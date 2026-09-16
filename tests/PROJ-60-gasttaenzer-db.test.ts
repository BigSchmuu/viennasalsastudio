import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { angemeldetAls } from "./anmeldung";

/**
 * PROJ-60: Was die Datenbank beim Gasttänzer-Programm durchsetzt.
 *
 * Der Kern ist die Vergabe des letzten Platzes. Zwei Menschen tippen im selben
 * Moment auf „Ich springe ein" — es darf nur einer hineinkommen. Alles andere
 * hier prüft, dass niemand über die Oberfläche hinweg zusagen kann, der nicht
 * eingeladen war.
 *
 * Braucht die Migration 20260916160000_proj60_gasttaenzer.sql.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORT = "CorrectPassword123!";

const ADMIN = "proj60-admin@viennasalsastudio.test";
const GAST_A = "proj60-gast-a@viennasalsastudio.test";
const GAST_B = "proj60-gast-b@viennasalsastudio.test";
const AUSSEN = "proj60-aussen@viennasalsastudio.test";

let service: SupabaseClient;
let alsAdmin: SupabaseClient;
let alsA: SupabaseClient;
let alsB: SupabaseClient;
let alsAussen: SupabaseClient;
const nutzer: Record<string, string> = {};
let kursId: string;
let terminDatum: string;
const slots: string[] = [];

/** Ein Datum in sieben Tagen, als Wiener Kalendertag. */
function inSiebenTagen(): string {
  const d = new Date(Date.now() + 7 * 86_400_000);
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Vienna" });
}

/** Der Wochentag in der Zählung des Projekts: 0 = Montag. */
function wochentag(datum: string): number {
  const tag = new Date(`${datum}T12:00:00Z`).getUTCDay(); // 0 = Sonntag
  return (tag + 6) % 7;
}

async function kontoAnlegen(mail: string, rolle: "admin" | "customer"): Promise<string> {
  const { data: alle } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = alle?.users.find((u) => u.email === mail);
  if (alt) await service.auth.admin.deleteUser(alt.id);
  const { data, error } = await service.auth.admin.createUser({
    email: mail,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-60 Konto ${mail}: ${error?.message}`);
  await service.from("profiles").update({ role: rolle, full_name: `E2E60 ${mail.split("@")[0]}` }).eq("id", data.user.id);
  nutzer[mail] = data.user.id;
  return data.user.id;
}

async function ausschreiben(felder: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await service
    .from("guest_slots")
    .insert({
      course_id: kursId,
      occurrence_date: terminDatum,
      dance_role: "follower",
      seats: 1,
      min_level: "intermediate",
      ...felder,
    })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-60 Ausschreibung: ${error.message}`);
  slots.push(data.id);
  return data.id;
}

async function zusagenAufraeumen(): Promise<void> {
  await service.from("course_bookings").delete().in("guest_slot_id", slots);
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });
  await kontoAnlegen(ADMIN, "admin");
  await kontoAnlegen(GAST_A, "customer");
  await kontoAnlegen(GAST_B, "customer");
  await kontoAnlegen(AUSSEN, "customer");

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data: kurs, error: kursFehler } = await service
    .from("courses")
    .insert({
      name: `E2E60 Gastkurs ${Date.now()}`,
      room_id: raum!.id,
      level: "improver",
      role_query_enabled: true,
      max_role_difference: 2,
      max_participants: 20,
    })
    .select("id")
    .single();
  if (kursFehler) throw new Error(`PROJ-60 Kurs: ${kursFehler.message}`);
  kursId = kurs!.id;

  terminDatum = inSiebenTagen();
  await service.from("course_schedule").insert({
    course_id: kursId,
    weekday: wochentag(terminDatum),
    start_time: "20:00",
    end_time: "21:00",
  });

  // A und B sind im Programm und passen auf eine Follower-Ausschreibung,
  // „außen" ist gar nicht dabei.
  await service.from("guest_dancers").insert([
    { customer_id: nutzer[GAST_A], dance_role: "follower", level: "advanced" },
    { customer_id: nutzer[GAST_B], dance_role: "both", level: "intermediate" },
  ]);

  alsAdmin = await angemeldetAls(URL, ANON, ADMIN, PASSWORT);
  alsA = await angemeldetAls(URL, ANON, GAST_A, PASSWORT);
  alsB = await angemeldetAls(URL, ANON, GAST_B, PASSWORT);
  alsAussen = await angemeldetAls(URL, ANON, AUSSEN, PASSWORT);
}, 90_000);

