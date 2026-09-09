import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export type Kurszugehoerigkeit = {
  /** Der Kunde hat eine laufende Flatrate — er darf Kurse hinzufügen. */
  hatFlatrate: boolean;
  /** Kurse, in denen er sitzt — über ein kursgebundenes Abo oder die Flatrate. */
  kursIds: Set<string>;
  /** Alles, wofür er Videos sehen darf: eigene Kurse plus Flatrate. */
  videoKursIds: Set<string>;
};

const LEER: Kurszugehoerigkeit = {
  hatFlatrate: false,
  kursIds: new Set(),
  videoKursIds: new Set(),
};

/**
 * „In welchen Kursen sitzt dieser Kunde?" — einmal beantwortet (PROJ-50).
 *
 * Vier Seiten stellten diese Frage bisher je für sich, und alle vier lasen
 * `subscriptions.course_id`. Bei einer Flatrate ist die Spalte leer, also
 * antworteten alle vier mit „in keinem" — der Kunde bekam überall „Jetzt
 * buchen" angeboten und legte damit ein zweites Abo an.
 *
 * Die Datenbank zieht denselben Zaun noch einmal: `course_memberships` gibt
 * per Regel nur die eigenen Zeilen heraus.
 */
export async function ladeKurszugehoerigkeit(
  supabase: Client,
  userId: string
): Promise<Kurszugehoerigkeit> {
  const [aboRes, platzRes] = await Promise.all([
    supabase.from("subscriptions").select("course_id").eq("customer_id", userId).eq("status", "active"),
    supabase
      .from("course_memberships")
      .select("course_id")
      .eq("customer_id", userId)
      .is("ended_on", null),
  ]);

  // Eine leere Liste ohne Fehlerprüfung ist eine unbeantwortete Frage —
  // siehe .claude/rules/backend.md.
  if (aboRes.error) console.error("Kurszugehörigkeit: Abos nicht lesbar", aboRes.error);
  if (platzRes.error) console.error("Kurszugehörigkeit: Kursplätze nicht lesbar", platzRes.error);
  if (aboRes.error && platzRes.error) return LEER;

  const abos = aboRes.data ?? [];
  const hatFlatrate = abos.some((a) => a.course_id === null);

  const kursIds = new Set<string>();
  for (const a of abos) if (a.course_id) kursIds.add(a.course_id);
  for (const p of platzRes.data ?? []) kursIds.add(p.course_id);

  // Wer eine Flatrate hat, darf die Videos aller Kurse sehen — das galt schon
  // vorher und bleibt so.
  const videoKursIds = hatFlatrate ? new Set<string>() : new Set(kursIds);

  return { hatFlatrate, kursIds, videoKursIds };
}

/** Darf dieser Kunde die Videos dieses Kurses sehen? */
export function darfVideosSehen(z: Kurszugehoerigkeit, kursId: string): boolean {
  return z.hatFlatrate || z.videoKursIds.has(kursId);
}
