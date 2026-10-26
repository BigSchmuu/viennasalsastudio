import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gehZu } from "./navigation";
import { ladeTestUmgebung } from "./env";

/**
 * PROJ-93: Die Pass-Kachel erscheint nur, wo es den Pass gibt.
 *
 * Das ist der Teil, den nur der Browser belegen kann: Die Datenbank weist eine
 * unzulässige Buchung ab (siehe PROJ-93-stil-pass-db.test.ts) — hier geht es
 * darum, dass der Kunde sie gar nicht erst angeboten bekommt.
 */

try {
  ladeTestUmgebung();
} catch {
  // Schon geladen — unkritisch.
}

const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const KUNDE = { email: "proj93-browser@viennasalsastudio.test", password: "CorrectPassword123!" };
const PASSPREIS = 85;

let kundeId = "";
let stilMitPass = "";
let stilOhnePass = "";
let kursMitPass = "";
let kursOhnePass = "";
let nameMitPass = "";
let nameOhnePass = "";
let stilnameMitPass = "";

function wienerDatum(versatzTage: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(
    new Date(Date.now() + versatzTage * 24 * 3_600_000)
  );
}

async function kursAnlegen(name: string, stilId: string): Promise<string> {
  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data, error } = await service
    .from("courses")
    .insert({ name, room_id: raum!.id, price: 65, dance_style_id: stilId })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-93 Kurs ${name}: ${error.message}`);
  await service.from("course_schedule").insert({
    course_id: data!.id,
    weekday: 2,
    start_time: "18:00:00",
    end_time: "19:00:00",
  });
  // Ohne Einstiegstermin zeigt der Dialog einen Hinweis statt des Formulars —
  // und damit auch keine Kacheln.
  await service.from("course_entry_dates").insert({ course_id: data!.id, entry_date: wienerDatum(7) });
  return data!.id;
}

async function anmelden(page: Page) {
  await gehZu(page, "/login");
  // Erst hydrieren lassen — siehe docs/troubleshooting-tests.md.
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(KUNDE.email);
  await page.getByLabel(/^Passwort$/).fill(KUNDE.password);
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL(/\/(mein-bereich|profil)$/, { timeout: 20000 });
}

/** Den Buchungsdialog dieses Kurses öffnen — über den Katalog, wie ein Kunde. */
async function dialogOeffnen(page: Page, kursName: string) {
  await gehZu(page, "/kurse");
  await page.waitForTimeout(800);
  const mehr = page.getByRole("button", { name: /Mehr laden/ });
  for (let i = 0; i < 6 && (await mehr.count()); i++) {
    await mehr.first().click();
    await page.waitForTimeout(400);
  }
  await page
    .locator(".rounded-lg.border.bg-card")
    .filter({ has: page.getByText(kursName, { exact: true }) })
    .getByRole("button", { name: /buchen|Buchen|anmelden|Anmelden/ })
    .first()
    .click();
  await page.waitForTimeout(600);
  await page.getByRole("tab", { name: "Anmeldung" }).click();
  await page.waitForTimeout(400);
}

test.beforeAll(async () => {
  test.setTimeout(180000);

  const { data: alle } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = alle?.users.find((u) => u.email === KUNDE.email);
  if (alt) {
    await service.from("course_bookings").delete().eq("customer_id", alt.id);
    await service.from("subscriptions").delete().eq("customer_id", alt.id);
    await service.from("sepa_mandates").delete().eq("customer_id", alt.id);
    await service.auth.admin.deleteUser(alt.id);
  }
  const { data, error } = await service.auth.admin.createUser({
    email: KUNDE.email,
    password: KUNDE.password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-93 Konto: ${error?.message}`);
  kundeId = data.user.id;
  // Herkunft gesetzt: Sonst steht im Dialog zusätzlich die Frage „Wie hast du
  // von uns erfahren?" — sie stört die Prüfung nicht, aber sie gehört nicht
  // dazu.
  await service
    .from("profiles")
    .update({ full_name: "E2E93 Browserkunde", referral_source: "google" })
    .eq("id", kundeId);
  // Ohne Mandat zeigt der Dialog den Mandatshinweis statt der Kacheln.
  await service.from("sepa_mandates").insert({
    customer_id: kundeId,
    iban: "AT611904300234573201",
    account_holder_name: "E2E93 Browserkunde",
    mandate_reference: `E2E93B-${Date.now()}`,
    consented_at: new Date().toISOString(),
  });

  const marke = Date.now();
  stilnameMitPass = `E2E93B Bachata ${marke}`;
  const { data: stile, error: stilFehler } = await service
    .from("dance_styles")
    .insert([
      { name: stilnameMitPass, pass_price: PASSPREIS, pass_student_price: 70 },
      { name: `E2E93B Salsa ${marke}` },
    ])
    .select("id, pass_price");
  if (stilFehler) throw new Error(`PROJ-93 Tanzstile: ${stilFehler.message}`);
  stilMitPass = stile!.find((s) => s.pass_price !== null)!.id;
  stilOhnePass = stile!.find((s) => s.pass_price === null)!.id;

  nameMitPass = `E2E93B Kurs mit Pass ${marke}`;
  nameOhnePass = `E2E93B Kurs ohne Pass ${marke}`;
  kursMitPass = await kursAnlegen(nameMitPass, stilMitPass);
  kursOhnePass = await kursAnlegen(nameOhnePass, stilOhnePass);
});

