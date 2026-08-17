import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { upcomingOccurrences } from "@/lib/scheduling/dates";
import { levelLabel, levelColor } from "@/lib/constants/levels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CourseDetailBooking, type CourseDetailData } from "@/components/catalog/course-detail-booking";
import { YoutubeEmbed } from "@/components/video/youtube-embed";

const UPCOMING_OCCURRENCES_WINDOW = 4;

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: course }, { data: pricing }] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, name, level, dance_style_id, dance_styles(name), video_set_id, room_id, rooms(location_id, locations(name)), course_teachers(teacher_id), course_schedule(weekday, course_schedule_pauses(pause_date)), course_entry_dates(entry_date)"
      )
      .eq("id", id)
      .single(),
    supabase.from("dropin_pricing").select("normal_price, student_price").limit(1).single(),
  ]);

  if (!course) {
    notFound();
  }

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
  let hasVideoAccess = false;

  if (user) {
    const [mandateRes, profileRes, bookingRes, subscriptionsRes] = await Promise.all([
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
    ]);
    hasMandate = !!mandateRes.data;
    hasReferralSource = !!profileRes.data?.referral_source;
    hasOpenRegularBooking = !!bookingRes.data;
    hasVideoAccess = (subscriptionsRes.data ?? []).some((s) => s.course_id === id || s.course_id === null);
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
    hasOpenRegularBooking,
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <Button variant="link" className="px-0" asChild>
        <Link href="/kurse">← Zurück zum Kurskatalog</Link>
      </Button>

      <div className="space-y-3">
        <h1 className="font-heading text-3xl font-bold">{course.name}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{course.dance_styles?.name ?? "—"}</Badge>
          <Badge style={{ backgroundColor: levelColor(course.level), color: "white" }}>
            {levelLabel(course.level)}
          </Badge>
        </div>
        <p className="text-muted-foreground">{course.rooms?.locations?.name ?? "—"}</p>
        <p className="text-muted-foreground">
          {course.course_teachers.length > 0
            ? course.course_teachers
                .map((ct) => teacherNameById.get(ct.teacher_id))
                .filter((name): name is string => Boolean(name))
                .join(", ")
            : "Lehrer wird noch bekanntgegeben"}
        </p>
      </div>

      <CourseDetailBooking
        course={detailData}
        isLoggedIn={!!user}
        hasMandate={hasMandate}
        hasReferralSource={hasReferralSource}
        dropinPricing={{
          normal: pricing?.normal_price ?? 20,
          student: pricing?.student_price ?? 15,
        }}
      />

      {lessons.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-heading text-xl font-bold">Videolektionen</h2>
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
