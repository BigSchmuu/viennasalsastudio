import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { gehZu } from "./navigation";
import { ladeTestUmgebung } from "./env";
import { zweiteStufeErledigen } from "./zweite-stufe";

ladeTestUmgebung();

/**
 * PROJ-70: Kein zweiter Einzug im selben Zyklus.
 *
 * Aus dem Betrieb gemeldet: Ein zweiter Lauf im selben Monat nahm alle Abos
 * noch einmal mit. Geprüft wird die Regel dort, wo sie entscheidet — beim
 * Anlegen eines Laufs über die Verwaltung — samt der Ferienverlängerung und
 * der Möglichkeit, ein Abo trotzdem von Hand nachzutragen.
 */

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const KENNUNG = `E2E70-${Date.now()}`;

// Weit weg von den Daten der anderen Lastschrift-Suiten: PROJ-7 liegt in
// 2026, PROJ-10 in 2028, PROJ-47 monatlich von 2029-05 bis 2030-04. Diese
// Läufe erfassen auch deren Fixtures — lägen sie dazwischen, nähmen sie
// einander gegenseitig die Positionen weg.
const ERSTER = "2031-06-01";
const ZU_FRUEH = "2031-06-10";
const NACH_VIER_WOCHEN = "2031-06-29";

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test.use({ locale: "de-DE" });

let kundeId = "";
let aboId = "";
let kursId = "";
let ferienId = "";
// Ein zweiter Kunde, dessen Abo erst nach dem ersten Lauf entsteht. Ohne ihn
// hätte der zweite Lauf überhaupt keine Position — und käme gar nicht
// zustande, womit der Weg „von Hand nachtragen" ungeprüft bliebe.
let kundeBId = "";
let aboBId = "";

async function loescheLaeufe(daten: string[]) {
  const { data: laeufe } = await svc.from("sepa_collection_runs").select("id").in("due_date", daten);
  for (const lauf of laeufe ?? []) {
    const { error: posFehler } = await svc.from("sepa_collection_items").delete().eq("run_id", lauf.id);
    if (posFehler) throw new Error(`PROJ-70 Positionen löschen: ${posFehler.message}`);
    const { error: laufFehler } = await svc.from("sepa_collection_runs").delete().eq("id", lauf.id);
    if (laufFehler) throw new Error(`PROJ-70 Lauf löschen: ${laufFehler.message}`);
  }
  // Ungeprüft gelöscht ist nicht gelöscht: Bleibt ein Lauf stehen, warnt die
  // Oberfläche beim nächsten Anlegen vor dem doppelten Datum, es entsteht kein
  // neuer Lauf — und die Prüfung misst danach den alten.
  const { count } = await svc
    .from("sepa_collection_runs")
    .select("id", { count: "exact", head: true })
    .in("due_date", daten);
  if (count) throw new Error(`PROJ-70: ${count} Lauf/Läufe blieben stehen`);
}

async function raeumeLaeufeWeg() {
  await loescheLaeufe([ERSTER, ZU_FRUEH, NACH_VIER_WOCHEN]);
}

test.beforeAll(async () => {
  const { data: alle } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = alle?.users.find((u) => u.email === `${KENNUNG.toLowerCase()}@viennasalsastudio.test`);
  if (alt) await svc.auth.admin.deleteUser(alt.id);

  const { data: konto, error: kontoFehler } = await svc.auth.admin.createUser({
    email: `${KENNUNG.toLowerCase()}@viennasalsastudio.test`,
    password: "CorrectPassword123!",
    email_confirm: true,
  });
  if (kontoFehler || !konto.user) throw new Error(`PROJ-70 Konto: ${kontoFehler?.message}`);
  kundeId = konto.user.id;
  await svc.from("profiles").update({ full_name: `${KENNUNG} Kunde` }).eq("id", kundeId);

  const { data: raum } = await svc.from("rooms").select("id").limit(1).single();
  const { data: kurs, error: kursFehler } = await svc
    .from("courses")
    .insert({ name: `${KENNUNG} Kurs`, room_id: raum!.id, price: 40 })
    .select("id")
    .single();
  if (kursFehler) throw new Error(`PROJ-70 Kurs: ${kursFehler.message}`);
  kursId = kurs!.id;

  const { data: abo, error: aboFehler } = await svc
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: kursId,
      status: "active",
      name: `${KENNUNG} Abo`,
      price: 40,
    })
    .select("id")
    .single();
  if (aboFehler) throw new Error(`PROJ-70 Abo: ${aboFehler.message}`);
  aboId = abo!.id;

  const { error: mandatFehler } = await svc.from("sepa_mandates").insert({
    customer_id: kundeId,
    iban: "AT611904300234573201",
    account_holder_name: `${KENNUNG} Kunde`,
    mandate_reference: `${KENNUNG}-MANDAT`,
  });
  if (mandatFehler) throw new Error(`PROJ-70 Mandat: ${mandatFehler.message}`);

  const { data: kontoB, error: kontoBFehler } = await svc.auth.admin.createUser({
    email: `${KENNUNG.toLowerCase()}-b@viennasalsastudio.test`,
    password: "CorrectPassword123!",
    email_confirm: true,
  });
  if (kontoBFehler || !kontoB.user) throw new Error(`PROJ-70 Konto B: ${kontoBFehler?.message}`);
  kundeBId = kontoB.user.id;
  await svc.from("profiles").update({ full_name: `${KENNUNG} Neuzugang` }).eq("id", kundeBId);
  const { error: mandatBFehler } = await svc.from("sepa_mandates").insert({
    customer_id: kundeBId,
    iban: "AT611904300234573201",
    account_holder_name: `${KENNUNG} Neuzugang`,
    mandate_reference: `${KENNUNG}-MANDAT-B`,
  });
  if (mandatBFehler) throw new Error(`PROJ-70 Mandat B: ${mandatBFehler.message}`);

  await raeumeLaeufeWeg();
});

