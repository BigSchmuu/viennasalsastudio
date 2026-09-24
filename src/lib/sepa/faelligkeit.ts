import type { Ferienzeitraum } from "@/lib/scheduling/dates";

/**
 * Wann ein Abo wieder eingezogen werden darf (PROJ-70).
 *
 * Bis hierher nahm jeder neue Lauf **alle** aktiven Abos mit. Zwei Läufe im
 * selben Monat buchten denselben Beitrag zweimal ab; bei den Event-Tickets gab
 * es diese Sperre längst, bei den Abos nicht.
 *
 * Der Abstand sind vier Wochen — aber gezählt werden nur Wochen, in denen auch
 * unterrichtet wird: Liegt eine Ferienwoche dazwischen, verschiebt sich die
 * nächste Fälligkeit um genau diese Tage nach hinten. Wer im August zwei
 * Wochen geschlossen hat, zieht im September nicht trotzdem pünktlich ein.
 *
 * Gerechnet wird auf Kalendertagen in UTC: Die Zeitzone spielt hier keine
 * Rolle, weil beide Enden reine Datumsangaben sind — und in UTC gibt es keine
 * Sommerzeit, die einen Tag verschluckt.
 */

/** Vier Wochen: der Zyklus, nach dem auch Pausieren und Kündigen wirksam werden (PROJ-9). */
export const ZYKLUS_TAGE = 28;

function alsTag(datum: string): number {
  return Date.parse(`${datum}T00:00:00Z`);
}

function alsDatum(zeit: number): string {
  return new Date(zeit).toISOString().slice(0, 10);
}

const TAG_MS = 86_400_000;

/**
 * Ferientage im Zeitraum **nach** `von` bis einschließlich `bis`.
 *
 * `von` bleibt außen vor: Das ist der Tag des letzten Einzugs, und er zählt
 * nicht noch einmal mit.
 */
export function ferientageZwischen(von: string, bis: string, ferien: Ferienzeitraum[]): number {
  const start = alsTag(von);
  const ende = alsTag(bis);
  if (!(ende > start)) return 0;

  let tage = 0;
  for (let tag = start + TAG_MS; tag <= ende; tag += TAG_MS) {
    const datum = alsDatum(tag);
    if (ferien.some((f) => datum >= f.von && datum <= f.bis)) tage += 1;
  }
  return tage;
}

/**
 * Der früheste Tag, an dem nach `letzterEinzug` wieder eingezogen werden darf.
 *
 * Die Schleife ist Absicht: Eine Ferienwoche am Ende des Fensters schiebt die
 * Fälligkeit nach hinten — und im neuen Fenster können weitere Ferientage
 * liegen. Ohne das Nachrechnen wäre eine zweiwöchige Schließung nur zur Hälfte
 * berücksichtigt.
 */
export function naechsteFaelligkeit(
  letzterEinzug: string,
  ferien: Ferienzeitraum[],
  zyklusTage: number = ZYKLUS_TAGE
): string {
  let ziel = alsDatum(alsTag(letzterEinzug) + zyklusTage * TAG_MS);
  let gezaehlt = -1;

  // Höchstens ein Jahr Verschiebung — eine Schleife, die nicht endet, wäre in
  // einem Lauf über hunderte Abos das größere Übel als ein ungenauer Rand.
  for (let runde = 0; runde < 13; runde++) {
    const tage = ferientageZwischen(letzterEinzug, ziel, ferien);
    if (tage === gezaehlt) break;
    gezaehlt = tage;
    ziel = alsDatum(alsTag(letzterEinzug) + (zyklusTage + tage) * TAG_MS);
  }

  return ziel;
}

/**
 * Darf dieses Abo in einen Lauf mit diesem Fälligkeitsdatum?
 *
 * Geprüft wird gegen **alle** bisherigen Einzüge, und zwar in beide
 * Richtungen: Ein Einzug gehört in denselben Zyklus, wenn weder er einen
 * vollen Zyklus vor dem neuen Datum liegt noch das neue Datum einen vollen
 * Zyklus vor ihm.
 *
 * Der Blick nach vorn ist kein Selbstzweck. Ein erster Entwurf verglich nur
 * mit dem **jüngsten** Einzug — und in der Testdatenbank liegt ein Lauf im
 * Jahr 2028. Dagegen war jeder Lauf davor „zu früh", und kein Abo kam mehr in
 * einen Lauf. Fachlich zählt ohnehin nicht „der letzte", sondern „gibt es in
 * diesem Zeitraum schon einen".
 *
 * Ohne vorherigen Einzug immer — der erste Beitrag eines neuen Kunden wartet
 * auf nichts.
 */
export function istFaellig(
  faelligkeitsdatum: string,
  bisherigeEinzuege: string | string[] | null | undefined,
  ferien: Ferienzeitraum[],
  zyklusTage: number = ZYKLUS_TAGE
): boolean {
  if (!bisherigeEinzuege) return true;
  const einzuege = Array.isArray(bisherigeEinzuege) ? bisherigeEinzuege : [bisherigeEinzuege];
  if (einzuege.length === 0) return true;

  const naechsteNachNeu = naechsteFaelligkeit(faelligkeitsdatum, ferien, zyklusTage);

  return einzuege.every((einzug) => {
    const naechsteNachEinzug = naechsteFaelligkeit(einzug, ferien, zyklusTage);
    // Ein voller Zyklus dazwischen — in der einen oder der anderen Richtung.
    return faelligkeitsdatum >= naechsteNachEinzug || einzug >= naechsteNachNeu;
  });
}
