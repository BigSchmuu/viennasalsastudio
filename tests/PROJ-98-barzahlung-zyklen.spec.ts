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

/**
 * PROJ-98: Zahlungszyklen bei den Barzahlern.
 *
 * Das ist der Teil, den nur der Browser belegen kann: dass der Betreiber ein
 * Enddatum **wählen** kann, dass der Dialog vorher sagt, was passiert, dass
 * der späte Zahler danach als bezahlt dasteht statt rauszufliegen, und dass
 * die Lehrkraft am Kursabend den Rest aus dem vorigen Zyklus sieht, ohne ihn
 * im Betrag dieses Zyklus zu finden.
 *
 * Die Regel selbst steht in `PROJ-98-barzahlung-zyklen-db.test.ts`.
 *
 * Braucht die Migration 20261105160000_proj98_barzahlung_zyklen.sql.
 */
const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const LEHRER = { email: "e2e13-lehrer-a@viennasalsastudio.test", password: "CorrectPassword123!" };
const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };

const stempel = Date.now();
const VOLL = `E2E98 Vera Voll ${stempel}`;
const SPAET = `E2E98 Sepp Spaet ${stempel}`;
const OFFEN = `E2E98 Nora Offen ${stempel}`;
/** Jemand mit Abo, der nie auf einer Barzahler-Liste stand. */
const NIE = `E2E98 Nie Bar ${stempel}`;

let kursId = "";
const kunde: Record<string, string> = {};
const abo: Record<string, string> = {};
const konten: string[] = [];

