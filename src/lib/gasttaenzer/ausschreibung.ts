import { erfuelltMindeststufe } from "./level";

/**
 * Wer darf eingeladen werden, und wer darf zusagen (PROJ-60).
 *
 * Bewusst ohne Datenbankbezug: Dieselben Regeln entscheiden über den
 * Empfängerkreis einer Einladung und über eine einzelne Zusage. Zwei Fassungen
 * davon würden irgendwann auseinanderlaufen — und dann bekäme jemand eine
 * Einladung, die er nicht annehmen kann.
 */

export type Tanzrolle = "leader" | "follower";
export type GastRolle = Tanzrolle | "both";

export type Ausschreibung = {
  plaetze: number;
  zusagen: number;
  rolle: Tanzrolle;
  mindeststufe: string | null;
  zurueckgezogenAm: string | null;
  /** Beginn des Kursabends, ISO. Bis dahin kann zugesagt werden. */
  kursBeginn: string;
};

export type Gast = {
  imProgramm: boolean;
  ausgeschlossen: boolean;
  rolle: GastRolle | null;
  level: string | null;
  /** Sitzt an diesem Abend ohnehin im Kurs — als Abo oder gebucht. */
  schonImKurs: boolean;
};

export type Hindernis =
  | "nicht_im_programm"
  | "ausgeschlossen"
  | "zurueckgezogen"
  | "begonnen"
  | "schon_dabei"
  | "rolle"
  | "level"
  | "keine_plaetze";

export function freiePlaetze(a: Pick<Ausschreibung, "plaetze" | "zusagen">): number {
  return Math.max(0, a.plaetze - a.zusagen);
}

/** Läuft die Ausschreibung überhaupt noch? */
export function laeuft(a: Pick<Ausschreibung, "zurueckgezogenAm" | "kursBeginn">, jetzt: Date): boolean {
  if (a.zurueckgezogenAm) return false;
  return new Date(a.kursBeginn) > jetzt;
}

/** Passt die Rolle? „Beides" passt immer. */
export function rollePasst(gast: GastRolle | null, gesucht: Tanzrolle): boolean {
  if (!gast) return false;
  return gast === "both" || gast === gesucht;
}

/**
 * Gehört dieser Mensch in den Empfängerkreis einer Einladung?
 *
 * Die Plätze spielen hier keine Rolle: Beim Ausschreiben sind alle frei.
 */
export function darfEingeladenWerden(a: Ausschreibung, g: Gast): boolean {
  if (!g.imProgramm || g.ausgeschlossen) return false;
  if (g.schonImKurs) return false;
  if (!rollePasst(g.rolle, a.rolle)) return false;
  return erfuelltMindeststufe(g.level, a.mindeststufe);
}

/**
 * Was einer Zusage im Weg steht — oder `null`, wenn nichts.
 *
 * Die Reihenfolge ist keine Willkür: Zuerst die Gründe, die diesen Menschen
 * gar nichts angehen („du bist nicht im Programm"), dann der Zustand der
 * Ausschreibung, zuletzt „die Plätze sind weg". Sonst bekäme jemand, der nie
 * in Frage kam, die freundliche Auskunft, er sei nur zu spät gewesen.
 */
export function zusageHindernis(a: Ausschreibung, g: Gast, jetzt: Date): Hindernis | null {
  if (!g.imProgramm) return "nicht_im_programm";
  if (g.ausgeschlossen) return "ausgeschlossen";
  if (g.schonImKurs) return "schon_dabei";
  if (!rollePasst(g.rolle, a.rolle)) return "rolle";
  if (!erfuelltMindeststufe(g.level, a.mindeststufe)) return "level";
  if (a.zurueckgezogenAm) return "zurueckgezogen";
  if (new Date(a.kursBeginn) <= jetzt) return "begonnen";
  if (freiePlaetze(a) === 0) return "keine_plaetze";
  return null;
}

/** Was der Zusagende zu lesen bekommt. */
export const HINDERNIS_TEXT: Record<Hindernis, string> = {
  nicht_im_programm: "Du bist nicht im Gasttänzer-Programm angemeldet.",
  ausgeschlossen: "Für dieses Programm bist du derzeit nicht freigeschaltet.",
  schon_dabei: "Du bist an diesem Abend ohnehin im Kurs.",
  rolle: "Gesucht wird eine andere Rolle.",
  level: "Für diesen Kurs wird ein höheres Level vorausgesetzt.",
  zurueckgezogen: "Die Ausschreibung wurde zurückgezogen.",
  begonnen: "Der Kurs hat bereits begonnen.",
  keine_plaetze: "Die Plätze sind leider schon vergeben.",
};
