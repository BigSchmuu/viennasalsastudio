import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireCourseAccess } from "@/lib/auth/require-teacher";
import { formatDateLocal, jsDayToWeekday, occurrencesBetween } from "@/lib/scheduling/dates";
import { aktuelleStaffel, staffelplan } from "@/lib/scheduling/staffel";
import { isBirthdayToday } from "@/lib/birthdays";
import {
  AttendanceMatrix,
  type MatrixColumn,
  type MatrixRow,
  type MatrixCell,
  type EligibleCustomer,
} from "@/components/teacher/attendance-matrix";
import type { RosterRow } from "@/lib/actions/teacher/staffel-laden";
import { heuteInWien, heuteAlsDatumInWien } from "@/lib/constants/zeitzone";
import { Lehrmaterial, type Lektion } from "@/components/teacher/lehrmaterial";
import { ladeFerien, kurszeitraum } from "@/lib/scheduling/ferien";

/**
 * Wie weit die Seite Termine überhaupt in Betracht zieht (PROJ-72).
 *
 * Nicht, was sie zeigt — gezeigt wird eine Staffel von vier. Diese Grenzen
 * sagen nur, woraus der Staffelplan gebaut wird: ein Jahr zurück, ein
 * Vierteljahr voraus. Ohne hinterlegten Kursbeginn ist das zugleich der Anfang
 * der Zählung.
 */
const RUECKBLICK_TAGE = 365;
const VORSCHAU_TAGE = 91;

