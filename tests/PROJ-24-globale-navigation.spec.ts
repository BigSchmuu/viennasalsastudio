import { test, expect, type Page } from "@playwright/test";

const ADMIN = { email: "e2e24-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER = { email: "e2e24-customer@viennasalsastudio.test", password: "CorrectPassword123!" };

async function login(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto("/login");
  // Erst hydrieren lassen. Die Felder sind über react-hook-form gesteuert;
  // wird vor der Hydration gefüllt, setzt React den Wert zurück und das
  // Formular meldet „ist erforderlich". Auf WebKit regelmäßig — siehe
  // docs/troubleshooting-tests.md.
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.waitForTimeout(1000); // let hydration settle, see PROJ-2 BUG-1
  await page.getByRole("button", { name: "Einloggen" }).click();
  // Admin lands on /admin after login, every other role on /profil.
  await page.waitForURL(/\/(mein-bereich|profil|admin)$/, { timeout: 10000 });
  // Seit PROJ-45 landen Kunden auf /mein-bereich, die Pruefungen hier gelten
  // aber dem Profil. Faehrt der Test unmittelbar danach selbst woandershin,
  // ueberholt seine Navigation diese hier — auf WebKit regelmaessig. Das ist
  // kein Fehler, sondern genau das, was der Test will; darum wird die
  // Unterbrechung geschluckt statt gemeldet.
  if (page.url().endsWith("/mein-bereich")) await page.goto("/profil").catch(() => {});
}

/**
 * Returns the container that actually holds the navigation links.
 *
 * Below the md breakpoint (768px) the header folds its links into a sheet
 * behind "Menü öffnen" — correct responsive behaviour, but it means the links
 * live somewhere else than on a desktop viewport. These tests were written
 * against the desktop layout only and therefore failed wholesale on the
 * Mobile Safari project, looking for links that were one tap away.
 *
 * Both layouts mark the active link with `text-primary`, so assertions on the
 * highlight work through this helper unchanged.
 */
async function navContainer(page: Page) {
  const burger = page.getByRole("banner").getByRole("button", { name: "Menü öffnen" });
  if (await burger.isVisible().catch(() => false)) {
    await burger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    return page.getByRole("dialog");
  }
  return page.getByRole("banner");
}

test.describe("PROJ-24: Globale Navigation & Login-Status", () => {
  test("Ausgeloggter Besucher sieht Kurse/Stundenplan/Login auf allen öffentlichen Seiten", async ({ page }) => {
    for (const path of ["/", "/kurse", "/stundenplan", "/login", "/registrieren"]) {
      await page.goto(path);
      await page.waitForTimeout(300);
      const nav = await navContainer(page);
      await expect(nav.getByRole("link", { name: "Kurse", exact: true })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Stundenplan" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Login" })).toBeVisible();
    }
  });

  test("Admin-Link ist im HTML nicht vorhanden, wenn niemand eingeloggt ist", async ({ page }) => {
    await page.goto("/kurse");
    const html = await page.content();
    expect(html.includes('href="/admin"')).toBe(false);
  });

  test("Eingeloggter Kunde sieht Mein Profil + Logout statt Login, keinen Admin-Link", async ({ page }) => {
    await login(page, CUSTOMER);
    await page.goto("/kurse");
    await page.waitForTimeout(300);
    const nav = await navContainer(page);
    await expect(nav.getByRole("link", { name: "Mein Profil" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Logout" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Login" })).toHaveCount(0);
    const html = await page.content();
    expect(html.includes('href="/admin"')).toBe(false);
  });

  test("Eingeloggter Admin sieht zusätzlichen Admin-Link", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/kurse");
    await page.waitForTimeout(300);
    const nav = await navContainer(page);
    await expect(nav.getByRole("link", { name: "Admin", exact: true })).toBeVisible();
  });

  test("Logout über die Nav-Leiste zeigt danach wieder den ausgeloggten Zustand", async ({ page }) => {
    await login(page, CUSTOMER);
    await page.goto("/profil");
    await page.waitForTimeout(300);
    const nav = await navContainer(page);
    await nav.getByRole("button", { name: "Logout" }).click();
    await page.waitForTimeout(1200);
    // The sheet closes with the navigation, so it has to be reopened to check
    // the logged-out state on a mobile viewport.
    const navAfter = await navContainer(page);
    await expect(navAfter.getByRole("link", { name: "Login" })).toBeVisible();
  });

  test("Aktuelle Seite ist in der Nav optisch hervorgehoben", async ({ page }) => {
    await page.goto("/stundenplan");
    await page.waitForTimeout(300);
    const nav = await navContainer(page);
    await expect(nav.getByRole("link", { name: "Stundenplan" })).toHaveClass(/text-primary/);
    await expect(nav.getByRole("link", { name: "Kurse", exact: true })).not.toHaveClass(/text-primary/);
  });

  test("/admin zeigt weiterhin nur die bestehende AdminNav, keine globale Nav-Leiste", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin");
    await page.waitForTimeout(300);
    await expect(page.locator("header")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Kunden" })).toBeVisible();
  });

  test("Mobile: Menü-Icon öffnet ausklappbares Menü mit funktionierendem Schließen-Button", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/kurse");
    await page.waitForTimeout(300);
    await expect(page.getByRole("button", { name: "Menü öffnen" })).toBeVisible();
    await page.getByRole("button", { name: "Menü öffnen" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByRole("dialog").getByRole("link", { name: "Stundenplan" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("Startseite zeigt Willkommenstext statt Next.js-Boilerplate", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(300);
    await expect(page.getByRole("heading", { name: "Vienna Salsa Studio" })).toBeVisible();
    await expect(page.locator('img[src="/next.svg"]')).toHaveCount(0);
  });

  test("Nicht eingeloggter Besucher wird bei direktem Aufruf von /profil weiterhin zu /login umgeleitet", async ({
    page,
  }) => {
    await page.goto("/profil");
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/login/);
  });
});
