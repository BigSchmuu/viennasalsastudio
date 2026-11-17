import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { FruehererEinzug, Zyklus } from "@/lib/sepa/ausgelassen";

/**
 * Die Zyklen des Studios, gelesen (PROJ-107).
 *
 * Diese Datei ist absichtlich klein und absichtlich geteilt: Sowohl das
 * Anlegen eines Laufs als auch die Seite des Entwurfs brauchen genau dieselben
 * zwei Auskünfte — welcher Zyklus gilt, und welche Einzüge gehören zu welchem
 * Zyklus. Bis PROJ-103 standen solche Fragen zweimal im Code, einmal zählend
 * und einmal erklärend. Das soll sich hier nicht wiederholen.
 */

type Client = SupabaseClient<Database>;

const AUSWAHL = "id, starts_on, ends_on";

function alsZyklus(zeile: { id: string; starts_on: string; ends_on: string }): Zyklus {
  return { id: zeile.id, von: zeile.starts_on, bis: zeile.ends_on };
}

/**
 * Der Zyklus, in den dieser Tag fällt — oder `null`.
 *
 * `null` ist kein Fehler: Für Tage vor der Umstellung gibt es keinen Zyklus,
 * und dann gilt die Vier-Wochen-Rechnung aus PROJ-70. Der Aufrufer muss das
 * aber **sagen**, statt stillschweigend zurückzufallen.
 */
export async function ladeZyklusFuer(supabase: Client, tag: string): Promise<Zyklus | null> {
  const { data, error } = await supabase
    .from("billing_cycles")
    .select(AUSWAHL)
    .lte("starts_on", tag)
    .gte("ends_on", tag)
    .maybeSingle();

  // Ein Lesefehler darf nicht als „kein Zyklus" durchgehen — das wäre ein
  // stiller Rückfall auf die alte Regel. Siehe .claude/rules/backend.md.
  if (error) {
    console.error("PROJ-107: Zyklus nicht lesbar", error);
    throw new Error("Die Zahlungszyklen konnten nicht gelesen werden");
  }
  return data ? alsZyklus(data) : null;
}

/** Ein bestimmter Zyklus, etwa der, an dem ein Lauf hängt. */
export async function ladeZyklus(supabase: Client, id: string | null): Promise<Zyklus | null> {
  if (!id) return null;
  const { data, error } = await supabase
    .from("billing_cycles")
    .select(AUSWAHL)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("PROJ-107: Zyklus nicht lesbar", error);
    throw new Error("Die Zahlungszyklen konnten nicht gelesen werden");
  }
  return data ? alsZyklus(data) : null;
}

type EinzugsZeile = {
  subscription_id: string | null;
  sepa_collection_runs: { due_date: string; cycle_id: string | null } | null;
};

/**
 * Je Abo seine bisherigen Einzüge — mit dem Zyklus, für den sie einzogen.
 *
 * Entwürfe zählen mit, unverändert seit PROJ-70: Zwei offene Entwürfe zum
 * selben Zyklus wären zwei Abbuchungen, sobald beide bestätigt werden.
 */
export function einzuegeJeAbo(zeilen: EinzugsZeile[] | null): Map<string, FruehererEinzug[]> {
  const je = new Map<string, FruehererEinzug[]>();
  for (const zeile of zeilen ?? []) {
    const abo = zeile.subscription_id;
    const lauf = zeile.sepa_collection_runs;
    if (!abo || !lauf?.due_date) continue;
    const bisher = je.get(abo) ?? [];
    bisher.push({ faellig: lauf.due_date, zyklusId: lauf.cycle_id });
    je.set(abo, bisher);
  }
  return je;
}
