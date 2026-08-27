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

// Debit runs created by PROJ-7 and PROJ-9 each write invoices. Those suites
// clean up after themselves, but they run *after* this one alphabetically —
// so their invoices from the previous run are still around when these tests
// execute, and the "rows for this customer" assertions drown in them (38 rows
// at the last count). Clearing them here is what makes this suite independent
// of run order.
const FOREIGN_INVOICE_DATES = ["2026-11-01", "2026-11-15", "2026-12-24"];

// Permanente Fixture: ein SEPA-Lastschriftlauf für dieses feste Fälligkeitsdatum
// erzeugt automatisch Rechnungen für die bestehenden PROJ-7/PROJ-8-Fixture-Kunden
// e2e7-customer-multi (2 aktive Abos) und e2e8-customer (1 aktives Abo).
// Die Erstellung ist idempotent (siehe erster Test) — Reruns legen keinen
// zweiten Lauf für dasselbe Datum an, siehe [[no-staging-test-assumptions]].
const FIXTURE_DUE_DATE = "2028-01-15";
const FIXTURE_DUE_DATE_DISPLAY = "15.1.2028";

const ADMIN = { email: "qa-proj23-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER_MULTI = { email: "e2e7-customer-multi@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER_SINGLE = { email: "e2e8-customer@viennasalsastudio.test", password: "CorrectPassword123!" };
// Hat Abos, aber nie ein SEPA-Mandat/eine Lastschrift → garantiert 0 Rechnungen.
const CUSTOMER_NO_INVOICES = { email: "e2e11-other@viennasalsastudio.test", password: "TestPassword123!" };

async function login(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(user.email);
  await page.getByLabel("Passwort").fill(user.password);
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Einloggen" }).click();
  // Admin lands on /admin after login, every other role on /profil.
  await page.waitForURL(/\/(mein-bereich|profil|admin)$/, { timeout: 10000 });
  // Seit PROJ-45 landen Kunden auf /mein-bereich. Die Prüfungen hier gelten
  // dem Profil — also dorthin, wo der Test vorher schon stand.
  if (page.url().endsWith("/mein-bereich")) await page.goto("/profil");
}

// /profil's sections live behind a collapsed Accordion (Radix unmounts closed
// content entirely) — must expand "Meine Rechnungen" before any invoice
// link/empty-state text is in the DOM.
async function openInvoicesSection(page: Page) {
  await page.getByRole("button", { name: "Meine Rechnungen" }).click();
  await page.waitForTimeout(400);
}

test.beforeAll(async () => {
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: runs } = await service
    .from("sepa_collection_runs")
    .select("id")
    .in("due_date", FOREIGN_INVOICE_DATES);
  const runIds = (runs ?? []).map((r) => r.id);

  // Invoices first — they reference the collection items.
  await service.from("invoices").delete().in("invoice_date", FOREIGN_INVOICE_DATES);
  if (runIds.length) {
    await service.from("sepa_collection_items").delete().in("run_id", runIds);
    await service.from("sepa_collection_runs").delete().in("id", runIds);
  }
});

