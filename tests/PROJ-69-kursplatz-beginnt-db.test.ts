import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { angemeldetAls } from "./anmeldung";

/**
 * PROJ-69: Ein Kursplatz gilt erst ab seinem Starttermin.
 *
 * Aus dem Betrieb gemeldet: Ein Kunde mit Flatrate ab Oktober konnte sich im
 * September einchecken. Geprüft wird deshalb beides, was sich auf einen
 * **Tag** bezieht — der Selbst-Check-in und die Anwesenheitsliste — und dazu
 * die Gegenprobe: Der Platz muss trotzdem sofort belegt sein, sonst ließe sich
 * der Kurs überbuchen.
 *
 * Braucht die Migration 20260924210000_proj69_kursplatz_beginnt.sql.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORT = "CorrectPassword123!";
const KUNDE = "proj69-start@viennasalsastudio.test";
const ADMIN = "e2e8-admin@viennasalsastudio.test";

let service: SupabaseClient;
let alsKunde: SupabaseClient;
let alsAdmin: SupabaseClient;
let kundeId = "";
let kursId = "";
let aboId = "";

/** Wiener Wanduhrzeit in `stunden` von jetzt an, als "HH:MM:SS". */
function wienerZeitIn(stunden: number): string {
  const ziel = new Date(Date.now() + stunden * 3_600_000);
  return ziel.toLocaleTimeString("de-AT", { timeZone: "Europe/Vienna", hour12: false });
}

/** Wie viele Stunden der Wiener Tag schon hinter sich hat. */
function bisherigeStunden(): number {
  const wien = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Vienna" }));
  return wien.getHours() + wien.getMinutes() / 60;
}

function heutigerWochentag(): number {
  const wien = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Vienna" });
  const tag = new Date(`${wien}T12:00:00Z`).getUTCDay();
  return (tag + 6) % 7;
}

function wienerDatum(versatzTage = 0): string {
  const ziel = new Date(Date.now() + versatzTage * 24 * 3_600_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(ziel);
}

const HEUTE = wienerDatum(0);

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });

  const { data: alle } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = alle?.users.find((u) => u.email === KUNDE);
  if (alt) await service.auth.admin.deleteUser(alt.id);
  const { data: neu, error: kontoFehler } = await service.auth.admin.createUser({
    email: KUNDE,
    password: PASSWORT,
    email_confirm: true,
  });
  if (kontoFehler || !neu.user) throw new Error(`PROJ-69 Konto: ${kontoFehler?.message}`);
  kundeId = neu.user.id;
  await service.from("profiles").update({ full_name: "E2E69 Startkunde" }).eq("id", kundeId);

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data: kurs, error: kursFehler } = await service
    .from("courses")
    .insert({ name: `E2E69 Startkurs ${Date.now()}`, room_id: raum!.id, price: 50 })
    .select("id")
    .single();
  if (kursFehler) throw new Error(`PROJ-69 Kurs: ${kursFehler.message}`);
  kursId = kurs!.id;

  // Eine Stunde, die gerade läuft: im Eincheck-Fenster und noch nicht zu Ende.
  const beginn = wienerZeitIn(-0.25);
  const rohesEnde = wienerZeitIn(0.75);
  const { error: planFehler } = await service.from("course_schedule").insert({
    course_id: kursId,
    weekday: heutigerWochentag(),
    start_time: beginn,
    end_time: rohesEnde > beginn ? rohesEnde : "23:59:00",
  });
  if (planFehler) throw new Error(`PROJ-69 Stundenplan: ${planFehler.message}`);

  // Der Platz beginnt erst morgen — genau der gemeldete Fall, nur einen Tag
  // statt einen Monat entfernt.
  const { data: abo, error: aboFehler } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: kursId,
      status: "active",
      name: "E2E69",
      price: 50,
      cycle_anchor_date: wienerDatum(1),
    })
    .select("id")
    .single();
  if (aboFehler) throw new Error(`PROJ-69 Abo: ${aboFehler.message}`);
  aboId = abo!.id;

  alsKunde = await angemeldetAls(URL, ANON, KUNDE, PASSWORT);
  alsAdmin = await angemeldetAls(URL, ANON, ADMIN, PASSWORT);
});

