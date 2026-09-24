import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { gehZu } from "./navigation";
import { ladeTestUmgebung } from "./env";
import { zweiteStufeErledigen } from "./zweite-stufe";

try {
  ladeTestUmgebung();
} catch {
  // Schon geladen — unkritisch.
}

/**
 * PROJ-69: Was der Kunde sieht, bevor sein Platz gilt.
 *
 * Die Regel selbst steht im Datenbanktest. Hier geht es um das, was der
 * gemeldete Fall wirklich zeigte: eine Kachel mit einem Eincheck-Knopf für
 * einen Kurs, der erst im nächsten Monat beginnt. Die Datenbank allein hätte
 * den Knopf stehen lassen und erst den Klick abgewiesen.
 */

const KUNDE = { email: "proj69-ui@viennasalsastudio.test", password: "CorrectPassword123!" };
const KURSNAME = `E2E69 Startkurs UI ${Date.now()}`;

let service: SupabaseClient;
let kundeId = "";
let kursId = "";
let aboId = "";

function wienerZeitIn(minuten: number): string {
  return new Date(Date.now() + minuten * 60_000).toLocaleTimeString("de-AT", {
    timeZone: "Europe/Vienna",
    hour12: false,
  });
}

function wienerDatum(versatzTage = 0): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(
    new Date(Date.now() + versatzTage * 24 * 3_600_000)
  );
}

function restDesTages(): number {
  const wien = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Vienna" }));
  return 24 - wien.getHours() - wien.getMinutes() / 60;
}

function heutigerWochentag(): number {
  const wien = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Vienna" });
  const tag = new Date(`${wien}T12:00:00Z`).getUTCDay();
  return (tag + 6) % 7;
}

test.beforeAll(async () => {
  // Die Kachel zeigt nur Stunden, die heute noch kommen oder laufen, und eine
  // Endzeit nach Mitternacht nimmt der Stundenplan nicht an. Gebraucht werden
  // also gut 40 Minuten Tagesrest — nicht mehr.
  test.skip(
    restDesTages() < 0.8,
    `Die Prüfung braucht eine Kursstunde, die heute noch beginnt und endet. Aktuell bleiben ${restDesTages().toFixed(1)} h.`
  );

  service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: alle } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = alle?.users.find((u) => u.email === KUNDE.email);
  if (alt) await service.auth.admin.deleteUser(alt.id);
  const { data: konto, error: kontoFehler } = await service.auth.admin.createUser({
    email: KUNDE.email,
    password: KUNDE.password,
    email_confirm: true,
  });
  if (kontoFehler || !konto.user) throw new Error(`PROJ-69 Konto: ${kontoFehler?.message}`);
  kundeId = konto.user.id;
  await service.from("profiles").update({ full_name: "E2E69 UI-Kunde" }).eq("id", kundeId);

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data: kurs, error: kursFehler } = await service
    .from("courses")
    .insert({ name: KURSNAME, room_id: raum!.id, price: 50 })
    .select("id")
    .single();
  if (kursFehler) throw new Error(`PROJ-69 Kurs: ${kursFehler.message}`);
  kursId = kurs!.id;

  const { error: planFehler } = await service.from("course_schedule").insert({
    course_id: kursId,
    weekday: heutigerWochentag(),
    start_time: wienerZeitIn(5),
    end_time: wienerZeitIn(35),
  });
  if (planFehler) throw new Error(`PROJ-69 Stundenplan: ${planFehler.message}`);

  const { data: abo, error: aboFehler } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: kursId,
      status: "active",
      name: "E2E69 UI",
      price: 50,
      cycle_anchor_date: wienerDatum(30), // Einstieg in einem Monat
    })
    .select("id")
    .single();
  if (aboFehler) throw new Error(`PROJ-69 Abo: ${aboFehler.message}`);
  aboId = abo!.id;
});

test.afterAll(async () => {
  if (!service) return;
  if (kursId) {
    await service.from("course_attendance").delete().eq("course_id", kursId);
    await service.from("course_schedule").delete().eq("course_id", kursId);
  }
  if (aboId) await service.from("subscriptions").delete().eq("id", aboId);
  if (kursId) await service.from("courses").delete().eq("id", kursId);
  if (kundeId) await service.auth.admin.deleteUser(kundeId).catch(() => {});
});

async function anmelden(page: Page) {
  await gehZu(page, "/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(KUNDE.email);
  await page.getByLabel("Passwort").fill(KUNDE.password);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await zweiteStufeErledigen(page, KUNDE.email);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

function kachel(page: Page) {
  return page.locator(".rounded-lg.border").filter({ hasText: KURSNAME });
}

test.describe("PROJ-69: Der Kurs erscheint erst ab dem Starttermin", () => {
  test("Vor dem Einstieg steht der Kurs nicht unter „Mein Bereich“", async ({ page }) => {
    await anmelden(page);
    await gehZu(page, "/mein-bereich");
    await page.waitForTimeout(1500);

    await expect(kachel(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ich bin da" })).toHaveCount(0);
  });

  test("Ab dem Starttermin ist er da, samt Eincheck-Knopf", async ({ page }) => {
    await service.from("subscriptions").update({ cycle_anchor_date: wienerDatum(0) }).eq("id", aboId);

    await anmelden(page);
    await gehZu(page, "/mein-bereich");
    await page.waitForTimeout(1500);

    await expect(kachel(page)).toBeVisible();
    await expect(kachel(page).getByRole("button", { name: "Ich bin da" })).toBeVisible();
  });
});
