import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

// The Playwright runner doesn't auto-load .env.local (unlike `next dev`), but
// the fixture setup below needs SUPABASE_SERVICE_ROLE_KEY.
try {
  ladeTestUmgebung();
} catch {
  // Already loaded (e.g. CI env vars set directly) — safe to ignore.
}

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER = { email: "e2e15-customer@viennasalsastudio.test", password: "CorrectPassword123!" };

const COURSE_NAME = "E2E15 Gutschein Kurs";
const ENTRY_DATE = "2026-09-07";
const VALID_CODE = "E2E15VALID20";
const EXPIRED_CODE = "E2E15EXPIRED";

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let courseId: string;
let customerId: string;

async function login(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto("/login");
  // Erst hydrieren lassen. Die Felder sind über react-hook-form gesteuert;
  // wird vor der Hydration gefüllt, setzt React den Wert zurück und das
  // Formular meldet „ist erforderlich". Auf WebKit regelmäßig — siehe
  // docs/troubleshooting-tests.md.
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL(/\/(mein-bereich|profil|admin)$/, { timeout: 15000 });
  // Seit PROJ-45 landen Kunden auf /mein-bereich, die Pruefungen hier gelten
  // aber dem Profil. Faehrt der Test unmittelbar danach selbst woandershin,
  // ueberholt seine Navigation diese hier — auf WebKit regelmaessig. Das ist
  // kein Fehler, sondern genau das, was der Test will; darum wird die
  // Unterbrechung geschluckt statt gemeldet.
  if (page.url().endsWith("/mein-bereich")) await page.goto("/profil").catch(() => {});
}

async function openBookingDialog(page: Page) {
  await page.goto("/kurse");
  await page.waitForTimeout(1200);
  const moreButton = page.getByRole("button", { name: /Mehr laden/ });
  for (let i = 0; i < 10 && (await moreButton.count()) > 0; i++) {
    await moreButton.click();
    await page.waitForTimeout(400);
  }
  await page
    .locator(".rounded-lg.border.bg-card")
    .filter({ has: page.getByText(COURSE_NAME, { exact: true }) })
    .getByRole("button", { name: "Jetzt buchen" })
    .click();
  await page.waitForTimeout(700);
}

/** Fills in entry date + plan so the coupon field becomes reachable. */
async function fillRegularForm(page: Page) {
  await page.getByRole("dialog").getByRole("combobox").first().click();
  await page.waitForTimeout(400);
  await page.getByRole("option").first().click();
  // PROJ-41: Die Abo-Art ist jetzt eine Kachel. Das Radio darunter ist
  // sr-only, ein Klick darauf wird von der sichtbaren Beschriftung
  // abgefangen — also die Kachel selbst anklicken, wie ein Nutzer auch.
  await page.getByText("Nur diesen Kurs").click();
  await page.waitForTimeout(300);
}

test.beforeAll(async () => {
  const { data: list } = await service.auth.admin.listUsers({ perPage: 200 });
  const found = list?.users.find((u) => u.email === CUSTOMER.email);
  if (!found) throw new Error("PROJ-15 fixture customer not found — seed e2e15-customer first");
  customerId = found.id;

  // Course (idempotent: reuse if a previous run left it behind).
  const { data: existingCourse } = await service.from("courses").select("id").eq("name", COURSE_NAME).maybeSingle();
  if (existingCourse) {
    courseId = existingCourse.id;
  } else {
    const { data: room } = await service.from("rooms").select("id").limit(1).single();
    const { data: course, error } = await service
      .from("courses")
      .insert({ name: COURSE_NAME, room_id: room!.id, role_query_enabled: false, price: 40 })
      .select("id")
      .single();
    if (error || !course) throw new Error(`Could not create fixture course: ${error?.message}`);
    courseId = course.id;
  }
  const { data: entry } = await service
    .from("course_entry_dates")
    .select("id")
    .eq("course_id", courseId)
    .eq("entry_date", ENTRY_DATE)
    .maybeSingle();
  if (!entry) await service.from("course_entry_dates").insert({ course_id: courseId, entry_date: ENTRY_DATE });

  // A coupon only attaches for a customer who has NEVER had a subscription,
  // and this suite's own flow creates one — so both must be reset each run.
  await service.from("course_bookings").delete().eq("customer_id", customerId);
  await service.from("subscriptions").delete().eq("customer_id", customerId);

  await service.from("coupons").delete().ilike("code", "E2E15%");
  await service.from("coupons").insert([
    { code: VALID_CODE, discount_type: "percent", discount_amount: 20, max_redemptions: 5 },
    { code: EXPIRED_CODE, discount_type: "fixed", discount_amount: 10, max_redemptions: 5, expires_at: "2020-01-01" },
  ]);
});

