"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FlatrateErgebnis =
  | { ok: true }
  | { error: string }
  | { full: true }
  | { roleImbalance: true };

/**
 * Die Meldungen der Datenbank ins Deutsche — dieselbe Zuordnung wie im
 * Buchungsvorgang, damit ein Kunde für dieselbe Lage nicht zwei verschiedene
 * Sätze zu lesen bekommt.
 */
function uebersetze(meldung: string): FlatrateErgebnis {
  if (meldung.includes("course is full")) return { full: true };
  if (meldung.includes("role imbalance")) return { roleImbalance: true };
  if (meldung.includes("dance role required")) {
    return { error: "Bitte wähle, ob du als Leader oder Follower tanzt." };
  }
  if (meldung.includes("prerequisite not confirmed")) {
    return { error: "Bitte bestätige zuerst den Hinweis zu den Vorkenntnissen." };
  }
  if (meldung.includes("already enrolled")) {
    return { error: "Du bist für diesen Kurs bereits angemeldet." };
  }
  if (meldung.includes("already requested")) {
    return { error: "Du hast diesen Kurs bereits gebucht — die Bestätigung steht noch aus." };
  }
  if (meldung.includes("no flatrate")) {
    // Kann eintreten, während der Kunde auf dem Kurs steht: Der Betreiber
    // kündigt oder pausiert gerade. Ein verständlicher Satz statt eines
    // stillen Fehlschlags.
    return { error: "Für dieses Konto läuft gerade keine Flatrate." };
  }
  if (meldung.includes("not a member")) {
    return { error: "Du bist in diesem Kurs nicht eingeschrieben." };
  }
  return { error: "Das hat nicht geklappt. Bitte versuch es noch einmal." };
}

/** Nach jeder Änderung: Überall dort, wo Kurszugehörigkeit angezeigt wird. */
function seitenAktualisieren(kursId: string) {
  revalidatePath("/kurse");
  revalidatePath(`/kurse/${kursId}`);
  revalidatePath("/stundenplan");
  revalidatePath("/profil");
  revalidatePath("/mein-bereich");
}

/**
 * Einen Kurs zur eigenen Flatrate hinzufügen (PROJ-50).
 *
 * Kein neues Abo, keine zweite Abbuchung, keine Bestätigung durch den
 * Betreiber — die Geldfrage ist mit der Flatrate entschieden. Die Prüfungen
 * (Kursgrenze, Rollenverhältnis, Vorkenntnisse) stecken vollständig in der
 * Datenbank: Nur dort lässt sich der letzte freie Platz unter Sperre vergeben.
 */
export async function kursZuFlatrateHinzufuegen(
  kursId: string,
  tanzrolle?: string | null,
  vorkenntnisseBestaetigt?: boolean
): Promise<FlatrateErgebnis> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Bitte melde dich zuerst an." };

  const { error } = await supabase.rpc("add_course_to_flatrate", {
    p_course_id: kursId,
    p_dance_role: tanzrolle ?? "",
    p_prerequisite_confirmed: vorkenntnisseBestaetigt ?? false,
  });

  if (error) return uebersetze(error.message);

  seitenAktualisieren(kursId);
  return { ok: true };
}

/**
 * Einen Kurs aus der eigenen Flatrate entfernen.
 *
 * Sofort wirksam und ohne Frist: Es ändert nichts am Geld. Die Warteliste
 * rückt unmittelbar nach — das erledigt die Datenbank im selben Vorgang, damit
 * kein Platz liegen bleibt, wenn der Aufruf hier abbricht.
 */
export async function kursAusFlatrateEntfernen(kursId: string): Promise<FlatrateErgebnis> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Bitte melde dich zuerst an." };

  const { error } = await supabase.rpc("remove_course_from_flatrate", { p_course_id: kursId });
  if (error) return uebersetze(error.message);

  seitenAktualisieren(kursId);
  return { ok: true };
}

/** Dasselbe für den Betreiber, an einem fremden Kunden. */
export async function adminKursplatzHinzufuegen(
  kundeId: string,
  kursId: string,
  tanzrolle?: string | null,
  grenzeUebergehen?: boolean
): Promise<FlatrateErgebnis> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_add_course_membership", {
    p_customer_id: kundeId,
    p_course_id: kursId,
    p_dance_role: tanzrolle ?? "",
    p_ignore_capacity: grenzeUebergehen ?? false,
  });
  if (error) return uebersetze(error.message);

  revalidatePath(`/admin/kunden/${kundeId}`);
  seitenAktualisieren(kursId);
  return { ok: true };
}

export async function adminKursplatzEntfernen(
  kundeId: string,
  kursId: string
): Promise<FlatrateErgebnis> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_remove_course_membership", {
    p_customer_id: kundeId,
    p_course_id: kursId,
  });
  if (error) return uebersetze(error.message);

  revalidatePath(`/admin/kunden/${kundeId}`);
  seitenAktualisieren(kursId);
  return { ok: true };
}
