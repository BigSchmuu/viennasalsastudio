"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdminOrTeacher } from "@/lib/auth/require-admin-or-teacher";

export type RosterRow = {
  customer_id: string;
  full_name: string | null;
  source: string;
  status: "present" | "absent" | null;
  self_checked_in: boolean;
};

export type StaffelErgebnis =
  | { error: string }
  | { dates: { date: string; roster: RosterRow[]; note: string }[] };

/** Mehr als eine Staffel auf einmal braucht niemand — und schützt vor einem Aufruf mit hundert Tagen. */
const MAX_TERMINE = 12;

/**
 * Die Anwesenheit zu genau diesen Terminen laden (PROJ-72).
 *
 * Vorher rechnete die Aktion selbst aus, welche vier Termine vor einem Datum
 * liegen. Jetzt kommt die Einteilung aus dem Staffelplan, den die Seite
 * aufgestellt hat, und diese Aktion holt nur noch, was dort steht. Zwei Stellen,
 * die Termine ausrechnen, hätten früher oder später zwei verschiedene Staffeln
 * ergeben.
 *
 * Wer die Liste sehen darf, entscheidet die Datenbankfunktion selbst
 * (Lehrkraft des Kurses oder Verwaltung). Die Prüfung hier fängt nur den Fall
 * ab, dass gar niemand angemeldet ist — dann steht eine klare Meldung statt
 * einer leeren Liste.
 */
export async function ladeStaffel(courseId: string, termine: string[]): Promise<StaffelErgebnis> {
  await requireAdminOrTeacher();

  const gefiltert = termine.filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t)).slice(0, MAX_TERMINE);
  if (gefiltert.length === 0) return { dates: [] };

  const supabase = await createClient();

  const dates = await Promise.all(
    gefiltert.map(async (date) => {
      const [rosterRes, noteRes] = await Promise.all([
        supabase.rpc("get_course_attendance_roster", { p_course_id: courseId, p_occurrence_date: date }),
        supabase.rpc("get_course_session_note", { p_course_id: courseId, p_occurrence_date: date }),
      ]);
      if (rosterRes.error) {
        // Eine leere Liste ohne Fehlerprüfung sähe aus wie „niemand da".
        console.error("Anwesenheitsliste nicht lesbar", date, rosterRes.error);
        return null;
      }
      return { date, roster: (rosterRes.data ?? []) as RosterRow[], note: noteRes.data ?? "" };
    })
  );

  if (dates.some((d) => d === null)) {
    return { error: "Die Anwesenheit konnte nicht geladen werden. Bitte lade die Seite neu." };
  }

  return { dates: dates.filter((d): d is NonNullable<typeof d> => d !== null) };
}
