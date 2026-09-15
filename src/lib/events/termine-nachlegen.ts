import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Ferienzeitraum } from "@/lib/scheduling/dates";
import { viennaWallClockToDate } from "@/lib/scheduling/dates";
import { ladeFerien } from "@/lib/scheduling/ferien";
import { serientermine, SERIE_AKTIV } from "@/lib/events/serie";

type Client = SupabaseClient<Database>;

export const SERIEN_SPALTEN =
  "id, name, slug, description, location, event_type_id, sales_mode, weekday, start_time, end_time, starts_on, ends_on, pause_in_holidays, capacity, price_normal, price_student";

/** Eine Serie so, wie `SERIEN_SPALTEN` sie liest. */
export type SerieZeile = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  location: string | null;
  event_type_id: string;
  sales_mode: string;
  weekday: number;
  start_time: string;
  end_time: string | null;
  starts_on: string;
  ends_on: string | null;
  pause_in_holidays: boolean;
  capacity: number | null;
  price_normal: number | null;
  price_student: number | null;
};

/** Die Angaben, die ein Termin von seiner Serie erbt. */
export function geerbteSpalten(serie: SerieZeile) {
  return {
    name: serie.name,
    description: serie.description,
    location: serie.location,
    event_type_id: serie.event_type_id,
    sales_mode: serie.sales_mode,
    capacity: serie.capacity,
    price_normal: serie.price_normal,
    price_student: serie.price_student,
  };
}

/**
 * Beginn und Ende eines Termins als echte Zeitpunkte.
 *
 * Gerechnet wird in Wiener Zeit: „21:00" heißt 21:00 in Wien, auch wenn der
 * Server in UTC läuft. Endet die Party vor ihrem Beginn, liegt das Ende am
 * Folgetag — eine Party von 21:00 bis 02:00 ist ein Abend, keine 19 Stunden.
 */
export function terminZeitpunkte(datum: string, startTime: string, endTime: string | null) {
  const beginn = viennaWallClockToDate(datum, startTime);
  if (!endTime) return { starts_at: beginn.toISOString(), ends_at: null };

  let ende = viennaWallClockToDate(datum, endTime);
  if (ende <= beginn) {
    ende = viennaWallClockToDate(tagDanach(datum), endTime);
  }
  return { starts_at: beginn.toISOString(), ends_at: ende.toISOString() };
}

function tagDanach(datum: string): string {
  return new Date(Date.parse(`${datum}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/**
 * Legt die fehlenden Termine einer Serie im Vorschaufenster an.
 *
 * Eine Tür für beide Anlässe: das Speichern einer Serie in der Verwaltung und
 * der nächtliche Lauf. Liefe das Nachlegen an zwei Stellen, würde eine davon
 * früher oder später anders rechnen — und der Unterschied fiele erst auf,
 * wenn ein Abend fehlt.
 *
 * Vorhandene Termine bleiben unangetastet: Sie können Tickets tragen,
 * abgesagt oder einzeln verlegt sein.
 */
export async function legeSerienTermineAn(supabase: Client, serie: SerieZeile, ferien?: Ferienzeitraum[]) {
  const daten = serientermine(
    {
      weekday: serie.weekday,
      startsOn: serie.starts_on,
      endsOn: serie.ends_on,
      pausiertInFerien: serie.pause_in_holidays,
    },
    { ferien: ferien ?? (await ladeFerien(supabase)) }
  );
  if (daten.length === 0) return 0;

  const { data: vorhanden, error } = await supabase
    .from("events")
    .select("occurrence_date")
    .eq("series_id", serie.id)
    .in("occurrence_date", daten);
  // Eine leere Liste ohne Fehlerprüfung sähe aus wie „noch keine Termine" —
  // und der Lauf legte jeden Abend ein zweites Mal an.
  if (error) throw new Error(`Vorhandene Termine der Serie ${serie.slug} nicht lesbar: ${error.message}`);

  const schonDa = new Set((vorhanden ?? []).map((termin) => termin.occurrence_date));
  const fehlende = daten.filter((datum) => !schonDa.has(datum));
  if (fehlende.length === 0) return 0;

  const { error: anlegeFehler } = await supabase.from("events").insert(
    fehlende.map((datum) => ({
      ...geerbteSpalten(serie),
      ...terminZeitpunkte(datum, serie.start_time, serie.end_time),
      series_id: serie.id,
      occurrence_date: datum,
      slug: `${serie.slug}-${datum}`,
      status: "geplant",
    }))
  );
  if (anlegeFehler) {
    throw new Error(`Termine der Serie ${serie.slug} nicht anlegbar: ${anlegeFehler.message}`);
  }
  return fehlende.length;
}

/**
 * Der nächtliche Schritt: Für jede laufende Serie die Termine im
 * Vorschaufenster auffüllen.
 *
 * Eine Serie, die stolpert, kostet nicht die anderen — gemeldet wird sie
 * trotzdem, damit ein halb gelungener Lauf nicht wie ein gelungener aussieht.
 */
export async function ergaenzeSerienTermine(supabase: Client): Promise<{ serien: number; termine: number }> {
  const { data, error } = await supabase.from("event_series").select(SERIEN_SPALTEN).eq("status", SERIE_AKTIV);
  if (error) throw new Error(`Serien nicht lesbar: ${error.message}`);

  const serien = data ?? [];
  if (serien.length === 0) return { serien: 0, termine: 0 };

  const ferien = await ladeFerien(supabase);
  const fehler: string[] = [];
  let termine = 0;

  for (const serie of serien) {
    try {
      termine += await legeSerienTermineAn(supabase, serie, ferien);
    } catch (ursache) {
      fehler.push(ursache instanceof Error ? ursache.message : String(ursache));
    }
  }

  if (fehler.length > 0) throw new Error(fehler.join("; "));
  return { serien: serien.length, termine };
}
