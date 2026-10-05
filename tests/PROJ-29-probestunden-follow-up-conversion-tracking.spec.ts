import { test, expect, type Page } from "@playwright/test";
import { gehZu } from "./navigation";
import { createClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";
import { zweiteStufeErledigen } from "./zweite-stufe";

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
  // Für die Sortierung nach Kurs braucht es einen zweiten Kurs — und einen
  // eigenen Kunden dafür, weil jedem Kunden nur eine Probestunde zusteht
  // (PROJ-52).
  zweitkurs: "e2e29-zweitkurs@viennasalsastudio.test",
};

let courseId: string;
let zweitKursId: string;
const customerIds: Record<string, string> = {};

async function login(page: Page) {
  await gehZu(page, "/login");
  // Erst hydrieren lassen. Die Felder sind über react-hook-form gesteuert;
  // wird vor der Hydration gefüllt, setzt React den Wert zurück und das
  // Formular meldet „ist erforderlich". Auf WebKit regelmäßig — siehe
  // docs/troubleshooting-tests.md.
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(ADMIN.email);
  await page.getByLabel("Passwort").fill(ADMIN.password);
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await zweiteStufeErledigen(page, ADMIN.email);
  await page.waitForURL(/\/(mein-bereich|profil|admin)$/, { timeout: 10000 });
  // Seit PROJ-45 landen Kunden auf /mein-bereich, die Pruefungen hier gelten
  // aber dem Profil. Faehrt der Test unmittelbar danach selbst woandershin,
  // ueberholt seine Navigation diese hier — auf WebKit regelmaessig. Das ist
  // kein Fehler, sondern genau das, was der Test will; darum wird die
  // Unterbrechung geschluckt statt gemeldet.
  if (page.url().endsWith("/mein-bereich")) await page.goto("/profil").catch(() => {});
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

  // Zweiter Kurs, dessen Name hinter dem ersten liegt („Probestunden" < „Zweit"):
  // damit ist die Reihenfolge beim Sortieren eindeutig prüfbar.
  const { data: vorhandenerZweiter } = await service
    .from("courses")
    .select("id")
    .eq("name", "E2E29 Zweitkurs")
    .maybeSingle();
  if (vorhandenerZweiter) {
    zweitKursId = vorhandenerZweiter.id;
  } else {
    const { data: room } = await service.from("rooms").select("id").limit(1).single();
    const { data: zweiter, error: zweiterFehler } = await service
      .from("courses")
      .insert({ name: "E2E29 Zweitkurs", room_id: room!.id, role_query_enabled: false })
      .select("id")
      .single();
    if (zweiterFehler || !zweiter) throw new Error(`Could not create second fixture course: ${zweiterFehler?.message}`);
    zweitKursId = zweiter.id;
  }

  for (const [key, email] of Object.entries(CUSTOMERS)) {
    const id = await ensureCustomer(email);
    customerIds[key] = id;
    await service.from("profiles").update({ full_name: `E2E29 Kunde ${key}` }).eq("id", id);
  }

  // Reset any leftover bookings/followups from a previous (possibly crashed) run.
  await service.from("course_bookings").delete().eq("course_id", courseId);
  await service.from("course_bookings").delete().eq("course_id", zweitKursId);
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

  // Eine Probestunde im zweiten Kurs — die Gegenprobe für die Sortierung.
  const { error: zweiteProbeFehler } = await service.from("course_bookings").insert({
    customer_id: customerIds.zweitkurs,
    course_id: zweitKursId,
    type: "trial",
    chosen_date: daysAgo(4),
    status: "confirmed",
  });
  if (zweiteProbeFehler) throw new Error(`Could not create second-course trial: ${zweiteProbeFehler.message}`);

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
  if (zweitKursId) {
    const { data: zweite } = await service.from("course_bookings").select("id").eq("course_id", zweitKursId);
    if (zweite?.length) {
      await service.from("trial_followups").delete().in("booking_id", zweite.map((b) => b.id));
    }
    await service.from("course_bookings").delete().eq("course_id", zweitKursId);
  }
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
    // Seit 2026-10-05 steht die Notiz in ihrer eigenen Spalte und ist
    // zusammengeklappt, solange nichts drinsteht.
    await row.getByRole("button", { name: /Notiz für .* hinzufügen/ }).click();
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

    // Die Kachel zählt *alle* Probestunden im Zeitraum, nicht nur die eigenen.
    // Andere Suiten lassen welche liegen — „1 / 1" war deshalb eine Behauptung
    // über den gesamten Datenbestand, und genau davor warnt
    // docs/troubleshooting-tests.md. Geprüft wird jetzt das Verhalten der
    // Kachel: Nenner gleich der Zahl der Probestunden im Fenster, eigene
    // konvertierte Probestunde mitgezählt, Prozentwert stimmig gerundet.
    // `status = confirmed`, wie die Seite selbst: Eine stornierte Probestunde
    // im Fenster zählte sonst im Test mit, aber nicht in der Kachel — und der
    // Test wäre an etwas gescheitert, das richtig ist. Genau das passierte am
    // 2026-10-05, als eine stornierte Probestunde in diesem Fenster lag.
    const { count: imFenster } = await service
      .from("course_bookings")
      .select("id", { count: "exact", head: true })
      .eq("type", "trial")
      .eq("status", "confirmed")
      .gte("chosen_date", from)
      .lte("chosen_date", to);

    const kachel = await page.getByText(/\d+ \/ \d+ Probestunden konvertiert/).innerText();
    const [konvertiert, gesamt] = kachel.match(/(\d+) \/ (\d+)/)!.slice(1).map(Number);

    expect(gesamt, "Nenner der Kachel").toBe(imFenster);
    expect(konvertiert, "die eigene konvertierte Probestunde zählt mit").toBeGreaterThanOrEqual(1);
    await expect(page.getByText(`${Math.round((konvertiert / gesamt) * 100)}%`)).toBeVisible();
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
  // PROJ-33, Nachtrag 2026-10-05: Sortierung nach Kurs.
  test("AC7: Ein Klick auf „Kurs“ sortiert nach Kursname, ein zweiter kehrt um", async ({ page }) => {
    await login(page);
    await page.goto("/admin/probestunden");
    await page.waitForTimeout(800);

    // Geprüft wird die Reihenfolge der beiden Fixture-Kurse zueinander, nicht
    // die ganze Spalte: In der Testdatenbank stehen auch Probestunden anderer
    // Suiten in der Liste, und deren Namen gehören nicht zu diesem Test.
    async function reihenfolgeDerFixtureKurse(): Promise<string[]> {
      const namen = await page.locator("table tbody tr td:nth-child(2)").allInnerTexts();
      return namen.map((n) => n.trim()).filter((n) => n.startsWith("E2E29"));
    }

    // Auf die Reihenfolge warten, nicht auf eine Frist: Die Adresse ändert sich
    // sofort, die neu geladene Liste kommt erst danach. Eine feste Wartezeit
    // hätte einen echten Fehler als Zufall erscheinen lassen — oder umgekehrt.
    await page.getByRole("button", { name: /Kurs/ }).click();
    await expect(page).toHaveURL(/sort=course_name/);
    await expect(page).toHaveURL(/dir=asc/);
    await expect
      .poll(async () => (await reihenfolgeDerFixtureKurse()).join(" | "), { timeout: 15000 })
      .toMatch(/^E2E29 Probestunden Kurs.*E2E29 Zweitkurs$/);

    await page.getByRole("button", { name: /Kurs/ }).click();
    await expect(page).toHaveURL(/dir=desc/);
    await expect
      .poll(async () => (await reihenfolgeDerFixtureKurse()).join(" | "), { timeout: 15000 })
      .toMatch(/^E2E29 Zweitkurs.*E2E29 Probestunden Kurs$/);
  });

  test("AC8: Die Sortierung bleibt beim Statusfilter erhalten — und umgekehrt", async ({ page }) => {
    await login(page);
    await page.goto("/admin/probestunden?sort=course_name&dir=asc");
    await page.waitForTimeout(800);

    await page.getByLabel("Status").click();
    await page.getByRole("option", { name: "Offen", exact: true }).click();
    await expect(page).toHaveURL(/status=offen/);
    await expect(page).toHaveURL(/sort=course_name/);

    // Und der Weg zurück: Ein Klick auf die Spalte darf den Filter nicht
    // abwerfen. Genau dieser Fall war in PROJ-33 der Grund für die Prüfung.
    await page.getByRole("button", { name: /Kurs/ }).click();
    await expect(page).toHaveURL(/status=offen/);
    await expect(page).toHaveURL(/dir=desc/);
  });
  // 2026-10-05: Die Notiz hat eine eigene Spalte und nimmt nur Platz ein, wenn
  // sie gebraucht wird.
  test("AC9: Ohne Notiz steht nur ein schmaler Knopf, mit Notiz das Feld", async ({ page }) => {
    await login(page);
    await page.goto("/admin/probestunden");
    const zeile = page.locator("tr", { hasText: "E2E29 Kunde offen" });

    // Ohne Notiz: kein Textfeld in der Zeile, nur der Knopf.
    await expect(zeile.getByRole("button", { name: /Notiz für .* hinzufügen/ })).toBeVisible();
    await expect(zeile.getByPlaceholder("Notiz…")).toHaveCount(0);

    await zeile.getByRole("button", { name: /Notiz für .* hinzufügen/ }).click();
    await zeile.getByPlaceholder("Notiz…").fill("Kommt nächste Woche wieder.");
    await zeile.getByPlaceholder("Notiz…").blur();
    await page.waitForTimeout(800);

    // Nach dem Neuladen steht das Feld offen da — eine vorhandene Notiz soll man
    // sehen, ohne zu klicken.
    await page.reload();
    await page.waitForTimeout(1000);
    const zeileDanach = page.locator("tr", { hasText: "E2E29 Kunde offen" });
    await expect(zeileDanach.getByPlaceholder("Notiz…")).toHaveValue("Kommt nächste Woche wieder.");

    // Und leer geräumt klappt es wieder zu, sonst bliebe genau das Feld stehen,
    // das weg sollte.
    await zeileDanach.getByPlaceholder("Notiz…").fill("");
    await zeileDanach.getByPlaceholder("Notiz…").blur();
    await expect(zeileDanach.getByRole("button", { name: /Notiz für .* hinzufügen/ })).toBeVisible();
  });

  test("AC10: Die Notiz steht in der letzten Spalte", async ({ page }) => {
    await login(page);
    await page.goto("/admin/probestunden");
    const koepfe = (await page.locator("table thead th").allInnerTexts()).map((k) => k.trim());
    expect(koepfe[koepfe.length - 1]).toBe("Notiz");
    expect(koepfe[koepfe.length - 2]).toBe("Nachverfolgung");
  });
});
