/**
 * Weicht der Kontoinhaber vom Namen im Profil ab? (PROJ-7)
 *
 * Beim Lastschriftverfahren kann niemand prüfen, wem eine IBAN gehört — das
 * Mandat *ist* die Erklärung des Zahlers. Der Name auf dem Konto ist damit der
 * einzige Anhaltspunkt, den es überhaupt gibt.
 *
 * Eine Abweichung ist deshalb **kein Verdacht**: Eltern zahlen fürs Kind,
 * Partner teilen ein Konto. Sie ist nur der Anlass, einmal nachzufragen —
 * und die Antwort wird am Mandat festgehalten.
 *
 * Die Prüfung ist bewusst großzügig. Ein falsches „weicht ab" kostet eine
 * Rückfrage, ein falsches „stimmt überein" kostet eine Rückfrage weniger:
 * Beides ist verkraftbar, also gewinnt die einfache Regel.
 */
const UMLAUTE: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  ß: "ss",
  å: "a",
  ø: "o",
  æ: "ae",
};

/**
 * Auf eine Form bringen, in der „Müller" und „Mueller" dasselbe sind.
 *
 * Erst die Umlaute ausschreiben, dann die übrigen Akzente entfernen — die
 * Reihenfolge ist wichtig: Nach der Zerlegung in Grundbuchstaben wäre aus „ü"
 * ein „u" geworden und der Vergleich mit „ue" gescheitert.
 */
function vereinheitliche(name: string): string[] {
  const ausgeschrieben = name
    .toLowerCase()
    .replace(/[äöüßåøæ]/g, (z) => UMLAUTE[z] ?? z)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  return ausgeschrieben
    // Bindestriche, Punkte und Kommas trennen Namensteile, sie unterscheiden
    // sie nicht: „Anna-Lena" und „Anna Lena" sind dieselbe Person.
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    // Die Reihenfolge sagt nichts — auf Kontoauszügen steht oft der Nachname
    // zuerst.
    .sort();
}

export function nameWeichtAb(profilName: string | null, kontoinhaber: string): boolean {
  // Ohne hinterlegten Namen gibt es nichts zu vergleichen. Dann lieber nicht
  // fragen, als eine Rückfrage zu stellen, die niemand beantworten kann.
  if (!profilName?.trim()) return false;

  const links = vereinheitliche(profilName);
  const rechts = vereinheitliche(kontoinhaber);
  if (links.length === 0 || rechts.length === 0) return false;

  return links.join(" ") !== rechts.join(" ");
}
