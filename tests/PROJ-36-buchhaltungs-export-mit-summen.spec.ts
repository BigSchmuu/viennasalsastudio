import { test, expect, type Page } from "@playwright/test";

const ADMIN = { email: "e2e30-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const KUNDE = { email: "e2e8-customer@viennasalsastudio.test", password: "CorrectPassword123!" };

// PROJ-10 seeds exactly three invoices on this date and nothing else writes to
// it, so this period is stable to assert on. A period the other suites touch
// would make these numbers depend on run order.
const FIXTURE_FROM = "2028-01-01";
const FIXTURE_TO = "2028-01-31";
// Far enough out that no fixture reaches it — used for the empty-period case.
const LEERER_ZEITRAUM = "from=2029-05-01&to=2029-05-31";

async function login(page: Page, creds: { email: string; password: string }) {
  await page.goto("/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(creds.email);
  await page.getByLabel("Passwort").fill(creds.password);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

async function exportCsv(page: Page, queryString: string) {
  const res = await page.request.get(`/api/admin/rechnungen/export?${queryString}`);
  return { res, body: await res.text() };
}

/** Summary rows carry their label in the customer column and no invoice number. */
function summaryLine(body: string, label: string): string | undefined {
  return body.split("\n").find((l) => l.includes(label));
}

test.describe("PROJ-36: Buchhaltungs-Export mit Summen", () => {
  test("AC1: Unter den Einzelzeilen steht eine GESAMT-Zeile mit Netto, USt und Brutto", async ({ page }) => {
    await login(page, ADMIN);
    const { body } = await exportCsv(page, `from=${FIXTURE_FROM}&to=${FIXTURE_TO}`);

    const gesamt = summaryLine(body, "GESAMT");
    expect(gesamt, "GESAMT-Zeile fehlt").toBeTruthy();
    // Nur die eine bezahlte Rechnung: 25,00 netto + 5,00 USt = 30,00 brutto
    expect(gesamt).toContain("25,00");
    expect(gesamt).toContain("5,00");
    expect(gesamt).toContain("30,00");
  });

  test("AC2/AC3: Pro USt-Satz gibt es eine Zwischensumme, auch bei nur einem Satz", async ({ page }) => {
    await login(page, ADMIN);
    const { body } = await exportCsv(page, `from=${FIXTURE_FROM}&to=${FIXTURE_TO}`);

    const zwischensumme = summaryLine(body, "Zwischensumme 20%");
    expect(zwischensumme, "Zwischensumme fehlt trotz einheitlichem Satz").toBeTruthy();
    expect(zwischensumme).toContain("30,00");
  });

  test("AC4: Rücklastschriften stehen getrennt und zählen nicht in GESAMT", async ({ page }) => {
    await login(page, ADMIN);
    const { body } = await exportCsv(page, `from=${FIXTURE_FROM}&to=${FIXTURE_TO}`);

    const nichtEingegangen = summaryLine(body, "Nicht eingegangen");
    expect(nichtEingegangen, "Zeile für Rücklastschriften fehlt").toBeTruthy();
    // 40,00 + 30,00 zurückgebucht
    expect(nichtEingegangen).toContain("70,00");

    // Der Kern: Das zurückgebuchte Geld darf nicht in der Gesamtsumme stecken.
    const gesamt = summaryLine(body, "GESAMT")!;
    expect(gesamt).not.toContain("70,00");
    expect(gesamt).not.toContain("100,00");
  });

  test("AC5: Ein Zeitraum ohne Rechnungen liefert Kopfzeile und Nullsummen statt eines Fehlers", async ({ page }) => {
    await login(page, ADMIN);
    const { res, body } = await exportCsv(page, LEERER_ZEITRAUM);

    expect(res.status()).toBe(200);
    expect(body).toContain("Rechnungsnummer");
    const gesamt = summaryLine(body, "GESAMT");
    expect(gesamt).toContain("0,00");
  });

  test("AC6: Die Monatsauswahl setzt Von und Bis auf den Monatsanfang und das Monatsende", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/rechnungen");
    await page.waitForLoadState("networkidle");

    await page.getByLabel("Zeitraum").click();
    await page.waitForTimeout(400);
    await page.getByRole("option", { name: "Juli 2026" }).click();
    await page.waitForTimeout(400);

    await expect(page.locator("#invoice-from")).toHaveValue("2026-07-01");
    await expect(page.locator("#invoice-to")).toHaveValue("2026-07-31");
  });

  test("Ein ganzes Jahr lässt sich in einem Schritt wählen", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/rechnungen");
    await page.waitForLoadState("networkidle");

    await page.getByLabel("Zeitraum").click();
    await page.waitForTimeout(400);
    await page.getByRole("option", { name: "Jahr 2026" }).click();
    await page.waitForTimeout(400);

    await expect(page.locator("#invoice-from")).toHaveValue("2026-01-01");
    await expect(page.locator("#invoice-to")).toHaveValue("2026-12-31");
  });

  test("Der Dateiname eines Jahres-Exports nennt das Jahr", async ({ page }) => {
    await login(page, ADMIN);
    const { res } = await exportCsv(page, "from=2028-01-01&to=2028-12-31");
    expect(res.headers()["content-disposition"]).toContain("rechnungsjournal-2028.csv");
  });

  // BUG-1 aus der QA: Ein erkannter Zeitraum außerhalb der angebotenen Listen
  // ließ die Auswahl leer und damit kaputt aussehen, obwohl die Daten stimmten.
  test("BUG-1: Auch Zeiträume außerhalb der Auswahlliste werden beschriftet", async ({ page }) => {
    await login(page, ADMIN);

    await page.goto("/admin/rechnungen?from=2019-03-01&to=2019-03-31");
    await page.waitForLoadState("networkidle");
    await expect(page.getByLabel("Zeitraum")).toContainText("März 2019");

    await page.goto("/admin/rechnungen?from=2019-01-01&to=2019-12-31");
    await page.waitForLoadState("networkidle");
    await expect(page.getByLabel("Zeitraum")).toContainText("Jahr 2019");

    await page.goto("/admin/rechnungen?from=2026-01-05&to=2026-03-20");
    await page.waitForLoadState("networkidle");
    await expect(page.getByLabel("Zeitraum")).toContainText("Eigener Zeitraum");
  });

  test("AC7: Der Dateiname nennt den exportierten Zeitraum", async ({ page }) => {
    await login(page, ADMIN);
    const { res } = await exportCsv(page, `from=${FIXTURE_FROM}&to=${FIXTURE_TO}`);
    expect(res.headers()["content-disposition"]).toContain("rechnungsjournal-2028-01.csv");
  });

  test("AC8: Die freien Datumsfelder funktionieren unverändert", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/rechnungen");
    await page.waitForLoadState("networkidle");

    await page.locator("#invoice-from").fill("2028-01-01");
    await page.locator("#invoice-to").fill("2028-01-31");
    await page.getByRole("button", { name: "Filtern" }).click();
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/from=2028-01-01/);
    await expect(page.getByRole("row", { name: /2028-0002/ })).toBeVisible();
    // Seit der BUG-1-Behebung wird auch ein handgesetzter Monat außerhalb der
    // Liste korrekt beschriftet.
    await expect(page.getByLabel("Zeitraum")).toContainText("Januar 2028");
  });

  test("AC9: Beträge im österreichischen Format, Umlaute intakt", async ({ page }) => {
    await login(page, ADMIN);
    const { body } = await exportCsv(page, `from=${FIXTURE_FROM}&to=${FIXTURE_TO}`);

    expect(body.charCodeAt(0), "BOM fehlt — Excel liest sonst Latin-1").toBe(0xfeff);
    expect(body).toContain("Rechnungsnummer;Datum;Kunde");
    expect(body).toContain("25,00");
    expect(body).not.toContain("25.00");
    expect(body).toContain("Rücklastschrift");
    expect(body).toContain("enthält");
  });

  test("AC10: Summenzeilen sind ohne Rechnungsnummer erkennbar", async ({ page }) => {
    await login(page, ADMIN);
    const { body } = await exportCsv(page, `from=${FIXTURE_FROM}&to=${FIXTURE_TO}`);

    for (const label of ["Zwischensumme 20%", "GESAMT", "Nicht eingegangen"]) {
      const zeile = summaryLine(body, label)!;
      expect(zeile.startsWith(";;"), `"${label}" trägt eine Rechnungsnummer`).toBe(true);
    }
  });

  test("Die Datei weist aus, dass sie nur SEPA-Einnahmen enthält", async ({ page }) => {
    await login(page, ADMIN);
    const { body } = await exportCsv(page, `from=${FIXTURE_FROM}&to=${FIXTURE_TO}`);
    expect(body).toContain("ausschließlich Einnahmen aus SEPA-Lastschriften");
  });

  test("Sicherheit: Kunden und Unangemeldete erhalten keine Buchhaltungsdaten", async ({ page }) => {
    const anon = await page.request.get(`/api/admin/rechnungen/export?from=${FIXTURE_FROM}&to=${FIXTURE_TO}`);
    expect(await anon.text()).not.toContain("Rechnungsnummer;Datum");

    await login(page, KUNDE);
    const { body } = await exportCsv(page, `from=${FIXTURE_FROM}&to=${FIXTURE_TO}`);
    expect(body).not.toContain("Rechnungsnummer;Datum");
    expect(body).not.toContain("2028-000");
  });
});
