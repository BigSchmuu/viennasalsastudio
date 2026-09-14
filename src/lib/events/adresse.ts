/**
 * Lesbare Adressen für Eventseiten (PROJ-53).
 *
 * Aus „Salsa-Nacht für Anfänger" wird `salsa-nacht-fuer-anfaenger`. Die
 * Adresse wird geteilt — in WhatsApp, auf Instagram, auf Flyern — und soll
 * deshalb lesbar sein und sagen, worum es geht.
 *
 * Umlaute werden ausgeschrieben statt weggelassen: „fur" und „anfanger"
 * sähen nach Tippfehlern aus. Andere Akzente (Café) fallen auf den
 * Grundbuchstaben zurück.
 */

const UMLAUTE: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  Ä: "ae",
  Ö: "oe",
  Ü: "ue",
  ß: "ss",
};

/** Länger wird eine Adresse nicht — sie steht in Links und Vorschauen. */
const HOECHSTLAENGE = 80;

export function eventAdresse(name: string): string {
  const adresse = name
    .replace(/[äöüÄÖÜß]/g, (zeichen) => UMLAUTE[zeichen])
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, HOECHSTLAENGE)
    .replace(/-+$/, "");

  // Ein Name nur aus Sonderzeichen ergäbe eine leere Adresse — und damit eine
  // Eventseite unter `/events/`, also die Übersicht selbst.
  return adresse || "event";
}

/**
 * Hängt eine Zahl an, wenn die Adresse schon vergeben ist: zweimal
 * „Salsa Workshop" wird `salsa-workshop` und `salsa-workshop-2`.
 *
 * `vergeben` umfasst auch frühere Adressen umbenannter Events. Sonst bekäme
 * ein neues Event die alte Adresse eines anderen, und dessen geteilte Links
 * führten plötzlich auf das falsche Event.
 */
export function eindeutigeAdresse(basis: string, vergeben: ReadonlySet<string>): string {
  if (!vergeben.has(basis)) return basis;
  for (let nummer = 2; ; nummer++) {
    const kandidat = `${basis}-${nummer}`;
    if (!vergeben.has(kandidat)) return kandidat;
  }
}
