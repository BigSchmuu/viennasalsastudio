/**
 * Was einer Buchung gerade noch im Weg steht — oder `null`, wenn nichts.
 *
 * Der Absende-Knopf war ausgegraut, ohne dass irgendwo stand, warum. Bei einer
 * Probestunde können fünf verschiedene Bedingungen ihn sperren; wer eine davon
 * übersehen hat, sieht nur einen toten Knopf und sucht den Fehler bei sich.
 * Gemeldet vom Betreiber am 2026-09-09 mit einem Lehrer-Konto auf dem Handy.
 *
 * Die Reihenfolge folgt der Leserichtung im Dialog: erst der Termin, dann die
 * Angaben darunter. So nennt der Hinweis immer das Nächstliegende und springt
 * nicht im Formular umher.
 *
 * Diese Funktion ist zugleich die einzige Quelle für „darf abgeschickt
 * werden": Der Knopf ist genau dann frei, wenn hier `null` herauskommt. Zwei
 * getrennte Regelwerke würden früher oder später auseinanderlaufen.
 */
export type BuchungsHindernis =
  | "termin"
  | "aboArt"
  | "rolle"
  | "vorkenntnisse"
  | "herkunft"
  | "agb"
  | "mandat"
  | "bereitsAngefragt"
  | "bereitsEingeschrieben"
  | "warteliste";

export type BuchungsZustand = {
  art: "regular" | "trial" | "dropin";
  terminGewaehlt: boolean;
  /** Nur bei „regular": Kursabo oder Flatrate gewählt. */
  aboArtGewaehlt: boolean;
  /** Der Kurs fragt Leader/Follower ab, es wurde aber nichts gewählt. */
  rolleFehlt: boolean;
  /** Der Kurs nennt Vorkenntnisse, das Häkchen fehlt noch. */
  vorkenntnisseOffen: boolean;
  /** „Wie hast du von uns erfahren?" ist offen — nur bei der ersten Buchung. */
  herkunftFehlt: boolean;
  agbAkzeptiert: boolean;
  hatMandat: boolean;
  bereitsAngefragt: boolean;
  bereitsEingeschrieben: boolean;
  aufWarteliste: boolean;
};

export function buchungsHindernis(z: BuchungsZustand): BuchungsHindernis | null {
  // Zuerst die Gründe, die den Kurs als Ganzes betreffen: Sie stehen im Dialog
  // schon als Hinweis und machen jede weitere Eingabe sinnlos.
  if (z.art === "regular") {
    if (z.bereitsEingeschrieben) return "bereitsEingeschrieben";
    if (z.bereitsAngefragt) return "bereitsAngefragt";
    if (z.aufWarteliste) return "warteliste";
    if (!z.hatMandat) return "mandat";
  }

  if (!z.terminGewaehlt) return "termin";
  if (z.art === "regular" && !z.aboArtGewaehlt) return "aboArt";
  if (z.rolleFehlt) return "rolle";
  if (z.vorkenntnisseOffen) return "vorkenntnisse";
  if (z.herkunftFehlt) return "herkunft";
  if (!z.agbAkzeptiert) return "agb";

  return null;
}
