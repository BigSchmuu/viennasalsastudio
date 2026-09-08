import { test, expect, type Page } from "@playwright/test";
import { gehZu } from "./navigation";
import { createClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

// The Playwright runner doesn't auto-load .env.local (unlike `next dev`), but
// the fixture reset below needs SUPABASE_SERVICE_ROLE_KEY.
try {
  ladeTestUmgebung();
} catch {
  // Already loaded (e.g. CI env vars set directly) — safe to ignore.
}

/**
 * The suite creates two courses and deletes only one of them again, so
 * "E2E23 Kurs ohne Videosatz" piled up one copy per run and eventually made
 * the "is it visible?" assertion ambiguous. Video sets are cleaned up too, in
 * case a run aborted between creating and deleting one.
 */
test.beforeAll(async () => {
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  await service.from("courses").delete().like("name", "E2E23 Kurs%");
  await service.from("video_sets").delete().like("name", "E2E23 Videosatz%");
});

const ADMIN_EMAIL = "qa-proj23-admin@viennasalsastudio.test";
const TEACHER_EMAIL = "qa-proj23-teacher@viennasalsastudio.test";
const CUSTOMER_EMAIL = "samuelg.kramer@yahoo.de";
const PASSWORD = "CorrectPassword123!";

async function loginAsAdmin(page: Page) {
  await gehZu(page, "/login");
  // Erst hydrieren lassen. Die Felder sind über react-hook-form gesteuert;
  // wird vor der Hydration gefüllt, setzt React den Wert zurück und das
  // Formular meldet „ist erforderlich". Auf WebKit regelmäßig — siehe
  // docs/troubleshooting-tests.md.
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(ADMIN_EMAIL);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.waitForTimeout(1500); // let hydration settle, see PROJ-2 BUG-1
  await page.getByRole("button", { name: "Einloggen" }).click();
  // Admin lands on /admin after login, every other role on /profil.
  await page.waitForURL(/\/(mein-bereich|profil|admin)$/, { timeout: 10000 });
  // Seit PROJ-45 landen Kunden auf /mein-bereich, die Pruefungen hier gelten
  // aber dem Profil. Faehrt der Test unmittelbar danach selbst woandershin,
  // ueberholt seine Navigation diese hier — auf WebKit regelmaessig. Das ist
  // kein Fehler, sondern genau das, was der Test will; darum wird die
  // Unterbrechung geschluckt statt gemeldet.
  if (page.url().endsWith("/mein-bereich")) await page.goto("/profil").catch(() => {});
}

test.describe("PROJ-23: Admin — Videosätze & Lektionen verwalten", () => {
  test("Zugriffskontrolle: nur Admin darf Videosätze verwalten", async ({ page }) => {
    // Anonym
    await page.goto("/admin/videosaetze");
    await expect(page).toHaveURL(/\/login\?redirect=\/admin/);

    // Lehrer — kein Zugriff auf den Admin-Bereich
    await gehZu(page, "/login");
    // Erst hydrieren lassen. Die Felder sind über react-hook-form gesteuert;
    // wird vor der Hydration gefüllt, setzt React den Wert zurück und das
    // Formular meldet „ist erforderlich". Auf WebKit regelmäßig — siehe
    // docs/troubleshooting-tests.md.
    await page.waitForTimeout(1200);
    await page.getByLabel("E-Mail").fill(TEACHER_EMAIL);
    await page.getByLabel("Passwort").fill(PASSWORD);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Einloggen" }).click();
    // Admin lands on /admin after login, every other role on /profil.
    await page.waitForURL(/\/(mein-bereich|profil|admin)$/, { timeout: 10000 });
    await page.goto("/admin/videosaetze");
    await expect(page).toHaveURL("/");

    // Admin — voller Zugriff
    await loginAsAdmin(page);
    await page.goto("/admin/videosaetze");
    await expect(page).toHaveURL(/\/admin\/videosaetze/);
  });

  // Originally asserted the true empty-state ("Noch keine Videosätze
  // vorhanden") — untestable now that the shared production DB permanently
  // holds a real video set from actual studio use, so that state can never
  // be observed live again. Rewritten to verify the page renders the "Neuer
  // Videosatz" create action correctly instead.
  test("Videosätze-Seite lädt und zeigt die Aktion zum Anlegen", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/videosaetze");
    await expect(page.getByRole("button", { name: "Neuer Videosatz" })).toBeVisible();
  });

  test("Videosatz anlegen mit Level; Duplikat-Name (case-insensitiv) wird abgelehnt", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/videosaetze");

    await page.getByRole("button", { name: "Neuer Videosatz" }).click();
    await page.waitForTimeout(400);
    await page.getByLabel("Name").fill("E2E23 Videosatz Beginner");
    await page.getByLabel(/Level/).click();
    await page.getByRole("option", { name: "Beginner" }).click();
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByText("E2E23 Videosatz Beginner")).toBeVisible();

    await page.getByRole("button", { name: "Neuer Videosatz" }).click();
    await page.waitForTimeout(400);
    await page.getByLabel("Name").fill("e2e23 videosatz beginner");
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByText("existiert bereits")).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("Lektion mit mehreren Video-Links anlegen; ungültiger Link wird abgelehnt", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/videosaetze");
    await page.getByRole("link", { name: "E2E23 Videosatz Beginner" }).click();
    await page.waitForURL(/\/admin\/videosaetze\/.+/);

    await page.getByRole("button", { name: "Neue Lektion" }).click();
    await page.waitForTimeout(400);
    await page.getByLabel("Titel").fill("E2E23 Grundschritt");
    await page.getByPlaceholder("https://youtube.com/…").first().fill("https://youtube.com/watch?v=e2e23-1");
    await page.getByRole("button", { name: "Video hinzufügen" }).click();
    await page.getByPlaceholder("https://youtube.com/…").nth(1).fill("nicht-eine-url");
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText("Bitte eine gültige YouTube-URL eingeben")).toBeVisible();

    // korrigieren und erneut speichern
    await page.getByPlaceholder("https://youtube.com/…").nth(1).fill("https://youtube.com/watch?v=e2e23-2");
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByRole("row", { name: /E2E23 Grundschritt/ })).toContainText("2");
  });

  test("Lektionen-Reihenfolge per Auf/Ab ändern", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/videosaetze");
    await page.getByRole("link", { name: "E2E23 Videosatz Beginner" }).click();
    await page.waitForURL(/\/admin\/videosaetze\/.+/);

    await page.getByRole("button", { name: "Neue Lektion" }).click();
    await page.waitForTimeout(400);
    await page.getByLabel("Titel").fill("E2E23 Zweite Lektion");
    await page.getByPlaceholder("https://youtube.com/…").first().fill("https://youtube.com/watch?v=e2e23-3");
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(800);

    const rows = page.locator("table tbody tr");
    await expect(rows.nth(0)).toContainText("E2E23 Grundschritt");
    await expect(rows.nth(1)).toContainText("E2E23 Zweite Lektion");

    await rows.nth(1).getByRole("button", { name: "Nach oben" }).click();
    await page.waitForTimeout(800);
    await expect(rows.nth(0)).toContainText("E2E23 Zweite Lektion");
    await expect(rows.nth(1)).toContainText("E2E23 Grundschritt");
  });

  test("Kurs mit Videosatz-Zuweisung anlegen; Videosatz-Auswahl bleibt optional", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/kurse");
    await page.getByRole("button", { name: "Neuer Kurs" }).click();
    await page.waitForTimeout(500);

    await page.getByLabel("Name").fill("E2E23 Kurs ohne Videosatz");
    // Scoped to the dialog: since PROJ-33 the page behind it also carries
    // "Tanzstil filtern" and "Level filtern", so an unscoped label lookup is
    // ambiguous and Playwright refuses it.
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Tanzstil").click();
    await page.getByRole("option").first().click();
    await dialog.getByLabel("Level").click();
    await page.getByRole("option", { name: "Beginner" }).click();
    await dialog.getByLabel("Standort").click();
    await page.getByRole("option").first().click();
    await page.waitForTimeout(500);
    await page.getByLabel("Raum").click();
    await page.getByRole("option").first().click();
    await page.waitForTimeout(300);
    // Videosatz bewusst nicht auswählen
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText("E2E23 Kurs ohne Videosatz")).toBeVisible();

    await page.getByRole("button", { name: "Neuer Kurs" }).click();
    await page.waitForTimeout(500);
    await page.getByLabel("Name").fill("E2E23 Kurs mit Videosatz");
    await dialog.getByLabel("Tanzstil").click();
    await page.getByRole("option").first().click();
    await dialog.getByLabel("Level").click();
    await page.getByRole("option", { name: "Beginner" }).click();
    await dialog.getByLabel("Standort").click();
    await page.getByRole("option").first().click();
    await page.waitForTimeout(500);
    await page.getByLabel("Raum").click();
    await page.getByRole("option").first().click();
    await page.waitForTimeout(300);
    await page.getByLabel(/Videosatz/).click();
    await page.getByRole("option", { name: "E2E23 Videosatz Beginner" }).click();
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByRole("row", { name: /E2E23 Kurs mit Videosatz/ })).toContainText(
      "E2E23 Videosatz Beginner"
    );
  });

  test("Videosatz-Löschschutz solange von Kurs verwendet; danach löschbar inkl. Lektionen", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/videosaetze");
    await page.getByRole("row", { name: /E2E23 Videosatz Beginner/ }).getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("alertdialog").getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText("kann nicht gelöscht werden, da er noch bei Kursen")).toBeVisible();
    await page.keyboard.press("Escape");

    // Kurs mit Videosatz-Zuweisung löschen (es gibt aktuell keine
    // UI-Möglichkeit, die Zuweisung nachträglich zu entfernen, siehe BUG-1),
    // damit der Videosatz für den folgenden Löschversuch frei ist.
    await page.goto("/admin/kurse");
    await page.getByRole("row", { name: /E2E23 Kurs mit Videosatz/ }).getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("alertdialog").getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(800);

    await page.goto("/admin/videosaetze");
    await page.getByRole("row", { name: /E2E23 Videosatz Beginner/ }).getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("alertdialog").getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(800);
    await expect(page.getByText("E2E23 Videosatz Beginner")).toHaveCount(0);
  });
});

