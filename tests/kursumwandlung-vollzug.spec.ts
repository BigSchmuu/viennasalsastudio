import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

ladeTestUmgebung();

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Der Vollzug vorgemerkter Kursumwandlungen (PROJ-51).
 *
 * Aus Beginner 1 wird Beginner 2: derselbe Kurs, dieselbe Gruppe, nur Name und
 * Level ändern sich. Geprüft wird gegen den Cron-Endpunkt, also den Weg, den
 * der Betrieb geht — und nicht gegen die Funktion allein.
 *
 * Der Endpunkt leert nebenbei die Benachrichtigungs-Warteschlange, und die
 * Test-Postfächer auf `.test` laufen dabei in SMTP-Zeitüberschreitungen. Ein
 * Aufruf dauert entsprechend; das ist der Vorgang, kein Fehler.
 */
test.setTimeout(240_000);

const KURS_NAME = "E2E51V Beginner 1";
const NEUER_NAME = "E2E51V Beginner 2";
const KUNDE_MAIL = "e2e51v-kunde@viennasalsastudio.test";
const ABO_NAME = "E2E51V Abo";
const BASIS = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3100";

let kursId = "";
let kundeId = "";

async function cronLaufen(): Promise<Response> {
  return fetch(`${BASIS}/api/cron/notifications`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
}

function tageVersetzt(tage: number): string {
  const d = new Date();
  d.setDate(d.getDate() + tage);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(d);
}

async function aufraeumen() {
  await svc.from("subscriptions").delete().eq("name", ABO_NAME);
  await svc.from("courses").delete().in("name", [KURS_NAME, NEUER_NAME]);
  if (kundeId) await svc.from("notification_queue").delete().eq("customer_id", kundeId);
}

test.beforeAll(async () => {
  const { data: alle } = await svc.auth.admin.listUsers({ perPage: 400 });
  const alt = alle.users.find((u) => u.email === KUNDE_MAIL);
  if (alt) await svc.auth.admin.deleteUser(alt.id);
  const { data: angelegt, error } = await svc.auth.admin.createUser({
    email: KUNDE_MAIL,
    password: "CorrectPassword123!",
    email_confirm: true,
  });
  if (error) throw new Error(`Testkunde: ${error.message}`);
  kundeId = angelegt.user.id;
  await svc.from("profiles").update({ full_name: "E2E51V Kunde" }).eq("id", kundeId);
});

test.afterAll(async () => {
  await aufraeumen();
  if (kundeId) await svc.auth.admin.deleteUser(kundeId);
});

test.beforeEach(aufraeumen);

/** Ein Kurs mit vorgemerkter Umwandlung — und einem Kunden darin. */
async function legeKursAn(stichtag: string): Promise<void> {
  const { data: raum } = await svc.from("rooms").select("id").limit(1).single();
  const { data: kurs, error } = await svc
    .from("courses")
    .insert({
      name: KURS_NAME,
      room_id: raum!.id,
      level: "beginner",
      pending_name: NEUER_NAME,
      pending_level: "intermediate",
      pending_effective_date: stichtag,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Kurs anlegen: ${error.message}`);
  kursId = kurs.id;

  const { error: aboFehler } = await svc.from("subscriptions").insert({
    customer_id: kundeId,
    course_id: kursId,
    name: ABO_NAME,
    price: 45,
    status: "active",
  });
  if (aboFehler) throw new Error(`Abo anlegen: ${aboFehler.message}`);
}

async function kursZustand() {
  const { data } = await svc
    .from("courses")
    .select("name, level, pending_name, pending_effective_date, pending_announced_at")
    .eq("id", kursId)
    .single();
  return data!;
}

async function ankuendigungen(): Promise<number> {
  const { count } = await svc
    .from("notification_queue")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", kundeId)
    .eq("event_type", "kursumwandlung");
  return count ?? 0;
}

test("Am Stichtag heißt der Kurs neu — und die Kunden bleiben eingeschrieben", async () => {
  await legeKursAn(tageVersetzt(0));

  const antwort = await cronLaufen();
  expect(antwort.status).toBe(200);

  const danach = await kursZustand();
  expect(danach.name).toBe(NEUER_NAME);
  expect(danach.level).toBe("intermediate");
  expect(danach.pending_name, "Die Vormerkung blieb stehen").toBeNull();
  expect(danach.pending_effective_date).toBeNull();

  // Der Kern der ganzen Entscheidung: derselbe Kurs, deshalb hängt das Abo
  // unverändert daran. Ein neuer Kurs hätte jede Verknüpfung einzeln gebraucht.
  const { data: abo } = await svc
    .from("subscriptions")
    .select("course_id, status")
    .eq("name", ABO_NAME)
    .single();
  expect(abo!.course_id).toBe(kursId);
  expect(abo!.status).toBe("active");
});

test("Eine Woche vorher wird angekündigt, umgewandelt aber noch nicht", async () => {
  await legeKursAn(tageVersetzt(7));

  await cronLaufen();

  const danach = await kursZustand();
  expect(danach.name, "Der Kurs wurde zu früh umbenannt").toBe(KURS_NAME);
  expect(danach.pending_announced_at, "Es wurde nicht angekündigt").not.toBeNull();
  expect(await ankuendigungen()).toBe(1);
});

test("Ein zweiter Lauf kündigt nicht noch einmal an", async () => {
  await legeKursAn(tageVersetzt(7));

  await cronLaufen();
  await cronLaufen();

  expect(await ankuendigungen(), "Derselbe Kunde wurde zweimal angeschrieben").toBe(1);
});

test("Ein Stichtag in fünf Wochen bleibt unangetastet", async () => {
  await legeKursAn(tageVersetzt(35));

  await cronLaufen();

  const danach = await kursZustand();
  expect(danach.name).toBe(KURS_NAME);
  expect(danach.pending_announced_at, "Zu früh angekündigt").toBeNull();
  expect(await ankuendigungen()).toBe(0);
});

test("Ein verpasster Stichtag wird nachgeholt", async () => {
  // Fällt ein Lauf aus, würde ein „genau heute" den Tag überspringen und die
  // Umwandlung bliebe für immer liegen.
  await legeKursAn(tageVersetzt(-3));

  await cronLaufen();

  expect((await kursZustand()).name).toBe(NEUER_NAME);
});
