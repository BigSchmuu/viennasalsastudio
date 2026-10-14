import { describe, it, expect } from "vitest";
import { sollTage, spaetester, BARZAHLUNG_STICHTAG } from "./soll-nachtragen";

const KEINE_FERIEN: never[] = [];

describe("sollTage", () => {
  it("beginnt beim Zyklusbeginn, wenn der nach dem Stichtag liegt", () => {
    // Ein neues Abo: Der erste Beitrag wartet auf nichts.
    const tage = sollTage("2026-10-20", "2026-10-20", "2026-10-20", KEINE_FERIEN);
    expect(tage).toEqual(["2026-10-20"]);
  });

  it("zählt in Vier-Wochen-Schritten", () => {
    const tage = sollTage("2026-10-20", "2026-12-20", "2026-10-20", KEINE_FERIEN);
    expect(tage).toEqual(["2026-10-20", "2026-11-17", "2026-12-15"]);
  });

  it("lässt alles vor dem Stichtag weg, behält aber den Rhythmus", () => {
    // Abo seit März, Stichtag Mitte Oktober: Die Tage davor sind abgerechnet,
    // und der erste gezählte Tag ist der des Kunden — nicht der Stichtag.
    const tage = sollTage("2026-03-03", "2026-11-30", BARZAHLUNG_STICHTAG, KEINE_FERIEN);
    expect(tage.every((t) => t >= BARZAHLUNG_STICHTAG)).toBe(true);
    expect(tage[0]).toBe("2026-11-10");
  });

  it("gibt nichts aus, solange der erste Fälligkeitstag nach dem Stichtag noch aussteht", () => {
    // Genau der Fall am Tag der Freigabe: Die App beginnt bei null.
    const tage = sollTage("2026-03-03", "2026-10-15", "2026-10-15", KEINE_FERIEN);
    expect(tage).toEqual([]);
  });

  it("verschiebt die Fälligkeit um Ferientage nach hinten", () => {
    // Eine Woche geschlossen zwischen zwei Fälligkeiten: Der nächste Beitrag
    // kommt eine Woche später, wie beim Lastschriftlauf (PROJ-70).
    const ferien = [{ von: "2026-10-26", bis: "2026-11-01" }];
    const tage = sollTage("2026-10-20", "2026-12-31", "2026-10-20", ferien);
    expect(tage[1]).toBe("2026-11-24");
  });

  it("hört am Kündigungstag auf", () => {
    const tage = sollTage("2026-10-20", "2026-11-17", "2026-10-20", KEINE_FERIEN);
    expect(tage).toEqual(["2026-10-20", "2026-11-17"]);
    const vorher = sollTage("2026-10-20", "2026-11-16", "2026-10-20", KEINE_FERIEN);
    expect(vorher).toEqual(["2026-10-20"]);
  });

  it("kommt auch bei einem jahrealten Abo bis heute", () => {
    // Die Schleife läuft vom Zyklusbeginn an; bricht sie zu früh ab, fehlen
    // genau die Zeilen der letzten Wochen — also die, auf die es ankommt.
    const tage = sollTage("2019-01-07", "2026-10-31", "2026-10-01", KEINE_FERIEN);
    expect(tage.length).toBeGreaterThan(0);
    expect(tage.at(-1)!).toMatch(/^2026-10-/);
  });
});

describe("spaetester", () => {
  it("nimmt den spätesten Tag", () => {
    expect(spaetester("2026-10-15", "2026-03-03")).toBe("2026-10-15");
  });

  it("übergeht leere Angaben", () => {
    // Wer nie ein Mandat hatte, hat keinen Widerrufstag — das darf den
    // Stichtag nicht verdrängen.
    expect(spaetester("2026-10-15", undefined, null)).toBe("2026-10-15");
  });
});
