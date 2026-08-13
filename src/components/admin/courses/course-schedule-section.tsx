"use client";

import { useState } from "react";
import {
  upsertCourseSchedule,
  deleteCourseSchedule,
  addSchedulePause,
  deleteSchedulePause,
} from "@/lib/actions/admin/course-schedule";
import { weekdayOptions, weekdayLabel } from "@/lib/constants/weekdays";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ScheduleData = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
};

export type PauseData = {
  id: string;
  pauseDate: string;
};

export function CourseScheduleSection({
  courseId,
  schedule: initialSchedule,
  pauses: initialPauses,
}: {
  courseId: string;
  schedule: ScheduleData | null;
  pauses: PauseData[];
}) {
  // Held locally and updated directly from Server Action results, rather
  // than relying on the parent CourseFormDialog's `course` prop refreshing
  // — that prop is captured in the parent's `editing` useState when the
  // dialog opens and does not update on its own after a save, even with
  // router.refresh(), since a fresh server render doesn't re-flow into
  // already-mounted client state.
  const [schedule, setSchedule] = useState(initialSchedule);
  const [pauses, setPauses] = useState(initialPauses);
  const [weekday, setWeekday] = useState(initialSchedule ? String(initialSchedule.weekday) : "");
  const [startTime, setStartTime] = useState(initialSchedule?.startTime.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(initialSchedule?.endTime.slice(0, 5) ?? "");
  const [pauseDate, setPauseDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("weekday", weekday);
      formData.set("start_time", startTime);
      formData.set("end_time", endTime);
      const result = await upsertCourseSchedule(courseId, formData);
      if ("error" in result) {
        setError(result.error);
      } else {
        setSchedule(result.schedule);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!schedule) return;
    setLoading(true);
    setError(null);
    try {
      const result = await deleteCourseSchedule(schedule.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSchedule(null);
      setPauses([]);
      setWeekday("");
      setStartTime("");
      setEndTime("");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddPause() {
    if (!schedule || !pauseDate) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("pause_date", pauseDate);
      const result = await addSchedulePause(schedule.id, formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setPauses((prev) => [...prev, result.pause]);
      setPauseDate("");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePause(pauseId: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await deleteSchedulePause(pauseId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setPauses((prev) => prev.filter((p) => p.id !== pauseId));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border p-4">
      <p className="text-sm font-medium">Wochentermin</p>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label htmlFor="schedule-weekday">Wochentag</Label>
          <Select value={weekday || undefined} onValueChange={setWeekday}>
            <SelectTrigger id="schedule-weekday">
              <SelectValue placeholder="Bitte wählen" />
            </SelectTrigger>
            <SelectContent>
              {weekdayOptions.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="schedule-start">Startzeit</Label>
          <Input
            id="schedule-start"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="schedule-end">Endzeit</Label>
          <Input id="schedule-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={loading || !weekday || !startTime || !endTime} onClick={handleSave}>
          {schedule ? "Termin speichern" : "Termin anlegen"}
        </Button>
        {schedule && (
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={handleDelete}>
            Termin entfernen
          </Button>
        )}
      </div>

      {schedule && (
        <div className="space-y-2 pt-2 border-t">
          <p className="text-sm font-medium">Pausierte Wochen</p>
          {pauses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine pausierten Wochen.</p>
          ) : (
            <ul className="space-y-1">
              {pauses.map((pause) => (
                <li key={pause.id} className="flex items-center justify-between text-sm">
                  <span>
                    {weekdayLabel(schedule.weekday)}, {pause.pauseDate}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    onClick={() => handleDeletePause(pause.id)}
                  >
                    Entfernen
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 items-end">
            <div className="space-y-1">
              <Label htmlFor="schedule-pause-date">Woche pausieren</Label>
              <Input
                id="schedule-pause-date"
                type="date"
                value={pauseDate}
                onChange={(e) => setPauseDate(e.target.value)}
              />
            </div>
            <Button type="button" variant="outline" size="sm" disabled={loading || !pauseDate} onClick={handleAddPause}>
              Hinzufügen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