function wienerDatum(versatzTage = 0): string {
  const ziel = new Date(Date.now() + versatzTage * 24 * 3_600_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(ziel);
}

function wienerWochentag(): number {
  const tag = new Date(`${wienerDatum(0)}T12:00:00Z`).getUTCDay();
  return (tag + 6) % 7;
}

/** „2026-11-02" als „02.11.2026" — so, wie die Oberfläche es schreibt. */
function deDatum(iso: string): string {
  const [jahr, monat, tag] = iso.split("-");
  return `${tag}.${monat}.${jahr}`;
}

const ENDE = wienerDatum(-2);

function listenKarte(page: Page) {
  return page.getByRole("region", { name: /^Liste/ });
}

function archivKarte(page: Page) {
  return page.getByRole("region", { name: /Abgeschlossene Zyklen/ });
}

function barzahlerKarte(page: Page) {
  return page.getByRole("region", { name: "Barzahler" });
}

async function anmelden(page: Page, konto: { email: string; password: string }) {
  await gehZu(page, "/login");
  // Erst hydrieren lassen — siehe docs/troubleshooting-tests.md.
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(konto.email);
  await page.getByLabel("Passwort").fill(konto.password);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await zweiteStufeErledigen(page, konto.email);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

async function kontoAnlegen(kennung: string, name: string): Promise<string> {
  const mail = `proj98-${kennung}-${stempel}@viennasalsastudio.test`;
  const { data, error } = await service.auth.admin.createUser({
    email: mail,
    password: "CorrectPassword123!",
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-98 Konto ${mail}: ${error?.message}`);
  konten.push(data.user.id);
  await service.from("profiles").update({ full_name: name }).eq("id", data.user.id);
  return data.user.id;
}

/**
 * Die Lage vor dem Abschluss: einer voll bezahlt, einer **nach** dem
 * Enddatum bezahlt, einer offen. Zyklen weg — jede Prüfung fängt bei null an.
 */
async function lageHerstellen() {
  await service.from("cash_cycles").delete().not("id", "is", null);
  await service.from("cash_payments").delete().in("subscription_id", Object.values(abo));
  await service.from("cash_entries").delete().not("id", "is", null);

  // „nie" steht absichtlich nicht hier: An ihm wird geprüft, dass der
  // Abschnitt auf der Kundenseite bei jemandem ohne Barzahlung **ganz** fehlt.
  const ids: Record<string, string> = {};
  for (const [schluessel, betrag] of [
    ["voll", 89],
    ["spaet", 91],
    ["offen", 95],
  ] as const) {
    const { data, error } = await service
      .from("cash_entries")
      .insert({
        customer_id: kunde[schluessel],
        subscription_id: abo[schluessel],
        amount_due: betrag,
      })
      .select("id")
      .single();
    if (error) throw new Error(`PROJ-98 Eintrag ${schluessel}: ${error.message}`);
    ids[schluessel] = data!.id;
  }

  // Vor dem Enddatum bezahlt — verlässt die Liste.
  await service.from("cash_payments").insert({
    subscription_id: abo.voll,
    customer_id: kunde.voll,
    entry_id: ids.voll,
    amount: 89,
    paid_on: wienerDatum(-4),
  });
  // Nach dem Enddatum bezahlt — bleibt stehen, und das Geld zählt für den
  // neuen Zyklus. Der Anlass der ganzen Änderung.
  await service.from("cash_payments").insert({
    subscription_id: abo.spaet,
    customer_id: kunde.spaet,
    entry_id: ids.spaet,
    amount: 91,
    paid_on: wienerDatum(-1),
  });
  return ids;
}

test.beforeAll(async () => {
  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data: kurs, error } = await service
    .from("courses")
    .insert({ name: `E2E98 Zykluskurs ${stempel}`, room_id: raum!.id, price: 89 })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-98 Kurs: ${error.message}`);
  kursId = kurs!.id;

  await service.from("course_schedule").insert({
    course_id: kursId,
    weekday: wienerWochentag(),
    start_time: "08:00:00",
    end_time: "09:00:00",
  });
  const { data: lehrer } = await service
    .from("profiles")
    .select("id")
    .eq("full_name", "E2E13 Lehrer A")
    .single();
  await service.from("course_teachers").insert({ course_id: kursId, teacher_id: lehrer!.id });

  for (const [schluessel, name, betrag] of [
    ["voll", VOLL, 89],
    ["spaet", SPAET, 91],
    ["offen", OFFEN, 95],
    ["nie", NIE, 89],
  ] as const) {
    kunde[schluessel] = await kontoAnlegen(schluessel, name);
    const { data, error: aboFehler } = await service
      .from("subscriptions")
      .insert({
        customer_id: kunde[schluessel],
        course_id: kursId,
        status: "active",
        name: `E2E98 Kursabo ${schluessel}`,
        price: betrag,
        cycle_anchor_date: "2026-01-07",
      })
      .select("id")
      .single();
    if (aboFehler) throw new Error(`PROJ-98 Abo ${schluessel}: ${aboFehler.message}`);
    abo[schluessel] = data!.id;
  }
});

test.afterAll(async () => {
  // Der Zyklus ist globaler Zustand und darf diesen Lauf nicht überleben.
  await service.from("cash_cycles").delete().not("id", "is", null);
  const abos = Object.values(abo);
  if (abos.length > 0) {
    await service.from("cash_payments").delete().in("subscription_id", abos);
    await service.from("cash_entries").delete().in("subscription_id", abos);
    await service.from("subscriptions").delete().in("id", abos);
  }
  if (kursId) {
    await service.from("course_schedule").delete().eq("course_id", kursId);
    await service.from("course_teachers").delete().eq("course_id", kursId);
    await service.from("courses").delete().eq("id", kursId);
  }
  for (const id of konten) await service.auth.admin.deleteUser(id).catch(() => {});
});

test.describe("PROJ-98: Abschließen mit gewähltem Enddatum", () => {
  test("nennt die Zahlungen nach dem Enddatum und lässt den späten Zahler stehen", async ({
    page,
  }) => {
    await lageHerstellen();
    await anmelden(page, ADMIN);
    await gehZu(page, "/admin/barzahlungen");
    await expect(listenKarte(page)).toBeVisible({ timeout: 30000 });

    const karte = listenKarte(page);
    await karte.getByRole("button", { name: "Zyklus abschließen" }).click();

    // Zurückdatieren ist der Zweck der Übung.
    await karte.locator("#zyklus-ende").fill(ENDE);

    const dialog = karte.getByRole("alert");

    // Ein Zyklus, der noch läuft, lässt sich nicht abschließen — und der
    // Dialog sagt das, statt den Knopf stumm zu verweigern.
    await karte.locator("#zyklus-ende").fill(wienerDatum(1));
    await expect(dialog).toContainText("Dieser Zyklus läuft noch");
    await expect(karte.getByRole("button", { name: "Jetzt abschließen" })).toBeDisabled();
    await karte.locator("#zyklus-ende").fill(ENDE);

    // Die Vorschau nennt den späten Zahler mit Namen und Tag — wer dort falsch
    // steht, bekommt ein anderes Enddatum, bevor etwas passiert.
    await expect(dialog).toContainText(SPAET, { timeout: 15000 });
    await expect(dialog).toContainText(`Nach dem ${deDatum(ENDE)} wurde gezahlt`);
    await expect(dialog).toContainText("1 Eintrag verlässt die Liste");

    await karte.getByRole("button", { name: "Jetzt abschließen" }).click();
    await page.waitForTimeout(3000);

    // Der voll Bezahlte ist weg, die anderen beiden stehen noch da.
    await expect(listenKarte(page)).not.toContainText(VOLL);
    const spaetZeile = listenKarte(page).getByRole("row", { name: new RegExp(SPAET) });
    await expect(spaetZeile).toContainText("Für diesen Zyklus bezahlt");

    // Und am Offenen steht der Rest von damals — daneben, nicht im Betrag.
    const offenZeile = listenKarte(page).getByRole("row", { name: new RegExp(OFFEN) });
    await expect(offenZeile).toContainText(`Aus dem Zyklus bis ${deDatum(ENDE)} offen`);
    await expect(offenZeile).toContainText("95,00");
  });

  test("legt den Zyklus ins Archiv — mit dem Betrag, der damals galt", async ({ page }) => {
    const ids = await lageHerstellen();
    await anmelden(page, ADMIN);
    await gehZu(page, "/admin/barzahlungen");
    await expect(listenKarte(page)).toBeVisible({ timeout: 30000 });

    const karte = listenKarte(page);
    await karte.getByRole("button", { name: "Zyklus abschließen" }).click();
    await karte.locator("#zyklus-ende").fill(ENDE);
    await expect(karte.getByRole("button", { name: "Jetzt abschließen" })).toBeEnabled({
      timeout: 15000,
    });
    await karte.getByRole("button", { name: "Jetzt abschließen" }).click();
    await page.waitForTimeout(3000);

    // Der Betrag wird nach dem Abschluss geändert — das Archiv darf nicht
    // mitwandern.
    await service.from("cash_entries").update({ amount_due: 150 }).eq("id", ids.offen);
    await page.reload();

    const archiv = archivKarte(page);
    await expect(archiv).toBeVisible({ timeout: 30000 });
    await archiv.getByRole("button", { name: new RegExp(deDatum(ENDE)) }).click();
    await expect(archiv).toContainText(VOLL);
    const zeile = archiv.getByRole("row", { name: new RegExp(OFFEN) });
    await expect(zeile).toContainText("95,00");
    await expect(zeile).not.toContainText("150,00");
  });

  test("nimmt den Abschluss zurück und stellt die Liste wieder her", async ({ page }) => {
    await lageHerstellen();
    await anmelden(page, ADMIN);
    await gehZu(page, "/admin/barzahlungen");
    await expect(listenKarte(page)).toBeVisible({ timeout: 30000 });

    const karte = listenKarte(page);
    await karte.getByRole("button", { name: "Zyklus abschließen" }).click();
    await karte.locator("#zyklus-ende").fill(ENDE);
    await expect(karte.getByRole("button", { name: "Jetzt abschließen" })).toBeEnabled({
      timeout: 15000,
    });
    await karte.getByRole("button", { name: "Jetzt abschließen" }).click();
    await page.waitForTimeout(3000);
    await expect(listenKarte(page)).not.toContainText(VOLL);

    const archiv = archivKarte(page);
    await archiv.getByRole("button", { name: new RegExp(deDatum(ENDE)) }).click();
    await archiv.getByRole("button", { name: "Abschluss zurücknehmen" }).click();
    await archiv.getByRole("button", { name: "Ja, zurücknehmen" }).click();
    await page.waitForTimeout(3000);

    // Die Liste steht wieder wie davor, der Zyklus ist aus dem Archiv weg.
    await expect(listenKarte(page)).toContainText(VOLL);
    await expect(archivKarte(page)).toContainText("Es wurde noch kein Zyklus abgeschlossen");
  });
});

test.describe("PROJ-98: Das Archiv am Kunden", () => {
  test("zeigt dem Betreiber die Zyklen dieses Menschen — und bei wem es keine gibt, keinen Abschnitt", async ({
    page,
  }) => {
    await lageHerstellen();
    await anmelden(page, ADMIN);
    await gehZu(page, "/admin/barzahlungen");
    await expect(listenKarte(page)).toBeVisible({ timeout: 30000 });

    const karte = listenKarte(page);
    await karte.getByRole("button", { name: "Zyklus abschließen" }).click();
    await karte.locator("#zyklus-ende").fill(ENDE);
    await expect(karte.getByRole("button", { name: "Jetzt abschließen" })).toBeEnabled({
      timeout: 15000,
    });
    await karte.getByRole("button", { name: "Jetzt abschließen" }).click();
    await page.waitForTimeout(3000);

    // Bei einer Reklamation ist der Kunde der Einstieg, nicht der Zyklus.
    await gehZu(page, `/admin/kunden/${kunde.offen}`);
    // Der Abschnitt ist eine Überschrift mit Tabelle, kein benannter Bereich —
    // gesucht wird deshalb über die Überschrift, und die ist zugleich das,
    // was fehlen muss, wenn es keine Zyklen gibt.
    await expect(page.getByRole("heading", { name: "Barzahlungen" })).toBeVisible({
      timeout: 30000,
    });
    const tabelle = page.locator("table").filter({ hasText: "Zyklus" });
    await expect(tabelle).toContainText(deDatum(ENDE));
    // Teilweise bezahlt ist der Fall, um den es geht: geschuldet 95, gezahlt 0.
    await expect(tabelle).toContainText("95,00");

    // Und bei jemandem, der nie bar gezahlt hat, steht dort kein leerer
    // Abschnitt, sondern gar keiner.
    await gehZu(page, `/admin/kunden/${kunde.nie}`);
    await expect(page.getByRole("heading", { name: "Abos" })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("heading", { name: "Barzahlungen" })).toHaveCount(0);
  });
});

test.describe("PROJ-98: Am Kursabend", () => {
  test("die Lehrkraft sieht den Rest aus dem vorigen Zyklus als eigene Angabe", async ({
    page,
  }) => {
    await lageHerstellen();
    // Ein abgeschlossener Zyklus, in dem „Offen" nichts gezahlt hat. Angelegt
    // mit dem Dienstschlüssel: Eine Lehrkraft darf nicht abschließen, und
    // genau das prüft der Datenbanktest.
    const { data: zyklus } = await service
      .from("cash_cycles")
      .insert({ starts_on: wienerDatum(-30), ends_on: ENDE })
      .select("id")
      .single();
    await service.from("cash_cycle_entries").insert({
      cycle_id: zyklus!.id,
      customer_id: kunde.offen,
      subscription_id: abo.offen,
      amount_due: 95,
    });

    await anmelden(page, LEHRER);
    await gehZu(page, `/lehrer/${kursId}`);
    const karte = barzahlerKarte(page);
    await expect(karte).toBeVisible({ timeout: 30000 });

    const zeile = karte.getByRole("row", { name: new RegExp(OFFEN) });
    await expect(zeile).toContainText(`Aus dem Zyklus bis ${deDatum(ENDE)} offen`);
    // Der Betrag dieses Zyklus bleibt unberührt: 95 € bleiben 95 €. Stünde
    // hier die Summe beider Zyklen, wäre beim Kassieren nicht mehr zu trennen,
    // was wofür hereinkommt.
    await expect(zeile).toContainText("95,00");
    await expect(zeile).not.toContainText("190,00");
  });
});
