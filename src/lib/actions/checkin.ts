"use server";

import { requireAdminOrTeacher } from "@/lib/auth/require-admin-or-teacher";

export type CheckinEventRow = { id: string; name: string; startsAt: string };

export async function listCheckinEvents(): Promise<CheckinEventRow[]> {
  const { supabase } = await requireAdminOrTeacher();

  // PROJ-54: Nur was noch ansteht. Eine Serie bringt jede Woche einen neuen
  // Termin mit; ohne diese Grenze wüchse die Auswahl an der Tür mit jedem
  // vergangenen Abend weiter. Ein Tag Rückblick bleibt, damit der Check-in
  // eines Abends auch nach Mitternacht noch möglich ist.
  const { data } = await supabase
    .from("events")
    .select("id, name, starts_at")
    .eq("status", "geplant")
    .gt("starts_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("starts_at", { ascending: true });

  return (data ?? []).map((e) => ({ id: e.id, name: e.name, startsAt: e.starts_at }));
}

export type TicketSearchRow = {
  id: string;
  customerId: string;
  customerName: string;
  paymentMethod: string;
  status: string;
  checkedInAt: string | null;
};

export async function searchEventTickets(eventId: string, query: string): Promise<TicketSearchRow[]> {
  const { supabase } = await requireAdminOrTeacher();

  const { data } = await supabase
    .from("tickets")
    .select("id, customer_id, payment_method, status, checked_in_at, profiles(full_name)")
    .eq("event_id", eventId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: true });

  const rows: TicketSearchRow[] = (data ?? []).map((t) => ({
    id: t.id,
    customerId: t.customer_id,
    customerName: t.profiles?.full_name ?? "—",
    paymentMethod: t.payment_method,
    status: t.status,
    checkedInAt: t.checked_in_at,
  }));

  if (!query.trim()) return rows;
  const needle = query.trim().toLowerCase();
  return rows.filter((r) => r.customerName.toLowerCase().includes(needle));
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
 *
 * Bei einer Serie heißen alle Termine gleich. Ohne den Abgleich wäre das
 * Ticket vom Abend der Vorwoche an der Tür gültig — und die Gästeliste des
 * laufenden Abends stimmte nicht mehr. Geprüft wird in der Datenbank, nicht
 * hier: An der Oberfläche vorbei ginge es sonst weiterhin.
 */
export async function checkinTicket(ticketId: string, eventId: string): Promise<CheckinResult> {
  const { supabase } = await requireAdminOrTeacher();

  const { data, error } = await supabase.rpc("checkin_event_ticket", {
    p_ticket_id: ticketId,
    p_event_id: eventId,
  });

  if (error) {
    if (error.message.includes("ticket for other event")) {
      return { error: "Dieses Ticket gehört zu einem anderen Termin." };
    }
    if (error.message.includes("already checked in")) {
      const { data: existing } = await supabase
        .from("tickets")
        .select("checked_in_at")
        .eq("id", ticketId)
        .maybeSingle();
      return { alreadyCheckedIn: true, checkedInAt: existing?.checked_in_at ?? "" };
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
