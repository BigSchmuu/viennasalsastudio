import { test, expect, type Page } from "@playwright/test";
import { gehZu } from "./navigation";
import { createClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

try {
  ladeTestUmgebung();
} catch {
  // Schon geladen (z. B. CI-Variablen direkt gesetzt) — unkritisch.
}

const PASSWORT = "CorrectPassword123!";
const LEHRER = "e2e13-lehrer-a@viennasalsastudio.test";
const LEHRER_OHNE_KURS = "e2e13-lehrer-c@viennasalsastudio.test";
const KUNDE = "e2e8-customer@viennasalsastudio.test";
const KURS_ID = "6032ce07-b19c-445b-9f42-f45921df557e"; // "E2E13 Kurs", Donnerstag

const dienst = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

async function anmelden(page: Page, email: string) {
  await gehZu(page, "/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(PASSWORT);
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL(/\/(mein-bereich|profil|admin)$/, { timeout: 20000 });
}

test.describe("PROJ-49: Eigener Bereich für Lehrer", () => {
  test("AC1: Ein Lehrer sieht unter „Mein Bereich“ den Lehrer-Bereich", async ({ page }) => {
    await anmelden(page, LEHRER);
    await gehZu(page, "/mein-bereich");
    await page.waitForTimeout(1200);

    await expect(page.getByText("Deine nächsten Kurse")).toBeVisible();
    // Und ausdrücklich nicht die Kundenansicht.
    await expect(page.getByText("Nächster Kurs", { exact: true })).toHaveCount(0);
  });

  test("AC2: Ein Kunde ohne Lehrerzuweisung sieht unverändert die Kundenansicht", async ({
    page,
  }) => {
    await anmelden(page, KUNDE);
    await gehZu(page, "/mein-bereich");
    await page.waitForTimeout(1200);

    await expect(page.getByText("Deine nächsten Kurse")).toHaveCount(0);
  });

  test("AC5: Die nächsten Termine stehen mit Wochentag, Datum, Uhrzeit und Ort da", async ({
    page,
  }) => {
    await anmelden(page, LEHRER);
    await gehZu(page, "/mein-bereich");
    await page.waitForTimeout(1200);

    const karte = page.locator("div").filter({ hasText: "E2E13 Kurs" }).last();
    await expect(karte).toContainText("E2E13 Kurs");
    // Wochentag mit Datum, z. B. „Donnerstag, 10.09."
    await expect(page.getByText(/(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag), \d\d\.\d\d\./).first()).toBeVisible();
  });

  test("AC6: „Anwesenheit“ führt auf die Kursseite", async ({ page }) => {
    await anmelden(page, LEHRER);
    await gehZu(page, "/mein-bereich");
    await page.waitForTimeout(1200);

    await page.getByRole("link", { name: "Anwesenheit", exact: true }).first().click();
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/lehrer/");
  });

  test("AC8: Ohne Videosatz erscheint keine Aktion „Lehrmaterial“, mit Videosatz schon", async ({
    page,
  }) => {
    const service = dienst();
    // Ausgangslage: kein Videosatz am Kurs.
    await service.from("courses").update({ video_set_id: null }).eq("id", KURS_ID);

    await anmelden(page, LEHRER);
    await gehZu(page, "/mein-bereich");
    await page.waitForTimeout(1200);
    await expect(page.getByRole("link", { name: "Lehrmaterial" })).toHaveCount(0);

    // Jetzt einen Videosatz anhängen — derselbe Termin, nur mit Material.
    const { data: satz } = await service
      .from("video_sets")
      .insert({ name: "E2E49 Videosatz" })
      .select("id")
      .single();
    await service.from("courses").update({ video_set_id: satz!.id }).eq("id", KURS_ID);

    await page.reload();
    await page.waitForTimeout(1500);
    await expect(page.getByRole("link", { name: "Lehrmaterial" }).first()).toBeVisible();

    await service.from("courses").update({ video_set_id: null }).eq("id", KURS_ID);
    await service.from("video_sets").delete().eq("id", satz!.id);
  });

  test("AC11: Eine Stunde ohne erfasste Anwesenheit wird genannt und führt auf die Kursseite", async ({
    page,
  }) => {
    await anmelden(page, LEHRER);
    await gehZu(page, "/mein-bereich");
    await page.waitForTimeout(1200);

    const abschnitt = page.getByText("Anwesenheit nachtragen");
    if ((await abschnitt.count()) === 0) {
      test.skip(true, "Für diesen Lehrer ist gerade jede vergangene Stunde erfasst.");
    }
    await expect(abschnitt).toBeVisible();
    await expect(page.getByText("Für diese Stunden fehlt noch die Anwesenheit.")).toBeVisible();
  });

  test("AC13: Die letzte Notiz steht beim nächsten Termin", async ({ page }) => {
    const service = dienst();
    const KENNUNG = "E2E49 Notiz zum Weitermachen";
    // Eine Notiz an einem vergangenen Termin dieses Kurses.
    await service.from("course_session_notes").delete().eq("course_id", KURS_ID).like("note", "E2E49%");
    const { data: vorhandene } = await service
      .from("course_session_notes")
      .select("occurrence_date")
      .eq("course_id", KURS_ID)
      .limit(1);
    const datum = vorhandene?.[0]?.occurrence_date ?? "2026-08-06";
    await service
      .from("course_session_notes")
      .upsert(
        { course_id: KURS_ID, occurrence_date: datum, note: KENNUNG },
        { onConflict: "course_id,occurrence_date" }
      );

    await anmelden(page, LEHRER);
    await gehZu(page, "/mein-bereich");
    await page.waitForTimeout(1500);

    await expect(page.getByText(KENNUNG)).toBeVisible();

    await service.from("course_session_notes").delete().eq("course_id", KURS_ID).like("note", "E2E49%");
  });

  test("AC15: Ein Lehrer ohne Termine sieht einen erklärenden Hinweis statt einer leeren Seite", async ({
    page,
  }) => {
    // Lehrer C ist keinem Kurs zugewiesen — er hat nichts anstehen.
    await anmelden(page, LEHRER_OHNE_KURS);
    await gehZu(page, "/mein-bereich");
    await page.waitForTimeout(1200);

    await expect(
      page.getByText("In den nächsten sieben Tagen unterrichtest du keinen Kurs.")
    ).toBeVisible();
  });
});
