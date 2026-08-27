import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

// The Playwright runner doesn't auto-load .env.local (unlike `next dev`), but
// the fixtures below need SUPABASE_SERVICE_ROLE_KEY.
try {
  ladeTestUmgebung();
} catch {
  // Already loaded (e.g. CI env vars set directly) — safe to ignore.
}

const ADMIN = { email: "e2e30-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const KUNDE = { email: "e2e8-customer@viennasalsastudio.test", password: "CorrectPassword123!" };
const LEHRER = { email: "e2e13-lehrer-a@viennasalsastudio.test", password: "CorrectPassword123!" };

const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// This project has no staging database — tests share the live fixture data and
// other suites create open bookings of their own. So every assertion below
// measures a *delta* the test caused itself, never an absolute count, and
// never a system-wide empty state.
const seeded: string[] = [];

async function seedBooking(type: "regular" | "dropin" | "trial", status: string) {
  const { data: customer } = await service
    .from("profiles")
    .select("id")
    .eq("full_name", "E2E8 Kunde")
    .single();
  const { data: course } = await service.from("courses").select("id").eq("name", "E2E8 Kurs").single();

  const { data, error } = await service
    .from("course_bookings")
    .insert({
      customer_id: customer!.id,
      course_id: course!.id,
      type,
      status,
      chosen_date: "2026-09-15",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Fixture-Buchung fehlgeschlagen: ${error.message}`);
  seeded.push(data!.id);
  return data!.id;
}

async function login(page: Page, creds: { email: string; password: string }) {
  await page.goto("/login");
  await page.waitForTimeout(1000);
  await page.getByLabel("E-Mail").fill(creds.email);
  await page.getByLabel("Passwort").fill(creds.password);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL(/\/(mein-bereich|profil|admin)$/, { timeout: 15000 });
}

/** Reads the counter off the Buchungen menu entry; 0 when no badge is shown. */
async function readBadge(page: Page): Promise<number> {
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  const badge = page.getByLabel(/offene Buchungen/);
  if ((await badge.count()) === 0) return 0;
  // aria-label carries the true number even when the text is capped at "99+".
  const label = await badge.first().getAttribute("aria-label");
  return Number(label!.match(/^(\d+)/)![1]);
}

test.afterAll(async () => {
  if (seeded.length) await service.from("course_bookings").delete().in("id", seeded);
});

test.describe("PROJ-39: Admin-Hinweis auf neue Buchungen", () => {
  test("AC1: Offene Buchungen erzeugen einen Zähler am Menüpunkt 'Buchungen'", async ({ page }) => {
    await login(page, ADMIN);
    await seedBooking("regular", "open");

    const badge = page.getByLabel(/offene Buchungen/);
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    await expect(badge).toBeVisible();
    expect(await badge.getAttribute("aria-label")).toMatch(/^\d+ offene Buchungen$/);
    // The badge belongs to Buchungen and nowhere else in the navigation.
    expect(await badge.locator("xpath=ancestor::a").getAttribute("href")).toBe("/admin/buchungen");
  });

  test("AC2: Jede neue offene Buchung erhöht den Zähler um genau eins", async ({ page }) => {
    await login(page, ADMIN);
    const before = await readBadge(page);

    await seedBooking("regular", "open");
    expect(await readBadge(page)).toBe(before + 1);

    await seedBooking("dropin", "open");
    // AC "Zählt eine Drop-in-Anfrage mit? → Ja"
    expect(await readBadge(page)).toBe(before + 2);
  });

  test("AC3: Bestätigte, abgelehnte und stornierte Buchungen zählen nicht mit", async ({ page }) => {
    await login(page, ADMIN);
    const before = await readBadge(page);

    await seedBooking("regular", "confirmed");
    await seedBooking("regular", "rejected");
    await seedBooking("dropin", "cancelled");

    expect(await readBadge(page)).toBe(before);
  });

  test("AC4: Eine Probestunde zählt nicht mit — sie ist automatisch bestätigt", async ({ page }) => {
    await login(page, ADMIN);
    const before = await readBadge(page);

    // Mirrors what create_self_service_booking does for trials: status 'confirmed'.
    await seedBooking("trial", "confirmed");

    expect(await readBadge(page)).toBe(before);
  });

  test("AC5: Bearbeitet der Admin eine Anfrage, sinkt der Zähler — ohne Wegklicken", async ({ page }) => {
    await login(page, ADMIN);
    const before = await readBadge(page);

    const bookingId = await seedBooking("regular", "open");
    expect(await readBadge(page)).toBe(before + 1);

    // Processing the request is the only thing that clears it: the counter is
    // derived from the work itself, so there is no "mark as read" step.
    await service.from("course_bookings").update({ status: "confirmed" }).eq("id", bookingId);

    expect(await readBadge(page)).toBe(before);
  });

  test("AC6: Ein Kunde sieht den Zähler nirgends", async ({ page }) => {
    await seedBooking("regular", "open");
    await login(page, KUNDE);

    await expect(page.getByLabel(/offene Buchungen/)).toHaveCount(0);

    // The whole admin area is closed to customers, counter included.
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/admin");
    await expect(page.getByLabel(/offene Buchungen/)).toHaveCount(0);
  });

  test("AC7: Ein Lehrer sieht den Zähler nirgends", async ({ page }) => {
    await seedBooking("regular", "open");
    await login(page, LEHRER);

    await expect(page.getByLabel(/offene Buchungen/)).toHaveCount(0);

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/admin");
  });

  test("Der Zähler bleibt auf dem Handy (375px) lesbar und sprengt das Menü nicht", async ({ page }) => {
    await login(page, ADMIN);
    await seedBooking("regular", "open");
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    const badge = page.getByLabel(/offene Buchungen/).first();
    await expect(badge).toBeVisible();

    const box = await badge.boundingBox();
    expect(box!.width).toBeLessThan(60);
    // The nav scrolls horizontally by design; the page body must not.
    const bodyOverflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(bodyOverflows).toBe(false);
  });

  test("Regression: Die Admin-Navigation bleibt vollständig", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    const nav = page.getByLabel("Admin-Navigation");
    for (const label of ["Dashboard", "Kurse", "Kunden", "Buchungen", "Rechnungen", "Gutscheine"]) {
      await expect(nav.getByRole("link", { name: new RegExp(label) }).first()).toBeVisible();
    }
  });
});
