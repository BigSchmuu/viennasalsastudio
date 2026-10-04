/**
 * Kurstermine in Staffeln (PROJ-72).
 *
 * Die Anwesenheitsliste zeigte die letzten acht Termine und lud auf Klick
 * weitere vier in die Vergangenheit. Künftige Termine kannte sie nicht. Für
 * den Betrieb ist das die falsche Einteilung: Kurse laufen in Staffeln von
 * vier Wochen, und genau eine davon will der Lehrer sehen.
 *
 * Gezählt wird ab Kursbeginn, nicht ab heute — damit die Staffel vier Wochen
 * lang dieselbe bleibt und sich mit der Abrechnung deckt. Ohne hinterlegten
 * Kursbeginn gibt es nichts zu zählen; dann endet die aktuelle Staffel am
 * jüngsten Termin (das ist das Verhalten von vorher, nur in Vierer-Schritten).
 */

/** Vier Wochen — derselbe Zyklus, in dem Abos abgerechnet werden (PROJ-9). */
export const STAFFEL_LAENGE = 4;

/**
 * Termine in Staffeln schneiden.
 *
 * `abKursbeginn` entscheidet über die Richtung des Schnitts: vom ersten Termin
 * nach vorn (dann ist die erste Staffel immer vollständig und die letzte
 * vielleicht angebrochen) oder vom letzten Termin nach hinten (dann ist es
 * umgekehrt). Beides mit demselben Schnittmuster zu machen wäre einfacher und
 * falsch: Liegt der Kursbeginn fest, müssen die Grenzen dort verankert sein,
 * sonst wandern sie bei jedem neuen Termin.
 */
export function staffeln(
  termine: string[],
  { laenge = STAFFEL_LAENGE, abKursbeginn }: { laenge?: number; abKursbeginn: boolean }
): string[][] {
  if (termine.length === 0 || laenge < 1) return [];

  if (abKursbeginn) {
    const bloecke: string[][] = [];
    for (let i = 0; i < termine.length; i += laenge) bloecke.push(termine.slice(i, i + laenge));
    return bloecke;
  }

  // Von hinten: Der Rest, der nicht aufgeht, landet in der ersten Staffel.
  const bloecke: string[][] = [];
  for (let ende = termine.length; ende > 0; ende -= laenge) {
    bloecke.unshift(termine.slice(Math.max(0, ende - laenge), ende));
  }
  return bloecke;
}

/**
 * Welche Staffel heute gilt.
 *
 * Die, in der der jüngste vergangene Termin liegt — nicht die, in der der
 * nächste künftige liegt. Am Tag nach der letzten Stunde einer Staffel will
 * der Lehrer noch diese sehen, um nachzutragen, nicht schon die nächste.
 *
 * Liegt alles in der Zukunft (ein Kurs, der noch nicht begonnen hat), ist es
 * die erste. Gibt es keine Termine, dann `-1`.
 */
export function aktuelleStaffel(bloecke: string[][], heute: string): number {
  if (bloecke.length === 0) return -1;

  let treffer = -1;
  for (let i = 0; i < bloecke.length; i++) {
    if (bloecke[i].some((datum) => datum <= heute)) treffer = i;
  }
  return treffer === -1 ? 0 : treffer;
}

/** „05.10. – 26.10." — die Spanne einer Staffel, für die Überschrift. */
export function staffelSpanne(block: string[]): { von: string; bis: string } | null {
  if (block.length === 0) return null;
  return { von: block[0], bis: block[block.length - 1] };
}

/**
 * Der ganze Staffelplan eines Kurses.
 *
 * Mit hinterlegtem Kursbeginn wird vom ersten Termin nach vorn geschnitten —
 * die Grenzen liegen damit fest und wandern nicht.
 *
 * Ohne Kursbeginn gibt es keinen Anker. Dann wird am heutigen Tag geteilt: Was
 * war, wird von hinten geschnitten, damit die laufende Staffel vollständig ist
 * und am jüngsten Termin endet; was kommt, von vorn. Sonst hinge die Einteilung
 * am zufälligen Ende des Vorschaufensters — zwei Wochen später sähe der Lehrer
 * eine andere Aufteilung derselben Termine.
 */
export function staffelplan(
  termine: string[],
  { heute, kursbeginn, laenge = STAFFEL_LAENGE }: { heute: string; kursbeginn: boolean; laenge?: number }
): string[][] {
  if (kursbeginn) return staffeln(termine, { abKursbeginn: true, laenge });

  const vergangen = termine.filter((t) => t <= heute);
  const kuenftig = termine.filter((t) => t > heute);
  return [
    ...staffeln(vergangen, { abKursbeginn: false, laenge }),
    ...staffeln(kuenftig, { abKursbeginn: true, laenge }),
  ];
}
