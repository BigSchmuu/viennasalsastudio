import { createClient } from "@/lib/supabase/server";
import { ladeKurszugehoerigkeit } from "@/lib/flatrate/kurszugehoerigkeit";
import { ladeFerien, ladeFerienMitNamen, kurszeitraum } from "@/lib/scheduling/ferien";
import { imStundenplan, zeitraumhinweis, anstehendeFerien } from "@/lib/scheduling/kursanzeige";
import { WeeklyScheduleView, type ScheduleEntry } from "@/components/schedule/weekly-schedule-view";
import { jsDayToWeekday, formatDateLocal, upcomingOccurrences } from "@/lib/scheduling/dates";
import { heuteInWien, heuteAlsDatumInWien } from "@/lib/constants/zeitzone";
import { readStudioPricing } from "@/lib/pricing";
import { getTranslations } from "next-intl/server";
import { getViewer } from "@/lib/auth/viewer";

const UPCOMING_OCCURRENCES_WINDOW = 4;

function currentWeekDates(): string[] {
  // Der Wochentag muss der Wiener sein, nicht der des Servers (UTC).
  const now = heuteAlsDatumInWien();
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

  // Der Rahmen hat das schon ermittelt — getViewer() gibt innerhalb einer
  // Anfrage dieselbe Antwort zurück, ohne erneut zu fragen.
  const user = await getViewer();

  const [coursesRes, teachersRes, mySubsRes, occupancyRes, dropinPricingRes, mandateRes, profileRes, myOpenBookingsRes, myWaitlistRes] =
    await Promise.all([
      supabase
        .from("courses")
        .select(
          "id, name, level, dance_styles(name), rooms(id, name, locations(id, name)), course_teachers(teacher_id), course_schedule!inner(id, weekday, start_time, end_time, course_schedule_pauses(pause_date)), course_entry_dates(entry_date), max_participants, price, prerequisite_note, role_query_enabled, runs_from, runs_until, pending_name, pending_effective_date"
        ),
      supabase.from("teacher_directory").select("id, full_name"),
      // PROJ-25: In welchen Kursen der Kunde sitzt, entscheidet über den
      // Selbst-Check-in. Seit PROJ-50 über die gemeinsame Antwort — vorher
      // stand hier eine Abfrage auf `subscriptions.course_id`, und die ließ
      // einen Flatrate-Kunden leer ausgehen: kein Check-in, dafür überall
      // „Jetzt buchen".
      user
        ? ladeKurszugehoerigkeit(supabase, user.id)
        : Promise.resolve({ hatFlatrate: false, kursIds: new Set<string>(), videoKursIds: new Set<string>() }),
      // PROJ-26: occupancy is public/aggregate (same RPC /kurse already uses), needed regardless of login state.
      supabase.rpc("get_course_occupancy"),
      supabase.from("dropin_pricing").select("*").limit(1).single(),
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

  // Vor der ersten Verwendung, nicht erst vor der Ausgabe: Stand die
  // Deklaration weiter unten, warf die Zeile darunter „Cannot access before
  // initialization" — aber nur, wenn ein Lehrer keinen Namen hat, weil `||`
  // sonst kurzschließt. Genau so ist der Stundenplan am 2026-09-09 in
  // Produktion ausgefallen, als sich der Betreiber ohne hinterlegten Namen
  // als Lehrer eintrug.
  const texte = await getTranslations("schedule");

  const teacherNameById = new Map(
    (teachersRes.data ?? []).map((lehrer) => [lehrer.id, lehrer.full_name || texte("unnamedTeacher")])
  );

  const myActiveCourseIds = mySubsRes.kursIds;
  // PROJ-51: einmal für die ganze Woche geladen.
  const ferien = await ladeFerien(supabase);

  // PROJ-26: booking-eligibility data, gathered once for all courses shown this week.
  const occupiedByCourse = new Map((occupancyRes.data ?? []).map((o) => [o.course_id, o.occupied_count]));
  const pricing = readStudioPricing(dropinPricingRes.data);
  const hasMandate = !!mandateRes.data;
  const hasReferralSource = !!profileRes.data?.referral_source;
  const myOpenRegularCourseIds = new Set((myOpenBookingsRes.data ?? []).map((b) => b.course_id));
  const myWaitlistCourseIds = new Set((myWaitlistRes.data ?? []).map((w) => w.course_id));

  const weekDates = currentWeekDates();
  const entriesByWeekday: Record<number, ScheduleEntry[]> = {};

  const heute = heuteInWien();

  for (const course of coursesRes.data ?? []) {
    const schedule = course.course_schedule;
    if (!schedule) continue;

    // PROJ-51: Ein ausgelaufener Kurs steht nicht mehr im Plan, ein Kurs, der
    // erst in fünf Wochen beginnt, noch nicht. Das ist eine
    // Anzeigeentscheidung — ob ein einzelner Termin stattfindet, beantwortet
    // die Terminrechnung, nicht diese Zeile.
    if (!imStundenplan(kurszeitraum(course), heute)) continue;

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
      locationId: course.rooms?.locations?.id ?? "unassigned",
      locationName: course.rooms?.locations?.name ?? "—",
      roomId: course.rooms?.id ?? "unassigned",
      roomName: course.rooms?.name ?? null,
      teacherNames: course.course_teachers
        .map((ct) => teacherNameById.get(ct.teacher_id))
        .filter((name): name is string => Boolean(name)),
      startTime: schedule.start_time,
      endTime: schedule.end_time,
      prerequisiteNote: course.prerequisite_note,
      runsUntil: course.runs_until,
      zeitraumHinweis: zeitraumhinweis(
        {
          zeitraum: kurszeitraum(course),
          umwandlung:
            course.pending_name && course.pending_effective_date
              ? { name: course.pending_name, datum: course.pending_effective_date }
              : null,
        },
        heute
      ),
    };

    // Der Stundenplan zeigt, wann etwas stattfindet — und dazu die Aktion, die
    // zum Kurs gehört: der Weg hinein, wenn der Kunde nicht drin ist, der Weg
    // hinaus, wenn er mit einer Flatrate drin ist.
    //
    // Das Einchecken hat seinen Ort seit 2026-09-10 ausschließlich unter „Mein
    // Bereich": Dort steht der ganze Kurstag mit einem Knopf je Stunde, und
    // derselbe Handgriff an zwei Orten ist einer zu viel. (Umkehr einer
    // Entscheidung von PROJ-25 — damals gab es „Mein Bereich" noch nicht.)
    //
    // Nebenwirkung jener Verlagerung, gemeldet aus dem Betrieb am 2026-09-11:
    // Für einen Kurs, in dem der Kunde saß, blieb die Karte danach ganz ohne
    // Aktion zurück. Der Rückweg der Flatrate stand nur im Kurskatalog — also
    // genau dort nicht, wo man seine Kurse ansieht.
    const istDrin = myActiveCourseIds.has(course.id);
    entry.booking = {
      entryDates: (course.course_entry_dates ?? []).map((d) => d.entry_date).sort(),
      price: course.price,
      nextOccurrenceDates: upcomingOccurrences(schedule.weekday, {
        count: UPCOMING_OCCURRENCES_WINDOW,
        pauseDates: schedule.course_schedule_pauses.map((p) => p.pause_date),
        zeitraum: kurszeitraum(course),
        ferien,
      }),
      hasOpenRegularBooking: myOpenRegularCourseIds.has(course.id),
      hasActiveSubscription: istDrin,
      hasFlatrate: mySubsRes.hatFlatrate,
      isFull: course.max_participants !== null && (occupiedByCourse.get(course.id) ?? 0) >= course.max_participants,
      isOnWaitlist: myWaitlistCourseIds.has(course.id),
      isLoggedIn: !!user,
      hasMandate,
      hasReferralSource,
      pricing,
      roleQueryEnabled: course.role_query_enabled,
    };

    if (!entriesByWeekday[schedule.weekday]) entriesByWeekday[schedule.weekday] = [];
    entriesByWeekday[schedule.weekday].push(entry);
  }

  for (const weekday of Object.keys(entriesByWeekday)) {
    entriesByWeekday[Number(weekday)].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  const todayWeekday = jsDayToWeekday(heuteAlsDatumInWien().getDay());


  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">{texte("heading")}</h1>
        <p className="text-muted-foreground">{texte("subheading")}</p>
      </div>
      <WeeklyScheduleView
        entriesByWeekday={entriesByWeekday}
        todayWeekday={todayWeekday}
        ferien={anstehendeFerien(await ladeFerienMitNamen(supabase), heute)}
      />
    </div>
  );
}
