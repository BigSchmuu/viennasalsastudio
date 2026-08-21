import { describe, it, expect } from "vitest";
import { joinWaitlistSchema } from "./waitlist";

const validCourseId = "3b11eea8-cab5-46b0-9a2f-ad35bc99115f";

describe("joinWaitlistSchema", () => {
  const base = { course_id: validCourseId, desired_plan: "single_course" as const, chosen_date: "2026-08-31" };

  it("accepts a valid waitlist join request", () => {
    expect(joinWaitlistSchema.safeParse(base).success).toBe(true);
  });

  it("accepts the flatrate plan", () => {
    expect(joinWaitlistSchema.safeParse({ ...base, desired_plan: "flatrate" }).success).toBe(true);
  });

  it("rejects a non-UUID course_id", () => {
    expect(joinWaitlistSchema.safeParse({ ...base, course_id: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects a missing desired_plan", () => {
    expect(joinWaitlistSchema.safeParse({ ...base, desired_plan: "" }).success).toBe(false);
  });

  it("rejects an unknown desired_plan value", () => {
    expect(joinWaitlistSchema.safeParse({ ...base, desired_plan: "premium" }).success).toBe(false);
  });

  it("rejects an empty chosen_date", () => {
    expect(joinWaitlistSchema.safeParse({ ...base, chosen_date: "" }).success).toBe(false);
  });

  it("accepts a valid dance_role (PROJ-30)", () => {
    expect(joinWaitlistSchema.safeParse({ ...base, dance_role: "follower" }).success).toBe(true);
  });

  it("accepts no dance_role (optional field, PROJ-30)", () => {
    expect(joinWaitlistSchema.safeParse({ ...base, dance_role: "" }).success).toBe(true);
  });

  it("rejects an invalid dance_role (PROJ-30)", () => {
    expect(joinWaitlistSchema.safeParse({ ...base, dance_role: "coach" }).success).toBe(false);
  });
});
