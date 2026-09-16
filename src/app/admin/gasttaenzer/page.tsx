import { requireAdmin } from "@/lib/auth/require-admin";
import { ladeFerien, kurszeitraum } from "@/lib/scheduling/ferien";
import { upcomingOccurrences } from "@/lib/scheduling/dates";
import {
  getSchieflage,
  getAusschreibungen,
  getProgrammteilnehmer,
} from "@/lib/actions/admin/gasttaenzer";
import { GasttaenzerManager, type KursOption } from "@/components/admin/gasttaenzer/gasttaenzer-manager";

/**
 * Gasttänzer-Programm (PROJ-60).
 *
 * Drei Dinge auf einer Seite: Wo läuft das Rollenverhältnis aus dem Ruder,
 * was ist ausgeschrieben, und wer ist überhaupt dabei.
 */
export default async function AdminGasttaenzerPage() {
  const { supabase } = await requireAdmin();

  const [schieflage, ausschreibungen, teilnehmer, kurseRes, ferien] = await Promise.all([
    getSchieflage(),
    getAusschreibungen(),
    getProgrammteilnehmer(),
    // Nur Kurse mit Rollenabfrage: Eine Ausschreibung sucht „2 Follower" —
    // ohne Rollen gibt es nichts zu suchen.
    supabase
      .from("courses")
      .select(
        "id, name, level, runs_from, runs_until, course_schedule(weekday, course_schedule_pauses(pause_date))"
      )
      .eq("role_query_enabled", true)
      .order("name", { ascending: true }),
    ladeFerien(supabase),
  ]);

  if (kurseRes.error) {
    console.error("Kurse für Ausschreibungen nicht lesbar", kurseRes.error);
  }

  // Die möglichen Termine werden hier gerechnet, nicht im Dialog: Ferien und
  // ausgefallene Abende stehen in der Datenbank, und ein Termin, an dem der
  // Kurs gar nicht stattfindet, darf gar nicht erst zur Wahl stehen.
  const kurse: KursOption[] = (kurseRes.data ?? []).map((k) => {
    const plan = k.course_schedule;
    return {
      id: k.id,
      name: k.name,
      level: k.level,
      termine: plan
        ? upcomingOccurrences(plan.weekday, {
            count: 8,
            pauseDates: plan.course_schedule_pauses.map((p) => p.pause_date),
            zeitraum: kurszeitraum(k),
            ferien,
          })
        : [],
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-xl font-bold">Gasttänzer</h2>
        <p className="text-sm text-muted-foreground">
          Erfahrene Tänzerinnen und Tänzer, die einspringen, wenn eine Rolle fehlt. Der Abend ist für
          sie gratis.
        </p>
      </div>

      <GasttaenzerManager
        schieflage={schieflage}
        ausschreibungen={ausschreibungen}
        teilnehmer={teilnehmer}
        kurse={kurse}
      />
    </div>
  );
}
