import { test, expect, type Page, type Locator } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

// The Playwright runner doesn't auto-load .env.local (unlike `next dev`), but
// the fixture reset below needs SUPABASE_SERVICE_ROLE_KEY.
try {
  ladeTestUmgebung();
} catch {
  // Already loaded (e.g. CI env vars set directly) — safe to ignore.
}

/**
 * Three of these events are bought from during the run and one gets cancelled,
 * but nothing released the tickets or restored the status. After a handful of
 * runs "Kaufen Event" and "Checkin Event" had used up all 5 seats and
 * "Cancel Notify Event" was permanently cancelled, so the app correctly showed
 * "Ausgebucht" and hid the cancelled event — and the tests, expecting seats to
 * be available, failed.
 *
 * The two events that are *supposed* to stay occupied ("Ausgebucht Event",
 * capacity 1, and "Stornofrist Event") keep their tickets untouched.
 *
 * Dates are recomputed relative to now as well: they were fixed timestamps and
 * would have silently started failing once they slipped into the past.
 */
test.beforeAll(async () => {
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: events, error } = await service.from("events").select("id, name").like("name", "E2E14%");
  if (error) throw new Error(`PROJ-14 Fixture-Reset fehlgeschlagen: ${error.message}`);
  const byName = new Map((events ?? []).map((e) => [e.name, e.id]));

  const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

  // Die Stornofrist rechnet tagesgenau (daysUntil auf dem Datum, wie bei
  // Buchungen — so im Spec festgelegt). Ein Termin „in 12 Stunden" liegt
  // deshalb je nach Tageszeit mal innerhalb, mal außerhalb der Frist: Läuft
  // die Suite vormittags, bleibt er heute; läuft sie abends, fällt er auf
  // morgen und die Frist gilt plötzlich als gewahrt. Genau daran ist der Test
  // um 23:02 gescheitert, nachdem er um 04:29 grün war.
  //
  // Für einen Termin, der zuverlässig innerhalb der Frist liegt, zählt nur
  // der Kalendertag — also heute, zu fester Stunde.
  const heuteUm = (stunde: number) => {
    const d = new Date();
    d.setHours(stunde, 0, 0, 0);
    return d.toISOString();
  };

  // Seats must be free again for the three events the suite buys from.
  const needFreeSeats = ["E2E14 Kaufen Event", "E2E14 Checkin Event", "E2E14 Cancel Notify Event"]
    .map((n) => byName.get(n))
    .filter((id): id is string => Boolean(id));
  if (needFreeSeats.length) {
    // Cancelling rather than deleting: tickets that were billed in a SEPA run
    // are referenced by sepa_collection_items, so a delete fails on that
    // foreign key. Capacity counts only confirmed/checked_in/reserved seats,
    // so cancelling frees them without tearing up accounting references.
    const { error: seatError } = await service
      .from("tickets")
      .update({ status: "cancelled" })
      .in("event_id", needFreeSeats)
      .neq("status", "cancelled");
    if (seatError) throw new Error(`PROJ-14 Ticket-Reset fehlgeschlagen: ${seatError.message}`);

    await service.from("events").update({ status: "geplant", starts_at: hoursFromNow(24 * 7) }).in("id", needFreeSeats);
  }

  const ausgebucht = byName.get("E2E14 Ausgebucht Event");
  if (ausgebucht) {
    await service.from("events").update({ status: "geplant", starts_at: hoursFromNow(24 * 7) }).eq("id", ausgebucht);
  }

  // "Stornofrist Event" must sit inside the 1-day cancellation deadline, so
  // the cancel button stays hidden. Its existing ticket is left alone.
  const stornofrist = byName.get("E2E14 Stornofrist Event");
  if (stornofrist) {
    await service.from("events").update({ status: "geplant", starts_at: heuteUm(12) }).eq("id", stornofrist);
  }

  // AC13 switches the event-ticket e-mail preference off and tries to switch it
  // back at the end — but by then it has opened another accordion section, so
  // the switch is no longer mounted and the restore never lands. One aborted
  // run therefore left the preference off for good, and every later run failed
  // on its very first assertion. Restore it here instead, where nothing can
  // interfere.
  const { data: customer } = await service
    .from("profiles")
    .select("id")
    .eq("full_name", "E2E14 Kunde Mit Mandat")
    .maybeSingle();
  if (customer) {
    await service
      .from("notification_preferences")
      .delete()
      .eq("customer_id", customer.id)
      .eq("event_group", "event_tickets");
  }
});

