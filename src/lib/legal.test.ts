import { describe, it, expect } from "vitest";
import { AGB_VERSION, formatAgbVersion } from "./legal";

describe("formatAgbVersion", () => {
  it("renders the maintained version as a readable date", () => {
    expect(formatAgbVersion("2026-08")).toBe("August 2026");
    expect(formatAgbVersion("2027-01")).toBe("Januar 2027");
    expect(formatAgbVersion("2027-12")).toBe("Dezember 2027");
  });

  it("falls back to the raw value rather than inventing a month", () => {
    // Ein unlesbarer Stand ist besser als ein erfundener: der Wert ist ein
    // Nachweis, kein Anzeigetext.
    expect(formatAgbVersion("kaputt")).toBe("kaputt");
    expect(formatAgbVersion("2026-13")).toBe("2026-13");
  });

  it("uses the current version by default", () => {
    expect(formatAgbVersion()).toBe(formatAgbVersion(AGB_VERSION));
  });

  it("keeps the version in the sortable form that gets stored", () => {
    expect(AGB_VERSION).toMatch(/^\d{4}-\d{2}$/);
  });
});
