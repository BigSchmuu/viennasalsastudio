"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { gasttaenzerSchema } from "@/lib/validations/gasttaenzer";
import { HINDERNIS_TEXT, type Hindernis } from "@/lib/gasttaenzer/ausschreibung";

type Ergebnis = { error: string } | { success: true };

/**
 * Das Gasttänzer-Programm aus Sicht des Kunden (PROJ-60).
 *
 * Die Regeln stehen nicht hier, sondern in der Datenbank: Wer zusagen darf,
 * entscheidet `gastplatz_zusagen`. Diese Datei übersetzt nur zwischen Formular
 * und Funktion — und macht aus einer technischen Meldung einen Satz.
 */

export async function programmBeitreten(formData: FormData): Promise<Ergebnis> {
  const parsed = gasttaenzerSchema.safeParse({
    dance_role: formData.get("dance_role"),
    level: formData.get("level"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Bitte die Angaben prüfen." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { error } = await supabase.from("guest_dancers").insert({
    customer_id: user.id,
    dance_role: parsed.data.dance_role,
    level: parsed.data.level,
  });

  if (error) {
    // 23505: Es gibt bereits eine Zeile — entweder ist der Mensch schon dabei,
    // oder er wurde ausgeschlossen. Beides sagt dieselbe Zeile, und beides
    // beantwortet das Profil, ohne dass hier geraten werden muss.
    if (error.code === "23505") return { error: "Du bist bereits angemeldet." };
    console.error("Gasttänzer-Anmeldung fehlgeschlagen", error);
    return { error: "Die Anmeldung hat nicht geklappt. Bitte versuche es erneut." };
  }

  revalidatePath("/profil");
  return { success: true };
}

export async function programmAendern(formData: FormData): Promise<Ergebnis> {
  const parsed = gasttaenzerSchema.safeParse({
    dance_role: formData.get("dance_role"),
    level: formData.get("level"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Bitte die Angaben prüfen." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  // Die Rechte auf die Ausschluss-Spalten hat die Migration entzogen — hier
  // kann also niemand sich selbst wieder freischalten.
  const { error } = await supabase
    .from("guest_dancers")
    .update({ dance_role: parsed.data.dance_role, level: parsed.data.level })
    .eq("customer_id", user.id);

  if (error) {
    console.error("Gasttänzer-Angaben nicht änderbar", error);
    return { error: "Die Änderung hat nicht geklappt." };
  }

  revalidatePath("/profil");
  return { success: true };
}

export async function programmVerlassen(): Promise<Ergebnis> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { error } = await supabase.from("guest_dancers").delete().eq("customer_id", user.id);
  if (error) {
    console.error("Abmeldung vom Programm fehlgeschlagen", error);
    return { error: "Die Abmeldung hat nicht geklappt." };
  }

  // Bereits zugesagte Abende bleiben bestehen — wer zugesagt hat, wird erwartet.
  revalidatePath("/profil");
  return { success: true };
}

/** Aus der Meldung der Datenbank einen Satz machen, den ein Mensch lesen kann. */
function hindernisAus(meldung: string): string {
  const zuordnung: Record<string, Hindernis> = {
    "not in programme": "nicht_im_programm",
    excluded: "ausgeschlossen",
    "role mismatch": "rolle",
    "level too low": "level",
    withdrawn: "zurueckgezogen",
    "course already started": "begonnen",
    "no seats left": "keine_plaetze",
    "already attending": "schon_dabei",
  };
  for (const [teil, hindernis] of Object.entries(zuordnung)) {
    if (meldung.includes(teil)) return HINDERNIS_TEXT[hindernis];
  }
  return "Die Zusage hat nicht geklappt. Bitte versuche es erneut.";
}

export async function gastplatzZusagen(slotId: string, levelBestaetigt: boolean): Promise<Ergebnis> {
  if (!levelBestaetigt) {
    return { error: "Bitte bestätige, dass du das Level für diesen Kurs mitbringst." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("gastplatz_zusagen", {
    p_slot_id: slotId,
    p_level_bestaetigt: true,
  });

  if (error) return { error: hindernisAus(error.message) };

  revalidatePath("/profil");
  return { success: true };
}

export async function gastplatzAbsagen(buchungId: string): Promise<Ergebnis> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("gastplatz_absagen", { p_booking_id: buchungId });

  if (error) {
    console.error("Gastplatz-Absage fehlgeschlagen", error);
    return { error: "Die Absage hat nicht geklappt." };
  }

  revalidatePath("/profil");
  return { success: true };
}
