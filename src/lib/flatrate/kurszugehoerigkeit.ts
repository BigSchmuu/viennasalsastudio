import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export type Kurszugehoerigkeit = {
  /** Der Kunde hat ein laufendes kursloses Abo — Flatrate oder Pass. */
  hatFlatrate: boolean;
  /**
   * PROJ-93: Die Stilrichtung dieses Abos. `null` bei der vollen Flatrate —
   * dann ist alles gedeckt. Bei einem Pass deckt es nur Kurse dieses Stils.
   */
  passStilId: string | null;
  /** Kurse, in denen er sitzt — über ein kursgebundenes Abo oder die Flatrate. */
  kursIds: Set<string>;
  /** Alles, wofür er Videos sehen darf: eigene Kurse plus Flatrate. */
  videoKursIds: Set<string>;
};

export const LEERE_ZUGEHOERIGKEIT: Kurszugehoerigkeit = {
  hatFlatrate: false,
  passStilId: null,
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
    supabase
      .from("subscriptions")
      .select("course_id, dance_style_id")
      .eq("customer_id", userId)
      .eq("status", "active"),
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
  if (aboRes.error && platzRes.error) return LEERE_ZUGEHOERIGKEIT;

  const abos = aboRes.data ?? [];
  // PROJ-93: Höchstens eines davon gibt es je Kunde (Pass **oder** Flatrate).
  // Trifft es doch zwei, gewinnt die volle Flatrate — sie deckt mehr, und der
  // Kunde soll nicht an einer Dateninkonsistenz hängen bleiben.
  const kurslos = abos.filter((a) => a.course_id === null);
  const hatFlatrate = kurslos.length > 0;
  const passStilId = kurslos.some((a) => a.dance_style_id === null)
    ? null
    : (kurslos[0]?.dance_style_id ?? null);

  const kursIds = new Set<string>();
  for (const a of abos) if (a.course_id) kursIds.add(a.course_id);
  for (const p of platzRes.data ?? []) kursIds.add(p.course_id);

  // Wer die **volle** Flatrate hat, darf die Videos aller Kurse sehen — das
  // galt schon vorher und bleibt so. Ein Pass öffnet sie nicht: Er sieht die
  // Videos der Kurse, in denen er sitzt, wie jeder mit Kursabo. Das ist die
  // zurückhaltende Lesart, und sie nimmt niemandem etwas, was er heute hat.
  const volleFlatrate = hatFlatrate && passStilId === null;
  const videoKursIds = volleFlatrate ? new Set<string>() : new Set(kursIds);

  return { hatFlatrate, passStilId, kursIds, videoKursIds };
}

/** Darf dieser Kunde die Videos dieses Kurses sehen? */
export function darfVideosSehen(z: Kurszugehoerigkeit, kursId: string): boolean {
  return (z.hatFlatrate && z.passStilId === null) || z.videoKursIds.has(kursId);
}

/**
 * Deckt das kurslose Abo **diesen** Kurs? (PROJ-93)
 *
 * Das Gegenstück zu `deckt_abo_kurs()` in der Datenbank: Dort entscheidet es,
 * ob der Eintrag entsteht; hier, ob der Knopf dazu überhaupt erscheint. Zwei
 * Stellen mit derselben Regel — läuft eine davon weg, bietet die Oberfläche
 * etwas an, das die Datenbank ablehnt.
 *
 * Ein Kurs ohne Stilrichtung wird von keinem Pass gedeckt. Die volle Flatrate
 * deckt auch ihn.
 */
export function decktKurs(z: Kurszugehoerigkeit, kursStilId: string | null): boolean {
  if (!z.hatFlatrate) return false;
  if (z.passStilId === null) return true;
  return kursStilId !== null && kursStilId === z.passStilId;
}
