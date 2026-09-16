"use server";

import { requireAdminOrTeacher } from "@/lib/auth/require-admin-or-teacher";
import { nachZeit } from "@/lib/events/tickets";
import type { DanceRole } from "@/lib/constants/booking";

export type CheckinEventRow = {
  id: string;
  name: string;
  startsAt: string;
  /** PROJ-56: Ein Event mit Programm wird je Einheit eingecheckt. */
  hatEinheiten: boolean;
  rolleZeigen: boolean;
};

export type CheckinEinheit = {
  id: string;
  titel: string;
  startsAt: string;
  endsAt: string | null;
};

export async function listCheckinEvents(): Promise<CheckinEventRow[]> {
  const { supabase } = await requireAdminOrTeacher();

  // PROJ-54: Nur was noch ansteht. Eine Serie bringt jede Woche einen neuen
  // Termin mit; ohne diese Grenze wüchse die Auswahl an der Tür mit jedem
  // vergangenen Abend weiter. Ein Tag Rückblick bleibt, damit der Check-in
  // eines Abends auch nach Mitternacht noch möglich ist.
  const { data } = await supabase
    .from("events")
    .select("id, name, starts_at, role_query_enabled, event_units(id)")
    .eq("status", "geplant")
    .gt("starts_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("starts_at", { ascending: true });

  return (data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    startsAt: e.starts_at,
    hatEinheiten: (e.event_units ?? []).length > 0,
    rolleZeigen: e.role_query_enabled ?? false,
  }));
}

/** Das Programm eines Events für die Auswahl an der Tür. */
export async function listCheckinEinheiten(eventId: string): Promise<CheckinEinheit[]> {
  const { supabase } = await requireAdminOrTeacher();
  const { data } = await supabase
    .from("event_units")
    .select("id, title, starts_at, ends_at")
    .eq("event_id", eventId)
    .order("starts_at", { ascending: true });

  return nachZeit(
    (data ?? []).map((einheit) => ({
      id: einheit.id,
      titel: einheit.title,
      startsAt: einheit.starts_at,
      endsAt: einheit.ends_at,
    }))
  );
}

export type TicketSearchRow = {
  id: string;
  /** Ein verkauftes Ticket oder ein von Hand eingetragener Gast (PROJ-56). */
  art: "ticket" | "gast";
  customerId: string | null;
  customerName: string;
  paymentMethod: string;
  status: string;
  checkedInAt: string | null;
  ticketart: string | null;
  einheit: string | null;
  rolle: DanceRole | null;
};

/**
 * Wer an der Tür in Frage kommt — Tickets und Gäste von Hand.
 *
 * `checkedInAt` bezieht sich auf die gewählte Einheit: Ein Pass für drei
 * Einheiten ist nach der ersten nicht „schon eingecheckt", sondern nur für
 * diese eine.
 */
export async function searchEventTickets(
  eventId: string,
  query: string,
  unitId?: string | null
): Promise<TicketSearchRow[]> {
  const { supabase } = await requireAdminOrTeacher();

  const [ticketsRes, gaesteRes, einlassRes] = await Promise.all([
    supabase
      .from("tickets")
      .select(
        "id, customer_id, payment_method, status, checked_in_at, dance_role, profiles(full_name), event_ticket_types(name), event_units(title)"
      )
      .eq("event_id", eventId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: true }),
    supabase.from("event_guests").select("id, name, note, dance_role").eq("event_id", eventId).order("name"),
    supabase.from("event_checkins").select("ticket_id, guest_id, unit_id, checked_in_at"),
  ]);

  const einlass = einlassRes.data ?? [];
  const eingechecktAm = (id: string, feld: "ticket_id" | "guest_id") =>
    einlass.find((zeile) => zeile[feld] === id && (unitId ? zeile.unit_id === unitId : zeile.unit_id === null))
      ?.checked_in_at ?? null;

  const tickets: TicketSearchRow[] = (ticketsRes.data ?? []).map((t) => ({
    id: t.id,
    art: "ticket",
    customerId: t.customer_id,
    customerName: t.profiles?.full_name ?? "—",
    paymentMethod: t.payment_method,
    status: t.status,
    // Ohne Einheiten bleibt es beim Vermerk am Ticket selbst (PROJ-14).
    checkedInAt: unitId ? eingechecktAm(t.id, "ticket_id") : t.checked_in_at,
    ticketart: t.event_ticket_types?.name ?? null,
    einheit: t.event_units?.title ?? null,
    rolle: (t.dance_role as DanceRole | null) ?? null,
  }));

  const gaeste: TicketSearchRow[] = (gaesteRes.data ?? []).map((gast) => ({
    id: gast.id,
    art: "gast",
    customerId: null,
    customerName: gast.name,
    paymentMethod: "guest",
    status: "guest",
    checkedInAt: eingechecktAm(gast.id, "guest_id"),
    ticketart: gast.note,
    einheit: null,
    rolle: (gast.dance_role as DanceRole | null) ?? null,
  }));

  const alle = [...tickets, ...gaeste];
  if (!query.trim()) return alle;
  const needle = query.trim().toLowerCase();
  return alle.filter((zeile) => zeile.customerName.toLowerCase().includes(needle));
}

