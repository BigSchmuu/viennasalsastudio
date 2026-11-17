import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gehZu } from "./navigation";
import { ladeTestUmgebung } from "./env";
import { zweiteStufeErledigen } from "./zweite-stufe";

ladeTestUmgebung();

/**
 * PROJ-105: Keine Lastschrift gegen ein widerrufenes Mandat.
 *
 * Eine Position trägt IBAN und Mandatsreferenz vom Anlegen des Laufs. Wird das
 * Mandat danach widerrufen, stand die Lastschrift bis zu dieser Änderung
 * trotzdem in der Bankdatei — weder `generateRunXml` noch die Freigabe prüften
 * `revoked_at`. Am 2026-11-17 ist das beinahe passiert; es hat nur deshalb
 * nicht stattgefunden, weil der Betreiber den Entwurf verworfen hat.
 *
 * Geprüft wird in der Reihenfolge, in der es im Betrieb passiert: Lauf anlegen,
 * Datei holen (das muss gehen), Mandat widerrufen, Datei holen (das darf nicht
 * gehen), Position entfernen, Datei holen (das muss wieder gehen).
 *
 * Zwei Kunden, weil der Entwurf nach dem Entfernen noch eine Position braucht
 * — ein Lauf ohne Positionen lässt sich nicht herunterladen.
 *
 * Daten in 2035, hinter allen anderen Lastschrift-Suiten.
 */

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const KENNUNG = `E2E105-${Date.now()}`;
const FAELLIG = "2035-02-05";

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test.use({ locale: "de-DE" });
test.describe.configure({ mode: "serial", timeout: 180_000 });

let kursId = "";
const kunden: Record<string, string> = {};
const abos: Record<string, string> = {};
const INHABER: Record<string, string> = {
  bleibt: `${KENNUNG} Bleibt Gueltig`,
  widerruft: `${KENNUNG} Widerruft`,
  barzahler: `${KENNUNG} Nie Ein Mandat`,
};

async function legeKundenAn(rolle: string, mitMandat = true) {
  const mail = `${KENNUNG.toLowerCase()}-${rolle}@viennasalsastudio.test`;
  const { data: konto, error: kontoFehler } = await svc.auth.admin.createUser({
    email: mail,
    password: "CorrectPassword123!",
    email_confirm: true,
  });
  if (kontoFehler || !konto.user) throw new Error(`PROJ-105 Konto ${rolle}: ${kontoFehler?.message}`);
  kunden[rolle] = konto.user.id;

  await svc.from("profiles").update({ full_name: INHABER[rolle] }).eq("id", konto.user.id);

  if (mitMandat) {
    const { error: mandatFehler } = await svc.from("sepa_mandates").insert({
      customer_id: konto.user.id,
      iban: "AT611904300234573201",
      account_holder_name: INHABER[rolle],
      mandate_reference: `${KENNUNG}-${rolle}`.slice(0, 35),
    });
    if (mandatFehler) throw new Error(`PROJ-105 Mandat ${rolle}: ${mandatFehler.message}`);
  }

  const { data: abo, error: aboFehler } = await svc
    .from("subscriptions")
    .insert({
      customer_id: konto.user.id,
      course_id: kursId,
      status: "active",
      name: `${KENNUNG} ${rolle}`,
      price: 49,
      cycle_anchor_date: "2035-01-02",
    })
    .select("id")
    .single();
  if (aboFehler) throw new Error(`PROJ-105 Abo ${rolle}: ${aboFehler.message}`);
  abos[rolle] = abo!.id;
}

async function loescheLauf() {
  const { data: laeufe } = await svc.from("sepa_collection_runs").select("id").eq("due_date", FAELLIG);
  for (const lauf of laeufe ?? []) {
    const { error: posFehler } = await svc.from("sepa_collection_items").delete().eq("run_id", lauf.id);
    if (posFehler) throw new Error(`PROJ-105 Positionen löschen: ${posFehler.message}`);
    const { error: laufFehler } = await svc.from("sepa_collection_runs").delete().eq("id", lauf.id);
    if (laufFehler) throw new Error(`PROJ-105 Lauf löschen: ${laufFehler.message}`);
  }
  const { count } = await svc
    .from("sepa_collection_runs")
    .select("id", { count: "exact", head: true })
    .eq("due_date", FAELLIG);
  if (count) throw new Error(`PROJ-105: ${count} Lauf/Läufe blieben stehen`);
}

