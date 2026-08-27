import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

// The Playwright runner (unlike `next dev`) doesn't auto-load .env.local, but
// the fixture setup below needs SUPABASE_SERVICE_ROLE_KEY to seed/clean data.
try {
  ladeTestUmgebung();
} catch {
  // Already loaded (e.g. CI env vars set directly) — safe to ignore.
}

const ADMIN = { email: "e2e30-admin@viennasalsastudio.test", password: "CorrectPassword123!" };

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const CUSTOMERS = {
  offen: "e2e29-offen@viennasalsastudio.test",
  kontaktiert: "e2e29-kontaktiert@viennasalsastudio.test",
  konvertiert: "e2e29-konvertiert@viennasalsastudio.test",
  ueberfaellig: "e2e29-ueberfaellig@viennasalsastudio.test",
};

let courseId: string;
const customerIds: Record<string, string> = {};

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(ADMIN.email);
  await page.getByLabel("Passwort").fill(ADMIN.password);
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL(/\/(profil|admin)$/, { timeout: 10000 });
}

async function ensureCustomer(email: string): Promise<string> {
  // Look up by email via auth admin listUsers (small fixture set, fine to page through once).
  const { data: list } = await service.auth.admin.listUsers({ perPage: 200 });
  const found = list?.users.find((u) => u.email === email);
  if (found) return found.id;

  const { data: created, error } = await service.auth.admin.createUser({
    email,
    password: "CorrectPassword123!",
    email_confirm: true,
  });
  if (error || !created.user) throw new Error(`Could not create fixture user ${email}: ${error?.message}`);
  return created.user.id;
}

test.beforeAll(async () => {
  // Course (idempotent: reuse if a previous run left it behind).
  const { data: existingCourse } = await service.from("courses").select("id").eq("name", "E2E29 Probestunden Kurs").maybeSingle();
  if (existingCourse) {
    courseId = existingCourse.id;
  } else {
    const { data: room } = await service.from("rooms").select("id").limit(1).single();
    const { data: course, error } = await service
      .from("courses")
      .insert({ name: "E2E29 Probestunden Kurs", room_id: room!.id, role_query_enabled: false })
      .select("id")
      .single();
    if (error || !course) throw new Error(`Could not create fixture course: ${error?.message}`);
    courseId = course.id;
  }

  for (const [key, email] of Object.entries(CUSTOMERS)) {
    const id = await ensureCustomer(email);
    customerIds[key] = id;
    await service.from("profiles").update({ full_name: `E2E29 Kunde ${key}` }).eq("id", id);
  }

  // Reset any leftover bookings/followups from a previous (possibly crashed) run.
  await service.from("course_bookings").delete().eq("course_id", courseId);
  await service.from("trial_followups").delete().in(
    "booking_id",
    (await service.from("course_bookings").select("id").eq("course_id", courseId)).data?.map((b) => b.id) ?? []
  );

  const { data: trials, error: trialsError } = await service
    .from("course_bookings")
    .insert([
      { customer_id: customerIds.offen, course_id: courseId, type: "trial", chosen_date: daysAgo(5), status: "confirmed" },
      { customer_id: customerIds.kontaktiert, course_id: courseId, type: "trial", chosen_date: daysAgo(3), status: "confirmed" },
      { customer_id: customerIds.konvertiert, course_id: courseId, type: "trial", chosen_date: daysAgo(10), status: "confirmed" },
      { customer_id: customerIds.ueberfaellig, course_id: courseId, type: "trial", chosen_date: daysAgo(20), status: "confirmed" },
    ])
    .select("id, customer_id");
  if (trialsError || !trials) throw new Error(`Could not create fixture trials: ${trialsError?.message}`);

  // The "konvertiert" customer gets a CONFIRMED regular booking after their trial.
  await service.from("course_bookings").insert({
    customer_id: customerIds.konvertiert,
    course_id: courseId,
    type: "regular",
    chosen_date: daysAgo(8),
    status: "confirmed",
  });
});

