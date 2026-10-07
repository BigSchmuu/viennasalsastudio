import { createClient } from "@/lib/supabase/server";
import { resolvePeriod, trailing12MonthsPeriod, trendGranularity, buildBuckets } from "@/lib/analytics/period";
import { zaehleJeZeitraum } from "@/lib/analytics/verlauf";
import { daysUntilNextBirthday, formatNextBirthdayMonthDay } from "@/lib/birthdays";
import { PeriodFilter } from "@/components/admin/analytics/period-filter";
import { MetricTile } from "@/components/admin/analytics/metric-tile";
import { TrendChart, type TrendPoint } from "@/components/admin/analytics/trend-chart";
import { OccupancyList, type OccupancyRow } from "@/components/admin/analytics/occupancy-list";
import { BirthdayList, type BirthdayRow } from "@/components/admin/analytics/birthday-list";
import { HeutigeKurseListe } from "@/components/admin/analytics/heutige-kurse-liste";
import { ladeHeutigeKurse, type HeutigerKursEintrag } from "@/lib/dashboard/heutige-kurse-laden";
import { heuteInWien, heuteAlsDatumInWien } from "@/lib/constants/zeitzone";

const BIRTHDAY_WINDOW_DAYS = 7;

const EUR = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { period, isCustom } = resolvePeriod(params);
  const trendWindow = isCustom ? period : trailing12MonthsPeriod();
  const granularity = trendGranularity(trendWindow);
  const buckets = buildBuckets(trendWindow, granularity);

  const supabase = await createClient();

  const [invoicesRes, subscriptionsRes, occupancyRes, coursesRes, activeSubsRes, birthdatesRes, anmeldungenRes] =
    await Promise.all([
    supabase
      .from("invoices")
      .select("gross_amount, invoice_date, cancels_invoice_id")
      .is("bounced_at", null)
      .gte("invoice_date", trendWindow.from)
      .lte("invoice_date", trendWindow.to),
    supabase
      .from("subscriptions")
      .select("cancelled_at, status")
      .not("cancelled_at", "is", null)
      .gte("cancelled_at", trendWindow.from)
      .lte("cancelled_at", trendWindow.to),
    supabase.rpc("get_course_occupancy"),
    supabase.from("courses").select("id, name, max_participants").not("max_participants", "is", null),
    // PROJ-32: fetched live (no cache) so a subscription that just turned
    // active/paused today via the cron job is always reflected immediately.
    supabase.from("subscriptions").select("customer_id").eq("status", "active"),
    supabase.from("profiles").select("id, full_name, birthdate").eq("role", "customer").not("birthdate", "is", null),
    // PROJ-76: der Gegenspieler zur Kündigung — jedes Abo am Tag seines
    // Abschlusses. `created_at` ist ein Zeitstempel, nicht ein Datum; die
    // Zuordnung zum Monat macht deshalb zaehleJeZeitraum().
    supabase
      .from("subscriptions")
      .select("created_at")
      .gte("created_at", `${trendWindow.from}T00:00:00Z`)
      .lte("created_at", `${trendWindow.to}T23:59:59Z`),
  ]);

  // PROJ-75: Die Arbeit des Tages. Scheitert das Laden, bleibt das Dashboard
  // trotzdem benutzbar — aber der Abschnitt behauptet dann nicht „kein Kurs
  // heute", sondern bleibt weg und der Fehler steht im Log.
  let heutigeEintraege: HeutigerKursEintrag[] | null = null;
  try {
    heutigeEintraege = await ladeHeutigeKurse(supabase);
  } catch (fehler) {
    console.error("Dashboard: heutige Kurse", fehler);
  }

  const { count: pausedCount } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("status", "paused");

  const cancellations = subscriptionsRes.data ?? [];

  // PROJ-46: Stornos und Gutschriften stehen als eigene Zeilen mit negativem
  // Betrag und mindern den Umsatz dadurch von selbst — richtig so. Nur bei
  // einer zurückgebuchten Rechnung nicht: die war nie im Umsatz enthalten, und
  // ihr Storno würde ihn ein zweites Mal senken. Dieselbe Regel wie im
  // Buchhaltungs-Export.
  const roheRechnungen = invoicesRes.data ?? [];
  const aufhebungsBezuege = [
    ...new Set(roheRechnungen.map((i) => i.cancels_invoice_id).filter(Boolean)),
  ] as string[];
  const zurueckgebuchteBezuege = new Set<string>();
  if (aufhebungsBezuege.length > 0) {
    const { data: bezuege } = await supabase
      .from("invoices")
      .select("id")
      .in("id", aufhebungsBezuege)
      .not("bounced_at", "is", null);
    for (const b of bezuege ?? []) zurueckgebuchteBezuege.add(b.id);
  }
  const invoices = roheRechnungen.filter(
    (i) => !i.cancels_invoice_id || !zurueckgebuchteBezuege.has(i.cancels_invoice_id)
  );

  const revenueTotal = invoices
    .filter((i) => i.invoice_date >= period.from && i.invoice_date <= period.to)
    .reduce((sum, i) => sum + i.gross_amount, 0);

  const cancelledCount = cancellations.filter(
    (s) => s.cancelled_at! >= period.from && s.cancelled_at! <= period.to
  ).length;

  const revenueBuckets: TrendPoint[] = buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    value: invoices
      .filter((i) => i.invoice_date >= bucket.from && i.invoice_date <= bucket.to)
      .reduce((sum, i) => sum + i.gross_amount, 0),
  }));

  // PROJ-76: Anmeldungen und Kündigungen in einem Graphen — die erste Reihe ist
  // der Zugang, die zweite der Abgang. Gezählt wird über denselben Weg, damit
  // nicht zwei Zeilen zwei Wahrheiten über eine Monatsgrenze ergeben.
  const anmeldungenJeZeitraum = zaehleJeZeitraum(
    buckets,
    (anmeldungenRes.data ?? []).map((s) => s.created_at)
  );
  const kuendigungenJeZeitraum = zaehleJeZeitraum(
    buckets,
    cancellations.map((s) => s.cancelled_at)
  );
  const verlaufBuckets: TrendPoint[] = buckets.map((bucket, i) => ({
    key: bucket.key,
    label: bucket.label,
    value: anmeldungenJeZeitraum[i],
    secondValue: kuendigungenJeZeitraum[i],
  }));

  const occupancyByCourseId = new Map((occupancyRes.data ?? []).map((o) => [o.course_id, o.occupied_count]));
  const occupancyRows: OccupancyRow[] = (coursesRes.data ?? [])
    .map((course) => ({
      courseId: course.id,
      courseName: course.name,
      occupied: occupancyByCourseId.get(course.id) ?? 0,
      capacity: course.max_participants!,
    }))
    .sort((a, b) => b.occupied / b.capacity - a.occupied / a.capacity);

  const totalOccupied = occupancyRows.reduce((sum, r) => sum + r.occupied, 0);
  const totalCapacity = occupancyRows.reduce((sum, r) => sum + r.capacity, 0);
  const totalOccupancyPercent = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

  // A customer with multiple active subscriptions still counts once.
  const activeCustomerCount = new Set((activeSubsRes.data ?? []).map((s) => s.customer_id)).size;

  // Der Wiener Kalendertag, nicht der des Servers (UTC bei Vercel).
  const today = heuteAlsDatumInWien();
  const birthdayRows: BirthdayRow[] = (birthdatesRes.data ?? [])
    .map((p) => ({
      customerId: p.id,
      name: p.full_name || "Unbenannter Kunde",
      daysUntil: daysUntilNextBirthday(p.birthdate!, today),
      monthDay: formatNextBirthdayMonthDay(p.birthdate!, today),
    }))
    .filter((r) => r.daysUntil <= BIRTHDAY_WINDOW_DAYS)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Geschäftsüberblick über Umsatz, Auslastung und Kündigungen</p>
      </div>

      {/* PROJ-75: Vor den Kennzahlen. Umsatz und Trends schaut der Betreiber
          seltener an als die Kurse, die heute laufen. */}
      {heutigeEintraege !== null && <HeutigeKurseListe eintraege={heutigeEintraege} />}

      <PeriodFilter from={period.from} to={period.to} isCustom={isCustom} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Umsatz im Zeitraum" value={EUR.format(revenueTotal)} />
        <MetricTile
          label="Auslastung (aktuell)"
          value={`${totalOccupancyPercent}%`}
          secondaryLabel={`${totalOccupied} / ${totalCapacity} Plätze belegt`}
        />
        <MetricTile
          label="Kündigungen im Zeitraum"
          value={String(cancelledCount)}
          secondaryLabel={`${pausedCount ?? 0} aktuell pausiert`}
        />
        <MetricTile label="Aktive Kunden" value={String(activeCustomerCount)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TrendChart
          title="Umsatz-Verlauf"
          data={revenueBuckets}
          color="hsl(4 100% 59%)"
          valueLabel="Umsatz"
          valueFormat="currency"
        />
        <TrendChart
          title="Anmeldungen & Kündigungen"
          data={verlaufBuckets}
          /* Die Farben sind geprüft, nicht gewählt: Das Teal der Kursstufen und
             ein dunkleres Mango bestehen die Prüfung auf Farbfehlsichtigkeit
             (ΔE 13 bei Protanopie) und auf Kontrast zur Kartenfläche. Das
             bisherige #ffb000 lag bei 1,78:1 — zu blass, um einen Balken
             verlässlich zu erkennen. */
          color="#2a9d8f"
          valueLabel="Anmeldungen"
          secondSeries={{ label: "Kündigungen", color: "#c47f00" }}
        />
      </div>

      <OccupancyList rows={occupancyRows} />

      <BirthdayList rows={birthdayRows} />
    </div>
  );
}
