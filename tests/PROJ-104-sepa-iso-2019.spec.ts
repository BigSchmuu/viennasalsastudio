import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { gehZu } from "./navigation";
import { ladeTestUmgebung } from "./env";
import { zweiteStufeErledigen } from "./zweite-stufe";

ladeTestUmgebung();

/**
 * PROJ-104: Die Lastschriftdatei im Format ISO-2019.
 *
 * Geprüft wird an der **heruntergeladenen Datei** und nicht an einer
 * Funktionsrückgabe: Dazwischen liegt die Serveraktion, die die
 * Gläubigeradresse aus der Konfiguration liest. Genau dieser Schritt ist der,
 * der beim Betreiber schiefgehen könnte.
 */

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const KENNUNG = `E2E104-${Date.now()}`;

// Weit weg von allen anderen Lastschrift-Suiten: PROJ-7 in 2026, PROJ-10 in
// 2028, PROJ-47 in 2029/2030, PROJ-70 in 2031, PROJ-103 in 2032.
const FAELLIG = "2033-04-05";

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test.use({ locale: "de-DE" });
test.describe.configure({ mode: "serial" });

let kundeId = "";
let aboId = "";
let kursId = "";

async function loescheLauf() {
  const { data: laeufe } = await svc.from("sepa_collection_runs").select("id").eq("due_date", FAELLIG);
  for (const lauf of laeufe ?? []) {
    const { error: posFehler } = await svc.from("sepa_collection_items").delete().eq("run_id", lauf.id);
    if (posFehler) throw new Error(`PROJ-104 Positionen löschen: ${posFehler.message}`);
    const { error } = await svc.from("sepa_collection_runs").delete().eq("id", lauf.id);
    if (error) throw new Error(`PROJ-104 Lauf löschen: ${error.message}`);
  }
  const { count } = await svc
    .from("sepa_collection_runs")
    .select("id", { count: "exact", head: true })
    .eq("due_date", FAELLIG);
  if (count) throw new Error(`PROJ-104: ${count} Lauf/Läufe blieben stehen`);
}

test.beforeAll(async () => {
  const { data: raum } = await svc.from("rooms").select("id").limit(1).single();
  const { data: kurs, error: kursFehler } = await svc
    .from("courses")
    .insert({ name: `${KENNUNG} Kurs`, room_id: raum!.id, price: 39 })
    .select("id")
    .single();
  if (kursFehler) throw new Error(`PROJ-104 Kurs: ${kursFehler.message}`);
  kursId = kurs!.id;

  const { data: konto, error: kontoFehler } = await svc.auth.admin.createUser({
    email: `${KENNUNG.toLowerCase()}@viennasalsastudio.test`,
    password: "CorrectPassword123!",
    email_confirm: true,
  });
  if (kontoFehler || !konto.user) throw new Error(`PROJ-104 Konto: ${kontoFehler?.message}`);
  kundeId = konto.user.id;
  // Umlaute im Namen: Der Zeichensatz der Richtlinie erlaubt den national
  // gebräuchlichen Satz, und genau das soll die Datei auch zeigen.
  await svc.from("profiles").update({ full_name: `${KENNUNG} Jürgen Müller` }).eq("id", kundeId);

  const { error: mandatFehler } = await svc.from("sepa_mandates").insert({
    customer_id: kundeId,
    iban: "AT611904300234573201",
    account_holder_name: `${KENNUNG} Jürgen Müller`,
    mandate_reference: `${KENNUNG}-MANDAT`,
  });
  if (mandatFehler) throw new Error(`PROJ-104 Mandat: ${mandatFehler.message}`);

  const { data: abo, error: aboFehler } = await svc
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: kursId,
      status: "active",
      name: `${KENNUNG} Abo`,
      price: 39,
    })
    .select("id")
    .single();
  if (aboFehler) throw new Error(`PROJ-104 Abo: ${aboFehler.message}`);
  aboId = abo!.id;

  await loescheLauf();
});

test.afterAll(async () => {
  await loescheLauf();
  if (aboId) await svc.from("subscriptions").delete().eq("id", aboId);
  if (kundeId) await svc.from("sepa_mandates").delete().eq("customer_id", kundeId);
  if (kundeId) await svc.auth.admin.deleteUser(kundeId).catch(() => {});
  if (kursId) await svc.from("courses").delete().eq("id", kursId);
});

async function anmelden(page: Page) {
  // Siehe PROJ-103: Gegen einen frisch gestarteten Entwicklungsserver
  // antwortet /login beim ersten Aufruf gelegentlich mit 404, weil die
  // Sprachweiche noch übersetzt wird.
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

/** Legt den Lauf über die Oberfläche an und gibt die heruntergeladene Datei zurück. */
async function ladeDateiHerunter(page: Page): Promise<string> {
  await gehZu(page, "/admin/lastschriften");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  await page.locator("#due-date").fill(FAELLIG);
  await page.getByRole("button", { name: "Lauf erstellen" }).click();
  await page.waitForURL(/\/admin\/lastschriften\/[0-9a-f-]{36}/, { timeout: 60_000 });

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "1. SEPA-XML herunterladen" }).click();
  const datei = await download;
  const pfad = await datei.path();
  if (!pfad) throw new Error("PROJ-104: Die Datei wurde nicht gespeichert");
  return readFileSync(pfad, "utf8");
}

test.describe("PROJ-104: Die Bankdatei trägt ISO-2019", () => {
  test("Die heruntergeladene Datei ist pain.008.001.08 mit strukturierter Adresse", async ({
    page,
  }) => {
    test.slow();
    await anmelden(page);
    const xml = await ladeDateiHerunter(page);

    // Das, worüber die Bank gewarnt hat.
    expect(xml).toContain('xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.08"');
    expect(xml).not.toContain("pain.008.001.02");

    // Die Gläubigeradresse kommt aus der Konfiguration und steht strukturiert
    // darin — der Schritt, den nur dieser Test abdeckt.
    expect(xml).toContain("<PstlAdr>");
    expect(xml).toContain("<TwnNm>Wien</TwnNm>");
    expect(xml).toContain("<Ctry>AT</Ctry>");
    expect(xml).toContain("<StrtNm>Teststraße</StrtNm>");
    expect(xml).toContain("<Room>Top 2</Room>");
    // „‚Address Line' is not allowed" in der strukturierten Form.
    expect(xml).not.toContain("AdrLine");

    // Der Zahlungspflichtige steht ohne Adresse darin — im EWR nicht verlangt.
    expect(xml).toContain(`<Nm>${KENNUNG} Jürgen Müller</Nm>`);

    // Und die Position ist die erwartete.
    expect(xml).toContain('<InstdAmt Ccy="EUR">39.00</InstdAmt>');
    expect(xml).toContain(`<MndtId>${KENNUNG}-MANDAT</MndtId>`);
    expect(xml).toContain("<Id>NOTPROVIDED</Id>");
  });
});
