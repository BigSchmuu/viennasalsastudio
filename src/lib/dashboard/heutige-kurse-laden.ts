import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { heuteInWien } from "@/lib/constants/zeitzone";
import { ladeFerien, kurszeitraum } from "@/lib/scheduling/ferien";
import type { KursEingabe } from "@/lib/teacher/uebersicht";
import {
  einchecksStand,
  heutigeKurse,
  laeuftJetzt,
  standText,
  type Eincheckstand,
} from "@/lib/dashboard/heutige-kurse";

type Client = SupabaseClient<Database>;

export type HeutigerKursEintrag = {
  kursId: string;
  kursName: string;
  ort: string | null;
  startZeit: string | null;
  endZeit: string | null;
  laeuft: boolean;
  /** `null`, wenn der Stand nicht gelesen werden konnte. */
  stand: Eincheckstand | null;
  standText: string;
};

/**
 * Die heutigen Kurse samt Stand des Eincheckens (PROJ-75).
 *
 * Für die **Verwaltung**, also über alle Kurse — nicht über die eigenen
 * Zuordnungen wie der Lehrer-Bereich (PROJ-49). Genau das ist der Anlass: Ein
 * Admin ohne Kurszuweisung sah unter „Meine Kurse" eine leere Liste und musste
 * den Weg über die Kursverwaltung suchen.
 *
 * Die Stände laufen parallel, einer je heutigem Kurs. Bei zwei bis sechs Kursen
 * am Tag ist das eine Handvoll Abfragen; je Kurs einzeln nacheinander wäre
 * spürbar, und eine eigene Zählung über alle Kurse auf einmal ließe Dashboard
 * und Anwesenheitsliste auseinanderlaufen.
 */
export async function ladeHeutigeKurse(
  supabase: Client,
  jetzt: Date = new Date()
): Promise<HeutigerKursEintrag[]> {
  const heute = heuteInWien(jetzt);

  const { data: kursDaten, error } = await supabase
    .from("courses")
    .select(
      "id, name, video_set_id, role_query_enabled, runs_from, runs_until, rooms(name, locations(name)), course_schedule(weekday, start_time, end_time, course_schedule_pauses(pause_date))"
    );

  if (error) {
    // Eine leere Liste sähe aus wie „heute kein Kurs" — und genau an dem Abend,
    // an dem jemand eincheckt, ist das die falsche Auskunft.
    console.error("Heutige Kurse nicht lesbar", error);
    throw new Error("Heutige Kurse konnten nicht geladen werden");
  }

  const kurse: KursEingabe[] = (kursDaten ?? []).map((c) => {
    // course_schedule kommt je nach Beziehung als Objekt oder als Liste.
    const plan = Array.isArray(c.course_schedule) ? c.course_schedule[0] : c.course_schedule;
    return {
      id: c.id,
      name: c.name,
      ort: c.rooms?.locations?.name ?? c.rooms?.name ?? null,
      weekday: plan?.weekday ?? null,
      startZeit: plan?.start_time ?? null,
      endZeit: plan?.end_time ?? null,
      pausen: (plan?.course_schedule_pauses ?? []).map((p: { pause_date: string }) => p.pause_date),
      zeitraum: kurszeitraum(c),
      hatVideosatz: !!c.video_set_id,
      fragtRolleAb: !!c.role_query_enabled,
    };
  });

  const ferien = await ladeFerien(supabase);
  const heutige = heutigeKurse(kurse, heute, ferien, jetzt);

  return Promise.all(
    heutige.map(async (kurs) => {
      const { data, error: standFehler } = await supabase.rpc("get_course_attendance_roster", {
        p_course_id: kurs.kursId,
        p_occurrence_date: heute,
      });

      // Ein Fehler darf nicht als „niemand anwesend" durchgehen (dieselbe Lehre
      // wie bei „Nicht zugestellt", PROJ-16). Der Kurs bleibt in der Liste —
      // der Weg zur Anwesenheitsliste ist wichtiger als die Zahl daneben.
      if (standFehler) {
        console.error("Stand des Eincheckens nicht lesbar", kurs.kursId, standFehler);
        return { ...kurs, laeuft: laeuftJetzt(kurs, jetzt), stand: null, standText: standText(null) };
      }

      const stand = einchecksStand(data ?? []);
      return { ...kurs, laeuft: laeuftJetzt(kurs, jetzt), stand, standText: standText(stand) };
    })
  );
}
