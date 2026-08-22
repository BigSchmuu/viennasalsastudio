import { test, expect, type Page, type Locator } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// The Playwright runner doesn't auto-load .env.local (unlike `next dev`), but
// the fixture reset below needs SUPABASE_SERVICE_ROLE_KEY.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Already loaded (e.g. CI env vars set directly) — safe to ignore.
}

const CUSTOMER_NO_SUB = { email: "e2e26-customer-no-sub@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER_WITH_SUB = { email: "e2e26-customer-with-sub@viennasalsastudio.test", password: "CorrectPassword123!" };

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test.beforeAll(async () => {
  // /stundenplan only renders upcoming occurrences, so a fixture course
  // pinned to a fixed weekday is invisible on every other day of the week —
  // the whole suite then fails for a reason that has nothing to do with the
  // feature. Repin both fixture courses to *today* on every run, same
  // approach as PROJ-25's re-priming.
  const jsDay = new Date().getDay();
  const todayWeekday = jsDay === 0 ? 6 : jsDay - 1; // app convention: 0=Mo ... 6=So

  const { data: courses } = await service.from("courses").select("id, name").like("name", "E2E26%");
  if (!courses?.length) throw new Error("PROJ-26 fixture courses not found");
  for (const course of courses) {
    await service.from("course_schedule").update({ weekday: todayWeekday }).eq("course_id", course.id);
    // A pause dated today would suppress the occurrence entirely.
    const { data: schedule } = await service
      .from("course_schedule")
      .select("id")
      .eq("course_id", course.id)
      .maybeSingle();
    if (schedule) await service.from("course_schedule_pauses").delete().eq("schedule_id", schedule.id);
  }

  // AC6 books a drop-in and leaves it behind; on a re-run those pile up and
  // the course can drift toward "full". Clear this suite's own leftovers.
  const { data: users } = await service.auth.admin.listUsers({ perPage: 200 });
  const noSubId = users?.users.find((u) => u.email === CUSTOMER_NO_SUB.email)?.id;
  if (noSubId) {
    await service
      .from("course_bookings")
      .delete()
      .eq("customer_id", noSubId)
      .in(
        "course_id",
        courses.map((c) => c.id)
      );
    // A customer whose profile has no referral_source gets the mandatory
    // "Wie haben Sie von uns erfahren?" prompt (PROJ-8), which blocks
    // submitting. AC6 is about booking a drop-in from /stundenplan, not
    // about that prompt — so seed the answered state here rather than
    // making every test click through it.
    await service.from("profiles").update({ referral_source: "google" }).eq("id", noSubId);
  }
});

async function login(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForTimeout(1500);
}

// shadcn Card root: "rounded-lg border ..."
function courseCard(page: Page, name: string): Locator {
  return page.locator(".rounded-lg.border").filter({ hasText: name });
}

test.describe("PROJ-26: Kursbuchung direkt von /stundenplan aus", () => {
  test("AC1: Kunde ohne aktives Abo sieht 'Buchen' bei einem Kurstermin", async ({ page }) => {
    await login(page, CUSTOMER_NO_SUB);
    await page.goto("/stundenplan");
    const card = courseCard(page, "E2E26 Buchbar Kurs");
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: "Buchen" })).toBeVisible();
  });

  test("AC2: Klick auf 'Buchen' öffnet denselben Dialog wie /kurse mit allen drei Tabs", async ({ page }) => {
    await login(page, CUSTOMER_NO_SUB);
    await page.goto("/stundenplan");
    const card = courseCard(page, "E2E26 Buchbar Kurs");
    await card.getByRole("button", { name: "Buchen" }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Anmeldung" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Probestunde" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Drop-in" })).toBeVisible();
  });

  test("AC3: Nicht eingeloggter Besucher wird beim Klick auf 'Buchen' zum Login weitergeleitet (mit Rücksprung)", async ({
    page,
  }) => {
    await page.goto("/stundenplan");
    const card = courseCard(page, "E2E26 Buchbar Kurs");
    await card.getByRole("button", { name: "Buchen" }).click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/login\?redirect=\/stundenplan/);
  });

  test("AC4: Kunde mit aktivem Abo für den Kurs sieht dort keinen Buchen-Button", async ({ page }) => {
    await login(page, CUSTOMER_WITH_SUB);
    await page.goto("/stundenplan");
    const card = courseCard(page, "E2E26 Buchbar Kurs");
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: "Buchen" })).toHaveCount(0);
  });

  test("AC5: Ausgebuchter Kurs zeigt 'Ausgebucht' direkt auf der Stundenplan-Karte", async ({ page }) => {
    await login(page, CUSTOMER_NO_SUB);
    await page.goto("/stundenplan");
    const card = courseCard(page, "E2E26 Ausgebucht Kurs");
    await expect(card).toBeVisible();
    await expect(card.getByText("Ausgebucht", { exact: true })).toBeVisible();
    // The button is still offered — fullness is surfaced inside the dialog
    // itself (e.g. waitlist), matching /kurse's existing behavior.
    await expect(card.getByRole("button", { name: "Buchen" })).toBeVisible();
  });

  test("AC6: Vollständige Drop-in-Buchung über /stundenplan verhält sich wie über /kurse und erscheint unter Meine Buchungen", async ({
    page,
  }) => {
    await login(page, CUSTOMER_NO_SUB);
    await page.goto("/stundenplan");

    const card = courseCard(page, "E2E26 Buchbar Kurs");
    await card.getByRole("button", { name: "Buchen" }).click();
    await page.getByRole("tab", { name: "Drop-in" }).click();
    await page.waitForTimeout(300);

    await page.getByRole("combobox").first().click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: "Absenden" }).click();
    await page.waitForTimeout(1000);

    await page.goto("/profil");
    // /profil's sections live behind a collapsed Accordion (Radix unmounts
    // closed content entirely) — must click the trigger, not just scroll to
    // it, before any booking is in the DOM.
    await page.getByRole("button", { name: "Meine Buchungen" }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText("E2E26 Buchbar Kurs")).toBeVisible();
  });
});

// AC7 ("ein Kurstermin erscheint an mehreren Wochentagen") describes a
// scenario that cannot occur with the current data model: course_schedule
// has a UNIQUE constraint on course_id (one weekly slot per course,
// isOneToOne in the generated Supabase types). Verified directly against
// production (a second INSERT for an existing course_id was rejected with
// "duplicate key value violates unique constraint course_schedule_course_id_key").
// Not a PROJ-26 bug — the per-entry booking logic is generated independently
// for every (course, weekday) pair in the schedule loop and would handle a
// second weekday correctly if the data model ever allowed it — but no real
// fixture can be constructed to exercise it today. See QA notes.
