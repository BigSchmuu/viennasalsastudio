import { describe, it, expect } from "vitest";
import { eventTermin } from "./termin";

describe("eventTermin", () => {
  it("nennt ohne Ende nur Datum und Beginn", () => {
    const text = eventTermin("2026-10-03T19:00:00Z", null, "de");
    expect(text).toContain("03.10.2026");
    expect(text).toContain("21:00");
  });

  it("schreibt einen Abend am selben Tag als von–bis", () => {
    expect(eventTermin("2026-10-03T16:00:00Z", "2026-10-03T20:00:00Z", "de")).toMatch(/18:00–22:00$/);
  });

  it("zählt eine Party bis 2 Uhr früh als einen Abend", () => {
    expect(eventTermin("2026-10-03T19:00:00Z", "2026-10-04T00:00:00Z", "de")).toMatch(/21:00–02:00$/);
  });

  it("schreibt einen Workshop über mehrere Tage als Zeitraum", () => {
    const text = eventTermin("2026-10-03T08:00:00Z", "2026-10-04T16:00:00Z", "de");
    expect(text).toContain("03.10.2026");
    expect(text).toContain("04.10.2026");
    expect(text).toContain(" – ");
  });

  it("schreibt auf Englisch den Tag vor den Monat", () => {
    expect(eventTermin("2026-10-03T19:00:00Z", null, "en")).toContain("03/10/2026");
  });
});
