import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

// The Playwright runner doesn't auto-load .env.local (unlike `next dev`), but
// the fixture reset below needs SUPABASE_SERVICE_ROLE_KEY.
try {
  ladeTestUmgebung();
} catch {
  // Already loaded (e.g. CI env vars set directly) — safe to ignore.
}

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER = { email: "e2e12-a@viennasalsastudio.test", password: "CorrectPassword123!" };

// Eigene Fixture-Kurse aus PROJ-41 mitbenutzt: einer ohne eigenen Preis, einer
// mit. Beide sind Testkurse, an echten Kursen wird nicht gedreht.
const COURSE = "E2E41 Kurs Standardpreis";
const AGB_VERSION = "2026-08";

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function courseId(name: string): Promise<string> {
  const { data } = await service.from("courses").select("id").eq("name", name).single();
  if (!data) throw new Error(`PROJ-42 Fixture-Kurs fehlt: ${name}`);
  return data.id;
}

// Ohne Reset vor *jedem* Test zeigt der Dialog beim zweiten Mal „Du hast diesen
// Kurs bereits gebucht" statt des Formulars. Es gibt keine Staging-Datenbank.
async function resetBookings() {
  const id = await courseId(COURSE);
  await service.from("course_bookings").delete().eq("course_id", id);
  await service.from("waitlist_entries").delete().eq("course_id", id);
  await service.from("subscriptions").delete().eq("course_id", id);
}

test.beforeEach(async () => {
  await resetBookings();
});

test.afterAll(async () => {
  await resetBookings();
});

async function login(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.waitForTimeout(1000); // let hydration settle, see PROJ-2 BUG-1
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL(/\/(mein-bereich|profil|admin)$/, { timeout: 10000 });
  // Seit PROJ-45 landen Kunden auf /mein-bereich, die Pruefungen hier gelten
  // aber dem Profil. Faehrt der Test unmittelbar danach selbst woandershin,
  // ueberholt seine Navigation diese hier — auf WebKit regelmaessig. Das ist
  // kein Fehler, sondern genau das, was der Test will; darum wird die
  // Unterbrechung geschluckt statt gemeldet.
  if (page.url().endsWith("/mein-bereich")) await page.goto("/profil").catch(() => {});
}

// The course catalog is paginated (PAGE_SIZE=12, "Mehr laden") — fixture
// courses created late sort past page 1 by created_at ascending.
async function openBookingDialog(page: Page, courseName: string) {
  await page.goto("/kurse");
  await page.waitForTimeout(800);
  const moreButton = page.getByRole("button", { name: /Mehr laden/ });
  for (let i = 0; i < 10 && (await moreButton.count()) > 0; i++) {
    await moreButton.click();
    await page.waitForTimeout(400);
  }
  await page
    .locator(".rounded-lg.border.bg-card")
    .filter({ has: page.getByText(courseName, { exact: true }) })
    .getByRole("button", { name: "Jetzt buchen" })
    .click();
  await page.waitForTimeout(400);
  await page.getByRole("tab", { name: "Anmeldung" }).click();
  await page.waitForTimeout(400);
}

async function fillBookingForm(page: Page) {
  await page.getByRole("combobox").first().click();
  await page.getByRole("option").first().click();
  await page.getByText("Nur diesen Kurs").click();
  await page.waitForTimeout(200);
}

