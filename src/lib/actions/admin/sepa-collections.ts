"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { enqueueNotification } from "@/lib/notifications/dispatch";
import { collectionRunSchema } from "@/lib/validations/sepa";
import { generateSepaDirectDebitXml, type SepaXmlItem } from "@/lib/sepa/xml";
import { POSITION_BETRAG_MAX } from "@/lib/sepa/laeufe";
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

  // PROJ-47: Der Lauf entsteht als Entwurf. Rechnungen und Vorabankuendigung
  // gibt es erst mit der Freigabe -- bis dahin ist eine Korrektur folgenlos.
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

  // PROJ-44: Guthaben mindert den abzubuchenden Betrag — es entsteht keine
  // zweite Buchung, denn eine negative Lastschrift gibt es nicht.
  //
  // Erst nach dem Anlegen, weil die Verrechnung an der Position festgehalten
  // wird: Nur so kann ein wiederholter Lauf dasselbe Guthaben nicht zweimal
  // verbrauchen.
  //
  // Nur Abo-Positionen. Tickets werden nicht regelmäßig eingezogen; dort hätte
  // eine Verrechnung keinen natürlichen Zeitpunkt.
  for (const position of angelegtePositionen ?? []) {
    if (!position.subscription_id || position.amount <= 0) continue;
    const { data: verrechnet } = await supabase.rpc("redeem_customer_credit", {
      p_customer_id: position.customer_id,
      p_collection_item_id: position.id,
      p_max_amount: position.amount,
    });
    if (verrechnet && verrechnet > 0) {
      const gemindert = position.amount - verrechnet;
      const { error: senkFehler } = await supabase
        .from("sepa_collection_items")
        .update({ amount: gemindert })
        .eq("id", position.id);
      if (senkFehler) {
        // Das darf nicht stillschweigend danebengehen: Die Guthabenzeile ist
        // dann schon geschrieben, und ein unveraendert stehender Betrag
        // buchte den vollen Beitrag ab, obwohl das Guthaben verbraucht ist.
        console.error("Betrag nach Guthabenverrechnung nicht gesenkt", senkFehler);
        await supabase.rpc("return_collection_item_credit", {
          p_collection_item_id: position.id,
        });
        return {
          error:
            "Die Guthabenverrechnung ist fehlgeschlagen. Der Lauf wurde angelegt, aber ein Betrag stimmt nicht — bitte den Entwurf verwerfen und neu anlegen.",
        };
      }
    }
  }

  // Nur der Werbende wird benachrichtigt. Der Geworbene sieht sein Guthaben
  // ohnehin auf der Rechnung, die mit der Freigabe entsteht.
  //
  // Diese Nachricht bleibt beim Anlegen, obwohl sie nach aussen geht: Sie
  // gehoert nicht zu diesem Lauf, sondern zu einer Empfehlung, deren erste
  // Lastschrift laengst durchgegangen ist. Ob dieser Entwurf freigegeben oder
  // verworfen wird, aendert daran nichts.
  await Promise.all(
    (belohnungen ?? [])
      .filter((b) => Number(b.referrer_amount) > 0)
      .map((b) =>
        enqueueNotification({
          customerId: b.referrer_id,
          eventType: "guthaben",
          payload: {
            sub_type: "referral",
            amount: Number(b.referrer_amount),
            balance: Number(b.referrer_balance),
          },
          dedupeKey: `guthaben_empfehlung:${b.referee_id}`,
        })
      )
  );

  revalidatePath("/admin/lastschriften");
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

/* ------------------------------------------------------------------------ *
 * PROJ-47: Korrekturen am Entwurf
 *
 * Alle fuenf pruefen zuerst, ob der Lauf ueberhaupt noch ein Entwurf ist. Die
 * Oberflaeche bietet die Schaltflaechen zwar gar nicht erst an, aber sie ist
 * nicht der einzige Weg hierher -- und bei einem Vorgang, der Geld bewegt,
 * genuegt eine ausgeblendete Schaltflaeche nicht.
 *
 * Die verbindliche Sperre kommt im Backend-Schritt als Waechter in die
 * Datenbank. Diese Pruefungen hier bleiben trotzdem: Sie liefern dem
 * Betreiber einen Satz statt einer Datenbankmeldung.
 * ------------------------------------------------------------------------ */

/** Der Lauf zu einer Position, oder eine Absage. */
async function entwurfsLauf(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  runId: string
): Promise<{ error: string } | { ok: true }> {
  const { data: run, error } = await supabase
    .from("sepa_collection_runs")
    .select("id, released_at")
    .eq("id", runId)
    .maybeSingle();

  if (error) return { error: "Der Lastschriftlauf konnte nicht gelesen werden." };
  if (!run) return { error: "Diesen Lastschriftlauf gibt es nicht (mehr)." };
  if (run.released_at) {
    return {
      error:
        "Dieser Lauf ist bereits freigegeben und lässt sich nicht mehr ändern. Eine Korrektur läuft jetzt über Storno oder Gutschrift.",
    };
  }
  return { ok: true };
}