test.describe("PROJ-10: Rechnungsarchiv", () => {
  test("Setup: Lastschriftlauf für die PROJ-10-Fixtures existiert (idempotent)", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/lastschriften");
    await page.waitForTimeout(400);

    const alreadyExists = await page.getByText(FIXTURE_DUE_DATE_DISPLAY).count();
    if (alreadyExists > 0) {
      // Fixture wurde bereits in einem früheren Testlauf angelegt — nichts zu tun.
      return;
    }

    await page.locator("#due-date").fill(FIXTURE_DUE_DATE);
    await page.getByRole("button", { name: "Lauf erstellen" }).click();
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/admin\/lastschriften\/.+/);
  });

  test("AC1: Lastschriftlauf erzeugt automatisch fortlaufend nummerierte Rechnungen", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/rechnungen");
    await page.waitForTimeout(400);
    await page.getByLabel("Von").fill(FIXTURE_DUE_DATE);
    await page.getByLabel("Bis").fill(FIXTURE_DUE_DATE);
    await page.getByRole("button", { name: "Filtern" }).click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("row", { name: /E2E7 Multi Kunde/ }).first()).toBeVisible();
    await expect(page.getByRole("row", { name: /E2E8 Kunde/ })).toBeVisible();
    // Kunde mit zwei Abos bekommt zwei getrennte Zeilen, nicht eine zusammengefasste.
    await expect(page.getByRole("row", { name: /E2E7 Multi Kunde/ })).toHaveCount(2);
  });

  test("AC7: Admin-Filter nach Kundenname zeigt nur passende Rechnungen", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/rechnungen");
    await page.waitForTimeout(400);
    await page.getByLabel("Kunde").fill("E2E8 Kunde");
    await page.getByRole("button", { name: "Filtern" }).click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("row", { name: /E2E8 Kunde/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /E2E7 Multi Kunde/ })).toHaveCount(0);
  });

  test("Zeitraum-Filter ohne Treffer zeigt Leerzustand statt Fehler", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/rechnungen?from=2020-01-01&to=2020-01-02");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Keine Rechnungen gefunden.")).toBeVisible();
  });

  test("AC4 + AC9: Rechnungsdetailseite zeigt Studio-Stammdaten, Netto/USt/Brutto und ist druckbar", async ({
    page,
  }) => {
    await login(page, ADMIN);
    await page.goto("/admin/rechnungen");
    await page.waitForTimeout(400);
    await page.getByLabel("Kunde").fill("E2E8 Kunde");
    await page.getByRole("button", { name: "Filtern" }).click();
    await page.waitForLoadState("networkidle");
    // Each row carries two links since the customer column became clickable:
    // the invoice itself and the customer. Target the invoice explicitly.
    await page
      .getByRole("row", { name: /E2E8 Kunde/ })
      .locator('a[href^="/rechnungen/"]')
      .first()
      .click();
    await page.waitForURL(/\/rechnungen\//, { timeout: 10000 });

    await expect(page.getByText("Rechnungsempfänger")).toBeVisible();
    await expect(page.getByText("Rechnungsnummer:")).toBeVisible();
    await expect(page.getByText("Netto")).toBeVisible();
    await expect(page.getByText("USt-Satz")).toBeVisible();
    await expect(page.getByRole("button", { name: "Drucken" })).toBeVisible();
  });

  test("AC2 + AC3: Kunde sieht im Profil ausschließlich eigene Rechnungen", async ({ page }) => {
    await login(page, CUSTOMER_MULTI);
    await openInvoicesSection(page);
    await expect(page.getByText("Meine Rechnungen")).toBeVisible();
    await expect(page.getByRole("link", { name: /E2E7 Multi Abo A/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /E2E7 Multi Abo B/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /E2E8 Kurs/ })).toHaveCount(0);
  });

  test("AC3: Kunde ohne Rechnungen sieht Leerzustand-Hinweis statt leerer Liste", async ({ page }) => {
    await login(page, CUSTOMER_NO_INVOICES);
    await openInvoicesSection(page);
    await expect(page.getByText("Noch keine Rechnungen vorhanden.")).toBeVisible();
  });

  test("AC5: Sicherheit — Kunde kann die Rechnungs-Detailseite eines anderen Kunden nicht über die URL aufrufen", async ({
    page,
  }) => {
    await login(page, ADMIN);
    await page.goto("/admin/rechnungen");
    await page.waitForTimeout(400);
    await page.getByLabel("Kunde").fill("E2E8 Kunde");
    await page.getByRole("button", { name: "Filtern" }).click();
    await page.waitForLoadState("networkidle");
    // Each row carries two links since the customer column became clickable:
    // the invoice itself and the customer. Target the invoice explicitly.
    await page
      .getByRole("row", { name: /E2E8 Kunde/ })
      .locator('a[href^="/rechnungen/"]')
      .first()
      .click();
    await page.waitForURL(/\/rechnungen\/(.+)/, { timeout: 10000 });
    const otherCustomerInvoiceUrl = page.url();

    await login(page, CUSTOMER_MULTI);
    const response = await page.goto(otherCustomerInvoiceUrl);
    expect(response?.status()).toBe(404);
  });

  test("AC8: CSV-Export enthält gefilterte Rechnungen mit korrekten Spalten", async ({ page }, testInfo) => {
    // Mobiles Safari kennt keinen Datei-Download im Sinne von Playwright —
    // iOS öffnet die Datei stattdessen. Das Ereignis kommt dort also nie.
    // Der Export ist ohnehin eine Verwaltungsfunktion am Rechner.
    test.skip(
      testInfo.project.name === "Mobile Safari",
      "Datei-Downloads gibt es auf mobilem Safari nicht"
    );
    await login(page, ADMIN);
    await page.goto("/admin/rechnungen");
    await page.waitForTimeout(400);
    await page.getByLabel("Von").fill(FIXTURE_DUE_DATE);
    await page.getByLabel("Bis").fill(FIXTURE_DUE_DATE);
    await page.getByRole("button", { name: "Filtern" }).click();
    await page.waitForLoadState("networkidle");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "CSV exportieren" }).click(),
    ]);
    const path = await download.path();
    const fs = await import("fs");
    const content = fs.readFileSync(path!, "utf-8");
    // Seit PROJ-36 trennt die Datei mit Semikolon und beginnt mit einer
    // Kodierungs-Kennung (BOM) — beides nötig, damit österreichisches Excel
    // Zahlen als Zahlen und Umlaute korrekt liest.
    expect(content.charCodeAt(0)).toBe(0xfeff);
    expect(content.split("\n")[0].slice(1)).toBe(
      "Rechnungsnummer;Datum;Kunde;Netto;USt-Satz;USt-Betrag;Brutto;Status"
    );
    expect(content).toContain("E2E8 Kunde");
  });

  test("AC6: Rücklastschrift-Markierung ändert den Rechnungsstatus für Kunde und Admin", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/lastschriften");
    await page.waitForTimeout(400);
    await page.getByRole("row", { name: FIXTURE_DUE_DATE_DISPLAY }).getByRole("link", { name: "Ansehen" }).click();
    await page.waitForURL(/\/admin\/lastschriften\//, { timeout: 10000 });

    const itemRow = page.locator("tr", { hasText: "E2E8 Kurs" });
    const alreadyBounced = (await itemRow.textContent())?.includes("Rückgebucht");
    if (!alreadyBounced) {
      await itemRow.getByRole("button", { name: "Als rückgebucht markieren" }).click();
      await page.waitForTimeout(800);
    }

    await page.goto("/admin/rechnungen");
    await page.waitForTimeout(400);
    await page.getByLabel("Kunde").fill("E2E8 Kunde");
    await page.getByRole("button", { name: "Filtern" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("row", { name: /E2E8 Kunde/ })).toContainText("Rücklastschrift");

    await login(page, CUSTOMER_SINGLE);
    await openInvoicesSection(page);
    const row = page.locator("a", { hasText: "E2E8 Kurs" });
    await expect(row).toContainText("Rücklastschrift");
  });

  test("Rechnungseinstellungen: Admin kann Firmenname, Adresse, UID-Nummer und USt-Satz speichern", async ({
    page,
  }) => {
    await login(page, ADMIN);
    await page.goto("/admin/rechnungen/einstellungen");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Firmenname").fill("Vienna Salsa Studio e.U.");
    await page.getByLabel("Adresse").fill("Teststraße 1, 1010 Wien");
    await page.getByLabel("UID-Nummer").fill("ATU12345678");
    await page.getByLabel("USt-Satz (%)").fill("20");
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByText("Einstellungen gespeichert.")).toBeVisible();
  });

  test("Sicherheit: Nicht-Admin wird von /admin/rechnungen, den Einstellungen und dem CSV-Export abgewiesen", async ({
    page,
  }) => {
    await login(page, CUSTOMER_SINGLE);

    await page.goto("/admin/rechnungen");
    await expect(page).not.toHaveURL(/\/admin\/rechnungen/);

    await page.goto("/admin/rechnungen/einstellungen");
    await expect(page).not.toHaveURL(/\/admin\/rechnungen/);

    await page.goto("/api/admin/rechnungen/export");
    expect(page.url()).not.toContain("/api/admin/rechnungen/export");
  });
});
