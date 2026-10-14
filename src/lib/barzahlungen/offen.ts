/**
 * Die Barzahler-Liste (PROJ-84).
 *
 * Ein Eintrag ist eine Zeile auf einer Liste, die von Hand geführt wird:
 * Kunde, Abo, Betrag. Daran hängen die Zahlungen. Offen ist, was fehlt.
 *
 * Vorher (PROJ-81/83) wurde beides abgeleitet — wer bar zahlt aus dem fehlenden
 * Mandat, was er schuldet aus Zyklus, Preis und Ferien. Das entschied Dinge,
 * die der Betreiber selbst entscheiden will, und brauchte dafür eine
 * Soll-Tabelle, eine Sicht, einen Stichtag und einen täglichen Lauf. Hier
 * rechnet nichts mehr: Betrag minus Gezahltes, zwei Zahlen.
 */

const EUR = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

/** Unter einem Cent ist bezahlt. Sonst entscheidet eine Rundung über „offen". */
const CENT = 0.005;

export type Eintrag = {
  eintragId: string;
  kundeId: string;
  kundeName: string;
  aboId: string;
  aboName: string | null;
  istFlatrate: boolean;
  /** Was dieser Mensch in diesem Zyklus zahlen soll. */
  betrag: number;
  /** Was davon schon da ist. */
  bezahlt: number;
  letzteZahlung: string | null;
  /** Die jüngste Zahlung — nur sie lässt sich mit einem Druck zurücknehmen. */
  letzteZahlungId: string | null;
  /**
   * Gehört dieser Eintrag zu einem Teilnehmer dieses Kurses?
   *
   * Flatrate-Einträge stehen in **jedem** Kurs, weil ein Flatrater überall
   * auftauchen kann — die aus anderen Kursen aber eingeklappt.
   */
  eigenerKurs: boolean;
};

export type EintragsZeile = Eintrag & {
  offen: number;
  istOffen: boolean;
  teilweise: boolean;
};

/** Für jeden Eintrag: wie viel noch fehlt. Offene zuerst, der größte oben. */
export function eintragsZeilen(eintraege: Eintrag[]): EintragsZeile[] {
  return eintraege
    .map((e) => {
      const offen = runde(e.betrag - e.bezahlt);
      return {
        ...e,
        offen,
        istOffen: offen > CENT,
        teilweise: offen > CENT && e.bezahlt > CENT,
      };
    })
    .sort(
      (a, b) =>
        Number(b.istOffen) - Number(a.istOffen) ||
        (b.istOffen ? b.offen - a.offen : 0) ||
        a.kundeName.localeCompare(b.kundeName, "de")
    );
}

/** Was am Eintrag über den Zustand steht. */
export function zustandText(zeile: EintragsZeile): string {
  if (!zeile.istOffen) {
    return zeile.letzteZahlung ? `Bezahlt am ${datumKurz(zeile.letzteZahlung)}` : "Bezahlt";
  }
  if (!zeile.teilweise) return "Offen";
  // Der bezahlte Teil gehört dazu: Sonst sieht die Lehrkraft nur den Rest und
  // fragt nach dem vollen Betrag.
  return `Teilweise bezahlt — ${EUR.format(zeile.bezahlt)} von ${EUR.format(zeile.betrag)}`;
}

/** Die Summe, die noch einzusammeln ist. */
export function offeneSumme(zeilen: EintragsZeile[]): number {
  return runde(zeilen.filter((z) => z.istOffen).reduce((summe, z) => summe + z.offen, 0));
}

/**
 * Die beiden Gruppen einer Kursseite.
 *
 * `eigene` sind die Teilnehmer dieses Kurses — die Arbeit des Abends. `fremde`
 * sind Flatrate-Einträge von Leuten, die hier nicht angemeldet sind; sie stehen
 * eingeklappt da, weil ein Flatrater jederzeit vorbeikommen kann, die Liste
 * aber nicht in jedem Kurs um Unbeteiligte wachsen soll.
 */
export function teileNachKurs(zeilen: EintragsZeile[]): {
  eigene: EintragsZeile[];
  fremde: EintragsZeile[];
} {
  return {
    eigene: zeilen.filter((z) => z.eigenerKurs),
    fremde: zeilen.filter((z) => !z.eigenerKurs),
  };
}

function runde(wert: number): number {
  return Math.round(wert * 100) / 100;
}

function datumKurz(datum: string): string {
  const [jahr, monat, tag] = datum.split("-");
  return `${tag}.${monat}.${jahr}`;
}
