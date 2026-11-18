import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { heuteInWien } from "@/lib/constants/zeitzone";
import { STUDIERENDEN_HOECHSTALTER, alterAm } from "@/lib/alter";

type ServiceClient = SupabaseClient<Database>;

/**
 * PROJ-102: Der Studierendenpreis endet mit 28 — angekündigt, nicht
 * überraschend.
 *
 * Zwei Schritte, beide im Tageslauf:
 *
 * 1. **Ankündigen.** Wird der Kunde zum nächsten erreichbaren Zyklusbeginn 28,
 *    bekommt er eine Nachricht: alter Preis, neuer Preis, Datum, und der Weg
 *    zum Kündigen. Das Abo merkt sich die Umstellung.
 * 2. **Umstellen.** Am angekündigten Tag wird der Preis gesetzt — es sei denn,
 *    das Abo wurde gekündigt, pausiert oder von Hand geändert.
 *
 * Wer kündigt, zahlt den neuen Preis **nie**: Eine Kündigung wirkt zum Ende des
 * laufenden Zyklus, und genau dann beginnt der neue Preis.
 *
 * Der Lauf steht hier und nicht in SQL, weil der Tageslauf seine Arbeit hier
 * hat (siehe `vollzieheFaelligeAenderungen` daneben) und weil die Rechnung so
 * ohne Datenbank prüfbar ist.
 */

/**
 * Der versprochene Mindestvorlauf vor einer Preisumstellung.
 *
 * Hiess bis PROJ-107 `ZYKLUS_TAGE` und war dasselbe wie die Zyklusdauer. Seit
 * ein Zyklus eingetragen wird, stimmt das nicht mehr — der erste Zyklus des
 * Studios ist 42 Tage lang, weil die Weihnachtspause darin liegt. Geblieben
 * ist die Zusage: mindestens vier Wochen zwischen Ankündigung und neuem Preis.
 * Ein Name, der eine Zyklusdauer behauptet, wäre dafür falsch.
 */
export const VORLAUF_TAGE = 28;

/** @deprecated Hiess früher so; der Wert ist der Mindestvorlauf, nicht die Zyklusdauer. */
export const ZYKLUS_TAGE = VORLAUF_TAGE;

/** Centgenauigkeit: Preise sind `numeric`, Vergleiche brauchen eine Toleranz. */
const CENT = 0.005;

export type StudentenpreisLaufErgebnis = {
  /** Wie viele Umstellungen in diesem Lauf angekündigt wurden. */
  angekuendigt: number;
  /** Wie viele Preise heute tatsächlich gesetzt wurden. */
  umgestellt: number;
  /** Angekündigte Umstellungen, die heute bewusst **nicht** griffen. */
  uebersprungen: number;
  /** Studierendenabos ohne Geburtsdatum am Kunden — für die Liste. */
  ohneGeburtsdatum: number;
};

/**
 * Der Tag, an dem der neue Preis beginnt — Rückfallweg ohne eingetragene
 * Zyklen.
 *
 * `naechstesZyklusende` kommt aus `next_cycle_end` und liegt zwischen einem und
 * 28 Tagen in der Zukunft. Liegt es näher als der versprochene Vorlauf, wird
 * ein Zyklus weiter gegangen: Lieber einmal zu früh angekündigt als eine
 * Erhöhung, der niemand mehr ausweichen kann.
 */
export function umstellungsDatum(naechstesZyklusende: string, heute: string): string {
  if (tageZwischen(heute, naechstesZyklusende) >= VORLAUF_TAGE) return naechstesZyklusende;
  return plusTage(naechstesZyklusende, VORLAUF_TAGE);
}

/** Ein eingetragener Zahlungszyklus, so weit er hier gebraucht wird. */
export type ZyklusZeitraum = { von: string; bis: string };

/**
 * Der Umstellungstag aus den eingetragenen Zyklen (PROJ-107).
 *
 * Ein neuer Preis beginnt **mit einem Zyklus**, nie mitten darin — sonst zahlte
 * jemand für denselben Zeitraum zwei Preise. Also: der Beginn des nächsten
 * Zyklus, und wenn der näher liegt als der versprochene Vorlauf, der Beginn
 * des übernächsten.
 *
 * Dass dieser Tag für **alle** Abos derselbe ist, ist kein Zufall, sondern der
 * ganze Zweck: Bis PROJ-107 hing er am Ankerdatum des einzelnen Abos und
 * zählte Ferien gar nicht mit — von den drei Zyklusrechnungen im Projekt war
 * das die am weitesten abgedriftete.
 *
 * `null` heisst: Für heute oder für den Folgezyklus ist nichts eingetragen.
 * Dann gilt der Rückfallweg, und der Aufrufer sagt es.
 */
