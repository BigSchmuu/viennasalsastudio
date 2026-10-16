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

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };

const NAMEN = {
  da: "E2E89 Anna Anwesend",
  weg: "E2E89 Bea Abgemeldet",
  offen: "E2E89 Carl Offen",
  gast: "E2E89 Gustl Einzel",
};

const konten: Record<keyof typeof NAMEN, string> = { da: "", weg: "", offen: "", gast: "" };

let kursId = "";
let kursName = "";
let adminId = "";
const abos: string[] = [];

function wienerDatum(versatzTage = 0): string {
  const ziel = new Date(Date.now() + versatzTage * 24 * 3_600_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(ziel);
}

function heutigerWochentag(): number {
  const wien = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Vienna" });
  const tag = new Date(`${wien}T12:00:00Z`).getUTCDay();
  return (tag + 6) % 7;
}

const HEUTE = wienerDatum(0);
const VORWOCHE = wienerDatum(-7);

async function kontoAnlegen(schluessel: keyof typeof NAMEN): Promise<string> {
  const mail = `proj89-${schluessel}@viennasalsastudio.test`;
  const { data: alle } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = alle?.users.find((u) => u.email === mail);
  if (alt) await service.auth.admin.deleteUser(alt.id);
  const { data, error } = await service.auth.admin.createUser({
    email: mail,
    password: "CorrectPassword123!",
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-89 Konto ${mail}: ${error?.message}`);
  await service.from("profiles").update({ full_name: NAMEN[schluessel] }).eq("id", data.user.id);
  return data.user.id;
}

async function login(page: Page) {
  await gehZu(page, "/login");
  // Erst hydrieren lassen — siehe docs/troubleshooting-tests.md.
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(ADMIN.email);
  await page.getByLabel("Passwort").fill(ADMIN.password);
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await zweiteStufeErledigen(page, ADMIN.email);
  await page.waitForURL(/\/(admin|profil)$/, { timeout: 20000 });
}

/** Den Weg gehen, nicht springen: über „Meine Kurse" zur Kursseite. */
async function zurKursseite(page: Page) {
  await gehZu(page, "/lehrer");
  await page.waitForTimeout(800);
  await page.getByRole("link", { name: new RegExp(kursName) }).first().click();
  await page.waitForURL(new RegExp(`/lehrer/${kursId}`), { timeout: 20000 });
  await page.waitForTimeout(1200);
}

/** Die Zeile über der Liste — das ist der ganze Gegenstand dieser Prüfung. */
function standZeile(page: Page) {
  return page.getByText(/von \d+ eingecheckt/);
}

function matrix(page: Page) {
  return page
    .locator("table")
    .filter({ has: page.getByRole("columnheader", { name: "Kursteilnehmer" }) });
}

/**
 * Der Knopf im Spaltenkopf. Nur Tag und Monat: WebKit setzt bei de-AT kein
 * Komma hinter den Wochentag, Chromium schon (siehe PROJ-74).
 */
function datumsKnopf(page: Page, datum: string) {
  const [, monat, tag] = datum.split("-");
  return matrix(page)
    .locator("thead")
    .getByRole("button", { name: new RegExp(`${tag}\\.${monat}\\.`) });
}

function anwesenheitsZelle(page: Page, name: string, datum: string) {
  const [, monat, tag] = datum.split("-");
  return matrix(page).getByRole("button", {
    name: new RegExp(`Anwesenheit für ${name} am .*${tag}\\.${monat}\\.`),
  });
}

test.beforeAll(async () => {
  test.setTimeout(180000);

  for (const schluessel of Object.keys(NAMEN) as (keyof typeof NAMEN)[]) {
    konten[schluessel] = await kontoAnlegen(schluessel);
  }

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  kursName = `E2E89 Standkurs ${Date.now()}`;
  const { data: kurs, error: kursFehler } = await service
    .from("courses")
    .insert({ name: kursName, room_id: raum!.id, price: 50 })
    .select("id")
    .single();
  if (kursFehler) throw new Error(`PROJ-89 Kurs: ${kursFehler.message}`);
  kursId = kurs!.id;

  // Wochentag wie heute — damit es eine Spalte für heute gibt und die Vorwoche
  // in derselben Staffel liegt.
  const { error: planFehler } = await service.from("course_schedule").insert({
    course_id: kursId,
    weekday: heutigerWochentag(),
    start_time: "08:00:00",
    end_time: "09:00:00",
  });
  if (planFehler) throw new Error(`PROJ-89 Stundenplan: ${planFehler.message}`);

  const { data: adminKonto } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  adminId = adminKonto?.users.find((u) => u.email === ADMIN.email)?.id ?? "";
  if (!adminId) throw new Error("PROJ-89: Verwaltungskonto nicht gefunden");
  await service.from("course_teachers").insert({ course_id: kursId, teacher_id: adminId });

  // Drei Kursteilnehmer — der Nenner. `cycle_anchor_date` weit zurück, damit
  // der Platz auch in der Spalte der Vorwoche schon galt (PROJ-69).
  for (const schluessel of ["da", "weg", "offen"] as const) {
    const { data: abo, error } = await service
      .from("subscriptions")
      .insert({
        customer_id: konten[schluessel],
        course_id: kursId,
        status: "active",
        name: "E2E89",
        price: 50,
        cycle_anchor_date: wienerDatum(-30),
      })
      .select("id")
      .single();
    if (error) throw new Error(`PROJ-89 Abo ${schluessel}: ${error.message}`);
    abos.push(abo!.id);
  }

  // Ein Drop-in von heute. Er ist anwesend, gehört aber nicht in den Nenner.
  const { error: buchungsFehler } = await service.from("course_bookings").insert({
    course_id: kursId,
    customer_id: konten.gast,
    type: "dropin",
    status: "confirmed",
    chosen_date: HEUTE,
    dance_role: "leader",
  });
  if (buchungsFehler) throw new Error(`PROJ-89 Buchung: ${buchungsFehler.message}`);

  const { error: anwesenheitsFehler } = await service.from("course_attendance").insert([
    { course_id: kursId, customer_id: konten.da, occurrence_date: HEUTE, status: "present", marked_by: adminId },
    { course_id: kursId, customer_id: konten.weg, occurrence_date: HEUTE, status: "absent", marked_by: adminId },
    { course_id: kursId, customer_id: konten.gast, occurrence_date: HEUTE, status: "present", marked_by: adminId },
  ]);
  if (anwesenheitsFehler) throw new Error(`PROJ-89 Anwesenheit: ${anwesenheitsFehler.message}`);
});

test.afterAll(async () => {
  if (kursId) {
    await service.from("course_attendance").delete().eq("course_id", kursId);
    await service.from("course_bookings").delete().eq("course_id", kursId);
    await service.from("course_teachers").delete().eq("course_id", kursId);
    await service.from("course_schedule").delete().eq("course_id", kursId);
  }
  if (abos.length > 0) await service.from("subscriptions").delete().in("id", abos);
  if (kursId) await service.from("courses").delete().eq("id", kursId);
  for (const id of Object.values(konten)) {
    if (id) await service.auth.admin.deleteUser(id).catch(() => {});
  }
});

test.describe("PROJ-89: Der Eincheck-Stand über der Anwesenheitsliste", () => {
  test("Über der Liste steht, wie viele von wie vielen eingecheckt sind", async ({ page }) => {
    await login(page);
    await zurKursseite(page);

    // Einer von drei Kursteilnehmern ist anwesend. Der Gast gehört nicht dazu,
    // sonst stünde hier „2 von 4".
    await expect(standZeile(page)).toContainText("1 von 3 eingecheckt");
  });

  test("Abgemeldete zählen nicht als eingecheckt, stehen aber daneben", async ({ page }) => {
    await login(page);
    await zurKursseite(page);

    await expect(standZeile(page)).toContainText("1 abwesend gemeldet");
  });

  test("Ein Gast steht getrennt und nicht im Nenner", async ({ page }) => {
    await login(page);
    await zurKursseite(page);

    const zeile = standZeile(page);
    await expect(zeile).toContainText("+ 1 Gast");
    await expect(zeile).not.toContainText("von 4 eingecheckt");
  });

  test("Ein anderer Termin rechnet die Zahl um", async ({ page }) => {
    await login(page);
    await zurKursseite(page);

    await datumsKnopf(page, VORWOCHE).click();
    await page.waitForTimeout(600);

    // In der Vorwoche ist für niemanden etwas erfasst — und trotzdem steht der
    // Kurs da, statt dass die Zeile verschwindet.
    await expect(standZeile(page)).toContainText("0 von 3 eingecheckt");
  });

  test("Ein Häkchen ändert die Zahl sofort, ohne Neuladen", async ({ page }) => {
    await login(page);
    await zurKursseite(page);

    await anwesenheitsZelle(page, NAMEN.offen, HEUTE).click();
    await page.getByRole("button", { name: "Anwesend", exact: true }).click();
    await page.waitForTimeout(2500);

    await expect(standZeile(page)).toContainText("2 von 3 eingecheckt");
  });
});
