import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { gehZu } from "./navigation";
import { ladeTestUmgebung } from "./env";

try {
  ladeTestUmgebung();
} catch {
  // Schon geladen (z. B. CI-Variablen direkt gesetzt) — unkritisch.
}

/**
 * PROJ-56: Ticketarten, Pässe und Einheiten.
 *
 * Die Datenbanktests prüfen, was beim Kauf gilt. Hier geht es um den Weg
 * dorthin: Sieht der Kunde das Programm, kann er wählen, und sagt die App das
 * Richtige, wenn er nicht kaufen kann?
 *
 * Braucht die Migrationen 20260915220000 und 20260915234500.
 */

const CUSTOMER = { email: "e2e14-customer-nomandate@viennasalsastudio.test", password: "CorrectPassword123!" };
const MANDAT = { email: "e2e14-customer-mandate@viennasalsastudio.test", password: "CorrectPassword123!" };
const ADMIN = { email: "e2e14-admin@viennasalsastudio.test", password: "CorrectPassword123!" };

const ART_NAME = "E2E56 Art";
const STUNDE = 3_600_000;
const inStunden = (h: number) => new Date(Date.now() + h * STUNDE).toISOString();

/** Wert für ein `datetime-local`-Feld, in der Ortszeit des Browsers. */
function lokalInStunden(stunden: number): string {
  const d = new Date(Date.now() + stunden * STUNDE);
  const zwei = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}T${zwei(d.getHours())}:00`;
}

let service: SupabaseClient;
let artId: string;
const ids: Record<string, string> = {};

async function eventAnlegen(schluessel: string, name: string, slug: string, felder: Record<string, unknown> = {}) {
  const { data, error } = await service
    .from("events")
    .insert({
      name,
      slug,
      event_type_id: artId,
      sales_mode: "tickets",
      capacity: 100,
      price_normal: 20,
      price_student: 15,
      starts_at: inStunden(72),
      ends_at: inStunden(80),
      ...felder,
    })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-56 Event ${name}: ${error.message}`);
  ids[schluessel] = data.id;
  return data.id;
}

async function einheitAnlegen(eventId: string, titel: string, stunden: number, kapazitaet: number | null) {
  const { data, error } = await service
    .from("event_units")
    .insert({ event_id: eventId, title: titel, starts_at: inStunden(stunden), capacity: kapazitaet })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-56 Einheit ${titel}: ${error.message}`);
  return data.id;
}

async function ticketartAnlegen(eventId: string, felder: Record<string, unknown>) {
  const { data, error } = await service
    .from("event_ticket_types")
    .insert({ event_id: eventId, price_normal: 20, price_student: 15, ...felder })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-56 Ticketart: ${error.message}`);
  return data.id;
}

