/**
 * PROJ-101: Alter aus einem Geburtsdatum — zum **Anzeigen**.
 *
 * Diese Funktion entscheidet nichts. Ob jemand den Studierendenpreis bekommt,
 * beantwortet `studentenpreis_erlaubt` in der Datenbank, und zwar als einzige
 * Stelle: Das Kennzeichen kommt als Parameter an den Buchungsfunktionen an, ein
 * Kästchen im Browser hält niemanden auf. Hier geht es nur um die Zahl, die in
 * der Verwaltung neben einer Anfrage steht, damit der Betreiber einen Grenzfall
 * sieht.
 *
 * Gerechnet wird kalendergenau über Jahr, Monat und Tag. Eine Rechnung über
 * Millisekunden („Alter = Differenz / 365,25 Tage“) bricht am 29. Februar und
 * an der Zeitzone: `new Date("2026-08-23")` ist UTC-Mitternacht, `new Date()`
 * der aktuelle Augenblick — in Wien liegt dazwischen bis zu zwei Stunden, und
 * ein Geburtstag wäre dann einen Abend zu früh.
 */

/** Bis einschließlich zu diesem Alter gilt der Studierendenpreis. */
export const STUDIERENDEN_HOECHSTALTER = 27;

/**
 * Vollendete Lebensjahre am Stichtag, oder `null`, wenn das Datum fehlt oder
 * keines ist. Beide Angaben als ISO-Datum (`YYYY-MM-DD`).
 */
export function alterAm(
  geburtsdatum: string | null | undefined,
  stichtag: string
): number | null {
  const geboren = zerlege(geburtsdatum);
  const heute = zerlege(stichtag);
  if (!geboren || !heute) return null;

  let jahre = heute.jahr - geboren.jahr;
  // Der Geburtstag dieses Jahres ist noch nicht erreicht: ein Jahr weniger.
  if (heute.monat < geboren.monat || (heute.monat === geboren.monat && heute.tag < geboren.tag)) {
    jahre -= 1;
  }
  return jahre;
}

/**
 * Wie `alterAm`, aber als Satzbaustein für die Verwaltung: „28 Jahre“ oder
 * „—“, wenn kein Geburtsdatum hinterlegt ist. Ein leeres Feld und „0 Jahre“
 * dürfen sich nicht verwechseln lassen.
 */
export function alterText(
  geburtsdatum: string | null | undefined,
  stichtag: string
): string {
  const jahre = alterAm(geburtsdatum, stichtag);
  if (jahre === null) return "—";
  return `${jahre} ${jahre === 1 ? "Jahr" : "Jahre"}`;
}

function zerlege(datum: string | null | undefined): { jahr: number; monat: number; tag: number } | null {
  if (!datum || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) return null;
  const [jahr, monat, tag] = datum.split("-").map(Number);
  if (monat < 1 || monat > 12 || tag < 1 || tag > 31) return null;
  return { jahr, monat, tag };
}