export function umstellungAusZyklen(
  zyklen: ZyklusZeitraum[],
  heute: string,
  vorlaufTage: number = VORLAUF_TAGE
): string | null {
  const laufend = zyklen.find((z) => z.von <= heute && heute <= z.bis);
  if (!laufend) return null;

  const naechsterBeginn = plusTage(laufend.bis, 1);
  if (tageZwischen(heute, naechsterBeginn) >= vorlaufTage) return naechsterBeginn;

  const naechster = zyklen.find((z) => z.von === naechsterBeginn);
  if (!naechster) return null;
  return plusTage(naechster.bis, 1);
}

/** Ist der Kunde am Umstellungstag zu alt für den Studierendenpreis? */
export function zuAltAm(geburtsdatum: string | null | undefined, umstellung: string): boolean {
  const jahre = alterAm(geburtsdatum, umstellung);
  return jahre !== null && jahre > STUDIERENDEN_HOECHSTALTER;
}

/**
 * Gibt es überhaupt etwas zu erhöhen?
 *
 * Diese Prüfung ist der Rettungsanker für ein ungenaues Kennzeichen: Hat die
 * Verwaltung das Abo ohnehin zum Normalpreis bestätigt, obwohl die Anfrage den
 * Rabatt verlangt hatte, passiert nichts — keine Ankündigung, keine Mail.
 */
export function lohntUmstellung(preis: number | null, normalpreis: number | null): boolean {
  if (preis === null || normalpreis === null) return false;
  return normalpreis - preis > CENT;
}

export async function fuehreStudentenpreisLaufDurch(
  service: ServiceClient,
  heute: string = heuteInWien()
): Promise<StudentenpreisLaufErgebnis> {
  const ergebnis: StudentenpreisLaufErgebnis = {
    angekuendigt: 0,
    umgestellt: 0,
    uebersprungen: 0,
    ohneGeburtsdatum: 0,
  };

  await kuendigeUmstellungenAn(service, heute, ergebnis);
  await stelleFaelligeUm(service, heute, ergebnis);
  return ergebnis;
}

async function kuendigeUmstellungenAn(
  service: ServiceClient,
  heute: string,
  ergebnis: StudentenpreisLaufErgebnis
): Promise<void> {
  const { data: abos, error } = await service
    .from("subscriptions")
    .select("id, customer_id, name, price, cycle_anchor_date, profiles(birthdate)")
    .eq("status", "active")
    .eq("student_price", true)
    .is("pending_price_date", null);

  if (error) {
    console.error("PROJ-102: Studierendenabos nicht lesbar", error);
    return;
  }

  // PROJ-107: Der Umstellungstag ist für alle Abos derselbe, also einmal
  // gerechnet und nicht je Abo. Gelesen werden nur die Zyklen, die noch
  // kommen — mehr als zwei braucht die Rechnung nie.
  const { data: zyklusZeilen, error: zyklusLeseFehler } = await service
    .from("billing_cycles")
    .select("starts_on, ends_on")
    .gte("ends_on", heute)
    .order("starts_on")
    .limit(3);
  if (zyklusLeseFehler) {
    // Kein stiller Rückfall auf die alte Rechnung: Hier wird ein Preis
    // erhöht, und auf welchen Tag, muss nachvollziehbar sein.
    console.error("PROJ-107: Zahlungszyklen nicht lesbar", zyklusLeseFehler);
    return;
  }
  const gemeinsamerTag = umstellungAusZyklen(
    (zyklusZeilen ?? []).map((z) => ({ von: z.starts_on, bis: z.ends_on })),
    heute
  );
  if (!gemeinsamerTag) {
    console.warn(
      "PROJ-107: Kein Zyklus für heute oder den Folgezyklus eingetragen — " +
        "der Studierendenpreis rechnet nach der alten Regel je Abo."
    );
  }

  for (const abo of abos ?? []) {
    const geburtsdatum = abo.profiles?.birthdate ?? null;
    if (!geburtsdatum) {
      // Ohne Geburtsdatum keine Altersregel — und keine stille Erhöhung.
      // Gezählt wird es trotzdem, damit der Betreiber davon erfährt.
      ergebnis.ohneGeburtsdatum += 1;
      continue;
    }

    let umstellung: string;
    if (gemeinsamerTag) {
      umstellung = gemeinsamerTag;
    } else {
      // Rückfallweg: die Rechnung aus PROJ-102, am Anker des einzelnen Abos.
      const { data: zyklusende, error: zyklusFehler } = await service.rpc("next_cycle_end", {
        p_anchor: abo.cycle_anchor_date,
      });
      if (zyklusFehler || !zyklusende) {
        console.error(`PROJ-102: Zyklusende zu Abo ${abo.id} nicht errechenbar`, zyklusFehler);
        continue;
      }
      umstellung = umstellungsDatum(String(zyklusende), heute);
    }
    if (!zuAltAm(geburtsdatum, umstellung)) continue;

    const { data: normalpreis, error: preisFehler } = await service.rpc("abo_normalpreis", {
      p_subscription_id: abo.id,
    });
    if (preisFehler) {
      console.error(`PROJ-102: Normalpreis zu Abo ${abo.id} nicht lesbar`, preisFehler);
      continue;
    }

    const alt = abo.price === null ? null : Number(abo.price);
    const neu = normalpreis === null ? null : Number(normalpreis);
    if (!lohntUmstellung(alt, neu)) continue;

    const { data: geaendert, error: schreibFehler } = await service
      .from("subscriptions")
      .update({
        pending_price: neu,
        pending_price_old: alt,
        pending_price_date: umstellung,
        price_notice_sent_at: new Date().toISOString(),
      })
      .eq("id", abo.id)
      // Nur wenn noch nichts angekündigt ist: Zwei Läufe am selben Tag dürfen
      // keine zweite Ankündigung erzeugen.
      .is("pending_price_date", null)
      .select("id");

    if (schreibFehler) {
      console.error(`PROJ-102: Ankündigung zu Abo ${abo.id} nicht gespeichert`, schreibFehler);
      continue;
    }
    if (!geaendert || geaendert.length === 0) continue;

    const { error: queueFehler } = await service.from("notification_queue").insert({
      customer_id: abo.customer_id,
      event_type: "studentenpreis_endet",
      payload: {
        abo: abo.name ?? "Dein Abo",
        alt,
        neu,
        datum: umstellung,
      },
      // Zweite Sperre neben `price_notice_sent_at`: Dieselbe Umstellung wird
      // auch dann nur einmal verschickt, wenn jemand die Spalten zurücksetzt.
      dedupe_key: `studentenpreis_endet:${abo.id}:${umstellung}`,
    });
    if (queueFehler) {
      // Die Ankündigung steht am Abo, die Nachricht fehlt. Das ist der
      // schlimmste der möglichen Zustände, deshalb wird er zurückgedreht:
      // Lieber im nächsten Lauf noch einmal versuchen als am Stichtag einen
      // Preis erhöhen, von dem niemand erfahren hat.
      console.error(`PROJ-102: Nachricht zu Abo ${abo.id} nicht eingereiht`, queueFehler);
      await service
        .from("subscriptions")
        .update({
          pending_price: null,
          pending_price_old: null,
          pending_price_date: null,
          price_notice_sent_at: null,
        })
        .eq("id", abo.id);
      continue;
    }

    ergebnis.angekuendigt += 1;
  }
}

