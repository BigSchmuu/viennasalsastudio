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
 * This suite promotes a customer and demotes two teachers, and nothing put the
 * roles back. After one run the fixtures said the exact opposite of their
 * names — "E2E22 Kunde" was a teacher, both "Lehrer" were customers — and
 * every later run failed looking for people who no longer held those roles.
 * There is no staging database, so the roles are restored here.
 *
 * Das Zurückstufen selbst entfernt die Kurszuordnung nicht — die Aktion ändert
 * nur die Rolle. Weggeräumt wird sie woanders: beim Speichern eines Kurses
 * ersetzt die Verwaltung dessen Lehrerliste vollständig (courses.ts), und
 * andere Testdateien bearbeiten genau diesen Kurs. Danach fand der
 * Warnhinweis-Test keinen Kursnamen mehr vor und fiel um, ohne dass etwas an
 * ihm selbst falsch gewesen wäre. Deshalb wird auch die Zuordnung hier
 * hergestellt statt vorausgesetzt.
 */
test.beforeAll(async () => {
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const roles: Record<string, string> = {
    "E2E22 Admin": "admin",
    "E2E22 Kunde": "customer",
    "E2E22 Lehrer Mit Kurs": "teacher",
    "E2E22 Lehrer Ohne Kurs": "teacher",
  };

  for (const [fullName, role] of Object.entries(roles)) {
    const { error } = await service.from("profiles").update({ role }).eq("full_name", fullName);
    if (error) throw new Error(`PROJ-22 Fixture-Reset (${fullName}) fehlgeschlagen: ${error.message}`);
  }

  const { data: lehrer } = await service
    .from("profiles")
    .select("id")
    .eq("full_name", "E2E22 Lehrer Mit Kurs")
    .single();
  const { data: kurs } = await service
    .from("courses")
    .select("id")
    .eq("name", "E2E5 Kizomba Beginner")
    .single();
  if (!lehrer || !kurs) {
    throw new Error("PROJ-22 Fixture-Reset: Lehrkraft oder Kurs 'E2E5 Kizomba Beginner' fehlt");
  }
  const { error: zuordnungFehler } = await service
    .from("course_teachers")
    .upsert({ course_id: kurs.id, teacher_id: lehrer.id }, { onConflict: "course_id,teacher_id" });
  if (zuordnungFehler) {
    throw new Error(`PROJ-22 Fixture-Reset (Kurszuordnung) fehlgeschlagen: ${zuordnungFehler.message}`);
  }
});

