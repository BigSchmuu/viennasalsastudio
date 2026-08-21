import { createClient } from "@/lib/supabase/server";
import { BookingManager, type AdminBookingRow } from "@/components/admin/bookings/booking-manager";
import { DropinPricingForm } from "@/components/admin/bookings/dropin-pricing-form";

export default async function BuchungenPage() {
  const supabase = await createClient();

  const [bookingsRes, pricingRes] = await Promise.all([
    supabase
      .from("course_bookings")
      .select(
        "id, customer_id, type, status, chosen_date, desired_plan, note, price, courses(name, price), profiles(full_name)"
      )
      .order("created_at", { ascending: false }),
    supabase.from("dropin_pricing").select("normal_price, student_price").limit(1).single(),
  ]);

  const bookings: AdminBookingRow[] = (bookingsRes.data ?? []).map((b) => ({
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
  }));

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
      <BookingManager bookings={bookings} />
    </div>
  );
}
