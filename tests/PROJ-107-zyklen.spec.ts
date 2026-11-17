import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gehZu } from "./navigation";
import { ladeTestUmgebung } from "./env";
import { zweiteStufeErledigen } from "./zweite-stufe";

ladeTestUmgebung();

/**
 * PROJ-107 Stufe 1: Der gemeinsame Zahlungszyklus.
 *
 * Geprüft wird an einem Zyklus von **42 Tagen** — der Lage des echten ersten
 * Zyklus (30.11.2026 bis 10.01.2027: vier Kurswochen plus zwei Wochen
 * Weihnachtspause). Gerade diese Länge trennt die neue Regel von der alten in
 * beide Richtungen, und beide Richtungen stehen hier:
 *
 *   Lauf B liegt **35 Tage** nach Lauf A, aber im selben Zyklus. Die alte
 *   Vier-Wochen-Regel hätte freigegeben — und zweimal für dieselbe Zeit
 *   abgebucht.
 *
 *   Lauf C liegt **7 Tage** nach Lauf B, aber im nächsten Zyklus. Die alte
 *   Regel hätte gesperrt — genau das hätte am 30.11.2026 jedes Abo aus dem
 *   Lauf geworfen.
 *
 * Die Daten liegen in 2034, weit hinter allen anderen Lastschrift-Suiten
 * (PROJ-7 in 2026, PROJ-10 in 2028, PROJ-47 in 2029/2030, PROJ-70 in 2031,
 * PROJ-103 in 2032, PROJ-104 in 2033).
 */

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const KENNUNG = `E2E107-${Date.now()}`;

/** Zyklus 1: 42 Tage, wie die Weihnachtslage. */
const Z1_VON = "2034-03-06";
const Z1_BIS = "2034-04-16";
/** Zyklus 2: die üblichen vier Wochen, lückenlos anschließend. */
const Z2_VON = "2034-04-17";
const Z2_BIS = "2034-05-14";

/** Drei Läufe: A und B im Zyklus 1, C im Zyklus 2. */
const LAUF_A = "2034-03-06";
const LAUF_B = "2034-04-10";
const LAUF_C = "2034-04-17";
const ALLE_LAEUFE = [LAUF_A, LAUF_B, LAUF_C];

/** Damit Lauf B überhaupt eine Position bekommt: Dieses Abo beginnt erst dazwischen. */
const BEGINN_DAZWISCHEN = "2034-04-01";

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test.use({ locale: "de-DE" });
test.describe.configure({ mode: "serial" });

let kursId = "";
const kunden: Record<string, string> = {};
const abos: Record<string, string> = {};

async function legeKundenAn(rolle: string, name: string, anker: string) {
  const mail = `${KENNUNG.toLowerCase()}-${rolle}@viennasalsastudio.test`;
  const { data: konto, error: kontoFehler } = await svc.auth.admin.createUser({
    email: mail,
    password: "CorrectPassword123!",
    email_confirm: true,
  });
  if (kontoFehler || !konto.user) throw new Error(`PROJ-107 Konto ${rolle}: ${kontoFehler?.message}`);
  kunden[rolle] = konto.user.id;

  await svc.from("profiles").update({ full_name: name }).eq("id", konto.user.id);

  const { error: mandatFehler } = await svc.from("sepa_mandates").insert({
    customer_id: konto.user.id,
    iban: "AT611904300234573201",
    account_holder_name: name,
    mandate_reference: `${KENNUNG}-${rolle}`.slice(0, 35),
  });
  if (mandatFehler) throw new Error(`PROJ-107 Mandat ${rolle}: ${mandatFehler.message}`);

  const { data: abo, error: aboFehler } = await svc
    .from("subscriptions")
    .insert({
      customer_id: konto.user.id,
      course_id: kursId,
      status: "active",
      name: `${KENNUNG} ${rolle}`,
      price: 55,
      cycle_anchor_date: anker,
    })
    .select("id")
    .single();
  if (aboFehler) throw new Error(`PROJ-107 Abo ${rolle}: ${aboFehler.message}`);
  abos[rolle] = abo!.id;
}

async function loescheLaeufe() {
  const { data: laeufe } = await svc
    .from("sepa_collection_runs")
    .select("id")
    .in("due_date", ALLE_LAEUFE);
  for (const lauf of laeufe ?? []) {
    const { error: posFehler } = await svc.from("sepa_collection_items").delete().eq("run_id", lauf.id);
    if (posFehler) throw new Error(`PROJ-107 Positionen löschen: ${posFehler.message}`);
    const { error: laufFehler } = await svc.from("sepa_collection_runs").delete().eq("id", lauf.id);
    if (laufFehler) throw new Error(`PROJ-107 Lauf löschen: ${laufFehler.message}`);
  }
  const { count } = await svc
    .from("sepa_collection_runs")
    .select("id", { count: "exact", head: true })
    .in("due_date", ALLE_LAEUFE);
  if (count) throw new Error(`PROJ-107: ${count} Lauf/Läufe blieben stehen`);
}

