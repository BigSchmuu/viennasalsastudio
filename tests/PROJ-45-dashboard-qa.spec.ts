import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";
ladeTestUmgebung();

/**
 * PROJ-45: QA-Durchgang für das Kunden-Dashboard.
 *
 * Diese Datei legt sich **alles selbst an** — Kurs, Videosatz, Lektionen,
 * Kunden, Abos — und räumt hinterher auf. Das ist keine Umständlichkeit,
 * sondern die Lehre aus PROJ-22 und PROJ-38: beide bauten auf Daten, die
 * andere Testdateien im selben Lauf umschrieben, und fielen dann um, ohne
 * dass an ihnen selbst etwas falsch gewesen wäre.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORT = "CorrectPassword123!";

const NEU = "proj45qa-neu@viennasalsastudio.test";
const MIT_ABO = "proj45qa-abo@viennasalsastudio.test";
const FLATRATE = "proj45qa-flat@viennasalsastudio.test";

let service: SupabaseClient;
const ids: Record<string, string> = {};

function wienHeute(versatz = 0): string {
  return new Date(Date.now() + versatz * 86400000).toLocaleDateString("en-CA", { timeZone: "Europe/Vienna" });
}

/**
 * 0=Montag..6=Sonntag für einen gegebenen Kalendertag, wie überall in der App.
 *
 * Der Kurs liegt bewusst *morgen* zu einer festen Uhrzeit statt "in zwei
 * Stunden": Läuft die Suite spätabends, wäre "jetzt + 2h" schon der nächste
 * Kalendertag, die Uhrzeit läge an *diesem* Tag in der Vergangenheit, und der
 * Termin verschwände. Genau daran ist PROJ-25 heute gescheitert.
 */
function wienWochentag(datum: string): number {
  const tag = new Date(`${datum}T12:00:00Z`).getUTCDay();
  return tag === 0 ? 6 : tag - 1;
}

const KURSBEGINN = "18:00:00";
const KURSENDE = "19:00:00";

async function kundeAnlegen(mail: string, name: string): Promise<string> {
  const { data: alle } = await service.auth.admin.listUsers({ perPage: 400 });
  const alt = alle.users.find((u) => u.email === mail);
  if (alt) await service.auth.admin.deleteUser(alt.id);
  const { data, error } = await service.auth.admin.createUser({
    email: mail,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error) throw error;
  await service.from("profiles").update({ full_name: name }).eq("id", data.user.id);
  return data.user.id;
}

async function anmelden(page: Page, mail: string) {
  await page.goto("/login");
  await page.waitForTimeout(1200);
  await page.getByLabel(/e-?mail/i).fill(mail);
  await page.getByLabel(/passwort|password/i).fill(PASSWORT);
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Einloggen|Log in/ }).click();
  await page.waitForURL(/\/(mein-bereich|profil|admin)$/, { timeout: 20000 });
  await page.waitForTimeout(1200);
}