afterAll(async () => {
  if (kursId) {
    await service.from("course_attendance").delete().eq("course_id", kursId);
    await service.from("course_schedule").delete().eq("course_id", kursId);
  }
  if (aboId) await service.from("subscriptions").delete().eq("id", aboId);
  if (kursId) await service.from("courses").delete().eq("id", kursId);
  if (kundeId) await service.auth.admin.deleteUser(kundeId).catch(() => {});
});

async function anwesenheitsliste() {
  const { data } = await alsAdmin.rpc("get_course_attendance_roster", {
    p_course_id: kursId,
    p_occurrence_date: HEUTE,
  });
  return (data ?? []) as { customer_id: string; source: string }[];
}

describe.skipIf(bisherigeStunden() < 1)("PROJ-69: Der Kursplatz beginnt erst später", () => {
  it("lässt niemanden einchecken, dessen Platz erst morgen beginnt", async () => {
    const { error } = await alsKunde.rpc("self_toggle_attendance", { p_course_id: kursId });
    expect(error?.message, "Einchecken war möglich, obwohl der Platz noch nicht gilt").toContain(
      "membership not started"
    );
  });

  it("zeigt ihn heute auch nicht auf der Anwesenheitsliste", async () => {
    const liste = await anwesenheitsliste();
    expect(liste.map((z) => z.customer_id)).not.toContain(kundeId);
  });

  it("hält seinen Platz trotzdem besetzt — sonst wäre der Kurs überbuchbar", async () => {
    const { data } = await service.rpc("get_course_occupancy");
    const zeile = (data ?? []).find((z: { course_id: string }) => z.course_id === kursId);
    expect(zeile?.occupied_count, "Der gebuchte Platz zählt nicht gegen die Kursgrenze").toBe(1);
  });

  it("lässt ihn einchecken, sobald sein Platz gilt", async () => {
    await service.from("subscriptions").update({ cycle_anchor_date: HEUTE }).eq("id", aboId);
    // Von vorne: Schlägt die erste Prüfung einmal fehl, steht hier sonst schon
    // ein Eintrag, und das Umschalten meldet „removed" statt „present" — ein
    // Folgefehler, der wie ein zweiter Befund aussähe.
    await service.from("course_attendance").delete().eq("course_id", kursId).eq("customer_id", kundeId);

    const { data, error } = await alsKunde.rpc("self_toggle_attendance", { p_course_id: kursId });
    expect(error?.message ?? null, "Einchecken am Starttag abgewiesen").toBeNull();
    expect(data).toBe("present");
  });

  it("bleibt für anonyme Aufrufer verschlossen", async () => {
    // `create or replace function` setzt in Supabase die Rechte zurück und
    // vergibt sie per Voreinstellung neu an `anon`. Diese Migration hat beide
    // Funktionen ersetzt — ohne den Rechte-Block am Ende stünden sie danach
    // offen. Siehe .claude/rules/backend.md.
    const ohneKonto = createClient(URL, ANON, { auth: { persistSession: false } });

    const { error: checkin } = await ohneKonto.rpc("self_toggle_attendance", { p_course_id: kursId });
    expect(checkin, "Selbst-Check-in war ohne Konto aufrufbar").not.toBeNull();

    const { error: liste } = await ohneKonto.rpc("get_course_attendance_roster", {
      p_course_id: kursId,
      p_occurrence_date: HEUTE,
    });
    expect(liste, "Anwesenheitsliste war ohne Konto aufrufbar").not.toBeNull();
  });

  it("und zeigt ihn dann auch dem Lehrer", async () => {
    const liste = await anwesenheitsliste();
    const eintrag = liste.find((z) => z.customer_id === kundeId);
    expect(eintrag, "Nicht auf der Anwesenheitsliste").toBeTruthy();
    expect(eintrag!.source).toBe("abo");
  });
});
