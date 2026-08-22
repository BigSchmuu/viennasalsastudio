import { createClient } from "@/lib/supabase/server";
import { CouponManager, type CouponRow } from "@/components/admin/coupons/coupon-manager";

export default async function CouponsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coupons")
    .select("id, code, discount_type, discount_amount, max_redemptions, redemption_count, expires_at, active")
    .order("created_at", { ascending: false });

  const coupons: CouponRow[] = (data ?? []).map((c) => ({
    id: c.id,
    code: c.code,
    discountType: c.discount_type as "percent" | "fixed",
    discountAmount: Number(c.discount_amount),
    maxRedemptions: c.max_redemptions,
    redemptionCount: c.redemption_count,
    expiresAt: c.expires_at,
    active: c.active,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold">Gutscheine</h2>
        <p className="text-sm text-muted-foreground">
          Rabattcodes für die erste Anmeldung neuer Kunden anlegen und verwalten.
        </p>
      </div>

      <CouponManager coupons={coupons} />
    </div>
  );
}
