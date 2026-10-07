import { STUDIO_TIMEZONE } from "@/lib/constants/zeitzone";
import { naechsteTermine, type KursEingabe } from "@/lib/teacher/uebersicht";
import type { Ferienzeitraum } from "@/lib/scheduling/dates";

/**
 * Die heutigen Kurse für das Admin-Dashboard (PROJ-75).
 *
 * Bewusst ohne Datenbankbezug: Welcher Kurs heute stattfindet und wie weit das
 * Einchecken ist, lässt sich hier mit erfundenen Werten prüfen — dieselbe
 * Trennung wie in lib/teacher/uebersicht.ts.
 */

export type HeutigerKurs = {
  kursId: string;
  kursName: string;
  ort: string | null;
  startZeit: string | null;
  endZeit: string | null;
};

/**
 * Aus allen Kursen die heutigen.
 *
 * Gerechnet wird mit `naechsteTermine` aus PROJ-49, nicht mit einer eigenen
 * Formel: Pausen, Ferien und Kurszeitraum sind dort schon richtig behandelt und
 * geprüft. Eine zweite Rechnung ergäbe früher oder später zwei verschiedene
 * Tage — und dann klickt der Betreiber auf eine Stunde, die ausfällt.
 */
export function heutigeKurse(
  kurse: KursEingabe[],
  heute: string,
  ferien: Ferienzeitraum[],
  jetzt?: Date
): HeutigerKurs[] {
  return naechsteTermine(kurse, heute, ferien, jetzt)
    .filter((termin) => termin.datum === heute)
    .map((termin) => ({
      kursId: termin.kursId,
      kursName: termin.kursName,
      ort: termin.ort,
      startZeit: termin.startZeit,
      endZeit: termin.endZeit,
    }))
    .sort(
      (a, b) =>
        (a.startZeit ?? "").localeCompare(b.startZeit ?? "") ||
        a.kursName.localeCompare(b.kursName, "de")
    );
}

export type Eincheckstand = {
  /** Wie viele Personen zu diesem Termin erwartet werden. */
  erwartet: number;
  /** Wie viele davon als anwesend markiert sind. */
  anwesend: number;
  /** Wie viele überhaupt markiert sind — anwesend oder abwesend. */
  erfasst: number;
};

/**
 * Der Stand aus einer Anwesenheitsliste.
 *
 * Gezählt wird genau die Liste, die der Betreiber beim Klick zu sehen bekommt
 * (`get_course_attendance_roster`). Jede eigene Zählung ließe Dashboard und
 * Liste auseinanderlaufen — und das zu verhindern ist der Zweck des Abschnitts.
 */
export function einchecksStand(zeilen: { status: string | null }[]): Eincheckstand {
  return {
    erwartet: zeilen.length,
    anwesend: zeilen.filter((z) => z.status === "present").length,
    erfasst: zeilen.filter((z) => z.status !== null).length,
  };
}

/**
 * Was am Eintrag über den Stand steht.
 *
 * „noch nicht erfasst" und „niemand anwesend" bedeuten Verschiedenes: nichts
 * getan oder niemand da. Und `null` heißt, dass der Stand nicht gelesen werden
 * konnte — eine Null wäre dann eine Behauptung.
 */
export function standText(stand: Eincheckstand | null): string {
  if (stand === null) return "Stand unbekannt";
  if (stand.erwartet === 0) return "Niemand erwartet";
  if (stand.erfasst === 0) return "Noch nicht erfasst";
  return `${stand.anwesend} von ${stand.erwartet} anwesend`;
}

/**
 * Die Wiener Wanduhrzeit als „HH:MM:SS" — nicht die des Servers (auf Vercel UTC).
 *
 * Mit `hourCycle: "h23"` und zweistelligen Feldern, nicht mit `hour12: false`:
 * Letzteres liefert je nach ICU-Fassung um Mitternacht „24:00:00", und ein
 * Vergleich von Zeichenketten hielte den Kurs dann für längst vorbei. Die
 * Zweistelligkeit ist aus demselben Grund ausdrücklich verlangt — „8:00:00"
 * steht beim Vergleich hinter „19:00:00".
 */
const WIENER_UHR = new Intl.DateTimeFormat("de-AT", {
  timeZone: STUDIO_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function uhrzeitInWien(jetzt: Date = new Date()): string {
  return WIENER_UHR.format(jetzt);
}

/**
 * Läuft dieser Kurs gerade?
 *
 * Ohne hinterlegte Zeiten lautet die Antwort nein statt „vielleicht": Ein
 * Kennzeichen, das auch bei unbekannten Zeiten erscheint, sagt nichts mehr aus.
 */
export function laeuftJetzt(
  kurs: { startZeit: string | null; endZeit: string | null },
  jetzt: Date = new Date()
): boolean {
  if (!kurs.startZeit || !kurs.endZeit) return false;
  const jetztZeit = uhrzeitInWien(jetzt);
  return kurs.startZeit <= jetztZeit && jetztZeit <= kurs.endZeit;
}
