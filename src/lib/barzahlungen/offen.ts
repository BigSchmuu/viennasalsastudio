/**
 * Wer wie viel bar schuldet (PROJ-81, Teilbeträge ab PROJ-83).
 *
 * Bis PROJ-83 war das eine **Datumsfrage**: Gibt es in diesem Zyklus eine
 * Zahlung? Beträge spielten keine Rolle, und wer 40 von 89 Euro gab, galt als
 * bezahlt. Jetzt gilt je Abo Soll minus Haben — das Soll entsteht an jedem
 * Fälligkeitstag als Zeile (`soll-nachtragen.ts`), das Haben ist jede erfasste
 * Zahlung. Gerechnet wird die Differenz in der Datenbank (`cash_ledger`);
 * hier wird sie nur gedeutet.
 *
 * Daraus folgt beides von selbst: Ein Rest bleibt stehen und addiert sich mit
 * dem nächsten Beitrag, eine Überzahlung deckt den nächsten Beitrag ab.
 */

const EUR = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

/** Unter einem Cent ist bezahlt. Sonst entscheidet eine Rundung über „offen". */
const CENT = 0.005;

export type Barzahler = {
  kundeId: string;
  kundeName: string;
  aboId: string;
  aboName: string | null;
  /** Der Beitrag je Zyklus; `null`, wenn am Abo kein Preis hinterlegt ist. */
  betrag: number | null;
  istFlatrate: boolean;
  /** Summe der fällig gewordenen Beiträge seit dem Stichtag. */
  soll: number;
  /** Summe der erfassten Barzahlungen. */
  haben: number;
  /** Tag der jüngsten Barzahlung — für „bezahlt am …". */
  letzteZahlung: string | null;
  /** Nur gesetzt, wenn das Abo gekündigt ist und ein Rest offen bleibt. */
  beendet?: boolean;
};

export type BarzahlerZeile = Barzahler & {
  /** Soll minus Haben. Positiv heißt offen, negativ ist Guthaben. */
  saldo: number;
  /** Muss jetzt Geld eingesammelt werden? */
  offen: boolean;
  /** Es ist etwas offen, aber schon etwas bezahlt. */
  teilweise: boolean;
  /** Was über den offenen Betrag hinaus bezahlt wurde; sonst 0. */
  guthaben: number;
};

/**
 * Für jeden Barzahler: offen oder bezahlt, und wie viel.
 *
 * Braucht weder Datum noch Ferien mehr — beides steckt in den Soll-Zeilen, die
 * der Morgenlauf erzeugt hat. Das ist der Punkt der Umstellung: Die Liste
 * deutet eine Rechnung, statt sie jedes Mal neu anzustellen.
 */
export function barzahlerZeilen(zahler: Barzahler[]): BarzahlerZeile[] {
  return zahler
    .map((z) => {
      const saldo = runde(z.soll - z.haben);
      return {
        ...z,
        saldo,
        offen: saldo > CENT,
        teilweise: saldo > CENT && z.haben > CENT,
        guthaben: saldo < -CENT ? runde(-saldo) : 0,
      };
    })
    .sort(
      (a, b) =>
        // Offene zuerst: Das ist die Arbeit des Abends. Innerhalb davon der
        // größere Betrag zuerst — wer am meisten schuldet, soll nicht unten
        // stehen.
        Number(b.offen) - Number(a.offen) ||
        (b.offen ? b.saldo - a.saldo : 0) ||
        a.kundeName.localeCompare(b.kundeName, "de")
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

  if (zeile.offen) {
    if (!zeile.teilweise) return "Offen";
    // Der bezahlte Teil gehört dazu: Sonst sieht die Lehrkraft nur den Rest und
    // fragt nach dem vollen Beitrag.
    return `Teilweise bezahlt — ${EUR.format(zeile.haben)} von ${EUR.format(zeile.soll)}`;
  }

  if (zeile.guthaben > 0) return `Guthaben ${EUR.format(zeile.guthaben)}`;
  if (zeile.letzteZahlung) return `Bezahlt am ${datumKurz(zeile.letzteZahlung)}`;
  // Kein Soll und keine Zahlung: Das Abo ist noch vor seinem ersten
  // Fälligkeitstag — oder es wurde bis zum Stichtag eingezogen.
  return "Nichts fällig";
}

function runde(wert: number): number {
  return Math.round(wert * 100) / 100;
}

function datumKurz(datum: string): string {
  const [jahr, monat, tag] = datum.split("-");
  return `${tag}.${monat}.${jahr}`;
}

/** Die Summe, die an diesem Abend noch einzusammeln ist. */
export function offeneSumme(zeilen: BarzahlerZeile[]): number {
  return runde(zeilen.filter((z) => z.offen).reduce((summe, z) => summe + z.saldo, 0));
}
