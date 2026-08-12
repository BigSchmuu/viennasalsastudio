import { describe, it, expect } from "vitest";

// Integration test against the real Supabase REST API using the public
// anon key. Only covers what's reachable without creating auth users
// (that needs a service_role key, which this project doesn't have
// configured yet — see QA notes on PROJ-1).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function restGet(table: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: { apikey: ANON_KEY },
  });
  return { status: res.status, body: await res.json() };
}

describe("PROJ-1: Supabase Infrastructure Setup", () => {
  it("allows anonymous read access to public catalog tables", async () => {
    for (const table of ["locations", "rooms", "courses", "class_sessions", "course_teachers"]) {
      const { status, body } = await restGet(table);
      expect(status, `${table} should be readable by anon`).toBe(200);
      expect(Array.isArray(body), `${table} should return an array`).toBe(true);
    }
  });

  it("does not expose private tables' data to anonymous callers", async () => {
    for (const table of ["profiles", "bookings", "subscriptions", "course_materials"]) {
      const { body } = await restGet(table);
      // Either a clean empty array (RLS filters rows) or an access-denied
      // error is acceptable — what must never happen is real row data
      // leaking to an unauthenticated caller.
      const leaked = Array.isArray(body) && body.length > 0;
      expect(leaked, `${table} must not leak rows to anon`).toBe(false);
    }
  });
});
