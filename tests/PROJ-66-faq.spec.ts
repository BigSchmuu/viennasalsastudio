import { test, expect } from "@playwright/test";
import { gehZu } from "./navigation";
import { FAQ, faqFlach } from "../src/lib/faq/eintraege";

/**
 * PROJ-66: Die Seite mit den häufigen Fragen.
 *
 * Geprüft wird, was eine FAQ ausmacht: dass man sie findet, dass die Antworten
 * auch zugeklappt im Quelltext stehen (Suchmaschinen und Strg+F lesen keine
 * aufgeklappten Kästen), und dass die englische Fassung wirklich englisch ist.
 */

const ERSTE_FRAGE = FAQ[0].eintraege[0];

test.describe("PROJ-66: Häufige Fragen", () => {
  test("Von der Fußzeile jeder Seite aus erreichbar", async ({ page }) => {
    await gehZu(page, "/kurse");
    await page.getByRole("contentinfo").getByRole("link", { name: "Häufige Fragen" }).click();
    await page.waitForURL(/\/faq$/, { timeout: 20000 });
    await expect(page.getByRole("heading", { name: "Häufige Fragen", level: 1 })).toBeVisible();
  });

  test("Auch von der Startseite und von einer Kursseite aus", async ({ page }) => {
    // Nicht über eine Rolle wie „main": Die Seiten dieses Projekts haben kein
    // solches Element. Geprüft wird deshalb das Verhalten — der erste Verweis
    // im Seiteninhalt steht vor der Fußzeile, und ein Klick muss ankommen.
    await gehZu(page, "/");
    await page.getByRole("link", { name: "Häufige Fragen" }).first().click();
    await page.waitForURL(/\/faq$/, { timeout: 20000 });
    await expect(page.getByRole("heading", { name: "Häufige Fragen", level: 1 })).toBeVisible();

    await gehZu(page, "/kurse");
    await page.locator(".rounded-lg.border").first().getByRole("link").first().click();
    await page.waitForURL(/\/kurse\/.+/, { timeout: 20000 });
    const aufDerKursseite = page.getByRole("link", { name: "Häufige Fragen" });
    // Zwei: einer im Inhalt unter dem Buchungsbereich, einer in der Fußzeile.
    await expect(aufDerKursseite).toHaveCount(2);
    await aufDerKursseite.first().click();
    await page.waitForURL(/\/faq$/, { timeout: 20000 });
  });

  test("Jede Antwort steht im Quelltext, auch zugeklappt", async ({ page }) => {
    await gehZu(page, "/faq");

    // Zugeklappt heißt: vorhanden, aber nicht sichtbar. Genau so findet eine
    // Suchmaschine sie — und genau so findet sie auch Strg+F im Browser.
    const antwort = page.getByText(ERSTE_FRAGE.antwort.de, { exact: false });
    await expect(antwort).toHaveCount(1);
    await expect(antwort).toBeHidden();

    await page.getByText(ERSTE_FRAGE.frage.de, { exact: false }).first().click();
    await expect(antwort).toBeVisible();
  });

  test("Alle Fragen sind da, nach Gruppen sortiert", async ({ page }) => {
    await gehZu(page, "/faq");
    for (const gruppe of FAQ) {
      await expect(page.getByRole("heading", { name: gruppe.titel.de, level: 2 })).toBeVisible();
    }
    await expect(page.locator("details")).toHaveCount(faqFlach("de").length);
  });

  test("Suchmaschinen bekommen dieselben Fragen und Antworten", async ({ page }) => {
    await gehZu(page, "/faq");
    const roh = await page.locator('script[type="application/ld+json"]').first().textContent();
    const daten = JSON.parse(roh ?? "{}");

    expect(daten["@type"]).toBe("FAQPage");
    expect(daten.mainEntity).toHaveLength(faqFlach("de").length);
    expect(daten.mainEntity[0].name).toBe(ERSTE_FRAGE.frage.de);
    expect(daten.mainEntity[0].acceptedAnswer.text).toBe(ERSTE_FRAGE.antwort.de);
  });

  test("Auf Englisch ist alles englisch — Seite wie Auszeichnung", async ({ page }) => {
    await gehZu(page, "/en/faq");

    await expect(page.getByRole("heading", { name: "Frequently asked questions", level: 1 })).toBeVisible();
    await expect(page.getByText(ERSTE_FRAGE.frage.en, { exact: false })).toHaveCount(1);
    // Die deutsche Fassung darf hier nirgends durchschlagen.
    await expect(page.getByText(ERSTE_FRAGE.frage.de, { exact: false })).toHaveCount(0);

    const roh = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(JSON.parse(roh ?? "{}").mainEntity[0].name).toBe(ERSTE_FRAGE.frage.en);
  });

  test("Der Verweis hält die Sprache — von /en führt er nach /en/faq", async ({ page }) => {
    await gehZu(page, "/en/kurse");
    await page.getByRole("contentinfo").getByRole("link", { name: "FAQ", exact: true }).click();
    await page.waitForURL(/\/en\/faq$/, { timeout: 20000 });
    await expect(page.getByRole("heading", { name: "Frequently asked questions", level: 1 })).toBeVisible();
  });
});
