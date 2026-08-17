"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { enqueueAndDispatch } from "@/lib/notifications/dispatch";
import type { ActionResult } from "@/lib/actions/types";

export async function confirmRegularBooking(
  bookingId: string,
  formData: FormData
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const priceRaw = formData.get("price");
  const price = priceRaw === null || priceRaw === "" ? NaN : Number(priceRaw);

  if (!name) {
    return { error: "Name ist erforderlich" };
  }
  if (Number.isNaN(price) || price < 0) {
    return { error: "Bitte einen gültigen Preis eingeben" };
  }

  const { supabase } = await requireAdmin();

  const { data: booking } = await supabase
    .from("course_bookings")
    .select("id, customer_id, type, status, course_id, desired_plan, chosen_date")
    .eq("id", bookingId)
    .single();

  if (!booking || booking.type !== "regular" || booking.status !== "open") {
    return { error: "Buchung nicht gefunden oder nicht mehr offen." };
  }

  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .insert({
      customer_id: booking.customer_id,
      name,
      price,
      status: "active",
      course_id: booking.desired_plan === "single_course" ? booking.course_id : null,
      cycle_anchor_date: booking.chosen_date,
    })
    .select("id")
    .single();

  if (subError || !subscription) {
    return { error: "Abo konnte nicht angelegt werden." };
  }

  const { error } = await supabase
    .from("course_bookings")
    .update({ status: "confirmed", subscription_id: subscription.id })
    .eq("id", bookingId);

  if (error) {
    return { error: "Buchung konnte nicht bestätigt werden." };
  }

  await enqueueAndDispatch({
    customerId: booking.customer_id,
    eventType: "buchungsstatus",
    payload: { booking_id: bookingId, new_status: "confirmed" },
    dedupeKey: `booking_status:${bookingId}:confirmed`,
  });

  revalidatePath("/admin/buchungen");
  revalidatePath("/admin/kunden");
  return { success: true };
}

export async function confirmDropinBooking(bookingId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();

  const { data: booking } = await supabase
    .from("course_bookings")
    .select("id, type, status, customer_id")
    .eq("id", bookingId)
    .single();

  if (!booking || booking.type !== "dropin" || booking.status !== "open") {
    return { error: "Buchung nicht gefunden oder nicht mehr offen." };
  }

  const { error } = await supabase
    .from("course_bookings")
    .update({ status: "confirmed" })
    .eq("id", bookingId);

  if (error) {
    return { error: "Buchung konnte nicht bestätigt werden." };
  }

  await enqueueAndDispatch({
    customerId: booking.customer_id,
    eventType: "buchungsstatus",
    payload: { booking_id: bookingId, new_status: "confirmed" },
    dedupeKey: `booking_status:${bookingId}:confirmed`,
  });

  revalidatePath("/admin/buchungen");
  return { success: true };
}

export async function rejectBooking(bookingId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();

  const { data: booking } = await supabase
    .from("course_bookings")
    .select("id, status, type, course_id, customer_id")
    .eq("id", bookingId)
    .single();

  if (!booking || booking.status !== "open") {
    return { error: "Buchung nicht gefunden oder nicht mehr offen." };
  }

  const { error } = await supabase
    .from("course_bookings")
    .update({ status: "rejected" })
    .eq("id", bookingId);

  if (error) {
    return { error: "Buchung konnte nicht abgelehnt werden." };
  }

  await enqueueAndDispatch({
    customerId: booking.customer_id,
    eventType: "buchungsstatus",
    payload: { booking_id: bookingId, new_status: "rejected" },
    dedupeKey: `booking_status:${bookingId}:rejected`,
  });

  if (booking.type === "regular" && booking.course_id) {
    const { error: promoteError } = await supabase.rpc("promote_waitlist_for_course", {
      p_course_id: booking.course_id,
    });
    if (promoteError) {
      console.error("promote_waitlist_for_course failed", promoteError);
    }
  }

  revalidatePath("/admin/buchungen");
  return { success: true };
}
