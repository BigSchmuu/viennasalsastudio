import { test, expect } from "@playwright/test";
import { gehZu } from "./navigation";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

try {
  ladeTestUmgebung();
} catch {
  // Schon geladen — unkritisch.
}

/**
 * Eigene Kurse und eigene Ferien.
 *
 * Diese Suite verändert Zeiträume und legt studioweite Ferien an — beides
 * wirkt auf **jeden** Kurstermin im ganzen Projekt. Geteilte Fixtures wären
 * hier besonders gefährlich: Ein liegengebliebener Ferienzeitraum ließe in
 * jeder anderen Suite Termine ausfallen, die stattfinden sollten.
 */
const KURS_LAEUFT = "E2E51 Kurs laeuft";
const KURS_BEGINNT_BALD = "E2E51 Kurs beginnt bald";
const KURS_BEGINNT_SPAETER = "E2E51 Kurs beginnt spaeter";
const KURS_VORBEI = "E2E51 Kurs vorbei";
const FERIEN_NAME = "E2E51 Ferien";
const ALLE_NAMEN = [KURS_LAEUFT, KURS_BEGINNT_BALD, KURS_BEGINNT_SPAETER, KURS_VORBEI];

const dienst = (): SupabaseClient =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

function tagePlus(tage: number): string {
  const d = new Date();
  d.setDate(d.getDate() + tage);
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Vienna" });
}

/** 0 = Montag … 6 = Sonntag — die Konvention des Projekts. */
function wochentagIn(tage: number): number {
  const d = new Date();
  d.setDate(d.getDate() + tage);
  return (d.getDay() + 6) % 7;
}

const WOCHENTAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

let wochentag = 0;

test.beforeAll(async () => {
  const service = dienst();
  await service.from("courses").delete().in("name", ALLE_NAMEN);
  await service.from("studio_holidays").delete().eq("name", FERIEN_NAME);

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  if (!raum) throw new Error("PROJ-51: Kein Raum vorhanden");

  // Alle vier auf denselben Wochentag, damit ein Reiter sie zusammen zeigt.
  // Zwei Tage voraus: So liegt der Tag sicher in derselben Woche wie heute und
  // ist noch nicht vorbei.
  wochentag = wochentagIn(2);

  const { data: kurse, error } = await service
    .from("courses")
    .insert([
      { name: KURS_LAEUFT, room_id: raum.id, role_query_enabled: false, runs_until: tagePlus(10) },
      { name: KURS_BEGINNT_BALD, room_id: raum.id, role_query_enabled: false, runs_from: tagePlus(9) },
      { name: KURS_BEGINNT_SPAETER, room_id: raum.id, role_query_enabled: false, runs_from: tagePlus(40) },
      { name: KURS_VORBEI, room_id: raum.id, role_query_enabled: false, runs_until: tagePlus(-1) },
    ])
    .select("id, name");
  if (error) throw new Error(`PROJ-51 Testkurse: ${error.message}`);

  await service.from("course_schedule").insert(
    (kurse ?? []).map((k) => ({
      course_id: k.id,
      weekday: wochentag,
      start_time: "18:00",
      end_time: "19:00",
    }))
  );
});

test.afterAll(async () => {
  const service = dienst();
  await service.from("courses").delete().in("name", ALLE_NAMEN);
  await service.from("studio_holidays").delete().eq("name", FERIEN_NAME);
});

async function oeffneTag(page: import("@playwright/test").Page) {
  await gehZu(page, "/stundenplan");
  await page.waitForTimeout(1800);
  await page.getByRole("tab", { name: new RegExp(WOCHENTAGE[wochentag]) }).click();
  await page.waitForTimeout(800);
}

test.describe("PROJ-51: Kurszeiträume und Ferien im Stundenplan", () => {
  test("AC: Ein laufender Kurs steht im Plan, ein ausgelaufener nicht mehr", async ({ page }) => {
    await oeffneTag(page);
    await expect(page.getByText(KURS_LAEUFT, { exact: true })).toBeVisible();
    // Vorher musste der Betreiber einen ausgelaufenen Kurs von Hand entfernen.
    await expect(page.getByText(KURS_VORBEI, { exact: true })).toHaveCount(0);
  });

  test("AC: Ein Kurs, der bald beginnt, wird mit Startdatum genannt — einer in sechs Wochen nicht", async ({
    page,
  }) => {
    await oeffneTag(page);
    await expect(page.getByText(KURS_BEGINNT_BALD, { exact: true })).toBeVisible();
    await expect(page.getByText(KURS_BEGINNT_SPAETER, { exact: true })).toHaveCount(0);

    // Auf Seitenebene geprüft, nicht auf die Karte eingegrenzt: Der Versuch,
    // die Karte über verschachtelte divs zu greifen, trifft den falschen.
    // Eindeutig ist es trotzdem — nur die Kurse dieser Suite haben überhaupt
    // einen Zeitraum, alle anderen sind unbefristet.
    await expect(page.getByText(/^ab /).first()).toBeVisible();
  });

  test("AC: Bei einem Kurs, der demnächst endet, steht das Enddatum dabei", async ({ page }) => {
    await oeffneTag(page);
    await expect(page.getByText(/^noch bis /).first()).toBeVisible();
  });

  test("AC: Eine vorgemerkte Umwandlung steht beim Kurs und geht dem Ende vor", async ({ page }) => {
    const service = dienst();
    await service
      .from("courses")
      .update({
        pending_name: "E2E51 Fortgeschritten",
        pending_level: "intermediate",
        pending_effective_date: tagePlus(11),
      })
      .eq("name", KURS_LAEUFT);

    try {
      await oeffneTag(page);
      // „Wird zu …" sagt mehr als „endet" — der Kurs hört ja nicht auf.
      await expect(page.getByText(/^ab .*E2E51 Fortgeschritten/)).toBeVisible();
      await expect(page.getByText(/^noch bis /)).toHaveCount(0);
    } finally {
      await service
        .from("courses")
        .update({ pending_name: null, pending_level: null, pending_effective_date: null })
        .eq("name", KURS_LAEUFT);
    }
  });

  test("AC: Ferien stehen als Hinweis über dem Plan", async ({ page }) => {
    const service = dienst();
    await service
      .from("studio_holidays")
      .insert({ name: FERIEN_NAME, starts_on: tagePlus(5), ends_on: tagePlus(8) });

    try {
      await gehZu(page, "/stundenplan");
      await page.waitForTimeout(1800);
      await expect(page.getByText(new RegExp(`${FERIEN_NAME}.*geschlossen`))).toBeVisible();
    } finally {
      await service.from("studio_holidays").delete().eq("name", FERIEN_NAME);
    }
  });
});
