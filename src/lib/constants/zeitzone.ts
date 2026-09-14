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

/**
 * Mitternacht am Ende des Wiener Kalendertags, in den `zeitpunkt` fällt — als
 * echter Zeitpunkt, nicht als Datum.
 *
 * Für Events ohne eingetragenes Ende (PROJ-53): Sie gelten bis zum Ende ihres
 * Veranstaltungstags. In UTC gerechnet endete dieser Tag im Sommer schon um
 * 2 Uhr früh Wiener Zeit.
 *
 * Die Umstellung auf Sommer- oder Winterzeit liegt in Wien um 2 bzw. 3 Uhr,
 * nie um Mitternacht. Der Versatz des Folgetags um 0 Uhr ist deshalb eindeutig;
 * die zweite Messung fängt nur den Fall ab, dass die Schätzung auf der anderen
 * Seite einer Umstellung landet.
 */
export function tagesendeInWien(zeitpunkt: Date): Date {
  const [jahr, monat, tag] = heuteInWien(zeitpunkt).split("-").map(Number);
  const mitternachtUtc = Date.UTC(jahr, monat - 1, tag + 1);
  const versatz = wienerVersatzMinuten(new Date(mitternachtUtc));
  const ergebnis = new Date(mitternachtUtc - versatz * 60_000);
  const nachgemessen = wienerVersatzMinuten(ergebnis);
  return nachgemessen === versatz ? ergebnis : new Date(mitternachtUtc - nachgemessen * 60_000);
}

/** Versatz der Wiener Zeit gegenüber UTC in Minuten, z. B. 120 im Sommer. */
function wienerVersatzMinuten(zeitpunkt: Date): number {
  const angabe =
    new Intl.DateTimeFormat("en-US", { timeZone: STUDIO_TIMEZONE, timeZoneName: "longOffset" })
      .formatToParts(zeitpunkt)
      .find((teil) => teil.type === "timeZoneName")?.value ?? "GMT";
  const treffer = angabe.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!treffer) return 0;
  const minuten = Number(treffer[2]) * 60 + Number(treffer[3]);
  return treffer[1] === "-" ? -minuten : minuten;
}
