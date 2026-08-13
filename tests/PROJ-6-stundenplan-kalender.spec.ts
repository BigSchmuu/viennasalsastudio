import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = "qa-proj6-admin@viennasalsastudio.test";
const PASSWORD = "CorrectPassword123!";

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(ADMIN_EMAIL);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.waitForTimeout(1500); // let hydration settle, see PROJ-2 BUG-1
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL("**/profil", { timeout: 10000 });
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
    await page.goto("/stundenplan");
    await page.getByRole("tab", { name: "Sonntag" }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText("Keine Kurse an diesem Tag")).toBeVisible();
  });

  test("Anonymer Besucher sieht Kurs mit Wochentag, Uhrzeit, Tanzstil, Level, Standort, Lehrer", async ({ page }) => {
    await page.goto("/stundenplan");
    await page.getByRole("tab", { name: "Freitag" }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText("E2E6 Kurs Heute")).toBeVisible();
    await expect(page.getByText("19:00–20:00")).toBeVisible();
    await expect(page.getByText("E2E6 Forro", { exact: true })).toBeVisible();
    await expect(page.getByText("Improver", { exact: true })).toBeVisible();
    await expect(page.getByText("E2E6 Location")).toBeVisible();
    await expect(page.getByText("Lehrer wird noch bekanntgegeben")).toBeVisible();
  });

  test("Admin markiert eine Woche als Pause; Kurs verschwindet nur für diese Woche", async ({ page }) => {
    await loginAsAdmin(page);
    await openCourseEdit(page, "E2E6 Kurs Heute");
    const today = new Date().toISOString().slice(0, 10);
    await page.locator("#schedule-pause-date").fill(today);
    await page.getByRole("button", { name: "Hinzufügen" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByText(today)).toBeVisible();

    await page.goto("/stundenplan");
    await page.getByRole("tab", { name: "Freitag" }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText("E2E6 Kurs Heute")).not.toBeVisible();

    // Pause wieder entfernen -> Kurs erscheint wieder
    await openCourseEdit(page, "E2E6 Kurs Heute");
    await page.getByText(today).locator("..").getByRole("button", { name: "Entfernen" }).click();
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
    await expect(page.getByText("E2E6 Kurs Montag")).toBeVisible();
  });
});
