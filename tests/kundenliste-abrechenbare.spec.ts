import { test, expect, type Page } from "@playwright/test";
import { gehZu } from "./navigation";
import { createClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

ladeTestUmgebung();

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

test.use({ locale: "de-DE" });

/**
 * Gefunden bei der Startvorbereitung: In der Produktion hatte eine Lehrkraft
 * ein aktives Flatrate-Abo über 135 €. Weil die Kundenverwaltung auf
 * `role = 'customer'` filterte, tauchte sie dort nicht auf — ihr Abo war weder
 * änderbar noch kündbar, obwohl es monatlich abgebucht wird. Auch der direkte
 * Aufruf der Detailseite half nicht: Sie filterte genauso und meldete „nicht
 * gefunden".
 *
 * Wen der Betrieb abrechnet, den muss er auch verwalten können.
 */
const ABO_NAME = "Kundenliste-Pruefung";

let lehrkraftId = "";
let aboId = "";

async function aufraeumen() {
  if (aboId) {
    await svc.from("subscriptions").delete().eq("id", aboId);
    aboId = "";
  }
  await svc.from("subscriptions").delete().eq("name", ABO_NAME);
}

test.beforeAll(async () => {
  const { data: lehrkraft } = await svc
    .from("profiles")
    .select("id, full_name")
    .eq("role", "teacher")
    .limit(1)
    .single();
  if (!lehrkraft) throw new Error("Keine Lehrkraft in der Testdatenbank");
  lehrkraftId = lehrkraft.id;

  await aufraeumen();
  const { data: abo, error } = await svc
    .from("subscriptions")
    .insert({
      customer_id: lehrkraftId,
      name: ABO_NAME,
      price: 135,
      status: "active",
    })
    .select("id")
    .single();
  if (error) throw new Error(`Abo anlegen: ${error.message}`);
  aboId = abo.id;
});

test.afterAll(aufraeumen);

async function login(page: Page) {
  await gehZu(page, "/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(ADMIN.email);
  await page.getByLabel("Passwort").fill(ADMIN.password);
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

test("Eine Lehrkraft mit Abo steht in der Kundenliste, als Lehrkraft gekennzeichnet", async ({
  page,
}) => {
  const { data: lehrkraft } = await svc
    .from("profiles")
    .select("full_name")
    .eq("id", lehrkraftId)
    .single();

  await login(page);
  await page.goto("/admin/kunden");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  const zeile = page.locator("tr").filter({ hasText: lehrkraft!.full_name! });
  await expect(zeile).toBeVisible();
  await expect(zeile.getByText("Lehrkraft")).toBeVisible();
});

test("Ihre Akte ist erreichbar und ihr Abo bearbeitbar", async ({ page }) => {
  await login(page);
  await page.goto(`/admin/kunden/${lehrkraftId}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  // Vor der Korrektur meldete diese Adresse „nicht gefunden".
  await expect(page.getByText(ABO_NAME)).toBeVisible();
  await expect(page.getByRole("button", { name: "Neues Abo" })).toBeVisible();
  await expect(page.getByText("Lehrkraft").first()).toBeVisible();
});

test("Eine Lehrkraft ohne Zahlungsbeziehung bleibt draußen — die Liste bildet die Abrechnung ab, nicht das Personal", async ({
  page,
}) => {
  const { data: ohne } = await svc
    .from("profiles")
    .select("id, full_name")
    .eq("role", "teacher")
    .neq("id", lehrkraftId);

  const { data: mitAbo } = await svc.from("subscriptions").select("customer_id");
  const { data: mitMandat } = await svc
    .from("sepa_mandates")
    .select("customer_id")
    .is("revoked_at", null);
  const gebunden = new Set([
    ...(mitAbo ?? []).map((s) => s.customer_id),
    ...(mitMandat ?? []).map((m) => m.customer_id),
  ]);
  const unbeteiligt = (ohne ?? []).find((l) => !gebunden.has(l.id) && l.full_name);
  test.skip(!unbeteiligt, "Keine Lehrkraft ohne Abo und Mandat vorhanden");

  await login(page);
  await page.goto("/admin/kunden");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  await expect(page.locator("tr").filter({ hasText: unbeteiligt!.full_name! })).toHaveCount(0);
});
