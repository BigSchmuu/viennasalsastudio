import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gehZu } from "./navigation";
import { ladeTestUmgebung } from "./env";
import { zweiteStufeErledigen } from "./zweite-stufe";

/**
 * PROJ-87: Upgrade auf die Flatrate — der ganze Weg.
 *
 * Vom Knopf im Kundenbereich über die Bestätigung bis in den
 * Lastschriftlauf und auf die Rechnung: Die Differenz ist der Teil, an dem
 * Geld hängt, und der wird deshalb bis zum Ende verfolgt.
 *
 * Braucht die Migration 20261015160000_proj87_upgrade_auf_flatrate.sql.
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

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };

const stempel = Date.now();
const NAME = `E2E87 Uwe Upgrade ${stempel}`;
const MAIL = `proj87-ui-${stempel}@viennasalsastudio.test`;
const PASSWORT = "CorrectPassword123!";
const KURSPREIS = 75;

let kursId = "";
let kundeId = "";
let aboId = "";
let flatrateNormal = 0;
let preisErgaenzt = false;
/** Der Lauf, der den Einzug dieses Zyklus trägt — hinterher weg. */
let laufId = "";
let laufGehoertUns = false;

function wienerDatum(versatzTage = 0): string {
  const ziel = new Date(Date.now() + versatzTage * 24 * 3_600_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(ziel);
}

async function anmelden(page: Page, konto: { email: string; password: string }) {
  await gehZu(page, "/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(konto.email);
  await page.getByLabel("Passwort").fill(konto.password);
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await zweiteStufeErledigen(page, konto.email);
  await page.waitForURL(/\/(mein-bereich|profil|admin)$/, { timeout: 20000 });
}

/** /profil klappt seine Abschnitte zu — ohne Aufklappen fehlt die Abo-Zeile. */
async function zumAbo(page: Page) {
  await gehZu(page, "/profil");
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Mein Abo" }).click();
  await page.waitForTimeout(600);
}

async function abo() {
  const { data } = await service
    .from("subscriptions")
    .select("course_id, name, price, upgrade_requested_at")
    .eq("id", aboId)
    .single();
  return data!;
}

test.beforeAll(async () => {
  test.setTimeout(180000);

  const { data: alle } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = alle?.users.find((u) => u.email === MAIL);
  if (alt) await service.auth.admin.deleteUser(alt.id);
  const { data: neu, error: kontoFehler } = await service.auth.admin.createUser({
    email: MAIL,
    password: PASSWORT,
    email_confirm: true,
  });
  if (kontoFehler || !neu.user) throw new Error(`PROJ-87 Konto: ${kontoFehler?.message}`);
  kundeId = neu.user.id;
  await service.from("profiles").update({ full_name: NAME }).eq("id", kundeId);

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data: kurs, error: kursFehler } = await service
    .from("courses")
    .insert({ name: `E2E87 Kurs ${stempel}`, room_id: raum!.id, price: KURSPREIS })
    .select("id")
    .single();
  if (kursFehler) throw new Error(`PROJ-87 Kurs: ${kursFehler.message}`);
  kursId = kurs!.id;

  // Ein Mandat, damit das Abo überhaupt in einen Lastschriftlauf kommt.
  await service.from("sepa_mandates").insert({
    customer_id: kundeId,
    iban: "AT611904300234573201",
    account_holder_name: NAME,
    mandate_reference: `E2E87-${stempel}`,
    consented_at: new Date().toISOString(),
  });

  // Zyklusbeginn weit zurück: Damit ist der Beitrag beim nächsten Lauf fällig.
  const { data: sub, error: aboFehler } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: kursId,
      status: "active",
      name: "E2E87 Kursabo",
      price: KURSPREIS,
      cycle_anchor_date: wienerDatum(-120),
    })
    .select("id")
    .single();
  if (aboFehler) throw new Error(`PROJ-87 Abo: ${aboFehler.message}`);
  aboId = sub!.id;

  // Ein Einzug im laufenden Zyklus: Seit PROJ-88 rechnet die Differenz gegen
  // das, was tatsächlich bezahlt wurde. Ohne diesen Einzug wäre sie der volle
  // Flatrate-Preis — richtig gerechnet, aber nicht der Fall, den diese Tests
  // zeigen wollen.
  //
  // Der Lauf wird **nicht** freigegeben und trägt nur diese eine Position:
  // Ein echter, freigegebener Lauf schreibt Rechnungen für jedes fällige Abo
  // der Testdatenbank und hat PROJ-10, PROJ-33 und PROJ-70 umgeworfen.
  // Ein eigener Tag im Fenster: Einen fremden Lauf mitzubenutzen hieße, ihn
  // am Ende freizugeben — und wäre er der Entwurf einer anderen Suite, hätte
  // ich ihr die Arbeit verdorben.
  let einzugsTag = "";
  for (let versatz = 10; versatz <= 27; versatz++) {
    const tag = wienerDatum(-versatz);
    const { count } = await service
      .from("sepa_collection_runs")
      .select("id", { count: "exact", head: true })
      .eq("due_date", tag);
    if ((count ?? 0) === 0) {
      einzugsTag = tag;
      break;
    }
  }
  if (!einzugsTag) throw new Error("PROJ-87: kein freier Tag im Anrechnungsfenster");

  const { data: neuerLauf, error: laufFehler } = await service
    .from("sepa_collection_runs")
    .insert({ due_date: einzugsTag })
    .select("id")
    .single();
  if (laufFehler) throw new Error(`PROJ-87 Lauf: ${laufFehler.message}`);
  laufId = neuerLauf!.id;
  laufGehoertUns = true;

  const { error: postenFehler } = await service.from("sepa_collection_items").insert({
    run_id: laufId,
    customer_id: kundeId,
    subscription_id: aboId,
    amount: KURSPREIS,
    iban: "AT611904300234573201",
    account_holder_name: NAME,
    mandate_reference: `E2E87-${stempel}`,
  });
  if (postenFehler) throw new Error(`PROJ-87 Position: ${postenFehler.message}`);

  // Erst jetzt freigeben: Angerechnet wird nur ein freigegebener Einzug, und
  // einer freigegebenen Position etwas hinzuzufügen verbietet PROJ-47.
  const { error: freigabeFehler } = await service
    .from("sepa_collection_runs")
    .update({ released_at: new Date().toISOString() })
    .eq("id", laufId);
  if (freigabeFehler) throw new Error(`PROJ-87 Freigabe: ${freigabeFehler.message}`);

  // Die Preisliste gehört allen Tests: lesen, nur ergänzen wenn leer.
  const { data: preise } = await service
    .from("dropin_pricing")
    .select("flatrate_price")
    .limit(1)
    .single();
  if (preise?.flatrate_price === null || preise?.flatrate_price === undefined) {
    await service
      .from("dropin_pricing")
      .update({ flatrate_price: 120, flatrate_student_price: 95 })
      .not("id", "is", null);
    preisErgaenzt = true;
    flatrateNormal = 120;
  } else {
    flatrateNormal = Number(preise.flatrate_price);
  }
});

