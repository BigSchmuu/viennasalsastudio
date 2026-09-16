import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";
import { gehZu } from "./navigation";
import { totpCode, restDesFensters } from "./totp";
import { zweiteStufeErledigen, schluessel } from "./zweite-stufe";

ladeTestUmgebung();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const PASSWORT = "CorrectPassword123!";

/** Frisch angelegt, damit die Prüfungen niemandem sonst den Faktor wegnehmen. */
const OHNE_APP = "e2e58-ohne-app@viennasalsastudio.test";
const ZUM_ZURUECKSETZEN = "e2e58-reset@viennasalsastudio.test";
const KUNDE = "e2e58-kunde@viennasalsastudio.test";

/** Ein bereits eingerichtetes Verwaltungskonto aus dem Lauf-Aufbau. */
const EINGERICHTET = "e2e14-admin@viennasalsastudio.test";

let dienst: SupabaseClient;
const kennungen: Record<string, string> = {};

async function legeKontoAn(mail: string, rolle: "admin" | "customer"): Promise<string> {
  const vorhanden = await dienst.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = vorhanden.data?.users.find((u) => u.email === mail);
  if (alt) await dienst.auth.admin.deleteUser(alt.id);

  const { data, error } = await dienst.auth.admin.createUser({
    email: mail,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-58 Konto ${mail}: ${error?.message}`);

  // Eindeutige Namen: Die Prüfung über die Kundenliste sucht eine bestimmte
  // Zeile, und zwei gleich benannte Konten machten den Treffer mehrdeutig.
  const name = `E2E58 ${mail.split("@")[0].replace("e2e58-", "")}`;
  await dienst.from("profiles").update({ role: rolle, full_name: name }).eq("id", data.user.id);
  return data.user.id;
}

test.beforeAll(async () => {
  dienst = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  kennungen[OHNE_APP] = await legeKontoAn(OHNE_APP, "admin");
  kennungen[ZUM_ZURUECKSETZEN] = await legeKontoAn(ZUM_ZURUECKSETZEN, "admin");
  kennungen[KUNDE] = await legeKontoAn(KUNDE, "customer");
});

test.afterAll(async () => {
  for (const kennung of Object.values(kennungen)) {
    await dienst.auth.admin.deleteUser(kennung).catch(() => {});
  }
});

async function anmelden(page: Page, mail: string) {
  await gehZu(page, "/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(mail);
  await page.getByLabel("Passwort").fill(PASSWORT);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Einloggen" }).click();
}

/** Den Schlüssel von der Einrichtungsseite ablesen und daraus einen Code bilden. */
async function codeVonDerSeite(page: Page): Promise<string> {
  await page.getByText("Die Kamera spielt nicht mit?").click();
  const roh = await page.locator("details p").first().innerText();
  const geheim = roh.replace(/\s/g, "");
  if (restDesFensters() < 3000) await page.waitForTimeout(restDesFensters() + 200);
  return totpCode(geheim);
}

test.describe("PROJ-58: Zwei-Faktor-Anmeldung für Verwaltungskonten", () => {
  test("Admin ohne App landet auf der Einrichtung und kommt nirgendwo sonst hin", async ({ page }) => {
    await anmelden(page, OHNE_APP);
    await page.waitForURL(/\/sicherheit\/einrichten/, { timeout: 20000 });

    // Auch nicht in die Verwaltung und nicht in den eigenen Kundenbereich —
    // so hat der Betreiber es entschieden.
    await gehZu(page, "/admin");
    await expect(page).toHaveURL(/\/sicherheit\/einrichten/);
    await gehZu(page, "/profil");
    await expect(page).toHaveURL(/\/sicherheit\/einrichten/);
  });

  test("Einrichtung zeigt QR-Code und denselben Schlüssel zum Abtippen", async ({ page }) => {
    await anmelden(page, OHNE_APP);
    await page.waitForURL(/\/sicherheit\/einrichten/, { timeout: 20000 });

    await expect(page.getByRole("img", { name: /QR-Code/ })).toBeVisible();
    await page.getByText("Die Kamera spielt nicht mit?").click();
    // Base32 in Vierergruppen — nichts anderes darf dort stehen.
    await expect(page.locator("details p").first()).toHaveText(/^[A-Z2-7]{4}( [A-Z2-7]{2,4})+$/);
  });

  test("Falscher Code bei der Einrichtung: Meldung, und derselbe QR-Code bleibt gültig", async ({ page }) => {
    await anmelden(page, OHNE_APP);
    await page.waitForURL(/\/sicherheit\/einrichten/, { timeout: 20000 });

    const vorher = await page.getByRole("img", { name: /QR-Code/ }).getAttribute("src");
    await page.getByRole("textbox").first().fill("000000");
    await page.getByRole("button", { name: "Einrichtung abschließen" }).click();

    await expect(page.getByText(/Der Code stimmt nicht/)).toBeVisible({ timeout: 15000 });
    expect(await page.getByRole("img", { name: /QR-Code/ }).getAttribute("src")).toBe(vorher);
  });

  test("Einrichtung mit gültigem Code führt in die Verwaltung", async ({ page }) => {
    await anmelden(page, ZUM_ZURUECKSETZEN);
    await page.waitForURL(/\/sicherheit\/einrichten/, { timeout: 20000 });

    await page.getByRole("textbox").first().fill(await codeVonDerSeite(page));
    await page.getByRole("button", { name: "Einrichtung abschließen" }).click();
    await page.waitForURL(/\/admin$/, { timeout: 20000 });
    await expect(page.getByRole("heading", { name: "Verwaltung" })).toBeVisible();
  });

  test("Admin mit App wird nach dem Passwort nach dem Code gefragt", async ({ page }) => {
    await anmelden(page, EINGERICHTET);
    await page.waitForURL(/\/sicherheit\/code/, { timeout: 20000 });
    await expect(page.getByRole("heading", { name: "Code bestätigen" })).toBeVisible();

    // Ohne Code kommt niemand weiter, auch nicht über die Adresszeile.
    await gehZu(page, "/admin");
    await expect(page).toHaveURL(/\/sicherheit\/code/);
  });

  test("Falscher Code beim Anmelden wird abgewiesen", async ({ page }) => {
    await anmelden(page, EINGERICHTET);
    await page.waitForURL(/\/sicherheit\/code/, { timeout: 20000 });

    await page.getByRole("textbox").first().fill("000000");
    await page.getByRole("button", { name: "Weiter" }).click();
    await expect(page.getByText(/Der Code stimmt nicht/)).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/\/sicherheit\/code/);
  });

  test("Ohne Häkchen endet das Vertrauen mit dem Browser, mit Häkchen gilt es 30 Tage", async ({
    page,
    context,
  }) => {
    const geheim = schluessel()[EINGERICHTET];
    expect(geheim, "Der Lauf-Aufbau muss einen Schlüssel hinterlegt haben").toBeTruthy();

    // Erst ohne Häkchen.
    await anmelden(page, EINGERICHTET);
    await page.waitForURL(/\/sicherheit\/code/, { timeout: 20000 });
    if (restDesFensters() < 3000) await page.waitForTimeout(restDesFensters() + 200);
    await page.getByRole("textbox").first().fill(totpCode(geheim));
    await page.getByRole("button", { name: "Weiter" }).click();
    await page.waitForURL(/\/admin$/, { timeout: 20000 });

    const ohne = (await context.cookies()).find((c) => c.name === "vss_zweite_stufe");
    expect(ohne, "Der Merker muss gesetzt sein").toBeTruthy();
    // -1 ist die Schreibweise von Playwright für „endet mit dem Browser".
    expect(ohne!.expires).toBe(-1);

    // Jetzt mit Häkchen. Kein Klick auf „Abmelden": Der Knopf steht auf der
    // Code-Seite, nicht auf /admin — der Versuch verbrannte nur die Testzeit.
    await context.clearCookies();
    await anmelden(page, EINGERICHTET);
    await page.waitForURL(/\/sicherheit\/code/, { timeout: 20000 });
    await page.getByLabel(/Diesem Gerät 30 Tage vertrauen/).check();
    if (restDesFensters() < 3000) await page.waitForTimeout(restDesFensters() + 200);
    await page.getByRole("textbox").first().fill(totpCode(geheim));
    await page.getByRole("button", { name: "Weiter" }).click();
    await page.waitForURL(/\/admin$/, { timeout: 20000 });

    const mit = (await context.cookies()).find((c) => c.name === "vss_zweite_stufe");
    const tage = (mit!.expires * 1000 - Date.now()) / 86_400_000;
    expect(tage).toBeGreaterThan(29);
    expect(tage).toBeLessThan(31);
  });

  test("Für Kundenkonten ändert sich nichts", async ({ page }) => {
    await anmelden(page, KUNDE);
    await page.waitForURL(/\/mein-bereich/, { timeout: 20000 });
    await expect(page).not.toHaveURL(/\/sicherheit\//);
  });

  test("Verwaltung zeigt den Zustand und sperrt das Zurücksetzen des eigenen Kontos", async ({ page }) => {
    await anmelden(page, EINGERICHTET);
    await zweiteStufeErledigen(page, EINGERICHTET);

    // Fremdes Verwaltungskonto: Zustand sichtbar, Zurücksetzen möglich.
    await gehZu(page, `/admin/kunden/${kennungen[ZUM_ZURUECKSETZEN]}`);
    await expect(page.getByRole("heading", { name: "Anmeldesicherheit" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Zweite Stufe zurücksetzen" })).toBeVisible();

    // Eigenes Konto: kein Knopf, sondern die Begründung.
    const eigene = (await dienst.auth.admin.listUsers({ page: 1, perPage: 1000 })).data?.users.find(
      (u) => u.email === EINGERICHTET
    );
    await gehZu(page, `/admin/kunden/${eigene!.id}`);
    await expect(page.getByText(/Die eigene zweite Stufe lässt sich hier nicht zurücksetzen/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Zweite Stufe zurücksetzen" })).toHaveCount(0);
  });

  test("Zurücksetzen entfernt die App des anderen Kontos", async ({ page }) => {
    await anmelden(page, EINGERICHTET);
    await zweiteStufeErledigen(page, EINGERICHTET);
    await gehZu(page, `/admin/kunden/${kennungen[ZUM_ZURUECKSETZEN]}`);

    await page.getByRole("button", { name: "Zweite Stufe zurücksetzen" }).click();
    await page.getByRole("button", { name: "Zurücksetzen", exact: true }).click();
    await expect(page.getByText(/Zurückgesetzt\./)).toBeVisible({ timeout: 20000 });

    // Gegenprobe an der Datenbank, nicht nur an der Oberfläche.
    const { data } = await dienst.auth.admin.mfa.listFactors({ userId: kennungen[ZUM_ZURUECKSETZEN] });
    expect((data?.factors ?? []).filter((f) => f.status === "verified")).toHaveLength(0);
  });

  test("Der Notfallweg ist über die Kundenliste erreichbar, nicht nur über die Adresszeile", async ({
    page,
  }) => {
    // Im Betrieb aufgefallen (2026-09-16): Die Liste zeigte nur Kunden und
    // Konten mit Zahlungsbeziehung. Ein reines Verwaltungskonto stand nicht
    // darin — der Abschnitt „Anmeldesicherheit" war damit zwar gebaut, aber
    // unerreichbar. Die früheren Prüfungen sprangen direkt auf die Adresse und
    // haben das nie bemerkt.
    await anmelden(page, EINGERICHTET);
    await zweiteStufeErledigen(page, EINGERICHTET);

    await gehZu(page, "/admin/kunden");

    // Ohne Suchfeld: Es filtert erst auf Knopfdruck, und geprüft werden soll
    // die Liste selbst — steht das Verwaltungskonto überhaupt darin?
    const zeile = page.getByRole("link", { name: "E2E58 reset" });
    await expect(zeile).toBeVisible({ timeout: 15000 });
    await zeile.click();

    await expect(page.getByRole("heading", { name: "Anmeldesicherheit" })).toBeVisible();
  });

  test("Sicherheit: Die Einrichtungsseite ist ohne Anmeldung nicht erreichbar", async ({ page }) => {
    await gehZu(page, "/sicherheit/einrichten");
    await expect(page).toHaveURL(/\/login/);
    await gehZu(page, "/sicherheit/code");
    await expect(page).toHaveURL(/\/login/);
  });
});
