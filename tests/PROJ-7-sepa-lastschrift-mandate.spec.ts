import { test, expect, type Page } from "@playwright/test";

const ADMIN = { email: "e2e7-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER_SOLO = { email: "e2e7-customer-solo@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER_EMPTY_ID_PATH = "/admin/kunden"; // resolved via UI, see test 2
const VALID_IBAN = "AT61 1904 3002 3457 3201";
const VALID_IBAN_2 = "DE89 3704 0044 0532 0130 00";

async function login(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.waitForTimeout(1000); // let hydration settle, see PROJ-2 BUG-1
  await page.getByRole("button", { name: "Einloggen" }).click();
  // Admin lands on /admin after login, every other role on /profil.
  await page.waitForURL(/\/(profil|admin)$/, { timeout: 10000 });
}

async function openCustomerDetail(page: Page, fullName: string) {
  await page.goto(CUSTOMER_EMPTY_ID_PATH);
  await page.waitForTimeout(400);
  await page.getByRole("link", { name: fullName, exact: true }).click();
  await page.waitForTimeout(500);
}

// /profil's sections live behind a collapsed Accordion (Radix unmounts closed
// content entirely) — must expand "Zahlungsmethode" before any IBAN/mandate
// field is in the DOM.
async function openPaymentSection(page: Page) {
  await page.goto("/profil");
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Zahlungsmethode" }).click();
  await page.waitForTimeout(400);
}

test.describe("PROJ-7: SEPA-Lastschriftmandate & Sammel-Einzug", () => {
  test("Nicht eingeloggter Besucher wird von /profil zu /login umgeleitet", async ({ page }) => {
    await page.goto("/profil");
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/login/);
  });

  test("Admin sieht 'Kein Mandat hinterlegt' bei Kunde ohne Abo und ohne Mandat", async ({ page }) => {
    await login(page, ADMIN);
    await openCustomerDetail(page, "E2E7 Leer Kunde");
    await expect(page.getByText("Kein Mandat hinterlegt")).toBeVisible();
  });

  test("Admin-Lauf ohne passende Kunden zeigt Hinweis statt leerer Datei", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/lastschriften");
    await page.waitForTimeout(400);
    await page.locator("#due-date").fill("2026-11-01");
    await page.getByRole("button", { name: "Lauf erstellen" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByText("Keine Kunden für diesen Lauf gefunden")).toBeVisible();
    await expect(page).toHaveURL("/admin/lastschriften");
  });

  test("Ungültige IBAN wird beim Anlegen eines Mandats abgelehnt", async ({ page }) => {
    await login(page, CUSTOMER_SOLO);
    await openPaymentSection(page);
    await page.getByLabel("IBAN").fill("AT00 0000 0000 0000 0000");
    await page.getByLabel("Kontoinhaber").fill("E2E7 Solo Kunde");
    await page.getByLabel(/stimme dem SEPA-Lastschriftmandat/).check();
    await page.getByRole("button", { name: "Mandat speichern" }).click();
    await page.waitForTimeout(600);
    await expect(page.getByText(/Prüfziffer/)).toBeVisible();
  });

  test("Kunde legt gültiges SEPA-Mandat an; wird gespeichert und angezeigt", async ({ page }) => {
    await login(page, CUSTOMER_SOLO);
    await openPaymentSection(page);
    await page.getByLabel("IBAN").fill(VALID_IBAN);
    await page.getByLabel("Kontoinhaber").fill("E2E7 Solo Kunde");
    await page.getByLabel(/stimme dem SEPA-Lastschriftmandat/).check();
    await page.getByRole("button", { name: "Mandat speichern" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByText(/AT61/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Mandat ersetzen" })).toBeVisible();
  });

  test("Admin sieht 'SEPA-Mandat hinterlegt' mit Datum, sobald ein Mandat existiert", async ({ page }) => {
    await login(page, ADMIN);
    await openCustomerDetail(page, "E2E7 Solo Kunde");
    await expect(page.getByText(/SEPA-Mandat hinterlegt seit/)).toBeVisible();
  });

  test("Kunde ersetzt bestehendes Mandat; neue IBAN erscheint, alte verschwindet", async ({ page }) => {
    await login(page, CUSTOMER_SOLO);
    await openPaymentSection(page);
    await page.getByRole("button", { name: "Mandat ersetzen" }).click();
    await page.waitForTimeout(300);
    await page.getByLabel("IBAN").fill(VALID_IBAN_2);
    await page.getByLabel("Kontoinhaber").fill("E2E7 Solo Kunde Neu");
    await page.getByLabel(/stimme dem SEPA-Lastschriftmandat/).check();
    await page.getByRole("button", { name: "Mandat speichern" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByText(/DE89/)).toBeVisible();
    await expect(page.getByText(/AT61/)).not.toBeVisible();
  });

  test("Kunde entfernt Mandat; Admin sieht Warnhinweis bei aktivem Abo", async ({ page }) => {
    await login(page, CUSTOMER_SOLO);
    await openPaymentSection(page);
    await page.getByRole("button", { name: "Mandat entfernen" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Entfernen" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByLabel("IBAN")).toBeVisible();

    await login(page, ADMIN);
    await openCustomerDetail(page, "E2E7 Solo Kunde");
    await expect(page.getByText("Mandat entfernt — Abo prüfen")).toBeVisible();
  });

  test("Kunde mit mehreren aktiven Abos erzeugt mehrere Positionen im selben Lauf", async ({ page }) => {
    await login(page, { email: "e2e7-customer-multi@viennasalsastudio.test", password: "CorrectPassword123!" });
    await openPaymentSection(page);
    await page.getByLabel("IBAN").fill(VALID_IBAN);
    await page.getByLabel("Kontoinhaber").fill("E2E7 Multi Kunde");
    await page.getByLabel(/stimme dem SEPA-Lastschriftmandat/).check();
    await page.getByRole("button", { name: "Mandat speichern" }).click();
    await page.waitForTimeout(800);

    await login(page, ADMIN);
    await page.goto("/admin/lastschriften");
    await page.waitForTimeout(400);
    await page.locator("#due-date").fill("2026-11-15");
    await page.getByRole("button", { name: "Lauf erstellen" }).click();
    await page.waitForURL("**/admin/lastschriften/*", { timeout: 10000 });
    await page.waitForTimeout(600);
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await expect(page.getByText("E2E7 Multi Abo A")).toBeVisible();
    await expect(page.getByText("E2E7 Multi Abo B")).toBeVisible();
  });

  test("Zweiter Lauf für dasselbe Fälligkeitsdatum warnt vor doppeltem Einzug", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/lastschriften");
    await page.waitForTimeout(400);
    await page.locator("#due-date").fill("2026-11-15");
    await page.getByRole("button", { name: "Lauf erstellen" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByText(/Bereits ein Lauf für dieses Datum/)).toBeVisible();
  });

  test("Lauf-Detail zeigt Positionen mit Betrag; Rückbuchung markierbar", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/lastschriften");
    await page.waitForTimeout(400);
    await page.getByRole("row", { name: /15\.11\.2026/ }).getByRole("link", { name: "Ansehen" }).click();
    await page.waitForTimeout(600);
    await expect(page.getByText("30,00")).toBeVisible();
    await page.getByRole("button", { name: "Als rückgebucht markieren" }).first().click();
    await page.waitForTimeout(600);
    await expect(page.getByText("Rückgebucht").first()).toBeVisible();
  });
});
