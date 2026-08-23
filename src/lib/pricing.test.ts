import { describe, it, expect } from "vitest";
import { readStudioPricing, planPrice, formatPrice, type StudioPricing } from "./pricing";

const pricing: StudioPricing = {
  dropin: { normal: 20, student: 15 },
  course: { normal: 65, student: 45 },
  flatrate: { normal: 145, student: 100 },
};

describe("planPrice", () => {
  it("uses the standard course price when the course has none", () => {
    expect(planPrice(pricing, "single_course", { coursePrice: null })).toBe(65);
  });

  it("lets a course's own price beat the standard", () => {
    expect(planPrice(pricing, "single_course", { coursePrice: 80 })).toBe(80);
  });

  it("falls back to the standard once a course price is cleared again", () => {
    expect(planPrice(pricing, "single_course", { coursePrice: 80 })).toBe(80);
    expect(planPrice(pricing, "single_course", { coursePrice: null })).toBe(65);
  });

  it("shows the student price for both plans", () => {
    expect(planPrice(pricing, "single_course", { coursePrice: null, student: true })).toBe(45);
    expect(planPrice(pricing, "flatrate", { student: true })).toBe(100);
  });

  it("keeps the student discount even when the course deviates", () => {
    // Ein abweichender Kurspreis ist eine Aussage über diesen Kurs, keine über
    // die Ermäßigung — sonst würde ein teurerer Kurs die Ermäßigung aushebeln.
    expect(planPrice(pricing, "single_course", { coursePrice: 80, student: true })).toBe(45);
  });

  it("returns null when nothing is maintained — never a silent 0", () => {
    const empty: StudioPricing = {
      dropin: { normal: 20, student: 15 },
      course: { normal: null, student: null },
      flatrate: { normal: null, student: null },
    };
    expect(planPrice(empty, "single_course", { coursePrice: null })).toBeNull();
    expect(planPrice(empty, "flatrate")).toBeNull();
  });

  it("falls back to the normal price when only the student rate is missing", () => {
    const noStudentRate: StudioPricing = { ...pricing, flatrate: { normal: 145, student: null } };
    expect(planPrice(noStudentRate, "flatrate", { student: true })).toBe(145);
  });

  it("respects a course priced at 0 instead of treating it as 'not maintained'", () => {
    expect(planPrice(pricing, "single_course", { coursePrice: 0 })).toBe(0);
  });
});

describe("readStudioPricing", () => {
  it("maps a full row", () => {
    const result = readStudioPricing({
      normal_price: 20,
      student_price: 15,
      course_price: 65,
      course_student_price: 45,
      flatrate_price: 145,
      flatrate_student_price: 100,
    });
    expect(result).toEqual(pricing);
  });

  it("keeps unmaintained subscription prices as null, but defaults the drop-ins", () => {
    const result = readStudioPricing({ normal_price: 22, student_price: 17 });
    expect(result.dropin).toEqual({ normal: 22, student: 17 });
    expect(result.course.normal).toBeNull();
    expect(result.flatrate.normal).toBeNull();
  });

  it("survives a missing row entirely", () => {
    const result = readStudioPricing(null);
    expect(result.dropin.normal).toBe(20);
    expect(result.course.normal).toBeNull();
  });
});

describe("formatPrice", () => {
  it("formats in Austrian style", () => {
    expect(formatPrice(65).replace(/ /g, " ")).toBe("€ 65,00");
  });
});
