import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { angemeldetAls } from "./anmeldung";

/**
 * PROJ-74: Die Anwesenheitsliste benennt Probestunde und Drop-In getrennt.
 *
 * Vorher hieß beides „buchung". Geprüft wird, dass jede der vier Quellen beim
 * richtigen Namen genannt wird — und dass ein Abo-Platz davon unberührt bleibt
 * (dort hängt PROJ-69 dran).
 *
 * Braucht die Migration 20261005200000_proj74_quelle_probestunde_dropin.sql.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORT = "CorrectPassword123!";
const ADMIN = "e2e8-admin@viennasalsastudio.test";

const KONTEN = {
  probe: "proj74-probe@viennasalsastudio.test",
  drop: "proj74-drop@viennasalsastudio.test",
  gast: "proj74-gast@viennasalsastudio.test",
  abo: "proj74-abo@viennasalsastudio.test",
};

let service: SupabaseClient;
let alsAdmin: SupabaseClient;
let kursId = "";
let aboId = "";
let slotId = "";
const ids: Record<keyof typeof KONTEN, string> = { probe: "", drop: "", gast: "", abo: "" };

function wienerDatum(versatzTage = 0): string {
  const ziel = new Date(Date.now() + versatzTage * 24 * 3_600_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(ziel);
}

const TERMIN = wienerDatum(0);

async function kontoAnlegen(mail: string, name: string): Promise<string> {
  const { data: alle } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = alle?.users.find((u) => u.email === mail);
  if (alt) await service.auth.admin.deleteUser(alt.id);
  const { data, error } = await service.auth.admin.createUser({
    email: mail,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-74 Konto ${mail}: ${error?.message}`);
  await service.from("profiles").update({ full_name: name }).eq("id", data.user.id);
  return data.user.id;
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });

  ids.probe = await kontoAnlegen(KONTEN.probe, "E2E74 Probe");
  ids.drop = await kontoAnlegen(KONTEN.drop, "E2E74 Drop");
  ids.gast = await kontoAnlegen(KONTEN.gast, "E2E74 Gast");
  ids.abo = await kontoAnlegen(KONTEN.abo, "E2E74 Abo");

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data: kurs, error: kursFehler } = await service
    .from("courses")
    .insert({ name: `E2E74 Quellenkurs ${Date.now()}`, room_id: raum!.id, price: 50 })
    .select("id")
    .single();
  if (kursFehler) throw new Error(`PROJ-74 Kurs: ${kursFehler.message}`);
  kursId = kurs!.id;

  // Ein Gastabend braucht eine Ausschreibung — die Datenbank verlangt das seit
  // PROJ-60 (`course_bookings_guest_needs_slot`).
  const { data: slot, error: slotFehler } = await service
    .from("guest_slots")
    .insert({
      course_id: kursId,
      occurrence_date: TERMIN,
      dance_role: "follower",
      seats: 1,
      min_level: "intermediate",
    })
    .select("id")
    .single();
  if (slotFehler) throw new Error(`PROJ-74 Ausschreibung: ${slotFehler.message}`);
  slotId = slot!.id;

  const { error: buchungsFehler } = await service.from("course_bookings").insert([
    { course_id: kursId, customer_id: ids.probe, type: "trial", status: "confirmed", chosen_date: TERMIN },
    { course_id: kursId, customer_id: ids.drop, type: "dropin", status: "confirmed", chosen_date: TERMIN },
    {
      course_id: kursId,
      customer_id: ids.gast,
      type: "guest",
      status: "confirmed",
      chosen_date: TERMIN,
      guest_slot_id: slotId,
      price: 0,
    },
  ]);
  if (buchungsFehler) throw new Error(`PROJ-74 Buchungen: ${buchungsFehler.message}`);

  const { data: abo, error: aboFehler } = await service
    .from("subscriptions")
    .insert({
      customer_id: ids.abo,
      course_id: kursId,
      status: "active",
      name: "E2E74",
      price: 50,
      // Gestern begonnen: Der Platz gilt heute (PROJ-69).
      cycle_anchor_date: wienerDatum(-1),
    })
    .select("id")
    .single();
  if (aboFehler) throw new Error(`PROJ-74 Abo: ${aboFehler.message}`);
  aboId = abo!.id;

  alsAdmin = await angemeldetAls(URL, ANON, ADMIN, PASSWORT);
});

afterAll(async () => {
  if (kursId) {
    await service.from("course_attendance").delete().eq("course_id", kursId);
    await service.from("course_bookings").delete().eq("course_id", kursId);
    await service.from("guest_slots").delete().eq("course_id", kursId);
  }
  if (aboId) await service.from("subscriptions").delete().eq("id", aboId);
  if (kursId) await service.from("courses").delete().eq("id", kursId);
  for (const id of Object.values(ids)) {
    if (id) await service.auth.admin.deleteUser(id).catch(() => {});
  }
});

async function quellen(): Promise<Record<string, string>> {
  const { data, error } = await alsAdmin.rpc("get_course_attendance_roster", {
    p_course_id: kursId,
    p_occurrence_date: TERMIN,
  });
  // Eine leere Antwort ohne Fehlerprüfung sähe aus wie „niemand gebucht".
  expect(error, `Anwesenheitsliste nicht lesbar: ${error?.message}`).toBeNull();
  const zeilen = (data ?? []) as { customer_id: string; source: string }[];
  return Object.fromEntries(zeilen.map((z) => [z.customer_id, z.source]));
}

describe("PROJ-74: Jede Quelle beim richtigen Namen", () => {
  it("nennt eine Probestunde „probestunde“", async () => {
    expect((await quellen())[ids.probe]).toBe("probestunde");
  });

  it("nennt einen Drop-In „dropin“", async () => {
    expect((await quellen())[ids.drop]).toBe("dropin");
  });

  it("nennt einen Gasttänzer weiterhin „gast“ (PROJ-60)", async () => {
    expect((await quellen())[ids.gast]).toBe("gast");
  });

  it("nennt einen Abo-Platz weiterhin „abo“ (PROJ-69)", async () => {
    expect((await quellen())[ids.abo]).toBe("abo");
  });

  it("nennt niemanden mehr pauschal „buchung“", async () => {
    expect(Object.values(await quellen())).not.toContain("buchung");
  });

  // Die Rechte setzt `create or replace function` zurück — der häufigste Fehler
  // bei genau dieser Art von Migration (.claude/rules/backend.md).
  it("bleibt für einen nicht angemeldeten Aufrufer verschlossen", async () => {
    const anonym = createClient(URL, ANON, { auth: { persistSession: false } });
    const { error } = await anonym.rpc("get_course_attendance_roster", {
      p_course_id: kursId,
      p_occurrence_date: TERMIN,
    });
    expect(error, "Die Liste war ohne Anmeldung abrufbar").not.toBeNull();
  });
});