test.afterAll(async () => {
  for (const kurs of [kursMitPass, kursOhnePass].filter(Boolean)) {
    await service.from("course_entry_dates").delete().eq("course_id", kurs);
    await service.from("course_schedule").delete().eq("course_id", kurs);
    await service.from("courses").delete().eq("id", kurs);
  }
  for (const stil of [stilMitPass, stilOhnePass].filter(Boolean)) {
    await service.from("dance_styles").delete().eq("id", stil);
  }
  if (kundeId) {
    await service.from("course_bookings").delete().eq("customer_id", kundeId);
    await service.from("sepa_mandates").delete().eq("customer_id", kundeId);
    await service.auth.admin.deleteUser(kundeId).catch(() => {});
  }
});

test.describe("PROJ-93: Der Pass erscheint nur bei seiner Stilrichtung", () => {
  test("Bei einem Kurs mit Pass steht die Kachel samt Preis da", async ({ page }) => {
    await anmelden(page);
    await dialogOeffnen(page, nameMitPass);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(`${stilnameMitPass}-Pass`)).toBeVisible();
    // Der Preis gehört zur Kachel — eine Kachel ohne Betrag wäre ein Angebot
    // ohne Aussage.
    await expect(dialog.getByText(String(PASSPREIS))).toBeVisible();
    // Die beiden alten Tarife stehen weiterhin daneben.
    await expect(dialog.getByText("Nur diesen Kurs")).toBeVisible();
  });

  test("Bei einem Kurs ohne Pass fehlt die Kachel ganz", async ({ page }) => {
    await anmelden(page);
    await dialogOeffnen(page, nameOhnePass);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Nur diesen Kurs")).toBeVisible();
    await expect(dialog.getByText(/-Pass$/)).toHaveCount(0);
  });

  test("Der Pass lässt sich wählen und absenden", async ({ page }) => {
    await anmelden(page);
    await dialogOeffnen(page, nameMitPass);

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox").first().click();
    await page.waitForTimeout(300);
    await page.getByRole("option").first().click();
    await dialog.getByText(`${stilnameMitPass}-Pass`).click();
    await page.locator("#terms-accepted-booking").check();
    await dialog.getByRole("button", { name: "Rechtlich verbindlich buchen" }).click();
    await page.waitForTimeout(2500);

    // Die Anfrage steht mit dem Pass als Tarif in der Datenbank — nicht als
    // Kursabo, und mit dem Preis der Stilrichtung.
    const { data: buchung } = await service
      .from("course_bookings")
      .select("desired_plan, price")
      .eq("customer_id", kundeId)
      .eq("course_id", kursMitPass)
      .maybeSingle();
    expect(buchung, "Die Buchung ist nicht entstanden").not.toBeNull();
    expect(buchung!.desired_plan).toBe("style_pass");
    expect(Number(buchung!.price)).toBe(PASSPREIS);
  });
});
