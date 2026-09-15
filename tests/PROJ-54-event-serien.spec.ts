import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { gehZu } from "./navigation";
import { ladeTestUmgebung } from "./env";
import { viennaWallClockToDate } from "../src/lib/scheduling/dates";
import { heuteInWien } from "../src/lib/constants/zeitzone";

try {
  ladeTestUmgebung();
} catch {
  // Schon geladen (z. B. CI-Variablen direkt gesetzt) — unkritisch.
}

/**
 * PROJ-54: Event-Serien — Programm, Serienseite, Verwaltung.
 *
 * Die Testdaten tragen „E2E54" im Namen und entstehen vor jedem Lauf neu.
 * Alle Termine stehen relativ zu heute: Feste Daten rutschten unbemerkt in die
 * Vergangenheit und ließen die Suite eines Tages ohne Änderung scheitern.
 *
 * Kein Test verlässt sich darauf, dass es sonst keine Serien oder Events gibt —
 * die Testdatenbank teilen sich alle Suiten.
 */

const CUSTOMER = { email: "e2e14-customer-nomandate@viennasalsastudio.test", password: "CorrectPassword123!" };
const ADMIN = { email: "e2e14-admin@viennasalsastudio.test", password: "CorrectPassword123!" };

/** Kalendertag plus `tage`, rein als Datum gerechnet. */
function plusTage(datum: string, tage: number): string {
  return new Date(Date.parse(`${datum}T00:00:00Z`) + tage * 86_400_000).toISOString().slice(0, 10);
}

/** 0 = Montag … 6 = Sonntag, wie überall im Projekt. */
function wochentag(datum: string): number {
  return (new Date(`${datum}T12:00:00Z`).getUTCDay() + 6) % 7;
}

function wienerName(datum: string): string {
  return new Date(`${datum}T12:00:00Z`).toLocaleDateString("de-AT", { weekday: "long", timeZone: "Europe/Vienna" });
}

/**
 * Ein Zeitpunkt, wie er in der App steht — ohne den Wochentag davor.
 *
 * Den Wochentag schreibt jede Browser-Engine anders: Chromium setzt ein Komma
 * dahinter („Mi., 16.09."), WebKit nicht. Die Angabe, auf die es ankommt, ist
 * ohnehin Datum und Uhrzeit; gesucht wird als Teilzeichenkette.
 */