test.afterAll(async () => {
  if (kundeId) {
    await service.from("subscription_surcharges").delete().eq("customer_id", kundeId);
    await service.from("course_memberships").delete().eq("customer_id", kundeId);
    await service.from("notification_queue").delete().eq("customer_id", kundeId);
    await service.from("invoices").delete().eq("customer_id", kundeId);
    await service.from("sepa_collection_items").delete().eq("customer_id", kundeId);
    await service.from("subscriptions").delete().eq("customer_id", kundeId);
    await service.from("sepa_mandates").delete().eq("customer_id", kundeId);
    await service.auth.admin.deleteUser(kundeId).catch(() => {});
  }
  if (kursId) await service.from("courses").delete().eq("id", kursId);
  if (laufId && laufGehoertUns) {
    await service.from("sepa_collection_items").delete().eq("run_id", laufId);
    await service.from("sepa_collection_runs").delete().eq("id", laufId);
  }
  if (preisErgaenzt) {
    await service
      .from("dropin_pricing")
      .update({ flatrate_price: null, flatrate_student_price: null })
      .not("id", "is", null);
  }
});

test.describe("PROJ-87: Upgrade auf die Flatrate", () => {
  test("Der Kunde fragt an und sieht Preis und Differenz vorher", async ({ page }) => {
    await service
      .from("subscriptions")
      .update({ upgrade_requested_at: null })
      .eq("id", aboId);

    await anmelden(page, { email: MAIL, password: PASSWORT });
    await zumAbo(page);

    const karte = page.locator("li", { hasText: "E2E87 Kursabo" });
    await expect(karte.getByText("Auf Flatrate upgraden")).toBeVisible();
    // Der laufende Preis und die einmalige Differenz stehen da, bevor er
    // drückt — die Differenz gegen den Einzug dieses Zyklus (PROJ-88).
    await expect(karte).toContainText(String(flatrateNormal - KURSPREIS));

    await karte.getByRole("button", { name: "Upgrade anfragen" }).click();
    await page.waitForTimeout(2000);

    // Das Abo ist unberührt — nur die Markierung ist da.
    const stand = await abo();
    expect(stand.upgrade_requested_at).not.toBeNull();
    expect(stand.course_id).toBe(kursId);
    expect(Number(stand.price)).toBe(KURSPREIS);

    await expect(page.locator("li", { hasText: "E2E87 Kursabo" })).toContainText(
      "Upgrade angefragt"
    );
  });

  test("Der Kunde zieht die Anfrage zurück", async ({ page }) => {
    await service
      .from("subscriptions")
      .update({ upgrade_requested_at: new Date().toISOString() })
      .eq("id", aboId);

    await anmelden(page, { email: MAIL, password: PASSWORT });
    await zumAbo(page);

    await page
      .locator("li", { hasText: "E2E87 Kursabo" })
      .getByRole("button", { name: "Anfrage zurückziehen" })
      .click();
    await page.waitForTimeout(2000);
    expect((await abo()).upgrade_requested_at).toBeNull();
  });

  test("Der Betreiber bestätigt — Abo umgestellt, Kursplatz da, Aufschlag festgehalten", async ({
    page,
  }) => {
    // Ausgangslage: angefragt, nichts bestätigt. Der Einzug aus dem Aufbau
    // bleibt stehen — gegen ihn rechnet die Differenz (PROJ-88).
    await service.from("subscription_surcharges").delete().eq("customer_id", kundeId);
    await service.from("course_memberships").delete().eq("customer_id", kundeId);
    await service
      .from("subscriptions")
      .update({
        course_id: kursId,
        name: "E2E87 Kursabo",
        price: KURSPREIS,
        upgrade_requested_at: new Date().toISOString(),
      })
      .eq("id", aboId);

    await anmelden(page, ADMIN);
    await gehZu(page, "/admin");
    await page.waitForTimeout(1500);

    const karte = page.getByRole("region", { name: "Upgrade auf Flatrate" });
    await expect(karte.getByText(NAME)).toBeVisible();
    await karte
      .getByRole("button", { name: `Upgrade von ${NAME} zum Normaltarif bestätigen` })
      .click();
    await page.waitForTimeout(2500);

    // Abo umgestellt, Kursplatz daneben, Aufschlag festgehalten.
    const stand = await abo();
    expect(stand.course_id).toBeNull();
    expect(Number(stand.price)).toBe(flatrateNormal);

    const { data: plaetze } = await service
      .from("course_memberships")
      .select("course_id")
      .eq("subscription_id", aboId);
    expect(plaetze).toHaveLength(1);

    const { data: aufschlaege } = await service
      .from("subscription_surcharges")
      .select("amount, collection_item_id")
      .eq("subscription_id", aboId);
    expect(aufschlaege).toHaveLength(1);
    expect(Number(aufschlaege![0].amount)).toBe(flatrateNormal - KURSPREIS);

    // Der Lauf selbst wird hier **nicht** angelegt. Ein echter Lauf nimmt
    // jedes fällige Abo der Testdatenbank mit, und die Freigabe schreibt für
    // alle Rechnungen — das hat im Volllauf PROJ-10, PROJ-33 und PROJ-70
    // umgeworfen (achtzehn fremde Rechnungen, die dort niemand erwartet).
    //
    // Dass der Aufschlag in den Lauf kommt, auf der Position landet, gestempelt
    // wird und auf der Rechnung steht, prüft der Datenbanktest an einem Lauf,
    // der nur diese eine Position enthält.
  });

  test("Die Lehrkraft kommt auf die Verwaltungsseite nicht", async ({ page }) => {
    await anmelden(page, {
      email: "e2e13-lehrer-a@viennasalsastudio.test",
      password: "CorrectPassword123!",
    });
    await gehZu(page, "/admin");
    await page.waitForTimeout(1500);
    await expect(page.getByRole("region", { name: "Upgrade auf Flatrate" })).toHaveCount(0);
  });
});
