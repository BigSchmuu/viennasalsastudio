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

/**
 * PROJ-100: Der Rückweg aus der Kundenakte führt dorthin, wo man herkam.
 *
 * Das ist der Teil, den nur der Browser belegen kann: dass der Weg **hin und
 * zurück** wirklich funktioniert. Die Namenstabelle, die geprüften Pfade und
 * der Kreis stehen in `src/lib/navigation/herkunft.test.ts` — hier geht der
 * Test den Weg, statt ihn zu behaupten.
 */
const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };

const stempel = Date.now();
const KURSNAME = `E2E100 Rückwegkurs ${stempel}`;
const KUNDE = `E2E100 Rita Rueckweg ${stempel}`;

let kursId = "";
let kundeId = "";
let aboId = "";

function wienerWochentag(): number {
  const heute = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Vienna" }));
  return heute.getDay();
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

/**
 * Der Rückweg im Kopf der Akte — der Link, um den es in PROJ-100 geht.
 *
 * Der Verwaltungsrahmen trägt selbst ein „← Zurück zu Mein Profil“ (im
 * Layout, auf jeder Verwaltungsseite). Ein Locator auf /^← Zurück/ trifft
 * also zwei Links. Hier wird der andere ausgeschlossen, statt über `.last()`
 * auf die Reihenfolge im Baum zu wetten.
 */
function rueckweg(page: Page) {
  return page.getByRole("link", { name: /^← Zurück(?! zu Mein Profil)/ });
}

test.beforeAll(async () => {
  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data: kurs, error } = await service
    .from("courses")
    .insert({ name: KURSNAME, room_id: raum!.id, price: 75 })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-100 Kurs: ${error.message}`);
  kursId = kurs!.id;

  await service.from("course_schedule").insert({
    course_id: kursId,
    weekday: wienerWochentag(),
    start_time: "08:00:00",
    end_time: "09:00:00",
  });

  const mail = `proj100-kunde-${stempel}@viennasalsastudio.test`;
  const { data: konto, error: kontoFehler } = await service.auth.admin.createUser({
    email: mail,
    password: "CorrectPassword123!",
    email_confirm: true,
  });
  if (kontoFehler || !konto.user) throw new Error(`PROJ-100 Konto: ${kontoFehler?.message}`);
  kundeId = konto.user.id;
  await service.from("profiles").update({ full_name: KUNDE }).eq("id", kundeId);

  // Ein Kursabo macht aus dem Konto einen Kursteilnehmer — damit steht der
  // Name in der Anwesenheitsliste, von der aus geklickt wird.
  const { data: abo, error: aboFehler } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: kursId,
      status: "active",
      name: `E2E100 Kursabo ${stempel}`,
      price: 75,
      cycle_anchor_date: "2026-01-07",
    })
    .select("id")
    .single();
  if (aboFehler) throw new Error(`PROJ-100 Abo: ${aboFehler.message}`);
  aboId = abo!.id;
});

test.afterAll(async () => {
  if (aboId) await service.from("subscriptions").delete().eq("id", aboId);
  if (kursId) {
    await service.from("course_schedule").delete().eq("course_id", kursId);
    await service.from("courses").delete().eq("id", kursId);
  }
  if (kundeId) await service.auth.admin.deleteUser(kundeId).catch(() => {});
});

test.describe("PROJ-100: Aus der Anwesenheitsliste und zurück", () => {
  test("nennt den Kurs beim Namen und führt wirklich dorthin zurück", async ({ page }) => {
    await anmelden(page, ADMIN);
    await gehZu(page, `/lehrer/${kursId}`);
    await expect(page.getByRole("heading", { name: KURSNAME })).toBeVisible({ timeout: 30000 });

    // Der Weg hin: über den Namen in der Anwesenheitsliste, nicht über die
    // Adresszeile. Nur so ist belegt, dass der Ursprung mitreist.
    await page.getByRole("link", { name: KUNDE }).click();
    await page.waitForURL(/\/admin\/kunden\//, { timeout: 20000 });

    const weg = rueckweg(page);
    await expect(weg).toBeVisible({ timeout: 20000 });
    await expect(weg).toHaveText(`← Zurück zur Anwesenheit: ${KURSNAME}`);

    // Und der Weg zurück: in dieselbe Anwesenheitsliste, nicht auf die
    // Kundenliste.
    await weg.click();
    await page.waitForURL(new RegExp(`/lehrer/${kursId}`), { timeout: 20000 });
    await expect(page.getByRole("heading", { name: KURSNAME })).toBeVisible({ timeout: 30000 });
  });

  test("lässt „Alle Kunden“ daneben stehen, mit eigenem Namen", async ({ page }) => {
    await anmelden(page, ADMIN);
    await gehZu(page, `/lehrer/${kursId}`);
    await page.getByRole("link", { name: KUNDE }).click();
    await page.waitForURL(/\/admin\/kunden\//, { timeout: 20000 });

    // Zwei Wege, zwei unterschiedliche Namen — zwei Mal „Zurück“ wäre für
    // Tastatur und Screenreader nicht unterscheidbar.
    await expect(rueckweg(page)).toBeVisible({ timeout: 20000 });
    const alle = page.getByRole("link", { name: "Alle Kunden" });
    await expect(alle).toBeVisible();

    // Auf dem Handy (Mobile Safari, 375 px) dürfen die beiden Wege die Seite
    // nicht in die Breite treiben.
    const ueberlauf = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(ueberlauf).toBe(false);

    await alle.click();
    await page.waitForURL(/\/admin\/kunden(\?|$)/, { timeout: 20000 });
    // Die Kundenliste hat keine eigene Überschrift — ihr Suchfeld ist das
    // Merkmal, an dem man sie erkennt.
    await expect(page.getByPlaceholder("Suche nach Name oder E-Mail…")).toBeVisible({
      timeout: 30000,
    });
  });

  test("überlebt das Speichern in der Akte", async ({ page }) => {
    await anmelden(page, ADMIN);
    await gehZu(page, `/lehrer/${kursId}`);
    await page.getByRole("link", { name: KUNDE }).click();
    await page.waitForURL(/\/admin\/kunden\//, { timeout: 20000 });
    await expect(rueckweg(page)).toBeVisible({ timeout: 20000 });

    // Speichern lädt die Seite nach (revalidatePath). Der Ursprung steht in
    // der Adresse und muss das überstehen — sonst wäre der Rückweg genau
    // dann weg, wenn man etwas getan hat.
    await page.getByRole("button", { name: "Speichern" }).first().click();
    await page.waitForTimeout(2500);

    await expect(rueckweg(page)).toHaveText(`← Zurück zur Anwesenheit: ${KURSNAME}`);
  });
});

test.describe("PROJ-100: Aus der Kundenliste", () => {
  test("zeigt genau einen Rückweg, und der Filter kommt mit zurück", async ({ page }) => {
    await anmelden(page, ADMIN);
    await gehZu(page, `/admin/kunden?q=${encodeURIComponent(KUNDE)}`);
    await page.getByRole("link", { name: KUNDE }).click();
    await page.waitForURL(/\/admin\/kunden\//, { timeout: 20000 });

    // Die Kundenliste ist der Standardweg. Sie bekommt keinen zweiten Link
    // auf dasselbe Ziel — aber ihren Filter zurück.
    await expect(rueckweg(page)).toHaveText("← Zurück zu Kunden");
    await expect(page.getByRole("link", { name: "Alle Kunden" })).toHaveCount(0);

    await rueckweg(page).click();
    await page.waitForURL(/\/admin\/kunden\?/, { timeout: 20000 });
    expect(new URL(page.url()).searchParams.get("q")).toBe(KUNDE);
  });
});

test.describe("PROJ-100: Was nicht passieren darf", () => {
  test("folgt keinem fremden Ziel aus der Adresse", async ({ page }) => {
    await anmelden(page, ADMIN);

    // Hier ist der Sprung in die Adresszeile der Punkt: So käme der Angriff.
    for (const fremd of ["https://example.com/pwned", "//example.com", "/\\example.com"]) {
      await gehZu(page, `/admin/kunden/${kundeId}?von=${encodeURIComponent(fremd)}`);
      const weg = rueckweg(page);
      await expect(weg).toHaveText("← Zurück zu Kunden", { timeout: 20000 });
      await expect(weg).toHaveAttribute("href", "/admin/kunden");
    }
  });

  test("erfindet keinen Namen für einen unbekannten Pfad", async ({ page }) => {
    await anmelden(page, ADMIN);
    await gehZu(page, `/admin/kunden/${kundeId}?von=%2Fadmin%2Fferien`);

    // Sicher, aber ohne Namen in der Tabelle: dann der gewohnte Weg statt
    // eines Links, der „Zurück zu /admin/ferien“ heißt.
    await expect(rueckweg(page)).toHaveText("← Zurück zu Kunden", { timeout: 20000 });
    await expect(page.getByRole("link", { name: "Alle Kunden" })).toHaveCount(0);
  });

  test("zeigt ohne Ursprung den gewohnten Rückweg", async ({ page }) => {
    await anmelden(page, ADMIN);
    await gehZu(page, `/admin/kunden/${kundeId}`);
    await expect(rueckweg(page)).toHaveText("← Zurück zu Kunden", { timeout: 20000 });
  });
});
