import { describe, it, expect } from "vitest";
import { belegAnzahlText, zeitraumText } from "./zeitraum";

describe("PROJ-64: Zeitraum im Belegarchiv", () => {
  it("nennt Anfang und Ende", () => {
    expect(zeitraumText("2026-01-01", "2026-12-31")).toBe("01.01.2026 bis 31.12.2026");
  });

  it("nennt eine offene Seite als solche", () => {
    expect(zeitraumText("2026-03-01", undefined)).toBe("ab 01.03.2026");
    expect(zeitraumText(undefined, "2026-03-31")).toBe("bis 31.03.2026");
  });

  it("sagt „alle Belege“, wenn nichts eingegrenzt ist", () => {
    // Ein leeres Feld wäre in der abgelegten Datei nicht einzuordnen.
    expect(zeitraumText(undefined, undefined)).toBe("alle Belege");
    expect(zeitraumText("", "")).toBe("alle Belege");
  });
});

describe("PROJ-64: Anzahl der Belege", () => {
  it("beugt die Einzahl richtig", () => {
    expect(belegAnzahlText(1)).toBe("1 Beleg");
  });

  it("und die Mehrzahl", () => {
    expect(belegAnzahlText(0)).toBe("0 Belege");
    expect(belegAnzahlText(47)).toBe("47 Belege");
  });
});
