import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { upcomingOccurrences } from "@/lib/scheduling/dates";
import { levelLabel, levelBadgeStyle } from "@/lib/constants/levels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CourseDetailBooking, type CourseDetailData } from "@/components/catalog/course-detail-booking";
import { YoutubeEmbed } from "@/components/video/youtube-embed";
import { readStudioPricing } from "@/lib/pricing";
import { formatShortDate } from "@/lib/formatting";
import { CoursePriceLine } from "@/components/catalog/course-price-line";
import { getViewer } from "@/lib/auth/viewer";

const UPCOMING_OCCURRENCES_WINDOW = 4;

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const t = await getTranslations("courses");
  const tag = await getTranslations("weekdays");
  const locale = await getLocale();

  // Der Rahmen hat das schon ermittelt — getViewer() gibt innerhalb einer
  // Anfrage dieselbe Antwort zurück, ohne erneut zu fragen.
  const user = await getViewer();

  const [{ data: course }, { data: pricingRow }, occupancyRes] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, name, level, dance_style_id, dance_styles(name), video_set_id, room_id, rooms(name, location_id, locations(name)), course_teachers(teacher_id), course_schedule(weekday, start_time, end_time, course_schedule_pauses(pause_date)), course_entry_dates(entry_date), max_participants, price, prerequisite_note, role_query_enabled"
      )
      .eq("id", id)
      .single(),
    supabase.from("dropin_pricing").select("*").limit(1).single(),
    // subscriptions/course_bookings are RLS-scoped to "own row or admin" — see
    // src/app/(site)/kurse/page.tsx for why this needs the aggregate RPC.
    supabase.rpc("get_course_occupancy"),
  ]);

  if (!course) {
    notFound();
  }

  const occupiedCount = (occupancyRes.data ?? []).find((row) => row.course_id === id)?.occupied_count ?? 0;
  const isFull = course.max_participants !== null && occupiedCount >= course.max_participants;

  const { data: teachersData } = await supabase.from("teacher_directory").select("id, full_name");
  const teacherNameById = new Map((teachersData ?? []).map((t) => [t.id, t.full_name || "Unbenannter Lehrer"]));

  const schedule = course.course_schedule;
  const nextOccurrenceDates = schedule
    ? upcomingOccurrences(schedule.weekday, {
        count: UPCOMING_OCCURRENCES_WINDOW,
        pauseDates: schedule.course_schedule_pauses.map((p) => p.pause_date),
      })
    : [];

  let hasMandate = false;
  let hasReferralSource = false;
  let hasOpenRegularBooking = false;
  let hasActiveSubscription = false;
  let hasVideoAccess = false;
  let isOnWaitlist = false;

  if (user) {
    const [mandateRes, profileRes, bookingRes, subscriptionsRes, waitlistRes] = await Promise.all([
      supabase.from("sepa_mandates").select("id").eq("customer_id", user.id).is("revoked_at", null).maybeSingle(),
      supabase.from("profiles").select("referral_source").eq("id", user.id).single(),
      supabase
        .from("course_bookings")
        .select("id")
        .eq("customer_id", user.id)
        .eq("course_id", id)
        .eq("type", "regular")
        .eq("status", "open")
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("id, course_id")
        .eq("customer_id", user.id)
        .eq("status", "active"),
      supabase
        .from("waitlist_entries")
        .select("id")
        .eq("customer_id", user.id)
        .eq("course_id", id)
        .maybeSingle(),
    ]);
    hasMandate = !!mandateRes.data;
    hasReferralSource = !!profileRes.data?.referral_source;
    hasOpenRegularBooking = !!bookingRes.data;
    hasVideoAccess = (subscriptionsRes.data ?? []).some((s) => s.course_id === id || s.course_id === null);
    hasActiveSubscription = (subscriptionsRes.data ?? []).some((s) => s.course_id === id);
    isOnWaitlist = !!waitlistRes.data;
  }

  // Server-side gate: only fetch lesson videos at all if the customer is
  // actually entitled to see them — an unauthorized visitor never receives
  // this data in the page payload, not just a hidden UI section.
  type LessonWithVideo = { id: string; title: string; customerVideoUrl: string };
  let lessons: LessonWithVideo[] = [];
  if (hasVideoAccess && course.video_set_id) {
    const { data: lessonsData } = await supabase
      .from("video_set_lessons")
      .select("id, title, customer_video_url, position")
      .eq("video_set_id", course.video_set_id)
      .not("customer_video_url", "is", null)
      .order("position", { ascending: true });
    lessons = (lessonsData ?? []).map((l) => ({
      id: l.id,
      title: l.title,
      customerVideoUrl: l.customer_video_url as string,
    }));
  }

  const detailData: CourseDetailData = {
    id: course.id,
    name: course.name,
    entryDates: (course.course_entry_dates ?? []).map((d) => d.entry_date).sort(),
    nextOccurrenceDates,
    price: course.price,
    hasOpenRegularBooking,
    hasActiveSubscription,
    isFull,
    isOnWaitlist,
    prerequisiteNote: course.prerequisite_note,
    roleQueryEnabled: course.role_query_enabled,
  };

  const lehrerNamen = course.course_teachers
    .map((ct) => teacherNameById.get(ct.teacher_id))
    .filter((name): name is string => Boolean(name));

  const ortText = course.rooms?.name
    ? `${course.rooms.locations?.name ?? ""} · ${course.rooms.name}`.replace(/^ · /, "")
    : (course.rooms?.locations?.name ?? "—");

  // Wochentag und Uhrzeit standen bisher nicht auf dieser Seite — wer sich
  // entscheiden will, bekam hier weniger zu sehen als auf der Karte, die ihn
  // hergeführt hat.
  const zeitText = schedule
    ? `${tag(String(schedule.weekday))}, ${schedule.start_time.slice(0, 5)}–${schedule.end_time.slice(0, 5)}`
    : t("detailNoSchedule");

  const steckbrief: { titel: string; wert: React.ReactNode }[] = [
    { titel: t("detailWhen"), wert: zeitText },
    { titel: t("detailWhere"), wert: ortText },
    { titel: t("detailTeacher"), wert: lehrerNamen.length > 0 ? lehrerNamen.join(", ") : t("teacherTba") },
    {
      titel: t("detailPrice"),
      wert: <CoursePriceLine pricing={readStudioPricing(pricingRow)} coursePrice={course.price} />,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <Button variant="link" className="px-0" asChild>
        <Link href="/kurse">← {t("backToCatalog")}</Link>
      </Button>

      <div className="space-y-3">
        <h1 className="font-heading text-4xl font-bold tracking-[-0.5px]">{course.name}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{course.dance_styles?.name ?? "—"}</Badge>
          <Badge variant="outline" style={levelBadgeStyle(course.level)}>
            {levelLabel(course.level)}
          </Badge>
          {isFull && <Badge variant="destructive">{t("soldOut")}</Badge>}
        </div>
        {course.prerequisite_note && (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm">{course.prerequisite_note}</p>
        )}
      </div>

      {/* Der Steckbrief beantwortet die vier Fragen, die vor einer Buchung
          kommen — wann, wo, bei wem, zu welchem Preis. */}
      <dl className="grid gap-px overflow-hidden rounded-card border bg-border shadow-soft sm:grid-cols-2">
        {steckbrief.map((zeile) => (
          <div key={zeile.titel} className="bg-card p-5">
            <dt className="nav-label text-muted-foreground">{zeile.titel}</dt>
            <dd className="mt-1 text-base">{zeile.wert}</dd>
          </div>
        ))}
      </dl>

      {nextOccurrenceDates.length > 0 && (
        <div>
          <p className="nav-label text-muted-foreground">{t("detailNextDates")}</p>
          <p className="mt-1 text-base">
            {nextOccurrenceDates.map((d) => formatShortDate(d, locale)).join(" · ")}
          </p>
        </div>
      )}

      <CourseDetailBooking
        course={detailData}
        isLoggedIn={!!user}
        hasMandate={hasMandate}
        hasReferralSource={hasReferralSource}
        pricing={readStudioPricing(pricingRow)}
      />

      {lessons.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-heading text-xl font-bold">{t("videoLessons")}</h2>
          <div className="space-y-6">
            {lessons.map((lesson) => (
              <div key={lesson.id} className="space-y-2">
                <h3 className="font-medium">{lesson.title}</h3>
                <YoutubeEmbed url={lesson.customerVideoUrl} title={lesson.title} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
