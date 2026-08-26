"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { enqueueNotification } from "@/lib/notifications/dispatch";
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

  const [subscriptionsRes, ticketsRes, collectedTicketIdsRes, mandatesRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, customer_id, name, price, pending_effective_date")
      .eq("status", "active"),
    supabase
      .from("tickets")
      .select("id, customer_id, price")
      .eq("payment_method", "sepa")
      .in("status", ["confirmed", "checked_in"]),
    // Tickets already picked up by an earlier run must not be billed twice.
    supabase.from("sepa_collection_items").select("event_ticket_id").not("event_ticket_id", "is", null),
    supabase
      .from("sepa_mandates")
      .select("customer_id, iban, account_holder_name, mandate_reference")
      .is("revoked_at", null),
  ]);

  const mandateByCustomer = new Map((mandatesRes.data ?? []).map((m) => [m.customer_id, m]));
  const alreadyCollectedTicketIds = new Set((collectedTicketIdsRes.data ?? []).map((i) => i.event_ticket_id));

  const subscriptionItems = (subscriptionsRes.data ?? [])
    .filter((s) => s.price !== null && mandateByCustomer.has(s.customer_id))
    .filter((s) => !s.pending_effective_date || s.pending_effective_date > dueDate)
    .map((s) => {
      const mandate = mandateByCustomer.get(s.customer_id)!;
      return {
        customer_id: s.customer_id,
        subscription_id: s.id as string | null,
        event_ticket_id: null as string | null,
        amount: s.price as number,
        iban: mandate.iban,
        account_holder_name: mandate.account_holder_name,
        mandate_reference: mandate.mandate_reference,
      };
    });

  const ticketItems = (ticketsRes.data ?? [])
    .filter((t) => mandateByCustomer.has(t.customer_id) && !alreadyCollectedTicketIds.has(t.id))
    .map((t) => {
      const mandate = mandateByCustomer.get(t.customer_id)!;
      return {
        customer_id: t.customer_id,
        subscription_id: null as string | null,
        event_ticket_id: t.id as string | null,
        amount: t.price,
        iban: mandate.iban,
        account_holder_name: mandate.account_holder_name,
        mandate_reference: mandate.mandate_reference,
      };
    });

  const items = [...subscriptionItems, ...ticketItems];

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

  const { data: angelegtePositionen, error: itemsError } = await supabase
    .from("sepa_collection_items")
    .insert(items.map((item) => ({ ...item, run_id: run.id })))
    .select("id, customer_id, subscription_id, event_ticket_id, amount");

  if (itemsError) {
    return { error: "Lastschriftpositionen konnten nicht gespeichert werden." };
  }

  // PROJ-44: Empfehlungen, deren erste Lastschrift durchgegangen ist, werden
  // jetzt belohnt — vor der Verrechnung, damit das frische Guthaben schon
  // diesen Lauf mindert. Wer im vorigen Lauf geworben hat, wartet nicht noch
  // einen Monat auf die Wirkung.
  const { data: belohnungen, error: belohnungFehler } = await supabase.rpc(
    "grant_pending_referral_rewards"
  );
  if (belohnungFehler) {
    // Der Lauf selbst steht bereits. Eine ausgefallene Belohnung ist ärgerlich,
    // aber sie geht nicht verloren: Solange referral_rewarded_at leer bleibt,
    // findet der nächste Lauf denselben Fall wieder.
    console.error("grant_pending_referral_rewards failed", belohnungFehler);
  }

  // Was angekündigt wird, führt diese Liste — die Verrechnung darunter senkt
  // einzelne Beträge, und die Ankündigung muss den gesenkten nennen.
  const angekuendigt = (angelegtePositionen ?? []).map((position) => ({
    customerId: position.customer_id,
    subscriptionId: position.subscription_id,
    eventTicketId: position.event_ticket_id,
    amount: position.amount as number,
  }));

  // PROJ-44: Guthaben mindert den abzubuchenden Betrag — es entsteht keine
  // zweite Buchung, denn eine negative Lastschrift gibt es nicht.
  //
  // Erst nach dem Anlegen, weil die Verrechnung an der Position festgehalten
  // wird: Nur so kann ein wiederholter Lauf dasselbe Guthaben nicht zweimal
  // verbrauchen.
  //
  // Nur Abo-Positionen. Tickets werden nicht regelmäßig eingezogen; dort hätte
  // eine Verrechnung keinen natürlichen Zeitpunkt.
  for (const [index, position] of (angelegtePositionen ?? []).entries()) {
    if (!position.subscription_id || position.amount <= 0) continue;
    const { data: verrechnet } = await supabase.rpc("redeem_customer_credit", {
      p_customer_id: position.customer_id,
      p_collection_item_id: position.id,
      p_max_amount: position.amount,
    });
    if (verrechnet && verrechnet > 0) {
      const gemindert = position.amount - verrechnet;
      await supabase
        .from("sepa_collection_items")
        .update({ amount: gemindert })
        .eq("id", position.id);
      angekuendigt[index].amount = gemindert;
    }
  }

  const { error: invoiceError } = await supabase.rpc("create_invoices_for_collection_run", {
    p_run_id: run.id,
  });
  if (invoiceError) {
    // Der Lastschriftlauf selbst ist bereits gespeichert; nur die Rechnungserstellung
    // ist fehlgeschlagen und müsste ggf. nachträglich untersucht werden.
    console.error("create_invoices_for_collection_run failed", invoiceError);
  }

  // Queue-only, not enqueueAndDispatch: with many customers, waiting on a
  // synchronous email+push attempt per item here risked the admin's request
  // timing out even though the run/invoices already saved successfully. The
  // cron drain sends these. Keyed by run.id (not due_date) so a correction
  // run for the same due date still gets its own announcement per item.
  //
  // Der angekündigte Betrag ist der nach der Guthabenverrechnung — eine
  // Vorabankündigung, die mehr nennt als abgebucht wird, ist keine.
  await Promise.all(
    angekuendigt.map((item) =>
      enqueueNotification({
        customerId: item.customerId,
        eventType: "sepa_ankuendigung",
        payload: { amount: item.amount, due_date: dueDate },
        dedupeKey: `sepa_item:${item.subscriptionId ?? item.eventTicketId}:${run.id}`,
      })
    )
  );

  // Nur der Werbende wird benachrichtigt. Der Geworbene sieht sein Guthaben
  // ohnehin auf der Rechnung, die dieser Lauf gerade erzeugt hat.
  await Promise.all(
    (belohnungen ?? [])
      .filter((b) => Number(b.referrer_amount) > 0)
      .map((b) =>
        enqueueNotification({
          customerId: b.referrer_id,
          eventType: "empfehlung",
          payload: { amount: Number(b.referrer_amount), balance: Number(b.referrer_balance) },
          dedupeKey: `empfehlung:${b.referee_id}`,
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
    .select(
      "id, amount, iban, account_holder_name, mandate_reference, created_at, subscriptions(name), tickets(events(name))"
    )
    .eq("run_id", runId)
    .order("created_at", { ascending: true });

  if (itemsError || !rawItems || rawItems.length === 0) {
    return { error: "Keine Positionen für diesen Lauf gefunden." };
  }

  // PROJ-44: Deckt das Guthaben den vollen Beitrag, bleibt eine Position über
  // 0 € stehen. Sie gehört in die Rechnung — dort erklärt sie, warum nichts
  // abgebucht wurde — aber nicht in die Bankdatei: Eine Lastschrift über 0 €
  // weist die Bank ab, und das kann die ganze Datei mitnehmen.
  const einzuziehen = rawItems.filter((item) => item.amount > 0);
  if (einzuziehen.length === 0) {
    return { error: "In diesem Lauf ist nichts einzuziehen — alle Beträge sind durch Guthaben gedeckt." };
  }

  const mandateReferences = [...new Set(einzuziehen.map((i) => i.mandate_reference))];
  const { data: mandates } = await supabase
    .from("sepa_mandates")
    .select("mandate_reference, consented_at")
    .in("mandate_reference", mandateReferences);
  const signedDateByReference = new Map(
    (mandates ?? []).map((m) => [m.mandate_reference, m.consented_at.slice(0, 10)])
  );

  // Nur wirklich eingezogene Positionen zählen als frühere Nutzung des
  // Mandats: Eine durch Guthaben auf 0 € gesunkene Position war nie in einer
  // Bankdatei. Zählte sie mit, würde die nächste Lastschrift als
  // Folgelastschrift gekennzeichnet, obwohl das Mandat noch nie benutzt wurde.
  const { data: priorItems } = await supabase
    .from("sepa_collection_items")
    .select("mandate_reference, created_at")
    .in("mandate_reference", mandateReferences)
    .gt("amount", 0);

  const items: SepaXmlItem[] = einzuziehen.map((item) => {
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
      remittanceInfo:
        (item.subscriptions as { name: string | null } | null)?.name ??
        (item.tickets as { events: { name: string } | null } | null)?.events?.name ??
        "Mitgliedsbeitrag",
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
