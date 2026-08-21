import { createServiceClient } from "@/lib/supabase/service";
import { sendNotificationEmail } from "@/lib/notifications/mailer";
import { sendPushToCustomer } from "@/lib/notifications/push";
import { buildNotificationContent, type NotificationContent } from "@/lib/notifications/templates";
import { upcomingOccurrences } from "@/lib/scheduling/dates";
import type { Json } from "@/lib/supabase/types";

type ServiceClient = ReturnType<typeof createServiceClient>;
type QueueRow = {
  id: string;
  customer_id: string;
  event_type: string;
  payload: Record<string, unknown>;
};

async function getChannelPreferences(
  service: ServiceClient,
  customerId: string,
  eventGroup: string
): Promise<{ email: boolean; push: boolean }> {
  const { data } = await service
    .from("notification_preferences")
    .select("channel, enabled")
    .eq("customer_id", customerId)
    .eq("event_group", eventGroup);

  const email = data?.find((r) => r.channel === "email")?.enabled ?? true;
  const push = data?.find((r) => r.channel === "push")?.enabled ?? true;
  return { email, push };
}

async function resolveContent(service: ServiceClient, row: QueueRow): Promise<NotificationContent | null> {
  const payload = row.payload;

  switch (row.event_type) {
    case "buchungsstatus": {
      const { data } = await service
        .from("course_bookings")
        .select("courses(name)")
        .eq("id", payload.booking_id as string)
        .maybeSingle();
      return buildNotificationContent("buchungsstatus", {
        courseName: data?.courses?.name ?? "Kurs",
        newStatus: payload.new_status as "confirmed" | "rejected",
      });
    }
    case "warteliste": {
      const { data } = await service
        .from("courses")
        .select("name")
        .eq("id", payload.course_id as string)
        .maybeSingle();
      return buildNotificationContent("warteliste", {
        courseName: data?.name ?? "Kurs",
        chosenDate: payload.chosen_date as string,
      });
    }
    case "abo_kuendigung": {
      const { data } = await service
        .from("subscriptions")
        .select("name, courses(name)")
        .eq("id", payload.subscription_id as string)
        .maybeSingle();
      return buildNotificationContent("abo_kuendigung", {
        subscriptionName: data?.name ?? data?.courses?.name ?? "Abo",
        newStatus: payload.new_status as "paused" | "cancelled",
        effectiveDate: payload.effective_date as string,
      });
    }
    case "kursstart_erinnerung": {
      const { data } = await service
        .from("course_bookings")
        .select("type, chosen_date, courses(name)")
        .eq("id", payload.booking_id as string)
        .maybeSingle();
      if (!data) return null;
      return buildNotificationContent("kursstart_erinnerung", {
        courseName: data.courses?.name ?? "Kurs",
        chosenDate: data.chosen_date,
        type: data.type as "trial" | "dropin",
      });
    }
    case "sepa_ankuendigung": {
      return buildNotificationContent("sepa_ankuendigung", {
        amount: payload.amount as number,
        dueDate: payload.due_date as string,
      });
    }
    case "event_tickets": {
      if (payload.sub_type === "event_cancelled") {
        const { data } = await service
          .from("events")
          .select("name, starts_at")
          .eq("id", payload.event_id as string)
          .maybeSingle();
        if (!data) return null;
        return buildNotificationContent("event_tickets", {
          subType: "event_cancelled",
          eventName: data.name,
          startsAt: data.starts_at,
        });
      }

      const { data } = await service
        .from("tickets")
        .select("status, events(name, starts_at)")
        .eq("id", payload.ticket_id as string)
        .maybeSingle();
      if (!data || !data.events) return null;
      return buildNotificationContent("event_tickets", {
        subType: "purchased",
        eventName: data.events.name,
        startsAt: data.events.starts_at,
        ticketStatus: data.status as "confirmed" | "reserved",
      });
    }
    case "probestunde_nachfassung": {
      const { data } = await service
        .from("course_bookings")
        .select("course_id, courses(name)")
        .eq("id", payload.booking_id as string)
        .maybeSingle();
      if (!data) return null;
      return buildNotificationContent("probestunde_nachfassung", {
        subType: payload.sub_type as "abend" | "naechster_termin",
        courseName: data.courses?.name ?? "Kurs",
        courseId: data.course_id,
      });
    }
    default:
      return null;
  }
}