test.describe("PROJ-42: Rechtssichere Buchungsbestätigung", () => {
  test("Beschriftung: der Absende-Knopf nennt die Verbindlichkeit", async ({ page }) => {
    await login(page, CUSTOMER);
    await openBookingDialog(page, COURSE);
    await expect(page.getByRole("dialog").getByRole("button", { name: "Rechtlich verbindlich buchen" })).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Absenden", exact: true })).toHaveCount(0);
  });

  test("Beschriftung: der Wartelisten-Knopf bleibt neutral", async ({ page }) => {
    // PROJ-12s Fixture-Kurs ist voll — dort erscheint der Wartelisten-Zweig.
    await login(page, CUSTOMER);
    await openBookingDialog(page, "E2E12 Kurs");
    await expect(page.getByRole("dialog").getByRole("button", { name: "Auf Warteliste eintragen" })).toBeVisible();
    await expect(
      page.getByRole("dialog").getByRole("button", { name: "Rechtlich verbindlich buchen" })
    ).toHaveCount(0);
  });

  test("Zustimmung: das Häkchen ist beim Öffnen nicht vorausgefüllt", async ({ page }) => {
    await login(page, CUSTOMER);
    await openBookingDialog(page, COURSE);
    await expect(page.locator("#terms-accepted-booking")).toHaveAttribute("data-state", "unchecked");
  });

  test("Zustimmung: ohne Häkchen bleibt das Absenden gesperrt, mit Häkchen frei", async ({ page }) => {
    await login(page, CUSTOMER);
    await openBookingDialog(page, COURSE);
    await fillBookingForm(page);

    const knopf = page.getByRole("button", { name: "Rechtlich verbindlich buchen" });
    await expect(knopf).toBeDisabled();
    await page.locator("#terms-accepted-booking").check();
    await page.waitForTimeout(200);
    await expect(knopf).toBeEnabled();
  });

  test("Zustimmung: die AGB lassen sich nachlesen, ohne die Eingaben zu verlieren", async ({ page, context }) => {
    await login(page, CUSTOMER);
    await openBookingDialog(page, COURSE);
    await fillBookingForm(page);
    await page.getByLabel("Notiz (optional)").fill("Bitte hinten anstellen");

    const link = page.getByRole("dialog").getByRole("link", { name: "AGB" });
    await expect(link).toHaveAttribute("target", "_blank");

    const [agbTab] = await Promise.all([context.waitForEvent("page"), link.click()]);
    await agbTab.waitForLoadState();
    await expect(agbTab.getByRole("heading", { name: "Allgemeine Geschäftsbedingungen" })).toBeVisible();
    await agbTab.close();

    // Der Klick auf den Link darf die Zustimmung nicht mitschalten — er sitzt
    // im Label, ohne Gegenmaßnahme wäre das Häkchen jetzt gesetzt.
    await expect(page.locator("#terms-accepted-booking")).toHaveAttribute("data-state", "unchecked");
    await expect(page.getByLabel("Notiz (optional)")).toHaveValue("Bitte hinten anstellen");
    await expect(page.locator("#plan-single_course")).toHaveAttribute("data-state", "checked");
  });

  test("Zustimmung: der Server lehnt eine Buchung ohne Zustimmung ab", async ({ page }) => {
    // Am Browser vorbei, direkt gegen die Datenbankfunktion — genau das, was
    // ein manipulierter Client täte.
    const id = await courseId(COURSE);
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    await anon.auth.signInWithPassword(CUSTOMER);
    const { data: dates } = await anon.from("course_entry_dates").select("entry_date").eq("course_id", id).limit(1);

    for (const args of [
      { p_terms_accepted: false },
      {}, // Parameter ganz weggelassen
      { p_terms_accepted: true, p_terms_version: "   " },
    ]) {
      const { error } = await anon.rpc("create_regular_course_booking", {
        p_course_id: id,
        p_desired_plan: "single_course",
        p_chosen_date: dates![0].entry_date,
        p_note: "",
        p_prerequisite_confirmed: true,
        p_dance_role: "",
        p_coupon_code: "",
        ...args,
      });
      expect(error?.message ?? "").toMatch(/terms (not accepted|version missing)/);
    }

    const { count } = await service
      .from("course_bookings")
      .select("id", { count: "exact", head: true })
      .eq("course_id", id);
    expect(count).toBe(0);
    await page.close();
  });

  test("Nachweis: die Buchung hält Zeitpunkt und AGB-Stand fest", async ({ page }) => {
    const id = await courseId(COURSE);
    await login(page, CUSTOMER);
    await openBookingDialog(page, COURSE);
    await fillBookingForm(page);
    await page.locator("#terms-accepted-booking").check();
    await page.getByRole("button", { name: "Rechtlich verbindlich buchen" }).click();
    await expect(page.getByText("Deine Buchung ist eingegangen")).toBeVisible({ timeout: 15000 });

    const { data } = await service
      .from("course_bookings")
      .select("terms_accepted_at, terms_version")
      .eq("course_id", id)
      .single();
    expect(data!.terms_version).toBe(AGB_VERSION);
    expect(data!.terms_accepted_at).not.toBeNull();
    // Der Zeitpunkt stammt vom Server, nicht vom Browser: er darf nicht in der
    // Zukunft liegen und nicht Stunden alt sein.
    // Den Zeitstempel setzt die Datenbank, verglichen wird mit der Uhr des
    // Testrechners. Die beiden gehen um Millisekunden auseinander -- zuletzt
    // lag der Wert 52 ms "in der Zukunft" und der Test fiel um. Gemeint ist
    // "gerade eben festgehalten", nicht "auf die Millisekunde nicht voraus";
    // deshalb wird der Betrag geprueft und die Drift ausdruecklich zugelassen.
    const abstand = Date.now() - new Date(data!.terms_accepted_at!).getTime();
    expect(Math.abs(abstand), "Zeitpunkt liegt nicht 'gerade eben'").toBeLessThan(5 * 60 * 1000);
  });

  test("Nachweis: der Betreiber sieht in der Verwaltung, ob und wann zugestimmt wurde", async ({ page }) => {
    const id = await courseId(COURSE);
    const { data: dates } = await service.from("course_entry_dates").select("entry_date").eq("course_id", id).limit(1);
    const { data: kunde } = await service.from("profiles").select("id").limit(1).single();
    await service.from("course_bookings").insert({
      customer_id: kunde!.id,
      course_id: id,
      type: "regular",
      status: "open",
      desired_plan: "single_course",
      chosen_date: dates![0].entry_date,
      terms_accepted_at: new Date().toISOString(),
      terms_version: AGB_VERSION,
    });

    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForTimeout(900);
    await expect(page.locator("tr", { hasText: COURSE }).first()).toContainText(`Stand ${AGB_VERSION}`);
  });

  test("Nachweis: ein älterer AGB-Stand bleibt an der Buchung erkennbar", async ({ page }) => {
    // Die AGB werden später geändert — was damals galt, muss sichtbar bleiben.
    const id = await courseId(COURSE);
    const { data: dates } = await service.from("course_entry_dates").select("entry_date").eq("course_id", id).limit(1);
    const { data: kunde } = await service.from("profiles").select("id").limit(1).single();
    await service.from("course_bookings").insert({
      customer_id: kunde!.id,
      course_id: id,
      type: "regular",
      status: "open",
      desired_plan: "single_course",
      chosen_date: dates![0].entry_date,
      terms_accepted_at: "2026-03-15T10:00:00Z",
      terms_version: "2026-03",
    });

    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForTimeout(900);
    const zeile = page.locator("tr", { hasText: COURSE }).first();
    await expect(zeile).toContainText("Stand 2026-03");
    await expect(zeile).not.toContainText(`Stand ${AGB_VERSION}`);
  });

  test("Nachweis: eine Buchung von vor der Einführung zeigt „—“ statt eines erfundenen Zeitpunkts", async ({
    page,
  }) => {
    const id = await courseId(COURSE);
    const { data: dates } = await service.from("course_entry_dates").select("entry_date").eq("course_id", id).limit(1);
    const { data: kunde } = await service.from("profiles").select("id").limit(1).single();
    await service.from("course_bookings").insert({
      customer_id: kunde!.id,
      course_id: id,
      type: "regular",
      status: "open",
      desired_plan: "single_course",
      chosen_date: dates![0].entry_date,
      // terms_* bleiben leer, wie bei jeder Buchung von vor der Einführung
    });

    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForTimeout(900);
    const zeile = page.locator("tr", { hasText: COURSE }).first();
    await expect(zeile).toContainText("—");
    // Nicht auf „Stand" allein prüfen: der Kursname enthält das Wort selbst
    // („StandardpreisS"). Die Klammerform kommt nur im Nachweis vor.
    await expect(zeile).not.toContainText("(Stand ");
  });

  test("Nachweis: die Zustimmung lässt sich nachträglich nicht ändern oder löschen", async ({ page }) => {
    const id = await courseId(COURSE);
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    await anon.auth.signInWithPassword(CUSTOMER);
    const { data: dates } = await anon.from("course_entry_dates").select("entry_date").eq("course_id", id).limit(1);
    const { data: gebucht } = await anon.rpc("create_regular_course_booking", {
      p_course_id: id,
      p_desired_plan: "single_course",
      p_chosen_date: dates![0].entry_date,
      p_note: "",
      p_prerequisite_confirmed: true,
      p_dance_role: "",
      p_coupon_code: "",
      p_terms_accepted: true,
      p_terms_version: AGB_VERSION,
    });

    const geaendert = await anon
      .from("course_bookings")
      .update({ terms_version: "2030-01" })
      .eq("id", gebucht!.id)
      .select();
    expect(geaendert.data ?? []).toHaveLength(0);

    const geloescht = await anon
      .from("course_bookings")
      .update({ terms_accepted_at: null, terms_version: null })
      .eq("id", gebucht!.id)
      .select();
    expect(geloescht.data ?? []).toHaveLength(0);

    const { data: unveraendert } = await service
      .from("course_bookings")
      .select("terms_version")
      .eq("id", gebucht!.id)
      .single();
    expect(unveraendert!.terms_version).toBe(AGB_VERSION);
    await page.close();
  });

  test("Zustimmung: der Ticketkauf verlangt dieselbe Zustimmung", async ({ page }) => {
    await login(page, CUSTOMER);
    await page.goto("/events");
    await page.waitForTimeout(1500);
    const knopf = page.getByRole("button", { name: /Ticket kaufen|Jetzt buchen/ }).first();
    test.skip((await knopf.count()) === 0, "Aktuell kein buchbares Event vorhanden.");

    await knopf.click();
    await page.waitForTimeout(700);
    await expect(page.locator("#terms-accepted-ticket")).toHaveAttribute("data-state", "unchecked");
    const kaufen = page.getByRole("dialog").getByRole("button", { name: "Ticket kaufen" });
    await expect(kaufen).toBeDisabled();
    await page.locator("#terms-accepted-ticket").check();
    await page.waitForTimeout(200);
    await expect(kaufen).toBeEnabled();

    // Der Dialog bleibt beim Schließen gemountet — beim zweiten Öffnen darf das
    // Häkchen nicht noch gesetzt sein, sonst wäre es vorausgewählt.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await knopf.click();
    await page.waitForTimeout(700);
    await expect(page.locator("#terms-accepted-ticket")).toHaveAttribute("data-state", "unchecked");
  });

  test("Zustimmung: der Server lehnt einen Ticketkauf ohne Zustimmung ab", async () => {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    await anon.auth.signInWithPassword(CUSTOMER);
    const { data: events } = await service
      .from("events")
      .select("id")
      .eq("status", "geplant")
      .gt("starts_at", new Date().toISOString())
      .limit(1);
    test.skip(!events || events.length === 0, "Aktuell kein buchbares Event vorhanden.");

    const { error } = await anon.rpc("purchase_event_ticket", {
      p_event_id: events![0].id,
      p_payment_method: "onsite",
      p_wants_student_price: false,
    });
    expect(error?.message ?? "").toContain("terms not accepted");
  });

  test("Zustimmung: das Umbuchen verlangt eine eigene Zustimmung", async () => {
    // Der frühere Sonderweg, die Zustimmung der Ursprungsbuchung zu übernehmen,
    // war eine Hintertür: mit einer beliebigen Kennung entstand eine Buchung
    // ganz ohne Zustimmung. Der Parameter darf es nicht mehr geben.
    const id = await courseId(COURSE);
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    await anon.auth.signInWithPassword(CUSTOMER);
    const { data: dates } = await anon.from("course_entry_dates").select("entry_date").eq("course_id", id).limit(1);

    const { error } = await anon.rpc("create_self_service_booking", {
      p_course_id: id,
      p_type: "trial",
      p_chosen_date: dates![0].entry_date,
      p_prerequisite_confirmed: true,
      p_carry_terms_from: id,
    });
    expect(error?.message ?? "").toContain("Could not find the function");

    const { count } = await service
      .from("course_bookings")
      .select("id", { count: "exact", head: true })
      .eq("course_id", id);
    expect(count).toBe(0);
  });

  test("Nachweis: ein erfundener AGB-Stand wird abgelehnt (BUG-1)", async () => {
    // Der Stand ist ein Parameter, und die Funktion ist über PostgREST direkt
    // erreichbar. Ohne Prüfung könnte ein Kunde behaupten, er habe einer ganz
    // anderen Fassung zugestimmt — genau die Frage, die dieses Feature
    // beantworten soll.
    const id = await courseId(COURSE);
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    await anon.auth.signInWithPassword(CUSTOMER);
    const { data: dates } = await anon.from("course_entry_dates").select("entry_date").eq("course_id", id).limit(1);

    const buche = (version: string) =>
      anon.rpc("create_regular_course_booking", {
        p_course_id: id,
        p_desired_plan: "single_course",
        p_chosen_date: dates![0].entry_date,
        p_note: "",
        p_prerequisite_confirmed: true,
        p_dance_role: "",
        p_coupon_code: "",
        p_terms_accepted: true,
        p_terms_version: version,
      });

    const abzulehnen = [
      "1999-01", // erfundene Vergangenheit, vor der App
      "2030-01", // Zukunft — es gibt sie noch nicht
      "2026-99", // kein echter Monat
      "august 2026", // falsche Form
      "<script>alert(1)</script>" + "X".repeat(5000), // Müll und Überlänge
    ];
    for (const version of abzulehnen) {
      const { error } = await buche(version);
      expect(error?.message ?? "", `abzulehnen: ${version.slice(0, 20)}`).toMatch(/terms version/);
    }

    const { count } = await service
      .from("course_bookings")
      .select("id", { count: "exact", head: true })
      .eq("course_id", id);
    expect(count, "keiner der Versuche darf eine Buchung hinterlassen").toBe(0);

    // Gegenprobe: der echte Stand geht durch.
    const { data, error } = await buche(AGB_VERSION);
    expect(error).toBeNull();
    expect(data!.terms_version).toBe(AGB_VERSION);
  });

  test("Nachweis: die Tabelle selbst lässt keinen unsinnigen AGB-Stand zu", async () => {
    // Zweite Verteidigungslinie: auch ein künftiger Schreibweg, der an der
    // Funktion vorbeiginge, kann keinen Müll ablegen.
    const id = await courseId(COURSE);
    const { data: dates } = await service.from("course_entry_dates").select("entry_date").eq("course_id", id).limit(1);
    const { data: kunde } = await service.from("profiles").select("id").limit(1).single();
    const { error } = await service.from("course_bookings").insert({
      customer_id: kunde!.id,
      course_id: id,
      type: "regular",
      status: "open",
      desired_plan: "single_course",
      chosen_date: dates![0].entry_date,
      terms_accepted_at: new Date().toISOString(),
      terms_version: "Unsinn",
    });
    expect(error?.message ?? "").toContain("terms_version_format");
  });

  test("Nachweis: ein halber Nachweis wird von der Datenbank abgelehnt", async () => {
    const id = await courseId(COURSE);
    const { data: dates } = await service.from("course_entry_dates").select("entry_date").eq("course_id", id).limit(1);
    const { data: kunde } = await service.from("profiles").select("id").limit(1).single();

    // Ein Zeitpunkt ohne Fassung sagt nicht, wozu zugestimmt wurde.
    const { error } = await service.from("course_bookings").insert({
      customer_id: kunde!.id,
      course_id: id,
      type: "regular",
      status: "open",
      desired_plan: "single_course",
      chosen_date: dates![0].entry_date,
      terms_accepted_at: new Date().toISOString(),
    });
    expect(error?.message ?? "").toContain("terms_complete");
  });
});

