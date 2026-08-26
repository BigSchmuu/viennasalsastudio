import { describe, it, expect } from "vitest";
import { heuteInWien } from "./zeitzone";

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
