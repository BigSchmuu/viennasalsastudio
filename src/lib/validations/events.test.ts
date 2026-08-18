import { describe, it, expect } from "vitest";
import { eventSchema, createEventSchema } from "./events";

const validEvent = {
  name: "Salsa Congress",
  description: "Ein tolles Event",
  location: "Studio Saal 1",
  starts_at: "2099-09-01T20:00",
  ends_at: "",
  capacity: "50",
  price_normal: "25",
  price_student: "15",
};

describe("eventSchema", () => {
  it("accepts a valid event", () => {
    expect(eventSchema.safeParse(validEvent).success).toBe(true);
  });

  it("rejects a missing name", () => {
    const result = eventSchema.safeParse({ ...validEvent, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer or zero capacity", () => {
    expect(eventSchema.safeParse({ ...validEvent, capacity: "0" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...validEvent, capacity: "1.5" }).success).toBe(false);
  });

  it("rejects a negative price", () => {
    expect(eventSchema.safeParse({ ...validEvent, price_normal: "-5" }).success).toBe(false);
  });

  it("rejects an end date before the start date", () => {
    const result = eventSchema.safeParse({
      ...validEvent,
      starts_at: "2099-09-02T20:00",
      ends_at: "2099-09-01T20:00",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a past starts_at (editing an event whose date has already passed must remain possible)", () => {
    const result = eventSchema.safeParse({ ...validEvent, starts_at: "2020-01-01T20:00" });
    expect(result.success).toBe(true);
  });
});

describe("createEventSchema", () => {
  it("accepts a future starts_at", () => {
    expect(createEventSchema.safeParse(validEvent).success).toBe(true);
  });

  it("rejects a past starts_at when creating a new event", () => {
    const result = createEventSchema.safeParse({ ...validEvent, starts_at: "2020-01-01T20:00" });
    expect(result.success).toBe(false);
  });
});
