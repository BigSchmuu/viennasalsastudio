import { describe, it, expect } from "vitest";
import { formatDate, formatDateTime, formatShortDate } from "./formatting";

/**
 * Der entscheidende Fall: ein Zeitpunkt, der in UTC und in Wien auf
 * verschiedene Kalendertage fällt. 02.09.2026 22:49 UTC ist in Wien der
 * 03.09. um 00:49. Vorher zeigte die Produktion (die auf UTC läuft) den
 * falschen Tag und die falsche Uhrzeit.
 */
const ueberMitternacht = "2026-09-02T22:49:00Z";

describe("Datumsanzeige rechnet in Wien, nicht in der Zeitzone des Servers", () => {
  it("formatDateTime nennt den Wiener Tag und die Wiener Uhrzeit", () => {
    expect(formatDateTime(ueberMitternacht, "de")).toContain("03.09.2026");
    expect(formatDateTime(ueberMitternacht, "de")).toContain("00:49");
  });

  it("formatDate ebenso", () => {
    expect(formatDate(ueberMitternacht, "de")).toBe("03.09.2026");
  });

  it("formatShortDate ebenso", () => {
    expect(formatShortDate(ueberMitternacht, "de")).toContain("03.09");
  });

  it("gilt auch für die englische Fassung", () => {
    expect(formatDate(ueberMitternacht, "en")).toBe("03/09/2026");
  });

  it("im Winter mit einer Stunde Versatz", () => {
    // 15.01.2026 23:30 UTC ist in Wien der 16.01. um 00:30.
    expect(formatDate("2026-01-15T23:30:00Z", "de")).toBe("16.01.2026");
  });
});
