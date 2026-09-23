import { describe, it, expect } from "vitest";
import { FAQ, faqFlach } from "./eintraege";

describe("PROJ-66: Die häufigen Fragen", () => {
  it("hat Gruppen, und jede Gruppe hat Einträge", () => {
    expect(FAQ.length).toBeGreaterThan(0);
    for (const gruppe of FAQ) {
      expect(gruppe.eintraege.length, gruppe.titel.de).toBeGreaterThan(0);
    }
  });

  it("ist überall zweisprachig — keine halbe Übersetzung", () => {
    // Der eigentliche Zweck dieser Datei: Eine vergessene englische Antwort
    // fiele sonst erst auf, wenn ein Gast vor dem deutschen Text steht.
    for (const gruppe of FAQ) {
      expect(gruppe.titel.de.trim(), "Gruppentitel deutsch").not.toBe("");
      expect(gruppe.titel.en.trim(), "Gruppentitel englisch").not.toBe("");
      for (const eintrag of gruppe.eintraege) {
        expect(eintrag.frage.de.trim(), `Frage deutsch: ${eintrag.frage.de}`).not.toBe("");
        expect(eintrag.frage.en.trim(), `Frage englisch zu: ${eintrag.frage.de}`).not.toBe("");
        expect(eintrag.antwort.de.trim(), `Antwort deutsch zu: ${eintrag.frage.de}`).not.toBe("");
        expect(eintrag.antwort.en.trim(), `Antwort englisch zu: ${eintrag.frage.de}`).not.toBe("");
      }
    }
  });

  it("übersetzt wirklich, statt den deutschen Satz zu wiederholen", () => {
    // Ein kopierter deutscher Satz im englischen Feld sieht im Code aus wie
    // eine Übersetzung und ist keine.
    for (const gruppe of FAQ) {
      for (const eintrag of gruppe.eintraege) {
        expect(eintrag.frage.en, `Frage unübersetzt: ${eintrag.frage.de}`).not.toBe(eintrag.frage.de);
        expect(eintrag.antwort.en, `Antwort unübersetzt zu: ${eintrag.frage.de}`).not.toBe(eintrag.antwort.de);
      }
    }
  });

  it("liefert beide Sprachen flach und gleich lang", () => {
    const deutsch = faqFlach("de");
    const englisch = faqFlach("en");
    const anzahl = FAQ.reduce((summe, gruppe) => summe + gruppe.eintraege.length, 0);
    expect(deutsch).toHaveLength(anzahl);
    expect(englisch).toHaveLength(anzahl);
  });

  it("stellt die Kontaktmöglichkeit in beiden Sprachen bereit", () => {
    // Die letzte Frage ist die wichtigste: Wer hier nichts findet, muss uns
    // erreichen können.
    for (const sprache of ["de", "en"] as const) {
      const text = faqFlach(sprache)
        .map((e) => e.antwort)
        .join(" ");
      expect(text, sprache).toContain("info@viennasalsastudio.at");
      expect(text, sprache).toContain("+43 678 7826067");
    }
  });
});
