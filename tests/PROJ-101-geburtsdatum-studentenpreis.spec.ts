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
 * PROJ-101: Geburtsdatum als Pflichtfeld, Studierendenpreis nur bis 27.
 *
 * Das ist der Teil, den nur der Browser belegen kann: dass die Registrierung
 * ohne Geburtsdatum nicht durchgeht, und dass der Kunde im Buchungsdialog
 * **liest**, warum es den Studierendenpreis für ihn nicht gibt, statt vor einem
 * verschwundenen Kästchen zu stehen.
 *
 * Die Regel selbst steht in `PROJ-101-studentenpreis-alter-db.test.ts` — dort
 * wird sie an der Datenbank geprüft, am Dialog vorbei.
 *
 * Braucht die Migration 20261116100000_proj101_studentenpreis_alter.sql.
 */
const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const PASSWORT = "CorrectPassword123!";
const BUCHUNGSKNOPF = /Jetzt buchen|Buchen|Anfrage läuft|Auf der Warteliste|Du bist in diesem Kurs/;

const stempel = Date.now();
/**
 * Ein **gesäter** Kurs, nicht ein selbst angelegter.
 *
 * Ein frisch angelegter Kurs hat keine Einstiegstermine, und der
 * Buchungsdialog zeigt dann „Aktuell keine Einstiegstermine verfügbar" statt
 * der Preiskacheln — mitsamt dem Kästchen, um das es hier geht. Genau so war
 * dieser Test zuerst rot. Derselbe Kurs trägt PROJ-41.
 */
const KURSNAME = "E2E41 Kurs Standardpreis";
const OHNE_DATUM_MAIL = `proj101-browser-ohnedatum-${stempel}@viennasalsastudio.test`;
const ZU_ALT_MAIL = `proj101-browser-zualt-${stempel}@viennasalsastudio.test`;
const NEU_MAIL = `proj101-browser-neu-${stempel}@viennasalsastudio.test`;

let kursId = "";
const konten: string[] = [];

function vorJahren(jahre: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - jahre);
  return d.toISOString().slice(0, 10);
}

