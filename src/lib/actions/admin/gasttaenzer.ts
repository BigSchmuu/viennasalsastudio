"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { enqueueAndDispatch } from "@/lib/notifications/dispatch";
import { ausschreibungSchema } from "@/lib/validations/gasttaenzer";

type Ergebnis = { error: string } | { success: true };

export type SchieflageZeile = {
  courseId: string;
  kursName: string;
  leader: number;
  follower: number;
  grenze: number;
  fehlendeRolle: "leader" | "follower";
  fehlendeAnzahl: number;
};

export type AusschreibungZeile = {
  id: string;
  kursName: string;
  termin: string;
  rolle: "leader" | "follower";
  plaetze: number;
  zusagen: number;
  mindeststufe: string | null;
  zurueckgezogenAm: string | null;
};

export type TeilnehmerZeile = {
  customerId: string;
  name: string;
  rolle: string;
  level: string;
  seit: string;
  ausgeschlossenAm: string | null;
};

/** Kurse, deren Rollendifferenz die eingestellte Grenze überschreitet. */
export async function getSchieflage(): Promise<SchieflageZeile[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("get_course_role_balance");

  if (error) {
    console.error("Schieflage nicht lesbar", error);
    return [];
  }

  return (data ?? []).map((z) => ({
    courseId: z.course_id,
    kursName: z.course_name,
    leader: z.leader_count,
    follower: z.follower_count,
    grenze: z.max_role_difference,
    fehlendeRolle: z.fehlende_rolle as "leader" | "follower",
    fehlendeAnzahl: z.fehlende_anzahl,
  }));
}

