"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import type { ActionResult } from "@/lib/actions/types";
import { heuteInWien } from "@/lib/constants/zeitzone";

export async function createCoupon(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") ?? "").trim();
  const discountType = String(formData.get("discount_type") ?? "");
  const discountAmountRaw = formData.get("discount_amount");
  const maxRedemptionsRaw = formData.get("max_redemptions");
  const expiresAt = String(formData.get("expires_at") ?? "").trim();

  if (!code) {
    return { error: "Code ist erforderlich." };
  }
  if (discountType !== "percent" && discountType !== "fixed") {
    return { error: "Bitte einen Rabatt-Typ wählen." };
  }
  const discountAmount = discountAmountRaw === null || discountAmountRaw === "" ? NaN : Number(discountAmountRaw);
  if (Number.isNaN(discountAmount) || discountAmount <= 0) {
    return { error: "Bitte eine gültige Rabatt-Höhe eingeben." };
  }
  if (discountType === "percent" && discountAmount > 100) {
    return { error: "Ein Prozent-Rabatt kann nicht über 100% liegen." };
  }
  const maxRedemptions = maxRedemptionsRaw === null || maxRedemptionsRaw === "" ? NaN : Number(maxRedemptionsRaw);
  if (!Number.isInteger(maxRedemptions) || maxRedemptions <= 0) {
    return { error: "Bitte eine gültige maximale Einlöse-Anzahl eingeben." };
  }
  // Gegen den Wiener Tag, nicht den UTC-Tag: Sonst gilt ein Ablaufdatum
  // nachts zwei Stunden lang als vergangen, obwohl es das nicht ist.
  if (expiresAt && expiresAt < heuteInWien()) {
    return { error: "Das Ablaufdatum darf nicht in der Vergangenheit liegen." };
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("coupons").insert({
    code: code.toUpperCase(),
    discount_type: discountType,
    discount_amount: discountAmount,
    max_redemptions: maxRedemptions,
    expires_at: expiresAt || null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Dieser Code ist bereits vergeben." };
    }
    return { error: "Gutschein konnte nicht angelegt werden." };
  }

  revalidatePath("/admin/gutscheine");
  return { success: true };
}

export async function toggleCouponActive(couponId: string, active: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("coupons").update({ active }).eq("id", couponId);
  if (error) {
    return { error: "Status konnte nicht geändert werden." };
  }
  revalidatePath("/admin/gutscheine");
  return { success: true };
}
