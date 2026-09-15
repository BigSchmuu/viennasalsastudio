"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { eventSeriesSchema, terminVerlegenSchema, type EventSeriesInput } from "@/lib/validations/events";
import { enqueueNotification } from "@/lib/notifications/dispatch";
import { eindeutigeAdresse, eventAdresse } from "@/lib/events/adresse";
import { vergebeneAdressen } from "@/lib/actions/admin/adressen";
import { serientermine, SERIE_AKTIV, SERIE_BEENDET } from "@/lib/events/serie";
import { ladeFerien } from "@/lib/scheduling/ferien";
import { viennaWallClockToDate } from "@/lib/scheduling/dates";
import type { ActionResult } from "@/lib/actions/types";

type AdminSupabase = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

const GUELTIGE_TICKETS = ["reserved", "confirmed", "checked_in"];
const OFFENE_TICKETS = ["reserved", "confirmed"];

function parseSerienFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    description: formData.get("description"),
    location: formData.get("location"),
    event_type_id: formData.get("event_type_id"),
    sales_mode: formData.get("sales_mode"),
    weekday: formData.get("weekday"),
    start_time: formData.get("start_time"),
    end_time: formData.get("end_time"),
    starts_on: formData.get("starts_on"),
    ends_on: formData.get("ends_on"),
    pause_in_holidays: formData.get("pause_in_holidays"),
    capacity: formData.get("capacity"),
    price_normal: formData.get("price_normal"),
    price_student: formData.get("price_student"),
  };
}

function zahlOderNull(wert: string | undefined): number | null {
  return wert ? Number(wert) : null;
}

function serienSpalten(data: EventSeriesInput) {
  return {
    name: data.name,
    description: data.description || null,
    location: data.location || null,
    event_type_id: data.event_type_id,
    sales_mode: data.sales_mode,
    weekday: Number(data.weekday),
    start_time: data.start_time,
    end_time: data.end_time || null,
    starts_on: data.starts_on,
    ends_on: data.ends_on || null,
    pause_in_holidays: data.pause_in_holidays === "true",
    capacity: zahlOderNull(data.capacity),
    price_normal: zahlOderNull(data.price_normal),
    price_student: zahlOderNull(data.price_student),
  };
}

/**
 * Beginn und Ende eines Termins als echte Zeitpunkte.
 *
 * Gerechnet wird in Wiener Zeit: „21:00" heißt 21:00 in Wien, auch wenn der
 * Server in UTC läuft. Endet die Party vor ihrem Beginn, liegt das Ende am
 * Folgetag — eine Party von 21:00 bis 02:00 ist ein Abend, keine 19 Stunden.
 */
