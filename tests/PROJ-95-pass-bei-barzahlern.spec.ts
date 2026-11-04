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
 * PROJ-95: Der Pass als Auswahl bei den Barzahlern.
 *
 * Das ist der Teil, den nur der Browser belegen kann: dass die Lehrkraft den
 * Pass dort **angeboten** bekommt, wo es ihn gibt, und dort nicht, wo es ihn
 * nicht gibt. Dass die Datenbank einen unzulässigen Pass auch dann abweist,
 * wenn jemand das Formular umgeht, steht in
 * `src/lib/actions/teacher/barzahler-anlegen.test.ts`; wo ein Pass auf welcher
 * Liste erscheint, in `PROJ-95-pass-bei-barzahlern-db.test.ts`.
 *
 * Braucht die Migration 20261028100000_proj95_pass_bei_barzahlern.sql.
 */
const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const LEHRER = { email: "e2e13-lehrer-a@viennasalsastudio.test", password: "CorrectPassword123!" };

const stempel = Date.now();
const STILNAME = `E2E95 Bachata ${stempel}`;
const GAST = `E2E95 Paula Pass ${stempel}`;

let stilMitPass = "";
let stilOhnePass = "";
let kursMitPass = "";
let kursOhnePass = "";

function wienerDatum(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(new Date());
}

function wienerWochentag(): number {
  const tag = new Date(`${wienerDatum()}T12:00:00Z`).getUTCDay();
  return (tag + 6) % 7;
}

function barzahlerKarte(page: Page) {
  return page.getByRole("region", { name: "Barzahler" });
}

