"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { profileSchema } from "@/lib/validations/auth";
import type { ActionResult } from "@/lib/actions/types";

export async function updateCustomerProfile(customerId: string, formData: FormData): Promise<ActionResult> {
  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    birthdate: formData.get("birthdate"),
    gender: formData.get("gender"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name || null,
      phone: parsed.data.phone || null,
      birthdate: parsed.data.birthdate || null,
      gender: parsed.data.gender || null,
    })
    .eq("id", customerId)
    .eq("role", "customer");

  if (error) {
    return { error: "Profil konnte nicht gespeichert werden." };
  }

  revalidatePath(`/admin/kunden/${customerId}`);
  revalidatePath("/admin/kunden");
  return { success: true };
}
