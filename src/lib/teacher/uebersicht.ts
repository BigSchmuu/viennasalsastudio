import {
  upcomingOccurrences,
  pastOccurrences,
  type Ferienzeitraum,
  type Kurszeitraum,
} from "@/lib/scheduling/dates";
import { isBirthdayWithinDays } from "@/lib/birthdays";
import { heuteInWien } from "@/lib/constants/zeitzone";

/**
 * Die Rechenarbeit hinter dem Lehrer-Bereich (PROJ-49).
 *
 * Bewusst ohne Datenbankzugriff: Was hier steht, lässt sich mit erfundenen
 * Werten prüfen, ohne einen Kurs anzulegen. Die Seite holt die Daten und
 * reicht sie herein.
 */

/** Wie weit der Bereich nach vorn schaut. */
export const FENSTER_TAGE = 7;
/** Wie weit er beim Anmahnen fehlender Anwesenheit zurückschaut. */
export const RUECKBLICK_TERMINE = 4;

export type KursEingabe = {
  id: string;
  name: string;
  ort: string | null;
  /** 0 = Montag … 6 = Sonntag (Zählweise des Projekts, siehe constants/weekdays);
   *  null, wenn kein Wochentermin hinterlegt ist. */
  weekday: number | null;
  startZeit: string | null;
  endZeit: string | null;
  pausen: string[];
  /** PROJ-51: Außerhalb davon findet der Kurs nicht statt. */
  zeitraum: Kurszeitraum;
  hatVideosatz: boolean;
  fragtRolleAb: boolean;
};

export type Termin = {
  kursId: string;
  kursName: string;
  ort: string | null;
  datum: string;
  startZeit: string | null;
  endZeit: string | null;
  hatVideosatz: boolean;
  /** Nur gesetzt, wenn der Kurs die Tanzrolle abfragt. */
  rollen: { leader: number; follower: number; beides: number } | null;
  /** Die jüngste Notiz des Kurses — nur beim jeweils nächsten Termin. */
  letzteNotiz: string | null;
};

export type OffenerTermin = { kursId: string; kursName: string; datum: string };

/**
 * Die Termine der nächsten sieben Tage, über alle Kurse hinweg sortiert.
 *
 * Ein Kurs läuft wöchentlich, taucht hier also höchstens einmal auf. Zwei
 * Termine werden trotzdem berechnet: Fällt der nächste aus, rückt der
 * übernächste nach — und liegt dann meist außerhalb des Fensters, wird also
 * korrekt verworfen.
 */
export function naechsteTermine(
  kurse: KursEingabe[],
  heute: string,
  ferien: Ferienzeitraum[],
  jetzt?: Date
): Omit<Termin, "rollen" | "letzteNotiz">[] {
  const grenze = tagePlus(heute, FENSTER_TAGE);

  const termine = kurse.flatMap((kurs) => {
    if (kurs.weekday === null) return [];
    return upcomingOccurrences(kurs.weekday, {
      count: 2,
      pauseDates: kurs.pausen,
      zeitraum: kurs.zeitraum,
      ferien,
      jetzt,
    })
      .filter((datum) => datum <= grenze)
      .map((datum) => ({
        kursId: kurs.id,
        kursName: kurs.name,
        ort: kurs.ort,
        datum,
        startZeit: kurs.startZeit,
        endZeit: kurs.endZeit,
        hatVideosatz: kurs.hatVideosatz,
      }));
  });

  return termine.sort(
    (a, b) => a.datum.localeCompare(b.datum) || (a.startZeit ?? "").localeCompare(b.startZeit ?? "")
  );
}

/**
 * Vergangene Termine ohne erfasste Anwesenheit, jüngster zuerst.
 *
 * `erfasst` enthält die Termine, zu denen es Anwesenheitseinträge gibt.
 * Ausgefallene Stunden stehen gar nicht erst zur Debatte — `pastOccurrences`
 * lässt sie aus. Eine Stunde, die nicht stattgefunden hat, kann keine
 * Anwesenheit haben.
 *
 * Ein **ausgelaufener** Kurs steht ebenfalls nicht mehr hier (PROJ-51). Das
 * ist eine bewusste Abwägung: Seine letzten Stunden haben stattgefunden, und
 * fehlt dort die Anwesenheit, fehlt sie wirklich. Aber sonst bliebe eine Liste
 * stehen, die niemand mehr abarbeiten kann — der Kurs ist vorbei, die
 * Erinnerung daran nie. Nachtragen geht weiter über die Kursseite.
 */
export function fehlendeAnwesenheit(
  kurse: KursEingabe[],
  erfasst: Set<string>,
  ferien: Ferienzeitraum[],
  before?: Date
): OffenerTermin[] {
  const heute = heuteInWien(before);
  const offen = kurse.flatMap((kurs) => {
    if (kurs.weekday === null) return [];
    if (kurs.zeitraum.bis && kurs.zeitraum.bis < heute) return [];
    return pastOccurrences(kurs.weekday, {
      count: RUECKBLICK_TERMINE,
      pauseDates: kurs.pausen,
      zeitraum: kurs.zeitraum,
      ferien,
      before,
    })
      .filter((datum) => !erfasst.has(`${kurs.id}|${datum}`))
      .map((datum) => ({ kursId: kurs.id, kursName: kurs.name, datum }));
  });

  // Jüngster zuerst: Die letzte Stunde nachzutragen ist am dringendsten und am
  // ehesten noch erinnerlich.
  return offen.sort((a, b) => b.datum.localeCompare(a.datum));
}

export type GeburtstagEingabe = { id: string; name: string; geburtsdatum: string | null };
export type Geburtstag = { id: string; name: string; datum: string };

/**
 * Schüler mit Geburtstag im Fenster.
 *
 * Ohne Altersangabe — dieselbe Zurückhaltung wie in PROJ-31. Wer kein
 * Geburtsdatum hinterlegt hat, erscheint nicht; das ist kein Fehler.
 */
export function geburtstage(schueler: GeburtstagEingabe[], von: Date): Geburtstag[] {
  return schueler
    .filter((s): s is GeburtstagEingabe & { geburtsdatum: string } => !!s.geburtsdatum)
    .filter((s) => isBirthdayWithinDays(s.geburtsdatum, von, FENSTER_TAGE))
    .map((s) => ({ id: s.id, name: s.name, datum: s.geburtsdatum }))
    .sort((a, b) => tagBisGeburtstag(a.datum, von) - tagBisGeburtstag(b.datum, von));
}

/** Verteilung der Tanzrollen unter den bestätigten Teilnehmern eines Kurses. */
export function rollenVerteilung(rollen: (string | null)[]): {
  leader: number;
  follower: number;
  beides: number;
} {
  return {
    leader: rollen.filter((r) => r === "leader").length,
    follower: rollen.filter((r) => r === "follower").length,
    beides: rollen.filter((r) => r === "both").length,
  };
}

/** `2026-09-09` plus n Tage, wieder als Kalendertag. */
function tagePlus(datum: string, tage: number): string {
  const d = new Date(datum + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

/** Tage bis zum nächsten Geburtstag — nur zum Sortieren. */
function tagBisGeburtstag(geburtsdatum: string, von: Date): number {
  const [, monat, tag] = geburtsdatum.split("-").map(Number);
  const jahr = von.getUTCFullYear();
  let naechster = Date.UTC(jahr, monat - 1, tag);
  const heute = Date.UTC(von.getUTCFullYear(), von.getUTCMonth(), von.getUTCDate());
  if (naechster < heute) naechster = Date.UTC(jahr + 1, monat - 1, tag);
  return Math.round((naechster - heute) / 86400000);
}
