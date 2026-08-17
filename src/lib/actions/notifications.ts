"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/types";
import {
  notificationEventGroupValues,
  notificationChannelValues,
  type NotificationEventGroup,
  type NotificationChannel,
} from "@/lib/constants/notifications";

export async function setNotificationPreference(
  eventGroup: NotificationEventGroup,
  channel: NotificationChannel,
  enabled: boolean
): Promise<ActionResult> {
  if (!notificationEventGroupValues.includes(eventGroup) || !notificationChannelValues.includes(channel)) {
    return { error: "Ungültige Einstellung" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht eingeloggt" };

  const { error } = await supabase.from("notification_preferences").upsert(
    {
      customer_id: user.id,
      event_group: eventGroup,
      channel,
      enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "customer_id,event_group,channel" }
  );

  if (error) {
    return { error: "Einstellung konnte nicht gespeichert werden." };
  }

  revalidatePath("/profil");
  return { success: true };
}

type SubscribeResult = { error: string } | { success: true };

export async function subscribeToPush(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<SubscribeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht eingeloggt" };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      customer_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth_key: subscription.keys.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return { error: "Push-Registrierung konnte nicht gespeichert werden." };
  }

  revalidatePath("/profil");
  return { success: true };
}

export async function unsubscribeFromPush(endpoint: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht eingeloggt" };

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("customer_id", user.id)
    .eq("endpoint", endpoint);

  if (error) {
    return { error: "Push-Registrierung konnte nicht entfernt werden." };
  }

  revalidatePath("/profil");
  return { success: true };
}
