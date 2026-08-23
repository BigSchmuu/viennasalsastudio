import { describe, it, expect } from "vitest";
import { bookingSchema, courseEntryDateSchema, pricingSchema, MAX_PRICE } from "./booking";

const validCourseId = "3b11eea8-cab5-46b0-9a2f-ad35bc99115f";

describe("bookingSchema", () => {
  it("accepts a valid trial booking", () => {
    const result = bookingSchema.safeParse({
      course_id: validCourseId,
      type: "trial",
      chosen_date: "2026-09-01",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid dropin booking with student price flag", () => {
    const result = bookingSchema.safeParse({
      course_id: validCourseId,
      type: "dropin",
      chosen_date: "2026-09-01",
      wants_student_price: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a regular booking with a desired plan", () => {
    const result = bookingSchema.safeParse({
      course_id: validCourseId,
      type: "regular",
      chosen_date: "2026-09-01",
      desired_plan: "flatrate",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a regular booking missing the desired plan", () => {
    const result = bookingSchema.safeParse({
      course_id: validCourseId,
      type: "regular",
      chosen_date: "2026-09-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid course id", () => {
    const result = bookingSchema.safeParse({
      course_id: "not-a-uuid",
      type: "trial",
      chosen_date: "2026-09-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid booking type", () => {
    const result = bookingSchema.safeParse({
      course_id: validCourseId,
      type: "bogus",
      chosen_date: "2026-09-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing chosen date", () => {
    const result = bookingSchema.safeParse({
      course_id: validCourseId,
      type: "trial",
      chosen_date: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a note longer than 500 characters", () => {
    const result = bookingSchema.safeParse({
      course_id: validCourseId,
      type: "regular",
      chosen_date: "2026-09-01",
      desired_plan: "single_course",
      note: "a".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("accepts a regular booking with a valid dance role", () => {
    const result = bookingSchema.safeParse({
      course_id: validCourseId,
      type: "regular",
      chosen_date: "2026-09-01",
      desired_plan: "single_course",
      dance_role: "leader",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a regular booking with no dance role (optional field)", () => {
    const result = bookingSchema.safeParse({
      course_id: validCourseId,
      type: "regular",
      chosen_date: "2026-09-01",
      desired_plan: "single_course",
      dance_role: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid dance role", () => {
    const result = bookingSchema.safeParse({
      course_id: validCourseId,
      type: "regular",
      chosen_date: "2026-09-01",
      desired_plan: "single_course",
      dance_role: "admin",
    });
    expect(result.success).toBe(false);
  });
});

describe("courseEntryDateSchema", () => {
  it("accepts a valid date", () => {
    const result = courseEntryDateSchema.safeParse({ entry_date: "2026-09-01" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty date", () => {
    const result = courseEntryDateSchema.safeParse({ entry_date: "" });
    expect(result.success).toBe(false);
  });
});

describe("pricingSchema", () => {
  const base = {
    normal_price: 20,
    student_price: 15,
    course_price: 65,
    course_student_price: 45,
    flatrate_price: 145,
    flatrate_student_price: 100,
  };

  it("accepts the full price list", () => {
    expect(pricingSchema.safeParse(base).success).toBe(true);
  });

  it("rejects zero or negative prices", () => {
    expect(pricingSchema.safeParse({ ...base, normal_price: 0 }).success).toBe(false);
    expect(pricingSchema.safeParse({ ...base, student_price: -5 }).success).toBe(false);
    expect(pricingSchema.safeParse({ ...base, course_price: -1 }).success).toBe(false);
  });

  it("rejects unrealistically high prices — a typo must not become an offer", () => {
    expect(pricingSchema.safeParse({ ...base, course_price: MAX_PRICE + 1 }).success).toBe(false);
    expect(pricingSchema.safeParse({ ...base, flatrate_price: 65000 }).success).toBe(false);
    expect(pricingSchema.safeParse({ ...base, course_price: MAX_PRICE }).success).toBe(true);
  });

  it("accepts a missing subscription price — empty means 'not maintained'", () => {
    const result = pricingSchema.safeParse({
      ...base,
      course_price: null,
      course_student_price: null,
      flatrate_price: null,
      flatrate_student_price: null,
    });
    expect(result.success).toBe(true);
  });

  it("still requires the drop-in prices", () => {
    expect(pricingSchema.safeParse({ ...base, normal_price: null }).success).toBe(false);
  });
});
