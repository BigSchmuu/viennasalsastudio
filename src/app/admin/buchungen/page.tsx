import { createClient } from "@/lib/supabase/server";
import { BookingManager, type AdminBookingRow } from "@/components/admin/bookings/booking-manager";
import { DropinPricingForm } from "@/components/admin/bookings/dropin-pricing-form";
import { bookingTypeValues } from "@/lib/constants/booking";

const SORTABLE_COLUMNS = ["customer_name", "course_name", "chosen_date"] as const;

export default async function BuchungenPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sort?: string; dir?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const sortKey = SORTABLE_COLUMNS.includes(params.sort as (typeof SORTABLE_COLUMNS)[number])
    ? (params.sort as (typeof SORTABLE_COLUMNS)[number])
    : "chosen_date";
  const ascending = params.sort ? params.dir !== "desc" : false; // default: newest request first

  let query = supabase
    .from("course_bookings")
    .select(
      "id, customer_id, type, status, chosen_date, desired_plan, note, price, courses(name, price), profiles(full_name), coupons(code, discount_type, discount_amount, max_redemptions, redemption_count, expires_at, active)"
    );

  if (sortKey === "customer_name") {
    query = query.order("full_name", { foreignTable: "profiles", ascending });
  } else if (sortKey === "course_name") {
    query = query.order("name", { foreignTable: "courses", ascending });
  } else {
    query = query.order("chosen_date", { ascending });
  }

  const isValidType = (bookingTypeValues as readonly string[]).includes(params.type ?? "");
  if (isValidType) query = query.eq("type", params.type!);

  const [bookingsRes, pricingRes] = await Promise.all([
    query,
    supabase.from("dropin_pricing").select("normal_price, student_price").limit(1).single(),
  ]);

  // PROJ-15: recomputed on every page load rather than trusted from the
  // attach-time decision, so a coupon that has since expired, been exhausted
  // or deactivated stops showing as a discount hint immediately.
  const today = new Date().toISOString().slice(0, 10);

  const bookings: AdminBookingRow[] = (bookingsRes.data ?? []).map((b) => {
    const coupon = b.coupons;
    const couponStillValid =
      !!coupon &&
      coupon.active &&
      (!coupon.expires_at || coupon.expires_at >= today) &&
      coupon.redemption_count < coupon.max_redemptions;

    return {
      id: b.id,
      customerId: b.customer_id,
      customerName: b.profiles?.full_name || "Unbenannt",
      courseName: b.courses?.name ?? "—",
      type: b.type,
      status: b.status,
      chosenDate: b.chosen_date,
      desiredPlan: b.desired_plan,
      note: b.note,
      price: b.price,
      coursePrice: b.courses?.price ?? null,
      coupon: couponStillValid
        ? {
            code: coupon.code,
            discountType: coupon.discount_type as "percent" | "fixed",
            discountAmount: Number(coupon.discount_amount),
          }
        : null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold">Buchungen</h2>
        <p className="text-sm text-muted-foreground">Buchungsanfragen, Probestunden und Drop-ins verwalten</p>
      </div>
      <DropinPricingForm
        normalPrice={pricingRes.data?.normal_price ?? 20}
        studentPrice={pricingRes.data?.student_price ?? 15}
      />
      <BookingManager bookings={bookings} initialType={isValidType ? params.type! : ""} />
    </div>
  );
}
