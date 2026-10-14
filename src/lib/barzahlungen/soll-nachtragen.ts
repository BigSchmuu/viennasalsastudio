import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { naechsteFaelligkeit } from "@/lib/sepa/faelligkeit";
import { ladeFerien } from "@/lib/scheduling/ferien";
import { heuteInWien } from "@/lib/constants/zeitzone";
import type { Ferienzeitraum } from "@/lib/scheduling/dates";

type Client = SupabaseClient<Database>;

/**
 * Der Tag, ab dem die App mitrechnet (PROJ-83).
 *
 * Davor liefen die Barzahler auf Papier, und in der Datenbank stehen
 * Barzahlungen erst seit PROJ-81. Ohne diesen Schnitt bekäme jeder langjährige
 * Barzahler eine Schuld über Monate angeschrieben, die er längst bezahlt hat —
 * nur eben auf einem Zettel.
 *
 * Der Stichtag bleibt stehen, wenn er einmal vorbei ist: Er ist die Grenze der
 * Aufzeichnung, kein Schalter.
 */
export const BARZAHLUNG_STICHTAG = "2026-10-15";

/**
 * Höchstens so viele Zyklen rückwärts.
 *
 * Ein Abo von 2020 liegt über achtzig Zyklen zurück; die Schleife muss bis
 * dorthin kommen, sonst fehlten die Zeilen der letzten Wochen. Vierhundert
 * Runden sind rund dreißig Jahre und damit großzügig — die Rechnung läuft
 * einmal am Tag, und `naechsteFaelligkeit` kostet dabei wenig.
 */
const MAX_ZYKLEN = 400;

/**
 * Die Fälligkeitstage eines Abos im Fenster `[ab, bis]`.
 *
 * Gezählt wird ab `anker` — dem Zyklusbeginn des Abos —, damit jeder Kunde
 * seinen eigenen Rhythmus behält. Es sind dieselben Tage, nach denen auch der
 * Lastschriftlauf einzieht: vier Wochen Abstand, durch Ferien verlängert
 * (PROJ-70). Ausgegeben werden nur die Tage ab `ab`; die davor sind
 * abgerechnet, auf Papier oder per Einzug.
 */
export function sollTage(
  anker: string,
  bis: string,
  ab: string,
  ferien: Ferienzeitraum[]
): string[] {
  const tage: string[] = [];
  let tag = anker;

  for (let runde = 0; runde < MAX_ZYKLEN && tag <= bis; runde++) {
    if (tag >= ab) tage.push(tag);
    tag = naechsteFaelligkeit(tag, ferien);
  }

  return tage;
}

/** Der späteste der angegebenen Tage; leere Angaben zählen nicht mit. */
export function spaetester(...tage: (string | null | undefined)[]): string {
  return tage.filter((t): t is string => !!t).sort().at(-1) ?? "";
}

/** Der frühere von zwei Tagen. */
function frueherer(a: string, b: string): string {
  return a <= b ? a : b;
}

export type SollErgebnis = { angelegt: number; abos: number };

/**
 * Fällig gewordene Beiträge der Barzahler als Soll-Zeilen nachtragen (PROJ-83).
 *
 * Läuft im Morgenlauf. Wiederholbar: Die Eindeutigkeit über (Abo, Tag) lässt
 * einen doppelten Lauf nichts Zweites schreiben, und ein ausgefallener Lauf
 * holt am Folgetag nach.
 *
 * **Nur wer kein Mandat hat.** Solange eingezogen wird, entsteht gar kein Soll
 * — ein Einzug muss nichts abdecken, weil es nichts zu decken gibt. Wird ein
 * Mandat widerrufen, beginnt die Rechnung am Tag des Widerrufs und nicht am
 * Stichtag: Sonst entstünde für die Monate, in denen eingezogen wurde,
 * rückwirkend eine Schuld.
 *
 * Ein pausiertes Abo ist nicht `active` und sammelt deshalb nichts an; ein
 * gekündigtes hört an seinem Kündigungstag auf.
 */
export async function traegeFaelligesSollNach(
  service: Client,
  jetzt: Date = new Date()
): Promise<SollErgebnis> {
  const heute = heuteInWien(jetzt);

  const [aboRes, mandatRes] = await Promise.all([
    service
      .from("subscriptions")
      .select("id, customer_id, price, cycle_anchor_date, cancelled_at")
      .eq("status", "active"),
    // Nur diese zwei Spalten: In der Mandatstabelle stehen IBANs, und die
    // haben hier nichts zu suchen.
    service.from("sepa_mandates").select("customer_id, revoked_at"),
  ]);

  // Ein Lesefehler darf nicht als „keine Barzahler" durchgehen — sonst
  // entstünde kein Soll, und alle Zeilen sähen bezahlt aus. Der Morgenlauf
  // fängt den Wurf je Schritt ab und meldet ihn.
  if (aboRes.error) throw new Error(`Abos nicht lesbar: ${aboRes.error.message}`);
  if (mandatRes.error) throw new Error(`Mandate nicht lesbar: ${mandatRes.error.message}`);

  const mitMandat = new Set<string>();
  const widerrufAm = new Map<string, string>();
  for (const mandat of mandatRes.data ?? []) {
    if (mandat.revoked_at === null) {
      mitMandat.add(mandat.customer_id);
      continue;
    }
    const tag = mandat.revoked_at.slice(0, 10);
    widerrufAm.set(mandat.customer_id, spaetester(widerrufAm.get(mandat.customer_id), tag));
  }

  const ferien = await ladeFerien(service);

  const zeilen: Database["public"]["Tables"]["cash_dues"]["Insert"][] = [];
  let abos = 0;

  for (const abo of aboRes.data ?? []) {
    // Ohne Preis kein Soll. Die Zeile sagt in der Oberfläche „Kein Preis am
    // Abo" — eine Schuld über null Euro wäre nur verwirrend.
    if (abo.price === null || abo.price <= 0) continue;
    if (mitMandat.has(abo.customer_id)) continue;

    const bis = abo.cancelled_at ? frueherer(heute, abo.cancelled_at.slice(0, 10)) : heute;
    const ab = spaetester(
      BARZAHLUNG_STICHTAG,
      abo.cycle_anchor_date,
      widerrufAm.get(abo.customer_id)
    );

    const tage = sollTage(abo.cycle_anchor_date, bis, ab, ferien);
    if (tage.length > 0) abos += 1;

    for (const tag of tage) {
      zeilen.push({
        subscription_id: abo.id,
        customer_id: abo.customer_id,
        due_on: tag,
        amount: abo.price,
      });
    }
  }

  if (zeilen.length === 0) return { angelegt: 0, abos: 0 };

  // `ignoreDuplicates` statt eines Abgleichs vorher: Die Eindeutigkeit steht in
  // der Datenbank, und sie ist die verlässlichere Stelle dafür. Zurück kommen
  // nur die wirklich neuen Zeilen — das ist die Zahl, die der Lauf meldet.
  const { data, error } = await service
    .from("cash_dues")
    .upsert(zeilen, { onConflict: "subscription_id,due_on", ignoreDuplicates: true })
    .select("id");

  if (error) throw new Error(`Soll-Zeilen nicht geschrieben: ${error.message}`);

  return { angelegt: (data ?? []).length, abos };
}
