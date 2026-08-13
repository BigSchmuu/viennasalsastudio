"use client";

import { useState } from "react";
import { weekdayOptions } from "@/lib/constants/weekdays";
import { levelLabel, levelColor } from "@/lib/constants/levels";
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

function formatTime(time: string): string {
  return time.slice(0, 5);
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
          <TabsContent key={day.value} value={String(day.value)} className="space-y-3 mt-4">
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Keine Kurse an diesem Tag.
              </p>
            ) : (
              entries.map((entry) => (
                <Card key={entry.courseId}>
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
                      <Badge style={{ backgroundColor: levelColor(entry.level), color: "white" }}>
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
              ))
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
