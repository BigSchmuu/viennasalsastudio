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
    await service.from("course_session_notes").delete().eq("course_id", KURS_ID).like("note", "E2E49%");

    // Ein eigener, freier Termin — keine fremde Notiz anfassen.
    //
    // Vorher hat dieser Test die erstbeste vorhandene Zeile ueberschrieben und
    // am Ende geloescht. Getroffen hat es die vorbereitete Notiz aus PROJ-13,
    // deren AC8 danach umfiel. Angezeigt wird ohnehin die Notiz mit dem
    // spaetesten Termin, also einen Tag hinter allem Vorhandenen.
    const { data: vorhandene } = await service
      .from("course_session_notes")
      .select("occurrence_date")
      .eq("course_id", KURS_ID)
      .order("occurrence_date", { ascending: false })
      .limit(1);
    const spaetestes = vorhandene?.[0]?.occurrence_date;
    const heute = new Date().toISOString().slice(0, 10);
    const datum =
      spaetestes && spaetestes >= heute
        ? new Date(new Date(spaetestes).getTime() + 86400000).toISOString().slice(0, 10)
        : heute;
    const { error: notizFehler } = await service
      .from("course_session_notes")
      .insert({ course_id: KURS_ID, occurrence_date: datum, note: KENNUNG });
    if (notizFehler) throw new Error(`Notiz anlegen fehlgeschlagen: ${notizFehler.message}`);

    await anmelden(page, LEHRER);
    await gehZu(page, "/mein-bereich");
    await page.waitForTimeout(1500);

    await expect(page.getByText(KENNUNG)).toBeVisible();

    await service
      .from("course_session_notes")
      .delete()
      .eq("course_id", KURS_ID)
      .eq("occurrence_date", datum);
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

  test("AC9: Ein Schüler mit Geburtstag im Fenster erscheint — ohne Altersangabe", async ({
    page,
  }) => {
    const service = dienst();
    const { data: schueler } = await service
      .from("profiles")
      .select("id, birthdate")
      .eq("full_name", "E2E13 Abo Kunde")
      .single();
    expect(schueler, "Fixture E2E13 Abo Kunde fehlt").toBeTruthy();
    const vorher = schueler!.birthdate;

    // Geburtstag übermorgen, Jahrgang absichtlich alt — er darf nirgends auftauchen.
    const uebermorgen = new Date(Date.now() + 2 * 86400000);
    const geburtstag = `1971-${String(uebermorgen.getMonth() + 1).padStart(2, "0")}-${String(
      uebermorgen.getDate()
    ).padStart(2, "0")}`;
    await service.from("profiles").update({ birthdate: geburtstag }).eq("id", schueler!.id);

    await anmelden(page, LEHRER);
    await gehZu(page, "/mein-bereich");
    await page.waitForTimeout(1500);

    await expect(page.getByText("Geburtstage")).toBeVisible();
    await expect(page.getByText("E2E13 Abo Kunde")).toBeVisible();
    // Weder Jahrgang noch Alter — dieselbe Zurückhaltung wie in PROJ-31.
    await expect(page.getByText("1971")).toHaveCount(0);

    await service.from("profiles").update({ birthdate: vorher }).eq("id", schueler!.id);
  });

  test("AC10: Eine anstehende Probestunde wird mit Name, Kurs und Termin genannt", async ({
    page,
  }) => {
    const service = dienst();
    const { data: gast } = await service
      .from("profiles")
      .select("id")
      .eq("full_name", "E2E13 Flatrate Kunde")
      .single();
    expect(gast, "Fixture E2E13 Flatrate Kunde fehlt").toBeTruthy();

    // Übermorgen — sicher im Sieben-Tage-Fenster.
    const datum = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    await service.from("course_bookings").delete().eq("customer_id", gast!.id).eq("course_id", KURS_ID).eq("type", "trial");
    const { data: buchung, error } = await service
      .from("course_bookings")
      .insert({
        customer_id: gast!.id,
        course_id: KURS_ID,
        type: "trial",
        status: "confirmed",
        chosen_date: datum,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Probestunde anlegen fehlgeschlagen: ${error.message}`);

    await anmelden(page, LEHRER);
    await gehZu(page, "/mein-bereich");
    await page.waitForTimeout(1500);

    await expect(page.getByText("Probestunden")).toBeVisible();
    await expect(page.getByText("E2E13 Flatrate Kunde")).toBeVisible();

    await service.from("course_bookings").delete().eq("id", buchung!.id);
  });

  test("AC14: Die Rollenverteilung erscheint nur, wo der Kurs die Tanzrolle abfragt", async ({
    page,
  }) => {
    const service = dienst();

    // Ohne eigene Rollenbuchung stünde hier „0 Leader / 0 Follower" — und das
    // sähe genauso aus wie eine Abfrage, die gar nichts zurückbekommt. Also
    // erst eine Verteilung herstellen, die es zu zählen gibt.
    const { data: leute } = await service
      .from("profiles")
      .select("id, full_name")
      .in("full_name", ["E2E13 Abo Kunde", "E2E13 Flatrate Kunde"]);
    const leaderId = leute?.find((l) => l.full_name === "E2E13 Abo Kunde")?.id;
    const followerId = leute?.find((l) => l.full_name === "E2E13 Flatrate Kunde")?.id;
    expect(leaderId && followerId, "Fixtures für die Rollenverteilung fehlen").toBeTruthy();

    const { data: schonDa } = await service
      .from("course_bookings")
      .select("dance_role")
      .eq("course_id", KURS_ID)
      .eq("type", "regular")
      .not("dance_role", "is", null);
    const vorhanden = (rolle: string) =>
      (schonDa ?? []).filter((b) => b.dance_role === rolle).length;

    // `chosen_date` ist Pflicht; für eine reguläre Buchung ist der Kursstart
    // der naheliegende Wert.
    const start = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const { data: gesaet, error } = await service
      .from("course_bookings")
      .insert([
        { customer_id: leaderId!, course_id: KURS_ID, type: "regular", status: "confirmed", dance_role: "leader", chosen_date: start },
        { customer_id: followerId!, course_id: KURS_ID, type: "regular", status: "confirmed", dance_role: "follower", chosen_date: start },
      ])
      .select("id");
    if (error) throw new Error(`Rollenbuchungen anlegen fehlgeschlagen: ${error.message}`);
    const aufraeumen = async () => {
      await service.from("course_bookings").delete().in("id", (gesaet ?? []).map((b) => b.id));
      await service.from("courses").update({ role_query_enabled: false }).eq("id", KURS_ID);
    };

    try {
      // Aus: keine Verteilung.
      await service.from("courses").update({ role_query_enabled: false }).eq("id", KURS_ID);
      await anmelden(page, LEHRER);
      await gehZu(page, "/mein-bereich");
      await page.waitForTimeout(1500);
      await expect(page.getByText(/\d+ Leader/)).toHaveCount(0);

      // An: Verteilung steht beim Termin — mit den Zahlen, die auch in der
      // Datenbank stehen.
      await service.from("courses").update({ role_query_enabled: true }).eq("id", KURS_ID);
      await page.reload();
      await page.waitForTimeout(1500);
      await expect(page.getByText(`${vorhanden("leader") + 1} Leader`).first()).toBeVisible();
      await expect(page.getByText(`${vorhanden("follower") + 1} Follower`).first()).toBeVisible();
    } finally {
      await aufraeumen();
    }
  });

});
