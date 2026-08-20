"use server";

import { createClient } from "@/lib/supabase/server";
import { pastOccurrences } from "@/lib/scheduling/dates";

export type RosterRow = {
  customer_id: string;
  full_name: string | null;
  source: string;
  status: "present" | "absent" | null;
  self_checked_in: boolean;
};

export type LoadMoreResult =
  | { error: string }
  | { dates: { date: string; roster: RosterRow[]; note: string }[] };

const LOAD_MORE_COUNT = 4;

export async function loadMoreOccurrences(courseId: string, beforeDate: string): Promise<LoadMoreResult> {
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("course_schedule(weekday, course_schedule_pauses(pause_date))")
    .eq("id", courseId)
    .single();

  const schedule = course?.course_schedule;
  if (!schedule) {
    return { error: "Für diesen Kurs ist kein Wochentermin hinterlegt." };
  }

  const pauseDates = schedule.course_schedule_pauses.map((p) => p.pause_date);
  const dates = pastOccurrences(schedule.weekday, {
    count: LOAD_MORE_COUNT,
    pauseDates,
    before: new Date(beforeDate + "T00:00:00"),
  });

  const perDate = await Promise.all(
    dates.map(async (date) => {
      const [rosterRes, noteRes] = await Promise.all([
        supabase.rpc("get_course_attendance_roster", { p_course_id: courseId, p_occurrence_date: date }),
        supabase.rpc("get_course_session_note", { p_course_id: courseId, p_occurrence_date: date }),
      ]);
      return { date, rosterRes, noteRes };
    })
  );

  const failed = perDate.find((d) => d.rosterRes.error);
  if (failed) {
    return { error: "Weitere Termine konnten nicht geladen werden." };
  }

  return {
    dates: perDate.map(({ date, rosterRes, noteRes }) => ({
      date,
      roster: (rosterRes.data ?? []) as RosterRow[],
      note: noteRes.data ?? "",
    })),
  };
}
