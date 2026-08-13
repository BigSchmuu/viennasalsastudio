import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = "qa-proj3-admin@viennasalsastudio.test";
const TEACHER_EMAIL = "qa-proj3-teacher@viennasalsastudio.test";
const CUSTOMER_EMAIL = "qa-proj3-customer@viennasalsastudio.test";
const PASSWORD = "CorrectPassword123!";

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(ADMIN_EMAIL);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.waitForTimeout(1500); // let hydration settle, see PROJ-2 BUG-1
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL("**/profil", { timeout: 10000 });
}

test.describe("PROJ-3: Admin — Kurse, Levels, Locations & Tanzstile", () => {
  test("Zugriffskontrolle: nur Admin darf /admin betreten", async ({ page }) => {
    // Anonym
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?redirect=\/admin/);

    // Kunde — bewusst über eine "saubere" /login-URL ohne redirect-Parameter,
    // damit der Login regulär auf /profil landet, nicht auf /admin zurück.
    await page.goto("/login");
    await page.getByLabel("E-Mail").fill(CUSTOMER_EMAIL);
    await page.getByLabel("Passwort").fill(PASSWORD);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Einloggen" }).click();
    await page.waitForURL("**/profil", { timeout: 10000 });
    await page.goto("/admin");
    await expect(page).toHaveURL("/");

    // Lehrer — erneutes Einloggen überschreibt die Kunden-Session direkt
    await page.goto("/login");
    await page.getByLabel("E-Mail").fill(TEACHER_EMAIL);
    await page.getByLabel("Passwort").fill(PASSWORD);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Einloggen" }).click();
    await page.waitForURL("**/profil", { timeout: 10000 });
    await page.goto("/admin");
    await expect(page).toHaveURL("/");

    // Admin — erneutes Einloggen überschreibt die Lehrer-Session direkt
    await loginAsAdmin(page);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/standorte/);
  });

  test("Leerer Zustand: keine Standorte, keine Tanzstile, Kurs-Button deaktiviert", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/standorte");
    await expect(page.getByText("Noch keine Standorte vorhanden")).toBeVisible();

    await page.goto("/admin/tanzstile");
    await expect(page.getByText("Noch keine Tanzstile vorhanden")).toBeVisible();

    await page.goto("/admin/kurse");
    await expect(page.getByText(/mindestens einen Tanzstil und einen/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Neuer Kurs" })).toBeDisabled();
  });

  test("Standort anlegen, Löschschutz mit Raum, Raum anlegen und Löschschutz mit Kurs", async ({ page }) => {
    await loginAsAdmin(page);

    // Standort anlegen
    await page.goto("/admin/standorte");
    await page.getByRole("button", { name: "Neuer Standort" }).click();
    await page.waitForTimeout(500);
    await page.getByLabel("Name").fill("E2E Studio");
    await page.getByLabel("Adresse").fill("Teststraße 1, Wien");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("E2E Studio")).toBeVisible();

    // Standort ohne Raum darf gelöscht werden können (Vorbedingung nicht verletzt) —
    // wir löschen NICHT, sondern navigieren stattdessen zur Raumverwaltung.
    await page.getByRole("link", { name: "E2E Studio" }).click();
    await expect(page).toHaveURL(/\/admin\/standorte\/.+/);

    // Raum anlegen
    await page.getByRole("button", { name: "Neuer Raum" }).click();
    await page.waitForTimeout(500);
    await page.getByLabel("Name").fill("E2E Saal");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("E2E Saal")).toBeVisible();

    // Standort mit Raum kann nicht gelöscht werden
    await page.goto("/admin/standorte");
    await page.getByRole("row", { name: /E2E Studio/ }).getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(300);
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Löschen" })
      .click();
    await expect(page.getByText("kann nicht gelöscht werden, da ihm noch Räume")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText("E2E Studio")).toBeVisible();
  });

  test("Tanzstil anlegen und sofort im Kurs-Formular verfügbar", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/tanzstile");
    await page.getByRole("button", { name: "Neuer Tanzstil" }).click();
    await page.waitForTimeout(500);
    await page.getByLabel("Name").fill("E2E Salsa");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("E2E Salsa")).toBeVisible();

    await page.goto("/admin/kurse");
    await page.getByRole("button", { name: "Neuer Kurs" }).click();
    await page.waitForTimeout(500);
    await page.getByLabel("Tanzstil").click();
    await expect(page.getByRole("option", { name: "E2E Salsa" })).toBeVisible();
  });

  test("Pflichtfeld-Validierung: leerer Standort-Name wird abgelehnt", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/standorte");
    await page.getByRole("button", { name: "Neuer Standort" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Name ist erforderlich")).toBeVisible();
  });

  test("Kurs anlegen mit Lehrer und Video-Link; Kurs ohne Video bearbeiten möglich", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/kurse");
    await page.getByRole("button", { name: "Neuer Kurs" }).click();
    await page.waitForTimeout(500);

    await page.getByLabel("Name").fill("E2E Salsa Kurs");
    await page.getByLabel("Tanzstil").click();
    await page.getByRole("option", { name: "E2E Salsa" }).click();
    await page.getByLabel("Level").click();
    await page.getByRole("option", { name: "Beginner" }).click();
    await page.getByLabel("Standort").click();
    await page.getByRole("option", { name: "E2E Studio" }).click();
    await page.waitForTimeout(500);
    await page.getByLabel("Raum").click();
    await page.getByRole("option", { name: "E2E Saal" }).click();
    await page.waitForTimeout(500);

    await page.getByText("Lehrer auswählen").click();
    await page.waitForTimeout(300);
    await page.getByText("QA Lehrer Eins").click();
    await page.keyboard.press("Escape");

    // Video-Link bewusst leer lassen (optional)
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(1000);

    await expect(page.getByText("E2E Salsa Kurs")).toBeVisible();
    await expect(page.getByText("QA Lehrer Eins")).toBeVisible();
  });

  test("Ungültiger Video-Link wird abgelehnt", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/kurse");
    await page.getByRole("row", { name: /E2E Salsa Kurs/ }).getByRole("button", { name: "Bearbeiten" }).click();
    await page.waitForTimeout(500);
    await page.getByLabel(/Kursinhalt-Video/).fill("nicht-eine-url");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Bitte eine gültige URL eingeben")).toBeVisible();
  });

  test("Tanzstil und Raum, die noch von einem Kurs verwendet werden, können nicht gelöscht werden", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    await page.goto("/admin/tanzstile");
    await page.getByRole("row", { name: /E2E Salsa/ }).getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("alertdialog").getByRole("button", { name: "Löschen" }).click();
    await expect(page.getByText("kann nicht gelöscht werden, da er noch bei Kursen")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/admin/standorte");
    await page.getByRole("link", { name: "E2E Studio" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("row", { name: /E2E Saal/ }).getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("alertdialog").getByRole("button", { name: "Löschen" }).click();
    await expect(page.getByText("kann nicht gelöscht werden, da ihm noch Kurse")).toBeVisible();
  });
});
