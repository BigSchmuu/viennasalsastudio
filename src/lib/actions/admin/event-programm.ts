"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { einheitSchema, gastSchema, ticketartSchema } from "@/lib/validations/tickets";
import { einheitImEvent, GELTUNG_AUSWAHL, type Geltung } from "@/lib/events/tickets";
import type { DanceRole } from "@/lib/constants/booking";
import type { ActionResult } from "@/lib/actions/types";

type AdminSupabase = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

const GUELTIGE_TICKETS = ["reserved", "confirmed", "checked_in"];

export type EinheitZeile = {
  id: string;
  titel: string;
  startsAt: string;
  endsAt: string | null;
  kapazitaet: number | null;
  /** Gültige Tickets, die für diese Einheit gelten. */
  belegt: number;
};

export type TicketartZeile = {
  id: string;
  name: string;
  preisNormal: number;
  preisStudierend: number;
  kontingent: number | null;
  geltung: Geltung;
  einheitIds: string[];
  imVerkauf: boolean;
  verkauft: number;
};

export type GastZeile = {
  id: string;
  name: string;
  notiz: string | null;
  rolle: DanceRole | null;
  einheitIds: string[];
};

export type EventProgramm = {
  einheiten: EinheitZeile[];
  ticketarten: TicketartZeile[];
  gaeste: GastZeile[];
};

async function neuLaden(supabase: AdminSupabase, eventId: string) {
  revalidatePath("/admin/events");
  revalidatePath("/events");
  const { data } = await supabase.from("events").select("slug").eq("id", eventId).maybeSingle();
  if (data?.slug) revalidatePath(`/events/${data.slug}`);
}

/**
 * Wie viele gültige Tickets in jeder Einheit sitzen.
 *
 * Ein Ticket zählt in jeder Einheit, für die seine Art gilt — ein Full Pass
 * also in allen. Sonst wären drei Einheiten à 20 Plätze zusammen 60 Tickets
 * für einen Raum, in dem 20 Leute stehen.
 */
function belegungRechnen(
  einheitIds: string[],
  arten: { id: string; scope: Geltung; einheitIds: string[] }[],
  tickets: { ticket_type_id: string | null; unit_id: string | null }[]
): Map<string, number> {
  const belegt = new Map(einheitIds.map((id) => [id, 0]));
  const artNach = new Map(arten.map((art) => [art.id, art]));

  for (const ticket of tickets) {
    const art = ticket.ticket_type_id ? artNach.get(ticket.ticket_type_id) : undefined;
    if (!art) continue;

    const betroffen =
      art.scope === "choice"
        ? ticket.unit_id
          ? [ticket.unit_id]
          : []
        : art.scope === GELTUNG_AUSWAHL
          ? art.einheitIds
          : einheitIds;

    for (const id of betroffen) {
      if (belegt.has(id)) belegt.set(id, (belegt.get(id) ?? 0) + 1);
    }
  }
  return belegt;
}

