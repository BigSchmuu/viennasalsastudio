import { upcomingOccurrences, type Ferienzeitraum } from "@/lib/scheduling/dates";
import { heuteInWien } from "@/lib/constants/zeitzone";

/**
 * Wiederkehrende Veranstaltungen (PROJ-54).
 *
 * Eine Serie beschreibt nur die Regel: ein fester Wochentag, eine Uhrzeit, ein
 * Anfang und vielleicht ein Ende. Die einzelnen Termine daraus sind ganz
 * normale Events — mit Tickets, Kapazität und QR-Code. Hier steht nur, welche
 * Termine ins Vorschaufenster fallen.
 *
 * Gerechnet wird mit der Terminfunktion der Kurse: Sie beherrscht Wochentag,
 * Zeitraum und Studioferien schon. Eine zweite Rechnung liefe früher oder
 * später anders als der Stundenplan.
 */

/** Vier Wochen: So weit stehen Serientermine im Programm und sind kaufbar (Betreiberentscheidung 2026-09-15). */
export const SERIEN_VORSCHAU_TAGE = 28;

export type SerienRegel = {
  /** 0 = Montag … 6 = Sonntag, wie überall im Projekt. */
  weekday: number;
  /** Erster möglicher Termin, als Kalendertag. */
  startsOn: string;
  /** Letzter möglicher Termin; `null` heißt: läuft weiter. */
  endsOn: string | null;
  pausiertInFerien: boolean;
};

type Fenster = {
  ferien: Ferienzeitraum[];
  jetzt?: Date;
  /** Nur für Tests und Sonderfälle; sonst gilt das Vorschaufenster. */
  tage?: number;
};

/** Die Termine der Serie von heute bis zum Ende des Vorschaufensters. */
export function serientermine(regel: SerienRegel, fenster: Fenster): string[] {
  const { ferien, jetzt, tage = SERIEN_VORSCHAU_TAGE } = fenster;
  const bis = tagePlus(heuteInWien(jetzt), tage);
  const grenze = regel.endsOn && regel.endsOn < bis ? regel.endsOn : bis;

  return upcomingOccurrences(regel.weekday, {
    // Ein Termin je Woche, plus Reserve für die Wochen, die Ferien wegnehmen.
    count: Math.floor(tage / 7) + 2,
    zeitraum: { von: regel.startsOn, bis: grenze },
    ferien: regel.pausiertInFerien ? ferien : [],
    jetzt,
  });
}

/** Der nächste stattfindende Termin, oder `null`, wenn im Fenster keiner liegt. */
export function naechsterTermin(regel: SerienRegel, fenster: Fenster): string | null {
  return serientermine(regel, fenster)[0] ?? null;
}

/**
 * Fällt der nächste reguläre Termin in die Studioferien, das Ende dieser Ferien
 * — sonst `null`.
 *
 * Damit sagt das Programm „Ferienpause bis …", statt die Serie wortlos ohne
 * Termine dastehen zu lassen.
 */
export function ferienpauseBis(regel: SerienRegel, fenster: Fenster): string | null {
  if (!regel.pausiertInFerien) return null;

  // Derselbe Zeitraum, aber ohne Ferien gerechnet: Wo wäre der nächste Termin,
  // wenn nichts dazwischenkäme?
  const ohneFerien = serientermine({ ...regel, pausiertInFerien: false }, fenster)[0];
  if (!ohneFerien) return null;

  const treffer = fenster.ferien.find((zeitraum) => ohneFerien >= zeitraum.von && ohneFerien <= zeitraum.bis);
  return treffer ? treffer.bis : null;
}

/** „21:00:00" aus der Datenbank wird zu „21:00". */
export function uhrzeitKurz(zeit: string): string {
  return zeit.slice(0, 5);
}

/** Kalendertag plus `tage`, ohne Zeitzonenfallen (rein als Datum gerechnet). */
function tagePlus(datum: string, tage: number): string {
  return new Date(Date.parse(`${datum}T00:00:00Z`) + tage * 86_400_000).toISOString().slice(0, 10);
}

/** Eine Serie läuft oder ist beendet — beendet heißt: keine neuen Termine mehr. */
export const SERIE_AKTIV = "aktiv";
export const SERIE_BEENDET = "beendet";
