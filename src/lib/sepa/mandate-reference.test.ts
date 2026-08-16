import { describe, it, expect } from "vitest";
import { generateMandateReference } from "./mandate-reference";

describe("generateMandateReference", () => {
  it("stays within the SEPA 35-character limit", () => {
    expect(generateMandateReference().length).toBeLessThanOrEqual(35);
  });

  it("only contains SEPA-safe characters (alphanumeric and hyphen)", () => {
    expect(generateMandateReference()).toMatch(/^[A-Z0-9-]+$/);
  });

  it("generates a different reference on each call", () => {
    const a = generateMandateReference();
    const b = generateMandateReference();
    expect(a).not.toBe(b);
  });
});
