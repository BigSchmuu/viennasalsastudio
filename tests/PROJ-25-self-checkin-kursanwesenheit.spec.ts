import { test, expect, type Page, type Locator } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// The Playwright runner doesn't auto-load .env.local (unlike `next dev`), but
// the fixture reset below needs SUPABASE_SERVICE_ROLE_KEY.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Already loaded (e.g. CI env vars set directly) — safe to ignore.
}

// This feature's core behavior is deliberately wall-clock-time-sensitive
// (self-check-in window opens 30 min before class, closes at class end),
// and course_schedule.weekday must match "today" in Vienna time for an
// occurrence to render at all (see src/lib/scheduling/dates.ts). A fixed
// fixture anchor date goes stale as soon as it isn't run on that exact day —
// the beforeAll below recomputes each fixture course's weekday/start_time/
// end_time relative to the actual current time on every run instead.

const CUSTOMER_WITH_ABO = { email: "e2e25-customer-with-abo@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER_NO_ABO = { email: "e2e25-customer-no-abo@viennasalsastudio.test", password: "CorrectPassword123!" };
const ADMIN = { email: "e2e14-admin@viennasalsastudio.test", password: "CorrectPassword123!" };

const COURSE_IM_FENSTER_ID = "d61c66bd-338d-433a-b109-930ef0ef1e1b";

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Mirrors src/lib/scheduling/dates.ts's Vienna-wall-clock + weekday
// conventions (0=Montag...6=Sonntag) — duplicated here rather than imported
// since test files don't reach into app source elsewhere in this repo.
function viennaNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Vienna" }));
}
function viennaWeekday(date: Date): number {
  const jsDay = date.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}
function timeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:00`;
}
function dateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

test.beforeAll(async () => {
  const now = viennaNow();
  const todayWeekday = viennaWeekday(now);
  const today = dateString(now);

  async function setSchedule(courseName: string, startOffsetMin: number, endOffsetMin: number) {
    const { data: course } = await service.from("courses").select("id").eq("name", courseName).single();
    if (!course) throw new Error(`PROJ-25 fixture course '${courseName}' not found`);
    const { error } = await service
      .from("course_schedule")
      .update({
        weekday: todayWeekday,
        start_time: timeString(addMinutes(now, startOffsetMin)),
        end_time: timeString(addMinutes(now, endOffsetMin)),
      })
      .eq("course_id", course.id);
    if (error) throw new Error(`Could not reprime schedule for '${courseName}': ${error.message}`);
  }

  await setSchedule("E2E25 Zu Früh Kurs", 120, 180); // starts in 2h — well outside the 30-min pre-window
  await setSchedule("E2E25 Im Fenster Kurs", 15, 90); // starts in 15min (inside window), ends in 90min
  await setSchedule("E2E25 Beendet Kurs", -120, -60); // started 2h ago, ended 1h ago — but still today

  // "Pausiert Kurs" keeps the same weekday as today (it would otherwise
  // occur), but a pause exception dated today suppresses the occurrence —
  // that's the actual behavior AC9 exercises.
  const { data: pausedCourse } = await service.from("courses").select("id").eq("name", "E2E25 Pausiert Kurs").single();
  if (!pausedCourse) throw new Error("PROJ-25 fixture course 'E2E25 Pausiert Kurs' not found");
  const { data: pausedSchedule } = await service
    .from("course_schedule")
    .update({ weekday: todayWeekday, start_time: timeString(addMinutes(now, 180)), end_time: timeString(addMinutes(now, 240)) })
    .eq("course_id", pausedCourse.id)
    .select("id")
    .single();
  if (!pausedSchedule) throw new Error("Could not reprime 'E2E25 Pausiert Kurs' schedule");
  await service.from("course_schedule_pauses").update({ pause_date: today }).eq("schedule_id", pausedSchedule.id);

  // AC2/3 assumes CUSTOMER_WITH_ABO is NOT yet checked in for today's
  // occurrence (unlike AC4/AC6/7/"Rand", which self-heal either way) — clear
  // any leftover attendance row so a same-day re-run starts clean too.
  const { data: users } = await service.auth.admin.listUsers({ perPage: 200 });
  const customerId = users?.users.find((u) => u.email === CUSTOMER_WITH_ABO.email)?.id;
  if (!customerId) throw new Error("PROJ-25 fixture customer not found");
  const { data: imFensterCourse } = await service.from("courses").select("id").eq("name", "E2E25 Im Fenster Kurs").single();
  const { data: beendetCourse } = await service.from("courses").select("id").eq("name", "E2E25 Beendet Kurs").single();
  for (const course of [imFensterCourse, beendetCourse]) {
    if (!course) continue;
    await service
      .from("course_attendance")
      .delete()
      .eq("customer_id", customerId)
      .eq("course_id", course.id)
      .eq("occurrence_date", today);
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

test.describe("PROJ-25: Self-Check-In für Kursanwesenheit (Abo-Kunden)", () => {
  test("AC1: Mehr als 30 Minuten vor Kursbeginn ist kein Self-Check-In-Button sichtbar", async ({ page }) => {
    await login(page, CUSTOMER_WITH_ABO);
    await page.goto("/stundenplan");
    const card = courseCard(page, "E2E25 Zu Früh Kurs");
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: "Ich bin da" })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "✓ Eingecheckt" })).toHaveCount(0);
  });

  test("AC2, AC3: Ab 30 Minuten vor Kursbeginn erscheint 'Ich bin da', Klick checkt sofort ein", async ({ page }) => {
    await login(page, CUSTOMER_WITH_ABO);
    await page.goto("/stundenplan");
    const card = courseCard(page, "E2E25 Im Fenster Kurs");
    await expect(card).toBeVisible();

    const button = card.getByRole("button", { name: "Ich bin da" });
    await expect(button).toBeVisible();
    await button.click();
    await expect(card.getByRole("button", { name: "✓ Eingecheckt" })).toBeVisible();
  });

  test("AC4: Erneuter Klick vor Kursende macht den Check-In rückgängig", async ({ page }) => {
    await login(page, CUSTOMER_WITH_ABO);
    await page.goto("/stundenplan");
    const card = courseCard(page, "E2E25 Im Fenster Kurs");

    // Ensure a known starting state: checked in (from the previous test, or check in now).
    let checkedButton = card.getByRole("button", { name: "✓ Eingecheckt" });
    if ((await checkedButton.count()) === 0) {
      await card.getByRole("button", { name: "Ich bin da" }).click();
      checkedButton = card.getByRole("button", { name: "✓ Eingecheckt" });
      await expect(checkedButton).toBeVisible();
    }

    await checkedButton.click();
    await expect(card.getByRole("button", { name: "Ich bin da" })).toBeVisible();

    // Leave it checked in again for subsequent tests (roster/conflict checks).
    await card.getByRole("button", { name: "Ich bin da" }).click();
    await expect(card.getByRole("button", { name: "✓ Eingecheckt" })).toBeVisible();
  });

  test("AC8: Kunde ohne aktives Abo für einen heutigen Kurs sieht keinen Self-Check-In-Button", async ({ page }) => {
    await login(page, CUSTOMER_NO_ABO);
    await page.goto("/stundenplan");
    const card = courseCard(page, "E2E25 Im Fenster Kurs");
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: "Ich bin da" })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "✓ Eingecheckt" })).toHaveCount(0);
  });

  test("AC9: An einem pausierten Kurstag erscheint kein Self-Check-In-Button (der Termin selbst wird gar nicht erst angezeigt, PROJ-6-Verhalten)", async ({
    page,
  }) => {
    await login(page, CUSTOMER_WITH_ABO);
    await page.goto("/stundenplan");
    await expect(courseCard(page, "E2E25 Pausiert Kurs")).toHaveCount(0);
  });

  test("Rand: nach Kursende zeigt ein bereits eingechecktes Ticket einen nicht klickbaren Zustand", async ({ page }) => {
    await login(page, CUSTOMER_WITH_ABO);
    await page.goto("/stundenplan");
    const card = courseCard(page, "E2E25 Beendet Kurs");
    await expect(card).toBeVisible();

    // First-time late check-in must still succeed (allowed until midnight).
    const openButton = card.getByRole("button", { name: "Ich bin da" });
    if ((await openButton.count()) > 0) {
      await openButton.click();
    }
    const doneButton = card.getByRole("button", { name: "✓ Eingecheckt" });
    await expect(doneButton).toBeVisible();
    await expect(doneButton).toBeDisabled();
  });

  test("AC6, AC7: Self-Check-In überschreibt Lehrer-Markierung; Lehrer/Admin sieht Self-Check-In-Kennzeichnung", async ({
    page,
  }) => {
    // NOTE: as of PROJ-13's attendance-matrix rework, there is no longer a
    // /lehrer/[courseId]/[date] page or <li>-based roster — attendance for
    // all visible termine (incl. today) lives in a table on
    // /lehrer/[courseId], with per-cell Popover-based marking. Updated below
    // to match (was still targeting the removed route/DOM before this fix).

    // Admin marks the customer "absent" first.
    await login(page, ADMIN);
    await page.goto(`/lehrer/${COURSE_IM_FENSTER_ID}`);
    await page.waitForTimeout(1000);
    const row = page.locator("tr", { hasText: "E2E25 Kunde Mit Abo" });
    await expect(row).toBeVisible();
    const cells = row.locator("td");
    const cellCount = await cells.count();
    const todayCell = cells.nth(cellCount - 1); // today's column is always last
    await todayCell.getByRole("button").click();
    await page.getByRole("button", { name: "Abwesend", exact: true }).click();
    await page.waitForTimeout(500);
    await expect(todayCell.locator("span.bg-blue-500")).toHaveCount(0);

    // Customer self-checks-in, which must override the teacher's mark.
    await login(page, CUSTOMER_WITH_ABO);
    await page.goto("/stundenplan");
    const card = courseCard(page, "E2E25 Im Fenster Kurs");
    const checkedButton = card.getByRole("button", { name: "✓ Eingecheckt" });
    if ((await checkedButton.count()) > 0) {
      // Already checked in from an earlier test — undo then re-check-in to
      // force a fresh self-check-in write that overrides the admin's mark.
      await checkedButton.click();
      await expect(card.getByRole("button", { name: "Ich bin da" })).toBeVisible();
    }
    await card.getByRole("button", { name: "Ich bin da" }).click();
    await expect(card.getByRole("button", { name: "✓ Eingecheckt" })).toBeVisible();

    // Admin's roster now shows "Anwesend" with the Self-Check-In indicator.
    await login(page, ADMIN);
    await page.goto(`/lehrer/${COURSE_IM_FENSTER_ID}`);
    await page.waitForTimeout(1000);
    const rowAfter = page.locator("tr", { hasText: "E2E25 Kunde Mit Abo" });
    const cellsAfter = rowAfter.locator("td");
    const countAfter = await cellsAfter.count();
    const todayCellAfter = cellsAfter.nth(countAfter - 1);
    await expect(todayCellAfter.getByRole("button")).toHaveClass(/border-emerald-600/);
    await expect(todayCellAfter.locator("span.bg-blue-500")).toBeVisible();
    await todayCellAfter.getByRole("button").click();
    await expect(page.getByText(/Self-Check-In/)).toBeVisible();
  });
});
