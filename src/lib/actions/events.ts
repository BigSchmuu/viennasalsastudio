"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TicketPaymentMethod } from "@/lib/constants/events";
import { enqueueAndDispatch } from "@/lib/notifications/dispatch";
import type { ActionResult } from "@/lib/actions/types";
import { AGB_VERSION } from "@/lib/legal";

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
  wantsStudentPrice: boolean,
  // PROJ-42: Ob zugestimmt wurde, kommt vom Browser. Welcher Stand galt, setzt
  // der Server selbst — sonst waere der Nachweis faelschbar.
  termsAccepted: boolean
): Promise<PurchaseTicketResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Nicht eingeloggt" };
  }

  if (!termsAccepted) {
    return { error: "Bitte bestätige zuerst die AGB." };
  }

  const { data, error } = await supabase.rpc("purchase_event_ticket", {
    p_event_id: eventId,
    p_payment_method: paymentMethod,
    p_wants_student_price: wantsStudentPrice,
    p_terms_accepted: termsAccepted,
    p_terms_version: AGB_VERSION,
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

  // Routed through a SECURITY DEFINER RPC (not a direct table update) so that
  // customers can only ever flip their own ticket to "cancelled" — a raw RLS
  // policy here would let a customer's own JWT PATCH arbitrary columns
  // (status, price, ...) directly via the REST API (QA BUG-1).
  const { error } = await supabase.rpc("cancel_event_ticket", { p_ticket_id: ticketId });

  if (error) {
    if (error.message.includes("not found") || error.message.includes("not your ticket")) {
      return { error: "Ticket nicht gefunden." };
    }
    if (error.message.includes("not cancellable")) {
      return { error: "Dieses Ticket kann nicht mehr storniert werden." };
    }
    if (error.message.includes("deadline passed")) {
      return { error: "Die Frist zum Stornieren ist abgelaufen." };
    }
    return { error: "Ticket konnte nicht storniert werden." };
  }

  revalidatePath("/events");
  revalidatePath("/profil");
  return { success: true };
}
