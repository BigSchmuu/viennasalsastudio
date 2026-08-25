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

/**
 * Der Stand, den die englische Übersetzung wiedergibt (PROJ-43).
 *
 * **Beim Übersetzen einer AGB-Änderung hier nachziehen.** Weichen die beiden
 * Werte voneinander ab, zeigt die englische Seite bewusst den deutschen Text
 * mit einem Hinweis, statt eine veraltete Übersetzung stehenzulassen: ein
 * falscher Rechtstext in der Sprache des Lesers ist schlimmer als ein
 * aktueller in einer Fremdsprache.
 */
export const AGB_TRANSLATION_VERSION = "2026-08";

/** Ist die englische Fassung auf dem Stand der deutschen? */
export function agbTranslationIsCurrent(): boolean {
  return AGB_TRANSLATION_VERSION === AGB_VERSION;
}

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
