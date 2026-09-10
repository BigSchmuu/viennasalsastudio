"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookingDialog } from "@/components/booking/booking-dialog";
import { FlatrateCourseButton } from "@/components/booking/flatrate-course-button";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { StudioPricing } from "@/lib/pricing";

export type CourseDetailData = {
  id: string;
  name: string;
  entryDates: string[];
  nextOccurrenceDates: string[];
  /** Eigener Kurspreis; `null` = Standardpreis (PROJ-41). */
  price: number | null;
  hasOpenRegularBooking: boolean;
  hasActiveSubscription: boolean;
  /** PROJ-50: Der Kunde hat eine laufende Flatrate — Kurse kosten ihn nichts extra. */
  hasFlatrate: boolean;
  isFull: boolean;
  isOnWaitlist: boolean;
  prerequisiteNote: string | null;
  roleQueryEnabled: boolean;
};

export function CourseDetailBooking({
  course,
  isLoggedIn,
  hasMandate,
  hasReferralSource,
  pricing,
}: {
  course: CourseDetailData;
  isLoggedIn: boolean;
  hasMandate: boolean;
  hasReferralSource: boolean;
  pricing: StudioPricing;
}) {
  const router = useRouter();
  const t = useTranslations("flatrate");
  const [bookingOpen, setBookingOpen] = useState(false);

  function handleBook() {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/kurse/${course.id}`);
      return;
    }
    setBookingOpen(true);
  }

  // PROJ-50: Für einen Flatrate-Kunden ist der große Buchungsdialog
  // gegenstandslos — Zahlweise, Preis und AGB sind mit seiner Flatrate bereits
  // geklärt. Er bekommt den kurzen Weg; alle anderen den bisherigen.
  const mitFlatrate = isLoggedIn && course.hasFlatrate;

  if (mitFlatrate) {
    return (
      <>
        {/* Wer schon drin ist, sah hier nur den Satz „Du bist in diesem Kurs".
            Der Knopf bleibt jetzt stehen und führt hinaus — der Rückweg gehört
            dorthin, wo der Hinweg war. */}
        {course.hasActiveSubscription && (
          <p className="mb-2 text-sm text-muted-foreground">{t("alreadyIn")}</p>
        )}
        <FlatrateCourseButton
          kursId={course.id}
          istDrin={course.hasActiveSubscription}
          fragtRolleAb={course.roleQueryEnabled}
          vorkenntnisseHinweis={course.prerequisiteNote}
          istVoll={course.isFull}
          // Bei vollem Kurs führt der Knopf dorthin, wo es weitergeht: in den
          // bestehenden Dialog mit der Warteliste.
          onWarteliste={() => setBookingOpen(true)}
        />
        {bookingOpen && (
          <BookingDialog
            open={bookingOpen}
            onOpenChange={setBookingOpen}
            course={course}
            hasMandate={hasMandate}
            hasReferralSource={hasReferralSource}
            pricing={pricing}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Button className="rounded-full" onClick={handleBook}>Jetzt buchen</Button>

      {bookingOpen && (
        <BookingDialog
          open={bookingOpen}
          onOpenChange={setBookingOpen}
          course={course}
          hasMandate={hasMandate}
          hasReferralSource={hasReferralSource}
          pricing={pricing}
        />
      )}
    </>
  );
}