test.afterAll(async () => {
  if (courseId) {
    const { data: bookings } = await service.from("course_bookings").select("id").eq("course_id", courseId);
    if (bookings?.length) {
      await service.from("trial_followups").delete().in("booking_id", bookings.map((b) => b.id));
    }
    await service.from("course_bookings").delete().eq("course_id", courseId);
  }
  // Fixture customers/course are intentionally left in place (idempotent, reused by the next run) —
  // only the per-run booking/followup state is reset here.
});

test.describe("PROJ-29: Probestunden-Follow-up & Conversion-Tracking", () => {
  test("AC1: Übersicht zeigt Kunde mit Kursname, Datum und Status", async ({ page }) => {
    await login(page);
    await page.goto("/admin/probestunden");
    const row = page.locator("tr", { hasText: "E2E29 Kunde offen" });
    await expect(row).toContainText("E2E29 Probestunden Kurs");
    await expect(row).toContainText("Offen");
  });

  test("AC2: Kunde mit bestätigter regulärer Buchung nach der Probestunde ist automatisch 'konvertiert'", async ({ page }) => {
    await login(page);
    await page.goto("/admin/probestunden");
    const row = page.locator("tr", { hasText: "E2E29 Kunde konvertiert" });
    await expect(row).toContainText("Konvertiert");
    await expect(row.getByRole("checkbox")).toHaveCount(0);
  });

  test("AC3: Kontaktiert-Haken + Notiz speichern und bleiben nach Reload sichtbar", async ({ page }) => {
    await login(page);
    await page.goto("/admin/probestunden");
    const row = page.locator("tr", { hasText: "E2E29 Kunde kontaktiert" });
    await row.getByRole("checkbox").click();
    await page.waitForTimeout(500);
    await row.getByPlaceholder("Notiz…").fill("Anruf hinterlassen, wartet auf Rückmeldung.");
    await row.getByPlaceholder("Notiz…").blur();
    await page.waitForTimeout(600);

    await page.reload();
    const rowAfter = page.locator("tr", { hasText: "E2E29 Kunde kontaktiert" });
    await expect(rowAfter).toContainText("Kontaktiert");
    await expect(rowAfter.getByPlaceholder("Notiz…")).toHaveValue("Anruf hinterlassen, wartet auf Rückmeldung.");
  });

  test("AC4: Conversion-Rate-Kachel zeigt Anteil konvertierter Probestunden für den Zeitraum", async ({ page }) => {
    await login(page);
    const from = daysAgo(11);
    const to = daysAgo(9);
    await page.goto(`/admin/probestunden?from=${from}&to=${to}`);
    await expect(page.getByText("Conversion-Rate im Zeitraum")).toBeVisible();
    await expect(page.getByText("1 / 1 Probestunden konvertiert")).toBeVisible();
    await expect(page.getByText("100%")).toBeVisible();
  });

  test("AC5: Probestunde >14 Tage ohne Kontakt/Konvertierung wird als 'Follow-up überfällig' hervorgehoben", async ({ page }) => {
    await login(page);
    await page.goto("/admin/probestunden");
    const row = page.locator("tr", { hasText: "E2E29 Kunde ueberfaellig" });
    await expect(row).toContainText("Follow-up überfällig");

    const notOverdueRow = page.locator("tr", { hasText: "E2E29 Kunde offen" });
    await expect(notOverdueRow).not.toContainText("Follow-up überfällig");
  });

  test("AC6: Status-Filter 'Offen' zeigt nur weder kontaktierte noch konvertierte Probestunden", async ({ page }) => {
    await login(page);
    await page.goto("/admin/probestunden");
    await page.getByLabel("Status").click();
    await page.getByRole("option", { name: "Offen", exact: true }).click();
    await expect(page).toHaveURL(/status=offen/);
    await expect(page.locator("tr", { hasText: "E2E29 Kunde offen" })).toBeVisible();
    await expect(page.locator("tr", { hasText: "E2E29 Kunde konvertiert" })).toHaveCount(0);
  });
});
