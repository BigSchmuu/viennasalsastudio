import { createClient } from "@/lib/supabase/server";
import { CourseManager, type CourseRow, type RoomOption, type SimpleOption } from "@/components/admin/courses/course-manager";
import type { TeacherOption } from "@/components/admin/courses/teacher-multi-select";

export default async function CoursesPage() {
  const supabase = await createClient();

  const [coursesRes, danceStylesRes, locationsRes, roomsRes, teachersRes] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, name, level, dance_style_id, dance_styles(name), room_id, rooms(name, location_id, locations(name)), course_teachers(teacher_id, profiles(full_name)), course_materials(content_video_url)"
      )
      .order("created_at", { ascending: true }),
    supabase.from("dance_styles").select("id, name").order("name", { ascending: true }),
    supabase.from("locations").select("id, name").order("name", { ascending: true }),
    supabase.from("rooms").select("id, name, location_id").order("name", { ascending: true }),
    supabase.from("profiles").select("id, full_name").eq("role", "teacher"),
  ]);

  const danceStyles: SimpleOption[] = danceStylesRes.data ?? [];
  const locations: SimpleOption[] = locationsRes.data ?? [];
  const rooms: RoomOption[] = (roomsRes.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    locationId: r.location_id,
  }));
  const teachers: TeacherOption[] = (teachersRes.data ?? []).map((t) => ({
    id: t.id,
    label: t.full_name || "Unbenannter Lehrer",
  }));

  const courses: CourseRow[] = (coursesRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    level: c.level,
    danceStyleId: c.dance_style_id,
    danceStyleName: c.dance_styles?.name ?? "—",
    roomId: c.room_id,
    roomName: c.rooms?.name ?? "—",
    locationId: c.rooms?.location_id ?? "",
    locationName: c.rooms?.locations?.name ?? "—",
    teacherIds: c.course_teachers.map((ct) => ct.teacher_id),
    teacherNames: c.course_teachers.map((ct) => ct.profiles?.full_name || "Unbenannter Lehrer"),
    videoUrl: c.course_materials?.content_video_url ?? null,
  }));

  return (
    <CourseManager
      courses={courses}
      danceStyles={danceStyles}
      locations={locations}
      rooms={rooms}
      teachers={teachers}
    />
  );
}