test.beforeAll(async () => {
  await loescheLauf();
  const { data: raum } = await svc.from("rooms").select("id").limit(1).single();
  const { data: kurs, error: kursFehler } = await svc
    .from("courses")
    .insert({ name: `${KENNUNG} Kurs`, room_id: raum!.id, price: 49 })
    .select("id")
    .single();
  if (kursFehler) throw new Error(`PROJ-105 Kurs: ${kursFehler.message}`);
  kursId = kurs!.id;

  await legeKundenAn("bleibt");
  await legeKundenAn("widerruft");
  // Der echte Barzahler: nie ein Mandat erteilt. Er ist die Gegenprobe zur
  // Trennlinie — er darf in keiner der drei Listen stehen.
  await legeKundenAn("barzahler", false);
});

test.afterAll(async () => {
  await loescheLauf();
  for (const rolle of Object.keys(kunden)) {
    if (abos[rolle]) {
      // Erst die Barzahlungs-Einträge: Sie hängen am Abo.
      await svc.from("cash_entries").delete().eq("subscription_id", abos[rolle]);
    }
    if (abos[rolle]) await svc.from("subscriptions").delete().eq("id", abos[rolle]);
    await svc.from("sepa_mandates").delete().eq("customer_id", kunden[rolle]);
    await svc.auth.admin.deleteUser(kunden[rolle]).catch(() => {});
  }
  if (kursId) await svc.from("courses").delete().eq("id", kursId);
});