async function loescheZyklen() {
  // Erst die Läufe, dann die Zyklen: Ein Zyklus mit Lauf ist unveränderlich,
  // und das gilt auch für das Löschen.
  const { error } = await svc.from("billing_cycles").delete().in("starts_on", [Z1_VON, Z2_VON]);
  if (error) throw new Error(`PROJ-107 Zyklen löschen: ${error.message}`);
}

test.beforeAll(async () => {
  await loescheLaeufe();
  await loescheZyklen();

  const { data: raum } = await svc.from("rooms").select("id").limit(1).single();
  const { data: kurs, error: kursFehler } = await svc
    .from("courses")
    .insert({ name: `${KENNUNG} Kurs`, room_id: raum!.id, price: 55 })
    .select("id")
    .single();
  if (kursFehler) throw new Error(`PROJ-107 Kurs: ${kursFehler.message}`);
  kursId = kurs!.id;

  await legeKundenAn("haupt", `${KENNUNG} Haupt`, "2034-01-02");
  await legeKundenAn("spaeter", `${KENNUNG} Spaeter`, BEGINN_DAZWISCHEN);
});

test.afterAll(async () => {
  await loescheLaeufe();
  await loescheZyklen();
  for (const rolle of Object.keys(kunden)) {
    if (abos[rolle]) await svc.from("subscriptions").delete().eq("id", abos[rolle]);
    await svc.from("sepa_mandates").delete().eq("customer_id", kunden[rolle]);
    await svc.auth.admin.deleteUser(kunden[rolle]).catch(() => {});
  }
  if (kursId) await svc.from("courses").delete().eq("id", kursId);
});

