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

/**
 * Ob ein bereits angelegter Termin bestehen bleibt, wenn die Serie sich ändert.
 *
 * Er bleibt, solange er im Rhythmus liegt — auch dann, wenn ihm gerade nur die
 * Studioferien im Weg stehen. Nachträglich eingetragene Ferien sagen nichts ab:
 * Eine Absage hat Folgen für zahlende Gäste und braucht eine bewusste
 * Entscheidung (Produktentscheidung 2026-09-14, QA-Befund BUG-1). Fällt der
 * Termin dagegen aus dem Rhythmus selbst — anderer Wochentag, Serie früher zu
 * Ende — dann gehört er weg.
 */
export function terminBleibt(
  datum: string,
  fenster: { gueltig: Set<string>; imRhythmus: Set<string> }
): boolean {
  return fenster.gueltig.has(datum) || fenster.imRhythmus.has(datum);
}

/** Liegt dieser Kalendertag in einem der Ferienzeiträume? */
export function inFerienzeit(datum: string, ferien: Ferienzeitraum[]): boolean {
  return ferienEndeAm(datum, ferien) !== null;
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

  return ferienEndeAm(ohneFerien, fenster.ferien);
}

/** Das Ende der Ferien, in denen dieser Kalendertag liegt — sonst `null`. */
export function ferienEndeAm(datum: string, ferien: Ferienzeitraum[]): string | null {
  return ferien.find((zeitraum) => datum >= zeitraum.von && datum <= zeitraum.bis)?.bis ?? null;
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
