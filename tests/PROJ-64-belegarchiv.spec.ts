import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gehZu } from "./navigation";
import { ladeTestUmgebung } from "./env";
import { zweiteStufeErledigen } from "./zweite-stufe";

ladeTestUmgebung();

/**
 * PROJ-64: Das Belegarchiv zum Aufbewahren.
 *
 * Geprüft wird, was die Aufbewahrungspflicht braucht: dass wirklich **jeder**
 * Beleg des Zeitraums vollständig in der Ansicht steht, dass ein Storno seine
 * Rechnung benennt, und dass im Druck die Verwaltungsoberfläche verschwindet
 * statt mitgedruckt zu werden.
 */

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const KUNDE = { email: "e2e8-customer@viennasalsastudio.test", password: "CorrectPassword123!" };

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test.use({ locale: "de-DE" });

const KENNUNG = `PROJ64-${Date.now()}`;
let kundeId = "";
const angelegt: string[] = [];

/** Der heutige Kalendertag in Wien — dasselbe, was die Datenbank als Belegdatum setzt. */
function heuteInWien(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(new Date());
}
const HEUTE = heuteInWien();

async function legeBelegAn(
  nummer: string,
  betrag: number,
  zusatz: Record<string, unknown> = {}
): Promise<{ id: string; invoice_number: string }> {
  const { data, error } = await svc
    .from("invoices")
    .insert({
      invoice_number: nummer,
      invoice_date: HEUTE,
      customer_id: kundeId,
      description: `Archivprüfung ${nummer}`,
      gross_amount: betrag,
      vat_rate: 20,
      ...zusatz,
    })
    .select("id, invoice_number")
    .single();
  if (error) throw new Error(`Beleg ${nummer}: ${error.message}`);
  angelegt.unshift(data.id); // Stornos zuerst löschen — sie verweisen auf die Rechnung.
  return data;
}

test.beforeAll(async () => {
  const { data: users, error } = await svc.auth.admin.listUsers({ perPage: 200 });
  if (error) throw new Error(`Konten lesen: ${error.message}`);
  const treffer = users.users.find((u) => u.email === KUNDE.email);
  if (!treffer) throw new Error(`Testkunde ${KUNDE.email} fehlt — Seed nicht gelaufen?`);
  kundeId = treffer.id;
});

test.afterAll(async () => {
  for (const id of angelegt) await svc.from("invoices").delete().eq("id", id);
  angelegt.length = 0;
});

