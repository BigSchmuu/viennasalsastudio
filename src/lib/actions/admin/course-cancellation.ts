"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";

const idSchema = z.string().uuid("Ungültige Pause");

export type AffectedCount = { error: string } | { count: number };

/**
 * PROJ-38: how many people would be told about this cancelled session.
 *
 * Counted at the moment the dialog opens rather than when the page was loaded:
 * the admin is about to send an irreversible message, and a number from ten
 * minutes ago could be wrong in either direction.
 *
 * Who counts:
 *   - customers with an ACTIVE subscription for the course — they might turn up
 *     any week
 *   - anyone with a confirmed trial or drop-in for EXACTLY this date; somebody
 *     booked for another week is not affected
 */
export async function countAffectedCustomers(pauseId: string): Promise<AffectedCount> {
  if (!idSchema.safeParse(pauseId).success) return { error: "Ungültige Pause" };

  const { supabase } = await requireAdmin();

  const { data: pause } = await supabase
    .from("course_schedule_pauses")
    .select("pause_date, course_schedule(course_id)")
    .eq("id", pauseId)
    .maybeSingle();

  if (!pause?.course_schedule?.course_id) return { error: "Pause nicht gefunden." };
  const courseId = pause.course_schedule.course_id;

  const [subscriptions, bookings] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("customer_id")
      .eq("course_id", courseId)
      .eq("status", "active"),
    supabase
      .from("course_bookings")
      .select("customer_id")
      .eq("course_id", courseId)
      .eq("chosen_date", pause.pause_date)
      .eq("status", "confirmed")
      .in("type", ["trial", "dropin"]),
  ]);

  // One person may hold both a subscription and a drop-in for the same date;
  // they should be counted — and later messaged — once.
  const recipients = new Set([
    ...(subscriptions.data ?? []).map((s) => s.customer_id),
    ...(bookings.data ?? []).map((b) => b.customer_id),
  ]);

  return { count: recipients.size };
}
