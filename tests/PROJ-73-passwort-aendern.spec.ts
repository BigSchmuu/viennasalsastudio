import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { gehZu } from "./navigation";
import { ladeTestUmgebung } from "./env";
import { totpCode, restDesFensters } from "./totp";

try {
  ladeTestUmgebung();
} catch {
  // Schon geladen — unkritisch.
}

const URL_DB = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const ALT = "AltesPasswort2026";
const NEU = "NeuesPasswort2027";

let service: SupabaseClient;

/**
 * Jeder Test bekommt sein eigenes Konto. Zwei der Tests ändern ein Passwort —
 * ein gemeinsames Konto hieße, dass die Reihenfolge der Tests über ihr Ergebnis
 * entscheidet.
 */
async function kontoAnlegen(mail: string, rolle: "customer" | "admin" = "customer"): Promise<string> {
  const { data: alle } = await service.auth.admin.listUsers({ perPage: 400 });
  const alt = alle.users.find((u) => u.email === mail);
  if (alt) await service.auth.admin.deleteUser(alt.id);

  const { data, error } = await service.auth.admin.createUser({
    email: mail,
    password: ALT,
    email_confirm: true,
  });
  if (error) throw error;
  if (rolle === "admin") {
    await service.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  }
  return data.user.id;
}

async function kontoLoeschen(mail: string): Promise<void> {
  const { data: alle } = await service.auth.admin.listUsers({ perPage: 400 });
  const konto = alle.users.find((u) => u.email === mail);
  if (konto) await service.auth.admin.deleteUser(konto.id);
}

async function anmelden(page: Page, mail: string, passwort: string): Promise<void> {
  await gehZu(page, "/login");
  // Erst hydrieren lassen — siehe docs/troubleshooting-tests.md.
  await page.waitForTimeout(1200);
  await page.getByLabel(/e-?mail/i).fill(mail);
  await page.getByLabel(/^Passwort$/).fill(passwort);
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Einloggen" }).click();
}

/**
 * Den Abschnitt im Profil aufklappen und die drei Felder füllen.
 *
 * Die Felder werden über ihren Namen im Formular angesprochen, nicht über ihre
 * Beschriftung: Der aufgeklappte Bereich trägt Titel *und* Hinweis als
 * Beschriftung („Passwort ändern Neues Passwort für die Anmeldung festlegen"),
 * und „Neues Passwort" passt damit auf zwei Elemente.
 */
async function formularAusfuellen(
  page: Page,
  aktuell: string,
  neu: string,
  wiederholung = neu,
  titel: RegExp = /Passwort ändern/,
  knopf = "Passwort speichern"
) {
  await page.getByRole("button", { name: titel }).click();
  const abschnitt = page.getByRole("region", { name: titel });
  await abschnitt.locator('input[name="currentPassword"]').fill(aktuell);
  await abschnitt.locator('input[name="password"]').fill(neu);
  await abschnitt.locator('input[name="confirmPassword"]').fill(wiederholung);
  await abschnitt.getByRole("button", { name: knopf }).click();
}

test.beforeAll(async () => {
  service = createClient(URL_DB, SERVICE, { auth: { persistSession: false } });
});