async function anmelden(page: Page) {
  const feld = page.getByLabel("E-Mail");
  for (let versuch = 0; ; versuch++) {
    await gehZu(page, "/login");
    try {
      await feld.waitFor({ state: "visible", timeout: 15_000 });
      break;
    } catch (fehler) {
      if (versuch >= 2) throw fehler;
      await page.waitForTimeout(1500);
    }
  }
  await page.waitForTimeout(800);
  await page.getByLabel("E-Mail").fill(ADMIN.email);
  await page.getByLabel("Passwort").fill(ADMIN.password);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await zweiteStufeErledigen(page, ADMIN.email);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

async function laufId(): Promise<string> {
  const { data } = await svc
    .from("sepa_collection_runs")
    .select("id")
    .eq("due_date", FAELLIG)
    .maybeSingle();
  if (!data) throw new Error("PROJ-105: kein Lauf");
  return data.id;
}

async function widerrufeMandat(rolle: string) {
  const { error } = await svc
    .from("sepa_mandates")
    .update({ revoked_at: new Date().toISOString() })
    .eq("customer_id", kunden[rolle]);
  if (error) throw new Error(`PROJ-105 Widerruf: ${error.message}`);
}

test.describe("PROJ-105: Kein Einzug gegen einen Widerruf", () => {
  test("Der Lauf entsteht und die Datei lässt sich holen", async ({ page }) => {
    await anmelden(page);
    await gehZu(page, "/admin/lastschriften");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);
    await page.locator("#due-date").fill(FAELLIG);
    await page.getByRole("button", { name: "Lauf erstellen" }).click();
    await page.waitForURL(/\/admin\/lastschriften\/[0-9a-f-]{36}/, { timeout: 60_000 });

    // Beide Abos sind drin — die Vorbedingung für alles Weitere.
    const { count } = await svc
      .from("sepa_collection_items")
      .select("id", { count: "exact", head: true })
      .eq("run_id", await laufId())
      .in("subscription_id", [abos.bleibt, abos.widerruft]);
    expect(count).toBe(2);

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "1. SEPA-XML herunterladen" }).click();
    expect(await (await download).path()).toBeTruthy();
  });

  test("Nach dem Widerruf ist die Position gekennzeichnet", async ({ page }) => {
    await widerrufeMandat("widerruft");
    await anmelden(page);
    await gehZu(page, `/admin/lastschriften/${await laufId()}`);
    const zeile = page.locator("tr", { hasText: INHABER.widerruft });
    await expect(zeile).toContainText("Mandat widerrufen");
    // Die gültige Position bleibt unbehelligt.
    await expect(page.locator("tr", { hasText: INHABER.bleibt })).not.toContainText(
      "Mandat widerrufen"
    );
  });

  test("Die Datei wird verweigert und nennt den Kontoinhaber", async ({ page }) => {
    await anmelden(page);
    await gehZu(page, `/admin/lastschriften/${await laufId()}`);
    await page.getByRole("button", { name: "1. SEPA-XML herunterladen" }).click();
    const meldung = page.getByText(/das SEPA-Mandat widerrufen/);
    await expect(meldung).toBeVisible({ timeout: 30_000 });
    await expect(meldung).toContainText(INHABER.widerruft);
    await expect(meldung).toContainText("Barzahlungsliste");
  });

  test("Auch die Bestätigung des Uploads wird verweigert", async ({ page }) => {
    await anmelden(page);
    await gehZu(page, `/admin/lastschriften/${await laufId()}`);
    await page.getByRole("button", { name: "2. Bei der Bank hochgeladen" }).click();
    await page.getByRole("button", { name: "Ja, hochgeladen" }).click();
    await expect(page.getByText(/das SEPA-Mandat widerrufen/)).toBeVisible({ timeout: 30_000 });

    // Nicht freigegeben: Die Bestätigung macht aus Positionen Rechnungen.
    const { data } = await svc
      .from("sepa_collection_runs")
      .select("released_at")
      .eq("id", await laufId())
      .single();
    expect(data?.released_at).toBeNull();
  });

  test("Nach dem Entfernen der Position entsteht die Datei wieder", async ({ page }) => {
    await anmelden(page);
    await gehZu(page, `/admin/lastschriften/${await laufId()}`);
    const zeile = page.locator("tr", { hasText: INHABER.widerruft });
    await zeile.getByRole("button", { name: "Entfernen" }).click();
    await page.getByRole("button", { name: "Entfernen" }).last().click();
    await expect(page.locator("tr", { hasText: INHABER.widerruft })).toHaveCount(0, {
      timeout: 30_000,
    });

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "1. SEPA-XML herunterladen" }).click();
    expect(await (await download).path()).toBeTruthy();
  });

  test("Das Abo steht nun unter Mandat widerrufen, Beitrag offen", async ({ page }) => {
    // Genau die Lage vom 2026-11-17: Die Position ist aus dem Lauf heraus, das
    // Mandat ist widerrufen, und der Beitrag ist trotzdem offen. Vorher
    // verschwand das Abo hier aus **beiden** Listen.
    await anmelden(page);
    await gehZu(page, `/admin/lastschriften/${await laufId()}`);

    const liste = page.getByTestId("ohne-mandat-abos");
    const zeile = liste.locator("li").filter({ hasText: INHABER.widerruft });
    await expect(zeile).toBeVisible({ timeout: 30_000 });
    await expect(zeile).toContainText("Das SEPA-Mandat ist widerrufen");
    await expect(zeile).toContainText("49,00");

    // Die Gegenprobe: Der echte Barzahler kommt auf dieser Seite überhaupt
    // nicht vor — in keiner Liste und in keiner Position. Geprüft über die
    // ganze Seite und nicht je Liste: `not.toContainText` scheitert, wenn das
    // Element fehlt, und die Liste der ausgelassenen Abos fehlt hier zu Recht.
    await expect(page.getByText(INHABER.barzahler)).toHaveCount(0);
  });

  test("Der Betrag lässt sich auf die Barzahlungsliste setzen", async ({ page }) => {
    await anmelden(page);
    await gehZu(page, `/admin/lastschriften/${await laufId()}`);
    const zeile = page
      .getByTestId("ohne-mandat-abos")
      .locator("li")
      .filter({ hasText: INHABER.widerruft });
    await zeile.getByRole("button", { name: "Auf die Barzahlungsliste" }).click();

    // Vorbelegt mit dem Beitrag des Abos — ein Rat, keine Festlegung.
    await expect(page.locator("#barzahlung-betrag")).toHaveValue("49,00");
    await page.getByRole("button", { name: "Auf die Liste setzen" }).click();

    await expect(zeile).toContainText("Steht auf der Barzahlungsliste", { timeout: 30_000 });
    const { count } = await svc
      .from("cash_entries")
      .select("id", { count: "exact", head: true })
      .eq("subscription_id", abos.widerruft);
    expect(count).toBe(1);
  });
});
