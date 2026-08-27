import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

// The Playwright runner doesn't auto-load .env.local (unlike `next dev`), but
// the fixtures below need SUPABASE_SERVICE_ROLE_KEY.
try {
  ladeTestUmgebung();
} catch {
  // Already loaded (e.g. CI env vars set directly) — safe to ignore.
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ADMIN = { email: "e2e30-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const KUNDE = { email: "e2e8-customer@viennasalsastudio.test", password: "CorrectPassword123!" };
const KURS = "E2E8 Kurs";
const AUSFALL = "2026-12-03";
const ANDERER_TERMIN = "2026-12-10";

async function fixtures() {
  const { data: kurs } = await service.from("courses").select("id, name").eq("name", KURS).single();
  const { data: sched } = await service.from("course_schedule").select("id").eq("course_id", kurs!.id).single();
  return { kurs: kurs!, scheduleId: sched!.id };
}

/** The pause and the bookings around it are exactly what these tests assert on,
 *  so each one rebuilds them instead of inheriting whatever ran before. */
async function resetFixtures() {
  const { kurs, scheduleId } = await fixtures();
  await service.from("course_schedule_pauses").delete().eq("schedule_id", scheduleId).eq("pause_date", AUSFALL);
  await service.from("course_bookings").delete().eq("course_id", kurs.id).in("chosen_date", [AUSFALL, ANDERER_TERMIN]);
  await service.from("notification_queue").delete().eq("event_type", "kursausfall");
  return { kurs, scheduleId };
}

async function createPause() {
  const { scheduleId } = await fixtures();
  const { data } = await service
    .from("course_schedule_pauses")
    .insert({ schedule_id: scheduleId, pause_date: AUSFALL })
    .select("id")
    .single();
  return data!.id;
}

test.beforeEach(resetFixtures);
test.afterAll(resetFixtures);

async function login(page: Page, creds: { email: string; password: string }) {
  await page.goto("/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(creds.email);
  await page.getByLabel("Passwort").fill(creds.password);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

async function openCourseForm(page: Page, kursName: string) {
  await page.goto("/admin/kurse");
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: kursName, exact: true }) })
    .getByRole("button", { name: "Bearbeiten" })
    .click();
  await page.waitForTimeout(1000);
}

