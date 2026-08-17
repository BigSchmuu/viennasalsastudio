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
