import { test, expect, type Page } from "@playwright/test";
import { ladeTestUmgebung } from "./env";
ladeTestUmgebung();

/**
 * PROJ-45: Kunden-Dashboard.
 *
 * Grundabdeckung aus dem Frontend-Schritt. Die vollständige Prüfung aller
 * Akzeptanzkriterien folgt in /qa; hier steht, was beim Bauen gefunden wurde
 * und nicht wieder zurückfallen darf.
 */

async function anmelden(page: Page, mail: string) {
  await page.goto("/login");
  await page.waitForTimeout(1200);
  await page.getByLabel(/e-?mail/i).fill(mail);
  await page.getByLabel(/passwort|password/i).fill("CorrectPassword123!");
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Einloggen|Log in/ }).click();
  await page.waitForURL(/\/(mein-bereich|profil|admin)$/, { timeout: 20000 });
  await page.waitForTimeout(1200);
}

test.describe("PROJ-45: Kunden-Dashboard", () => {
  test.use({ locale: "de-DE" });

  test("Der Kunde landet nach dem Login auf dem Dashboard, nicht im Profil", async ({ page }) => {
    await anmelden(page, "e2e13-abo-kunde@viennasalsastudio.test");
    expect(page.url()).toContain("/mein-bereich");
  });

  test("Der nächste Kurs steht mit Uhrzeit, Raum und Standort da", async ({ page }) => {
    await anmelden(page, "e2e13-abo-kunde@viennasalsastudio.test");
    const text = await page.locator("body").innerText();
    expect(text).toContain("Dein nächster Kurs");
    expect(text).toContain("E2E13 Kurs");
    // Raum und Standort gehören zusammen auf die Karte — ohne sie steht der
    // Kunde vor dem richtigen Gebäude im falschen Saal.
    expect(text).toContain("Saal 1 (Groß)");
    expect(text).toContain("Good Energy");
  });

  test("Ein fehlendes SEPA-Mandat erscheint als offener Punkt", async ({ page }) => {
    await anmelden(page, "e2e13-abo-kunde@viennasalsastudio.test");
    const text = await page.locator("body").innerText();
    expect(text).toContain("Zu erledigen");
    expect(text).toContain("Zahlungsweise fehlt");
  });

  test("Ein Flatrate-Abo ohne Kursbindung macht aus einem Mitglied keinen Neukunden", async ({ page }) => {
    // Gefunden beim Bauen: die Seite entschied anhand des errechneten Termins
    // statt anhand des Abos — ein Flatrate-Kunde liefert keinen Termin und
    // bekam deshalb den Probestunden-Bildschirm zu sehen.
    await anmelden(page, "e2e7-customer-multi@viennasalsastudio.test");
    const text = await page.locator("body").innerText();
    expect(text).not.toContain("Komm zur Probestunde");
    expect(text).toContain("kein fester Kurstermin");
  });

  test("Die Navigation führt weiterhin auch ins Profil", async ({ page }) => {
    await anmelden(page, "e2e13-abo-kunde@viennasalsastudio.test");
    await page.getByRole("link", { name: "Mein Profil" }).first().click();
    await page.waitForURL(/\/profil$/, { timeout: 15000 });
  });

  test("Auf Englisch ist das Dashboard englisch", async ({ page, context }) => {
    await context.addCookies([{ name: "NEXT_LOCALE", value: "en", url: "http://localhost:3100" }]);
    await anmelden(page, "e2e13-abo-kunde@viennasalsastudio.test");
    const text = await page.locator("body").innerText();
    expect(page.url()).toContain("/en/");
    expect(text).toContain("Your next class");
    expect(text).not.toContain("Dein nächster Kurs");
  });
});
