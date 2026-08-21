import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// The Playwright runner doesn't auto-load .env.local (unlike `next dev`), but
// the fixture setup below needs SUPABASE_SERVICE_ROLE_KEY.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Already loaded (e.g. CI env vars set directly) — safe to ignore.
}

const ADMIN = { email: "e2e30-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER_EMAIL = "e2e28-kurs-teilnehmer@viennasalsastudio.test";
const COURSE_NAME = "E2E28 Newsletter Kurs";

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let courseId: string;
let customerId: string;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(ADMIN.email);
  await page.getByLabel("Passwort").fill(ADMIN.password);
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL(/\/(profil|admin)$/, { timeout: 10000 });
}

test.beforeAll(async () => {
  // Course (idempotent: reuse if a previous run left it behind).
  const { data: existingCourse } = await service.from("courses").select("id").eq("name", COURSE_NAME).maybeSingle();
  if (existingCourse) {
    courseId = existingCourse.id;
  } else {
    const { data: room } = await service.from("rooms").select("id").limit(1).single();
    const { data: course, error } = await service
      .from("courses")
      .insert({ name: COURSE_NAME, room_id: room!.id, role_query_enabled: false })
      .select("id")
      .single();
    if (error || !course) throw new Error(`Could not create fixture course: ${error?.message}`);
    courseId = course.id;
  }

  // Customer — the ONLY member of this course's "Kurs-Teilnehmer" group, so
  // an actual "Senden" click during the permanent suite only ever reaches
  // this one disposable fixture, never a real customer.
  const { data: list } = await service.auth.admin.listUsers({ perPage: 200 });
  const existing = list?.users.find((u) => u.email === CUSTOMER_EMAIL);
  if (existing) {
    customerId = existing.id;
  } else {
    const { data: created, error } = await service.auth.admin.createUser({
      email: CUSTOMER_EMAIL,
      password: "CorrectPassword123!",
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(`Could not create fixture customer: ${error?.message}`);
    customerId = created.user.id;
  }
  await service.from("profiles").update({ full_name: "E2E28 Kurs Teilnehmer" }).eq("id", customerId);

  // Reset any leftover state from a previous (possibly crashed) run.
  await service.from("course_bookings").delete().eq("course_id", courseId);
  await service
    .from("notification_queue")
    .delete()
    .eq("customer_id", customerId)
    .eq("event_type", "newsletter");
  await service.from("newsletter_sends").delete().eq("recipient_group", "kurs_teilnehmer").eq("course_id", courseId);

  const { error: bookingError } = await service.from("course_bookings").insert({
    customer_id: customerId,
    course_id: courseId,
    type: "regular",
    chosen_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    status: "open",
  });
  if (bookingError) throw new Error(`Could not create fixture booking: ${bookingError.message}`);
});

test.afterAll(async () => {
  if (courseId) {
    const { data: sends } = await service.from("newsletter_sends").select("id").eq("course_id", courseId);
    for (const send of sends ?? []) {
      await service.from("notification_queue").delete().contains("payload", { send_id: send.id });
      await service.from("newsletter_sends").delete().eq("id", send.id);
    }
    await service.from("course_bookings").delete().eq("course_id", courseId);
  }
  // Fixture course/customer are intentionally left in place (idempotent, reused by
  // the next run) — only the per-run booking/send/queue state is reset here.
});

test.describe("PROJ-28: Newsletter-Versand mit Empfängergruppen", () => {
  test("AC1: Empfängerzahl aktualisiert sich bei Gruppenwahl", async ({ page }) => {
    await login(page);
    await page.goto("/admin/newsletter");
    await expect(page.getByRole("heading", { name: "Newsletter" })).toBeVisible();

    // "Alle"/"Aktive" only checked for a rendered count — never sent to during this suite.
    await page.getByLabel("Empfängergruppe").click();
    await page.getByRole("option", { name: "Alle Kunden", exact: true }).click();
    await page.waitForTimeout(600);
    await expect(page.getByText(/\d+ Empfänger in dieser Gruppe\./)).toBeVisible();

    await page.getByLabel("Empfängergruppe").click();
    await page.getByRole("option", { name: "Kurs-Teilnehmer", exact: true }).click();
    await page.getByLabel("Kurs").click();
    await page.getByRole("option", { name: COURSE_NAME }).click();
    await page.waitForTimeout(600);
    await expect(page.getByText("1 Empfänger in dieser Gruppe.")).toBeVisible();
  });

  test("AC7 + AC8: Senden-Button deaktiviert bei leerem Formular, fehlendem Kurs und 0 Empfängern", async ({ page }) => {
    await login(page);
    await page.goto("/admin/newsletter");
    await expect(page.getByRole("button", { name: "Senden" })).toBeDisabled();

    await page.getByLabel("Betreff").fill("Test");
    await page.getByLabel("Text").fill("Test");
    await page.getByLabel("Empfängergruppe").click();
    await page.getByRole("option", { name: "Kurs-Teilnehmer", exact: true }).click();
    await expect(page.getByRole("button", { name: "Senden" })).toBeDisabled();
  });

  test("AC2 + AC10: voller Versand-Flow (isolierter Testkurs, 1 Empfänger), Bestätigung, Historie", async ({ page }) => {
    await login(page);
    await page.goto("/admin/newsletter");

    const subject = `E2E28 Test-Newsletter ${Date.now()}`;
    await page.getByLabel("Betreff").fill(subject);
    await page.getByLabel("Text").fill("Dies ist ein automatisierter E2E-Test-Newsletter.");
    await page.getByLabel("Empfängergruppe").click();
    await page.getByRole("option", { name: "Kurs-Teilnehmer", exact: true }).click();
    await page.getByLabel("Kurs").click();
    await page.getByRole("option", { name: COURSE_NAME }).click();
    await page.waitForTimeout(600);
    await expect(page.getByText("1 Empfänger in dieser Gruppe.")).toBeVisible();

    await page.getByRole("button", { name: "Senden" }).click();
    await expect(page.getByText(/wird an 1 Empfänger/)).toBeVisible();
    await page.getByRole("button", { name: "Jetzt senden" }).click();
    await page.waitForTimeout(1000);

    await expect(page.getByText("Newsletter an 1 Empfänger verschickt.")).toBeVisible();
    await expect(page.getByLabel("Betreff")).toHaveValue("");

    const historyRow = page.locator("tr", { hasText: subject });
    await expect(historyRow).toBeVisible();
    await expect(historyRow).toContainText("Kurs-Teilnehmer");
    await expect(historyRow).toContainText(COURSE_NAME);
  });
});
