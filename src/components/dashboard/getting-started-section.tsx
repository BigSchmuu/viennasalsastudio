"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations, useFormatter } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookingDialog, type BookingDialogCourse } from "@/components/booking/booking-dialog";
import type { StudioPricing } from "@/lib/pricing";
import { levelBadgeStyle, levelLabel } from "@/lib/constants/levels";

export type Kursvorschlag = {
  kurs: BookingDialogCourse;
  level: string | null;
  tanzstil: string | null;
  wochentag: string;
  startZeit: string;
  naechsterTermin: string | null;
};

/**
 * „Einstieg" — was ein frisch registrierter Kunde sieht.
 *
 * Der wichtigste Bildschirm der ganzen Seite: er entscheidet, ob aus einer
 * Registrierung eine Buchung wird. Deshalb genau eine offensichtliche
 * Handlung — Probestunde — und darunter höchstens drei Kurse, damit die
 * Wahl nicht zur Recherche wird.
 *
 * Der Aufruf ist kein eigener Knopf über der Liste, sondern der Knopf am
 * ersten Kurs. Ein Aufruf, der nur zur Kursauswahl scrollt, verschiebt die
 * Entscheidung bloß.
 */
export function GettingStartedSection({
  vorschlaege,
  hasMandate,
  hasReferralSource,
  pricing,
}: {
  vorschlaege: Kursvorschlag[];
  hasMandate: boolean;
  hasReferralSource: boolean;
  pricing: StudioPricing;
}) {
  const t = useTranslations("dashboard.start");
  const format = useFormatter();
  const [offenerKurs, setOffenerKurs] = useState<BookingDialogCourse | null>(null);

  return (
    <section>
      <Card className="border-primary/25 bg-primary/[0.04]">
        <CardContent className="p-6 text-center">
          <h2 className="font-heading text-2xl font-bold tracking-[-0.5px]">{t("trialTitle")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t("trialBody")}</p>

          {vorschlaege.length > 0 ? (
            <Button
              size="lg"
              className="mt-5"
              onClick={() => setOffenerKurs(vorschlaege[0].kurs)}
            >
              {t("trialCta")}
            </Button>
          ) : (
            <Button asChild size="lg" className="mt-5">
              <Link href="/kurse">{t("allCourses")}</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {vorschlaege.length > 0 ? (
        <>
          <h3 className="mt-6 font-heading text-lg font-bold tracking-[-0.5px]">
            {t("suggestionsHeading")}
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vorschlaege.map(({ kurs, level, tanzstil, wochentag, startZeit, naechsterTermin }) => (
              <Card key={kurs.id} className="border-border/60">
                <CardContent className="flex h-full flex-col p-4">
                  {level ? (
                    <span
                      className="mb-2 inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                      style={levelBadgeStyle(level)}
                    >
                      {levelLabel(level)}
                    </span>
                  ) : null}
                  <p className="font-medium leading-snug">{kurs.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {tanzstil ? `${tanzstil} · ` : ""}
                    {wochentag} {startZeit.slice(0, 5)}
                  </p>
                  {naechsterTermin ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("nextStart", {
                        date: format.dateTime(new Date(`${naechsterTermin}T12:00:00Z`), {
                          day: "2-digit",
                          month: "2-digit",
                          timeZone: "Europe/Vienna",
                        }),
                      })}
                    </p>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 w-full border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
                    onClick={() => setOffenerKurs(kurs)}
                  >
                    {t("trialCta")}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="mt-4 text-sm">
            <Link href="/kurse" className="font-medium text-primary hover:underline">
              {t("allCourses")}
            </Link>
          </p>
        </>
      ) : null}

      {offenerKurs ? (
        <BookingDialog
          open
          onOpenChange={(o) => !o && setOffenerKurs(null)}
          course={offenerKurs}
          hasMandate={hasMandate}
          hasReferralSource={hasReferralSource}
          pricing={pricing}
        />
      ) : null}
    </section>
  );
}
