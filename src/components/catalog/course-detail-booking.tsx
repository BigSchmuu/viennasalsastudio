"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookingDialog } from "@/components/booking/booking-dialog";
import { Button } from "@/components/ui/button";

export type CourseDetailData = {
  id: string;
  name: string;
  entryDates: string[];
  nextOccurrenceDates: string[];
  hasOpenRegularBooking: boolean;
  isFull: boolean;
  isOnWaitlist: boolean;
  prerequisiteNote: string | null;
};

export function CourseDetailBooking({
  course,
  isLoggedIn,
  hasMandate,
  hasReferralSource,
  dropinPricing,
}: {
  course: CourseDetailData;
  isLoggedIn: boolean;
  hasMandate: boolean;
  hasReferralSource: boolean;
  dropinPricing: { normal: number; student: number };
}) {
  const router = useRouter();
  const [bookingOpen, setBookingOpen] = useState(false);

  function handleBook() {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/kurse/${course.id}`);
      return;
    }
    setBookingOpen(true);
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
          dropinPricing={dropinPricing}
        />
      )}
    </>
  );
}
