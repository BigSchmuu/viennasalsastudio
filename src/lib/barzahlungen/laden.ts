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
  /** Die Stilrichtung, wenn das Abo ein Pass ist (PROJ-95) — sonst `null`. */
  passStil: string | null;
  preis: number | null;
  /**
   * Was dieses Abo im vorigen Zyklus schuldete (PROJ-99) — `null`, wenn es
   * dort nicht auf der Liste stand.
   *
   * Zwei Dinge in einem Feld, und beide gewollt: Es ist der Vorschlag für den
   * Betrag **und** das Merkmal, an dem die Gruppe „Im vorigen Zyklus" erkannt
   * wird. Eine zweite Angabe „stand damals drauf" könnte davon abweichen.
   */
  vorigerBetrag: number | null;
};

/**
 * Die Barzahler-Einträge eines Kurses, fertig zum Anzeigen (PROJ-84).
 *
 * Über die Datenbankfunktion und nicht über Tabellen: Für eine Lehrkraft sind
 * `subscriptions` und `sepa_mandates` gesperrt, und in der Mandatstabelle stehen
 * IBANs. Die Funktion prüft selbst, ob sie diesen Kurs unterrichtet.
 *
 * Sie liefert zwei Gruppen in einer Antwort — die Teilnehmer dieses Kurses und
 * die übrigen kurslosen Abos, die in diesem Kurs erreichbar sind: Flatraten
 * immer, Pässe nur in Kursen ihrer Stilrichtung (PROJ-95).
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
    passStil: z.pass_stil,
    betrag: Number(z.amount_due),
    bezahlt: Number(z.bezahlt ?? 0),
    letzteZahlung: z.letzte_zahlung,
    notiz: z.note,
    letzteZahlungId: z.letzte_zahlung_id,
    eigenerKurs: z.eigener_kurs,
    // PROJ-98: Der Rest aus dem vorigen Zyklus. Er kommt aus der Datenbank und
    // wird hier nicht gerechnet — die Zuordnung Zahlung → Zyklus hängt an
    // Zeiträumen, die nur dort vollständig bekannt sind.
    restVorher: Number(z.rest_vorher ?? 0),
    vorherBis: z.vorher_bis,
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
    passStil: k.pass_stil,
    preis: k.price === null ? null : Number(k.price),
    vorigerBetrag: k.voriger_betrag === null ? null : Number(k.voriger_betrag),
  }));
}

/** Eine Zeile des Archivs — eine Abschrift aus einem abgeschlossenen Zyklus. */
export type ArchivZeile = {
  zyklusId: string;
  von: string;
  bis: string;
  zeileId: string;
  kundeId: string;
  kundeName: string;
  aboId: string;
  aboName: string | null;
  istFlatrate: boolean;
  passStil: string | null;
  betrag: number;
  gezahlt: number;
  notiz: string | null;
};

/** Ein abgeschlossener Zyklus mit seinen Summen. */
export type ZyklusZeile = {
  zyklusId: string;
  von: string;
  bis: string;
  abgeschlossenAm: string;
  abgeschlossenVon: string | null;
  eintraege: number;
  geschuldet: number;
  eingesammelt: number;
  offen: number;
  kannZurueck: boolean;
};

/**
 * Die abgeschlossenen Zyklen (PROJ-98).
 *
 * Ein Lesefehler wirft. Ein leeres Archiv und ein kaputtes Archiv sehen in der
 * Anzeige gleich aus — und das eine bedeutet „noch nichts abgeschlossen", das
 * andere „die Nachweise sind nicht da".
 */
export async function ladeZyklen(supabase: Client): Promise<ZyklusZeile[]> {
  const { data, error } = await supabase.rpc("get_cash_cycles");

  if (error) {
    console.error("Zahlungszyklen nicht lesbar", error);
    throw new Error("Die abgeschlossenen Zyklen konnten nicht geladen werden");
  }

  return (data ?? []).map((z) => ({
    zyklusId: z.cycle_id,
    von: z.starts_on,
    bis: z.ends_on,
    abgeschlossenAm: z.closed_at,
    abgeschlossenVon: z.closed_by_name,
    eintraege: Number(z.eintraege),
    geschuldet: Number(z.geschuldet),
    eingesammelt: Number(z.eingesammelt),
    offen: Number(z.offen),
    kannZurueck: z.kann_zurueck,
  }));
}

/**
 * Die Abschriften — ohne Kunden das ganze Archiv, mit Kunden nur seine Zeilen.
 *
 * Dieselbe Funktion für beide Richtungen (PROJ-98): Die Barzahlungsseite fragt
 * „wer stand in diesem Zyklus auf der Liste", die Kundenseite „in welchen
 * Zyklen stand dieser Mensch". Eine zweite Quelle für dieselbe Abschrift wäre
 * eine, die irgendwann etwas anderes sagt.
 */
export async function ladeArchiv(
  supabase: Client,
  kundeId?: string
): Promise<ArchivZeile[]> {
  const { data, error } = await supabase.rpc("get_cash_archive_entries", {
    p_customer_id: kundeId ?? null,
  });

  if (error) {
    console.error("Barzahlungs-Archiv nicht lesbar", kundeId ?? "alle", error);
    throw new Error("Das Archiv der Barzahlungen konnte nicht geladen werden");
  }

  return (data ?? []).map((a) => ({
    zyklusId: a.cycle_id,
    von: a.starts_on,
    bis: a.ends_on,
    zeileId: a.archiv_id,
    kundeId: a.customer_id,
    kundeName: a.full_name || "Unbenannter Kunde",
    aboId: a.subscription_id,
    aboName: a.subscription_name,
    istFlatrate: a.ist_flatrate,
    passStil: a.pass_stil,
    betrag: Number(a.amount_due),
    gezahlt: Number(a.gezahlt),
    notiz: a.note,
  }));
}