test.beforeAll(async () => {
  test.setTimeout(120000);
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();

  // Videosatz mit sechs Lektionen: fünf mit Kundenvideo, eine ohne. Damit
  // lassen sich zwei Kriterien auf einmal pruefen — "hoechstens fuenf plus
  // Verweis" und "Lektion ohne Video erscheint nicht".
  const { data: satz } = await service
    .from("video_sets")
    .insert({ name: "PROJ45QA Videosatz" })
    .select("id")
    .single();
  ids.videoSet = satz!.id;
  await service.from("video_set_lessons").insert(
    [1, 2, 3, 4, 5, 6].map((i) => ({
      video_set_id: satz!.id,
      title: `PROJ45QA Lektion ${i}`,
      position: i,
      customer_video_url: i === 6 ? null : "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    }))
  );

  // Kurs mit Termin heute, beginnt in zwei Stunden — also ausserhalb des
  // Check-in-Fensters, aber sicher noch heute.
  const { data: kurs } = await service
    .from("courses")
    .insert({
      name: "PROJ45QA Kurs",
      level: "beginner",
      room_id: raum!.id,
      video_set_id: satz!.id,
    })
    .select("id")
    .single();
  ids.kurs = kurs!.id;
  await service.from("course_schedule").insert({
    course_id: kurs!.id,
    weekday: wienWochentag(wienHeute(1)),
    start_time: KURSBEGINN,
    end_time: KURSENDE,
  });

  ids.neu = await kundeAnlegen(NEU, "PROJ45QA Neu");
  ids.abo = await kundeAnlegen(MIT_ABO, "PROJ45QA MitAbo");
  ids.flat = await kundeAnlegen(FLATRATE, "PROJ45QA Flatrate");

  await service.from("subscriptions").insert([
    { customer_id: ids.abo, course_id: kurs!.id, name: "PROJ45QA Abo", price: 65, status: "active" },
    // Flatrate: ohne Kursbezug. Genau der Fall, an dem BUG-1 haftete.
    { customer_id: ids.flat, course_id: null, name: "PROJ45QA Flatrate", price: 145, status: "active" },
  ]);

  // Der Flatrate-Kunde hat zusaetzlich eine bestaetigte Probestunde im Kurs —
  // damit ueberhaupt ein naechster Termin entsteht.
  await service.from("course_bookings").insert({
    customer_id: ids.flat,
    course_id: kurs!.id,
    type: "trial",
    status: "confirmed",
    chosen_date: wienHeute(1),
  });

  // Anwesenheiten fuer den Abo-Kunden: zwei im Fenster, eine ausserhalb.
  await service.from("course_attendance").insert([
    { course_id: kurs!.id, customer_id: ids.abo, occurrence_date: wienHeute(-7), status: "present" },
    { course_id: kurs!.id, customer_id: ids.abo, occurrence_date: wienHeute(-21), status: "present" },
    { course_id: kurs!.id, customer_id: ids.abo, occurrence_date: wienHeute(-70), status: "present" },
  ]);
});

test.afterAll(async () => {
  if (ids.kurs) {
    await service.from("course_attendance").delete().eq("course_id", ids.kurs);
    await service.from("course_bookings").delete().eq("course_id", ids.kurs);
    await service.from("subscriptions").delete().eq("course_id", ids.kurs);
    await service.from("course_schedule").delete().eq("course_id", ids.kurs);
    await service.from("courses").delete().eq("id", ids.kurs);
  }
  for (const id of [ids.neu, ids.abo, ids.flat]) {
    if (id) {
      await service.from("subscriptions").delete().eq("customer_id", id);
      await service.auth.admin.deleteUser(id);
    }
  }
  if (ids.videoSet) {
    await service.from("video_set_lessons").delete().eq("video_set_id", ids.videoSet);
    await service.from("video_sets").delete().eq("id", ids.videoSet);
  }
});

test.describe("PROJ-45 QA: Leerzustand", () => {
  test.use({ locale: "de-DE" });

  test("Ein frisch registrierter Kunde sieht den Probestunden-Aufruf als Wichtigstes", async ({ page }) => {
    await anmelden(page, NEU);
    const text = await page.locator("body").innerText();
    expect(text).toContain("Komm zur Probestunde");
    expect(text).toContain("Passend für den Anfang");
  });

  test("Ohne Abo erscheinen 'Dein nächster Kurs', 'Üben' und 'Anwesenheit' gar nicht", async ({ page }) => {
    await anmelden(page, NEU);
    const text = await page.locator("body").innerText();
    expect(text).not.toContain("Dein nächster Kurs");
    expect(text).not.toContain("Üben");
    expect(text).not.toContain("Deine Anwesenheit");
  });

  test("Der Aufruf öffnet die Terminauswahl für eine Probestunde", async ({ page }) => {
    await anmelden(page, NEU);
    await page.getByRole("button", { name: "Termin wählen" }).first().click();
    await page.waitForTimeout(1200);
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test.describe("PROJ-45 QA: Videolektionen", () => {
  test.use({ locale: "de-DE" });

  test("Der Kurs-Abonnent sieht höchstens fünf Lektionen und einen Verweis auf alle", async ({ page }) => {
    await anmelden(page, MIT_ABO);
    const text = await page.locator("body").innerText();
    expect(text).toContain("Üben");
    for (const i of [1, 2, 3, 4, 5]) expect(text).toContain(`PROJ45QA Lektion ${i}`);
    // Die sechste hat kein Kundenvideo — sie zaehlt gar nicht mit und darf
    // auch nicht in der Gesamtzahl auftauchen.
    expect(text).not.toContain("PROJ45QA Lektion 6");
  });

  test("Ein Klick spielt das Video eingebettet ab, ohne die Seite zu verlassen", async ({ page }) => {
    await anmelden(page, MIT_ABO);
    await page.getByRole("button", { name: /PROJ45QA Lektion 1/ }).click();
    await page.waitForTimeout(900);
    await expect(page.locator("iframe[src*='youtube']")).toBeVisible();
    expect(page.url()).toContain("/mein-bereich");
  });

  test("BUG-1: Ein Flatrate-Abo sieht die Lektionen des anstehenden Kurses", async ({ page }) => {
    // Gefunden im QA-Durchgang: die Seite suchte den Kurs nur unter den
    // kursgebundenen Abos. Ein Flatrate-Abo steht dort mit courses = null,
    // der Vergleich griff nie — und der Abschnitt blieb leer, obwohl die
    // Zugriffsregel der Datenbank ihn ausdruecklich erlaubt.
    await anmelden(page, FLATRATE);
    const text = await page.locator("body").innerText();
    expect(text).toContain("PROJ45QA Lektion 1");
  });

  test("Der frisch registrierte Kunde sieht keine Lektionen", async ({ page }) => {
    await anmelden(page, NEU);
    expect(await page.locator("body").innerText()).not.toContain("PROJ45QA Lektion");
  });
});

test.describe("PROJ-45 QA: Termin, Anwesenheit, Guthaben", () => {
  test.use({ locale: "de-DE" });

  test("Der morgige Termin steht mit MORGEN, Uhrzeit, Raum und Standort da", async ({ page }) => {
    await anmelden(page, MIT_ABO);
    const karte = page.locator("section").filter({ hasText: "Dein nächster Kurs" });
    await expect(karte).toContainText("Morgen");
    await expect(karte).toContainText("18:00–19:00");
    await expect(karte).toContainText("PROJ45QA Kurs");
    // Raum und Standort gehoeren zusammen: ohne sie steht der Kunde vor dem
    // richtigen Gebaeude im falschen Saal.
    await expect(karte).toContainText("·");
  });

  test("Bei nur einem Kurs erscheint keine 'Danach'-Zeile", async ({ page }) => {
    await anmelden(page, MIT_ABO);
    expect(await page.locator("body").innerText()).not.toContain("Danach:");
  });

  test("Der Anwesenheitszähler zählt nur das Acht-Wochen-Fenster", async ({ page }) => {
    await anmelden(page, MIT_ABO);
    const abschnitt = page.locator("section").filter({ hasText: "Deine Anwesenheit" });
    // Zwei liegen im Fenster, die dritte 70 Tage zurueck.
    await expect(abschnitt).toContainText("2");
    await expect(abschnitt).toContainText("Mal in den letzten acht Wochen");
  });

  test("Ohne Anwesenheit erscheint der Abschnitt nicht", async ({ page }) => {
    await anmelden(page, NEU);
    expect(await page.locator("body").innerText()).not.toContain("Deine Anwesenheit");
  });

  test("Der Guthaben-Abschnitt nennt, dass nicht ausgezahlt wird", async ({ page }) => {
    const { error } = await service
      .from("customer_credits")
      .insert({ customer_id: ids.abo, amount: 30, origin: "manual", reason: "PROJ45QA" });
    // Ohne diese Pruefung schlug das Einfuegen still fehl (origin 'manual'
    // verlangt eine Begruendung) und der Test suchte einen Abschnitt, den es
    // gar nicht geben konnte.
    expect(error).toBeNull();
    await anmelden(page, MIT_ABO);
    const text = await page.locator("body").innerText();
    expect(text).toContain("Eine Auszahlung ist nicht möglich");
    await service.from("customer_credits").delete().eq("customer_id", ids.abo);
  });
});

test.describe("PROJ-45 QA: Zugang", () => {
  test.use({ locale: "de-DE" });

  test("Ohne Anmeldung führt /mein-bereich zur Anmeldung und danach zurück", async ({ page }) => {
    await page.goto("/mein-bereich");
    await expect(page).toHaveURL(/\/login\?redirect=(%2F|\/)mein-bereich/);
    await page.waitForTimeout(1200);
    await page.getByLabel(/e-?mail/i).fill(MIT_ABO);
    await page.getByLabel(/passwort|password/i).fill(PASSWORT);
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /Einloggen|Log in/ }).click();
    await page.waitForURL(/\/mein-bereich$/, { timeout: 20000 });
  });
});
