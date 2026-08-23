import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// The Playwright runner doesn't auto-load .env.local (unlike `next dev`), but
// the fixture reset below needs SUPABASE_SERVICE_ROLE_KEY.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Already loaded (e.g. CI env vars set directly) — safe to ignore.
}

const ADMIN = { email: "e2e30-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const KUNDE = { email: "e2e8-customer@viennasalsastudio.test", password: "CorrectPassword123!" };

const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/**
 * These tests change fee, settled and reminder state on the bounced fixture
 * invoices — exactly the fields they assert on. Without a reset the suite would
 * pass once and then fail, the pattern that cost this project a full cleanup
 * round across nine suites.
 */
test.beforeEach(async () => {
  await service
    .from("invoices")
    .update({ bounce_fee: 0, settled_at: null, reminded_at: null })
    .not("bounced_at", "is", null);
  await service.from("notification_queue").delete().eq("event_type", "zahlungserinnerung");
});

test.afterAll(async () => {
  await service
    .from("invoices")
    .update({ bounce_fee: 0, settled_at: null, reminded_at: null })
    .not("bounced_at", "is", null);
  await service.from("notification_queue").delete().eq("event_type", "zahlungserinnerung");
});

async function login(page: Page, creds: { email: string; password: string }) {
  await page.goto("/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(creds.email);
  await page.getByLabel("Passwort").fill(creds.password);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

async function firstOpenInvoice() {
  const { data } = await service
    .from("invoices")
    .select("id, invoice_number, gross_amount")
    .not("bounced_at", "is", null)
    .is("settled_at", null)
    .limit(1)
    .single();
  return data!;
}

test.describe("PROJ-37: Offene Posten", () => {
  test("AC1: Die Liste zeigt zurückgebuchte Rechnungen mit Kunde, Nummer, Datum und Standzeit", async ({ page }) => {
    const invoice = await firstOpenInvoice();
    await login(page, ADMIN);
    await page.goto("/admin/offene-posten");
    await page.waitForLoadState("networkidle");

    const row = page.locator("tbody tr").filter({ hasText: invoice.invoice_number });
    await expect(row).toBeVisible();
    await expect(row).toContainText(/seit \d+ Tag/);
  });

  test("AC2: Eine Kachel nennt Anzahl und Gesamtsumme der offenen Beträge", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/offene-posten");
    await page.waitForLoadState("networkidle");

    const kachel = page.locator(".rounded-lg.border.bg-card").first();
    await expect(kachel).toContainText("Offene Posten");
    await expect(kachel).toContainText(/€/);
    await expect(kachel).toContainText(/offene[rn]? Posten/);
  });

  test("AC3: Die Gebühr fließt in die Gesamtsumme ein und wird getrennt ausgewiesen", async ({ page }) => {
    const invoice = await firstOpenInvoice();
    await login(page, ADMIN);
    await page.goto("/admin/offene-posten");
    await page.waitForLoadState("networkidle");

    const feld = page.getByLabel(`Gebühr für Rechnung ${invoice.invoice_number}`);
    await feld.fill("4.50");
    await feld.blur();
    await page.waitForTimeout(2500);

    const { data } = await service.from("invoices").select("bounce_fee").eq("id", invoice.id).single();
    expect(Number(data!.bounce_fee)).toBe(4.5);

    // Rechnungsbetrag und Gebühr stehen getrennt, die Summe zusätzlich daneben.
    const row = page.locator("tbody tr").filter({ hasText: invoice.invoice_number });
    const erwarteteSumme = (Number(invoice.gross_amount) + 4.5).toFixed(2).replace(".", ",");
    await expect(row).toContainText(erwarteteSumme);
  });

  test("AC4: Ein erledigter Posten verschwindet aus der Liste und lässt sich wieder öffnen", async ({ page }) => {
    const invoice = await firstOpenInvoice();
    await login(page, ADMIN);
    await page.goto("/admin/offene-posten");
    await page.waitForLoadState("networkidle");

    await page
      .locator("tbody tr")
      .filter({ hasText: invoice.invoice_number })
      .getByRole("button", { name: "Erledigt" })
      .click();
    await page.waitForTimeout(2500);
    await expect(page.locator("tbody tr").filter({ hasText: invoice.invoice_number })).toHaveCount(0);

    // Ein unwiderruflicher Haken auf einer Geldforderung wäre riskant.
    await page.goto("/admin/offene-posten?erledigte=1");
    await page.waitForLoadState("networkidle");
    const erledigt = page.locator("tbody tr").filter({ hasText: invoice.invoice_number });
    await expect(erledigt).toBeVisible();
    await erledigt.getByRole("button", { name: "Wieder öffnen" }).click();
    await page.waitForTimeout(2500);

    const { data } = await service.from("invoices").select("settled_at").eq("id", invoice.id).single();
    expect(data!.settled_at).toBeNull();
  });

  test("AC5: Ohne offene Posten erscheint ein Leerzustand statt einer leeren Tabelle", async ({ page }) => {
    // Alle Posten kurzzeitig auf erledigt setzen — der Leerzustand ist sonst
    // nicht herstellbar, ohne systemweit etwas zu behaupten.
    await service.from("invoices").update({ settled_at: new Date().toISOString() }).not("bounced_at", "is", null);
    try {
      await login(page, ADMIN);
      await page.goto("/admin/offene-posten");
      await page.waitForLoadState("networkidle");
      await expect(page.getByText("Keine offenen Posten")).toBeVisible();
      await expect(page.locator("tbody tr")).toHaveCount(0);
    } finally {
      await service.from("invoices").update({ settled_at: null }).not("bounced_at", "is", null);
    }
  });

  test("AC6: Eine Erinnerung, die nicht zugestellt werden kann, wird nicht als erinnert vermerkt", async ({ page }) => {
    const invoice = await firstOpenInvoice();
    await login(page, ADMIN);
    await page.goto("/admin/offene-posten");
    await page.waitForLoadState("networkidle");

    await page
      .locator("tbody tr")
      .filter({ hasText: invoice.invoice_number })
      .getByRole("button", { name: "Erinnerung senden" })
      .click();
    await page.waitForTimeout(9000);

    // Die Fixture-Kunden haben .test-Adressen, die Zustellung scheitert also
    // zwangsläufig — genau der Fall, den das Kriterium beschreibt.
    const { data: queued } = await service
      .from("notification_queue")
      .select("email_status")
      .eq("event_type", "zahlungserinnerung");
    expect(queued?.length, "Es muss ein Zustellversuch protokolliert sein").toBeGreaterThan(0);

    const { data } = await service.from("invoices").select("reminded_at").eq("id", invoice.id).single();
    if (queued![0].email_status !== "sent") {
      expect(data!.reminded_at, "Fehlgeschlagene Zustellung darf nicht als erinnert gelten").toBeNull();
      // Nicht über die Rolle allein: Next.js rendert eine eigene, leere
      // Routen-Ansage mit derselben Rolle.
      await expect(page.getByText("Die Erinnerung konnte nicht zugestellt werden")).toBeVisible();
    }
  });

  test("AC7: Kunden und Unangemeldete erreichen die Seite nicht", async ({ page }) => {
    await page.goto("/admin/offene-posten");
    await page.waitForLoadState("networkidle");
    expect(new URL(page.url()).pathname).toBe("/login");

    await login(page, KUNDE);
    await page.goto("/admin/offene-posten");
    await page.waitForLoadState("networkidle");
    expect(new URL(page.url()).pathname).not.toBe("/admin/offene-posten");
    await expect(page.getByText("Zurückgebuchte Lastschriften")).toHaveCount(0);
  });

  test("Sicherheit: Ein Kunde kann seine Rechnung nicht selbst als erledigt markieren", async () => {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    await anon.auth.signInWithPassword({ email: KUNDE.email, password: KUNDE.password });

    const { data: eigene } = await anon.from("invoices").select("id").not("bounced_at", "is", null).limit(1);
    expect(eigene?.length, "Der Kunde muss seine eigene Rechnung sehen können").toBeGreaterThan(0);

    const { count } = await anon
      .from("invoices")
      .update({ settled_at: new Date().toISOString(), bounce_fee: 0 }, { count: "exact" })
      .eq("id", eigene![0].id);
    expect(count ?? 0, "Ein Kunde darf keine Rechnung verändern").toBe(0);
  });

  test("Der Standardwert in den Einstellungen ist vorhanden und beschriftet", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/rechnungen/einstellungen");
    await page.waitForLoadState("networkidle");
    await expect(page.getByLabel("Rücklastschrift-Gebühr (€)")).toBeVisible();
  });
});
