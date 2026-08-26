"use server";

import { createClient } from "@/lib/supabase/server";

export type CouponCheckResult =
  | { valid: true; kind: "coupon"; discountType: "percent" | "fixed"; discountAmount: number }
  | { valid: true; kind: "referral"; creditAmount: number }
  | { valid: false; rateLimited?: boolean };

/**
 * Read-only hint for the booking dialog's code field (Gutschein oder Empfehlung), so an invalid code
 * shows an inline error before the customer submits (see PROJ-15 spec).
 * This is NOT authoritative — it does not attach or reserve anything.
 * The actual attach-if-valid decision happens fresh inside
 * create_regular_course_booking on submit, and the real, atomic redemption
 * happens later when an admin confirms the request.
 *
 * Brute-force protection lives in the RPC itself, not here (QA BUG-1): the
 * attack calls the RPC directly with an anon key, so an app-side limiter
 * would never see it.
 */
export async function checkCouponCode(code: string): Promise<CouponCheckResult> {
  const trimmed = code.trim();
  if (!trimmed) return { valid: false };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_coupon_code", { p_code: trimmed }).maybeSingle();

  if (error || !data) return { valid: false };
  if (data.rate_limited) return { valid: false, rateLimited: true };
  if (!data.valid) return { valid: false };

  // PROJ-44: Dasselbe Feld nimmt beide Arten von Codes. Der Kunde muss den
  // Unterschied nicht kennen — der Hinweis darunter schon, denn ein Gutschein
  // senkt den Preis sofort, eine Empfehlung bringt Guthaben nach der ersten
  // Abbuchung.
  if (data.code_kind === "referral") {
    return { valid: true, kind: "referral", creditAmount: Number(data.discount_amount) };
  }
  return {
    valid: true,
    kind: "coupon",
    discountType: data.discount_type as "percent" | "fixed",
    discountAmount: Number(data.discount_amount),
  };
}