function alsZeitpunkt(iso: string): string {
  return new Date(iso).toLocaleString("de-AT", {
    timeZone: "Europe/Vienna",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Wie die Karte den nächsten Termin schreibt — ohne Wochentag, siehe alsZeitpunkt. */
function alsKurzdatum(datum: string): string {
  return new Date(`${datum}T12:00:00Z`).toLocaleDateString("de-AT", {
    timeZone: "Europe/Vienna",
    day: "2-digit",
    month: "2-digit",
  });
}

function alsDatum(datum: string): string {
  return new Date(`${datum}T12:00:00Z`).toLocaleDateString("de-AT", {
    timeZone: "Europe/Vienna",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const heute = heuteInWien();
// Vier Termine im Vorschaufenster, beginnend morgen. Der erste bestimmt den
// Wochentag der Serie — so nennt die Karte denselben Tag, den die Terminliste
// zeigt.
const tage = [1, 8, 15, 22].map((versatz) => plusTage(heute, versatz));
const TAG = wochentag(tage[0]);

const PARTY_SLUG = "e2e54-freitagsparty";
const PRAXIS_SLUG = "e2e54-praxis";
const FERIEN_SLUG = "e2e54-ferienserie";

const arten: Record<string, string> = {};
const serien: Record<string, string> = {};
const termine: Record<string, string> = {};
let ferienId: string | null = null;
let service: SupabaseClient;

function beginn(datum: string, zeit: string): string {
  return viennaWallClockToDate(datum, zeit).toISOString();
}

async function eventart(name: string): Promise<string> {
  const { data } = await service.from("event_types").select("id").eq("name", name).maybeSingle();
  if (data) return data.id;
  const { data: neu, error } = await service.from("event_types").insert({ name }).select("id").single();
  if (error) throw new Error(`PROJ-54 Eventart „${name}“: ${error.message}`);
  return neu.id;
}

async function serieAnlegen(felder: Record<string, unknown>): Promise<string> {
  const { data, error } = await service.from("event_series").insert(felder).select("id").single();
  if (error) throw new Error(`PROJ-54 Serie: ${error.message}`);
  return data.id;
}

async function terminAnlegen(felder: Record<string, unknown>): Promise<string> {
  const { data, error } = await service.from("events").insert(felder).select("id").single();
  if (error) throw new Error(`PROJ-54 Termin: ${error.message}`);
  return data.id;
}

test.beforeAll(async () => {
  service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Aufräumen: Termine hängen mit „on delete cascade" an den Events, Tickets
  // an den Terminen. Gekauft wird hier nur „vor Ort" — ohne SEPA-Posten, die
  // das Löschen sperrten.
  const { error: loeschFehler } = await service.from("events").delete().like("name", "E2E54%");
  if (loeschFehler) throw new Error(`PROJ-54 Aufräumen fehlgeschlagen: ${loeschFehler.message}`);
  await service.from("event_series").delete().like("name", "E2E54%");
  await service.from("studio_holidays").delete().like("name", "E2E54%");

  arten.party = await eventart("E2E54 Party");
  arten.praxis = await eventart("E2E54 Praxis");

  serien.party = await serieAnlegen({
    name: "E2E54 Freitagsparty",
    slug: PARTY_SLUG,
    event_type_id: arten.party,
    sales_mode: "tickets",
    weekday: TAG,
    start_time: "21:00",
    end_time: "02:00",
    starts_on: tage[0],
    pause_in_holidays: false,
    location: "Studio Saal 1",
    description: "Jede Woche dieselbe gute Laune.",
    capacity: 20,
    price_normal: 12,
    price_student: 9,
    status: "aktiv",
  });

  const geerbt = {
    name: "E2E54 Freitagsparty",
    event_type_id: arten.party,
    sales_mode: "tickets",
    location: "Studio Saal 1",
    series_id: serien.party,
    status: "geplant",
    price_normal: 12,
    price_student: 9,
  };

  termine.eins = await terminAnlegen({
    ...geerbt,
    slug: `${PARTY_SLUG}-${tage[0]}`,
    occurrence_date: tage[0],
    starts_at: beginn(tage[0], "21:00"),
    ends_at: beginn(plusTage(tage[0], 1), "02:00"),
    capacity: 20,
  });

  // Ein ausgebuchter Abend — nur dieser, die anderen bleiben kaufbar.
  termine.voll = await terminAnlegen({
    ...geerbt,
    slug: `${PARTY_SLUG}-${tage[1]}`,
    occurrence_date: tage[1],
    starts_at: beginn(tage[1], "21:00"),
    ends_at: beginn(plusTage(tage[1], 1), "02:00"),
    capacity: 1,
  });
  const { data: kundenListe } = await service.auth.admin.listUsers({ perPage: 300 });
  const fremder = kundenListe.users.find((u) => u.email === ADMIN.email);
  if (!fremder) throw new Error("PROJ-54: Admin-Konto fehlt in der Testdatenbank");
  const { error: ticketFehler } = await service
    .from("tickets")
    .insert({ event_id: termine.voll, customer_id: fremder.id, payment_method: "onsite", price: 12, status: "reserved" });
  if (ticketFehler) throw new Error(`PROJ-54 Ticket: ${ticketFehler.message}`);

  termine.abgesagt = await terminAnlegen({
    ...geerbt,
    slug: `${PARTY_SLUG}-${tage[2]}`,
    occurrence_date: tage[2],
    starts_at: beginn(tage[2], "21:00"),
    ends_at: beginn(plusTage(tage[2], 1), "02:00"),
    capacity: 20,
    status: "abgesagt",
  });

  termine.verlegt = await terminAnlegen({
    ...geerbt,
    slug: `${PARTY_SLUG}-${tage[3]}`,
    occurrence_date: tage[3],
    starts_at: beginn(tage[3], "22:30"),
    ends_at: beginn(plusTage(tage[3], 1), "02:00"),
    capacity: 20,
    overridden: true,
    moved_at: new Date().toISOString(),
  });

  // Eine Serie ohne Ticketverkauf, zugleich die zweite Eventart für den Filter.
  serien.praxis = await serieAnlegen({
    name: "E2E54 Praxis",
    slug: PRAXIS_SLUG,
    event_type_id: arten.praxis,
    sales_mode: "display",
    weekday: TAG,
    start_time: "19:00",
    end_time: null,
    starts_on: tage[0],
    pause_in_holidays: false,
    location: "Studio Saal 2",
    status: "aktiv",
  });
  await terminAnlegen({
    name: "E2E54 Praxis",
    slug: `${PRAXIS_SLUG}-${tage[0]}`,
    event_type_id: arten.praxis,
    sales_mode: "display",
    location: "Studio Saal 2",
    series_id: serien.praxis,
    occurrence_date: tage[0],
    starts_at: beginn(tage[0], "19:00"),
    ends_at: null,
    capacity: null,
    price_normal: null,
    price_student: null,
    status: "geplant",
  });

  // Eine pausierende Serie samt Ferien, die ihren nächsten Termin trifft.
  serien.ferien = await serieAnlegen({
    name: "E2E54 Ferienserie",
    slug: FERIEN_SLUG,
    event_type_id: arten.party,
    sales_mode: "tickets",
    weekday: TAG,
    start_time: "20:00",
    end_time: null,
    starts_on: tage[0],
    pause_in_holidays: true,
    capacity: 20,
    price_normal: 10,
    price_student: 8,
    status: "aktiv",
  });
  // Dieser Termin war zuerst da; die Ferien kommen gleich danach. Genau der
  // Fall, in dem eine Serienänderung ihn nicht absagen darf (QA-Befund BUG-1).
  termine.inFerien = await terminAnlegen({
    name: "E2E54 Ferienserie",
    slug: `${FERIEN_SLUG}-${tage[0]}`,
    event_type_id: arten.party,
    sales_mode: "tickets",
    series_id: serien.ferien,
    occurrence_date: tage[0],
    starts_at: beginn(tage[0], "20:00"),
    ends_at: null,
    capacity: 20,
    price_normal: 10,
    price_student: 8,
    status: "geplant",
  });
  const { error: ferienTicketFehler } = await service
    .from("tickets")
    .insert({ event_id: termine.inFerien, customer_id: fremder.id, payment_method: "onsite", price: 10, status: "reserved" });
  if (ferienTicketFehler) throw new Error(`PROJ-54 Ferien-Ticket: ${ferienTicketFehler.message}`);
  const { data: ferien, error: ferienFehler } = await service
    .from("studio_holidays")
    .insert({ name: "E2E54 Testferien", starts_on: tage[0], ends_on: plusTage(tage[0], 3) })
    .select("id")
    .single();
  if (ferienFehler) throw new Error(`PROJ-54 Ferien: ${ferienFehler.message}`);
  ferienId = ferien.id;
});

test.afterAll(async () => {
  // Die Ferien zuerst: Sie gelten studioweit und dürfen keine Minute länger
  // stehen als nötig — sonst fehlten anderen Suiten ihre Kurstermine.
  if (ferienId) await service.from("studio_holidays").delete().eq("id", ferienId);
  await service.from("events").delete().like("name", "E2E54%");
  await service.from("event_series").delete().like("name", "E2E54%");
  await service.from("event_types").delete().like("name", "E2E54%");
});

async function login(page: Page, { email, password }: { email: string; password: string }) {
  // Siehe PROJ-14: erst hydrieren lassen, dann auf das Ziel der Weiterleitung warten.
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  await page.goto("/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
}

/** Die Karte, deren Titel-Link genau `name` heißt. */
function karte(page: Page, name: string) {
  return page.locator(".rounded-lg.border").filter({ has: page.getByRole("link", { name, exact: true }) });
}

/** Die Zeile der Terminliste, die diesen Zeitpunkt nennt. */
function terminZeile(page: Page, zeitpunkt: string) {
  return page.locator("li").filter({ hasText: zeitpunkt });
}

test.describe("PROJ-54: Event-Serien", () => {
  test("Übersicht: Serie unter „Regelmäßig“ mit Rhythmus, nächstem Termin und Ort", async ({ page }) => {
    await gehZu(page, "/events");
    await expect(page.getByRole("heading", { name: "Regelmäßig" })).toBeVisible();

    const partei = karte(page, "E2E54 Freitagsparty");
    await expect(partei.getByText(`Jeden ${wienerName(tage[0])}, 21:00–02:00`)).toBeVisible();
    await expect(partei.getByText("Studio Saal 1")).toBeVisible();
    // Die Eventart steht auf einer Karte ohne Titelbild zweimal: als Abzeichen
    // und auf der gestalteten Fläche darüber (PROJ-55, QA-Befund BUG-2).
    // Geprüft wird das Abzeichen — es steht als letztes im Text.
    await expect(partei.getByText("E2E54 Party", { exact: true }).last()).toBeVisible();
    await expect(partei.getByText(/Nächster Termin:/)).toBeVisible();

    // Dieselbe Party stünde sonst vier Mal untereinander unter „Besondere Events".
    const besondere = page.locator("section", { has: page.getByRole("heading", { name: "Besondere Events" }) });
    await expect(besondere.getByRole("link", { name: "E2E54 Freitagsparty", exact: true })).toHaveCount(0);
  });

  test("Übersicht: pausierende Serie zeigt die Ferienpause statt eines Termins", async ({ page }) => {
    await gehZu(page, "/events");
    const ferienserie = karte(page, "E2E54 Ferienserie");
    await expect(ferienserie.getByText(`Ferienpause bis ${alsDatum(plusTage(tage[0], 3))}`)).toBeVisible();
  });

  test("Übersicht: Der Filter nach Eventart gilt auch für Serien", async ({ page }) => {
    await gehZu(page, `/events?art=${arten.praxis}`);
    // Nur im Bereich „Regelmäßig" suchen: Die Filterleiste trägt dieselben Namen.
    const regelmaessig = page.locator("section", { has: page.getByRole("heading", { name: "Regelmäßig" }) });
    await expect(regelmaessig.getByRole("link", { name: "E2E54 Praxis", exact: true })).toBeVisible();
    await expect(regelmaessig.getByRole("link", { name: "E2E54 Freitagsparty", exact: true })).toHaveCount(0);
  });

  test("Serienseite: Terminliste mit freien Plätzen, „Ausgebucht“, „Fällt aus“ und „Geändert“", async ({ page }) => {
    await gehZu(page, `/events/${PARTY_SLUG}`);
    await expect(page.getByRole("heading", { level: 1, name: "E2E54 Freitagsparty" })).toBeVisible();
    await expect(page.getByText(`Jeden ${wienerName(tage[0])}, 21:00–02:00`)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nächste Termine" })).toBeVisible();

    await expect(terminZeile(page, alsZeitpunkt(beginn(tage[0], "21:00"))).getByText(/Plätze frei/)).toBeVisible();
    await expect(terminZeile(page, alsZeitpunkt(beginn(tage[1], "21:00"))).getByText("Ausgebucht")).toBeVisible();
    await expect(terminZeile(page, alsZeitpunkt(beginn(tage[2], "21:00"))).getByText("Fällt aus")).toBeVisible();
    await expect(terminZeile(page, alsZeitpunkt(beginn(tage[3], "22:30"))).getByText("Geändert")).toBeVisible();
  });

  test("Serienseite: „Nur anzeigen“ bietet keinen Ticketkauf an", async ({ page }) => {
    await gehZu(page, `/events/${PRAXIS_SLUG}`);
    await expect(page.getByRole("heading", { level: 1, name: "E2E54 Praxis" })).toBeVisible();
    await expect(page.getByText(alsZeitpunkt(beginn(tage[0], "19:00")))).toBeVisible();
    await expect(page.getByRole("button", { name: "Ticket kaufen" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Zum Ticket-Kauf einloggen" })).toHaveCount(0);
  });

  test("Englisch: Der Rhythmus steht auf Englisch", async ({ page }) => {
    await gehZu(page, `/en/events/${PARTY_SLUG}`);
    const englisch = new Date(`${tage[0]}T12:00:00Z`).toLocaleDateString("en-GB", {
      weekday: "long",
      timeZone: "Europe/Vienna",
    });
    await expect(page.getByText(`Every ${englisch}, 21:00–02:00`)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Upcoming dates" })).toBeVisible();
  });

  test("Kunde: Ticket für einen bestimmten Termin, „Meine Tickets“ nennt genau diesen", async ({ page }) => {
    await login(page, CUSTOMER);
    await gehZu(page, `/events/${PARTY_SLUG}`);
    await page.waitForTimeout(1500);

    const zeile = terminZeile(page, alsZeitpunkt(beginn(tage[0], "21:00")));
    await zeile.getByRole("button", { name: "Ticket kaufen" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("checkbox").last().check();
    await dialog.getByRole("button", { name: "Ticket kaufen" }).click();
    await expect(page.getByText(/Ticket reserviert/)).toBeVisible({ timeout: 15000 });

    await gehZu(page, "/profil");
    await page.getByRole("button", { name: /^Meine Tickets/ }).click();
    const ticket = page.locator("div.rounded-md.border").filter({ hasText: "E2E54 Freitagsparty" }).first();
    await expect(ticket.getByText(alsZeitpunkt(beginn(tage[0], "21:00")))).toBeVisible();
  });

  test("Admin: Serie anlegen — die Termine erscheinen ohne weiteres Zutun im Programm", async ({ page }) => {
    await login(page, ADMIN);
    await gehZu(page, "/admin/events");
    await page.getByRole("button", { name: "Serie anlegen" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("E2E54 Neue Serie");
    await dialog.getByLabel("Eventart").click();
    await page.getByRole("option", { name: "E2E54 Party" }).click();
    await dialog.getByLabel("Wochentag").click();
    await page.getByRole("option", { name: wienerName(tage[0]) }).click();
    await dialog.getByLabel("Beginn").fill("18:30");
    await dialog.getByLabel("Ende (optional)").fill("20:30");
    await dialog.getByLabel("Erster Termin ab").fill(tage[0]);
    await dialog.getByLabel("Ort (optional)").fill("Studio Saal 3");
    // Diese Suite hat Ferien eingetragen; ohne das Häkchen beginnt die Serie
    // wie gewünscht am ersten Termin.
    await dialog.getByLabel("In Studioferien pausieren").uncheck();
    await dialog.getByLabel("Nur anzeigen").check();
    await dialog.getByRole("button", { name: "Speichern" }).click();
    await expect(dialog).toBeHidden({ timeout: 15000 });

    await gehZu(page, "/events");
    await expect(karte(page, "E2E54 Neue Serie").getByText(`Jeden ${wienerName(tage[0])}, 18:30–20:30`)).toBeVisible();

    // Vier Wochen Vorlauf: der erste Termin und drei weitere.
    await gehZu(page, "/events/e2e54-neue-serie");
    await expect(page.getByText(alsZeitpunkt(beginn(tage[0], "18:30")))).toBeVisible();
    await expect(page.getByText(alsZeitpunkt(beginn(tage[3], "18:30")))).toBeVisible();
  });

  test("Admin: Termin absagen und die Absage zurücknehmen", async ({ page }) => {
    await login(page, ADMIN);
    await gehZu(page, "/admin/events");

    const reihe = page.getByRole("row").filter({ hasText: "E2E54 Freitagsparty" });
    await reihe.getByRole("button", { name: "Termine" }).click();
    const dialog = page.getByRole("dialog");
    const ersterTermin = dialog.locator("li").filter({ hasText: alsZeitpunkt(beginn(tage[0], "21:00")) });
    await ersterTermin.getByRole("button", { name: "Absagen" }).click();
    await expect(ersterTermin.getByText("Fällt aus")).toBeVisible({ timeout: 15000 });

    await gehZu(page, `/events/${PARTY_SLUG}`);
    await expect(terminZeile(page, alsZeitpunkt(beginn(tage[0], "21:00"))).getByText("Fällt aus")).toBeVisible();

    // Die Übersicht darf jetzt nicht mehr den abgesagten Abend als nächsten
    // nennen — sonst führe jemand hin (QA-Befund BUG-2).
    await gehZu(page, "/events");
    const kartentext = await karte(page, "E2E54 Freitagsparty").textContent();
    expect(kartentext).toContain(alsKurzdatum(tage[1]));
    // Das abgesagte Datum darf auf der Karte überhaupt nicht mehr vorkommen.
    expect(kartentext).not.toContain(alsKurzdatum(tage[0]));

    await gehZu(page, "/admin/events");
    await page.getByRole("row").filter({ hasText: "E2E54 Freitagsparty" }).getByRole("button", { name: "Termine" }).click();
    const wieder = page.getByRole("dialog").locator("li").filter({ hasText: alsZeitpunkt(beginn(tage[0], "21:00")) });
    await wieder.getByRole("button", { name: "Absage zurücknehmen" }).click();
    await expect(wieder.getByText("Fällt aus")).toHaveCount(0, { timeout: 15000 });
  });

  test("Admin: Termin verlegen — und nicht auf einen Tag, an dem die Serie schon einen hat", async ({ page }) => {
    await login(page, ADMIN);
    await gehZu(page, "/admin/events");
    await page.getByRole("row").filter({ hasText: "E2E54 Freitagsparty" }).getByRole("button", { name: "Termine" }).click();

    const dialog = page.getByRole("dialog");
    const zeile = dialog.locator("li").filter({ hasText: alsZeitpunkt(beginn(tage[1], "21:00")) });
    await zeile.getByRole("button", { name: "Verlegen" }).click();

    // Auf den Tag des ersten Termins: Dort hat die Serie schon einen.
    const verlegen = page.getByRole("dialog").filter({ hasText: "Termin verlegen" });
    await verlegen.getByLabel("Neuer Beginn").fill(`${tage[0]}T21:00`);
    await verlegen.getByRole("button", { name: "Verlegen" }).click();
    await expect(verlegen.getByText("An diesem Tag hat die Serie bereits einen Termin.")).toBeVisible({ timeout: 15000 });

    // Auf einen freien Tag: geht, und das Programm nennt ihn „Geändert".
    const frei = plusTage(tage[1], 1);
    await verlegen.getByLabel("Neuer Beginn").fill(`${frei}T20:00`);
    await verlegen.getByRole("button", { name: "Verlegen" }).click();
    await expect(verlegen).toBeHidden({ timeout: 15000 });

    await gehZu(page, `/events/${PARTY_SLUG}`);
    await expect(terminZeile(page, alsZeitpunkt(beginn(frei, "20:00"))).getByText("Geändert")).toBeVisible();
  });

  test("Admin: „Serie beenden“ nennt vorher die Zahl der betroffenen Tickets", async ({ page }) => {
    await login(page, ADMIN);
    await gehZu(page, "/admin/events");
    await page.getByRole("row").filter({ hasText: "E2E54 Freitagsparty" }).getByRole("button", { name: "Beenden" }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText("Serie beenden?")).toBeVisible();
    await expect(dialog.getByText(/Betroffen sind aktuell \d+ Tickets/)).toBeVisible({ timeout: 15000 });
    await dialog.getByRole("button", { name: "Abbrechen" }).click();
  });

  test("Admin: Nachträgliche Ferien sagen einen Termin mit Ticket nicht ab", async ({ page }) => {
    await login(page, ADMIN);
    await gehZu(page, "/admin/events");

    // Eine ganz beliebige Änderung an der Serie — hier nur die Beschreibung.
    const reihe = page.getByRole("row").filter({ hasText: "E2E54 Ferienserie" });
    await reihe.getByRole("button", { name: "Bearbeiten" }).click();
    const formular = page.getByRole("dialog");
    await formular.getByLabel("Beschreibung (optional)").fill("Nur die Beschreibung geändert.");
    await formular.getByRole("button", { name: "Speichern" }).click();
    await expect(formular).toBeHidden({ timeout: 15000 });

    await page.getByRole("row").filter({ hasText: "E2E54 Ferienserie" }).getByRole("button", { name: "Termine" }).click();
    const termineDialog = page.getByRole("dialog");
    const zeile = termineDialog.locator("li").filter({ hasText: alsZeitpunkt(beginn(tage[0], "20:00")) });
    await expect(zeile).toBeVisible({ timeout: 15000 });
    await expect(zeile.getByText("Fällt aus")).toHaveCount(0);
    // Und die Verwaltung sagt, warum dieser Termin auffällt.
    await expect(zeile.getByText("In Studioferien")).toBeVisible();
    await expect(termineDialog.getByText(/bleiben bestehen, bis du sie hier absagst/)).toBeVisible();
  });

  test("Admin: Das Bearbeiten-Formular nennt die Tickets auf künftigen Terminen", async ({ page }) => {
    await login(page, ADMIN);
    await gehZu(page, "/admin/events");
    await page
      .getByRole("row")
      .filter({ hasText: "E2E54 Freitagsparty" })
      .getByRole("button", { name: "Bearbeiten" })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/Auf künftigen Terminen hängen \d+ Tickets/)).toBeVisible({ timeout: 15000 });
    await expect(dialog.getByText(/Änderst du Uhrzeit oder Ort, werden die Inhaber benachrichtigt/)).toBeVisible();
  });
});
