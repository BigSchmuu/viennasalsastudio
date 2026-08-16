import { describe, it, expect } from "vitest";
import { mandateSchema, collectionRunSchema } from "./sepa";

describe("mandateSchema", () => {
  it("accepts a valid IBAN, name, and consent", () => {
    const result = mandateSchema.safeParse({
      iban: "AT611904300234573201",
      account_holder_name: "Max Mustermann",
      consent: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid IBAN checksum", () => {
    const result = mandateSchema.safeParse({
      iban: "AT000000000000000000",
      account_holder_name: "Max Mustermann",
      consent: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing account holder name", () => {
    const result = mandateSchema.safeParse({
      iban: "AT611904300234573201",
      account_holder_name: "",
      consent: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects consent left unchecked", () => {
    const result = mandateSchema.safeParse({
      iban: "AT611904300234573201",
      account_holder_name: "Max Mustermann",
      consent: false,
    });
    expect(result.success).toBe(false);
  });
});

describe("collectionRunSchema", () => {
  it("accepts a valid due date", () => {
    const result = collectionRunSchema.safeParse({ due_date: "2026-09-15" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty due date", () => {
    const result = collectionRunSchema.safeParse({ due_date: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an unparseable date string", () => {
    const result = collectionRunSchema.safeParse({ due_date: "not-a-date" });
    expect(result.success).toBe(false);
  });
});