export async function getEventProgramm(eventId: string): Promise<EventProgramm> {
  const { supabase } = await requireAdmin();

  const [einheitenRes, artenRes, zuordnungRes, ticketsRes, gaesteRes, gastEinheitenRes] = await Promise.all([
    supabase
      .from("event_units")
      .select("id, title, starts_at, ends_at, capacity")
      .eq("event_id", eventId)
      .order("starts_at", { ascending: true }),
    supabase
      .from("event_ticket_types")
      .select("id, name, price_normal, price_student, quota, scope, on_sale, position")
      .eq("event_id", eventId)
      .order("position", { ascending: true }),
    supabase.from("event_ticket_type_units").select("ticket_type_id, unit_id"),
    supabase
      .from("tickets")
      .select("ticket_type_id, unit_id")
      .eq("event_id", eventId)
      .in("status", GUELTIGE_TICKETS),
    supabase.from("event_guests").select("id, name, note, dance_role").eq("event_id", eventId).order("name"),
    supabase.from("event_guest_units").select("guest_id, unit_id"),
  ]);

  for (const [was, res] of [
    ["Einheiten", einheitenRes],
    ["Ticketarten", artenRes],
    ["Tickets", ticketsRes],
    ["Gäste", gaesteRes],
  ] as const) {
    if (res.error) console.error(`${was} nicht lesbar`, res.error);
  }

  const einheitIds = (einheitenRes.data ?? []).map((einheit) => einheit.id);
  const eigeneZuordnung = (zuordnungRes.data ?? []).filter((zeile) =>
    (artenRes.data ?? []).some((art) => art.id === zeile.ticket_type_id)
  );

  const arten = (artenRes.data ?? []).map((art) => ({
    id: art.id,
    scope: art.scope as Geltung,
    einheitIds: eigeneZuordnung.filter((z) => z.ticket_type_id === art.id).map((z) => z.unit_id),
  }));

  const belegt = belegungRechnen(einheitIds, arten, ticketsRes.data ?? []);
  const verkauftJeArt = new Map<string, number>();
  for (const ticket of ticketsRes.data ?? []) {
    if (!ticket.ticket_type_id) continue;
    verkauftJeArt.set(ticket.ticket_type_id, (verkauftJeArt.get(ticket.ticket_type_id) ?? 0) + 1);
  }

  return {
    einheiten: (einheitenRes.data ?? []).map((einheit) => ({
      id: einheit.id,
      titel: einheit.title,
      startsAt: einheit.starts_at,
      endsAt: einheit.ends_at,
      kapazitaet: einheit.capacity,
      belegt: belegt.get(einheit.id) ?? 0,
    })),
    ticketarten: (artenRes.data ?? []).map((art) => ({
      id: art.id,
      name: art.name,
      preisNormal: Number(art.price_normal),
      preisStudierend: Number(art.price_student),
      kontingent: art.quota,
      geltung: art.scope as Geltung,
      einheitIds: arten.find((a) => a.id === art.id)?.einheitIds ?? [],
      imVerkauf: art.on_sale,
      verkauft: verkauftJeArt.get(art.id) ?? 0,
    })),
    gaeste: (gaesteRes.data ?? []).map((gast) => ({
      id: gast.id,
      name: gast.name,
      notiz: gast.note,
      rolle: (gast.dance_role as DanceRole | null) ?? null,
      einheitIds: (gastEinheitenRes.data ?? []).filter((z) => z.guest_id === gast.id).map((z) => z.unit_id),
    })),
  };
}

// ---------------------------------------------------------------------------
// Einheiten
// ---------------------------------------------------------------------------

function einheitFelder(formData: FormData) {
  return {
    title: formData.get("title"),
    starts_at: formData.get("starts_at"),
    ends_at: formData.get("ends_at"),
    capacity: formData.get("capacity"),
  };
}

/** Liegt die Einheit im Zeitraum ihres Events? Sonst steht sie außerhalb des Programms. */
async function zeitraumPruefen(
  supabase: AdminSupabase,
  eventId: string,
  einheit: { startsAt: string; endsAt: string | null }
): Promise<string | null> {
  const { data: event, error } = await supabase
    .from("events")
    .select("starts_at, ends_at")
    .eq("id", eventId)
    .maybeSingle();
  if (error || !event) return "Event nicht gefunden.";

  return einheitImEvent(einheit, { startsAt: event.starts_at, endsAt: event.ends_at })
    ? null
    : "Die Einheit liegt außerhalb des Event-Zeitraums.";
}

