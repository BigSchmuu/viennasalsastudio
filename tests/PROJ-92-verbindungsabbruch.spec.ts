import { test, expect, type Page } from "@playwright/test";
import { gehZu } from "./navigation";

/**
 * PROJ-92: Ein Druck darf nicht ins Nichts gehen.
 *
 * Nachgestellt wird der Fehler vom 2026-10-23 (Sentry, 111 Ereignisse): Der
 * POST der Server-Action geht hinaus und kommt nicht zu Ende. Auf dem iPhone
 * passiert das beim Wechsel von WLAN auf Mobilfunk; hier bricht Playwright die
 * Anfrage ab, was im Browser denselben `TypeError` erzeugt.
 *
 * Diese Prüfungen brauchen **kein** Testkonto: Die Anfrage erreicht den Server
 * nie. Sie hängen damit an keiner Fixture und an keinem Datenbankzustand.
 */

const MAIL = "proj92-niemand@viennasalsastudio.test";
const PASSWORT = "CorrectPassword123!";

/** Jeden POST auf diese Seite abbrechen — die GETs laufen weiter. */
async function verbindungKappen(page: Page, pfad: string) {
  await page.route(`**${pfad}**`, async (route) => {
    if (route.request().method() === "POST") {
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
}

test.describe("PROJ-92: Abgebrochene Anfrage", () => {
  test("Die Anmeldung sagt es, statt die Fehlerseite zu zeigen", async ({ page }) => {
    await gehZu(page, "/login");
    // Erst hydrieren lassen — siehe docs/troubleshooting-tests.md.
    await page.waitForTimeout(1200);
    await page.getByLabel("E-Mail").fill(MAIL);
    await page.getByLabel(/^Passwort$/).fill(PASSWORT);

    await verbindungKappen(page, "/login");
    await page.getByRole("button", { name: "Einloggen" }).click();

    await expect(page.getByText(/Die Verbindung ist abgebrochen/)).toBeVisible({ timeout: 20000 });
    // Und zwar im Formular: Der Kunde ist nicht auf der Fehlerseite gelandet.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Einloggen" })).toBeEnabled();
  });

  test("Die Eingaben bleiben stehen", async ({ page }) => {
    await gehZu(page, "/login");
    await page.waitForTimeout(1200);
    await page.getByLabel("E-Mail").fill(MAIL);
    await page.getByLabel(/^Passwort$/).fill(PASSWORT);

    await verbindungKappen(page, "/login");
    await page.getByRole("button", { name: "Einloggen" }).click();
    await expect(page.getByText(/Die Verbindung ist abgebrochen/)).toBeVisible({ timeout: 20000 });

    // Der ganze Sinn der Meldung im Formular: noch einmal drücken, nicht noch
    // einmal tippen.
    await expect(page.getByLabel("E-Mail")).toHaveValue(MAIL);
    await expect(page.getByLabel(/^Passwort$/)).toHaveValue(PASSWORT);
  });

  test("Auf der englischen Seite steht der Satz auf Englisch", async ({ page }) => {
    await gehZu(page, "/en/login");
    await page.waitForTimeout(1200);
    await page.getByLabel(/e-?mail/i).fill(MAIL);
    await page.getByLabel(/^Password$/).fill(PASSWORT);

    await verbindungKappen(page, "/login");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText(/The connection was interrupted/)).toBeVisible({ timeout: 20000 });
  });

  test("Auch das Registrieren bleibt im Formular", async ({ page }) => {
    await gehZu(page, "/registrieren");
    await page.waitForTimeout(1200);
    // PROJ-94: Pflichtfelder, sonst sendet das Formular gar nicht ab und der
    // Abbruch könnte nie geprüft werden.
    await page.getByLabel("Vorname").fill("QA");
    await page.getByLabel("Nachname").fill("Abbruch");
    await page.getByLabel("E-Mail").fill(MAIL);
    await page.getByLabel(/^Passwort$/).fill(PASSWORT);
    const wiederholung = page.getByLabel(/Passwort bestätigen|Passwort wiederholen/);
    if (await wiederholung.count()) await wiederholung.first().fill(PASSWORT);

    await verbindungKappen(page, "/registrieren");
    await page.getByRole("button", { name: /Registrieren|Konto erstellen/ }).first().click();

    await expect(page.getByText(/Die Verbindung ist abgebrochen/)).toBeVisible({ timeout: 20000 });
    await expect(page).toHaveURL(/\/registrieren/);
  });
});
