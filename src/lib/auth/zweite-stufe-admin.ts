import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Hat dieses Konto eine bestätigte Authenticator-App? (PROJ-58)
 *
 * Für das *eigene* Konto darf die Sitzung im Browser das selbst erfragen. Für
 * ein fremdes Konto geht das nicht — dafür braucht es den privilegierten
 * Serverzugang. Deshalb liegt diese Auskunft hier und nicht im Browser.
 *
 * Aufrufer sind ausschließlich Verwaltungsseiten hinter `requireAdmin()`.
 */
export async function zweiteStufeEingerichtet(kontoId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: kontoId });

  if (error) {
    console.error("Zweite Stufe konnte nicht nachgeschlagen werden", error);
    return false;
  }

  return (data?.factors ?? []).some((faktor) => faktor.status === "verified");
}