async function trySendEmail(service: ServiceClient, customerId: string, content: NotificationContent) {
  try {
    const { data } = await service.auth.admin.getUserById(customerId);
    const email = data.user?.email;
    if (!email) return { status: "failed" as const, error: "Keine E-Mail-Adresse gefunden" };

    await sendNotificationEmail(email, content.subject, content.emailHtml);
    return { status: "sent" as const, error: null };
  } catch (err) {
    return { status: "failed" as const, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Atomically claims a pending row so exactly one caller ever processes it —
 * closes the race between the cron drain and an inline dispatch picking up
 * the same row (BUG-4). Returns null if the row was already claimed.
 */
async function claimQueueRow(service: ServiceClient, id: string): Promise<QueueRow | null> {
  const { data } = await service
    .from("notification_queue")
    .update({ status: "processing" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id, customer_id, event_type, payload")
    .maybeSingle();
  return (data as QueueRow) ?? null;
}

export async function processQueueRow(service: ServiceClient, row: QueueRow): Promise<void> {
  const errors: string[] = [];
  let emailStatus: "skipped" | "sent" | "failed" = "skipped";
  let pushStatus: "skipped" | "sent" | "failed" = "skipped";

  try {
    const content = await resolveContent(service, row);
    if (!content) {
      errors.push("Konnte Inhalte nicht auflösen (referenzierte Daten fehlen)");
    } else if (row.event_type === "sepa_ankuendigung") {
      const emailResult = await trySendEmail(service, row.customer_id, content);
      emailStatus = emailResult.status;
      if (emailResult.error) errors.push(`E-Mail: ${emailResult.error}`);
    } else {
      const prefs = await getChannelPreferences(service, row.customer_id, row.event_type);

      if (prefs.email) {
        const emailResult = await trySendEmail(service, row.customer_id, content);
        emailStatus = emailResult.status;
        if (emailResult.error) errors.push(`E-Mail: ${emailResult.error}`);
      }

      if (prefs.push) {
        pushStatus = await sendPushToCustomer(service, row.customer_id, {
          title: content.pushTitle,
          body: content.pushBody,
          url: content.url,
        });
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  await service
    .from("notification_queue")
    .update({
      status: "processed",
      email_status: emailStatus,
      push_status: pushStatus,
      error_detail: errors.length > 0 ? errors.join("; ") : null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", row.id);
}

type EnqueueInput = {
  customerId: string;
  eventType: string;
  payload: Record<string, Json>;
  dedupeKey: string;
};

/**
 * Enqueues a notification only — fast, no send attempt. Use this for bulk
 * triggers (e.g. one row per customer in a SEPA collection run) so the
 * triggering action isn't blocked on N synchronous email/push sends; the
 * cron drain picks these up.
 */
export async function enqueueNotification(input: EnqueueInput): Promise<void> {
  try {
    const service = createServiceClient();
    const { error } = await service.from("notification_queue").insert({
      customer_id: input.customerId,
      event_type: input.eventType,
      payload: input.payload,
      dedupe_key: input.dedupeKey,
      status: "pending",
    });
    if (error && error.code !== "23505") {
      console.error("enqueueNotification: insert failed", error);
    }
  } catch (err) {
    console.error("enqueueNotification failed", err);
  }
}

/**
 * Enqueues a notification and attempts to dispatch it immediately (best-effort,
 * never throws). Used from admin server actions right after a single-customer
 * business action succeeds (booking confirm/reject), so that customer gets
 * near-real-time delivery. Not suitable for bulk triggers — see `enqueueNotification`.
 */
export async function enqueueAndDispatch(input: EnqueueInput): Promise<void> {
  try {
    const service = createServiceClient();
    const { data: inserted, error } = await service
      .from("notification_queue")
      .insert({
        customer_id: input.customerId,
        event_type: input.eventType,
        payload: input.payload,
        dedupe_key: input.dedupeKey,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      if (error.code !== "23505") console.error("enqueueAndDispatch: insert failed", error);
      return;
    }

    const claimed = await claimQueueRow(service, inserted.id);
    if (claimed) await processQueueRow(service, claimed);
  } catch (err) {
    console.error("enqueueAndDispatch failed", err);
  }
}

function todayInVienna(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Vienna" });
}

/** Adds days to a YYYY-MM-DD string via UTC arithmetic — independent of the
 *  executing process's own local timezone (BUG-6: the previous implementation
 *  mutated a local Date, which was only safe because Vercel runs UTC). */
function addDaysToDateString(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function tomorrowInVienna(): string {
  return addDaysToDateString(todayInVienna(), 1);
}

/** Enqueues day-before reminders (trial/dropin) and "cancellation is now effective" notices. */
export async function runDailyChecks(service: ServiceClient): Promise<{ reminders: number; effective: number }> {
  const tomorrow = tomorrowInVienna();
  const today = todayInVienna();
  let reminders = 0;
  let effective = 0;

  const { data: bookings } = await service
    .from("course_bookings")
    .select("id, customer_id")
    .in("type", ["trial", "dropin"])
    .eq("status", "confirmed")
    .eq("chosen_date", tomorrow);

  for (const booking of bookings ?? []) {
    const { error } = await service.from("notification_queue").insert({
      customer_id: booking.customer_id,
      event_type: "kursstart_erinnerung",
      payload: { booking_id: booking.id },
      dedupe_key: `trial_reminder:${booking.id}`,
      status: "pending",
    });
    if (!error) reminders += 1;
  }

  const { data: subscriptions } = await service
    .from("subscriptions")
    .select("id, customer_id, pending_status, pending_effective_date")
    .eq("pending_effective_date", today)
    .not("pending_status", "is", null);

  for (const sub of subscriptions ?? []) {
    const { error } = await service.from("notification_queue").insert({
      customer_id: sub.customer_id,
      event_type: "abo_kuendigung",
      payload: {
        subscription_id: sub.id,
        new_status: sub.pending_status,
        effective_date: sub.pending_effective_date,
      },
      dedupe_key: `sub_effective:${sub.id}:${sub.pending_effective_date}`,
      status: "pending",
    });
    if (!error) effective += 1;
  }

  return { reminders, effective };
}

/** True if `customerId` has any regular booking or subscription dated on/after `sinceDate` (PROJ-29 conversion check). */
async function hasConvertedSince(service: ServiceClient, customerId: string, sinceDate: string): Promise<boolean> {
  const { data: regularBooking } = await service
    .from("course_bookings")
    .select("id")
    .eq("customer_id", customerId)
    .eq("type", "regular")
    .gte("chosen_date", sinceDate)
    .limit(1)
    .maybeSingle();
  if (regularBooking) return true;

  const { data: subscription } = await service
    .from("subscriptions")
    .select("id")
    .eq("customer_id", customerId)
    .gte("created_at", `${sinceDate}T00:00:00Z`)
    .limit(1)
    .maybeSingle();
  return !!subscription;
}

/** Enqueues the same-evening trial reminder (chosen_date = today, Vienna). Meant for a
 *  separate evening cron run — the existing morning run is too early for "same evening". */
export async function runEveningChecks(service: ServiceClient): Promise<{ evening: number }> {
  const today = todayInVienna();
  let evening = 0;

  const { data: bookings } = await service
    .from("course_bookings")
    .select("id, customer_id")
    .eq("type", "trial")
    .eq("status", "confirmed")
    .eq("chosen_date", today);

  for (const booking of bookings ?? []) {
    const { error } = await service.from("notification_queue").insert({
      customer_id: booking.customer_id,
      event_type: "probestunde_nachfassung",
      payload: { booking_id: booking.id, sub_type: "abend" },
      dedupe_key: `probestunde_nachfassung:abend:${booking.id}`,
      status: "pending",
    });
    if (!error) evening += 1;
  }

  return { evening };
}

/** Enqueues the second trial reminder, timed to land the day before the course's next
 *  actual occurrence (pauses are skipped automatically) rather than a fixed day count —
 *  fires at most once per booking (guarded by `notification_queue`'s unique dedupe_key). */
export async function runFollowupChecks(service: ServiceClient): Promise<{ followup: number }> {
  const today = todayInVienna();
  const tomorrow = tomorrowInVienna();
  const windowStart = addDaysToDateString(today, -30);

  let followup = 0;

  const { data: bookings } = await service
    .from("course_bookings")
    .select(
      "id, customer_id, chosen_date, courses(course_schedule(weekday, course_schedule_pauses(pause_date)))"
    )
    .eq("type", "trial")
    .eq("status", "confirmed")
    .lt("chosen_date", today)
    .gte("chosen_date", windowStart);

  for (const booking of bookings ?? []) {
    const schedule = booking.courses?.course_schedule;
    if (!schedule) continue;

    const converted = await hasConvertedSince(service, booking.customer_id, booking.chosen_date);
    if (converted) continue;

    const pauseDates = schedule.course_schedule_pauses.map((p) => p.pause_date);
    const [nextOccurrence] = upcomingOccurrences(schedule.weekday, { count: 1, pauseDates });
    if (nextOccurrence !== tomorrow) continue;

    const { error } = await service.from("notification_queue").insert({
      customer_id: booking.customer_id,
      event_type: "probestunde_nachfassung",
      payload: { booking_id: booking.id, sub_type: "naechster_termin" },
      dedupe_key: `probestunde_nachfassung:naechster_termin:${booking.id}`,
      status: "pending",
    });
    if (!error) followup += 1;
  }

  return { followup };
}

/** Drains pending queue rows (safety net for rows enqueued from SQL, e.g. waitlist promotion). */
export async function drainPendingQueue(service: ServiceClient, limit = 200): Promise<{ processed: number }> {
  const { data: rows } = await service
    .from("notification_queue")
    .select("id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  let processed = 0;
  for (const row of rows ?? []) {
    const claimed = await claimQueueRow(service, row.id);
    if (claimed) {
      await processQueueRow(service, claimed);
      processed += 1;
    }
  }

  return { processed };
}
