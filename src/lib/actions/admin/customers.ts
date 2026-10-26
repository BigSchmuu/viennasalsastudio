"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { adminProfileSchema } from "@/lib/validations/auth";
import type { ActionResult } from "@/lib/actions/types";

export async function updateCustomerProfile(customerId: string, formData: FormData): Promise<ActionResult> {
  const parsed = adminProfileSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
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
      // PROJ-94: `full_name` setzt der Trigger aus diesen beiden.
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name || null,
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