async function login(page: Page, zugang: { email: string; password: string }) {
  await gehZu(page, "/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(zugang.email);
  await page.getByLabel("Passwort").fill(zugang.password);
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await zweiteStufeErledigen(page, zugang.email);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

/** Der Weg, den ein Mensch geht: Rechnungsliste → Knopf → Archiv. */
async function oeffneArchivUeberDieListe(page: Page) {
  await page.goto(`/admin/rechnungen?from=${HEUTE}&to=${HEUTE}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "Belege zum Aufbewahren" }).click();
  await page.waitForURL(/\/admin\/rechnungen\/archiv/, { timeout: 20000 });
}

test.describe("PROJ-64: Belegarchiv zum Aufbewahren", () => {
  test("Von der Rechnungsliste ins Archiv — mit Zeitraum, Anzahl und Summe", async ({ page }) => {
    await legeBelegAn(`${KENNUNG}-A`, 60);
    await legeBelegAn(`${KENNUNG}-B`, 40);

    await login(page, ADMIN);
    await oeffneArchivUeberDieListe(page);

    // Der Zeitraum wandert mit: Wer heute filtert, archiviert heute.
    await expect(page).toHaveURL(new RegExp(`from=${HEUTE}`));
    await expect(page.getByRole("heading", { name: "Belege zum Aufbewahren" })).toBeVisible();

    const kopf = page.getByText(/Beleg(e)? · /).first();
    await expect(kopf).toContainText(HEUTE.split("-").reverse().join("."));
    // Beide Belege gezählt, und die Summe stimmt.
    await expect(kopf).toContainText("Belege");
    await expect(kopf).toContainText("100,00");
  });

  test("Jeder Beleg steht vollständig in der Ansicht", async ({ page }) => {
    const rechnung = await legeBelegAn(`${KENNUNG}-C`, 75);

    await login(page, ADMIN);
    await oeffneArchivUeberDieListe(page);

    const blatt = page.locator(".beleg-blatt").filter({ hasText: rechnung.invoice_number });
    await expect(blatt).toBeVisible();
    await expect(blatt.getByText("Rechnungsempfänger")).toBeVisible();
    await expect(blatt.getByText(`Archivprüfung ${rechnung.invoice_number}`)).toBeVisible();
    // Netto, USt und Brutto — bei 20 % aus 75,00 brutto: 62,50 + 12,50.
    await expect(blatt.getByText("62,50").first()).toBeVisible();
    await expect(blatt.getByText("12,50").first()).toBeVisible();
    await expect(blatt.getByText("75,00").first()).toBeVisible();
  });

  test("Ein Storno nennt seine Rechnung, und die Rechnung nennt ihr Storno", async ({ page }) => {
    const rechnung = await legeBelegAn(`${KENNUNG}-D`, 50);
    const storno = await legeBelegAn(`${KENNUNG}-D-STORNO`, -50, {
      document_type: "cancellation",
      cancels_invoice_id: rechnung.id,
      reason: "Kurs entfallen",
    });

    await login(page, ADMIN);
    await oeffneArchivUeberDieListe(page);

    const stornoBlatt = page.locator(".beleg-blatt").filter({ hasText: storno.invoice_number });
    await expect(stornoBlatt.getByText(`Storno zu Rechnung ${rechnung.invoice_number}`)).toBeVisible();
    await expect(stornoBlatt.getByText("Kurs entfallen")).toBeVisible();

    const rechnungsBlatt = page.locator(".beleg-blatt").filter({ hasText: `${rechnung.invoice_number} ` }).first();
    await expect(rechnungsBlatt.getByText(/Aufgehoben durch Storno/)).toBeVisible();
  });

  test("Im Druck bleibt nur das Archiv übrig", async ({ page }) => {
    await legeBelegAn(`${KENNUNG}-E`, 30);

    await login(page, ADMIN);
    await oeffneArchivUeberDieListe(page);
    await expect(page.getByRole("button", { name: "Drucken" })).toBeVisible();

    // Playwright kann die Seite so zeigen, wie der Drucker sie bekäme.
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Drucken" })).toBeHidden();
    await expect(page.getByRole("link", { name: "Zurück zur Liste" })).toBeHidden();
    // Die Verwaltungsnavigation gehört nicht in ein Buchhaltungsarchiv.
    await expect(page.getByRole("link", { name: "Lastschriften" })).toBeHidden();
    // Der Beleg dagegen schon.
    await expect(page.locator(".beleg-blatt").first()).toBeVisible();
    await page.emulateMedia({ media: "screen" });
  });

  test("Ein leerer Zeitraum sagt das, statt eine leere Seite zu zeigen", async ({ page }) => {
    await login(page, ADMIN);
    // Ein Tag, an dem es nichts gibt: der 1. Januar des Vorjahres.
    const leer = `${new Date().getFullYear() - 1}-01-01`;
    await gehZu(page, `/admin/rechnungen/archiv?from=${leer}&to=${leer}`);

    await expect(page.getByText("In diesem Zeitraum gibt es keine Belege.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Drucken" })).toHaveCount(0);
  });

  test("Sicherheit: Kund:innen kommen nicht ins Belegarchiv", async ({ page }) => {
    await legeBelegAn(`${KENNUNG}-F`, 20);

    await login(page, KUNDE);
    await gehZu(page, `/admin/rechnungen/archiv?from=${HEUTE}&to=${HEUTE}`);

    await expect(page).not.toHaveURL(/\/admin\/rechnungen\/archiv/);
    await expect(page.locator(".beleg-blatt")).toHaveCount(0);
  });
});
