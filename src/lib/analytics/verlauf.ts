import { heuteInWien } from "@/lib/constants/zeitzone";
import type { Bucket } from "@/lib/analytics/period";

/**
 * Zählen je Zeitraum für die Verlaufsgraphen (PROJ-76).
 *
 * Bisher stand dieselbe Filterzeile zweimal in der Dashboard-Seite. Mit einer
 * zweiten Reihe wären es drei geworden — und zwar an der Stelle, an der ein
 * Zeitstempel anders behandelt werden muss als ein Datum.
 */

/**
 * Der Wiener Kalendertag eines Zeitpunkts, als „JJJJ-MM-TT".
 *
 * Nötig, weil nicht alles ein Datum ist: `cancelled_at` ist eine Datumsspalte,
 * `created_at` ein Zeitstempel. Ein Abo, das am 31. um 23:30 Wiener Zeit
 * abgeschlossen wird, steht in der Datenbank als `…T21:30:00Z` — die ersten zehn
 * Zeichen ergäben den 31. in UTC, und bei einem Abschluss um 00:30 Wiener Zeit
 * umgekehrt den Vortag. Beides verschiebt den Eintrag an einer Monatsgrenze in
 * den falschen Balken.
 *
 * Für eine reine Datumsangabe ändert sich nichts: Mitternacht UTC ist in Wien
 * derselbe Tag.
 */
export function kalendertagInWien(zeitpunkt: string): string {
  return heuteInWien(new Date(zeitpunkt));
}

/**
 * Wie viele der Zeitpunkte in jeden Zeitraum fallen — in der Reihenfolge der
 * Zeiträume.
 *
 * Leere Werte werden übersprungen, nicht als „heute" gezählt: Ein Abo ohne
 * Kündigungsdatum ist nicht gekündigt.
 */
export function zaehleJeZeitraum(
  zeitraeume: Bucket[],
  zeitpunkte: (string | null | undefined)[]
): number[] {
  const tage = zeitpunkte
    .filter((z): z is string => typeof z === "string" && z.length > 0)
    .map(kalendertagInWien);

  return zeitraeume.map(
    (zeitraum) => tage.filter((tag) => tag >= zeitraum.from && tag <= zeitraum.to).length
  );
}
