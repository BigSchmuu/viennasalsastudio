/**
 * Der Stand der AGB (PROJ-42).
 *
 * **Bei jeder inhaltlichen Änderung der AGB hier hochzählen.** Der Wert wird bei
 * jeder Zustimmung mitgespeichert und beantwortet später die Frage, welchem
 * Text ein Kunde damals zugestimmt hat.
 *
 * Bewusst gepflegt und nicht aus dem Text berechnet: eine Prüfsumme änderte
 * sich schon bei einem korrigierten Komma und täuschte damit eine Änderung des
 * Rechtsstands vor, die nie stattgefunden hat.
 */
export const AGB_VERSION = "2026-08";

const MONATE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

/**
 * Der Stand als lesbare Angabe („August 2026").
 *
 * Die Überschrift der AGB-Seite und der gespeicherte Nachweis stammen aus
 * derselben Quelle — sonst könnte die angezeigte Fassung von der gespeicherten
 * abweichen, und der Nachweis wäre wertlos.
 */
export function formatAgbVersion(version: string = AGB_VERSION): string {
  const [jahr, monat] = version.split("-");
  const name = MONATE[Number(monat) - 1];
  return name ? `${name} ${jahr}` : version;
}
