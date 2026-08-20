import { test, expect, type Page } from "@playwright/test";

const ADMIN = { email: "e2e13-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const LEHRER_A = { email: "e2e13-lehrer-a@viennasalsastudio.test", password: "CorrectPassword123!" };
const LEHRER_B = { email: "e2e13-lehrer-b@viennasalsastudio.test", password: "CorrectPassword123!" };
const LEHRER_C_UNASSIGNED = { email: "e2e13-lehrer-c@viennasalsastudio.test", password: "CorrectPassword123!" };

const COURSE_ID = "6032ce07-b19c-445b-9f42-f45921df557e"; // "E2E13 Kurs"
const COURSE_NO_SCHEDULE_ID = "502077db-5c24-416f-b126-0838e580bd03"; // "E2E13 Kurs Ohne Termin"

// The fixture course's weekly schedule is deliberately set to weekday=3
// (Donnerstag) to match "today" at the time these fixtures were seeded
// (2026-08-20, a Thursday), so a "Heute" column exists whenever this suite
// runs. Like the PROJ-13 QA's earlier SEEDED_DATE, this is a date that must
// be re-primed (via UPDATE course_schedule SET weekday = ...) if this test
// starts flaking on a day where "today" no longer falls on a Thursday.

async function login(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.waitForTimeout(1000); // let hydration settle, see PROJ-2 BUG-1
  await page.getByRole("button", { name: "Einloggen" }).click();
  // Admin lands on /admin after login, every other role on /profil.
  await page.waitForURL(/\/(profil|admin)$/, { timeout: 10000 });
}

function rowFor(page: Page, name: string) {
  return page.locator("tr", { hasText: name });
}

async function openCell(page: Page, row: ReturnType<typeof rowFor>, cellIndex: number) {
  const cells = row.locator("td");
  await cells.nth(cellIndex).getByRole("button", { name: "Anwesenheit markieren" }).click();
}

test.describe("PROJ-13: Lehrer-Ansicht (Stundenplan, Anwesenheit, Notizen)", () => {
  test("AC1: Eingeloggter Lehrer sieht 'Meine Kurse' in der globalen Navigation", async ({ page }) => {
    await login(page, LEHRER_A);
    await expect(page.getByRole("link", { name: "Meine Kurse" })).toBeVisible();
  });

  test("AC2: Lehrer ohne zugewiesene Kurse sieht Hinweistext statt leerer Liste", async ({ page }) => {
    await login(page, LEHRER_C_UNASSIGNED);
    await page.goto("/lehrer");
    await page.waitForTimeout(500);
    await expect(page.getByText("Dir sind noch keine Kurse zugewiesen.")).toBeVisible();
  });

  test("AC2b: Kurs ohne Wochentermin zeigt Hinweistext statt leerer Matrix", async ({ page }) => {
    await login(page, LEHRER_A);
    await page.goto(`/lehrer/${COURSE_NO_SCHEDULE_ID}`);
    await page.waitForTimeout(500);
    await expect(page.getByText("Für diesen Kurs ist noch kein Wochentermin hinterlegt.")).toBeVisible();
  });

  test("AC3: Lehrer sieht seine Kurse zur Auswahl", async ({ page }) => {
    await login(page, LEHRER_A);
    await page.goto("/lehrer");
    await page.waitForTimeout(500);
    await expect(page.getByText("E2E13 Kurs", { exact: true })).toBeVisible();
  });

  test("AC3b/AC6: Matrix zeigt heutige + letzte 8 vergangene Termine als Spalten, keine zukünftigen", async ({ page }) => {
    await login(page, LEHRER_A);
    await page.goto(`/lehrer/${COURSE_ID}`);
    await page.waitForTimeout(1000);

    await expect(page.getByText("Heute")).toBeVisible();

    const headerRow = page.locator("thead tr");
    const dateHeaders = headerRow.locator("th").filter({ hasNotText: "Kursteilnehmer" });
    // Exactly 9 columns: today + 8 past. If "today" doesn't match the fixture's
    // weekday when this runs (see comment above), this degrades to 8 — re-prime
    // the fixture's weekday in that case.
    await expect(dateHeaders).toHaveCount(9);
  });

  test("AC4: Automatische Vorbefüllung — Abo, Buchung, und kein Duplikat bei Abo+Buchung am selben Termin", async ({ page }) => {
    await login(page, LEHRER_A);
    await page.goto(`/lehrer/${COURSE_ID}`);
    await page.waitForTimeout(1000);

    await expect(page.getByText("E2E13 Abo Kunde")).toBeVisible();
    await expect(page.getByText("E2E13 Dropin Kunde")).toBeVisible();

    // E2E13 Kombi Kunde has both an active abo AND a confirmed dropin booking
    // on 2026-08-13 — must appear as exactly one row (BUG-1 regression check).
    await expect(rowFor(page, "E2E13 Kombi Kunde")).toHaveCount(1);
  });

  test("AC5: Anwesenheit markieren übernimmt den Status sofort und bleibt nach Reload sichtbar", async ({ page }) => {
    await login(page, LEHRER_A);
    await page.goto(`/lehrer/${COURSE_ID}`);
    await page.waitForTimeout(1000);

    const row = rowFor(page, "E2E13 Dropin Kunde");
    const cells = row.locator("td");
    const cellCount = await cells.count();
    // Today's column is always last (columns render oldest -> newest).
    await cells.nth(cellCount - 1).getByRole("button", { name: "Anwesenheit markieren" }).click();
    await page.getByRole("button", { name: "Anwesend", exact: true }).click();
    await page.waitForTimeout(800);

    await expect(cells.nth(cellCount - 1).getByRole("button", { name: "Anwesenheit markieren" })).toHaveClass(/border-emerald-600/);

    await page.reload();
    await page.waitForTimeout(1000);
    const rowAfterReload = rowFor(page, "E2E13 Dropin Kunde");
    const cellsAfterReload = rowAfterReload.locator("td");
    await expect(cellsAfterReload.nth(cellCount - 1).getByRole("button", { name: "Anwesenheit markieren" })).toHaveClass(/border-emerald-600/);
  });

  test("AC5b: Vorab erfasste Anwesenheit (Abwesend) ist beim Laden sichtbar", async ({ page }) => {
    await login(page, LEHRER_A);
    await page.goto(`/lehrer/${COURSE_ID}`);
    await page.waitForTimeout(1000);

    // Fixture: E2E13 Abo Kunde was pre-marked "absent" on 2026-07-30.
    const row = rowFor(page, "E2E13 Abo Kunde");
    const markedAbsent = row.locator("button.border-red-600");
    await expect(markedAbsent).toHaveCount(1);
  });

  // Marks E2E13 Flatrate Kunde present today, which persists a real
  // course_attendance row — on a re-run they'd already be listed (no longer
  // "addable"), so this test needs `DELETE FROM course_attendance WHERE
  // course_id = '6032ce07-...' AND occurrence_date = today AND customer_id =
  // 'b2b880e6-...'` re-run before it to stay green, same category of
  // re-priming as the AC5/AC5b fixtures.
  test("AC7: 'Kunde hinzufügen' listet nur Kunden mit aktivem Abo/Buchung, fügt Zeile hinzu, in passender Spalte markierbar", async ({ page }) => {
    await login(page, LEHRER_A);
    await page.goto(`/lehrer/${COURSE_ID}`);
    await page.waitForTimeout(1000);

    await page.getByRole("button", { name: "Kunde hinzufügen" }).click();
    await page.waitForTimeout(300);
    await page.getByPlaceholder("Suche nach Name…").fill("E2E13 Flatrate");
    await page.waitForTimeout(300);
    await expect(page.getByText("E2E13 Flatrate Kunde")).toBeVisible();
    await page.getByRole("button", { name: "Hinzufügen" }).click();
    await page.waitForTimeout(300);

    const row = rowFor(page, "E2E13 Flatrate Kunde");
    await expect(row).toBeVisible();
    const cells = row.locator("td");
    const cellCount = await cells.count();
    await cells.nth(cellCount - 1).getByRole("button", { name: "Anwesenheit markieren" }).click();
    await page.getByRole("button", { name: "Anwesend", exact: true }).click();
    await page.waitForTimeout(800);
    await expect(cells.nth(cellCount - 1).getByRole("button", { name: "Anwesenheit markieren" })).toHaveClass(/border-emerald-600/);
  });

  test("AC8: Notiz ist für alle zugewiesenen Lehrer sichtbar und bearbeitbar", async ({ page }) => {
    await login(page, LEHRER_B);
    await page.goto(`/lehrer/${COURSE_ID}`);
    await page.waitForTimeout(1000);

    // Fixture: a note was pre-seeded by Lehrer A on 2026-08-06.
    const noteButtons = page.getByRole("button", { name: "Notiz zu diesem Termin" });
    const count = await noteButtons.count();
    let found = false;
    for (let i = 0; i < count; i++) {
      await noteButtons.nth(i).click();
      await page.waitForTimeout(300);
      const textarea = page.getByRole("dialog").getByRole("textbox");
      const value = await textarea.inputValue();
      if (value.includes("E2E13: Vorbereitete Testnotiz")) {
        found = true;
        await textarea.fill(value + " (von Lehrer B ergänzt)");
        await page.getByRole("button", { name: "Notiz speichern" }).click();
        await page.waitForTimeout(800);
        await expect(page.getByText("Notiz gespeichert.")).toBeVisible();
        await page.keyboard.press("Escape");
        break;
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    }
    expect(found).toBe(true);
  });

  test("AC9: Zugriff auf fremden Kurs wird verweigert", async ({ page }) => {
    await login(page, LEHRER_C_UNASSIGNED);
    await page.goto(`/lehrer/${COURSE_ID}`);
    await page.waitForURL((url) => !url.pathname.includes(COURSE_ID), { timeout: 10000 });
    await expect(page).toHaveURL(/\/lehrer$/);
  });

  test("AC10: Admin sieht/bearbeitet dieselbe Matrix wie ein zugewiesener Lehrer", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/kurse");
    await page.waitForTimeout(1000);
    const courseRow = page.locator("tr", { hasText: "E2E13 Kurs" }).first();
    await courseRow.getByRole("link", { name: "Anwesenheit" }).click();
    await page.waitForURL(`**/lehrer/${COURSE_ID}`, { timeout: 10000 });
    await page.waitForTimeout(1000);

    await expect(page.getByText("E2E13 Abo Kunde")).toBeVisible();
    await expect(page.getByText("Heute")).toBeVisible();
  });

  test("Mobile (375px): Matrix scrollt horizontal, Kundennamen-Spalte bleibt sichtbar", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page, LEHRER_A);
    await page.goto(`/lehrer/${COURSE_ID}`);
    await page.waitForTimeout(1000);

    await expect(page.getByText("Kursteilnehmer")).toBeVisible();
    const scrollContainer = page.locator(".relative.w-full.overflow-auto").first();
    await scrollContainer.evaluate((el) => {
      el.scrollLeft = 500;
    });
    await page.waitForTimeout(300);
    await expect(page.getByText("Kursteilnehmer")).toBeVisible();
    await expect(page.getByText("E2E13 Abo Kunde")).toBeVisible();
  });
});
