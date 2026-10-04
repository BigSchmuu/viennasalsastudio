import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { gehZu } from "./navigation";
import { ladeTestUmgebung } from "./env";
import { zweiteStufeErledigen } from "./zweite-stufe";

ladeTestUmgebung();

/**
 * PROJ-72: Die Anwesenheitsliste zeigt die laufende Staffel.
 *
 * Vorher waren es die letzten acht Termine, künftige gab es nicht. Geprüft wird
 * deshalb genau das Neue: vier Termine zu sehen, frühere und spätere auf Klick —
 * und dass an den Rändern des Kurses Schluss ist.
 */

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const KENNUNG = `E2E72-${Date.now()}`;

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test.use({ locale: "de-DE" });

let kursId = "";

function wienerDatum(versatzTage: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(
    new Date(Date.now() + versatzTage * 24 * 3_600_000)
  );
}

function heutigerWochentag(): number {
  const wien = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Vienna" });
  const tag = new Date(`${wien}T12:00:00Z`).getUTCDay();
  return (tag + 6) % 7;
}

test.beforeAll(async () => {
  const { data: raum } = await svc.from("rooms").select("id").limit(1).single();

  // Kursbeginn vor zwölf Wochen: Damit gibt es drei vollständige Staffeln in
  // der Vergangenheit und — ohne Kursende — weitere in der Zukunft.
  const { data: kurs, error } = await svc
    .from("courses")
    .insert({
      name: `${KENNUNG} Staffelkurs`,
      room_id: raum!.id,
      price: 50,
      runs_from: wienerDatum(-84),
    })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-72 Kurs: ${error.message}`);
  kursId = kurs!.id;

  const { error: planFehler } = await svc.from("course_schedule").insert({
    course_id: kursId,
    weekday: heutigerWochentag(),
    start_time: "18:00",
    end_time: "19:00",
  });
  if (planFehler) throw new Error(`PROJ-72 Stundenplan: ${planFehler.message}`);
});

test.afterAll(async () => {
  if (!kursId) return;
  await svc.from("course_attendance").delete().eq("course_id", kursId);
  await svc.from("course_session_notes").delete().eq("course_id", kursId);
  await svc.from("course_schedule").delete().eq("course_id", kursId);
  await svc.from("courses").delete().eq("id", kursId);
});

async function anmelden(page: Page) {
  await gehZu(page, "/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(ADMIN.email);
  await page.getByLabel("Passwort").fill(ADMIN.password);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await zweiteStufeErledigen(page, ADMIN.email);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

function terminSpalten(page: Page) {
  return page.locator("thead tr th").filter({ hasNotText: "Kursteilnehmer" });
}

test.describe("PROJ-72: Anwesenheitsliste in Staffeln", () => {
  test("Zeigt die laufende Staffel: vier Termine", async ({ page }) => {
    await anmelden(page);
    await gehZu(page, `/lehrer/${kursId}`);
    await page.waitForTimeout(1500);

    await expect(terminSpalten(page)).toHaveCount(4);
    // Heute ist Kurstag (der Stundenplan steht auf dem heutigen Wochentag),
    // also gehört der heutige Termin dazu.
    await expect(page.getByText("Heute")).toBeVisible();
  });

  test("„Frühere Termine“ holt die Staffel davor", async ({ page }) => {
    await anmelden(page);
    await gehZu(page, `/lehrer/${kursId}`);
    await page.waitForTimeout(1500);

    await page.getByRole("button", { name: /Frühere Termine/ }).click();
    await expect(terminSpalten(page)).toHaveCount(8, { timeout: 20000 });

    // Die Reihenfolge bleibt chronologisch: Die nachgeladenen Termine stehen
    // links, nicht angehängt.
    const texte = await terminSpalten(page).locator("span").allInnerTexts();
    const alsZahl = texte
      .map((t) => t.match(/(\d{2})\.(\d{2})\./))
      .filter(Boolean)
      .map((m) => Number(m![2]) * 100 + Number(m![1]));
    for (let i = 1; i < alsZahl.length; i++) {
      // Innerhalb von acht Wochen gibt es höchstens einen Monatswechsel und
      // keinen Jahreswechsel — der Vergleich trägt.
      expect(alsZahl[i]).toBeGreaterThan(alsZahl[i - 1]);
    }
  });

  test("„Spätere Termine“ holt die Staffel danach", async ({ page }) => {
    // Den Knopf gab es vorher überhaupt nicht: Künftige Termine kannte die
    // Liste nicht.
    await anmelden(page);
    await gehZu(page, `/lehrer/${kursId}`);
    await page.waitForTimeout(1500);

    await page.getByRole("button", { name: /Spätere Termine/ }).click();
    await expect(terminSpalten(page)).toHaveCount(8, { timeout: 20000 });
  });

  test("Am Kursanfang ist mit „Frühere Termine“ Schluss", async ({ page }) => {
    await anmelden(page);
    await gehZu(page, `/lehrer/${kursId}`);
    await page.waitForTimeout(1500);

    const frueher = page.getByRole("button", { name: /Frühere Termine/ });
    // Drei Staffeln liegen zurück; nach drei Klicks ist der Kursbeginn erreicht.
    for (let i = 0; i < 3; i++) {
      if (await frueher.isDisabled()) break;
      await frueher.click();
      await page.waitForTimeout(2000);
    }
    await expect(frueher).toBeDisabled();
  });
});
