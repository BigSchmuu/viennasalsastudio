/**
 * PROJ-48: Regeln für die stapelweise Bearbeitung von Buchungen.
 *
 * Sie liegen hier und nicht im Bildschirm, weil sie ab jetzt an zwei Stellen
 * gelten: Die Vorschau zeigt sie, der Stapelvorgang führt sie aus. Zweimal
 * hingeschrieben liefen die beiden Fassungen irgendwann auseinander — und
 * auseinandergelaufen hieße hier: ein Abo zu einem Preis, den niemand gesehen
 * hat.
 */

/**
 * Wie viele Buchungen ein Stapel höchstens umfassen darf.
 *
 * Ein Wochenende bringt bestenfalls zwanzig Anmeldungen. Fünfzig lässt jeden
 * echten Fall zu und fängt trotzdem das versehentliche „alle auswählen" über
 * eine Liste ab, die nach zwei Jahren mehrere hundert Zeilen hat.
 */
export const STAPEL_MAX = 50;

export type Gutschein = {
  code: string;
  discountType: "percent" | "fixed";
  discountAmount: number;
};

/**
 * Der rabattierte Preis.
 *
 * Bis PROJ-41 ging das nur bei „Nur diesen Kurs": die Flatrate hatte keinen
 * Preis, von dem sich rabattieren ließe. Jetzt hat sie einen, also gilt ein
 * Gutschein für beide Abo-Arten.
 */
export function rabattierterPreis(grundpreis: number, gutschein: Gutschein): number {
  const ergebnis =
    gutschein.discountType === "percent"
      ? grundpreis * (1 - gutschein.discountAmount / 100)
      : grundpreis - gutschein.discountAmount;
  return Math.max(0, Math.round(ergebnis * 100) / 100);
}

export type VorschlagsBuchung = {
  id: string;
  type: string;
  status: string;
  courseName: string;
  /** Der bei der Anfrage gezeigte Preis. Steht seit damals fest. */
  price: number | null;
  /** Rückfall für Anfragen von vor PROJ-41. */
  coursePrice: number | null;
  coupon: Gutschein | null;
};

export type Vorschlag = {
  buchungId: string;
  aboName: string;
  /** `null`, wenn kein Preis zu ermitteln ist — dann darf der Stapel sie nicht anfassen. */
  preis: number | null;
  gutscheinCode: string | null;
};

/**
 * Was beim Bestätigen entstehen würde.
 *
 * Der Preis stammt aus dem, was dem Kunden bei der Anfrage gezeigt wurde —
 * eine spätere Preisänderung am Kurs darf den Vorschlag nicht verschieben.
 * Fehlt er ganz, ist das kein Grund für eine Null: Ein Abo über 0 € bucht
 * jeden Monat nichts ab und fällt niemandem auf. Solche Buchungen bleiben dem
 * Einzelweg vorbehalten.
 */
export function vorschlagFuer(buchung: VorschlagsBuchung): Vorschlag {
  const grundpreis = buchung.price ?? buchung.coursePrice;
  const preis =
    grundpreis != null && buchung.coupon
      ? rabattierterPreis(grundpreis, buchung.coupon)
      : grundpreis;

  return {
    buchungId: buchung.id,
    aboName: buchung.courseName,
    preis: preis ?? null,
    gutscheinCode: buchung.coupon?.code ?? null,
  };
}

/** Nur offene Buchungen lassen sich bearbeiten — alles andere ist erledigt. */
export function istAuswaehlbar(buchung: { status: string }): boolean {
  return buchung.status === "open";
}

/**
 * Braucht diese Buchung beim Bestätigen ein Abo?
 *
 * Drop-ins nicht — dort ist es ein reiner Statuswechsel. Probestunden kommen
 * gar nicht vor, sie entstehen bereits bestätigt.
 */
export function brauchtAbo(buchung: { type: string }): boolean {
  return buchung.type === "regular";
}

export type StapelHindernis = "leer" | "zu_gross" | "preis_fehlt";

/**
 * Was einem Stapel im Weg steht, oder null wenn nichts.
 *
 * `preis_fehlt` ist der Fall, der sonst durchrutscht: Eine Buchungsanfrage
 * ohne ermittelbaren Preis würde ein Abo über 0 € anlegen.
 */
export function stapelHindernis(vorschlaege: {
  anzahl: number;
  ohnePreis: number;
}): StapelHindernis | null {
  if (vorschlaege.anzahl === 0) return "leer";
  if (vorschlaege.anzahl > STAPEL_MAX) return "zu_gross";
  if (vorschlaege.ohnePreis > 0) return "preis_fehlt";
  return null;
}

export type StapelErgebnis = {
  erledigt: number;
  uebersprungen: { buchungId: string; kundenname: string; grund: string }[];
};

/**
 * Der Satz, den der Betreiber nach einem Stapel liest.
 *
 * „Erledigt" allein wäre gelogen, sobald etwas übersprungen wurde — und
 * übersprungen wird still, wenn jemand anders schneller war.
 */
export function stapelBericht(ergebnis: StapelErgebnis, verb: string): string {
  const { erledigt, uebersprungen } = ergebnis;

  if (erledigt === 0 && uebersprungen.length > 0) {
    return `Keine Buchung ${verb} — ${uebersprungen.length} übersprungen.`;
  }
  if (uebersprungen.length === 0) {
    return erledigt === 1 ? `1 Buchung ${verb}.` : `${erledigt} Buchungen ${verb}.`;
  }
  return `${erledigt} ${erledigt === 1 ? "Buchung" : "Buchungen"} ${verb}, ${uebersprungen.length} übersprungen.`;
}
