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

export type Ortsangabe = {
  name: string | null;
  adresse: string | null;
  /** PROJ-77: die Beschreibung des Standorts — wie man hinfindet. */
  beschreibung?: string | null;
  /** PROJ-78: ihre englische Fassung; leer heißt „die deutsche gilt auch hier". */
  beschreibungEn?: string | null;
};

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

/**
 * Zeilenumbrüche zu Leerzeichen, Rand abschneiden.
 *
 * Der E-Mail-Text wird als ein Absatz gerendert: Ein Umbruch wäre dort
 * unsichtbar, und zwei aufeinanderfolgende ergäben eine Lücke mitten im Satz.
 */
function gesaeubert(wert: string | null | undefined): string {
  return (wert ?? "").replace(/\s+/g, " ").trim();
}

/**
 * „So findest du uns: Eingang über den Hof, zweiter Stock" — oder nichts
 * (PROJ-77).
 *
 * Der Satz entsteht hier und nicht in der Vorlage, aus demselben Grund wie bei
 * `{ort}`: Stünde die Einleitung im Vorlagentext, bliebe sie bei einem Standort
 * ohne Beschreibung als Satzanfang ohne Fortsetzung stehen.
 *
 * Die Einleitung gibt es in zwei Sprachen, weil der Satz im Code entsteht und
 * die Vorlage ihn nicht mehr übersetzen kann.
 */
export function wegbeschreibung(ort: Ortsangabe | null | undefined, locale = "de"): string {
  // PROJ-78: Für englische Empfänger die englische Fassung — und fehlt sie, die
  // deutsche. Entscheidung des Betreibers: Eine Wegbeschreibung hilft auch in
  // der falschen Sprache noch zur Tür, dieselbe Abwägung wie bei den Vorlagen.
  //
  // Erst säubern, dann wählen: Ein Feld, in dem nur Leerzeichen stehen, ist
  // „vorhanden" im Sinne von JavaScript und hätte die deutsche Fassung
  // verdrängt — der englische Kunde hätte dann gar nichts bekommen.
  const deutsch = gesaeubert(ort?.beschreibung);
  const text = locale === "en" ? gesaeubert(ort?.beschreibungEn) || deutsch : deutsch;
  if (!text) return "";
  const einleitung = locale === "en" ? "Here is how to find us:" : "So findest du uns:";
  return `${einleitung} ${text}`;
}
