"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { invoiceSettingsSchema } from "@/lib/validations/admin";
import type { ActionResult } from "@/lib/actions/types";

export async function updateInvoiceSettings(formData: FormData): Promise<ActionResult> {
  const parsed = invoiceSettingsSchema.safeParse({
    company_name: formData.get("company_name"),
    address: formData.get("address") ?? "",
    uid_number: formData.get("uid_number") ?? "",
    vat_rate: Number(formData.get("vat_rate")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();

  const { data: existing } = await supabase.from("invoice_settings").select("id").limit(1).single();
  if (!existing) {
    return { error: "Rechnungseinstellungen nicht gefunden." };
  }

  const { error } = await supabase
    .from("invoice_settings")
    .update({
      company_name: parsed.data.company_name,
      address: parsed.data.address || "",
      uid_number: parsed.data.uid_number || "",
      vat_rate: parsed.data.vat_rate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (error) {
    return { error: "Einstellungen konnten nicht gespeichert werden." };
  }

  revalidatePath("/admin/rechnungen/einstellungen");
  return { success: true };
}