const ADMIN = { email: "e2e22-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER = { email: "e2e22-customer@viennasalsastudio.test", password: "CorrectPassword123!" };
const TEACHER_NOCOURSE = { email: "e2e22-teacher-nocourse@viennasalsastudio.test", password: "CorrectPassword123!" };
const TEACHER_WITHCOURSE = {
  email: "e2e22-teacher-withcourse@viennasalsastudio.test",
  password: "CorrectPassword123!",
};

async function login(page: Page, { email, password }: { email: string; password: string }) {
  await gehZu(page, "/login");
  // Erst hydrieren lassen. Die Felder sind über react-hook-form gesteuert;
  // wird vor der Hydration gefüllt, setzt React den Wert zurück und das
  // Formular meldet „ist erforderlich". Auf WebKit regelmäßig — siehe
  // docs/troubleshooting-tests.md.
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.waitForTimeout(1000); // let hydration settle, see PROJ-2 BUG-1
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

async function loginAsAdmin(page: Page) {
  await login(page, ADMIN);
}

test.describe("PROJ-22: Admin — Lehrer-Rollen verwalten", () => {
  test("Zugriffskontrolle: nur Admin darf /admin/lehrer betreten", async ({ page }) => {
    // Anonym
    await page.goto("/admin/lehrer");
    await expect(page).toHaveURL(/\/login\?redirect=\/admin/);

    // Kunde — kein Zugriff
    await login(page, CUSTOMER);
    await page.goto("/admin/lehrer");
    await expect(page).toHaveURL("/");

    // Lehrer — auch kein Zugriff (Lehrer-Rolle ist kein Admin-Ersatz)
    await login(page, TEACHER_NOCOURSE);
    await page.goto("/admin/lehrer");
    await expect(page).toHaveURL("/");

    // Admin — voller Zugriff
    await loginAsAdmin(page);
    await page.goto("/admin/lehrer");
    await expect(page).toHaveURL(/\/admin\/lehrer/);
  });

  test("Liste zeigt bestehende Lehrer mit Name und E-Mail", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/lehrer");
    await expect(page.getByText("E2E22 Lehrer Ohne Kurs")).toBeVisible();
    await expect(page.getByText(TEACHER_NOCOURSE.email)).toBeVisible();
    await expect(page.getByText("E2E22 Lehrer Mit Kurs")).toBeVisible();
    await expect(page.getByText(TEACHER_WITHCOURSE.email)).toBeVisible();
  });

  test("Kundensuche zeigt nur Personen mit Rolle customer, keine bestehenden Lehrer/Admins", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/lehrer");
    await page.getByRole("button", { name: "Bestehenden Kunden befördern" }).click();
    await page.waitForTimeout(400);
    await page.getByPlaceholder(/Suche nach Name/).fill("E2E22");
    await page.waitForTimeout(300);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("E2E22 Kunde")).toBeVisible();
    await expect(dialog.getByText("E2E22 Lehrer Ohne Kurs")).toHaveCount(0);
    await expect(dialog.getByText("E2E22 Lehrer Mit Kurs")).toHaveCount(0);
    await expect(dialog.getByText("E2E22 Admin")).toHaveCount(0);
    await page.keyboard.press("Escape");
  });

  test("Ungültige Eingaben bei 'Lehrer einladen' werden clientseitig abgelehnt", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/lehrer");
    await page.getByRole("button", { name: "Lehrer einladen" }).click();
    await page.waitForTimeout(400);

    // Name ist leer
    await page.getByLabel("E-Mail").fill("ungueltig-format");
    await page.getByRole("button", { name: "Einladung senden" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText("Name ist erforderlich")).toBeVisible();
    await expect(page.getByText("Bitte eine gültige E-Mail-Adresse eingeben")).toBeVisible();
  });

  test("Einladen einer bereits registrierten E-Mail zeigt verständlichen Fehlerhinweis", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/lehrer");
    await page.getByRole("button", { name: "Lehrer einladen" }).click();
    await page.waitForTimeout(400);
    await page.getByLabel("Name", { exact: true }).fill("Duplikat Test");
    await page.getByLabel("E-Mail").fill(TEACHER_NOCOURSE.email);
    await page.getByRole("button", { name: "Einladung senden" }).click();
    await page.waitForTimeout(1500);
    await expect(page.getByText("Diese E-Mail ist bereits registriert")).toBeVisible();
  });

  test("Bestehenden Kunden über Kundensuche befördern; verschwindet danach aus Kundenliste", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/lehrer");
    await page.getByRole("button", { name: "Bestehenden Kunden befördern" }).click();
    await page.waitForTimeout(400);
    await page.getByPlaceholder(/Suche nach Name/).fill("E2E22 Kunde");
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Befördern" }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText("E2E22 Kunde")).toBeVisible();

    await page.goto("/admin/kunden");
    await page.waitForTimeout(500);
    await expect(page.getByText("E2E22 Kunde")).toHaveCount(0);

    // und ist jetzt im Lehrer-Picker der Kurs-Verwaltung wählbar
    await page.goto("/admin/kurse");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Neuer Kurs" }).click();
    await page.waitForTimeout(500);
    await page.getByText("Lehrer auswählen").click();
    await page.waitForTimeout(300);
    await expect(page.getByText("E2E22 Kunde", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("Lehrer ohne Kurs-Zuordnung: Zurückstufen erfolgt sofort ohne Bestätigungsdialog", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/lehrer");
    const row = page.locator("tr", { hasText: "E2E22 Lehrer Ohne Kurs" });
    await row.getByRole("button", { name: "Zum Kunden zurückstufen" }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByText("E2E22 Lehrer Ohne Kurs")).toHaveCount(0);

    await page.goto("/admin/kunden");
    await page.waitForTimeout(500);
    await expect(page.getByText("E2E22 Lehrer Ohne Kurs")).toBeVisible();
  });

  test("Lehrer mit Kurs-Zuordnung: Zurückstufen zeigt Warnung mit Kursnamen; nach Bestätigung Rolle geändert", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/lehrer");
    const row = page.locator("tr", { hasText: "E2E22 Lehrer Mit Kurs" });
    await row.getByRole("button", { name: "Zum Kunden zurückstufen" }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await expect(page.getByRole("alertdialog").getByText("E2E5 Kizomba Beginner")).toBeVisible();

    await page.getByRole("alertdialog").getByRole("button", { name: "Zurückstufen" }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText("E2E22 Lehrer Mit Kurs")).toHaveCount(0);

    await page.goto("/admin/kunden");
    await page.waitForTimeout(500);
    await expect(page.getByText("E2E22 Lehrer Mit Kurs")).toBeVisible();

    // öffentliche Lehrer-Anzeige des Kurses zeigt die zurückgestufte Person nicht mehr
    await page.goto("/kurse");
    await page.waitForTimeout(500);
    const card = page.locator(".rounded-lg.border.bg-card", { hasText: "E2E5 Kizomba Beginner" });
    await expect(card.getByText("E2E22 Lehrer Mit Kurs")).toHaveCount(0);
  });

  // Gefunden am 2026-09-09 durch einen scheiternden Test in PROJ-40: Diese
  // Suite stuft „E2E22 Lehrer Mit Kurs" zurück und laesst die Kurszuweisung
  // bewusst stehen. Das Kursformular schickt beim Speichern aber alle
  // bestehenden Zuweisungen mit — und die zurueckgestufte Person steht nicht
  // mehr in der Auswahlliste. Sie war ausgewaehlt, aber unsichtbar, und der
  // Kurs liess sich nie wieder speichern: „Einer der ausgewaehlten Lehrer ist
  // ungueltig." Niemand konnte das in der Oberflaeche beheben.
  test("Ein Kurs bleibt speicherbar, wenn eine zugewiesene Lehrkraft zurückgestuft wurde", async ({
    page,
  }) => {
    // PROJ-22 legt seinen Dienst-Client im beforeAll an, nicht auf Modulebene.
    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: kurs } = await service
      .from("courses")
      .select("id")
      .eq("name", "E2E5 Kizomba Beginner")
      .single();
    const { data: person } = await service
      .from("profiles")
      .select("id")
      .eq("full_name", "E2E22 Lehrer Mit Kurs")
      .single();
    expect(kurs && person, "Fixtures fehlen").toBeTruthy();

    // Zustand herstellen: zugewiesen, aber keine Lehrkraft mehr.
    await service.from("profiles").update({ role: "customer" }).eq("id", person!.id);
    await service.from("course_teachers").upsert(
      { course_id: kurs!.id, teacher_id: person!.id },
      { onConflict: "course_id,teacher_id", ignoreDuplicates: true }
    );

    await login(page, ADMIN);
    await page.goto("/admin/kurse");
    await page.waitForLoadState("networkidle");
    await page
      .locator("tr", { hasText: "E2E5 Kizomba Beginner" })
      .first()
      .getByRole("button", { name: "Bearbeiten" })
      .click();
    await page.waitForTimeout(900);
    await page.getByRole("dialog").getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForTimeout(2500);

    await expect(
      page.getByText("Einer der ausgewählten Lehrer ist ungültig."),
      "Eine zurückgestufte Lehrkraft darf den Kurs nicht unbearbeitbar machen"
    ).toHaveCount(0);

    // Die tote Zuweisung ist beim Speichern verschwunden; die gueltige bleibt.
    const { data: danach } = await service
      .from("course_teachers")
      .select("teacher_id")
      .eq("course_id", kurs!.id);
    expect((danach ?? []).some((z) => z.teacher_id === person!.id)).toBe(false);
  });

});
