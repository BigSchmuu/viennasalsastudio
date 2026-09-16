/**
 * Die Rangfolge der Kurslevel (PROJ-60).
 *
 * Gebraucht für „mindestens eine Stufe über dem Kurs": Ein Gasttänzer soll
 * tragen, nicht selbst kämpfen.
 */

export const LEVEL_REIHE = ["beginner", "improver", "intermediate", "advanced"] as const;
export type Level = (typeof LEVEL_REIHE)[number];
/** `open_level` steht bewusst außerhalb der Reihe — es hat keinen Rang. */
export type Kurslevel = Level | "open_level";

export const LEVEL_NAME: Record<Kurslevel, string> = {
  beginner: "Beginner",
  improver: "Improver",
  intermediate: "Intermediate",
  advanced: "Advanced",
  open_level: "Open Level",
};

/** Der Rang eines Levels, oder `null` für alles ohne Rang. */
export function rang(level: string | null | undefined): number | null {
  const index = LEVEL_REIHE.indexOf(level as Level);
  return index === -1 ? null : index + 1;
}

/**
 * Die Vorbelegung für die Mindeststufe: eine Stufe über dem Kurs.
 *
 * Gibt `null` zurück, wo die Regel nicht greift — bei `open_level`, das keinen
 * Rang hat, und bei `advanced`, über dem nichts mehr kommt. Dann entscheidet
 * der Betreiber im Ausschreiben-Dialog, statt dass sich die App etwas ausdenkt.
 */
export function eineStufeUeber(kursLevel: string | null | undefined): Level | null {
  const r = rang(kursLevel);
  if (r === null) return null;
  return LEVEL_REIHE[r] ?? null;
}

/**
 * Reicht das Können eines Gasts für eine Ausschreibung?
 *
 * Ohne geforderte Mindeststufe reicht jedes Level — dann hat der Betreiber
 * bewusst keine gesetzt.
 */
export function erfuelltMindeststufe(gastLevel: string | null | undefined, mindest: string | null): boolean {
  if (!mindest) return true;
  const gast = rang(gastLevel);
  const schwelle = rang(mindest);
  if (schwelle === null) return true;
  if (gast === null) return false;
  return gast >= schwelle;
}
