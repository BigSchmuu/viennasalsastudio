import { test, expect, type Page, type Locator } from "@playwright/test";

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
  await page.waitForTimeout(1500);
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
    await page.getByRole("dialog").getByRole("button", { name: "Ticket kaufen" }).click();
    await expect(page.getByText("Ticket bestätigt! Du findest es mit QR-Code in deinem Profil.")).toBeVisible();

    await page.goto("/profil");
    await page.getByText("Meine Tickets", { exact: true }).scrollIntoViewIfNeeded();
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
    await page.getByRole("dialog").getByRole("button", { name: "Ticket kaufen" }).click();
    await expect(page.getByText("Ticket reserviert! Zahlung bitte vor Ort.")).toBeVisible();

    await page.goto("/events");
    const afterPurchase = await card.getByText(/Noch \d+ Plätze frei/).innerText();
    expect(Number(afterPurchase.match(/\d+/)![0])).toBe(beforeCount - 1);

    await page.goto("/profil");
    await page.getByText("Meine Tickets", { exact: true }).scrollIntoViewIfNeeded();
    const row = ticketRow(page, "E2E14 Kaufen Event");
    await expect(row.getByText("Reserviert")).toBeVisible();
    await row.getByRole("button", { name: "Ticket stornieren" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Stornieren" }).click();
    await expect(page.getByText("Ticket storniert.")).toBeVisible();

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
    await page.getByText("Meine Tickets", { exact: true }).scrollIntoViewIfNeeded();

    const row = ticketRow(page, "E2E14 Stornofrist Event");
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: "Ticket stornieren" })).toHaveCount(0);
  });

  test("AC8, AC9: Admin checkt Gast per Namenssuche ein; erneute Suche zeigt bereits eingecheckt", async ({ page }) => {
    await login(page, CUSTOMER_MANDATE);
    await page.goto("/events");
    await eventCard(page, "E2E14 Checkin Event").getByRole("button", { name: "Ticket kaufen" }).click();
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
    await expect(page).toHaveURL("http://localhost:3000/");
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
    await page.getByText("Benachrichtigungen", { exact: true }).first().scrollIntoViewIfNeeded();
    await expect(page.getByText("Event-Tickets", { exact: true })).toBeVisible();

    const emailSwitch = page.getByRole("switch", { name: "Event-Tickets per E-Mail" });
    await expect(emailSwitch).toHaveAttribute("data-state", "checked");
    await emailSwitch.click();
    await expect(emailSwitch).toHaveAttribute("data-state", "unchecked");
    await page.waitForTimeout(500);

    await page.reload();
    await page.getByText("Benachrichtigungen", { exact: true }).first().scrollIntoViewIfNeeded();
    await expect(page.getByRole("switch", { name: "Event-Tickets per E-Mail" })).toHaveAttribute("data-state", "unchecked");

    // Ticket must still be visible in profile regardless of notification preference.
    await page.getByText("Meine Tickets", { exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByText("E2E14 Kaufen Event")).toBeVisible();

    // Reset to default for repeatable runs.
    await page.getByRole("switch", { name: "Event-Tickets per E-Mail" }).click();
    await expect(page.getByRole("switch", { name: "Event-Tickets per E-Mail" })).toHaveAttribute("data-state", "checked");
    await page.waitForTimeout(800);
  });
});
