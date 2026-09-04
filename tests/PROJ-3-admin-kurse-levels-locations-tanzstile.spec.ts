import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

// The Playwright runner doesn't auto-load .env.local (unlike `next dev`), but
// the fixture reset below needs SUPABASE_SERVICE_ROLE_KEY.
try {
  ladeTestUmgebung();
} catch {
  // Already loaded (e.g. CI env vars set directly) — safe to ignore.
}

const ADMIN_EMAIL = "qa-proj3-admin@viennasalsastudio.test";
const TEACHER_EMAIL = "qa-proj3-teacher@viennasalsastudio.test";
const CUSTOMER_EMAIL = "qa-proj3-customer@viennasalsastudio.test";
const PASSWORD = "CorrectPassword123!";

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test.beforeAll(async () => {
  // "Kurs anlegen mit Lehrer" creates + renames a course fresh every run;
  // without cleanup, each run left another "E2E Salsa Kurs (erneut
  // bearbeitet)" row behind, and by the second run two rows shared that
  // exact name — a strict-mode locator violation on the final assertion.
  // This course is never booked (course_bookings/subscriptions would RESTRICT
  // the delete), so a plain delete is safe.
  await service.from("courses").delete().ilike("name", "E2E Salsa Kurs%");
});

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
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

test.describe("PROJ-3: Admin — Kurse, Levels, Locations & Tanzstile", () => {
  test("Zugriffskontrolle: nur Admin darf /admin betreten", async ({ page }) => {
    // Anonym
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?redirect=\/admin/);

    // Kunde — bewusst über eine "saubere" /login-URL ohne redirect-Parameter,
    // damit der Login regulär auf /profil landet, nicht auf /admin zurück.
    await page.goto("/login");
    // Erst hydrieren lassen. Die Felder sind über react-hook-form gesteuert;
    // wird vor der Hydration gefüllt, setzt React den Wert zurück und das
    // Formular meldet „ist erforderlich". Auf WebKit regelmäßig — siehe
    // docs/troubleshooting-tests.md.
    await page.waitForTimeout(1200);
    await page.getByLabel("E-Mail").fill(CUSTOMER_EMAIL);
    await page.getByLabel("Passwort").fill(PASSWORD);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Einloggen" }).click();
    // Admin lands on /admin after login, every other role on /profil.
    await page.waitForURL(/\/(mein-bereich|profil|admin)$/, { timeout: 10000 });
    await page.goto("/admin");
    await expect(page).toHaveURL("/");

    // Lehrer — erneutes Einloggen überschreibt die Kunden-Session direkt
    await page.goto("/login");
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
    await page.goto("/admin");
    await expect(page).toHaveURL("/");

    // Admin — erneutes Einloggen überschreibt die Lehrer-Session direkt
    // Since PROJ-17, /admin serves the Analytics Dashboard directly (no
    // longer redirects to /admin/standorte) — assert admin can actually
    // reach and stay on /admin instead.
    await loginAsAdmin(page);
    await page.goto("/admin");
    await expect(page).toHaveURL("/admin");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  // Originally asserted the true empty-state ("Noch keine Standorte/Tanzstile
  // vorhanden", "Neuer Kurs" disabled) — untestable now that the shared
  // production DB permanently holds real locations/dance styles from actual
  // studio use, so that state can never be observed live again. Rewritten to
  // verify the complementary, now-permanently-true case: with locations and
  // dance styles present, both list pages show real items and "Neuer Kurs"
  // is enabled (i.e. the disabled-without-prerequisites logic doesn't
  // accidentally stay disabled once prerequisites exist).
  test("Standorte/Tanzstile zeigen vorhandene Einträge; Kurs-Button aktiv sobald beides existiert", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/standorte");
    await expect(page.getByText("Noch keine Standorte vorhanden")).toHaveCount(0);

    await page.goto("/admin/tanzstile");
    await expect(page.getByText("Noch keine Tanzstile vorhanden")).toHaveCount(0);

    await page.goto("/admin/kurse");
    await expect(page.getByRole("button", { name: "Neuer Kurs" })).toBeEnabled();
  });

  test("Standort anlegen, Löschschutz mit Raum, Raum anlegen und Löschschutz mit Kurs", async ({ page }) => {
    await loginAsAdmin(page);

    // Named distinctly from the stable "E2E Studio"/"E2E Saal" fixture that
    // later tests in this file (and PROJ-23) depend on, so this test's own
    // create-flow never collides with it on a re-run against the same
    // persistent DB (no staging/reset exists in this project).
    const STANDORT_NAME = "E2E Studio Neu";
    const RAUM_NAME = "E2E Saal Neu";

    // Standort anlegen
    await page.goto("/admin/standorte");
    await page.getByRole("button", { name: "Neuer Standort" }).click();
    await page.waitForTimeout(500);
    await page.getByLabel("Name").fill(STANDORT_NAME);
    await page.getByLabel("Adresse").fill("Teststraße 1, Wien");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText(STANDORT_NAME)).toBeVisible();

    // Standort ohne Raum darf gelöscht werden können (Vorbedingung nicht verletzt) —
    // wir löschen NICHT, sondern navigieren stattdessen zur Raumverwaltung.
    await page.getByRole("link", { name: STANDORT_NAME }).click();
    await expect(page).toHaveURL(/\/admin\/standorte\/.+/);

    // Raum anlegen
    await page.getByRole("button", { name: "Neuer Raum" }).click();
    await page.waitForTimeout(500);
    await page.getByLabel("Name").fill(RAUM_NAME);
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText(RAUM_NAME)).toBeVisible();

    // Standort mit Raum kann nicht gelöscht werden
    await page.goto("/admin/standorte");
    await page.getByRole("row", { name: STANDORT_NAME }).getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(300);
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Löschen" })
      .click();
    await expect(page.getByText("kann nicht gelöscht werden, da ihm noch Räume")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText(STANDORT_NAME)).toBeVisible();

    // Clean up after ourselves so a re-run against the same persistent DB
    // (no staging/reset exists in this project) doesn't accumulate another
    // "E2E Studio Neu" duplicate — delete the room, then the now-empty location.
    await page.getByRole("link", { name: STANDORT_NAME }).click();
    await expect(page).toHaveURL(/\/admin\/standorte\/.+/);
    await page.getByRole("row", { name: RAUM_NAME }).getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("alertdialog").getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(300);
    await page.goto("/admin/standorte");
    await page.getByRole("row", { name: STANDORT_NAME }).getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("alertdialog").getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(300);
    // Assert the table row is gone rather than "the text isn't visible": a
    // toast or dialog left over from the delete also carries the name, and a
    // negative assertion against multiple matches fails on strict mode instead
    // of passing.
    await expect(page.getByRole("row", { name: STANDORT_NAME })).toHaveCount(0);
  });

  test("Tanzstil anlegen und sofort im Kurs-Formular verfügbar", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/tanzstile");
    await page.getByRole("button", { name: "Neuer Tanzstil" }).click();
    await page.waitForTimeout(500);
    await page.getByLabel("Name").fill("E2E Salsa");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("E2E Salsa")).toBeVisible();

    await page.goto("/admin/kurse");
    await page.getByRole("button", { name: "Neuer Kurs" }).click();
    await page.waitForTimeout(500);
    await page.getByLabel("Tanzstil", { exact: true }).click();
    await expect(page.getByRole("option", { name: "E2E Salsa" })).toBeVisible();
  });

  test("Pflichtfeld-Validierung: leerer Standort-Name wird abgelehnt", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/standorte");
    await page.getByRole("button", { name: "Neuer Standort" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Name ist erforderlich")).toBeVisible();
  });

  test("Kurs anlegen mit Lehrer; Kurs ohne Videosatz bearbeiten möglich", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/kurse");
    await page.getByRole("button", { name: "Neuer Kurs" }).click();
    await page.waitForTimeout(500);

    await page.getByLabel("Name").fill("E2E Salsa Kurs");
    await page.getByLabel("Tanzstil", { exact: true }).click();
    await page.getByRole("option", { name: "E2E Salsa" }).click();
    await page.getByLabel("Level", { exact: true }).click();
    await page.getByRole("option", { name: "Beginner" }).click();
    await page.getByLabel("Standort").click();
    await page.getByRole("option", { name: "E2E Studio" }).click();
    await page.waitForTimeout(500);
    await page.getByLabel("Raum").click();
    await page.getByRole("option", { name: "E2E Saal" }).click();
    await page.waitForTimeout(500);

    await page.getByText("Lehrer auswählen").click();
    await page.waitForTimeout(300);
    // Scoped to the option role: a plain text match can also hit this
    // teacher's name in an existing course row rendered behind the dialog.
    await page.getByRole("option", { name: "QA Lehrer Eins" }).click();
    await page.keyboard.press("Escape");

    // Videosatz bewusst nicht zuweisen (optional, siehe PROJ-23)
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(1000);

    // "E2E Salsa Kurs" alone is also a substring of the pre-existing
    // "E2E Salsa Kurs (bearbeitet)" fixture from an earlier run — exclude it.
    const newCourseRow = page
      .getByRole("row", { name: /E2E Salsa Kurs/ })
      .filter({ hasNotText: "bearbeitet" });
    await expect(newCourseRow).toBeVisible();
    await expect(newCourseRow.getByText("QA Lehrer Eins")).toBeVisible();

    // Bestehenden Kurs ohne Videosatz weiterhin bearbeiten können.
    // Renamed to a name distinct from the "E2E Salsa Kurs (bearbeitet)"
    // fixture an earlier run already left behind, so this row stays
    // unambiguous afterwards too.
    await newCourseRow.getByRole("button", { name: "Bearbeiten" }).click();
    await page.waitForTimeout(500);
    await page.getByLabel("Name").fill("E2E Salsa Kurs (erneut bearbeitet)");
    await page.getByRole("button", { name: "Speichern" }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText("E2E Salsa Kurs (erneut bearbeitet)")).toBeVisible();
  });

  test("Tanzstil und Raum, die noch von einem Kurs verwendet werden, können nicht gelöscht werden", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    await page.goto("/admin/tanzstile");
    await page.getByRole("row", { name: /E2E Salsa/ }).getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("alertdialog").getByRole("button", { name: "Löschen" }).click();
    await expect(page.getByText("kann nicht gelöscht werden, da er noch bei Kursen")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/admin/standorte");
    await page.getByRole("link", { name: "E2E Studio" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("row", { name: /E2E Saal/ }).getByRole("button", { name: "Löschen" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("alertdialog").getByRole("button", { name: "Löschen" }).click();
    await expect(page.getByText("kann nicht gelöscht werden, da ihm noch Kurse")).toBeVisible();
  });
});
