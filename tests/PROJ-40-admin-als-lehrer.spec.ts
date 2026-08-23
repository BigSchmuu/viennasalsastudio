import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// The Playwright runner doesn't auto-load .env.local (unlike `next dev`), but
// the fixtures below need SUPABASE_SERVICE_ROLE_KEY.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Already loaded (e.g. CI env vars set directly) — safe to ignore.
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ADMIN = { email: "e2e22-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const ADMIN_NAME = "E2E22 Admin";
const LEHRER = { email: "e2e13-lehrer-a@viennasalsastudio.test", password: "CorrectPassword123!" };
const KUNDE = { email: "e2e8-customer@viennasalsastudio.test", password: "CorrectPassword123!" };
const KURS_NAME = "E2E5 Kizomba Beginner";

async function adminProfile() {
  const { data } = await service.from("profiles").select("id, role").eq("full_name", ADMIN_NAME).single();
  return data!;
}
async function kurs() {
  const { data } = await service.from("courses").select("id, name").eq("name", KURS_NAME).single();
  return data!;
}

/** Assignments are what this feature turns on and off — every test starts from
 *  "not assigned" so none of them depends on what a previous one left behind. */
test.beforeEach(async () => {
  const admin = await adminProfile();
  await service.from("course_teachers").delete().eq("teacher_id", admin.id);
});

test.afterAll(async () => {
  const admin = await adminProfile();
  await service.from("course_teachers").delete().eq("teacher_id", admin.id);
});

async function assign() {
  const admin = await adminProfile();
  const c = await kurs();
  await service.from("course_teachers").insert({ teacher_id: admin.id, course_id: c.id });
  return { admin, kurs: c };
}

async function login(page: Page, creds: { email: string; password: string }) {
  await page.goto("/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(creds.email);
  await page.getByLabel("Passwort").fill(creds.password);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

/** Below 768px the header folds its links into a sheet (see PROJ-24). */
async function navContainer(page: Page) {
  const burger = page.getByRole("banner").getByRole("button", { name: "Menü öffnen" });
  if (await burger.isVisible().catch(() => false)) {
    await burger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    return page.getByRole("dialog");
  }
  return page.getByRole("banner");
}

test.describe("PROJ-40: Admin auch als Lehrer eintragbar", () => {
  test("AC1: Die Lehrer-Auswahl im Kursformular enthält Lehrer und Admins", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/kurse");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Neuer Kurs" }).click();
    await page.waitForTimeout(700);
    await page.getByText("Lehrer auswählen", { exact: true }).click();
    await page.waitForTimeout(600);

    const namen = await page.getByRole("option").allInnerTexts();
    expect(namen.some((n) => n.includes("Lehrer")), "Lehrer müssen wählbar bleiben").toBe(true);
    expect(namen.some((n) => n.includes("Admin")), "Admins müssen wählbar sein").toBe(true);
  });

  test("AC2: Eine Zuweisung lässt die Rolle des Admins unverändert", async ({ page }) => {
    const { admin } = await assign();
    await login(page, ADMIN);
    await page.goto("/admin/kunden");
    await page.waitForLoadState("networkidle");

    const { data } = await service.from("profiles").select("role").eq("id", admin.id).single();
    expect(data!.role, "Eine Kurszuweisung darf keine Verwaltungsrechte kosten").toBe("admin");
  });

  test("AC3: Ein zugewiesener Admin erscheint öffentlich auf der Kursseite", async ({ page }) => {
    const { kurs: c } = await assign();
    await page.goto(`/kurse/${c.id}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(ADMIN_NAME)).toBeVisible();
  });

  test("AC4: Ein Admin ohne Zuweisung taucht öffentlich nirgends auf", async ({ page }) => {
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const admin = await adminProfile();
    const { data } = await anon.from("teacher_directory").select("id").eq("id", admin.id);
    expect(data?.length ?? 0).toBe(0);

    const c = await kurs();
    await page.goto(`/kurse/${c.id}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(ADMIN_NAME)).toHaveCount(0);
  });

  test("AC5: Die öffentliche Lehrer-Liste enthält ausschließlich Personen mit Kurszuweisung", async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data: liste } = await anon.from("teacher_directory").select("id, full_name");
    expect(liste?.length ?? 0, "Die Liste darf nicht leer sein").toBeGreaterThan(0);

    for (const person of liste!) {
      const { count } = await service
        .from("course_teachers")
        .select("course_id", { count: "exact", head: true })
        .eq("teacher_id", person.id);
      expect(count ?? 0, `${person.full_name} steht öffentlich, unterrichtet aber nichts`).toBeGreaterThan(0);
    }
  });

  test("AC6: 'Meine Kurse' erscheint nur bei tatsächlicher Zuweisung", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/kurse");
    await page.waitForLoadState("networkidle");
    let nav = await navContainer(page);
    await expect(nav.getByRole("link", { name: "Meine Kurse" })).toHaveCount(0);

    await assign();
    await page.goto("/kurse");
    await page.waitForLoadState("networkidle");
    nav = await navContainer(page);
    await expect(nav.getByRole("link", { name: "Meine Kurse" })).toBeVisible();
  });

  test("AC7: Ein unterrichtender Admin sieht in 'Meine Kurse' genau seine Kurse", async ({ page }) => {
    const { kurs: c } = await assign();
    await login(page, ADMIN);
    await page.goto("/lehrer");
    await page.waitForLoadState("networkidle");

    expect(new URL(page.url()).pathname).toBe("/lehrer");
    await expect(page.getByText(c.name)).toBeVisible();
    // Nicht alle Kurse der Schule — nur die eigenen.
    await expect(page.getByText("E2E8 Kurs")).toHaveCount(0);
  });

  test("AC8: Ein Admin ohne Zuweisung wird von /lehrer weggeleitet", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/lehrer");
    await page.waitForLoadState("networkidle");
    expect(new URL(page.url()).pathname).not.toBe("/lehrer");
  });

  test("AC9: Ein Kunde sieht 'Meine Kurse' weiterhin nicht", async ({ page }) => {
    await login(page, KUNDE);
    await page.goto("/kurse");
    await page.waitForLoadState("networkidle");
    const nav = await navContainer(page);
    await expect(nav.getByRole("link", { name: "Meine Kurse" })).toHaveCount(0);
  });

  test("AC10: Für einen regulären Lehrer bleibt alles unverändert", async ({ page }) => {
    await login(page, LEHRER);
    await page.goto("/kurse");
    await page.waitForLoadState("networkidle");
    const nav = await navContainer(page);
    await expect(nav.getByRole("link", { name: "Meine Kurse" })).toBeVisible();

    await page.goto("/lehrer");
    await page.waitForLoadState("networkidle");
    expect(new URL(page.url()).pathname).toBe("/lehrer");
  });

  test("Sicherheit: Weder Kunde noch Lehrer können sich selbst einem Kurs zuweisen", async () => {
    const c = await kurs();
    for (const creds of [KUNDE, LEHRER]) {
      const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
      const { data: auth } = await client.auth.signInWithPassword(creds);
      const { error } = await client
        .from("course_teachers")
        .insert({ teacher_id: auth!.user!.id, course_id: c.id });
      expect(error, `${creds.email} durfte sich selbst zuweisen`).not.toBeNull();
      // Aufräumen, falls der Schutz je wegfällt und der Test dadurch rot wird.
      await service.from("course_teachers").delete().eq("teacher_id", auth!.user!.id).eq("course_id", c.id);
    }
  });

  // Der Rollenfilter in der öffentlichen Liste ist nicht theoretisch: Ohne ihn
  // würde eine versehentliche Zuweisung den Namen eines Kunden öffentlich machen.
  test("Sicherheit: Ein versehentlich zugewiesener Kunde wird nicht öffentlich sichtbar", async () => {
    const c = await kurs();
    const { data: kunde } = await service
      .from("profiles")
      .select("id, full_name")
      .eq("role", "customer")
      .limit(1)
      .single();
    await service.from("course_teachers").insert({ teacher_id: kunde!.id, course_id: c.id });

    try {
      const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
      const { data } = await anon.from("teacher_directory").select("id").eq("id", kunde!.id);
      expect(data?.length ?? 0, "Ein Kunde darf nie in der öffentlichen Lehrer-Liste stehen").toBe(0);
    } finally {
      await service.from("course_teachers").delete().eq("teacher_id", kunde!.id).eq("course_id", c.id);
    }
  });
});
