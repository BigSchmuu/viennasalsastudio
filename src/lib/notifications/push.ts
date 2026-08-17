import webpush from "web-push";
import type { createServiceClient } from "@/lib/supabase/service";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;

  const { VAPID_PUBLIC_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  const publicKey = VAPID_PUBLIC_KEY || NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return false;

  webpush.setVapidDetails(VAPID_SUBJECT, publicKey, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * Sends a push notification to every device the customer has registered.
 * Expired/revoked device subscriptions are removed automatically.
 * Returns "sent" if at least one device succeeded, "skipped" if the customer
 * has no registered devices, "failed" if every attempted device failed.
 */
export async function sendPushToCustomer(
  service: ServiceClient,
  customerId: string,
  message: { title: string; body: string; url: string }
): Promise<"sent" | "skipped" | "failed"> {
  if (!ensureConfigured()) return "failed";

  const { data: subscriptions } = await service
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("customer_id", customerId);

  if (!subscriptions || subscriptions.length === 0) return "skipped";

  const payload = JSON.stringify(message);
  let anySent = false;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth_key },
        },
        payload
      );
      anySent = true;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await service.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }

  return anySent ? "sent" : "failed";
}