const CUSTOMER_MANDATE = { email: "e2e14-customer-mandate@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER_NOMANDATE = { email: "e2e14-customer-nomandate@viennasalsastudio.test", password: "CorrectPassword123!" };
const ADMIN = { email: "e2e14-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const TEACHER = { email: "e2e14-teacher@viennasalsastudio.test", password: "CorrectPassword123!" };

async function login(page: Page, { email, password }: { email: string; password: string }, redirect?: string) {
  await page.goto(redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.waitForTimeout(1000); // let hydration settle, see PROJ-2 BUG-1
  await page.getByRole("button", { name: "Einloggen" }).click();
  // Wait for the redirect to actually land instead of guessing 1.5s. On WebKit
  // it regularly arrived later, and the next page.goto() of the calling test
  // was then aborted with "interrupted by another navigation".
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
  // Seit PROJ-45 landen Kunden auf /mein-bereich. Die Prüfungen hier gelten
  // dem Profil — also dorthin, wo der Test vorher schon stand.
  if (page.url().endsWith("/mein-bereich")) await page.goto("/profil");
}

// shadcn Card root: "rounded-lg border bg-card text-card-foreground shadow-sm"
function eventCard(page: Page, name: string): Locator {
  return page.locator(".rounded-lg.border").filter({ hasText: name });
}

// MyTicketsSection row: "rounded-md border p-3 space-y-2"
function ticketRow(page: Page, name: string): Locator {
  return page.locator(".rounded-md.border.p-3").filter({ hasText: name });
}

// checkin-client guest row: "flex items-center justify-between rounded-md border p-2 text-sm"
function guestRow(page: Page, name: string): Locator {
  return page.locator(".rounded-md.border.p-2").filter({ hasText: name });
}

test.describe("PROJ-14: Events & Workshops (Tickets, QR-Check-in)", () => {
  test("AC1: Event-Übersicht zeigt kommende Events mit Termin, Preis und Kapazitäts-Hinweis", async ({ page }) => {
    await page.goto("/events");
    await expect(page.getByRole("heading", { name: "Events & Workshops" })).toBeVisible();

    const card = eventCard(page, "E2E14 Kaufen Event");
    await expect(card).toBeVisible();
    await expect(card.getByText(/25,00/)).toBeVisible();
    await expect(card.getByText(/Studierende/)).toBeVisible();
    await expect(card.getByText(/Noch \d+ Plätze frei/)).toBeVisible();
  });

  test("AC2: Nicht eingeloggter Besucher wird beim Kaufversuch zum Login weitergeleitet", async ({ page }) => {
    await page.goto("/events");
    const loginLink = eventCard(page, "E2E14 Kaufen Event").getByRole("link", { name: "Zum Ticket-Kauf einloggen" });
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("AC3, AC7: Ticket-Kauf mit SEPA-Mandat wird sofort bestätigt und erscheint mit QR-Code im Profil", async ({ page }) => {
    await login(page, CUSTOMER_MANDATE);
    await page.goto("/events");

    await eventCard(page, "E2E14 Kaufen Event").getByRole("button", { name: "Ticket kaufen" }).click();

    await expect(page.getByRole("radio", { name: /SEPA-Lastschrift/ })).toBeChecked();
    // PROJ-42: Ohne Zustimmung bleibt der Knopf gesperrt.
    await page.getByRole("dialog").getByRole("checkbox", { name: /AGB gelesen/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Ticket kaufen" }).click();
    await expect(page.getByText("Ticket bestätigt! Du findest es mit QR-Code in deinem Profil.")).toBeVisible();

    await page.goto("/profil");
    await page.getByRole("button", { name: "Meine Tickets" }).click();
    await page.waitForTimeout(400);
    const row = ticketRow(page, "E2E14 Kaufen Event");
    await expect(row.getByText("Bestätigt")).toBeVisible();
    await expect(row.locator("canvas, img")).toBeVisible();
  });

  test("AC4: Kunde ohne SEPA-Mandat kann nur 'Vor Ort zahlen' wählen", async ({ page }) => {
    await login(page, CUSTOMER_NOMANDATE);
    await page.goto("/events");

    await eventCard(page, "E2E14 Kaufen Event").getByRole("button", { name: "Ticket kaufen" }).click();

    await expect(page.getByRole("radio", { name: /SEPA-Lastschrift/ })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: /Vor Ort zahlen/ })).toBeChecked();
    await expect(page.getByText("Kein SEPA-Mandat hinterlegt.")).toBeVisible();
  });

  test("AC5, AC10: 'Vor Ort zahlen' reserviert sofort, Stornierung gibt Kapazität sofort wieder frei", async ({ page }) => {
    await login(page, CUSTOMER_NOMANDATE);
    await page.goto("/events");

    const card = eventCard(page, "E2E14 Kaufen Event");
    const before = await card.getByText(/Noch \d+ Plätze frei/).innerText();
    const beforeCount = Number(before.match(/\d+/)![0]);

    await card.getByRole("button", { name: "Ticket kaufen" }).click();
    // PROJ-42: Ohne Zustimmung bleibt der Knopf gesperrt.
    await page.getByRole("dialog").getByRole("checkbox", { name: /AGB gelesen/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Ticket kaufen" }).click();
    await expect(page.getByText("Ticket reserviert! Zahlung bitte vor Ort.")).toBeVisible();

    await page.goto("/events");
    const afterPurchase = await card.getByText(/Noch \d+ Plätze frei/).innerText();
    expect(Number(afterPurchase.match(/\d+/)![0])).toBe(beforeCount - 1);

    await page.goto("/profil");
    await page.getByRole("button", { name: "Meine Tickets" }).click();
    await page.waitForTimeout(400);
    const row = ticketRow(page, "E2E14 Kaufen Event");
    await expect(row.getByText("Reserviert")).toBeVisible();
    await row.getByRole("button", { name: "Ticket stornieren" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Stornieren" }).click();
    await expect(page.getByText("Ticket storniert.")).toBeVisible();

    // Cancelling refreshes /profil in the background. Navigating away while
    // that is still in flight aborts it ("interrupted by another navigation"),
    // so wait until the row has actually left the reserved state — that is the
    // visible proof the refresh landed.
    await expect(row.getByText("Reserviert")).toHaveCount(0);

    await page.goto("/events");
    const afterCancel = await card.getByText(/Noch \d+ Plätze frei/).innerText();
    expect(Number(afterCancel.match(/\d+/)![0])).toBe(beforeCount);
  });

  test("AC6: Ausgebuchtes Event zeigt 'Ausgebucht' und Kauf ist gesperrt", async ({ page }) => {
    await login(page, CUSTOMER_MANDATE);
    await page.goto("/events");

    const card = eventCard(page, "E2E14 Ausgebucht Event");
    await expect(card.getByText("Ausgebucht").first()).toBeVisible();
    await expect(card.getByRole("button", { name: "Ausgebucht" })).toBeDisabled();
  });

  test("AC11: Stornieren ist nach Ablauf der Frist nicht mehr möglich (Button ausgeblendet)", async ({ page }) => {
    await login(page, CUSTOMER_NOMANDATE);
    await page.goto("/profil");
    await page.getByRole("button", { name: "Meine Tickets" }).click();
    await page.waitForTimeout(400);

    const row = ticketRow(page, "E2E14 Stornofrist Event");
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: "Ticket stornieren" })).toHaveCount(0);
  });

  test("AC8, AC9: Admin checkt Gast per Namenssuche ein; erneute Suche zeigt bereits eingecheckt", async ({ page }) => {
    await login(page, CUSTOMER_MANDATE);
    await page.goto("/events");
    await eventCard(page, "E2E14 Checkin Event").getByRole("button", { name: "Ticket kaufen" }).click();
    // PROJ-42: Ohne Zustimmung bleibt der Knopf gesperrt.
    await page.getByRole("dialog").getByRole("checkbox", { name: /AGB gelesen/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Ticket kaufen" }).click();
    await expect(page.getByText("Ticket bestätigt! Du findest es mit QR-Code in deinem Profil.")).toBeVisible();

    await login(page, ADMIN);
    await page.goto("/checkin");
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "E2E14 Checkin Event" }).click();

    await page.getByPlaceholder("Name suchen…").fill("E2E14 Kunde Mit Mandat");
    await page.waitForTimeout(500);
    const guest = guestRow(page, "E2E14 Kunde Mit Mandat");
    await guest.getByRole("button", { name: "Einchecken" }).click();
    await expect(page.getByText(/eingecheckt \(SEPA-Lastschrift\)/)).toBeVisible();

    await page.getByPlaceholder("Name suchen…").fill("");
    await page.getByPlaceholder("Name suchen…").fill("E2E14 Kunde Mit Mandat");
    await page.waitForTimeout(500);
    await expect(guest.getByRole("button", { name: /Eingecheckt \d{2}:\d{2}/ })).toBeDisabled();
  });

  test("AC14: Kunde ohne Admin-/Lehrer-Rolle wird von /checkin weggeleitet", async ({ page }) => {
    await login(page, CUSTOMER_NOMANDATE);
    await page.goto("/checkin");
    // Relativ zur baseURL statt fest auf einen Port: Der Testserver laeuft
    // auf 3100, damit er nie den Entwicklungsserver mit den Produktionsdaten
    // uebernimmt.
    await expect(page).toHaveURL(/\/$/);
  });

  test("Lehrer-Rolle darf ebenfalls einchecken (Zugriff auf /checkin)", async ({ page }) => {
    await login(page, TEACHER);
    await page.goto("/checkin");
    await expect(page.getByRole("heading", { name: "Event-Check-in" })).toBeVisible();
  });

  test("AC12: Event-Absage entfernt es von /events und benachrichtigt Ticket-Inhaber", async ({ page }) => {
    await login(page, CUSTOMER_MANDATE);
    await page.goto("/events");
    await eventCard(page, "E2E14 Cancel Notify Event").getByRole("button", { name: "Ticket kaufen" }).click();
    // PROJ-42: Ohne Zustimmung bleibt der Knopf gesperrt.
    await page.getByRole("dialog").getByRole("checkbox", { name: /AGB gelesen/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Ticket kaufen" }).click();
    await expect(page.getByText("Ticket bestätigt! Du findest es mit QR-Code in deinem Profil.")).toBeVisible();

    await login(page, ADMIN);
    await page.goto("/admin/events");
    const row = page.getByRole("row", { name: /E2E14 Cancel Notify Event/ });
    await row.getByRole("button", { name: "Absagen" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Absagen" }).click();
    await expect(page.getByText("Event abgesagt.")).toBeVisible();

    await page.goto("/events");
    await expect(page.getByText("E2E14 Cancel Notify Event")).toHaveCount(0);
  });

  test("AC13: Deaktivierte Event-Tickets-Benachrichtigung lässt Ticket im Profil sichtbar", async ({ page }) => {
    await login(page, CUSTOMER_MANDATE);
    await page.getByRole("button", { name: "Benachrichtigungen" }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText("Event-Tickets", { exact: true })).toBeVisible();

    const emailSwitch = page.getByRole("switch", { name: "Event-Tickets — E-Mail" });
    await expect(emailSwitch).toHaveAttribute("data-state", "checked");
    await emailSwitch.click();
    await expect(emailSwitch).toHaveAttribute("data-state", "unchecked");
    await page.waitForTimeout(500);

    await page.reload();
    await page.getByRole("button", { name: "Benachrichtigungen" }).click();
    await page.waitForTimeout(400);
    await expect(page.getByRole("switch", { name: "Event-Tickets — E-Mail" })).toHaveAttribute("data-state", "unchecked");

    // Ticket must still be visible in profile regardless of notification preference.
    // The customer keeps every ticket ever bought for this event, cancelled ones
    // included, so the claim is "still shown" — not "shown exactly once".
    await page.getByRole("button", { name: "Meine Tickets" }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText("E2E14 Kaufen Event").first()).toBeVisible();

    // Reset to default for repeatable runs.
    await page.getByRole("switch", { name: "Event-Tickets — E-Mail" }).click();
    await expect(page.getByRole("switch", { name: "Event-Tickets — E-Mail" })).toHaveAttribute("data-state", "checked");
    await page.waitForTimeout(800);
  });
});
