import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CollectionRunDetail,
  type CollectionItemRow,
} from "@/components/admin/sepa/collection-run-detail";
import type { OffenePosition } from "@/components/admin/sepa/positions-dialoge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  type Zyklus,
} from "@/lib/sepa/ausgelassen";
import { ladeZyklus, einzuegeJeAbo } from "@/lib/sepa/zyklus";
import { beitragOffenOhneMandat, ohneMandatText } from "@/lib/sepa/ohne-mandat";
import { OhneMandatAbos, type OhneMandatAbo } from "@/components/admin/sepa/ohne-mandat-abos";
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
const NACHTRAGBAR = new Set<AuslassArt>([
  "beginnt_spaeter",
  "zyklus_offen",
  "zyklus_vorgemerkt",
  // PROJ-107: Nach einer Rücklastschrift muss ein Abo auch innerhalb seines
  // Zyklus ein zweites Mal eingezogen werden können.
  "zyklus_eingezogen",
]);

type Luecken = {
  offene: OffenePosition[];
  ausgelassen: AusgelassenesAbo[];
  /** PROJ-105: Mandat widerrufen, Beitrag offen — fiel vorher aus beiden Listen. */
  ohneMandat: OhneMandatAbo[];
};

async function laufLuecken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  runId: string,
  dueDate: string,
  zyklus: Zyklus | null
): Promise<Luecken> {
  const [
    abosRes,
    ticketsRes,
    eingezogenRes,
    imLaufRes,
    mandateRes,
    widerrufenRes,
    barzahlungRes,
    profileRes,
    frühereRes,
    ferien,
  ] = await Promise.all([
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
    // PROJ-105: Wer **einmal** ein Mandat hatte. Das ist die Trennlinie zum
    // echten Barzahler, der nie eines erteilt hat und deshalb nicht bei jedem
    // Lauf in dieser Liste stehen soll.
    supabase.from("sepa_mandates").select("customer_id").not("revoked_at", "is", null),
    // PROJ-105: Was schon auf der Barzahlungsliste steht — damit nicht zweimal
    // kassiert wird.
    supabase.from("cash_entries").select("subscription_id"),
    supabase.from("profiles").select("id, full_name"),
    // PROJ-70: Dieselbe Sperre wie beim Anlegen. Ohne sie böte diese Liste
    // genau die Abos wieder an, die der Lauf gerade übersprungen hat — und
    // der Betreiber trüge sie gutgläubig nach.
    supabase
      .from("sepa_collection_items")
      .select("subscription_id, sepa_collection_runs(due_date, cycle_id)")
      .not("subscription_id", "is", null)
      .neq("run_id", runId),
    ladeFerien(supabase),
  ]);

  // Ein Lesefehler darf nicht als „hatte nie ein Mandat" durchgehen — dann
  // verschwände das Abo wieder aus allen drei Listen, also genau der Fehler,
  // den diese Liste beseitigt.
  if (mandateRes.error || widerrufenRes.error || barzahlungRes.error) {
    console.error(
      "PROJ-105: Mandate oder Barzahlungsliste nicht lesbar",
      mandateRes.error ?? widerrufenRes.error ?? barzahlungRes.error
    );
    throw new Error("Die SEPA-Mandate konnten nicht geprüft werden");
  }

  const mitMandat = new Set((mandateRes.data ?? []).map((m) => m.customer_id));
  const hatteMandat = new Set((widerrufenRes.data ?? []).map((m) => m.customer_id));
  const aufBarzahlungsliste = new Set(
    (barzahlungRes.data ?? []).map((e) => e.subscription_id).filter(Boolean)
  );
  const nameJeKunde = new Map((profileRes.data ?? []).map((p) => [p.id, p.full_name ?? "Unbenannt"]));
  const schonEingezogen = new Set((eingezogenRes.data ?? []).map((i) => i.event_ticket_id));
  const imLauf = new Set(
    (imLaufRes.data ?? []).flatMap((i) => [i.subscription_id, i.event_ticket_id].filter(Boolean))
  );

  const einzuege = einzuegeJeAbo(frühereRes.data);

  const offeneAbos: OffenePosition[] = [];
  const ausgelassen: AusgelassenesAbo[] = [];
  const ohneMandat: OhneMandatAbo[] = [];

  for (const s of abosRes.data ?? []) {
    if (imLauf.has(s.id)) continue;

    const kundenname = nameJeKunde.get(s.customer_id) ?? "Unbenannt";
    const bezeichnung = s.name ?? "Abo";
    const grund = auslassGrund(s, dueDate, einzuege.get(s.id), ferien, zyklus);

    // PROJ-103 hat alle ohne gültiges Mandat übergangen: Ein echter Barzahler
    // stünde bei jedem Lauf da und gäbe nichts zu beurteilen. Für ein
    // **widerrufenes** Mandat war das falsch — da ist ein Beitrag offen, und
    // zwar einmalig (PROJ-105).
    if (!mitMandat.has(s.customer_id)) {
      if (beitragOffenOhneMandat(false, hatteMandat.has(s.customer_id), grund)) {
        const tage = (einzuege.get(s.id) ?? []).map((e) => e.faellig).sort();
        ohneMandat.push({
          aboId: s.id,
          kundeId: s.customer_id,
          kundenname,
          bezeichnung,
          preis: s.price === null ? null : Number(s.price),
          text: ohneMandatText(tage[tage.length - 1] ?? null, s.pending_effective_date),
          schonAufListe: aufBarzahlungsliste.has(s.id),
        });
      }
      continue;
    }

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
    ohneMandat: ohneMandat.sort(nachNamen),
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
    .select("id, due_date, released_at, released_by, cycle_id")
    .eq("id", id)
    .single();
  if (!run) {
    notFound();
  }

  const { data: rawItems } = await supabase
    .from("sepa_collection_items")
    .select(
      "id, customer_id, amount, bounced_at, subscription_id, mandate_reference, subscriptions(name), tickets(events(name)), profiles(full_name)"
    )
    .eq("run_id", id)
    .order("created_at", { ascending: true });

  // PROJ-105: Welche Positionen zeigen auf ein widerrufenes Mandat? Die Sperre
  // beim Herunterladen nennt die Namen — hier steht sie an der Zeile, damit
  // der Betreiber weiß, welche er entfernen muss.
  const widerrufeneRef = new Set<string>();
  if ((rawItems ?? []).length > 0) {
    const { data: mandate, error: mandatFehler } = await supabase
      .from("sepa_mandates")
      .select("mandate_reference, revoked_at")
      .in("mandate_reference", [...new Set((rawItems ?? []).map((i) => i.mandate_reference))]);
    if (mandatFehler) {
      console.error("PROJ-105: Mandatsstand nicht lesbar", mandatFehler);
      throw new Error("Der Stand der SEPA-Mandate konnte nicht geprüft werden");
    }
    for (const m of mandate ?? []) {
      if (m.revoked_at !== null) widerrufeneRef.add(m.mandate_reference);
    }
  }

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
    mandatWiderrufen: widerrufeneRef.has(item.mandate_reference),
  }));

  const entwurf = run.released_at === null;
  // Nach der Freigabe ist am Lauf nichts mehr zu entscheiden — dann gibt es
  // weder den Dialog noch den Hinweis auf ausgelassene Abos.
  // PROJ-107: Der Zyklus, an dem der Lauf hängt — nicht der zum heutigen Tag.
  // Sonst beurteilte die Seite einen Entwurf nach einem Zeitraum, für den er
  // nie gedacht war.
  const zyklus = entwurf ? await ladeZyklus(supabase, run.cycle_id) : null;
  const { offene, ausgelassen, ohneMandat } = entwurf
    ? await laufLuecken(supabase, id, run.due_date, zyklus)
    : { offene: [], ausgelassen: [], ohneMandat: [] };

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
      {/* PROJ-107: Ein Fälligkeitstag ohne eingetragenen Zyklus fällt auf die
          Vier-Wochen-Rechnung zurück. Das ist erlaubt — still darf es nicht
          sein, sonst beurteilt der Betreiber einen Lauf nach einer Regel, von
          der er nicht weiß, dass sie gilt. */}
      {entwurf && !zyklus && (
        <Alert>
          <AlertDescription>
            Für den {new Date(`${run.due_date}T00:00:00`).toLocaleDateString("de-AT")} ist kein
            Zahlungszyklus eingetragen. Dieser Lauf wurde deshalb nach der alten Regel
            zusammengestellt: vier Wochen Abstand zum letzten Einzug je Abo, Ferientage
            mitgerechnet. Trage den Zyklus ein, wenn dieser Lauf zu einem Zeitraum gehören soll.
          </AlertDescription>
        </Alert>
      )}
      {/* PROJ-105: Vor den ausgelassenen Abos, weil hier Geld entgeht und
          nicht nur eine Regel erklärt wird. */}
      <OhneMandatAbos abos={ohneMandat} />
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
