import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

// The Playwright runner doesn't auto-load .env.local (unlike `next dev`), but
// the fixture reset below needs SUPABASE_SERVICE_ROLE_KEY.
try {
  ladeTestUmgebung();
} catch {
  // Already loaded (e.g. CI env vars set directly) — safe to ignore.
}

const CUSTOMER = { email: "e2e12-a@viennasalsastudio.test", password: "CorrectPassword123!" };
const COURSE = "E2E41 Kurs Standardpreis";

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function customerId(): Promise<string> {
  const { data } = await service.auth.admin.listUsers({ perPage: 200 });
  const user = data.users.find((u) => u.email === CUSTOMER.email);
  if (!user) throw new Error("PROJ-43 Fixture-Kunde fehlt");
  return user.id;
}

// Ohne Reset vor *jedem* Test schleppt die am Konto gespeicherte Sprache aus
// einem früheren Test in den nächsten. Es gibt keine Staging-Datenbank.
test.beforeEach(async () => {
  await service.from("profiles").update({ language: null }).eq("id", await customerId());
});

test.afterAll(async () => {
  await service.from("profiles").update({ language: null }).eq("id", await customerId());
  const { data: course } = await service.from("courses").select("id").eq("name", COURSE).single();
  if (course) await service.from("course_bookings").delete().eq("course_id", course.id);
});

async function login(page: Page, pfad = "/login") {
  await page.goto(pfad);
  await page.waitForTimeout(1000); // let hydration settle, see PROJ-2 BUG-1
  await page.getByLabel(/^(E-Mail|Email)$/).fill(CUSTOMER.email);
  await page.getByLabel(/^(Passwort|Password)$/).fill(CUSTOMER.password);
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /^(Einloggen|Log in)$/ }).click();
  await page.waitForURL(/\/(en\/)?(mein-bereich|profil|admin)$/, { timeout: 15000 });
  // Seit PROJ-45 landen Kunden auf /mein-bereich. Die Prüfungen hier gelten
  // dem Profil — und zwar in der Sprache, in der der Test gerade unterwegs ist.
  if (page.url().includes("/mein-bereich")) {
    await page.goto(page.url().includes("/en/") ? "/en/profil" : "/profil");
  }
}