/** Laufende und kürzlich zurückgezogene Ausschreibungen samt Zusagen. */
export async function getAusschreibungen(): Promise<AusschreibungZeile[]> {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from("guest_slots")
    .select("id, occurrence_date, dance_role, seats, min_level, withdrawn_at, courses(name)")
    .gte("occurrence_date", new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Vienna" }))
    .order("occurrence_date", { ascending: true });

  if (error) {
    console.error("Ausschreibungen nicht lesbar", error);
    return [];
  }

  // Die Zusagen werden gezählt, nicht mitgeführt: Ein gespeicherter Zähler und
  // die tatsächlichen Buchungen driften irgendwann auseinander.
  const ids = (data ?? []).map((a) => a.id);
  const zusagenJeSlot = new Map<string, number>();
  if (ids.length > 0) {
    const { data: buchungen } = await supabase
      .from("course_bookings")
      .select("guest_slot_id")
      .in("guest_slot_id", ids)
      .neq("status", "cancelled");
    for (const b of buchungen ?? []) {
      if (!b.guest_slot_id) continue;
      zusagenJeSlot.set(b.guest_slot_id, (zusagenJeSlot.get(b.guest_slot_id) ?? 0) + 1);
    }
  }

  return (data ?? []).map((a) => ({
    id: a.id,
    kursName: a.courses?.name ?? "—",
    termin: a.occurrence_date,
    rolle: a.dance_role as "leader" | "follower",
    plaetze: a.seats,
    zusagen: zusagenJeSlot.get(a.id) ?? 0,
    mindeststufe: a.min_level,
    zurueckgezogenAm: a.withdrawn_at,
  }));
}

export async function getProgrammteilnehmer(): Promise<TeilnehmerZeile[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("guest_dancers")
    .select("customer_id, dance_role, level, joined_at, excluded_at, profiles(full_name)")
    .order("joined_at", { ascending: false });

  if (error) {
    console.error("Programmteilnehmer nicht lesbar", error);
    return [];
  }

  return (data ?? []).map((g) => ({
    customerId: g.customer_id,
    name: g.profiles?.full_name || "Unbenannt",
    rolle: g.dance_role,
    level: g.level,
    seit: g.joined_at,
    ausgeschlossenAm: g.excluded_at,
  }));
}

/**
 * Plätze ausschreiben und die passenden Gasttänzer einladen (PROJ-60).
 *
 * Wer eingeladen wird, entscheidet die Datenbank — dieselbe Regel, die auch
 * über eine Zusage entscheidet. Zwei Fassungen davon würden auseinanderlaufen,
 * und dann bekäme jemand eine Einladung, die er nicht annehmen kann.
 */
export async function ausschreiben(formData: FormData): Promise<Ergebnis> {
  const { supabase } = await requireAdmin();

  const parsed = ausschreibungSchema.safeParse({
    course_id: formData.get("course_id"),
    occurrence_date: formData.get("occurrence_date"),
    dance_role: formData.get("dance_role"),
    seats: formData.get("seats"),
    min_level: formData.get("min_level") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Bitte die Angaben prüfen." };
  }

  const { data: slot, error } = await supabase
    .from("guest_slots")
    .insert({
      course_id: parsed.data.course_id,
      occurrence_date: parsed.data.occurrence_date,
      dance_role: parsed.data.dance_role,
      seats: Number(parsed.data.seats),
      min_level: parsed.data.min_level || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Ausschreibung fehlgeschlagen", error);
    return { error: "Die Ausschreibung hat nicht geklappt." };
  }

  const { data: empfaenger, error: empfaengerFehler } = await supabase.rpc("gastplatz_empfaenger", {
    p_slot_id: slot.id,
  });

  if (empfaengerFehler) {
    console.error("Empfängerkreis nicht ermittelbar", empfaengerFehler);
  }

  // Sofort zustellen, nicht nur einreihen: Die Warteschlange wird zweimal am
  // Tag geleert (06:00 und 18:00). Eine Einladung kann für **heute Abend**
  // sein — dann wäre sie wertlos, wenn sie erst am nächsten Morgen ankommt.
  // Genau dieser Fehler ist beim ersten Versuch in der Produktion aufgefallen.
  //
  // Nebeneinander statt nacheinander: Jede Zustellung ist ein eigener Aufruf
  // nach draußen, und bei zwanzig Empfängern summierte sich das sonst zu einer
  // spürbaren Wartezeit für den Betreiber.
  await Promise.all(
    (empfaenger ?? []).map((e) =>
      enqueueAndDispatch({
        customerId: e.customer_id,
        eventType: "gasttaenzer_einladung",
        payload: { slot_id: slot.id, sub_type: "einladung" },
        dedupeKey: `gasttaenzer_einladung:${slot.id}:${e.customer_id}`,
      })
    )
  );

  revalidatePath("/admin/gasttaenzer");
  return { success: true };
}

/**
 * Eine Ausschreibung zurückziehen.
 *
 * Wer bereits zugesagt hat, erfährt es — sonst stünde er am Dienstag umsonst
 * im Studio. Seine Zusage wird dabei abgesagt, nicht nur die Ausschreibung
 * geschlossen.
 */
export async function ausschreibungZurueckziehen(slotId: string): Promise<Ergebnis> {
  const { supabase, user } = await requireAdmin();

  const { error } = await supabase
    .from("guest_slots")
    .update({ withdrawn_at: new Date().toISOString(), withdrawn_by: user.id })
    .eq("id", slotId);

  if (error) {
    console.error("Zurückziehen fehlgeschlagen", error);
    return { error: "Das Zurückziehen hat nicht geklappt." };
  }

  const { data: zusagen } = await supabase
    .from("course_bookings")
    .select("id, customer_id")
    .eq("guest_slot_id", slotId)
    .neq("status", "cancelled");

  for (const z of zusagen ?? []) {
    await supabase.rpc("gastplatz_absagen", { p_booking_id: z.id });
    // Auch hier sofort: Wer zugesagt hat, soll nicht abends im Studio stehen,
    // weil die Absage noch in der Warteschlange liegt.
    await enqueueAndDispatch({
      customerId: z.customer_id,
      eventType: "gasttaenzer_einladung",
      payload: { slot_id: slotId, sub_type: "zurueckgezogen" },
      dedupeKey: `gasttaenzer_zurueckgezogen:${slotId}:${z.customer_id}`,
    });
  }

  revalidatePath("/admin/gasttaenzer");
  return { success: true };
}

/**
 * Jemanden aus dem Programm nehmen.
 *
 * Der Eintrag bleibt stehen und wird nur als ausgeschlossen vermerkt — sonst
 * meldete sich derselbe Mensch am nächsten Tag neu an, und niemand wüsste mehr,
 * warum er weg war. Bereits zugesagte Abende bleiben gültig; der Ausschluss
 * wirkt nach vorn.
 */
export async function gasttaenzerAusschliessen(customerId: string): Promise<Ergebnis> {
  const { supabase, user } = await requireAdmin();

  const { error } = await supabase
    .from("guest_dancers")
    .update({ excluded_at: new Date().toISOString(), excluded_by: user.id })
    .eq("customer_id", customerId);

  if (error) {
    console.error("Ausschluss fehlgeschlagen", error);
    return { error: "Der Ausschluss hat nicht geklappt." };
  }

  revalidatePath("/admin/gasttaenzer");
  return { success: true };
}

/** Einen Ausschluss wieder aufheben. */
export async function gasttaenzerWiederZulassen(customerId: string): Promise<Ergebnis> {
  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("guest_dancers")
    .update({ excluded_at: null, excluded_by: null })
    .eq("customer_id", customerId);

  if (error) {
    console.error("Wiederzulassung fehlgeschlagen", error);
    return { error: "Das hat nicht geklappt." };
  }

  revalidatePath("/admin/gasttaenzer");
  return { success: true };
}
