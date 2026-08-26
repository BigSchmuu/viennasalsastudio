import { createClient } from "@/lib/supabase/server";
import { resolvePeriod, trailing12MonthsPeriod, trendGranularity, buildBuckets } from "@/lib/analytics/period";
import { daysUntilNextBirthday, formatNextBirthdayMonthDay } from "@/lib/birthdays";
import { PeriodFilter } from "@/components/admin/analytics/period-filter";
import { MetricTile } from "@/components/admin/analytics/metric-tile";
import { TrendChart, type TrendPoint } from "@/components/admin/analytics/trend-chart";
import { OccupancyList, type OccupancyRow } from "@/components/admin/analytics/occupancy-list";
import { BirthdayList, type BirthdayRow } from "@/components/admin/analytics/birthday-list";
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

  const [invoicesRes, subscriptionsRes, occupancyRes, coursesRes, activeSubsRes, birthdatesRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("gross_amount, invoice_date")
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
  ]);

  const { count: pausedCount } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("status", "paused");

  const invoices = invoicesRes.data ?? [];
  const cancellations = subscriptionsRes.data ?? [];

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

  const cancellationBuckets: TrendPoint[] = buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    value: cancellations.filter((s) => s.cancelled_at! >= bucket.from && s.cancelled_at! <= bucket.to).length,
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
          title="Kündigungs-Verlauf"
          data={cancellationBuckets}
          color="#ffb000"
          valueLabel="Kündigungen"
        />
      </div>

      <OccupancyList rows={occupancyRows} />

      <BirthdayList rows={birthdayRows} />
    </div>
  );
}
