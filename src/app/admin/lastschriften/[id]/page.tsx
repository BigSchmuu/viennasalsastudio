import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CollectionRunDetail,
  type CollectionItemRow,
} from "@/components/admin/sepa/collection-run-detail";
import type { OffenePosition } from "@/components/admin/sepa/positions-dialoge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LAUF_ZUSTAND_BESCHRIFTUNG, LAUF_ZUSTAND_FARBE, laufZustand } from "@/lib/sepa/laeufe";

/**
 * Was dieser Lauf übersehen hat.
 *
 * Dieselbe Regel wie beim Anlegen — aktives Abo oder SEPA-Ticket, gültiges
 * Mandat, nicht schon eingezogen —, abzüglich dessen, was im Lauf bereits
 * steht. Eine zweite, eigene Regel würde irgendwann von der ersten abweichen,
 * und dann wäre unklar, welche stimmt.
 */
async function offenePositionen(
  supabase: Awaited<ReturnType<typeof createClient>>,
  runId: string,
  dueDate: string
): Promise<OffenePosition[]> {
  const [abosRes, ticketsRes, eingezogenRes, imLaufRes, mandateRes, profileRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, customer_id, name, price, pending_effective_date")
      .eq("status", "active"),
    supabase
      .from("tickets")
      .select("id, customer_id, price, events(name)")
      .eq("payment_method", "sepa")
      .in("status", ["confirmed", "checked_in"]),
    supabase.from("sepa_collection_items").select("event_ticket_id").not("event_ticket_id", "is", null),
    supabase.from("sepa_collection_items").select("subscription_id, event_ticket_id").eq("run_id", runId),
    supabase.from("sepa_mandates").select("customer_id").is("revoked_at", null),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const mitMandat = new Set((mandateRes.data ?? []).map((m) => m.customer_id));
  const nameJeKunde = new Map((profileRes.data ?? []).map((p) => [p.id, p.full_name ?? "Unbenannt"]));
  const schonEingezogen = new Set((eingezogenRes.data ?? []).map((i) => i.event_ticket_id));
  const imLauf = new Set(
    (imLaufRes.data ?? []).flatMap((i) => [i.subscription_id, i.event_ticket_id].filter(Boolean))
  );

  const abos: OffenePosition[] = (abosRes.data ?? [])
    .filter((s) => s.price !== null && mitMandat.has(s.customer_id) && !imLauf.has(s.id))
    .filter((s) => !s.pending_effective_date || s.pending_effective_date > dueDate)
    .map((s) => ({
      id: s.id,
      art: "abo" as const,
      kundenname: nameJeKunde.get(s.customer_id) ?? "Unbenannt",
      bezeichnung: s.name ?? "Abo",
      vorschlagsbetrag: Number(s.price),
    }));

  const tickets: OffenePosition[] = (ticketsRes.data ?? [])
    .filter((t) => mitMandat.has(t.customer_id) && !schonEingezogen.has(t.id) && !imLauf.has(t.id))
    .map((t) => ({
      id: t.id,
      art: "ticket" as const,
      kundenname: nameJeKunde.get(t.customer_id) ?? "Unbenannt",
      bezeichnung: t.events?.name ? `Ticket · ${t.events.name}` : "Ticket",
      vorschlagsbetrag: Number(t.price),
    }));

  return [...abos, ...tickets].sort((a, b) => a.kundenname.localeCompare(b.kundenname, "de-AT"));
}

export default async function LastschriftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: run } = await supabase
    .from("sepa_collection_runs")
    .select("id, due_date, released_at, released_by")
    .eq("id", id)
    .single();
  if (!run) {
    notFound();
  }

  const { data: rawItems } = await supabase
    .from("sepa_collection_items")
    .select(
      "id, customer_id, amount, bounced_at, subscription_id, subscriptions(name), tickets(events(name)), profiles(full_name)"
    )
    .eq("run_id", id)
    .order("created_at", { ascending: true });

  const items: CollectionItemRow[] = (rawItems ?? []).map((item) => ({
    id: item.id,
    customerId: item.customer_id,
    customerName: item.profiles?.full_name ?? "Unbenannt",
    // Bis PROJ-47 stand hier nur der Abo-Name — eine Ticketposition zeigte
    // deshalb einen Strich, obwohl sie einen Bezug hat.
    bezug: item.subscriptions?.name ?? (item.tickets?.events?.name
      ? `Ticket · ${item.tickets.events.name}`
      : "—"),
    amount: item.amount,
    bouncedAt: item.bounced_at,
  }));

  const entwurf = run.released_at === null;
  const offene = entwurf ? await offenePositionen(supabase, id, run.due_date) : [];

  // Der Name des Freigebenden steht in den Anmeldedaten, nicht im Profil.
  let freigegebenVon: string | null = null;
  if (run.released_by) {
    const { data: profil } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", run.released_by)
      .maybeSingle();
    freigegebenVon = profil?.full_name ?? null;
  }

  const zustand = laufZustand(run.released_at, items.some((i) => i.bouncedAt !== null));

  return (
    <div className="space-y-6">
      <div>
        <Button variant="link" className="px-0" asChild>
          <Link href="/admin/lastschriften">← Zurück zu Lastschriften</Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-xl font-bold">
            Lastschriftlauf {new Date(run.due_date).toLocaleDateString("de-AT")}
          </h2>
          <Badge style={{ backgroundColor: LAUF_ZUSTAND_FARBE[zustand], color: "white" }}>
            {LAUF_ZUSTAND_BESCHRIFTUNG[zustand]}
          </Badge>
        </div>
      </div>
      <CollectionRunDetail
        runId={run.id}
        items={items}
        freigegebenAm={run.released_at}
        freigegebenVon={freigegebenVon}
        offenePositionen={offene}
      />
    </div>
  );
}
