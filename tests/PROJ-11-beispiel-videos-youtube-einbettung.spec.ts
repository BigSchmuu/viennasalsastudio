import { test, expect, type Page } from "@playwright/test";

// Permanente Fixtures (angelegt während /frontend und /qa von PROJ-11):
// Videosatz "E2E11 Videosatz" mit 2 Lektionen (Lektion 1 hat ein Kunden-Video,
// Lektion 2 nicht), Kurs "E2E11 Kurs mit Video" (dieser Videosatz zugeordnet).
const COURSE_ID = "2891b989-1eb5-443b-a8e7-865e50b801f9";
const PASSWORD = "TestPassword123!";
const ENROLLED_EMAIL = "e2e11-enrolled@viennasalsastudio.test"; // aktives Abo, kursgebunden auf E2E11 Kurs
const FLATRATE_EMAIL = "e2e11-flatrate@viennasalsastudio.test"; // aktives Flatrate-Abo (kein Kurs-Bezug)
const PAUSED_EMAIL = "e2e11-paused@viennasalsastudio.test"; // pausiertes Abo auf E2E11 Kurs
const OTHER_EMAIL = "e2e11-other@viennasalsastudio.test"; // aktives Abo auf einem anderen Kurs

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL(/\/(profil)?$/, { timeout: 10000 }).catch(() => {});
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

test.describe("PROJ-11: Beispiel-Videos (YouTube-Einbettung)", () => {
  test("AC1: Klick auf Kurskarte im Katalog führt zur Kursdetailseite, auch anonym", async ({ page }) => {
    await page.goto("/kurse");
    await loadAllCourses(page);
    await page.getByText("E2E11 Kurs mit Video").click();
    await expect(page).toHaveURL(new RegExp(`/kurse/${COURSE_ID}`));
    await expect(page.getByRole("heading", { name: "E2E11 Kurs mit Video" })).toBeVisible();
  });

  test("AC2: Anonymer Besucher sieht keinen Videolektionen-Abschnitt", async ({ page }) => {
    await page.goto(`/kurse/${COURSE_ID}`);
    await expect(page.getByText("Videolektionen")).toHaveCount(0);
  });

  test("AC2 (Variante): Eingeloggter Kunde ohne passendes Abo sieht keinen Videolektionen-Abschnitt", async ({
    page,
  }) => {
    await login(page, OTHER_EMAIL);
    await page.goto(`/kurse/${COURSE_ID}`);
    await expect(page.getByText("Videolektionen")).toHaveCount(0);
  });

  test("AC3: Kunde mit aktivem kursgebundenem Abo sieht Videolektionen mit Kunden-Video", async ({ page }) => {
    await login(page, ENROLLED_EMAIL);
    await page.goto(`/kurse/${COURSE_ID}`);
    await expect(page.getByText("Videolektionen")).toBeVisible();
    await expect(page.getByText("E2E11 Lektion 1")).toBeVisible();
  });

  test("AC4: Kunde mit aktivem Flatrate-Abo sieht Videolektionen für einen beliebigen Kurs", async ({ page }) => {
    await login(page, FLATRATE_EMAIL);
    await page.goto(`/kurse/${COURSE_ID}`);
    await expect(page.getByText("Videolektionen")).toBeVisible();
  });

  test("AC5: Kunde mit pausiertem Abo sieht keinen Videolektionen-Abschnitt", async ({ page }) => {
    await login(page, PAUSED_EMAIL);
    await page.goto(`/kurse/${COURSE_ID}`);
    await expect(page.getByText("Videolektionen")).toHaveCount(0);
  });

  test("AC6: Video wird als eingebetteter YouTube-Player abgespielt, kein Wechsel zu youtube.com", async ({
    page,
  }) => {
    await login(page, ENROLLED_EMAIL);
    await page.goto(`/kurse/${COURSE_ID}`);
    const iframe = page.locator("iframe").first();
    await expect(iframe).toBeVisible();
    await expect(iframe).toHaveAttribute("src", /youtube-nocookie\.com\/embed\//);
  });

  test("AC8: Lektion ohne Kunden-Video erscheint nicht im Videolektionen-Abschnitt", async ({ page }) => {
    await login(page, ENROLLED_EMAIL);
    await page.goto(`/kurse/${COURSE_ID}`);
    await expect(page.getByText("Videolektionen")).toBeVisible();
    await expect(page.getByText("E2E11 Lektion 2")).toHaveCount(0);
  });

  test("AC9: Kurs ohne Videosatz zeigt keinen Videolektionen-Abschnitt, auch bei aktivem Abo", async ({ page }) => {
    await login(page, FLATRATE_EMAIL);
    // "E2E5 Kizomba Beginner" ist ein bestehender Kurs ohne Videosatz-Zuordnung.
    await page.goto("/kurse");
    await loadAllCourses(page);
    await page.getByText("E2E5 Kizomba Beginner").first().click();
    await expect(page.getByText("Videolektionen")).toHaveCount(0);
  });

  test("Sicherheit: Kunde ohne Berechtigung erhält die Kunden-Video-URLs nicht im Seiten-Quelltext", async ({
    page,
  }) => {
    await login(page, OTHER_EMAIL);
    const response = await page.goto(`/kurse/${COURSE_ID}`);
    const body = (await response?.text()) ?? "";
    expect(body).not.toContain("dQw4w9WgXcQ");
  });

  test("Katalogkarte: 'Jetzt buchen' öffnet weiterhin direkt den Buchungsdialog, ohne zur Detailseite zu navigieren", async ({
    page,
  }) => {
    await login(page, ENROLLED_EMAIL);
    await page.goto("/kurse");
    await loadAllCourses(page);
    const card = page.locator(".rounded-lg.border.bg-card").filter({ hasText: "E2E11 Kurs mit Video" });
    await card.getByRole("button", { name: "Jetzt buchen" }).click();
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/kurse$/);
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
