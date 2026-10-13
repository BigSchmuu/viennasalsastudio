import { istFaellig } from "@/lib/sepa/faelligkeit";
import type { Ferienzeitraum } from "@/lib/scheduling/dates";

/**
 * Wer jetzt bar zahlen muss (PROJ-81).
 *
 * Die Regel ist **dieselbe** wie beim Lastschriftlauf: vier Wochen Abstand,
 * Ferien verlängern (`lib/sepa/faelligkeit.ts`, PROJ-70). Hätte die Barzahlung
 * eine eigene Rechnung, bedeuteten „Zyklus" und „bezahlt" bei Bar und
 * Lastschrift unbemerkt Verschiedenes.
 *
 * Einzüge und Barzahlungen zählen dabei **zusammen**: Wer im September
 * eingezogen wurde und im Oktober sein Mandat widerruft, hat den September
 * bezahlt — egal auf welchem Weg.
 */

export type Barzahler = {
  kundeId: string;
  kundeName: string;
  aboId: string;
  aboName: string | null;
  /** Der Beitrag je Zyklus; `null`, wenn am Abo kein Preis hinterlegt ist. */
  betrag: number | null;
  istFlatrate: boolean;
  /** Fälligkeitstage bisheriger Einzüge. */
  einzuege: string[];
  /** Tage bisheriger Barzahlungen. */
  barzahlungen: string[];
};

export type BarzahlerZeile = Barzahler & {
  /** Muss jetzt gezahlt werden? */
  offen: boolean;
  /** Die jüngste Barzahlung — für „bezahlt am …". */
  letzteBarzahlung: string | null;
};

/**
 * Für jeden Barzahler: offen oder bezahlt, und wann zuletzt.
 *
 * `heute` ist der Tag, an dem gefragt wird — die Lehrkraft steht am Kursabend
 * davor. Ohne jede Zahlung ist immer offen: Der erste Beitrag wartet auf nichts.
 */
export function barzahlerZeilen(
  zahler: Barzahler[],
  heute: string,
  ferien: Ferienzeitraum[]
): BarzahlerZeile[] {
  return zahler
    .map((z) => {
      const alle = [...z.einzuege, ...z.barzahlungen];
      const sortierteBar = [...z.barzahlungen].sort();
      return {
        ...z,
        offen: istFaellig(heute, alle, ferien),
        letzteBarzahlung: sortierteBar[sortierteBar.length - 1] ?? null,
      };
    })
    .sort(
      (a, b) =>
        // Offene zuerst: Das ist die Arbeit des Abends.
        Number(b.offen) - Number(a.offen) || a.kundeName.localeCompare(b.kundeName, "de")
    );
}

/**
 * Was am Eintrag über den Zustand steht.
 *
 * Ein Abo ohne Preis lässt sich nicht abhaken — und das wird gesagt, statt
 * einen Knopf anzubieten, der nichts bewirken kann.
 */
export function zustandText(zeile: BarzahlerZeile): string {
  if (zeile.betrag === null || zeile.betrag <= 0) return "Kein Preis am Abo";
  if (zeile.offen) return "Offen";
  if (zeile.letzteBarzahlung) return `Bezahlt am ${datumKurz(zeile.letzteBarzahlung)}`;
  // Bezahlt, aber keine Barzahlung — dann deckt ein Einzug den Zyklus ab. Kommt
  // vor, wenn das Mandat gerade widerrufen wurde.
  return "Durch Einzug gedeckt";
}

function datumKurz(datum: string): string {
  const [jahr, monat, tag] = datum.split("-");
  return `${tag}.${monat}.${jahr}`;
}

/** Die Summe, die an diesem Abend noch einzusammeln ist. */
export function offeneSumme(zeilen: BarzahlerZeile[]): number {
  return zeilen.filter((z) => z.offen).reduce((summe, z) => summe + (z.betrag ?? 0), 0);
}
