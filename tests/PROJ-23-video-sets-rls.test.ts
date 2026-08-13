import { describe, it, expect } from "vitest";

// Integration test against the real Supabase REST API using the public
// anon key, same approach as PROJ-1's RLS test (no service_role key
// configured for this project, so authenticated-user scenarios for the
// assigned-vs-other-teacher read boundary are verified manually and
// documented in the PROJ-23 QA results instead).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function restGet(table: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: { apikey: ANON_KEY },
  });
  return { status: res.status, body: await res.json() };
}

describe("PROJ-23: Videosätze & Lektionen — RLS", () => {
  it("does not expose video set / lesson / video rows to anonymous callers", async () => {
    for (const table of ["video_sets", "video_set_lessons", "video_set_lesson_videos"]) {
      const { body } = await restGet(table);
      const leaked = Array.isArray(body) && body.length > 0;
      expect(leaked, `${table} must not leak rows to anon`).toBe(false);
    }
  });

  it("rejects anonymous writes to video_sets", async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/video_sets`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Anon Hack Attempt" }),
    });
    expect(res.status, "anon insert into video_sets must be rejected").not.toBe(201);
  });
});
