/**
 * Die Zeitzone des Studios.
 *
 * Ohne ausdrückliche Angabe rechnen `Date` und `toLocaleString` in der
 * Zeitzone des Servers. Der steht bei Vercel auf UTC, das Studio und seine
 * Kunden stehen in Wien — im Sommer zwei Stunden auseinander. Das hatte zwei
 * sichtbare Folgen:
 *
 * Ein Event am 02.09. um 22:49 UTC ist in Wien der 03.09. um 00:49. Angezeigt
 * wurde der falsche Tag und die falsche Uhrzeit.
 *
 * Und Fristen, die in ganzen Tagen rechnen (Stornieren, Umbuchen), zählten
 * zwischen Mitternacht und 2 Uhr Wiener Zeit noch den Vortag. Ein Kunde
 * konnte um 00:30 einen Kurs stornieren, der nach seinem Kalender schon heute
 * stattfindet.
 *
 * Deshalb rechnet und formatiert die App ausdrücklich in Wien, unabhängig
 * davon, wo sie läuft.
 */
export const STUDIO_TIMEZONE = "Europe/Vienna";

/**
 * Der heutige Kalendertag in Wien als "JJJJ-MM-TT".
 *
 * `en-CA` liefert genau dieses Format — kürzer und verlässlicher, als die
 * Bestandteile einzeln zusammenzusetzen.
 */
export function heuteInWien(jetzt: Date = new Date()): string {
  return jetzt.toLocaleDateString("en-CA", { timeZone: STUDIO_TIMEZONE });
}

/**
 * Der heutige Tag in Wien als `Date` zur Mittagsstunde.
 *
 * Für Rechnungen, die nur den Kalendertag brauchen. Die Mittagsstunde hält
 * Abstand zu beiden Tagesgrenzen, damit keine Sommerzeitumstellung das
 * Ergebnis um einen Tag verschiebt.
 */
export function heuteAlsDatumInWien(jetzt: Date = new Date()): Date {
  const [jahr, monat, tag] = heuteInWien(jetzt).split("-").map(Number);
  return new Date(jahr, monat - 1, tag, 12, 0, 0, 0);
}
