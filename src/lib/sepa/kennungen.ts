/**
 * Kennungen für die Lastschriftdatei (pain.008).
 *
 * Die Norm begrenzt `MsgId`, `PmtInfId` und `EndToEndId` auf **35 Zeichen**
 * (Max35Text). Bis zum 2026-09-16 standen dort schlicht UUIDs — mit Präfix
 * ergab das 40, 45 und 36 Zeichen. Die Bank hat die Datei abgelehnt:
 * „Ungültige message id (msgId), in Zeile 13". Sie bricht beim ersten Fehler
 * ab, die beiden anderen wären danach gekommen.
 *
 * Der Zeichensatz ist bewusst eng gehalten: Buchstaben, Ziffern, Bindestrich.
 * Manche Banken lehnen alles andere ab, und eine abgelehnte Datei kostet einen
 * zweiten Gang zur Bank.
 */

export const SEPA_MAX_KENNUNG = 35;
// Buchstaben, Ziffern, Bindestrich. Kleinbuchstaben sind in SEPA ausdrücklich
// erlaubt — eine strengere Regel hier würde gültige Kennungen abweisen. Was
// draußen bleibt, sind Doppelpunkte, Leerzeichen und Umlaute, an denen Banken
// sich stoßen.
const ERLAUBT = /^[A-Za-z0-9-]+$/;

/**
 * Eine kurze, eindeutige Kennung aus einer UUID.
 *
 * Sechzehn Hexstellen sind 64 Bit — für die paar Lastschriftläufe eines
 * Tanzstudios mehr als genug, und es bleibt Luft für einen Zusatz wie `-FRST`.
 */
export function sepaKennung(praefix: string, uuid: string, zusatz?: string): string {
  const kern = uuid.replace(/-/g, "").slice(0, 16).toUpperCase();
  const kennung = [praefix.toUpperCase(), kern, zusatz?.toUpperCase()].filter(Boolean).join("-");
  pruefeKennung(kennung, `${praefix}-Kennung`);
  return kennung;
}

/**
 * Wirft, wenn eine Kennung die Norm verletzt.
 *
 * Lieber hier ein Fehler als eine Datei, die die Bank zurückweist: Dort merkt
 * es der Betreiber erst beim Hochladen, und der Lauf ist dann schon erzeugt.
 */
export function pruefeKennung(wert: string, feld: string): void {
  if (wert.length === 0) {
    throw new Error(`SEPA: ${feld} ist leer.`);
  }
  if (wert.length > SEPA_MAX_KENNUNG) {
    throw new Error(
      `SEPA: ${feld} ist ${wert.length} Zeichen lang, erlaubt sind ${SEPA_MAX_KENNUNG}. Die Bank würde die Datei ablehnen.`
    );
  }
  if (!ERLAUBT.test(wert)) {
    throw new Error(
      `SEPA: ${feld} enthält unerlaubte Zeichen („${wert}"). Erlaubt sind Buchstaben, Ziffern und Bindestrich.`
    );
  }
}
