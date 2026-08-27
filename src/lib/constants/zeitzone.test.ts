import { describe, it, expect } from "vitest";
import { heuteInWien, heuteAlsDatumInWien } from "./zeitzone";

describe("heuteInWien", () => {
  it("liefert das Format JJJJ-MM-TT", () => {
    expect(heuteInWien()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("zählt um 00:30 Wiener Zeit bereits den neuen Tag — auch wenn der Server auf UTC steht", () => {
    // 26.08.2026 22:30 UTC ist in Wien der 27.08. um 00:30 (Sommerzeit).
    expect(heuteInWien(new Date("2026-08-26T22:30:00Z"))).toBe("2026-08-27");
  });

  it("zählt um 23:30 Wiener Zeit noch den laufenden Tag", () => {
    expect(heuteInWien(new Date("2026-08-26T21:30:00Z"))).toBe("2026-08-26");
  });

  it("rechnet im Winter mit einer Stunde Versatz statt zweien", () => {
    // 15.01.2026 23:30 UTC ist in Wien der 16.01. um 00:30 (Normalzeit).
    expect(heuteInWien(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-16");
    expect(heuteInWien(new Date("2026-01-15T22:30:00Z"))).toBe("2026-01-15");
  });
});

describe("heuteAlsDatumInWien", () => {
  it("liefert den Wochentag aus Wien, nicht den des Servers", () => {
    // 27.08.2026 22:30 UTC ist ein Donnerstag. In Wien ist es da bereits
    // Freitag, der 28.08., um 00:30. Genau hier lag der Fehler: der Tag kam
    // aus heuteInWien(), der Wochentag daneben aus new Date().getDay().
    const spaetabends = new Date("2026-08-27T22:30:00Z");
    expect(spaetabends.getUTCDay()).toBe(4); // Donnerstag laut Server
    expect(heuteAlsDatumInWien(spaetabends).getDay()).toBe(5); // Freitag in Wien
    expect(heuteInWien(spaetabends)).toBe("2026-08-28");
  });

  it("stimmt tagsüber mit dem Serverdatum überein", () => {
    const mittags = new Date("2026-08-27T12:00:00Z");
    expect(heuteAlsDatumInWien(mittags).getDay()).toBe(4);
    expect(heuteInWien(mittags)).toBe("2026-08-27");
  });

  it("liegt zur Mittagsstunde, damit keine Zeitumstellung den Tag verschiebt", () => {
    // 29.03.2026 ist der Umstellungstag auf Sommerzeit.
    const umstellungstag = heuteAlsDatumInWien(new Date("2026-03-29T10:00:00Z"));
    expect(umstellungstag.getHours()).toBe(12);
    expect(umstellungstag.getDate()).toBe(29);
  });
});
