import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gehZu } from "./navigation";
import { ladeTestUmgebung } from "./env";
import { zweiteStufeErledigen } from "./zweite-stufe";

/**
 * PROJ-83: Teilbeträge erfassen — am Kursabend und in der Verwaltung.
 *
 * Braucht die Migration 20261014120000_proj83_teilbetraege.sql.
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

const LEHRER = { email: "e2e13-lehrer-a@viennasalsastudio.test", password: "CorrectPassword123!" };
const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };

const stempel = Date.now();
const NAME = `E2E83 Teresa Teil ${stempel}`;
const KURS = `E2E83 Teilkurs ${stempel}`;
const BEITRAG = 89;

let kursId = "";
let kundeId = "";
let aboId = "";
let flatrateId = "";

function wienerDatum(versatzTage = 0): string {
  const ziel = new Date(Date.now() + versatzTage * 24 * 3_600_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(ziel);
}

function wienerWochentag(): number {
  const tag = new Date(`${wienerDatum(0)}T12:00:00Z`).getUTCDay();
  return (tag + 6) % 7;
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

function offeneKarte(page: Page) {
  return page.getByRole("region", { name: /^Offen/ });
}

/**
 * Das Eingabefeld für den Teilbetrag — genau, nicht als Anfang.
 *
 * `getByLabel` passt auf Teilzeichenfolgen, und „Teilbetrag von Teresa" ist
 * auch der Anfang von „Teilbetrag von Teresa erfassen" am OK-Knopf daneben.
 */
function teilbetragsFeld(bereich: ReturnType<typeof barzahlerKarte>, name: string) {
  return bereich.getByRole("textbox", { name: `Teilbetrag von ${name}`, exact: true });
}

/** Den Stand zurücksetzen: so viele fällige Beiträge, keine Zahlung. */
async function stand(abo: string, anzahl: number, betrag = BEITRAG) {
  await service.from("cash_payments").delete().eq("subscription_id", abo);
  await service.from("cash_dues").delete().eq("subscription_id", abo);
  if (anzahl === 0) return;
  const zeilen = Array.from({ length: anzahl }, (_, i) => ({
    subscription_id: abo,
    customer_id: kundeId,
    amount: betrag,
    due_on: wienerDatum(-28 * (anzahl - 1 - i) - 1),
  }));
  const { error } = await service.from("cash_dues").insert(zeilen);
  if (error) throw new Error(`PROJ-83 Soll: ${error.message}`);
}

async function saldo(abo: string): Promise<number> {
  const { data } = await service
    .from("cash_ledger")
    .select("saldo")
    .eq("subscription_id", abo)
    .maybeSingle();
  return Number(data?.saldo ?? 0);
}

test.beforeAll(async () => {
  test.setTimeout(180000);

  const { data: alle } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = alle?.users.find((u) => u.email === `proj83-${stempel}@viennasalsastudio.test`);
  if (alt) await service.auth.admin.deleteUser(alt.id);
  const { data: neu, error: kontoFehler } = await service.auth.admin.createUser({
    email: `proj83-${stempel}@viennasalsastudio.test`,
    password: "CorrectPassword123!",
    email_confirm: true,
  });
  if (kontoFehler || !neu.user) throw new Error(`PROJ-83 Konto: ${kontoFehler?.message}`);
  kundeId = neu.user.id;
  await service.from("profiles").update({ full_name: NAME }).eq("id", kundeId);

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data: kurs, error: kursFehler } = await service
    .from("courses")
    .insert({ name: KURS, room_id: raum!.id, price: BEITRAG })
    .select("id")
    .single();
  if (kursFehler) throw new Error(`PROJ-83 Kurs: ${kursFehler.message}`);
  kursId = kurs!.id;

  // Ein Termin heute, damit die Kursseite eine Anwesenheitsspalte hat.
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

  const { data: abo, error: aboFehler } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: kursId,
      status: "active",
      name: "E2E83 Kursabo",
      price: BEITRAG,
      cycle_anchor_date: wienerDatum(-60),
    })
    .select("id")
    .single();
  if (aboFehler) throw new Error(`PROJ-83 Abo: ${aboFehler.message}`);
  aboId = abo!.id;
});

