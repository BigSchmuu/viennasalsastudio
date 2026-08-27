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
const CUSTOMER = { email: "e2e8-customer@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER_NO_MANDATE = {
  email: "e2e8-customer-nomandate@viennasalsastudio.test",
  password: "CorrectPassword123!",
};
const CUSTOMER_TODAY = {
  email: "e2e8-customer-today@viennasalsastudio.test",
  password: "CorrectPassword123!",
};
const COURSE_NAME = "E2E8 Kurs";

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test.beforeAll(async () => {
  // The tests below drive CUSTOMER through one continuous booking-request
  // story on COURSE_NAME every run: first-ever-booking triggers the
  // acquisition-channel prompt, a second open request is blocked, admin
  // confirms the regular request (creating a subscription), rejects the
  // drop-in, and the customer reschedules/cancels their trial. None of that
  // is idempotent by itself — re-running it left referral_source
  // permanently non-null and accumulated cancelled/rejected rows behind,
  // breaking the acquisition-channel prompt and exact-count assertions on
  // every run after the first. Reset to a pristine state here so the whole
  // story reproduces identically on every run.
  const { data: list } = await service.auth.admin.listUsers({ perPage: 200 });
  const customerId = list?.users.find((u) => u.email === CUSTOMER.email)?.id;
  const { data: course } = await service.from("courses").select("id").eq("name", COURSE_NAME).single();
  if (!customerId || !course) throw new Error("PROJ-8 fixture customer/course not found");

  await service.from("profiles").update({ referral_source: null }).eq("id", customerId);
  await service.from("course_bookings").delete().eq("customer_id", customerId).eq("course_id", course.id);
  // Stornieren statt löschen: Abos, die schon in einem SEPA-Lauf abgerechnet
  // wurden, hängen an sepa_collection_items — das Löschen scheiterte dort still
  // am Fremdschlüssel, weshalb sich 23 aktive Abos desselben Kunden für
  // denselben Kurs angesammelt hatten. Aufgefallen erst, als die neue Prüfung
  // "bereits angemeldet" darauf ansprang.
  const { error: cancelError } = await service
    .from("subscriptions")
    .update({ status: "cancelled" })
    .eq("customer_id", customerId)
    .eq("course_id", course.id)
    .neq("status", "cancelled");
  if (cancelError) throw new Error(`PROJ-8 Abo-Reset fehlgeschlagen: ${cancelError.message}`);

  // Was nicht abgerechnet wurde, darf ganz weg — hält die Fixture-Daten schlank.
  await service
    .from("subscriptions")
    .delete()
    .eq("customer_id", customerId)
    .eq("course_id", course.id)
    .is("cancelled_at", null);
});

async function login(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.waitForTimeout(1000); // let hydration settle, see PROJ-2 BUG-1
  await page.getByRole("button", { name: "Einloggen" }).click();
  // Admin lands on /admin after login, every other role on /profil.
  await page.waitForURL(/\/(mein-bereich|profil|admin)$/, { timeout: 10000 });
  // Seit PROJ-45 landen Kunden auf /mein-bereich, die Pruefungen hier gelten
  // aber dem Profil. Faehrt der Test unmittelbar danach selbst woandershin,
  // ueberholt seine Navigation diese hier — auf WebKit regelmaessig. Das ist
  // kein Fehler, sondern genau das, was der Test will; darum wird die
  // Unterbrechung geschluckt statt gemeldet.
  if (page.url().endsWith("/mein-bereich")) await page.goto("/profil").catch(() => {});
}

// /profil's sections live behind a collapsed Accordion (Radix unmounts closed
// content entirely) — must expand "Meine Buchungen" before any booking <li>
// is in the DOM.
async function openBookingsSection(page: Page) {
  await page.getByRole("button", { name: "Meine Buchungen" }).click();
  await page.waitForTimeout(400);
}

