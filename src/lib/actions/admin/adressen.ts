import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

/**
 * Alle vergebenen Adressen, die mit `basis` beginnen (PROJ-53, PROJ-54).
 *
 * Gezählt werden Events, frühere Adressen umbenannter Events und Serien:
 * Eine Adresse führt entweder zu einem Event oder zu einer Serie, und beide
 * liegen unter `/events/…`. Wäre eine doppelt vergeben, verdeckte die eine
 * die andere — ohne dass jemand es merkt.
 *
 * Ein eigener Eintrag zählt nicht mit, sonst könnte sich ein Event oder eine
 * Serie beim Speichern nicht selbst behalten.
 */
export async function vergebeneAdressen(
  supabase: Client,
  basis: string,
  eigenes: { eventId?: string; serieId?: string } = {}
): Promise<Set<string> | null> {
  const [events, frueher, serien] = await Promise.all([
    supabase.from("events").select("id, slug").like("slug", `${basis}%`),
    supabase.from("event_previous_slugs").select("event_id, slug").like("slug", `${basis}%`),
    supabase.from("event_series").select("id, slug").like("slug", `${basis}%`),
  ]);

  if (events.error || frueher.error || serien.error) {
    console.error("Adressen konnten nicht geprüft werden", events.error ?? frueher.error ?? serien.error);
    return null;
  }

  return new Set([
    ...(events.data ?? []).filter((z) => z.id !== eigenes.eventId).map((z) => z.slug),
    ...(frueher.data ?? []).filter((z) => z.event_id !== eigenes.eventId).map((z) => z.slug),
    ...(serien.data ?? []).filter((z) => z.id !== eigenes.serieId).map((z) => z.slug),
  ]);
}
