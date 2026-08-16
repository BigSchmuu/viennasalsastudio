"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { dropinPricingSchema } from "@/lib/validations/booking";
import type { ActionResult } from "@/lib/actions/types";

export async function updateDropinPricing(formData: FormData): Promise<ActionResult> {
  const parsed = dropinPricingSchema.safeParse({
    normal_price: Number(formData.get("normal_price")),
    student_price: Number(formData.get("student_price")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();

  const { data: existing } = await supabase.from("dropin_pricing").select("id").limit(1).single();
  if (!existing) {
    return { error: "Preiseinstellungen nicht gefunden." };
  }

  const { error } = await supabase
    .from("dropin_pricing")
    .update({
      normal_price: parsed.data.normal_price,
      student_price: parsed.data.student_price,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (error) {
    return { error: "Preise konnten nicht gespeichert werden." };
  }

  revalidatePath("/admin/buchungen");
  revalidatePath("/kurse");
  return { success: true };
}
