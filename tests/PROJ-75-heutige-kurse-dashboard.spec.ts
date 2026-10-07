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

const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const KUNDE = "proj75-teilnehmer@viennasalsastudio.test";

const stempel = Date.now();
const NAMEN = {
  heute: `E2E75 Heutekurs ${stempel}`,
  laufend: `E2E75 Laufender Kurs ${stempel}`,
  anderertag: `E2E75 Anderer Tag ${stempel}`,
  pausiert: `E2E75 Pausiert ${stempel}`,
};

const ids: Record<keyof typeof NAMEN, string> = { heute: "", laufend: "", anderertag: "", pausiert: "" };
let kundeId = "";
let aboId = "";

function wienerDatum(versatzTage = 0): string {
  const ziel = new Date(Date.now() + versatzTage * 24 * 3_600_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(ziel);
}

/** 0 = Montag … 6 = Sonntag, wie im Projekt. */
function wienerWochentag(versatzTage = 0): number {
  const tag = new Date(`${wienerDatum(versatzTage)}T12:00:00Z`).getUTCDay();
  return (tag + 6) % 7;
}

/** Wiener Wanduhrzeit mit Versatz in Minuten, als „HH:MM:SS". */
function wienerZeit(versatzMinuten: number): string {
  const ziel = new Date(Date.now() + versatzMinuten * 60_000);
  return new Intl.DateTimeFormat("de-AT", {
    timeZone: "Europe/Vienna",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(ziel);
}

const HEUTE = wienerDatum(0);

async function kursAnlegen(
  schluessel: keyof typeof NAMEN,
  plan: { weekday: number; start: string; ende: string; pausiertHeute?: boolean }
): Promise<string> {
  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data: kurs, error } = await service
    .from("courses")
    .insert({ name: NAMEN[schluessel], room_id: raum!.id, price: 50 })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-75 Kurs ${schluessel}: ${error.message}`);

  const { data: zeile, error: planFehler } = await service
    .from("course_schedule")
    .insert({
      course_id: kurs!.id,
      weekday: plan.weekday,
      start_time: plan.start,
      end_time: plan.ende,
    })
    .select("id")
    .single();
  if (planFehler) throw new Error(`PROJ-75 Stundenplan ${schluessel}: ${planFehler.message}`);

  if (plan.pausiertHeute) {
    const { error: pauseFehler } = await service
      .from("course_schedule_pauses")
      .insert({ schedule_id: zeile!.id, pause_date: HEUTE });
    if (pauseFehler) throw new Error(`PROJ-75 Pause: ${pauseFehler.message}`);
  }

  ids[schluessel] = kurs!.id;
  return kurs!.id;
}

async function login(page: Page) {
  await gehZu(page, "/login");
  // Erst hydrieren lassen — siehe docs/troubleshooting-tests.md.
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(ADMIN.email);
  await page.getByLabel("Passwort").fill(ADMIN.password);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await zweiteStufeErledigen(page, ADMIN.email);
  await page.waitForURL(/\/admin$/, { timeout: 20000 });
  // Auf den Abschnitt warten, nicht auf eine Frist: Beim ersten Aufruf nach einer
  // Änderung kompiliert der Entwicklungsserver noch, und fünf Sekunden reichen
  // dann nicht. Genau daran ist dieser Test einmal vollständig gescheitert,
  // obwohl die Seite in Ordnung war.
  await expect(page.getByRole("region", { name: "Heute" })).toBeVisible({ timeout: 30000 });
}

function abschnitt(page: Page) {
  // Der benannte Bereich, nicht irgendein div um die Überschrift: `div`-Filter
  // plus `.last()` traf den Kartenkopf — der enthält die Überschrift, aber nicht
  // die Liste darunter.
  return page.getByRole("region", { name: "Heute" });
}

test.beforeAll(async () => {
  test.setTimeout(180000);

  // Ein Kunde mit Kursplatz, damit der Stand etwas zu zählen hat.
  const { data: alle } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = alle?.users.find((u) => u.email === KUNDE);
  if (alt) await service.auth.admin.deleteUser(alt.id);
  const { data: neu, error: kontoFehler } = await service.auth.admin.createUser({
    email: KUNDE,
    password: "CorrectPassword123!",
    email_confirm: true,
  });
  if (kontoFehler || !neu.user) throw new Error(`PROJ-75 Konto: ${kontoFehler?.message}`);
  kundeId = neu.user.id;
  await service.from("profiles").update({ full_name: "E2E75 Teilnehmer" }).eq("id", kundeId);

  await kursAnlegen("heute", { weekday: wienerWochentag(0), start: "08:00:00", ende: "09:00:00" });
  await kursAnlegen("laufend", {
    weekday: wienerWochentag(0),
    start: wienerZeit(-30),
    ende: wienerZeit(30),
  });
  await kursAnlegen("anderertag", { weekday: wienerWochentag(1), start: "18:00:00", ende: "19:00:00" });
  await kursAnlegen("pausiert", {
    weekday: wienerWochentag(0),
    start: "10:00:00",
    ende: "11:00:00",
    pausiertHeute: true,
  });

  // Der Platz gilt seit gestern, damit er heute zählt (PROJ-69).
  const { data: abo, error: aboFehler } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: ids.heute,
      status: "active",
      name: "E2E75",
      price: 50,
      cycle_anchor_date: wienerDatum(-1),
    })
    .select("id")
    .single();
  if (aboFehler) throw new Error(`PROJ-75 Abo: ${aboFehler.message}`);
  aboId = abo!.id;
});

test.afterAll(async () => {
  for (const id of Object.values(ids)) {
    if (!id) continue;
    await service.from("course_attendance").delete().eq("course_id", id);
    await service.from("course_schedule").delete().eq("course_id", id);
  }
  if (aboId) await service.from("subscriptions").delete().eq("id", aboId);
  for (const id of Object.values(ids)) {
    if (id) await service.from("courses").delete().eq("id", id);
  }
  if (kundeId) await service.auth.admin.deleteUser(kundeId).catch(() => {});
});

test.describe("PROJ-75: Heutige Kurse im Admin-Dashboard", () => {
  test("Der Abschnitt zeigt den heutigen Kurs mit Uhrzeit, Ort und Stand", async ({ page }) => {
    await login(page);

    const zeile = abschnitt(page).getByRole("link", { name: new RegExp(NAMEN.heute) });
    await expect(zeile).toBeVisible();
    await expect(zeile).toContainText("08:00");
    // Ein Platz, aber noch kein Häkchen: Das muss als „noch nicht erfasst"
    // dastehen und nicht als „0 anwesend" — die beiden bedeuten Verschiedenes.
    await expect(zeile).toContainText("Noch nicht erfasst");
  });

  test("Ein Klick führt direkt in die Anwesenheitsliste des Kurses", async ({ page }) => {
    await login(page);

    await abschnitt(page).getByRole("link", { name: new RegExp(NAMEN.heute) }).click();
    await page.waitForURL(new RegExp(`/lehrer/${ids.heute}`), { timeout: 20000 });
    await page.waitForTimeout(1500);

    // Nicht nur die Adresse: Die Liste selbst muss da sein.
    await expect(page.getByRole("heading", { name: NAMEN.heute })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Kursteilnehmer" })).toBeVisible();
    await expect(page.getByText("E2E75 Teilnehmer")).toBeVisible();
  });

  test("Der laufende Kurs ist als laufend gekennzeichnet", async ({ page }) => {
    await login(page);

    const zeile = abschnitt(page).getByRole("link", { name: new RegExp(NAMEN.laufend) });
    await expect(zeile).toBeVisible();
    await expect(zeile).toContainText("läuft jetzt");

    // Und der Kurs um 08:00 ist es nicht — sonst sagte das Kennzeichen nichts.
    const frueh = abschnitt(page).getByRole("link", { name: new RegExp(NAMEN.heute) });
    await expect(frueh).not.toContainText("läuft jetzt");
  });

  test("Ein Kurs ohne erwartete Teilnehmer sagt das, statt null zu zählen", async ({ page }) => {
    await login(page);

    const zeile = abschnitt(page).getByRole("link", { name: new RegExp(NAMEN.laufend) });
    await expect(zeile).toContainText("Niemand erwartet");
  });

  test("Kurse an anderen Tagen und ausgefallene Termine stehen nicht da", async ({ page }) => {
    await login(page);

    // Zuerst: Der Abschnitt ist überhaupt da. Sonst wären die beiden Prüfungen
    // darunter auch dann grün, wenn er gar nicht erscheint.
    await expect(abschnitt(page).getByRole("link", { name: new RegExp(NAMEN.heute) })).toBeVisible();

    await expect(abschnitt(page).getByText(new RegExp(NAMEN.anderertag))).toHaveCount(0);
    // Der Betreiber soll nicht auf eine Stunde klicken, die nicht stattfindet.
    await expect(abschnitt(page).getByText(new RegExp(NAMEN.pausiert))).toHaveCount(0);
  });
});