// This fixture customer is shared with other suites (notably PROJ-27, which
// books its own trials for them on a different course). An unscoped
// `li:has-text("Probestunde")` therefore counts *those* bookings too and
// breaks this file's exact-count assertions whenever the suites run together.
// Always scope profile bookings to this file's own course — exact text, since
// "E2E8 Kurs" is a prefix of "E2E8 Kurs Ohne Einstieg".
function bookingItems(page: Page, type: string) {
  return page
    .locator("li")
    .filter({ has: page.getByText(COURSE_NAME, { exact: true }) })
    .filter({ hasText: type });
}

// The course catalog is paginated (PAGE_SIZE=12, "Mehr laden") — fixture
// courses created late sort past page 1 by created_at ascending.
async function loadAllCourses(page: Page) {
  await page.waitForTimeout(1000);
  const moreButton = page.getByRole("button", { name: /Mehr laden/ });
  for (let i = 0; i < 10 && (await moreButton.count()) > 0; i++) {
    await moreButton.click();
    await page.waitForTimeout(500);
  }
}

async function openBookingDialog(page: Page, courseName: string) {
  await page.goto("/kurse");
  await page.waitForTimeout(600);
  await loadAllCourses(page);
  // Scope to the Card root and require an EXACT text match — "E2E8 Kurs" is
  // a substring of "E2E8 Kurs Ohne Einstieg", so a loose hasText match
  // resolves to both cards (strict-mode violation).
  await page
    .locator(".rounded-lg.border.bg-card")
    .filter({ has: page.getByText(courseName, { exact: true }) })
    .getByRole("button", { name: "Jetzt buchen" })
    .click();
  await page.waitForTimeout(400);
}

