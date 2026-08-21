import { createClient } from "@/lib/supabase/server";
import { CourseCatalog, type CatalogCourseRow, type SimpleOption } from "@/components/catalog/course-catalog";
import { upcomingOccurrences } from "@/lib/scheduling/dates";

const UPCOMING_OCCURRENCES_WINDOW = 4;

export default async function KurskatalogPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [coursesRes, danceStylesRes, locationsRes, teachersRes, pricingRes, occupancyRes] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, name, level, dance_style_id, dance_styles(name), room_id, rooms(name, location_id, locations(name)), course_teachers(teacher_id), course_schedule(weekday, course_schedule_pauses(pause_date)), course_entry_dates(entry_date), max_participants, prerequisite_note, role_query_enabled"
      )
      .order("created_at", { ascending: true }),
    supabase.from("dance_styles").select("id, name").order("name", { ascending: true }),
    supabase.from("locations").select("id, name").order("name", { ascending: true }),
    supabase.from("teacher_directory").select("id, full_name"),
    supabase.from("dropin_pricing").select("normal_price, student_price").limit(1).single(),
    // subscriptions/course_bookings are RLS-scoped to "own row or admin", so a
    // plain query here would only ever see the viewer's own occupancy — this
    // SECURITY DEFINER function returns aggregate counts only (no customer
    // data), which is why it's safe to call for anonymous visitors too.
    supabase.rpc("get_course_occupancy"),
  ]);

  const occupiedByCourse = new Map<string, number>(
    (occupancyRes.data ?? []).map((row) => [row.course_id, row.occupied_count])
  );

  const danceStyles: SimpleOption[] = danceStylesRes.data ?? [];
  const locations: SimpleOption[] = locationsRes.data ?? [];
  const teacherNameById = new Map(
    (teachersRes.data ?? []).map((t) => [t.id, t.full_name || "Unbenannter Lehrer"])
  );

  let hasMandate = false;
  let hasReferralSource = false;
  let openRegularCourseIds = new Set<string>();
  let waitlistCourseIds = new Set<string>();

  if (user) {
    const [mandateRes, profileRes, bookingsRes, waitlistRes] = await Promise.all([
      supabase.from("sepa_mandates").select("id").eq("customer_id", user.id).is("revoked_at", null).maybeSingle(),
      supabase.from("profiles").select("referral_source").eq("id", user.id).single(),
      supabase
        .from("course_bookings")
        .select("course_id")
        .eq("customer_id", user.id)
        .eq("type", "regular")
        .eq("status", "open"),
      supabase.from("waitlist_entries").select("course_id").eq("customer_id", user.id),
    ]);
    hasMandate = !!mandateRes.data;
    hasReferralSource = !!profileRes.data?.referral_source;
    openRegularCourseIds = new Set((bookingsRes.data ?? []).map((b) => b.course_id));
    waitlistCourseIds = new Set((waitlistRes.data ?? []).map((w) => w.course_id));
  }

  const courses: CatalogCourseRow[] = (coursesRes.data ?? []).map((c) => {
    const schedule = c.course_schedule;
    const nextDates = schedule
      ? upcomingOccurrences(schedule.weekday, {
          count: UPCOMING_OCCURRENCES_WINDOW,
          pauseDates: schedule.course_schedule_pauses.map((p) => p.pause_date),
        })
      : [];

    return {
      id: c.id,
      name: c.name,
      danceStyleId: c.dance_style_id,
      danceStyleName: c.dance_styles?.name ?? "—",
      level: c.level,
      locationId: c.rooms?.location_id ?? "",
      locationName: c.rooms?.locations?.name ?? "—",
      roomName: c.rooms?.name ?? null,
      teacherNames: c.course_teachers
        .map((ct) => teacherNameById.get(ct.teacher_id))
        .filter((name): name is string => Boolean(name)),
      nextOccurrenceDates: nextDates,
      entryDates: (c.course_entry_dates ?? []).map((d) => d.entry_date).sort(),
      hasOpenRegularBooking: openRegularCourseIds.has(c.id),
      isFull: c.max_participants !== null && (occupiedByCourse.get(c.id) ?? 0) >= c.max_participants,
      isOnWaitlist: waitlistCourseIds.has(c.id),
      prerequisiteNote: c.prerequisite_note,
      roleQueryEnabled: c.role_query_enabled,
    };
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Kurse</h1>
        <p className="text-muted-foreground">Entdecke unser Kursangebot.</p>
      </div>
      <CourseCatalog
        courses={courses}
        danceStyles={danceStyles}
        locations={locations}
        isLoggedIn={!!user}
        hasMandate={hasMandate}
        hasReferralSource={hasReferralSource}
        dropinPricing={{
          normal: pricingRes.data?.normal_price ?? 20,
          student: pricingRes.data?.student_price ?? 15,
        }}
      />
    </div>
  );
}
