/**
 * PROJ-47: Regeln rund um den Zustand eines Lastschriftlaufs.
 *
 * Sie liegen hier und nicht in den Dialogen, weil sie an zwei Stellen gelten:
 * Die Oberfläche wendet sie an, damit gar nicht erst etwas abgeschickt wird,
 * was abgewiesen würde — verbindlich prüft sie der Server. Zweimal
 * hingeschrieben liefen die beiden Fassungen irgendwann auseinander.
 */

/**
 * Obergrenze für den Betrag einer einzelnen Position.
 *
 * Dieselbe Überlegung wie bei der Rücklastschriftgebühr in PROJ-37: Ein
 * Vertipper wie 4500 statt 45,00 darf keine Abbuchung werden. Bei einer
 * Abbuchung wiegt er schwerer als bei einer Gebühr, nicht leichter.
 */
export const POSITION_BETRAG_MAX = 1000;

export type BetragFehler = "betrag_ungueltig" | "betrag_zu_hoch";

/**
 * Wandelt eine Eingabe in einen Betrag. Akzeptiert Komma wie Punkt — in
 * Österreich schreibt man 12,50, die Tastatur liefert oft 12.50.
 */
export function betragAusEingabe(eingabe: string): number {
  return Number(eingabe.trim().replace(",", "."));
}

export function pruefePositionsbetrag(eingabe: string): BetragFehler[] {
  const fehler: BetragFehler[] = [];
  const betrag = betragAusEingabe(eingabe);

  if (!Number.isFinite(betrag) || betrag <= 0) {
    fehler.push("betrag_ungueltig");
  } else if (betrag > POSITION_BETRAG_MAX) {
    fehler.push("betrag_zu_hoch");
  }

  return fehler;
}

/**
 * Der Zustand eines Laufs.
 *
 * „entwurf" hat Vorrang vor allem anderen: Solange nicht freigegeben ist,
 * wurde nichts eingezogen, und dann kann auch nichts zurückgebucht worden
 * sein. Die Reihenfolge der Prüfungen ist hier die Aussage.
 */
export type LaufZustand = "entwurf" | "eingezogen" | "rueckgebucht";

export function laufZustand(freigegebenAm: string | null, hatRueckbuchung: boolean): LaufZustand {
  if (!freigegebenAm) return "entwurf";
  return hatRueckbuchung ? "rueckgebucht" : "eingezogen";
}

export const LAUF_ZUSTAND_BESCHRIFTUNG: Record<LaufZustand, string> = {
  entwurf: "Entwurf",
  eingezogen: "Vollständig eingezogen",
  rueckgebucht: "Mit Rückbuchungen",
};

export const LAUF_ZUSTAND_FARBE: Record<LaufZustand, string> = {
  // Bernstein statt Grün oder Rot: Ein Entwurf ist weder gut noch schlecht,
  // er wartet — und genau das soll er signalisieren.
  entwurf: "#ffb000",
  eingezogen: "#2a9d8f",
  rueckgebucht: "#e63946",
};

/**
 * Darf dieser Lauf noch verändert werden?
 *
 * Maßgeblich entscheidet das die Datenbank. Hier dient es dazu, Schaltflächen
 * gar nicht erst anzubieten, die zu einer Absage führen würden.
 */
export function istAenderbar(freigegebenAm: string | null): boolean {
  return freigegebenAm === null;
}

/**
 * Was der Freigabe im Weg steht, oder null wenn nichts.
 *
 * Ein leerer Lauf ist der Fall, der sonst durchrutscht: Wer die letzte
 * Position entfernt, hat einen Lauf ohne Inhalt, und eine Freigabe darüber
 * erzeugte eine Bankdatei ohne Zeilen.
 */
export function freigabeHindernis(
  freigegebenAm: string | null,
  positionsAnzahl: number
): "bereits_freigegeben" | "keine_positionen" | null {
  if (freigegebenAm) return "bereits_freigegeben";
  if (positionsAnzahl === 0) return "keine_positionen";
  return null;
}

export function positionenSumme(positionen: { amount: number }[]): number {
  return positionen.reduce((summe, p) => summe + Number(p.amount), 0);
}
