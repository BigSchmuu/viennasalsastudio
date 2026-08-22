import { test, expect } from "@playwright/test";

const CONFIRMED_EMAIL = "qa-proj2-a@viennasalsastudio.test";
const CONFIRMED_PASSWORD = "CorrectPassword123!";
const UNCONFIRMED_EMAIL = "qa-proj2-unconfirmed@viennasalsastudio.test";
// Separate account for the birthdate test so it doesn't race the profile-save
// test against the same `profiles` row when tests run in parallel.
const CONFIRMED_EMAIL_2 = "qa-proj2-c@viennasalsastudio.test";

test.describe("PROJ-2: Auth & Kundenprofil", () => {
  test("nicht eingeloggter Besucher wird von /profil zu /login umgeleitet und nach Login zurückgeleitet", async ({
    page,
  }) => {
    await page.goto("/profil");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fprofil/);

    await page.getByLabel("E-Mail").fill(CONFIRMED_EMAIL);
    await page.getByLabel("Passwort").fill(CONFIRMED_PASSWORD);
    await page.getByRole("button", { name: "Einloggen" }).click();

    await expect(page).toHaveURL(/\/profil$/);
    await expect(page.getByText(CONFIRMED_EMAIL)).toBeVisible();
  });

  test("Login mit falschem Passwort zeigt generische Fehlermeldung", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-Mail").fill(CONFIRMED_EMAIL);
    await page.getByLabel("Passwort").fill("FalschesPasswort!");
    await page.getByRole("button", { name: "Einloggen" }).click();

    await expect(page.getByText("E-Mail oder Passwort falsch")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("Login mit unbekannter E-Mail zeigt dieselbe generische Fehlermeldung (kein Enumeration-Leak)", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("E-Mail").fill("existiert-nicht@viennasalsastudio.test");
    await page.getByLabel("Passwort").fill("Irgendwas123");
    await page.getByRole("button", { name: "Einloggen" }).click();

    await expect(page.getByText("E-Mail oder Passwort falsch")).toBeVisible();
  });

  test("Login mit unbestätigter E-Mail zeigt Bestätigungs-Hinweis mit Resend-Option", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-Mail").fill(UNCONFIRMED_EMAIL);
    await page.getByLabel("Passwort").fill(CONFIRMED_PASSWORD);
    await page.getByRole("button", { name: "Einloggen" }).click();

    await expect(page.getByText("Bitte bestätige zuerst deine E-Mail-Adresse")).toBeVisible();
    await expect(page.getByRole("button", { name: "Bestätigungs-E-Mail erneut senden" })).toBeVisible();
  });

  test("Registrierung mit zu kurzem Passwort zeigt Validierungsfehler ohne Absenden", async ({ page }) => {
    await page.goto("/registrieren");
    await page.getByLabel("E-Mail").fill("qa-neu@viennasalsastudio.test");
    await page.getByLabel("Passwort").fill("123");
    await page.getByRole("button", { name: "Registrieren" }).click();

    await expect(page.getByText("Passwort muss mindestens 6 Zeichen lang sein")).toBeVisible();
  });

  test("Passwort vergessen zeigt neutrale Erfolgsmeldung", async ({ page }) => {
    await page.goto("/passwort-vergessen");
    await page.getByLabel("E-Mail").fill("irgendeine-adresse@viennasalsastudio.test");
    await page.getByRole("button", { name: "Reset-Link anfordern" }).click();

    await expect(
      page.getByText("Falls ein Konto mit dieser E-Mail-Adresse existiert")
    ).toBeVisible();
  });

  test("Profil bearbeiten und speichern zeigt aktualisierte Daten; Rollenfeld ist nicht vorhanden", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("E-Mail").fill(CONFIRMED_EMAIL);
    await page.getByLabel("Passwort").fill(CONFIRMED_PASSWORD);
    await page.getByRole("button", { name: "Einloggen" }).click();
    await expect(page).toHaveURL(/\/profil$/);

    await expect(page.getByLabel("Rolle")).toHaveCount(0);

    // Small stabilization wait: client hydration must finish before the
    // Save button's click handler is attached, see BUG-1 in QA results —
    // clicking before hydration falls back to a native GET submission.
    await page.waitForTimeout(2000);
    await page.getByLabel("Name").fill("QA Test Kundin");
    await page.getByLabel("Telefon").fill("+43 660 1234567");
    await page.getByRole("button", { name: "Speichern", exact: true }).click();

    await expect(page.getByText("Profil gespeichert.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Name")).toHaveValue("QA Test Kundin");
  });

  // The birthdate field is three selects (Tag/Monat/Jahr) whose year list ends
  // at the current year, so a future birthdate can no longer be entered at all
  // — prevention instead of after-the-fact rejection. The schema's
  // "nicht in der Zukunft" rule still runs server-side in updateProfile as a
  // backstop against a crafted request; this test covers the UI guarantee.
  test("Zukünftiges Geburtsdatum kann gar nicht erst ausgewählt werden", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-Mail").fill(CONFIRMED_EMAIL_2);
    await page.getByLabel("Passwort").fill(CONFIRMED_PASSWORD);
    await page.getByRole("button", { name: "Einloggen" }).click();
    await expect(page).toHaveURL(/\/profil$/);
    await page.waitForTimeout(2000);

    const currentYear = new Date().getFullYear();
    await page.getByLabel("Jahr").click();
    await page.waitForTimeout(300);
    await expect(page.getByRole("option", { name: String(currentYear), exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: String(currentYear + 1), exact: true })).toHaveCount(0);
  });

  test("Logout beendet die Sitzung und /profil ist danach wieder geschützt", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-Mail").fill(CONFIRMED_EMAIL);
    await page.getByLabel("Passwort").fill(CONFIRMED_PASSWORD);
    await page.getByRole("button", { name: "Einloggen" }).click();
    await expect(page).toHaveURL(/\/profil$/);

    // See BUG-1 in QA results — same hydration-timing caveat as the profile save test.
    await page.waitForTimeout(2000);
    // Two "Logout" buttons exist since PROJ-24 added a nav-level logout
    // alongside this page's own profile-card logout — .last() targets the
    // profile card's button specifically.
    await page.getByRole("button", { name: "Logout" }).last().click();
    await expect(page).toHaveURL("/");

    await page.goto("/profil");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fprofil/);
  });
});
