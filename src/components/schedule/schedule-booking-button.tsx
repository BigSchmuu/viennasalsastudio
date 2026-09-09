"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookingDialog, type BookingDialogCourse } from "@/components/booking/booking-dialog";
import { Button } from "@/components/ui/button";
import { FlatrateAddButton } from "@/components/booking/flatrate-add-button";
import type { StudioPricing } from "@/lib/pricing";

export function ScheduleBookingButton({
  course,
  isLoggedIn,
  hasMandate,
  hasReferralSource,
  pricing,
}: {
  course: BookingDialogCourse;
  isLoggedIn: boolean;
  hasMandate: boolean;
  hasReferralSource: boolean;
  pricing: StudioPricing;
}) {
  const router = useRouter();
  const [bookingOpen, setBookingOpen] = useState(false);

  function handleClick() {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/stundenplan`);
      return;
    }
    setBookingOpen(true);
  }

  // PROJ-50: Ein Flatrate-Kunde bucht nicht, er trägt sich ein. Der Dialog
  // bleibt für ihn nur der Weg auf die Warteliste, wenn der Kurs voll ist.
  if (isLoggedIn && course.hasFlatrate) {
    return (
      <>
        <FlatrateAddButton
          kursId={course.id}
          fragtRolleAb={course.roleQueryEnabled}
          vorkenntnisseHinweis={course.prerequisiteNote}
          istVoll={course.isFull}
          onWarteliste={() => setBookingOpen(true)}
          className="w-full border border-primary/30 bg-transparent text-primary hover:bg-primary hover:text-primary-foreground h-9 px-3 text-sm"
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
      {/* Ruhiger Umriss wie im Kurskatalog: Ein Stundenplan zeigt viele Kurse
          untereinander, und eine Akzentfarbe wirkt nur, solange sie selten
          ist. Das Rot bleibt der Buchung im Dialog vorbehalten. */}
      <Button
        size="sm"
        variant="outline"
        className="w-full border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
        onClick={handleClick}
      >
        Buchen
      </Button>

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
