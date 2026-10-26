/**
 * Vorname und Nachname (PROJ-94).
 *
 * Bis dahin stand der Name in einem Feld. Beim Umzug und an der Tür muss ein
 * ganzer Name geteilt werden, und an vielen Stellen muss er wieder als Ganzes
 * erscheinen — beides gehört an eine Stelle, weil beides falsch sein kann.
 */

export type GeteilterName = { vorname: string; nachname: string };

/**
 * Einen ganzen Namen am **letzten** Leerzeichen teilen.
 *
 * „Anna Maria Müller" wird zu „Anna Maria" und „Müller": Zweit- und
 * Drittvornamen sind häufiger als mehrteilige Nachnamen. Bei „van der Berg"
 * trifft es nicht zu — das ist bewusst in Kauf genommen (Entscheidung des
 * Betreibers), weil jede klügere Regel an anderer Stelle falsch rät. Was
 * danebenliegt, korrigiert die Verwaltung von Hand.
 *
 * Ein einzelnes Wort wird der **Vorname**: So steht der Name dort, wo man ihn
 * zuerst liest, und niemand wird wegen eines fehlenden Nachnamens gesperrt.
 */
export function teileName(ganz: string | null | undefined): GeteilterName {
  const sauber = (ganz ?? "").replace(/\s+/g, " ").trim();
  if (sauber === "") return { vorname: "", nachname: "" };

  const letztes = sauber.lastIndexOf(" ");
  if (letztes === -1) return { vorname: sauber, nachname: "" };

  return {
    vorname: sauber.slice(0, letztes).trim(),
    nachname: sauber.slice(letztes + 1).trim(),
  };
}

/**
 * Die beiden Teile wieder zu einem Namen — dieselbe Regel wie im Trigger
 * `profiles_namen_zusammensetzen` in der Datenbank.
 *
 * Gibt `null` zurück, wenn beides leer ist: Ein leerer Name ist nichts, und
 * eine leere Zeichenkette in einer Liste sieht aus wie ein Fehler.
 */
export function zusammengesetzterName(
  vorname: string | null | undefined,
  nachname: string | null | undefined
): string | null {
  const ganz = [vorname ?? "", nachname ?? ""]
    .map((teil) => teil.trim())
    .filter((teil) => teil !== "")
    .join(" ");
  return ganz === "" ? null : ganz;
}