test.afterAll(async () => {
  const abos = [aboId, flatrateId].filter(Boolean);
  if (abos.length > 0) {
    await service.from("cash_payments").delete().in("subscription_id", abos);
    await service.from("cash_dues").delete().in("subscription_id", abos);
    await service.from("subscriptions").delete().in("id", abos);
  }
  if (kursId) {
    await service.from("course_attendance").delete().eq("course_id", kursId);
    await service.from("subscriptions").delete().eq("course_id", kursId);
    await service.from("course_teachers").delete().eq("course_id", kursId);
    await service.from("course_schedule").delete().eq("course_id", kursId);
    await service.from("courses").delete().eq("id", kursId);
  }
  if (kundeId) await service.auth.admin.deleteUser(kundeId).catch(() => {});
});

test.describe("PROJ-83: Teilbeträge am Kursabend", () => {
  test("Die Lehrkraft trägt einen Teilbetrag ein — die Zeile bleibt über den Rest offen", async ({
    page,
  }) => {
    await stand(aboId, 1);
    await anmelden(page, LEHRER);
    await gehZu(page, `/lehrer/${kursId}`);
    await expect(barzahlerKarte(page)).toBeVisible({ timeout: 30000 });

    const karte = barzahlerKarte(page);
    await karte.getByRole("button", { name: `Teilbetrag für ${NAME} eingeben` }).click();
    // Mit Komma — auf einem Handy tippt niemand einen Punkt.
    await teilbetragsFeld(karte, NAME).fill("40,00");
    await karte.getByRole("button", { name: `Teilbetrag von ${NAME} erfassen` }).click();
    await page.waitForTimeout(2500);

    // In der Datenbank, nicht nur auf dem Schirm.
    const { data: zahlungen } = await service
      .from("cash_payments")
      .select("amount")
      .eq("subscription_id", aboId);
    expect(zahlungen).toHaveLength(1);
    expect(Number(zahlungen![0].amount)).toBe(40);
    expect(await saldo(aboId)).toBe(49);

    // Und die Zeile sagt beides: dass etwas bezahlt ist und wie viel fehlt.
    const zeile = karte.getByRole("row", { name: new RegExp(NAME) });
    await expect(zeile).toContainText("Teilweise bezahlt");
    await expect(zeile).toContainText("49,00");
  });

  test("Der Knopf nennt den gesamten offenen Betrag, nicht einen Zyklusbeitrag", async ({
    page,
  }) => {
    // Zwei fällige Beiträge, nichts bezahlt: Es geht um 178 Euro, nicht um 89.
    await stand(aboId, 2);
    await anmelden(page, LEHRER);
    await gehZu(page, `/lehrer/${kursId}`);
    await expect(barzahlerKarte(page)).toBeVisible({ timeout: 30000 });

    const karte = barzahlerKarte(page);
    const zeile = karte.getByRole("row", { name: new RegExp(NAME) });
    await expect(zeile).toContainText("178,00");

    await karte.getByRole("button", { name: `Barzahlung von ${NAME} erfassen` }).click();
    await page.waitForTimeout(2500);

    const { data: zahlungen } = await service
      .from("cash_payments")
      .select("amount")
      .eq("subscription_id", aboId);
    expect(zahlungen).toHaveLength(1);
    expect(Number(zahlungen![0].amount)).toBe(178);
    expect(await saldo(aboId)).toBe(0);
  });

  test("Ein unsinniger Betrag wird abgewiesen, ohne etwas zu verbuchen", async ({ page }) => {
    await stand(aboId, 1);
    await anmelden(page, LEHRER);
    await gehZu(page, `/lehrer/${kursId}`);
    await expect(barzahlerKarte(page)).toBeVisible({ timeout: 30000 });

    const karte = barzahlerKarte(page);
    await karte.getByRole("button", { name: `Teilbetrag für ${NAME} eingeben` }).click();
    await teilbetragsFeld(karte, NAME).fill("keine Ahnung");
    await karte.getByRole("button", { name: `Teilbetrag von ${NAME} erfassen` }).click();
    await page.waitForTimeout(1500);

    await expect(karte.getByText(/Bitte einen Betrag zwischen/)).toBeVisible();
    const { count } = await service
      .from("cash_payments")
      .select("id", { count: "exact", head: true })
      .eq("subscription_id", aboId);
    expect(count, "Es wurde doch etwas verbucht").toBe(0);
  });
});

