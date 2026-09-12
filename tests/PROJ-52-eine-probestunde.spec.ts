import { test, expect, type Page } from "@playwright/test";
import { gehZu } from "./navigation";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

try {
  ladeTestUmgebung();
} catch {
  // Schon geladen — unkritisch.
}

/**
 * PROJ-52: Eine Probestunde je Kunde.
 *
 * Eigener Kunde und eigene Kurse. Diese Suite bucht, storniert und verschiebt
 * Probestunden — an einem geteilten Konto wäre jede davon eine Falle für die
 * nächste Suite, weil eine Probestunde jetzt **eine** ist.
 */
const KUNDE = { email: "e2e52-kunde@viennasalsastudio.test", passwort: "CorrectPassword123!" };
const KURS_A = "E2E52 Kurs A";
const KURS_B = "E2E52 Kurs B";
const ALLE_KURSE = [KURS_A, KURS_B];

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

let kundeId = "";
let kursAId = "";
let kursBId = "";

async function anmelden(page: Page) {
  await gehZu(page, "/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(KUNDE.email);
  await page.getByLabel("Passwort").fill(KUNDE.passwort);
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL(/\/(mein-bereich|profil|admin)$/, { timeout: 20000 });
}

/** Den Buchungsdialog eines Kurses öffnen — über die Kursdetailseite, die ist
 *  direkt adressierbar und braucht kein Blättern im Katalog. */
async function oeffneDialog(page: Page, kursId: string) {
  await gehZu(page, `/kurse/${kursId}`);
  await page.waitForTimeout(1800);
  await page.getByRole("button", { name: "Jetzt buchen" }).click();
  await page.waitForTimeout(1000);
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: "Probestunde" }).click();
  await page.waitForTimeout(600);
  return dialog;
}

test.beforeAll(async () => {
  const service = dienst();
  await service.from("courses").delete().in("name", ALLE_KURSE);

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data: stil } = await service.from("dance_styles").select("id").limit(1).single();
  if (!raum || !stil) throw new Error("PROJ-52: Raum oder Tanzstil fehlt");

  const { data: kurse, error } = await service
    .from("courses")
    .insert([
      { name: KURS_A, room_id: raum.id, dance_style_id: stil.id, level: "beginner", role_query_enabled: false },
      // Kurs B fragt die Tanzrolle ab: An ihm hängt die Prüfung, dass die
      // Rollenwahl auch im Probestunden-Reiter erreichbar ist.
      { name: KURS_B, room_id: raum.id, dance_style_id: stil.id, level: "beginner", role_query_enabled: true },
    ])
    .select("id, name");
  if (error) throw new Error(`PROJ-52 Testkurse: ${error.message}`);
  kursAId = kurse!.find((k) => k.name === KURS_A)!.id;
  kursBId = kurse!.find((k) => k.name === KURS_B)!.id;

  // Zwei verschiedene Wochentage, damit die Termine der beiden Kurse
  // auseinanderfallen und ein Umbuchen wirklich den Termin wechselt.
  await service.from("course_schedule").insert([
    { course_id: kursAId, weekday: wochentagIn(3), start_time: "18:00", end_time: "19:00" },
    { course_id: kursBId, weekday: wochentagIn(5), start_time: "20:00", end_time: "21:00" },
  ]);

  const { data: alle } = await service.auth.admin.listUsers({ perPage: 400 });
  const alt = alle.users.find((u) => u.email === KUNDE.email);
  if (alt) await service.auth.admin.deleteUser(alt.id);
  const { data: angelegt, error: anlageFehler } = await service.auth.admin.createUser({
    email: KUNDE.email,
    password: KUNDE.passwort,
    email_confirm: true,
  });
  if (anlageFehler) throw new Error(`PROJ-52 Testkunde: ${anlageFehler.message}`);
  kundeId = angelegt.user.id;
  // Ohne Herkunftsangabe verlangt der Dialog sie bei der ersten Buchung — das
  // gehört zu PROJ-8 und nicht hierher.
  await service
    .from("profiles")
    .update({ full_name: "E2E52 Kunde", referral_source: "instagram" })
    .eq("id", kundeId);
});

test.afterAll(async () => {
  const service = dienst();
  if (kundeId) {
    await service.from("course_bookings").delete().eq("customer_id", kundeId);
    await service.auth.admin.deleteUser(kundeId);
  }
  await service.from("courses").delete().in("name", ALLE_KURSE);
});