test.beforeAll(async () => {
  service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: alteArt } = await service.from("event_types").select("id").eq("name", ART_NAME).maybeSingle();
  if (alteArt) {
    await service.from("events").delete().eq("event_type_id", alteArt.id);
    await service.from("event_types").delete().eq("id", alteArt.id);
  }
  const { data: art, error } = await service.from("event_types").insert({ name: ART_NAME }).select("id").single();
  if (error) throw new Error(`PROJ-56 Eventart: ${error.message}`);
  artId = art.id;

  // Ein Workshop mit Programm und zwei Ticketarten.
  const workshop = await eventAnlegen("workshop", "E2E56 Workshop", "e2e56-workshop", {
    cancellation_lead_days: 3,
  });
  ids.eins = await einheitAnlegen(workshop, "E2E56 Styling", 73, 5);
  ids.zwei = await einheitAnlegen(workshop, "E2E56 Footwork", 76, 5);
  ids.pass = await ticketartAnlegen(workshop, {
    name: "E2E56 Full Pass",
    price_normal: 60,
    price_student: 50,
    scope: "all",
    position: 0,
  });
  ids.einzeln = await ticketartAnlegen(workshop, {
    name: "E2E56 Einzelticket",
    price_normal: 25,
    price_student: 20,
    scope: "choice",
    position: 1,
  });

  // Ein Event mit einer ausverkauften und einer freien Ticketart. Ausverkauft
  // wird hier über die Kapazität einer Einheit: Der Pass gilt für das ganze
  // Programm, und eine seiner Einheiten ist voll. (Über das Kontingent ginge es
  // heute nicht — siehe QA-Befund BUG-1.)
  const voll = await eventAnlegen("voll", "E2E56 Ausverkauft", "e2e56-ausverkauft");
  const engeEinheit = await einheitAnlegen(voll, "E2E56 Enge Einheit", 73, 1);
  await einheitAnlegen(voll, "E2E56 Weite Einheit", 76, 20);
  await ticketartAnlegen(voll, { name: "E2E56 Letztes", scope: "all", position: 0 });
  const frei = await ticketartAnlegen(voll, { name: "E2E56 Frei", scope: "choice", position: 1 });

  const { data: nutzerListe } = await service.auth.admin.listUsers({ perPage: 300 });
  // Der Platz wird von einem Dritten belegt: Wer selbst ein Ticket hat, sieht
  // „Zum Ticket" statt „Ticket kaufen" — und der Test käme nie zum Dialog.
  const belegtVon = nutzerListe.users.find((u) => u.email === ADMIN.email);
  ids.mandatKunde = nutzerListe.users.find((u) => u.email === MANDAT.email)?.id ?? "";
  if (!belegtVon) throw new Error("PROJ-56: Admin-Konto fehlt in der Testdatenbank");
  const { error: ticketFehler } = await service.from("tickets").insert({
    event_id: voll,
    customer_id: belegtVon.id,
    ticket_type_id: frei,
    unit_id: engeEinheit,
    payment_method: "onsite",
    price: 20,
    status: "reserved",
  });
  if (ticketFehler) throw new Error(`PROJ-56 Ticket: ${ticketFehler.message}`);

  // Der Name des Kunden mit Mandat — die Namenssuche am Einlass braucht ihn.
  const { data: profil } = await service.from("profiles").select("full_name").eq("id", ids.mandatKunde).maybeSingle();
  ids.mandatName = profil?.full_name ?? "";

  // Ein Event, das nur SEPA erlaubt.
  const nurSepa = await eventAnlegen("nurSepa", "E2E56 Nur SEPA", "e2e56-nur-sepa", { payment_methods: "sepa" });
  await ticketartAnlegen(nurSepa, { name: "E2E56 SEPA-Ticket", scope: "all" });

  // Ein Event, das die Tanzrolle abfragt.
  const rolle = await eventAnlegen("rolle", "E2E56 Rollenabfrage", "e2e56-rolle", {
    role_query_enabled: true,
    max_role_difference: 2,
  });
  await ticketartAnlegen(rolle, { name: "E2E56 Rollen-Ticket", scope: "all" });

  // Ein Event für die Gästeliste.
  await eventAnlegen("gaeste", "E2E56 Gästeliste", "e2e56-gaesteliste");

  // Und eines für den Einlass — mit eigenem Programm, damit kein anderer Test
  // dem Kunden dort schon ein Ticket verkauft hat.
  const einlass = await eventAnlegen("einlass", "E2E56 Einlass", "e2e56-einlass");
  await einheitAnlegen(einlass, "E2E56 Vormittag", 73, 10);
  await einheitAnlegen(einlass, "E2E56 Nachmittag", 76, 10);
  await ticketartAnlegen(einlass, { name: "E2E56 Einlass-Ticket", scope: "choice" });
});

test.afterAll(async () => {
  await service.from("events").delete().eq("event_type_id", artId);
  if (artId) await service.from("event_types").delete().eq("id", artId);
});