export async function aendereLaufPositionsbetrag(
  itemId: string,
  betrag: number
): Promise<ActionResult> {
  if (!Number.isFinite(betrag) || betrag <= 0) {
    return { error: "Der Betrag muss größer als null sein." };
  }
  if (betrag > POSITION_BETRAG_MAX) {
    return { error: `Höchstens ${POSITION_BETRAG_MAX} €. Das sieht nach einem Vertipper aus.` };
  }

  const { supabase } = await requireAdmin();

  const { data: position, error: leseFehler } = await supabase
    .from("sepa_collection_items")
    .select("id, run_id")
    .eq("id", itemId)
    .maybeSingle();
  if (leseFehler) return { error: "Die Position konnte nicht gelesen werden." };
  if (!position) return { error: "Diese Position gibt es nicht (mehr)." };

  const zustand = await entwurfsLauf(supabase, position.run_id);
  if ("error" in zustand) return zustand;

  // Guthaben zuerst zurueckgeben, dann gegen den neuen Betrag neu verrechnen.
  // Die Differenz anzupassen ginge bei kleinen Aenderungen gut und bei der
  // einen, auf die es ankommt, schief: unter das bereits verrechnete Guthaben
  // gesenkt muesste die Position negativ werden.
  const { error: rueckgabeFehler } = await supabase.rpc("return_collection_item_credit", {
    p_collection_item_id: itemId,
  });
  if (rueckgabeFehler) {
    return { error: "Das verrechnete Guthaben konnte nicht zurückgegeben werden." };
  }

  const { error: schreibFehler } = await supabase
    .from("sepa_collection_items")
    .update({ amount: betrag })
    .eq("id", itemId);
  if (schreibFehler) return { error: "Der Betrag konnte nicht gespeichert werden." };

  await verrechneGuthabenNeu(supabase, itemId);

  revalidatePath(`/admin/lastschriften/${position.run_id}`);
  revalidatePath("/admin/lastschriften");
  return { success: true };
}

export async function entferneLaufPosition(itemId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();

  const { data: position, error: leseFehler } = await supabase
    .from("sepa_collection_items")
    .select("id, run_id")
    .eq("id", itemId)
    .maybeSingle();
  if (leseFehler) return { error: "Die Position konnte nicht gelesen werden." };
  if (!position) return { error: "Diese Position gibt es nicht (mehr)." };

  const zustand = await entwurfsLauf(supabase, position.run_id);
  if ("error" in zustand) return zustand;

  const { error: rueckgabeFehler } = await supabase.rpc("return_collection_item_credit", {
    p_collection_item_id: itemId,
  });
  if (rueckgabeFehler) {
    return { error: "Das verrechnete Guthaben konnte nicht zurückgegeben werden." };
  }

  const { error } = await supabase.from("sepa_collection_items").delete().eq("id", itemId);
  if (error) return { error: "Die Position konnte nicht entfernt werden." };

  revalidatePath(`/admin/lastschriften/${position.run_id}`);
  revalidatePath("/admin/lastschriften");
  return { success: true };
}

/**
 * Verrechnet vorhandenes Guthaben gegen eine Position und senkt ihren Betrag.
 *
 * Dieselben zwei Schritte wie beim Anlegen eines Laufs. Sie stehen hier
 * gesondert, weil jede Korrektur sie wiederholt — und weil sie zusammen
 * gehoeren: Eine Verrechnung ohne Senkung buchte das Guthaben ab, ohne dass es
 * jemandem zugutekaeme.
 */
async function verrechneGuthabenNeu(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  itemId: string
): Promise<void> {
  const { data: position } = await supabase
    .from("sepa_collection_items")
    .select("id, customer_id, subscription_id, amount")
    .eq("id", itemId)
    .maybeSingle();

  // Nur Abo-Positionen. Tickets werden nicht regelmaessig eingezogen; dort
  // haette eine Verrechnung keinen natuerlichen Zeitpunkt.
  if (!position || !position.subscription_id || position.amount <= 0) return;

  const { data: verrechnet } = await supabase.rpc("redeem_customer_credit", {
    p_customer_id: position.customer_id,
    p_collection_item_id: position.id,
    p_max_amount: position.amount,
  });

  if (verrechnet && verrechnet > 0) {
    const { error } = await supabase
      .from("sepa_collection_items")
      .update({ amount: position.amount - verrechnet })
      .eq("id", position.id);
    if (error) {
      // Siehe createCollectionRun: ein stiller Fehlschlag hier kostet den
      // Kunden sein Guthaben und bucht trotzdem voll ab.
      console.error("Betrag nach Guthabenverrechnung nicht gesenkt", error);
      await supabase.rpc("return_collection_item_credit", { p_collection_item_id: position.id });
    }
  }
}