async function kontoAnlegen(mail: string, name: string, geburtsdatum: string | null): Promise<string> {
  const { data, error } = await service.auth.admin.createUser({
    email: mail,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-101 Konto ${mail}: ${error?.message}`);
  konten.push(data.user.id);
  await service.from("profiles").update({ full_name: name, birthdate: geburtsdatum }).eq("id", data.user.id);

  // Ohne SEPA-Mandat zeigt die Anmeldung im Buchungsdialog nur „Dafür braucht
  // es zuerst ein Mandat" — die Preiskacheln und damit das Kästchen gibt es
  // dann gar nicht. Gefunden, weil genau das hier zuerst rot war.
  const { error: mandatFehler } = await service.from("sepa_mandates").insert({
    customer_id: data.user.id,
    iban: "AT611904300234573201",
    account_holder_name: name,
    mandate_reference: `E2E101-${data.user.id.slice(0, 8)}`,
    consented_at: new Date().toISOString(),
  });
  if (mandatFehler) throw new Error(`PROJ-101 Mandat ${mail}: ${mandatFehler.message}`);
  return data.user.id;
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

async function oeffneBuchungsdialog(page: Page) {
  await gehZu(page, "/kurse");
  await page.waitForTimeout(800);
  const mehr = page.getByRole("button", { name: /Mehr laden/ });
  for (let i = 0; i < 10 && (await mehr.count()) > 0; i++) {
    await mehr.click();
    await page.waitForTimeout(400);
  }
  await page
    .locator(".rounded-lg.border.bg-card")
    .filter({ has: page.getByText(KURSNAME, { exact: true }) })
    .getByRole("button", { name: BUCHUNGSKNOPF })
    .click();
  await page.waitForTimeout(600);
  await page.getByRole("tab", { name: "Anmeldung" }).click();
  // Die Auskunft kommt vom Server — das Kästchen oder der Hinweis erscheint
  // einen Augenblick nach dem Dialog.
  await page.waitForTimeout(1200);
}

test.beforeAll(async () => {
  const { data: kurs } = await service.from("courses").select("id").eq("name", KURSNAME).maybeSingle();
  if (!kurs) throw new Error(`PROJ-101: Fixture-Kurs fehlt: ${KURSNAME}`);
  kursId = kurs.id;

  await kontoAnlegen(OHNE_DATUM_MAIL, `E2E101 Ohne Datum ${stempel}`, null);
  await kontoAnlegen(ZU_ALT_MAIL, `E2E101 Zu alt ${stempel}`, vorJahren(31));

  // Die Adresse für die Registrierungsprüfung darf vorher nicht existieren.
  const { data: liste } = await service.auth.admin.listUsers({ perPage: 1000 });
  const vorhanden = liste?.users.find((u) => u.email === NEU_MAIL);
  if (vorhanden) await service.auth.admin.deleteUser(vorhanden.id);
});

test.afterAll(async () => {
  // Der Kurs ist geliehen: Er bleibt stehen. Weggeräumt wird nur, was diese
  // Datei angelegt hat — die Konten und ihre Mandate (letztere gehen mit dem
  // Konto).
  for (const id of konten) await service.auth.admin.deleteUser(id).catch(() => {});
  const { data: liste } = await service.auth.admin.listUsers({ perPage: 1000 });
  const neu = liste?.users.find((u) => u.email === NEU_MAIL);
  if (neu) await service.auth.admin.deleteUser(neu.id);
});

test.describe("PROJ-101: Das Geburtsdatum bei der Registrierung", () => {
  test("Ohne Geburtsdatum entsteht kein Konto", async ({ page }) => {
    await gehZu(page, "/registrieren");
    // Erst hydrieren lassen — siehe docs/troubleshooting-tests.md.
    await page.waitForTimeout(1200);
    await page.getByLabel("Vorname").fill("QA");
    await page.getByLabel("Nachname").fill("Ohne Datum");
    await page.getByLabel("E-Mail").fill(NEU_MAIL);
    await page.getByLabel("Passwort").fill(PASSWORT);
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Registrieren" }).click();
    await page.waitForTimeout(1500);

    await expect(page.getByText("Bitte gib dein Geburtsdatum an.")).toBeVisible();
    // Und zwar wirklich nicht angelegt — nicht nur eine Meldung daneben.
    const { data: liste } = await service.auth.admin.listUsers({ perPage: 1000 });
    expect(
      liste?.users.find((u) => u.email === NEU_MAIL),
      "Das Konto wurde trotzdem angelegt"
    ).toBeUndefined();
  });

  test("Das Feld fragt nach Tag, Monat und Jahr", async ({ page }) => {
    // Nicht `input type=date`: Der Auswähler öffnet dort auf heute, und für ein
    // Geburtsdatum hieße das, das Jahresrad drei Jahrzehnte zurückzudrehen.
    await gehZu(page, "/registrieren");
    await page.waitForTimeout(1200);
    for (const feld of ["Tag", "Monat", "Jahr"]) {
      await expect(page.getByLabel(feld, { exact: true })).toBeVisible();
    }
  });
});

test.describe("PROJ-101: Der Studierendenpreis im Buchungsdialog", () => {
  test("Wer über 27 ist, liest den Grund statt ein Kästchen zu suchen", async ({ page }) => {
    await anmelden(page, ZU_ALT_MAIL);
    await oeffneBuchungsdialog(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Der Studierendenpreis gilt bis einschließlich 27 Jahre.")).toBeVisible();
    // Das Kästchen ist weg — nicht grau, sondern nicht da.
    await expect(dialog.getByLabel("Ich bin Student(in)")).toHaveCount(0);
  });

  test("Ohne hinterlegtes Geburtsdatum führt der Hinweis ins Profil", async ({ page }) => {
    await anmelden(page, OHNE_DATUM_MAIL);
    await oeffneBuchungsdialog(page);

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText("Trag dein Geburtsdatum im Profil ein, um den Studierendenpreis zu wählen.")
    ).toBeVisible();
    // Ein Hinweis ohne Weg wäre eine Sackgasse.
    const weg = dialog.getByRole("link", { name: "Zum Profil" });
    await expect(weg).toBeVisible();
    await expect(weg).toHaveAttribute("href", "/profil");
    await expect(dialog.getByLabel("Ich bin Student(in)")).toHaveCount(0);
  });

  test("Wer das Geburtsdatum nachträgt, bekommt das Kästchen", async ({ page }) => {
    // Derselbe Kunde wie eben — jetzt mit Geburtsdatum. Belegt, dass der
    // Hinweis keine Sperre ist, sondern eine Aufforderung.
    const { data: liste } = await service.auth.admin.listUsers({ perPage: 1000 });
    const kundeId = liste?.users.find((u) => u.email === OHNE_DATUM_MAIL)?.id;
    expect(kundeId).toBeTruthy();
    await service.from("profiles").update({ birthdate: vorJahren(24) }).eq("id", kundeId!);

    await anmelden(page, OHNE_DATUM_MAIL);
    await oeffneBuchungsdialog(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Ich bin Student(in)")).toBeVisible();

    // Für die folgenden Läufe zurücksetzen: Diese Datei prüft beide Lagen.
    await service.from("profiles").update({ birthdate: null }).eq("id", kundeId!);
  });
});

test.describe("PROJ-101: Das Profil", () => {
  test("lässt sich nicht ohne Geburtsdatum speichern", async ({ page }) => {
    await anmelden(page, ZU_ALT_MAIL);
    await gehZu(page, "/profil");
    await page.waitForTimeout(1500);

    // Das Datum löschen und speichern: Einmal angegeben, bleibt es.
    await page.getByRole("button", { name: "Geburtsdatum löschen" }).click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Speichern" }).first().click();
    await page.waitForTimeout(1200);

    await expect(page.getByText("Bitte gib dein Geburtsdatum an.")).toBeVisible();

    // Und wirklich nicht gespeichert.
    const { data: liste } = await service.auth.admin.listUsers({ perPage: 1000 });
    const kundeId = liste?.users.find((u) => u.email === ZU_ALT_MAIL)?.id;
    const { data: profil } = await service.from("profiles").select("birthdate").eq("id", kundeId!).single();
    expect(profil?.birthdate, "Das Geburtsdatum wurde gelöscht").not.toBeNull();
  });
});
