"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { eventSchema, createEventSchema } from "@/lib/validations/events";
import { enqueueNotification } from "@/lib/notifications/dispatch";
import type { ActionResult } from "@/lib/actions/types";

function parseEventFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    description: formData.get("description"),
    location: formData.get("location"),
    starts_at: formData.get("starts_at"),
    ends_at: formData.get("ends_at"),
    capacity: formData.get("capacity"),
    price_normal: formData.get("price_normal"),
    price_student: formData.get("price_student"),
  };
}

export async function createEvent(formData: FormData): Promise<ActionResult> {
  const parsed = createEventSchema.safeParse(parseEventFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();

  const { error } = await supabase.from("events").insert({
    name: parsed.data.name,
    description: parsed.data.description || null,
    location: parsed.data.location || null,
    starts_at: parsed.data.starts_at,
    ends_at: parsed.data.ends_at || null,
    capacity: Number(parsed.data.capacity),
    price_normal: Number(parsed.data.price_normal),
    price_student: Number(parsed.data.price_student),
  });

  if (error) {
    return { error: "Event konnte nicht angelegt werden." };
  }

  revalidatePath("/admin/events");
  revalidatePath("/events");
  return { success: true };
}

export async function updateEvent(eventId: string, formData: FormData): Promise<ActionResult> {
  const parsed = eventSchema.safeParse(parseEventFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("events")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      location: parsed.data.location || null,
      starts_at: parsed.data.starts_at,
      ends_at: parsed.data.ends_at || null,
      capacity: Number(parsed.data.capacity),
      price_normal: Number(parsed.data.price_normal),
      price_student: Number(parsed.data.price_student),
    })
    .eq("id", eventId);

  if (error) {
    return { error: "Event konnte nicht gespeichert werden." };
  }

  revalidatePath("/admin/events");
  revalidatePath("/events");
  return { success: true };
}

export async function cancelEvent(eventId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();

  const { error } = await supabase.from("events").update({ status: "abgesagt" }).eq("id", eventId);

  if (error) {
    return { error: "Event konnte nicht abgesagt werden." };
  }

  const { data: activeTickets } = await supabase
    .from("tickets")
    .select("id, customer_id")
    .eq("event_id", eventId)
    .in("status", ["reserved", "confirmed"]);

  await Promise.all(
    (activeTickets ?? []).map((t) =>
      enqueueNotification({
        customerId: t.customer_id,
        eventType: "event_tickets",
        payload: { sub_type: "event_cancelled", event_id: eventId },
        dedupeKey: `event_ticket_cancelled:${t.id}`,
      })
    )
  );

  revalidatePath("/admin/events");
  revalidatePath("/events");
  return { success: true };
}

export type EventGuestRow = {
  id: string;
  customerId: string;
  customerName: string;
  paymentMethod: string;
  status: string;
  price: number;
  checkedInAt: string | null;
};

export async function getEventGuestList(eventId: string): Promise<EventGuestRow[]> {
  const { supabase } = await requireAdmin();

  const { data } = await supabase
    .from("tickets")
    .select("id, customer_id, payment_method, status, price, checked_in_at, profiles(full_name)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((t) => ({
    id: t.id,
    customerId: t.customer_id,
    customerName: t.profiles?.full_name ?? "—",
    paymentMethod: t.payment_method,
    status: t.status,
    price: t.price,
    checkedInAt: t.checked_in_at,
  }));
}
