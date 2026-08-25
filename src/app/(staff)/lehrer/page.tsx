import { requireTeacher } from "@/lib/auth/require-teacher";
import { MyCoursesList, type MyCourseRow } from "@/components/teacher/my-courses-list";

export default async function MyCoursesPage() {
  const { supabase, user } = await requireTeacher();

  const { data: assignments } = await supabase
    .from("course_teachers")
    .select(
      "course_id, courses(id, name, level, dance_styles(name), rooms(name, locations(name)))"
    )
    .eq("teacher_id", user.id);

  const courses: MyCourseRow[] = (assignments ?? [])
    .map((a) => a.courses)
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .map((c) => ({
      id: c.id,
      name: c.name,
      level: c.level,
      danceStyleName: c.dance_styles?.name ?? "—",
      locationName: c.rooms?.locations?.name ?? "—",
      roomName: c.rooms?.name ?? null,
    }));

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Meine Kurse</h1>
        <p className="text-muted-foreground">Anwesenheit und Notizen für deine zugewiesenen Kurse.</p>
      </div>
      <MyCoursesList courses={courses} />
    </div>
  );
}
