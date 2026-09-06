"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { invoiceSettingsSchema } from "@/lib/validations/admin";
import { belegFehlertext } from "@/lib/invoices";
import type { ActionResult } from "@/lib/actions/types";

async function erstelleBeleg(
  invoiceId: string,
  art: "cancellation" | "credit_note",
  betrag: number,
  grund: string
): Promise<ActionResult> {
  if (grund.trim().length === 0) {
    return { error: "Bitte gib einen Grund an." };
  }

  const { supabase } = await requireAdmin();

  // Betrag, Restbetrag und Sperre liegen bewusst in der Datenbank: dieser
  // Server Action ist nicht der einzige denkbare Weg zu einem Storno, und
  // zwei gleichzeitige Gutschriften dürfen die Rechnung nicht übersteigen.
  const { error } = await supabase.rpc("create_invoice_document", {
    p_invoice_id: invoiceId,
    p_document_type: art,
    p_amount: betrag,
    p_reason: grund.trim(),
  });

  if (error) {
    return { error: belegFehlertext(error.message) };
  }

  revalidatePath("/admin/rechnungen");
  revalidatePath("/admin/offene-posten");
  revalidatePath("/profil");
  return { success: true };
}

/**
 * Hebt eine Rechnung vollständig auf. Der Betrag ist nicht wählbar — ein
 * Vollstorno storniert, was von der Rechnung noch offen ist. Genau deshalb
 * nimmt diese Funktion keinen Betrag entgegen.
 */
export async function storniereRechnung(
  invoiceId: string,
  grund: string
): Promise<ActionResult> {
  return erstelleBeleg(invoiceId, "cancellation", 0, grund);
}

/** Erstattet einen Teilbetrag einer Rechnung. */
export async function erstelleGutschrift(
  invoiceId: string,
  betrag: number,
  grund: string
): Promise<ActionResult> {
  if (!Number.isFinite(betrag) || betrag <= 0) {
    return { error: "Der Betrag muss größer als null sein." };
  }
  return erstelleBeleg(invoiceId, "credit_note", betrag, grund);
}

export async function updateInvoiceSettings(formData: FormData): Promise<ActionResult> {
  const parsed = invoiceSettingsSchema.safeParse({
    company_name: formData.get("company_name"),
    address: formData.get("address") ?? "",
    uid_number: formData.get("uid_number") ?? "",
    vat_rate: Number(formData.get("vat_rate")),
    bounce_fee_default: Number(formData.get("bounce_fee_default") ?? 0),
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
      bounce_fee_default: parsed.data.bounce_fee_default,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (error) {
    return { error: "Einstellungen konnten nicht gespeichert werden." };
  }

  revalidatePath("/admin/rechnungen/einstellungen");
  return { success: true };
}
