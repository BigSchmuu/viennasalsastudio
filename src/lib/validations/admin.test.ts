import { describe, it, expect } from "vitest";
import { subscriptionSchema } from "./admin";

const validCourseId = "3b11eea8-cab5-46b0-9a2f-ad35bc99115f";

describe("subscriptionSchema", () => {
  const base = { name: "Flatrate Studierende", price: 45, status: "active" as const };

  it("accepts a subscription with a course reference and a cycle anchor date", () => {
    const result = subscriptionSchema.safeParse({
      ...base,
      course_id: validCourseId,
      cycle_anchor_date: "2026-08-01",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a Flatrate subscription with no course reference (empty string)", () => {
    const result = subscriptionSchema.safeParse({
      ...base,
      course_id: "",
      cycle_anchor_date: "2026-08-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID course_id", () => {
    const result = subscriptionSchema.safeParse({
      ...base,
      course_id: "not-a-uuid",
      cycle_anchor_date: "2026-08-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing cycle_anchor_date", () => {
    const result = subscriptionSchema.safeParse({
      ...base,
      course_id: "",
      cycle_anchor_date: "",
    });
    expect(result.success).toBe(false);
  });
});
