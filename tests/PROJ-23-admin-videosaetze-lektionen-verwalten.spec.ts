import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = "qa-proj23-admin@viennasalsastudio.test";
const TEACHER_EMAIL = "qa-proj23-teacher@viennasalsastudio.test";
const CUSTOMER_EMAIL = "samuelg.kramer@yahoo.de";
const PASSWORD = "CorrectPassword123!";

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(ADMIN_EMAIL);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.waitForTimeout(1500); // let hydration settle, see PROJ-2 BUG-1
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL("**/profil", { timeout: 10000 });
}

test.describe("PROJ-23: Admin — Videosätze & Lektionen verwalten", () => {
  test("Zugriffskontrolle: nur Admin darf Videosätze verwalten", async ({ page }) => {
    // Anonym
    await page.goto("/admin/videosaetze");
    await expect(page).toHaveURL(/\/login\?redirect=\/admin/);

    // Lehrer — kein Zugriff auf den Admin-Bereich
    await page.goto("/login");
    await page.getByLabel("E-Mail").fill(TEACHER_EMAIL);
    await page.getByLabel("Passwort").fill(PASSWORD);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Einloggen" }).click();
    await page.waitForURL("**/profil", { timeout: 10000 });
    await page.goto("/admin/videosaetze");
    await expect(page).toHaveURL("/");

    // Admin — voller Zugriff
    await loginAsAdmin(page);
    await page.goto("/admin/videosaetze");
    await expect(page).toHaveURL(/\/admin\/videosaetze/);
  });

  // Originally asserted the true empty-state ("Noch keine Videosätze
  // vorhanden") — untestable now that the shared production DB permanently
  // holds a real video set from actual studio use, so that state can never
  // be observed live again. Rewritten to verify the page renders the "Neuer
  // Videosatz" create action correctly instead.
  test("Videosätze-Seite lädt und zeigt die Aktion zum Anlegen", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/videosaetze");
    await expect(page.getByRole("button", { name: "Neuer Videosatz" })).toBeVisible();
  });

  test("Videosatz anlegen mit Level; Duplikat-Name (case-insensitiv) wird abgelehnt", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/videosaetze");

    await page.getByRole("button", { name: "Neuer Videosatz" }).click();
    await page.waitForTimeout(400);
    await page.getByLabel("Name").fill("E2E23 Videosatz Beginner");
    await page.getByLabel(/Level/).click();
    await page.getByRole("option", { name: "Beginner" }).click();
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByText("E2E23 Videosatz Beginner")).toBeVisible();

    await page.getByRole("button", { name: "Neuer Videosatz" }).click();
    await page.waitForTimeout(400);
    await page.getByLabel("Name").fill("e2e23 videosatz beginner");
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByText("existiert bereits")).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("Lektion mit mehreren Video-Links anlegen; ungültiger Link wird abgelehnt", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/videosaetze");
    await page.getByRole("link", { name: "E2E23 Videosatz Beginner" }).click();
    await page.waitForURL(/\/admin\/videosaetze\/.+/);

    await page.getByRole("button", { name: "Neue Lektion" }).click();
    await page.waitForTimeout(400);
    await page.getByLabel("Titel").fill("E2E23 Grundschritt");
    await page.getByPlaceholder("https://youtube.com/…").first().fill("https://youtube.com/watch?v=e2e23-1");
    await page.getByRole("button", { name: "Video hinzufügen" }).click();
    await page.getByPlaceholder("https://youtube.com/…").nth(1).fill("nicht-eine-url");
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText("Bitte eine gültige URL eingeben")).toBeVisible();

    // korrigieren und erneut speichern
    await page.getByPlaceholder("https://youtube.com/…").nth(1).fill("https://youtube.com/watch?v=e2e23-2");
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByRole("row", { name: /E2E23 Grundschritt/ })).toContainText("2");
  });

  test("Lektionen-Reihenfolge per Auf/Ab ändern", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/videosaetze");
    await page.getByRole("link", { name: "E2E23 Videosatz Beginner" }).click();
    await page.waitForURL(/\/admin\/videosaetze\/.+/);

    await page.getByRole("button", { name: "Neue Lektion" }).click();
    await page.waitForTimeout(400);
    await page.getByLabel("Titel").fill("E2E23 Zweite Lektion");
    await page.getByPlaceholder("https://youtube.com/…").first().fill("https://youtube.com/watch?v=e2e23-3");
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(800);

    const rows = page.locator("table tbody tr");
    await expect(rows.nth(0)).toContainText("E2E23 Grundschritt");
    await expect(rows.nth(1)).toContainText("E2E23 Zweite Lektion");

    await rows.nth(1).getByRole("button", { name: "Nach oben" }).click();
    await page.waitForTimeout(800);
    await expect(rows.nth(0)).toContainText("E2E23 Zweite Lektion");
    await expect(rows.nth(1)).toContainText("E2E23 Grundschritt");
  });

  test("Kurs mit Videosatz-Zuweisung anlegen; Videosatz-Auswahl bleibt optional", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/kurse");
    await page.getByRole("button", { name: "Neuer Kurs" }).click();
    await page.waitForTimeout(500);

    await page.getByLabel("Name").fill("E2E23 Kurs ohne Videosatz");
    await page.getByLabel("Tanzstil").click();
    await page.getByRole("option").first().click();
    await page.getByLabel("Level").click();
    await page.getByRole("option", { name: "Beginner" }).click();
    await page.getByLabel("Standort").click();
    await page.getByRole("option").first().click();
    await page.waitForTimeout(500);
    await page.getByLabel("Raum").click();
    await page.getByRole("option").first().click();
    await page.waitForTimeout(300);
    // Videosatz bewusst nicht auswählen
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText("E2E23 Kurs ohne Videosatz")).toBeVisible();

    await page.getByRole("button", { name: "Neuer Kurs" }).click();
    await page.waitForTimeout(500);
    await page.getByLabel("Name").fill("E2E23 Kurs mit Videosatz");
    await page.getByLabel("Tanzstil").click();
    await page.getByRole("option").first().click();
    await page.getByLabel("Level").click();
    await page.getByRole("option", { name: "Beginner" }).click();
    await page.getByLabel("Standort").click();
    await page.getByRole("option").first().click();
    await page.waitForTimeout(500);
    await page.getByLabel("Raum").click();
    await page.getByRole("option").first().click();
    await page.waitForTimeout(300);
    await page.getByLabel(/Videosatz/).click();
    await page.getByRole("option", { name: "E2E23 Videosatz Beginner" }).click();
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByRole("row", { name: /E2E23 Kurs mit Videosatz/ })).toContainText(
      "E2E23 Videosatz Beginner"
    );
  });

  test("Videosatz-Löschschutz solange von Kurs verwendet; danach löschbar inkl. Lektionen", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/videosaetze");
    await page.getByRole("row", { name: /E2E23 Videosatz Beginner/ }).getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("alertdialog").getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText("kann nicht gelöscht werden, da er noch bei Kursen")).toBeVisible();
    await page.keyboard.press("Escape");

    // Kurs mit Videosatz-Zuweisung löschen (es gibt aktuell keine
    // UI-Möglichkeit, die Zuweisung nachträglich zu entfernen, siehe BUG-1),
    // damit der Videosatz für den folgenden Löschversuch frei ist.
    await page.goto("/admin/kurse");
    await page.getByRole("row", { name: /E2E23 Kurs mit Videosatz/ }).getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("alertdialog").getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(800);

    await page.goto("/admin/videosaetze");
    await page.getByRole("row", { name: /E2E23 Videosatz Beginner/ }).getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("alertdialog").getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByText("E2E23 Videosatz Beginner")).toHaveCount(0);
  });
});
