import { createClient } from "@/lib/supabase/server";
import { darfEingeladenWerden, type GastRolle } from "./ausschreibung";

/**
 * Alles, was der Profilabschnitt eines Gasttänzers braucht (PROJ-60).
 *
 * Gefiltert wird mit denselben Regeln, die auch die Datenbank beim Zusagen
 * anwendet (`src/lib/gasttaenzer/ausschreibung.ts`). Dass jemand eine
 * Einladung sieht, die er nicht annehmen kann, wäre die ärgerlichste Form
 * dieses Features.
 */

export type EinladungZeile = {
  slotId: string;
  kursName: string;
  termin: string;
  uhrzeit: string | null;
  ort: string | null;
  rolle: "leader" | "follower";
  freiePlaetze: number;
};

export type ZusageZeile = {
  buchungId: string;
  kursName: string;
  termin: string;
  uhrzeit: string | null;
  ort: string | null;
};

export type GasttaenzerAnsicht = {
  imProgramm: boolean;
  ausgeschlossen: boolean;
  rolle: GastRolle | null;
  level: string | null;
  einladungen: EinladungZeile[];
  zusagen: ZusageZeile[];
};

const LEER: GasttaenzerAnsicht = {
  imProgramm: false,
  ausgeschlossen: false,
  rolle: null,
  level: null,
  einladungen: [],
  zusagen: [],
};

function heuteInWien(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Vienna" });
}

function uhrzeitAus(plan: { start_time: string } | { start_time: string }[] | null): string | null {
  if (!plan) return null;
  const eintrag = Array.isArray(plan) ? plan[0] : plan;
  return eintrag?.start_time ? `${eintrag.start_time.slice(0, 5)} Uhr` : null;
}

export async function ladeGasttaenzerAnsicht(kundeId: string): Promise<GasttaenzerAnsicht> {
  const supabase = await createClient();
  const heute = heuteInWien();

  const { data: gast } = await supabase
    .from("guest_dancers")
    .select("dance_role, level, excluded_at")
    .eq("customer_id", kundeId)
    .maybeSingle();

  const { data: zusagenRoh } = await supabase
    .from("course_bookings")
    .select("id, chosen_date, courses(name, course_schedule(start_time), rooms(name))")
    .eq("customer_id", kundeId)
    .eq("type", "guest")
    .neq("status", "cancelled")
    .gte("chosen_date", heute)
    .order("chosen_date", { ascending: true });

  const zusagen: ZusageZeile[] = (zusagenRoh ?? []).map((z) => ({
    buchungId: z.id,
    kursName: z.courses?.name ?? "Kurs",
    termin: z.chosen_date,
    uhrzeit: uhrzeitAus(z.courses?.course_schedule ?? null),
    ort: z.courses?.rooms?.name ?? null,
  }));

  if (!gast) return { ...LEER, zusagen };
  if (gast.excluded_at) {
    return { ...LEER, imProgramm: true, ausgeschlossen: true, rolle: gast.dance_role as GastRolle, level: gast.level, zusagen };
  }

  // Die offenen Ausschreibungen — die Feinfilterung folgt gleich.
  const { data: slots } = await supabase
    .from("guest_slots")
    .select(
      "id, course_id, occurrence_date, dance_role, seats, min_level, courses(name, course_schedule(start_time), rooms(name))"
    )
    .is("withdrawn_at", null)
    .gte("occurrence_date", heute)
    .order("occurrence_date", { ascending: true });

  const kandidaten = slots ?? [];
  if (kandidaten.length === 0) {
    return {
      imProgramm: true,
      ausgeschlossen: false,
      rolle: gast.dance_role as GastRolle,
      level: gast.level,
      einladungen: [],
      zusagen,
    };
  }

  // Wo sitze ich ohnehin schon? Einmal fragen, nicht je Ausschreibung.
  const [{ data: mitgliedschaften }, { data: meineBuchungen }, { data: alleZusagen }] = await Promise.all([
    supabase.from("course_members").select("course_id").eq("customer_id", kundeId),
    supabase
      .from("course_bookings")
      .select("course_id, chosen_date")
      .eq("customer_id", kundeId)
      .neq("status", "cancelled")
      .gte("chosen_date", heute),
    supabase
      .from("course_bookings")
      .select("guest_slot_id")
      .in("guest_slot_id", kandidaten.map((s) => s.id))
      .neq("status", "cancelled"),
  ]);

  const meineKurse = new Set((mitgliedschaften ?? []).map((m) => m.course_id));
  const belegt = new Set((meineBuchungen ?? []).map((b) => `${b.course_id}|${b.chosen_date}`));
  const zusagenJeSlot = new Map<string, number>();
  for (const z of alleZusagen ?? []) {
    if (!z.guest_slot_id) continue;
    zusagenJeSlot.set(z.guest_slot_id, (zusagenJeSlot.get(z.guest_slot_id) ?? 0) + 1);
  }

  const einladungen: EinladungZeile[] = [];
  for (const s of kandidaten) {
    const schonImKurs = meineKurse.has(s.course_id) || belegt.has(`${s.course_id}|${s.occurrence_date}`);
    const passt = darfEingeladenWerden(
      {
        plaetze: s.seats,
        zusagen: zusagenJeSlot.get(s.id) ?? 0,
        rolle: s.dance_role as "leader" | "follower",
        mindeststufe: s.min_level,
        zurueckgezogenAm: null,
        kursBeginn: `${s.occurrence_date}T00:00:00`,
      },
      {
        imProgramm: true,
        ausgeschlossen: false,
        rolle: gast.dance_role as GastRolle,
        level: gast.level,
        schonImKurs,
      }
    );
    if (!passt) continue;

    const frei = Math.max(0, s.seats - (zusagenJeSlot.get(s.id) ?? 0));
    if (frei === 0) continue;

    einladungen.push({
      slotId: s.id,
      kursName: s.courses?.name ?? "Kurs",
      termin: s.occurrence_date,
      uhrzeit: uhrzeitAus(s.courses?.course_schedule ?? null),
      ort: s.courses?.rooms?.name ?? null,
      rolle: s.dance_role as "leader" | "follower",
      freiePlaetze: frei,
    });
  }

  return {
    imProgramm: true,
    ausgeschlossen: false,
    rolle: gast.dance_role as GastRolle,
    level: gast.level,
    einladungen,
    zusagen,
  };
}
