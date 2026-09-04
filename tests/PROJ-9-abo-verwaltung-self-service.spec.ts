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

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER = { email: "e2e24-customer@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER_MULTI = { email: "e2e8-customer-nomandate@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER_DUE = { email: "e2e8-customer-today@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER_FLATRATE = { email: "e2e7-customer-solo@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER_EMPTY = { email: "e2e7-customer-empty@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER_DUE_ID = "024c4c0a-03f8-4a2d-bce5-5a85f07ca5e7";

async function login(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto("/login");
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

// /profil's sections live behind a collapsed Accordion (Radix unmounts closed
// content entirely) — must expand "Mein Abo" before any subscription <li> is
// in the DOM.
async function openAboSection(page: Page) {
  await page.getByRole("button", { name: "Mein Abo" }).click();
  await page.waitForTimeout(400);
}

/**
 * Every test here changes the subscription it depends on: one reactivates the
 * paused one, another applies the due cancellation. Nothing restored those, so
 * the suite passed once and then failed forever — the fixtures ended up
 * contradicting their names ("Paused Abo" sitting on active, "Due Abo" already
 * cancelled). There is no staging database, so the starting state is restored
 * explicitly here.
 */
test.beforeAll(async () => {
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // AC8 creates a debit run for 2026-12-24 and confirms the duplicate-run
  // dialog on re-runs, so every past run left another one behind — five had
  // piled up before this reset existed.
  const { data: staleRuns } = await service
    .from("sepa_collection_runs")
    .select("id")
    .eq("due_date", "2026-12-24");
  const staleRunIds = (staleRuns ?? []).map((r) => r.id);
  if (staleRunIds.length) {
    // Every run also writes invoices. Leaving those behind was how 98 invoices
    // for this single date piled up and eventually broke PROJ-10, whose
    // assertions drowned in the noise. Invoices first — they reference the
    // collection items.
    await service.from("invoices").delete().eq("invoice_date", "2026-12-24");
    await service.from("sepa_collection_items").delete().in("run_id", staleRunIds);
    await service.from("sepa_collection_runs").delete().in("id", staleRunIds);
  }

  const { data: bodymovement } = await service
    .from("courses")
    .select("id")
    .eq("name", "Bodymovement")
    .maybeSingle();
  if (!bodymovement) throw new Error("PROJ-9 Fixture-Kurs fehlt: Bodymovement");

  const clean = { pending_status: null, pending_effective_date: null, cancelled_at: null };

  const resets: { name: string; patch: Record<string, unknown> }[] = [
    // AC6 moves this one to Pachanga and back; restoring the course guards
    // against a run that aborted midway.
    { name: "E2E9 Testabo", patch: { ...clean, status: "active", course_id: bodymovement.id } },
    { name: "E2E9 Multi Abo A", patch: { ...clean, status: "active" } },
    { name: "E2E9 Multi Abo B", patch: { ...clean, status: "active" } },
    // AC4 reactivates this one — it has to start out paused.
    { name: "E2E9 Paused Abo", patch: { ...clean, status: "paused" } },
    { name: "E2E7 Solo Abo", patch: { ...clean, status: "active" } },
  ];

  for (const { name, patch } of resets) {
    const { error } = await service.from("subscriptions").update(patch).eq("name", name);
    if (error) throw new Error(`PROJ-9 Fixture-Reset (${name}) fehlgeschlagen: ${error.message}`);
  }

  // "Due Abo" needs a cancellation that is already due, so the admin page
  // offers "Jetzt übernehmen". Yesterday keeps it due regardless of run time.
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dueDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(
    yesterday.getDate()
  ).padStart(2, "0")}`;

  const { error: dueError } = await service
    .from("subscriptions")
    .update({
      status: "active",
      pending_status: "cancelled",
      pending_effective_date: dueDate,
      cancelled_at: null,
    })
    .eq("name", "E2E9 Due Abo");
  if (dueError) throw new Error(`PROJ-9 Fixture-Reset (Due Abo) fehlgeschlagen: ${dueError.message}`);
});

test.describe("PROJ-9: Abo-Verwaltung (Self-Service Pause/Kündigung)", () => {
  test("Kunde ohne Abo sieht Leerzustand statt leerer Liste", async ({ page }) => {
    await login(page, CUSTOMER_EMPTY);
    await page.waitForTimeout(600);
    await openAboSection(page);
    await expect(page.getByText("Kein aktives Abo vorhanden.")).toBeVisible();
  });

  test("AC1: Pausieren speichert geplante Pausierung zum nächsten Zyklusende, Abo bleibt Aktiv mit Hinweis", async ({
    page,
  }) => {
    await login(page, CUSTOMER);
    await page.waitForTimeout(600);
    await openAboSection(page);
    const card = page.locator("li", { hasText: "E2E9 Testabo" });
    await card.getByRole("button", { name: "Pausieren" }).click();
    await page.waitForTimeout(800);
    await expect(card.getByText("Aktiv")).toBeVisible();
    await expect(card.getByText(/Wird pausiert ab \d{2}\.\d{2}\.\d{4}/)).toBeVisible();
  });

  test("AC3: Rückgängig machen entfernt die geplante Änderung vor dem Wirksamkeitsdatum", async ({ page }) => {
    await login(page, CUSTOMER);
    await page.waitForTimeout(600);
    await openAboSection(page);
    const card = page.locator("li", { hasText: "E2E9 Testabo" });
    await card.getByRole("button", { name: "Rückgängig machen" }).click();
    await page.waitForTimeout(800);
    await expect(card.getByText(/Wird pausiert ab/)).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Pausieren" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Kündigen" })).toBeVisible();
  });

  test("AC2: Kündigen speichert geplante Kündigung zum nächsten Zyklusende, Abo bleibt Aktiv mit Hinweis", async ({
    page,
  }) => {
    await login(page, CUSTOMER);
    await page.waitForTimeout(600);
    await openAboSection(page);
    const card = page.locator("li", { hasText: "E2E9 Testabo" });
    await card.getByRole("button", { name: "Kündigen" }).click();
    await page.waitForTimeout(800);
    await expect(card.getByText("Aktiv")).toBeVisible();
    await expect(card.getByText(/Wird gekündigt ab \d{2}\.\d{2}\.\d{4}/)).toBeVisible();
  });

  test("AC6: Umbuchen wechselt den Kurs sofort, auch bei laufender geplanter Kündigung; Preis bleibt unverändert", async ({
    page,
  }) => {
    await login(page, CUSTOMER);
    await page.waitForTimeout(600);
    await openAboSection(page);
    const card = page.locator("li", { hasText: "E2E9 Testabo" });
    await expect(card.getByText("Bodymovement")).toBeVisible();
    await expect(card.getByText("45,00")).toBeVisible();

    await card.getByRole("button", { name: "Umbuchen" }).click();
    await page.waitForTimeout(400);
    await page.getByRole("dialog").getByRole("combobox").click();
    await page.waitForTimeout(300);
    await page.getByRole("option", { name: "Pachanga", exact: true }).click();
    await page.getByRole("button", { name: "Umbuchen bestätigen" }).click();
    await page.waitForTimeout(800);

    await expect(card.getByText("Pachanga")).toBeVisible();
    await expect(card.getByText("45,00")).toBeVisible();
    // Umbuchen must not clear the still-pending Kündigung from the previous test
    await expect(card.getByText(/Wird gekündigt ab/)).toBeVisible();

    // reset fixture back to its original course + no pending change, for suite re-runnability
    await card.getByRole("button", { name: "Rückgängig machen" }).click();
    await page.waitForTimeout(800);
    await card.getByRole("button", { name: "Umbuchen" }).click();
    await page.waitForTimeout(400);
    await page.getByRole("dialog").getByRole("combobox").click();
    await page.waitForTimeout(300);
    await page.getByRole("option", { name: "Bodymovement", exact: true }).click();
    await page.getByRole("button", { name: "Umbuchen bestätigen" }).click();
    await page.waitForTimeout(800);
    await expect(card.getByText("Bodymovement")).toBeVisible();
  });

  test("AC7: Flatrate-Abo (kein Kurs-Bezug) zeigt keine Umbuchen-Option", async ({ page }) => {
    await login(page, CUSTOMER_FLATRATE);
    await page.waitForTimeout(600);
    await openAboSection(page);
    const card = page.locator("li", { hasText: "E2E7 Solo Abo" });
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: "Umbuchen" })).toHaveCount(0);
  });

  test("Edge Case: Kunde mit mehreren aktiven Abos sieht jedes einzeln mit eigenen Aktionen", async ({ page }) => {
    await login(page, CUSTOMER_MULTI);
    await page.waitForTimeout(600);
    await openAboSection(page);
    const cardA = page.locator("li", { hasText: "E2E9 Multi Abo A" });
    const cardB = page.locator("li", { hasText: "E2E9 Multi Abo B" });
    await expect(cardA.getByRole("button", { name: "Pausieren" })).toBeVisible();
    await expect(cardA.getByRole("button", { name: "Kündigen" })).toBeVisible();
    await expect(cardB.getByRole("button", { name: "Pausieren" })).toBeVisible();
    await expect(cardB.getByRole("button", { name: "Kündigen" })).toBeVisible();
  });

  test("AC4: Reaktivieren setzt ein pausiertes Abo sofort auf Aktiv, ohne Wartezeit", async ({ page }) => {
    await login(page, CUSTOMER_MULTI);
    await page.waitForTimeout(600);
    await openAboSection(page);
    const card = page.locator("li", { hasText: "E2E9 Paused Abo" });
    await expect(card.getByText("Pausiert")).toBeVisible();
    await card.getByRole("button", { name: "Reaktivieren" }).click();
    await page.waitForTimeout(800);
    await expect(card.getByText("Aktiv")).toBeVisible();
    await expect(card.getByRole("button", { name: "Pausieren" })).toBeVisible();
  });

  test("AC9 + AC5: Admin 'Jetzt übernehmen' setzt fällige geplante Kündigung um; Kunde sieht Gekündigt ohne Reaktivieren", async ({
    page,
  }) => {
    await login(page, ADMIN);
    await page.goto(`/admin/kunden/${CUSTOMER_DUE_ID}`);
    await page.waitForTimeout(600);
    await expect(page.getByText(/Geplante Änderung: Kündigung ab/)).toBeVisible();
    const applyButton = page.getByRole("button", { name: "Jetzt übernehmen" });
    await expect(applyButton).toBeVisible();
    await applyButton.click();
    await page.waitForTimeout(800);
    await expect(page.getByText(/Geplante Änderung/)).toHaveCount(0);

    await login(page, CUSTOMER_DUE);
    await page.waitForTimeout(600);
    await openAboSection(page);
    const card = page.locator("li", { hasText: "E2E9 Due Abo" });
    await expect(card.getByText("Gekündigt")).toBeVisible();
    await expect(card.getByRole("button", { name: "Reaktivieren" })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Pausieren" })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Kündigen" })).toHaveCount(0);
  });

  test("AC8: SEPA-Lauf schließt Abo mit fälliger geplanter Änderung automatisch aus", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/lastschriften");
    await page.waitForTimeout(400);
    await page.locator("#due-date").fill("2026-12-24");
    await page.getByRole("button", { name: "Lauf erstellen" }).click();
    await page.waitForTimeout(800);

    // if a run for this date somehow already exists (re-run), confirm the duplicate-run dialog
    const duplicateDialog = page.getByRole("alertdialog", { name: /Bereits ein Lauf/ });
    if (await duplicateDialog.isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Trotzdem erstellen" }).click();
      await page.waitForTimeout(800);
    }

    await expect(page).toHaveURL(/\/admin\/lastschriften\/[a-f0-9-]+/);
    await expect(page.getByText("E2E9 Due Abo")).toHaveCount(0);
    await expect(page.getByText("E2E8 Kunde Heute")).toHaveCount(0);
  });
});