afterAll(async () => {
  await service.from("course_bookings").delete().eq("course_id", kursId);
  await service.from("guest_slots").delete().eq("course_id", kursId);
  await service.from("course_schedule").delete().eq("course_id", kursId);
  await service.from("courses").delete().eq("id", kursId);
  await service.from("guest_dancers").delete().in("customer_id", Object.values(nutzer));
  for (const kennung of Object.values(nutzer)) {
    await service.auth.admin.deleteUser(kennung).catch(() => {});
  }
});

describe("PROJ-60: Zusagen", () => {
  it("legt eine Gastbuchung zum Preis 0 an", async () => {
    const slot = await ausschreiben();
    const { data, error } = await alsA.rpc("gastplatz_zusagen", {
      p_slot_id: slot,
      p_level_bestaetigt: true,
    });
    expect(error).toBeNull();

    const { data: buchung } = await service
      .from("course_bookings")
      .select("type, status, price, dance_role, chosen_date, guest_slot_id")
      .eq("id", data as string)
      .single();
    expect(buchung!.type).toBe("guest");
    expect(buchung!.status).toBe("confirmed");
    expect(Number(buchung!.price)).toBe(0);
    expect(buchung!.dance_role).toBe("follower");
    expect(buchung!.chosen_date).toBe(terminDatum);
    expect(buchung!.guest_slot_id).toBe(slot);

    await zusagenAufraeumen();
  });

  it("gibt bei zwei gleichzeitigen Zusagen genau einen Platz her", async () => {
    const slot = await ausschreiben({ seats: 1 });
    const [a, b] = await Promise.all([
      alsA.rpc("gastplatz_zusagen", { p_slot_id: slot, p_level_bestaetigt: true }),
      alsB.rpc("gastplatz_zusagen", { p_slot_id: slot, p_level_bestaetigt: true }),
    ]);

    const erfolge = [a, b].filter((r) => r.error === null);
    const fehler = [a, b].filter((r) => r.error !== null);
    expect(erfolge).toHaveLength(1);
    expect(fehler).toHaveLength(1);
    expect(fehler[0].error!.message).toContain("no seats left");

    const { data: zusagen } = await service
      .from("course_bookings")
      .select("id")
      .eq("guest_slot_id", slot)
      .neq("status", "cancelled");
    expect(zusagen).toHaveLength(1);

    await zusagenAufraeumen();
  });

  it("weist ohne Level-Bestätigung ab", async () => {
    const slot = await ausschreiben();
    const { error } = await alsA.rpc("gastplatz_zusagen", { p_slot_id: slot, p_level_bestaetigt: false });
    expect(error?.message).toContain("level not confirmed");
  });

  it("weist ein zu niedriges Level ab", async () => {
    const slot = await ausschreiben({ min_level: "advanced" });
    const { error } = await alsB.rpc("gastplatz_zusagen", { p_slot_id: slot, p_level_bestaetigt: true });
    expect(error?.message).toContain("level too low");
  });

  it("weist die falsche Rolle ab", async () => {
    const slot = await ausschreiben({ dance_role: "leader" });
    // A tanzt nur Follower; B tanzt beides und käme durch.
    const { error } = await alsA.rpc("gastplatz_zusagen", { p_slot_id: slot, p_level_bestaetigt: true });
    expect(error?.message).toContain("role mismatch");
  });

  it("weist ab, wer gar nicht im Programm ist", async () => {
    const slot = await ausschreiben();
    const { error } = await alsAussen.rpc("gastplatz_zusagen", { p_slot_id: slot, p_level_bestaetigt: true });
    expect(error?.message).toContain("not in programme");
  });

  it("weist einen Ausgeschlossenen ab", async () => {
    await service
      .from("guest_dancers")
      .update({ excluded_at: new Date().toISOString() })
      .eq("customer_id", nutzer[GAST_A]);

    const slot = await ausschreiben();
    const { error } = await alsA.rpc("gastplatz_zusagen", { p_slot_id: slot, p_level_bestaetigt: true });
    expect(error?.message).toContain("excluded");

    await service.from("guest_dancers").update({ excluded_at: null }).eq("customer_id", nutzer[GAST_A]);
  });

  it("weist eine zurückgezogene Ausschreibung ab", async () => {
    const slot = await ausschreiben({ withdrawn_at: new Date().toISOString() });
    const { error } = await alsA.rpc("gastplatz_zusagen", { p_slot_id: slot, p_level_bestaetigt: true });
    expect(error?.message).toContain("withdrawn");
  });

  it("weist nach Kursbeginn ab", async () => {
    const gestern = new Date(Date.now() - 86_400_000).toLocaleDateString("en-CA", { timeZone: "Europe/Vienna" });
    await service.from("course_schedule").update({ weekday: wochentag(gestern) }).eq("course_id", kursId);
    const slot = await ausschreiben({ occurrence_date: gestern });

    const { error } = await alsA.rpc("gastplatz_zusagen", { p_slot_id: slot, p_level_bestaetigt: true });
    expect(error?.message).toContain("course already started");

    await service.from("course_schedule").update({ weekday: wochentag(terminDatum) }).eq("course_id", kursId);
  });

  it("gibt den Platz nach einer Absage wieder frei", async () => {
    const slot = await ausschreiben({ seats: 1 });
    const { data: buchung } = await alsA.rpc("gastplatz_zusagen", {
      p_slot_id: slot,
      p_level_bestaetigt: true,
    });

    const { error: vollFehler } = await alsB.rpc("gastplatz_zusagen", {
      p_slot_id: slot,
      p_level_bestaetigt: true,
    });
    expect(vollFehler?.message).toContain("no seats left");

    await alsA.rpc("gastplatz_absagen", { p_booking_id: buchung as string });

    const { error: jetztFehler } = await alsB.rpc("gastplatz_zusagen", {
      p_slot_id: slot,
      p_level_bestaetigt: true,
    });
    expect(jetztFehler).toBeNull();

    await zusagenAufraeumen();
  });

  it("lässt niemanden eine fremde Zusage absagen", async () => {
    const slot = await ausschreiben();
    const { data: buchung } = await alsA.rpc("gastplatz_zusagen", {
      p_slot_id: slot,
      p_level_bestaetigt: true,
    });

    const { error } = await alsB.rpc("gastplatz_absagen", { p_booking_id: buchung as string });
    expect(error?.message).toContain("not your booking");

    await zusagenAufraeumen();
  });
});