test.afterAll(async () => {
  if (customerId) {
    await service.from("course_bookings").delete().eq("customer_id", customerId);
    await service.from("subscriptions").delete().eq("customer_id", customerId);
  }
  await service.from("coupons").delete().ilike("code", "E2E15%");
  // Fixture course/customer are intentionally left in place (idempotent, reused
  // by the next run) — only per-run booking/coupon state is reset.
});

test.describe("PROJ-15: Gutscheine & Rabattcodes", () => {
  test("Admin: Gutschein anlegen erscheint in der Liste mit 0 Einlösungen und Status Aktiv", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/gutscheine");
    await page.waitForTimeout(800);
    await expect(page.getByRole("heading", { name: "Gutscheine" })).toBeVisible();

    await page.locator("#coupon-code").fill("E2E15NEU");
    await page.locator("#coupon-amount").fill("15");
    await page.locator("#coupon-max").fill("3");
    await page.getByRole("button", { name: "Gutschein anlegen" }).click();
    await page.waitForTimeout(1500);

    const row = page.locator("tr", { hasText: "E2E15NEU" });
    await expect(row).toBeVisible();
    await expect(row).toContainText("0 von 3");
    await expect(row.getByText("Aktiv")).toBeVisible();
  });

  test("Admin: doppelter Code (auch abweichende Groß-/Kleinschreibung) wird abgelehnt", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/gutscheine");
    await page.waitForTimeout(800);

    await page.locator("#coupon-code").fill(VALID_CODE.toLowerCase());
    await page.locator("#coupon-amount").fill("15");
    await page.getByRole("button", { name: "Gutschein anlegen" }).click();
    await page.waitForTimeout(1200);
    await expect(page.getByText("Dieser Code ist bereits vergeben.")).toBeVisible();
  });

  test("Admin: abgelaufener Gutschein wird als 'Abgelaufen' gekennzeichnet", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/gutscheine");
    await page.waitForTimeout(800);
    const row = page.locator("tr", { hasText: EXPIRED_CODE });
    await expect(row.getByText("Abgelaufen")).toBeVisible();
  });

  test("Admin: Gutschein deaktivieren ändert den Status auf Inaktiv, Historie bleibt sichtbar", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/gutscheine");
    await page.waitForTimeout(800);

    const row = page.locator("tr", { hasText: EXPIRED_CODE });
    await row.getByRole("switch").click();
    await page.waitForTimeout(1200);
    await expect(row.getByText("Inaktiv")).toBeVisible();
    await expect(row).toContainText("0 von 5");

    // Restore for idempotency across re-runs.
    await row.getByRole("switch").click();
    await page.waitForTimeout(1000);
  });

  test("Kunde: ungültiger Code zeigt Inline-Fehler, Absenden bleibt möglich", async ({ page }) => {
    await login(page, CUSTOMER);
    await openBookingDialog(page);
    await fillRegularForm(page);

    await page.locator("#booking-coupon").fill("GIBT-ES-NICHT");
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Dieser Code ist nicht gültig/)).toBeVisible();
    // PROJ-42: Das Absenden ist jetzt an die AGB-Zustimmung gebunden.
    await page.locator("#terms-accepted-booking").check();
    await expect(page.getByRole("button", { name: "Rechtlich verbindlich buchen" })).toBeEnabled();
  });

  test("Kunde: abgelaufener Code wird als ungültig gemeldet", async ({ page }) => {
    await login(page, CUSTOMER);
    await openBookingDialog(page);
    await fillRegularForm(page);

    await page.locator("#booking-coupon").fill(EXPIRED_CODE);
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Dieser Code ist nicht gültig/)).toBeVisible();
  });

  test("Kunde: gültiger Code (klein geschrieben) zeigt den Rabatt an", async ({ page }) => {
    await login(page, CUSTOMER);
    await openBookingDialog(page);
    await fillRegularForm(page);

    await page.locator("#booking-coupon").fill(VALID_CODE.toLowerCase());
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Gutschein gültig: 20% Rabatt/)).toBeVisible();
  });

  test("Voller Ablauf: Buchung mit Gutschein → Admin sieht Hinweis, Preis rabattiert vorbefüllt → Einlösung zählt", async ({
    page,
  }) => {
    await login(page, CUSTOMER);
    await openBookingDialog(page);
    await fillRegularForm(page);
    await page.locator("#booking-coupon").fill(VALID_CODE);
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Gutschein gültig: 20% Rabatt/)).toBeVisible();
    // PROJ-42: Das Absenden ist jetzt an die AGB-Zustimmung gebunden.
    await page.locator("#terms-accepted-booking").check();
    await page.getByRole("button", { name: "Rechtlich verbindlich buchen" }).click();
    await page.waitForTimeout(2000);

    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForTimeout(1200);
    const row = page.locator("tr", { hasText: "E2E15 Kunde" }).filter({ hasText: "Buchungsanfrage" });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Bestätigen" }).click();
    await page.waitForTimeout(1200);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(new RegExp(VALID_CODE))).toBeVisible();
    // 20% off the fixture course's 40 € list price.
    await expect(page.locator("#sub-price")).toHaveValue("32");

    await dialog.getByRole("button", { name: "Bestätigen" }).click();
    await page.waitForTimeout(2000);

    await page.goto("/admin/gutscheine");
    await page.waitForTimeout(900);
    await expect(page.locator("tr", { hasText: VALID_CODE })).toContainText("1 von 5");
  });

  test("Kunde mit bestehendem Abo bekommt keinen Gutschein mehr angerechnet", async ({ page }) => {
    // Der volle Ablauf oben schreibt diesen Kunden in genau diesen Kurs ein.
    // Dann zeigt der Dialog aber „Du bist für diesen Kurs bereits angemeldet"
    // (PROJ-8) und bietet gar kein Code-Feld mehr an — der Test käme nie bis
    // zur Prüfung, die er behauptet zu prüfen.
    //
    // Gebraucht wird: ein Abo (das disqualifiziert), aber keine Einschreibung
    // in diesen Kurs. Ein Flatrate-Abo ohne Kursbezug ist genau das.
    await service.from("course_bookings").delete().eq("customer_id", customerId);
    await service.from("subscriptions").delete().eq("customer_id", customerId);
    await service.from("subscriptions").insert({
      customer_id: customerId,
      course_id: null,
      name: "E2E15 Bestandsabo",
      price: 40,
      status: "active",
    });

    await login(page, CUSTOMER);
    await openBookingDialog(page);
    await fillRegularForm(page);

    await page.locator("#booking-coupon").fill(VALID_CODE);
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Dieser Code ist nicht gültig/)).toBeVisible();
  });

  test("Sicherheit: Nicht-Admin wird von /admin/gutscheine weggeleitet", async ({ page }) => {
    await login(page, CUSTOMER);
    await page.goto("/admin/gutscheine");
    await page.waitForTimeout(600);
    expect(page.url()).not.toContain("/admin/gutscheine");
  });

  // QA BUG-1 regression: coupon codes used to be brute-forceable at ~78 req/s
  // with no throttling. The limit lives in the RPC (not the app layer),
  // because the original attack called the RPC directly with an anon key.
  test("Sicherheit: Code-Rateversuche werden serverseitig gedrosselt", async ({ page }) => {
    await login(page, CUSTOMER);
    await service.from("coupon_check_attempts").delete().eq("customer_id", customerId);

    await openBookingDialog(page);
    await fillRegularForm(page);
    for (let i = 0; i < 11; i++) {
      await page.locator("#booking-coupon").fill(`RATELIMITPROBE${i}`);
      await page.waitForTimeout(650);
    }
    await expect(page.getByText(/Zu viele Code-Versuche/)).toBeVisible();
    // Booking must still be possible even while throttled (spec: a coupon never blocks).
    // PROJ-42: Das Absenden ist jetzt an die AGB-Zustimmung gebunden.
    await page.locator("#terms-accepted-booking").check();
    await expect(page.getByRole("button", { name: "Rechtlich verbindlich buchen" })).toBeEnabled();

    await service.from("coupon_check_attempts").delete().eq("customer_id", customerId);
  });

  // A rate limit alone cannot protect a memorable code like "SOMMER25" — an
  // attacker still gets 10 guesses per window. Personal one-off codes must be
  // unguessable, so the admin form can generate one.
  test("Admin: Zufallscode-Generator erzeugt unerratbare, jedes Mal andere Codes", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/gutscheine");
    await page.waitForTimeout(800);

    await page.getByRole("button", { name: "Zufälligen Code erzeugen" }).click();
    const first = await page.locator("#coupon-code").inputValue();
    await page.getByRole("button", { name: "Zufälligen Code erzeugen" }).click();
    const second = await page.locator("#coupon-code").inputValue();

    // Ambiguous characters (0/O, 1/I) are excluded — these get read aloud and re-typed.
    expect(first).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
    expect(second).not.toBe(first);
  });
});
