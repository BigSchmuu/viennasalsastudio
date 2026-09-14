import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { gehZu } from "./navigation";
import { ladeTestUmgebung } from "./env";
import { AGB_VERSION } from "../src/lib/legal";

try {
  ladeTestUmgebung();
} catch {
  // Schon geladen (z. B. CI-Variablen direkt gesetzt) — unkritisch.
}

/**
 * PROJ-53: Veranstaltungsprogramm — Übersicht, Filter, Eventseite, Admin.
 *
 * Die Testdaten tragen „E2E53" im Namen und werden vor jedem Lauf neu
 * angelegt. Alle Zeiten stehen relativ zu jetzt: Feste Zeitpunkte rutschten
 * unbemerkt in die Vergangenheit, und die Tests schlügen eines Tages ohne
 * Änderung fehl (so geschehen bei PROJ-14).
 *
 * Kein Test verlässt sich darauf, dass es sonst keine Events gibt — die
 * Testdatenbank teilen sich alle Suiten.
 */

const CUSTOMER_MANDATE = { email: "e2e14-customer-mandate@viennasalsastudio.test", password: "CorrectPassword123!" };
const CUSTOMER_NOMANDATE = { email: "e2e14-customer-nomandate@viennasalsastudio.test", password: "CorrectPassword123!" };
const ADMIN = { email: "e2e14-admin@viennasalsastudio.test", password: "CorrectPassword123!" };

const STUNDE = 3_600_000;
const inStunden = (stunden: number) => new Date(Date.now() + stunden * STUNDE).toISOString();

