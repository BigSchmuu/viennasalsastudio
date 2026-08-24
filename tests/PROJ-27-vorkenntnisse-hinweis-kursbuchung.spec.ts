import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// The Playwright runner doesn't auto-load .env.local (unlike `next dev`), but
// the fixture reset below needs SUPABASE_SERVICE_ROLE_KEY.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Already loaded (e.g. CI env vars set directly) — safe to ignore.
}

const HINWEIS_TEXT = "Baut auf Salsa Beginner 1 auf";
const CONFIRM_LABEL = "Ich bestätige, dass ich die genannte Voraussetzung erfülle.";
const HINWEIS_KURS = "E2E27 Mit Hinweis Kurs";

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test.beforeAll(async () => {
  // AC7 deliberately clears the course's prerequisite_note as the very thing
  // it tests — which permanently destroys AC1's precondition, so the suite
  // only ever passed once. Restore the note before each run.
  const { error } = await service
    .from("courses")
    .update({ prerequisite_note: HINWEIS_TEXT })
    .eq("name", HINWEIS_KURS);
  if (error) throw new Error(`Could not restore PROJ-27 fixture note: ${error.message}`);

  // AC2 also asserts the note on /stundenplan, which only renders upcoming
  // occurrences — a course pinned to a fixed weekday is invisible there on
  // every other day. Repin both fixture courses to today (same approach as
  // PROJ-25/PROJ-26).
  const jsDay = new Date().getDay();
  const todayWeekday = jsDay === 0 ? 6 : jsDay - 1; // app convention: 0=Mo ... 6=So
  const { data: scheduleCourses } = await service.from("courses").select("id").like("name", "E2E27%");
  for (const c of scheduleCourses ?? []) {
    await service.from("course_schedule").update({ weekday: todayWeekday }).eq("course_id", c.id);
  }

  // AC6 books a trial for e2e8-customer on this course every run. Those pile
  // up and — because they share the e2e8-customer fixture — also break
  // PROJ-8's trial-count assertions when both suites run together.
  const { data: course } = await service.from("courses").select("id").eq("name", HINWEIS_KURS).maybeSingle();
  const { data: users } = await service.auth.admin.listUsers({ perPage: 200 });
  const customerId = users?.users.find((u) => u.email === "e2e8-customer@viennasalsastudio.test")?.id;
  if (course && customerId) {
    await service.from("course_bookings").delete().eq("course_id", course.id).eq("customer_id", customerId);
  }
});

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill("CorrectPassword123!");
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForTimeout(1500);
}

// /kurse paginates at 12 cards; the E2E27 fixtures sort near the end of the
// (created_at-ascending) unfiltered catalog, so tests need to click through
// "Mehr laden" before locating them by name.
async function loadAllCourses(page: import("@playwright/test").Page) {
  // Give client-side hydration time to attach the button's onClick before
  // clicking it — otherwise the click fires on inert (not-yet-hydrated)
  // markup and silently does nothing, see PROJ-2 BUG-1.
  await page.waitForTimeout(1000);
  const moreButton = page.getByRole("button", { name: /Mehr laden/ });
  for (let i = 0; i < 10 && (await moreButton.count()) > 0; i++) {
    await moreButton.click();
    await page.waitForTimeout(500);
  }
}

