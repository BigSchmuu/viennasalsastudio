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

/**
 * This suite promotes a customer and demotes two teachers, and nothing put the
 * roles back. After one run the fixtures said the exact opposite of their
 * names — "E2E22 Kunde" was a teacher, both "Lehrer" were customers — and
 * every later run failed looking for people who no longer held those roles.
 * There is no staging database, so the roles are restored here.
 *
 * The course assignment of "Lehrer Mit Kurs" is left alone: demoting does not
 * remove it, and it is what the warning dialog test relies on.
 */
test.beforeAll(async () => {
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const roles: Record<string, string> = {
    "E2E22 Admin": "admin",
    "E2E22 Kunde": "customer",
    "E2E22 Lehrer Mit Kurs": "teacher",
    "E2E22 Lehrer Ohne Kurs": "teacher",
  };

  for (const [fullName, role] of Object.entries(roles)) {
    const { error } = await service.from("profiles").update({ role }).eq("full_name", fullName);
    if (error) throw new Error(`PROJ-22 Fixture-Reset (${fullName}) fehlgeschlagen: ${error.message}`);
  }
});

const ADMIN = { email: "e2e22-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER = { email: "e2e22-customer@viennasalsastudio.test", password: "CorrectPassword123!" };
const TEACHER_NOCOURSE = { email: "e2e22-teacher-nocourse@viennasalsastudio.test", password: "CorrectPassword123!" };
const TEACHER_WITHCOURSE = {
  email: "e2e22-teacher-withcourse@viennasalsastudio.test",
  password: "CorrectPassword123!",
};

async function login(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.waitForTimeout(1000); // let hydration settle, see PROJ-2 BUG-1
  await page.getByRole("button", { name: "Einloggen" }).click();
  // Admin lands on /admin after login, every other role on /profil.
  await page.waitForURL(/\/(profil|admin)$/, { timeout: 10000 });
}

async function loginAsAdmin(page: Page) {
  await login(page, ADMIN);
}

test.describe("PROJ-22: Admin — Lehrer-Rollen verwalten", () => {
  test("Zugriffskontrolle: nur Admin darf /admin/lehrer betreten", async ({ page }) => {
    // Anonym
    await page.goto("/admin/lehrer");
    await expect(page).toHaveURL(/\/login\?redirect=\/admin/);

    // Kunde — kein Zugriff
    await login(page, CUSTOMER);
    await page.goto("/admin/lehrer");
    await expect(page).toHaveURL("/");

    // Lehrer — auch kein Zugriff (Lehrer-Rolle ist kein Admin-Ersatz)
    await login(page, TEACHER_NOCOURSE);
    await page.goto("/admin/lehrer");
    await expect(page).toHaveURL("/");

    // Admin — voller Zugriff
    await loginAsAdmin(page);
    await page.goto("/admin/lehrer");
    await expect(page).toHaveURL(/\/admin\/lehrer/);
  });

  test("Liste zeigt bestehende Lehrer mit Name und E-Mail", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/lehrer");
    await expect(page.getByText("E2E22 Lehrer Ohne Kurs")).toBeVisible();
    await expect(page.getByText(TEACHER_NOCOURSE.email)).toBeVisible();
    await expect(page.getByText("E2E22 Lehrer Mit Kurs")).toBeVisible();
    await expect(page.getByText(TEACHER_WITHCOURSE.email)).toBeVisible();
  });

  test("Kundensuche zeigt nur Personen mit Rolle customer, keine bestehenden Lehrer/Admins", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/lehrer");
    await page.getByRole("button", { name: "Bestehenden Kunden befördern" }).click();
    await page.waitForTimeout(400);
    await page.getByPlaceholder(/Suche nach Name/).fill("E2E22");
    await page.waitForTimeout(300);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("E2E22 Kunde")).toBeVisible();
    await expect(dialog.getByText("E2E22 Lehrer Ohne Kurs")).toHaveCount(0);
    await expect(dialog.getByText("E2E22 Lehrer Mit Kurs")).toHaveCount(0);
    await expect(dialog.getByText("E2E22 Admin")).toHaveCount(0);
    await page.keyboard.press("Escape");
  });

  test("Ungültige Eingaben bei 'Lehrer einladen' werden clientseitig abgelehnt", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/lehrer");
    await page.getByRole("button", { name: "Lehrer einladen" }).click();
    await page.waitForTimeout(400);

    // Name ist leer
    await page.getByLabel("E-Mail").fill("ungueltig-format");
    await page.getByRole("button", { name: "Einladung senden" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText("Name ist erforderlich")).toBeVisible();
    await expect(page.getByText("Bitte eine gültige E-Mail-Adresse eingeben")).toBeVisible();
  });

  test("Einladen einer bereits registrierten E-Mail zeigt verständlichen Fehlerhinweis", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/lehrer");
    await page.getByRole("button", { name: "Lehrer einladen" }).click();
    await page.waitForTimeout(400);
    await page.getByLabel("Name").fill("Duplikat Test");
    await page.getByLabel("E-Mail").fill(TEACHER_NOCOURSE.email);
    await page.getByRole("button", { name: "Einladung senden" }).click();
    await page.waitForTimeout(1500);
    await expect(page.getByText("Diese E-Mail ist bereits registriert")).toBeVisible();
  });

  test("Bestehenden Kunden über Kundensuche befördern; verschwindet danach aus Kundenliste", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/lehrer");
    await page.getByRole("button", { name: "Bestehenden Kunden befördern" }).click();
    await page.waitForTimeout(400);
    await page.getByPlaceholder(/Suche nach Name/).fill("E2E22 Kunde");
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Befördern" }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText("E2E22 Kunde")).toBeVisible();

    await page.goto("/admin/kunden");
    await page.waitForTimeout(500);
    await expect(page.getByText("E2E22 Kunde")).toHaveCount(0);

    // und ist jetzt im Lehrer-Picker der Kurs-Verwaltung wählbar
    await page.goto("/admin/kurse");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Neuer Kurs" }).click();
    await page.waitForTimeout(500);
    await page.getByText("Lehrer auswählen").click();
    await page.waitForTimeout(300);
    await expect(page.getByText("E2E22 Kunde", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("Lehrer ohne Kurs-Zuordnung: Zurückstufen erfolgt sofort ohne Bestätigungsdialog", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/lehrer");
    const row = page.locator("tr", { hasText: "E2E22 Lehrer Ohne Kurs" });
    await row.getByRole("button", { name: "Zum Kunden zurückstufen" }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByText("E2E22 Lehrer Ohne Kurs")).toHaveCount(0);

    await page.goto("/admin/kunden");
    await page.waitForTimeout(500);
    await expect(page.getByText("E2E22 Lehrer Ohne Kurs")).toBeVisible();
  });

  test("Lehrer mit Kurs-Zuordnung: Zurückstufen zeigt Warnung mit Kursnamen; nach Bestätigung Rolle geändert", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/lehrer");
    const row = page.locator("tr", { hasText: "E2E22 Lehrer Mit Kurs" });
    await row.getByRole("button", { name: "Zum Kunden zurückstufen" }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await expect(page.getByRole("alertdialog").getByText("E2E5 Kizomba Beginner")).toBeVisible();

    await page.getByRole("alertdialog").getByRole("button", { name: "Zurückstufen" }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText("E2E22 Lehrer Mit Kurs")).toHaveCount(0);

    await page.goto("/admin/kunden");
    await page.waitForTimeout(500);
    await expect(page.getByText("E2E22 Lehrer Mit Kurs")).toBeVisible();

    // öffentliche Lehrer-Anzeige des Kurses zeigt die zurückgestufte Person nicht mehr
    await page.goto("/kurse");
    await page.waitForTimeout(500);
    const card = page.locator(".rounded-lg.border.bg-card", { hasText: "E2E5 Kizomba Beginner" });
    await expect(card.getByText("E2E22 Lehrer Mit Kurs")).toHaveCount(0);
  });
});
