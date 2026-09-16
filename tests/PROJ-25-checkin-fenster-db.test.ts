import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { angemeldetAls } from "./anmeldung";
import { SELF_CHECKIN_VORLAUF_STUNDEN } from "@/lib/constants/checkin";

/**
 * PROJ-25: Wann sich jemand selbst einchecken darf.
 *
 * Die Frist steht an zwei Stellen — hier wird die geprüft, die wirklich
 * entscheidet. Die andere (src/lib/constants/checkin.ts) entscheidet nur, ob
 * der Knopf erscheint; sie wird in dates.test.ts geprüft.
 *
 * Braucht die Migration 20260916190000_proj25_checkin_sechs_stunden.sql.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORT = "CorrectPassword123!";
const KUNDE = "proj25-fenster@viennasalsastudio.test";

let service: SupabaseClient;
let alsKunde: SupabaseClient;
let kundeId: string;
const kurse: string[] = [];
const abos: string[] = [];

/** Wiener Wanduhrzeit in `stunden` von jetzt an, als "HH:MM:SS". */
function wienerZeitIn(stunden: number): string {
  const ziel = new Date(Date.now() + stunden * 3_600_000);
  return ziel.toLocaleTimeString("de-AT", { timeZone: "Europe/Vienna", hour12: false });
}

/**
 * Wie viele Stunden der Wiener Tag noch hat.
 *
 * Der Selbst-Check-in gilt nur für Kurse, die **heute** stattfinden. Eine
 * Uhrzeit „in sieben Stunden" liegt am späten Abend längst im nächsten Tag —
 * als heutige Uhrzeit eingesetzt läge der Kurs dann in der Vergangenheit, und
 * die Prüfung würde das Gegenteil dessen messen, was sie soll. Genau darauf
 * ist sie beim ersten Lauf um 22:35 hereingefallen.
 */
function restDesTages(): number {
  const wien = new Date().toLocaleString("en-US", { timeZone: "Europe/Vienna" });
  const jetzt = new Date(wien);
  return 24 - jetzt.getHours() - jetzt.getMinutes() / 60;
}

/** Der heutige Wiener Wochentag in der Zählung des Projekts (0 = Montag). */
function heutigerWochentag(): number {
  const wien = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Vienna" });
  const tag = new Date(`${wien}T12:00:00Z`).getUTCDay();
  return (tag + 6) % 7;
}

/** Ein Kurs, der heute in `stunden` Stunden beginnt, mit dem Kunden als Teilnehmer. */
async function kursDerHeuteBeginntIn(stunden: number): Promise<string> {
  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data: kurs, error } = await service
    .from("courses")
    .insert({ name: `E2E25 Fenster ${Date.now()}-${stunden}`, room_id: raum!.id, price: 50 })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-25 Kurs: ${error.message}`);
  kurse.push(kurs!.id);

  // Das Ende darf nicht über Mitternacht rutschen — der Stundenplan hält eine
  // Uhrzeit, keinen Zeitpunkt, und 00:45 wäre als *heutige* Uhrzeit vor dem
  // Beginn. Der erste Anlauf ist genau daran gescheitert, und weil der Fehler
  // ungeprüft blieb, meldete die Datenbank hinterher nur „no schedule".
  const beginn = wienerZeitIn(stunden);
  const rohesEnde = wienerZeitIn(stunden + 1);
  const ende = rohesEnde > beginn ? rohesEnde : "23:59:00";

  const { error: planFehler } = await service.from("course_schedule").insert({
    course_id: kurs!.id,
    weekday: heutigerWochentag(),
    start_time: beginn,
    end_time: ende,
  });
  if (planFehler) throw new Error(`PROJ-25 Stundenplan: ${planFehler.message}`);

  // Teilnehmer wird man über ein aktives, kursgebundenes Abo (siehe die Sicht
  // course_members).
  const { data: abo, error: aboFehler } = await service
    .from("subscriptions")
    .insert({ customer_id: kundeId, course_id: kurs!.id, status: "active", name: "E2E25", price: 50 })
    .select("id")
    .single();
  if (aboFehler) throw new Error(`PROJ-25 Abo: ${aboFehler.message}`);
  abos.push(abo!.id);

  return kurs!.id;
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });

  const { data: alle } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = alle?.users.find((u) => u.email === KUNDE);
  if (alt) await service.auth.admin.deleteUser(alt.id);
  const { data, error } = await service.auth.admin.createUser({
    email: KUNDE,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-25 Konto: ${error?.message}`);
  kundeId = data.user.id;
  await service.from("profiles").update({ full_name: "E2E25 Fensterprüfung" }).eq("id", kundeId);

  alsKunde = await angemeldetAls(URL, ANON, KUNDE, PASSWORT);
}, 60_000);

