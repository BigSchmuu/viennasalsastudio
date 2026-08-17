import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/auth/profile-form";
import { LogoutButton } from "@/components/auth/logout-button";
import { PaymentMethodSection, type MandateData } from "@/components/payments/payment-method-section";
import { MyBookingsSection, type MyBookingRow } from "@/components/booking/my-bookings-section";
import { MySubscriptionsSection, type MySubscriptionRow } from "@/components/subscription/my-subscriptions-section";
import { MyInvoicesSection, type MyInvoiceRow } from "@/components/invoices/my-invoices-section";
import { MyWaitlistSection, type MyWaitlistRow } from "@/components/waitlist/my-waitlist-section";
import {
  NotificationSettingsSection,
  type NotificationPreferenceRow,
} from "@/components/notifications/notification-settings-section";
import { createClient } from "@/lib/supabase/server";
import { upcomingOccurrences, daysUntil } from "@/lib/scheduling/dates";
import { BOOKING_CANCELLATION_LEAD_DAYS } from "@/lib/constants/booking";
import type { ProfileInput } from "@/lib/validations/auth";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/profil");
  }

  const [
    { data: profile },
    { data: mandateRow },
    { data: bookingRows },
    { data: subscriptionRows },
    { data: courseRows },
    { data: invoiceRows },
    { data: waitlistRows },
    { data: notificationPreferenceRows },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, birthdate, gender").eq("id", user.id).single(),
    supabase
      .from("sepa_mandates")
      .select("id, iban, account_holder_name, consented_at")
      .eq("customer_id", user.id)
      .is("revoked_at", null)
      .maybeSingle(),
    supabase
      .from("course_bookings")
      .select(
        "id, type, status, chosen_date, desired_plan, price, courses(name, course_schedule(weekday, course_schedule_pauses(pause_date)))"
      )
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("subscriptions")
      .select("id, name, price, status, pending_status, pending_effective_date, course_id, courses(name)")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: true }),
    supabase.from("courses").select("id, name").order("name", { ascending: true }),
    supabase
      .from("invoices")
      .select("id, invoice_number, invoice_date, description, gross_amount, bounced_at")
      .eq("customer_id", user.id)
      .order("invoice_date", { ascending: false }),
    supabase.rpc("list_my_waitlist"),
    supabase
      .from("notification_preferences")
      .select("event_group, channel, enabled")
      .eq("customer_id", user.id),
  ]);

  const mandate: MandateData | null = mandateRow
    ? {
        id: mandateRow.id,
        iban: mandateRow.iban,
        accountHolderName: mandateRow.account_holder_name,
        consentedAt: mandateRow.consented_at,
      }
    : null;

  const bookings: MyBookingRow[] = (bookingRows ?? []).map((b) => {
    const withinLeadTime = daysUntil(b.chosen_date) >= BOOKING_CANCELLATION_LEAD_DAYS;
    const isActive = b.status === "open" || b.status === "confirmed";
    const schedule = b.courses?.course_schedule;
    const availableDates =
      b.type !== "regular" && schedule
        ? upcomingOccurrences(schedule.weekday, {
            count: 4,
            pauseDates: schedule.course_schedule_pauses.map((p) => p.pause_date),
          })
        : [];

    return {
      id: b.id,
      courseName: b.courses?.name ?? "—",
      type: b.type,
      status: b.status,
      chosenDate: b.chosen_date,
      desiredPlan: b.desired_plan,
      price: b.price,
      canCancel: isActive && withinLeadTime,
      canRebook: isActive && withinLeadTime && b.type !== "regular",
      availableDates,
    };
  });

  const subscriptions: MySubscriptionRow[] = (subscriptionRows ?? []).map((s) => ({
    id: s.id,
    name: s.name ?? "",
    courseId: s.course_id,
    courseName: s.courses?.name ?? null,
    price: s.price,
    status: s.status,
    pendingStatus: s.pending_status,
    pendingEffectiveDate: s.pending_effective_date,
  }));

  const courses = courseRows ?? [];
  const courseNameById = new Map(courses.map((c) => [c.id, c.name]));

  const waitlistEntries: MyWaitlistRow[] = (waitlistRows ?? []).map((w) => ({
    id: w.id,
    courseId: w.course_id,
    courseName: courseNameById.get(w.course_id) ?? "—",
    desiredPlan: w.desired_plan,
    chosenDate: w.chosen_date,
    position: w.position,
  }));

  const invoices: MyInvoiceRow[] = (invoiceRows ?? []).map((i) => ({
    id: i.id,
    invoiceNumber: i.invoice_number,
    invoiceDate: i.invoice_date,
    description: i.description,
    grossAmount: i.gross_amount,
    bounced: !!i.bounced_at,
  }));

  const notificationPreferences: NotificationPreferenceRow[] = (notificationPreferenceRows ?? []).map((p) => ({
    eventGroup: p.event_group as NotificationPreferenceRow["eventGroup"],
    channel: p.channel as NotificationPreferenceRow["channel"],
    enabled: p.enabled,
  }));

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="font-heading">Mein Profil</CardTitle>
              <CardDescription>{user.email}</CardDescription>
            </div>
            <LogoutButton />
          </CardHeader>
          <CardContent>
            <ProfileForm
              defaultValues={{
                full_name: profile?.full_name ?? "",
                phone: profile?.phone ?? "",
                birthdate: profile?.birthdate ?? "",
                gender: (profile?.gender ?? "") as ProfileInput["gender"],
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Zahlungsmethode</CardTitle>
            <CardDescription>SEPA-Lastschriftmandat für deine Abo-Zahlungen</CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentMethodSection mandate={mandate} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Mein Abo</CardTitle>
            <CardDescription>Pausieren, kündigen oder umbuchen</CardDescription>
          </CardHeader>
          <CardContent>
            <MySubscriptionsSection subscriptions={subscriptions} courses={courses} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Meine Buchungen</CardTitle>
            <CardDescription>Anfragen, Probestunden und Drop-ins</CardDescription>
          </CardHeader>
          <CardContent>
            <MyBookingsSection bookings={bookings} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Meine Warteliste</CardTitle>
            <CardDescription>Kurse, für die du auf einen freien Platz wartest</CardDescription>
          </CardHeader>
          <CardContent>
            <MyWaitlistSection entries={waitlistEntries} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Meine Rechnungen</CardTitle>
            <CardDescription>Zahlungshistorie deiner Abo-Zahlungen</CardDescription>
          </CardHeader>
          <CardContent>
            <MyInvoicesSection invoices={invoices} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Benachrichtigungen</CardTitle>
            <CardDescription>Wähle, worüber du per E-Mail und Push informiert werden möchtest</CardDescription>
          </CardHeader>
          <CardContent>
            <NotificationSettingsSection preferences={notificationPreferences} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