/** Wert für ein `datetime-local`-Feld, in der Ortszeit des Browsers. */
function lokalInStunden(stunden: number): string {
  const d = new Date(Date.now() + stunden * STUNDE);
  const zwei = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}T${zwei(d.getHours())}:00`;
}

const arten: Record<string, string> = {};

async function eventart(service: SupabaseClient, name: string): Promise<string> {
  const { data } = await service.from("event_types").select("id").eq("name", name).maybeSingle();
  if (data) return data.id;
  const { data: neu, error } = await service.from("event_types").insert({ name }).select("id").single();
  if (error) throw new Error(`PROJ-53 Eventart „${name}“: ${error.message}`);
  return neu.id;
}

test.beforeAll(async () => {
  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Tickets und frühere Adressen hängen mit „on delete cascade" an den Events.
  // Gekauft wird hier nur „vor Ort" — ohne SEPA-Posten, die das Löschen sperrten.
  const { error: loeschFehler } = await service.from("events").delete().like("name", "E2E53%");
  if (loeschFehler) throw new Error(`PROJ-53 Aufräumen fehlgeschlagen: ${loeschFehler.message}`);
  await service.from("event_types").delete().like("name", "E2E53 Temp%");

  arten.party = await eventart(service, "E2E53 Party");
  arten.workshop = await eventart(service, "E2E53 Workshop");
  arten.vergangen = await eventart(service, "E2E53 Vergangen-Art");

  const leer = { location: null, ends_at: null, capacity: null, price_normal: null, price_student: null, description: null };
  const { data: angelegt, error } = await service
    .from("events")
    .insert([
      {
        ...leer,
        name: "E2E53 Salsa Party",
        slug: "e2e53-salsa-party",
        event_type_id: arten.party,
        sales_mode: "display",
        status: "geplant",
        location: "Studio Saal 1",
        starts_at: inStunden(48),
        ends_at: inStunden(53),
        price_normal: 12,
        price_student: 10,
        description: `Die Party am Samstag.\n\nZweiter Absatz: DJ, Getränke und viel Platz zum Tanzen. ${"Mehr Text für die gekürzte Karte. ".repeat(12)}Ende der Beschreibung.`,
      },
      {
        ...leer,
        name: "E2E53 Bachata Workshop",
        slug: "e2e53-bachata-workshop",
        event_type_id: arten.workshop,
        sales_mode: "tickets",
        status: "geplant",
        location: "Studio Saal 2",
        starts_at: inStunden(72),
        ends_at: inStunden(75),
        capacity: 20,
        price_normal: 30,
        price_student: 25,
        description: "Figuren und Musikalität.",
      },
      {
        ...leer,
        name: "E2E53 Laufender Workshop",
        slug: "e2e53-laufender-workshop",
        event_type_id: arten.workshop,
        sales_mode: "tickets",
        status: "geplant",
        starts_at: inStunden(-1),
        ends_at: inStunden(3),
        capacity: 20,
        price_normal: 20,
        price_student: 15,
      },
      {
        ...leer,
        name: "E2E53 Abgesagtes Event",
        slug: "e2e53-abgesagtes-event",
        event_type_id: arten.workshop,
        sales_mode: "tickets",
        status: "abgesagt",
        starts_at: inStunden(96),
        capacity: 20,
        price_normal: 20,
        price_student: 15,
      },
      {
        ...leer,
        name: "E2E53 Vergangenes Event",
        slug: "e2e53-vergangenes-event",
        event_type_id: arten.vergangen,
        sales_mode: "display",
        status: "geplant",
        starts_at: inStunden(-30),
        ends_at: inStunden(-27),
      },
      {
        ...leer,
        name: "E2E53 Umbenanntes Event",
        slug: "e2e53-umbenanntes-event",
        event_type_id: arten.party,
        sales_mode: "display",
        status: "geplant",
        starts_at: inStunden(120),
      },
      {
        ...leer,
        name: "E2E53 Ohne Ort",
        slug: "e2e53-ohne-ort",
        event_type_id: arten.party,
        sales_mode: "display",
        status: "geplant",
        starts_at: inStunden(100),
      },
      {
        ...leer,
        name: "E2E53 <script>window.__xss = 1</script> Party",
        slug: "e2e53-xss",
        event_type_id: arten.party,
        sales_mode: "display",
        status: "geplant",
        starts_at: inStunden(130),
        description: "</script><script>window.__xss = 2</script>",
      },
    ])
    .select("id, slug");
  if (error) throw new Error(`PROJ-53 Testdaten: ${error.message}`);
  const idVon = (slug: string) => angelegt!.find((e) => e.slug === slug)!.id;

  const { error: merkFehler } = await service
    .from("event_previous_slugs")
    .insert({ event_id: idVon("e2e53-umbenanntes-event"), slug: "e2e53-alter-name" });
  if (merkFehler) throw new Error(`PROJ-53 frühere Adresse: ${merkFehler.message}`);

  // Ein Ticket für den Kunden mit Mandat, gekauft wie im echten Ablauf.
  const kunde = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: loginFehler } = await kunde.auth.signInWithPassword(CUSTOMER_MANDATE);
  if (loginFehler) throw new Error(`PROJ-53 Login für Ticketkauf: ${loginFehler.message}`);
  const { error: kaufFehler } = await kunde.rpc("purchase_event_ticket", {
    p_event_id: idVon("e2e53-bachata-workshop"),
    p_payment_method: "onsite",
    p_wants_student_price: false,
    p_terms_accepted: true,
    p_terms_version: AGB_VERSION,
  });
  if (kaufFehler) throw new Error(`PROJ-53 Ticketkauf: ${kaufFehler.message}`);
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

test.describe("PROJ-53: Veranstaltungsprogramm", () => {
  test("Übersicht: „Besondere Events“ mit Eventart, Ort, Preis und Status — ohne Serien kein Bereich „Regelmäßig“", async ({
    page,
  }) => {
    await gehZu(page, "/events");
    await expect(page.getByRole("heading", { level: 1, name: "Events & Partys" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Besondere Events" })).toBeVisible();
    await expect(page.getByText("Regelmäßig", { exact: true })).toHaveCount(0);

    const party = karte(page, "E2E53 Salsa Party");
    await expect(party.getByText("E2E53 Party", { exact: true })).toBeVisible();
    await expect(party.getByText("Studio Saal 1")).toBeVisible();
    await expect(party.getByText(/12,00/)).toBeVisible();
    await expect(party.getByText("Eintritt vor Ort")).toBeVisible();
    await expect(party.getByRole("button", { name: "Ticket kaufen" })).toHaveCount(0);
    await expect(party.getByText(/Die Party am Samstag/)).toHaveClass(/line-clamp-3/);

    await expect(karte(page, "E2E53 Bachata Workshop").getByText(/Noch \d+ Plätze frei/)).toBeVisible();
  });

  test("Filter nach Eventart: nur passende Events, Auswahl in der Adresse, keine Art ohne kommende Events", async ({
    page,
  }) => {
    await gehZu(page, "/events");
    await page.waitForTimeout(1500);
    const filter = page.getByRole("navigation", { name: "Nach Eventart filtern" });
    await expect(filter.getByRole("link", { name: "E2E53 Vergangen-Art" })).toHaveCount(0);

    await filter.getByRole("link", { name: "E2E53 Party", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`art=${arten.party}`));
    await expect(page.getByRole("link", { name: "E2E53 Salsa Party", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "E2E53 Bachata Workshop", exact: true })).toHaveCount(0);
    await expect(filter.getByRole("link", { name: "E2E53 Party", exact: true })).toHaveAttribute("aria-current", "true");

    // Ein geteilter Link öffnet denselben Filter.
    await page.reload();
    await expect(page.getByRole("link", { name: "E2E53 Salsa Party", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "E2E53 Bachata Workshop", exact: true })).toHaveCount(0);
  });

  test("Filter ohne Treffer: Hinweis und „Filter zurücksetzen“", async ({ page }) => {
    await gehZu(page, `/events?art=${arten.vergangen}`);
    await expect(page.getByText("Für diese Eventart gibt es gerade keine kommenden Events.")).toBeVisible();
    await page.waitForTimeout(1500);
    await page.getByRole("link", { name: "Filter zurücksetzen" }).click();
    await expect(page).toHaveURL(/\/events$/);
    await expect(page.getByRole("link", { name: "E2E53 Bachata Workshop", exact: true })).toBeVisible();
  });

  test("Karte führt zur Eventseite; dort steht die Beschreibung vollständig mit Absätzen", async ({ page }) => {
    await gehZu(page, "/events");
    await page.waitForTimeout(1500);
    await page.getByRole("link", { name: "E2E53 Salsa Party", exact: true }).click();
    await page.waitForURL(/\/events\/e2e53-salsa-party$/, { timeout: 15000 });

    await expect(page.getByRole("heading", { level: 1, name: "E2E53 Salsa Party" })).toBeVisible();
    await expect(page.getByText(/Ende der Beschreibung\./)).toBeVisible();
    await expect(page.getByText(/Die Party am Samstag/)).toHaveClass(/whitespace-pre-line/);
  });

  test("Event ohne Ort und Preis zeigt keine leeren Zeilen", async ({ page }) => {
    await gehZu(page, "/events");
    const ohneOrt = karte(page, "E2E53 Ohne Ort");
    await expect(ohneOrt).toBeVisible();
    await expect(ohneOrt.getByText("€")).toHaveCount(0);
    await expect(ohneOrt.locator("svg.lucide-map-pin")).toHaveCount(0);
  });

  test("Unbekannte Eventadresse zeigt „nicht gefunden“", async ({ page }) => {
    const antwort = await page.goto("/events/gibt-es-nicht-e2e53");
    expect(antwort?.status()).toBe(404);
  });

  test("Frühere Adresse leitet dauerhaft auf die aktuelle weiter", async ({ page }) => {
    const antwort = await page.request.get("/events/e2e53-alter-name", { maxRedirects: 0 });
    expect(antwort.status()).toBe(308);
    expect(antwort.headers()["location"]).toMatch(/\/events\/e2e53-umbenanntes-event$/);

    await gehZu(page, "/events/e2e53-alter-name");
    await expect(page).toHaveURL(/\/events\/e2e53-umbenanntes-event$/);
  });

  test("Abgesagtes und vergangenes Event zeigen einen Hinweis statt Kaufknopf und fehlen in der Übersicht", async ({
    page,
  }) => {
    await gehZu(page, "/events/e2e53-abgesagtes-event");
    await expect(page.getByText("Dieses Event wurde abgesagt.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ticket kaufen" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Zum Ticket-Kauf einloggen" })).toHaveCount(0);

    await gehZu(page, "/events/e2e53-vergangenes-event");
    await expect(page.getByText("Dieses Event hat bereits stattgefunden.")).toBeVisible();

    await gehZu(page, "/events");
    await expect(page.getByRole("link", { name: "E2E53 Abgesagtes Event" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "E2E53 Vergangenes Event" })).toHaveCount(0);
  });

  test("Laufendes Event ist noch kaufbar, und der Kaufdialog nennt die abgelaufene Stornofrist", async ({ page }) => {
    await login(page, CUSTOMER_NOMANDATE);
    await gehZu(page, "/events/e2e53-laufender-workshop");
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Ticket kaufen" }).click();
    await expect(page.getByRole("dialog").getByText(/Die Frist zum Stornieren ist schon abgelaufen/)).toBeVisible();
  });

  test("Kunde mit Ticket sieht „Du hast ein Ticket“ und landet über „Zum Ticket“ im geöffneten Ticket-Abschnitt", async ({
    page,
  }) => {
    await login(page, CUSTOMER_MANDATE);
    await gehZu(page, "/events/e2e53-bachata-workshop");
    await expect(page.getByText("Du hast ein Ticket")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ticket kaufen" })).toHaveCount(0);

    await page.waitForTimeout(1500);
    await page.getByRole("link", { name: "Zum Ticket" }).click();
    await page.waitForURL(/\/profil#tickets$/, { timeout: 15000 });
    await expect(page.locator("#tickets")).toHaveAttribute("data-state", "open");
    await expect(page.getByText("E2E53 Bachata Workshop").first()).toBeVisible();
  });

  test("Englisch: Wer zum Kaufen einloggt, kehrt auf dieselbe englische Eventseite zurück", async ({ page }) => {
    await gehZu(page, "/en/events/e2e53-bachata-workshop");
    await page.waitForTimeout(1500);
    await page.getByRole("link", { name: "Log in to buy a ticket" }).click();
    await page.waitForURL(/\/en\/login\?redirect=/, { timeout: 15000 });

    await page.waitForTimeout(1200);
    await page.getByLabel("Email").fill(CUSTOMER_NOMANDATE.email);
    await page.getByLabel("Password", { exact: true }).fill(CUSTOMER_NOMANDATE.password);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(/\/en\/events\/e2e53-bachata-workshop$/, { timeout: 20000 });
  });

  test("Englische Eventseite: feste Texte englisch, Namen wie eingegeben", async ({ page }) => {
    await gehZu(page, "/en/events/e2e53-salsa-party");
    await expect(page.getByRole("heading", { level: 1, name: "E2E53 Salsa Party" })).toBeVisible();
    await expect(page.getByText("Pay at the door")).toBeVisible();
    await expect(page.getByRole("link", { name: "All events" })).toBeVisible();
    await expect(page.getByText("E2E53 Party", { exact: true })).toBeVisible();
    await expect(page.getByText("Eintritt vor Ort")).toHaveCount(0);
  });

  test("Eventseite liefert Seitentitel, Link-Vorschau und Event-Daten für Google", async ({ page }) => {
    await gehZu(page, "/events/e2e53-bachata-workshop");
    await expect(page).toHaveTitle("E2E53 Bachata Workshop · Vienna Salsa Studio");
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "E2E53 Bachata Workshop");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/events\/e2e53-bachata-workshop$/);

    const roh = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(JSON.parse(roh ?? "{}")).toMatchObject({
      "@type": "Event",
      name: "E2E53 Bachata Workshop",
      eventStatus: "https://schema.org/EventScheduled",
      offers: { price: 30, priceCurrency: "EUR" },
    });
  });

  test("Sicherheit: Ein Skript im Eventnamen oder in der Beschreibung wird nicht ausgeführt", async ({ page }) => {
    await gehZu(page, "/events/e2e53-xss");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("<script>");
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();

    const roh = await page.locator('script[type="application/ld+json"]').first().innerHTML();
    expect(roh).not.toContain("</script>");
    expect(roh).toContain("\\u003c");
  });

  test("Mein Bereich: Events führen zur Eventseite, „Nur anzeigen“ steht als „Eintritt vor Ort“", async ({ page }) => {
    await login(page, CUSTOMER_MANDATE);
    await gehZu(page, "/mein-bereich");
    const abschnitt = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: /Diese Woche im Studio|Demnächst im Studio/ }) });
    const zeile = abschnitt.locator("li").filter({ hasText: "E2E53 Salsa Party" });
    await expect(zeile.getByText("Eintritt vor Ort")).toBeVisible();

    await page.waitForTimeout(1500);
    await zeile.getByRole("link", { name: /E2E53 Salsa Party/ }).click();
    await page.waitForURL(/\/events\/e2e53-salsa-party$/, { timeout: 15000 });
  });

  test("Profil-Anker öffnen den passenden Abschnitt", async ({ page }) => {
    await login(page, CUSTOMER_NOMANDATE);
    await gehZu(page, "/profil#zahlungsmethode");
    await expect(page.locator("#zahlungsmethode")).toHaveAttribute("data-state", "open");
    await expect(page.locator("#abo")).toHaveAttribute("data-state", "closed");
  });

  test("Admin: Eventarten anlegen, umbenennen, löschen — gesperrt, solange Events zugeordnet sind", async ({ page }) => {
    await login(page, ADMIN);
    await gehZu(page, "/admin/eventarten");
    await page.waitForTimeout(1200);

    await page.getByRole("button", { name: "Neue Eventart" }).click();
    await page.getByRole("dialog").getByLabel("Name").fill("E2E53 Temp-Art");
    await page.getByRole("dialog").getByRole("button", { name: "Speichern" }).click();
    const zeile = page.getByRole("row", { name: /E2E53 Temp-Art/ });
    await expect(zeile).toBeVisible();

    await zeile.getByRole("button", { name: "Umbenennen" }).click();
    await page.getByRole("dialog").getByLabel("Name").fill("E2E53 Temp-Art Neu");
    await page.getByRole("dialog").getByRole("button", { name: "Speichern" }).click();
    const umbenannt = page.getByRole("row", { name: /E2E53 Temp-Art Neu/ });
    await expect(umbenannt).toBeVisible();

    await umbenannt.getByRole("button", { name: "Löschen" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Löschen" }).click();
    await expect(page.getByRole("row", { name: /E2E53 Temp-Art/ })).toHaveCount(0);

    // In Benutzung: kein Löschen-Knopf, stattdessen die Zahl der Events.
    await page.getByRole("row", { name: /E2E53 Party/ }).getByRole("button", { name: "Löschen" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText("Eventart wird noch verwendet")).toBeVisible();
    await expect(dialog.getByText(/Events zugeordnet/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Löschen" })).toHaveCount(0);
  });

  test("Admin: „Nur anzeigen“ ist mit verkauften Tickets gesperrt — mit Anzahl", async ({ page }) => {
    await login(page, ADMIN);
    await gehZu(page, "/admin/events");
    await page.waitForTimeout(1200);
    await page.getByRole("row", { name: /E2E53 Bachata Workshop/ }).getByRole("button", { name: "Bearbeiten" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: /Nur anzeigen/ }).click();
    await dialog.getByRole("button", { name: "Speichern" }).click();
    await expect(dialog.getByText(/ist schon 1 Ticket verkauft/)).toBeVisible();
  });

  test("Admin: Event mit Eventart und „Nur anzeigen“ ohne Kapazität anlegen; Umbenennen leitet die alte Adresse weiter", async ({
    page,
  }) => {
    await login(page, ADMIN);
    await gehZu(page, "/admin/events");
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: "Event anlegen" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name", { exact: true }).fill("E2E53 Admin Party");
    await dialog.getByLabel("Beginn").fill(lokalInStunden(24 * 20));
    await dialog.getByRole("radio", { name: /Nur anzeigen/ }).click();

    // Ohne Eventart wird nicht gespeichert.
    await dialog.getByRole("button", { name: "Speichern" }).click();
    await expect(dialog.getByText("Bitte eine Eventart wählen")).toBeVisible();

    await dialog.getByRole("combobox", { name: "Eventart" }).click();
    await page.getByRole("option", { name: "E2E53 Party", exact: true }).click();
    await dialog.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Event angelegt.")).toBeVisible();

    const zeile = page.getByRole("row", { name: /E2E53 Admin Party/ });
    await expect(zeile.getByText("Nur anzeigen")).toBeVisible();
    expect((await page.request.get("/events/e2e53-admin-party")).status()).toBe(200);

    await zeile.getByRole("button", { name: "Bearbeiten" }).click();
    await page.getByRole("dialog").getByLabel("Name", { exact: true }).fill("E2E53 Admin Party Neu");
    await page.getByRole("dialog").getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Event gespeichert.")).toBeVisible();

    await gehZu(page, "/events/e2e53-admin-party");
    await expect(page).toHaveURL(/\/events\/e2e53-admin-party-neu$/);
  });
});
