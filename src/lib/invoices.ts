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

/** Escapes a single CSV field per RFC 4180 (quotes fields containing commas, quotes, or newlines). */
export function toCsvField(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsvRow(fields: (string | number)[]): string {
  return fields.map(toCsvField).join(",");
}
