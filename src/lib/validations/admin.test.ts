import { describe, it, expect } from "vitest";
import { subscriptionSchema, teacherInviteSchema, lessonSchema, courseSchema } from "./admin";

const validCourseId = "3b11eea8-cab5-46b0-9a2f-ad35bc99115f";
const validVideoSetId = "ad07a4ed-ce9c-4d37-ae79-a549513ef839";
const validDanceStyleId = "6b0f9f2d-9d2a-4e5a-8b1b-6e6d3d0a1b2c";
const validRoomId = "9f1a2b3c-4d5e-4f60-8a1b-2c3d4e5f6071";

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

describe("courseSchema (max_participants / price, PROJ-12)", () => {
  const base = {
    name: "E2E12 Kurs",
    dance_style_id: validDanceStyleId,
    level: "beginner" as const,
    room_id: validRoomId,
    video_set_id: "",
    teacher_ids: [],
  };

  it("accepts empty strings for both fields (unlimited capacity, no fixed price)", () => {
    const result = courseSchema.safeParse({ ...base, max_participants: "", price: "" });
    expect(result.success).toBe(true);
  });

  it("accepts a positive integer max_participants and a non-negative price", () => {
    const result = courseSchema.safeParse({ ...base, max_participants: "12", price: "55.5" });
    expect(result.success).toBe(true);
  });

  it("accepts a price of exactly 0 (free course)", () => {
    const result = courseSchema.safeParse({ ...base, max_participants: "", price: "0" });
    expect(result.success).toBe(true);
  });

  it("rejects a zero max_participants", () => {
    const result = courseSchema.safeParse({ ...base, max_participants: "0", price: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a negative max_participants", () => {
    const result = courseSchema.safeParse({ ...base, max_participants: "-3", price: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer max_participants", () => {
    const result = courseSchema.safeParse({ ...base, max_participants: "2.5", price: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric max_participants", () => {
    const result = courseSchema.safeParse({ ...base, max_participants: "abc", price: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a negative price", () => {
    const result = courseSchema.safeParse({ ...base, max_participants: "", price: "-1" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric price", () => {
    const result = courseSchema.safeParse({ ...base, max_participants: "", price: "free" });
    expect(result.success).toBe(false);
  });
});

describe("courseSchema (role_query_enabled / max_role_difference, PROJ-30)", () => {
  const base = {
    name: "E2E30 Kurs",
    dance_style_id: validDanceStyleId,
    level: "beginner" as const,
    room_id: validRoomId,
    video_set_id: "",
    teacher_ids: [],
    max_participants: "",
    price: "",
  };

  it("accepts an empty max_role_difference (no balance restriction)", () => {
    const result = courseSchema.safeParse({ ...base, role_query_enabled: true, max_role_difference: "" });
    expect(result.success).toBe(true);
  });

  it("accepts a max_role_difference of exactly 0 (strict balance)", () => {
    const result = courseSchema.safeParse({ ...base, role_query_enabled: true, max_role_difference: "0" });
    expect(result.success).toBe(true);
  });

  it("accepts a positive integer max_role_difference", () => {
    const result = courseSchema.safeParse({ ...base, role_query_enabled: true, max_role_difference: "2" });
    expect(result.success).toBe(true);
  });

  it("rejects a negative max_role_difference", () => {
    const result = courseSchema.safeParse({ ...base, role_query_enabled: true, max_role_difference: "-1" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer max_role_difference", () => {
    const result = courseSchema.safeParse({ ...base, role_query_enabled: true, max_role_difference: "1.5" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric max_role_difference", () => {
    const result = courseSchema.safeParse({ ...base, role_query_enabled: true, max_role_difference: "abc" });
    expect(result.success).toBe(false);
  });
});

describe("teacherInviteSchema", () => {
  it("accepts a valid name and email", () => {
    const result = teacherInviteSchema.safeParse({
      full_name: "Maria Musterlehrerin",
      email: "maria@beispiel.at",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = teacherInviteSchema.safeParse({ full_name: "", email: "maria@beispiel.at" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = teacherInviteSchema.safeParse({ full_name: "Maria", email: "not-an-email" });
    expect(result.success).toBe(false);
  });
});

describe("lessonSchema", () => {
  const base = { title: "Grundschritt", video_set_id: validVideoSetId };

  it("accepts a lesson with a valid YouTube customer video and teacher video links", () => {
    const result = lessonSchema.safeParse({
      ...base,
      video_urls: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
      customer_video_url: "https://youtu.be/dQw4w9WgXcQ",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty customer_video_url (optional field)", () => {
    const result = lessonSchema.safeParse({
      ...base,
      video_urls: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
      customer_video_url: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a lesson with zero teacher video links (an empty array)", () => {
    const result = lessonSchema.safeParse({
      ...base,
      video_urls: [],
      customer_video_url: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a javascript: URL as customer_video_url (BUG-1)", () => {
    const result = lessonSchema.safeParse({
      ...base,
      video_urls: [],
      customer_video_url: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a valid but non-YouTube URL as customer_video_url (BUG-2)", () => {
    const result = lessonSchema.safeParse({
      ...base,
      video_urls: [],
      customer_video_url: "https://vimeo.com/12345",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a javascript: URL among the teacher video_urls", () => {
    const result = lessonSchema.safeParse({
      ...base,
      video_urls: ["javascript:alert(1)"],
      customer_video_url: "",
    });
    expect(result.success).toBe(false);
  });
});