async function stelleFaelligeUm(
  service: ServiceClient,
  heute: string,
  ergebnis: StudentenpreisLaufErgebnis
): Promise<void> {
  // `lte`, nicht `eq`: Fällt ein Lauf aus, würde ein Stichtag sonst
  // übersprungen und die Umstellung bliebe für immer liegen.
  const { data: faellige, error } = await service
    .from("subscriptions")
    .select("id, status, price, pending_status, pending_price, pending_price_old, pending_price_date")
    .not("pending_price_date", "is", null)
    .lte("pending_price_date", heute);

  if (error) {
    console.error("PROJ-102: fällige Umstellungen nicht lesbar", error);
    return;
  }

  for (const abo of faellige ?? []) {
    const alt = abo.pending_price_old === null ? null : Number(abo.pending_price_old);
    const jetzt = abo.price === null ? null : Number(abo.price);

    // Drei Gründe, nichts zu tun — jeder davon ist Absicht:
    // gekündigt oder pausiert (dann zahlt der Kunde den neuen Preis nie),
    // nicht mehr aktiv, oder die Verwaltung hat den Preis von Hand geändert.
    const darf =
      abo.status === "active" &&
      abo.pending_status === null &&
      alt !== null &&
      jetzt !== null &&
      Math.abs(jetzt - alt) <= CENT;

    const { error: schreibFehler } = await service
      .from("subscriptions")
      .update({
        ...(darf ? { price: abo.pending_price } : {}),
        pending_price: null,
        pending_price_old: null,
        pending_price_date: null,
        price_notice_sent_at: null,
      })
      .eq("id", abo.id);

    if (schreibFehler) {
      console.error(`PROJ-102: Umstellung zu Abo ${abo.id} nicht gespeichert`, schreibFehler);
      continue;
    }

    if (darf) ergebnis.umgestellt += 1;
    else ergebnis.uebersprungen += 1;
  }
}

function tageZwischen(von: string, bis: string): number {
  return Math.round((alsUtc(bis) - alsUtc(von)) / 86_400_000);
}

function plusTage(datum: string, tage: number): string {
  const ms = alsUtc(datum) + tage * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Kalendertage als Zahl — ohne Zeitzonenanteil, beide Seiten gleich. */
function alsUtc(datum: string): number {
  const [jahr, monat, tag] = datum.split("-").map(Number);
  return Date.UTC(jahr, monat - 1, tag);
}
