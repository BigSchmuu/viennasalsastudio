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

const STANDARD_COURSE = "E2E41 Kurs Standardpreis"; // kein eigener Preis
const EIGEN_COURSE = "E2E41 Kurs Eigenpreis"; // eigener Preis 80 €

// Die Preisliste ist studioweit — jeder Test, der sie anfasst, muss sie
// zurückstellen, sonst zieht er die übrigen Suiten mit. Es gibt keine
// Staging-Datenbank; alles hier läuft gegen die echte.
const BASELINE = {
  normal_price: 20,
  student_price: 15,
  course_price: 65,
  course_student_price: 45,
  flatrate_price: 145,
  flatrate_student_price: 100,
};

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function resetPricing() {
  const { data: row } = await service.from("dropin_pricing").select("id").limit(1).single();
  if (!row) throw new Error("PROJ-41: Preiszeile fehlt");
  const { error } = await service.from("dropin_pricing").update(BASELINE).eq("id", row.id);
  if (error) throw new Error(`PROJ-41: Preisliste ließ sich nicht zurücksetzen: ${error.message}`);
}

async function resetCourses() {
  const names = [STANDARD_COURSE, EIGEN_COURSE];
  const { data: courses } = await service.from("courses").select("id, name").in("name", names);
  for (const name of names) {
    if (!courses?.some((c) => c.name === name)) throw new Error(`PROJ-41 Fixture-Kurs fehlt: ${name}`);
  }
  const byName = new Map((courses ?? []).map((c) => [c.name, c.id]));
  // Die Preise sind das, was diese Suite prüft — und ein Test leert einen
  // davon. Ohne Reset liefe die Suite genau einmal richtig.
  await service.from("courses").update({ price: null }).eq("id", byName.get(STANDARD_COURSE)!);
  await service.from("courses").update({ price: 80 }).eq("id", byName.get(EIGEN_COURSE)!);
  // Offene Anfragen aus einem früheren Lauf blockieren sonst den Dialog.
  const ids = [...byName.values()];
  await service.from("course_bookings").delete().in("course_id", ids);
  await service.from("subscriptions").delete().in("course_id", ids);
}

test.beforeAll(async () => {
  await resetPricing();
});

// Vor *jedem* Test, nicht nur vor dem ersten. Zwei Gründe: eine abgeschickte
// Anfrage lässt den Dialog beim nächsten Öffnen „Du hast bereits eine offene
// Anfrage" zeigen statt des Formulars, und ein Test leert absichtlich einen
// Kurspreis. Ohne Reset vor jedem Test hinge das Ergebnis an der Reihenfolge —
// und es gibt keine Staging-Datenbank, die das abfedern würde.
test.beforeEach(async () => {
  await resetCourses();
});

test.afterAll(async () => {
  await resetPricing();
});

