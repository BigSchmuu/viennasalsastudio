import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireCourseAccess } from "@/lib/auth/require-teacher";
import { formatDateLocal, jsDayToWeekday, pastOccurrences } from "@/lib/scheduling/dates";
import { AttendanceMatrix, type MatrixColumn, type MatrixRow, type MatrixCell } from "@/components/teacher/attendance-matrix";

const PAST_WINDOW = 8;

type RosterRow = {
  customer_id: string;
  full_name: string | null;
  source: string;
  status: "present" | "absent" | null;
  self_checked_in: boolean;
};

export default async function TeacherCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { supabase } = await requireCourseAccess(courseId);

  const { data: course } = await supabase
    .from("courses")
    .select("id, name, course_schedule(weekday, course_schedule_pauses(pause_date))")
    .eq("id", courseId)
    .single();

  if (!course) {
    notFound();
  }

  const schedule = course.course_schedule;

  let columns: MatrixColumn[] = [];
  let rows: MatrixRow[] = [];
  let eligibleCustomers: { id: string; name: string }[] = [];

  if (schedule) {
    const pauseDates = schedule.course_schedule_pauses.map((p) => p.pause_date);
    const todayDate = formatDateLocal(new Date());
    const isTodayOccurrence = jsDayToWeekday(new Date().getDay()) === schedule.weekday && !pauseDates.includes(todayDate);

    const past = pastOccurrences(schedule.weekday, { count: PAST_WINDOW, pauseDates });
    const chronologicalPast = [...past].reverse();
    const allDates = isTodayOccurrence ? [...chronologicalPast, todayDate] : chronologicalPast;

    const [perDate, eligibleRes] = await Promise.all([
      Promise.all(
        allDates.map(async (date) => {
          const [rosterRes, noteRes] = await Promise.all([
            supabase.rpc("get_course_attendance_roster", { p_course_id: courseId, p_occurrence_date: date }),
            supabase.rpc("get_course_session_note", { p_course_id: courseId, p_occurrence_date: date }),
          ]);
          return { date, roster: (rosterRes.data ?? []) as RosterRow[], note: noteRes.data ?? "" };
        })
      ),
      supabase.rpc("list_attendance_eligible_customers"),
    ]);

    const customersById = new Map<string, string>();
    const cellsByCustomer = new Map<string, Record<string, MatrixCell>>();

    for (const { date, roster } of perDate) {
      for (const r of roster) {
        const name = r.full_name || "Unbenannter Kunde";
        customersById.set(r.customer_id, name);
        const existing = cellsByCustomer.get(r.customer_id) ?? {};
        existing[date] = { status: r.status, source: r.source, selfCheckedIn: r.self_checked_in };
        cellsByCustomer.set(r.customer_id, existing);
      }
    }

    rows = Array.from(customersById.entries()).map(([customerId, fullName]) => ({
      customerId,
      fullName,
      cells: cellsByCustomer.get(customerId) ?? {},
    }));

    columns = perDate.map(({ date, note }) => ({
      date,
      isToday: date === todayDate,
      initialNote: note,
    }));

    eligibleCustomers = (eligibleRes.data ?? []).map((c) => ({
      id: c.customer_id,
      name: c.full_name || "Unbenannter Kunde",
    }));
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      <Button variant="link" className="px-0" asChild>
        <Link href="/lehrer">← Zurück zu Meine Kurse</Link>
      </Button>

      <h1 className="font-heading text-3xl font-bold">{course.name}</h1>

      {!schedule ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Für diesen Kurs ist noch kein Wochentermin hinterlegt.
        </p>
      ) : (
        <AttendanceMatrix courseId={course.id} columns={columns} rows={rows} eligibleCustomers={eligibleCustomers} />
      )}
    </div>
  );
}
