import { test, expect, type Page } from "@playwright/test";
import { gehZu } from "./navigation";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

try {
  ladeTestUmgebung();
} catch {
  // Schon geladen — unkritisch.
}

// Die Fixtures stammen aus verschiedenen Suiten und haben verschiedene
// Passwörter — das je Konto mitzuführen ist weniger fehleranfällig als ein
// gemeinsames anzunehmen.
const FLATRATE_KUNDE = {
  email: "e2e11-flatrate@viennasalsastudio.test",
  passwort: "TestPassword123!",
};
const KURS_KUNDE = {
  email: "e2e8-customer@viennasalsastudio.test",
  passwort: "CorrectPassword123!",
};

/**
 * Eigene Testdaten statt fremder Fixtures.
 *
 * Die Kurse dieser Suite entstehen hier und verschwinden wieder. Ein geteilter
 * Kurs hätte gereicht, um andere Suiten zu stören — ein Kursplatz taucht seit
 * PROJ-50 in Anwesenheitsliste, Kursgrenze und Rollenbalance auf, und genau
 * solche stillen Wechselwirkungen haben in diesem Projekt schon zweimal Tests
 * umgeworfen, die mit der Sache nichts zu tun hatten.
 */
const KURS_NAME = "E2E50 Flatrate Kurs";
const KURS_MIT_ROLLE = "E2E50 Flatrate Rollenkurs";

const dienst = (): SupabaseClient =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