test.describe("PROJ-27: Vorkenntnisse-Hinweis bei Kursbuchung", () => {
  test("AC1: Admin trägt Hinweis im Kurs-Formular ein und speichert", async ({ page }) => {
    await login(page, "e2e8-admin@viennasalsastudio.test");
    await page.goto("/admin/kurse");
    await page.waitForTimeout(1000);

    const row = page.getByRole("row", { name: /E2E27 Mit Hinweis Kurs/ });
    await row.getByRole("button", { name: "Bearbeiten" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const textarea = dialog.getByPlaceholder("z.B. Baut auf Salsa Beginner 1 auf");
    await expect(textarea).toHaveValue(HINWEIS_TEXT);

    // Re-save to confirm the round-trip persists unchanged.
    await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForTimeout(1000);
    await expect(dialog).not.toBeVisible();
  });

  test("AC2: Hinweis sichtbar auf Kurskarte in /kurse und /stundenplan", async ({ page }) => {
    await page.goto("/kurse");
    await page.waitForTimeout(1500);
    await loadAllCourses(page);
    const catalogCard = page.locator(".rounded-lg.border").filter({ hasText: "E2E27 Mit Hinweis Kurs" });
    await expect(catalogCard.getByText(HINWEIS_TEXT)).toBeVisible();

    await page.goto("/stundenplan");
    await page.waitForTimeout(1500);
    const scheduleCard = page.locator(".rounded-lg.border").filter({ hasText: "E2E27 Mit Hinweis Kurs" });
    await expect(scheduleCard.getByText(HINWEIS_TEXT)).toBeVisible();
  });

  test("AC3: Kurs ohne Hinweis zeigt weder Karten-Hinweis noch Checkbox im Dialog", async ({ page }) => {
    await login(page, "e2e8-customer@viennasalsastudio.test");
    await page.goto("/kurse");
    await page.waitForTimeout(1500);
    await loadAllCourses(page);

    const card = page.locator(".rounded-lg.border").filter({ hasText: "E2E27 Ohne Hinweis Kurs" });
    await expect(card).toBeVisible();
    await expect(card.getByText(HINWEIS_TEXT)).not.toBeVisible();

    await card.getByRole("button", { name: "Jetzt buchen" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(CONFIRM_LABEL)).not.toBeVisible();
  });

  test("AC4: Dialog zeigt Hinweis + Checkbox bei allen drei Tabs", async ({ page }) => {
    await login(page, "e2e8-customer@viennasalsastudio.test");
    await page.goto("/kurse");
    await page.waitForTimeout(1500);
    await loadAllCourses(page);

    const card = page.locator(".rounded-lg.border").filter({ hasText: "E2E27 Mit Hinweis Kurs" });
    await card.getByRole("button", { name: "Jetzt buchen" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    for (const tabName of ["Anmeldung", "Probestunde", "Drop-in"]) {
      await dialog.getByRole("tab", { name: tabName }).click();
      await expect(dialog.getByText(HINWEIS_TEXT)).toBeVisible();
      await expect(dialog.getByText(CONFIRM_LABEL)).toBeVisible();
    }
  });

  test("AC5: Absenden bleibt gesperrt, bis die Checkbox aktiviert ist", async ({ page }) => {
    await login(page, "e2e8-customer@viennasalsastudio.test");
    await page.goto("/kurse");
    await page.waitForTimeout(1500);
    await loadAllCourses(page);

    const card = page.locator(".rounded-lg.border").filter({ hasText: "E2E27 Mit Hinweis Kurs" });
    await card.getByRole("button", { name: "Jetzt buchen" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: "Probestunde" }).click();

    const trialSelect = dialog.locator('button[role="combobox"]').first();
    await trialSelect.click();
    await page.locator('[role="option"]').first().click();

    // PROJ-42: Das Absenden ist jetzt an die AGB-Zustimmung gebunden.
    await dialog.locator("#terms-accepted-booking").check();
    const submitButton = dialog.getByRole("button", { name: "Rechtlich verbindlich buchen" });
    await expect(submitButton).toBeDisabled();
  });

  test("AC6: Checkbox aktiviert -> Buchung (Probestunde) schließt normal ab", async ({ page }) => {
    await login(page, "e2e8-customer@viennasalsastudio.test");
    await page.goto("/kurse");
    await page.waitForTimeout(1500);
    await loadAllCourses(page);

    const card = page.locator(".rounded-lg.border").filter({ hasText: "E2E27 Mit Hinweis Kurs" });
    await card.getByRole("button", { name: "Jetzt buchen" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: "Probestunde" }).click();

    const trialSelect = dialog.locator('button[role="combobox"]').first();
    await trialSelect.click();
    await page.locator('[role="option"]').first().click();

    // e2e8-customer's very first booking (PROJ-27 sorts before PROJ-8
    // alphabetically, so this can run first depending on suite order) also
    // requires picking an Akquisitionskanal once — handle it if present.
    const acquisitionPrompt = page.getByText("Wie haben Sie von uns erfahren?");
    if (await acquisitionPrompt.isVisible().catch(() => false)) {
      await dialog.getByRole("combobox").last().click();
      await page.waitForTimeout(300);
      await page.getByRole("option", { name: "Google / Suchmaschine" }).click();
    }

    await dialog.getByLabel(CONFIRM_LABEL).click();
    // PROJ-42: Das Absenden ist jetzt an die AGB-Zustimmung gebunden.
    await dialog.locator("#terms-accepted-booking").check();
    const submitButton = dialog.getByRole("button", { name: "Rechtlich verbindlich buchen" });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
    await page.waitForTimeout(1500);
    await expect(dialog).not.toBeVisible();
  });

  test("AC7: Admin entfernt Hinweis -> Checkbox und Karten-Hinweis verschwinden", async ({ page }) => {
    await login(page, "e2e8-admin@viennasalsastudio.test");
    await page.goto("/admin/kurse");
    await page.waitForTimeout(1000);

    const row = page.getByRole("row", { name: /E2E27 Mit Hinweis Kurs/ });
    await row.getByRole("button", { name: "Bearbeiten" }).click();
    const dialog = page.getByRole("dialog");
    const textarea = dialog.getByPlaceholder("z.B. Baut auf Salsa Beginner 1 auf");
    await textarea.fill("");
    await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForTimeout(1000);

    await page.goto("/kurse");
    await page.waitForTimeout(1500);
    await loadAllCourses(page);
    const card = page.locator(".rounded-lg.border").filter({ hasText: "E2E27 Mit Hinweis Kurs" });
    await expect(card.getByText(HINWEIS_TEXT)).not.toBeVisible();

    await card.getByRole("button", { name: "Jetzt buchen" }).click();
    const bookingDialog = page.getByRole("dialog");
    await expect(bookingDialog.getByText(CONFIRM_LABEL)).not.toBeVisible();
  });
});
