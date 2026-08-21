import { test, expect, type Page } from "@playwright/test";

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

async function login(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.waitForTimeout(1000); // let hydration settle, see PROJ-2 BUG-1
  await page.getByRole("button", { name: "Einloggen" }).click();
  // Admin lands on /admin after login, every other role on /profil.
  await page.waitForURL(/\/(profil|admin)$/, { timeout: 10000 });
}

// /profil's sections live behind a collapsed Accordion (Radix unmounts closed
// content entirely) — must expand "Meine Buchungen" before any booking <li>
// is in the DOM.
async function openBookingsSection(page: Page) {
  await page.getByRole("button", { name: "Meine Buchungen" }).click();
  await page.waitForTimeout(400);
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
    await page.getByLabel("Nur diesen Kurs").click();

    const submit = page.getByRole("button", { name: "Absenden" });
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
    await expect(page.getByText("Du hast bereits eine offene Anfrage für diesen Kurs.")).toBeVisible();
  });

  test("Probestunde wird sofort automatisch bestätigt, ohne Mandat", async ({ page }) => {
    await login(page, CUSTOMER);
    await openBookingDialog(page, "E2E8 Kurs");
    await page.getByRole("tab", { name: "Probestunde" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("dialog").getByRole("combobox").first().click();
    await page.waitForTimeout(300);
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: "Absenden" }).click();
    await page.waitForTimeout(800);

    await page.goto("/profil");
    await page.waitForTimeout(600);
    await openBookingsSection(page);
    await expect(page.locator("li", { hasText: "Probestunde" }).getByText("Bestätigt")).toBeVisible();
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
    await page.getByRole("button", { name: "Absenden" }).click();
    await page.waitForTimeout(800);

    await page.goto("/profil");
    await page.waitForTimeout(600);
    await openBookingsSection(page);
    await expect(page.locator("li", { hasText: "Drop-in" }).getByText(/15,00/)).toBeVisible();
  });

  test("Admin bestätigt reguläre Anfrage; legt Abo an und Kunde sieht Bestätigung", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForTimeout(600);
    await page
      .locator("tr", { hasText: "Buchungsanfrage" })
      .getByRole("button", { name: "Bestätigen" })
      .click();
    await page.waitForTimeout(400);
    await page.locator("#sub-price").fill("40");
    await page.getByRole("dialog").getByRole("button", { name: "Bestätigen" }).click();
    await page.waitForTimeout(800);
    await expect(page.locator("tr", { hasText: "Buchungsanfrage" }).getByText("Bestätigt")).toBeVisible();

    await login(page, CUSTOMER);
    await page.goto("/profil");
    await page.waitForTimeout(600);
    await openBookingsSection(page);
    await expect(page.locator("li", { hasText: "Buchungsanfrage" }).getByText("Bestätigt")).toBeVisible();
  });

  test("Admin lehnt Drop-in-Anfrage ab; Kunde sieht Ablehnung", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForTimeout(600);
    await page.locator("tr", { hasText: "Drop-in" }).getByRole("button", { name: "Ablehnen" }).click();
    await page.waitForTimeout(600);
    await expect(page.locator("tr", { hasText: "Drop-in" }).getByText("Abgelehnt")).toBeVisible();

    await login(page, CUSTOMER);
    await page.goto("/profil");
    await page.waitForTimeout(600);
    await openBookingsSection(page);
    await expect(page.locator("li", { hasText: "Drop-in" }).getByText("Abgelehnt")).toBeVisible();
  });

  test("Kunde bucht Probestunde um; alte Buchung storniert, neue mit neuem Termin", async ({ page }) => {
    await login(page, CUSTOMER);
    await page.goto("/profil");
    await page.waitForTimeout(600);
    await openBookingsSection(page);
    await page.locator("li", { hasText: "Probestunde" }).getByRole("button", { name: "Umbuchen" }).click();
    await page.waitForTimeout(400);
    await page.getByRole("dialog").getByRole("combobox").click();
    await page.waitForTimeout(300);
    await page.getByRole("option").nth(1).click();
    await page.getByRole("button", { name: "Umbuchen bestätigen" }).click();
    await page.waitForTimeout(800);

    const trialItems = page.locator("li", { hasText: "Probestunde" });
    await expect(trialItems).toHaveCount(2);
    await expect(trialItems.filter({ hasText: "Storniert" })).toHaveCount(1);
    await expect(trialItems.filter({ hasText: "Bestätigt" })).toHaveCount(1);
  });

  test("Kunde storniert Probestunde; Status wechselt auf storniert", async ({ page }) => {
    await login(page, CUSTOMER);
    await page.goto("/profil");
    await page.waitForTimeout(600);
    await openBookingsSection(page);
    await page
      .locator("li", { hasText: "Probestunde" })
      .filter({ hasText: "Bestätigt" })
      .getByRole("button", { name: "Stornieren" })
      .click();
    await page.waitForTimeout(800);
    await expect(page.locator("li", { hasText: "Probestunde" }).filter({ hasText: "Storniert" })).toHaveCount(2);
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
  });
});
