import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { heuteInWien } from "@/lib/constants/zeitzone";
import { probestundenStand, type ProbestundenStand } from "@/lib/bookings/probestunde";

type Client = SupabaseClient<Database>;

/**
 * Der Probestunden-Stand eines Kunden (PROJ-52).
 *
 * Ein gemeinsamer Weg für die vier Seiten, die den Buchungsdialog zeigen —
 * Katalog, Kursdetail, Stundenplan und Dashboard. Vier eigene Abfragen liefen
 * auseinander; dieselbe Überlegung wie bei `ladeFerien` und der
 * Kurszugehörigkeit.
 *
 * Ohne angemeldeten Kunden gilt „frei": Er sieht den Dialog ohnehin erst nach
 * dem Login, und „verbraucht" wäre für einen Gast schlicht falsch.
 */
export async function ladeProbestundenStand(
  supabase: Client,
  userId: string | null
): Promise<ProbestundenStand> {
  if (!userId) return { art: "frei" };

  const { data, error } = await supabase
    .from("course_bookings")
    .select("id, type, status, chosen_date, course_id, courses(name)")
    .eq("customer_id", userId)
    .eq("type", "trial");

  // Eine leere Liste ohne Fehlerprüfung sähe aus wie „noch keine Probestunde"
  // und gäbe dem Kunden eine zweite. Siehe .claude/rules/backend.md.
  if (error) {
    console.error("Probestunden nicht lesbar", error);
    return { art: "frei" };
  }

  return probestundenStand(
    (data ?? []).map((b) => ({
      id: b.id,
      type: b.type,
      status: b.status,
      chosen_date: b.chosen_date,
      course_id: b.course_id,
      kursName: b.courses?.name ?? "—",
    })),
    heuteInWien()
  );
}
