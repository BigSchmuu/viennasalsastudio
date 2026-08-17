import { test, expect, type Page } from "@playwright/test";

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const LEHRER_A = { email: "e2e13-lehrer-a@viennasalsastudio.test", password: "CorrectPassword123!" };
const LEHRER_B = { email: "e2e13-lehrer-b@viennasalsastudio.test", password: "CorrectPassword123!" };
const LEHRER_C_UNASSIGNED = { email: "e2e13-lehrer-c@viennasalsastudio.test", password: "CorrectPassword123!" };

const COURSE_ID = "0d295679-4d87-4909-8c46-0ed9127a1fda";
// Fixed historical date carrying seeded fixture data (active course-bound
// subscriptions aren't date-filtered, so this stays valid indefinitely; only
// the trial/dropin *booking*-sourced rows on this date are inherently
// one-shot and may need re-priming after this date is far in the past).
const SEEDED_DATE = "2026-08-17";

async function login(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.waitForTimeout(1000); // let hydration settle, see PROJ-2 BUG-1
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL("**/profil", { timeout: 10000 });
}

test.describe("PROJ-13: Lehrer-Ansicht (Stundenplan, Anwesenheit, Notizen)", () => {
  test("AC1: Eingeloggter Lehrer sieht 'Meine Kurse' in der globalen Navigation", async ({ page }) => {
    await login(page, LEHRER_A);
    await expect(page.getByRole("link", { name: "Meine Kurse" })).toBeVisible();
  });

  test("AC2: Lehrer ohne zugewiesene Kurse sieht Hinweistext statt leerer Liste", async ({ page }) => {
    await login(page, LEHRER_C_UNASSIGNED);
    await page.goto("/lehrer");
    await page.waitForTimeout(500);
    await expect(page.getByText("Dir sind noch keine Kurse zugewiesen.")).toBeVisible();
  });

  test("AC3: Kurs-Detailseite zeigt anstehende und die letzten 8 vergangenen Termine", async ({ page }) => {
    await login(page, LEHRER_A);
    await page.goto(`/lehrer/${COURSE_ID}`);
    await page.waitForTimeout(500);
    await expect(page.getByText("Anstehende Termine")).toBeVisible();
    await expect(page.getByText("Vergangene Termine")).toBeVisible();
    await expect(page.getByText("Vergangene Termine").locator("..").getByText("Anwesenheit & Notiz")).toHaveCount(8);
  });

  test("AC4: Anwesenheitsliste ist mit aktivem kursgebundenem Abo automatisch vorbefüllt", async ({ page }) => {
    await login(page, LEHRER_A);
    await page.goto(`/lehrer/${COURSE_ID}/${SEEDED_DATE}`);
    await page.waitForTimeout(500);
    const row = page.locator("li", { hasText: "E2E13 Abo Kunde" });
    await expect(row.getByText("Abo", { exact: true })).toBeVisible();
  });

  test("AC5: Anwesenheit markieren übernimmt den Status sofort und bleibt nach Reload sichtbar", async ({ page }) => {
    await login(page, LEHRER_A);
    await page.goto(`/lehrer/${COURSE_ID}/${SEEDED_DATE}`);
    await page.waitForTimeout(500);
    const row = page.locator("li", { hasText: "E2E13 Abo Kunde" });
    await row.getByRole("button", { name: "Anwesend" }).click();
    await page.waitForTimeout(600);
    await expect(row.locator("span").getByText("Anwesend", { exact: true })).toBeVisible();

    await page.reload();
    await page.waitForTimeout(500);
    await expect(row.locator("span").getByText("Anwesend", { exact: true })).toBeVisible();
  });

  test("AC6: Zukünftiger Termin sperrt das Markieren von Anwesenheit", async ({ page }) => {
    await login(page, LEHRER_A);
    await page.goto(`/lehrer/${COURSE_ID}`);
    await page.waitForTimeout(500);
    // index 0 under "Anstehende Termine" may be today itself for this fixture
    // course (weekday matches); index 1 is guaranteed to be a future date.
    await page.locator("a").filter({ hasText: "Anwesenheit & Notiz" }).nth(1).click();
    await page.waitForURL("**/lehrer/**/**", { timeout: 10000 });
    await page.waitForTimeout(500);
    await expect(page.getByText(/liegt in der Zukunft/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Anwesend" }).first()).toBeDisabled();
    await expect(page.getByRole("button", { name: "Kunde hinzufügen" })).toBeDisabled();
  });

  test("AC7: 'Kunde hinzufügen' zeigt Kunden mit aktivem Abo (auch Flatrate)", async ({ page }) => {
    await login(page, LEHRER_A);
    await page.goto(`/lehrer/${COURSE_ID}/${SEEDED_DATE}`);
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Kunde hinzufügen" }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText("E2E13 Flatrate Kunde")).toBeVisible();
  });

  test("AC8: Termin-Notiz ist für alle zugewiesenen Lehrer sichtbar und bearbeitbar", async ({ page }) => {
    await login(page, LEHRER_A);
    await page.goto(`/lehrer/${COURSE_ID}/${SEEDED_DATE}`);
    await page.waitForTimeout(500);
    const noteField = page.getByPlaceholder(/Notiz zu diesem Termin/);
    await noteField.fill("E2E13 gemeinsame Notiz");
    await page.getByRole("button", { name: "Notiz speichern" }).click();
    await page.waitForTimeout(800);

    await page.getByRole("navigation").getByRole("button", { name: "Logout" }).click();
    await page.waitForTimeout(500);

    await login(page, LEHRER_B);
    await page.goto(`/lehrer/${COURSE_ID}/${SEEDED_DATE}`);
    await page.waitForTimeout(500);
    await expect(page.getByPlaceholder(/Notiz zu diesem Termin/)).toHaveValue("E2E13 gemeinsame Notiz");
  });

  test("AC9: Direkter URL-Zugriff auf einen nicht zugewiesenen Kurs wird verweigert", async ({ page }) => {
    await login(page, LEHRER_C_UNASSIGNED);
    await page.goto(`/lehrer/${COURSE_ID}`);
    await page.waitForTimeout(500);
    expect(page.url()).not.toContain(`/lehrer/${COURSE_ID}`);
  });

  test("Edge Case: Kunde mit Abo UND bestätigter Buchung am selben Termin erscheint nur einmal", async ({
    page,
  }) => {
    await login(page, LEHRER_A);
    await page.goto(`/lehrer/${COURSE_ID}/${SEEDED_DATE}`);
    await page.waitForTimeout(500);
    await expect(page.locator("li", { hasText: "E2E13 Kombi Kunde" })).toHaveCount(1);
  });

  test("AC10: Admin erreicht dieselbe Ansicht über 'Anwesenheit' in der Kursverwaltung", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/kurse");
    await page.waitForTimeout(500);
    const row = page.locator("tr", { hasText: "E2E13 Kurs" });
    await row.getByRole("link", { name: "Anwesenheit" }).click();
    await page.waitForURL(`**/lehrer/${COURSE_ID}`, { timeout: 10000 });
    await expect(page.getByText("E2E13 Kurs")).toBeVisible();
  });
});
