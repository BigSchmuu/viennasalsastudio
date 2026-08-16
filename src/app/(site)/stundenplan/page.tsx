import { createClient } from "@/lib/supabase/server";
import { WeeklyScheduleView, type ScheduleEntry } from "@/components/schedule/weekly-schedule-view";
import { jsDayToWeekday, formatDateLocal } from "@/lib/scheduling/dates";

function currentWeekDates(): string[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - jsDayToWeekday(now.getDay()));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(formatDateLocal(d));
  }
  return dates;
}

export default async function StundenplanPage() {
  const supabase = await createClient();

  const [coursesRes, teachersRes] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, name, level, dance_styles(name), rooms(name, locations(name)), course_teachers(teacher_id), course_schedule!inner(id, weekday, start_time, end_time, course_schedule_pauses(pause_date))"
      ),
    supabase.from("teacher_directory").select("id, full_name"),
  ]);

  const teacherNameById = new Map(
    (teachersRes.data ?? []).map((t) => [t.id, t.full_name || "Unbenannter Lehrer"])
  );

  const weekDates = currentWeekDates();
  const entriesByWeekday: Record<number, ScheduleEntry[]> = {};

  for (const course of coursesRes.data ?? []) {
    const schedule = course.course_schedule;
    if (!schedule) continue;

    const thisWeekDate = weekDates[schedule.weekday];
    const isPausedThisWeek = schedule.course_schedule_pauses.some(
      (p) => p.pause_date === thisWeekDate
    );
    if (isPausedThisWeek) continue;

    const entry: ScheduleEntry = {
      courseId: course.id,
      courseName: course.name,
      danceStyleName: course.dance_styles?.name ?? "—",
      level: course.level,
      locationName: course.rooms?.locations?.name ?? "—",
      teacherNames: course.course_teachers
        .map((ct) => teacherNameById.get(ct.teacher_id))
        .filter((name): name is string => Boolean(name)),
      startTime: schedule.start_time,
      endTime: schedule.end_time,
    };

    if (!entriesByWeekday[schedule.weekday]) entriesByWeekday[schedule.weekday] = [];
    entriesByWeekday[schedule.weekday].push(entry);
  }

  for (const weekday of Object.keys(entriesByWeekday)) {
    entriesByWeekday[Number(weekday)].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  const todayWeekday = jsDayToWeekday(new Date().getDay());

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Stundenplan</h1>
        <p className="text-muted-foreground">Unser wöchentlicher Kursplan.</p>
      </div>
      <WeeklyScheduleView entriesByWeekday={entriesByWeekday} todayWeekday={todayWeekday} />
    </div>
  );
}
