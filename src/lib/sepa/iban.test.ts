import { describe, it, expect } from "vitest";
import { validateIban, normalizeIban, maskIban } from "./iban";

describe("validateIban", () => {
  it("accepts a valid German IBAN with spaces", () => {
    const result = validateIban("DE89 3704 0044 0532 0130 00");
    expect(result.valid).toBe(true);
  });

  it("accepts a valid Austrian IBAN", () => {
    const result = validateIban("AT611904300234573201");
    expect(result.valid).toBe(true);
  });

  it("accepts the studio's real creditor IBAN", () => {
    const result = validateIban("AT552011185222099900");
    expect(result.valid).toBe(true);
  });

  it("rejects a wrong checksum", () => {
    const result = validateIban("AT000000000000000000");
    expect(result.valid).toBe(false);
  });

  it("rejects a malformed IBAN (too short)", () => {
    const result = validateIban("AT12345");
    expect(result.valid).toBe(false);
  });

  it("rejects an IBAN from outside the SEPA area", () => {
    // US has no IBAN at all, but exercises the country-code gate with a
    // syntactically IBAN-shaped string
    const result = validateIban("US611904300234573201");
    expect(result.valid).toBe(false);
  });

  it("rejects lowercase-only garbage input", () => {
    const result = validateIban("not an iban");
    expect(result.valid).toBe(false);
  });
});

describe("normalizeIban", () => {
  it("strips spaces and uppercases", () => {
    expect(normalizeIban("de89 3704 0044 0532 0130 00")).toBe("DE89370400440532013000");
  });
});

describe("maskIban", () => {
  it("shows first 4 and last 4 characters only", () => {
    expect(maskIban("DE89370400440532013000")).toBe("DE89 •••• •••• 3000");
  });

  it("returns short input unchanged", () => {
    expect(maskIban("DE89")).toBe("DE89");
  });
});
