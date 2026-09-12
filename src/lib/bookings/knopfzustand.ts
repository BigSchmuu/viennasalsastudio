/**
 * Was der Buchungsknopf sagen soll (PROJ-8 / PROJ-26).
 *
 * Katalog und Stundenplan zeigen denselben Kurs, und beide hatten denselben
 * Knopf: „Jetzt buchen", ganz gleich, ob der Kunde schon eingeschrieben ist,
 * eine Anfrage offen hat oder auf der Warteliste steht. Erfahren hat er es
 * erst im Dialog — also nach einem Klick, der ins Leere führte.
 *
 * Die Zustände stehen hier und nicht zweimal dort: Zwei Fassungen liefen
 * früher oder später auseinander, und dann sagte der Stundenplan etwas
 * anderes als die Kursliste.
 *
 * „Ausgebucht" fehlt in dieser Liste mit Absicht: Das steht schon als Abzeichen
 * an der Karte, und der Knopf führt dann zur Warteliste — er hat also etwas
 * anderes zu sagen als das Abzeichen.
 */
export type Buchungsknopf = "buchen" | "eingeschrieben" | "anfrageOffen" | "warteliste";

export function buchungsknopf(kurs: {
  hasActiveSubscription: boolean;
  hasOpenRegularBooking: boolean;
  isOnWaitlist: boolean;
}): Buchungsknopf {
  // Die Reihenfolge ist eine Aussage darüber, was am weitesten trägt: Wer
  // eingeschrieben ist, hat alles andere hinter sich. Eine offene Anfrage geht
  // dem Wartelistenplatz vor — sie ist der Vorgang, auf den er wartet.
  if (kurs.hasActiveSubscription) return "eingeschrieben";
  if (kurs.hasOpenRegularBooking) return "anfrageOffen";
  if (kurs.isOnWaitlist) return "warteliste";
  return "buchen";
}

/**
 * Die Beschriftung zum Zustand.
 *
 * Steht hier, damit Katalog, Kursdetail und Stundenplan denselben Satz
 * benutzen — drei Kopien einer Kette aus Bedingungen liefen auseinander.
 *
 * `buchenText` kommt vom Aufrufer: Der Katalog sagt „Jetzt buchen", die enge
 * Stundenplan-Karte nur „Buchen". Das ist der einzige Unterschied, den es
 * zwischen den drei Orten geben darf.
 */
export function knopfText(
  zustand: Buchungsknopf,
  t: (schluessel: string) => string,
  buchenText: string
): string {
  switch (zustand) {
    case "eingeschrieben":
      return t("btnEnrolled");
    case "anfrageOffen":
      return t("btnPending");
    case "warteliste":
      return t("btnWaitlist");
    case "buchen":
      return buchenText;
  }
}
