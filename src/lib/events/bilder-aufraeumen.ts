import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { BILDER_BUCKET } from "@/lib/events/medien";

type Client = SupabaseClient<Database>;

/**
 * Verwaiste Bilddateien wegräumen (PROJ-55).
 *
 * Die Datenbank räumt im Bildspeicher nichts weg: Verschwindet ein Event, ist
 * der Eintrag weg — die Datei bleibt liegen. Dasselbe passiert, wenn jemand
 * beim Hochladen den Browser schließt, nachdem die Datei angekommen ist, aber
 * bevor die App davon erfährt.
 *
 * Deshalb sieht der nächtliche Lauf nach, welche Dateien zu keinem Eintrag
 * gehören, und entfernt sie.
 */

/** Frisch Hochgeladenes bleibt unangetastet — sonst träfe der Lauf einen Upload mitten im Satz. */
export const SCHONFRIST_STUNDEN = 24;

export type GefundeneDatei = { pfad: string; erstellt: string };

/**
 * Welche der gefundenen Dateien weg können.
 *
 * Nur, was zu keinem Eintrag gehört **und** die Schonfrist hinter sich hat.
 * Ohne die zweite Bedingung löschte der Lauf gerade hochgeladene Bilder, deren
 * Eintrag noch unterwegs ist.
 */
export function verwaisteDateien(
  eingetragen: Set<string>,
  gefunden: GefundeneDatei[],
  jetzt: Date,
  schonfristStunden = SCHONFRIST_STUNDEN
): string[] {
  const grenze = jetzt.getTime() - schonfristStunden * 60 * 60 * 1000;
  return gefunden
    .filter((datei) => !eingetragen.has(datei.pfad) && Date.parse(datei.erstellt) < grenze)
    .map((datei) => datei.pfad);
}

/** Alle Dateien unterhalb eines Ordners — der Bildspeicher listet je Ebene. */
async function dateienUnter(supabase: Client, ordner: string): Promise<GefundeneDatei[]> {
  const { data, error } = await supabase.storage.from(BILDER_BUCKET).list(ordner, { limit: 1000 });
  if (error) throw new Error(`Bildspeicher (${ordner || "/"}) nicht lesbar: ${error.message}`);

  const gefunden: GefundeneDatei[] = [];
  for (const eintrag of data ?? []) {
    const pfad = ordner ? `${ordner}/${eintrag.name}` : eintrag.name;
    // Ordner haben keine eigene Kennung — daran erkennt man sie.
    if (eintrag.id === null) {
      gefunden.push(...(await dateienUnter(supabase, pfad)));
    } else {
      gefunden.push({ pfad, erstellt: eintrag.created_at ?? new Date(0).toISOString() });
    }
  }
  return gefunden;
}

export async function raeumeVerwaisteBilder(supabase: Client): Promise<{ verwaist: number }> {
  const [{ data: eintraege, error }, gefunden] = await Promise.all([
    supabase.from("event_images").select("storage_path"),
    dateienUnter(supabase, ""),
  ]);
  // Eine leere Liste ohne Fehlerprüfung wäre hier gefährlich: Sie sähe aus wie
  // „kein Bild ist eingetragen" — und der Lauf löschte den ganzen Bestand.
  if (error) throw new Error(`Bildeinträge nicht lesbar: ${error.message}`);

  const eingetragen = new Set((eintraege ?? []).map((eintrag) => eintrag.storage_path));
  const verwaist = verwaisteDateien(eingetragen, gefunden, new Date());
  if (verwaist.length === 0) return { verwaist: 0 };

  const { error: loeschFehler } = await supabase.storage.from(BILDER_BUCKET).remove(verwaist);
  if (loeschFehler) throw new Error(`Verwaiste Bilder nicht löschbar: ${loeschFehler.message}`);

  return { verwaist: verwaist.length };
}
