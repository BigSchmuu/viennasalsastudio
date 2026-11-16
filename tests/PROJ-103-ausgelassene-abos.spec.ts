import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gehZu } from "./navigation";
import { ladeTestUmgebung } from "./env";
import { zweiteStufeErledigen } from "./zweite-stufe";

ladeTestUmgebung();

/**
 * PROJ-103: Der Lauf nennt die ausgelassenen Abos mit Grund.
 *
 * Aus dem Betrieb gemeldet: Der Hinweis nach dem Anlegen nannte eine Zahl und
 * zwei Möglichkeiten — „welches Abo?“ blieb offen. Geprüft wird deshalb an
 * fünf Abos, von denen jedes aus einem anderen Grund draußen bleibt, dass der
 * Hinweis Namen, Grund und Betrag nennt; dass der Barzahler nicht darin steht;
 * und dass sich ein ausgelassenes Abo in derselben Zeile trotzdem aufnehmen
 * lässt.
 */

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const KENNUNG = `E2E103-${Date.now()}`;

// Weit weg von allen anderen Lastschrift-Suiten: PROJ-7 liegt in 2026,
// PROJ-10 in 2028, PROJ-47 in 2029/2030, PROJ-70 in 2031. Ein Lauf erfasst
// auch deren Abos — lägen die Daten dazwischen, nähmen sie einander die
// Positionen weg.
const ERSTER = "2032-03-01";
const ZWEITER = "2032-03-10";
/** Die Kündigung wirkt vor beiden Läufen. */
const GEKUENDIGT_AB = "2032-02-01";
/** Dieses Abo beginnt lange nach beiden Läufen. */
const SPAETER_BEGINN = "2032-06-01";
/** Zwischen den beiden Läufen — damit der zweite überhaupt eine Position hat. */
const BEGINN_DAZWISCHEN = "2032-03-08";

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test.use({ locale: "de-DE" });
test.describe.configure({ mode: "serial" });

let kursId = "";
/** Kunde und Abo je Rolle: A zyklus, B Beginn, C gekündigt, D ohne Preis, E Barzahler, F zahlt. */
const kunden: Record<string, string> = {};
const abos: Record<string, string> = {};

async function legeKundenAn(
  rolle: string,
  name: string,
  mitMandat: boolean,
  aboFelder: Record<string, unknown>
) {
  const mail = `${KENNUNG.toLowerCase()}-${rolle}@viennasalsastudio.test`;
  const { data: konto, error: kontoFehler } = await svc.auth.admin.createUser({
    email: mail,
    password: "CorrectPassword123!",
    email_confirm: true,
  });
  if (kontoFehler || !konto.user) throw new Error(`PROJ-103 Konto ${rolle}: ${kontoFehler?.message}`);
  kunden[rolle] = konto.user.id;
  await svc.from("profiles").update({ full_name: name }).eq("id", konto.user.id);

  if (mitMandat) {
    const { error } = await svc.from("sepa_mandates").insert({
      customer_id: konto.user.id,
      iban: "AT611904300234573201",
      account_holder_name: name,
      mandate_reference: `${KENNUNG}-${rolle}`,
    });
    if (error) throw new Error(`PROJ-103 Mandat ${rolle}: ${error.message}`);
  }

  const { data: abo, error: aboFehler } = await svc
    .from("subscriptions")
    .insert({
      customer_id: konto.user.id,
      course_id: kursId,
      status: "active",
      name: `${KENNUNG} Abo ${rolle.toUpperCase()}`,
      ...aboFelder,
    })
    .select("id")
    .single();
  if (aboFehler) throw new Error(`PROJ-103 Abo ${rolle}: ${aboFehler.message}`);
  abos[rolle] = abo!.id;
}

