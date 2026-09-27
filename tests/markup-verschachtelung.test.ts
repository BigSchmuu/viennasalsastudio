import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Kein Blockelement in einem Absatz.
 *
 * Steht ein `div` in einem `p`, schließt der Browser den Absatz davor — das
 * schreibt die HTML-Spezifikation so vor. Damit weicht der ausgelieferte Baum
 * von dem ab, den React verwaltet, und beim nächsten Umbau scheitert es mit
 * „Failed to execute 'removeChild' on 'Node'". Der Besucher sieht eine
 * Fehlerseite, und in Sentry steht eine Meldung, die nach einem Rätsel aussieht.
 *
 * Genau das kam am 2026-09-27 als Bericht herein. Vier Stellen in der
 * Verwaltung hatten das Muster; auf der gemeldeten Seite war es eine
 * Browsererweiterung. Damit die vier nicht wiederkommen — und keine fünfte
 * dazu —, prüft dieser Test den Quelltext.
 *
 * Bewusst eine Textsuche und keine echte HTML-Analyse: Sie versteht kein JSX,
 * findet aber genau das Muster, das weh tut, und kostet nichts. Erwähnt ein
 * Kommentar Tags in spitzen Klammern, meldet sie einen Fehlalarm — deshalb
 * stehen in den Kommentaren des Projekts „Blockelement" und „Absatz".
 */

const BLOCKELEMENTE = ["<div", "<ul", "<ol", "<table", "<section", "<Badge", "<Alert", "<Card"];

/** Elemente, in die kein Blockelement gehört, mit dem Muster für ihren Inhalt. */
const NUR_TEXT = [
  { tag: "p", regex: /<p\b[^>]*>((?:(?!<\/p>)[\s\S])*?)<\/p>/g },
  { tag: "span", regex: /<span\b[^>]*>((?:(?!<\/span>)[\s\S])*?)<\/span>/g },
  { tag: "label", regex: /<label\b[^>]*>((?:(?!<\/label>)[\s\S])*?)<\/label>/g },
];

function alleDateien(ordner: string, endung = ".tsx"): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(ordner)) {
    const pfad = join(ordner, eintrag);
    if (statSync(pfad).isDirectory()) gefunden.push(...alleDateien(pfad, endung));
    else if (pfad.endsWith(endung)) gefunden.push(pfad);
  }
  return gefunden;
}

describe("Markup: kein Blockelement in einem Absatz", () => {
  it("findet im ganzen Projekt keine solche Verschachtelung", () => {
    const fundstellen: string[] = [];

    for (const datei of alleDateien("src")) {
      const inhalt = readFileSync(datei, "utf8");
      for (const { tag, regex } of NUR_TEXT) {
        for (const treffer of inhalt.matchAll(regex)) {
          const drin = BLOCKELEMENTE.filter((b) => treffer[1].includes(b));
          if (drin.length > 0) {
            const zeile = inhalt.slice(0, treffer.index).split("\n").length;
            fundstellen.push(`${datei}:${zeile} — <${tag}> enthält ${drin.join(", ")}`);
          }
        }
      }
    }

    expect(fundstellen, `Blockelemente in Text-Elementen:\n${fundstellen.join("\n")}`).toEqual([]);
  });
});
