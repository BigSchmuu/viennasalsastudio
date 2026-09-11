import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { heuteInWien } from "@/lib/constants/zeitzone";
import { enqueueAndDispatch } from "@/lib/notifications/dispatch";

type ServiceClient = SupabaseClient<Database>;

/**
 * Vollzieht vorgemerkte Kursumwandlungen (PROJ-51).
 *
 * Aus Beginner 1 wird Beginner 2: derselbe Kurs, dieselbe Gruppe, nur Name und
 * Level ändern sich. Die Vormerkung steht am Kurs, vollzogen wird sie hier —
 * im selben nächtlichen Lauf, der auch die fälligen Abo-Änderungen vollzieht.
 *
 * Zwei Schritte, die absichtlich getrennt bleiben:
 *
 * 1. **Ankündigen**, eine Woche vorher. Wer nächste Woche in einem anders
 *    heißenden Kurs sitzt, soll es vorher erfahren und nicht daraus schließen.
 * 2. **Vollziehen**, am Stichtag.
 *
 * Zusammengelegt wären sie eine Nachricht, die am Tag der Änderung eintrifft —
 * also genau dann, wenn sie niemandem mehr etwas nützt.
 */

/**
 * Wie viele Tage vor dem Stichtag die Nachricht hinausgeht.
 *
 * Eine Woche: der Abstand zum letzten Kurstermin unter dem alten Namen. Drei
 * Wochen — der Vorlauf des Stundenplans — wären zu früh für eine Nachricht;
 * was man liest und erst in drei Wochen braucht, hat man vergessen.
 */
export const ANKUENDIGUNG_TAGE = 7;

export type UmwandlungsErgebnis = {
  angekuendigt: number;
  umgewandelt: number;
};

