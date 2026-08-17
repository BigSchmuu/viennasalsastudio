"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { enqueueAndDispatch } from "@/lib/notifications/dispatch";
import { collectionRunSchema } from "@/lib/validations/sepa";
import { generateSepaDirectDebitXml, type SepaXmlItem } from "@/lib/sepa/xml";
import type { ActionResult } from "@/lib/actions/types";

type CreateRunResult =
  | { error: string }
  | { duplicate: true; existingCount: number }
  | { success: true; runId: string; itemCount: number };

export async function createCollectionRun(formData: FormData): Promise<CreateRunResult> {
  const parsed = collectionRunSchema.safeParse({
    due_date: formData.get("due_date"),
    confirm_duplicate: formData.get("confirm_duplicate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase, user } = await requireAdmin();
  const dueDate = parsed.data.due_date;
  const confirmed = parsed.data.confirm_duplicate === "true";

  if (!confirmed) {
    const { count } = await supabase
      .from("sepa_collection_runs")
      .select("id", { count: "exact", head: true })
      .eq("due_date", dueDate);
    if (count && count > 0) {
      return { duplicate: true, existingCount: count };
    }
  }

  const [subscriptionsRes, mandatesRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, customer_id, name, price, pending_effective_date")
      .eq("status", "active"),
    supabase
      .from("sepa_mandates")
      .select("customer_id, iban, account_holder_name, mandate_reference")
      .is("revoked_at", null),
  ]);

  const mandateByCustomer = new Map((mandatesRes.data ?? []).map((m) => [m.customer_id, m]));

  const items = (subscriptionsRes.data ?? [])
    .filter((s) => s.price !== null && mandateByCustomer.has(s.customer_id))
    .filter((s) => !s.pending_effective_date || s.pending_effective_date > dueDate)
    .map((s) => {
      const mandate = mandateByCustomer.get(s.customer_id)!;
      return {
        customer_id: s.customer_id,
        subscription_id: s.id,
        amount: s.price as number,
        iban: mandate.iban,
        account_holder_name: mandate.account_holder_name,
        mandate_reference: mandate.mandate_reference,
      };
    });

  if (items.length === 0) {
    return { error: "Keine Kunden für diesen Lauf gefunden." };
  }

  const { data: run, error: runError } = await supabase
    .from("sepa_collection_runs")
    .insert({ due_date: dueDate, created_by: user.id })
    .select("id")
    .single();

  if (runError || !run) {
    return { error: "Lastschriftlauf konnte nicht erstellt werden." };
  }

  const { error: itemsError } = await supabase
    .from("sepa_collection_items")
    .insert(items.map((item) => ({ ...item, run_id: run.id })));

  if (itemsError) {
    return { error: "Lastschriftpositionen konnten nicht gespeichert werden." };
  }

  const { error: invoiceError } = await supabase.rpc("create_invoices_for_collection_run", {
    p_run_id: run.id,
  });
  if (invoiceError) {
    // Der Lastschriftlauf selbst ist bereits gespeichert; nur die Rechnungserstellung
    // ist fehlgeschlagen und müsste ggf. nachträglich untersucht werden.
    console.error("create_invoices_for_collection_run failed", invoiceError);
  }

  await Promise.all(
    items.map((item) =>
      enqueueAndDispatch({
        customerId: item.customer_id,
        eventType: "sepa_ankuendigung",
        payload: { amount: item.amount, due_date: dueDate },
        dedupeKey: `sepa_item:${item.subscription_id}:${dueDate}`,
      })
    )
  );

  revalidatePath("/admin/lastschriften");
  revalidatePath("/admin/rechnungen");
  return { success: true, runId: run.id, itemCount: items.length };
}

type RunXmlResult = { error: string } | { success: true; xml: string; filename: string };

export async function generateRunXml(runId: string): Promise<RunXmlResult> {
  const { supabase } = await requireAdmin();

  const creditorName = process.env.SEPA_CREDITOR_NAME;
  const creditorIban = process.env.SEPA_CREDITOR_IBAN;
  const creditorId = process.env.SEPA_CREDITOR_ID;
  const creditorBic = process.env.SEPA_CREDITOR_BIC;

  if (!creditorName || !creditorIban || !creditorId) {
    return {
      error:
        "SEPA-Gläubigerdaten sind nicht konfiguriert. Bitte SEPA_CREDITOR_NAME, SEPA_CREDITOR_IBAN und SEPA_CREDITOR_ID setzen.",
    };
  }

  const { data: run, error: runError } = await supabase
    .from("sepa_collection_runs")
    .select("id, due_date")
    .eq("id", runId)
    .single();
  if (runError || !run) {
    return { error: "Lastschriftlauf nicht gefunden." };
  }

  const { data: rawItems, error: itemsError } = await supabase
    .from("sepa_collection_items")
    .select("id, amount, iban, account_holder_name, mandate_reference, created_at, subscriptions(name)")
    .eq("run_id", runId)
    .order("created_at", { ascending: true });

  if (itemsError || !rawItems || rawItems.length === 0) {
    return { error: "Keine Positionen für diesen Lauf gefunden." };
  }

  const mandateReferences = [...new Set(rawItems.map((i) => i.mandate_reference))];
  const { data: mandates } = await supabase
    .from("sepa_mandates")
    .select("mandate_reference, consented_at")
    .in("mandate_reference", mandateReferences);
  const signedDateByReference = new Map(
    (mandates ?? []).map((m) => [m.mandate_reference, m.consented_at.slice(0, 10)])
  );

  const { data: priorItems } = await supabase
    .from("sepa_collection_items")
    .select("mandate_reference, created_at")
    .in("mandate_reference", mandateReferences);

  const items: SepaXmlItem[] = rawItems.map((item) => {
    const hasEarlierUse = (priorItems ?? []).some(
      (p) => p.mandate_reference === item.mandate_reference && p.created_at < item.created_at
    );
    return {
      id: item.id,
      amount: item.amount,
      iban: item.iban,
      accountHolderName: item.account_holder_name,
      mandateReference: item.mandate_reference,
      mandateSignedDate: signedDateByReference.get(item.mandate_reference) ?? run.due_date,
      sequenceType: hasEarlierUse ? "RCUR" : "FRST",
      remittanceInfo: (item.subscriptions as { name: string | null } | null)?.name ?? "Mitgliedsbeitrag",
    };
  });

  const xml = generateSepaDirectDebitXml({
    messageId: `VSS-${run.id}`,
    creationDateTime: new Date().toISOString(),
    dueDate: run.due_date,
    creditorName,
    creditorIban,
    creditorBic,
    creditorId,
    items,
  });

  return { success: true, xml, filename: `SEPA-Lastschrift-${run.due_date}.xml` };
}

export async function markItemBounced(itemId: string, bounced: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const bouncedAt = bounced ? new Date().toISOString() : null;

  const { error } = await supabase
    .from("sepa_collection_items")
    .update({ bounced_at: bouncedAt })
    .eq("id", itemId);

  if (error) {
    return { error: "Status konnte nicht aktualisiert werden." };
  }

  await supabase.from("invoices").update({ bounced_at: bouncedAt }).eq("collection_item_id", itemId);

  revalidatePath("/admin/lastschriften");
  revalidatePath("/admin/rechnungen");
  return { success: true };
}