async function anmelden(page: Page) {
  // Wie in PROJ-103: Gegen einen frisch gestarteten Entwicklungsserver kann
  // /login mit 404 antworten, solange die Sprachweiche nicht übersetzt ist.
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

async function zyklusAnlegen(page: Page, von: string, bis: string) {
  await page.locator("#zyklus-von").fill(von);
  await page.locator("#zyklus-bis").fill(bis);
  await page.getByRole("button", { name: "Zyklus anlegen" }).click();
}

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

test.describe("PROJ-107: Zahlungszyklen verwalten", () => {
  test("ist über die Navigation erreichbar", async ({ page }) => {
    test.slow();
    await anmelden(page);
    await gehZu(page, "/admin");
    await page.getByRole("link", { name: "Zahlungszyklen" }).click();
    await page.waitForURL(/\/admin\/zyklen/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Zahlungszyklen" })).toBeVisible();
  });

  test("legt die Vorschlagsrechnung offen", async ({ page }) => {
    await anmelden(page);
    await gehZu(page, "/admin/zyklen");
    await expect(page.getByTestId("zyklus-rechnung")).toContainText("vier Kurswochen wären der");
  });

  test("lässt das Ende dem Beginn folgen", async ({ page }) => {
    // Gemeldet am 2026-11-17: Vorgeschlagen war „heute bis in vier Wochen",
    // weil noch kein Zyklus eingetragen war. Wer den Beginn überschrieb,
    // behielt das alte Ende — bei einem Abrechnungszeitraum eine Falle.
    await anmelden(page);
    await gehZu(page, "/admin/zyklen");
    await page.locator("#zyklus-von").fill("2034-07-03");
    // Vier Kurswochen: 28 Tage einschließlich des ersten.
    await expect(page.locator("#zyklus-bis")).toHaveValue("2034-07-30");
    await expect(page.getByTestId("zyklus-rechnung")).toContainText("30.07.2034");
  });

  test("sagt es, wenn das Ende vom Vorschlag abweicht", async ({ page }) => {
    await anmelden(page);
    await gehZu(page, "/admin/zyklen");
    await page.locator("#zyklus-von").fill("2034-07-03");
    await page.locator("#zyklus-bis").fill("2034-08-13");
    await expect(page.getByTestId("zyklus-rechnung")).toContainText("Dein Ende weicht davon ab");
  });

  test("legt einen Zyklus an und zeigt ihn mit Dauer und Zustand", async ({ page }) => {
    test.slow();
    await anmelden(page);
    await gehZu(page, "/admin/zyklen");
    await zyklusAnlegen(page, Z1_VON, Z1_BIS);

    const zeile = page.getByTestId("zyklen-liste").locator("tr", { hasText: "06.03.2034" });
    await expect(zeile).toBeVisible({ timeout: 20_000 });
    await expect(zeile).toContainText("16.04.2034");
    // 42 Tage: vier Kurswochen plus zwei Wochen Pause.
    await expect(zeile).toContainText("42");
    await expect(zeile).toContainText("künftig");
  });

  test("weist einen überschneidenden Zyklus mit Begründung ab", async ({ page }) => {
    test.slow();
    await anmelden(page);
    await gehZu(page, "/admin/zyklen");
    await zyklusAnlegen(page, "2034-04-10", "2034-05-07");
    await expect(page.getByText("überschneidet einen bestehenden Zyklus")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("benennt eine Lücke, bevor sie entsteht", async ({ page }) => {
    await anmelden(page);
    await gehZu(page, "/admin/zyklen");
    // Drei Tage nach dem letzten Ende: erlaubt, aber nicht stillschweigend.
    await page.locator("#zyklus-von").fill("2034-04-20");
    await expect(page.getByTestId("zyklus-luecke-warnung")).toContainText("3 Tage");
  });

  test("legt den Folgezyklus lückenlos an", async ({ page }) => {
    test.slow();
    await anmelden(page);
    await gehZu(page, "/admin/zyklen");
    await expect(page.locator("#zyklus-von")).toHaveValue(Z2_VON);
    await zyklusAnlegen(page, Z2_VON, Z2_BIS);
    await expect(page.getByTestId("zyklen-liste").locator("tr", { hasText: "17.04.2034" })).toBeVisible(
      { timeout: 20_000 }
    );
    await expect(page.getByTestId("zyklus-luecke-warnung")).toHaveCount(0);
  });

  test("nimmt das Abo in den ersten Lauf des Zyklus auf", async ({ page }) => {
    test.slow();
    await anmelden(page);
    expect(await legeLaufAn(page, LAUF_A)).toBe(true);
    expect(await positionenZu(LAUF_A, "haupt")).toBe(1);

    // Der Lauf hängt am Zyklus, nicht nur am Datum. Getrennt abgefragt und
    // nicht als Verknüpfung: `types.ts` ist für diese Spalte von Hand ergänzt
    // (der MCP-Zugang zum Neugenerieren fehlt), und eine selbstgeschriebene
    // Typform ist kein Fundament für eine Prüfung.
    const { data: lauf } = await svc
      .from("sepa_collection_runs")
      .select("cycle_id")
      .eq("due_date", LAUF_A)
      .single();
    expect(lauf?.cycle_id).toBeTruthy();

    const { data: zyklus } = await svc
      .from("billing_cycles")
      .select("starts_on")
      .eq("id", lauf!.cycle_id!)
      .single();
    expect(zyklus?.starts_on).toBe(Z1_VON);
  });

  test("sperrt den zweiten Lauf im selben Zyklus — auch nach 35 Tagen", async ({ page }) => {
    test.slow();
    await anmelden(page);
    // Die alte Vier-Wochen-Regel hätte hier freigegeben: 35 Tage Abstand.
    expect(await legeLaufAn(page, LAUF_B)).toBe(true);
    expect(await positionenZu(LAUF_B, "haupt")).toBe(0);
    // Dass überhaupt ein Lauf entstand, liegt am zweiten Abo.
    expect(await positionenZu(LAUF_B, "spaeter")).toBe(1);

    await expect(
      page.getByTestId("ausgelassene-abos").locator("li").filter({ hasText: `${KENNUNG} Haupt` })
    ).toContainText("In diesem Zyklus schon eingezogen am 06.03.2034");
  });

  test("nimmt das Abo im nächsten Zyklus wieder auf — nach nur 7 Tagen", async ({ page }) => {
    test.slow();
    await anmelden(page);
    // Das ist der Umstieg: Die alte Regel hätte gesperrt (28 Tage nicht um),
    // die neue sieht einen neuen Zyklus.
    expect(await legeLaufAn(page, LAUF_C)).toBe(true);
    expect(await positionenZu(LAUF_C, "haupt")).toBe(1);
  });

  test("bietet für einen abgerechneten Zyklus kein Ändern an", async ({ page }) => {
    await anmelden(page);
    await gehZu(page, "/admin/zyklen");
    const zeile = page.getByTestId("zyklen-liste").locator("tr", { hasText: "06.03.2034" });
    await expect(zeile).toContainText("abgerechnet");
    await expect(zeile.getByRole("button", { name: "Ändern" })).toHaveCount(0);
  });
});
