import { heuteInWien } from "@/lib/constants/zeitzone";

// Weekday convention across the app: 0=Montag ... 6=Sonntag.
// JS Date.getDay() uses 0=Sonntag ... 6=Samstag, so it needs remapping.
export function jsDayToWeekday(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

// Formats using LOCAL date components (not toISOString, which converts to
// UTC first and silently shifts the date backward by a day in any
// UTC-ahead timezone, e.g. Europe/Vienna in summer).
export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Der Zeitraum, in dem ein Kurs überhaupt stattfindet (PROJ-51).
 *
 * Beide Seiten dürfen offen sein: `null` heißt „unbefristet" und verhält sich
 * wie vor PROJ-51.
 */
export type Kurszeitraum = { von: string | null; bis: string | null };

/** Ein studioweiter Ferienzeitraum — einschließlich beider Tage. */
export type Ferienzeitraum = { von: string; bis: string };

/**
 * Warum `zeitraum` und `ferien` Pflicht sind und nicht optional (PROJ-51).
 *
 * Diese beiden Funktionen beantworten an 14 Stellen im Projekt die Frage
 * „wann findet dieser Kurs statt?". Wären die Angaben optional, funktionierte
 * alles — bis eine Stelle sie vergisst. Dann rechnet sie still falsch, ohne
 * Fehlermeldung, und niemand merkt es, bis jemand anruft. Genau so sind bei
 * PROJ-50 drei Lesestellen durchgerutscht.
 *
 * Als Pflichtangabe listet der Compiler beim Umbau alle Aufrufer auf einmal
 * auf. Wer einen Kurs ohne Zeitraum hat, übergibt ausdrücklich
 * `{ von: null, bis: null }` — das ist eine Aussage, kein Versehen.
 */
function faelltAus(datum: string, pausen: Set<string>, ferien: Ferienzeitraum[]): boolean {
  if (pausen.has(datum)) return true;
  // Ferien und einzelne Ausfalltage sind zwei verschiedene Dinge, die
  // dieselbe Wirkung haben. Ein Termin fällt einmal aus, nicht zweimal.
  return ferien.some((f) => datum >= f.von && datum <= f.bis);
}

function imZeitraum(datum: string, zeitraum: Kurszeitraum): boolean {
  if (zeitraum.von && datum < zeitraum.von) return false;
  if (zeitraum.bis && datum > zeitraum.bis) return false;
  return true;
}

/**
 * Eine Schranke gegen die Endlosschleife.
 *
 * Sucht die Schleife nach `count` Terminen und liegt das Kursende schon
 * hinter uns, gäbe es ohne diese Grenze keinen Ausstieg. Zehn Jahre sind weit
 * jenseits allem, was ein Kurs je braucht.
 */
const MAX_WOCHEN = 520;

/** Next `count` upcoming dates (today or later) matching `weekday`, skipping pauses, holidays and anything outside the course period. */
export function upcomingOccurrences(
  weekday: number,
  {
    count,
    pauseDates = [],
    zeitraum,
    ferien,
    jetzt,
  }: {
    count: number;
    pauseDates?: string[];
    zeitraum: Kurszeitraum;
    ferien: Ferienzeitraum[];
    jetzt?: Date;
  }
): string[] {
  const pauseSet = new Set(pauseDates);
  // Der heutige Tag in Wien, als reiner Kalendertag. Vorher der Tag des
  // Servers — auf Vercel (UTC) nachts also der falsche.
  //
  // `jetzt` ist überschreibbar, damit Aufrufer, die selbst einen Zeitpunkt
  // führen, nicht daneben noch die echte Uhr befragen. Ohne das war die
  // Einsetzbarkeit in naechsteTermine() nur die halbe Wahrheit: gefiltert
  // wurde nach dem übergebenen Zeitpunkt, die Termine kamen aber vom
  // tatsächlichen Tag — was am selben Tag niemandem auffällt und am nächsten
  // die Tests umwirft.
  const today = new Date(heuteInWien(jetzt) + "T12:00:00Z");

  const todayWeekday = jsDayToWeekday(today.getDay());
  const daysUntilNext = (weekday - todayWeekday + 7) % 7;

  const first = new Date(today);
  first.setDate(today.getDate() + daysUntilNext);

  const dates: string[] = [];
  let cursor = first;
  for (let woche = 0; woche < MAX_WOCHEN && dates.length < count; woche++) {
    const dateString = formatDateLocal(cursor);
    // Hinter dem Kursende gibt es nichts mehr zu finden — weitersuchen wäre
    // vergeblich.
    if (zeitraum.bis && dateString > zeitraum.bis) break;
    if (imZeitraum(dateString, zeitraum) && !faelltAus(dateString, pauseSet, ferien)) {
      dates.push(dateString);
    }
    const next = new Date(cursor);
    next.setDate(cursor.getDate() + 7);
    cursor = next;
  }
  return dates;
}

/** Last `count` past dates (strictly before `before`, defaulting to today) matching `weekday`, skipping any date in `pauseDates`. Most recent first.
 *  Pass `before` (e.g. the oldest currently-loaded occurrence) to continue further into the past — used for "Mehr laden". */
export function pastOccurrences(
  weekday: number,
  {
    count,
    pauseDates = [],
    zeitraum,
    ferien,
    before,
  }: {
    count: number;
    pauseDates?: string[];
    zeitraum: Kurszeitraum;
    ferien: Ferienzeitraum[];
    before?: Date;
  }
): string[] {
  const pauseSet = new Set(pauseDates);
  const anchor = before ? new Date(before) : new Date();
  anchor.setHours(0, 0, 0, 0);

  const anchorWeekday = jsDayToWeekday(anchor.getDay());
  const daysSinceLast = (anchorWeekday - weekday + 7) % 7 || 7;

  const first = new Date(anchor);
  first.setDate(anchor.getDate() - daysSinceLast);

  const dates: string[] = [];
  let cursor = first;
  for (let woche = 0; woche < MAX_WOCHEN && dates.length < count; woche++) {
    const dateString = formatDateLocal(cursor);
    // Vor dem Kursbeginn gab es diesen Kurs nicht — eine Stunde, die nie
    // stattfand, kann auch keine fehlende Anwesenheit haben.
    if (zeitraum.von && dateString < zeitraum.von) break;
    if (imZeitraum(dateString, zeitraum) && !faelltAus(dateString, pauseSet, ferien)) {
      dates.push(dateString);
    }
    const prev = new Date(cursor);
    prev.setDate(cursor.getDate() - 7);
    cursor = prev;
  }
  return dates;
}

/**
 * Ganze Tage zwischen heute und `dateString` (negativ, wenn vergangen).
 *
 * „Heute" ist der Kalendertag in Wien, nicht der des Servers. Bei Vercel läuft
 * der auf UTC: Zwischen Mitternacht und 2 Uhr Wiener Zeit zählte die Rechnung
 * noch den Vortag, und ein Kunde konnte um 00:30 einen Kurs stornieren, der
 * nach seinem Kalender schon heute stattfindet.
 *
 * Beide Seiten werden als reine Kalendertage in UTC verglichen — nicht als
 * Zeitpunkte. So kann keine Sommerzeitumstellung dazwischenkommen.
 */
export function daysUntil(dateString: string): number {
  const heute = new Date(heuteInWien() + "T00:00:00Z");
  const ziel = new Date(dateString.slice(0, 10) + "T00:00:00Z");
  return Math.round((ziel.getTime() - heute.getTime()) / (1000 * 60 * 60 * 24));
}

/** Minutes Europe/Vienna is ahead of UTC at the given instant (handles CET/CEST). */
function viennaOffsetMinutes(instant: Date): number {
  const utc = new Date(instant.toLocaleString("en-US", { timeZone: "UTC" }));
  const vienna = new Date(instant.toLocaleString("en-US", { timeZone: "Europe/Vienna" }));
  return (vienna.getTime() - utc.getTime()) / 60000;
}

/** Converts a course_schedule `start_time`/`end_time` (Vienna wall-clock, e.g. "18:00:00")
 *  on a given date into the correct UTC instant — course times are entered and displayed
 *  as Vienna local time everywhere in the app, not UTC. */
export function viennaWallClockToDate(dateString: string, timeString: string): Date {
  const naiveUtc = new Date(`${dateString}T${timeString.slice(0, 5)}:00Z`);
  const offsetMinutes = viennaOffsetMinutes(naiveUtc);
  return new Date(naiveUtc.getTime() - offsetMinutes * 60000);
}

/** Self-check-in window for a course occurrence: opens 30 minutes before the
 *  Vienna-local start time, closes (for undo purposes) at the Vienna-local end time. */
export function selfCheckinWindow(
  occurrenceDate: string,
  startTime: string,
  endTime: string
): { opensAt: Date; endsAt: Date } {
  const start = viennaWallClockToDate(occurrenceDate, startTime);
  const endsAt = viennaWallClockToDate(occurrenceDate, endTime);
  const opensAt = new Date(start.getTime() - 30 * 60000);
  return { opensAt, endsAt };
}
