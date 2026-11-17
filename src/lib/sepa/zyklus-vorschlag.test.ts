import { describe, it, expect } from "vitest";
import { zyklusVorschlag, endeZu, luecke } from "./zyklus-vorschlag";

const KEINE_FERIEN: { von: string; bis: string }[] = [];

/** Die echte Weihnachtspause des Studios, zwei Wochen. */
const WEIHNACHTEN = [{ von: "2026-12-21", bis: "2027-01-03" }];

describe("PROJ-107: Der Vorschlag für den nächsten Zyklus", () => {
  it("rechnet vier Wochen, wenn nichts geschlossen ist", () => {
    expect(zyklusVorschlag("2026-11-29", KEINE_FERIEN, "2026-11-30")).toEqual({
      von: "2026-11-30",
      bis: "2026-12-27",
      ohneSchliesstage: "2026-12-27",
      schliesstage: 0,
    });
  });

  it("trifft den echten ersten Zyklus des Studios", () => {
    // Die Angabe des Betreibers: 30.11.2026 bis 10.01.2027, vier Kurswochen
    // plus zwei Wochen Weihnachtspause. Die Rechnung muss genau dort landen —
    // sonst schlägt das Formular etwas anderes vor als der Betrieb lebt.
    const vorschlag = zyklusVorschlag("2026-11-29", WEIHNACHTEN, "2026-11-30");
    expect(vorschlag.von).toBe("2026-11-30");
    expect(vorschlag.bis).toBe("2027-01-10");
    expect(vorschlag.ohneSchliesstage).toBe("2026-12-27");
    expect(vorschlag.schliesstage).toBe(14);
  });

  it("enthält immer 28 Tage ohne Schließung", () => {
    const vorschlag = zyklusVorschlag("2026-11-29", WEIHNACHTEN, "2026-11-30");
    const tage = Math.round(
      (Date.parse(`${vorschlag.bis}T00:00:00Z`) - Date.parse(`${vorschlag.von}T00:00:00Z`)) /
        86_400_000
    ) + 1;
    expect(tage).toBe(42);
    expect(tage - vorschlag.schliesstage).toBe(28);
  });

  it("schließt lückenlos an den Vorgänger an", () => {
    expect(zyklusVorschlag("2027-01-10", KEINE_FERIEN, "egal").von).toBe("2027-01-11");
  });

  it("nimmt den Fallback, wenn es noch keinen Zyklus gibt", () => {
    expect(zyklusVorschlag(null, KEINE_FERIEN, "2026-11-30").von).toBe("2026-11-30");
  });

  it("zählt nur Schließtage, die im Zeitraum liegen", () => {
    const danach = [{ von: "2027-03-01", bis: "2027-03-07" }];
    expect(zyklusVorschlag("2026-11-29", danach, "2026-11-30").schliesstage).toBe(0);
  });

  it("verlängert auch bei einer Schließung am Rand des Fensters", () => {
    // Die Schließung beginnt am letzten Tag der vier Wochen und schiebt das
    // Ende nach hinten — genau der Fall, für den die Rechnung nachzählt.
    const amRand = [{ von: "2026-12-27", bis: "2026-12-31" }];
    expect(zyklusVorschlag("2026-11-29", amRand, "2026-11-30").bis).toBe("2027-01-01");
  });
});

describe("PROJ-107: Die Lücke wird benannt, nicht verboten", () => {
  it("nennt null bei lückenlosem Anschluss", () => {
    expect(luecke("2026-11-29", "2026-11-30")).toBe(0);
  });

  it("zählt die Tage, die zu keinem Zyklus gehören", () => {
    expect(luecke("2026-11-29", "2026-12-03")).toBe(3);
  });

  it("nennt null, wenn es keinen Vorgänger gibt", () => {
    expect(luecke(null, "2026-11-30")).toBe(0);
  });
});

describe("PROJ-107: Das Ende folgt dem gewählten Beginn", () => {
  /**
   * Der Fall aus dem Betrieb, 2026-11-17: Das Formular schlug 17.11. bis
   * 14.12. vor (heute plus vier Wochen, weil noch kein Zyklus eingetragen
   * war). Wer den Beginn auf den 30.11. setzte, behielt den 14.12. als Ende —
   * ein Zeitraum, der weder vier Kurswochen lang war noch die Weihnachtspause
   * enthielt.
   */
  it("rechnet das Ende zum Beginn, den der Betreiber eintippt", () => {
    expect(endeZu("2026-11-30", WEIHNACHTEN)).toEqual({
      bis: "2027-01-10",
      ohneSchliesstage: "2026-12-27",
      schliesstage: 14,
    });
  });

  it("nennt null Schließtage, wo die Pause nicht hineinfällt", () => {
    // Genau der gemeldete Vorschlag: Zwischen 17.11. und 15.12. liegt die
    // Weihnachtspause nicht. Null Schließtage sind hier also richtig und
    // sagen nichts darüber, ob Ferien eingetragen sind.
    expect(endeZu("2026-11-17", WEIHNACHTEN)).toEqual({
      bis: "2026-12-14",
      ohneSchliesstage: "2026-12-14",
      schliesstage: 0,
    });
  });

  it("liefert dasselbe wie der Vorschlag für den Anschlusszyklus", () => {
    const vorschlag = zyklusVorschlag("2026-11-29", WEIHNACHTEN, "egal");
    const direkt = endeZu("2026-11-30", WEIHNACHTEN);
    expect({ bis: vorschlag.bis, schliesstage: vorschlag.schliesstage }).toEqual({
      bis: direkt.bis,
      schliesstage: direkt.schliesstage,
    });
  });
});
