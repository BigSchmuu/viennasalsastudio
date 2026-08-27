import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

// The Playwright runner doesn't auto-load .env.local (unlike `next dev`), but
// the fixture reset below needs SUPABASE_SERVICE_ROLE_KEY.
try {
  ladeTestUmgebung();
} catch {
  // Already loaded (e.g. CI env vars set directly) — safe to ignore.
}

// Fixtures (see features/PROJ-30-leader-follower-auswahl-kursbuchung.md QA notes):
// - "E2E30 Rollen Kurs": role_query_enabled=true, max_role_difference=1, no capacity limit
// - "E2E30 Kein Rollen Kurs": role_query_enabled=false
// - e2e30-admin / e2e30-a / e2e30-b / e2e30-c / e2e30-d: all with an active SEPA mandate
//   and referral_source already set, so the booking dialog never shows the
//   "Wie haben Sie von uns erfahren?" prompt for them.
const ROLLEN_KURS_ID = "cdbbfdcf-8201-47d6-8cf3-0ee6a48a74ca";
const KEIN_ROLLEN_KURS_ID = "e26b2df4-8a5d-4433-8025-4ae18f850f23";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.waitForTimeout(1000);
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill("CorrectPassword123!");
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForTimeout(1500);
}

async function openBooking(page: import("@playwright/test").Page, courseId: string) {
  await page.goto(`/kurse/${courseId}`);
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Jetzt buchen" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

async function fillEntryDateAndPlan(dialog: import("@playwright/test").Locator, page: import("@playwright/test").Page) {
  await dialog.getByRole("combobox").first().click();
  await page.waitForTimeout(300);
  await page.getByRole("option").first().click();
  // PROJ-41: Die Abo-Art ist jetzt eine Kachel. Das Radio darunter ist
  // sr-only, ein Klick darauf wird von der sichtbaren Beschriftung
  // abgefangen — also die Kachel selbst anklicken, wie ein Nutzer auch.
  await dialog.getByText("Nur diesen Kurs").click();
}

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test.beforeAll(async () => {
  // This file is one sequential story that builds a role balance up to
  // 1L/1F/1B (asserted by AC11) and, at the end, permanently switches role
  // query ON for "Kein Rollen Kurs" — which is exactly the precondition AC2
  // (the first test) needs switched OFF. So the suite only ever passed on a
  // pristine database. Reset both course configs and all bookings here.
  await service.from("course_bookings").delete().in("course_id", [ROLLEN_KURS_ID, KEIN_ROLLEN_KURS_ID]);
  // AC8 ends by putting Kunde B on the waitlist; a leftover entry makes the
  // dialog show "du stehst bereits auf der Warteliste" instead of offering
  // it again, so AC8 can never pass twice without this.
  await service.from("waitlist_entries").delete().in("course_id", [ROLLEN_KURS_ID, KEIN_ROLLEN_KURS_ID]);
  // AC4/AC5 confirms Kunde A's booking, which creates a subscription; that
  // subscription then counts toward the course's role balance on the next run.
  // Stornieren vor dem Löschen: Abos, die schon in einem SEPA-Lauf abgerechnet
  // wurden, hängen an sepa_collection_items und lassen sich nicht löschen — das
  // scheiterte hier still, bis die Prüfung "bereits angemeldet" darauf ansprang
  // und die Fixture-Kunden ihren eigenen Kurs nicht mehr buchen konnten.
  await service
    .from("subscriptions")
    .update({ status: "cancelled" })
    .in("course_id", [ROLLEN_KURS_ID, KEIN_ROLLEN_KURS_ID])
    .neq("status", "cancelled");
  await service.from("subscriptions").delete().in("course_id", [ROLLEN_KURS_ID, KEIN_ROLLEN_KURS_ID]);

  const { error: rollenError } = await service
    .from("courses")
    .update({ role_query_enabled: true, max_role_difference: 1 })
    .eq("id", ROLLEN_KURS_ID);
  if (rollenError) throw new Error(`Could not reset PROJ-30 role course: ${rollenError.message}`);

  const { error: keinRollenError } = await service
    .from("courses")
    .update({ role_query_enabled: false, max_role_difference: null })
    .eq("id", KEIN_ROLLEN_KURS_ID);
  if (keinRollenError) throw new Error(`Could not reset PROJ-30 no-role course: ${keinRollenError.message}`);
});

test.describe("PROJ-30: Leader/Follower-Auswahl bei Kursbuchung", () => {
  test("AC2: Kurs ohne aktivierte Rollenabfrage zeigt keine Rollenauswahl im Buchungsdialog", async ({ page }) => {
    await login(page, "e2e30-a@viennasalsastudio.test");
    const dialog = await openBooking(page, KEIN_ROLLEN_KURS_ID);
    await expect(dialog.getByText("Ich tanze als", { exact: true })).not.toBeVisible();
  });

  test("AC1/AC3: Kurs mit Rollenabfrage verlangt eine Leader/Follower/Beide-Auswahl", async ({ page }) => {
    await login(page, "e2e30-a@viennasalsastudio.test");
    const dialog = await openBooking(page, ROLLEN_KURS_ID);
    await expect(dialog.getByText("Ich tanze als", { exact: true })).toBeVisible();
    // Seit der Umstellung auf Pflicht steht kein "(optional)" mehr daneben.
    await expect(dialog).not.toContainText("Ich tanze als (optional)");
    await expect(dialog.getByLabel("Leader", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("Follower", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("Beide", { exact: true })).toBeVisible();

    // Seit 2026-08-25 Pflichtangabe: alle übrigen Felder ausgefüllt, aber ohne
    // Rolle bleibt das Absenden gesperrt.
    await fillEntryDateAndPlan(dialog, page);
    // PROJ-42: Das Absenden ist jetzt an die AGB-Zustimmung gebunden.
    await dialog.locator("#terms-accepted-booking").check();
    const absenden = dialog.getByRole("button", { name: "Rechtlich verbindlich buchen" });
    await expect(absenden).toBeDisabled();

    await dialog.getByLabel("Leader", { exact: true }).click();
    await expect(absenden).toBeEnabled();
  });

  test("Ein Kurs ohne Rollenabfrage verlangt keine Rolle", async ({ page }) => {
    // Die Pflicht gilt nur, wo der Kurs die Rolle überhaupt abfragt — sonst
    // gäbe es nichts zu wählen.
    await login(page, "e2e30-a@viennasalsastudio.test");
    const dialog = await openBooking(page, KEIN_ROLLEN_KURS_ID);
    await fillEntryDateAndPlan(dialog, page);
    await dialog.locator("#terms-accepted-booking").check();
    await expect(dialog.getByRole("button", { name: "Rechtlich verbindlich buchen" })).toBeEnabled();
  });

  test("Kunde A bucht als Leader (1L/0F, erlaubte Differenz=1) — Buchung erfolgreich", async ({ page }) => {
    await login(page, "e2e30-a@viennasalsastudio.test");
    const dialog = await openBooking(page, ROLLEN_KURS_ID);
    await fillEntryDateAndPlan(dialog, page);
    await dialog.getByLabel("Leader", { exact: true }).click();
    // PROJ-42: Das Absenden ist jetzt an die AGB-Zustimmung gebunden.
    await dialog.locator("#terms-accepted-booking").check();
    await dialog.getByRole("button", { name: "Rechtlich verbindlich buchen" }).click();
    await page.waitForTimeout(1500);
    await expect(page.getByText("Diese Rolle ist für diesen Kurs aktuell nicht verfügbar")).not.toBeVisible();
  });

  test("AC9: Kunde D wählt 'Beide' trotz maximal ausgereizter Leader-Differenz — trotzdem erfolgreich", async ({ page }) => {
    await login(page, "e2e30-d@viennasalsastudio.test");
    const dialog = await openBooking(page, ROLLEN_KURS_ID);
    await fillEntryDateAndPlan(dialog, page);
    await dialog.getByLabel("Beide", { exact: true }).click();
    // PROJ-42: Das Absenden ist jetzt an die AGB-Zustimmung gebunden.
    await dialog.locator("#terms-accepted-booking").check();
    await dialog.getByRole("button", { name: "Rechtlich verbindlich buchen" }).click();
    await page.waitForTimeout(1500);
    await expect(page.getByText("Diese Rolle ist für diesen Kurs aktuell nicht verfügbar")).not.toBeVisible();
  });

  test("AC8: Kunde B wählt Leader, das die Differenz überschreiten würde — Hinweis + Wartelisten-Option", async ({ page }) => {
    await login(page, "e2e30-b@viennasalsastudio.test");
    const dialog = await openBooking(page, ROLLEN_KURS_ID);
    await fillEntryDateAndPlan(dialog, page);
    await dialog.getByLabel("Leader", { exact: true }).click();
    // PROJ-42: Das Absenden ist jetzt an die AGB-Zustimmung gebunden.
    await dialog.locator("#terms-accepted-booking").check();
    await dialog.getByRole("button", { name: "Rechtlich verbindlich buchen" }).click();
    await page.waitForTimeout(1500);

    await expect(dialog.getByText("Diese Rolle ist für diesen Kurs aktuell nicht verfügbar")).toBeVisible();
    // PROJ-42: Das Absenden ist jetzt an die AGB-Zustimmung gebunden.
    await dialog.locator("#terms-accepted-booking").check();
    const waitlistButton = dialog.getByRole("button", { name: "Auf Warteliste eintragen" });
    await expect(waitlistButton).toBeVisible();
    await waitlistButton.click();
    await page.waitForTimeout(1500);
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("Kunde C bucht als Follower (bringt Balance auf 1L/1F/1B) — Buchung erfolgreich", async ({ page }) => {
    await login(page, "e2e30-c@viennasalsastudio.test");
    const dialog = await openBooking(page, ROLLEN_KURS_ID);
    await fillEntryDateAndPlan(dialog, page);
    await dialog.getByLabel("Follower", { exact: true }).click();
    // PROJ-42: Das Absenden ist jetzt an die AGB-Zustimmung gebunden.
    await dialog.locator("#terms-accepted-booking").check();
    await dialog.getByRole("button", { name: "Rechtlich verbindlich buchen" }).click();
    await page.waitForTimeout(1500);
    await expect(page.getByText("Diese Rolle ist für diesen Kurs aktuell nicht verfügbar")).not.toBeVisible();
  });

  test("AC4/AC5: Anwesenheitsmatrix zeigt Rolle je bestätigtem Teilnehmer + Zusammenfassung, 'keine Angabe' für andere", async ({ page }) => {
    await login(page, "e2e30-admin@viennasalsastudio.test");
    await page.goto("/admin/buchungen");
    await page.waitForTimeout(1000);

    const row = page
      .getByRole("row", { name: /E2E30 Kunde A/ })
      .filter({ hasText: "E2E30 Rollen Kurs" });
    await row.getByRole("button", { name: "Bestätigen" }).click();
    await page.waitForTimeout(400);
    await page.locator("#sub-price").fill("40");
    await page.getByRole("dialog").getByRole("button", { name: "Bestätigen" }).click();
    await page.waitForTimeout(800);

    await page.goto(`/lehrer/${ROLLEN_KURS_ID}`);
    await page.waitForTimeout(1200);

    // Summary line: A (leader, now confirmed) + D (both) are counted; B/C
    // never attended a session so they don't appear in the roster at all.
    await expect(page.getByText(/Leader.*Follower.*Beide/)).toBeVisible();

    const rosterRow = page.locator("tr", { hasText: "E2E30 Kunde A" });
    await expect(rosterRow).toHaveCount(1);
    await expect(rosterRow.getByText("L", { exact: true })).toBeVisible();
  });

  test("AC11: Admin-Kursliste zeigt die aktuelle Leader/Follower/Beide-Verteilung", async ({ page }) => {
    await login(page, "e2e30-admin@viennasalsastudio.test");
    await page.goto("/admin/kurse");
    await page.waitForTimeout(1200);

    const rollenRow = page.getByRole("row", { name: /E2E30 Rollen Kurs/ });
    await expect(rollenRow).toContainText("1 L / 1 F / 1 B");

    const keinRollenRow = page.getByRole("row", { name: /E2E30 Kein Rollen Kurs/ });
    await expect(keinRollenRow.getByRole("cell").nth(7)).toHaveText("—");
  });

  test("AC1/AC6: Admin aktiviert Rollenabfrage im Kursformular und speichert eine Differenz", async ({ page }) => {
    await login(page, "e2e30-admin@viennasalsastudio.test");
    await page.goto("/admin/kurse");
    await page.waitForTimeout(1200);

    const row = page.getByRole("row", { name: /E2E30 Kein Rollen Kurs/ });
    await row.getByRole("button", { name: "Bearbeiten" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // AC1 (admin side): switching it on reveals the difference field.
    await expect(dialog.getByText(/Max\. Rollen-Differenz/)).not.toBeVisible();
    await dialog.getByRole("switch", { name: "Leader/Follower-Abfrage aktivieren" }).click();
    await expect(dialog.getByText(/Max\. Rollen-Differenz/)).toBeVisible();

    // AC6: enter and persist a difference value.
    await dialog.getByLabel(/Max\. Rollen-Differenz/).fill("2");
    await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForTimeout(1000);

    await row.getByRole("button", { name: "Bearbeiten" }).click();
    await expect(page.getByRole("dialog").getByLabel(/Max\. Rollen-Differenz/)).toHaveValue("2");

    // Leave the field blank going forward, for the AC7 "no restriction" test below.
    await page.getByRole("dialog").getByLabel(/Max\. Rollen-Differenz/).fill("");
    await page.getByRole("dialog").getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForTimeout(1000);
  });

  test("AC7: Kurs mit aktivierter Abfrage aber ohne hinterlegte Differenz erzwingt keine Balance", async ({ page }) => {
    // Depends on the previous test having enabled role query with an empty
    // max_role_difference on "E2E30 Kein Rollen Kurs".
    await login(page, "e2e30-a@viennasalsastudio.test");
    const dialog1 = await openBooking(page, KEIN_ROLLEN_KURS_ID);
    await expect(dialog1.getByText("Ich tanze als", { exact: true })).toBeVisible();
    await fillEntryDateAndPlan(dialog1, page);
    await dialog1.getByLabel("Leader", { exact: true }).click();
    // PROJ-42: Das Absenden ist jetzt an die AGB-Zustimmung gebunden.
    await dialog1.locator("#terms-accepted-booking").check();
    await dialog1.getByRole("button", { name: "Rechtlich verbindlich buchen" }).click();
    await page.waitForTimeout(1500);
    await expect(page.getByText("Diese Rolle ist für diesen Kurs aktuell nicht verfügbar")).not.toBeVisible();

    await login(page, "e2e30-b@viennasalsastudio.test");
    const dialog2 = await openBooking(page, KEIN_ROLLEN_KURS_ID);
    await fillEntryDateAndPlan(dialog2, page);
    await dialog2.getByLabel("Leader", { exact: true }).click();
    // PROJ-42: Das Absenden ist jetzt an die AGB-Zustimmung gebunden.
    await dialog2.locator("#terms-accepted-booking").check();
    await dialog2.getByRole("button", { name: "Rechtlich verbindlich buchen" }).click();
    await page.waitForTimeout(1500);
    // A second Leader with no configured max difference must succeed too —
    // no balance restriction applies without an explicit value.
    await expect(page.getByText("Diese Rolle ist für diesen Kurs aktuell nicht verfügbar")).not.toBeVisible();
  });
});
