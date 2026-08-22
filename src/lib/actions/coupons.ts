"use server";

import { createClient } from "@/lib/supabase/server";

export type CouponCheckResult =
  | { valid: true; discountType: "percent" | "fixed"; discountAmount: number }
  | { valid: false };

/**
 * Read-only hint for the booking dialog's coupon field, so an invalid code
 * shows an inline error before the customer submits (see PROJ-15 spec).
 * This is NOT authoritative — it does not attach or reserve anything.
 * The actual attach-if-valid decision happens fresh inside
 * create_regular_course_booking on submit, and the real, atomic redemption
 * happens later when an admin confirms the request.
 */
export async function checkCouponCode(code: string): Promise<CouponCheckResult> {
  const trimmed = code.trim();
  if (!trimmed) return { valid: false };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_coupon_code", { p_code: trimmed }).maybeSingle();

  if (error || !data || !data.valid) return { valid: false };
  return {
    valid: true,
    discountType: data.discount_type as "percent" | "fixed",
    discountAmount: Number(data.discount_amount),
  };
}
