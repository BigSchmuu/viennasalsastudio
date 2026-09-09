import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfilGruppe, ProfilAbschnitt } from "@/components/profile/profil-gruppe";
import { ProfileForm } from "@/components/auth/profile-form";
import { LogoutButton } from "@/components/auth/logout-button";
import type { MandateData } from "@/components/payments/payment-method-section";
import { MyBookingsSection, type MyBookingRow } from "@/components/booking/my-bookings-section";
import { MySubscriptionsSection, type MySubscriptionRow } from "@/components/subscription/my-subscriptions-section";
import { MyInvoicesSection, type MyInvoiceRow } from "@/components/invoices/my-invoices-section";
import { MyCreditSection, type MyCreditEntry } from "@/components/credits/my-credit-section";
import { readStudioPricing } from "@/lib/pricing";
import { istVollstaendigAufgehoben, summiereAufhebungen } from "@/lib/invoices";
import { MyWaitlistSection, type MyWaitlistRow } from "@/components/waitlist/my-waitlist-section";
import type { NotificationPreferenceRow } from "@/components/notifications/notification-settings-section";
import type { MyTicketRow } from "@/components/tickets/my-tickets-section";
import { createClient } from "@/lib/supabase/server";
import { upcomingOccurrences, daysUntil } from "@/lib/scheduling/dates";
import { BOOKING_CANCELLATION_LEAD_DAYS } from "@/lib/constants/booking";
import { TICKET_CANCELLATION_LEAD_DAYS } from "@/lib/constants/events";
import type { ProfileInput } from "@/lib/validations/auth";
import { getTranslations } from "next-intl/server";
import { getViewer } from "@/lib/auth/viewer";

// Code-split out of the main /profil bundle: each pulls in real extra weight
// (react-hook-form+zod, the QR-code generator, the push-notification hook)
// that most visits to this page don't need to download up front.
const PaymentMethodSection = dynamic(() =>
  import("@/components/payments/payment-method-section").then((mod) => mod.PaymentMethodSection)
);
const MyTicketsSection = dynamic(() =>
  import("@/components/tickets/my-tickets-section").then((mod) => mod.MyTicketsSection)
);
const NotificationSettingsSection = dynamic(() =>
  import("@/components/notifications/notification-settings-section").then(
    (mod) => mod.NotificationSettingsSection
  )
);