type CheckinResult =
  | { error: string }
  | { alreadyCheckedIn: true; checkedInAt: string }
  | {
      success: true;
      ticket: { id: string; eventId: string; customerName: string; paymentMethod: string };
    };

/**
 * PROJ-54: Der Termin gehört zum Check-in dazu.
 * PROJ-56: Und bei einem Event mit Programm auch die Einheit.
 *
 * Bei einer Serie heißen alle Termine gleich; bei einem Workshop gilt ein
 * Einzelticket nur für seine Einheit. Geprüft wird beides in der Datenbank,
 * nicht hier: An der Oberfläche vorbei ginge es sonst weiterhin.
 */
export async function checkinTicket(
  ticketId: string,
  eventId: string,
  unitId?: string | null
): Promise<CheckinResult> {
  const { supabase } = await requireAdminOrTeacher();

  const { data, error } = await supabase.rpc("checkin_event_ticket", {
    p_ticket_id: ticketId,
    p_event_id: eventId,
    // Weglassen statt null: Der Vorgabewert der Funktion ist null, und die
    // erzeugten Typen kennen für einen Parameter mit Vorgabe kein null.
    p_unit_id: unitId ?? undefined,
  });

  if (error) {
    if (error.message.includes("ticket for other event")) {
      return { error: "Dieses Ticket gehört zu einem anderen Termin." };
    }
    if (error.message.includes("ticket not for unit")) {
      return { error: "Gilt nicht für diese Einheit." };
    }
    if (error.message.includes("already checked in")) {
      const { data: bestehend } = await supabase
        .from("event_checkins")
        .select("checked_in_at")
        .eq("ticket_id", ticketId)
        // Ohne Einheit heisst die Bedingung "is null", nicht "eq null".
        .filter("unit_id", unitId ? "eq" : "is", unitId ?? null)
        .maybeSingle();
      if (bestehend?.checked_in_at) {
        return { alreadyCheckedIn: true, checkedInAt: bestehend.checked_in_at };
      }
      const { data: ticket } = await supabase
        .from("tickets")
        .select("checked_in_at")
        .eq("id", ticketId)
        .maybeSingle();
      return { alreadyCheckedIn: true, checkedInAt: ticket?.checked_in_at ?? "" };
    }
    if (error.message.includes("ticket cancelled")) {
      return { error: "Dieses Ticket wurde storniert." };
    }
    if (error.message.includes("ticket not found")) {
      return { error: "Ungültiger QR-Code — kein Ticket gefunden." };
    }
    return { error: "Check-in war nicht möglich. Bitte versuche es erneut." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", data.customer_id)
    .maybeSingle();

  return {
    success: true,
    ticket: {
      id: data.id,
      eventId: data.event_id,
      customerName: profile?.full_name ?? "—",
      paymentMethod: data.payment_method,
    },
  };
}

/** Einen von Hand eingetragenen Gast einchecken — er hat keinen QR-Code. */
export async function checkinGast(guestId: string, eventId: string, unitId?: string | null): Promise<CheckinResult> {
  const { supabase } = await requireAdminOrTeacher();

  const { data, error } = await supabase.rpc("checkin_event_guest", {
    p_guest_id: guestId,
    p_event_id: eventId,
    // Weglassen statt null: Der Vorgabewert der Funktion ist null, und die
    // erzeugten Typen kennen für einen Parameter mit Vorgabe kein null.
    p_unit_id: unitId ?? undefined,
  });

  if (error) {
    if (error.message.includes("already checked in")) {
      const { data: bestehend } = await supabase
        .from("event_checkins")
        .select("checked_in_at")
        .eq("guest_id", guestId)
        // Ohne Einheit heisst die Bedingung "is null", nicht "eq null".
        .filter("unit_id", unitId ? "eq" : "is", unitId ?? null)
        .maybeSingle();
      return { alreadyCheckedIn: true, checkedInAt: bestehend?.checked_in_at ?? "" };
    }
    if (error.message.includes("guest not for unit")) {
      return { error: "Gilt nicht für diese Einheit." };
    }
    return { error: "Check-in war nicht möglich. Bitte versuche es erneut." };
  }

  return {
    success: true,
    ticket: { id: data.id, eventId, customerName: data.name, paymentMethod: "guest" },
  };
}
