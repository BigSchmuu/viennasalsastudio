import { describe, it, expect } from "vitest";
import { beitragOffenOhneMandat, ohneMandatText } from "./ohne-mandat";

describe("PROJ-105: Wer in die Liste gehört", () => {
  it("nimmt ein fälliges Abo auf, dessen Mandat widerrufen wurde", () => {
    expect(beitragOffenOhneMandat(false, true, null)).toBe(true);
  });

  it("lässt den echten Barzahler draußen — er hatte nie ein Mandat", () => {
    // Ohne diese Trennlinie stünde bei jedem Lauf jeder Barzahler in der
    // Liste, und sie gäbe nichts zu beurteilen. Genau deshalb waren sie in
    // PROJ-103 bewusst ausgeschlossen.
    expect(beitragOffenOhneMandat(false, false, null)).toBe(false);
  });

  it("lässt ein Abo mit gültigem Mandat draußen", () => {
    // Das kommt in den Lauf oder unter die ausgelassenen Abos.
    expect(beitragOffenOhneMandat(true, true, null)).toBe(false);
  });

  it("nimmt ein Abo ohne Preis auf, damit es nicht in gar keiner Liste steht", () => {
    expect(beitragOffenOhneMandat(false, true, { art: "kein_preis" })).toBe(true);
  });

  it("lässt ein Abo draußen, dessen Zyklus schon eingezogen wurde", () => {
    expect(
      beitragOffenOhneMandat(false, true, {
        art: "zyklus_eingezogen",
        am: "2026-11-30",
        zyklusBis: "2027-01-10",
      })
    ).toBe(false);
  });

  it("lässt ein beendetes oder pausiertes Abo draußen", () => {
    expect(
      beitragOffenOhneMandat(false, true, {
        art: "aenderung_wirkt",
        was: "cancelled",
        ab: "2026-12-01",
      })
    ).toBe(false);
  });

  it("lässt ein Abo draußen, das erst später beginnt", () => {
    expect(
      beitragOffenOhneMandat(false, true, { art: "beginnt_spaeter", beginn: "2027-01-05" })
    ).toBe(false);
  });
});

describe("PROJ-105: Der Satz zur Zeile", () => {
  it("nennt den letzten Einzug und die Frist", () => {
    const text = ohneMandatText("2026-10-18", "2026-12-16");
    expect(text).toContain("Letzter Einzug am 18.10.2026");
    expect(text).toContain("Mandat ist widerrufen");
    expect(text).toContain("Ab dem 16.12.2026 wird ohnehin nicht mehr eingezogen");
  });

  it("formuliert die Frist neutral — eine Pause ist kein Ende", () => {
    // Ein Satz, der nur für die Kündigung stimmt, wäre bei einer Pause eine
    // Falschaussage über Geld.
    expect(ohneMandatText("2026-10-18", "2026-12-16")).not.toContain("endet");
  });

  it("sagt es, wenn noch nie eingezogen wurde", () => {
    expect(ohneMandatText(null, null)).toContain("noch nie eingezogen");
  });

  it("lässt die Frist weg, wenn keine Änderung vorliegt", () => {
    const text = ohneMandatText("2026-10-18", null);
    expect(text).not.toContain("Ab dem");
  });
});
