/** Splits a frozen gross amount into net + VAT using the invoice's own (frozen) VAT rate. */
export function computeInvoiceAmounts(grossAmount: number, vatRatePercent: number) {
  const netAmount = grossAmount / (1 + vatRatePercent / 100);
  const vatAmount = grossAmount - netAmount;
  return {
    netAmount: Math.round(netAmount * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    grossAmount,
  };
}

/** Escapes a single CSV field per RFC 4180, and neutralizes leading formula-trigger
 * characters (=, +, -, @, tab, CR) that spreadsheet apps would otherwise evaluate —
 * user-controlled values like a customer's profile name flow into this export. */
export function toCsvField(value: string | number): string {
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsvRow(fields: (string | number)[]): string {
  return fields.map(toCsvField).join(",");
}

/* ------------------------------------------------------------------------ *
 * PROJ-36: Monatsauswahl für den Rechnungs-Export
 *
 * Dates are assembled from local calendar parts, never via toISOString() —
 * that converts to UTC and shifts the day for anyone east of Greenwich, which
 * would silently pick the wrong month boundary (see PROJ-8 QA notes).
 * ------------------------------------------------------------------------ */

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/** Sentinel for "no month picked — the free Von/Bis fields apply". */
export const CUSTOM_RANGE = "custom";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "2026-08" → { from: "2026-08-01", to: "2026-08-31" }. Handles leap years. */
export function monthRange(month: string): { from: string; to: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) return null;
  // Day 0 of the following month is the last day of this one.
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return { from: `${year}-${pad(monthNumber)}-01`, to: `${year}-${pad(monthNumber)}-${pad(lastDay)}` };
}

/**
 * Inverse of monthRange: recognises a from/to pair that spans exactly one whole
 * month. Anything else counts as a custom range, so hand-edited dates don't get
 * mislabelled as a month in the picker.
 */
export function monthFromRange(from: string, to: string): string | null {
  const match = /^(\d{4})-(\d{2})-01$/.exec(from);
  if (!match) return null;
  const candidate = `${match[1]}-${match[2]}`;
  const range = monthRange(candidate);
  return range && range.to === to ? candidate : null;
}

/** "2026-08" → "August 2026"; falls back to the raw value if unparseable. */
export function monthLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  const index = Number(match[2]) - 1;
  return MONTH_NAMES[index] ? `${MONTH_NAMES[index]} ${match[1]}` : month;
}

/**
 * The current month plus the previous ones, newest first — the operator exports
 * a just-finished month far more often than an arbitrary range.
 */
export function recentMonths(count: number, today: Date = new Date()): { value: string; label: string }[] {
  const months: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    months.push({ value, label: monthLabel(value) });
  }
  return months;
}
