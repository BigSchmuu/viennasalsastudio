"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

type ScheduleChangeResult = { error: string } | { success: true; pendingEffectiveDate: string };

export async function pauseSubscription(subscriptionId: string): Promise<ScheduleChangeResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Nicht eingeloggt" };

  const { data, error } = await supabase.rpc("self_schedule_subscription_change", {
    p_subscription_id: subscriptionId,
    p_new_pending_status: "paused",
  });
  if (error || !data || !data.pending_effective_date) {
    return { error: "Pausieren konnte nicht geplant werden." };
  }

  revalidatePath("/profil");
  return { success: true, pendingEffectiveDate: data.pending_effective_date };
}

export async function cancelSubscription(subscriptionId: string): Promise<ScheduleChangeResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Nicht eingeloggt" };

  const { data, error } = await supabase.rpc("self_schedule_subscription_change", {
    p_subscription_id: subscriptionId,
    p_new_pending_status: "cancelled",
  });
  if (error || !data || !data.pending_effective_date) {
    return { error: "Kündigung konnte nicht geplant werden." };
  }

  revalidatePath("/profil");
  return { success: true, pendingEffectiveDate: data.pending_effective_date };
}

export async function undoPendingSubscriptionChange(subscriptionId: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Nicht eingeloggt" };

  const { error } = await supabase.rpc("self_undo_pending_change", {
    p_subscription_id: subscriptionId,
  });
  if (error) {
    return { error: "Geplante Änderung konnte nicht zurückgenommen werden." };
  }

  revalidatePath("/profil");
  return { success: true };
}

export async function reactivateSubscription(subscriptionId: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Nicht eingeloggt" };

  const { error } = await supabase.rpc("self_reactivate_subscription", {
    p_subscription_id: subscriptionId,
  });
  if (error) {
    return { error: "Abo konnte nicht reaktiviert werden." };
  }

  revalidatePath("/profil");
  return { success: true };
}

export async function switchSubscriptionCourse(
  subscriptionId: string,
  newCourseId: string
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Nicht eingeloggt" };

  const { error } = await supabase.rpc("self_switch_subscription_course", {
    p_subscription_id: subscriptionId,
    p_new_course_id: newCourseId,
  });
  if (error) {
    return { error: "Kurswechsel konnte nicht durchgeführt werden." };
  }

  revalidatePath("/profil");
  return { success: true };
}
