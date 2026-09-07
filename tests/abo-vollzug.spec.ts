import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

ladeTestUmgebung();

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/**
 * Der Vollzug fälliger Abo-Änderungen.
 *
 * Bis hierher war das Handarbeit: Der Kunde kündigt, das Abo merkt sich den
 * Stichtag, und am Stichtag verschickte der Versandlauf zwar eine Nachricht —
 * vollzogen hat die Änderung aber erst jemand in der Verwaltung. Blieb das
 * aus, war das Abo formal weiter aktiv und `cancelled_at` leer, und damit
 * fehlte die Kündigung in der Auswertung.
 *
 * Geprüft wird gegen den Cron-Endpunkt, also den Weg, den der Betrieb geht.
 */
/**
 * Der Cron-Endpunkt leert nebenbei die Benachrichtigungs-Warteschlange, und
 * die Test-Postfächer auf `.test` laufen dabei in SMTP-Zeitüberschreitungen.
 * Liegt ein Rückstau an, dauert ein Aufruf entsprechend — das ist kein Fehler,
 * sondern der Vorgang. Die Vorgabe von 30 Sekunden reicht dafür nicht.
 */
test.setTimeout(180_000);

const KENNUNG = "Vollzug-Pruefung";
const BASIS = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3100";

let kundeId = "";
let kursId = "";

async function aufraeumen() {
  await svc.from("subscriptions").delete().eq("name", KENNUNG);
}

async function cronLaufen(): Promise<Response> {
  return fetch(`${BASIS}/api/cron/notifications`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
}

test.beforeAll(async () => {
  const { data: kunde } = await svc
    .from("profiles")
    .select("id")
    .eq("full_name", "E2E26 Filler")
    .single();
  if (!kunde) throw new Error("Testkunde E2E26 Filler fehlt");
  kundeId = kunde.id;

  const { data: kurs } = await svc.from("courses").select("id").limit(1).single();
  kursId = kurs!.id;
});

test.beforeEach(aufraeumen);
test.afterAll(aufraeumen);

/** Ein Abo mit geplanter Änderung zum gegebenen Stichtag. */
async function legeAboAn(pendingStatus: string, stichtag: string): Promise<string> {
  const { data, error } = await svc
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      name: KENNUNG,
      price: 50,
      status: "active",
      course_id: kursId,
      pending_status: pendingStatus,
      pending_effective_date: stichtag,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Abo anlegen: ${error.message}`);
  return data.id;
}

function tageVersetzt(tage: number): string {
  const d = new Date();
  d.setDate(d.getDate() + tage);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(d);
}

test("Eine Kündigung, deren Stichtag erreicht ist, wird vollzogen und als Kündigung festgehalten", async () => {
  const stichtag = tageVersetzt(0);
  const aboId = await legeAboAn("cancelled", stichtag);

  const antwort = await cronLaufen();
  expect(antwort.status).toBe(200);

  const { data: danach } = await svc
    .from("subscriptions")
    .select("status, pending_status, pending_effective_date, cancelled_at")
    .eq("id", aboId)
    .single();

  expect(danach!.status).toBe("cancelled");
  expect(danach!.pending_status).toBeNull();
  expect(danach!.pending_effective_date).toBeNull();
  // Der Stichtag, nicht der heutige Tag — er ist die einzige dauerhafte Spur,
  // wann das Abo geendet hat, und die Auswertung zählt darüber.
  expect(danach!.cancelled_at).toBe(stichtag);
});

test("Ein verpasster Stichtag wird nachgeholt, statt für immer liegenzubleiben", async () => {
  // Fällt ein Versandlauf aus, würde ein „genau heute" den Tag überspringen.
  const stichtag = tageVersetzt(-3);
  const aboId = await legeAboAn("cancelled", stichtag);

  await cronLaufen();

  const { data: danach } = await svc
    .from("subscriptions")
    .select("status, cancelled_at")
    .eq("id", aboId)
    .single();
  expect(danach!.status).toBe("cancelled");
  expect(danach!.cancelled_at).toBe(stichtag);
});

test("Ein Stichtag in der Zukunft bleibt unangetastet", async () => {
  const aboId = await legeAboAn("cancelled", tageVersetzt(14));

  await cronLaufen();

  const { data: danach } = await svc
    .from("subscriptions")
    .select("status, pending_status")
    .eq("id", aboId)
    .single();
  expect(danach!.status).toBe("active");
  expect(danach!.pending_status).toBe("cancelled");
});

test("Eine geplante Pause wird ebenso vollzogen, aber nicht als Kündigung gezählt", async () => {
  const aboId = await legeAboAn("paused", tageVersetzt(0));

  await cronLaufen();

  const { data: danach } = await svc
    .from("subscriptions")
    .select("status, pending_status, cancelled_at")
    .eq("id", aboId)
    .single();
  expect(danach!.status).toBe("paused");
  expect(danach!.pending_status).toBeNull();
  expect(danach!.cancelled_at, "Eine Pause ist keine Kündigung").toBeNull();
});

test("Ein zweiter Lauf ändert nichts mehr", async () => {
  const stichtag = tageVersetzt(0);
  const aboId = await legeAboAn("cancelled", stichtag);

  await cronLaufen();
  const { data: nachErstem } = await svc
    .from("subscriptions")
    .select("status, cancelled_at")
    .eq("id", aboId)
    .single();

  await cronLaufen();
  const { data: nachZweitem } = await svc
    .from("subscriptions")
    .select("status, cancelled_at")
    .eq("id", aboId)
    .single();

  expect(nachZweitem).toEqual(nachErstem);
});

test("Ohne gültigen Schlüssel geschieht nichts", async () => {
  const aboId = await legeAboAn("cancelled", tageVersetzt(0));

  const antwort = await fetch(`${BASIS}/api/cron/notifications`, {
    headers: { authorization: "Bearer falsch" },
  });
  expect(antwort.status).toBe(401);

  const { data: danach } = await svc
    .from("subscriptions")
    .select("status")
    .eq("id", aboId)
    .single();
  expect(danach!.status).toBe("active");
});
