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

const ADMIN_EMAIL = "qa-proj4-admin@viennasalsastudio.test";
const CUSTOMER_EMAIL = "qa-proj4-customer@viennasalsastudio.test";
const PASSWORD = "CorrectPassword123!";

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test.beforeAll(async () => {
  // "Kein Abo vorhanden..." and "Mehrere unabhängige Abos..." are one
  // sequential story: the first test requires zero pre-existing abos, then
  // both tests together create/edit/delete subscriptions for "E2E4 Test
  // Kunde", ending with exactly 1 row. Without a reset, that leftover row
  // broke the first test's empty-state precondition on every re-run. Reset
  // to zero here so the story reproduces identically every time.
  const { data: profile } = await service.from("profiles").select("id").eq("full_name", "E2E4 Test Kunde").single();
  if (!profile) throw new Error("PROJ-4 fixture customer not found");
  await service.from("subscriptions").delete().eq("customer_id", profile.id);
});

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(ADMIN_EMAIL);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.waitForTimeout(1500); // let hydration settle, see PROJ-2 BUG-1
  await page.getByRole("button", { name: "Einloggen" }).click();
  // Admin lands on /admin after login, every other role on /profil.
  await page.waitForURL(/\/(profil|admin)$/, { timeout: 10000 });
}

test.describe("PROJ-4: Admin — Kunden-/Mitgliederverwaltung", () => {
  test("Zugriffskontrolle: nur Admin darf Kunden verwalten", async ({ page }) => {
    // Anonym
    await page.goto("/admin/kunden");
    await expect(page).toHaveURL(/\/login\?redirect=\/admin/);

    // Kunde — kein Zugriff
    await page.goto("/login");
    await page.getByLabel("E-Mail").fill(CUSTOMER_EMAIL);
    await page.getByLabel("Passwort").fill(PASSWORD);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Einloggen" }).click();
    // Admin lands on /admin after login, every other role on /profil.
    await page.waitForURL(/\/(profil|admin)$/, { timeout: 10000 });
    await page.goto("/admin/kunden");
    await expect(page).toHaveURL("/");

    // Admin — voller Zugriff
    await loginAsAdmin(page);
    await page.goto("/admin/kunden");
    await expect(page).toHaveURL(/\/admin\/kunden/);
  });

  test("Kundenliste zeigt Name und E-Mail; Suche filtert korrekt", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/kunden");
    await expect(page.getByText("E2E4 Test Kunde")).toBeVisible();
    await expect(page.getByText("e2e4-kunde@viennasalsastudio.test")).toBeVisible();

    // PROJ-33: search is submit-based (URL param), not live-as-you-type.
    await page.getByPlaceholder(/Suche/).fill("E2E4 Test Kunde");
    await page.getByRole("button", { name: "Filtern" }).click();
    await expect(page.getByText("E2E4 Test Kunde")).toBeVisible();

    await page.getByPlaceholder(/Suche/).fill("kein-treffer-xyz");
    await page.getByRole("button", { name: "Filtern" }).click();
    await expect(page.getByText("Keine Kunden gefunden")).toBeVisible();
  });

  test("Kundendetailseite zeigt Profildaten; Profil bearbeiten und speichern", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/kunden");
    await page.getByRole("link", { name: "E2E4 Test Kunde" }).click();
    await page.waitForURL(/\/admin\/kunden\/.+/);
    await expect(page.getByText("e2e4-kunde@viennasalsastudio.test")).toBeVisible();

    await page.getByLabel("Telefon").fill("+43 660 1112233");
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByText("Profil gespeichert")).toBeVisible();
    await expect(page.getByLabel("Telefon")).toHaveValue("+43 660 1112233");
  });

  test("Kein Abo vorhanden zeigt Leerzustand; neues Abo anlegen erscheint in Liste", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/kunden");
    await page.getByRole("link", { name: "E2E4 Test Kunde" }).click();
    await page.waitForURL(/\/admin\/kunden\/.+/);
    await expect(page.getByText("Noch keine Abos vorhanden")).toBeVisible();

    await page.getByRole("button", { name: "Neues Abo" }).click();
    await page.waitForTimeout(400);
    await page.getByPlaceholder(/Flatrate Studierende/).fill("E2E4 1 Kurs/Woche");
    await page.getByLabel("Preis (€)").fill("60");
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByText("E2E4 1 Kurs/Woche")).toBeVisible();
    await expect(page.getByText("60,00")).toBeVisible();
  });

  test("Pflichtfeld-Validierung: leerer Name und negativer Preis werden abgelehnt", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/kunden");
    await page.getByRole("link", { name: "E2E4 Test Kunde" }).click();
    await page.waitForURL(/\/admin\/kunden\/.+/);

    await page.getByRole("button", { name: "Neues Abo" }).click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText("Name ist erforderlich")).toBeVisible();

    await page.getByPlaceholder(/Flatrate Studierende/).fill("E2E4 Invalid");
    await page.getByLabel("Preis (€)").fill("-10");
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText("Preis darf nicht negativ sein")).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("Mehrere unabhängige Abos pro Kunde; Status ändern; Abo löschen", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/kunden");
    await page.getByRole("link", { name: "E2E4 Test Kunde" }).click();
    await page.waitForURL(/\/admin\/kunden\/.+/);

    // Zweites, unabhängiges Abo anlegen
    await page.getByRole("button", { name: "Neues Abo" }).click();
    await page.waitForTimeout(400);
    await page.getByPlaceholder(/Flatrate Studierende/).fill("E2E4 Drop-In");
    await page.getByLabel("Preis (€)").fill("20");
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(800);
    await expect(page.locator("table tbody tr")).toHaveCount(2);

    // Status des ersten Abos ändern
    await page.getByRole("row", { name: /E2E4 1 Kurs\/Woche/ }).getByRole("button", { name: "Bearbeiten" }).click();
    await page.waitForTimeout(400);
    await page.getByLabel("Status").click();
    await page.getByRole("option", { name: "Pausiert" }).click();
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByRole("row", { name: /E2E4 1 Kurs\/Woche/ })).toContainText("Pausiert");

    // Zweites Abo unverändert (unabhängig)
    await expect(page.getByRole("row", { name: /E2E4 Drop-In/ })).toContainText("Aktiv");

    // Abo löschen
    await page.getByRole("row", { name: /E2E4 Drop-In/ }).getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("alertdialog").getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(800);
    await expect(page.locator("table tbody tr")).toHaveCount(1);
  });
});