test.describe("PROJ-8: Kursbuchung", () => {
  test("Kunde ohne Mandat sieht Hinweis mit Link zu /profil statt Anmelde-Formular", async ({ page }) => {
    await login(page, CUSTOMER_NO_MANDATE);
    await openBookingDialog(page, "E2E8 Kurs");
    await page.getByRole("tab", { name: "Anmeldung" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText("Für eine Anmeldung brauchst du zuerst ein SEPA-Mandat.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Jetzt hinterlegen" })).toBeVisible();
  });

  test("Kurs ohne Einstiegstermin zeigt Hinweis statt Formular", async ({ page }) => {
    await login(page, CUSTOMER);
    await openBookingDialog(page, "E2E8 Kurs Ohne Einstieg");
    await page.getByRole("tab", { name: "Anmeldung" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText("Aktuell keine Einstiegstermine verfügbar.")).toBeVisible();
  });

  test("Erste Buchung erzwingt Akquisitionskanal; reguläre Anfrage wird mit Status offen erstellt", async ({
    page,
  }) => {
    await login(page, CUSTOMER);
    await openBookingDialog(page, "E2E8 Kurs");
    await expect(page.getByText("Wie haben Sie von uns erfahren?")).toBeVisible();

    await page.getByRole("dialog").getByRole("combobox").first().click();
    await page.waitForTimeout(300);
    await page.getByRole("option", { name: /07\.09/ }).click();
    // PROJ-41: Die Abo-Art ist jetzt eine Kachel. Das Radio darunter ist
    // sr-only, ein Klick darauf wird von der sichtbaren Beschriftung
    // abgefangen — also die Kachel selbst anklicken, wie ein Nutzer auch.
    await page.getByText("Nur diesen Kurs").click();

    // PROJ-42: Das Absenden ist jetzt an die AGB-Zustimmung gebunden.
    await page.locator("#terms-accepted-booking").check();
    const submit = page.getByRole("button", { name: "Rechtlich verbindlich buchen" });
    await expect(submit).toBeDisabled();

    await page.getByRole("dialog").getByRole("combobox").last().click();
    await page.waitForTimeout(300);
    await page.getByRole("option", { name: "Google / Suchmaschine" }).click();
    await submit.click();
    await page.waitForTimeout(800);

    await page.goto("/profil");
    await page.waitForTimeout(600);
    await openBookingsSection(page);
    await expect(page.getByText("Offen")).toBeVisible();
    await expect(page.getByText("Nur diesen Kurs")).toBeVisible();
  });

  test("Akquisitionskanal wird bei weiteren Buchungen nicht erneut abgefragt", async ({ page }) => {
    await login(page, CUSTOMER);
    await openBookingDialog(page, "E2E8 Kurs");
    await expect(page.getByText("Wie haben Sie von uns erfahren?")).not.toBeVisible();
  });

  test("Zweite offene Anfrage für denselben Kurs wird verhindert", async ({ page }) => {
    await login(page, CUSTOMER);
    await openBookingDialog(page, "E2E8 Kurs");
    await page.getByRole("tab", { name: "Anmeldung" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText("Du hast diesen Kurs bereits gebucht — die Bestätigung steht noch aus.")).toBeVisible();
  });

  test("Probestunde wird sofort automatisch bestätigt, ohne Mandat", async ({ page }) => {
    await login(page, CUSTOMER);
    await openBookingDialog(page, "E2E8 Kurs");
    await page.getByRole("tab", { name: "Probestunde" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("dialog").getByRole("combobox").first().click();
    await page.waitForTimeout(300);
    // Nicht den ersten Termin: Er kann heute sein, wenn der Kurs heute
    // stattfindet. Am selben Tag lässt sich eine Probestunde zu Recht nicht
    // mehr umbuchen oder stornieren — und genau das prüfen die beiden Tests
    // weiter unten an dieser Buchung. Der Kurs bleibt derselbe, nur eine
    // Woche später.
    const termine = page.getByRole("option");
    const anzahlTermine = await termine.count();
    await termine.nth(anzahlTermine > 1 ? 1 : 0).click();
    // PROJ-42: Das Absenden ist jetzt an die AGB-Zustimmung gebunden.
    await page.locator("#terms-accepted-booking").check();
    await page.getByRole("button", { name: "Rechtlich verbindlich buchen" }).click();
    await page.waitForTimeout(800);

    await page.goto("/profil");
    await page.waitForTimeout(600);
    await openBookingsSection(page);
    await expect(bookingItems(page, "Probestunde").getByText("Bestätigt")).toBeVisible();
  });

  test("Drop-in zeigt Studierendenpreis live und erstellt offene Anfrage", async ({ page }) => {
    await login(page, CUSTOMER);
    await openBookingDialog(page, "E2E8 Kurs");
    await page.getByRole("tab", { name: "Drop-in" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("dialog").getByRole("combobox").first().click();
    await page.waitForTimeout(300);
    await page.getByRole("option").first().click();
    await page.getByLabel("Ich bin Student(in)").check();
    await page.waitForTimeout(200);
    await expect(page.getByText("15,00")).toBeVisible();
    // PROJ-42: Das Absenden ist jetzt an die AGB-Zustimmung gebunden.
    await page.locator("#terms-accepted-booking").check();
    await page.getByRole("button", { name: "Rechtlich verbindlich buchen" }).click();
    await page.waitForTimeout(800);

    await page.goto("/profil");
    await page.waitForTimeout(600);
    await openBookingsSection(page);
    await expect(bookingItems(page, "Drop-in").getByText(/15,00/)).toBeVisible();
  });

  test("Admin bestätigt reguläre Anfrage; legt Abo an und Kunde sieht Bestätigung", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForTimeout(600);
    // Scoped to this fixture customer: "Buchungsanfrage" alone can match
    // other courses' open regular requests too, in a shared, growing DB.
    const row = page.locator("tr", { hasText: "E2E8 Kunde" }).filter({ hasText: "Buchungsanfrage" });
    await row.getByRole("button", { name: "Bestätigen" }).click();
    await page.waitForTimeout(400);
    await page.locator("#sub-price").fill("40");
    await page.getByRole("dialog").getByRole("button", { name: "Bestätigen" }).click();
    await page.waitForTimeout(800);
    await expect(row.getByText("Bestätigt")).toBeVisible();

    await login(page, CUSTOMER);
    await page.goto("/profil");
    await page.waitForTimeout(600);
    await openBookingsSection(page);
    await expect(bookingItems(page, "Buchungsanfrage").getByText("Bestätigt")).toBeVisible();
  });

  test("Admin lehnt Drop-in-Anfrage ab; Kunde sieht Ablehnung", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForTimeout(600);
    // Scope to this fixture customer: other suites (e.g. PROJ-13) have their
    // own Drop-in rows in this shared admin table.
    const dropinRow = page.locator("tr", { hasText: "E2E8 Kunde" }).filter({ hasText: "Drop-in" });
    await dropinRow.getByRole("button", { name: "Ablehnen" }).click();
    // rejectBooking sends the rejection email synchronously and the fixture
    // accounts' ".test" domain makes that SMTP call run into a timeout, so the
    // status flip can take a while — wait for it rather than a fixed delay.
    await expect(dropinRow.getByText("Abgelehnt")).toBeVisible({ timeout: 30000 });

    await login(page, CUSTOMER);
    await page.goto("/profil");
    await page.waitForTimeout(600);
    await openBookingsSection(page);
    await expect(bookingItems(page, "Drop-in").getByText("Abgelehnt")).toBeVisible();
  });

  test("Kunde bucht Probestunde um; alte Buchung storniert, neue mit neuem Termin", async ({ page }) => {
    await login(page, CUSTOMER);
    await page.goto("/profil");
    await page.waitForTimeout(600);
    await openBookingsSection(page);
    await bookingItems(page, "Probestunde").getByRole("button", { name: "Umbuchen" }).click();
    await page.waitForTimeout(400);
    await page.getByRole("dialog").getByRole("combobox").click();
    await page.waitForTimeout(300);
    // Der letzte angebotene Termin: Auf den vorderen liegen bereits die
    // Probestunde selbst und der Drop-in aus einem früheren Test — dann
    // meldet die App zu Recht „Für diesen Termin hast du bereits eine
    // Buchung."
    const neueTermine = page.getByRole("option");
    await neueTermine.nth((await neueTermine.count()) - 1).click();
    // PROJ-42: Auch das Umbuchen legt eine neue Buchung an — sie trägt
    // ihre eigene Zustimmung, ohne Sonderweg.
    await page.locator("#terms-accepted-rebook").check();
    await page.getByRole("button", { name: "Umbuchen bestätigen" }).click();
    await page.waitForTimeout(800);

    const trialItems = bookingItems(page, "Probestunde");
    await expect(trialItems).toHaveCount(2);
    await expect(trialItems.filter({ hasText: "Storniert" })).toHaveCount(1);
    await expect(trialItems.filter({ hasText: "Bestätigt" })).toHaveCount(1);
  });

  test("Kunde storniert Probestunde; Status wechselt auf storniert", async ({ page }) => {
    await login(page, CUSTOMER);
    await page.goto("/profil");
    await page.waitForTimeout(600);
    await openBookingsSection(page);
    await bookingItems(page, "Probestunde")
      .filter({ hasText: "Bestätigt" })
      .getByRole("button", { name: "Stornieren" })
      .click();
    await page.waitForTimeout(800);
    await expect(bookingItems(page, "Probestunde").filter({ hasText: "Storniert" })).toHaveCount(2);
  });

  test("Buchung innerhalb der 1-Tages-Frist zeigt keine Stornieren-Aktion mehr an", async ({ page }) => {
    // Fixture: a dedicated customer with a single trial booking dated "today"
    // was seeded directly via SQL (chosen_date = current_date), since the UI
    // itself has no way to reach a same-day slot deterministically. Isolated
    // to its own account so it can't pollute other tests' booking-count
    // assertions. The app enforces the 1-day lead time server-side in
    // cancelBooking() via daysUntil() (unit tested separately) — the UI
    // additionally hides the action entirely once the deadline has passed,
    // which is a stronger guarantee than a click-then-reject flow and still
    // satisfies the spec's intent.
    await login(page, CUSTOMER_TODAY);
    await page.goto("/profil");
    await page.waitForTimeout(600);
    await openBookingsSection(page);
    const todayBookingItem = page.locator("li", { hasText: "Probestunde" }).filter({ hasText: "Bestätigt" });
    await expect(todayBookingItem).toHaveCount(1);
    await expect(todayBookingItem.getByRole("button", { name: "Stornieren" })).toHaveCount(0);
  });

  test("Admin ändert Drop-in-Preise; neuer Preis gilt sofort für neue Buchungen", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForTimeout(600);
    await page.locator("#normal-price").fill("25");
    await page.locator("#student-price").fill("18");
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(600);
    await expect(page.getByText("Preise gespeichert.")).toBeVisible();

    await login(page, CUSTOMER);
    await openBookingDialog(page, "E2E8 Kurs");
    await page.getByRole("tab", { name: "Drop-in" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText("25,00")).toBeVisible();

    // Restore the baseline pricing this file's earlier "Studierendenpreis"
    // test depends on (15,00) — global pricing is shared state with no
    // per-test reset, so leaving it changed breaks that test on a re-run.
    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForTimeout(600);
    await page.locator("#normal-price").fill("20");
    await page.locator("#student-price").fill("15");
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(600);
    await expect(page.getByText("Preise gespeichert.")).toBeVisible();
  });

  // Fix nach dem PROJ-38-QA: Ein bereits eingeschriebener Kunde konnte denselben
  // Kurs erneut anfragen. Bestätigte der Admin, entstand ein zweites Abo — und
  // damit ein doppelter SEPA-Einzug, Monat für Monat. Nachgewiesen an einem
  // Kunden mit 23 aktiven Abos für denselben Kurs.
  test("Ein eingeschriebener Kunde kann denselben Kurs nicht erneut buchen", async ({ page }) => {
    const { data: list } = await service.auth.admin.listUsers({ perPage: 200 });
    const customerId = list!.users.find((u) => u.email === CUSTOMER.email)!.id;
    const { data: course } = await service.from("courses").select("id, price").eq("name", COURSE_NAME).single();

    // Einschreibung herstellen und offene Anfragen wegräumen, damit wirklich
    // das Abo blockt und nicht "bereits angefragt".
    await service.from("course_bookings").delete().eq("customer_id", customerId).eq("course_id", course!.id).eq("status", "open");
    const { data: abo } = await service
      .from("subscriptions")
      .insert({
        customer_id: customerId,
        course_id: course!.id,
        name: "Doppelbuchungs-Test",
        status: "active",
        price: course!.price ?? 45,
      })
      .select("id")
      .single();

    try {
      await login(page, CUSTOMER);
      await page.goto(`/kurse/${course!.id}`);
      await page.waitForTimeout(1500);
      await page.getByRole("button", { name: "Jetzt buchen" }).first().click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      await expect(dialog.getByText("bereits angemeldet")).toBeVisible();
      // PROJ-42: Das Absenden ist jetzt an die AGB-Zustimmung gebunden.
      await dialog.locator("#terms-accepted-booking").check();
      await expect(dialog.getByRole("button", { name: "Rechtlich verbindlich buchen" })).toBeDisabled();

      // Der wichtigere Teil: Auch am Formular vorbei, direkt gegen die
      // Datenbank, darf keine zweite Einschreibung entstehen.
      const anon = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
      );
      const { data: auth } = await anon.auth.signInWithPassword(CUSTOMER);
      expect(auth?.user).toBeTruthy();
      const { data: termine } = await service
        .from("course_entry_dates")
        .select("entry_date")
        .eq("course_id", course!.id)
        .limit(1);
      const { data: neueBuchung, error } = await anon.rpc("create_regular_course_booking", {
        p_course_id: course!.id,
        p_desired_plan: "single_course",
        p_chosen_date: termine![0].entry_date,
        p_note: "",
        p_prerequisite_confirmed: true,
        p_dance_role: "",
        p_coupon_code: "",
        // PROJ-42: Die Zustimmung wird vor allen anderen Prüfungen abgefragt.
        // Hier wird die Doppelanmeldungs-Sperre geprüft, nicht die Zustimmung —
        // also mitschicken, wie es die Server Action auch tut.
        p_terms_accepted: true,
        p_terms_version: "2026-08",
      });
      if (neueBuchung) await service.from("course_bookings").delete().eq("id", neueBuchung.id);
      expect(error?.message, "Die Datenbank muss die zweite Einschreibung ablehnen").toContain("already enrolled");
    } finally {
      await service.from("subscriptions").delete().eq("id", abo!.id);
    }
  });
});