async function loescheLaeufe() {
  const { data: laeufe } = await svc
    .from("sepa_collection_runs")
    .select("id")
    .in("due_date", [ERSTER, ZWEITER]);
  for (const lauf of laeufe ?? []) {
    const { error: posFehler } = await svc.from("sepa_collection_items").delete().eq("run_id", lauf.id);
    if (posFehler) throw new Error(`PROJ-103 Positionen löschen: ${posFehler.message}`);
    const { error: laufFehler } = await svc.from("sepa_collection_runs").delete().eq("id", lauf.id);
    if (laufFehler) throw new Error(`PROJ-103 Lauf löschen: ${laufFehler.message}`);
  }
  // Ungeprüft gelöscht ist nicht gelöscht: Bleibt ein Lauf stehen, warnt die
  // Oberfläche beim nächsten Anlegen vor dem doppelten Datum, es entsteht kein
  // neuer Lauf — und geprüft würde danach der alte.
  const { count } = await svc
    .from("sepa_collection_runs")
    .select("id", { count: "exact", head: true })
    .in("due_date", [ERSTER, ZWEITER]);
  if (count) throw new Error(`PROJ-103: ${count} Lauf/Läufe blieben stehen`);
}

test.beforeAll(async () => {
  const { data: raum } = await svc.from("rooms").select("id").limit(1).single();
  const { data: kurs, error: kursFehler } = await svc
    .from("courses")
    .insert({ name: `${KENNUNG} Kurs`, room_id: raum!.id, price: 42 })
    .select("id")
    .single();
  if (kursFehler) throw new Error(`PROJ-103 Kurs: ${kursFehler.message}`);
  kursId = kurs!.id;

  // A wird im ersten Lauf eingezogen und ist im zweiten deshalb zu früh dran.
  await legeKundenAn("a", `${KENNUNG} Zyklus`, true, { price: 42 });
  // B beginnt erst im Juni.
  await legeKundenAn("b", `${KENNUNG} Spaetstart`, true, {
    price: 43,
    cycle_anchor_date: SPAETER_BEGINN,
  });
  // C ist gekündigt, wirksam vor beiden Läufen.
  await legeKundenAn("c", `${KENNUNG} Gekuendigt`, true, {
    price: 44,
    pending_status: "cancelled",
    pending_effective_date: GEKUENDIGT_AB,
  });
  // D hat keinen Preis — der Fall, der vor PROJ-103 lautlos aus jedem Lauf fiel.
  await legeKundenAn("d", `${KENNUNG} Ohne Preis`, true, { price: null });
  // E hat kein Mandat: ein Barzahler. Er darf nicht in der Liste stehen.
  await legeKundenAn("e", `${KENNUNG} Barzahler`, false, { price: 45 });
  // F sorgt dafür, dass der zweite Lauf überhaupt zustande kommt.
  await legeKundenAn("f", `${KENNUNG} Zahlt`, true, {
    price: 46,
    cycle_anchor_date: BEGINN_DAZWISCHEN,
  });

  await loescheLaeufe();
});

test.afterAll(async () => {
  await loescheLaeufe();
  for (const rolle of Object.keys(kunden)) {
    if (abos[rolle]) await svc.from("subscriptions").delete().eq("id", abos[rolle]);
    await svc.from("sepa_mandates").delete().eq("customer_id", kunden[rolle]);
    await svc.auth.admin.deleteUser(kunden[rolle]).catch(() => {});
  }
  if (kursId) await svc.from("courses").delete().eq("id", kursId);
});

