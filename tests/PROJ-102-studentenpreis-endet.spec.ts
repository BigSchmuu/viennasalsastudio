import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gehZu } from "./navigation";
import { ladeTestUmgebung } from "./env";
import { zweiteStufeErledigen } from "./zweite-stufe";

try {
  ladeTestUmgebung();
} catch {
  // Schon geladen — unkritisch.
}

/**
 * PROJ-102: Der Studierendenpreis endet mit 28 — angekündigt, nicht
 * überraschend.
 *
 * Das ist der Teil, den nur der Browser belegen kann: dass der Kunde die
 * Ankündigung **sieht**, ohne auf eine Mail angewiesen zu sein, dass daneben
 * der Weg zum Kündigen steht, und dass der Betreiber die anstehenden
 * Umstellungen in der Verwaltung findet.
 *
 * Der Lauf selbst — ankündigen, umstellen, und die drei Fälle, in denen nichts
 * passiert — steht in `PROJ-102-studentenpreis-endet-db.test.ts`.
 *
 * Braucht die Migrationen 20261116100000_proj101_... und
 * 20261116120000_proj102_studentenpreis_endet.sql.
 */
const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const PASSWORT = "CorrectPassword123!";
const ADMIN = "e2e8-admin@viennasalsastudio.test";

const stempel = Date.now();
const KUNDE_MAIL = `proj102-browser-${stempel}@viennasalsastudio.test`;
const KUNDE_NAME = `E2E102 Preis Hinweis ${stempel}`;
const ABO_NAME = `E2E102 Kursabo ${stempel}`;

let kundeId = "";
let aboId = "";

function datum(versatzTage: number): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Vienna" }));
  d.setDate(d.getDate() + versatzTage);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const t = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${t}`;
}

/**
 * Das Profil und den Abschnitt „Mein Abo" aufklappen.
 *
 * Die Abschnitte im Kundenbereich sind zugeklappt — ohne diesen Klick steht der
 * Hinweis nicht im Dokument, und der Test hielte das für einen fehlenden
 * Hinweis. Genau so war er zuerst rot.
 */
async function oeffneMeinAbo(page: Page) {
  await gehZu(page, "/profil");
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Mein Abo" }).click();
  await page.waitForTimeout(800);
}

async function anmelden(page: Page, mail: string) {
  await gehZu(page, "/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(mail);
  await page.getByLabel("Passwort").fill(PASSWORT);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await zweiteStufeErledigen(page, mail);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

test.beforeAll(async () => {
  const { data: konto, error } = await service.auth.admin.createUser({
    email: KUNDE_MAIL,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error || !konto.user) throw new Error(`PROJ-102 Konto: ${error?.message}`);
  kundeId = konto.user.id;

  const vor28 = new Date();
  vor28.setFullYear(vor28.getFullYear() - 28);
  await service
    .from("profiles")
    .update({ full_name: KUNDE_NAME, birthdate: vor28.toISOString().slice(0, 10) })
    .eq("id", kundeId);

  // Die Lage nach einer Ankündigung: Das Abo läuft zum Studierendenpreis, die
  // Umstellung steht in 28 Tagen an. Der Lauf selbst wird hier nicht gerufen —
  // geprüft wird, was der Kunde und der Betreiber davon **sehen**.
  const { data: abo, error: aboFehler } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      status: "active",
      name: ABO_NAME,
      price: 45,
      student_price: true,
      cycle_anchor_date: datum(0),
      pending_price: 60,
      pending_price_old: 45,
      pending_price_date: datum(28),
      price_notice_sent_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (aboFehler) throw new Error(`PROJ-102 Abo: ${aboFehler.message}`);
  aboId = abo!.id;
});

test.afterAll(async () => {
  if (aboId) await service.from("subscriptions").delete().eq("id", aboId);
  if (kundeId) {
    await service.from("notification_queue").delete().eq("customer_id", kundeId);
    await service.auth.admin.deleteUser(kundeId).catch(() => {});
  }
});

test.describe("PROJ-102: Was der Kunde sieht", () => {
  test("Die Ankündigung steht am Abo, mit Datum und beiden Beträgen", async ({ page }) => {
    await anmelden(page, KUNDE_MAIL);
    await oeffneMeinAbo(page);

    const hinweis = page.getByTestId("preisumstellung");
    await expect(hinweis).toBeVisible({ timeout: 20000 });
    // Alle drei Angaben: Ohne das Datum wäre es keine Ankündigung, ohne die
    // Beträge keine Auskunft.
    await expect(hinweis).toContainText("60,00");
    await expect(hinweis).toContainText("45,00");
    const [jahr, monat, tag] = datum(28).split("-");
    await expect(hinweis).toContainText(`${tag}.${monat}.${jahr}`);
  });

  test("Daneben steht der Weg zum Kündigen", async ({ page }) => {
    // Die Wahl muss echt sein: Ein Hinweis auf eine Erhöhung ohne Ausweg wäre
    // eine Mitteilung, keine Entscheidung.
    await anmelden(page, KUNDE_MAIL);
    await oeffneMeinAbo(page);

    await expect(page.getByTestId("preisumstellung")).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("button", { name: /Kündigen/ }).first()).toBeVisible();
  });
});

test.describe("PROJ-102: Was der Betreiber sieht", () => {
  test("Die angekündigte Umstellung steht in der Verwaltung", async ({ page }) => {
    await anmelden(page, ADMIN);
    await gehZu(page, "/admin");
    await page.waitForTimeout(1500);

    const karte = page.locator("div").filter({ hasText: "Angekündigte Umstellungen" }).first();
    await expect(karte).toBeVisible({ timeout: 20000 });

    const zeile = page.getByRole("row").filter({ hasText: KUNDE_NAME });
    await expect(zeile).toBeVisible();
    await expect(zeile).toContainText("45,00");
    await expect(zeile).toContainText("60,00");
  });

  test("Ein Abo ohne Geburtsdatum steht gesondert und wird nicht umgestellt", async ({ page }) => {
    // Was sich nicht beurteilen lässt, darf nicht stillschweigend liegen
    // bleiben — und erst recht nicht automatisch erhöht werden.
    await service.from("profiles").update({ birthdate: null }).eq("id", kundeId);
    await service
      .from("subscriptions")
      .update({
        pending_price: null,
        pending_price_old: null,
        pending_price_date: null,
        price_notice_sent_at: null,
      })
      .eq("id", aboId);

    await anmelden(page, ADMIN);
    await gehZu(page, "/admin");
    await page.waitForTimeout(1500);

    await expect(page.getByText("Ohne Geburtsdatum — nicht beurteilbar")).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText(KUNDE_NAME).first()).toBeVisible();
  });
});
