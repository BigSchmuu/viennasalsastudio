/**
 * Welcher Teil eines Titelbilds auf der Karte zu sehen ist (PROJ-63).
 *
 * Die Karte hat ein festes Querformat. Ein Bild, das schmäler ist als dieses
 * Fenster, füllt es in der Breite aus und ragt oben und unten hinaus — dort
 * lässt sich nur senkrecht schieben. Ein Bild, das breiter ist, ragt links und
 * rechts hinaus. Passt es genau, gibt es nichts zu schieben.
 *
 * Deshalb genügt **eine** Zahl: Die Richtung verrät das Seitenverhältnis, und
 * Breite und Höhe stehen seit PROJ-55 an jedem Bild.
 */

/** Das Seitenverhältnis der Karte in der Übersicht: 16:9. */
export const KARTE_VERHAELTNIS = 16 / 9;

/** Mittig — das Verhalten vor PROJ-63 und der Standard für jedes Bild. */
export const AUSSCHNITT_STANDARD = 50;

/**
 * Wie weit zwei Seitenverhältnisse auseinanderliegen dürfen und trotzdem als
 * gleich gelten.
 *
 * Ein Bild von 1600×901 ist rechnerisch nicht 16:9, aber es fehlt weniger als
 * ein Pixel Höhe. Ein Regler dafür wäre eine Einstellung ohne sichtbare
 * Wirkung — und genau solche Regler lassen Menschen an sich selbst zweifeln.
 */
const TOLERANZ = 0.01;

export type Ausschnittrichtung = "senkrecht" | "waagrecht" | "keine";

/** In welche Richtung sich ein Bild in diesem Fenster überhaupt schieben lässt. */
export function ausschnittrichtung(
  breite: number,
  hoehe: number,
  fenster: number = KARTE_VERHAELTNIS
): Ausschnittrichtung {
  if (!(breite > 0) || !(hoehe > 0) || !(fenster > 0)) return "keine";

  const bild = breite / hoehe;
  if (Math.abs(bild - fenster) / fenster < TOLERANZ) return "keine";
  return bild < fenster ? "senkrecht" : "waagrecht";
}

/**
 * Auf 0 bis 100 begrenzen und runden — was von außen kommt, ist ungeprüft.
 *
 * Nicht einfach `Number(wert)`: Das macht aus `null`, `""` und `[]` eine Null,
 * und die ist hier keine harmlose Null, sondern „ganz oben". Ein leeres Feld
 * würde den Ausschnitt also verstellen, statt ihn in Ruhe zu lassen.
 */
export function begrenzeAusschnitt(wert: unknown): number {
  const zahl =
    typeof wert === "number"
      ? wert
      : typeof wert === "string" && wert.trim() !== ""
        ? Number(wert)
        : Number.NaN;
  if (!Number.isFinite(zahl)) return AUSSCHNITT_STANDARD;
  return Math.min(100, Math.max(0, Math.round(zahl)));
}

/**
 * Die Angabe für das Bildelement: erst waagrecht, dann senkrecht.
 *
 * Die Achse, auf der nichts abgeschnitten wird, bleibt in der Mitte — dort
 * hätte jeder andere Wert ohnehin keine Wirkung.
 */
export function ausschnittPosition(wert: number, richtung: Ausschnittrichtung): string {
  const sicher = begrenzeAusschnitt(wert);
  if (richtung === "senkrecht") return `50% ${sicher}%`;
  if (richtung === "waagrecht") return `${sicher}% 50%`;
  return "50% 50%";
}

/** Die Beschriftung der beiden Reglerenden — je nach Richtung. */
export function ausschnittEnden(richtung: Ausschnittrichtung): { anfang: string; ende: string } | null {
  if (richtung === "senkrecht") return { anfang: "oben", ende: "unten" };
  if (richtung === "waagrecht") return { anfang: "links", ende: "rechts" };
  return null;
}
