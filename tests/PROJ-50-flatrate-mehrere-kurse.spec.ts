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
});