async function anmelden(page: Page) {
  // Beim allerersten Aufruf gegen einen frisch gestarteten
  // Entwicklungsserver kann /login mit 404 antworten: Die Sprachweiche in der
  // Middleware wird erst übersetzt, und ohne sie gibt es diesen Pfad nicht
  // (die Seite liegt unter /[locale]/login). Deshalb bis zu dreimal.
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

/**
 * Legt über die Oberfläche einen Lauf an. Gibt zurück, ob einer entstanden ist.
 *
 * Gewartet wird auf die Navigation und nicht auf eine Frist: Beim ersten
 * Aufruf übersetzt der Entwicklungsserver die Serveraktion erst, und eine
 * feste Wartezeit hielt das für einen Fehlschlag.
 */
async function legeLaufAn(page: Page, datum: string): Promise<boolean> {
  await gehZu(page, "/admin/lastschriften");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  await page.locator("#due-date").fill(datum);
  await page.getByRole("button", { name: "Lauf erstellen" }).click();
  try {
    await page.waitForURL(/\/admin\/lastschriften\/[0-9a-f-]{36}/, { timeout: 60_000 });
    return true;
  } catch {
    return false;
  }
}

async function laufId(datum: string): Promise<string> {
  const { data } = await svc.from("sepa_collection_runs").select("id").eq("due_date", datum).maybeSingle();
  if (!data) throw new Error(`PROJ-103: kein Lauf zum ${datum}`);
  return data.id;
}

async function positionenZu(datum: string, rolle: string): Promise<number> {
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
    .eq("subscription_id", abos[rolle]);
  return count ?? 0;
}

function hinweis(page: Page) {
  return page.getByTestId("ausgelassene-abos");
}

function zeile(page: Page, name: string) {
  return hinweis(page).locator("li").filter({ hasText: name });
}

test.describe("PROJ-103: Ausgelassene Abos stehen mit Namen und Grund da", () => {
  test("Der erste Lauf nimmt das Abo mit", async ({ page }) => {
    // Anmelden, übersetzen, anlegen: zusammen mehr als eine Minute möglich.
    test.slow();
    await anmelden(page);
    expect(await legeLaufAn(page, ERSTER), "Zum ersten Datum entstand kein Lauf").toBe(true);
    expect(await positionenZu(ERSTER, "a"), "Abo A fehlt im ersten Lauf").toBe(1);
  });

  test("Der zweite Lauf nennt jedes ausgelassene Abo beim Namen", async ({ page }) => {
    test.slow();
    await anmelden(page);
    expect(await legeLaufAn(page, ZWEITER), "Zum zweiten Datum entstand kein Lauf").toBe(true);

    // Der Kasten ist da und nennt eine Anzahl. Eine feste Zahl wäre falsch:
    // In der Testdatenbank stehen weitere Abos anderer Suiten.
    await expect(hinweis(page)).toBeVisible();
    await expect(hinweis(page)).toContainText(/\d+ Abos? nicht aufgenommen/);

    // A: im selben Zyklus schon eingezogen — mit dem Tag, ab dem es wieder geht.
    const a = zeile(page, `${KENNUNG} Zyklus`);
    await expect(a).toHaveCount(1);
    await expect(a).toContainText(`${KENNUNG} Abo A`);
    await expect(a).toContainText(/Einzug am .* keine vier Wochen Abstand/);
    await expect(a).toContainText(/wieder möglich ab/);
    await expect(a).toContainText("42,00");

    // B: beginnt erst später — mit dem Beginndatum.
    const b = zeile(page, `${KENNUNG} Spaetstart`);
    await expect(b).toContainText("Beginnt erst am 1.6.2032");

    // C: gekündigt — bis PROJ-103 fiel dieses Abo ohne jede Meldung heraus.
    const c = zeile(page, `${KENNUNG} Gekuendigt`);
    await expect(c).toContainText("Gekündigt zum 1.2.2032");

    // D: kein Preis — ebenfalls ein stiller Fall, und ohne Betrag.
    const d = zeile(page, `${KENNUNG} Ohne Preis`);
    await expect(d).toContainText("Kein Preis am Abo hinterlegt");
    await expect(d).toContainText("—");

    // E: Barzahler ohne Mandat. Er gehört nicht in einen Lastschriftlauf und
    // auch nicht in diese Liste.
    await expect(zeile(page, `${KENNUNG} Barzahler`)).toHaveCount(0);

    // F zahlt — es steht in den Positionen, nicht im Hinweis.
    expect(await positionenZu(ZWEITER, "f"), "Abo F fehlt im zweiten Lauf").toBe(1);
    await expect(zeile(page, `${KENNUNG} Zahlt`)).toHaveCount(0);
  });

  test("Der Hinweis überlebt das Neuladen — er hängt nicht an der Adresse", async ({ page }) => {
    await anmelden(page);
    const id = await laufId(ZWEITER);
    // Ohne Suchteil aufgerufen: Vor PROJ-103 kam der Hinweis aus
    // `?uebersprungen=` und war damit nach dem ersten Neuladen weg.
    await gehZu(page, `/admin/lastschriften/${id}`);
    await expect(hinweis(page)).toBeVisible();
    await expect(zeile(page, `${KENNUNG} Spaetstart`)).toHaveCount(1);
  });

  test("Vom Hinweis in die Kundenakte und zurück auf den Lauf", async ({ page }) => {
    await anmelden(page);
    const id = await laufId(ZWEITER);
    await gehZu(page, `/admin/lastschriften/${id}`);

    await zeile(page, `${KENNUNG} Spaetstart`).getByRole("link", { name: `${KENNUNG} Spaetstart` }).click();
    await page.waitForLoadState("networkidle");
    const zurueck = page.getByRole("link", { name: "← Zurück zum Lastschriftlauf" });
    await expect(zurueck).toBeVisible();
    // Auf die Navigation warten, nicht auf „networkidle": Der Rückweg ist ein
    // Link, und ohne das Warten wird die Adresse vor dem Wechsel gelesen.
    await zurueck.click();
    await page.waitForURL(new RegExp(`/admin/lastschriften/${id}$`), { timeout: 20_000 });
    expect(page.url()).toContain(`/admin/lastschriften/${id}`);
  });

  test("Trotzdem aufnehmen — mit dem Grund neben der Entscheidung", async ({ page }) => {
    await anmelden(page);
    const id = await laufId(ZWEITER);
    await gehZu(page, `/admin/lastschriften/${id}`);

    await zeile(page, `${KENNUNG} Zyklus`).getByRole("button", { name: "Trotzdem aufnehmen" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`${KENNUNG} Zyklus`);
    await expect(dialog).toContainText(/Warum es fehlt/);
    await expect(dialog).toContainText(/keine vier Wochen Abstand/);
    // Der Preis des Abos liegt als Vorschlag im Feld.
    await expect(page.locator("#ausgelassen-betrag")).toHaveValue("42,00");

    await dialog.getByRole("button", { name: "Aufnehmen" }).click();
    await page.waitForTimeout(2500);

    expect(await positionenZu(ZWEITER, "a"), "Abo A wurde nicht aufgenommen").toBe(1);
    await expect(zeile(page, `${KENNUNG} Zyklus`)).toHaveCount(0);
  });

  test("Ohne Preis am Abo verlangt das Aufnehmen einen Betrag", async ({ page }) => {
    await anmelden(page);
    const id = await laufId(ZWEITER);
    await gehZu(page, `/admin/lastschriften/${id}`);

    await zeile(page, `${KENNUNG} Ohne Preis`)
      .getByRole("button", { name: "Trotzdem aufnehmen" })
      .click();
    const dialog = page.getByRole("dialog");
    const feld = page.locator("#ausgelassen-betrag");
    await expect(feld).toHaveValue("");
    // Ohne Betrag geht es nicht weiter — ein leeres Feld wäre eine Abbuchung
    // über null.
    await expect(dialog.getByRole("button", { name: "Aufnehmen" })).toBeDisabled();

    await feld.fill("33,50");
    await expect(dialog.getByRole("button", { name: "Aufnehmen" })).toBeEnabled();
    await dialog.getByRole("button", { name: "Aufnehmen" }).click();
    await page.waitForTimeout(2500);

    const { data: position } = await svc
      .from("sepa_collection_items")
      .select("amount")
      .eq("run_id", id)
      .eq("subscription_id", abos["d"])
      .maybeSingle();
    expect(position, "Abo ohne Preis wurde nicht aufgenommen").not.toBeNull();
    expect(Number(position!.amount)).toBe(33.5);
  });

  test("Nach der Freigabe gibt es keinen Hinweis mehr", async ({ page }) => {
    // Freigegeben wird hier über die Datenbank: Der Weg über die Oberfläche
    // erzeugt Rechnungen und Vorabankündigungen für alle Positionen des
    // Laufs — auch für die Fixtures anderer Suiten. Geprüft wird hier die
    // Anzeige, nicht die Freigabe; die hat PROJ-47.
    const id = await laufId(ERSTER);
    const { error } = await svc
      .from("sepa_collection_runs")
      .update({ released_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(`PROJ-103 Freigabe: ${error.message}`);

    await anmelden(page);
    await gehZu(page, `/admin/lastschriften/${id}`);
    await expect(page.getByRole("button", { name: /SEPA-XML herunterladen/ })).toBeVisible();
    await expect(hinweis(page)).toHaveCount(0);
  });
});
