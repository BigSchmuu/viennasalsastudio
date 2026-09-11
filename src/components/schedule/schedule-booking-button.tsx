"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookingDialog, type BookingDialogCourse } from "@/components/booking/booking-dialog";
import { Button } from "@/components/ui/button";
import { FlatrateCourseButton } from "@/components/booking/flatrate-course-button";
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
  // Der Satz steht im Namensraum „flatrate", weil er dort entstanden ist —
  // gemeint ist er allgemein, und zwei Fassungen desselben Satzes liefen
  // früher oder später auseinander.
  const t = useTranslations("flatrate");
  const [bookingOpen, setBookingOpen] = useState(false);

  function handleClick() {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/stundenplan`);
      return;
    }
    setBookingOpen(true);
  }

  // Wer mit einem kursgebundenen Abo drin sitzt, hat hier nichts zu tun: Sein
  // Abo hängt an genau diesem Kurs, heraus kommt er über „Umbuchen" oder
  // „Kündigen" im Profil, nicht mit einem Knopf am Stundenplan.
  //
  // Aber er soll es sehen. Ohne diese Zeile war eine Karte ohne Knopf
  // zweideutig: „ich bin drin" und „hier ist gerade nichts möglich" sahen
  // gleich aus — und gerade beim kursgebundenen Abo gibt es sonst nirgends im
  // Plan einen Hinweis darauf, wo man eigentlich hingehört.
  if (isLoggedIn && course.hasActiveSubscription && !course.hasFlatrate) {
    return <p className="text-sm text-muted-foreground">{t("alreadyIn")}</p>;
  }

  // PROJ-50: Ein Flatrate-Kunde bucht nicht, er trägt sich ein. Der Dialog
  // bleibt für ihn nur der Weg auf die Warteliste, wenn der Kurs voll ist.
  //
  // Und er kommt auf demselben Weg wieder heraus: Der Knopf bleibt stehen und
  // heißt dann „Aus meiner Flatrate entfernen". Der Rückweg gehört dorthin, wo
  // der Hinweg war — bis zum 2026-09-11 stand er nur im Kurskatalog.
  if (isLoggedIn && course.hasFlatrate) {
    return (
      <>
        {course.hasActiveSubscription && (
          <p className="mb-2 text-sm text-muted-foreground">{t("alreadyIn")}</p>
        )}
        <FlatrateCourseButton
          kursId={course.id}
          istDrin={course.hasActiveSubscription}
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
