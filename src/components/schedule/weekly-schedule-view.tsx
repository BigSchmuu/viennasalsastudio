"use client";

import { useState } from "react";
import { weekdayOptions } from "@/lib/constants/weekdays";
import { levelLabel, levelColor, levelBadgeStyle } from "@/lib/constants/levels";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SelfCheckinButton } from "@/components/schedule/self-checkin-button";
import { ScheduleBookingButton } from "@/components/schedule/schedule-booking-button";

export type ScheduleEntry = {
  courseId: string;
  courseName: string;
  danceStyleName: string;
  level: string | null;
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
    hasOpenRegularBooking: boolean;
    isFull: boolean;
    isOnWaitlist: boolean;
    isLoggedIn: boolean;
    hasMandate: boolean;
    hasReferralSource: boolean;
    dropinPricing: { normal: number; student: number };
    roleQueryEnabled: boolean;
  };
};

// Vertical offset per minute of start-time difference between rooms —
// mirrors the marketing website's day-timeline/day-track layout, applied
// per Saal instead of per start-minute.
const PX_PER_MINUTE = 3;

function formatTime(time: string): string {
  return time.slice(0, 5);
}

function minutesFromTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Extracts the number from a "Saal N" room name for left-to-right ordering
 * (Saal 1, Saal 2, Saal 3, ...). Rooms that don't follow this naming fall
 * back to alphabetical order after all numbered Säle. */
function saalNumber(roomName: string | null): number {
  const match = roomName?.match(/saal\s*(\d+)/i);
  return match ? Number(match[1]) : Infinity;
}

function ScheduleCard({ entry }: { entry: ScheduleEntry }) {
  return (
    <Card
      className="border-l-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
      style={{ borderLeftColor: levelColor(entry.level) }}
    >
      <CardHeader>
        <CardTitle className="flex items-baseline justify-between gap-2 text-lg">
          <span>{entry.courseName}</span>
          <span className="text-sm font-normal text-muted-foreground">
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
          {entry.booking?.isFull && <Badge variant="destructive">Ausgebucht</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {entry.roomName ? `${entry.locationName} · ${entry.roomName}` : entry.locationName}
        </p>
        <p className="text-sm text-muted-foreground">
          {entry.teacherNames.length > 0
            ? entry.teacherNames.join(", ")
            : "Lehrer wird noch bekanntgegeben"}
        </p>
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
              hasOpenRegularBooking: entry.booking.hasOpenRegularBooking,
              isFull: entry.booking.isFull,
              isOnWaitlist: entry.booking.isOnWaitlist,
              prerequisiteNote: entry.prerequisiteNote,
              roleQueryEnabled: entry.booking.roleQueryEnabled,
            }}
            isLoggedIn={entry.booking.isLoggedIn}
            hasMandate={entry.booking.hasMandate}
            hasReferralSource={entry.booking.hasReferralSource}
            dropinPricing={entry.booking.dropinPricing}
          />
        )}
      </CardContent>
    </Card>
  );
}

/** Entries sharing the exact same start time render side by side; otherwise stacked. */
function ScheduleSlots({ entries }: { entries: ScheduleEntry[] }) {
  const slots = new Map<string, ScheduleEntry[]>();
  for (const entry of entries) {
    const key = entry.startTime;
    if (!slots.has(key)) slots.set(key, []);
    slots.get(key)!.push(entry);
  }
  const sortedStartTimes = [...slots.keys()].sort(
    (a, b) => minutesFromTime(a) - minutesFromTime(b)
  );

  return (
    <div className="space-y-3">
      {sortedStartTimes.map((startTime) => {
        const slotEntries = slots.get(startTime)!;
        return (
          <div key={startTime} className="flex flex-wrap gap-3">
            {slotEntries.map((entry) => (
              <div key={entry.courseId} className="min-w-[240px] flex-1">
                <ScheduleCard entry={entry} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** Groups a day's entries into side-by-side columns by Saal (Saal 1 always
 * left, Saal 2 right of it, and so on), each column vertically offset to
 * reflect how much later its earliest course starts relative to the day's
 * overall earliest course — mirrors the marketing website's day-timeline
 * layout. Falls back to a single stacked list when only one room is used
 * that day. */
function DaySchedule({ entries }: { entries: ScheduleEntry[] }) {
  const rooms = new Map<string, { name: string; entries: ScheduleEntry[] }>();
  for (const entry of entries) {
    if (!rooms.has(entry.roomId)) {
      rooms.set(entry.roomId, { name: entry.roomName ?? "Ohne Saal", entries: [] });
    }
    rooms.get(entry.roomId)!.entries.push(entry);
  }

  const roomIds = [...rooms.keys()].sort((a, b) => {
    const roomA = rooms.get(a)!;
    const roomB = rooms.get(b)!;
    const numA = saalNumber(roomA.name);
    const numB = saalNumber(roomB.name);
    if (numA !== numB) return numA - numB;
    return roomA.name.localeCompare(roomB.name);
  });

  if (roomIds.length <= 1) {
    return <ScheduleSlots entries={entries} />;
  }

  const dayEarliestStart = Math.min(...entries.map((e) => minutesFromTime(e.startTime)));

  return (
    <div
      className="grid gap-3 items-start overflow-x-auto"
      style={{ gridTemplateColumns: `repeat(${roomIds.length}, minmax(240px, 1fr))` }}
    >
      {roomIds.map((roomId) => {
        const room = rooms.get(roomId)!;
        const roomEarliestStart = Math.min(...room.entries.map((e) => minutesFromTime(e.startTime)));
        const offsetPx = (roomEarliestStart - dayEarliestStart) * PX_PER_MINUTE;
        return (
          <div key={roomId}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {room.name}
            </p>
            <div style={{ marginTop: offsetPx }}>
              <ScheduleSlots entries={room.entries} />
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

  return (
    <Tabs value={activeDay} onValueChange={setActiveDay}>
      <div className="overflow-x-auto">
        <TabsList>
          {weekdayOptions.map((day) => (
            <TabsTrigger key={day.value} value={String(day.value)}>
              {day.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {weekdayOptions.map((day) => {
        const entries = entriesByWeekday[day.value] ?? [];
        return (
          <TabsContent key={day.value} value={String(day.value)} className="mt-4">
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Keine Kurse an diesem Tag.
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
