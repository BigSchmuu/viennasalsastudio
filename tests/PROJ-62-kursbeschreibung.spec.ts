import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";
import { gehZu } from "./navigation";
import { zweiteStufeErledigen } from "./zweite-stufe";

ladeTestUmgebung();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ADMIN = { email: "e2e14-admin@viennasalsastudio.test", password: "CorrectPassword123!" };

let service: SupabaseClient;
let kursId: string;
let kursName: string;

const BESCHREIBUNG = "Für alle, die schon sicher Grundschritt tanzen.\n\nZweiter Absatz zum Prüfen.";

test.beforeAll(async () => {
  service = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  // Mit Tanzstil: Ohne ihn besteht der Kurs die Prüfung des Verwaltungsformulars
  // nicht, und das Speichern liefe still ins Leere.
  const { data: stil } = await service.from("dance_styles").select("id").limit(1).single();
  kursName = `E2E62 Beschreibung ${Date.now()}`;
  const { data, error } = await service
    .from("courses")
    .insert({
      name: kursName,
      room_id: raum!.id,
      dance_style_id: stil!.id,
      level: "improver",
      price: 50,
      max_participants: 20,
    })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-62 Kurs: ${error.message}`);
  kursId = data!.id;

  // Ein Termin am heutigen Wochentag: Der Stundenplan zeigt beim Öffnen den
  // laufenden Tag, und ein Kurs am Freitag wäre am Montag schlicht nicht im Bild.
  const wienHeute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Vienna" });
  const heutigerWochentag = (new Date(`${wienHeute}T12:00:00Z`).getUTCDay() + 6) % 7;
  await service.from("course_schedule").insert({
    course_id: kursId,
    weekday: heutigerWochentag,
    start_time: "19:00",
    end_time: "20:00",
  });
});

test.afterAll(async () => {
  await service.from("course_schedule").delete().eq("course_id", kursId);
  await service.from("courses").delete().eq("id", kursId);
});

async function anmeldenAlsAdmin(page: Page) {
  await gehZu(page, "/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(ADMIN.email);
  await page.getByLabel("Passwort").fill(ADMIN.password);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await zweiteStufeErledigen(page, ADMIN.email);
}

test.describe("PROJ-62: Kursbeschreibung und Verlinkung", () => {
  test("Ohne Beschreibung bleibt die Kursseite ohne Lücke", async ({ page }) => {
    await service.from("courses").update({ description: null }).eq("id", kursId);
    await gehZu(page, `/kurse/${kursId}`);

    await expect(page.getByRole("heading", { level: 1, name: kursName })).toBeVisible();
    await expect(page.getByText("Zweiter Absatz zum Prüfen.")).toHaveCount(0);
  });

  test("Eine Beschreibung erscheint samt Absätzen", async ({ page }) => {
    await service.from("courses").update({ description: BESCHREIBUNG }).eq("id", kursId);
    await gehZu(page, `/kurse/${kursId}`);

    await expect(page.getByText("Für alle, die schon sicher Grundschritt tanzen.")).toBeVisible();
    await expect(page.getByText("Zweiter Absatz zum Prüfen.")).toBeVisible();
  });

  test("Nur Leerzeichen gelten als keine Beschreibung", async ({ page }) => {
    await service.from("courses").update({ description: "   \n  " }).eq("id", kursId);
    await gehZu(page, `/kurse/${kursId}`);
    // Die Seite steht, und es entsteht kein leerer Absatz mit Rahmen.
    await expect(page.getByRole("heading", { level: 1, name: kursName })).toBeVisible();
  });

  test("Ein Skript in der Beschreibung wird nicht ausgeführt", async ({ page }) => {
    await service
      .from("courses")
      .update({ description: '<script>window.__boom = true</script>Harmloser Text' })
      .eq("id", kursId);
    await gehZu(page, `/kurse/${kursId}`);

    await expect(page.getByText(/Harmloser Text/)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __boom?: boolean }).__boom)).toBeUndefined();

    await service.from("courses").update({ description: BESCHREIBUNG }).eq("id", kursId);
  });

  test("Vom Stundenplan führt der Kursname auf die Kursseite", async ({ page }) => {
    await gehZu(page, "/stundenplan");
    await page.getByRole("link", { name: kursName }).click();

    await expect(page).toHaveURL(new RegExp(`/kurse/${kursId}`));
    await expect(page.getByRole("heading", { level: 1, name: kursName })).toBeVisible();
  });

  test("Der Admin kann eine Beschreibung eintragen", async ({ page }) => {
    await anmeldenAlsAdmin(page);
    await gehZu(page, "/admin/kurse");

    await page.getByRole("row", { name: new RegExp(kursName) }).getByRole("button", { name: "Bearbeiten" }).click();
    // Im Dialog, nicht auf der Seite: „Speichern" gibt es zweimal.
    const dialog = page.getByRole("dialog");
    const feld = dialog.getByLabel(/Beschreibung/);
    await expect(feld).toBeVisible();
    await feld.fill("Über das Formular eingetragen.");
    // Der Knopf in der Fußzeile des Dialogs: Der Abschnitt zur Kursumwandlung
    // (PROJ-51) bringt einen zweiten „Speichern" mit.
    await dialog.locator("form").first().getByRole("button", { name: "Speichern" }).click();

    // Auf die Wirkung warten, nicht auf das Verschwinden des Dialogs: Was
    // gespeichert wurde, steht in der Datenbank — alles andere ist Beiwerk.
    await expect
      .poll(async () => {
        const { data } = await service.from("courses").select("description").eq("id", kursId).single();
        return data?.description;
      }, { timeout: 20000 })
      .toBe("Über das Formular eingetragen.");
  });
});