function tagePlus(datum: string, tage: number): string {
  const d = new Date(datum + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

export default async function TeacherCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { supabase, isAdmin } = await requireCourseAccess(courseId);

  const { data: course } = await supabase
    .from("courses")
    .select("id, name, role_query_enabled, video_set_id, runs_from, runs_until, course_schedule(weekday, course_schedule_pauses(pause_date))")
    .eq("id", courseId)
    .single();

  if (!course) {
    notFound();
  }

  // PROJ-23: das interne Lehrmaterial. Die Leseberechtigung liegt seit August
  // in der Datenbank („admin or assigned teacher read"), nur rief sie niemand
  // ab — deshalb der gewöhnliche, nutzergebundene Zugriff und kein Dienstschlüssel.
  let satzName: string | null = null;
  let lektionen: Lektion[] = [];
  if (course.video_set_id) {
    const { data: satz } = await supabase
      .from("video_sets")
      .select("name, video_set_lessons(id, title, position, video_set_lesson_videos(url, position))")
      .eq("id", course.video_set_id)
      .single();

    if (satz) {
      satzName = satz.name;
      // Nach `position` sortiert, nicht nach Zufall: Die Reihenfolge ist die
      // Unterrichtsreihenfolge, und der Admin hat sie von Hand gesetzt.
      lektionen = [...satz.video_set_lessons]
        .sort((a, b) => a.position - b.position)
        .map((l) => ({
          id: l.id,
          titel: l.title,
          videoUrls: [...l.video_set_lesson_videos]
            .sort((a, b) => a.position - b.position)
            .map((v) => v.url),
        }));
    }
  }

  const roleByCustomer: Record<string, "leader" | "follower" | "both"> = {};
  if (course.role_query_enabled) {
    // Über eine Funktion, nicht direkt: `course_bookings` erlaubt per Regel nur
    // „eigene Zeile oder Admin". Für eine Lehrkraft kam die direkte Abfrage
    // ohne Fehler, aber leer zurück — die Leader/Follower-Markierung aus
    // PROJ-30 war hier also ausgerechnet für sie nie sichtbar.
    const { data: roleBookings, error: roleFehler } = await supabase.rpc("get_course_dance_roles", {
      p_course_ids: [courseId],
    });
    if (roleFehler) console.error("Anwesenheitsliste: Tanzrollen nicht lesbar", roleFehler);
    for (const b of roleBookings ?? []) {
      // Seit PROJ-50 eine Zeile je Teilnehmer: Die Rolle steht am Kursplatz,
      // und den gibt es genau einmal. Die frühere Auswertung „die jüngste
      // Buchung gewinnt" ist damit gegenstandslos.
      roleByCustomer[b.customer_id] = b.dance_role as "leader" | "follower" | "both";
    }
  }

  const schedule = course.course_schedule;

  let columns: MatrixColumn[] = [];
  let rows: MatrixRow[] = [];
  let eligibleCustomers: EligibleCustomer[] = [];
  // PROJ-72: Der Staffelplan — nur Daten, keine Anwesenheiten. Die Oberfläche
  // weiß damit, was es vor und nach der gezeigten Staffel gibt, ohne dass die
  // Seite alles lädt.
  let plan: string[][] = [];
  let staffelIndex = -1;

  if (schedule) {
    const pauseDates = schedule.course_schedule_pauses.map((p) => p.pause_date);
    const todayDate = heuteInWien();

    // PROJ-72: Erst der ganze Plan, dann die eine Staffel daraus. Gezeigt wird
    // die laufende; frühere und spätere holt die Oberfläche auf Klick nach.
    const alleTermine = occurrencesBetween(schedule.weekday, {
      von: course.runs_from ?? tagePlus(todayDate, -RUECKBLICK_TAGE),
      bis: course.runs_until ?? tagePlus(todayDate, VORSCHAU_TAGE),
      pauseDates,
      // PROJ-51: Eine Stunde vor Kursbeginn oder in den Ferien hat nie
      // stattgefunden — sie gehört nicht in die Anwesenheitsliste.
      zeitraum: kurszeitraum(course),
      ferien: await ladeFerien(supabase),
    });

    plan = staffelplan(alleTermine, { heute: todayDate, kursbeginn: Boolean(course.runs_from) });
    staffelIndex = aktuelleStaffel(plan, todayDate);
    const allDates = staffelIndex >= 0 ? plan[staffelIndex] : [];

    const [perDate, eligibleRes] = await Promise.all([
      Promise.all(
        allDates.map(async (date) => {
          const [rosterRes, noteRes] = await Promise.all([
            supabase.rpc("get_course_attendance_roster", { p_course_id: courseId, p_occurrence_date: date }),
            supabase.rpc("get_course_session_note", { p_course_id: courseId, p_occurrence_date: date }),
          ]);
          return { date, roster: (rosterRes.data ?? []) as RosterRow[], note: noteRes.data ?? "" };
        })
      ),
      supabase.rpc("list_attendance_eligible_customers"),
    ]);

    const customersById = new Map<string, string>();
    const cellsByCustomer = new Map<string, Record<string, MatrixCell>>();

    for (const { date, roster } of perDate) {
      for (const r of roster) {
        const name = r.full_name || "Unbenannter Kunde";
        customersById.set(r.customer_id, name);
        const existing = cellsByCustomer.get(r.customer_id) ?? {};
        existing[date] = { status: r.status, source: r.source, selfCheckedIn: r.self_checked_in };
        cellsByCustomer.set(r.customer_id, existing);
      }
    }

    const eligibleIds = (eligibleRes.data ?? []).map((c) => c.customer_id);
    const allIds = Array.from(new Set([...customersById.keys(), ...eligibleIds]));
    // Über die Funktion, nicht per direkter Abfrage: `profiles` erlaubt nur
    // „eigene Zeile oder Admin". Eine Lehrkraft bekam hier stumm nichts —
    // das Geburtstags-Symbol aus PROJ-31 erschien deshalb nur Admins, obwohl
    // die Nutzergeschichte ausdrücklich den Lehrer meint. Aufgefallen am
    // 2026-09-09 beim Bauen von PROJ-49; der Test von PROJ-31 meldet sich als
    // Admin an und war darum immer grün.
    const { data: teilnehmer } = await supabase.rpc("get_course_participants", {
      p_course_ids: [courseId],
    });
    const birthdateRows = (teilnehmer ?? [])
      .filter((p) => allIds.includes(p.customer_id))
      .map((p) => ({ id: p.customer_id, birthdate: p.birthdate }));
    // Der Wiener Kalendertag, nicht der des Servers (UTC bei Vercel).
    const today = heuteAlsDatumInWien();
    const birthdayTodayById = new Set(
      (birthdateRows ?? []).filter((p) => p.birthdate && isBirthdayToday(p.birthdate, today)).map((p) => p.id)
    );

    rows = Array.from(customersById.entries()).map(([customerId, fullName]) => ({
      customerId,
      fullName,
      cells: cellsByCustomer.get(customerId) ?? {},
      hasBirthdayToday: birthdayTodayById.has(customerId),
    }));

    columns = perDate.map(({ date, note }) => ({
      date,
      isToday: date === todayDate,
      initialNote: note,
    }));

    eligibleCustomers = (eligibleRes.data ?? []).map((c) => ({
      id: c.customer_id,
      name: c.full_name || "Unbenannter Kunde",
      hasBirthdayToday: birthdayTodayById.has(c.customer_id),
    }));
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      <Button variant="link" className="px-0" asChild>
        <Link href="/lehrer">← Zurück zu Meine Kurse</Link>
      </Button>

      <h1 className="font-heading text-3xl font-bold">{course.name}</h1>

      {satzName ? (
        <Lehrmaterial satzName={satzName} lektionen={lektionen} />
      ) : (
        // Ein leerer Block wäre schlimmer als dieser Satz: Der Lehrer wüsste
        // nicht, ob nichts hinterlegt ist oder etwas kaputt.
        <p className="text-sm text-muted-foreground">
          Für diesen Kurs ist kein Videosatz hinterlegt.
        </p>
      )}

      {!schedule ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Für diesen Kurs ist noch kein Wochentermin hinterlegt.
        </p>
      ) : (
        <AttendanceMatrix
          courseId={course.id}
          plan={plan}
          staffelIndex={staffelIndex}
          columns={columns}
          rows={rows}
          eligibleCustomers={eligibleCustomers}
          isAdmin={isAdmin}
          roleQueryEnabled={course.role_query_enabled}
          roleByCustomer={roleByCustomer}
        />
      )}
    </div>
  );
}
