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

// Bewusst ohne die Wörter „Probestunde", „Drop-In" oder „Gast" im Namen: Sonst
// trifft eine Prüfung auf die Art auch den Namen daneben.
const NAMEN = {
  probe: "E2E74 Paula Neuling",
  drop: "E2E74 Dieter Einzel",
  gast: "E2E74 Gustav Besuch",
  vorwoche: "E2E74 Volker Vorwoche",
  abo: "E2E74 Agnes Stammkraft",
};

const konten: Record<keyof typeof NAMEN, string> = {
  probe: "",
  drop: "",
  gast: "",
  vorwoche: "",
  abo: "",
};

let kursId = "";
let aboId = "";
let kursName = "";

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
  const mail = `proj74-${schluessel}@viennasalsastudio.test`;
  const { data: alle } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = alle?.users.find((u) => u.email === mail);
  if (alt) await service.auth.admin.deleteUser(alt.id);
  const { data, error } = await service.auth.admin.createUser({
    email: mail,
    password: "CorrectPassword123!",
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-74 Konto ${mail}: ${error?.message}`);
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

/**
 * Den Weg gehen, nicht springen: über „Meine Kurse" zur Kursseite. Dass die
 * Seite unter ihrer Adresse erreichbar ist, belegt nicht, dass eine Lehrkraft
 * sie auch findet.
 */
async function zurKursseite(page: Page) {
  await gehZu(page, "/lehrer");
  await page.waitForTimeout(800);
  await page.getByRole("link", { name: new RegExp(kursName) }).first().click();
  await page.waitForURL(new RegExp(`/lehrer/${kursId}`), { timeout: 20000 });
  await page.waitForTimeout(1200);
}

/**
 * Der Knopf im Spaltenkopf, der den Termin wählt.
 *
 * Nur Tag und Monat, nicht die ganze Beschriftung: WebKit setzt bei de-AT kein
 * Komma hinter den Wochentag („Mo. 28.09."), Node und Chromium schon
 * („Mo., 28.09."). Ein nachgerechneter Text passte deshalb nur im einen Browser.
 *
 * Und nur im Kopf der Tabelle: Die Anwesenheitszelle trägt dasselbe Datum in
 * ihrer Beschriftung („Anwesenheit für … am … markieren").
 */
function datumsKnopf(page: Page, datum: string) {
  const [, monat, tag] = datum.split("-");
  return matrix(page)
    .locator("thead")
    .getByRole("button", { name: new RegExp(`${tag}\\.${monat}\\.`) });
}

function matrix(page: Page) {
  return page
    .locator("table")
    .filter({ has: page.getByRole("columnheader", { name: "Kursteilnehmer" }) });
}

function extraListe(page: Page) {
  return page.locator("section").filter({
    has: page.getByRole("heading", { name: /Probestunden, Drop-Ins/ }),
  });
}

test.beforeAll(async () => {
  test.setTimeout(180000);

  for (const schluessel of Object.keys(NAMEN) as (keyof typeof NAMEN)[]) {
    konten[schluessel] = await kontoAnlegen(schluessel);
  }

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  kursName = `E2E74 Gästekurs ${Date.now()}`;
  const { data: kurs, error: kursFehler } = await service
    .from("courses")
    .insert({ name: kursName, room_id: raum!.id, price: 50, role_query_enabled: true })
    .select("id")
    .single();
  if (kursFehler) throw new Error(`PROJ-74 Kurs: ${kursFehler.message}`);
  kursId = kurs!.id;

  // Wochentag wie heute, damit es eine „Heute"-Spalte gibt — und die Vorwoche
  // liegt auf demselben Wochentag, also in derselben Staffel.
  const { error: planFehler } = await service.from("course_schedule").insert({
    course_id: kursId,
    weekday: heutigerWochentag(),
    start_time: "08:00:00",
    end_time: "09:00:00",
  });
  if (planFehler) throw new Error(`PROJ-74 Stundenplan: ${planFehler.message}`);

  // Das Verwaltungskonto als Lehrkraft eintragen, sonst steht der Kurs nicht
  // unter „Meine Kurse".
  const { data: adminKonto } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const adminId = adminKonto?.users.find((u) => u.email === ADMIN.email)?.id;
  if (!adminId) throw new Error("PROJ-74: Verwaltungskonto nicht gefunden");
  await service.from("course_teachers").insert({ course_id: kursId, teacher_id: adminId });

  const { data: slot, error: slotFehler } = await service
    .from("guest_slots")
    .insert({
      course_id: kursId,
      occurrence_date: HEUTE,
      dance_role: "follower",
      seats: 1,
      min_level: "intermediate",
    })
    .select("id")
    .single();
  if (slotFehler) throw new Error(`PROJ-74 Ausschreibung: ${slotFehler.message}`);

  const { error: buchungsFehler } = await service.from("course_bookings").insert([
    { course_id: kursId, customer_id: konten.probe, type: "trial", status: "confirmed", chosen_date: HEUTE, dance_role: "follower" },
    { course_id: kursId, customer_id: konten.drop, type: "dropin", status: "confirmed", chosen_date: HEUTE, dance_role: "leader" },
    { course_id: kursId, customer_id: konten.gast, type: "guest", status: "confirmed", chosen_date: HEUTE, guest_slot_id: slot!.id, price: 0, dance_role: "follower" },
    { course_id: kursId, customer_id: konten.vorwoche, type: "dropin", status: "confirmed", chosen_date: VORWOCHE, dance_role: "leader" },
  ]);
  if (buchungsFehler) throw new Error(`PROJ-74 Buchungen: ${buchungsFehler.message}`);

  const { data: abo, error: aboFehler } = await service
    .from("subscriptions")
    .insert({
      customer_id: konten.abo,
      course_id: kursId,
      status: "active",
      name: "E2E74",
      price: 50,
      cycle_anchor_date: wienerDatum(-30),
    })
    .select("id")
    .single();
  if (aboFehler) throw new Error(`PROJ-74 Abo: ${aboFehler.message}`);
  aboId = abo!.id;
});

test.afterAll(async () => {
  if (kursId) {
    await service.from("course_attendance").delete().eq("course_id", kursId);
    await service.from("course_bookings").delete().eq("course_id", kursId);
    await service.from("guest_slots").delete().eq("course_id", kursId);
    await service.from("course_teachers").delete().eq("course_id", kursId);
    await service.from("course_schedule").delete().eq("course_id", kursId);
  }
  if (aboId) await service.from("subscriptions").delete().eq("id", aboId);
  if (kursId) await service.from("courses").delete().eq("id", kursId);
  for (const id of Object.values(konten)) {
    if (id) await service.auth.admin.deleteUser(id).catch(() => {});
  }
});

test.describe("PROJ-74: Eigene Liste für Probestunden, Drop-Ins und Gäste", () => {
  test("Die Liste zeigt die Gäste des heutigen Termins mit ihrer Art", async ({ page }) => {
    await login(page);
    await zurKursseite(page);

    const liste = extraListe(page);
    await expect(liste).toBeVisible();

    // Die Art steht in derselben Zeile wie der Name — das ist der Punkt der
    // Liste. „Paula steht drin" und „irgendwo steht Probestunde" wäre es nicht.
    for (const [name, art] of [
      [NAMEN.probe, "Probestunde"],
      [NAMEN.drop, "Drop-In"],
      [NAMEN.gast, "Gast"],
    ] as const) {
      const zeile = liste.getByRole("row", { name: new RegExp(name) });
      await expect(zeile, `${name} fehlt in der Liste`).toBeVisible();
      await expect(zeile.getByText(art, { exact: true })).toBeVisible();
    }

    // Nur die von heute: Der Drop-In der Vorwoche gehört nicht dazu.
    await expect(liste.getByText(NAMEN.vorwoche)).toHaveCount(0);
  });

  test("Die Anwesenheitsliste zeigt nur noch die Kursteilnehmer", async ({ page }) => {
    await login(page);
    await zurKursseite(page);

    await expect(matrix(page).getByText(NAMEN.abo)).toBeVisible();
    for (const name of [NAMEN.probe, NAMEN.drop, NAMEN.gast, NAMEN.vorwoche]) {
      await expect(matrix(page).getByText(name)).toHaveCount(0);
    }
  });

  test("Ein Klick auf ein anderes Datum zeigt die Gäste dieses Termins", async ({ page }) => {
    await login(page);
    await zurKursseite(page);

    await datumsKnopf(page, VORWOCHE).click();
    await page.waitForTimeout(600);

    const liste = extraListe(page);
    await expect(liste.getByText(NAMEN.vorwoche)).toBeVisible();
    await expect(liste.getByText(NAMEN.probe)).toHaveCount(0);
  });

  test("Ein Häkchen in der Liste bleibt nach dem Neuladen stehen", async ({ page }) => {
    await login(page);
    await zurKursseite(page);

    const liste = extraListe(page);
    await liste.getByRole("button", { name: `${NAMEN.drop} als anwesend markieren` }).click();
    await page.waitForTimeout(2500);

    await page.reload();
    await page.waitForTimeout(1500);

    // Der Knopf ist jetzt der hervorgehobene — die Markierung liegt in der
    // Datenbank, nicht nur im Browser.
    const knopf = extraListe(page).getByRole("button", {
      name: `${NAMEN.drop} als anwesend markieren`,
    });
    await expect(knopf).toBeVisible();
    await expect(knopf).toHaveClass(/bg-primary/);
  });

  test("Ein Termin ohne Gäste sagt das, statt leer zu bleiben", async ({ page }) => {
    await login(page);
    await zurKursseite(page);

    // Zwei Wochen zurück: dort ist niemand gebucht.
    await datumsKnopf(page, wienerDatum(-14)).click();
    await page.waitForTimeout(600);

    await expect(
      extraListe(page).getByText(/ist niemand als Probestunde, Drop-In oder Gast gebucht/)
    ).toBeVisible();
  });
});
