import { createClient } from "@/lib/supabase/server";
import { ladeFerien } from "@/lib/scheduling/ferien";
import { heuteInWien } from "@/lib/constants/zeitzone";
import { zyklusVorschlag } from "@/lib/sepa/zyklus-vorschlag";
import {
  ZyklenManager,
  type ZyklusZeile,
  type ZyklusZustand,
} from "@/components/admin/zyklen/zyklen-manager";

const TAG_MS = 86_400_000;

function tageZwischen(von: string, bis: string): number {
  return Math.round((Date.parse(`${bis}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`)) / TAG_MS);
}

/**
 * Die Zahlungszyklen des Studios (PROJ-107).
 *
 * Der Zustand einer Zeile wird **abgeleitet** und nicht gespeichert:
 * „abgerechnet", „laufend" und „künftig" ergeben sich aus dem heutigen Tag und
 * den Läufen. Eine gespeicherte Markierung könnte veralten — und zwar
 * unbemerkt, weil niemand sie prüft.
 */
export default async function ZyklenPage() {
  const supabase = await createClient();

  const [zyklenRes, laeufeRes, ferien] = await Promise.all([
    supabase.from("billing_cycles").select("id, starts_on, ends_on").order("starts_on", {
      ascending: false,
    }),
    supabase.from("sepa_collection_runs").select("cycle_id").not("cycle_id", "is", null),
    ladeFerien(supabase),
  ]);

  // Ein Lesefehler darf nicht als „noch kein Zyklus" durchgehen: Die Seite
  // würde dann zum Anlegen eines Zyklus auffordern, der längst existiert, und
  // die Datenbank wiese ihn als Überschneidung ab. Dieselbe Lehre wie bei den
  // Kündigungen (PROJ-79) und der Lehrerseite (PROJ-50).
  if (zyklenRes.error || laeufeRes.error) {
    console.error("PROJ-107: Zyklen nicht lesbar", zyklenRes.error ?? laeufeRes.error);
    throw new Error("Die Zahlungszyklen konnten nicht geladen werden");
  }

  const heute = heuteInWien();
  const laeufeJeZyklus = new Map<string, number>();
  for (const lauf of laeufeRes.data ?? []) {
    if (!lauf.cycle_id) continue;
    laeufeJeZyklus.set(lauf.cycle_id, (laeufeJeZyklus.get(lauf.cycle_id) ?? 0) + 1);
  }

  const zyklen: ZyklusZeile[] = (zyklenRes.data ?? []).map((z) => {
    const laeufe = laeufeJeZyklus.get(z.id) ?? 0;
    const zustand: ZyklusZustand =
      laeufe > 0
        ? "abgerechnet"
        : z.starts_on > heute
          ? "kuenftig"
          : z.ends_on >= heute
            ? "laufend"
            : // Vorbei und nie abgerechnet. Das ist kein Randfall, sondern die
              // Lage, die dieses Vorhaben ausgelöst hat: ein Zeitraum, für den
              // niemand eingezogen hat. Sie bekommt ihren eigenen Zustand,
              // damit sie auffällt.
              "offen";
    return {
      id: z.id,
      von: z.starts_on,
      bis: z.ends_on,
      tage: tageZwischen(z.starts_on, z.ends_on) + 1,
      laeufe,
      zustand,
    };
  });

  // Die Liste ist absteigend sortiert, der jüngste Zyklus steht also vorn.
  const letztesEnde = zyklen[0]?.bis ?? null;
  const vorschlag = zyklusVorschlag(letztesEnde, ferien, heute);
  const vorlaufTage = letztesEnde ? tageZwischen(heute, letztesEnde) : null;

  return (
    <ZyklenManager
      zyklen={zyklen}
      vorschlag={vorschlag}
      letztesEnde={letztesEnde}
      vorlaufTage={vorlaufTage}
    />
  );
}
