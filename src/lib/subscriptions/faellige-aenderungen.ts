import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { heuteInWien } from "@/lib/constants/zeitzone";

type ServiceClient = SupabaseClient<Database>;

/**
 * Vollzieht geplante Abo-Änderungen, deren Stichtag erreicht ist.
 *
 * Bis hierher war das Handarbeit: Der Kunde kündigt, das Abo merkt sich
 * `pending_status` und `pending_effective_date`, und am Stichtag verschickte
 * der Versandlauf zwar eine Nachricht — vollzogen hat die Änderung aber erst
 * jemand in der Verwaltung.
 *
 * Für das Geld war das folgenlos: Der Lastschriftlauf überspringt Positionen,
 * deren Stichtag erreicht ist. Aber das Abo blieb formal aktiv und
 * `cancelled_at` leer — und damit tauchte die Kündigung in der Auswertung
 * nicht auf. Eine stille Untererfassung, bis jemand von Hand nachzog.
 */
export type VollzugsErgebnis = {
  vollzogen: number;
  gekuendigt: number;
  freigewordeneKurse: string[];
};

export async function vollzieheFaelligeAenderungen(
  service: ServiceClient,
  heute: string = heuteInWien()
): Promise<VollzugsErgebnis> {
  // `lte`, nicht `eq`: Fällt ein Versandlauf aus, würde ein Stichtag sonst
  // übersprungen und die Änderung bliebe für immer liegen. So holt der
  // nächste Lauf sie nach.
  const { data: faellige, error } = await service
    .from("subscriptions")
    .select("id, status, course_id, pending_status, pending_effective_date")
    .not("pending_status", "is", null)
    .lte("pending_effective_date", heute);

  if (error) {
    console.error("Fällige Abo-Änderungen konnten nicht gelesen werden", error);
    return { vollzogen: 0, gekuendigt: 0, freigewordeneKurse: [] };
  }

  const freigeworden = new Set<string>();
  let vollzogen = 0;
  let gekuendigt = 0;

  for (const abo of faellige ?? []) {
    const { data: geaendert, error: schreibFehler } = await service
      .from("subscriptions")
      .update({
        status: abo.pending_status!,
        pending_status: null,
        pending_effective_date: null,
        // Der Stichtag, nicht der heutige Tag: Läuft der Versand einen Tag
        // später, ist die Kündigung trotzdem zum vereinbarten Datum erfolgt.
        // Und er ist die einzige dauerhafte Spur, wann dieses Abo geendet hat
        // — die Auswertung zählt darüber.
        ...(abo.pending_status === "cancelled"
          ? { cancelled_at: abo.pending_effective_date }
          : {}),
      })
      .eq("id", abo.id)
      // Nur solange die geplante Änderung noch steht: Hat jemand in der
      // Verwaltung inzwischen von Hand vollzogen, darf hier nichts zweites
      // passieren.
      .not("pending_status", "is", null)
      .select("id");

    if (schreibFehler) {
      console.error(`Abo ${abo.id} konnte nicht vollzogen werden`, schreibFehler);
      continue;
    }
    if (!geaendert || geaendert.length === 0) continue;

    vollzogen += 1;
    if (abo.pending_status === "cancelled") gekuendigt += 1;

    // Ein Platz wird frei, wenn ein aktives Abo aufhört, aktiv zu sein.
    if (abo.status === "active" && abo.pending_status !== "active") {
      if (abo.course_id) {
        freigeworden.add(abo.course_id);
      } else {
        // PROJ-50: Eine Flatrate hat keinen Kurs am Abo, aber Kursplätze.
        // Der Trigger auf `subscriptions` hat sie beim Statuswechsel gerade
        // beendet — ohne diese Abfrage bliebe jeder davon frei gewordene Platz
        // liegen, statt an die Warteliste zu gehen.
        const { data: beendetePlaetze, error: platzFehler } = await service
          .from("course_memberships")
          .select("course_id")
          .eq("subscription_id", abo.id)
          .eq("ended_on", heute);
        if (platzFehler) {
          console.error(`Kursplätze zu Abo ${abo.id} nicht lesbar`, platzFehler);
        }
        for (const platz of beendetePlaetze ?? []) freigeworden.add(platz.course_id);
      }
    }
  }

  // Je Kurs einmal, nicht je Abo: Werden drei Abos desselben Kurses beendet,
  // füllt ein Nachrücklauf die frei gewordenen Plätze.
  for (const kursId of freigeworden) {
    const { error: nachrueckFehler } = await service.rpc("promote_waitlist_for_course", {
      p_course_id: kursId,
    });
    if (nachrueckFehler) {
      console.error("promote_waitlist_for_course failed", nachrueckFehler);
    }
  }

  return { vollzogen, gekuendigt, freigewordeneKurse: [...freigeworden] };
}
