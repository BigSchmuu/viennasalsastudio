import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Ferienzeitraum, Kurszeitraum } from "@/lib/scheduling/dates";

type Client = SupabaseClient<Database>;

/**
 * Die studioweiten Ferien (PROJ-51).
 *
 * Ein gemeinsamer Weg, sie zu laden — damit nicht jede der vierzehn Stellen,
 * die Kurstermine berechnet, ihre eigene Abfrage schreibt und dabei eine
 * Kleinigkeit anders macht. Dieselbe Überlegung wie bei der
 * Kurszugehörigkeit aus PROJ-50.
 *
 * Öffentlich lesbar: Der Stundenplan zeigt die Ferien auch anonymen Besuchern,
 * und ein Kurstermin fällt für alle gleichermaßen aus.
 */
export async function ladeFerien(supabase: Client): Promise<Ferienzeitraum[]> {
  const { data, error } = await supabase
    .from("studio_holidays")
    .select("starts_on, ends_on")
    .order("starts_on", { ascending: true });

  // Eine leere Liste ohne Fehlerprüfung ist eine unbeantwortete Frage: Sie
  // sähe genauso aus wie „keine Ferien" und ließe jeden Ferientermin
  // stattfinden. Siehe .claude/rules/backend.md.
  if (error) {
    console.error("Ferien nicht lesbar", error);
    return [];
  }

  return (data ?? []).map((f) => ({ von: f.starts_on, bis: f.ends_on }));
}

/** Dasselbe mit Namen — für die Hinweisleiste im Stundenplan. */
export async function ladeFerienMitNamen(
  supabase: Client
): Promise<{ name: string; von: string; bis: string }[]> {
  const { data, error } = await supabase
    .from("studio_holidays")
    .select("name, starts_on, ends_on")
    .order("starts_on", { ascending: true });

  if (error) {
    console.error("Ferien nicht lesbar", error);
    return [];
  }

  return (data ?? []).map((f) => ({ name: f.name, von: f.starts_on, bis: f.ends_on }));
}

/**
 * Der Zeitraum eines Kurses aus seiner Datenzeile.
 *
 * Als eigene Funktion, damit die Umrechnung von Spaltennamen auf den Begriff
 * an einer Stelle steht und nicht an vierzehn.
 */
export function kurszeitraum(kurs: {
  runs_from?: string | null;
  runs_until?: string | null;
}): Kurszeitraum {
  return { von: kurs.runs_from ?? null, bis: kurs.runs_until ?? null };
}

/**
 * „Unbefristet" — ausdrücklich, nicht aus Versehen.
 *
 * Für Aufrufer, die gar keinen Kurs in der Hand haben und nur eine
 * Wochentagsrechnung brauchen. Wer das benutzt, sagt damit: Hier gibt es
 * bewusst keinen Zeitraum zu berücksichtigen.
 */
export const UNBEFRISTET: Kurszeitraum = { von: null, bis: null };