function tagePlus(datum: string, tage: number): string {
  const d = new Date(`${datum}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

export async function vollzieheFaelligeUmwandlungen(
  service: ServiceClient,
  heute: string = heuteInWien()
): Promise<UmwandlungsErgebnis> {
  const { data: vorgemerkt, error } = await service
    .from("courses")
    .select(
      "id, name, level, pending_name, pending_level, pending_effective_date, pending_runs_until, pending_announced_at"
    )
    .not("pending_name", "is", null)
    // Der Ankündigungshorizont ist die weitere der beiden Grenzen — ein Kurs,
    // der heute fällig ist, steht hier ebenfalls drin.
    .lte("pending_effective_date", tagePlus(heute, ANKUENDIGUNG_TAGE));

  // Eine leere Liste ohne Fehlerprüfung sähe aus wie „nichts vorgemerkt" und
  // ließe jede Umwandlung liegen. Siehe .claude/rules/backend.md.
  if (error) {
    console.error("Vorgemerkte Umwandlungen nicht lesbar", error);
    return { angekuendigt: 0, umgewandelt: 0 };
  }

  let angekuendigt = 0;
  let umgewandelt = 0;

  for (const kurs of vorgemerkt ?? []) {
    const stichtag = kurs.pending_effective_date!;

    if (!kurs.pending_announced_at) {
      const erreicht = await kuendigeAn(service, {
        kursId: kurs.id,
        alterName: kurs.name,
        neuerName: kurs.pending_name!,
        stichtag,
      });
      if (erreicht) angekuendigt += 1;
    }

    if (stichtag > heute) continue;

    const { data: geaendert, error: schreibFehler } = await service
      .from("courses")
      .update({
        name: kurs.pending_name!,
        // Das Level ist optional an der Vormerkung: Ein Kurs kann den Namen
        // wechseln, ohne die Stufe zu wechseln.
        ...(kurs.pending_level ? { level: kurs.pending_level } : {}),
        // Das Ende der neuen Staffel ersetzt das alte (BUG-1 aus dem
        // QA-Durchgang): Sonst wäre der Kurs am Tag seiner Umwandlung schon
        // abgelaufen, fiele aus dem Stundenplan und käme nie zurück —
        // nachdem die Kunden eine Woche vorher gelesen hatten, dass es
        // weitergeht.
        //
        // `runs_from` bleibt, wie es war, und das ist wichtig: Die
        // Anwesenheitsliste des Lehrers begrenzt ihre Historie daran. Auf den
        // Stichtag gesetzt, verschwände alles, was vor der Umwandlung
        // stattfand — und genau das darf laut Kriterium nicht passieren.
        //
        // Die Lücke zwischen den Staffeln trägt sich selbst: Bis zum Stichtag
        // gilt noch das alte Ende, der Kurs ist in dieser Zeit also ohnehin
        // aus dem Plan.
        runs_until: kurs.pending_runs_until,
        pending_name: null,
        pending_level: null,
        pending_effective_date: null,
        pending_runs_until: null,
        pending_announced_at: null,
      })
      .eq("id", kurs.id)
      // Nur solange die Vormerkung noch steht: Hat der Betreiber sie inzwischen
      // von Hand vollzogen oder zurückgenommen, darf hier nichts zweites
      // passieren.
      .not("pending_name", "is", null)
      .select("id");

    if (schreibFehler) {
      console.error(`Umwandlung von Kurs ${kurs.id} fehlgeschlagen`, schreibFehler);
      continue;
    }
    if (geaendert && geaendert.length > 0) umgewandelt += 1;
  }

  return { angekuendigt, umgewandelt };
}

/**
 * Sagt den Teilnehmern Bescheid — und merkt sich, dass es geschehen ist.
 *
 * Der Zeitstempel wird gesetzt, sobald der Versuch gelaufen ist, nicht erst
 * wenn jede einzelne Zustellung geklappt hat. Sonst hielte eine einzige tote
 * Adresse den ganzen Kurs im Zustand „noch nicht informiert" — und jeder
 * nächtliche Lauf schriebe allen anderen erneut.
 */
async function kuendigeAn(
  service: ServiceClient,
  kurs: { kursId: string; alterName: string; neuerName: string; stichtag: string }
): Promise<boolean> {
  // Dieselbe Definition wie überall: `course_members` vereint Abo-Kunden und
  // Flatrate-Kursplätze. Zwei getrennte Abfragen liefen früher oder später
  // auseinander, und dann fehlte eine halbe Gruppe.
  //
  // Die Sicht direkt, nicht `get_course_member_ids`: Jene Funktion prüft auf
  // Lehrkraft oder Verwaltung, und im nächtlichen Lauf sitzt niemand — die
  // Prüfung schlüge fehl und lieferte eine leere Liste, ohne dass es auffiele.
  const { data: teilnehmer, error } = await service
    .from("course_members")
    .select("customer_id")
    .eq("course_id", kurs.kursId);

  if (error) {
    console.error(`Teilnehmer von Kurs ${kurs.kursId} nicht lesbar`, error);
    return false;
  }

  // Die Sicht ist ein Verbund zweier Zweige; die Spalten sind dort formal
  // optional. Wer keine Kennung hat, ist niemand — der fällt hier heraus.
  const empfaenger = new Set(
    (teilnehmer ?? []).map((t) => t.customer_id).filter((id): id is string => Boolean(id))
  );

  for (const teilnehmerId of empfaenger) {
    await enqueueAndDispatch({
      customerId: teilnehmerId,
      eventType: "kursumwandlung",
      payload: {
        course_id: kurs.kursId,
        alter_name: kurs.alterName,
        neuer_name: kurs.neuerName,
        datum: kurs.stichtag,
      },
      // Je Kunde und Stichtag genau einmal. Nimmt der Betreiber die Vormerkung
      // zurück und merkt dasselbe Datum erneut vor, bliebe die zweite
      // Nachricht aus — richtig so: Es hat sich nichts geändert, was der Kunde
      // noch nicht wüsste.
      dedupeKey: `kursumwandlung:${kurs.kursId}:${teilnehmerId}:${kurs.stichtag}`,
    });
  }

  const { error: stempelFehler } = await service
    .from("courses")
    .update({ pending_announced_at: new Date().toISOString() })
    .eq("id", kurs.kursId);

  if (stempelFehler) {
    console.error(`Ankündigung von Kurs ${kurs.kursId} nicht vermerkt`, stempelFehler);
  }

  return true;
}
