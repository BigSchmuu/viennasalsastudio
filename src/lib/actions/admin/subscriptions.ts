"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { subscriptionSchema } from "@/lib/validations/admin";
import type { ActionResult } from "@/lib/actions/types";

function parseSubscriptionFormData(formData: FormData) {
  const priceRaw = formData.get("price");
  return subscriptionSchema.safeParse({
    name: formData.get("name"),
    price: priceRaw === null || priceRaw === "" ? NaN : Number(priceRaw),
    status: formData.get("status"),
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
    })
    .eq("id", id);

  if (error) {
    return { error: "Abo konnte nicht gespeichert werden." };
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
