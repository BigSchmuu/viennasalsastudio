import { describe, it, expect } from "vitest";
import { STUDIERENDEN_HOECHSTALTER, alterAm, alterText } from "./alter";

describe("alterAm", () => {
  it("zählt vollendete Lebensjahre", () => {
    expect(alterAm("1998-11-16", "2026-11-16")).toBe(28);
    expect(alterAm("1998-11-17", "2026-11-16")).toBe(27);
    expect(alterAm("1998-11-15", "2026-11-16")).toBe(28);
  });

  it("zählt am Geburtstag selbst das neue Jahr", () => {
    // Der 28. Geburtstag ist der Tag, an dem der Studierendenpreis endet.
    expect(alterAm("1999-03-01", "2027-02-28")).toBe(27);
    expect(alterAm("1999-03-01", "2027-03-01")).toBe(28);
  });

  it("kommt mit dem 29. Februar zurecht", () => {
    // Wer am 29.02. geboren ist, wird in Nicht-Schaltjahren am 1. März älter —
    // am 28.02. ist er es noch nicht.
    expect(alterAm("2000-02-29", "2028-02-28")).toBe(27);
    expect(alterAm("2000-02-29", "2028-02-29")).toBe(28);
    expect(alterAm("2000-02-29", "2027-02-28")).toBe(26);
    expect(alterAm("2000-02-29", "2027-03-01")).toBe(27);
  });

  it("gibt nichts her, wo nichts ist", () => {
    expect(alterAm(null, "2026-11-16")).toBeNull();
    expect(alterAm(undefined, "2026-11-16")).toBeNull();
    expect(alterAm("", "2026-11-16")).toBeNull();
    expect(alterAm("1998", "2026-11-16")).toBeNull();
    expect(alterAm("16.11.1998", "2026-11-16")).toBeNull();
    expect(alterAm("1998-13-01", "2026-11-16")).toBeNull();
  });
});

describe("alterText", () => {
  it("unterscheidet ein fehlendes Datum von null Jahren", () => {
    expect(alterText(null, "2026-11-16")).toBe("—");
    expect(alterText("2026-05-01", "2026-11-16")).toBe("0 Jahre");
    expect(alterText("2025-05-01", "2026-11-16")).toBe("1 Jahr");
    expect(alterText("1998-11-16", "2026-11-16")).toBe("28 Jahre");
  });
});

describe("Die Grenze", () => {
  it("steht an einer Stelle", () => {
    expect(STUDIERENDEN_HOECHSTALTER).toBe(27);
  });
});