/**
 * Die beiden Lehrer-Kriterien aus der Spezifikation (AC12/AC13).
 *
 * Sie standen seit August offen: PROJ-23 hatte die Ansicht an die
 * Lehrer-Ansicht weitergereicht („kein Teacher-facing UI vorhanden, da PROJ-13
 * noch nicht gebaut ist"), PROJ-13 hat sie nicht aufgegriffen. Geprüft war
 * bisher nur die Datenbankregel per SQL, nie die Ansicht.
 */
test.describe("PROJ-23: Lehrmaterial in der Lehrer-Ansicht", () => {
  const KURS_ID = "6032ce07-b19c-445b-9f42-f45921df557e"; // "E2E13 Kurs", Lehrer A zugeordnet
  const SATZ_NAME = "E2E23 Videosatz Lehrmaterial";
  const LEHRER_A = "e2e13-lehrer-a@viennasalsastudio.test";
  const LEHRER_C_OHNE_KURS = "e2e13-lehrer-c@viennasalsastudio.test";
  const YOUTUBE_ID = "E2E23video1";

  const dienst = () =>
    createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  let satzId = "";

  async function anmelden(page: Page, email: string) {
    await gehZu(page, "/login");
    await page.waitForTimeout(1200);
    await page.getByLabel("E-Mail").fill(email);
    await page.getByLabel("Passwort").fill(PASSWORD);
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Einloggen" }).click();
    await page.waitForURL(/\/(mein-bereich|profil|admin)$/, { timeout: 10000 });
  }

  test.beforeAll(async () => {
    const service = dienst();

    // Selbstheilend: Bricht ein Lauf zwischen Anhängen und Aufräumen ab, hängt
    // der Satz noch am Kurs — und der Fremdschlüssel verhindert dann sein
    // Löschen. Deshalb erst lösen, dann neu anlegen.
    await service.from("courses").update({ video_set_id: null }).eq("id", KURS_ID);
    await service.from("video_sets").delete().eq("name", SATZ_NAME);

    // `level` ist kleingeschrieben eingeschraenkt (video_sets_level_check).
    const { data: satz, error: satzFehler } = await service
      .from("video_sets")
      .insert({ name: SATZ_NAME, level: "beginner" })
      .select("id")
      .single();
    // Ohne diese Pruefung endete ein misslungener Insert als
    // "Cannot read properties of null" — der Fehler stand da, nur nicht lesbar.
    if (satzFehler || !satz) throw new Error(`Videosatz anlegen fehlgeschlagen: ${satzFehler?.message}`);
    satzId = satz.id;

    const { data: lektionen, error: lektionenFehler } = await service
      .from("video_set_lessons")
      .insert([
        { video_set_id: satzId, title: "E2E23 Lektion Grundschritt", position: 1 },
        { video_set_id: satzId, title: "E2E23 Lektion Drehung", position: 2 },
      ])
      .select("id, position");
    if (lektionenFehler || !lektionen) throw new Error(`Lektionen anlegen fehlgeschlagen: ${lektionenFehler?.message}`);

    const nach = (p: number) => lektionen.find((l) => l.position === p)!.id;
    const { error: videoFehler } = await service.from("video_set_lesson_videos").insert([
      { lesson_id: nach(1), url: `https://www.youtube.com/watch?v=${YOUTUBE_ID}`, position: 1 },
      // Bewusst kein YouTube: In der Datenbank darf jede Adresse stehen, und
      // der Player zeigt bei fremden Adressen nichts an.
      { lesson_id: nach(2), url: "https://vimeo.com/999999", position: 1 },
    ]);
    if (videoFehler) throw new Error(`Videos anlegen fehlgeschlagen: ${videoFehler.message}`);

    const { error: kursFehler } = await service
      .from("courses")
      .update({ video_set_id: satzId })
      .eq("id", KURS_ID);
    if (kursFehler) throw new Error(`Videosatz am Kurs setzen fehlgeschlagen: ${kursFehler.message}`);
  });

  test.afterAll(async () => {
    const service = dienst();
    await service.from("courses").update({ video_set_id: null }).eq("id", KURS_ID);
    if (satzId) await service.from("video_sets").delete().eq("id", satzId);
  });

  test("AC12: Der zugeordnete Lehrer sieht Lektionen und Videos seines Kurses", async ({ page }) => {
    await anmelden(page, LEHRER_A);
    await gehZu(page, `/lehrer/${KURS_ID}`);
    await page.waitForTimeout(1200);

    // Zugeklappt steht der Satz samt Umfang schon in der Kopfzeile.
    const aufklapper = page.getByRole("button", { name: /^Lehrmaterial/ });
    await expect(aufklapper).toContainText(SATZ_NAME);
    await expect(aufklapper).toContainText("2 Lektionen");

    await aufklapper.click();
    await expect(page.getByRole("button", { name: /Grundschritt/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Drehung/ })).toBeVisible();

    // Der Player lädt erst beim Aufklappen der Lektion — vorher darf kein
    // iframe im Dokument stehen, sonst wäre der Sinn der Sache verfehlt.
    await expect(page.locator(`iframe[src*="${YOUTUBE_ID}"]`)).toHaveCount(0);
    await page.getByRole("button", { name: /Grundschritt/ }).click();
    await expect(page.locator(`iframe[src*="${YOUTUBE_ID}"]`)).toBeVisible();
  });

  test("Eine Lektion ohne YouTube-Adresse zeigt einen Link statt einer leeren Fläche", async ({
    page,
  }) => {
    await anmelden(page, LEHRER_A);
    await gehZu(page, `/lehrer/${KURS_ID}`);
    await page.waitForTimeout(1200);

    await page.getByRole("button", { name: /^Lehrmaterial/ }).click();
    await page.getByRole("button", { name: /Drehung/ }).click();

    const link = page.getByRole("link", { name: /Video 1 öffnen/ });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "https://vimeo.com/999999");
  });

  test("AC13: Ein nicht zugeordneter Lehrer kommt nicht an das Lehrmaterial", async ({ page }) => {
    await anmelden(page, LEHRER_C_OHNE_KURS);
    await page.goto(`/lehrer/${KURS_ID}`);
    await page.waitForTimeout(1500);

    await expect(page).not.toHaveURL(new RegExp(`/lehrer/${KURS_ID}$`));
    await expect(page.getByText(SATZ_NAME)).toHaveCount(0);
  });
});