export default async function ProfilePage() {
  const supabase = await createClient();
  // Der Rahmen hat das schon ermittelt — getViewer() gibt innerhalb einer
  // Anfrage dieselbe Antwort zurück, ohne erneut zu fragen.
  const user = await getViewer();

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
    { data: ticketRows },
    { data: pricingRow },
    { data: creditRows },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, birthdate, gender, referral_code").eq("id", user.id).single(),
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
      .select(
        "id, invoice_number, invoice_date, description, gross_amount, bounced_at, document_type, cancels_invoice_id"
      )
      .eq("customer_id", user.id)
      .order("invoice_date", { ascending: false }),
    supabase.rpc("list_my_waitlist"),
    supabase
      .from("notification_preferences")
      .select("event_group, channel, enabled")
      .eq("customer_id", user.id),
    supabase
      .from("tickets")
      .select("id, payment_method, status, price, events(name, starts_at)")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false }),
    // PROJ-44: Die beiden Belohnungsbeträge — stehen beide auf 0, ist das
    // Empfehlungsprogramm aus und der Code wird nicht angeboten.
    supabase.from("dropin_pricing").select("*").limit(1).single(),
    // PROJ-44: Guthaben-Verlauf. Der Kontostand ist die Summe daraus.
    supabase
      .from("customer_credits")
      .select("id, amount, origin, reason, created_at")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false }),
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

  // PROJ-46: Was der Kunde sieht, steht vollständig in seinen eigenen Zeilen —
  // Stornos gehören demselben Kunden wie die Rechnung, die sie aufheben.
  const rechnungsnummerJeId = new Map(
    (invoiceRows ?? []).map((i) => [i.id, i.invoice_number] as const)
  );
  const aufgehobenJeRechnung = summiereAufhebungen(invoiceRows ?? []);

  const invoices: MyInvoiceRow[] = (invoiceRows ?? []).map((i) => ({
    id: i.id,
    invoiceNumber: i.invoice_number,
    invoiceDate: i.invoice_date,
    description: i.description,
    grossAmount: i.gross_amount,
    bounced: !!i.bounced_at,
    art:
      i.document_type === "cancellation"
        ? ("storno" as const)
        : i.document_type === "credit_note"
          ? ("gutschrift" as const)
          : ("rechnung" as const),
    bezugsnummer: i.cancels_invoice_id
      ? (rechnungsnummerJeId.get(i.cancels_invoice_id) ?? null)
      : null,
    aufgehoben:
      i.document_type === "invoice" &&
      istVollstaendigAufgehoben(Number(i.gross_amount), aufgehobenJeRechnung.get(i.id) ?? 0),
  }));

  const notificationPreferences: NotificationPreferenceRow[] = (notificationPreferenceRows ?? []).map((p) => ({
    eventGroup: p.event_group as NotificationPreferenceRow["eventGroup"],
    channel: p.channel as NotificationPreferenceRow["channel"],
    enabled: p.enabled,
  }));

  const tickets: MyTicketRow[] = (ticketRows ?? [])
    .filter((t) => t.events !== null)
    .map((t) => {
      const isActive = t.status === "reserved" || t.status === "confirmed";
      const withinLeadTime = daysUntil(t.events!.starts_at.slice(0, 10)) >= TICKET_CANCELLATION_LEAD_DAYS;
      return {
        id: t.id,
        eventName: t.events!.name,
        eventStartsAt: t.events!.starts_at,
        paymentMethod: t.payment_method,
        status: t.status,
        price: t.price,
        canCancel: isActive && withinLeadTime,
      };
    });

  const t = await getTranslations("profile");

  const creditEntries: MyCreditEntry[] = (creditRows ?? []).map((c) => ({
    id: c.id,
    amount: Number(c.amount),
    origin: c.origin as MyCreditEntry["origin"],
    reason: c.reason,
    createdAt: c.created_at,
  }));
  const creditBalance = creditEntries.reduce((summe, e) => summe + e.amount, 0);
  const studioPricing = readStudioPricing(pricingRow);
  const tc = await getTranslations("credit");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      {/* max-w-sm (384 px) stammte aus der Zeit, als hier eine einzelne
          Karte stand. Mit Tabellen fuer Rechnungen und Benachrichtigungen
          ist das zu eng; jede andere Kundenseite ist breiter. */}
      <div className="w-full max-w-2xl space-y-6">
        <Card className="rounded-card shadow-soft">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="font-heading">{t("heading")}</CardTitle>
              <CardDescription>{user.email}</CardDescription>
            </div>
            <LogoutButton />
          </CardHeader>
          <CardContent>
            {/* Die Karte ist seit der Verbreiterung 672 px breit. Eingabefelder
                fuer Name und Telefon ueber die volle Breite zu ziehen, macht
                sie nicht besser lesbar, sondern nur lang. */}
            <div className="max-w-md">
              <ProfileForm
                defaultValues={{
                  full_name: profile?.full_name ?? "",
                  phone: profile?.phone ?? "",
                  birthdate: profile?.birthdate ?? "",
                  gender: (profile?.gender ?? "") as ProfileInput["gender"],
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Drei Gruppen statt einer Liste aus acht: Kurse, Zahlungen,
            Einstellungen. Die Abschnitte selbst und ihre Beschriftungen
            bleiben unveraendert — nur ihre Anordnung aendert sich. */}
        <ProfilGruppe titel={t("groupCourses")} hinweis={t("groupCoursesHint")}>
          <ProfilAbschnitt wert="abo" titel={t("sectionSubscription")} hinweis={t("sectionSubscriptionHint")}>
            <MySubscriptionsSection subscriptions={subscriptions} courses={courses} />
          </ProfilAbschnitt>
          <ProfilAbschnitt wert="buchungen" titel={t("sectionBookings")} hinweis={t("sectionBookingsHint")}>
            <MyBookingsSection bookings={bookings} />
          </ProfilAbschnitt>
          <ProfilAbschnitt wert="warteliste" titel={t("sectionWaitlist")} hinweis={t("sectionWaitlistHint")}>
            <MyWaitlistSection entries={waitlistEntries} />
          </ProfilAbschnitt>
          <ProfilAbschnitt wert="tickets" titel={t("sectionTickets")} hinweis={t("sectionTicketsHint")} letzter>
            <MyTicketsSection tickets={tickets} />
          </ProfilAbschnitt>
        </ProfilGruppe>

        <ProfilGruppe titel={t("groupPayments")} hinweis={t("groupPaymentsHint")}>
          <ProfilAbschnitt wert="zahlungsmethode" titel={t("sectionPayment")} hinweis={t("sectionPaymentHint")}>
            <PaymentMethodSection mandate={mandate} />
          </ProfilAbschnitt>
          <ProfilAbschnitt wert="guthaben" titel={tc("section")} hinweis={tc("sectionHint")}>
            <MyCreditSection
              balance={creditBalance}
              entries={creditEntries}
              referralCode={profile?.referral_code ?? null}
              rewardReferrer={studioPricing.referral.referrer}
              rewardReferee={studioPricing.referral.referee}
            />
          </ProfilAbschnitt>
          <ProfilAbschnitt wert="rechnungen" titel={t("sectionInvoices")} hinweis={t("sectionInvoicesHint")} letzter>
            <MyInvoicesSection invoices={invoices} />
          </ProfilAbschnitt>
        </ProfilGruppe>

        <ProfilGruppe titel={t("groupSettings")} hinweis={t("groupSettingsHint")}>
          <ProfilAbschnitt
            wert="benachrichtigungen"
            titel={t("sectionNotifications")}
            hinweis={t("sectionNotificationsHint")}
            letzter
          >
            <NotificationSettingsSection preferences={notificationPreferences} />
          </ProfilAbschnitt>
        </ProfilGruppe>
      </div>
    </div>
  );
}