test.describe("PROJ-73: Passwort selbst ändern", () => {
  test("Ein Kunde ändert sein Passwort im Profil und meldet sich damit neu an", async ({ page }) => {
    const mail = "qa-proj73-kunde@viennasalsastudio.test";
    await kontoAnlegen(mail);

    await anmelden(page, mail, ALT);
    await page.waitForURL(/\/(mein-bereich|profil)$/, { timeout: 20000 });
    await gehZu(page, "/profil");
    await page.waitForTimeout(1200);

    await formularAusfuellen(page, ALT, NEU);
    await expect(page.getByText(/Dein Passwort ist geändert/)).toBeVisible({ timeout: 20000 });

    // Der eigentliche Beleg: Das neue Passwort trägt, das alte nicht mehr.
    await gehZu(page, "/profil");
    await page.getByRole("button", { name: "Logout" }).last().click();
    await page.waitForTimeout(1500);

    await anmelden(page, mail, ALT);
    await expect(page.getByText(/E-Mail oder Passwort/i)).toBeVisible({ timeout: 20000 });

    await anmelden(page, mail, NEU);
    await page.waitForURL(/\/(mein-bereich|profil)$/, { timeout: 20000 });

    await kontoLoeschen(mail);
  });

  test("Ein falsches aktuelles Passwort ändert nichts", async ({ page }) => {
    const mail = "qa-proj73-falsch@viennasalsastudio.test";
    await kontoAnlegen(mail);

    await anmelden(page, mail, ALT);
    await page.waitForURL(/\/(mein-bereich|profil)$/, { timeout: 20000 });
    await gehZu(page, "/profil");
    await page.waitForTimeout(1200);

    await formularAusfuellen(page, "FalschesPasswort2026", NEU);
    await expect(page.getByText("Das aktuelle Passwort stimmt nicht.")).toBeVisible({
      timeout: 20000,
    });

    // Und das alte Passwort gilt weiterhin — die Meldung allein belegt das nicht.
    const pruef = createClient(URL_DB, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { error } = await pruef.auth.signInWithPassword({ email: mail, password: ALT });
    expect(error).toBeNull();

    await kontoLoeschen(mail);
  });

  test("Eine abweichende Wiederholung wird abgewiesen", async ({ page }) => {
    const mail = "qa-proj73-wiederholung@viennasalsastudio.test";
    await kontoAnlegen(mail);

    await anmelden(page, mail, ALT);
    await page.waitForURL(/\/(mein-bereich|profil)$/, { timeout: 20000 });
    await gehZu(page, "/profil");
    await page.waitForTimeout(1200);

    await formularAusfuellen(page, ALT, NEU, "NochEinAnderes2027");
    await expect(page.getByText(/stimmen nicht überein/)).toBeVisible({ timeout: 20000 });

    await kontoLoeschen(mail);
  });

  test("Andere Geräte sind nach der Änderung abgemeldet", async ({ page, browser }) => {
    const mail = "qa-proj73-geraete@viennasalsastudio.test";
    await kontoAnlegen(mail);

    // Das zweite „Gerät": ein eigener Browserkontext mit eigenen Cookies.
    const zweites = await browser.newContext();
    const andereSeite = await zweites.newPage();
    await anmelden(andereSeite, mail, ALT);
    await andereSeite.waitForURL(/\/(mein-bereich|profil)$/, { timeout: 20000 });

    await anmelden(page, mail, ALT);
    await page.waitForURL(/\/(mein-bereich|profil)$/, { timeout: 20000 });
    await gehZu(page, "/profil");
    await page.waitForTimeout(1200);
    await formularAusfuellen(page, ALT, NEU);
    await expect(page.getByText(/Dein Passwort ist geändert/)).toBeVisible({ timeout: 20000 });

    // Das zweite Gerät kommt nicht mehr ins Profil.
    await andereSeite.goto("/profil");
    await expect(andereSeite).toHaveURL(/\/login/, { timeout: 20000 });

    // Das eigene Gerät dagegen schon — es bleibt angemeldet.
    await gehZu(page, "/profil");
    await expect(page.getByText(mail)).toBeVisible({ timeout: 20000 });

    await zweites.close();
    await kontoLoeschen(mail);
  });

  test("Auf der englischen Seite steht der Abschnitt auf Englisch", async ({ page }) => {
    const mail = "qa-proj73-englisch@viennasalsastudio.test";
    await kontoAnlegen(mail);

    await anmelden(page, mail, ALT);
    await page.waitForURL(/\/(mein-bereich|profil)$/, { timeout: 20000 });
    await gehZu(page, "/en/profil");
    await page.waitForTimeout(1200);

    const abschnitt = page.getByRole("region", { name: /Change password/ });
    await formularAusfuellen(
      page,
      "FalschesPasswort2026",
      NEU,
      NEU,
      /Change password/,
      "Save password"
    );
    // Die Beschriftungen selbst sind der Punkt dieses Tests.
    await expect(abschnitt.getByText("Current password")).toBeVisible();
    await expect(abschnitt.getByText("New password")).toBeVisible();

    // Die Fehlermeldung kommt vom Server — sie war der Grund für die
    // Schlüssel statt fertiger Sätze (lib/auth/fehler.ts).
    await expect(page.getByText("That's not your current password.")).toBeVisible({
      timeout: 20000,
    });

    await kontoLoeschen(mail);
  });

  // Der gemeldete Fall: Ein Verwaltungskonto kam über „Passwort vergessen"
  // nie am Formular an, weil die Code-Seite fest ins Dashboard führte.
  test("Ein Verwaltungskonto kommt über Mail-Link und Code zum Passwortformular", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const mail = "qa-proj73-admin@viennasalsastudio.test";
    await kontoAnlegen(mail, "admin");

    // Zweite Stufe einrichten wie ein Mensch — Supabase kann das nicht von
    // außen (siehe tests/zweite-stufe.ts).
    const alsKonto = createClient(URL_DB, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { error: anmeldeFehler } = await alsKonto.auth.signInWithPassword({
      email: mail,
      password: ALT,
    });
    expect(anmeldeFehler).toBeNull();
    const { data: eingerichtet, error: enrollFehler } = await alsKonto.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "PROJ-73",
    });
    expect(enrollFehler).toBeNull();
    const geheim = eingerichtet!.totp.secret;
    const { error: pruefFehler } = await alsKonto.auth.mfa.challengeAndVerify({
      factorId: eingerichtet!.id,
      code: totpCode(geheim),
    });
    expect(pruefFehler).toBeNull();

    // Denselben Link erzeugen, den die „Passwort vergessen"-Mail trägt.
    const { data: link, error: linkFehler } = await service.auth.admin.generateLink({
      type: "recovery",
      email: mail,
    });
    expect(linkFehler).toBeNull();
    const token = link!.properties!.hashed_token;

    await gehZu(
      page,
      `/bestaetigen?token_hash=${token}&type=recovery&next=%2Fpasswort-zuruecksetzen`
    );
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: /Neues Passwort festlegen|Passwort/ }).first().click();

    // Vorher endete der Weg hier im Dashboard. Jetzt trägt die Code-Seite das
    // Ziel mit sich.
    await page.waitForURL(/\/sicherheit\/code/, { timeout: 30000 });
    expect(page.url()).toContain("weiter=%2Fpasswort-zuruecksetzen");

    if (restDesFensters() < 3000) {
      await page.waitForTimeout(restDesFensters() + 200);
    }
    await page.getByRole("textbox").first().fill(totpCode(geheim));
    await page.getByRole("button", { name: "Weiter" }).click();

    await page.waitForURL(/\/passwort-zuruecksetzen/, { timeout: 30000 });
    await page.waitForTimeout(1200);
    await page.getByLabel("Neues Passwort").fill(NEU);
    await page.getByLabel("Passwort bestätigen").fill(NEU);
    await page.getByRole("button", { name: "Passwort speichern" }).click();

    // Und das neue Passwort trägt tatsächlich.
    await page.waitForURL(/\/profil/, { timeout: 30000 });
    const pruefen = createClient(URL_DB, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { error: neuerAnmeldefehler } = await pruefen.auth.signInWithPassword({
      email: mail,
      password: NEU,
    });
    expect(neuerAnmeldefehler).toBeNull();

    await kontoLoeschen(mail);
  });
});
