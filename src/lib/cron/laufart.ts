/**
 * Welcher der geplanten Läufe gerade dran ist.
 *
 * Drei Läufe teilen sich einen Endpunkt, unterschieden an `?run=`:
 *
 * - **morgen** — der volle Lauf: Erinnerungen, fällige Abo-Änderungen,
 *   Kursumwandlungen, Serientermine, verwaiste Bilder, Warteschlange.
 * - **abend** — nur die Erinnerung an die heutige Probestunde (PROJ-29) und
 *   die Warteschlange.
 * - **warteschlange** — nur die Warteschlange, alle 10 Minuten tagsüber.
 *
 * Der dritte kam erst mit dem Vercel-Pro-Tarif dazu: Auf dem kostenlosen
 * Tarif durfte ein geplanter Lauf **einmal täglich** starten, und auch das nur
 * stundengenau. Benachrichtigungen, die nicht sofort verschickt werden, lagen
 * damit bis 6 oder 18 Uhr — eine Buchungsbestätigung vom Vormittag erreichte
 * den Kunden am Abend.
 *
 * Warum nicht rund um die Uhr: Was um drei Uhr früh in die Warteschlange
 * kommt, muss nicht um drei Uhr früh ankommen — eine Mail zu dieser Zeit sieht
 * für den Empfänger nach Automat aus.
 *
 * Der Zeitplan steht in UTC, denn Vercel rechnet immer so, und er wandert
 * deshalb nicht mit der Sommerzeit. `5-22` heißt in Wien: im Winter 6:00 bis
 * 23:50 — also genau bis Mitternacht —, im Sommer 7:00 bis 0:50, womit der
 * letzte Lauf knapp in den nächsten Tag rutscht. Die Alternative `5-21` wäre
 * im Sommer genau, im Winter aber eine Stunde zu kurz; lieber knapp darüber
 * als abends zu früh Schluss.
 *
 * Unbekannte Werte gelten als Morgenlauf: Das ist das Verhalten von vorher,
 * als es den Parameter noch gar nicht gab.
 */

export type Laufart = "morgen" | "abend" | "warteschlange";

export function laufArt(wert: string | null | undefined): Laufart {
  if (wert === "evening") return "abend";
  if (wert === "queue") return "warteschlange";
  return "morgen";
}
