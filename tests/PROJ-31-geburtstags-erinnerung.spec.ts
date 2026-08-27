import { test, expect, type Page } from "@playwright/test";

const ADMIN = { email: "e2e30-admin@viennasalsastudio.test", password: "CorrectPassword123!" };

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// The birthdate form field rejects any date in the future, so a birthdate
// used to simulate "birthday in N days" must keep month/day from `addDays`
// but fall back to a birth YEAR safely in the past.
function birthdateStringForMonthDay(monthDayDate: Date): string {
  const month = String(monthDayDate.getMonth() + 1).padStart(2, "0");
  const day = String(monthDayDate.getDate()).padStart(2, "0");
  return `1998-${month}-${day}`;
}

function formatDayMonth(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.`;
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(ADMIN.email);
  await page.getByLabel("Passwort").fill(ADMIN.password);
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL(/\/(mein-bereich|profil|admin)$/, { timeout: 10000 });
  // Seit PROJ-45 landen Kunden auf /mein-bereich. Die Prüfungen hier gelten
  // dem Profil — also dorthin, wo der Test vorher schon stand.
  if (page.url().endsWith("/mein-bereich")) await page.goto("/profil");
}

const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

/**
 * Opens the given customer's admin detail page and sets/clears their birthdate.
 * The field is three selects (Tag/Monat/Jahr) rather than a date input, so that
 * picking a birth year doesn't mean scrolling a wheel back decades.
 * Pass "" to clear it via the field's "Löschen" button.
 */
async function setCustomerBirthdate(page: Page, customerName: string, birthdate: string) {
  await page.goto("/admin/kunden");
  await page.getByRole("link", { name: customerName }).click();
  await page.waitForURL(/\/admin\/kunden\/.+/);
  await page.waitForTimeout(400);

  if (birthdate === "") {
    const clear = page.getByRole("button", { name: "Geburtsdatum löschen" });
    if (await clear.count()) await clear.click();
  } else {
    const [year, month, day] = birthdate.split("-").map(Number);
    // Year first: it narrows nothing, but picking day before month can be
    // clamped by the shorter month, so set the coarse parts first.
    await page.getByLabel("Jahr").click();
    await page.getByRole("option", { name: String(year), exact: true }).click();
    await page.getByLabel("Monat").click();
    await page.getByRole("option", { name: MONTH_NAMES[month - 1], exact: true }).click();
    await page.getByLabel("Tag").click();
    await page.getByRole("option", { name: String(day), exact: true }).click();
  }

  await page.getByRole("button", { name: "Speichern" }).click();
  await page.waitForTimeout(600);
}

test.describe("PROJ-31: Geburtstags-Erinnerung", () => {
  test.afterEach(async ({ page }) => {
    // Fixture cleanup: no shared staging DB, so always leave birthdates unset.
    await setCustomerBirthdate(page, "E2E30 Kunde A", "");
    await setCustomerBirthdate(page, "E2E30 Kunde B", "");
  });

  test("AC1: Kunde mit Geburtstag heute erscheint im Dashboard-Widget mit Name und 'Heute'", async ({ page }) => {
    await login(page);
    const today = new Date();
    await setCustomerBirthdate(page, "E2E30 Kunde A", formatLocalDate(today));

    await page.goto("/admin");
    // Exact match: the empty-state line "Keine Geburtstage in den nächsten
    // 7 Tagen" also contains the word, so a substring match is ambiguous
    // whenever the list happens to be empty — which is exactly the case this
    // assertion is meant to rule out.
    await expect(page.getByText("Geburtstage", { exact: true })).toBeVisible();
    const row = page.locator("li", { hasText: "E2E30 Kunde A" });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Heute");
  });

  test("AC1 + AC5: mehrere Kunden mit Geburtstag in den nächsten 7 Tagen erscheinen beide, sortiert nach Datum", async ({ page }) => {
    await login(page);
    const today = new Date();
    const in4Days = addDays(today, 4);
    await setCustomerBirthdate(page, "E2E30 Kunde A", formatLocalDate(today));
    await setCustomerBirthdate(page, "E2E30 Kunde B", birthdateStringForMonthDay(in4Days));

    await page.goto("/admin");
    const rowA = page.locator("li", { hasText: "E2E30 Kunde A" });
    const rowB = page.locator("li", { hasText: "E2E30 Kunde B" });
    await expect(rowA).toContainText("Heute");
    await expect(rowB).toContainText(formatDayMonth(in4Days));

    const items = await page.locator("li").allTextContents();
    const idxA = items.findIndex((t) => t.includes("E2E30 Kunde A"));
    const idxB = items.findIndex((t) => t.includes("E2E30 Kunde B"));
    expect(idxA).toBeGreaterThanOrEqual(0);
    expect(idxA).toBeLessThan(idxB);
  });

  test("Grenzfall: Geburtstag außerhalb des 7-Tage-Fensters (Tag 8) erscheint NICHT im Widget", async ({ page }) => {
    await login(page);
    const in8Days = addDays(new Date(), 8);
    await setCustomerBirthdate(page, "E2E30 Kunde A", birthdateStringForMonthDay(in8Days));

    await page.goto("/admin");
    await expect(page.locator("li", { hasText: "E2E30 Kunde A" })).toHaveCount(0);
  });

  test("AC4: Kunde ohne hinterlegtes Geburtsdatum erscheint nicht im Widget", async ({ page }) => {
    await login(page);
    // E2E30 Kunde C never has a birthdate set by this suite.
    await page.goto("/admin");
    await expect(page.locator("li", { hasText: "E2E30 Kunde C" })).toHaveCount(0);
  });

  test("AC3: Geburtstags-Icon erscheint in der Anwesenheitsliste für einen Kursteilnehmer mit Geburtstag heute", async ({ page }) => {
    await login(page);
    await setCustomerBirthdate(page, "E2E30 Kunde A", formatLocalDate(new Date()));

    await page.goto("/admin/kurse");
    await page
      .locator("tr", { hasText: "E2E30 Rollen Kurs" })
      .getByRole("link", { name: "Anwesenheit" })
      .click();
    await page.waitForURL(/\/lehrer\/.+/);

    const row = page.locator("tr", { hasText: "E2E30 Kunde A" });
    await expect(row.getByLabel("Hat heute Geburtstag")).toBeVisible();
  });
});
