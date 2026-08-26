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

/** Zieht die Nummer aus einem Saalnamen („Saal 2") für die Reihenfolge von
 * links nach rechts. Namen ohne Nummer stehen alphabetisch dahinter. */
function saalNumber(roomName: string | null): number {
  const match = roomName?.match(/saal\s*(\d+)/i);
  return match ? Number(match[1]) : Infinity;
}

function ScheduleCard({ entry }: { entry: ScheduleEntry }) {
  const t = useTranslations("schedule");
  return (
    <Card className="rounded-card border-border/70 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-lg">
      <CardHeader>
        <CardTitle className="flex items-baseline justify-between gap-2 text-lg">
          <span>{entry.courseName}</span>
          <span className="whitespace-nowrap text-sm font-normal tabular-nums text-muted-foreground">
            {formatTime(entry.startTime)}–{formatTime(entry.endTime)}
          </span>
        </CardTitle>
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


const PX_PER_MINUTE = 3;

/** Kurse mit gleicher Anfangszeit stehen innerhalb eines Saals nebeneinander. */
function SaalSpalte({ entries }: { entries: ScheduleEntry[] }) {
  const slots = new Map<string, ScheduleEntry[]>();
  for (const entry of entries) {
    if (!slots.has(entry.startTime)) slots.set(entry.startTime, []);
    slots.get(entry.startTime)!.push(entry);
  }
  const startzeiten = [...slots.keys()].sort((a, b) => minutesFromTime(a) - minutesFromTime(b));

  return (
    <div className="space-y-4">
      {startzeiten.map((zeit) => (
        <div key={zeit} className="flex flex-wrap gap-4">
          {slots.get(zeit)!.map((entry) => (
            <div key={entry.courseId} className="min-w-[240px] flex-1">
              <ScheduleCard entry={entry} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Ein Tag, nach Sälen aufgeteilt (Designüberarbeitung 2026-08).
 *
 * Die Säle stehen nebeneinander, und ein Saal, der später beginnt, startet
 * entsprechend tiefer — so sieht man auf einen Blick, was parallel läuft.
 *
 * Zwei Dinge sind dabei anders als vorher:
 *
 * Der Versatz ist auf eine Stunde begrenzt. Unbegrenzt schob ein einzelner
 * Kurs um 03:12 den Rest des Tages um über 2500 px nach unten, und dahinter
 * lag eine leere Fläche. Mehr als eine Stunde Vorsprung sagt ohnehin nichts
 * mehr aus, das die Uhrzeit auf der Karte nicht schon sagt.
 *
 * Und am Handy klappen die Säle untereinander statt nebeneinander: Vier
 * Spalten auf 390 px waren nicht lesbar, die letzte wurde abgeschnitten. Dort
 * entfällt auch der Versatz — untereinander bedeutet er nichts.
 */
function DaySchedule({ entries }: { entries: ScheduleEntry[] }) {
  const t = useTranslations("schedule");

  const raeume = new Map<string, { name: string; entries: ScheduleEntry[] }>();
  for (const entry of entries) {
    if (!raeume.has(entry.roomId)) {
      raeume.set(entry.roomId, { name: entry.roomName ?? t("noRoom"), entries: [] });
    }
    raeume.get(entry.roomId)!.entries.push(entry);
  }

  const raumIds = [...raeume.keys()].sort((a, b) => {
    const raumA = raeume.get(a)!;
    const raumB = raeume.get(b)!;
    const nrA = saalNumber(raumA.name);
    const nrB = saalNumber(raumB.name);
    if (nrA !== nrB) return nrA - nrB;
    return raumA.name.localeCompare(raumB.name);
  });

  if (raumIds.length <= 1) {
    return <SaalSpalte entries={entries} />;
  }

  const fruehesterStart = Math.min(...entries.map((e) => minutesFromTime(e.startTime)));
  const MAX_VERSATZ_PX = 60 * PX_PER_MINUTE;

  return (
    <div
      style={{ ["--spalten" as string]: `repeat(${raumIds.length}, minmax(240px, 1fr))` }}
      className="grid grid-cols-1 gap-8 sm:gap-5 sm:[grid-template-columns:var(--spalten)] sm:overflow-x-auto"
    >
      {raumIds.map((raumId) => {
        const raum = raeume.get(raumId)!;
        const raumStart = Math.min(...raum.entries.map((e) => minutesFromTime(e.startTime)));
        const versatzPx = Math.min((raumStart - fruehesterStart) * PX_PER_MINUTE, MAX_VERSATZ_PX);
        return (
          <div key={raumId}>
            <p className="nav-label mb-3 text-muted-foreground">{raum.name}</p>
            {/* Der Versatz greift erst ab sm — untereinander sagt er nichts. */}
            <div style={{ ["--versatz" as string]: `${versatzPx}px` }} className="sm:mt-[var(--versatz)]">
              <SaalSpalte entries={raum.entries} />
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
              <DaySchedule entries={entries} />
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
