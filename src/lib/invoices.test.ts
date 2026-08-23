import { describe, it, expect } from "vitest";
import { computeInvoiceAmounts, toCsvField, toCsvRow, monthRange, monthFromRange, monthLabel, recentMonths } from "./invoices";

describe("computeInvoiceAmounts", () => {
  it("splits a gross amount into net + VAT at 20%", () => {
    const { netAmount, vatAmount, grossAmount } = computeInvoiceAmounts(45, 20);
    expect(grossAmount).toBe(45);
    expect(netAmount).toBe(37.5);
    expect(vatAmount).toBe(7.5);
    expect(Math.round((netAmount + vatAmount) * 100) / 100).toBe(45);
  });

  it("returns the full amount as net when the VAT rate is 0", () => {
    const { netAmount, vatAmount } = computeInvoiceAmounts(45, 0);
    expect(netAmount).toBe(45);
    expect(vatAmount).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    const { netAmount, vatAmount } = computeInvoiceAmounts(10, 13);
    expect(netAmount).toBeCloseTo(8.85, 2);
    expect(vatAmount).toBeCloseTo(1.15, 2);
  });
});

describe("toCsvField", () => {
  it("returns a plain field unquoted", () => {
    expect(toCsvField("2026-0001")).toBe("2026-0001");
  });

  it("quotes and escapes a field containing a comma", () => {
    expect(toCsvField("Muster, Anna")).toBe('"Muster, Anna"');
  });

  it("quotes and escapes internal double quotes", () => {
    expect(toCsvField('Say "hi"')).toBe('"Say ""hi"""');
  });

  it("neutralizes a leading = to prevent formula injection (CWE-1236)", () => {
    expect(toCsvField("=1+1")).toBe("'=1+1");
  });

  it("neutralizes a leading formula-triggering =HYPERLINK payload", () => {
    expect(toCsvField('=HYPERLINK("http://evil.example","click")')).toBe(
      '"\'=HYPERLINK(""http://evil.example"",""click"")"'
    );
  });

  it("neutralizes leading +, -, and @ as well", () => {
    expect(toCsvField("+1+1")).toBe("'+1+1");
    expect(toCsvField("-1+1")).toBe("'-1+1");
    expect(toCsvField("@SUM(1,1)")).toBe('"\'@SUM(1,1)"');
  });

  it("does not touch an invoice number that happens to contain a dash mid-string", () => {
    expect(toCsvField("2026-0001")).toBe("2026-0001");
  });
});

describe("toCsvRow", () => {
  it("joins fields with commas, quoting where necessary", () => {
    expect(toCsvRow(["2026-0001", "Muster, Anna", 45.0])).toBe('2026-0001,"Muster, Anna",45');
  });
});

describe("Monatsauswahl für den Export (PROJ-36)", () => {
  it("spannt einen Monat vom ersten bis zum letzten Tag auf", () => {
    expect(monthRange("2026-08")).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(monthRange("2026-04")).toEqual({ from: "2026-04-01", to: "2026-04-30" });
  });

  // Februar ist der Fall, den man von Hand falsch macht.
  it("kennt die Länge des Februars, auch im Schaltjahr", () => {
    expect(monthRange("2026-02")?.to).toBe("2026-02-28");
    expect(monthRange("2028-02")?.to).toBe("2028-02-29");
  });

  it("weist unsinnige Eingaben ab, statt ein falsches Datum zu erfinden", () => {
    expect(monthRange("2026-13")).toBeNull();
    expect(monthRange("2026-00")).toBeNull();
    expect(monthRange("August 2026")).toBeNull();
    expect(monthRange("")).toBeNull();
  });

  it("erkennt einen vollständigen Monat in einem Von/Bis-Paar wieder", () => {
    expect(monthFromRange("2026-08-01", "2026-08-31")).toBe("2026-08");
    expect(monthFromRange("2028-02-01", "2028-02-29")).toBe("2028-02");
  });

  // Wichtiger als der Positivfall: Ein handgesetzter Zeitraum darf nicht als
  // Monat durchgehen, sonst behauptet die Auswahl etwas Falsches.
  it("behandelt angebrochene oder übergreifende Zeiträume als eigenen Zeitraum", () => {
    expect(monthFromRange("2026-08-01", "2026-08-30")).toBeNull();
    expect(monthFromRange("2026-08-02", "2026-08-31")).toBeNull();
    expect(monthFromRange("2026-08-01", "2026-09-30")).toBeNull();
    expect(monthFromRange("", "")).toBeNull();
  });

  it("beschriftet Monate auf Deutsch", () => {
    expect(monthLabel("2026-08")).toBe("August 2026");
    expect(monthLabel("2026-03")).toBe("März 2026");
  });

  it("listet den aktuellen Monat zuerst und zählt rückwärts über den Jahreswechsel", () => {
    const months = recentMonths(3, new Date(2026, 0, 15)); // Januar 2026
    expect(months.map((m) => m.value)).toEqual(["2026-01", "2025-12", "2025-11"]);
    expect(months[0].label).toBe("Januar 2026");
  });
});
