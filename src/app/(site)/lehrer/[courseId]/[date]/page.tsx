import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireCourseAccess } from "@/lib/auth/require-teacher";
import { formatDateLocal } from "@/lib/scheduling/dates";
import { AttendanceRoster, type RosterEntry } from "@/components/teacher/attendance-roster";
import { SessionNoteEditor } from "@/components/teacher/session-note-editor";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("de-AT", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function TeacherOccurrencePage({
  params,
}: {
  params: Promise<{ courseId: string; date: string }>;
}) {
  const { courseId, date } = await params;
  if (!DATE_RE.test(date)) {
    notFound();
  }

  const { supabase } = await requireCourseAccess(courseId);

  const { data: course } = await supabase.from("courses").select("id, name").eq("id", courseId).single();
  if (!course) {
    notFound();
  }

  const [rosterRes, noteRes, eligibleRes] = await Promise.all([
    supabase.rpc("get_course_attendance_roster", { p_course_id: courseId, p_occurrence_date: date }),
    supabase.rpc("get_course_session_note", { p_course_id: courseId, p_occurrence_date: date }),
    supabase.rpc("list_attendance_eligible_customers"),
  ]);

  const entries: RosterEntry[] = (rosterRes.data ?? []).map((r) => ({
    customerId: r.customer_id,
    fullName: r.full_name || "Unbenannter Kunde",
    source: r.source,
    status: r.status,
    selfCheckedIn: r.self_checked_in,
  }));

  const eligibleCustomers = (eligibleRes.data ?? []).map((c) => ({
    id: c.customer_id,
    name: c.full_name || "Unbenannter Kunde",
  }));

  const isFuture = date > formatDateLocal(new Date());

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <Button variant="link" className="px-0" asChild>
        <Link href={`/lehrer/${courseId}`}>← Zurück zu {course.name}</Link>
      </Button>

      <div>
        <h1 className="font-heading text-3xl font-bold">{course.name}</h1>
        <p className="text-muted-foreground">{formatDate(date)}</p>
      </div>

      <div className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Anwesenheit</h2>
        <AttendanceRoster
          courseId={courseId}
          occurrenceDate={date}
          entries={entries}
          eligibleCustomers={eligibleCustomers}
          isFuture={isFuture}
        />
      </div>

      <div className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Notiz</h2>
        <SessionNoteEditor courseId={courseId} occurrenceDate={date} initialNote={noteRes.data ?? ""} />
      </div>
    </div>
  );
}