// PROJ-44: Der Guthaben-Abschnitt kam mit dem Empfehlungsprogramm dazu.
test.describe("AGB: Guthaben-Abschnitt", () => {
  test.use({ locale: "de-DE" });
  test("Deutsch: Punkt 6 Guthaben, Auszahlung ausgeschlossen", async ({ page }) => {
    await page.goto("/agb");
    await page.waitForTimeout(900);
    await expect(page.getByRole("heading", { name: "6. Guthaben" })).toBeVisible();
    await expect(page.getByText("Eine Auszahlung des Guthabens ist ausgeschlossen")).toBeVisible();
    await expect(page.getByText("vom nächsten fälligen Abo-Beitrag abgezogen")).toBeVisible();
    await expect(page.getByRole("heading", { name: "7. Haftung" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "8. Schlussbestimmungen" })).toBeVisible();
  });
});

test.describe("AGB englisch", () => {
  test.use({ locale: "en-GB" });
  test("Englisch: dieselbe Aussage, übersetzt", async ({ page }) => {
    await page.goto("/en/agb");
    await page.waitForTimeout(900);
    await expect(page.getByRole("heading", { name: "6. Account credit" })).toBeVisible();
    await expect(page.getByText("Credit cannot be paid out")).toBeVisible();
    await expect(page.getByRole("heading", { name: "8. Final provisions" })).toBeVisible();
  });
});