async function kursAnlegen(name: string, stilId: string): Promise<string> {
  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data, error } = await service
    .from("courses")
    .insert({ name, room_id: raum!.id, price: 65, dance_style_id: stilId })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-95 Kurs ${name}: ${error.message}`);
  // Ein Termin heute, damit die Kursseite eine Anwesenheitsliste hat.
  await service.from("course_schedule").insert({
    course_id: data!.id,
    weekday: wienerWochentag(),
    start_time: "08:00:00",
    end_time: "09:00:00",
  });
  const { data: lehrer } = await service
    .from("profiles")
    .select("id")
    .eq("full_name", "E2E13 Lehrer A")
    .single();
  await service.from("course_teachers").insert({ course_id: data!.id, teacher_id: lehrer!.id });
  return data!.id;
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

/** Das Gast-Formular aufklappen und die Auswahl „Abo" öffnen. */
async function abowahlOeffnen(page: Page, kursId: string) {
  await gehZu(page, `/lehrer/${kursId}`);
  const karte = barzahlerKarte(page);
  await expect(karte).toBeVisible({ timeout: 30000 });
  await karte.getByRole("button", { name: /Gast ohne Konto eintragen/ }).click();
  const wahl = karte.getByRole("combobox", { name: "Abo-Art auswählen" });
  await expect(wahl).toBeVisible();
  await wahl.click();
  return karte;
}

test.beforeAll(async () => {
  for (const [name, preis] of [
    [STILNAME, 45],
    [`E2E95 Salsa ${stempel}`, null],
  ] as const) {
    const { data, error } = await service
      .from("dance_styles")
      .insert({ name, pass_price: preis })
      .select("id")
      .single();
    if (error) throw new Error(`PROJ-95 Stil ${name}: ${error.message}`);
    if (preis !== null) stilMitPass = data!.id;
    else stilOhnePass = data!.id;
  }

  kursMitPass = await kursAnlegen(`E2E95 Bachata Kurs ${stempel}`, stilMitPass);
  kursOhnePass = await kursAnlegen(`E2E95 Salsa Kurs ${stempel}`, stilOhnePass);
});

test.afterAll(async () => {
  // Der angelegte Gast hängt an einem Abo und einem Kursplatz. Erst das
  // Abhängige, dann der Kurs — sonst scheitert das Löschen am Fremdschlüssel,
  // und zwar stumm (siehe docs/troubleshooting-tests.md).
  const { data: gast } = await service
    .from("profiles")
    .select("id")
    .eq("full_name", GAST)
    .maybeSingle();
  if (gast) {
    const { data: gastAbos } = await service
      .from("subscriptions")
      .select("id")
      .eq("customer_id", gast.id);
    const ids = (gastAbos ?? []).map((a) => a.id);
    if (ids.length > 0) {
      await service.from("cash_payments").delete().in("subscription_id", ids);
      await service.from("cash_entries").delete().in("subscription_id", ids);
      await service.from("course_memberships").delete().in("subscription_id", ids);
      await service.from("subscriptions").delete().in("id", ids);
    }
    await service.auth.admin.deleteUser(gast.id).catch(() => {});
  }

  for (const kurs of [kursMitPass, kursOhnePass].filter(Boolean)) {
    await service.from("course_teachers").delete().eq("course_id", kurs);
    await service.from("course_schedule").delete().eq("course_id", kurs);
    await service.from("courses").delete().eq("id", kurs);
  }
  for (const stil of [stilMitPass, stilOhnePass].filter(Boolean)) {
    await service.from("dance_styles").delete().eq("id", stil);
  }
});

test.describe("PROJ-95: Der Pass steht nur bei seiner Stilrichtung zur Wahl", () => {
  test("Bei einem Kurs mit Pass steht er in der Auswahl, benannt nach der Stilrichtung", async ({
    page,
  }) => {
    await anmelden(page);
    await abowahlOeffnen(page, kursMitPass);
    await expect(page.getByRole("option", { name: `${STILNAME} Pass` })).toBeVisible();
    // Die beiden alten Möglichkeiten bleiben, wo sie waren.
    await expect(page.getByRole("option", { name: "Nur dieser Kurs" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Flatrate" })).toBeVisible();
  });

  test("Bei einem Kurs ohne Passpreis fehlt der Eintrag ganz", async ({ page }) => {
    // Nicht ausgegraut, sondern nicht vorhanden: Ein Angebot, das es nicht
    // gibt, soll an der Tür auch nicht zu sehen sein.
    await anmelden(page);
    await abowahlOeffnen(page, kursOhnePass);
    await expect(page.getByRole("option", { name: "Flatrate" })).toBeVisible();
    await expect(page.getByRole("option", { name: /Pass$/ })).toHaveCount(0);
  });

  test("Ein Pass-Gast entsteht und steht mit seiner Stilrichtung auf der Liste", async ({
    page,
  }) => {
    await anmelden(page);
    const karte = await abowahlOeffnen(page, kursMitPass);
    await page.getByRole("option", { name: `${STILNAME} Pass` }).click();

    // Der Betrag bleibt Handarbeit — Entscheidung vom 2026-10-28. Geprüft wird
    // das hier mit: Stünde schon etwas im Feld, wäre dieser Griff überflüssig.
    await expect(page.locator("#barzahler-betrag")).toHaveValue("");
    await karte.getByLabel("Name").fill(GAST);
    await page.locator("#barzahler-betrag").fill("45");
    await karte.getByRole("button", { name: "Gast anlegen" }).click();

    // Die Seite lädt sich neu — danach steht er auf der Liste, mit dem
    // Abzeichen seiner Stilrichtung und nicht mit „Flatrate".
    const zeile = barzahlerKarte(page).getByRole("row", { name: new RegExp(GAST) });
    await expect(zeile).toBeVisible({ timeout: 30000 });
    await expect(zeile).toContainText(`${STILNAME} Pass`);
    await expect(zeile).not.toContainText("Flatrate");

    // Und das Abo trägt wirklich die Stilgrenze, nicht nur die Beschriftung.
    const { data: gast } = await service
      .from("profiles")
      .select("id")
      .eq("full_name", GAST)
      .single();
    const { data: abo } = await service
      .from("subscriptions")
      .select("course_id, dance_style_id, price")
      .eq("customer_id", gast!.id)
      .single();
    expect(abo!.course_id).toBeNull();
    expect(abo!.dance_style_id).toBe(stilMitPass);
    expect(Number(abo!.price)).toBe(45);
  });
});
