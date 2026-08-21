import { createClient } from "@/lib/supabase/server";
import { resolvePeriod } from "@/lib/analytics/period";
import { daysUntil } from "@/lib/scheduling/dates";
import { PeriodFilter } from "@/components/admin/analytics/period-filter";
import { MetricTile } from "@/components/admin/analytics/metric-tile";
import {
  TrialFollowupList,
  type TrialFollowupRow,
  type TrialFollowupStatus,
} from "@/components/admin/trials/trial-followup-list";

const OVERDUE_AFTER_DAYS = 14;

export default async function ProbestundenPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string }>;
}) {
  const params = await searchParams;
  const { period } = resolvePeriod(params);
  const supabase = await createClient();

  const [bookingsRes, followupsRes] = await Promise.all([
    supabase
      .from("course_bookings")
      .select("id, customer_id, course_id, chosen_date, profiles(full_name), courses(name)")
      .eq("type", "trial")
      .eq("status", "confirmed")
      .order("chosen_date", { ascending: false }),
    supabase.from("trial_followups").select("booking_id, contacted, note"),
  ]);

  const bookings = bookingsRes.data ?? [];
  const followupByBooking = new Map((followupsRes.data ?? []).map((f) => [f.booking_id, f]));

  const customerIds = Array.from(new Set(bookings.map((b) => b.customer_id)));

  const [regularBookingsRes, subscriptionsRes] = customerIds.length
    ? await Promise.all([
        supabase
          .from("course_bookings")
          .select("customer_id, chosen_date")
          .eq("type", "regular")
          .eq("status", "confirmed")
          .in("customer_id", customerIds),
        supabase.from("subscriptions").select("customer_id, created_at").in("customer_id", customerIds),
      ])
    : [{ data: [] }, { data: [] }];

  // Conversion = any regular booking or subscription for the same customer on/after
  // the trial's own date — computed here, not stored, same pattern as the automated
  // reminders' hasConvertedSince() in src/lib/notifications/dispatch.ts.
  const regularDatesByCustomer = new Map<string, string[]>();
  for (const b of regularBookingsRes.data ?? []) {
    const list = regularDatesByCustomer.get(b.customer_id) ?? [];
    list.push(b.chosen_date);
    regularDatesByCustomer.set(b.customer_id, list);
  }
  const subDatesByCustomer = new Map<string, string[]>();
  for (const s of subscriptionsRes.data ?? []) {
    const list = subDatesByCustomer.get(s.customer_id) ?? [];
    list.push(s.created_at.slice(0, 10));
    subDatesByCustomer.set(s.customer_id, list);
  }
  function isConverted(customerId: string, sinceDate: string): boolean {
    const regular = regularDatesByCustomer.get(customerId) ?? [];
    const subs = subDatesByCustomer.get(customerId) ?? [];
    return regular.some((d) => d >= sinceDate) || subs.some((d) => d >= sinceDate);
  }

  let rows: TrialFollowupRow[] = bookings.map((b) => {
    const converted = isConverted(b.customer_id, b.chosen_date);
    const followup = followupByBooking.get(b.id);
    const contacted = followup?.contacted ?? false;
    const daysSince = -daysUntil(b.chosen_date);
    const status: TrialFollowupStatus = converted ? "konvertiert" : contacted ? "kontaktiert" : "offen";

    return {
      bookingId: b.id,
      customerId: b.customer_id,
      customerName: b.profiles?.full_name || "Unbenannter Kunde",
      courseName: b.courses?.name ?? "—",
      chosenDate: b.chosen_date,
      status,
      overdue: status === "offen" && daysSince > OVERDUE_AFTER_DAYS,
      note: followup?.note ?? "",
    };
  });

  // Conversion-rate tile: scoped to trials within the selected period.
  // The table below intentionally stays unscoped by period (shows every trial
  // needing follow-up regardless of when it happened), analogous to how the
  // occupancy list on the main dashboard (PROJ-17) also ignores the period filter.
  const rowsInPeriod = rows.filter((r) => r.chosenDate >= period.from && r.chosenDate <= period.to);
  const conversionRate =
    rowsInPeriod.length > 0
      ? Math.round((rowsInPeriod.filter((r) => r.status === "konvertiert").length / rowsInPeriod.length) * 100)
      : 0;

  const isValidStatus = params.status === "offen" || params.status === "kontaktiert" || params.status === "konvertiert";
  if (isValidStatus) {
    rows = rows.filter((r) => r.status === params.status);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold">Probestunden</h2>
        <p className="text-sm text-muted-foreground">Follow-up-Nachverfolgung und Conversion-Rate</p>
      </div>

      <PeriodFilter from={period.from} to={period.to} isCustom={params.from !== undefined && params.to !== undefined} />

      <MetricTile
        label="Conversion-Rate im Zeitraum"
        value={`${conversionRate}%`}
        secondaryLabel={`${rowsInPeriod.filter((r) => r.status === "konvertiert").length} / ${rowsInPeriod.length} Probestunden konvertiert`}
      />

      <TrialFollowupList rows={rows} initialStatus={isValidStatus ? params.status! : ""} />
    </div>
  );
}
