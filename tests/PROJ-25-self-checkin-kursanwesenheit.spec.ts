import { test, expect, type Page, type Locator } from "@playwright/test";

// NOTE: This feature's core behavior is deliberately wall-clock-time-sensitive
// (window opens 30 min before class, closes at class end). The fixture course
// times below were chosen relative to when these fixtures were created
// (2026-08-18, ~13:00 Vienna time) and will need to be re-primed if re-run
// on a different day or far outside that window — see QA notes in the spec.

const CUSTOMER_WITH_ABO = { email: "e2e25-customer-with-abo@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER_NO_ABO = { email: "e2e25-customer-no-abo@viennasalsastudio.test", password: "CorrectPassword123!" };
const ADMIN = { email: "e2e14-admin@viennasalsastudio.test", password: "CorrectPassword123!" };

const COURSE_IM_FENSTER_ID = "d61c66bd-338d-433a-b109-930ef0ef1e1b";

async function login(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForTimeout(1500);
}

// shadcn Card root: "rounded-lg border ..."
function courseCard(page: Page, name: string): Locator {
  return page.locator(".rounded-lg.border").filter({ hasText: name });
}

test.describe("PROJ-25: Self-Check-In für Kursanwesenheit (Abo-Kunden)", () => {
  test("AC1: Mehr als 30 Minuten vor Kursbeginn ist kein Self-Check-In-Button sichtbar", async ({ page }) => {
    await login(page, CUSTOMER_WITH_ABO);
    await page.goto("/stundenplan");
    const card = courseCard(page, "E2E25 Zu Früh Kurs");
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: "Ich bin da" })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "✓ Eingecheckt" })).toHaveCount(0);
  });

  test("AC2, AC3: Ab 30 Minuten vor Kursbeginn erscheint 'Ich bin da', Klick checkt sofort ein", async ({ page }) => {
    await login(page, CUSTOMER_WITH_ABO);
    await page.goto("/stundenplan");
    const card = courseCard(page, "E2E25 Im Fenster Kurs");
    await expect(card).toBeVisible();

    const button = card.getByRole("button", { name: "Ich bin da" });
    await expect(button).toBeVisible();
    await button.click();
    await expect(card.getByRole("button", { name: "✓ Eingecheckt" })).toBeVisible();
  });

  test("AC4: Erneuter Klick vor Kursende macht den Check-In rückgängig", async ({ page }) => {
    await login(page, CUSTOMER_WITH_ABO);
    await page.goto("/stundenplan");
    const card = courseCard(page, "E2E25 Im Fenster Kurs");

    // Ensure a known starting state: checked in (from the previous test, or check in now).
    let checkedButton = card.getByRole("button", { name: "✓ Eingecheckt" });
    if ((await checkedButton.count()) === 0) {
      await card.getByRole("button", { name: "Ich bin da" }).click();
      checkedButton = card.getByRole("button", { name: "✓ Eingecheckt" });
      await expect(checkedButton).toBeVisible();
    }

    await checkedButton.click();
    await expect(card.getByRole("button", { name: "Ich bin da" })).toBeVisible();

    // Leave it checked in again for subsequent tests (roster/conflict checks).
    await card.getByRole("button", { name: "Ich bin da" }).click();
    await expect(card.getByRole("button", { name: "✓ Eingecheckt" })).toBeVisible();
  });

  test("AC8: Kunde ohne aktives Abo für einen heutigen Kurs sieht keinen Self-Check-In-Button", async ({ page }) => {
    await login(page, CUSTOMER_NO_ABO);
    await page.goto("/stundenplan");
    const card = courseCard(page, "E2E25 Im Fenster Kurs");
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: "Ich bin da" })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "✓ Eingecheckt" })).toHaveCount(0);
  });

  test("AC9: An einem pausierten Kurstag erscheint kein Self-Check-In-Button (der Termin selbst wird gar nicht erst angezeigt, PROJ-6-Verhalten)", async ({
    page,
  }) => {
    await login(page, CUSTOMER_WITH_ABO);
    await page.goto("/stundenplan");
    await expect(courseCard(page, "E2E25 Pausiert Kurs")).toHaveCount(0);
  });

  test("Rand: nach Kursende zeigt ein bereits eingechecktes Ticket einen nicht klickbaren Zustand", async ({ page }) => {
    await login(page, CUSTOMER_WITH_ABO);
    await page.goto("/stundenplan");
    const card = courseCard(page, "E2E25 Beendet Kurs");
    await expect(card).toBeVisible();

    // First-time late check-in must still succeed (allowed until midnight).
    const openButton = card.getByRole("button", { name: "Ich bin da" });
    if ((await openButton.count()) > 0) {
      await openButton.click();
    }
    const doneButton = card.getByRole("button", { name: "✓ Eingecheckt" });
    await expect(doneButton).toBeVisible();
    await expect(doneButton).toBeDisabled();
  });

  test("AC6, AC7: Self-Check-In überschreibt Lehrer-Markierung; Lehrer/Admin sieht Self-Check-In-Kennzeichnung", async ({
    page,
  }) => {
    // NOTE: as of PROJ-13's attendance-matrix rework, there is no longer a
    // /lehrer/[courseId]/[date] page or <li>-based roster — attendance for
    // all visible termine (incl. today) lives in a table on
    // /lehrer/[courseId], with per-cell Popover-based marking. Updated below
    // to match (was still targeting the removed route/DOM before this fix).

    // Admin marks the customer "absent" first.
    await login(page, ADMIN);
    await page.goto(`/lehrer/${COURSE_IM_FENSTER_ID}`);
    await page.waitForTimeout(1000);
    const row = page.locator("tr", { hasText: "E2E25 Kunde Mit Abo" });
    await expect(row).toBeVisible();
    const cells = row.locator("td");
    const cellCount = await cells.count();
    const todayCell = cells.nth(cellCount - 1); // today's column is always last
    await todayCell.getByRole("button").click();
    await page.getByRole("button", { name: "Abwesend", exact: true }).click();
    await page.waitForTimeout(500);
    await expect(todayCell.locator("span.bg-blue-500")).toHaveCount(0);

    // Customer self-checks-in, which must override the teacher's mark.
    await login(page, CUSTOMER_WITH_ABO);
    await page.goto("/stundenplan");
    const card = courseCard(page, "E2E25 Im Fenster Kurs");
    const checkedButton = card.getByRole("button", { name: "✓ Eingecheckt" });
    if ((await checkedButton.count()) > 0) {
      // Already checked in from an earlier test — undo then re-check-in to
      // force a fresh self-check-in write that overrides the admin's mark.
      await checkedButton.click();
      await expect(card.getByRole("button", { name: "Ich bin da" })).toBeVisible();
    }
    await card.getByRole("button", { name: "Ich bin da" }).click();
    await expect(card.getByRole("button", { name: "✓ Eingecheckt" })).toBeVisible();

    // Admin's roster now shows "Anwesend" with the Self-Check-In indicator.
    await login(page, ADMIN);
    await page.goto(`/lehrer/${COURSE_IM_FENSTER_ID}`);
    await page.waitForTimeout(1000);
    const rowAfter = page.locator("tr", { hasText: "E2E25 Kunde Mit Abo" });
    const cellsAfter = rowAfter.locator("td");
    const countAfter = await cellsAfter.count();
    const todayCellAfter = cellsAfter.nth(countAfter - 1);
    await expect(todayCellAfter.getByRole("button")).toHaveClass(/border-emerald-600/);
    await expect(todayCellAfter.locator("span.bg-blue-500")).toBeVisible();
    await todayCellAfter.getByRole("button").click();
    await expect(page.getByText(/Self-Check-In/)).toBeVisible();
  });
});
