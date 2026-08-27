import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

// The Playwright runner doesn't auto-load .env.local (unlike `next dev`), but
// the fixture reset below needs SUPABASE_SERVICE_ROLE_KEY.
try {
  ladeTestUmgebung();
} catch {
  // Already loaded (e.g. CI env vars set directly) — safe to ignore.
}

const ADMIN_EMAIL = "qa-proj6-admin@viennasalsastudio.test";
const PASSWORD = "CorrectPassword123!";

// weekday: 0 = Montag … 6 = Sonntag
const MONTAG = 0;
const FREITAG = 4;

/**
 * These tests rewrite the very schedules they depend on: one creates a slot on
 * "Kurs Ohne Termin", another deletes the one on "Kurs Montag". Without a
 * reset the suite therefore passes exactly once and fails on every later run —
 * the fixtures end up contradicting their own names ("Ohne Termin" carrying a
 * Wednesday slot, "Montag" carrying none). There is no staging database, so
 * the starting state has to be restored explicitly here.
 */
test.beforeAll(async () => {
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const names = ["E2E6 Kurs Ohne Termin", "E2E6 Kurs Montag", "E2E6 Kurs Heute"];
  const { data: courses, error } = await service.from("courses").select("id, name").in("name", names);
  if (error) throw new Error(`PROJ-6 Fixture-Reset fehlgeschlagen: ${error.message}`);

  const byName = new Map((courses ?? []).map((c) => [c.name, c.id]));
  for (const name of names) {
    if (!byName.has(name)) throw new Error(`PROJ-6 Fixture-Kurs fehlt: ${name}`);
  }

  // Dropping the schedules also clears any pause rows left behind by an
  // aborted run (course_schedule_pauses cascades from course_schedule).
  await service.from("course_schedule").delete().in("course_id", [...byName.values()]);

  await service.from("course_schedule").insert([
    // "Kurs Montag" starts at 18:00 so the edit test can move it to 18:30.
    { course_id: byName.get("E2E6 Kurs Montag"), weekday: MONTAG, start_time: "18:00", end_time: "19:00" },
    { course_id: byName.get("E2E6 Kurs Heute"), weekday: FREITAG, start_time: "19:00", end_time: "20:00" },
    // "Kurs Ohne Termin" deliberately gets none — that is what its name means.
  ]);
});

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(ADMIN_EMAIL);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.waitForTimeout(1500); // let hydration settle, see PROJ-2 BUG-1
  await page.getByRole("button", { name: "Einloggen" }).click();
  // Admin lands on /admin after login, every other role on /profil.
  await page.waitForURL(/\/(mein-bereich|profil|admin)$/, { timeout: 10000 });
  // Seit PROJ-45 landen Kunden auf /mein-bereich. Die Prüfungen hier gelten
  // dem Profil — also dorthin, wo der Test vorher schon stand.
  if (page.url().endsWith("/mein-bereich")) await page.goto("/profil");
}

// The course catalog is paginated (PAGE_SIZE=12, "Mehr laden") — fixture
// courses created late sort past page 1 by created_at ascending.
async function loadAllCourses(page: Page) {
  await page.waitForTimeout(1000);
  const moreButton = page.getByRole("button", { name: /Mehr laden/ });
  for (let i = 0; i < 10 && (await moreButton.count()) > 0; i++) {
    await moreButton.click();
    await page.waitForTimeout(500);
  }
}

async function openCourseEdit(page: Page, courseName: string) {
  await page.goto("/admin/kurse");
  await page.getByRole("row", { name: new RegExp(courseName) }).getByRole("button", { name: "Bearbeiten" }).click();
  await page.waitForTimeout(500);
}

