import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { heuteInWien } from "@/lib/constants/zeitzone";
import { ladeFerien, kurszeitraum } from "@/lib/scheduling/ferien";
import {
  naechsteTermine,
  fehlendeAnwesenheit,
  geburtstage,
  rollenVerteilung,
  FENSTER_TAGE,
  type KursEingabe,
  type Termin,
  type OffenerTermin,
  type Geburtstag,
} from "@/lib/teacher/uebersicht";
import type { Probestunde } from "@/components/teacher/lehrer-uebersicht";

type Client = SupabaseClient<Database>;

export type LehrerUebersichtDaten = {
  termine: Termin[];
  probestunden: Probestunde[];
  geburtstage: Geburtstag[];
  offeneAnwesenheit: OffenerTermin[];
};

/**
 * Holt alles, was der Lehrer-Bereich braucht (PROJ-49).
 *
 * In einem Rutsch und über alle Kurse gemeinsam, nicht Block für Block und
 * nicht Kurs für Kurs: Ein Lehrer mit sechs Kursen soll nicht sechsmal so lange
 * warten wie einer mit einem.
 *
 * Der Zugriff ist nutzergebunden — die Datenbank zieht denselben Zaun noch
 * einmal. Sichtbar wird trotzdem nur, was zu den eigenen Kursen gehört, weil
 * jede Frage bei den eigenen Zuordnungen beginnt.
 */