test.describe("PROJ-43: Englische Sprachvariante", () => {
  test.describe("Sprachwahl", () => {
    // Der Browser dieses Blocks meldet Englisch — wie bei einem
    // internationalen Besucher.
    test.use({ locale: "en-US" });

    test("Englischer Browser landet ohne Zutun auf der englischen Fassung", async ({ page }) => {
      await page.goto("/kurse");
      await page.waitForTimeout(1200);
      expect(new URL(page.url()).pathname).toBe("/en/kurse");
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
    });
  });

  test("Deutscher Browser bleibt auf der deutschen Fassung", async ({ page }) => {
    await page.goto("/kurse");
    await page.waitForTimeout(1200);
    expect(new URL(page.url()).pathname).toBe("/kurse");
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
  });

  test("Der Umschalter bleibt auf derselben Seite und überdauert den Besuch", async ({ page }) => {
    await page.goto("/stundenplan");
    await page.waitForTimeout(1200);
    await page.getByRole("group", { name: /Sprache|Language/ }).getByRole("button", { name: "EN" }).click();
    await page.waitForTimeout(2000);
    expect(new URL(page.url()).pathname).toBe("/en/stundenplan");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    // Neuer Aufruf ohne Präfix: die Wahl gilt weiter.
    await page.goto("/kurse");
    await page.waitForTimeout(1200);
    expect(new URL(page.url()).pathname).toBe("/en/kurse");
  });

  test("Die Wahl eines eingeloggten Kunden landet am Konto", async ({ page }) => {
    await login(page);
    await page.waitForTimeout(800);
    await page.getByRole("group", { name: /Sprache|Language/ }).getByRole("button", { name: "EN" }).click();
    await page.waitForTimeout(2500);

    const { data } = await service.from("profiles").select("language").eq("id", await customerId()).single();
    expect(data!.language).toBe("en");
  });

  test("Der Umschalter wirkt in beide Richtungen (BUG-3)", async ({ page }) => {
    // Getestet wurde zunächst nur Deutsch → Englisch. Die Gegenrichtung war
    // kaputt: Die deutsche Adresse trägt kein Präfix, also entschied allein das
    // Sprach-Cookie — und das stand noch auf "en". Die Sprachweiche leitete
    // sofort auf /en zurück.
    await page.goto("/stundenplan");
    await page.waitForTimeout(1200);
    const umschalter = () => page.getByRole("group", { name: /Sprache|Language/ });

    await umschalter().getByRole("button", { name: "EN" }).click();
    await page.waitForTimeout(2500);
    expect(new URL(page.url()).pathname, "DE → EN").toBe("/en/stundenplan");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await umschalter().getByRole("button", { name: "DE" }).click();
    await page.waitForTimeout(2500);
    expect(new URL(page.url()).pathname, "EN → DE").toBe("/stundenplan");
    await expect(page.locator("html")).toHaveAttribute("lang", "de");

    // Und die Rückkehr hält: ein neuer Aufruf ohne Präfix bleibt deutsch.
    await page.goto("/kurse");
    await page.waitForTimeout(1200);
    expect(new URL(page.url()).pathname, "bleibt deutsch").toBe("/kurse");
  });

  test("Der Umschalter ist auch auf dem Handy erreichbar und wirkt (BUG-1)", async ({ page }) => {
    // Er stand zunächst nur in der Desktop-Leiste: unter 768 px war die
    // Sprachwahl gar nicht zu erreichen.
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/stundenplan");
    await page.waitForTimeout(1200);

    // In der schmalen Ansicht führt der Weg über das Menü.
    await expect(page.getByRole("group", { name: /Sprache|Language/ })).toHaveCount(0);
    await page.getByRole("button", { name: /Menü öffnen|Open menu/ }).click();
    await page.waitForTimeout(500);

    const umschalter = page.getByRole("group", { name: /Sprache|Language/ });
    await expect(umschalter).toBeVisible();
    await umschalter.getByRole("button", { name: "EN" }).click();
    await page.waitForTimeout(2500);

    expect(new URL(page.url()).pathname).toBe("/en/stundenplan");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    // Und zurück — die Richtung, die zuerst nicht funktionierte (BUG-3).
    await page.getByRole("button", { name: /Menü öffnen|Open menu/ }).click();
    await page.waitForTimeout(500);
    await page.getByRole("group", { name: /Sprache|Language/ }).getByRole("button", { name: "DE" }).click();
    await page.waitForTimeout(2500);
    expect(new URL(page.url()).pathname, "am Handy zurück auf Deutsch").toBe("/stundenplan");
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
  });

  test("Deutsche Adressen bleiben unverändert erreichbar", async ({ page }) => {
    for (const pfad of ["/", "/kurse", "/stundenplan", "/events", "/agb", "/datenschutz", "/impressum", "/login"]) {
      const antwort = await page.goto(pfad);
      expect(antwort?.status(), `${pfad} muss erreichbar bleiben`).toBe(200);
      expect(new URL(page.url()).pathname, `${pfad} darf nicht umgeleitet werden`).toBe(pfad);
    }
  });

  test("Eine erfundene Sprache in der Adresse führt ins Leere statt irgendwohin", async ({ page }) => {
    for (const pfad of ["/xx/kurse", "/de-DE/kurse", "/en-US/kurse"]) {
      const antwort = await page.goto(pfad);
      expect(antwort?.status(), pfad).toBe(404);
    }
  });

  test("Die Navigation verlinkt Mitarbeiterbereiche ohne Sprachpräfix (BUG-2)", async ({ page }) => {
    // Sie liegen außerhalb der Sprachebene: ein Link auf /en/admin führte ins
    // Leere. Der Betreiber sah in der englischen Fassung eine Seite, die es
    // nicht gibt.
    await page.goto("/login");
    await page.waitForTimeout(1000);
    await page.getByLabel(/^(E-Mail|Email)$/).fill("e2e8-admin@viennasalsastudio.test");
    await page.getByLabel(/^(Passwort|Password)$/).fill("CorrectPassword123!");
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /^(Einloggen|Log in)$/ }).click();
    await page.waitForURL(/\/(en\/)?(mein-bereich|profil|admin)$/, { timeout: 15000 });

    await page.goto("/en/kurse");
    await page.waitForTimeout(1500);
    const navigation = page.getByRole("navigation").first();
    for (const [name, ziel] of [
      ["Admin", "/admin"],
      ["Check-in", "/checkin"],
    ] as const) {
      const link = navigation.getByRole("link", { name });
      await expect(link, name).toHaveAttribute("href", ziel);
    }

    // Und der Klick landet tatsächlich dort, statt auf einer 404.
    const antwort = await page.goto("/admin");
    expect(antwort?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe("/admin");
  });

  test("Mitarbeiterbereiche haben keine Sprachebene", async ({ page }) => {
    for (const pfad of ["/en/lehrer", "/en/checkin", "/en/admin"]) {
      const antwort = await page.goto(pfad);
      expect(antwort?.status(), pfad).toBe(404);
    }
  });

  test.describe("Englische Oberfläche", () => {
    test.use({ locale: "en-US" });

    test("Kundenbereich ist durchgehend englisch", async ({ page }) => {
      await page.goto("/en/kurse");
      await page.waitForTimeout(1500);
      await expect(page.getByRole("heading", { name: "Classes" })).toBeVisible();
      await expect(page.getByText("All levels")).toBeVisible();

      await page.goto("/en/stundenplan");
      await page.waitForTimeout(1200);
      await expect(page.getByRole("tab", { name: "Monday" })).toBeVisible();

      await page.goto("/en/events");
      await page.waitForTimeout(1200);
      await expect(page.getByRole("heading", { name: "Events & workshops" })).toBeVisible();
    });

    test("Beträge folgen der Sprache, die Währung bleibt Euro", async ({ page }) => {
      await page.goto("/en/kurse");
      await page.waitForTimeout(1500);
      const karte = page
        .locator(".rounded-lg.border.bg-card")
        .filter({ has: page.getByText("Salsa Beginner 1", { exact: true }) });
      const text = (await karte.textContent()) ?? "";
      expect(text).toContain("€60.00");
      expect(text).not.toContain("60,00");
    });

    test("Buchungsdialog und AGB-Zustimmung sind englisch, der Link führt zur englischen Fassung", async ({
      page,
    }) => {
      await login(page, "/en/login");
      await page.goto("/en/kurse");
      await page.waitForTimeout(1800);
      const more = page.getByRole("button", { name: /Load more/ });
      for (let i = 0; i < 10 && (await more.count()) > 0; i++) {
        await more.click();
        await page.waitForTimeout(400);
      }
      await page
        .locator(".rounded-lg.border.bg-card")
        .filter({ has: page.getByText(COURSE, { exact: true }) })
        .getByRole("button", { name: "Book now" })
        .click();
      await page.waitForTimeout(700);
      await page.getByRole("tab", { name: "Enrol" }).click();
      await page.waitForTimeout(700);

      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("This class only");
      await expect(dialog).toContainText("I have read and accept the");
      await expect(dialog.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/en/agb");
      await expect(page.getByRole("button", { name: "Book — legally binding" })).toBeVisible();
    });

    test("Profil ist englisch, inklusive Benachrichtigungs-Einstellungen", async ({ page }) => {
      await login(page, "/en/login");
      await page.waitForTimeout(1500);
      await expect(page.getByText("My profile", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Payment method")).toBeVisible();
      await page.getByRole("button", { name: "Notifications" }).click();
      await page.waitForTimeout(900);
      await expect(page.getByText("Booking status")).toBeVisible();
      await expect(page.getByText("Class start reminder")).toBeVisible();
    });
  });

  test.describe("Rechtstexte", () => {
    test.use({ locale: "en-US" });

    test("Die AGB erscheinen auf Englisch, mit Hinweis auf die verbindliche Fassung", async ({ page }) => {
      await page.goto("/en/agb");
      await page.waitForTimeout(1200);
      await expect(page.getByRole("heading", { name: "Terms and Conditions" })).toBeVisible();
      await expect(page.getByText("The German version is the legally binding one")).toBeVisible();
      await expect(page.getByText("2. Memberships and term")).toBeVisible();
      // Der Rücktritts-Abschnitt gibt § 4 der deutschen AGB wieder, statt ein
      // Recht zu behaupten, das dort ausgeschlossen ist.
      await expect(page.getByText("no statutory 14-day right of withdrawal")).toBeVisible();
    });

    test("Datenschutz und Impressum bleiben deutsch, mit englischem Hinweis", async ({ page }) => {
      for (const pfad of ["/en/datenschutz", "/en/impressum"]) {
        await page.goto(pfad);
        await page.waitForTimeout(1000);
        await expect(page.getByText("This page is only available in German"), pfad).toBeVisible();
      }
    });

  });

  test("Die deutsche AGB-Fassung trägt keinen Hinweis — sie ist die verbindliche", async ({ page }) => {
    // Bewusst außerhalb des englischen Blocks: Mit englischem Browser würde
    // /agb auf /en/agb umgeleitet, und der Test prüfte das Gegenteil dessen,
    // was seine Überschrift sagt.
    await page.goto("/agb");
    await page.waitForTimeout(1000);
    await expect(page.getByRole("heading", { name: "Allgemeine Geschäftsbedingungen" })).toBeVisible();
    await expect(page.getByText("This is a translation")).toHaveCount(0);
  });

  // Die Sprachwahl der Benachrichtigungen ist reine Logik und wird als
  // Unit-Test geprüft (src/lib/notifications/templates.i18n.test.ts) — der
  // Modullader von Playwright kommt mit der Importkette nicht zurecht.

  test("Der Betreiber pflegt beide Sprachfassungen einer Vorlage getrennt", async ({ page }) => {
    await page.goto("/login");
    await page.waitForTimeout(1000);
    await page.getByLabel("E-Mail").fill("e2e8-admin@viennasalsastudio.test");
    await page.getByLabel("Passwort").fill("CorrectPassword123!");
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Einloggen" }).click();
    await page.waitForURL(/\/(mein-bereich|profil|admin)$/, { timeout: 15000 });

    await page.goto("/admin/benachrichtigungen/buchungsstatus_bestaetigt");
    await page.waitForTimeout(1200);
    await expect(page.locator("input").first()).toHaveValue("Buchung bestätigt: {kurs}");

    await page.getByRole("link", { name: "Englische Fassung" }).click();
    await page.waitForTimeout(1500);
    await expect(page.locator("input").first()).toHaveValue("Booking confirmed: {kurs}");
  });
});

// Nachgereicht 2026-08-26: der Anmeldebereich war noch deutsch (PROJ-43-Lücke).
test.describe("Anmeldebereich auf Englisch", () => {
  test.use({ locale: "en-GB" });

  test("Login, Passwort-vergessen und Registrieren sind englisch und bleiben englisch", async ({ page }) => {
    await page.goto("/en/login");
    await page.waitForTimeout(800);
    await expect(page.getByRole("link", { name: "Forgot your password?" })).toBeVisible();
    await expect(page.getByText("No account yet?")).toBeVisible();

    // Der Link muss die Sprache mitnehmen
    await page.getByRole("link", { name: "Forgot your password?" }).click();
    await page.waitForURL(/passwort-vergessen/, { timeout: 10000 });
    expect(page.url()).toContain("/en/passwort-vergessen");
    await expect(page.getByText("Forgot password", { exact: true })).toBeVisible();
    await expect(page.getByText("we'll send you a link")).toBeVisible();

    await page.getByRole("link", { name: "Back to log in" }).click();
    await page.waitForURL(/login/, { timeout: 10000 });
    expect(page.url()).toContain("/en/login");

    await page.getByRole("link", { name: "Sign up" }).click();
    await page.waitForURL(/registrieren/, { timeout: 10000 });
    expect(page.url()).toContain("/en/registrieren");
    await expect(page.getByText("Already have an account?")).toBeVisible();

    // Ungültiger Rücksetz-Link, ohne Anmeldung
    await page.goto("/en/passwort-zuruecksetzen");
    await page.waitForTimeout(800);
    await expect(page.getByText("Set a new password", { exact: true })).toBeVisible();
    await expect(page.getByText("This link is invalid or has expired.")).toBeVisible();
  });
});

test.describe("Deutsch bleibt unberührt", () => {
  test.use({ locale: "de-DE" });
  test("Deutsche Anmeldung unverändert, ohne Sprachpräfix", async ({ page }) => {
    await page.goto("/login");
    await page.waitForTimeout(800);
    await page.getByRole("link", { name: "Passwort vergessen?" }).click();
    await page.waitForURL(/passwort-vergessen/, { timeout: 10000 });
    expect(page.url()).not.toContain("/en/");
    await expect(page.getByText("Passwort vergessen", { exact: true })).toBeVisible();
    await expect(page.getByText("wir schicken dir einen Link")).toBeVisible();
  });
});

test.describe("Rücksetz-Link aus der E-Mail", () => {
  test.use({ locale: "en-GB" });
  test("Der Token überlebt die Sprachumleitung", async ({ page, context }) => {
    await context.addCookies([{ name: "NEXT_LOCALE", value: "en", domain: "localhost", path: "/" }]);
    await page.goto("/passwort-zuruecksetzen?code=abc123-token-xyz");
    await page.waitForTimeout(1200);
    console.log("GELANDET AUF:", page.url());
    expect(page.url()).toContain("code=abc123-token-xyz");
  });
});

// Designüberarbeitung 2026-08: Der Hero nennt das Angebot. Er darf nichts
// behaupten, was das Studio nicht anbietet.
test.describe("Startseite: das genannte Angebot stimmt", () => {
  test.use({ locale: "de-DE" });

  test("Kein Kizomba mehr", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
  
    // Zuerst Deutsch: Ein Besuch auf /en merkt sich die Sprache im Cookie,
    // danach wäre auch / englisch.
    await page.goto("/");
    await page.waitForTimeout(2000);
    await expect(page.getByText("Salsa und Bachata in Wien")).toBeVisible();
  
    for (const pfad of ["/", "/kurse", "/stundenplan", "/events", "/en"]) {
      await page.goto(pfad);
      await page.waitForTimeout(1500);
      const text = await page.locator("body").innerText();
      expect(text, pfad + " enthält Kizomba").not.toContain("Kizomba");
    }
    await expect(page.getByText("Salsa and Bachata in Vienna")).toBeVisible();
  });
});
