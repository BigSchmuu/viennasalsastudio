/** SEPA mandate references must be unique and at most 35 characters (alphanumeric). */
export function generateMandateReference(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `VSS-${timestamp}-${random}`;
}