async function anmelden(page: Page, konto: { email: string; passwort: string }) {
  await gehZu(page, "/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(konto.email);
  await page.getByLabel("Passwort").fill(konto.passwort);
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL(/\/(mein-bereich|profil|admin)$/, { timeout: 20000 });
}

let kursId = "";
let rollenKursId = "";
let kundeId = "";

test.beforeAll(async () => {
  const service = dienst();

  const { data: kunde } = await service
    .from("profiles")
    .select("id")
    .eq("full_name", "E2E11 Flatrate Kunde")
    .single();
  if (!kunde) throw new Error("Fixture 'E2E11 Flatrate Kunde' fehlt");
  kundeId = kunde.id;

  const { data: abo } = await service
    .from("subscriptions")
    .select("id")
    .eq("customer_id", kundeId)
    .is("course_id", null)
    .eq("status", "active")
    .maybeSingle();
  if (!abo) throw new Error("Fixture-Kunde hat keine aktive Flatrate");

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  if (!raum) throw new Error("Kein Raum vorhanden");

  // Reste eines abgebrochenen Laufs zuerst weg — sonst scheitert das Anlegen
  // am nächsten Mal an sich selbst.
  await service.from("courses").delete().in("name", [KURS_NAME, KURS_MIT_ROLLE]);

  const { data: kurse, error } = await service
    .from("courses")
    .insert([
      { name: KURS_NAME, room_id: raum.id, level: "beginner", role_query_enabled: false },
      { name: KURS_MIT_ROLLE, room_id: raum.id, level: "beginner", role_query_enabled: true },
    ])
    .select("id, name");
  if (error) throw new Error(`Testkurse anlegen fehlgeschlagen: ${error.message}`);

  kursId = kurse!.find((k) => k.name === KURS_NAME)!.id;
  rollenKursId = kurse!.find((k) => k.name === KURS_MIT_ROLLE)!.id;

  // Donnerstag 19:00, damit die Kurse im Stundenplan auftauchen.
  await service.from("course_schedule").insert([
    { course_id: kursId, weekday: 3, start_time: "19:00", end_time: "20:00" },
    { course_id: rollenKursId, weekday: 3, start_time: "20:00", end_time: "21:00" },
  ]);
});

test.afterAll(async () => {
  const service = dienst();
  // Die Kursplätze hängen am Kurs und verschwinden mit ihm.
  await service.from("courses").delete().in("name", [KURS_NAME, KURS_MIT_ROLLE]);
});

test.beforeEach(async () => {
  const service = dienst();
  await service.from("course_memberships").delete().eq("customer_id", kundeId);
});

test.describe("PROJ-50: Flatrate für mehrere Kurse", () => {
  test("AC1: Mit Flatrate heißt die Aktion „Zu meiner Flatrate hinzufügen“", async ({ page }) => {
    await anmelden(page, FLATRATE_KUNDE);
    await gehZu(page, `/kurse/${kursId}`);
    await page.waitForTimeout(1500);

    await expect(page.getByRole("button", { name: "Zu meiner Flatrate hinzufügen" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Jetzt buchen" })).toHaveCount(0);
  });

  test("AC2: Ein Kunde ohne Flatrate sieht unverändert „Jetzt buchen“", async ({ page }) => {
    await anmelden(page, KURS_KUNDE);
    await gehZu(page, `/kurse/${kursId}`);
    await page.waitForTimeout(1500);

    await expect(page.getByRole("button", { name: "Jetzt buchen" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Zu meiner Flatrate hinzufügen" })).toHaveCount(0);
  });

  test("AC3: Ohne Rollen- und Vorkenntnisfrage genügt ein Klick — ohne Dialog", async ({ page }) => {
    await anmelden(page, FLATRATE_KUNDE);
    await gehZu(page, `/kurse/${kursId}`);
    await page.waitForTimeout(1500);

    await page.getByRole("button", { name: "Zu meiner Flatrate hinzufügen" }).click();
    await page.waitForTimeout(2500);

    // Kein Dialog dazwischen: Es gibt nichts mehr zu entscheiden.
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const service = dienst();
    const { data } = await service
      .from("course_memberships")
      .select("id")
      .eq("customer_id", kundeId)
      .eq("course_id", kursId)
      .is("ended_on", null);
    expect(data ?? [], "Kursplatz wurde nicht angelegt").toHaveLength(1);
  });

  test("AC4: Es entsteht kein zweites Abo und keine zusätzliche Abbuchung", async ({ page }) => {
    const service = dienst();
    const { count: vorher } = await service
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", kundeId);

    await anmelden(page, FLATRATE_KUNDE);
    await gehZu(page, `/kurse/${kursId}`);
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Zu meiner Flatrate hinzufügen" }).click();
    await page.waitForTimeout(2500);

    const { count: nachher } = await service
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", kundeId);

    // Der Kern der ganzen Sache: gleich viele Abos wie vorher.
    expect(nachher, "Es ist ein zweites Abo entstanden").toBe(vorher);
  });

  test("AC5: Fragt der Kurs die Tanzrolle ab, wird nur sie abgefragt", async ({ page }) => {
    await anmelden(page, FLATRATE_KUNDE);
    await gehZu(page, `/kurse/${rollenKursId}`);
    await page.waitForTimeout(1500);

    await page.getByRole("button", { name: "Zu meiner Flatrate hinzufügen" }).click();
    await page.waitForTimeout(800);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Als was tanzt du in diesem Kurs?")).toBeVisible();
    // Weder Startdatum noch AGB — es entsteht kein neuer Vertrag.
    await expect(dialog.getByText(/AGB/i)).toHaveCount(0);
    await expect(dialog.getByText(/Einstiegstermin|Startdatum/i)).toHaveCount(0);

    await dialog.getByLabel("Leader", { exact: true }).click();
    await dialog.getByRole("button", { name: "Hinzufügen" }).click();
    await page.waitForTimeout(2500);

    const service = dienst();
    const { data } = await service
      .from("course_memberships")
      .select("dance_role")
      .eq("customer_id", kundeId)
      .eq("course_id", rollenKursId)
      .is("ended_on", null);
    expect(data?.[0]?.dance_role, "Tanzrolle wurde nicht gespeichert").toBe("leader");
  });

  test("AC6: Wer schon im Kurs ist, bekommt keine Aktion zum Hinzufügen", async ({ page }) => {
    const service = dienst();
    const { data: abo } = await service
      .from("subscriptions")
      .select("id")
      .eq("customer_id", kundeId)
      .is("course_id", null)
      .eq("status", "active")
      .single();
    await service
      .from("course_memberships")
      .insert({ customer_id: kundeId, course_id: kursId, subscription_id: abo!.id });

    await anmelden(page, FLATRATE_KUNDE);
    await gehZu(page, `/kurse/${kursId}`);
    await page.waitForTimeout(1500);

    await expect(page.getByText("Du bist in diesem Kurs")).toBeVisible();
    await expect(page.getByRole("button", { name: "Zu meiner Flatrate hinzufügen" })).toHaveCount(0);
  });

  test("AC7: Im Profil stehen die Kurse der Flatrate und lassen sich entfernen", async ({
    page,
  }) => {
    const service = dienst();
    const { data: abo } = await service
      .from("subscriptions")
      .select("id")
      .eq("customer_id", kundeId)
      .is("course_id", null)
      .eq("status", "active")
      .single();
    await service
      .from("course_memberships")
      .insert({ customer_id: kundeId, course_id: kursId, subscription_id: abo!.id });

    await anmelden(page, FLATRATE_KUNDE);
    await gehZu(page, "/profil");
    await page.waitForTimeout(2000);

    // Die Abschnitte im Profil liegen hinter einem Akkordeon, und Radix nimmt
    // geschlossene Inhalte ganz aus dem DOM — ohne dieses Aufklappen ist die
    // Kursliste schlicht nicht da.
    await page.getByRole("button", { name: "Mein Abo" }).click();
    await page.waitForTimeout(600);

    await expect(page.getByText("In diesen Kursen bist du über deine Flatrate eingeschrieben.")).toBeVisible();
    await expect(page.getByText(KURS_NAME)).toBeVisible();

    await page.getByRole("button", { name: "Entfernen" }).first().click();
    await page.waitForTimeout(600);
    await page.getByRole("alertdialog").getByRole("button", { name: "Entfernen" }).click();
    await page.waitForTimeout(2500);

    const { data } = await service
      .from("course_memberships")
      .select("id")
      .eq("customer_id", kundeId)
      .eq("course_id", kursId)
      .is("ended_on", null);
    expect(data ?? [], "Der Kursplatz ist noch offen").toHaveLength(0);
  });

  test("AC8: Ein voller Kurs weist auch den Flatrate-Kunden ab", async ({ page }) => {
    const service = dienst();
    // Grenze auf null: Damit ist der Kurs für jeden voll.
    await service.from("courses").update({ max_participants: 0 }).eq("id", kursId);

    try {
      await anmelden(page, FLATRATE_KUNDE);
      await gehZu(page, `/kurse/${kursId}`);
      await page.waitForTimeout(1500);
      await page.getByRole("button", { name: "Zu meiner Flatrate hinzufügen" }).click();
      await page.waitForTimeout(2500);

      const { data } = await service
        .from("course_memberships")
        .select("id")
        .eq("customer_id", kundeId)
        .eq("course_id", kursId)
        .is("ended_on", null);
      expect(data ?? [], "Der volle Kurs hat trotzdem einen Platz vergeben").toHaveLength(0);
    } finally {
      await service.from("courses").update({ max_participants: null }).eq("id", kursId);
    }
  });

  test("AC9: Pausiert der Kunde seine Flatrate, enden seine Kursplätze", async ({ page: _page }) => {
    const service = dienst();
    const { data: abo } = await service
      .from("subscriptions")
      .select("id, status")
      .eq("customer_id", kundeId)
      .is("course_id", null)
      .eq("status", "active")
      .single();
    await service
      .from("course_memberships")
      .insert({ customer_id: kundeId, course_id: kursId, subscription_id: abo!.id });

    try {
      await service.from("subscriptions").update({ status: "paused" }).eq("id", abo!.id);

      const { data: offen } = await service
        .from("course_memberships")
        .select("id")
        .eq("customer_id", kundeId)
        .is("ended_on", null);
      expect(offen ?? [], "Der Kursplatz läuft trotz Pause weiter").toHaveLength(0);

      // Und die Erinnerung bleibt — sie ist der Vorschlag nach der Pause.
      const { data: beendet } = await service
        .from("course_memberships")
        .select("id")
        .eq("customer_id", kundeId)
        .not("ended_on", "is", null);
      expect((beendet ?? []).length, "Der beendete Platz wurde gelöscht statt beendet").toBeGreaterThan(0);
    } finally {
      await service.from("subscriptions").update({ status: "active" }).eq("id", abo!.id);
    }
  });

  test("Sicherheit: Ein Kunde ohne Flatrate kommt über die Funktion nicht in einen Kurs", async () => {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { error: loginFehler } = await client.auth.signInWithPassword({
      email: KURS_KUNDE.email,
      password: KURS_KUNDE.passwort,
    });
    expect(loginFehler).toBeNull();

    // Die Oberfläche bietet ihm den Knopf gar nicht an — der Zaun muss aber in
    // der Datenbank stehen, nicht im Bildschirm.
    const { error } = await client.rpc("add_course_to_flatrate", {
      p_course_id: kursId,
      p_dance_role: "",
      p_prerequisite_confirmed: false,
    });
    expect(error, "Ein Kunde ohne Flatrate durfte sich eintragen").not.toBeNull();
    expect(error!.message).toContain("no flatrate");
  });

  /**
   * Ab hier: die Lesestellen.
   *
   * Der Kursplatz allein nützt nichts, solange ihn niemand liest. Diese Fälle
   * prüfen genau die Stellen, an denen ein Flatrate-Kunde vorher unsichtbar
   * war — und sie melden sich als Flatrate-Kunde an, nicht als Admin. Genau
   * diese Verwechslung hat in PROJ-30 und PROJ-31 dafür gesorgt, dass ein
   * Fehler wochenlang grün war.
   */

  test("Lesestelle: Ein Flatrate-Kunde steht in der Anwesenheitsliste des Lehrers", async ({
    page,
  }) => {
    const service = dienst();
    const { data: abo } = await service
      .from("subscriptions")
      .select("id")
      .eq("customer_id", kundeId)
      .is("course_id", null)
      .eq("status", "active")
      .single();
    await service
      .from("course_memberships")
      .insert({ customer_id: kundeId, course_id: kursId, subscription_id: abo!.id });

    const { data: lehrer } = await service
      .from("profiles")
      .select("id")
      .eq("full_name", "E2E13 Lehrer A")
      .single();
    // Nur für die Dauer dieses Falls: Ein dauerhaft zugewiesener Testkurs
    // taucht sonst im Lehrer-Bereich aus PROJ-49 auf und verschiebt dort die
    // Terminliste.
    await service.from("course_teachers").insert({ course_id: kursId, teacher_id: lehrer!.id });

    try {
      await anmelden(page, { email: "e2e13-lehrer-a@viennasalsastudio.test", passwort: "CorrectPassword123!" });
      await gehZu(page, `/lehrer/${kursId}`);
      await page.waitForTimeout(2500);
      await expect(page.getByText("E2E11 Flatrate Kunde")).toBeVisible();
    } finally {
      await service
        .from("course_teachers")
        .delete()
        .eq("course_id", kursId)
        .eq("teacher_id", lehrer!.id);
    }
  });

  test("Lesestelle: Ein Flatrate-Kunde zählt gegen die Kursgrenze", async () => {
    const service = dienst();
    const { data: abo } = await service
      .from("subscriptions")
      .select("id")
      .eq("customer_id", kundeId)
      .is("course_id", null)
      .eq("status", "active")
      .single();

    // Ein Platz, und den nimmt der Flatrate-Kunde.
    await service.from("courses").update({ max_participants: 1 }).eq("id", kursId);
    await service
      .from("course_memberships")
      .insert({ customer_id: kundeId, course_id: kursId, subscription_id: abo!.id });

    try {
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );
      await client.auth.signInWithPassword({
        email: KURS_KUNDE.email,
        password: KURS_KUNDE.passwort,
      });

      const { error } = await client.rpc("create_regular_course_booking", {
        p_course_id: kursId,
        p_desired_plan: "single_course",
        p_chosen_date: new Date().toISOString().slice(0, 10),
        p_note: "",
        p_prerequisite_confirmed: false,
        p_dance_role: "",
        p_coupon_code: "",
        p_wants_student_price: false,
        p_terms_accepted: true,
        p_terms_version: new Date().toISOString().slice(0, 7),
      });

      // Vor PROJ-50 wäre der Kurs hier leer gewesen und die Buchung
      // durchgegangen — der Kurs hätte zwei Leute auf einem Platz gehabt.
      expect(error, "Der Flatrate-Kunde zählt nicht gegen die Kursgrenze").not.toBeNull();
      expect(error!.message).toContain("course is full");
    } finally {
      await service.from("courses").update({ max_participants: null }).eq("id", kursId);
      await service
        .from("course_bookings")
        .delete()
        .eq("course_id", kursId)
        .eq("type", "regular");
    }
  });

  test("Lesestelle: Ein Flatrate-Kunde kann keine reguläre Buchung mehr auslösen", async () => {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    await client.auth.signInWithPassword({
      email: FLATRATE_KUNDE.email,
      password: FLATRATE_KUNDE.passwort,
    });

    // Der Riegel gehört in die Datenbank, nicht in den Bildschirm: Genau über
    // diesen Aufruf entstand das zweite Abo.
    const { error } = await client.rpc("create_regular_course_booking", {
      p_course_id: kursId,
      p_desired_plan: "flatrate",
      p_chosen_date: new Date().toISOString().slice(0, 10),
      p_note: "",
      p_prerequisite_confirmed: false,
      p_dance_role: "",
      p_coupon_code: "",
      p_wants_student_price: false,
      p_terms_accepted: true,
      p_terms_version: new Date().toISOString().slice(0, 7),
    });

    expect(error, "Ein Flatrate-Kunde konnte eine reguläre Buchung anlegen").not.toBeNull();
    expect(error!.message).toContain("flatrate covers this");
  });

  /**
   * QA-Durchgang 2026-09-10: die Kriterien, die beim Bauen ungeprüft blieben.
   */

  async function flatrateAboId(): Promise<string> {
    const service = dienst();
    const { data } = await service
      .from("subscriptions")
      .select("id")
      .eq("customer_id", kundeId)
      .is("course_id", null)
      .eq("status", "active")
      .single();
    return data!.id;
  }

  test("AC: Der Vorkenntnisse-Hinweis muss auch hier bestätigt werden", async ({ page }) => {
    const service = dienst();
    await service
      .from("courses")
      .update({ prerequisite_note: "Du solltest den Grundkurs besucht haben." })
      .eq("id", kursId);

    try {
      await anmelden(page, FLATRATE_KUNDE);
      await gehZu(page, `/kurse/${kursId}`);
      await page.waitForTimeout(1500);
      await page.getByRole("button", { name: "Zu meiner Flatrate hinzufügen" }).click();
      await page.waitForTimeout(800);

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("Du solltest den Grundkurs besucht haben.")).toBeVisible();
      // Ohne Häkchen bleibt der Knopf gesperrt.
      await expect(dialog.getByRole("button", { name: "Hinzufügen" })).toBeDisabled();

      await dialog.getByRole("checkbox").check();
      await expect(dialog.getByRole("button", { name: "Hinzufügen" })).toBeEnabled();
    } finally {
      await service.from("courses").update({ prerequisite_note: null }).eq("id", kursId);
    }
  });

  test("AC: Wer seinen letzten Kurs entfernt, sieht einen Hinweis statt einer leeren Liste", async ({
    page,
  }) => {
    await anmelden(page, FLATRATE_KUNDE);
    await gehZu(page, "/profil");
    await page.waitForTimeout(2000);
    await page.getByRole("button", { name: "Mein Abo" }).click();
    await page.waitForTimeout(800);

    // beforeEach hat alle Kursplätze entfernt — das ist genau der Leerzustand.
    await expect(
      page.getByText("Deine Flatrate läuft, aber du bist in keinem Kurs eingeschrieben.")
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Kurse ansehen" })).toBeVisible();
  });

  test("AC: Nach einer Pause stehen die früheren Kurse als Vorschlag bereit", async ({ page }) => {
    const service = dienst();
    const aboId = await flatrateAboId();
    await service
      .from("course_memberships")
      .insert({ customer_id: kundeId, course_id: kursId, subscription_id: aboId });

    try {
      // Pausieren beendet die Kursplätze — die Erinnerung bleibt.
      await service.from("subscriptions").update({ status: "paused" }).eq("id", aboId);
      await service.from("subscriptions").update({ status: "active" }).eq("id", aboId);

      await anmelden(page, FLATRATE_KUNDE);
      await gehZu(page, "/profil");
      await page.waitForTimeout(2000);
      await page.getByRole("button", { name: "Mein Abo" }).click();
      await page.waitForTimeout(800);

      await expect(page.getByText("Deine früheren Kurse")).toBeVisible();
      await expect(page.getByRole("button", { name: new RegExp(KURS_NAME) })).toBeVisible();
    } finally {
      await service.from("subscriptions").update({ status: "active" }).eq("id", aboId);
      await service.from("course_memberships").delete().eq("customer_id", kundeId);
    }
  });

  test("AC: Gibt ein Flatrate-Kunde seinen Platz frei, rückt die Warteliste nach", async () => {
    const service = dienst();
    const aboId = await flatrateAboId();

    // Ein Platz, belegt vom Flatrate-Kunden; ein anderer wartet.
    await service.from("courses").update({ max_participants: 1 }).eq("id", kursId);
    await service
      .from("course_memberships")
      .insert({ customer_id: kundeId, course_id: kursId, subscription_id: aboId });

    const { data: wartender } = await service
      .from("profiles")
      .select("id")
      .eq("full_name", "E2E8 Customer")
      .maybeSingle();
    const wartenderId =
      wartender?.id ??
      (await service.auth.admin.listUsers({ perPage: 200 })).data.users.find(
        (u) => u.email === KURS_KUNDE.email
      )!.id;

    await service.from("waitlist_entries").delete().eq("course_id", kursId);
    await service.from("waitlist_entries").insert({
      course_id: kursId,
      customer_id: wartenderId,
      desired_plan: "single_course",
      chosen_date: new Date().toISOString().slice(0, 10),
    });

    try {
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );
      await client.auth.signInWithPassword({
        email: FLATRATE_KUNDE.email,
        password: FLATRATE_KUNDE.passwort,
      });
      const { error } = await client.rpc("remove_course_from_flatrate", { p_course_id: kursId });
      expect(error).toBeNull();

      // Der Wartende ist nachgerückt: Der Eintrag ist weg, eine Anfrage steht.
      const { data: nochWartend } = await service
        .from("waitlist_entries")
        .select("id")
        .eq("course_id", kursId);
      expect(nochWartend ?? [], "Die Warteliste ist nicht nachgerückt").toHaveLength(0);

      const { data: anfrage } = await service
        .from("course_bookings")
        .select("id, status")
        .eq("course_id", kursId)
        .eq("customer_id", wartenderId)
        .eq("type", "regular");
      expect((anfrage ?? []).length, "Für den Wartenden entstand keine Anfrage").toBeGreaterThan(0);
    } finally {
      await service.from("courses").update({ max_participants: null }).eq("id", kursId);
      await service.from("waitlist_entries").delete().eq("course_id", kursId);
      await service.from("course_bookings").delete().eq("course_id", kursId).eq("type", "regular");
      await service.from("course_memberships").delete().eq("customer_id", kundeId);
    }
  });

  test("AC: Ein nachrückender Flatrate-Kunde bekommt den Platz, keine offene Anfrage", async () => {
    const service = dienst();
    await service.from("courses").update({ max_participants: 1 }).eq("id", kursId);

    // Der Kurs wird von jemand anderem belegt — über ein kursgebundenes Abo,
    // damit der Aufbau nicht von einem zweiten Flatrate-Kunden abhängt.
    const { data: anderer } = await service
      .from("profiles")
      .select("id")
      .eq("full_name", "E2E13 Abo Kunde")
      .single();
    const { data: platzhalter } = await service
      .from("subscriptions")
      .insert({
        customer_id: anderer!.id,
        course_id: kursId,
        name: "E2E50 Platzhalter",
        price: 65,
        status: "active",
      })
      .select("id")
      .single();

    await service.from("waitlist_entries").delete().eq("course_id", kursId);
    await service.from("waitlist_entries").insert({
      course_id: kursId,
      customer_id: kundeId,
      desired_plan: "flatrate",
      chosen_date: new Date().toISOString().slice(0, 10),
    });

    try {
      // Platz frei machen und nachrücken lassen — über den Zugang, den auch
      // der Betreiber benutzt.
      await service.from("subscriptions").delete().eq("id", platzhalter!.id);

      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );
      await adminClient.auth.signInWithPassword({
        email: "e2e8-admin@viennasalsastudio.test",
        password: "CorrectPassword123!",
      });
      const { error } = await adminClient.rpc("promote_waitlist_for_course", {
        p_course_id: kursId,
      });
      expect(error, "Die Nachrückung ließ sich nicht auslösen").toBeNull();

      const { data: platz } = await service
        .from("course_memberships")
        .select("id")
        .eq("customer_id", kundeId)
        .eq("course_id", kursId)
        .is("ended_on", null);
      const { data: anfrage } = await service
        .from("course_bookings")
        .select("id")
        .eq("customer_id", kundeId)
        .eq("course_id", kursId)
        .eq("type", "regular");

      // Der Kern der Entscheidung: Platz statt Anfrage — über die Anfrage
      // entstand bisher das zweite Abo.
      expect(platz ?? [], "Der Nachrücker bekam keinen Kursplatz").toHaveLength(1);
      expect(anfrage ?? [], "Es entstand doch eine offene Anfrage").toHaveLength(0);
    } finally {
      await service.from("courses").update({ max_participants: null }).eq("id", kursId);
      await service.from("waitlist_entries").delete().eq("course_id", kursId);
      await service.from("course_memberships").delete().eq("course_id", kursId);
      await service.from("course_bookings").delete().eq("course_id", kursId).eq("type", "regular");
      await service.from("subscriptions").delete().eq("id", platzhalter!.id);
    }
  });

  test("AC: Der Betreiber sieht und ändert die Kursliste einer Flatrate", async ({ page }) => {
    const service = dienst();
    const aboId = await flatrateAboId();
    await service
      .from("course_memberships")
      .insert({ customer_id: kundeId, course_id: kursId, subscription_id: aboId });

    try {
      await anmelden(page, { email: "e2e8-admin@viennasalsastudio.test", passwort: "CorrectPassword123!" });
      await page.goto(`/admin/kunden/${kundeId}`);
      await page.waitForTimeout(2000);

      await expect(page.getByText("Kurse dieser Flatrate")).toBeVisible();
      await expect(page.getByText(KURS_NAME)).toBeVisible();

      await page.getByRole("button", { name: "Entfernen" }).first().click();
      await page.waitForTimeout(2500);

      const { data } = await service
        .from("course_memberships")
        .select("id")
        .eq("customer_id", kundeId)
        .eq("course_id", kursId)
        .is("ended_on", null);
      expect(data ?? [], "Der Betreiber konnte den Kursplatz nicht entfernen").toHaveLength(0);
    } finally {
      await service.from("course_memberships").delete().eq("customer_id", kundeId);
    }
  });

  test("Sicherheit: Ein Kunde kann die Kursliste eines fremden Abos nicht ändern", async () => {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    await client.auth.signInWithPassword({
      email: FLATRATE_KUNDE.email,
      password: FLATRATE_KUNDE.passwort,
    });

    const { data: fremder } = await dienst()
      .from("profiles")
      .select("id")
      .eq("full_name", "E2E13 Abo Kunde")
      .single();

    const { error } = await client.rpc("admin_add_course_membership", {
      p_customer_id: fremder!.id,
      p_course_id: kursId,
      p_dance_role: "",
      p_ignore_capacity: true,
    });
    expect(error, "Ein Kunde durfte einen fremden Kursplatz anlegen").not.toBeNull();
    expect(error!.message).toContain("not authorized");

    // Und lesen? Die Regel auf der Tabelle sagt „eigene Zeile oder Admin" —
    // geprüft, nicht angenommen.
    const service = dienst();
    const aboId = await flatrateAboId();
    await service
      .from("course_memberships")
      .insert({ customer_id: kundeId, course_id: kursId, subscription_id: aboId });
    const { data: fremdesAbo } = await service
      .from("subscriptions")
      .select("id")
      .eq("customer_id", fremder!.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    let fremderPlatz: string | null = null;
    if (fremdesAbo) {
      const { data } = await service
        .from("course_memberships")
        .insert({
          customer_id: fremder!.id,
          course_id: rollenKursId,
          subscription_id: fremdesAbo.id,
        })
        .select("id")
        .maybeSingle();
      fremderPlatz = data?.id ?? null;
    }

    try {
      const { data: sichtbar } = await client.from("course_memberships").select("customer_id");
      expect(sichtbar ?? [], "Der Kunde sieht gar keine eigenen Kursplätze").not.toHaveLength(0);
      expect(
        (sichtbar ?? []).every((z) => z.customer_id === kundeId),
        "Ein Kunde sieht fremde Kursplätze"
      ).toBe(true);
    } finally {
      await service.from("course_memberships").delete().eq("customer_id", kundeId);
      if (fremderPlatz) await service.from("course_memberships").delete().eq("id", fremderPlatz);
    }
  });

  test("BEFUND: Bestätigt der Betreiber eine neue Flatrate-Anfrage, entsteht ein Kursplatz", async () => {
    // Dieser Fall dokumentiert einen Befund aus dem QA-Durchgang und schlägt
    // bis zur Behebung fehl: Beim Bestätigen entsteht ein Abo ohne Kursbezug
    // und kein Kursplatz — der Kunde zahlt und sitzt in keinem Kurs.
    const service = dienst();
    const { data: abo } = await service
      .from("subscriptions")
      .insert({
        customer_id: kundeId,
        course_id: null,
        name: "E2E50 Bestätigungstest",
        price: 145,
        status: "active",
      })
      .select("id")
      .single();
    const { data: buchung } = await service
      .from("course_bookings")
      .insert({
        customer_id: kundeId,
        course_id: kursId,
        type: "regular",
        status: "confirmed",
        desired_plan: "flatrate",
        chosen_date: new Date().toISOString().slice(0, 10),
        subscription_id: abo!.id,
      })
      .select("id")
      .single();

    try {
      const { data: platz } = await service
        .from("course_memberships")
        .select("id")
        .eq("subscription_id", abo!.id)
        .is("ended_on", null);
      expect(
        platz ?? [],
        "Zur bestätigten Flatrate-Buchung entstand kein Kursplatz — der Kunde ist in keinem Kurs"
      ).toHaveLength(1);
    } finally {
      await service.from("course_bookings").delete().eq("id", buchung!.id);
      await service.from("course_memberships").delete().eq("subscription_id", abo!.id);
      await service.from("subscriptions").delete().eq("id", abo!.id);
    }
  });
});
