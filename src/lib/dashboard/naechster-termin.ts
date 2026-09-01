import { upcomingOccurrences, viennaWallClockToDate } from "@/lib/scheduling/dates";

/**
 * Welcher Kurstermin steht als Nächstes an?
 *
 * Die Frage klingt einfach und ist es nicht. Ein Kunde kann mehrere Abos
 * haben, dazu einzeln gebuchte Probestunden und Drop-ins. Termine fallen in
 * Pausen. Und ein Kurs, der heute schon vorbei ist, ist nicht der nächste —
 * wohl aber einer, der gerade läuft.
 *
 * Deshalb steht diese Logik hier und nicht in der Seite: sie ist die einzige
 * Stelle im Dashboard, die sich still verrechnen kann, ohne dass es jemandem
 * auffällt.
 */

export type Terminquelle = "abo" | "buchung";

export type Kurstermin = {
  kursId: string;
  kursName: string;
  datum: string;
  startZeit: string;
  endZeit: string;
  raum: string | null;
  standort: string | null;
  quelle: Terminquelle;
  /** Beginn als absoluter Zeitpunkt — Wiener Wandzeit korrekt umgerechnet. */
  beginn: Date;
  ende: Date;
};

export type AboEingabe = {
  kursId: string;
  kursName: string;
  wochentag: number;
  startZeit: string;
  endZeit: string;
  raum: string | null;
  standort: string | null;
  pausenTage: string[];
};

export type BuchungEingabe = {
  kursId: string;
  kursName: string;
  datum: string;
  startZeit: string;
  endZeit: string;
  raum: string | null;
  standort: string | null;
};

function bilde(
  kursId: string,
  kursName: string,
  datum: string,
  startZeit: string,
  endZeit: string,
  raum: string | null,
  standort: string | null,
  quelle: Terminquelle
): Kurstermin {
  return {
    kursId,
    kursName,
    datum,
    startZeit,
    endZeit,
    raum,
    standort,
    quelle,
    beginn: viennaWallClockToDate(datum, startZeit),
    ende: viennaWallClockToDate(datum, endZeit),
  };
}

/**
 * Alle in Frage kommenden Termine, aufsteigend nach Beginn.
 *
 * `jetzt` ist überschreibbar, damit sich das Verhalten an Tagesgrenzen prüfen
 * lässt, ohne die Systemuhr zu verstellen.
 */
export function sammleTermine(
  abos: AboEingabe[],
  buchungen: BuchungEingabe[],
  jetzt: Date = new Date()
): Kurstermin[] {
  const termine: Kurstermin[] = [];

  for (const abo of abos) {
    // Zwei statt einem: der erste kann heute sein und bereits vorbei —
    // dann ist der übernächste der richtige.
    for (const datum of upcomingOccurrences(abo.wochentag, {
      count: 2,
      pauseDates: abo.pausenTage,
      jetzt,
    })) {
      termine.push(
        bilde(abo.kursId, abo.kursName, datum, abo.startZeit, abo.endZeit, abo.raum, abo.standort, "abo")
      );
    }
  }

  for (const buchung of buchungen) {
    termine.push(
      bilde(
        buchung.kursId,
        buchung.kursName,
        buchung.datum,
        buchung.startZeit,
        buchung.endZeit,
        buchung.raum,
        buchung.standort,
        "buchung"
      )
    );
  }

  // Ein Kurs, der gerade läuft, zählt noch. Erst wenn er vorbei ist, fällt er raus.
  const laufendOderKuenftig = termine.filter((t) => t.ende.getTime() > jetzt.getTime());

  // Ein Kunde kann für denselben Kurstag ein Abo *und* eine Buchung haben —
  // etwa wenn er eine Probestunde nimmt, wo er ohnehin eingeschrieben ist.
  // Der Termin ist trotzdem nur einer. Das Abo gewinnt, weil daran der
  // Check-in hängt.
  const eindeutig = new Map<string, Kurstermin>();
  for (const t of laufendOderKuenftig) {
    const schluessel = `${t.kursId}|${t.datum}`;
    const vorhanden = eindeutig.get(schluessel);
    if (!vorhanden || (vorhanden.quelle === "buchung" && t.quelle === "abo")) {
      eindeutig.set(schluessel, t);
    }
  }

  return [...eindeutig.values()].sort((a, b) => a.beginn.getTime() - b.beginn.getTime());
}

export type TerminUebersicht = {
  /** Die frühesten Termine. Mehrere nur, wenn sie exakt gleichzeitig beginnen. */
  naechste: Kurstermin[];
  /** Der erste Termin danach, für die Zeile „Danach: …". */
  danach: Kurstermin | null;
};

export function naechsteTermine(
  abos: AboEingabe[],
  buchungen: BuchungEingabe[],
  jetzt: Date = new Date()
): TerminUebersicht {
  const alle = sammleTermine(abos, buchungen, jetzt);
  if (alle.length === 0) {
    return { naechste: [], danach: null };
  }

  const fruehester = alle[0].beginn.getTime();
  const naechste = alle.filter((t) => t.beginn.getTime() === fruehester);
  const danach = alle.find((t) => t.beginn.getTime() > fruehester) ?? null;

  return { naechste, danach };
}
