import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gehZu } from "./navigation";
import { ladeTestUmgebung } from "./env";
import { zweiteStufeErledigen } from "./zweite-stufe";

try {
  ladeTestUmgebung();
} catch {
  // Schon geladen — unkritisch.
}

const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };

const NAMEN = {
  offen: "E2E79 Anna Angekuendigt",
  beendet: "E2E79 Bert Beendet",
  frueher: "E2E79 Clara Frueher",
};

const konten: Record<keyof typeof NAMEN, string> = { offen: "", beendet: "", frueher: "" };
const abos: Record<keyof typeof NAMEN, string> = { offen: "", beendet: "", frueher: "" };

function wienerDatum(versatzTage = 0): string {
  const ziel = new Date(Date.now() + versatzTage * 24 * 3_600_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(ziel);
}

/** Erster Tag des laufenden Monats — der Zeitraum, mit dem die Seite öffnet. */
function monatsErster(): string {
  return `${wienerDatum(0).slice(0, 7)}-01`;
}

async function kontoAnlegen(schluessel: keyof typeof NAMEN): Promise<string> {
  const mail = `proj79-${schluessel}@viennasalsastudio.test`;
  const { data: alle } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = alle?.users.find((u) => u.email === mail);
  if (alt) await service.auth.admin.deleteUser(alt.id);
  const { data, error } = await service.auth.admin.createUser({
    email: mail,
    password: "CorrectPassword123!",
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-79 Konto ${mail}: ${error?.message}`);
  await service.from("profiles").update({ full_name: NAMEN[schluessel] }).eq("id", data.user.id);
  return data.user.id;
}

async function login(page: Page) {
  await gehZu(page, "/login");
  // Erst hydrieren lassen — siehe docs/troubleshooting-tests.md.
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(ADMIN.email);
  await page.getByLabel("Passwort").fill(ADMIN.password);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await zweiteStufeErledigen(page, ADMIN.email);
  await page.waitForURL(/\/admin$/, { timeout: 20000 });
  await page.waitForTimeout(1000);
}

/** Die beiden benannten Bereiche der Seite. */
function angekuendigt(page: Page) {
  return page.getByRole("region", { name: /Angekündigt/ });
}

function beendet(page: Page) {
  return page.getByRole("region", { name: /Beendet/ });
}

test.beforeAll(async () => {
  test.setTimeout(180000);

  for (const schluessel of Object.keys(NAMEN) as (keyof typeof NAMEN)[]) {
    konten[schluessel] = await kontoAnlegen(schluessel);
  }

  // Angekündigt: läuft noch, Stichtag in zehn Tagen, seit vier Monaten dabei.
  const { data: offen, error: offenFehler } = await service
    .from("subscriptions")
    .insert({
      customer_id: konten.offen,
      status: "active",
      name: "E2E79 Flatrate",
      price: 80,
      cycle_anchor_date: "2026-06-07",
      pending_status: "cancelled",
      pending_effective_date: wienerDatum(10),
    })
    .select("id")
    .single();
  if (offenFehler) throw new Error(`PROJ-79 Abo offen: ${offenFehler.message}`);
  abos.offen = offen!.id;

  // Beendet, im laufenden Monat — also im Zeitraum, mit dem die Seite öffnet.
  const { data: fertig, error: fertigFehler } = await service
    .from("subscriptions")
    .insert({
      customer_id: konten.beendet,
      status: "cancelled",
      name: "E2E79 Kursabo",
      price: 50,
      cycle_anchor_date: "2024-09-01",
      cancelled_at: monatsErster(),
    })
    .select("id")
    .single();
  if (fertigFehler) throw new Error(`PROJ-79 Abo beendet: ${fertigFehler.message}`);
  abos.beendet = fertig!.id;

  // Beendet, aber lange vor dem Zeitraum — darf im Standardzeitraum nicht
  // auftauchen.
  const { data: alt, error: altFehler } = await service
    .from("subscriptions")
    .insert({
      customer_id: konten.frueher,
      status: "cancelled",
      name: "E2E79 Altes Abo",
      price: 50,
      cycle_anchor_date: "2023-01-01",
      cancelled_at: "2023-06-30",
    })
    .select("id")
    .single();
  if (altFehler) throw new Error(`PROJ-79 Abo alt: ${altFehler.message}`);
  abos.frueher = alt!.id;
});

test.afterAll(async () => {
  for (const id of Object.values(abos)) {
    if (id) await service.from("subscriptions").delete().eq("id", id);
  }
  for (const id of Object.values(konten)) {
    if (id) await service.auth.admin.deleteUser(id).catch(() => {});
  }
});

test.describe("PROJ-79: Überblick der Kündigungen", () => {
  test("Der Menüpunkt führt auf die Seite", async ({ page }) => {
    await login(page);
    // Den Weg gehen, nicht springen: Dass die Seite unter ihrer Adresse
    // erreichbar ist, belegt nicht, dass die Verwaltung sie findet.
    await page.getByRole("link", { name: "Kündigungen" }).click();
    await page.waitForURL(/\/admin\/kuendigungen/, { timeout: 20000 });
    await expect(page.getByRole("heading", { name: "Kündigungen", level: 2 })).toBeVisible();
  });

  test("Eine angekündigte Kündigung steht oben mit Stichtag und Laufzeit", async ({ page }) => {
    await login(page);
    await gehZu(page, "/admin/kuendigungen");
    await page.waitForTimeout(1200);

    const zeile = angekuendigt(page).getByRole("row", { name: new RegExp(NAMEN.offen) });
    await expect(zeile).toBeVisible();
    // Vom 07.06.2026 bis heute+10 sind es vier Monate.
    await expect(zeile).toContainText("4 Monate");
    // Und sie steht nicht in der falschen Liste.
    await expect(beendet(page).getByText(NAMEN.offen)).toHaveCount(0);
  });

  test("Eine beendete Kündigung steht unten, mit ihrer Laufzeit", async ({ page }) => {
    await login(page);
    await gehZu(page, "/admin/kuendigungen");
    await page.waitForTimeout(1200);

    const zeile = beendet(page).getByRole("row", { name: new RegExp(NAMEN.beendet) });
    await expect(zeile).toBeVisible();
    await expect(zeile).toContainText("E2E79 Kursabo");
    // Seit 01.09.2024 — über zwei Jahre.
    await expect(zeile).toContainText("Jahre");
    await expect(angekuendigt(page).getByText(NAMEN.beendet)).toHaveCount(0);
  });

  test("Der Zeitraum wirkt auf die beendeten, nicht auf die angekündigten", async ({ page }) => {
    await login(page);
    await gehZu(page, "/admin/kuendigungen");
    await page.waitForTimeout(1200);

    // Standardzeitraum ist der laufende Monat: Die Kündigung von 2023 fehlt.
    await expect(beendet(page).getByText(NAMEN.frueher)).toHaveCount(0);

    // Mit passendem Zeitraum erscheint sie — und die angekündigte bleibt stehen.
    await gehZu(page, "/admin/kuendigungen?from=2023-01-01&to=2023-12-31");
    await page.waitForTimeout(1200);
    await expect(beendet(page).getByText(NAMEN.frueher)).toBeVisible();
    await expect(angekuendigt(page).getByText(NAMEN.offen)).toBeVisible();
    // Und die im laufenden Monat beendete ist jetzt draußen.
    await expect(beendet(page).getByText(NAMEN.beendet)).toHaveCount(0);
  });

  test("Der Name führt ins Kundenprofil", async ({ page }) => {
    await login(page);
    await gehZu(page, "/admin/kuendigungen");
    await page.waitForTimeout(1200);

    await angekuendigt(page).getByRole("link", { name: NAMEN.offen }).click();
    await page.waitForURL(new RegExp(`/admin/kunden/${konten.offen}`), { timeout: 20000 });
  });
});
