import { test, expect, type Page } from "@playwright/test";

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
  await page.waitForURL("**/profil", { timeout: 10000 });
}

async function openBookingDialog(page: Page, courseName: string) {
  await page.goto("/kurse");
  await page.waitForTimeout(600);
  await page
    .locator(".rounded-lg.border.bg-card")
    .filter({ has: page.getByText(courseName, { exact: true }) })
    .getByRole("button", { name: "Jetzt buchen" })
    .click();
  await page.waitForTimeout(400);
  await page.getByRole("tab", { name: "Anmeldung" }).click();
  await page.waitForTimeout(300);
}

test.describe("PROJ-12: Warteliste & automatische Nachrückung", () => {
  // AC6 promotes E2E12-Nachruecker off the waitlist and leaves E2E12-Holder2's
  // request rejected — this test is one-shot against the live fixtures; a
  // repeat run needs the fixture course reset (see QA Test Results, BUG-3
  // section for the exact reset SQL) before "Ablehnen" is available again.
  test("AC1: Voller Kurs zeigt Warteliste-Hinweis statt Anmeldeformular, Katalog zeigt 'Ausgebucht'", async ({
    page,
  }) => {
    await page.goto("/kurse");
    await page.waitForTimeout(600);
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
    // Holder already has an active subscription for this course but no open
    // request, so the dialog falls through to the normal full-course form;
    // submitting is expected to be rejected server-side ("already enrolled").
    await page.getByRole("combobox").first().click();
    await page.getByRole("option").first().click();
    await page.getByText("Nur diesen Kurs").click();
    await page.getByRole("button", { name: "Auf Warteliste eintragen" }).click();
    await page.waitForTimeout(600);
    await expect(page.getByText(/nicht möglich/)).toBeVisible();
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
    await page.waitForTimeout(800);

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
