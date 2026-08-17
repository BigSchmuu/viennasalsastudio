import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireCourseAccess } from "@/lib/auth/require-teacher";
import { upcomingOccurrences, pastOccurrences } from "@/lib/scheduling/dates";
import { CourseOccurrenceList } from "@/components/teacher/course-occurrence-list";

const UPCOMING_WINDOW = 4;
const PAST_WINDOW = 8;

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
  const pauseDates = schedule?.course_schedule_pauses.map((p) => p.pause_date) ?? [];

  const upcoming = schedule ? upcomingOccurrences(schedule.weekday, { count: UPCOMING_WINDOW, pauseDates }) : [];
  const past = schedule ? pastOccurrences(schedule.weekday, { count: PAST_WINDOW, pauseDates }) : [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <Button variant="link" className="px-0" asChild>
        <Link href="/lehrer">← Zurück zu Meine Kurse</Link>
      </Button>

      <h1 className="font-heading text-3xl font-bold">{course.name}</h1>

      <CourseOccurrenceList courseId={course.id} upcoming={upcoming} past={past} />
    </div>
  );
}