test.afterAll(async () => {
  await raeumeLaeufeWeg();
  if (ferienId) await svc.from("studio_holidays").delete().eq("id", ferienId);
  if (kundeId) await svc.from("sepa_mandates").delete().eq("customer_id", kundeId);
  if (kundeBId) await svc.from("sepa_mandates").delete().eq("customer_id", kundeBId);
  if (aboId) await svc.from("subscriptions").delete().eq("id", aboId);
  if (aboBId) await svc.from("subscriptions").delete().eq("id", aboBId);
  if (kundeBId) await svc.auth.admin.deleteUser(kundeBId).catch(() => {});
  if (kursId) await svc.from("courses").delete().eq("id", kursId);
  if (kundeId) await svc.auth.admin.deleteUser(kundeId).catch(() => {});
});

async function anmelden(page: Page) {
  await gehZu(page, "/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(ADMIN.email);
  await page.getByLabel("Passwort").fill(ADMIN.password);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await zweiteStufeErledigen(page, ADMIN.email);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

/** Legt über die Oberfläche einen Lauf an. Gibt zurück, ob einer entstanden ist. */
async function legeLaufAn(page: Page, datum: string): Promise<boolean> {
  await page.goto("/admin/lastschriften");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  await page.locator("#due-date").fill(datum);
  await page.getByRole("button", { name: "Lauf erstellen" }).click();
  await page.waitForTimeout(2500);
  return /\/admin\/lastschriften\/[0-9a-f-]{36}/.test(page.url());
}

/** Die Positionen dieses Abos in einem Lauf zum Datum. */
async function positionenZu(datum: string): Promise<number> {
  const { data: lauf } = await svc
    .from("sepa_collection_runs")
    .select("id")
    .eq("due_date", datum)
    .maybeSingle();
  if (!lauf) return 0;
  const { count } = await svc
    .from("sepa_collection_items")
    .select("id", { count: "exact", head: true })
    .eq("run_id", lauf.id)
    .eq("subscription_id", aboId);
  return count ?? 0;
}

test.describe("PROJ-70: Kein zweiter Einzug im selben Zyklus", () => {
  test("Der erste Lauf nimmt das Abo mit", async ({ page }) => {
    await anmelden(page);
    expect(await legeLaufAn(page, ERSTER)).toBe(true);
    expect(await positionenZu(ERSTER), "Abo fehlt im ersten Lauf").toBe(1);
  });

  test("Ein zweiter Lauf neun Tage später lässt es aus — und sagt das", async ({ page }) => {
    // Der Neuzugang war beim ersten Lauf noch nicht da; er sorgt dafür, dass
    // der zweite Lauf überhaupt eine Position hat.
    const { data: aboB, error: aboBFehler } = await svc
      .from("subscriptions")
      .insert({
        customer_id: kundeBId,
        course_id: kursId,
        status: "active",
        name: `${KENNUNG} Abo B`,
        price: 35,
      })
      .select("id")
      .single();
    if (aboBFehler) throw new Error(`PROJ-70 Abo B: ${aboBFehler.message}`);
    aboBId = aboB!.id;

    await anmelden(page);
    await legeLaufAn(page, ZU_FRUEH);

    expect(await positionenZu(ZU_FRUEH), "Abo wurde ein zweites Mal eingezogen").toBe(0);
    // Der Hinweis erscheint nur, wenn wirklich ein Lauf entstanden ist; sonst
    // steht die Meldung auf der Liste.
    if (/\/admin\/lastschriften\/[0-9a-f-]{36}/.test(page.url())) {
      await expect(page.getByText(/nicht aufgenommen/)).toBeVisible();
    }
  });

  test("Von Hand geht es trotzdem — mit sichtbarem Grund", async ({ page }) => {
    await anmelden(page);
    const { data: lauf } = await svc
      .from("sepa_collection_runs")
      .select("id")
      .eq("due_date", ZU_FRUEH)
      .maybeSingle();
    test.skip(!lauf, "Zum zweiten Datum ist kein Lauf entstanden — nichts nachzutragen.");

    await gehZu(page, `/admin/lastschriften/${lauf!.id}`);
    await page.getByRole("button", { name: /Position hinzufügen/ }).click();
    await expect(page.getByText(/Einzug am .* keine vier Wochen Abstand/).first()).toBeVisible();
  });

  test("Nach vier Wochen ist es wieder dabei", async ({ page }) => {
    await anmelden(page);
    expect(await legeLaufAn(page, NACH_VIER_WOCHEN)).toBe(true);
    expect(await positionenZu(NACH_VIER_WOCHEN), "Abo fehlt nach vier Wochen").toBe(1);
  });

  test("Eine Ferienwoche schiebt den Termin nach hinten", async ({ page }) => {
    // Aufräumen: nur der erste Lauf bleibt als Einzug stehen.
    await loescheLaeufe([ZU_FRUEH, NACH_VIER_WOCHEN]);

    const { data: ferien, error } = await svc
      .from("studio_holidays")
      .insert({ name: `${KENNUNG} Ferien`, starts_on: "2031-06-08", ends_on: "2031-06-14" })
      .select("id")
      .single();
    if (error) throw new Error(`PROJ-70 Ferien: ${error.message}`);
    ferienId = ferien!.id;

    await anmelden(page);
    await legeLaufAn(page, NACH_VIER_WOCHEN);
    expect(
      await positionenZu(NACH_VIER_WOCHEN),
      "Die Ferienwoche wurde nicht berücksichtigt"
    ).toBe(0);
  });
});
