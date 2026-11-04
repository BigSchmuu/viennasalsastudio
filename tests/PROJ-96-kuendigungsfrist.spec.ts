import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";
import { naechsteFaelligkeit } from "@/lib/sepa/faelligkeit";
import type { Ferienzeitraum } from "@/lib/scheduling/dates";

try {
  ladeTestUmgebung();
} catch {
  // Schon geladen (z. B. CI-Variablen direkt gesetzt) — unschädlich.
}

/**
 * PROJ-96: Der Stichtag im Profil.
 *
 * Die Rechnung selbst prüft tests/PROJ-96-kuendigungsfrist-db.test.ts, und zwar
 * über alle 28 Wochentagslagen. Hier geht es nur um das, was der Kunde sieht:
 * Steht der Stichtag an seinem Abo, nennt der Dialog dasselbe Datum, und sagt
 * die Zeile nach Ablauf der Frist, was jetzt gilt.
 *
 * Der Anker des Testabos wird je Prüfung so gesetzt, dass der gewünschte
 * Zustand entsteht — gerechnet mit derselben TypeScript-Funktion, gegen die der
 * Datenbanktest die SQL-Fassung vergleicht.
 *
 * Braucht die Migration 20261104160000_proj96_kuendigungsfrist.sql.
 */

const CUSTOMER = { email: "e2e24-customer@viennasalsastudio.test", password: "CorrectPassword123!" };
const ABO_NAME = "E2E96 Fristabo";
// Ein zweites Abo mit einem anderen Zyklus. Es existiert nur für die Prüfung,
// dass jedes Abo seinen eigenen Stichtag trägt — ein Fehler, der einen einzigen
// Stichtag für alle Abos anzeigt, wäre mit nur einem Abo unsichtbar.
const ZWEIT_NAME = "E2E96 Zweitabo";

const TAG_MS = 86_400_000;

let service: SupabaseClient;
let heute = "";
let ferien: Ferienzeitraum[] = [];
let aboId = "";

function tagePlus(datum: string, tage: number): string {
  return new Date(Date.parse(`${datum}T00:00:00Z`) + tage * TAG_MS).toISOString().slice(0, 10);
}

function letzterSonntag(datum: string): string {
  return tagePlus(datum, -new Date(`${datum}T00:00:00Z`).getUTCDay());
}

function alsText(datum: string, locale: "de-AT" | "en-GB"): string {
  return new Date(`${datum}T00:00:00`).toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Ein Anker, dessen Fenster die gewünschte Lage hat — oder `null`.
 *
 * `null` ist kein Fehler: An einem Sonntag gibt es keinen Anker, dessen Frist
 * schon abgelaufen ist. Die Frist **ist** der Sonntag, sie kann an diesem Tag
 * also nicht in der Vergangenheit liegen. Der Aufrufer überspringt dann.
 */
function ankerMit(
  bedingung: (frist: string, schluss: string) => boolean
): { anker: string; schluss: string; frist: string } | null {
  for (let versatz = -40; versatz <= 0; versatz++) {
    const anker = tagePlus(heute, versatz);
    const schluss = naechsteFaelligkeit(anker, ferien);
    if (schluss < heute) continue;
    const frist = letzterSonntag(schluss);
    if (bedingung(frist, schluss)) return { anker, schluss, frist };
  }
  return null;
}

async function ankerSetzen(anker: string): Promise<void> {
  const { error } = await service
    .from("subscriptions")
    .update({
      cycle_anchor_date: anker,
      pending_status: null,
      pending_effective_date: null,
      cancellation_reason: null,
      cancellation_note: null,
    })
    .eq("id", aboId);
  if (error) throw new Error(`PROJ-96 Anker: ${error.message}`);
}

async function login(page: Page, pfad = "/login"): Promise<void> {
  await page.goto(pfad);
  await page.waitForTimeout(1200);
  await page.getByLabel(/^(E-Mail|Email)$/).fill(CUSTOMER.email);
  await page.getByLabel(/^(Passwort|Password)$/).fill(CUSTOMER.password);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /^(Einloggen|Log in)$/ }).click();
  await page.waitForURL(/\/(en\/)?(mein-bereich|profil)$/, { timeout: 15000 });
  if (page.url().includes("/mein-bereich")) {
    // Eine überholende Navigation des Tests ist kein Fehler, siehe PROJ-8.
    await page.goto(page.url().includes("/en/") ? "/en/profil" : "/profil").catch(() => {});
  }
}

