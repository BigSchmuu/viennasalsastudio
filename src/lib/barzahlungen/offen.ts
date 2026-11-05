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
 *
 * PROJ-98: Dazu kommt der Zyklus — aber nur als Zeitraum, nicht als Rechnung.
 * „Bezahlt“ heißt ab jetzt „in diesem Zyklus bezahlt“; was aus dem vorigen
 * offen blieb, steht als eigene Angabe **daneben** und nie im Betrag. Eine Zahl
 * aus zwei Zyklen ist beim Kassieren nicht mehr auseinanderzunehmen.
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
  /**
   * Der Name der Stilrichtung, wenn dieses Abo ein Pass ist (PROJ-93), sonst
   * `null`.
   *
   * Nötig, weil `istFlatrate` beide nicht unterscheiden kann: Flatrate und Pass
   * sind in der Datenbank gleichermaßen „ein Abo ohne Kurs". Wer hier nur
   * `istFlatrate` liest, beschriftet einen Bachata-Pass als Flatrate — und die
   * Lehrkraft sammelt den falschen Betrag ein.
   */
  passStil: string | null;
  /** Was dieser Mensch in diesem Zyklus zahlen soll. */
  betrag: number;
  /** Was davon schon da ist. */
  bezahlt: number;
  letzteZahlung: string | null;
  /** Interne Randbemerkung (PROJ-86); leer ist `null`, nicht "". */
  notiz: string | null;
  /** Die jüngste Zahlung — nur sie lässt sich mit einem Druck zurücknehmen. */
  letzteZahlungId: string | null;
  /**
   * Was dieses Abo aus dem jüngsten abgeschlossenen Zyklus noch offen hat
   * (PROJ-98); 0, wenn es dort nicht stand oder voll bezahlt hat.
   *
   * Steht neben dem Betrag dieses Zyklus, nicht darin — Entscheidung des
   * Betreibers. Wer die beiden addiert, kann sie beim Kassieren nicht mehr
   * trennen.
   */
  restVorher: number;
  /** Bis wann jener vorige Zyklus ging; `null`, solange keiner abgeschlossen ist. */
  vorherBis: string | null;
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

/**
 * Was am Eintrag über den Zustand steht.
 *
 * PROJ-98: „Für diesen Zyklus bezahlt" statt „Bezahlt". Der Zusatz ist keine
 * Höflichkeit — ein Eintrag kann gleichzeitig für diesen Zyklus bezahlt sein
 * und aus dem vorigen etwas offen haben. Ohne ihn liest die Lehrkraft
 * „Bezahlt" und daneben einen offenen Betrag, und das sieht aus wie ein
 * Widerspruch. Ohne abgeschlossenen Zyklus stimmt der Satz auch: Dann ist
 * alles der laufende Zyklus.
 */
export function zustandText(zeile: EintragsZeile): string {
  if (!zeile.istOffen) {
    return zeile.letzteZahlung
      ? `Für diesen Zyklus bezahlt am ${datumKurz(zeile.letzteZahlung)}`
      : "Für diesen Zyklus bezahlt";
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
 * Was an einem Eintrag über das Produkt steht — oder `null` bei einem Kursabo,
 * denn dort ist der Kurs die Antwort und steht ohnehin über der Liste.
 *
 * Die Stilrichtung schlägt `istFlatrate`, weil beide kurslos sind: Ein Pass ist
 * eine Flatrate mit Grenze, und genau die Grenze ist hier die Information.
 */
export function produktText(zeile: {
  istFlatrate: boolean;
  passStil: string | null;
}): string | null {
  if (zeile.passStil) return `${zeile.passStil} Pass`;
  return zeile.istFlatrate ? "Flatrate" : null;
}

/**
 * Der offene Rest aus dem vorigen Zyklus — oder `null`, wenn es keinen gibt.
 *
 * An **einer** Stelle, weil beide Ansichten ihn brauchen: die Verwaltung beim
 * Abschließen, die Lehrkraft am Kursabend. Der Zeitraum steht im Satz, damit
 * „offen" nicht in der Luft hängt: Es ist nicht der Betrag von heute.
 */
export function restText(zeile: { restVorher: number; vorherBis: string | null }): string | null {
  if (zeile.restVorher <= CENT) return null;
  const bis = zeile.vorherBis ? ` bis ${datumKurz(zeile.vorherBis)}` : "";
  return `Aus dem Zyklus${bis} offen: ${EUR.format(zeile.restVorher)}`;
}

/**
 * Die beiden Gruppen einer Kursseite.
 *
 * `eigene` sind die Teilnehmer dieses Kurses — die Arbeit des Abends. `fremde`
 * sind kurslose Abos von Leuten, die hier nicht angemeldet sind: Flatraten und
 * Pässe dieser Stilrichtung. Sie stehen eingeklappt da, weil so jemand
 * jederzeit vorbeikommen kann, die Liste aber nicht in jedem Kurs um
 * Unbeteiligte wachsen soll.
 *
 * Welche Pässe überhaupt mitkommen, entscheidet die Datenbank
 * (`get_course_cash_payers`, PROJ-95) — ein Bachata-Pass erscheint in keinem
 * Salsa-Kurs.
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
