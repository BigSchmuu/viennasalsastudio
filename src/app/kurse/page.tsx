import { createClient } from "@/lib/supabase/server";
import { CourseCatalog, type CatalogCourseRow, type SimpleOption } from "@/components/catalog/course-catalog";

export default async function KurskatalogPage() {
  const supabase = await createClient();

  const [coursesRes, danceStylesRes, locationsRes, teachersRes] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, name, level, dance_style_id, dance_styles(name), room_id, rooms(location_id, locations(name)), course_teachers(teacher_id)"
      )
      .order("created_at", { ascending: true }),
    supabase.from("dance_styles").select("id, name").order("name", { ascending: true }),
    supabase.from("locations").select("id, name").order("name", { ascending: true }),
    supabase.from("teacher_directory").select("id, full_name"),
  ]);

  const danceStyles: SimpleOption[] = danceStylesRes.data ?? [];
  const locations: SimpleOption[] = locationsRes.data ?? [];
  const teacherNameById = new Map(
    (teachersRes.data ?? []).map((t) => [t.id, t.full_name || "Unbenannter Lehrer"])
  );

  const courses: CatalogCourseRow[] = (coursesRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    danceStyleId: c.dance_style_id,
    danceStyleName: c.dance_styles?.name ?? "—",
    level: c.level,
    locationId: c.rooms?.location_id ?? "",
    locationName: c.rooms?.locations?.name ?? "—",
    teacherNames: c.course_teachers
      .map((ct) => teacherNameById.get(ct.teacher_id))
      .filter((name): name is string => Boolean(name)),
  }));

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Kurse</h1>
        <p className="text-muted-foreground">Entdecke unser Kursangebot.</p>
      </div>
      <CourseCatalog courses={courses} danceStyles={danceStyles} locations={locations} />
    </div>
  );
}
