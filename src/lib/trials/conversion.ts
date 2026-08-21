import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * True if `customerId` has a CONFIRMED regular booking or a subscription
 * dated on/after `sinceDate` (PROJ-29 conversion check). Shared between the
 * automated trial follow-up reminders (dispatch.ts) and the PROJ-28
 * newsletter's "Probestunde ohne Folgebuchung" recipient group — keeping
 * this in one place avoids the two definitions silently drifting apart
 * (PROJ-29's BUG-1 was exactly that: a status filter present in one copy,
 * forgotten in the other).
 */
export async function hasConvertedSince(
  supabase: SupabaseClient<Database>,
  customerId: string,
  sinceDate: string
): Promise<boolean> {
  const { data: regularBooking } = await supabase
    .from("course_bookings")
    .select("id")
    .eq("customer_id", customerId)
    .eq("type", "regular")
    .eq("status", "confirmed")
    .gte("chosen_date", sinceDate)
    .limit(1)
    .maybeSingle();
  if (regularBooking) return true;

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("customer_id", customerId)
    .gte("created_at", `${sinceDate}T00:00:00Z`)
    .limit(1)
    .maybeSingle();
  return !!subscription;
}
