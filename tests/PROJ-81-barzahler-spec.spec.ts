import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gehZu } from "./navigation";
import { ladeTestUmgebung } from "./env";
import { zweiteStufeErledigen } from "./zweite-stufe";

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

const LEHRER = { email: "e2e13-lehrer-a@viennasalsastudio.test", password: "CorrectPassword123!" };
const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };

const stempel = Date.now();
const NAMEN = {
  bar: `E2E81 Berta Bar ${stempel}`,
  mandat: `E2E81 Max Mandat ${stempel}`,
};
const KURS = `E2E81 Kassenkurs ${stempel}`;
const HAND_NAME = `E2E82 Herbert Hand ${stempel}`;

let kursId = "";
let barKundeId = "";
let mandatKundeId = "";
let barAboId = "";

function wienerDatum(versatzTage = 0): string {
  const ziel = new Date(Date.now() + versatzTage * 24 * 3_600_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(ziel);
}

function wienerWochentag(): number {
  const tag = new Date(`${wienerDatum(0)}T12:00:00Z`).getUTCDay();
  return (tag + 6) % 7;
}

async function kontoAnlegen(mail: string, name: string): Promise<string> {
  const { data: alle } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = alle?.users.find((u) => u.email === mail);
  if (alt) await service.auth.admin.deleteUser(alt.id);
  const { data, error } = await service.auth.admin.createUser({
    email: mail,
    password: "CorrectPassword123!",
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-81 Konto ${mail}: ${error?.message}`);
  await service.from("profiles").update({ full_name: name }).eq("id", data.user.id);
  return data.user.id;
}

async function anmelden(page: Page, konto: { email: string; password: string }) {
  await gehZu(page, "/login");
  // Erst hydrieren lassen — siehe docs/troubleshooting-tests.md.
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(konto.email);
  await page.getByLabel("Passwort").fill(konto.password);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await zweiteStufeErledigen(page, konto.email);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

function barzahlerKarte(page: Page) {
  return page.getByRole("region", { name: "Barzahler" });
}

async function zurKursseite(page: Page) {
  await gehZu(page, `/lehrer/${kursId}`);
  await expect(barzahlerKarte(page)).toBeVisible({ timeout: 30000 });
}

test.beforeAll(async () => {
  test.setTimeout(180000);

  barKundeId = await kontoAnlegen(`proj81-bar-${stempel}@viennasalsastudio.test`, NAMEN.bar);
  mandatKundeId = await kontoAnlegen(`proj81-mandat-${stempel}@viennasalsastudio.test`, NAMEN.mandat);

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data: kurs, error: kursFehler } = await service
    .from("courses")
    .insert({ name: KURS, room_id: raum!.id, price: 50 })
    .select("id")
    .single();
  if (kursFehler) throw new Error(`PROJ-81 Kurs: ${kursFehler.message}`);
  kursId = kurs!.id;

  // Ein Termin heute, damit die Anwesenheitsliste eine Spalte hat.
  await service.from("course_schedule").insert({
    course_id: kursId,
    weekday: wienerWochentag(),
    start_time: "08:00:00",
    end_time: "09:00:00",
  });

  const { data: lehrer } = await service
    .from("profiles")
    .select("id")
    .eq("full_name", "E2E13 Lehrer A")
    .single();
  await service.from("course_teachers").insert({ course_id: kursId, teacher_id: lehrer!.id });

  const { data: barAbo, error: barFehler } = await service
    .from("subscriptions")
    .insert({
      customer_id: barKundeId,
      course_id: kursId,
      status: "active",
      name: "E2E81 Barabo",
      price: 50,
      cycle_anchor_date: wienerDatum(-40),
    })
    .select("id")
    .single();
  if (barFehler) throw new Error(`PROJ-81 Barabo: ${barFehler.message}`);
  barAboId = barAbo!.id;

  const { error: mandatAboFehler } = await service.from("subscriptions").insert({
    customer_id: mandatKundeId,
    course_id: kursId,
    status: "active",
    name: "E2E81 Mandatsabo",
    price: 60,
    cycle_anchor_date: wienerDatum(-40),
  });
  if (mandatAboFehler) throw new Error(`PROJ-81 Mandatsabo: ${mandatAboFehler.message}`);

  await service.from("sepa_mandates").insert({
    customer_id: mandatKundeId,
    iban: "AT611904300234573201",
    account_holder_name: NAMEN.mandat,
    mandate_reference: `E2E81-${stempel}`,
    consented_at: new Date().toISOString(),
  });
});

test.afterAll(async () => {
  // Von Hand eingetragene Kunden: über ihren Namen finden und mitsamt Konto weg.
  const { data: hand } = await service.from("profiles").select("id").eq("full_name", HAND_NAME);
  for (const p of hand ?? []) {
    await service.from("cash_payments").delete().eq("customer_id", p.id);
    await service.from("subscriptions").delete().eq("customer_id", p.id);
    await service.auth.admin.deleteUser(p.id).catch(() => {});
  }

  if (kursId) {
    await service.from("cash_payments").delete().in("customer_id", [barKundeId, mandatKundeId]);
    await service.from("course_attendance").delete().eq("course_id", kursId);
    await service.from("subscriptions").delete().eq("course_id", kursId);
    await service.from("course_teachers").delete().eq("course_id", kursId);
    await service.from("course_schedule").delete().eq("course_id", kursId);
    await service.from("courses").delete().eq("id", kursId);
  }
  await service.from("sepa_mandates").delete().eq("customer_id", mandatKundeId);
  for (const id of [barKundeId, mandatKundeId]) {
    if (id) await service.auth.admin.deleteUser(id).catch(() => {});
  }
});

test.describe("PROJ-81: Barzahler am Kursabend", () => {
  test("Die Liste zeigt den Barzahler mit Betrag — und den Mandatskunden nicht", async ({ page }) => {
    await anmelden(page, LEHRER);
    await zurKursseite(page);

    const karte = barzahlerKarte(page);
    const zeile = karte.getByRole("row", { name: new RegExp(NAMEN.bar) });
    await expect(zeile).toBeVisible();
    await expect(zeile).toContainText("50,00");
    await expect(zeile).toContainText("Offen");

    // Die Unterscheidung, um die es geht.
    await expect(karte.getByText(new RegExp(NAMEN.mandat))).toHaveCount(0);
    await expect(karte.getByText(/Heute einzusammeln/)).toBeVisible();
  });

  test("Abhaken hält die Zahlung fest und lässt sich zurücknehmen", async ({ page }) => {
    await service.from("cash_payments").delete().eq("subscription_id", barAboId);
    await anmelden(page, LEHRER);
    await zurKursseite(page);

    const karte = barzahlerKarte(page);
    await karte.getByRole("button", { name: `Barzahlung von ${NAMEN.bar} erfassen` }).click();
    await page.waitForTimeout(2000);

    // Nicht nur die Oberfläche: Die Zahlung muss in der Datenbank stehen, mit
    // dem Betrag aus dem Abo.
    const { data: zahlungen } = await service
      .from("cash_payments")
      .select("amount, paid_on, collected_by")
      .eq("subscription_id", barAboId);
    expect(zahlungen).toHaveLength(1);
    expect(Number(zahlungen![0].amount)).toBe(50);
    expect(zahlungen![0].paid_on).toBe(wienerDatum(0));
    expect(zahlungen![0].collected_by, "Ohne Lehrkraft wäre nicht nachvollziehbar, wer kassiert hat").toBeTruthy();

    await expect(karte.getByRole("row", { name: new RegExp(NAMEN.bar) })).toContainText("Bezahlt am");

    // Und der Fehlgriff lässt sich sofort zurücknehmen.
    await karte.getByRole("button", { name: `Barzahlung von ${NAMEN.bar} zurücknehmen` }).click();
    await page.waitForTimeout(2000);
    const { count } = await service
      .from("cash_payments")
      .select("id", { count: "exact", head: true })
      .eq("subscription_id", barAboId);
    expect(count).toBe(0);
  });

  test("Die Verwaltung sieht offene Barzahlungen und das Eingesammelte", async ({ page }) => {
    await service.from("cash_payments").delete().eq("subscription_id", barAboId);
    await service.from("cash_payments").insert({
      subscription_id: barAboId,
      customer_id: barKundeId,
      amount: 50,
      paid_on: wienerDatum(0),
    });

    await anmelden(page, ADMIN);
    await gehZu(page, "/admin/barzahlungen");
    await page.waitForTimeout(1500);

    const eingesammelt = page.getByRole("region", { name: /Eingesammelt/ });
    await expect(eingesammelt.getByText(new RegExp(NAMEN.bar))).toBeVisible();
    await expect(eingesammelt.getByText(/Summe im Zeitraum/)).toBeVisible();

    // Bezahlt heißt nicht mehr offen.
    const offen = page.getByRole("region", { name: /^Offen/ });
    await expect(offen.getByText(new RegExp(NAMEN.bar))).toHaveCount(0);
  });
});

test.describe("PROJ-82: Barzahler von Hand eintragen", () => {
  test("Die Lehrkraft trägt einen Gast ein — er steht danach in beiden Listen", async ({ page }) => {
    await anmelden(page, LEHRER);
    await zurKursseite(page);

    const karte = barzahlerKarte(page);
    await karte.getByRole("button", { name: /Barzahler eintragen/ }).click();
    await karte.getByLabel("Name").fill(HAND_NAME);
    // Mit Komma — auf einem Handy tippt niemand einen Punkt.
    await karte.getByLabel("Betrag").fill("49,50");
    await karte.getByRole("button", { name: "Eintragen" }).click();

    // Die Seite lädt sich neu: Der neue Kunde gehört auch in die
    // Anwesenheitsliste, nicht nur in diese Tabelle.
    await expect(barzahlerKarte(page).getByText(HAND_NAME)).toBeVisible({ timeout: 30000 });
    await expect(barzahlerKarte(page).getByRole("row", { name: new RegExp(HAND_NAME) })).toContainText("49,50");

    // Genau das war der Grund für einen echten Kunden: Er zählt überall mit.
    const matrix = page
      .locator("table")
      .filter({ has: page.getByRole("columnheader", { name: "Kursteilnehmer" }) });
    await expect(matrix.getByText(HAND_NAME)).toBeVisible();

    // Das Konto trägt eine Adresse, die nie Post empfangen kann.
    const { data: profil } = await service
      .from("profiles")
      .select("id")
      .eq("full_name", HAND_NAME)
      .single();
    const { data: konto } = await service.auth.admin.getUserById(profil!.id);
    expect(konto.user?.email).toMatch(/@viennasalsastudio\.invalid$/);
  });

  test("Ein unsinniger Betrag wird abgewiesen, ohne etwas anzulegen", async ({ page }) => {
    await anmelden(page, LEHRER);
    await zurKursseite(page);

    const karte = barzahlerKarte(page);
    await karte.getByRole("button", { name: /Barzahler eintragen/ }).click();
    await karte.getByLabel("Name").fill("E2E82 Wird Nicht Angelegt");
    await karte.getByLabel("Betrag").fill("keine Ahnung");
    await karte.getByRole("button", { name: "Eintragen" }).click();
    await page.waitForTimeout(1500);

    await expect(karte.getByText(/Bitte einen Betrag angeben/)).toBeVisible();
    const { count } = await service
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("full_name", "E2E82 Wird Nicht Angelegt");
    expect(count, "Es wurde doch ein Kunde angelegt").toBe(0);
  });
});