test.describe("PROJ-83: Erfassen in der Verwaltung", () => {
  test("Der Betreiber erfasst eine Zahlung in der Übersicht", async ({ page }) => {
    await stand(aboId, 1);
    await anmelden(page, ADMIN);
    await gehZu(page, "/admin/barzahlungen");
    await expect(offeneKarte(page)).toBeVisible({ timeout: 30000 });

    const karte = offeneKarte(page);
    await expect(karte.getByText(new RegExp(NAME))).toBeVisible();
    await karte.getByRole("button", { name: `Barzahlung von ${NAME} erfassen` }).click();
    await page.waitForTimeout(2500);

    expect(await saldo(aboId)).toBe(0);
    // Bezahlt heißt nicht mehr offen.
    await expect(offeneKarte(page).getByText(new RegExp(NAME))).toHaveCount(0);
  });

  test("Eine Flatrate ohne Kursplatz lässt sich dort abhaken — vorher ging das nirgends", async ({
    page,
  }) => {
    const { data: flat, error } = await service
      .from("subscriptions")
      .insert({
        customer_id: kundeId,
        course_id: null,
        status: "active",
        name: "E2E83 Flatrate ohne Kurs",
        price: 120,
        cycle_anchor_date: wienerDatum(-60),
      })
      .select("id")
      .single();
    if (error) throw new Error(`PROJ-83 Flatrate: ${error.message}`);
    flatrateId = flat!.id;
    await stand(aboId, 0);
    await stand(flatrateId, 1, 120);

    await anmelden(page, ADMIN);
    await gehZu(page, "/admin/barzahlungen");
    await expect(offeneKarte(page)).toBeVisible({ timeout: 30000 });

    const karte = offeneKarte(page);
    const zeile = karte.getByRole("row", { name: new RegExp(NAME) });
    await expect(zeile).toContainText("120,00");
    await karte.getByRole("button", { name: `Barzahlung von ${NAME} erfassen` }).click();
    await page.waitForTimeout(2500);

    expect(await saldo(flatrateId)).toBe(0);
  });

  test("Eine zurückgenommene Zahlung macht den Betrag wieder offen", async ({ page }) => {
    // Alle Zahlungen dieses Kunden weg, nicht nur die dieses Abos: Aus dem
    // Test davor steht noch die Flatrate-Zahlung — und beide Zeilen trügen
    // denselben Knopf.
    await service.from("cash_payments").delete().eq("customer_id", kundeId);
    if (flatrateId) await service.from("cash_dues").delete().eq("subscription_id", flatrateId);
    await stand(aboId, 1);
    await service.from("cash_payments").insert({
      subscription_id: aboId,
      customer_id: kundeId,
      amount: BEITRAG,
      paid_on: wienerDatum(0),
    });
    expect(await saldo(aboId)).toBe(0);

    await anmelden(page, ADMIN);
    await gehZu(page, "/admin/barzahlungen");
    await page.waitForTimeout(1500);

    const eingesammelt = page.getByRole("region", { name: /Eingesammelt/ });
    const zahlungsZeile = eingesammelt.getByRole("row").filter({ hasText: "89,00" });
    await zahlungsZeile
      .getByRole("button", { name: new RegExp(`Zahlung von ${NAME}.*zurücknehmen`) })
      .click();
    await page.waitForTimeout(2500);

    expect(await saldo(aboId)).toBe(BEITRAG);
    await expect(offeneKarte(page).getByText(new RegExp(NAME))).toBeVisible();
  });

  test("Die Lehrkraft kommt auf die Verwaltungsseite nicht", async ({ page }) => {
    await anmelden(page, LEHRER);
    await gehZu(page, "/admin/barzahlungen");
    await page.waitForTimeout(1500);
    await expect(page.getByRole("region", { name: /Eingesammelt/ })).toHaveCount(0);
  });
});
