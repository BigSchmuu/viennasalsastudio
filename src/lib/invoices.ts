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

/**
 * Column separator. Semicolon, not comma: Austrian/German Excel expects it, and
 * the amounts in this file use a decimal comma — with a comma separator every
 * amount would need quoting and a mis-detected file collapses into one text
 * column, which is exactly what makes an export useless to an accountant.
 */
export const CSV_SEPARATOR = ";";

/**
 * Byte order mark. Without it Excel on Windows reads the file as Latin-1 and
 * turns "Müller" into "MÃ¼ller" — the single most common complaint about CSV
 * exports from web apps.
 */
export const CSV_BOM = "\uFEFF";

/** Escapes a single CSV field per RFC 4180, and neutralizes leading formula-trigger
 * characters (=, +, -, @, tab, CR) that spreadsheet apps would otherwise evaluate —
 * user-controlled values like a customer's profile name flow into this export. */
export function toCsvField(value: string | number, separator: string = CSV_SEPARATOR): string {
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  const needsQuoting = str.includes('"') || str.includes("\n") || str.includes(separator);
  return needsQuoting ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsvRow(fields: (string | number)[], separator: string = CSV_SEPARATOR): string {
  return fields.map((f) => toCsvField(f, separator)).join(separator);
}

/** 1234.5 → "1234,50". No thousands separator: it would collide with the column
 * separator rules and Excel parses the plain form reliably. */
export function formatAmountDe(amount: number): string {
  return amount.toFixed(2).replace(".", ",");
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

/* ------------------------------------------------------------------------ *
 * PROJ-36: Summen für den Buchhaltungs-Export
 * ------------------------------------------------------------------------ */

export type SummarizableInvoice = { grossAmount: number; vatRatePercent: number; bounced: boolean };
export type AmountTriple = { net: number; vat: number; gross: number };

export type InvoiceSummary = {
  /** One entry per VAT rate that actually occurs, lowest rate first. */
  byVatRate: (AmountTriple & { vatRatePercent: number })[];
  /** Money that actually came in — bounced direct debits excluded. */
  total: AmountTriple;
  /** Money that was charged but returned. Deliberately NOT part of `total`. */
  bounced: AmountTriple;
};

function addTriple(a: AmountTriple, b: AmountTriple): AmountTriple {
  return { net: a.net + b.net, vat: a.vat + b.vat, gross: a.gross + b.gross };
}

const ZERO: AmountTriple = { net: 0, vat: 0, gross: 0 };

/**
 * Builds the totals shown at the bottom of the export.
 *
 * Two rules that look like details but decide whether the numbers are usable:
 *
 * 1. Bounced direct debits are money that never arrived. They are reported on
 *    their own line and kept out of the total — otherwise the figure would
 *    claim income the studio never received.
 * 2. Grouping uses the VAT rate stored on each invoice, not today's configured
 *    rate. Changing the rate later must not rewrite the past.
 *
 * Sums are built from the already-rounded per-invoice amounts so an accountant
 * adding up the column by hand arrives at the same number. That can differ by a
 * cent from the mathematically exact sum — a deliberate trade in favour of
 * "the column adds up".
 */
export function summarizeInvoices(invoices: SummarizableInvoice[]): InvoiceSummary {
  const byRate = new Map<number, AmountTriple>();
  let total = ZERO;
  let bounced = ZERO;

  for (const invoice of invoices) {
    const { netAmount, vatAmount } = computeInvoiceAmounts(invoice.grossAmount, invoice.vatRatePercent);
    const triple: AmountTriple = { net: netAmount, vat: vatAmount, gross: invoice.grossAmount };

    if (invoice.bounced) {
      bounced = addTriple(bounced, triple);
      continue;
    }

    total = addTriple(total, triple);
    byRate.set(invoice.vatRatePercent, addTriple(byRate.get(invoice.vatRatePercent) ?? ZERO, triple));
  }

  const rounded = (t: AmountTriple): AmountTriple => ({
    net: Math.round(t.net * 100) / 100,
    vat: Math.round(t.vat * 100) / 100,
    gross: Math.round(t.gross * 100) / 100,
  });

  return {
    byVatRate: [...byRate.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([vatRatePercent, triple]) => ({ vatRatePercent, ...rounded(triple) })),
    total: rounded(total),
    bounced: rounded(bounced),
  };
}

/**
 * Names the file after the period it covers, so several exports in a download
 * folder stay distinguishable — "rechnungsjournal.csv (3)" tells nobody which
 * month it holds.
 */
export function exportFileName(from: string, to: string): string {
  const year = yearFromRange(from, to);
  if (year) return `rechnungsjournal-${year}.csv`;
  const month = monthFromRange(from, to);
  if (month) return `rechnungsjournal-${month}.csv`;
  if (from && to) return `rechnungsjournal-${from}_bis_${to}.csv`;
  if (from) return `rechnungsjournal-ab-${from}.csv`;
  if (to) return `rechnungsjournal-bis-${to}.csv`;
  return "rechnungsjournal-gesamt.csv";
}

/* ------------------------------------------------------------------------ *
 * PROJ-36: Ganze Jahre als Auswahl
 * ------------------------------------------------------------------------ */

/** "2026" → { from: "2026-01-01", to: "2026-12-31" }. */
export function yearRange(year: string): { from: string; to: string } | null {
  if (!/^\d{4}$/.test(year)) return null;
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/** Inverse of yearRange. Checked before the month case: a January-to-December
 * span is a year, never a single month, so the two can't be confused. */
export function yearFromRange(from: string, to: string): string | null {
  const match = /^(\d{4})-01-01$/.exec(from);
  if (!match) return null;
  return to === `${match[1]}-12-31` ? match[1] : null;
}

/** The current year and the ones before it, newest first. */
export function recentYears(count: number, today: Date = new Date()): { value: string; label: string }[] {
  const years: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const value = String(today.getFullYear() - i);
    years.push({ value, label: `Jahr ${value}` });
  }
  return years;
}

export type RangeSelection = { kind: "year" | "month" | "custom"; value: string; label: string };

/**
 * Turns a from/to pair into the entry the picker should show.
 *
 * Returns the label as well, because a recognised period may fall outside the
 * offered lists — a month older than the two years on offer, for instance. The
 * picker then has to add that entry itself; otherwise it renders blank and
 * looks broken while the dates below it are perfectly valid (PROJ-36 BUG-1).
 */
export function selectionFromRange(from: string, to: string): RangeSelection {
  const year = yearFromRange(from, to);
  if (year) return { kind: "year", value: year, label: `Jahr ${year}` };

  const month = monthFromRange(from, to);
  if (month) return { kind: "month", value: month, label: monthLabel(month) };

  return { kind: "custom", value: CUSTOM_RANGE, label: "Eigener Zeitraum" };
}

/** Resolves a picker value back into a date range. */
export function rangeFromSelection(value: string): { from: string; to: string } | null {
  if (value === CUSTOM_RANGE) return { from: "", to: "" };
  return yearRange(value) ?? monthRange(value);
}
