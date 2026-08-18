"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TICKET_CANCELLATION_LEAD_DAYS, type TicketPaymentMethod } from "@/lib/constants/events";
import { daysUntil } from "@/lib/scheduling/dates";
import { enqueueAndDispatch } from "@/lib/notifications/dispatch";
import type { ActionResult } from "@/lib/actions/types";

type TicketRow = {
  id: string;
  event_id: string;
  payment_method: string;
  wants_student_price: boolean;
  price: number;
  status: string;
};

type PurchaseTicketResult =
  | { error: string }
  | { needsMandate: true }
  | { full: true }
  | { success: true; ticket: TicketRow };

export async function purchaseTicket(
  eventId: string,
  paymentMethod: TicketPaymentMethod,
  wantsStudentPrice: boolean
): Promise<PurchaseTicketResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Nicht eingeloggt" };
  }

  const { data, error } = await supabase.rpc("purchase_event_ticket", {
    p_event_id: eventId,
    p_payment_method: paymentMethod,
    p_wants_student_price: wantsStudentPrice,
  });

  if (error) {
    if (error.message.includes("no active mandate")) {
      return { needsMandate: true };
    }
    if (error.message.includes("event is full")) {
      return { full: true };
    }
    if (error.message.includes("event not open")) {
      return { error: "Dieses Event ist nicht mehr buchbar." };
    }
    return { error: "Ticket-Kauf war nicht möglich. Bitte versuche es erneut." };
  }

  const ticket = data as TicketRow;

  await enqueueAndDispatch({
    customerId: user.id,
    eventType: "event_tickets",
    payload: { ticket_id: ticket.id },
    dedupeKey: `event_ticket_purchased:${ticket.id}`,
  });

  revalidatePath("/events");
  revalidatePath("/profil");
  return { success: true, ticket };
}

export async function cancelTicket(ticketId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Nicht eingeloggt" };
  }

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, customer_id, status, events(starts_at)")
    .eq("id", ticketId)
    .single();

  if (!ticket || ticket.customer_id !== user.id) {
    return { error: "Ticket nicht gefunden." };
  }
  if (ticket.status === "cancelled") {
    return { error: "Dieses Ticket ist bereits storniert." };
  }
  if (ticket.status === "checked_in") {
    return { error: "Ein bereits eingechecktes Ticket kann nicht mehr storniert werden." };
  }
  if (!ticket.events || daysUntil(ticket.events.starts_at.slice(0, 10)) < TICKET_CANCELLATION_LEAD_DAYS) {
    return { error: "Die Frist zum Stornieren ist abgelaufen." };
  }

  const { error } = await supabase.from("tickets").update({ status: "cancelled" }).eq("id", ticketId);

  if (error) {
    return { error: "Ticket konnte nicht storniert werden." };
  }

  revalidatePath("/events");
  revalidatePath("/profil");
  return { success: true };
}
