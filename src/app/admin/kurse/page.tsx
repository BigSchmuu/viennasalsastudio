import { createClient } from "@/lib/supabase/server";
import {
  CourseManager,
  type CourseRow,
  type RoomOption,
  type SimpleOption,
  type VideoSetOption,
} from "@/components/admin/courses/course-manager";
import type { TeacherOption } from "@/components/admin/courses/teacher-multi-select";

export default async function CoursesPage() {
  const supabase = await createClient();

  const [
    coursesRes,
    danceStylesRes,
    locationsRes,
    roomsRes,
    teachersRes,
    videoSetsRes,
    activeSubsRes,
    openBookingsRes,
    waitlistRes,
  ] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, name, level, dance_style_id, dance_styles(name), room_id, rooms(name, location_id, locations(name)), course_teachers(teacher_id, profiles(full_name)), video_set_id, video_sets(name), course_schedule(id, weekday, start_time, end_time, course_schedule_pauses(id, pause_date)), course_entry_dates(id, entry_date), max_participants, price, prerequisite_note, role_query_enabled, max_role_difference"
      )
      .order("created_at", { ascending: true }),
    supabase.from("dance_styles").select("id, name").order("name", { ascending: true }),
    supabase.from("locations").select("id, name").order("name", { ascending: true }),
    supabase.from("rooms").select("id, name, location_id").order("name", { ascending: true }),
    supabase.from("profiles").select("id, full_name").eq("role", "teacher"),
    supabase.from("video_sets").select("id, name, level").order("name", { ascending: true }),
    supabase.from("subscriptions").select("course_id, course_bookings(dance_role)").eq("status", "active"),
    supabase
      .from("course_bookings")
      .select("course_id, dance_role")
      .eq("type", "regular")
      .eq("status", "open"),
    supabase
      .from("waitlist_entries")
      .select("id, course_id, customer_id, desired_plan, chosen_date, created_at, profiles(full_name)")
      .order("created_at", { ascending: true }),
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
  const videoSets: VideoSetOption[] = videoSetsRes.data ?? [];

  const occupiedByCourse = new Map<string, number>();
  for (const s of activeSubsRes.data ?? []) {
    if (!s.course_id) continue;
    occupiedByCourse.set(s.course_id, (occupiedByCourse.get(s.course_id) ?? 0) + 1);
  }
  for (const b of openBookingsRes.data ?? []) {
    if (!b.course_id) continue;
    occupiedByCourse.set(b.course_id, (occupiedByCourse.get(b.course_id) ?? 0) + 1);
  }

  const roleCountsByCourse = new Map<string, { leader: number; follower: number; both: number }>();
  function bumpRole(courseId: string | null | undefined, role: string | null | undefined) {
    if (!courseId) return;
    const counts = roleCountsByCourse.get(courseId) ?? { leader: 0, follower: 0, both: 0 };
    if (role === "leader") counts.leader += 1;
    else if (role === "follower") counts.follower += 1;
    else if (role === "both") counts.both += 1;
    roleCountsByCourse.set(courseId, counts);
  }
  for (const s of activeSubsRes.data ?? []) {
    bumpRole(s.course_id, s.course_bookings?.[0]?.dance_role);
  }
  for (const b of openBookingsRes.data ?? []) {
    bumpRole(b.course_id, b.dance_role);
  }

  const waitlistByCourse = new Map<string, CourseRow["waitlistEntries"]>();
  for (const w of waitlistRes.data ?? []) {
    const entries = waitlistByCourse.get(w.course_id) ?? [];
    entries.push({
      id: w.id,
      customerId: w.customer_id,
      customerName: w.profiles?.full_name || "Unbenannter Kunde",
      desiredPlan: w.desired_plan,
      chosenDate: w.chosen_date,
      createdAt: w.created_at,
    });
    waitlistByCourse.set(w.course_id, entries);
  }

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
    videoSetId: c.video_set_id,
    videoSetName: c.video_sets?.name ?? null,
    schedule: c.course_schedule
      ? {
          id: c.course_schedule.id,
          weekday: c.course_schedule.weekday,
          startTime: c.course_schedule.start_time,
          endTime: c.course_schedule.end_time,
        }
      : null,
    pauses: (c.course_schedule?.course_schedule_pauses ?? []).map((p) => ({
      id: p.id,
      pauseDate: p.pause_date,
    })),
    entryDates: (c.course_entry_dates ?? [])
      .map((d) => ({ id: d.id, entryDate: d.entry_date }))
      .sort((a, b) => a.entryDate.localeCompare(b.entryDate)),
    maxParticipants: c.max_participants,
    price: c.price,
    prerequisiteNote: c.prerequisite_note,
    occupiedCount: occupiedByCourse.get(c.id) ?? 0,
    waitlistEntries: waitlistByCourse.get(c.id) ?? [],
    roleQueryEnabled: c.role_query_enabled,
    maxRoleDifference: c.max_role_difference,
    roleCounts: roleCountsByCourse.get(c.id) ?? { leader: 0, follower: 0, both: 0 },
  }));

  return (
    <CourseManager
      courses={courses}
      danceStyles={danceStyles}
      locations={locations}
      rooms={rooms}
      teachers={teachers}
      videoSets={videoSets}
    />
  );
}
