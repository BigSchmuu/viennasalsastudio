"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookingDialog, type BookingDialogCourse } from "@/components/booking/booking-dialog";
import { Button } from "@/components/ui/button";
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
