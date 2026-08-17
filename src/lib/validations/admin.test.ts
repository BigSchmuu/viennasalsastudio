import { describe, it, expect } from "vitest";
import { subscriptionSchema, teacherInviteSchema, lessonSchema } from "./admin";

const validCourseId = "3b11eea8-cab5-46b0-9a2f-ad35bc99115f";
const validVideoSetId = "ad07a4ed-ce9c-4d37-ae79-a549513ef839";

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
