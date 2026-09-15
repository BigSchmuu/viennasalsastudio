import { describe, it, expect } from "vitest";
import { eventSchema, createEventSchema } from "./events";

const validEvent = {
  name: "Salsa Congress",
  description: "Ein tolles Event",
  location: "Studio Saal 1",
  // PROJ-53: Jedes Event hat eine Eventart und eine Verkaufsart.
  event_type_id: "3f6f1c1e-8a0b-4b7a-9d0e-2c4a5b6d7e8f",
  sales_mode: "tickets",
  starts_at: "2099-09-01T20:00",
  ends_at: "",
  capacity: "50",
  price_normal: "25",
  price_student: "15",
  // PROJ-56: Zahlungsarten, Stornofrist und Tanzrolle gehören jetzt zum Event.
  payment_methods: "both",
  cancellation_lead_days: "1",
  role_query_enabled: "false",
  max_role_difference: "",
};

function fehlerfelder(eingabe: Record<string, string>) {
  const ergebnis = eventSchema.safeParse(eingabe);
  return ergebnis.success ? [] : ergebnis.error.issues.map((issue) => issue.path[0]);
}

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

describe("eventSchema — Eventart und Verkaufsart (PROJ-53)", () => {
  it("verlangt bei „Tickets in der App“ Kapazität und Preise", () => {
    expect(fehlerfelder({ ...validEvent, capacity: "", price_normal: "", price_student: "" })).toEqual(
      expect.arrayContaining(["capacity", "price_normal", "price_student"])
    );
  });

  it("lässt bei „Nur anzeigen“ Kapazität und Preise leer", () => {
    expect(
      fehlerfelder({ ...validEvent, sales_mode: "display", capacity: "", price_normal: "", price_student: "" })
    ).toEqual([]);
  });

  it("prüft einen eingetragenen Preis auch bei „Nur anzeigen“", () => {
    expect(fehlerfelder({ ...validEvent, sales_mode: "display", price_normal: "-5" })).toContain("price_normal");
  });

  it("verlangt eine Eventart", () => {
    expect(fehlerfelder({ ...validEvent, event_type_id: "" })).toContain("event_type_id");
  });

  it("kennt nur die beiden Verkaufsarten", () => {
    expect(fehlerfelder({ ...validEvent, sales_mode: "gratis" })).toContain("sales_mode");
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

describe("eventSchema — Zahlungsarten, Stornofrist und Tanzrolle (PROJ-56)", () => {
  it("nimmt die drei Zahlungswahlen an", () => {
    for (const wahl of ["sepa", "onsite", "both"]) {
      expect(fehlerfelder({ ...validEvent, payment_methods: wahl })).toEqual([]);
    }
  });

  it("weist eine unbekannte Zahlungswahl ab", () => {
    // Keine Zahlungsart wäre ein Event, das niemand kaufen kann.
    expect(fehlerfelder({ ...validEvent, payment_methods: "keine" })).toContain("payment_methods");
  });

  it("verlangt eine Stornofrist in ganzen Tagen", () => {
    expect(fehlerfelder({ ...validEvent, cancellation_lead_days: "" })).toContain("cancellation_lead_days");
    expect(fehlerfelder({ ...validEvent, cancellation_lead_days: "1,5" })).toContain("cancellation_lead_days");
    expect(fehlerfelder({ ...validEvent, cancellation_lead_days: "-1" })).toContain("cancellation_lead_days");
  });

  it("lässt 0 Tage zu — dann gilt: stornieren bis zum Beginn", () => {
    expect(fehlerfelder({ ...validEvent, cancellation_lead_days: "0" })).toEqual([]);
  });

  it("lässt den Rollenabstand leer, wenn keiner gilt", () => {
    expect(fehlerfelder({ ...validEvent, role_query_enabled: "true", max_role_difference: "" })).toEqual([]);
    expect(fehlerfelder({ ...validEvent, role_query_enabled: "true", max_role_difference: "2" })).toEqual([]);
    expect(fehlerfelder({ ...validEvent, role_query_enabled: "true", max_role_difference: "-1" })).toContain(
      "max_role_difference"
    );
  });
});