test.describe("PROJ-6: Stundenplan & Kalender", () => {
  test("Admin legt Wochentermin an; erscheint im Stundenplan", async ({ page }) => {
    await loginAsAdmin(page);
    await openCourseEdit(page, "E2E6 Kurs Ohne Termin");
    await page.getByLabel("Wochentag").click();
    await page.waitForTimeout(300);
    await page.getByRole("option", { name: "Mittwoch" }).click();
    await page.locator("#schedule-start").fill("17:00");
    await page.locator("#schedule-end").fill("18:00");
    await page.getByRole("button", { name: "Termin anlegen" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByRole("button", { name: "Termin entfernen" })).toBeVisible();

    await page.goto("/stundenplan");
    await page.getByRole("tab", { name: "Mittwoch" }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText("E2E6 Kurs Ohne Termin")).toBeVisible();
    await expect(page.getByText("17:00–18:00")).toBeVisible();
  });

  test("Admin ändert bestehenden Wochentermin; Änderung sofort sichtbar", async ({ page }) => {
    await loginAsAdmin(page);
    await openCourseEdit(page, "E2E6 Kurs Montag");
    await page.locator("#schedule-start").fill("18:30");
    await page.getByRole("button", { name: "Termin speichern" }).click();
    await page.waitForTimeout(800);

    await page.goto("/stundenplan");
    await page.getByRole("tab", { name: "Montag" }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText("18:30–19:00")).toBeVisible();
  });

  test("Wochentag ohne terminierten Kurs zeigt verständlichen Leerzustand", async ({ page }) => {
    // Sonntag used to be hardcoded here, but PROJ-25 moves its fixture courses
    // onto *today's* weekday — so on a Sunday this suite asserted an empty day
    // that another suite had just filled. Ask the database which weekday is
    // actually free instead of assuming one.
    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data: scheduled } = await service.from("course_schedule").select("weekday");
    const taken = new Set((scheduled ?? []).map((s) => s.weekday));
    const dayNames = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
    const freeDay = dayNames.find((_, i) => !taken.has(i));

    test.skip(!freeDay, "Aktuell hat jeder Wochentag mindestens einen terminierten Kurs.");

    await page.goto("/stundenplan");
    await page.getByRole("tab", { name: freeDay! }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText("Keine Kurse an diesem Tag")).toBeVisible();
  });

  test("Anonymer Besucher sieht Kurs mit Wochentag, Uhrzeit, Tanzstil, Level, Standort, Lehrer", async ({ page }) => {
    await page.goto("/stundenplan");
    await page.getByRole("tab", { name: "Freitag" }).click();
    await page.waitForTimeout(400);
    // Scoped to this course's own card — other teacher-less fixture courses
    // (from other feature test suites) also render "Lehrer wird noch
    // bekanntgegeben" elsewhere on the page, causing a strict-mode violation
    // on an unscoped page-wide text match.
    const card = page.locator(".rounded-lg.border").filter({ hasText: "E2E6 Kurs Heute" });
    await expect(card).toBeVisible();
    await expect(card.getByText("19:00–20:00")).toBeVisible();
    await expect(card.getByText("E2E6 Forro", { exact: true })).toBeVisible();
    await expect(card.getByText("Improver", { exact: true })).toBeVisible();
    await expect(card.getByText("E2E6 Location")).toBeVisible();
    await expect(card.getByText("Lehrer wird noch bekanntgegeben")).toBeVisible();
  });

  test("Admin markiert eine Woche als Pause; Kurs verschwindet nur für diese Woche", async ({ page }) => {
    await loginAsAdmin(page);
    await openCourseEdit(page, "E2E6 Kurs Heute");
    // "E2E6 Kurs Heute" is scheduled on Freitag, and /stundenplan shows the
    // *current* week: it hides a course only when the pause matches this
    // week's date for that weekday. So the pause has to target this week's
    // Friday, computed exactly like currentWeekDates() does — Monday-based.
    //
    // The previous version paused the *next* Friday instead, which is the same
    // day Mon–Fri but a week off on Saturday and Sunday. The test therefore
    // failed every weekend regardless of whether the feature worked.
    //
    // Local date components, not toISOString() — see PROJ-8 QA notes on the
    // UTC-conversion date-shift bug that causes.
    const now = new Date();
    const jsDayToWeekday = (day: number) => (day + 6) % 7; // 0=Montag … 6=Sonntag
    const monday = new Date(now);
    monday.setDate(now.getDate() - jsDayToWeekday(now.getDay()));
    const d = new Date(monday);
    d.setDate(monday.getDate() + 4); // Freitag dieser Woche
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    await page.locator("#schedule-pause-date").fill(today);
    // Two "Hinzufügen" buttons exist since PROJ-8 added its own entry-dates
    // section with the same label to the same admin course edit page —
    // scope to the immediate flex-row container the pause-date input sits
    // in (input -> its own wrapper div -> the shared row with the button).
    await page
      .locator("#schedule-pause-date")
      .locator("xpath=../..")
      .getByRole("button", { name: "Hinzufügen" })
      .click();
    await page.waitForTimeout(800);
    // Die Pausen-Liste zeigt seit PROJ-38 deutsches Datumsformat, wie die übrige
    // Verwaltung auch — der Eintrag wird also als 21.08.2026 gerendert, nicht
    // als 2026-08-21.
    const angezeigtesDatum = new Date(today).toLocaleDateString("de-AT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    await expect(page.getByText(angezeigtesDatum)).toBeVisible();

    await page.goto("/stundenplan");
    await page.getByRole("tab", { name: "Freitag" }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText("E2E6 Kurs Heute")).not.toBeVisible();

    // Pause wieder entfernen -> Kurs erscheint wieder
    await openCourseEdit(page, "E2E6 Kurs Heute");
    await page.getByText(angezeigtesDatum).locator("..").getByRole("button", { name: "Entfernen" }).click();
    await page.waitForTimeout(800);

    await page.goto("/stundenplan");
    await page.getByRole("tab", { name: "Freitag" }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText("E2E6 Kurs Heute")).toBeVisible();
  });

  test("Endzeit vor Startzeit wird abgelehnt", async ({ page }) => {
    await loginAsAdmin(page);
    await openCourseEdit(page, "E2E6 Kurs Montag");
    await page.locator("#schedule-start").fill("20:00");
    await page.locator("#schedule-end").fill("19:00");
    await page.getByRole("button", { name: "Termin speichern" }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText("Endzeit muss nach der Startzeit liegen")).toBeVisible();
  });

  test("Wochentermin entfernen: Kurs verschwindet aus Stundenplan, bleibt im Kurskatalog", async ({ page }) => {
    await loginAsAdmin(page);
    await openCourseEdit(page, "E2E6 Kurs Montag");
    await page.getByRole("button", { name: "Termin entfernen" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByRole("button", { name: "Termin anlegen" })).toBeVisible();

    await page.goto("/stundenplan");
    await page.getByRole("tab", { name: "Montag" }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText("E2E6 Kurs Montag")).not.toBeVisible();

    await page.goto("/kurse");
    await page.waitForTimeout(600);
    await loadAllCourses(page);
    await expect(page.getByText("E2E6 Kurs Montag")).toBeVisible();
  });
});

// Designüberarbeitung 2026-08: Standortwahl über dem Wochenplan.
test.describe("Stundenplan: Standortwahl", () => {
  test.use({ locale: "de-DE" });

  test("Standortwahl zeigt nur diesen Standort", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 950 });
    await page.goto("/stundenplan");
    await page.waitForTimeout(2500);
    await page.getByRole("tab", { name: "Donnerstag" }).click();
    await page.waitForTimeout(800);
  
    const karten = page.locator(".rounded-lg.border.bg-card");
    const alle = await karten.count();
    console.log("Alle Standorte:", alle, "Karten");
  
    await page.getByRole("button", { name: "leOrama", exact: true }).click();
    await page.waitForTimeout(800);
    const nurLeorama = await karten.count();
    const mitLeorama = await karten.filter({ hasText: "leOrama" }).count();
    console.log("Nur leOrama:", nurLeorama, "Karten, davon leOrama:", mitLeorama);
    expect(nurLeorama).toBeGreaterThan(0);
    expect(mitLeorama).toBe(nurLeorama);
    expect(nurLeorama).toBeLessThan(alle);
  
    // Die Wahl gilt für alle Wochentage, nicht nur den offenen
    await page.getByRole("tab", { name: "Mittwoch" }).click();
    await page.waitForTimeout(800);
    const mittwoch = await karten.count();
    const mittwochLeorama = await karten.filter({ hasText: "leOrama" }).count();
    console.log("Mittwoch bei leOrama:", mittwochLeorama, "von", mittwoch);
    expect(mittwochLeorama).toBe(mittwoch);
  
    await page.getByRole("button", { name: "Alle Standorte" }).click();
    await page.waitForTimeout(800);
    expect(await karten.count()).toBeGreaterThan(mittwoch);
  });
});
