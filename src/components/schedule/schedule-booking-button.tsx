"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookingDialog, type BookingDialogCourse } from "@/components/booking/booking-dialog";
import { Button } from "@/components/ui/button";

export function ScheduleBookingButton({
  course,
  isLoggedIn,
  hasMandate,
  hasReferralSource,
  dropinPricing,
}: {
  course: BookingDialogCourse;
  isLoggedIn: boolean;
  hasMandate: boolean;
  hasReferralSource: boolean;
  dropinPricing: { normal: number; student: number };
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
      <Button size="sm" className="w-full" onClick={handleClick}>
        Buchen
      </Button>

      {bookingOpen && (
        <BookingDialog
          open={bookingOpen}
          onOpenChange={setBookingOpen}
          course={course}
          hasMandate={hasMandate}
          hasReferralSource={hasReferralSource}
          dropinPricing={dropinPricing}
        />
      )}
    </>
  );
}
