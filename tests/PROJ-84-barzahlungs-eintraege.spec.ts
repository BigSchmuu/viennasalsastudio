import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gehZu } from "./navigation";
import { ladeTestUmgebung } from "./env";
import { zweiteStufeErledigen } from "./zweite-stufe";

/**
 * PROJ-84: Barzahlungen als Einträge von Hand.
 *
 * Braucht die Migration 20261014160000_proj84_barzahlungs_eintraege.sql.
 */

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

const LEHRER = { email: "e2e13-lehrer-a@viennasalsastudio.test", password: "CorrectPassword123!" };
const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };

const stempel = Date.now();
const KURS_NAME = `E2E84 Kassenkurs ${stempel}`;
const IM_KURS = `E2E84 Karla Kurs ${stempel}`;
const FLATRATER = `E2E84 Fredi Flat ${stempel}`;
const BEITRAG = 89;

let kursId = "";
let kursKundeId = "";
let flatKundeId = "";
let kursAboId = "";
let flatAboId = "";

function wienerDatum(versatzTage = 0): string {
  const ziel = new Date(Date.now() + versatzTage * 24 * 3_600_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(ziel);
}

function wienerWochentag(): number {
  const tag = new Date(`${wienerDatum(0)}T12:00:00Z`).getUTCDay();
  return (tag + 6) % 7;
}

async function kontoAnlegen(mail: string, name: string): Promise<string> {
  const { data: alle } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = alle?.users.find((u) => u.email === mail);
  if (alt) await service.auth.admin.deleteUser(alt.id);
  const { data, error } = await service.auth.admin.createUser({
    email: mail,
    password: "CorrectPassword123!",
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-84 Konto ${mail}: ${error?.message}`);
  await service.from("profiles").update({ full_name: name }).eq("id", data.user.id);
  return data.user.id;
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

function barzahlerKarte(page: Page) {
  return page.getByRole("region", { name: "Barzahler" });
}

function listenKarte(page: Page) {
  return page.getByRole("region", { name: /^Liste/ });
}

/** Einträge und Zahlungen beider Testkunden zurücksetzen. */
async function leereListe() {
  const kunden = [kursKundeId, flatKundeId].filter(Boolean);
  await service.from("cash_payments").delete().in("customer_id", kunden);
  await service.from("cash_entries").delete().in("customer_id", kunden);
}

async function eintragAnlegen(aboId: string, kundeId: string, betrag: number): Promise<string> {
  const { data, error } = await service
    .from("cash_entries")
    .insert({ customer_id: kundeId, subscription_id: aboId, amount_due: betrag })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-84 Eintrag: ${error.message}`);
  return data!.id;
}

async function offen(entryId: string): Promise<number> {
  const { data: eintrag } = await service
    .from("cash_entries")
    .select("amount_due")
    .eq("id", entryId)
    .maybeSingle();
  if (!eintrag) return -1;
  const { data: zahlungen } = await service
    .from("cash_payments")
    .select("amount")
    .eq("entry_id", entryId);
  const bezahlt = (zahlungen ?? []).reduce((s, z) => s + Number(z.amount), 0);
  return Math.round((Number(eintrag.amount_due) - bezahlt) * 100) / 100;
}

test.beforeAll(async () => {
  test.setTimeout(180000);

  kursKundeId = await kontoAnlegen(`proj84-kurs-${stempel}@viennasalsastudio.test`, IM_KURS);
  flatKundeId = await kontoAnlegen(`proj84-flat-${stempel}@viennasalsastudio.test`, FLATRATER);

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data: kurs, error: kursFehler } = await service
    .from("courses")
    .insert({ name: KURS_NAME, room_id: raum!.id, price: BEITRAG })
    .select("id")
    .single();
  if (kursFehler) throw new Error(`PROJ-84 Kurs: ${kursFehler.message}`);
  kursId = kurs!.id;

  // Ein Termin heute, damit die Kursseite eine Anwesenheitsspalte hat.
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

  const { data: kursAbo, error: kursAboFehler } = await service
    .from("subscriptions")
    .insert({
      customer_id: kursKundeId,
      course_id: kursId,
      status: "active",
      name: "E2E84 Kursabo",
      price: BEITRAG,
      cycle_anchor_date: wienerDatum(-40),
    })
    .select("id")
    .single();
  if (kursAboFehler) throw new Error(`PROJ-84 Kursabo: ${kursAboFehler.message}`);
  kursAboId = kursAbo!.id;

  // Eine Flatrate **ohne** Kursplatz: Genau die soll in jedem Kurs erreichbar
  // sein, eingeklappt.
  const { data: flatAbo, error: flatFehler } = await service
    .from("subscriptions")
    .insert({
      customer_id: flatKundeId,
      course_id: null,
      status: "active",
      name: "E2E84 Flatrate",
      price: 120,
      cycle_anchor_date: wienerDatum(-40),
    })
    .select("id")
    .single();
  if (flatFehler) throw new Error(`PROJ-84 Flatrate: ${flatFehler.message}`);
  flatAboId = flatAbo!.id;
});

test.afterAll(async () => {
  const kunden = [kursKundeId, flatKundeId].filter(Boolean);
  if (kunden.length > 0) {
    await service.from("cash_payments").delete().in("customer_id", kunden);
    await service.from("cash_entries").delete().in("customer_id", kunden);
    await service.from("subscriptions").delete().in("customer_id", kunden);
  }
  if (kursId) {
    await service.from("course_attendance").delete().eq("course_id", kursId);
    await service.from("subscriptions").delete().eq("course_id", kursId);
    await service.from("course_teachers").delete().eq("course_id", kursId);
    await service.from("course_schedule").delete().eq("course_id", kursId);
    await service.from("courses").delete().eq("id", kursId);
  }
  for (const id of kunden) await service.auth.admin.deleteUser(id).catch(() => {});
});

test.describe("PROJ-84: Am Kursabend", () => {
  test("Die Lehrkraft trägt einen Teilnehmer mit Betrag ein", async ({ page }) => {
    await leereListe();
    await anmelden(page, LEHRER);
    await gehZu(page, `/lehrer/${kursId}`);
    await expect(barzahlerKarte(page)).toBeVisible({ timeout: 30000 });

    const karte = barzahlerKarte(page);
    // Vorher steht niemand da — und das sagt die Karte auch.
    await expect(karte.getByText(/steht niemand auf der Barzahler-Liste/)).toBeVisible();

    await karte.getByRole("button", { name: /^Barzahler eintragen/ }).click();
    await karte.getByRole("combobox", { name: "Teilnehmer auswählen" }).click();
    await page.getByRole("option", { name: new RegExp(IM_KURS) }).click();
    // Der Preis des Abos ist vorbelegt — hier mit Komma überschrieben.
    await page.locator("#barzahler-eintrags-betrag").fill("75,50");
    await karte.getByRole("button", { name: "Eintragen", exact: true }).click();
    await page.waitForTimeout(2500);

    const { data: eintraege } = await service
      .from("cash_entries")
      .select("amount_due")
      .eq("subscription_id", kursAboId);
    expect(eintraege).toHaveLength(1);
    expect(Number(eintraege![0].amount_due)).toBe(75.5);

    const zeile = barzahlerKarte(page).getByRole("row", { name: new RegExp(IM_KURS) });
    await expect(zeile).toContainText("75,50");
    await expect(zeile).toContainText("Offen");
  });

  test("Ein Teilbetrag lässt die Zeile über den Rest offen", async ({ page }) => {
    await leereListe();
    const id = await eintragAnlegen(kursAboId, kursKundeId, BEITRAG);

    await anmelden(page, LEHRER);
    await gehZu(page, `/lehrer/${kursId}`);
    await expect(barzahlerKarte(page)).toBeVisible({ timeout: 30000 });

    const karte = barzahlerKarte(page);
    await karte.getByRole("button", { name: `Teilbetrag für ${IM_KURS} eingeben` }).click();
    await karte
      .getByRole("textbox", { name: `Teilbetrag von ${IM_KURS}`, exact: true })
      .fill("40,00");
    await karte.getByRole("button", { name: `Teilbetrag von ${IM_KURS} erfassen` }).click();
    await page.waitForTimeout(2500);

    expect(await offen(id)).toBe(49);
    const zeile = barzahlerKarte(page).getByRole("row", { name: new RegExp(IM_KURS) });
    await expect(zeile).toContainText("Teilweise bezahlt");
    await expect(zeile).toContainText("49,00");
  });

  test("Der Knopf kassiert den gesamten offenen Rest", async ({ page }) => {
    await leereListe();
    const id = await eintragAnlegen(kursAboId, kursKundeId, 178);

    await anmelden(page, LEHRER);
    await gehZu(page, `/lehrer/${kursId}`);
    await expect(barzahlerKarte(page)).toBeVisible({ timeout: 30000 });

    await barzahlerKarte(page)
      .getByRole("button", { name: `Barzahlung von ${IM_KURS} erfassen` })
      .click();
    await page.waitForTimeout(2500);

    const { data: zahlungen } = await service
      .from("cash_payments")
      .select("amount")
      .eq("entry_id", id);
    expect(zahlungen).toHaveLength(1);
    expect(Number(zahlungen![0].amount)).toBe(178);
    expect(await offen(id)).toBe(0);
  });

  test("Ein Flatrater ohne Kursplatz steht eingeklappt hinter „Flatrater anzeigen“", async ({
    page,
  }) => {
    await leereListe();
    await eintragAnlegen(kursAboId, kursKundeId, BEITRAG);
    const flatId = await eintragAnlegen(flatAboId, flatKundeId, 120);

    await anmelden(page, LEHRER);
    await gehZu(page, `/lehrer/${kursId}`);
    await expect(barzahlerKarte(page)).toBeVisible({ timeout: 30000 });

    const karte = barzahlerKarte(page);
    // Eingeklappt: Der Name ist noch nicht zu sehen, der Kursteilnehmer schon.
    await expect(karte.getByText(new RegExp(IM_KURS))).toBeVisible();
    await expect(karte.getByText(new RegExp(FLATRATER))).toHaveCount(0);

    await karte.getByRole("button", { name: /Flatrater anzeigen/ }).click();
    await expect(karte.getByText(new RegExp(FLATRATER))).toBeVisible();

    // Und dort kann die Lehrkraft kassieren, obwohl er nicht angemeldet ist.
    await karte.getByRole("button", { name: `Barzahlung von ${FLATRATER} erfassen` }).click();
    await page.waitForTimeout(2500);
    expect(await offen(flatId)).toBe(0);
  });

  test("Ohne Flatrate-Eintrag gibt es den eingeklappten Abschnitt nicht", async ({ page }) => {
    await leereListe();
    await eintragAnlegen(kursAboId, kursKundeId, BEITRAG);

    await anmelden(page, LEHRER);
    await gehZu(page, `/lehrer/${kursId}`);
    await expect(barzahlerKarte(page)).toBeVisible({ timeout: 30000 });

    await expect(
      barzahlerKarte(page).getByRole("button", { name: /Flatrater anzeigen/ })
    ).toHaveCount(0);
  });

  test("Ein entfernter Eintrag ist weg — die Zahlung bleibt", async ({ page }) => {
    await leereListe();
    const id = await eintragAnlegen(kursAboId, kursKundeId, BEITRAG);

    await anmelden(page, LEHRER);
    await gehZu(page, `/lehrer/${kursId}`);
    await expect(barzahlerKarte(page)).toBeVisible({ timeout: 30000 });

    const karte = barzahlerKarte(page);
    await karte.getByRole("button", { name: `Teilbetrag für ${IM_KURS} eingeben` }).click();
    await karte.getByRole("textbox", { name: `Teilbetrag von ${IM_KURS}`, exact: true }).fill("20");
    await karte.getByRole("button", { name: `Teilbetrag von ${IM_KURS} erfassen` }).click();
    await page.waitForTimeout(2000);

    await barzahlerKarte(page)
      .getByRole("button", { name: `Eintrag von ${IM_KURS} entfernen` })
      .click();
    await page.waitForTimeout(2500);

    expect(await offen(id), "Der Eintrag steht noch").toBe(-1);
    const { data: zahlungen } = await service
      .from("cash_payments")
      .select("amount, entry_id")
      .eq("customer_id", kursKundeId);
    expect(zahlungen).toHaveLength(1);
    expect(Number(zahlungen![0].amount)).toBe(20);
    expect(zahlungen![0].entry_id).toBeNull();
  });
});

test.describe("PROJ-86: Notiz am Eintrag", () => {
  test("Die Lehrkraft notiert an der Zeile, was verabredet ist", async ({ page }) => {
    await leereListe();
    const id = await eintragAnlegen(kursAboId, kursKundeId, BEITRAG);

    await anmelden(page, LEHRER);
    await gehZu(page, `/lehrer/${kursId}`);
    await expect(barzahlerKarte(page)).toBeVisible({ timeout: 30000 });

    const karte = barzahlerKarte(page);
    await karte.getByRole("button", { name: `Notiz von ${IM_KURS} ändern` }).click();
    await karte
      .getByRole("textbox", { name: `Notiz von ${IM_KURS}`, exact: true })
      .fill("Rest kommt Freitag");
    await karte.getByRole("button", { name: `Notiz von ${IM_KURS} speichern` }).click();
    await page.waitForTimeout(2500);

    const { data: eintrag } = await service
      .from("cash_entries")
      .select("note")
      .eq("id", id)
      .single();
    expect(eintrag!.note).toBe("Rest kommt Freitag");

    // Und sie steht in der Zeile, ohne Klick.
    const zeile = barzahlerKarte(page).getByRole("row", { name: new RegExp(IM_KURS) });
    await expect(zeile).toContainText("Rest kommt Freitag");
  });

  test("Der Betreiber gibt die Notiz schon beim Eintragen mit", async ({ page }) => {
    await leereListe();
    await anmelden(page, ADMIN);
    await gehZu(page, "/admin/barzahlungen");
    await expect(listenKarte(page)).toBeVisible({ timeout: 30000 });

    const karte = listenKarte(page);
    await karte.getByRole("button", { name: /^Barzahler eintragen/ }).click();
    await karte.getByRole("combobox", { name: "Kunde und Abo auswählen" }).click();
    await page.getByRole("option", { name: new RegExp(IM_KURS) }).click();
    await page.locator("#barzahlung-betrag").fill("138");
    await page.locator("#barzahlung-notiz").fill("Rest aus September");
    await karte.getByRole("button", { name: "Eintragen", exact: true }).click();
    await page.waitForTimeout(2500);

    const { data: eintraege } = await service
      .from("cash_entries")
      .select("amount_due, note")
      .eq("subscription_id", kursAboId);
    expect(eintraege).toHaveLength(1);
    expect(Number(eintraege![0].amount_due)).toBe(138);
    expect(eintraege![0].note).toBe("Rest aus September");

    await expect(listenKarte(page).getByText("Rest aus September")).toBeVisible();
  });
});

test.describe("PROJ-84: In der Verwaltung", () => {
  test("Der Betreiber trägt ein Abo ein und kassiert", async ({ page }) => {
    await leereListe();
    await anmelden(page, ADMIN);
    await gehZu(page, "/admin/barzahlungen");
    await expect(listenKarte(page)).toBeVisible({ timeout: 30000 });

    const karte = listenKarte(page);
    await karte.getByRole("button", { name: /^Barzahler eintragen/ }).click();
    await karte.getByRole("combobox", { name: "Kunde und Abo auswählen" }).click();
    await page.getByRole("option", { name: new RegExp(FLATRATER) }).click();
    await page.locator("#barzahlung-betrag").fill("120");
    await karte.getByRole("button", { name: "Eintragen", exact: true }).click();
    await page.waitForTimeout(2500);

    const { data: eintraege } = await service
      .from("cash_entries")
      .select("id, amount_due")
      .eq("subscription_id", flatAboId);
    expect(eintraege).toHaveLength(1);
    expect(Number(eintraege![0].amount_due)).toBe(120);

    await listenKarte(page)
      .getByRole("button", { name: `Barzahlung von ${FLATRATER} erfassen` })
      .click();
    await page.waitForTimeout(2500);
    expect(await offen(eintraege![0].id)).toBe(0);
  });

  test("„Zyklus abschließen“ leert die Liste und nennt vorher, was verschwindet", async ({
    page,
  }) => {
    await leereListe();
    await eintragAnlegen(kursAboId, kursKundeId, BEITRAG);
    await eintragAnlegen(flatAboId, flatKundeId, 120);

    await anmelden(page, ADMIN);
    await gehZu(page, "/admin/barzahlungen");
    await expect(listenKarte(page)).toBeVisible({ timeout: 30000 });

    const karte = listenKarte(page);
    await karte.getByRole("button", { name: "Zyklus abschließen" }).click();
    // Die Bestätigung sagt, wie viel offen bleibt — 89 + 120. Im Hinweisfeld
    // gesucht: Dieselbe Summe steht auch oben in der Beschreibung der Karte.
    const bestaetigung = karte.getByRole("alert");
    await expect(bestaetigung).toContainText("209,00");
    await expect(bestaetigung).toContainText("2 Einträge");

    // Abbrechen ändert nichts.
    await bestaetigung.getByRole("button", { name: "Abbrechen" }).click();
    const { count: nochDa } = await service
      .from("cash_entries")
      .select("id", { count: "exact", head: true })
      .in("customer_id", [kursKundeId, flatKundeId]);
    expect(nochDa).toBe(2);

    await karte.getByRole("button", { name: "Zyklus abschließen" }).click();
    await karte.getByRole("button", { name: "Liste leeren" }).click();
    await page.waitForTimeout(2500);

    const { count } = await service
      .from("cash_entries")
      .select("id", { count: "exact", head: true })
      .in("customer_id", [kursKundeId, flatKundeId]);
    expect(count).toBe(0);
  });

  test("Eine zurückgenommene Zahlung macht den Betrag wieder offen", async ({ page }) => {
    await leereListe();
    const id = await eintragAnlegen(kursAboId, kursKundeId, BEITRAG);
    await service.from("cash_payments").insert({
      subscription_id: kursAboId,
      customer_id: kursKundeId,
      entry_id: id,
      amount: BEITRAG,
      paid_on: wienerDatum(0),
    });
    expect(await offen(id)).toBe(0);

    await anmelden(page, ADMIN);
    await gehZu(page, "/admin/barzahlungen");
    await page.waitForTimeout(1500);

    const eingesammelt = page.getByRole("region", { name: /Eingesammelt/ });
    await eingesammelt
      .getByRole("button", { name: new RegExp(`Zahlung von ${IM_KURS}.*zurücknehmen`) })
      .click();
    await page.waitForTimeout(2500);

    expect(await offen(id)).toBe(BEITRAG);
  });

  test("Die Lehrkraft kommt auf die Verwaltungsseite nicht", async ({ page }) => {
    await anmelden(page, LEHRER);
    await gehZu(page, "/admin/barzahlungen");
    await page.waitForTimeout(1500);
    await expect(page.getByRole("region", { name: /Eingesammelt/ })).toHaveCount(0);
  });
});