export async function fuegeLaufPositionHinzu(
  runId: string,
  auswahl: { id: string; art: "abo" | "ticket" },
  betrag: number
): Promise<ActionResult> {
  if (!Number.isFinite(betrag) || betrag <= 0) {
    return { error: "Der Betrag muss größer als null sein." };
  }
  if (betrag > POSITION_BETRAG_MAX) {
    return { error: `Höchstens ${POSITION_BETRAG_MAX} €. Das sieht nach einem Vertipper aus.` };
  }

  const { supabase } = await requireAdmin();

  const zustand = await entwurfsLauf(supabase, runId);
  if ("error" in zustand) return zustand;

  // Kunde und Mandat kommen aus der Quelle, nicht aus der Eingabe: Sonst
  // koennte eine Position gegen ein fremdes Konto entstehen.
  const { data: quelle } =
    auswahl.art === "abo"
      ? await supabase
          .from("subscriptions")
          .select("id, customer_id, status")
          .eq("id", auswahl.id)
          .maybeSingle()
      : await supabase
          .from("tickets")
          .select("id, customer_id, status")
          .eq("id", auswahl.id)
          .maybeSingle();

  if (!quelle) return { error: "Dieses Abo oder Ticket gibt es nicht (mehr)." };

  const { data: mandat } = await supabase
    .from("sepa_mandates")
    .select("iban, account_holder_name, mandate_reference")
    .eq("customer_id", quelle.customer_id)
    .is("revoked_at", null)
    .maybeSingle();

  if (!mandat) {
    return { error: "Für diesen Kunden gibt es kein gültiges SEPA-Mandat mehr." };
  }

  const { data: neu, error } = await supabase
    .from("sepa_collection_items")
    .insert({
      run_id: runId,
      customer_id: quelle.customer_id,
      subscription_id: auswahl.art === "abo" ? auswahl.id : null,
      event_ticket_id: auswahl.art === "ticket" ? auswahl.id : null,
      amount: betrag,
      iban: mandat.iban,
      account_holder_name: mandat.account_holder_name,
      mandate_reference: mandat.mandate_reference,
    })
    .select("id")
    .single();

  if (error || !neu) return { error: "Die Position konnte nicht hinzugefügt werden." };

  await verrechneGuthabenNeu(supabase, neu.id);

  revalidatePath(`/admin/lastschriften/${runId}`);
  revalidatePath("/admin/lastschriften");
  return { success: true };
}

export async function verwirfLaufEntwurf(runId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();

  const zustand = await entwurfsLauf(supabase, runId);
  if ("error" in zustand) return zustand;

  const { data: positionen } = await supabase
    .from("sepa_collection_items")
    .select("id")
    .eq("run_id", runId);

  // Guthaben zuerst zurueck, dann loeschen: Nach dem Loeschen gaebe es keinen
  // Bezug mehr, an dem die Verrechnung haengt.
  for (const position of positionen ?? []) {
    const { error } = await supabase.rpc("return_collection_item_credit", {
      p_collection_item_id: position.id,
    });
    if (error) return { error: "Das verrechnete Guthaben konnte nicht zurückgegeben werden." };
  }

  const { error: positionsFehler } = await supabase
    .from("sepa_collection_items")
    .delete()
    .eq("run_id", runId);
  if (positionsFehler) return { error: "Die Positionen konnten nicht entfernt werden." };

  const { error } = await supabase.from("sepa_collection_runs").delete().eq("id", runId);
  if (error) return { error: "Der Entwurf konnte nicht verworfen werden." };

  revalidatePath("/admin/lastschriften");
  return { success: true };
}

/**
 * Die Freigabe.
 *
 * Der eigentliche Vorgang liegt in der Datenbank, weil Rechnungen,
 * Ankuendigungen und Sperre gemeinsam oder gar nicht passieren muessen — und
 * weil zwei gleichzeitige Freigaben sonst zwei Rechnungssaetze erzeugen
 * koennten. Hier bleibt nur, die Meldung in einen Satz zu uebersetzen.
 */
const FREIGABE_FEHLER: [string, string][] = [
  ["not authorized", "Nur Administrator:innen dürfen einen Lauf freigeben."],
  ["collection run not found", "Diesen Lastschriftlauf gibt es nicht (mehr)."],
  ["already released", "Dieser Lauf ist bereits freigegeben."],
  ["has no items", "Ein Lauf ohne Positionen lässt sich nicht freigeben."],
];

export async function gibLaufFrei(runId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc("release_collection_run", { p_run_id: runId });

  if (error) {
    const treffer = FREIGABE_FEHLER.find(([kennung]) => error.message.includes(kennung));
    return { error: treffer?.[1] ?? "Der Lauf konnte nicht freigegeben werden." };
  }

  revalidatePath(`/admin/lastschriften/${runId}`);
  revalidatePath("/admin/lastschriften");
  revalidatePath("/admin/rechnungen");
  return { success: true };
}
