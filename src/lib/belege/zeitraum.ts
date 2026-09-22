/**
 * Wie ein Zeitraum im Belegarchiv benannt wird (PROJ-64).
 *
 * Steht hier und nicht in der Seite, weil es der einzige Satz ist, der später
 * in der abgelegten PDF-Datei erklärt, was darin steckt. „Alle Belege" statt
 * eines leeren Felds ist dabei kein Schmuck: Eine Datei ohne Zeitraum wäre in
 * fünf Jahren nicht einzuordnen.
 */

function formatDatum(datum: string): string {
  return new Date(datum).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function zeitraumText(von?: string, bis?: string): string {
  if (von && bis) return `${formatDatum(von)} bis ${formatDatum(bis)}`;
  if (von) return `ab ${formatDatum(von)}`;
  if (bis) return `bis ${formatDatum(bis)}`;
  return "alle Belege";
}

/** „1 Beleg" oder „7 Belege" — der Kopf steht auch in der gedruckten Datei. */
export function belegAnzahlText(anzahl: number): string {
  return `${anzahl} ${anzahl === 1 ? "Beleg" : "Belege"}`;
}
