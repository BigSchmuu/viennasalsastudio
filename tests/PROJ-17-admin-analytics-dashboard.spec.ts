import { test, expect, type Page } from "@playwright/test";

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER = { email: "e2e8-customer@viennasalsastudio.test", password: "CorrectPassword123!" };

async function login(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.waitForTimeout(1000); // let hydration settle, see PROJ-2 BUG-1
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForTimeout(1500);
}

test.describe("PROJ-17: Admin-Analytics-Dashboard", () => {
  test("AC2, AC4, AC7: Dashboard zeigt alle drei Kennzahl-Kacheln mit Beschriftung", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin");
    await page.waitForTimeout(1000);

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Umsatz im Zeitraum")).toBeVisible();
    await expect(page.getByText("Auslastung (aktuell)")).toBeVisible();
    await expect(page.getByText("Kündigungen im Zeitraum")).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveClass(/bg-primary/);
  });

  test("AC3, AC9: Eigener Zeitraum mit Rechnungsdaten zeigt Umsatz und Trend-Chart", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin?from=2026-12-01&to=2028-01-31");
    await page.waitForTimeout(1000);

    const revenueTile = page.getByText("Umsatz im Zeitraum").locator("xpath=following-sibling::*").first();
    await expect(revenueTile).not.toHaveText("€ 0,00");
    await expect(page.getByText("Umsatz-Verlauf")).toBeVisible();
    // Only the cancellation chart (no cancellations in this range) should show the empty-state text.
    await expect(page.getByText("Noch keine Daten für diesen Zeitraum")).toHaveCount(1);
  });

  test("AC9: Eigener Zeitraum zeigt hinterlegte Kündigung in Kachel und Trend-Chart", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin?from=2026-08-01&to=2026-08-31");
    await page.waitForTimeout(1000);

    // At least the PROJ-9 fixture's own cancellation ("E2E9 Due Abo") must be
    // counted here — but this is a shared, ever-growing live DB, so other
    // suites' unrelated cancellations in this window can push the real count
    // above 1. Assert "counted, non-zero" rather than an exact value, see
    // [[no-staging-test-assumptions]].
    const cancelTile = page.getByText("Kündigungen im Zeitraum").locator("xpath=following-sibling::*").first();
    await expect(cancelTile).not.toHaveText("0");
    expect(Number(await cancelTile.textContent())).toBeGreaterThanOrEqual(1);
    await expect(page.getByText("Kündigungs-Verlauf")).toBeVisible();
  });

  test("AC5: Auslastungs-Liste zeigt nur Kurse mit maximaler Teilnehmerzahl", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin");
    await page.waitForTimeout(1000);

    await expect(page.getByRole("cell", { name: "E2E12 Kurs", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "E2E12 Nachrück Kurs" })).toBeVisible();
    // Fixture course with no max_participants set must never appear here.
    await expect(page.getByRole("cell", { name: "Salsa Beginner 1" })).not.toBeVisible();
  });

  test("AC6: Auslastung bleibt bei Zeitraum-Wechsel unverändert", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin");
    await page.waitForTimeout(1000);
    const occupancyBefore = await page.getByText("Auslastung (aktuell)").locator("xpath=following-sibling::*").first().textContent();

    await page.goto("/admin?from=2026-08-01&to=2026-08-31");
    await page.waitForTimeout(1000);
    const occupancyAfter = await page.getByText("Auslastung (aktuell)").locator("xpath=following-sibling::*").first().textContent();

    expect(occupancyAfter).toBe(occupancyBefore);
  });

  test("AC10: Enddatum vor Startdatum zeigt Validierungsfehler ohne Navigation", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin");
    await page.waitForTimeout(1000);

    await page.locator("#period-from").fill("2026-08-20");
    await page.locator("#period-to").fill("2026-08-01");
    await page.getByRole("button", { name: "Anwenden" }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText("Das Enddatum muss nach dem Startdatum liegen.")).toBeVisible();
    expect(page.url()).toContain("/admin");
    expect(page.url()).not.toContain("from=2026-08-20");
  });

  test("AC11: Leerer Zeitraum zeigt Nullwerte statt Fehler", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin?from=2020-01-01&to=2020-01-31");
    await page.waitForTimeout(1000);

    await expect(page.getByText("€ 0,00")).toBeVisible();
    await expect(page.getByText("Noch keine Daten für diesen Zeitraum")).toHaveCount(2);
  });

  test("AC12: Nicht-Admin wird vom Dashboard weggeleitet", async ({ page }) => {
    await login(page, CUSTOMER);
    await page.goto("/admin");
    await page.waitForTimeout(1000);

    expect(page.url()).not.toContain("/admin");
  });
});
