"use client";

import { useState } from "react";
import { weekdayOptions } from "@/lib/constants/weekdays";
import { levelLabel, levelColor, levelBadgeStyle } from "@/lib/constants/levels";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export type ScheduleEntry = {
  courseId: string;
  courseName: string;
  danceStyleName: string;
  level: string | null;
  locationName: string;
  teacherNames: string[];
  startTime: string;
  endTime: string;
};

// Vertical offset per minute of start-time difference between tracks —
// mirrors the marketing website's day-timeline/day-track layout.
const PX_PER_MINUTE = 3;

function formatTime(time: string): string {
  return time.slice(0, 5);
}

function minutesFromTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutePart(time: string): number {
  return Number(time.split(":")[1]);
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
        </div>
        <p className="text-sm text-muted-foreground">{entry.locationName}</p>
        <p className="text-sm text-muted-foreground">
          {entry.teacherNames.length > 0
            ? entry.teacherNames.join(", ")
            : "Lehrer wird noch bekanntgegeben"}
        </p>
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

/** Groups a day's entries into side-by-side tracks by start-minute (:00 vs. :30 etc.),
 * each track vertically offset to reflect how much later its courses start —
 * mirrors the marketing website's day-timeline layout. Falls back to a single
 * stacked list when every course starts on the same minute mark. */
function DaySchedule({ entries }: { entries: ScheduleEntry[] }) {
  const tracks = new Map<number, ScheduleEntry[]>();
  for (const entry of entries) {
    const key = minutePart(entry.startTime);
    if (!tracks.has(key)) tracks.set(key, []);
    tracks.get(key)!.push(entry);
  }
  const minuteKeys = [...tracks.keys()].sort((a, b) => a - b);

  if (minuteKeys.length <= 1) {
    return <ScheduleSlots entries={entries} />;
  }

  const dayEarliestStart = Math.min(...entries.map((e) => minutesFromTime(e.startTime)));

  return (
    <div
      className="grid gap-3 items-start overflow-x-auto"
      style={{ gridTemplateColumns: `repeat(${minuteKeys.length}, minmax(220px, 1fr))` }}
    >
      {minuteKeys.map((minuteKey) => {
        const trackEntries = tracks.get(minuteKey)!;
        const trackEarliestStart = Math.min(...trackEntries.map((e) => minutesFromTime(e.startTime)));
        const offsetPx = (trackEarliestStart - dayEarliestStart) * PX_PER_MINUTE;
        return (
          <div key={minuteKey} style={{ marginTop: offsetPx }}>
            <ScheduleSlots entries={trackEntries} />
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