test.describe("PROJ-38: Kursausfall-Benachrichtigung", () => {
  test("AC1: Jede Pause hat einen Knopf zum Benachrichtigen", async ({ page }) => {
    await createPause();
    await login(page, ADMIN);
    await openCourseForm(page, KURS);
    await expect(page.getByRole("button", { name: "Kunden benachrichtigen" }).first()).toBeVisible();
  });

  test("AC2: Vor dem Versand steht die Empfängerzahl und muss bestätigt werden", async ({ page }) => {
    await createPause();
    await login(page, ADMIN);
    await openCourseForm(page, KURS);
    await page.getByRole("button", { name: "Kunden benachrichtigen" }).first().click();
    await page.waitForTimeout(2500);

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(/\d+ (Person wird|Personen werden)/);
    await expect(dialog).toContainText("03.12.2026");
    await expect(dialog).toContainText("nicht zurücknehmen");
    await expect(dialog.getByRole("button", { name: "Abbrechen" })).toBeVisible();
  });

  test("AC3: Eine neu eingetragene Pause benachrichtigt niemanden von selbst", async ({ page }) => {
    const pauseId = await createPause();
    await login(page, ADMIN);
    await openCourseForm(page, KURS);

    const { data: pause } = await service
      .from("course_schedule_pauses")
      .select("notified_at")
      .eq("id", pauseId)
      .single();
    expect(pause!.notified_at, "Ferien werden Monate im Voraus eingetragen").toBeNull();

    const { data: queue } = await service.from("notification_queue").select("id").eq("event_type", "kursausfall");
    expect(queue?.length ?? 0).toBe(0);
  });

  // Der Kern des Features: Wer genau wird benachrichtigt?
  test("AC4: Nur Abo-Kunden und Gäste GENAU dieses Termins zählen — jede Person einmal", async ({ page }) => {
    const { kurs } = await resetFixtures();
    await createPause();

    const { data: kunden } = await service.from("profiles").select("id").eq("role", "customer").limit(3);
    const [amAusfalltag, andererTermin, nichtBestaetigt] = kunden!;

    await service.from("course_bookings").insert([
      { customer_id: amAusfalltag.id, course_id: kurs.id, type: "dropin", status: "confirmed", chosen_date: AUSFALL },
      { customer_id: andererTermin.id, course_id: kurs.id, type: "dropin", status: "confirmed", chosen_date: ANDERER_TERMIN },
      { customer_id: nichtBestaetigt.id, course_id: kurs.id, type: "dropin", status: "open", chosen_date: AUSFALL },
    ]);

    // Wieviele verschiedene Personen haben ein aktives Abo? Dieselbe Person
    // kann mehrere Abos halten — sie darf trotzdem nur einmal zählen.
    const { data: abos } = await service
      .from("subscriptions")
      .select("customer_id")
      .eq("course_id", kurs.id)
      .eq("status", "active");
    const aboKunden = new Set((abos ?? []).map((a) => a.customer_id));
    const erwartet = new Set([...aboKunden, amAusfalltag.id]).size;

    await login(page, ADMIN);
    await openCourseForm(page, KURS);
    await page.getByRole("button", { name: "Kunden benachrichtigen" }).first().click();
    await page.waitForTimeout(2500);

    const text = await page.getByRole("alertdialog").innerText();
    const gezaehlt = Number(text.match(/(\d+) (?:Person|Personen)/)![1]);
    expect(gezaehlt, "Gast am Ausfalltag zählt, anderer Termin und unbestätigte Buchung nicht").toBe(erwartet);
  });

  test("AC5: Ist niemand betroffen, wird nichts versendet", async ({ page }) => {
    const { kurs } = await resetFixtures();
    // Alle Abos dieses Kurses kurz stilllegen — der Leerzustand ist sonst nicht
    // herstellbar, ohne systemweit etwas zu behaupten.
    const { data: abos } = await service.from("subscriptions").select("id").eq("course_id", kurs.id).eq("status", "active");
    const ids = (abos ?? []).map((a) => a.id);
    if (ids.length) await service.from("subscriptions").update({ status: "paused" }).in("id", ids);
    await createPause();

    try {
      await login(page, ADMIN);
      await openCourseForm(page, KURS);
      await page.getByRole("button", { name: "Kunden benachrichtigen" }).first().click();
      await page.waitForTimeout(2500);

      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toContainText("niemand betroffen");
      await expect(dialog.getByRole("button", { name: "Benachrichtigung senden" })).toBeDisabled();
    } finally {
      if (ids.length) await service.from("subscriptions").update({ status: "active" }).in("id", ids);
    }
  });

  test("AC6: Eine fehlgeschlagene Zustellung wird nicht als benachrichtigt vermerkt", async ({ page }) => {
    const pauseId = await createPause();
    await login(page, ADMIN);
    await openCourseForm(page, KURS);
    await page.getByRole("button", { name: "Kunden benachrichtigen" }).first().click();
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: "Benachrichtigung senden" }).click();
    await page.waitForTimeout(12000);

    const { data: queue } = await service
      .from("notification_queue")
      .select("email_status, push_status")
      .eq("event_type", "kursausfall");
    expect(queue?.length ?? 0, "Es muss ein Zustellversuch protokolliert sein").toBeGreaterThan(0);

    // Alle Fixture-Kunden haben .test-Adressen und keine Geräte — die
    // Zustellung scheitert zwangsläufig, genau der Fall, der zählt.
    const erreicht = (queue ?? []).some((q) => q.email_status === "sent" || q.push_status === "sent");
    if (!erreicht) {
      const { data: pause } = await service
        .from("course_schedule_pauses")
        .select("notified_at")
        .eq("id", pauseId)
        .single();
      expect(pause!.notified_at, "Ohne Zustellung darf kein Vermerk entstehen").toBeNull();
      await expect(page.getByText("Keine der Benachrichtigungen konnte zugestellt werden")).toBeVisible();
    }
  });

  test("Sicherheit: Ein Kunde erreicht die Kursverwaltung nicht", async ({ page }) => {
    await login(page, KUNDE);
    await page.goto("/admin/kurse");
    await page.waitForLoadState("networkidle");
    expect(new URL(page.url()).pathname).not.toBe("/admin/kurse");
    await expect(page.getByRole("button", { name: "Kunden benachrichtigen" })).toHaveCount(0);
  });

  test("Der Ausfall-Text ist unter Benachrichtigungs-Texte anpassbar", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/benachrichtigungen");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Kursausfall", { exact: true })).toBeVisible();
  });
});
