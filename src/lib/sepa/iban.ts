const SEPA_COUNTRY_CODES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IS", "IE", "IT", "LV", "LI", "LT", "LU", "MT", "MC", "NL", "NO",
  "PL", "PT", "RO", "SM", "SK", "SI", "ES", "SE", "CH", "GB", "VA", "AD",
]);

export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/**
 * ISO 7064 MOD 97-10 checksum, computed digit-by-digit since the numeric
 * form of an IBAN exceeds safe integer range.
 */
function isValidChecksum(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (char) => String(char.charCodeAt(0) - 55));

  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

export function validateIban(raw: string): { valid: true } | { valid: false; error: string } {
  const iban = normalizeIban(raw);

  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) {
    return { valid: false, error: "IBAN hat ein ungültiges Format" };
  }
  if (!SEPA_COUNTRY_CODES.has(iban.slice(0, 2))) {
    return { valid: false, error: "IBAN muss aus einem SEPA-Land stammen" };
  }
  if (!isValidChecksum(iban)) {
    return { valid: false, error: "IBAN-Prüfziffer ist ungültig" };
  }
  return { valid: true };
}

export function maskIban(iban: string): string {
  const normalized = normalizeIban(iban);
  if (normalized.length <= 8) return normalized;
  return `${normalized.slice(0, 4)} •••• •••• ${normalized.slice(-4)}`;
}
