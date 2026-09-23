/**
 * Wo ein Kurs stattfindet, als Satzbaustein für Benachrichtigungen (PROJ-67).
 *
 * Das Studio hat zwei Standorte, und in der Erinnerung stand bisher nur der
 * Kursname. Wer beide kennt, ist schon am falschen gestanden.
 *
 * Zwei Bausteine, weil zwei Stellen unterschiedlich viel Platz haben: `{ort}`
 * trägt den vollständigen Satzteil für die E-Mail, `{adresse}` nur die
 * Anschrift für alle, die ihren Text selbst zusammensetzen wollen.
 *
 * Der zusammengesetzte Wert entsteht hier und nicht in der Vorlage: „{ort},
 * {adresse}" hinterließe bei einem Standort ohne Anschrift ein Komma, hinter
 * dem nichts mehr kommt.
 */

export type Ortsangabe = { name: string | null; adresse: string | null };

/** „Studio Nord, Musterstraße 1" — oder nur der Name, wenn keine Anschrift hinterlegt ist. */
export function ortMitAdresse(ort: Ortsangabe | null | undefined): string {
  const name = ort?.name?.trim() ?? "";
  const adresse = ort?.adresse?.trim() ?? "";
  if (name && adresse) return `${name}, ${adresse}`;
  return name || adresse;
}

/** Nur die Anschrift, ohne Namen — leer, wenn keine hinterlegt ist. */
export function nurAdresse(ort: Ortsangabe | null | undefined): string {
  return ort?.adresse?.trim() ?? "";
}
