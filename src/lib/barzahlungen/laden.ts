import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { barzahlerZeilen, type Barzahler } from "@/lib/barzahlungen/offen";
import type { BarzahlerAnsicht } from "@/components/teacher/barzahler-liste";

type Client = SupabaseClient<Database>;

/**
 * Die Barzahler eines Kurses, fertig zum Anzeigen (PROJ-81, Saldo ab PROJ-83).
 *
 * Über die Datenbankfunktion und nicht über Tabellen: Für eine Lehrkraft sind
 * `subscriptions` und `sepa_mandates` gesperrt, und in der Mandatstabelle stehen
 * IBANs. Die Funktion prüft selbst, ob sie diesen Kurs unterrichtet.
 *
 * Ein Lesefehler wirft. Eine leere Liste sähe aus wie „niemand zahlt bar" — und
 * genau dann steht die Lehrkraft am Abend da und sammelt nichts ein.
 */
export async function ladeBarzahler(supabase: Client, courseId: string): Promise<BarzahlerAnsicht[]> {
  const { data, error } = await supabase.rpc("get_course_cash_payers", {
    p_course_id: courseId,
  });

  if (error) {
    console.error("Barzahler nicht lesbar", courseId, error);
    throw new Error("Die Barzahler konnten nicht geladen werden");
  }

  const heutigeZahlungen = new Map(
    (data ?? []).map((z) => [z.subscription_id, z.heutige_zahlung_id])
  );

  const zahler: Barzahler[] = (data ?? []).map((z) => ({
    kundeId: z.customer_id,
    kundeName: z.full_name || "Unbenannter Kunde",
    aboId: z.subscription_id,
    aboName: z.subscription_name,
    betrag: z.price,
    istFlatrate: z.ist_flatrate,
    soll: z.soll ?? 0,
    haben: z.haben ?? 0,
    letzteZahlung: z.letzte_zahlung,
  }));

  // Weder Datum noch Ferien: Seit PROJ-83 steht die Rechnung in der Datenbank
  // (`cash_ledger`), und die Liste deutet sie nur noch.
  return barzahlerZeilen(zahler).map((zeile) => ({
    ...zeile,
    heutigeZahlungId: heutigeZahlungen.get(zeile.aboId) ?? null,
  }));
}