test.beforeEach(async () => {
  if (kundeId) await dienst().from("course_bookings").delete().eq("customer_id", kundeId);
});

/** Die zählenden Probestunden dieses Kunden, jüngste zuerst. */
async function probestunden() {
  const { data } = await dienst()
    .from("course_bookings")
    .select("id, course_id, chosen_date, status")
    .eq("customer_id", kundeId)
    .eq("type", "trial")
    .order("chosen_date", { ascending: false });
  return data ?? [];
}

test.describe("PROJ-52: Eine Probestunde je Kunde", () => {
  test("AC: Wer noch keine hatte, bucht eine wie bisher", async ({ page }) => {
    await anmelden(page);
    const dialog = await oeffneDialog(page, kursAId);

    await dialog.getByRole("combobox").first().click();
    await page.waitForTimeout(400);
    await page.getByRole("option").first().click();
    await dialog.locator("#terms-accepted-booking").check();
    await dialog.getByRole("button", { name: /verbindlich buchen/ }).click();
    await page.waitForTimeout(2500);

    const gebucht = await probestunden();
    expect(gebucht, "Die Probestunde wurde nicht gebucht").toHaveLength(1);
    expect(gebucht[0].status).toBe("confirmed");
  });

  test("AC: Eine verbrauchte Probestunde wird benannt, nicht weggesperrt", async ({ page }) => {
    // Verbraucht heißt: Der Termin ist vorbei.
    await dienst().from("course_bookings").insert({
      customer_id: kundeId,
      course_id: kursAId,
      type: "trial",
      status: "confirmed",
      chosen_date: tagePlus(-7),
    });

    await anmelden(page);
    const dialog = await oeffneDialog(page, kursAId);

    await expect(dialog.getByText(/Probestunde am .* Jeder Kunde bekommt eine/)).toBeVisible();
    // Ein gesperrter Knopf ohne Erklärung lässt den Kunden den Fehler bei sich
    // suchen — der Grund steht deshalb daneben.
    await expect(dialog.getByText("Du hast deine Probestunde bereits verbraucht.")).toBeVisible();
    // Und keine Terminauswahl: Es gibt nichts zu wählen.
    await expect(dialog.getByRole("combobox")).toHaveCount(0);
  });

  test("AC: Eine stornierte Probestunde gibt sie wieder frei", async ({ page }) => {
    // Entscheidung des Betreibers: Eine Erkältung darf die Probestunde nicht
    // kosten.
    await dienst().from("course_bookings").insert({
      customer_id: kundeId,
      course_id: kursAId,
      type: "trial",
      status: "cancelled",
      chosen_date: tagePlus(-7),
    });

    await anmelden(page);
    const dialog = await oeffneDialog(page, kursAId);
    await expect(dialog.getByText(/bereits verbraucht/)).toHaveCount(0);
    await expect(dialog.getByRole("combobox").first()).toBeVisible();
  });

  test("AC: Eine anstehende Probestunde lässt sich auf einen anderen Kurs umbuchen", async ({
    page,
  }) => {
    const service = dienst();
    const { data: alt } = await service
      .from("course_bookings")
      .insert({
        customer_id: kundeId,
        course_id: kursAId,
        type: "trial",
        status: "confirmed",
        chosen_date: tagePlus(3),
      })
      .select("id")
      .single();

    await anmelden(page);
    const dialog = await oeffneDialog(page, kursBId);

    await expect(dialog.getByText(new RegExp(`Probestunde in ${KURS_A}`))).toBeVisible();

    await dialog.getByRole("combobox").first().click();
    await page.waitForTimeout(400);
    await page.getByRole("option").first().click();
    await dialog.locator("#terms-accepted-booking").check();
    await dialog.getByRole("button", { name: "Probestunde umbuchen" }).click();
    await page.waitForTimeout(2500);

    const nachher = await probestunden();
    const aktive = nachher.filter((b) => b.status === "confirmed" || b.status === "open");
    expect(aktive, "Es gibt nicht genau eine aktive Probestunde").toHaveLength(1);
    expect(aktive[0].course_id, "Sie liegt nicht im Zielkurs").toBe(kursBId);
    expect(
      nachher.find((b) => b.id === alt!.id)?.status,
      "Die alte Buchung wurde nicht storniert"
    ).toBe("cancelled");
  });

  test("AC: Im selben Kurs ändert sie den Termin", async ({ page }) => {
    const service = dienst();
    await service.from("course_bookings").insert({
      customer_id: kundeId,
      course_id: kursAId,
      type: "trial",
      status: "confirmed",
      chosen_date: tagePlus(3),
    });

    await anmelden(page);
    const dialog = await oeffneDialog(page, kursAId);
    await expect(dialog.getByText(/schon eine Probestunde am .* Termin hier ändern/)).toBeVisible();
  });

  test("Die Rollenwahl steht im Probestunden-Reiter — nicht nur bei der Anmeldung", async ({
    page,
  }) => {
    // Gemeldet aus dem Betrieb am 2026-09-12: Die Wahl steckte im Reiter
    // „Anmeldung", der Knopf war aber auf allen Reitern gesperrt, solange keine
    // Rolle gewählt war. Ein Kunde ohne SEPA-Mandat sah dort nur den
    // Mandatshinweis — für ihn war die Probestunde gar nicht buchbar.
    await anmelden(page);
    const dialog = await oeffneDialog(page, kursBId);

    // Sichtbar, ohne den Reiter zu wechseln.
    await expect(dialog.getByLabel("Leader", { exact: true })).toBeVisible();

    await dialog.getByRole("combobox").first().click();
    await page.waitForTimeout(400);
    await page.getByRole("option").first().click();
    await dialog.getByLabel("Leader", { exact: true }).check();
    await dialog.locator("#terms-accepted-booking").check();
    await dialog.getByRole("button", { name: /verbindlich buchen/ }).click();
    await page.waitForTimeout(2500);

    const gebucht = await probestunden();
    expect(gebucht, "Die Probestunde wurde nicht gebucht").toHaveLength(1);
    // Und die Rolle wird festgehalten, statt verlangt und weggeworfen zu
    // werden: Der Lehrer liest sie in der Anwesenheitsliste.
    const { data } = await dienst()
      .from("course_bookings")
      .select("dance_role")
      .eq("id", gebucht[0].id)
      .single();
    expect(data?.dance_role, "Die Tanzrolle wurde nicht gespeichert").toBe("leader");
  });

  test("Sicherheit: Die zweite Probestunde scheitert auch am Dialog vorbei", async () => {
    // Genau dieser Weg war bei PROJ-39 der Missbrauchspfad: Der Aufruf kam an
    // der Oberfläche vorbei.
    const service = dienst();
    await service.from("course_bookings").insert({
      customer_id: kundeId,
      course_id: kursAId,
      type: "trial",
      status: "confirmed",
      chosen_date: tagePlus(-7),
    });

    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    await client.auth.signInWithPassword({ email: KUNDE.email, password: KUNDE.passwort });

    const { error } = await client.rpc("create_self_service_booking", {
      p_course_id: kursBId,
      p_type: "trial",
      p_chosen_date: tagePlus(4),
      p_prerequisite_confirmed: true,
      p_terms_accepted: true,
      p_terms_version: "2026-08-23",
    });
    expect(error?.message ?? "", "Die zweite Probestunde ging durch").toContain("trial already used");

    const aktive = (await probestunden()).filter((b) => b.status !== "cancelled");
    expect(aktive).toHaveLength(1);
  });

  test("Beim Umbuchen geht nie beides oder keines verloren", async () => {
    // Vorher lief das Umbuchen in zwei Schritten: neue Buchung anlegen, dann
    // die alte stornieren. Scheiterte der zweite Schritt, hatte der Kunde zwei.
    // Jetzt ist es ein Vorgang — ein ungültiger Termin nimmt die Stornierung
    // mit zurück.
    const service = dienst();
    const { data: alt } = await service
      .from("course_bookings")
      .insert({
        customer_id: kundeId,
        course_id: kursAId,
        type: "trial",
        status: "confirmed",
        chosen_date: tagePlus(3),
      })
      .select("id")
      .single();

    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    await client.auth.signInWithPassword({ email: KUNDE.email, password: KUNDE.passwort });

    // Ohne AGB-Zustimmung scheitert das Einfügen (PROJ-42) — mitten im Vorgang.
    const { error } = await client.rpc("rebook_self_service_booking", {
      p_booking_id: alt!.id,
      p_course_id: kursBId,
      p_chosen_date: tagePlus(4),
      p_prerequisite_confirmed: true,
      p_terms_accepted: false,
    });
    expect(error?.message ?? "").toContain("terms not accepted");

    const nachher = await probestunden();
    expect(nachher, "Es entstand eine zweite Buchung").toHaveLength(1);
    expect(nachher[0].status, "Die alte Buchung blieb storniert zurück").toBe("confirmed");
  });
});
