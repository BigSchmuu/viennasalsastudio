"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { subscriptionSchema } from "@/lib/validations/admin";
import { formatDateLocal } from "@/lib/scheduling/dates";
import type { ActionResult } from "@/lib/actions/types";

function parseSubscriptionFormData(formData: FormData) {
  const priceRaw = formData.get("price");
  return subscriptionSchema.safeParse({
    name: formData.get("name"),
    price: priceRaw === null || priceRaw === "" ? NaN : Number(priceRaw),
    status: formData.get("status"),
    course_id: formData.get("course_id") ?? "",
    cycle_anchor_date: formData.get("cycle_anchor_date"),
  });
}

export async function createSubscription(customerId: string, formData: FormData): Promise<ActionResult> {
  const parsed = parseSubscriptionFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("subscriptions").insert({
    customer_id: customerId,
    name: parsed.data.name,
    price: parsed.data.price,
    status: parsed.data.status,
    course_id: parsed.data.course_id || null,
    cycle_anchor_date: parsed.data.cycle_anchor_date,
  });

  if (error) {
    return { error: "Abo konnte nicht angelegt werden." };
  }

  revalidatePath(`/admin/kunden/${customerId}`);
  return { success: true };
}

export async function updateSubscription(
  id: string,
  customerId: string,
  formData: FormData
): Promise<ActionResult> {
  const parsed = parseSubscriptionFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("subscriptions")
    .update({
      name: parsed.data.name,
      price: parsed.data.price,
      status: parsed.data.status,
      course_id: parsed.data.course_id || null,
      cycle_anchor_date: parsed.data.cycle_anchor_date,
    })
    .eq("id", id);

  if (error) {
    return { error: "Abo konnte nicht gespeichert werden." };
  }

  revalidatePath(`/admin/kunden/${customerId}`);
  return { success: true };
}

export async function applyPendingChange(id: string, customerId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id, pending_status, pending_effective_date")
    .eq("id", id)
    .single();

  if (!subscription || !subscription.pending_status || !subscription.pending_effective_date) {
    return { error: "Keine geplante Änderung vorhanden." };
  }
  if (subscription.pending_effective_date > formatDateLocal(new Date())) {
    return { error: "Das Wirksamkeitsdatum liegt noch in der Zukunft." };
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: subscription.pending_status,
      pending_status: null,
      pending_effective_date: null,
    })
    .eq("id", id);

  if (error) {
    return { error: "Änderung konnte nicht übernommen werden." };
  }

  revalidatePath(`/admin/kunden/${customerId}`);
  return { success: true };
}

export async function deleteSubscription(id: string, customerId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("subscriptions").delete().eq("id", id);

  if (error) {
    return { error: "Abo konnte nicht gelöscht werden." };
  }

  revalidatePath(`/admin/kunden/${customerId}`);
  return { success: true };
}
