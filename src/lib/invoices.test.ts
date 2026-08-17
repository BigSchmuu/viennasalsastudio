import { describe, it, expect } from "vitest";
import { computeInvoiceAmounts, toCsvField, toCsvRow } from "./invoices";

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
});

describe("toCsvRow", () => {
  it("joins fields with commas, quoting where necessary", () => {
    expect(toCsvRow(["2026-0001", "Muster, Anna", 45.0])).toBe('2026-0001,"Muster, Anna",45');
  });
});
