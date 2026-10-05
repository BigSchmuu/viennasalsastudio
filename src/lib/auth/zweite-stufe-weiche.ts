import { getViewerContext } from "@/lib/auth/viewer";
import { zweiteStufeLage } from "@/lib/auth/zweite-stufe-lage";
import { WEG_CODE, WEG_EINRICHTEN, wegMitZiel } from "@/lib/auth/zweite-stufe";

/**
 * Muss dieses Konto vor dem Ziel erst die zweite Stufe hinter sich bringen?
 * (PROJ-73)
 *
 * Gibt den Umweg samt gemerktem Ziel zurück — oder `null`, wenn es direkt
 * weitergehen kann. Damit bleibt beim Aufrufer die Entscheidung, ob er den
 * Umweg (einsprachig deutsch, ohne Sprachebene) oder das Ziel (mit Sprachebene)
 * ansteuert.
 *
 * Gefragt wird das beim **Einlösen** eines Mail-Links, nicht im Layout des
 * Kundenbereichs: Ein Layout kennt in Next die aufgerufene Adresse nicht und
 * könnte das Ziel deshalb gar nicht weitergeben. Das Einlösen kennt sie.
 */
export async function zweiteStufeUmweg(ziel: string): Promise<string | null> {
  const { isAdmin } = await getViewerContext();
  if (!isAdmin) return null;

  const lage = await zweiteStufeLage();
  if (lage === "einrichten") return wegMitZiel(WEG_EINRICHTEN, ziel);
  if (lage === "bestaetigen") return wegMitZiel(WEG_CODE, ziel);
  return null;
}