async function login(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.waitForTimeout(1000); // let hydration settle, see PROJ-2 BUG-1
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL(/\/(mein-bereich|profil|admin)$/, { timeout: 10000 });
  // Seit PROJ-45 landen Kunden auf /mein-bereich. Die Prüfungen hier gelten
  // dem Profil — also dorthin, wo der Test vorher schon stand.
  if (page.url().endsWith("/mein-bereich")) await page.goto("/profil");
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

/** Die Kachel als Ganzes — Preis und Beschriftung müssen zusammen stimmen. */
function tile(page: Page, label: string) {
  return page.getByRole("dialog").locator("label").filter({ hasText: label });
}

test.describe("PROJ-41: Preise bei der Kursbuchung", () => {
  test("Preise pflegen: Verwaltung zeigt Kursabo- und Flatrate-Felder neben den Drop-in-Preisen", async ({
    page,
  }) => {
    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForTimeout(800);
    await expect(page.locator("#course-price")).toHaveValue("65");
    await expect(page.locator("#course-student-price")).toHaveValue("45");
    await expect(page.locator("#flatrate-price")).toHaveValue("145");
    await expect(page.locator("#flatrate-student-price")).toHaveValue("100");
    // Die bestehenden Drop-in-Preise stehen weiterhin an derselben Stelle.
    await expect(page.locator("#normal-price")).toHaveValue("20");
    await expect(page.locator("#student-price")).toHaveValue("15");
  });

  test("Preise pflegen: geänderter Standardpreis erscheint im Buchungsdialog des Kunden", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForTimeout(800);
    await page.locator("#course-price").fill("70");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Preise gespeichert.")).toBeVisible({ timeout: 10000 });

    await login(page, CUSTOMER);
    await openBookingDialog(page, STANDARD_COURSE);
    await expect(tile(page, "Nur diesen Kurs")).toContainText("70,00");

    await resetPricing();
  });

  test("Preise pflegen: negativer und unrealistisch hoher Betrag werden abgelehnt", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForTimeout(800);

    await page.locator("#course-price").fill("-5");
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByText("Preise gespeichert.")).toHaveCount(0);

    await page.locator("#course-price").fill("99999");
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByText("Preise gespeichert.")).toHaveCount(0);

    // Der bisherige Wert muss die Ablehnung überlebt haben.
    const { data } = await service.from("dropin_pricing").select("course_price").limit(1).single();
    expect(Number(data!.course_price)).toBe(65);
  });

  test("Kurs-Einzelpreis: Kurs ohne eigenen Preis übernimmt den Standard", async ({ page }) => {
    await login(page, CUSTOMER);
    await openBookingDialog(page, STANDARD_COURSE);
    await expect(tile(page, "Nur diesen Kurs")).toContainText("65,00");
  });

  test("Kurs-Einzelpreis: eigener Kurspreis schlägt den Standard, andere Kurse bleiben unberührt", async ({
    page,
  }) => {
    await login(page, CUSTOMER);
    await openBookingDialog(page, EIGEN_COURSE);
    await expect(tile(page, "Nur diesen Kurs")).toContainText("80,00");
    // Die Flatrate ist kursunabhängig und darf sich nicht mitverschieben.
    await expect(tile(page, "Flatrate")).toContainText("145,00");

    await page.keyboard.press("Escape");
    await openBookingDialog(page, STANDARD_COURSE);
    await expect(tile(page, "Nur diesen Kurs")).toContainText("65,00");
  });

  test("Kurs-Einzelpreis: geleertes Preisfeld lässt wieder den Standard gelten", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/kurse");
    await page.waitForTimeout(800);
    await page
      .getByRole("row", { name: new RegExp(EIGEN_COURSE) })
      .getByRole("button", { name: "Bearbeiten" })
      .click();
    await page.waitForTimeout(500);
    await page.getByLabel(/Preis pro Monat/).fill("");
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(1200);

    await login(page, CUSTOMER);
    await openBookingDialog(page, EIGEN_COURSE);
    await expect(tile(page, "Nur diesen Kurs")).toContainText("65,00");
  });

  test("Buchungsdialog: zwei Kacheln mit Preis pro Monat und Erläuterung", async ({ page }) => {
    await login(page, CUSTOMER);
    await openBookingDialog(page, STANDARD_COURSE);

    const kurs = tile(page, "Nur diesen Kurs");
    await expect(kurs).toContainText("65,00");
    await expect(kurs).toContainText("/ Monat");
    await expect(kurs).toContainText("Dieser eine Kurs, wöchentlich");

    const flat = tile(page, "Flatrate");
    await expect(flat).toContainText("145,00");
    await expect(flat).toContainText("/ Monat");
    await expect(flat).toContainText("Alle Kurse, so oft du willst");
  });

  test("Buchungsdialog: gewählte Kachel ist erkennbar und wird beim Absenden übernommen", async ({ page }) => {
    await login(page, CUSTOMER);
    await openBookingDialog(page, STANDARD_COURSE);
    await page.getByRole("combobox").first().click();
    await page.getByRole("option").first().click();
    await tile(page, "Flatrate").click();
    await page.waitForTimeout(300);

    // Die Auswahl ist sichtbar am gesetzten Radio-Zustand der Kachel.
    await expect(page.locator("#plan-flatrate")).toHaveAttribute("data-state", "checked");
    await expect(page.locator("#plan-single_course")).toHaveAttribute("data-state", "unchecked");

    // PROJ-42: Das Absenden ist jetzt an die AGB-Zustimmung gebunden.
    await page.locator("#terms-accepted-booking").check();
    await page.getByRole("button", { name: "Rechtlich verbindlich buchen" }).click();
    await page.waitForTimeout(3000);

    const { data: course } = await service.from("courses").select("id").eq("name", STANDARD_COURSE).single();
    const { data: booking } = await service
      .from("course_bookings")
      .select("desired_plan, price")
      .eq("course_id", course!.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(booking!.desired_plan).toBe("flatrate");
    expect(Number(booking!.price)).toBe(145);
  });

  test("Buchungsdialog: Studierendenangabe schaltet beide Kacheln auf den ermäßigten Preis", async ({ page }) => {
    await login(page, CUSTOMER);
    await openBookingDialog(page, STANDARD_COURSE);
    await page.getByLabel("Ich bin Student(in)").check();
    await page.waitForTimeout(300);
    await expect(tile(page, "Nur diesen Kurs")).toContainText("45,00");
    await expect(tile(page, "Flatrate")).toContainText("100,00");
  });

  test("Buchungsdialog: ohne gewählte Abo-Art bleibt das Absenden gesperrt", async ({ page }) => {
    await login(page, CUSTOMER);
    await openBookingDialog(page, STANDARD_COURSE);
    await page.getByRole("combobox").first().click();
    await page.getByRole("option").first().click();
    await page.waitForTimeout(300);
    // PROJ-42: Das Absenden ist jetzt an die AGB-Zustimmung gebunden.
    await page.locator("#terms-accepted-booking").check();
    await expect(page.getByRole("button", { name: "Rechtlich verbindlich buchen" })).toBeDisabled();
  });

  test("Verlässlichkeit: der Betreiber bekommt genau den Preis vorgeschlagen, den der Kunde sah", async ({
    page,
  }) => {
    await login(page, CUSTOMER);
    await openBookingDialog(page, STANDARD_COURSE);
    await page.getByRole("combobox").first().click();
    await page.getByRole("option").first().click();
    await page.getByLabel("Ich bin Student(in)").check();
    await page.waitForTimeout(300);
    await expect(tile(page, "Nur diesen Kurs")).toContainText("45,00");
    await tile(page, "Nur diesen Kurs").click();
    // PROJ-42: Das Absenden ist jetzt an die AGB-Zustimmung gebunden.
    await page.locator("#terms-accepted-booking").check();
    await page.getByRole("button", { name: "Rechtlich verbindlich buchen" }).click();
    await page.waitForTimeout(3000);

    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForTimeout(900);
    const row = page.locator("tr", { hasText: STANDARD_COURSE }).first();
    await row.getByRole("button", { name: "Bestätigen" }).click();
    await page.waitForTimeout(600);
    await expect(page.locator("#sub-price")).toHaveValue("45");
  });

  test("Verlässlichkeit: eine spätere Preisänderung verschiebt eine offene Anfrage nicht", async ({ page }) => {
    await login(page, CUSTOMER);
    await openBookingDialog(page, STANDARD_COURSE);
    await page.getByRole("combobox").first().click();
    await page.getByRole("option").first().click();
    await tile(page, "Nur diesen Kurs").click();
    // PROJ-42: Das Absenden ist jetzt an die AGB-Zustimmung gebunden.
    await page.locator("#terms-accepted-booking").check();
    await page.getByRole("button", { name: "Rechtlich verbindlich buchen" }).click();
    await page.waitForTimeout(3000);

    // Der Betreiber ändert danach den Standardpreis.
    const { data: row } = await service.from("dropin_pricing").select("id").limit(1).single();
    await service.from("dropin_pricing").update({ course_price: 90 }).eq("id", row!.id);

    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForTimeout(900);
    const bookingRow = page.locator("tr", { hasText: STANDARD_COURSE }).first();
    await bookingRow.getByRole("button", { name: "Bestätigen" }).click();
    await page.waitForTimeout(600);
    // Zugesagt war 65 — die Änderung auf 90 darf die Zusage nicht bewegen.
    await expect(page.locator("#sub-price")).toHaveValue("65");

    await resetPricing();
  });

  test("Verlässlichkeit: ohne gepflegten Standardpreis erscheint ein Hinweis statt 0,00 € und Buchen bleibt möglich", async ({
    page,
  }) => {
    const { data: row } = await service.from("dropin_pricing").select("id").limit(1).single();
    await service
      .from("dropin_pricing")
      .update({ course_price: null, course_student_price: null })
      .eq("id", row!.id);

    await login(page, CUSTOMER);
    await openBookingDialog(page, STANDARD_COURSE);
    await expect(tile(page, "Nur diesen Kurs")).toContainText("Preis auf Anfrage");
    await expect(tile(page, "Nur diesen Kurs")).not.toContainText("0,00");

    await page.getByRole("combobox").first().click();
    await page.getByRole("option").first().click();
    await tile(page, "Nur diesen Kurs").click();
    await page.waitForTimeout(300);
    // PROJ-42: Das Absenden ist jetzt an die AGB-Zustimmung gebunden.
    await page.locator("#terms-accepted-booking").check();
    await expect(page.getByRole("button", { name: "Rechtlich verbindlich buchen" })).toBeEnabled();

    await resetPricing();
  });

  test("Gast ohne Konto sieht den Preis auf der Kurskarte", async ({ page }) => {
    // Der Buchungsdialog verlangt eine Anmeldung. Wer sich erst überlegt, ob er
    // herkommt, soll den Preis trotzdem sehen — deshalb steht er auf der Karte.
    await page.goto("/kurse");
    await page.waitForTimeout(800);
    const moreButton = page.getByRole("button", { name: /Mehr laden/ });
    for (let i = 0; i < 10 && (await moreButton.count()) > 0; i++) {
      await moreButton.click();
      await page.waitForTimeout(400);
    }
    const karte = page
      .locator(".rounded-lg.border.bg-card")
      .filter({ has: page.getByText(STANDARD_COURSE, { exact: true }) });
    await expect(karte).toContainText("65,00");
    await expect(karte).toContainText("/ Monat");
    await expect(karte).toContainText("ermäßigt");

    const eigen = page
      .locator(".rounded-lg.border.bg-card")
      .filter({ has: page.getByText(EIGEN_COURSE, { exact: true }) });
    await expect(eigen).toContainText("80,00");
  });

  test("Gast ohne Konto sieht den Preis auch auf der Kursdetailseite", async ({ page }) => {
    const { data: course } = await service.from("courses").select("id").eq("name", STANDARD_COURSE).single();
    await page.goto(`/kurse/${course!.id}`);
    await page.waitForTimeout(800);
    await expect(page.getByText("65,00").first()).toBeVisible();
  });

  test("Preise pflegen: Studierendenpreis über dem Normalpreis wird abgelehnt", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForTimeout(800);
    await page.locator("#course-student-price").fill("99");
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText(/Studierendenpreis darf nicht über dem Normalpreis/)).toBeVisible();
    await expect(page.getByText("Preise gespeichert.")).toHaveCount(0);

    // Der bisherige Wert muss die Ablehnung überlebt haben.
    const { data } = await service.from("dropin_pricing").select("course_student_price").limit(1).single();
    expect(Number(data!.course_student_price)).toBe(45);
  });

  test("Kurs-Formular erklärt, dass ein leeres Preisfeld den Standardpreis bedeutet", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/kurse");
    await page.waitForTimeout(800);
    await page
      .getByRole("row", { name: new RegExp(STANDARD_COURSE) })
      .getByRole("button", { name: "Bearbeiten" })
      .click();
    await page.waitForTimeout(600);
    const feld = page.getByLabel(/Preis pro Monat/);
    await expect(feld).toHaveAttribute("placeholder", "65");
    await expect(page.getByText(/Leer lassen, damit der Standardpreis von 65 € gilt/)).toBeVisible();
  });
});
