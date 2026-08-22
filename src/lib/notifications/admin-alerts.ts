import { createServiceClient } from "@/lib/supabase/service";
import { enqueueAndDispatch } from "@/lib/notifications/dispatch";

/**
 * A booking made by a test account must not reach anyone's phone.
 *
 * The E2E suite runs against the production database — this project has no
 * staging environment — and books through the real UI. Without this guard a
 * single full test run sent the operator 9 real push notifications and wrote
 * 9 rows into the live notification queue (measured during PROJ-39 QA).
 *
 * `.test` is reserved by RFC 2606 for exactly this purpose, so it can never
 * collide with a real customer address.
 */
export function isTestAccountEmail(email: string | null | undefined): boolean {
  return Boolean(email?.trim().toLowerCase().endsWith(".test"));
}

/**
 * PROJ-39: tells the admins that a booking is waiting for them.
 *
 * Only admins who actually registered a device are notified. Without that
 * filter every incoming booking would create a queue row for each of the
 * admin accounts — including the leftover test fixtures — that could never
 * be delivered anyway.
 *
 * Never throws: a failure here must not affect the customer's booking. The
 * caller additionally runs this *after* the response has been sent (see
 * `after()` in booking.ts), so the customer never waits on it.
 */
export async function notifyAdminsOfNewBooking(bookingId: string): Promise<void> {
  try {
    const service = createServiceClient();

    const { data: booking } = await service
      .from("course_bookings")
      .select("customer_id")
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking) return;

    const { data: customer } = await service.auth.admin.getUserById(booking.customer_id);
    if (isTestAccountEmail(customer?.user?.email)) return;

    const { data: admins } = await service.from("profiles").select("id").eq("role", "admin");
    if (!admins?.length) return;

    const adminIds = admins.map((a) => a.id);
    const { data: devices } = await service
      .from("push_subscriptions")
      .select("customer_id")
      .in("customer_id", adminIds);

    const recipients = [...new Set((devices ?? []).map((d) => d.customer_id))];

    await Promise.all(
      recipients.map((adminId) =>
        enqueueAndDispatch({
          customerId: adminId,
          eventType: "neue_buchung",
          payload: { booking_id: bookingId },
          // One alert per admin per booking, even if this ever runs twice.
          dedupeKey: `neue_buchung:${bookingId}:${adminId}`,
        })
      )
    );
  } catch (err) {
    console.error("notifyAdminsOfNewBooking failed", err);
  }
}
