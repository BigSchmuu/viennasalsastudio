"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { enqueueAndDispatch } from "@/lib/notifications/dispatch";
import type { ActionResult } from "@/lib/actions/types";

const feeSchema = z.object({
  invoice_id: z.string().uuid("Ungültige Rechnung"),
  // Same ceiling as the default in the settings: a typo like 4500 instead of
  // 45,00 must not quietly become a demand sent to a customer.
  bounce_fee: z
    .number({ message: "Bitte einen gültigen Betrag eingeben" })
    .min(0, "Die Gebühr darf nicht negativ sein")
    .max(1000, "Die Gebühr erscheint unrealistisch hoch"),
});

export async function setBounceFee(formData: FormData): Promise<ActionResult> {
  const parsed = feeSchema.safeParse({
    invoice_id: formData.get("invoice_id"),
    bounce_fee: Number(formData.get("bounce_fee")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("invoices")
    .update({ bounce_fee: parsed.data.bounce_fee })
    .eq("id", parsed.data.invoice_id)
    .not("bounced_at", "is", null);

  if (error) return { error: "Gebühr konnte nicht gespeichert werden." };

  revalidatePath("/admin/offene-posten");
  return { success: true };
}

/**
 * Marks an open item as handled, or reopens it.
 *
 * Reversible on purpose: an irreversible tick on a money claim would turn a
 * misclick into a lost receivable.
 */
export async function setSettled(invoiceId: string, settled: boolean): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(invoiceId).success) {
    return { error: "Ungültige Rechnung" };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("invoices")
    .update({ settled_at: settled ? new Date().toISOString() : null })
    .eq("id", invoiceId)
    .not("bounced_at", "is", null);

  if (error) return { error: "Status konnte nicht geändert werden." };

  revalidatePath("/admin/offene-posten");
  return { success: true };
}

/**
 * Sends the payment reminder.
 *
 * The timestamp is written only after the mail was actually delivered — not
 * merely queued. Otherwise the list would claim the customer was reminded when
 * nothing left the building, and the admin would stop chasing a debt that was
 * never mentioned.
 */
export async function sendPaymentReminder(invoiceId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(invoiceId).success) {
    return { error: "Ungültige Rechnung" };
  }

  const { supabase } = await requireAdmin();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, customer_id, bounced_at, settled_at")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice || !invoice.bounced_at) {
    return { error: "Diese Rechnung ist kein offener Posten." };
  }
  if (invoice.settled_at) {
    return { error: "Dieser Posten ist bereits als erledigt markiert." };
  }

  // Timestamped on purpose. The dedupe key normally prevents duplicates, but
  // here repeating is the point: the admin may remind a second time and that
  // reminder has to actually leave the building.
  const dedupeKey = `zahlungserinnerung:${invoice.id}:${Date.now()}`;

  try {
    await enqueueAndDispatch({
      customerId: invoice.customer_id,
      eventType: "zahlungserinnerung",
      payload: { invoice_id: invoice.id },
      dedupeKey,
    });
  } catch {
    return { error: "Die Erinnerung konnte nicht verschickt werden." };
  }

  // enqueueAndDispatch records delivery failures instead of throwing, so the
  // call above succeeding says nothing about whether the mail actually went
  // out. Reading the outcome back matters: marking the item as reminded after
  // a failed send would make the admin stop chasing a debt the customer was
  // never told about.
  const service = createServiceClient();
  const { data: queued } = await service
    .from("notification_queue")
    .select("email_status")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();

  if (queued?.email_status !== "sent") {
    return {
      error:
        "Die Erinnerung konnte nicht zugestellt werden. Bitte prüfe die E-Mail-Adresse des Kunden.",
    };
  }

  const { error } = await supabase
    .from("invoices")
    .update({ reminded_at: new Date().toISOString() })
    .eq("id", invoiceId);

  if (error) return { error: "Erinnerung verschickt, konnte aber nicht vermerkt werden." };

  revalidatePath("/admin/offene-posten");
  return { success: true };
}
