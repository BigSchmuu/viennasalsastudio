import type { Ferienzeitraum } from "@/lib/scheduling/dates";
import { naechsteFaelligkeit, ZYKLUS_TAGE } from "@/lib/sepa/faelligkeit";

/**
 * Der Vorschlag für den nächsten Zyklus (PROJ-107).
 *
 * Hier wird die ferienbewusste Rechnung aus PROJ-70 nicht abgeschafft, sondern
 * **degradiert**: vom Gesetz zum Vorschlag. Sie belegt das Formular vor und
 * legt ihre Zwischenschritte offen — „vier Wochen wären der 27.12., dazu 14
 * eingetragene Schließtage, also der 10.01." —, und der Betreiber bestätigt
 * oder überschreibt. Das ist der Unterschied zwischen einer Rechnung, der man
 * ausgeliefert ist, und einer, die man prüfen kann.
 *
 * Ein Zyklus soll **vier Kurswochen** enthalten: 28 Tage, an denen nicht
 * geschlossen ist. Gerechnet wird über `naechsteFaelligkeit`, also mit genau
 * der Fassung, die bisher den Einzug gesteuert hat — der erste Tag des
 * Folgezyklus minus einen Tag.
 */

const TAG_MS = 86_400_000;

function tagePlus(datum: string, tage: number): string {
  return new Date(Date.parse(`${datum}T00:00:00Z`) + tage * TAG_MS).toISOString().slice(0, 10);
}

function tageZwischen(von: string, bis: string): number {
  return Math.round((Date.parse(`${bis}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`)) / TAG_MS);
}

export type ZyklusVorschlag = {
  /** Erster Tag: der Tag nach dem letzten Zyklus, sonst der genannte Starttag. */
  von: string;
  /** Letzter Tag, Schließtage mitgerechnet. */
  bis: string;
  /** Wo das Ende ohne Schließungen läge — für die offengelegte Rechnung. */
  ohneSchliesstage: string;
  /** Wie viele Schließtage im Zeitraum liegen. */
  schliesstage: number;
};

/**
 * Vorschlag für den Zyklus nach `letztesEnde`.
 *
 * Gibt es noch keinen Zyklus, beginnt der Vorschlag bei `fallback` — in der
 * Oberfläche der heutige Tag, den der Betreiber ohnehin überschreibt.
 *
 * Eine bekannte Grenze: Liegt der **erste** Tag selbst in einer Schließung,
 * zählt er nicht als Schließtag, weil `ferientageZwischen` den Starttag außen
 * vor lässt (so steuert es seit PROJ-70 den Einzug). Der Zyklus wäre dann um
 * diesen Tag zu kurz. Ein Zyklus, der mitten in einer Schließung beginnt, ist
 * aber ohnehin eine Angabe, die der Betreiber von Hand setzt — und er sieht
 * die Rechnung daneben.
 */
export function zyklusVorschlag(
  letztesEnde: string | null,
  ferien: Ferienzeitraum[],
  fallback: string,
  zyklusTage: number = ZYKLUS_TAGE
): ZyklusVorschlag {
  const von = letztesEnde ? tagePlus(letztesEnde, 1) : fallback;
  const ohneSchliesstage = tagePlus(von, zyklusTage - 1);
  const bis = tagePlus(naechsteFaelligkeit(von, ferien, zyklusTage), -1);
  return {
    von,
    bis,
    ohneSchliesstage,
    schliesstage: tageZwischen(ohneSchliesstage, bis),
  };
}

/**
 * Die Lücke zwischen dem letzten Zyklus und diesem Beginn, in Tagen.
 *
 * Null heißt lückenlos, eine negative Zahl wäre eine Überschneidung — die
 * verbietet die Datenbank, hier wird sie nur benannt.
 */
export function luecke(letztesEnde: string | null, von: string): number {
  if (!letztesEnde) return 0;
  return tageZwischen(letztesEnde, von) - 1;
}
