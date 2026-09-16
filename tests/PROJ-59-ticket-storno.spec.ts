import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";
import { gehZu } from "./navigation";
import { zweiteStufeErledigen } from "./zweite-stufe";

ladeTestUmgebung();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PASSWORT = "CorrectPassword123!";
const ADMIN = "e2e14-admin@viennasalsastudio.test";
const KUNDE = "e2e59-kunde@viennasalsastudio.test";

let service: SupabaseClient;
let kundeId: string;
let artId: string;
let eventId: string;
const laeufe: string[] = [];

async function ticketAnlegen(zahlungsart: "sepa" | "onsite", preis = 18): Promise<string> {
  const { data, error } = await service
    .from("tickets")
    .insert({
      event_id: eventId,
      customer_id: kundeId,
      payment_method: zahlungsart,
      price: preis,
      status: "confirmed",
      cancellation_lead_days: 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-59 Ticket: ${error.message}`);
  return data.id;
}

async function laufMitTicket(ticketId: string, freigegeben: boolean): Promise<void> {
  const { data: lauf } = await service
    .from("sepa_collection_runs")
    .insert({ due_date: "2026-10-01" })
    .select("id")
    .single();
  laeufe.push(lauf!.id);
  await service.from("sepa_collection_items").insert({
    run_id: lauf!.id,
    customer_id: kundeId,
    event_ticket_id: ticketId,
    amount: 18,
    iban: "AT611904300234573201",
    account_holder_name: "E2E59 Kunde",
    mandate_reference: `E2E59-${Date.now()}`,
  });
  if (freigegeben) {
    await service.from("sepa_collection_runs").update({ released_at: new Date().toISOString() }).eq("id", lauf!.id);
  }
}

test.beforeAll(async () => {
  service = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  const { data: alle } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = alle?.users.find((u) => u.email === KUNDE);
  if (alt) await service.auth.admin.deleteUser(alt.id);
  const { data: neu } = await service.auth.admin.createUser({
    email: KUNDE,
    password: PASSWORT,
    email_confirm: true,
  });
  kundeId = neu!.user!.id;
  await service.from("profiles").update({ full_name: "E2E59 Storno-Kunde" }).eq("id", kundeId);

  const { data: art } = await service
    .from("event_types")
    .insert({ name: `E2E59 Art ${Date.now()}` })
    .select("id")
    .single();
  artId = art!.id;

  const { data: event } = await service
    .from("events")
    .insert({
      name: "E2E59 Storno-Event",
      slug: `e2e59-${crypto.randomUUID().slice(0, 8)}`,
      event_type_id: artId,
      sales_mode: "tickets",
      starts_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      capacity: 20,
      price_normal: 18,
      price_student: 15,
      status: "geplant",
    })
    .select("id")
    .single();
  eventId = event!.id;
});

test.afterAll(async () => {
  await service.from("customer_credits").delete().eq("customer_id", kundeId);
  const { data: tickets } = await service.from("tickets").select("id").eq("event_id", eventId);
  await service.from("sepa_collection_items").delete().in("event_ticket_id", (tickets ?? []).map((t) => t.id));
  await service.from("sepa_collection_runs").delete().in("id", laeufe);
  await service.from("tickets").delete().eq("event_id", eventId);
  await service.from("events").delete().eq("id", eventId);
  await service.from("event_types").delete().eq("id", artId);
  await service.auth.admin.deleteUser(kundeId).catch(() => {});
});

/**
 * Vor jeder Prüfung eine leere Liste.
 *
 * Sonst klickt `.first()` auf ein Ticket aus der vorigen Prüfung — etwa auf
 * das, das dort absichtlich stehen geblieben ist. Genau das ist beim ersten
 * Lauf passiert.
 */
test.beforeEach(async () => {
  const { data: tickets } = await service.from("tickets").select("id").eq("event_id", eventId);
  const ids = (tickets ?? []).map((t) => t.id);
  if (ids.length > 0) {
    await service.from("sepa_collection_items").delete().in("event_ticket_id", ids);
    await service.from("tickets").delete().in("id", ids);
  }
  await service.from("customer_credits").delete().eq("customer_id", kundeId);
});

async function gaestelisteOeffnen(page: Page) {
  await gehZu(page, "/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(ADMIN);
  await page.getByLabel("Passwort").fill(PASSWORT);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await zweiteStufeErledigen(page, ADMIN);

  await gehZu(page, "/admin/events");
  const zeile = page.getByRole("row", { name: /E2E59 Storno-Event/ });
  await zeile.getByRole("button", { name: "Gästeliste" }).click();
  await expect(page.getByRole("dialog").getByText("E2E59 Storno-Kunde").first()).toBeVisible({ timeout: 15000 });
}

test.describe("PROJ-59: Ticket stornieren durch die Verwaltung", () => {
  test("Zahlung vor Ort: kein Wort von Guthaben, Stornieren wirkt", async ({ page }) => {
    const ticket = await ticketAnlegen("onsite");
    await gaestelisteOeffnen(page);

    await page.getByRole("button", { name: "Stornieren" }).first().click();
    await expect(page.getByText(/durch die App ist nie Geld geflossen/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel(/als Guthaben gutschreiben/)).toHaveCount(0);

    await page.getByRole("dialog").getByRole("button", { name: "Stornieren" }).click();
    await expect(page.getByText("Ticket storniert.")).toBeVisible({ timeout: 20000 });

    const { data } = await service.from("tickets").select("status").eq("id", ticket).single();
    expect(data!.status).toBe("cancelled");
  });

  test("Lastschrift ohne freigegebenen Lauf: nichts abgebucht, kein Häkchen", async ({ page }) => {
    const ticket = await ticketAnlegen("sepa");
    await laufMitTicket(ticket, false);
    await gaestelisteOeffnen(page);

    await page.getByRole("button", { name: "Stornieren" }).first().click();
    // Der Hinweis, der Geld spart: erst die Zeile aus dem Lauf nehmen.
    await expect(page.getByText(/nicht\s+freigegeben/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel(/als Guthaben gutschreiben/)).toHaveCount(0);
  });

  test("Lastschrift mit freigegebenem Lauf: Häkchen vorausgewählt, Gutschrift entsteht", async ({ page }) => {
    const ticket = await ticketAnlegen("sepa");
    await laufMitTicket(ticket, true);
    await gaestelisteOeffnen(page);

    await page.getByRole("button", { name: "Stornieren" }).first().click();
    await expect(page.getByText(/Bereits abgebucht/)).toBeVisible({ timeout: 15000 });
    const haekchen = page.getByLabel(/als Guthaben gutschreiben/);
    await expect(haekchen).toBeChecked();

    await page.getByRole("dialog").getByRole("button", { name: "Stornieren" }).click();
    await expect(page.getByText("Ticket storniert.")).toBeVisible({ timeout: 20000 });

    const { data } = await service
      .from("customer_credits")
      .select("amount, origin")
      .eq("customer_id", kundeId)
      .eq("origin", "storno");
    expect(data).toHaveLength(1);
    expect(Number(data![0].amount)).toBe(18);

    void ticket;
  });

  test("Stornierte Zeile bleibt stehen und nennt wann, durch wen und warum", async ({ page }) => {
    const ticket = await ticketAnlegen("onsite");
    await gaestelisteOeffnen(page);

    await page.getByRole("button", { name: "Stornieren" }).first().click();
    await page.getByLabel("Grund (optional)").fill("Kunde hat abgesagt");
    await page.getByRole("dialog").getByRole("button", { name: "Stornieren" }).click();
    await expect(page.getByText("Ticket storniert.")).toBeVisible({ timeout: 20000 });

    await expect(page.getByText(/Kunde hat abgesagt/)).toBeVisible({ timeout: 15000 });
    const { data } = await service.from("tickets").select("cancellation_reason").eq("id", ticket).single();
    expect(data!.cancellation_reason).toBe("Kunde hat abgesagt");
  });
});
