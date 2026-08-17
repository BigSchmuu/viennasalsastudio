import { formatDateLocal } from "@/lib/scheduling/dates";

export type Period = { from: string; to: string };
export type Bucket = { key: string; label: string; from: string; to: string };

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

export function currentMonthPeriod(referenceDate = new Date()): Period {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
  return { from: formatDateLocal(start), to: formatDateLocal(end) };
}

export function trailing12MonthsPeriod(referenceDate = new Date()): Period {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 11, 1);
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
  return { from: formatDateLocal(start), to: formatDateLocal(end) };
}

/** Resolves the metric-tile period from URL search params, defaulting to the current month. */
export function resolvePeriod(params: { from?: string; to?: string }): { period: Period; isCustom: boolean } {
  if (
    params.from &&
    params.to &&
    isValidDateString(params.from) &&
    isValidDateString(params.to) &&
    params.from <= params.to
  ) {
    return { period: { from: params.from, to: params.to }, isCustom: true };
  }
  return { period: currentMonthPeriod(), isCustom: false };
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/** Month buckets once a range spans 2+ months, otherwise day buckets — a
 *  2-week custom range grouped by month would collapse to one data point;
 *  a multi-year range grouped by day would be unreadable. */
export function trendGranularity(period: Period): "day" | "month" {
  return daysBetween(period.from, period.to) >= 60 ? "month" : "day";
}

export function buildBuckets(period: Period, granularity: "day" | "month"): Bucket[] {
  return granularity === "month" ? buildMonthBuckets(period) : buildDayBuckets(period);
}

function buildMonthBuckets(period: Period): Bucket[] {
  const buckets: Bucket[] = [];
  const periodStart = `${period.from}T00:00:00`;
  const periodEnd = `${period.to}T00:00:00`;
  let cursor = new Date(periodStart);
  cursor = new Date(cursor.getFullYear(), cursor.getMonth(), 1);

  while (cursor.getTime() <= new Date(periodEnd).getTime()) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const from = formatDateLocal(monthStart) < period.from ? period.from : formatDateLocal(monthStart);
    const to = formatDateLocal(monthEnd) > period.to ? period.to : formatDateLocal(monthEnd);

    buckets.push({
      key: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`,
      label: monthStart.toLocaleDateString("de-AT", { month: "short", year: "2-digit" }),
      from,
      to,
    });

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return buckets;
}

function buildDayBuckets(period: Period): Bucket[] {
  const buckets: Bucket[] = [];
  let cursor = new Date(`${period.from}T00:00:00`);
  const end = new Date(`${period.to}T00:00:00`);

  while (cursor.getTime() <= end.getTime()) {
    const dateString = formatDateLocal(cursor);
    buckets.push({
      key: dateString,
      label: cursor.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit" }),
      from: dateString,
      to: dateString,
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }
  return buckets;
}