describe("PROJ-60: Empfängerkreis", () => {
  it("nennt nur Passende und nur dem Betreiber", async () => {
    const slot = await ausschreiben({ min_level: "intermediate", dance_role: "follower" });

    const { data, error } = await alsAdmin.rpc("gastplatz_empfaenger", { p_slot_id: slot });
    expect(error).toBeNull();
    const ids = (data as { customer_id: string }[]).map((r) => r.customer_id);
    expect(ids).toContain(nutzer[GAST_A]);
    expect(ids).toContain(nutzer[GAST_B]);
    expect(ids).not.toContain(nutzer[AUSSEN]);

    const { error: kundenFehler } = await alsA.rpc("gastplatz_empfaenger", { p_slot_id: slot });
    expect(kundenFehler?.message).toContain("not authorized");
  });

  it("lässt bei einer Leader-Ausschreibung den reinen Follower weg", async () => {
    const slot = await ausschreiben({ dance_role: "leader" });
    const { data } = await alsAdmin.rpc("gastplatz_empfaenger", { p_slot_id: slot });
    const ids = (data as { customer_id: string }[]).map((r) => r.customer_id);
    expect(ids).not.toContain(nutzer[GAST_A]);
    expect(ids).toContain(nutzer[GAST_B]);
  });

  it("lädt niemanden ein, der an dem Abend schon im Kurs ist", async () => {
    const slot = await ausschreiben();
    await service.from("course_bookings").insert({
      course_id: kursId,
      customer_id: nutzer[GAST_A],
      type: "dropin",
      status: "confirmed",
      chosen_date: terminDatum,
    });

    const { data } = await alsAdmin.rpc("gastplatz_empfaenger", { p_slot_id: slot });
    const ids = (data as { customer_id: string }[]).map((r) => r.customer_id);
    expect(ids).not.toContain(nutzer[GAST_A]);

    await service.from("course_bookings").delete().eq("course_id", kursId).eq("type", "dropin");
  });
});

describe("PROJ-60: Auf der Anwesenheitsliste", () => {
  it("erscheint der Gast mit der Quelle „gast\"", async () => {
    const slot = await ausschreiben();
    await alsA.rpc("gastplatz_zusagen", { p_slot_id: slot, p_level_bestaetigt: true });

    const { data, error } = await alsAdmin.rpc("get_course_attendance_roster", {
      p_course_id: kursId,
      p_occurrence_date: terminDatum,
    });
    expect(error).toBeNull();
    const zeile = (data as { customer_id: string; source: string }[]).find(
      (r) => r.customer_id === nutzer[GAST_A]
    );
    expect(zeile?.source).toBe("gast");

    await zusagenAufraeumen();
  });
});
