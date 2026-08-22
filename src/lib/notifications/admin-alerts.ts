import { createServiceClient } from "@/lib/supabase/service";
import { enqueueAndDispatch } from "@/lib/notifications/dispatch";

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
