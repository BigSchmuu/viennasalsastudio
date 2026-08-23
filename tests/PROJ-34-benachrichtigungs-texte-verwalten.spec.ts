import { test, expect, type Page } from "@playwright/test";
import { TEMPLATE_REGISTRY } from "../src/lib/notifications/template-registry";
import { createClient } from "@supabase/supabase-js";

// The Playwright runner doesn't auto-load .env.local (unlike `next dev`), but
// the fixture reset below needs SUPABASE_SERVICE_ROLE_KEY.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Already loaded (e.g. CI env vars set directly) — safe to ignore.
}

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER = { email: "e2e8-customer@viennasalsastudio.test", password: "CorrectPassword123!" };
const TEACHER = { email: "e2e13-lehrer-a@viennasalsastudio.test", password: "CorrectPassword123!" };

const TEST_KEY = "buchungsstatus_bestaetigt";
const DEFAULT_BODY = "Deine Buchungsanfrage für {kurs} wurde bestätigt.";

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function login(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForTimeout(1500);
}

test.beforeAll(async () => {
  await service.from("notification_template_overrides").delete().eq("template_key", TEST_KEY);
});

test.afterAll(async () => {
  await service.from("notification_template_overrides").delete().eq("template_key", TEST_KEY);
});

test.describe("PROJ-34: Benachrichtigungs-Texte verwalten", () => {
  test("Übersicht listet alle Vorlagen gruppiert, standardmäßig als 'Standard' markiert", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/benachrichtigungen");
    await page.waitForTimeout(600);

    await expect(page.getByRole("heading", { name: "Benachrichtigungs-Texte" })).toBeVisible();
    for (const group of [
      "Buchungsstatus",
      "Warteliste",
      "Abo-Kündigung",
      "Kursstart-Erinnerung",
      "SEPA-Ankündigung",
      "Event-Tickets",
      "Probestunden-Follow-up",
      "Zahlungserinnerung",
    ]) {
      await expect(page.getByText(group, { exact: true })).toBeVisible();
    }
    // Keine feste Zahl: Sie müsste bei jeder neuen Vorlage nachgezogen werden
    // und bestätigte am Ende nur, dass jemand sie hochgezählt hat. Die Aussage
    // ist "jede Vorlage ist bearbeitbar" — also so viele Links wie Vorlagen.
    await expect(page.getByRole("link", { name: "Bearbeiten" })).toHaveCount(TEMPLATE_REGISTRY.length);
    // Scoped to the "Buchungsstatus" group — "Bestätigt" is also a variant
    // label under "Event-Tickets", so an unscoped match would be ambiguous.
    const buchungsstatusGroup = page.locator("div.rounded-md.border", {
      has: page.getByText("Buchungsstatus", { exact: true }),
    });
    const row = buchungsstatusGroup.locator("li", { hasText: "Bestätigt" });
    await expect(row.getByText("Standard")).toBeVisible();
  });

  test("Editor zeigt vorausgefüllte Felder und die gültigen Platzhalter für diese Vorlage", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/admin/benachrichtigungen/${TEST_KEY}`);
    await page.waitForTimeout(600);

    await expect(page.getByRole("heading", { name: "Buchungsstatus: Bestätigt" })).toBeVisible();
    await expect(page.locator("#tpl-email-body")).toHaveValue(DEFAULT_BODY);
    await expect(page.getByText("Verfügbare Platzhalter")).toBeVisible();
    await expect(page.locator("code", { hasText: "{kurs}" })).toBeVisible();
    // No customization yet — no reset button.
    await expect(page.getByRole("button", { name: "Auf Standard zurücksetzen" })).toHaveCount(0);
  });

  test("Unbekannter Platzhalter blockiert Speichern mit Fehlermeldung", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/admin/benachrichtigungen/${TEST_KEY}`);
    await page.waitForTimeout(600);

    await page.locator("#tpl-email-body").fill("Deine Buchungsanfrage für {kurss} wurde bestätigt.");
    await page.waitForTimeout(300);
    await expect(page.getByText(/Unbekannte Platzhalter/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Speichern" })).toBeDisabled();
    await expect(page.getByText("Vorschau nicht verfügbar")).toBeVisible();
  });

  // QA BUG-1 regression: substituteHtml() used to escape only the substituted
  // placeholder VALUES, not the surrounding admin-typed literal text — a raw
  // <img onerror=...> in the body rendered live in the preview (and would
  // have shipped identically in the real email, since both share
  // buildNotificationContent). Fixed by escaping the whole template text
  // before substitution.
  test("Roher HTML-Text im Vorlagenfeld wird escaped, nicht als HTML ausgeführt", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/admin/benachrichtigungen/${TEST_KEY}`);
    await page.waitForTimeout(600);

    await page
      .locator("#tpl-email-body")
      .fill('<img src=x onerror="window.__xss=true"> Deine Buchungsanfrage für {kurs} wurde bestätigt.');
    await page.waitForTimeout(500);

    const xssFired = await page.evaluate(() => (window as unknown as { __xss?: boolean }).__xss === true);
    expect(xssFired).toBe(false);

    const previewText = await page.locator(".rounded-md.border.bg-white").innerText();
    expect(previewText).toContain("<img");
  });

  test("Leeres Feld blockiert Speichern", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/admin/benachrichtigungen/${TEST_KEY}`);
    await page.waitForTimeout(600);

    await page.locator("#tpl-email-body").fill("");
    await page.waitForTimeout(300);
    await expect(page.getByRole("button", { name: "Speichern" })).toBeDisabled();
  });

  test("Live-Vorschau aktualisiert sich beim Tippen mit Beispieldaten", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/admin/benachrichtigungen/${TEST_KEY}`);
    await page.waitForTimeout(600);

    const preview = page.locator(".rounded-md.border.bg-white");
    await expect(preview).toContainText("Salsa Beginner 1");

    await page.locator("#tpl-email-subject").fill("Geändert: {kurs}");
    await page.waitForTimeout(300);
    await expect(preview).toContainText("Geändert: Salsa Beginner 1");
  });

  test("Gültige Änderung speichern; Vorlage gilt danach als 'Angepasst'; Zurücksetzen stellt Standard wieder her", async ({
    page,
  }) => {
    await login(page, ADMIN);
    await page.goto(`/admin/benachrichtigungen/${TEST_KEY}`);
    await page.waitForTimeout(600);

    await page.locator("#tpl-email-body").fill("Deine Buchungsanfrage für {kurs} wurde bestätigt und bearbeitet.");
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText("Vorlage gespeichert.")).toBeVisible();

    await page.goto("/admin/benachrichtigungen");
    await page.waitForTimeout(600);
    const buchungsstatusGroup = page.locator("div.rounded-md.border", {
      has: page.getByText("Buchungsstatus", { exact: true }),
    });
    const row = buchungsstatusGroup.locator("li", { hasText: "Bestätigt" });
    await expect(row.getByText("Angepasst")).toBeVisible();

    // Reset back to default.
    await page.goto(`/admin/benachrichtigungen/${TEST_KEY}`);
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "Auf Standard zurücksetzen" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("alertdialog").getByRole("button", { name: "Zurücksetzen" }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText("Auf Standard zurückgesetzt.")).toBeVisible();
    await expect(page.locator("#tpl-email-body")).toHaveValue(DEFAULT_BODY);
    await expect(page.getByRole("button", { name: "Auf Standard zurücksetzen" })).toHaveCount(0);
  });

  test("Nicht-Admin (Kunde oder Lehrer) wird von Übersicht und Editor weggeleitet", async ({ page }) => {
    for (const user of [CUSTOMER, TEACHER]) {
      await login(page, user);
      await page.goto("/admin/benachrichtigungen");
      await page.waitForTimeout(400);
      expect(page.url()).not.toContain("/admin/benachrichtigungen");

      await page.goto(`/admin/benachrichtigungen/${TEST_KEY}`);
      await page.waitForTimeout(400);
      expect(page.url()).not.toContain("/admin/benachrichtigungen");
    }
  });

  test("Unbekannter Vorlagen-Schlüssel in der URL zeigt 404", async ({ page }) => {
    await login(page, ADMIN);
    const response = await page.goto("/admin/benachrichtigungen/does-not-exist");
    expect(response?.status()).toBe(404);
  });
});
