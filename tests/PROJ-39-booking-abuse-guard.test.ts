import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * PROJ-39 BUG-1 regression guard.
 *
 * These run against the database directly rather than through the UI on
 * purpose: the abuse path found during QA called the RPC with the anon key,
 * bypassing the server action entirely. A test that went through the booking
 * dialog would therefore not cover the hole that was actually found.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const EMAIL = "proj39-abuse-guard@viennasalsastudio.test";
const PASSWORD = "CorrectPassword123!";

let service: SupabaseClient;
let attacker: SupabaseClient;
let userId: string;
let courseId: string;

async function book(date: string) {
  return attacker.rpc("create_self_service_booking", {
    p_course_id: courseId,
    p_type: "dropin",
    p_chosen_date: date,
    p_wants_student_price: false,
    p_prerequisite_confirmed: true,
  });
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  // A dedicated account keeps the hourly budget of the shared fixture
  // customers untouched — otherwise this file would make later booking
  // suites fail depending on run order.
  const { data: existing } = await service.auth.admin.listUsers({ perPage: 200 });
  const stale = existing.users.find((u) => u.email === EMAIL);
  if (stale) await service.auth.admin.deleteUser(stale.id);

  const { data: created, error } = await service.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  userId = created.user.id;

  // The profile row is created by a trigger, so it is not guaranteed to exist
  // the instant createUser returns.
  for (let i = 0; i < 20; i++) {
    const { data } = await service.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (data) break;
    await new Promise((r) => setTimeout(r, 100));
  }

  const { data: course } = await service.from("courses").select("id").eq("name", "E2E8 Kurs").single();
  courseId = course!.id;

  attacker = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: authError } = await attacker.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (authError) throw authError;
}, 30000);

beforeEach(async () => {
  // Each test starts from an empty booking history, so the hourly budget is
  // predictable regardless of test order.
  await service.from("course_bookings").delete().eq("customer_id", userId);
});

afterAll(async () => {
  if (!userId) return;
  await service.from("course_bookings").delete().eq("customer_id", userId);
  await service.auth.admin.deleteUser(userId);
});

describe("PROJ-39 BUG-1: self-service booking abuse guards", () => {
  it("rejects a second identical drop-in for the same course and date", async () => {
    const first = await book("2026-09-15");
    expect(first.error, "the first booking must still work").toBeNull();

    const second = await book("2026-09-15");
    expect(second.error?.message).toContain("already booked");
  });

  it("still allows the same course on a different date", async () => {
    expect((await book("2026-09-15")).error).toBeNull();
    expect((await book("2026-09-16")).error, "different dates are not duplicates").toBeNull();
  });

  it("lets a customer rebook a date they previously cancelled", async () => {
    const { data } = await book("2026-09-15");
    await service.from("course_bookings").update({ status: "cancelled" }).eq("id", data!.id);

    const again = await book("2026-09-15");
    expect(again.error, "a cancelled booking must not block the date forever").toBeNull();
  });

  // Varying the date defeats the duplicate check alone, which is why the
  // hourly cap exists as a second layer.
  it("caps how many bookings one customer can create per hour", async () => {
    const reasons: string[] = [];
    let accepted = 0;

    for (let day = 1; day <= 20; day++) {
      const { error } = await book(`2026-10-${String(day).padStart(2, "0")}`);
      if (error) reasons.push(error.message);
      else accepted++;
    }

    expect(accepted).toBeLessThanOrEqual(10);
    expect(accepted).toBeGreaterThan(0);
    expect(reasons.some((r) => r.includes("booking rate limit"))).toBe(true);
  }, 60000);

  it("counts cancelled bookings towards the cap so cancelling cannot reset it", async () => {
    for (let day = 1; day <= 10; day++) {
      await book(`2026-11-${String(day).padStart(2, "0")}`);
    }
    await service.from("course_bookings").update({ status: "cancelled" }).eq("customer_id", userId);

    const { error } = await book("2026-11-20");
    expect(error?.message).toContain("booking rate limit");
  }, 60000);
});