function terminZeitpunkte(datum: string, startTime: string, endTime: string | null) {
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

type SerieZeile = {
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

const SERIEN_SPALTEN =
  "id, name, slug, description, location, event_type_id, sales_mode, weekday, start_time, end_time, starts_on, ends_on, pause_in_holidays, capacity, price_normal, price_student";

/** Die Angaben, die ein Termin von seiner Serie erbt. */
function geerbteSpalten(serie: SerieZeile) {
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
 * Legt die fehlenden Termine im Vorschaufenster an (PROJ-54).
 *
 * Läuft beim Speichern einer Serie und künftig auch im nächtlichen Lauf.
 * Vorhandene Termine bleiben unangetastet: Sie können Tickets tragen, abgesagt
 * oder verlegt sein.
 */
async function legeTermineAn(supabase: AdminSupabase, serie: SerieZeile): Promise<number> {
  const ferien = await ladeFerien(supabase);
  const daten = serientermine(
    {
      weekday: serie.weekday,
      startsOn: serie.starts_on,
      endsOn: serie.ends_on,
      pausiertInFerien: serie.pause_in_holidays,
    },
    { ferien }
  );
  if (daten.length === 0) return 0;

  const { data: vorhanden, error } = await supabase
    .from("events")
    .select("occurrence_date")
    .eq("series_id", serie.id)
    .in("occurrence_date", daten);
  if (error) {
    console.error("Vorhandene Serientermine nicht lesbar", error);
    return 0;
  }

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
    console.error("Serientermine konnten nicht angelegt werden", anlegeFehler);
    return 0;
  }
  return fehlende.length;
}

/** Ticket-Inhaber eines Termins benachrichtigen — abgesagt oder verlegt. */
async function benachrichtigeTicketInhaber(
  supabase: AdminSupabase,
  eventId: string,
  subType: "event_cancelled" | "event_moved",
  merkmal: string
): Promise<void> {
  const { data: tickets } = await supabase
    .from("tickets")
    .select("id, customer_id")
    .eq("event_id", eventId)
    .in("status", OFFENE_TICKETS);

  await Promise.all(
    (tickets ?? []).map((ticket) =>
      enqueueNotification({
        customerId: ticket.customer_id,
        eventType: "event_tickets",
        payload: { sub_type: subType, event_id: eventId },
        // Je Ticket und Anlass einmal: Ein zweites Verlegen ist eine neue
        // Nachricht, dasselbe Verlegen nicht.
        dedupeKey: `event_ticket_${subType}:${ticket.id}:${merkmal}`,
      })
    )
  );
}

function neuLaden(...adressen: string[]) {
  revalidatePath("/admin/events");
  revalidatePath("/events");
  revalidatePath("/mein-bereich");
  for (const adresse of adressen) revalidatePath(`/events/${adresse}`);
}

export async function createEventSeries(formData: FormData): Promise<ActionResult> {
  const parsed = eventSeriesSchema.safeParse(parseSerienFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const basis = eventAdresse(parsed.data.name);
  const vergeben = await vergebeneAdressen(supabase, basis);
  if (!vergeben) {
    return { error: "Serie konnte nicht angelegt werden." };
  }

  const { data: serie, error } = await supabase
    .from("event_series")
    .insert({ ...serienSpalten(parsed.data), slug: eindeutigeAdresse(basis, vergeben), status: SERIE_AKTIV })
    .select(SERIEN_SPALTEN)
    .single();

  if (error || !serie) {
    console.error("Serie konnte nicht angelegt werden", error);
    return { error: "Serie konnte nicht angelegt werden." };
  }

  // Sofort, nicht erst im nächtlichen Lauf: Sonst stünde die Serie ohne
  // Termine da, und der Admin hielte sie für kaputt.
  await legeTermineAn(supabase, serie);
  neuLaden(serie.slug);
  return { success: true };
}

export async function updateEventSeries(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = eventSeriesSchema.safeParse(parseSerienFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { data: serie, error: ladeFehler } = await supabase
    .from("event_series")
    .update(serienSpalten(parsed.data))
    .eq("id", id)
    .select(SERIEN_SPALTEN)
    .single();

  if (ladeFehler || !serie) {
    console.error("Serie konnte nicht gespeichert werden", ladeFehler);
    return { error: "Serie konnte nicht gespeichert werden." };
  }

  await richteKuenftigeTermineAus(supabase, serie);
  await legeTermineAn(supabase, serie);
  neuLaden(serie.slug);
  return { success: true };
}

/**
 * Bringt die künftigen Termine mit der geänderten Serie in Einklang.
 *
 * Unangetastet bleiben abgesagte und einzeln verlegte Termine: Wer einen
 * Termin bewusst verschoben hat, will ihn nicht von der nächsten
 * Serienänderung überschrieben sehen.
 */
async function richteKuenftigeTermineAus(supabase: AdminSupabase, serie: SerieZeile): Promise<void> {
  const ferien = await ladeFerien(supabase);
  const gueltig = new Set(
    serientermine(
      {
        weekday: serie.weekday,
        startsOn: serie.starts_on,
        endsOn: serie.ends_on,
        pausiertInFerien: serie.pause_in_holidays,
      },
      { ferien }
    )
  );

  const { data: kuenftige, error } = await supabase
    .from("events")
    .select("id, occurrence_date, starts_at, ends_at, location, slug")
    .eq("series_id", serie.id)
    .eq("status", "geplant")
    .eq("overridden", false)
    .gt("starts_at", new Date().toISOString());
  if (error) {
    console.error("Künftige Serientermine nicht lesbar", error);
    return;
  }

  for (const termin of kuenftige ?? []) {
    if (!termin.occurrence_date) continue;

    // Fällt der Termin nach der Änderung aus dem Rhythmus, verschwindet er —
    // es sei denn, jemand hat schon ein Ticket. Dann wird er abgesagt, damit
    // die Inhaber es erfahren.
    if (!gueltig.has(termin.occurrence_date)) {
      const { count } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("event_id", termin.id)
        .in("status", GUELTIGE_TICKETS);

      if ((count ?? 0) > 0) {
        await supabase.from("events").update({ status: "abgesagt" }).eq("id", termin.id);
        await benachrichtigeTicketInhaber(supabase, termin.id, "event_cancelled", termin.occurrence_date);
      } else {
        await supabase.from("events").delete().eq("id", termin.id);
      }
      continue;
    }

    const zeiten = terminZeitpunkte(termin.occurrence_date, serie.start_time, serie.end_time);
    const verlegt = zeiten.starts_at !== termin.starts_at || (serie.location ?? null) !== termin.location;

    await supabase
      .from("events")
      .update({
        ...geerbteSpalten(serie),
        ...zeiten,
        ...(verlegt ? { moved_at: new Date().toISOString() } : {}),
      })
      .eq("id", termin.id);

    if (verlegt) {
      await benachrichtigeTicketInhaber(supabase, termin.id, "event_moved", zeiten.starts_at);
    }
  }
}

/** Wie viele gültige Tickets hängen an künftigen Terminen dieser Serie? */
export async function countTicketsOnFutureOccurrences(seriesId: string): Promise<number> {
  const { supabase } = await requireAdmin();
  const { data: termine } = await supabase
    .from("events")
    .select("id")
    .eq("series_id", seriesId)
    .gt("starts_at", new Date().toISOString());

  const ids = (termine ?? []).map((termin) => termin.id);
  if (ids.length === 0) return 0;

  const { count } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .in("event_id", ids)
    .in("status", GUELTIGE_TICKETS);
  return count ?? 0;
}

export async function endEventSeries(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { data: serie, error } = await supabase
    .from("event_series")
    .update({ status: SERIE_BEENDET })
    .eq("id", id)
    .select("id, slug")
    .single();

  if (error || !serie) {
    return { error: "Serie konnte nicht beendet werden." };
  }

  const { data: kuenftige } = await supabase
    .from("events")
    .select("id")
    .eq("series_id", id)
    .eq("status", "geplant")
    .gt("starts_at", new Date().toISOString());

  for (const termin of kuenftige ?? []) {
    const { count } = await supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("event_id", termin.id)
      .in("status", GUELTIGE_TICKETS);

    if ((count ?? 0) > 0) {
      await supabase.from("events").update({ status: "abgesagt" }).eq("id", termin.id);
      await benachrichtigeTicketInhaber(supabase, termin.id, "event_cancelled", "serie-beendet");
    } else {
      await supabase.from("events").delete().eq("id", termin.id);
    }
  }

  neuLaden(serie.slug);
  return { success: true };
}

export type SerienTerminZeile = {
  id: string;
  slug: string;
  startsAt: string;
  endsAt: string | null;
  abgesagt: boolean;
  verlegt: boolean;
  ticketCount: number;
};

/** Die Termine einer Serie für die Verwaltung — vergangene bleiben außen vor. */
export async function getSeriesOccurrences(seriesId: string): Promise<SerienTerminZeile[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("events")
    .select("id, slug, starts_at, ends_at, status, overridden, tickets(status)")
    .eq("series_id", seriesId)
    .gt("starts_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    console.error("Serientermine nicht lesbar", error);
    return [];
  }

  return (data ?? []).map((termin) => ({
    id: termin.id,
    slug: termin.slug,
    startsAt: termin.starts_at,
    endsAt: termin.ends_at,
    abgesagt: termin.status === "abgesagt",
    verlegt: termin.overridden,
    ticketCount: termin.tickets.filter((ticket) => ticket.status !== "cancelled").length,
  }));
}

export async function cancelSeriesOccurrence(eventId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { data: termin, error } = await supabase
    .from("events")
    .update({ status: "abgesagt" })
    .eq("id", eventId)
    .select("id, slug, occurrence_date")
    .single();

  if (error || !termin) {
    return { error: "Termin konnte nicht abgesagt werden." };
  }

  await benachrichtigeTicketInhaber(supabase, eventId, "event_cancelled", termin.occurrence_date ?? eventId);
  neuLaden(termin.slug);
  return { success: true };
}

/** Eine Absage zurücknehmen, solange der Termin noch nicht stattgefunden hat. */
export async function restoreSeriesOccurrence(eventId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { data: termin, error } = await supabase
    .from("events")
    .update({ status: "geplant" })
    .eq("id", eventId)
    .gt("starts_at", new Date().toISOString())
    .select("id, slug")
    .maybeSingle();

  if (error || !termin) {
    return { error: "Die Absage konnte nicht zurückgenommen werden — der Termin liegt vielleicht schon zurück." };
  }

  neuLaden(termin.slug);
  return { success: true };
}

export async function moveSeriesOccurrence(eventId: string, formData: FormData): Promise<ActionResult> {
  const parsed = terminVerlegenSchema.safeParse({
    starts_at: formData.get("starts_at"),
    ends_at: formData.get("ends_at"),
    location: formData.get("location"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { data: bisher, error: ladeFehler } = await supabase
    .from("events")
    .select("id, series_id, occurrence_date")
    .eq("id", eventId)
    .maybeSingle();
  if (ladeFehler || !bisher?.series_id) {
    return { error: "Termin nicht gefunden." };
  }

  const neuesDatum = new Date(parsed.data.starts_at).toISOString().slice(0, 10);
  if (neuesDatum !== bisher.occurrence_date) {
    const { data: kollision } = await supabase
      .from("events")
      .select("id")
      .eq("series_id", bisher.series_id)
      .eq("occurrence_date", neuesDatum)
      .maybeSingle();
    if (kollision) {
      return { error: "An diesem Tag hat die Serie bereits einen Termin." };
    }
  }

  const { data: termin, error } = await supabase
    .from("events")
    .update({
      starts_at: new Date(parsed.data.starts_at).toISOString(),
      ends_at: parsed.data.ends_at ? new Date(parsed.data.ends_at).toISOString() : null,
      location: parsed.data.location || null,
      occurrence_date: neuesDatum,
      // Ab jetzt weicht dieser Termin bewusst ab — Serienänderungen lassen ihn
      // in Ruhe, und Ticket-Inhaber dürfen ohne Frist stornieren.
      overridden: true,
      moved_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .select("id, slug")
    .single();

  if (error || !termin) {
    console.error("Termin konnte nicht verlegt werden", error);
    return { error: "Termin konnte nicht verlegt werden." };
  }

  await benachrichtigeTicketInhaber(supabase, eventId, "event_moved", parsed.data.starts_at);
  neuLaden(termin.slug);
  return { success: true };
}
