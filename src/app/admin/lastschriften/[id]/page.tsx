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
import {
  LAUF_ZUSTAND_BESCHRIFTUNG,
  LAUF_ZUSTAND_FARBE,
  istUeberfaelligerEntwurf,
  laufZustand,
} from "@/lib/sepa/laeufe";
import { heuteInWien } from "@/lib/constants/zeitzone";
import { ladeFerien } from "@/lib/scheduling/ferien";
import {
  auslassGrund,
  auslassText,
  istDatenfehler,
  type AuslassArt,
} from "@/lib/sepa/ausgelassen";
import {
  AusgelasseneAbos,
  type AusgelassenesAbo,
} from "@/components/admin/sepa/ausgelassene-abos";

/**
 * Was dieser Lauf übersehen hat — in zwei Listen.
 *
 * **Ausgelassen** sind die Abos, die der Lauf hätte einziehen können und aus
 * einem benennbaren Grund nicht eingezogen hat. Sie stehen namentlich oben auf
 * der Seite (PROJ-103); vorher gab es dort nur eine Zahl und zwei
 * Möglichkeiten, und genau das war der Anlass.
 *
 * **Offen** ist, was dem Lauf fehlt und sich von Hand nachtragen lässt — der
 * Inhalt des Dialogs „Position hinzufügen“, unverändert seit PROJ-47.
 *
 * Beide Listen kommen aus einem Durchgang und aus derselben Regel wie das
 * Anlegen des Laufs (`auslassGrund`). Bis PROJ-103 stand diese Regel zweimal
 * im Code — einmal zählend, einmal erklärend. Seit der Hinweis Namen nennt,
 * wäre eine Abweichung keine Unschönheit mehr, sondern eine Falschaussage
 * über Geld.
 */

/**
 * Gründe, bei denen ein Nachtragen von Hand sinnvoll sein kann — etwa nach
 * einer Rücklastschrift. Ein gekündigtes Abo und eines ohne Preis stehen
 * deshalb **nicht** im Dialog: Sie haben in der Zeile oben ihren eigenen Weg,
 * mit dem Grund daneben.
 */
const NACHTRAGBAR = new Set<AuslassArt>(["beginnt_spaeter", "zyklus_offen", "zyklus_vorgemerkt"]);

type Luecken = { offene: OffenePosition[]; ausgelassen: AusgelassenesAbo[] };

async function laufLuecken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  runId: string,
  dueDate: string
): Promise<Luecken> {
  const [abosRes, ticketsRes, eingezogenRes, imLaufRes, mandateRes, profileRes, frühereRes, ferien] =
    await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, customer_id, name, price, pending_effective_date, pending_status, cycle_anchor_date")
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
    // PROJ-70: Dieselbe Sperre wie beim Anlegen. Ohne sie böte diese Liste
    // genau die Abos wieder an, die der Lauf gerade übersprungen hat — und
    // der Betreiber trüge sie gutgläubig nach.
    supabase
      .from("sepa_collection_items")
      .select("subscription_id, sepa_collection_runs(due_date)")
      .not("subscription_id", "is", null)
      .neq("run_id", runId),
    ladeFerien(supabase),
  ]);

  const mitMandat = new Set((mandateRes.data ?? []).map((m) => m.customer_id));
  const nameJeKunde = new Map((profileRes.data ?? []).map((p) => [p.id, p.full_name ?? "Unbenannt"]));
  const schonEingezogen = new Set((eingezogenRes.data ?? []).map((i) => i.event_ticket_id));
  const imLauf = new Set(
    (imLaufRes.data ?? []).flatMap((i) => [i.subscription_id, i.event_ticket_id].filter(Boolean))
  );

  const einzuegeJeAbo = new Map<string, string[]>();
  for (const zeile of frühereRes.data ?? []) {
    const abo = zeile.subscription_id;
    const faellig = zeile.sepa_collection_runs?.due_date;
    if (!abo || !faellig) continue;
    const bisher = einzuegeJeAbo.get(abo) ?? [];
    bisher.push(faellig);
    einzuegeJeAbo.set(abo, bisher);
  }

  const offeneAbos: OffenePosition[] = [];
  const ausgelassen: AusgelassenesAbo[] = [];

  for (const s of abosRes.data ?? []) {
    // Ohne gültiges Mandat ist das ein Barzahler — er gehört in keine der
    // beiden Listen (PROJ-103, bewusst entschieden).
    if (!mitMandat.has(s.customer_id) || imLauf.has(s.id)) continue;

    const kundenname = nameJeKunde.get(s.customer_id) ?? "Unbenannt";
    const bezeichnung = s.name ?? "Abo";
    const grund = auslassGrund(s, dueDate, einzuegeJeAbo.get(s.id), ferien);

    if (grund) {
      ausgelassen.push({
        aboId: s.id,
        kundeId: s.customer_id,
        kundenname,
        bezeichnung,
        preis: s.price === null ? null : Number(s.price),
        grundText: auslassText(grund),
        datenfehler: istDatenfehler(grund),
      });
    }

    if (s.price !== null && (!grund || NACHTRAGBAR.has(grund.art))) {
      offeneAbos.push({
        id: s.id,
        art: "abo",
        kundenname,
        bezeichnung,
        vorschlagsbetrag: Number(s.price),
        // PROJ-70: Nicht ausfiltern, sondern kennzeichnen. Von Hand soll der
        // Betreiber ein ausgelassenes Abo eintragen können — ohne den Satz
        // daneben wäre das aber genau der Doppeleinzug, den wir loswerden
        // wollen.
        hinweis: grund ? auslassText(grund) : undefined,
      });
    }
  }

  const tickets: OffenePosition[] = (ticketsRes.data ?? [])
    .filter((t) => mitMandat.has(t.customer_id) && !schonEingezogen.has(t.id) && !imLauf.has(t.id))
    .map((t) => ({
      id: t.id,
      art: "ticket" as const,
      kundenname: nameJeKunde.get(t.customer_id) ?? "Unbenannt",
      bezeichnung: t.events?.name ? `Ticket · ${t.events.name}` : "Ticket",
      vorschlagsbetrag: Number(t.price),
    }));

  const nachNamen = (a: { kundenname: string }, b: { kundenname: string }) =>
    a.kundenname.localeCompare(b.kundenname, "de-AT");

  return {
    offene: [...offeneAbos, ...tickets].sort(nachNamen),
    ausgelassen: ausgelassen.sort(nachNamen),
  };
}

export default async function LastschriftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
  // Nach der Freigabe ist am Lauf nichts mehr zu entscheiden — dann gibt es
  // weder den Dialog noch den Hinweis auf ausgelassene Abos.
  const { offene, ausgelassen } = entwurf
    ? await laufLuecken(supabase, id, run.due_date)
    : { offene: [], ausgelassen: [] };

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

      {/* PROJ-70: Ein Lauf mit weniger Positionen als erwartet sieht aus wie
          ein Fehler, wenn niemand sagt, warum.
          PROJ-103: Und eine Zahl ohne Namen lässt sich nicht beurteilen. Der
          Kasten rechnet sich aus dem Lauf, nicht aus der Adresse — er ist
          nach dem Neuladen und an jedem älteren Entwurf noch da. */}
      <AusgelasseneAbos runId={run.id} abos={ausgelassen} />
      <CollectionRunDetail
        runId={run.id}
        items={items}
        freigegebenAm={run.released_at}
        freigegebenVon={freigegebenVon}
        offenePositionen={offene}
        ueberfaellig={istUeberfaelligerEntwurf(run.due_date, run.released_at, heuteInWien())}
      />
    </div>
  );
}
