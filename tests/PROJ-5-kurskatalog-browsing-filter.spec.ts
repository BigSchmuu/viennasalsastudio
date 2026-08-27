import { test, expect, type Page, type Locator } from "@playwright/test";

const CUSTOMER_EMAIL = "qa-proj5-customer@viennasalsastudio.test";
const PASSWORD = "CorrectPassword123!";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.waitForTimeout(1500); // let hydration settle, see PROJ-2 BUG-1
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

// Scopes to the shadcn Card root (`.rounded-lg.border.bg-card`) containing
// the given course name, instead of a plain "div" filter — a bare "div"
// filter matches every ancestor div containing the text, and `.last()`
// resolves to the innermost one (e.g. just the CardTitle wrapper), not the
// whole card, so sibling content like the teacher line is missed.
function courseCard(page: Page, courseName: string): Locator {
  return page.locator(".rounded-lg.border.bg-card", { hasText: courseName });
}

// /kurse paginates at 12 cards; the E2E5 fixtures sort well past that on the
// unfiltered (created_at-ascending) catalog, so tests locating them by name
// without an active filter need to click through "Mehr laden" first.
async function loadAllCourses(page: Page) {
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

test.describe("PROJ-5: Kurskatalog (Browsing & Filter)", () => {
  test("Anonymer Besucher sieht Kurse mit Name, Tanzstil, Level, Standort, Lehrer", async ({ page }) => {
    await page.goto("/kurse");
    await loadAllCourses(page);
    const card = courseCard(page, "E2E5 Kizomba Beginner");
    await expect(card).toBeVisible();
    await expect(card.getByText("E2E5 Kizomba", { exact: true })).toBeVisible();
    await expect(card.getByText("Beginner", { exact: true })).toBeVisible();
    await expect(card.getByText("E2E5 Location")).toBeVisible();
    await expect(card.getByText("E2E5 Lehrerin")).toBeVisible();
  });

  test("Eingeloggter Kunde sieht denselben Katalog wie ein anonymer Besucher", async ({ page }) => {
    await login(page, CUSTOMER_EMAIL);
    await page.goto("/kurse");
    await loadAllCourses(page);
    const card = courseCard(page, "E2E5 Kizomba Beginner");
    await expect(card).toBeVisible();
    await expect(card.getByText("E2E5 Lehrerin")).toBeVisible();
  });

  test("Tanzstil-Filter zeigt nur passende Kurse", async ({ page }) => {
    await page.goto("/kurse");
    await page.getByRole("combobox").nth(0).click();
    await page.waitForTimeout(300);
    await page.getByRole("option", { name: "E2E5 Kizomba" }).click();
    await page.waitForTimeout(300);
    await expect(courseCard(page, "E2E5 Kizomba Beginner")).toBeVisible();
    await expect(courseCard(page, "E2E5 Kizomba Ohne Lehrer")).toBeVisible();
  });

  test("Level-Filter zeigt nur passende Kurse", async ({ page }) => {
    await page.goto("/kurse");
    await page.getByRole("combobox").nth(1).click();
    await page.waitForTimeout(300);
    await page.getByRole("option", { name: "Beginner" }).click();
    await page.waitForTimeout(300);
    await expect(courseCard(page, "E2E5 Kizomba Beginner")).toBeVisible();
    await expect(courseCard(page, "E2E5 Kizomba Ohne Lehrer")).not.toBeVisible();
  });

  test("Standort-Filter zeigt nur passende Kurse", async ({ page }) => {
    await page.goto("/kurse");
    await page.getByRole("combobox").nth(2).click();
    await page.waitForTimeout(300);
    await page.getByRole("option", { name: "E2E5 Location" }).click();
    await page.waitForTimeout(300);
    await expect(courseCard(page, "E2E5 Kizomba Beginner")).toBeVisible();
    await expect(courseCard(page, "E2E5 Kizomba Ohne Lehrer")).toBeVisible();
  });

  test("Filter-Kombination ohne Treffer zeigt verständlichen Hinweis", async ({ page }) => {
    await page.goto("/kurse");
    await page.getByRole("combobox").nth(0).click();
    await page.waitForTimeout(300);
    await page.getByRole("option", { name: "E2E5 Kizomba" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("combobox").nth(1).click();
    await page.waitForTimeout(300);
    await page.getByRole("option", { name: "Advanced" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText("Keine Kurse gefunden")).toBeVisible();

    // Zurücksetzen funktioniert
    await page.getByRole("button", { name: "Filter zurücksetzen" }).click();
    await page.waitForTimeout(300);
    await loadAllCourses(page);
    await expect(courseCard(page, "E2E5 Kizomba Beginner")).toBeVisible();
  });

  test("Kurs ohne Lehrer und ohne Level zeigt klar erkennbare Platzhalter", async ({ page }) => {
    await page.goto("/kurse");
    await loadAllCourses(page);
    const card = courseCard(page, "E2E5 Kizomba Ohne Lehrer");
    await expect(card).toBeVisible();
    await expect(card.getByText("Lehrer wird noch bekanntgegeben")).toBeVisible();
    await expect(card.getByText("—")).toBeVisible();
  });

  // Originally asserted a "bald verfügbar" placeholder toast — obsolete
  // since PROJ-8 replaced that placeholder with a real booking flow.
  // Anonymous visitors are now redirected to log in first; the actual
  // booking dialog itself is covered by PROJ-8's own E2E suite.
  test("Jetzt-buchen-Button leitet anonyme Besucher zum Login", async ({ page }) => {
    await page.goto("/kurse");
    await loadAllCourses(page);
    await courseCard(page, "E2E5 Kizomba Beginner").getByRole("button", { name: "Jetzt buchen" }).click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/login\?redirect=\/kurse/);
  });

  // Designüberarbeitung 2026-08: Die Startseite verlinkt je Stufe in den
  // Katalog. Anfangs stand die Stufe nur in der Adresse und filterte nichts.
  test("Stufen-Kacheln filtern wirklich", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 950 });
    await page.goto("/");
    await page.waitForTimeout(2500);
  
    await page.getByRole("link", { name: /Beginner/ }).click();
    await page.waitForURL(/level=beginner/, { timeout: 10000 });
    await page.waitForTimeout(1500);
    const beginnerKarten = await page.locator(".rounded-lg.border.bg-card").count();
    const beginnerAbzeichen = await page.locator(".rounded-lg.border.bg-card").filter({ hasText: "Beginner" }).count();
    console.log("Beginner:", beginnerKarten, "Karten,", beginnerAbzeichen, "Beginner-Abzeichen");
    expect(beginnerKarten).toBeGreaterThan(0);
    expect(beginnerAbzeichen).toBe(beginnerKarten);
  
    // Zweite Stufe, ohne die Seite zu verlassen — hier ging es vorher schief
    await page.goto("/");
    await page.waitForTimeout(1500);
    await page.getByRole("link", { name: /Advanced/ }).click();
    await page.waitForURL(/level=advanced/, { timeout: 10000 });
    await page.waitForTimeout(1500);
    const advKarten = await page.locator(".rounded-lg.border.bg-card").count();
    const advAbzeichen = await page.locator(".rounded-lg.border.bg-card").filter({ hasText: "Advanced" }).count();
    console.log("Advanced:", advKarten, "Karten,", advAbzeichen, "Advanced-Abzeichen");
    expect(advAbzeichen).toBe(advKarten);
    expect(advKarten).not.toBe(beginnerKarten);
  
    // Wechsel direkt in der Adresse, ohne Neumontage
    await page.goto("/kurse?level=beginner");
    await page.waitForTimeout(1500);
    expect(await page.locator(".rounded-lg.border.bg-card").filter({ hasText: "Beginner" }).count()).toBe(beginnerKarten);
    // Das Filterfeld zeigt die Stufe aus der Adresse an
    await expect(page.getByRole("combobox").filter({ hasText: "Beginner" })).toBeVisible();
  });
});