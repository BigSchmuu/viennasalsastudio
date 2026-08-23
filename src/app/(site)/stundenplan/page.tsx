import { createClient } from "@/lib/supabase/server";
import { WeeklyScheduleView, type ScheduleEntry } from "@/components/schedule/weekly-schedule-view";
import { jsDayToWeekday, formatDateLocal, selfCheckinWindow, upcomingOccurrences } from "@/lib/scheduling/dates";

const UPCOMING_OCCURRENCES_WINDOW = 4;

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [coursesRes, teachersRes, mySubsRes, myAttendanceRes, occupancyRes, dropinPricingRes, mandateRes, profileRes, myOpenBookingsRes, myWaitlistRes] =
    await Promise.all([
      supabase
        .from("courses")
        .select(
          "id, name, level, dance_styles(name), rooms(id, name, locations(name)), course_teachers(teacher_id), course_schedule!inner(id, weekday, start_time, end_time, course_schedule_pauses(pause_date)), course_entry_dates(entry_date), max_participants, prerequisite_note, role_query_enabled"
        ),
      supabase.from("teacher_directory").select("id, full_name"),
      // PROJ-25: own active course-bound subscriptions determine self-check-in eligibility.
      user
        ? supabase.from("subscriptions").select("course_id").eq("customer_id", user.id).eq("status", "active")
        : Promise.resolve({ data: null }),
      user ? supabase.rpc("get_my_todays_attendance") : Promise.resolve({ data: null }),
      // PROJ-26: occupancy is public/aggregate (same RPC /kurse already uses), needed regardless of login state.
      supabase.rpc("get_course_occupancy"),
      supabase.from("dropin_pricing").select("normal_price, student_price").limit(1).single(),
      user
        ? supabase.from("sepa_mandates").select("id").eq("customer_id", user.id).is("revoked_at", null).maybeSingle()
        : Promise.resolve({ data: null }),
      user ? supabase.from("profiles").select("referral_source").eq("id", user.id).single() : Promise.resolve({ data: null }),
      user
        ? supabase
            .from("course_bookings")
            .select("course_id")
            .eq("customer_id", user.id)
            .eq("type", "regular")
            .eq("status", "open")
        : Promise.resolve({ data: null }),
      user
        ? supabase.from("waitlist_entries").select("course_id").eq("customer_id", user.id)
        : Promise.resolve({ data: null }),
    ]);

  const teacherNameById = new Map(
    (teachersRes.data ?? []).map((t) => [t.id, t.full_name || "Unbenannter Lehrer"])
  );

  const myActiveCourseIds = new Set((mySubsRes.data ?? []).map((s) => s.course_id).filter(Boolean));
  const myTodaysStatusByCourse = new Map((myAttendanceRes.data ?? []).map((a) => [a.course_id, a.status]));

  // PROJ-26: booking-eligibility data, gathered once for all courses shown this week.
  const occupiedByCourse = new Map((occupancyRes.data ?? []).map((o) => [o.course_id, o.occupied_count]));
  const dropinPricing = {
    normal: dropinPricingRes.data?.normal_price ?? 20,
    student: dropinPricingRes.data?.student_price ?? 15,
  };
  const hasMandate = !!mandateRes.data;
  const hasReferralSource = !!profileRes.data?.referral_source;
  const myOpenRegularCourseIds = new Set((myOpenBookingsRes.data ?? []).map((b) => b.course_id));
  const myWaitlistCourseIds = new Set((myWaitlistRes.data ?? []).map((w) => w.course_id));

  const weekDates = currentWeekDates();
  const todayDateString = formatDateLocal(new Date());
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
      roomId: course.rooms?.id ?? "unassigned",
      roomName: course.rooms?.name ?? null,
      teacherNames: course.course_teachers
        .map((ct) => teacherNameById.get(ct.teacher_id))
        .filter((name): name is string => Boolean(name)),
      startTime: schedule.start_time,
      endTime: schedule.end_time,
      prerequisiteNote: course.prerequisite_note,
    };

    if (thisWeekDate === todayDateString && myActiveCourseIds.has(course.id)) {
      const { opensAt, endsAt } = selfCheckinWindow(thisWeekDate, schedule.start_time, schedule.end_time);
      entry.selfCheckin = {
        opensAtIso: opensAt.toISOString(),
        endsAtIso: endsAt.toISOString(),
        checkedIn: myTodaysStatusByCourse.get(course.id) === "present",
      };
    } else if (!myActiveCourseIds.has(course.id)) {
      // PROJ-26: booking is only offered when the customer doesn't already
      // have an active subscription for this course (self-check-in shows instead).
      entry.booking = {
        entryDates: (course.course_entry_dates ?? []).map((d) => d.entry_date).sort(),
        nextOccurrenceDates: upcomingOccurrences(schedule.weekday, {
          count: UPCOMING_OCCURRENCES_WINDOW,
          pauseDates: schedule.course_schedule_pauses.map((p) => p.pause_date),
        }),
        hasOpenRegularBooking: myOpenRegularCourseIds.has(course.id),
        // Immer false: dieser Zweig wird nur betreten, wenn der Kunde KEIN
        // aktives Abo für den Kurs hat (siehe Bedingung oben).
        hasActiveSubscription: false,
        isFull: course.max_participants !== null && (occupiedByCourse.get(course.id) ?? 0) >= course.max_participants,
        isOnWaitlist: myWaitlistCourseIds.has(course.id),
        isLoggedIn: !!user,
        hasMandate,
        hasReferralSource,
        dropinPricing,
        roleQueryEnabled: course.role_query_enabled,
      };
    }

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
