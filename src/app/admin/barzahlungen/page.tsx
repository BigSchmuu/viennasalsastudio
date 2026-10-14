import { createClient } from "@/lib/supabase/server";
import { resolvePeriod } from "@/lib/analytics/period";
import { barzahlerZeilen, type Barzahler } from "@/lib/barzahlungen/offen";
import { PeriodFilter } from "@/components/admin/analytics/period-filter";
import {
  BarzahlungsUebersicht,
  type EingesammeltZeile,
} from "@/components/admin/barzahlungen/barzahlungs-uebersicht";

/**
 * Barzahlungen in der Verwaltung (PROJ-81, Erfassen und Teilbeträge ab PROJ-83).
 *
 * Zwei Fragen, zwei Listen: Wer ist noch offen — über alle Kurse, ohne
 * Zeitraumgrenze, denn eine offene Zahlung ist nicht von einem Monat abhängig.
 * Und was wurde im Zeitraum eingesammelt, von wem.
 *
 * Hier wird direkt gelesen und nicht über die Funktion der Lehreransicht: Die
 * Verwaltung darf Abos und Mandate sehen, und die Frage ist eine andere — nicht
 * „wer sitzt in diesem Kurs", sondern „wer ist überhaupt offen". Der Saldo
 * selbst kommt aus derselben Sicht wie dort (`cash_ledger`); zwei Rechnungen
 * würden driften.
 */
export default async function BarzahlungenPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { period, isCustom } = resolvePeriod(params);
  const supabase = await createClient();

  const [aboRes, mandatRes, saldoRes, zahlungRes, eingesammeltRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, customer_id, name, price, course_id, status, courses(name), profiles(full_name)")
      .eq("status", "active"),
    supabase.from("sepa_mandates").select("customer_id").is("revoked_at", null),
    supabase.from("cash_ledger").select("subscription_id, soll, haben, saldo"),
    supabase.from("cash_payments").select("subscription_id, paid_on"),
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
  const fehler =
    aboRes.error ?? mandatRes.error ?? saldoRes.error ?? zahlungRes.error ?? eingesammeltRes.error;
  if (fehler) {
    console.error("Barzahlungen nicht lesbar", fehler);
    throw new Error("Die Barzahlungen konnten nicht geladen werden");
  }

  const mitMandat = new Set((mandatRes.data ?? []).map((m) => m.customer_id));

  const saldoJeAbo = new Map(
    (saldoRes.data ?? [])
      .filter((s): s is typeof s & { subscription_id: string } => !!s.subscription_id)
      .map((s) => [s.subscription_id, { soll: s.soll ?? 0, haben: s.haben ?? 0, saldo: s.saldo ?? 0 }])
  );

  const letzteZahlungJeAbo = new Map<string, string>();
  for (const z of zahlungRes.data ?? []) {
    const bisher = letzteZahlungJeAbo.get(z.subscription_id);
    if (!bisher || z.paid_on > bisher) letzteZahlungJeAbo.set(z.subscription_id, z.paid_on);
  }

  const aktive = aboRes.data ?? [];

  // PROJ-83: Wer eine Restschuld hat, bleibt sichtbar — auch nach einer
  // Kündigung oder wenn er inzwischen ein Mandat erteilt hat. Eine Schuld, die
  // aus der Liste fällt, ist verlorenes Geld.
  const bekannteAbos = new Set(aktive.map((a) => a.id));
  const schuldner = Array.from(saldoJeAbo.entries())
    .filter(([id, stand]) => stand.saldo > 0.005 && !bekannteAbos.has(id))
    .map(([id]) => id);

  let beendete: typeof aktive = [];
  if (schuldner.length > 0) {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("id, customer_id, name, price, course_id, status, courses(name), profiles(full_name)")
      .in("id", schuldner);
    if (error) {
      console.error("Abos mit Restschuld nicht lesbar", error);
      throw new Error("Die Barzahlungen konnten nicht geladen werden");
    }
    beendete = data ?? [];
  }

  const zahler: Barzahler[] = [...aktive, ...beendete]
    // Ein aktives Abo mit Mandat wird eingezogen und gehört nicht hierher. Eines
    // mit Restschuld steht trotzdem da — es kam über `schuldner` herein.
    .filter((s) => !mitMandat.has(s.customer_id) || (saldoJeAbo.get(s.id)?.saldo ?? 0) > 0.005)
    .map((s) => {
      const stand = saldoJeAbo.get(s.id) ?? { soll: 0, haben: 0, saldo: 0 };
      return {
        kundeId: s.customer_id,
        kundeName: s.profiles?.full_name || "Unbenannter Kunde",
        aboId: s.id,
        aboName: s.courses?.name ?? s.name ?? "Flatrate",
        betrag: s.price,
        istFlatrate: s.course_id === null,
        soll: stand.soll,
        haben: stand.haben,
        letzteZahlung: letzteZahlungJeAbo.get(s.id) ?? null,
        // Kein neues Soll mehr: gekündigt, pausiert oder inzwischen mit Mandat.
        beendet: s.status !== "active" || mitMandat.has(s.customer_id),
      };
    });

  const zeilen = barzahlerZeilen(zahler);

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