async function login(page: Page, { email, password }: { email: string; password: string }) {
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  // Über gehZu, nicht roh: Nach einem Kauf lädt die Seite sich selbst nach, und
  // WebKit bricht dann die eigene Navigation ab (siehe tests/navigation.ts).
  await gehZu(page, "/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
}

async function oeffneProgramm(page: Page, name: string) {
  await gehZu(page, "/admin/events");
  await page.getByRole("row").filter({ hasText: name }).getByRole("button", { name: "Programm & Tickets" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Einheiten" })).toBeVisible({ timeout: 15000 });
  return dialog;
}

test.describe("PROJ-56: Ticketarten, Pässe & Einheiten", () => {
  test("Eventseite zeigt das Programm und die Ticketarten", async ({ page }) => {
    await gehZu(page, "/events/e2e56-workshop");
    await expect(page.getByRole("heading", { name: "Programm" })).toBeVisible();
    await expect(page.getByText("E2E56 Styling")).toBeVisible();
    await expect(page.getByText("E2E56 Footwork")).toBeVisible();

    await expect(page.getByRole("heading", { name: "Tickets" })).toBeVisible();
    const tickets = page.locator("section").filter({ has: page.getByRole("heading", { name: "Tickets" }) });
    await expect(tickets.getByText("E2E56 Full Pass")).toBeVisible();
    await expect(tickets.getByText("Gilt für das ganze Programm")).toBeVisible();
    await expect(tickets.getByText("E2E56 Einzelticket")).toBeVisible();
    await expect(tickets.getByText("Eine Einheit nach Wahl")).toBeVisible();
  });

  test("Kunde kauft einen Pass — die Ticketart ist wählbar", async ({ page }) => {
    await login(page, CUSTOMER);
    await gehZu(page, "/events/e2e56-workshop");
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Ticket kaufen" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Ticketart")).toBeVisible();
    await dialog.getByRole("radio", { name: /E2E56 Full Pass/ }).check();
    // Die Frist des Events steht im Dialog, nicht die Vorgabe.
    await expect(dialog.getByText(/3 Tage vor Beginn/)).toBeVisible();

    await dialog.getByRole("checkbox").last().check();
    await dialog.getByRole("button", { name: "Ticket kaufen" }).click();
    await expect(page.getByText(/Ticket reserviert/)).toBeVisible({ timeout: 15000 });
  });

  test("Einzelticket verlangt die Wahl einer Einheit", async ({ page }) => {
    // Ein anderer Kunde als im Test davor: Der hat auf diesem Workshop schon
    // einen Pass, und wer ein Ticket hat, bekommt keinen Kaufknopf mehr.
    await login(page, MANDAT);
    await gehZu(page, "/events/e2e56-workshop");
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Ticket kaufen" }).first().click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: /E2E56 Einzelticket/ }).check();
    await expect(dialog.getByText("Einheit")).toBeVisible();

    // Ohne Einheit bleibt der Knopf gesperrt.
    await dialog.getByRole("checkbox").last().check();
    await expect(dialog.getByRole("button", { name: "Ticket kaufen" })).toBeDisabled();

    await dialog.getByRole("radio", { name: /E2E56 Footwork/ }).check();
    await dialog.getByRole("button", { name: "Ticket kaufen" }).click();
    // Mit Mandat ist das Ticket sofort bestätigt, ohne reserviert.
    await expect(page.getByText(/Ticket bestätigt|Ticket reserviert/)).toBeVisible({ timeout: 15000 });
  });

  test("Eine ausverkaufte Ticketart bleibt sichtbar, ist aber nicht wählbar", async ({ page }) => {
    await login(page, CUSTOMER);
    await gehZu(page, "/events/e2e56-ausverkauft");

    const tickets = page.locator("section").filter({ has: page.getByRole("heading", { name: "Tickets" }) });
    await expect(tickets.getByText("E2E56 Letztes")).toBeVisible();
    await expect(tickets.getByText("Ausgebucht")).toBeVisible();

    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Ticket kaufen" }).first().click();
    // Bleibt nur eine Art übrig, zeigt der Dialog keine Auswahl mehr — die
    // ausverkaufte darf dort jedenfalls nicht auftauchen.
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("E2E56 Letztes")).toHaveCount(0);
    await expect(dialog.getByRole("radio", { name: /E2E56 Weite Einheit/ })).toBeVisible();
  });

  test("Erlaubt das Event nur SEPA und fehlt das Mandat, ist kein Kauf möglich", async ({ page }) => {
    await login(page, CUSTOMER);
    await gehZu(page, "/events/e2e56-nur-sepa");
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Ticket kaufen" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/Kein SEPA-Mandat hinterlegt/)).toBeVisible();
    await expect(dialog.getByRole("radio", { name: /Vor Ort zahlen/ })).toHaveCount(0);

    await dialog.getByRole("checkbox").last().check();
    await expect(dialog.getByRole("button", { name: "Ticket kaufen" })).toBeDisabled();
  });

  test("Fragt das Event die Tanzrolle ab, steht sie im Kaufdialog", async ({ page }) => {
    await login(page, MANDAT);
    await gehZu(page, "/events/e2e56-rolle");
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Ticket kaufen" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Tanzrolle")).toBeVisible();
    await dialog.getByRole("radio", { name: "Follower", exact: true }).check();
    await dialog.getByRole("checkbox").last().check();
    await dialog.getByRole("button", { name: "Ticket kaufen" }).click();
    await expect(page.getByText(/Ticket bestätigt|Ticket reserviert/)).toBeVisible({ timeout: 15000 });

    // Und danach steht sie an der Gästeliste.
    await login(page, ADMIN);
    await gehZu(page, "/admin/events");
    await page.getByRole("row").filter({ hasText: "E2E56 Rollenabfrage" }).getByRole("button", { name: "Gästeliste" }).click();
    await expect(page.getByRole("dialog").getByText("Follower")).toBeVisible({ timeout: 15000 });
  });

  test("Admin: eine Einheit außerhalb des Event-Zeitraums wird abgewiesen", async ({ page }) => {
    await login(page, ADMIN);
    const dialog = await oeffneProgramm(page, "E2E56 Workshop");
    await dialog.getByRole("button", { name: "Einheit", exact: true }).click();

    const formular = page.getByRole("dialog").filter({ hasText: "Einheit anlegen" });
    await formular.getByLabel("Titel").fill("E2E56 Zu spät");
    // Das Event endet in 80 Stunden.
    await formular.getByLabel("Beginn").fill(lokalInStunden(200));
    await formular.getByRole("button", { name: "Speichern" }).click();
    await expect(formular.getByText(/außerhalb des Event-Zeitraums/)).toBeVisible({ timeout: 15000 });
  });

  test("Admin: eine Ticketart mit verkauften Tickets lässt sich nur umbenennen", async ({ page }) => {
    // Erst ein Ticket kaufen, damit die Art nicht mehr frei ist.
    await login(page, MANDAT);
    await gehZu(page, "/events/e2e56-ausverkauft");
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Ticket kaufen" }).first().click();
    let dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: /E2E56 Weite Einheit/ }).check();
    await dialog.getByRole("checkbox").last().check();
    await dialog.getByRole("button", { name: "Ticket kaufen" }).click();
    await expect(page.getByText(/Ticket bestätigt|Ticket reserviert/)).toBeVisible({ timeout: 15000 });

    await login(page, ADMIN);
    dialog = await oeffneProgramm(page, "E2E56 Ausverkauft");
    await dialog
      .locator("li")
      .filter({ hasText: "E2E56 Frei" })
      .getByRole("button", { name: "Ticketart bearbeiten" })
      .click();

    const formular = page.getByRole("dialog").filter({ hasText: "Ticketart bearbeiten" });
    await expect(formular.getByText(/verkauft. Preis und Geltung/)).toBeVisible();

    await formular.getByLabel("Preis normal (€)").fill("99");
    await formular.getByRole("button", { name: "Speichern" }).click();
    await expect(formular.getByText(/lassen sich dann nicht mehr ändern/)).toBeVisible({ timeout: 15000 });

    // Umbenennen geht.
    await formular.getByLabel("Preis normal (€)").fill("20");
    await formular.getByLabel("Name").fill("E2E56 Frei neu");
    await formular.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Ticketart gespeichert.")).toBeVisible({ timeout: 15000 });
  });

  test("Admin: einen Gast von Hand eintragen und wieder entfernen", async ({ page }) => {
    await login(page, ADMIN);
    await gehZu(page, "/admin/events");
    await page.getByRole("row").filter({ hasText: "E2E56 Gästeliste" }).getByRole("button", { name: "Gästeliste" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Gäste von Hand" })).toBeVisible({ timeout: 15000 });
    await dialog.getByRole("button", { name: "Gast eintragen" }).click();

    const formular = page.getByRole("dialog").filter({ hasText: "Gast eintragen" });
    await formular.getByLabel("Name").fill("E2E56 Maria (Lehrerin)");
    await formular.getByLabel("Notiz (optional)").fill("Gast von Lisa");
    await formular.getByRole("button", { name: "Eintragen" }).click();
    await expect(page.getByText("Gast eingetragen.")).toBeVisible({ timeout: 15000 });

    const zeile = dialog.locator("li").filter({ hasText: "E2E56 Maria (Lehrerin)" });
    await expect(zeile.getByText("Gast", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/1 Gäste von Hand/)).toBeVisible();

    await zeile.getByRole("button", { name: "Entfernen" }).click();
    await expect(page.getByText("Gast entfernt.")).toBeVisible({ timeout: 15000 });
    await expect(dialog.locator("li").filter({ hasText: "E2E56 Maria (Lehrerin)" })).toHaveCount(0);
  });

  test("Einlass: Einheit wählen — ein Ticket der anderen Einheit wird abgewiesen", async ({ page }) => {
    // Ein Ticket für den Vormittag kaufen.
    await login(page, MANDAT);
    await gehZu(page, "/events/e2e56-einlass");
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Ticket kaufen" }).first().click();
    const kauf = page.getByRole("dialog");
    await kauf.getByRole("radio", { name: /E2E56 Vormittag/ }).check();
    await kauf.getByRole("checkbox").last().check();
    await kauf.getByRole("button", { name: "Ticket kaufen" }).click();
    await expect(page.getByText(/Ticket bestätigt|Ticket reserviert/)).toBeVisible({ timeout: 15000 });

    await login(page, ADMIN);
    await gehZu(page, "/checkin");
    await page.waitForTimeout(1500);

    // Termin wählen …
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /E2E56 Einlass/ }).click();

    // … und die falsche Einheit.
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: /E2E56 Nachmittag/ }).click();

    await page.getByPlaceholder("Name suchen…").fill(ids.mandatName.split(" ")[0] ?? "a");
    await page.waitForTimeout(2000);

    const zeile = page.locator("div.rounded-md.border").filter({ hasText: "E2E56 Einlass-Ticket" }).first();
    await zeile.getByRole("button", { name: "Einchecken" }).click();
    await expect(page.getByText(/Gilt nicht für diese Einheit/)).toBeVisible({ timeout: 15000 });
  });
});
