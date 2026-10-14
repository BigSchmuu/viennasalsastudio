import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { eintragsZeilen, type Eintrag, type EintragsZeile } from "@/lib/barzahlungen/offen";

type Client = SupabaseClient<Database>;

/** Wen die Lehrkraft hier noch eintragen kann — mit dem Preis als Vorschlag. */
export type Kandidat = {
  kundeId: string;
  kundeName: string;
  aboId: string;
  aboName: string | null;
  istFlatrate: boolean;
  preis: number | null;
};

/**
 * Die Barzahler-Einträge eines Kurses, fertig zum Anzeigen (PROJ-84).
 *
 * Über die Datenbankfunktion und nicht über Tabellen: Für eine Lehrkraft sind
 * `subscriptions` und `sepa_mandates` gesperrt, und in der Mandatstabelle stehen
 * IBANs. Die Funktion prüft selbst, ob sie diesen Kurs unterrichtet.
 *
 * Sie liefert zwei Gruppen in einer Antwort — die Teilnehmer dieses Kurses und
 * die übrigen Flatrate-Einträge, die in jedem Kurs erreichbar sind.
 *
 * Ein Lesefehler wirft. Eine leere Liste sähe aus wie „niemand zahlt bar" — und
 * genau dann steht die Lehrkraft am Abend da und sammelt nichts ein.
 */
export async function ladeBarzahler(supabase: Client, courseId: string): Promise<EintragsZeile[]> {
  const { data, error } = await supabase.rpc("get_course_cash_payers", {
    p_course_id: courseId,
  });

  if (error) {
    console.error("Barzahler nicht lesbar", courseId, error);
    throw new Error("Die Barzahler konnten nicht geladen werden");
  }

  const eintraege: Eintrag[] = (data ?? []).map((z) => ({
    eintragId: z.entry_id,
    kundeId: z.customer_id,
    kundeName: z.full_name || "Unbenannter Kunde",
    aboId: z.subscription_id,
    aboName: z.subscription_name,
    istFlatrate: z.ist_flatrate,
    betrag: Number(z.amount_due),
    bezahlt: Number(z.bezahlt ?? 0),
    letzteZahlung: z.letzte_zahlung,
    notiz: z.note,
    letzteZahlungId: z.letzte_zahlung_id,
    eigenerKurs: z.eigener_kurs,
  }));

  return eintragsZeilen(eintraege);
}

/** Die Teilnehmer dieses Kurses, die noch nicht auf der Liste stehen. */
export async function ladeKandidaten(supabase: Client, courseId: string): Promise<Kandidat[]> {
  const { data, error } = await supabase.rpc("get_course_cash_candidates", {
    p_course_id: courseId,
  });

  if (error) {
    // Kein Wurf: Ohne Kandidaten fehlt nur die Auswahl zum Eintragen, die
    // Liste selbst bleibt brauchbar. Protokolliert wird es trotzdem — eine
    // leere Auswahl ohne Fehlerprüfung wäre eine unbeantwortete Frage.
    console.error("Kandidaten nicht lesbar", courseId, error);
    return [];
  }

  return (data ?? []).map((k) => ({
    kundeId: k.customer_id,
    kundeName: k.full_name || "Unbenannter Kunde",
    aboId: k.subscription_id,
    aboName: k.subscription_name,
    istFlatrate: k.ist_flatrate,
    preis: k.price === null ? null : Number(k.price),
  }));
}