afterAll(async () => {
  await service.from("course_attendance").delete().eq("customer_id", kundeId);
  await service.from("subscriptions").delete().in("id", abos);
  await service.from("course_schedule").delete().in("course_id", kurse);
  await service.from("courses").delete().in("id", kurse);
  await service.auth.admin.deleteUser(kundeId).catch(() => {});
});

describe(`PROJ-25: Das Fenster öffnet ${SELF_CHECKIN_VORLAUF_STUNDEN} Stunden vorher`, () => {
  it("entscheidet beim spätesten Kurs des Tages genau nach der Frist", async () => {
    // Diese Prüfung läuft zu jeder Tageszeit und misst trotzdem die Regel:
    // Sie legt den spätestmöglichen Kurs von heute an und leitet die Erwartung
    // aus derselben Frist ab. Vormittags fällt sie damit auf „zu früh",
    // abends auf „geht" — und beide Male muss die Datenbank zustimmen.
    const stundenBisKursbeginn = restDesTages() - 0.25;
    const kurs = await kursDerHeuteBeginntIn(stundenBisKursbeginn);
    const { data, error } = await alsKunde.rpc("self_toggle_attendance", { p_course_id: kurs });

    if (stundenBisKursbeginn > SELF_CHECKIN_VORLAUF_STUNDEN) {
      expect(error?.message, `Kurs in ${stundenBisKursbeginn.toFixed(1)} h`).toContain("too early");
    } else {
      expect(error?.message ?? null, `Kurs in ${stundenBisKursbeginn.toFixed(1)} h`).toBeNull();
      expect(data).toBe("present");
    }
  });

  it.skipIf(restDesTages() < 4)("lässt einchecken, wenn der Kurs in drei Stunden beginnt", async () => {
    // Mit der alten Frist von 30 Minuten wäre das noch „too early" gewesen —
    // genau daran zeigt sich die Änderung. Braucht einen Tag, der noch vier
    // Stunden hat.
    const kurs = await kursDerHeuteBeginntIn(3);
    const { data, error } = await alsKunde.rpc("self_toggle_attendance", { p_course_id: kurs });
    expect(error).toBeNull();
    expect(data).toBe("present");
  });

  it("lässt einchecken, wenn der Kurs gerade läuft", async () => {
    const kurs = await kursDerHeuteBeginntIn(-0.25);
    const { data, error } = await alsKunde.rpc("self_toggle_attendance", { p_course_id: kurs });
    expect(error).toBeNull();
    expect(data).toBe("present");
  });

  it("nimmt den Check-in auf demselben Weg wieder zurück", async () => {
    // Ein Kurs, der gerade läuft: im Fenster und noch nicht zu Ende. Damit
    // hängt die Prüfung nicht davon ab, wie viel vom Tag noch übrig ist.
    const kurs = await kursDerHeuteBeginntIn(-0.5);
    await alsKunde.rpc("self_toggle_attendance", { p_course_id: kurs });
    const { data } = await alsKunde.rpc("self_toggle_attendance", { p_course_id: kurs });
    expect(data).toBe("removed");
  });
});
