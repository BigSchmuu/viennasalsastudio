import { createClient } from "@/lib/supabase/server";
import { resolvePeriod } from "@/lib/analytics/period";
import { heuteInWien } from "@/lib/constants/zeitzone";
import { ladeFerien } from "@/lib/scheduling/ferien";
import { barzahlerZeilen, type Barzahler } from "@/lib/barzahlungen/offen";
import { PeriodFilter } from "@/components/admin/analytics/period-filter";
import {
  BarzahlungsUebersicht,
  type EingesammeltZeile,
} from "@/components/admin/barzahlungen/barzahlungs-uebersicht";

/**
 * Barzahlungen in der Verwaltung (PROJ-81).
 *
 * Zwei Fragen, zwei Listen: Wer ist noch offen — über alle Kurse, ohne
 * Zeitraumgrenze, denn eine offene Zahlung ist nicht von einem Monat abhängig.
 * Und was wurde im Zeitraum eingesammelt, von wem.
 *
 * Hier wird direkt gelesen und nicht über die Funktion der Lehreransicht: Die
 * Verwaltung darf Abos und Mandate sehen, und die Frage ist eine andere — nicht
 * „wer sitzt in diesem Kurs", sondern „wer ist überhaupt offen".
 */
export default async function BarzahlungenPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { period, isCustom } = resolvePeriod(params);
  const supabase = await createClient();

  const [aboRes, mandatRes, zahlungRes, einzugRes, eingesammeltRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, customer_id, name, price, course_id, courses(name), profiles(full_name)")
      .eq("status", "active"),
    supabase.from("sepa_mandates").select("customer_id").is("revoked_at", null),
    supabase.from("cash_payments").select("subscription_id, paid_on"),
    supabase
      .from("sepa_collection_items")
      .select("subscription_id, sepa_collection_runs(due_date)")
      .not("subscription_id", "is", null),
    // Ohne eingebettete Beziehung: Die Typdatei wird hier von Hand gepflegt
    // (wie bei PROJ-62), und eine Beziehung, die sie nicht kennt, wäre nur ein
    // Kampf mit dem Typprüfer. Die Namen kommen gleich darunter in einem Zug.
    supabase
      .from("cash_payments")
      .select("id, paid_on, amount, customer_id, collected_by")
      .gte("paid_on", period.from)
      .lte("paid_on", period.to)
      .order("paid_on", { ascending: false }),
  ]);

  // Ein Lesefehler darf nicht als „niemand offen" durchgehen — dieselbe Lehre
  // wie bei „Nicht zugestellt" (PROJ-16).
  const fehler = aboRes.error ?? mandatRes.error ?? zahlungRes.error ?? einzugRes.error ?? eingesammeltRes.error;
  if (fehler) {
    console.error("Barzahlungen nicht lesbar", fehler);
    throw new Error("Die Barzahlungen konnten nicht geladen werden");
  }

  const mitMandat = new Set((mandatRes.data ?? []).map((m) => m.customer_id));

  const barzahlungenJeAbo = new Map<string, string[]>();
  for (const z of zahlungRes.data ?? []) {
    const liste = barzahlungenJeAbo.get(z.subscription_id) ?? [];
    liste.push(z.paid_on);
    barzahlungenJeAbo.set(z.subscription_id, liste);
  }

  const einzuegeJeAbo = new Map<string, string[]>();
  for (const e of einzugRes.data ?? []) {
    const faellig = e.sepa_collection_runs?.due_date;
    if (!e.subscription_id || !faellig) continue;
    const liste = einzuegeJeAbo.get(e.subscription_id) ?? [];
    liste.push(faellig);
    einzuegeJeAbo.set(e.subscription_id, liste);
  }

  const zahler: Barzahler[] = (aboRes.data ?? [])
    .filter((s) => !mitMandat.has(s.customer_id))
    .map((s) => ({
      kundeId: s.customer_id,
      kundeName: s.profiles?.full_name || "Unbenannter Kunde",
      aboId: s.id,
      aboName: s.courses?.name ?? s.name ?? "Flatrate",
      betrag: s.price,
      istFlatrate: s.course_id === null,
      einzuege: einzuegeJeAbo.get(s.id) ?? [],
      barzahlungen: barzahlungenJeAbo.get(s.id) ?? [],
    }));

  const ferien = await ladeFerien(supabase);
  const zeilen = barzahlerZeilen(zahler, heuteInWien(), ferien);

  // Namen für Kunden *und* Lehrkräfte in einem Zug: Ein gekündigtes Abo steht
  // nicht mehr oben in der Liste, die Zahlung von damals aber schon.
  const namensIds = Array.from(
    new Set(
      (eingesammeltRes.data ?? []).flatMap((z) =>
        [z.customer_id, z.collected_by].filter((id): id is string => !!id)
      )
    )
  );
  const namen = new Map<string, string>();
  if (namensIds.length > 0) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", namensIds);
    for (const p of profile ?? []) namen.set(p.id, p.full_name || "Unbenannter Kunde");
  }

  const eingesammelt: EingesammeltZeile[] = (eingesammeltRes.data ?? []).map((z) => ({
    id: z.id,
    kundeId: z.customer_id,
    kundeName: namen.get(z.customer_id) ?? "Unbenannter Kunde",
    tag: z.paid_on,
    betrag: z.amount,
    // Wer eingesammelt hat. Fehlt der Name, ist das Konto gelöscht — die
    // Zahlung bleibt trotzdem stehen, sie ist passiert.
    kassiertVon: z.collected_by ? (namen.get(z.collected_by) ?? "Gelöschtes Konto") : "—",
  }));

  const spanne = (wert: string) => new Date(`${wert}T00:00:00`).toLocaleDateString("de-AT");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold">Barzahlungen</h2>
        <p className="text-sm text-muted-foreground">
          Teilnehmer ohne SEPA-Mandat — wer noch offen ist und was eingesammelt wurde
        </p>
      </div>

      {/* Der Zeitraum wirkt nur auf das Eingesammelte. Eine offene Zahlung ist
          offen, unabhängig davon, welcher Monat oben steht. */}
      <PeriodFilter from={period.from} to={period.to} isCustom={isCustom} />

      <BarzahlungsUebersicht
        zeilen={zeilen}
        eingesammelt={eingesammelt}
        zeitraumText={`Im Zeitraum ${spanne(period.from)} bis ${spanne(period.to)} eingesammelt.`}
      />
    </div>
  );
}