async function aboAbschnitt(page: Page): Promise<void> {
  // Ohne Anker im Muster: Der barrierefreie Name des Knopfes ist
  // „Mein Abo Pausieren, kündigen oder umbuchen“ — der Untertitel der Klappe
  // gehört dazu. Ein verankertes /^Mein Abo$/ passt darauf nie.
  await page.getByRole("button", { name: /(Mein Abo|My membership)/ }).click();
  await page.waitForTimeout(500);
}

test.beforeAll(async () => {
  service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: tag } = await service.rpc("heute_wien");
  heute = String(tag);

  const { data: f } = await service.from("studio_holidays").select("starts_on, ends_on");
  ferien = (f ?? []).map((z) => ({ von: z.starts_on, bis: z.ends_on }));

  // Reste aus einem abgebrochenen Lauf: Ein zweites aktives Abo würde die
  // Zählungen anderer Prüfungen verschieben. Es gibt keine Staging-Datenbank,
  // der Ausgangszustand wird deshalb hier hergestellt.
  await service.from("subscriptions").delete().in("name", [ABO_NAME, ZWEIT_NAME]);

  // Die E-Mail steht in auth.users, nicht in `profiles` — dort gibt es keine
  // solche Spalte. Dieselbe Suche wie in den anderen Browsertests.
  const { data: liste, error: listeFehler } = await service.auth.admin.listUsers({ perPage: 1000 });
  if (listeFehler) throw new Error(`PROJ-96 Konten: ${listeFehler.message}`);
  const kunde = (liste?.users ?? []).find((u) => u.email === CUSTOMER.email);
  if (!kunde) throw new Error(`PROJ-96 Kunde ${CUSTOMER.email} nicht gefunden`);

  const { data: neu, error } = await service
    .from("subscriptions")
    .insert({
      customer_id: kunde.id,
      course_id: null,
      status: "active",
      name: ABO_NAME,
      price: 79,
      cycle_anchor_date: tagePlus(heute, -14),
    })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-96 Abo: ${error.message}`);
  aboId = neu!.id;
});

test.afterAll(async () => {
  await service.from("subscriptions").delete().in("name", [ABO_NAME, ZWEIT_NAME]);
});

test.describe("PROJ-96: Der Stichtag steht im Profil", () => {
  test("Vor der Frist nennt die Zeile den Stichtag und das Datum, zu dem es wirkt", async ({ page }) => {
    const lage = ankerMit((frist) => frist >= heute);
    expect(lage, "kein Anker mit laufender Frist gefunden").not.toBeNull();
    await ankerSetzen(lage!.anker);

    await login(page);
    await page.waitForTimeout(600);
    await aboAbschnitt(page);

    const karte = page.locator("li", { hasText: ABO_NAME });
    const zeile = karte.getByTestId("kuendigungsfrist");
    await expect(zeile).toBeVisible();
    await expect(zeile).toContainText(alsText(lage!.frist, "de-AT"));
    await expect(zeile).toContainText(alsText(lage!.schluss, "de-AT"));
    await expect(zeile).not.toContainText("abgelaufen");
  });

  test("Der Kündigen-Dialog nennt dasselbe Datum", async ({ page }) => {
    const lage = ankerMit((frist) => frist >= heute);
    expect(lage).not.toBeNull();
    await ankerSetzen(lage!.anker);

    await login(page);
    await page.waitForTimeout(600);
    await aboAbschnitt(page);

    const karte = page.locator("li", { hasText: ABO_NAME });
    await karte.getByRole("button", { name: "Kündigen" }).click();
    await page.waitForTimeout(500);

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(alsText(lage!.schluss, "de-AT"));

    // Abbrechen, nicht kündigen: Das Abo soll für die nächste Prüfung noch
    // aktiv und ohne geplante Änderung sein. Der Knopf heißt „Abo behalten“ —
    // nicht „Abbrechen“, und das ist richtig so: „Abbrechen“ neben
    // „Ja, kündigen“ wäre zweimal dasselbe Wort für zwei Gegenteile.
    await dialog.getByRole("button", { name: "Abo behalten" }).click();
    await page.waitForTimeout(400);
    await expect(karte.getByText(/Wird gekündigt ab/)).toHaveCount(0);
  });

  test("Nach Ablauf der Frist nennt die Zeile das spätere Datum", async ({ page }) => {
    const lage = ankerMit((frist) => frist < heute);
    // An einem Sonntag ist die Frist der Sonntag selbst — abgelaufen kann sie
    // dann nicht sein. Kein Zweig für „sonst": Ein `else`, der nie läuft, sähe
    // wie Abdeckung aus. Die Lage ist deterministisch in
    // tests/PROJ-96-kuendigungsfrist-db.test.ts geprüft, über alle 28 Lagen.
    test.skip(lage === null, "Heute ist Sonntag — eine abgelaufene Frist gibt es an diesem Tag nicht");
    await ankerSetzen(lage!.anker);

    const spaeter = naechsteFaelligkeit(lage!.schluss, ferien);

    await login(page);
    await page.waitForTimeout(600);
    await aboAbschnitt(page);

    const zeile = page.locator("li", { hasText: ABO_NAME }).getByTestId("kuendigungsfrist");
    await expect(zeile).toBeVisible();
    await expect(zeile).toContainText("abgelaufen");
    await expect(zeile).toContainText(alsText(spaeter, "de-AT"));
  });

  test("Im englischen Kundenbereich steht der Hinweis auf Englisch", async ({ page }) => {
    const lage = ankerMit((frist) => frist >= heute);
    expect(lage).not.toBeNull();
    await ankerSetzen(lage!.anker);

    await login(page, "/en/login");
    await page.waitForTimeout(600);
    await aboAbschnitt(page);

    const zeile = page.locator("li", { hasText: ABO_NAME }).getByTestId("kuendigungsfrist");
    await expect(zeile).toBeVisible();
    await expect(zeile).toContainText("Cancel or pause by");
    // Englisches Datumsformat: 09/11/2026, nicht 09.11.2026. Bei einer Frist
    // ist das der Unterschied zwischen rechtzeitig und zu spät.
    await expect(zeile).toContainText(alsText(lage!.frist, "en-GB"));
  });
  test("Jedes Abo trägt seinen eigenen Stichtag", async ({ page }) => {
    const erstes = ankerMit((frist) => frist >= heute);
    expect(erstes).not.toBeNull();
    await ankerSetzen(erstes!.anker);

    // Ein zweiter Zyklusschluss, nicht derselbe: Sonst würde die Prüfung auch
    // bestehen, wenn beide Karten dasselbe Datum zeigen.
    const zweites = ankerMit((frist, schluss) => frist >= heute && schluss !== erstes!.schluss);
    expect(zweites, "kein zweiter Anker mit anderem Zyklusschluss gefunden").not.toBeNull();

    const { data: kunde } = await service
      .from("subscriptions")
      .select("customer_id")
      .eq("id", aboId)
      .single();
    const { error } = await service.from("subscriptions").insert({
      customer_id: kunde!.customer_id,
      course_id: null,
      status: "active",
      name: ZWEIT_NAME,
      price: 59,
      cycle_anchor_date: zweites!.anker,
    });
    if (error) throw new Error(`PROJ-96 Zweitabo: ${error.message}`);

    await login(page);
    await page.waitForTimeout(600);
    await aboAbschnitt(page);

    const eine = page.locator("li", { hasText: ABO_NAME }).getByTestId("kuendigungsfrist");
    const andere = page.locator("li", { hasText: ZWEIT_NAME }).getByTestId("kuendigungsfrist");
    await expect(eine).toContainText(alsText(erstes!.schluss, "de-AT"));
    await expect(andere).toContainText(alsText(zweites!.schluss, "de-AT"));
  });

  test("Ein Abo mit geplanter Änderung zeigt das geplante Datum und keinen Stichtag", async ({
    page,
  }) => {
    const lage = ankerMit((frist) => frist >= heute);
    expect(lage).not.toBeNull();
    await ankerSetzen(lage!.anker);

    // Eine bereits geplante Kündigung. Ihr Datum darf nicht neu gerechnet
    // werden — ein zugesagtes Datum nachträglich zu verschieben wäre genau der
    // Vertrauensbruch, den die Frist verhindern soll. Deshalb ein Datum, das
    // die neue Rechnung nie liefern würde.
    const zugesagt = tagePlus(heute, 99);
    const { error } = await service
      .from("subscriptions")
      .update({ pending_status: "cancelled", pending_effective_date: zugesagt })
      .eq("id", aboId);
    if (error) throw new Error(`PROJ-96 geplante Kündigung: ${error.message}`);

    await login(page);
    await page.waitForTimeout(600);
    await aboAbschnitt(page);

    const karte = page.locator("li", { hasText: ABO_NAME });
    await expect(karte.getByText(`Wird gekündigt ab ${alsText(zugesagt, "de-AT")}`)).toBeVisible();
    await expect(karte.getByTestId("kuendigungsfrist")).toHaveCount(0);
  });
});
