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
 * PROJ-99: Die Auswahl beim Eintragen.
 *
 * Der Beweis, den nur der Browser führen kann: Die Lehrkraft trägt einen
 * Pass-Inhaber **ohne** eingetragenen Kursplatz ein, ohne ihn als Gast neu
 * anzulegen. Vorher blieb ihr nur „Gast ohne Konto eintragen", und PROJ-82
 * erzeugte dabei einen zweiten echten Kunden mit eigenem Abo — dieselbe Person
 * stand danach zweimal im System.
 *
 * Deshalb prüft diese Datei nicht nur, dass der Eintrag entsteht, sondern auch,
 * dass **kein** neues Profil und **kein** zweites Abo dazugekommen ist. Genau
 * das war der Schaden.
 *
 * Wer in der Auswahl steht, steht in `PROJ-99-barzahler-auswahl-db.test.ts`.
 *
 * Braucht die Migrationen 20261105160000_proj98_barzahlung_zyklen.sql und
 * 20261105180000_proj99_barzahler_auswahl.sql.
 */
const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const LEHRER = { email: "e2e13-lehrer-a@viennasalsastudio.test", password: "CorrectPassword123!" };

const stempel = Date.now();
const STILNAME = `E2E99 Bachata ${stempel}`;
const PASS_KUNDE = `E2E99 Paul Pass ${stempel}`;

let stilId = "";
let kursId = "";
let kundeId = "";
let aboId = "";

function wienerDatum(versatzTage = 0): string {
  const ziel = new Date(Date.now() + versatzTage * 24 * 3_600_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(ziel);
}

function wienerWochentag(): number {
  const tag = new Date(`${wienerDatum(0)}T12:00:00Z`).getUTCDay();
  return (tag + 6) % 7;
}

function barzahlerKarte(page: Page) {
  return page.getByRole("region", { name: "Barzahler" });
}

async function anmelden(page: Page) {
  await gehZu(page, "/login");
  // Erst hydrieren lassen — siehe docs/troubleshooting-tests.md.
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(LEHRER.email);
  await page.getByLabel("Passwort").fill(LEHRER.password);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await zweiteStufeErledigen(page, LEHRER.email);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

/** Wie viele Profile und Abos es zu diesem Menschen gibt. */
async function zaehle(): Promise<{ profile: number; abos: number }> {
  const { count: profile } = await service
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("full_name", PASS_KUNDE);
  const { count: abos } = await service
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", kundeId);
  return { profile: profile ?? 0, abos: abos ?? 0 };
}

async function listeLeeren() {
  await service.from("cash_cycles").delete().not("id", "is", null);
  await service.from("cash_payments").delete().eq("subscription_id", aboId);
  await service.from("cash_entries").delete().eq("subscription_id", aboId);
}

test.beforeAll(async () => {
  const { data: stil, error: stilFehler } = await service
    .from("dance_styles")
    .insert({ name: STILNAME, pass_price: 45 })
    .select("id")
    .single();
  if (stilFehler) throw new Error(`PROJ-99 Stil: ${stilFehler.message}`);
  stilId = stil!.id;

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data: kurs, error: kursFehler } = await service
    .from("courses")
    .insert({
      name: `E2E99 Bachata Kurs ${stempel}`,
      room_id: raum!.id,
      price: 89,
      dance_style_id: stilId,
    })
    .select("id")
    .single();
  if (kursFehler) throw new Error(`PROJ-99 Kurs: ${kursFehler.message}`);
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

  // Der Mensch, um den es geht: Pass dieser Stilrichtung, **kein** Kursplatz.
  const mail = `proj99-pass-${stempel}@viennasalsastudio.test`;
  const { data: konto, error: kontoFehler } = await service.auth.admin.createUser({
    email: mail,
    password: "CorrectPassword123!",
    email_confirm: true,
  });
  if (kontoFehler || !konto.user) throw new Error(`PROJ-99 Konto: ${kontoFehler?.message}`);
  kundeId = konto.user.id;
  await service.from("profiles").update({ full_name: PASS_KUNDE }).eq("id", kundeId);

  const { data: abo, error: aboFehler } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: null,
      dance_style_id: stilId,
      status: "active",
      name: `${STILNAME} Pass`,
      price: 45,
      cycle_anchor_date: "2026-01-07",
    })
    .select("id")
    .single();
  if (aboFehler) throw new Error(`PROJ-99 Abo: ${aboFehler.message}`);
  aboId = abo!.id;
});

