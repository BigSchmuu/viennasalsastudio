"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { enqueueAndDispatch } from "@/lib/notifications/dispatch";

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

export type NotifyResult = { error: string } | { success: true; sent: number; failed: number };

/**
 * PROJ-38: tells everyone affected that this session is cancelled.
 *
 * Recipients are worked out here, not read from a stored list — see the note on
 * `notified_at`. The same person can hold a subscription and a drop-in for the
 * date; they are messaged once.
 *
 * The timestamp is written when at least one message actually went out.
 * Requiring *every* delivery to succeed would let a single stale address hide
 * the fact that thirty other people were informed — and the admin would send
 * again, spamming everyone who already knew.
 */
export async function notifyCourseCancellation(pauseId: string): Promise<NotifyResult> {
  if (!idSchema.safeParse(pauseId).success) return { error: "Ungültige Pause" };

  const { supabase } = await requireAdmin();

  const { data: pause } = await supabase
    .from("course_schedule_pauses")
    .select("id, pause_date, course_schedule(course_id)")
    .eq("id", pauseId)
    .maybeSingle();

  if (!pause?.course_schedule?.course_id) return { error: "Pause nicht gefunden." };
  const courseId = pause.course_schedule.course_id;

  const [subscriptions, bookings] = await Promise.all([
    supabase.from("subscriptions").select("customer_id").eq("course_id", courseId).eq("status", "active"),
    supabase
      .from("course_bookings")
      .select("customer_id")
      .eq("course_id", courseId)
      .eq("chosen_date", pause.pause_date)
      .eq("status", "confirmed")
      .in("type", ["trial", "dropin"]),
  ]);

  const recipients = [
    ...new Set([
      ...(subscriptions.data ?? []).map((s) => s.customer_id),
      ...(bookings.data ?? []).map((b) => b.customer_id),
    ]),
  ];

  if (recipients.length === 0) {
    return { error: "Für diesen Termin ist niemand betroffen — es wurde nichts versendet." };
  }

  const service = createServiceClient();
  const stamp = Date.now();
  let sent = 0;
  let failed = 0;

  for (const customerId of recipients) {
    // Timestamped key: repeat sends are explicitly allowed (a wrong click, or
    // someone who signed up afterwards), and each one has to actually go out.
    const dedupeKey = `kursausfall:${pause.id}:${customerId}:${stamp}`;
    try {
      await enqueueAndDispatch({
        customerId,
        eventType: "kursausfall",
        payload: { pause_id: pause.id },
        dedupeKey,
      });
    } catch {
      failed++;
      continue;
    }

    // enqueueAndDispatch records delivery problems instead of throwing, so the
    // queue row is the only honest source for what actually happened.
    const { data: queued } = await service
      .from("notification_queue")
      .select("email_status, push_status")
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();

    // Either channel counts. A customer who only uses push has been told just
    // as surely as one who reads e-mail — counting only e-mail would mark them
    // as unreached and, if everybody were push-only, hide the fact that the
    // whole course was informed.
    const reached = queued?.email_status === "sent" || queued?.push_status === "sent";
    if (reached) sent++;
    else failed++;
  }

  if (sent === 0) {
    return { error: "Keine der Benachrichtigungen konnte zugestellt werden." };
  }

  const { error } = await supabase
    .from("course_schedule_pauses")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", pauseId);

  if (error) return { error: "Versendet, konnte aber nicht vermerkt werden." };

  revalidatePath("/admin/kurse");
  return { success: true, sent, failed };
}