export async function createEinheit(eventId: string, formData: FormData): Promise<ActionResult> {
  const parsed = einheitSchema.safeParse(einheitFelder(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };

  const { supabase } = await requireAdmin();
  const zeiten = { startsAt: parsed.data.starts_at, endsAt: parsed.data.ends_at || null };
  const zeitfehler = await zeitraumPruefen(supabase, eventId, zeiten);
  if (zeitfehler) return { error: zeitfehler };

  const { error } = await supabase.from("event_units").insert({
    event_id: eventId,
    title: parsed.data.title,
    starts_at: parsed.data.starts_at,
    ends_at: parsed.data.ends_at || null,
    capacity: parsed.data.capacity ? Number(parsed.data.capacity) : null,
  });
  if (error) {
    console.error("Einheit konnte nicht angelegt werden", error);
    return { error: "Einheit konnte nicht angelegt werden." };
  }

  await neuLaden(supabase, eventId);
  return { success: true };
}

export async function updateEinheit(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = einheitSchema.safeParse(einheitFelder(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };

  const { supabase } = await requireAdmin();
  const { data: bisher } = await supabase.from("event_units").select("event_id, starts_at").eq("id", id).maybeSingle();
  if (!bisher) return { error: "Einheit nicht gefunden." };

  const zeiten = { startsAt: parsed.data.starts_at, endsAt: parsed.data.ends_at || null };
  const zeitfehler = await zeitraumPruefen(supabase, bisher.event_id, zeiten);
  if (zeitfehler) return { error: zeitfehler };

  const { error } = await supabase
    .from("event_units")
    .update({
      title: parsed.data.title,
      starts_at: parsed.data.starts_at,
      ends_at: parsed.data.ends_at || null,
      capacity: parsed.data.capacity ? Number(parsed.data.capacity) : null,
    })
    .eq("id", id);
  if (error) return { error: "Einheit konnte nicht gespeichert werden." };

  await neuLaden(supabase, bisher.event_id);
  return { success: true };
}

/** Gültige Tickets, die für diese Einheit gelten — vor dem Löschen und Verschieben. */
export async function countTicketsFuerEinheit(id: string): Promise<number> {
  const { supabase } = await requireAdmin();
  const { data: einheit } = await supabase.from("event_units").select("event_id").eq("id", id).maybeSingle();
  if (!einheit) return 0;

  const programm = await getEventProgramm(einheit.event_id);
  return programm.einheiten.find((e) => e.id === id)?.belegt ?? 0;
}

export async function deleteEinheit(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { data: einheit } = await supabase.from("event_units").select("event_id").eq("id", id).maybeSingle();
  if (!einheit) return { error: "Einheit nicht gefunden." };

  // Eine Einheit mit verkauften Tickets zu löschen hieße, jemandem das Ticket
  // unter den Füßen wegzuziehen. Die Datenbank sperrt es ebenfalls; hier
  // bekommt der Admin die Zahl dazu.
  const betroffen = await countTicketsFuerEinheit(id);
  if (betroffen > 0) {
    const tickets = betroffen === 1 ? "ist 1 Ticket" : `sind ${betroffen} Tickets`;
    return { error: `Für diese Einheit ${tickets} gültig. Löschen ist erst möglich, wenn keines mehr besteht.` };
  }

  const { error } = await supabase.from("event_units").delete().eq("id", id);
  if (error) return { error: "Einheit konnte nicht gelöscht werden." };

  await neuLaden(supabase, einheit.event_id);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Ticketarten
// ---------------------------------------------------------------------------

function ticketartFelder(formData: FormData) {
  return {
    name: formData.get("name"),
    price_normal: formData.get("price_normal"),
    price_student: formData.get("price_student"),
    quota: formData.get("quota"),
    scope: formData.get("scope"),
    unit_ids: formData.getAll("unit_ids").map(String),
    // Ein nicht gesetztes Häkchen schickt gar nichts — das heißt hier „nicht im
    // Verkauf". Mit „true" als Rückfall ließe sich eine Art nie vom Verkauf nehmen.
    on_sale: formData.get("on_sale") ?? "false",
  };
}

async function zuordnungSetzen(supabase: AdminSupabase, artId: string, geltung: Geltung, einheitIds: string[]) {
  await supabase.from("event_ticket_type_units").delete().eq("ticket_type_id", artId);
  if (geltung !== GELTUNG_AUSWAHL || einheitIds.length === 0) return;
  await supabase
    .from("event_ticket_type_units")
    .insert(einheitIds.map((unitId) => ({ ticket_type_id: artId, unit_id: unitId })));
}

export async function createTicketart(eventId: string, formData: FormData): Promise<ActionResult> {
  const parsed = ticketartSchema.safeParse(ticketartFelder(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };

  const { supabase } = await requireAdmin();
  const { data: letzte } = await supabase
    .from("event_ticket_types")
    .select("position")
    .eq("event_id", eventId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: art, error } = await supabase
    .from("event_ticket_types")
    .insert({
      event_id: eventId,
      name: parsed.data.name,
      price_normal: Number(parsed.data.price_normal),
      price_student: Number(parsed.data.price_student),
      quota: parsed.data.quota ? Number(parsed.data.quota) : null,
      scope: parsed.data.scope,
      on_sale: parsed.data.on_sale === "true",
      position: (letzte?.position ?? -1) + 1,
    })
    .select("id")
    .single();

  if (error || !art) {
    console.error("Ticketart konnte nicht angelegt werden", error);
    return { error: "Ticketart konnte nicht angelegt werden." };
  }

  await zuordnungSetzen(supabase, art.id, parsed.data.scope, parsed.data.unit_ids);
  await neuLaden(supabase, eventId);
  return { success: true };
}

export async function updateTicketart(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = ticketartSchema.safeParse(ticketartFelder(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };

  const { supabase } = await requireAdmin();
  const { data: bisher } = await supabase
    .from("event_ticket_types")
    .select("event_id, price_normal, price_student, scope")
    .eq("id", id)
    .maybeSingle();
  if (!bisher) return { error: "Ticketart nicht gefunden." };

  const { count, error: zaehlFehler } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("ticket_type_id", id)
    .in("status", GUELTIGE_TICKETS);
  if (zaehlFehler) return { error: "Ticketart konnte nicht gespeichert werden." };

  const verkauft = count ?? 0;
  const preisGeaendert =
    Number(bisher.price_normal) !== Number(parsed.data.price_normal) ||
    Number(bisher.price_student) !== Number(parsed.data.price_student);
  const geltungGeaendert = bisher.scope !== parsed.data.scope;

  // Ein nachträglich geänderter Preis stünde an einem Ticket, das jemand zu
  // einem anderen gekauft hat. Umbenennen und vom Verkauf nehmen bleiben
  // erlaubt — beides ändert nichts am Gekauften.
  if (verkauft > 0 && (preisGeaendert || geltungGeaendert)) {
    const tickets = verkauft === 1 ? "ist schon 1 Ticket" : `sind schon ${verkauft} Tickets`;
    return {
      error: `Für diese Ticketart ${tickets} verkauft. Preis und Geltungsbereich lassen sich dann nicht mehr ändern — Name und Verkaufsstatus schon.`,
    };
  }

  const { error } = await supabase
    .from("event_ticket_types")
    .update({
      name: parsed.data.name,
      price_normal: Number(parsed.data.price_normal),
      price_student: Number(parsed.data.price_student),
      quota: parsed.data.quota ? Number(parsed.data.quota) : null,
      scope: parsed.data.scope,
      on_sale: parsed.data.on_sale === "true",
    })
    .eq("id", id);
  if (error) return { error: "Ticketart konnte nicht gespeichert werden." };

  if (verkauft === 0) {
    await zuordnungSetzen(supabase, id, parsed.data.scope, parsed.data.unit_ids);
  }
  await neuLaden(supabase, bisher.event_id);
  return { success: true };
}

export async function deleteTicketart(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { data: art } = await supabase.from("event_ticket_types").select("event_id").eq("id", id).maybeSingle();
  if (!art) return { error: "Ticketart nicht gefunden." };

  const { count } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("ticket_type_id", id);
  if ((count ?? 0) > 0) {
    return { error: "Zu dieser Ticketart gehören Tickets. Nimm sie vom Verkauf, statt sie zu löschen." };
  }

  const { error } = await supabase.from("event_ticket_types").delete().eq("id", id);
  if (error) return { error: "Ticketart konnte nicht gelöscht werden." };

  await neuLaden(supabase, art.event_id);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Gäste von Hand
// ---------------------------------------------------------------------------

export async function createGast(eventId: string, formData: FormData): Promise<ActionResult> {
  const parsed = gastSchema.safeParse({
    name: formData.get("name"),
    note: formData.get("note"),
    dance_role: formData.get("dance_role") ?? "",
    unit_ids: formData.getAll("unit_ids").map(String),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };

  const { supabase, user } = await requireAdmin();
  const { data: gast, error } = await supabase
    .from("event_guests")
    .insert({
      event_id: eventId,
      name: parsed.data.name,
      note: parsed.data.note || null,
      dance_role: parsed.data.dance_role || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !gast) {
    console.error("Gast konnte nicht eingetragen werden", error);
    return { error: "Gast konnte nicht eingetragen werden." };
  }

  // Keine Auswahl heißt: für alle Einheiten. Dann bleibt die Zuordnung leer —
  // wie bei einer Ticketart, die für alles gilt.
  if (parsed.data.unit_ids.length > 0) {
    await supabase
      .from("event_guest_units")
      .insert(parsed.data.unit_ids.map((unitId) => ({ guest_id: gast.id, unit_id: unitId })));
  }

  await neuLaden(supabase, eventId);
  return { success: true };
}

export async function deleteGast(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { data: gast, error } = await supabase
    .from("event_guests")
    .delete()
    .eq("id", id)
    .select("event_id")
    .single();
  if (error || !gast) return { error: "Gast konnte nicht entfernt werden." };

  await neuLaden(supabase, gast.event_id);
  return { success: true };
}