test.afterAll(async () => {
  await service.from("cash_cycles").delete().not("id", "is", null);
  if (aboId) {
    await service.from("cash_payments").delete().eq("subscription_id", aboId);
    await service.from("cash_entries").delete().eq("subscription_id", aboId);
    await service.from("course_memberships").delete().eq("subscription_id", aboId);
    await service.from("subscriptions").delete().eq("id", aboId);
  }
  // Was eine Doppelanlage angelegt hätte, geht hier mit weg — sonst bliebe
  // nach einem roten Lauf ein Geisterkunde in der Testdatenbank stehen.
  const { data: doppel } = await service
    .from("profiles")
    .select("id")
    .eq("full_name", PASS_KUNDE);
  for (const p of doppel ?? []) {
    await service.from("subscriptions").delete().eq("customer_id", p.id);
    await service.auth.admin.deleteUser(p.id).catch(() => {});
  }
  if (kursId) {
    await service.from("course_schedule").delete().eq("course_id", kursId);
    await service.from("course_teachers").delete().eq("course_id", kursId);
    await service.from("courses").delete().eq("id", kursId);
  }
  if (stilId) await service.from("dance_styles").delete().eq("id", stilId);
});

test.describe("PROJ-99: Ein Pass-Inhaber ohne Kursplatz", () => {
  test("ist auswählbar — und wird dabei nicht zum zweiten Mal angelegt", async ({ page }) => {
    await listeLeeren();
    const vorher = await zaehle();
    expect(vorher.profile).toBe(1);
    expect(vorher.abos).toBe(1);

    await anmelden(page);
    await gehZu(page, `/lehrer/${kursId}`);
    const karte = barzahlerKarte(page);
    await expect(karte).toBeVisible({ timeout: 30000 });

    await karte.getByRole("button", { name: /^Barzahler eintragen/ }).click();
    await karte.getByRole("combobox", { name: "Kunde und Abo auswählen" }).click();
    // Ohne abgeschlossenen Zyklus gibt es die Gruppe „Im vorigen Zyklus"
    // nicht — und zwar gar nicht, nicht leer. `listeLeeren` hat die Zyklen
    // vorher entfernt, dieser Lauf ist also genau diese Lage.
    await expect(page.getByRole("group", { name: "Im vorigen Zyklus" })).toHaveCount(0);

    // Das Produkt steht am Eintrag: „<Stil> Pass", nicht „Flatrate".
    const option = page.getByRole("option", { name: new RegExp(PASS_KUNDE) });
    await expect(option).toContainText(`${STILNAME} Pass`);
    await option.click();

    // Der Preis des Passes ist vorbelegt.
    await expect(karte.locator("#barzahler-eintrags-betrag")).toHaveValue("45");
    await karte.getByRole("button", { name: "Eintragen", exact: true }).click();
    await page.waitForTimeout(2500);

    // Der Eintrag hängt am **bestehenden** Abo.
    const { data: eintraege } = await service
      .from("cash_entries")
      .select("subscription_id, customer_id, amount_due")
      .eq("subscription_id", aboId);
    expect(eintraege).toHaveLength(1);
    expect(eintraege![0].customer_id).toBe(kundeId);
    expect(Number(eintraege![0].amount_due)).toBe(45);

    // Und der Schaden, den PROJ-99 verhindert: kein zweites Profil, kein
    // zweites Abo.
    const nachher = await zaehle();
    expect(nachher.profile, "Die Person wurde ein zweites Mal angelegt").toBe(1);
    expect(nachher.abos, "Es ist ein zweites Abo entstanden").toBe(1);
  });

  test("steht nach einem Abschluss oben, mit dem Betrag von damals", async ({ page }) => {
    await listeLeeren();
    // Ein abgeschlossener Zyklus, in dem dieser Mensch 60 € schuldete.
    const { data: zyklus } = await service
      .from("cash_cycles")
      .insert({ starts_on: wienerDatum(-30), ends_on: wienerDatum(-3) })
      .select("id")
      .single();
    await service.from("cash_cycle_entries").insert({
      cycle_id: zyklus!.id,
      customer_id: kundeId,
      subscription_id: aboId,
      amount_due: 60,
    });

    await anmelden(page);
    await gehZu(page, `/lehrer/${kursId}`);
    const karte = barzahlerKarte(page);
    await expect(karte).toBeVisible({ timeout: 30000 });

    await karte.getByRole("button", { name: /^Barzahler eintragen/ }).click();
    await karte.getByRole("combobox", { name: "Kunde und Abo auswählen" }).click();

    // Eigene Gruppe oben — und der Betrag von damals steht schon an der Zeile.
    await expect(page.getByRole("group", { name: "Im vorigen Zyklus" })).toContainText(
      PASS_KUNDE
    );
    await page.getByRole("option", { name: new RegExp(PASS_KUNDE) }).click();

    // 60 statt der 45 aus dem Preis des Abos: der genauere Vorschlag.
    await expect(karte.locator("#barzahler-eintrags-betrag")).toHaveValue("60");
  });
});
