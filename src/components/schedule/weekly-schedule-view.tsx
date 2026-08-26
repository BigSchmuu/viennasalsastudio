"use client";

import { useMemo, useState } from "react";
import { weekdayOptions } from "@/lib/constants/weekdays";
import { levelLabel, levelBadgeStyle } from "@/lib/constants/levels";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SelfCheckinButton } from "@/components/schedule/self-checkin-button";
import { ScheduleBookingButton } from "@/components/schedule/schedule-booking-button";
import type { StudioPricing } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export type ScheduleEntry = {
  courseId: string;
  courseName: string;
  danceStyleName: string;
  level: string | null;
  locationId: string;
  locationName: string;
  roomId: string;
  roomName: string | null;
  teacherNames: string[];
  startTime: string;
  endTime: string;
  // PROJ-27: shown on the card whenever set, independent of booking/self-checkin.
  prerequisiteNote: string | null;
  // PROJ-25: only set for today's occurrence of a course the logged-in
  // customer has an active subscription for.
  selfCheckin?: { opensAtIso: string; endsAtIso: string; checkedIn: boolean };
  // PROJ-26: only set when the customer does NOT already have an active
  // subscription for this course (mutually exclusive with selfCheckin).
  booking?: {
    entryDates: string[];
    nextOccurrenceDates: string[];
    /** Eigener Kurspreis; `null` = Standardpreis (PROJ-41). */
    price: number | null;
    hasOpenRegularBooking: boolean;
    hasActiveSubscription: boolean;
    isFull: boolean;
    isOnWaitlist: boolean;
    isLoggedIn: boolean;
    hasMandate: boolean;
    hasReferralSource: boolean;
    pricing: StudioPricing;
    roleQueryEnabled: boolean;
  };
};

const ALLE_STANDORTE = "__alle__";

function formatTime(time: string): string {
  return time.slice(0, 5);
}

function minutesFromTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function ScheduleCard({ entry }: { entry: ScheduleEntry }) {
  const t = useTranslations("schedule");
  return (
    <Card className="rounded-card border-border/70 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-lg">
      <CardHeader>
        {/* Die Uhrzeit steht an der Zeitschiene links, nicht noch einmal auf
            jeder Karte daneben. */}
        <CardTitle className="text-lg">{entry.courseName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{entry.danceStyleName}</Badge>
          <Badge variant="outline" style={levelBadgeStyle(entry.level)}>
            {levelLabel(entry.level)}
          </Badge>
          {entry.booking?.isFull && <Badge variant="destructive">{t("soldOut")}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          {entry.roomName ? `${entry.locationName} · ${entry.roomName}` : entry.locationName}
        </p>
        {/* Ein noch offener Lehrer bleibt sichtbar (PROJ-6), tritt aber zurück. */}
        {entry.teacherNames.length > 0 ? (
          <p className="text-sm text-muted-foreground">{entry.teacherNames.join(", ")}</p>
        ) : (
          <p className="text-xs text-muted-foreground/70">{t("teacherTba")}</p>
        )}
        {entry.prerequisiteNote && (
          <p className="text-xs bg-muted rounded-md px-2 py-1">{entry.prerequisiteNote}</p>
        )}
        {entry.selfCheckin && (
          <SelfCheckinButton
            courseId={entry.courseId}
            opensAtIso={entry.selfCheckin.opensAtIso}
            endsAtIso={entry.selfCheckin.endsAtIso}
            initialCheckedIn={entry.selfCheckin.checkedIn}
          />
        )}
        {entry.booking && (
          <ScheduleBookingButton
            course={{
              id: entry.courseId,
              name: entry.courseName,
              entryDates: entry.booking.entryDates,
              nextOccurrenceDates: entry.booking.nextOccurrenceDates,
              price: entry.booking.price,
              hasOpenRegularBooking: entry.booking.hasOpenRegularBooking,
              hasActiveSubscription: entry.booking.hasActiveSubscription,
              isFull: entry.booking.isFull,
              isOnWaitlist: entry.booking.isOnWaitlist,
              prerequisiteNote: entry.prerequisiteNote,
              roleQueryEnabled: entry.booking.roleQueryEnabled,
            }}
            isLoggedIn={entry.booking.isLoggedIn}
            hasMandate={entry.booking.hasMandate}
            hasReferralSource={entry.booking.hasReferralSource}
            pricing={entry.booking.pricing}
          />
        )}
      </CardContent>
    </Card>
  );
}


/**
 * Ein Tag als Zeitschiene (Designüberarbeitung 2026-08).
 *
 * Vorher standen die Säle als Spalten nebeneinander, jede um die Differenz
 * ihrer ersten Anfangszeit nach unten versetzt. Das las sich am Rechner
 * halbwegs, war am Handy unbenutzbar — vier Spalten auf 390 px — und der
 * Versatz richtete ohnehin nur die erste Karte je Spalte aus.
 *
 * Jetzt führt die Zeit: Kurse zur selben Uhrzeit stehen nebeneinander, jede
 * Uhrzeit einmal links an der Schiene. Am Handy klappt die Schiene über die
 * Karten, statt sie zu verdrängen.
 */
function DayTimeline({ entries }: { entries: ScheduleEntry[] }) {
  const t = useTranslations("schedule");

  const slots = new Map<string, ScheduleEntry[]>();
  for (const entry of entries) {
    if (!slots.has(entry.startTime)) slots.set(entry.startTime, []);
    slots.get(entry.startTime)!.push(entry);
  }
  const startzeiten = [...slots.keys()].sort((a, b) => minutesFromTime(a) - minutesFromTime(b));

  return (
    <div className="space-y-8">
      {startzeiten.map((zeit) => {
        const imSlot = slots.get(zeit)!;
        // Das späteste Ende der gleichzeitig startenden Kurse.
        const ende = imSlot
          .map((e) => e.endTime)
          .sort((a, b) => minutesFromTime(b) - minutesFromTime(a))[0];
        return (
          <div
            key={zeit}
            // Benennt den Abschnitt nach seiner Anfangszeit — so kann ein Test
            // eine Uhrzeit samt ihren Kursen greifen, ohne über Klassennamen zu
            // raten.
            data-zeitschiene={formatTime(zeit)}
            className="grid gap-3 sm:grid-cols-[6rem_1fr] sm:gap-5"
          >
            <div className="flex items-baseline gap-2 sm:block">
              <p className="font-heading text-xl font-bold tabular-nums leading-none">{formatTime(zeit)}</p>
              <p className="text-xs text-muted-foreground tabular-nums sm:mt-1">
                {t("until")} {formatTime(ende)}
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {imSlot.map((entry) => (
                <ScheduleCard key={entry.courseId} entry={entry} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function WeeklyScheduleView({
  entriesByWeekday,
  todayWeekday,
}: {
  entriesByWeekday: Record<number, ScheduleEntry[]>;
  todayWeekday: number;
}) {
  const [activeDay, setActiveDay] = useState(String(todayWeekday));
  const [standort, setStandort] = useState(ALLE_STANDORTE);

  const t = useTranslations("schedule");
  const tag = useTranslations("weekdays");

  // Die Standorte, an denen diese Woche überhaupt etwas stattfindet.
  const standorte = useMemo(() => {
    const gefunden = new Map<string, string>();
    for (const eintrag of Object.values(entriesByWeekday).flat()) {
      gefunden.set(eintrag.locationId, eintrag.locationName);
    }
    return [...gefunden].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [entriesByWeekday]);

  return (
    <Tabs value={activeDay} onValueChange={setActiveDay}>
      {/* Erst ab zwei Standorten sinnvoll — sonst wäre es eine Auswahl ohne
          Wahl. Sie steht über den Wochentagen, weil sie für die ganze Woche
          gilt und nicht je Tag neu getroffen wird. */}
      {standorte.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {[{ id: ALLE_STANDORTE, name: t("allLocations") }, ...standorte].map((ort) => (
            <button
              key={ort.id}
              type="button"
              onClick={() => setStandort(ort.id)}
              aria-pressed={standort === ort.id}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                standort === ort.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {ort.name}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <TabsList>
          {weekdayOptions.map((day) => (
            <TabsTrigger key={day.value} value={String(day.value)}>
              {tag(String(day.value))}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {weekdayOptions.map((day) => {
        const alle = entriesByWeekday[day.value] ?? [];
        const entries =
          standort === ALLE_STANDORTE ? alle : alle.filter((e) => e.locationId === standort);
        return (
          <TabsContent key={day.value} value={String(day.value)} className="mt-6">
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {t("emptyDay")}
              </p>
            ) : (
              <DayTimeline entries={entries} />
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
