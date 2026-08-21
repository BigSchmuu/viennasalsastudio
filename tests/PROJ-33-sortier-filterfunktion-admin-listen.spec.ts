import { test, expect, type Page } from "@playwright/test";

const ADMIN = { email: "e2e30-admin@viennasalsastudio.test", password: "CorrectPassword123!" };

async function login(page: Page, creds: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(creds.email);
  await page.getByLabel("Passwort").fill(creds.password);
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Einloggen" }).click();
  // Admin lands on /admin after login, every other role on /profil.
  await page.waitForURL(/\/(profil|admin)$/, { timeout: 10000 });
}

test.describe("PROJ-33: Sortier- und Filterfunktion für Admin-Listen", () => {
  test("AC1: Kundenliste — Klick auf Spaltenüberschrift sortiert, erneuter Klick kehrt um", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/kunden");
    await page.getByRole("button", { name: /Name/ }).click();
    await expect(page).toHaveURL(/sort=name/);
    await expect(page).toHaveURL(/dir=asc/);
    const namesAsc = await page.locator("table tbody tr td:first-child").allTextContents();
    await page.getByRole("button", { name: /Name/ }).click();
    await expect(page).toHaveURL(/dir=desc/);
    const namesDesc = await page.locator("table tbody tr td:first-child").allTextContents();
    expect(namesAsc).not.toEqual(namesDesc);
    expect([...namesAsc].reverse()).toEqual(namesDesc);
  });

  test("AC2: Kundenliste — Status-Filter 'Aktiv' zeigt ausschließlich Kunden mit aktivem Abo", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/kunden");
    await page.getByLabel("Status").click();
    await page.getByRole("option", { name: "Aktiv", exact: true }).click();
    await expect(page).toHaveURL(/status=active/);
    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i)).toContainText("Aktiv");
    }
  });

  test("AC3: Kundenliste — Status-Filter 'Kein Abo' zeigt nur Kunden ohne Abo", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/kunden");
    await page.getByLabel("Status").click();
    await page.getByRole("option", { name: "Kein Abo", exact: true }).click();
    await expect(page).toHaveURL(/status=none/);
    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await expect(rows.nth(i)).toContainText("Kein Abo");
      }
    }
  });

  test("AC4: Rechnungsliste — Klick auf Spaltenüberschrift sortiert die Liste", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/rechnungen");
    await page.getByRole("button", { name: /Betrag/ }).click();
    await expect(page).toHaveURL(/sort=gross_amount/);
    await expect(page).toHaveURL(/dir=asc/);
    const amounts = await page.locator("table tbody tr td:nth-child(4)").allTextContents();
    const parsed = amounts.map((a) => parseFloat(a.replace(/[^\d,.-]/g, "").replace(",", ".")));
    const sorted = [...parsed].sort((a, b) => a - b);
    expect(parsed).toEqual(sorted);
  });

  test("AC5: Buchungsliste — Typ-Filter zeigt nur passenden Buchungstyp, Spalte ist sortierbar", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.getByLabel("Art").click();
    await page.getByRole("option", { name: "Probestunde", exact: true }).click();
    await expect(page).toHaveURL(/type=trial/);
    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await expect(rows.nth(i)).toContainText("Probestunde");
      }
    }
    await page.getByRole("button", { name: /Termin/ }).click();
    await expect(page).toHaveURL(/sort=chosen_date/);
    await expect(page).toHaveURL(/type=trial/); // filter preserved across sort click
  });

  test("AC6: Kursliste — Level-Filter zeigt nur passendes Level, Spalte ist sortierbar", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/kurse");
    await page.getByLabel("Level").click();
    await page.getByRole("option", { name: "Beginner", exact: true }).click();
    await expect(page).toHaveURL(/level=beginner/);
    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await expect(rows.nth(i)).toContainText("Beginner");
      }
    }
    await page.getByRole("button", { name: /Name/ }).click();
    await expect(page).toHaveURL(/sort=name/);
    await expect(page).toHaveURL(/level=beginner/); // filter preserved across sort click
  });

  test("AC7: Lastschriftlauf-Liste — Status-Filter zeigt nur passenden Status, Spalte ist sortierbar", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/lastschriften");
    await page.getByLabel("Status").click();
    await page.getByRole("option", { name: "Vollständig eingezogen", exact: true }).click();
    await expect(page).toHaveURL(/status=complete/);
    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await expect(rows.nth(i)).toContainText("Vollständig eingezogen");
      }
    }
    await page.getByRole("button", { name: /Gesamtbetrag/ }).click();
    await expect(page).toHaveURL(/sort=total/);
  });

  test("AC8: Ein Filter ohne Treffer zeigt einen Leerzustand statt einer leeren Tabelle", async ({ page }) => {
    await login(page, ADMIN);
    // Combine two filters unlikely to co-occur to force a 0-result state.
    await page.goto("/admin/kunden?q=zzz-nonexistent-customer-zzz");
    await expect(page.getByText("Keine Kunden gefunden.")).toBeVisible();
    await expect(page.locator("table")).toHaveCount(0);
  });

  test("AC9: Ein aktiver Filter bleibt nach Neuladen der Seite über die URL erhalten", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/kunden?status=paused&sort=created_at&dir=desc");
    await expect(page.getByLabel("Status")).toContainText("Pausiert");
    await page.reload();
    await expect(page).toHaveURL(/status=paused/);
    await expect(page).toHaveURL(/sort=created_at/);
    await expect(page).toHaveURL(/dir=desc/);
    await expect(page.getByLabel("Status")).toContainText("Pausiert");
  });

  test("Edge Case: mehrere Filter (Suche + Status) wirken kombiniert (UND-Verknüpfung)", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/kunden");
    await page.getByLabel("Status").click();
    await page.getByRole("option", { name: "Aktiv", exact: true }).click();
    await expect(page).toHaveURL(/status=active/);
    await page.getByLabel("Suche").fill("zzz-nonexistent-combo-zzz");
    await page.getByRole("button", { name: "Filtern" }).click();
    await expect(page).toHaveURL(/status=active/);
    await expect(page).toHaveURL(/q=zzz-nonexistent-combo-zzz/);
    await expect(page.getByText("Keine Kunden gefunden.")).toBeVisible();
  });
});
