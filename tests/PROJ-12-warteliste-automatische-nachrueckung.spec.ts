import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// The Playwright runner doesn't auto-load .env.local (unlike `next dev`), but
// the fixture reset below needs SUPABASE_SERVICE_ROLE_KEY.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Already loaded (e.g. CI env vars set directly) — safe to ignore.
}

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER_NOMANDATE = {
  email: "e2e12-nomandate@viennasalsastudio.test",
  password: "CorrectPassword123!",
};
const CUSTOMER_A = { email: "e2e12-a@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER_HOLDER = { email: "e2e12-holder@viennasalsastudio.test", password: "CorrectPassword123!" };

async function login(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.waitForTimeout(1000); // let hydration settle, see PROJ-2 BUG-1
  await page.getByRole("button", { name: "Einloggen" }).click();
  // Admin lands on /admin after login, every other role on /profil.
  await page.waitForURL(/\/(profil|admin)$/, { timeout: 10000 });
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
  await page
    .locator(".rounded-lg.border.bg-card")
    .filter({ has: page.getByText(courseName, { exact: true }) })
    .getByRole("button", { name: "Jetzt buchen" })
    .click();
  await page.waitForTimeout(400);
  await page.getByRole("tab", { name: "Anmeldung" }).click();
  await page.waitForTimeout(300);
}

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CHOSEN_DATE = "2026-09-07";

test.beforeAll(async () => {
  // AC6 rejects Holder2's request, which promotes Nachruecker off the
  // waitlist into a real booking — consuming the very waitlist entry AC8
  // asserts on and leaving nothing left to reject. The suite was therefore
  // one-shot. Rebuild the documented baseline here on every run:
  //   E2E12 Kurs         -> Preischeck holds the single slot (open request)
  //   E2E12 Nachrück Kurs -> Holder2 holds the slot, Nachruecker waits
  const { data: courses } = await service.from("courses").select("id, name").like("name", "E2E12%");
  const kurs = courses?.find((c) => c.name === "E2E12 Kurs");
  const nachrueckKurs = courses?.find((c) => c.name === "E2E12 Nachrück Kurs");
  if (!kurs || !nachrueckKurs) throw new Error("PROJ-12 fixture courses not found");

  const { data: users } = await service.auth.admin.listUsers({ perPage: 200 });
  const idFor = (email: string) => users?.users.find((u) => u.email === email)?.id;
  const preischeckId = idFor("e2e12-preischeck@viennasalsastudio.test");
  const holder2Id = idFor("e2e12-holder2@viennasalsastudio.test");
  const nachrueckerId = idFor("e2e12-nachruecker@viennasalsastudio.test");
  if (!preischeckId || !holder2Id || !nachrueckerId) throw new Error("PROJ-12 fixture customers not found");

  const courseIds = [kurs.id, nachrueckKurs.id];
  await service.from("course_bookings").delete().in("course_id", courseIds);
  await service.from("waitlist_entries").delete().in("course_id", courseIds);
  await service.from("subscriptions").delete().in("course_id", courseIds);

  const { error: bookingError } = await service.from("course_bookings").insert([
    {
      customer_id: preischeckId,
      course_id: kurs.id,
      type: "regular",
      status: "open",
      desired_plan: "single_course",
      chosen_date: CHOSEN_DATE,
    },
    {
      customer_id: holder2Id,
      course_id: nachrueckKurs.id,
      type: "regular",
      status: "open",
      desired_plan: "single_course",
      chosen_date: CHOSEN_DATE,
    },
  ]);
  if (bookingError) throw new Error(`Could not seed PROJ-12 bookings: ${bookingError.message}`);

  const { error: waitlistError } = await service.from("waitlist_entries").insert({
    customer_id: nachrueckerId,
    course_id: nachrueckKurs.id,
    desired_plan: "single_course",
    chosen_date: CHOSEN_DATE,
  });
  if (waitlistError) throw new Error(`Could not seed PROJ-12 waitlist entry: ${waitlistError.message}`);

  // AC9 needs a customer who is already enrolled in "E2E12 Kurs". The cleanup
  // above wipes every subscription for these courses, so it has to be put back
  // here — otherwise AC9 asserts a rejection that can never happen, which is
  // exactly how it started failing.
  const holderId = idFor("e2e12-holder@viennasalsastudio.test");
  if (!holderId) throw new Error("PROJ-12 fixture customer 'holder' not found");
  const { error: subscriptionError } = await service.from("subscriptions").insert({
    customer_id: holderId,
    course_id: kurs.id,
    name: "E2E12 Holder Abo",
    status: "active",
    price: 45,
    cycle_anchor_date: CHOSEN_DATE,
  });
  if (subscriptionError) {
    throw new Error(`Could not seed PROJ-12 holder subscription: ${subscriptionError.message}`);
  }
});

test.describe("PROJ-12: Warteliste & automatische Nachrückung", () => {
  test("AC1: Voller Kurs zeigt Warteliste-Hinweis statt Anmeldeformular, Katalog zeigt 'Ausgebucht'", async ({
    page,
  }) => {
    await page.goto("/kurse");
    await page.waitForTimeout(600);
    await loadAllCourses(page);
    const card = page
      .locator(".rounded-lg.border.bg-card")
      .filter({ has: page.getByText("E2E12 Kurs", { exact: true }) });
    await expect(card.getByText("Ausgebucht")).toBeVisible();

    await login(page, CUSTOMER_A);
    await openBookingDialog(page, "E2E12 Kurs");
    await expect(page.getByText("Dieser Kurs ist aktuell voll.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Auf Warteliste eintragen" })).toBeVisible();
  });

  test("AC2: Kunde ohne SEPA-Mandat sieht Mandat-Hinweis statt Warteliste-Formular", async ({ page }) => {
    await login(page, CUSTOMER_NOMANDATE);
    await openBookingDialog(page, "E2E12 Kurs");
    await expect(page.getByText("Für eine Anmeldung brauchst du zuerst ein SEPA-Mandat.")).toBeVisible();
  });

  test("AC9: Kunde mit aktivem Abo für den Kurs sieht Hinweis statt Warteliste-Option", async ({ page }) => {
    await login(page, CUSTOMER_HOLDER);
    await openBookingDialog(page, "E2E12 Kurs");
    // Der Dialog sagt es jetzt vorab, statt das Formular anzubieten und die
    // Eingabe erst beim Absenden abzulehnen. Der frühere Umweg — ausfüllen,
    // abschicken, serverseitige Ablehnung abwarten — war eine Notlösung,
    // solange der Hinweis fehlte; die Überschrift dieses Kriteriums verlangt
    // genau das, was jetzt passiert.
    await expect(page.getByRole("dialog").getByText("bereits angemeldet")).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Auf Warteliste eintragen" })).toHaveCount(0);
  });

  test("AC3/AC4: Kunde trägt sich auf die Warteliste ein, sieht Position im Profil und trägt sich wieder aus", async ({
    page,
  }) => {
    await login(page, CUSTOMER_A);
    await openBookingDialog(page, "E2E12 Kurs");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option").first().click();
    await page.getByText("Nur diesen Kurs").click();
    await page.getByRole("button", { name: "Auf Warteliste eintragen" }).click();
    await page.waitForTimeout(800);

    await page.goto("/profil");
    await page.waitForTimeout(600);
    // /profil's sections live behind a collapsed Accordion (Radix unmounts
    // closed content entirely) — must expand "Meine Warteliste" first.
    await page.getByRole("button", { name: "Meine Warteliste" }).click();
    await page.waitForTimeout(400);
    const entry = page.locator("li", { hasText: "E2E12 Kurs" });
    await expect(entry.getByText(/Position 1/)).toBeVisible();

    await entry.getByRole("button", { name: "Von der Warteliste austragen" }).click();
    await page.waitForTimeout(800);
    await expect(page.locator("li", { hasText: "E2E12 Kurs" })).toHaveCount(0);
  });

  test("AC7: Preisfeld im Admin-Bestätigungsdialog ist mit dem festen Kurspreis vorausgefüllt", async ({
    page,
  }) => {
    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForTimeout(600);
    const row = page.locator("tr", { hasText: "E2E12 Preischeck" });
    await row.getByRole("button", { name: "Bestätigen" }).click();
    await page.waitForTimeout(400);
    await expect(page.locator("#sub-price")).toHaveValue("55");
  });

  test("AC8: Admin sieht Wartelisten-Übersicht mit Position, Kunde, Termin und kann Einträge entfernen", async ({
    page,
  }) => {
    await login(page, ADMIN);
    await page.goto("/admin/kurse");
    await page.waitForTimeout(600);
    const row = page.locator("tr", { hasText: "E2E12 Nachrück Kurs" });
    await row.getByRole("button", { name: /wartend/ }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText("E2E12 Nachruecker")).toBeVisible();
    await expect(page.getByText("1", { exact: true }).first()).toBeVisible();
  });

  test("AC6: Admin lehnt offene Anfrage ab, nächster Wartelisten-Eintrag rückt automatisch nach", async ({
    page,
  }) => {
    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForTimeout(600);
    const row = page.locator("tr", { hasText: "E2E12 Holder2" }).filter({ hasText: "E2E12 Nachrück Kurs" });
    await row.getByRole("button", { name: "Ablehnen" }).click();

    // rejectBooking sends the customer's rejection email *synchronously*
    // before it promotes the waitlist, and the fixture accounts' ".test"
    // domain makes that SMTP call run into a timeout — so a fixed short wait
    // races the action. Wait for the status badge instead: it only flips once
    // the server action has actually returned, i.e. after the promotion ran.
    await expect(row.getByText("Abgelehnt")).toBeVisible({ timeout: 30000 });

    await page.reload();
    await page.waitForTimeout(600);
    await expect(page.locator("tr", { hasText: "E2E12 Nachruecker" })).toBeVisible();
  });

  test("Admin: Max. Teilnehmer und Preis sind im Kurs-Formular editierbar", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/kurse");
    await page.waitForTimeout(600);
    const row = page.locator("tr", { hasText: "E2E12 Kurs" }).first();
    await row.getByRole("button", { name: "Bearbeiten" }).click();
    await page.waitForTimeout(400);
    await expect(page.getByLabel(/Max\. Teilnehmer/)).toHaveValue("1");
    await expect(page.getByLabel(/Preis pro Monat/)).toHaveValue("55");
  });
});