export async function ladeLehrerUebersicht(
  supabase: Client,
  userId: string,
  jetzt: Date = new Date()
): Promise<LehrerUebersichtDaten> {
  const heute = heuteInWien(jetzt);
  const grenze = new Date(jetzt.getTime() + FENSTER_TAGE * 86400000).toISOString().slice(0, 10);

  const { data: zuordnungen } = await supabase
    .from("course_teachers")
    .select(
      "course_id, courses(id, name, video_set_id, role_query_enabled, runs_from, runs_until, rooms(name, locations(name)), course_schedule(weekday, start_time, end_time, course_schedule_pauses(pause_date)))"
    )
    .eq("teacher_id", userId);

  const kurse: KursEingabe[] = (zuordnungen ?? [])
    .map((z) => z.courses)
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .map((c) => {
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

  if (kurse.length === 0) {
    return { termine: [], probestunden: [], geburtstage: [], offeneAnwesenheit: [] };
  }

  const kursIds = kurse.map((k) => k.id);
  // PROJ-51: einmal für alle Kurse dieses Lehrers.
  const ferien = await ladeFerien(supabase);

  // Alles über Funktionen, keine einzige direkte Tabellenabfrage.
  //
  // Für eine Lehrkraft sind `course_attendance`, `subscriptions`,
  // `course_bookings` und `course_session_notes` gesperrt — teils per Regel
  // „eigene Zeile oder Admin“, bei der Anwesenheit sogar ganz ohne Leseregel.
  // Eine direkte Abfrage schlägt dabei nicht fehl, sie liefert leer. Genau
  // daran sind Geburtstage, Probestunden, Rollenverteilung und die offenen
  // Anwesenheiten beim Bauen still gescheitert.
  const [anwesenheitRes, probenRes, aboRes, notizenRes, rollenRes] = await Promise.all([
    supabase.rpc("get_course_attendance_dates", { p_course_ids: kursIds }),
    supabase.rpc("get_course_trial_bookings", {
      p_course_ids: kursIds,
      p_von: heute,
      p_bis: grenze,
    }),
    supabase.rpc("get_course_active_subscribers", { p_course_ids: kursIds }),
    supabase.rpc("get_last_session_notes", { p_course_ids: kursIds }),
    supabase.rpc("get_course_dance_roles", { p_course_ids: kursIds }),
  ]);

  // Eine leere Liste ist hier nicht dasselbe wie „nichts vorhanden“ — sie kann
  // auch heißen, dass die Abfrage nicht durchkam. Also laut sagen, wenn etwas
  // schiefging.
  for (const [was, res] of [
    ["Anwesenheiten", anwesenheitRes],
    ["Probestunden", probenRes],
    ["Abos", aboRes],
    ["Notizen", notizenRes],
    ["Tanzrollen", rollenRes],
  ] as const) {
    if (res.error) console.error(`Lehrer-Bereich: ${was} nicht lesbar`, res.error);
  }

  // Namen und Geburtsdaten der eigenen Kursteilnehmer — aus demselben Grund
  // ebenfalls über eine Funktion. Ausgeliefert wird nur, wer im eigenen Kurs
  // ein Abo oder eine Buchung hat, nicht ein beliebiges Profil.
  const { data: personen, error: personenFehler } = await supabase.rpc("get_course_participants", {
    p_course_ids: kursIds,
  });
  if (personenFehler) console.error("Lehrer-Bereich: Teilnehmer nicht lesbar", personenFehler);
  const personById = new Map(
    (personen ?? []).map((p) => [p.customer_id, { full_name: p.full_name, birthdate: p.birthdate }])
  );

  const erfasst = new Set(
    (anwesenheitRes.data ?? []).map((a) => `${a.course_id}|${a.occurrence_date}`)
  );

  // Je Kurs die jüngste Notiz — die Funktion liefert bereits höchstens eine
  // Zeile je Kurs.
  const letzteNotizJeKurs = new Map<string, string>(
    (notizenRes.data ?? []).map((n) => [n.course_id, n.note])
  );

  // Eine Zeile je Teilnehmer: Seit PROJ-50 steht die Rolle am Kursplatz, und
  // den gibt es je Kunde und Kurs genau einmal.
  const rolleJeKursUndKunde = new Map<string, string | null>();
  for (const b of rollenRes.data ?? []) {
    rolleJeKursUndKunde.set(`${b.course_id}|${b.customer_id}`, b.dance_role);
  }
  const rollenJeKurs = new Map<string, (string | null)[]>();
  for (const [schluessel, rolle] of rolleJeKursUndKunde) {
    const kursId = schluessel.split("|")[0];
    rollenJeKurs.set(kursId, [...(rollenJeKurs.get(kursId) ?? []), rolle]);
  }

  const kursById = new Map(kurse.map((k) => [k.id, k]));
  const roh = naechsteTermine(kurse, heute, ferien, jetzt);

  // Die Notiz steht nur beim jeweils nächsten Termin eines Kurses — zweimal
  // dieselbe Notiz wäre Lärm.
  const notizVergeben = new Set<string>();
  const termine: Termin[] = roh.map((t) => {
    const kurs = kursById.get(t.kursId)!;
    const zeigeNotiz = !notizVergeben.has(t.kursId);
    if (zeigeNotiz) notizVergeben.add(t.kursId);
    return {
      ...t,
      rollen: kurs.fragtRolleAb ? rollenVerteilung(rollenJeKurs.get(t.kursId) ?? []) : null,
      letzteNotiz: zeigeNotiz ? letzteNotizJeKurs.get(t.kursId) ?? null : null,
    };
  });

  const probestunden: Probestunde[] = (probenRes.data ?? [])
    .filter((p) => p.chosen_date)
    .map((p) => ({
      id: p.id,
      name: personById.get(p.customer_id)?.full_name ?? "—",
      kursName: kursById.get(p.course_id)?.name ?? "—",
      datum: p.chosen_date as string,
    }))
    .sort((a, b) => a.datum.localeCompare(b.datum));

  // „Schüler" sind Kunden mit aktivem Abo im Kurs — ein einmaliger Gast ist
  // niemand, dessen Geburtstag man kennt (Entscheidung vom 2026-09-09).
  const schuelerIds = Array.from(new Set((aboRes.data ?? []).map((a) => a.customer_id)));
  const gebs = geburtstage(
    schuelerIds.map((id) => ({
      id,
      name: personById.get(id)?.full_name ?? "—",
      geburtsdatum: personById.get(id)?.birthdate ?? null,
    })),
    jetzt
  );

  return {
    termine,
    probestunden,
    geburtstage: gebs,
    offeneAnwesenheit: fehlendeAnwesenheit(kurse, erfasst, ferien, jetzt),
  };
}
