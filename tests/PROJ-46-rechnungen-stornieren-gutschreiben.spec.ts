import { test, expect, type Page } from "@playwright/test";
import { gehZu } from "./navigation";
import { createClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

ladeTestUmgebung();

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const KUNDE = { email: "e2e8-customer@viennasalsastudio.test", password: "CorrectPassword123!" };
const LEHRER = { email: "e2e13-lehrer-a@viennasalsastudio.test", password: "CorrectPassword123!" };

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

test.use({ locale: "de-DE" });

/**
 * Eigene Rechnungen statt der Vorgabedaten.
 *
 * Die drei Rechnungen aus dem Seed liegen in 2028 und tragen die Summen, auf
 * die PROJ-36 seine GESAMT-Zeile prüft. Ein Storno darauf würde jenen Test
 * kippen — deshalb legt diese Datei ihre eigenen an und räumt sie hinterher weg.
 */
const KENNUNG = `PROJ46-${Date.now()}`;
let kundeId = "";
const angelegt: string[] = [];

/** Der heutige Kalendertag in Wien — dasselbe, was die Datenbank als Belegdatum setzt. */
function heuteInWien(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(new Date());
}
const HEUTE = heuteInWien();

async function legeRechnungAn(
  nummer: string,
  betrag: number,
  zusatz: Record<string, unknown> = {}
): Promise<{ id: string; invoice_number: string }> {
  const { data, error } = await svc
    .from("invoices")
    .insert({
      invoice_number: nummer,
      invoice_date: HEUTE,
      customer_id: kundeId,
      description: `Testrechnung ${nummer}`,
      gross_amount: betrag,
      vat_rate: 20,
      ...zusatz,
    })
    .select("id, invoice_number")
    .single();
  if (error) throw new Error(`Rechnung ${nummer}: ${error.message}`);
  angelegt.push(data.id);
  return data;
}

/** Räumt alles weg, was in diesem Lauf entstanden ist — auch die Belege. */
async function aufraeumen() {
  // Belege zuerst: sie verweisen per Fremdschlüssel auf die Rechnungen.
  const { data: belege } = await svc
    .from("invoices")
    .select("id")
    .not("cancels_invoice_id", "is", null)
    .in("cancels_invoice_id", angelegt.length ? angelegt : ["00000000-0000-0000-0000-000000000000"]);
  for (const b of belege ?? []) await svc.from("invoices").delete().eq("id", b.id);
  for (const id of angelegt) await svc.from("invoices").delete().eq("id", id);
  angelegt.length = 0;
  await svc.from("customer_credits").delete().eq("customer_id", kundeId).eq("origin", "storno");
}

test.beforeAll(async () => {
  const { data: users, error } = await svc.auth.admin.listUsers({ perPage: 200 });
  if (error) throw new Error(`Konten lesen: ${error.message}`);
  const treffer = users.users.find((u) => u.email === KUNDE.email);
  if (!treffer) throw new Error(`Testkunde ${KUNDE.email} fehlt — Seed nicht gelaufen?`);
  kundeId = treffer.id;
});

test.afterAll(aufraeumen);

async function login(page: Page, creds: { email: string; password: string }) {
  await gehZu(page, "/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(creds.email);
  await page.getByLabel("Passwort").fill(creds.password);
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

/**
 * Klappt einen Profil-Abschnitt auf.
 *
 * Seit PROJ-43 sind die Abschnitte im Profil zugeklappt. Ohne diesen Schritt
 * prüft der Test gegen nicht gerendertes Markup und meldet einen Fehler, den
 * es gar nicht gibt.
 */
async function klappeAuf(page: Page, titel: string) {
  await page.getByRole("button", { name: new RegExp(titel) }).click();
  await page.waitForTimeout(600);
}

/** Öffnet die Rechnungsliste, eingegrenzt auf heute — dort stehen nur die Zeilen dieses Laufs. */
async function oeffneHeutigeRechnungen(page: Page) {
  await page.goto(`/admin/rechnungen?from=${HEUTE}&to=${HEUTE}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
}

test.describe("PROJ-46: Rechnungen stornieren und gutschreiben", () => {
  test("AC Storno: Aktion vorhanden, Grund ist Pflicht, Beleg entsteht mit Verweis und negativem Betrag", async ({
    page,
  }) => {
    const rechnung = await legeRechnungAn(`${KENNUNG}-A`, 65);

    await login(page, ADMIN);
    await oeffneHeutigeRechnungen(page);

    const zeile = page.getByRole("row").filter({ hasText: rechnung.invoice_number });
    await expect(zeile).toBeVisible();
    await expect(zeile.getByRole("button", { name: "Stornieren" })).toBeVisible();

    await zeile.getByRole("button", { name: "Stornieren" }).click();
    await expect(page.getByRole("heading", { name: "Rechnung stornieren" })).toBeVisible();

    // Ohne Grund kein Storno.
    await expect(page.getByRole("button", { name: "Stornieren", exact: true }).last()).toBeDisabled();

    await page.getByLabel("Grund").fill("Kurs doppelt abgerechnet");
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "Stornieren", exact: true }).last().click();
    await page.waitForTimeout(2500);

    const { data: beleg } = await svc
      .from("invoices")
      .select("invoice_number, gross_amount, document_type, cancels_invoice_id, reason, invoice_date")
      .eq("cancels_invoice_id", rechnung.id)
      .single();

    expect(beleg, "Es wurde kein Beleg erzeugt").toBeTruthy();
    expect(beleg!.document_type).toBe("cancellation");
    expect(Number(beleg!.gross_amount)).toBe(-65);
    expect(beleg!.reason).toBe("Kurs doppelt abgerechnet");
    expect(beleg!.invoice_date).toBe(HEUTE);
    // Nummer aus demselben fortlaufenden Kreis wie Rechnungen.
    expect(beleg!.invoice_number).toMatch(/^\d{4}-\d{4}$/);

    // Die Rechnung selbst bleibt unverändert.
    const { data: danach } = await svc
      .from("invoices")
      .select("gross_amount, document_type")
      .eq("id", rechnung.id)
      .single();
    expect(Number(danach!.gross_amount)).toBe(65);
    expect(danach!.document_type).toBe("invoice");
  });

  test("AC Storno: aufgehobene Rechnung ist gekennzeichnet und wird nicht erneut zum Stornieren angeboten", async ({
    page,
  }) => {
    const rechnung = await legeRechnungAn(`${KENNUNG}-B`, 50);

    await login(page, ADMIN);
    await oeffneHeutigeRechnungen(page);
    const zeile = page.getByRole("row").filter({ hasText: rechnung.invoice_number });
    await zeile.getByRole("button", { name: "Stornieren" }).click();
    await page.getByLabel("Grund").fill("Doppelbuchung");
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "Stornieren", exact: true }).last().click();
    await page.waitForTimeout(2500);

    await oeffneHeutigeRechnungen(page);
    const neu = page.getByRole("row").filter({ hasText: rechnung.invoice_number });
    await expect(neu.getByText("Aufgehoben")).toBeVisible();
    await expect(neu.getByRole("button", { name: "Stornieren" })).toHaveCount(0);
    await expect(neu.getByRole("button", { name: "Gutschrift" })).toHaveCount(0);
  });

  test("AC Gutschrift: Betrag über der Rechnungssumme und Betrag null werden abgelehnt", async ({
    page,
  }) => {
    const rechnung = await legeRechnungAn(`${KENNUNG}-C`, 65);

    await login(page, ADMIN);
    await oeffneHeutigeRechnungen(page);
    const zeile = page.getByRole("row").filter({ hasText: rechnung.invoice_number });
    await zeile.getByRole("button", { name: "Gutschrift" }).click();
    await expect(page.getByRole("heading", { name: "Gutschrift erstellen" })).toBeVisible();

    const absenden = page.getByRole("button", { name: "Gutschrift erstellen", exact: true }).last();

    await page.getByLabel("Betrag").fill("100");
    await page.getByLabel("Grund").fill("Zu viel");
    await page.waitForTimeout(300);
    // Der Dialogtext nennt die Obergrenze ebenfalls — gemeint ist hier die
    // Fehlermeldung unter dem Feld.
    await expect(page.locator("p.text-destructive").filter({ hasText: "Höchstens" })).toBeVisible();
    await expect(absenden).toBeDisabled();

    await page.getByLabel("Betrag").fill("0");
    await page.waitForTimeout(300);
    await expect(absenden).toBeDisabled();

    await page.getByLabel("Betrag").fill("15");
    await page.getByLabel("Grund").fill("");
    await page.waitForTimeout(300);
    await expect(absenden, "Ohne Grund darf nichts abgeschickt werden").toBeDisabled();

    // Nichts davon darf eine Zeile hinterlassen haben.
    const { count } = await svc
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("cancels_invoice_id", rechnung.id);
    expect(count).toBe(0);
  });

  test("Edge Case: Vollstorno nach einer Teilgutschrift hebt nur den Restbetrag auf", async ({
    page,
  }) => {
    const rechnung = await legeRechnungAn(`${KENNUNG}-D`, 65);

    await login(page, ADMIN);
    await oeffneHeutigeRechnungen(page);
    const zeile = () => page.getByRole("row").filter({ hasText: rechnung.invoice_number });

    await zeile().getByRole("button", { name: "Gutschrift" }).click();
    await page.getByLabel("Betrag").fill("15");
    await page.getByLabel("Grund").fill("Vier Wochen krank");
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Gutschrift erstellen", exact: true }).last().click();
    await page.waitForTimeout(2500);

    await oeffneHeutigeRechnungen(page);
    await zeile().getByRole("button", { name: "Stornieren" }).click();
    // Der Dialog nennt den Restbetrag, nicht die Rechnungssumme — an beiden
    // Stellen, an denen er einen Betrag nennt. Zwischen € und Zahl steht ein
    // geschütztes Leerzeichen, das ein regulärer Ausdruck nicht mitliest.
    await expect(page.getByText(/Von .* werden .*50,00 durch/)).toBeVisible();
    await expect(page.getByText(/50,00 werden dem Kunden als Guthaben/)).toBeVisible();
    await page.getByLabel("Grund").fill("Kurs entfällt komplett");
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "Stornieren", exact: true }).last().click();
    await page.waitForTimeout(2500);

    const { data: belege } = await svc
      .from("invoices")
      .select("gross_amount, document_type")
      .eq("cancels_invoice_id", rechnung.id)
      .order("gross_amount", { ascending: true });

    expect(belege!.length).toBe(2);
    const summe = belege!.reduce((s, b) => s + Number(b.gross_amount), 0);
    expect(summe, "Rechnung und Belege müssen sich auf null verrechnen").toBe(-65);
    expect(belege!.find((b) => b.document_type === "cancellation")).toBeTruthy();
    expect(Number(belege!.find((b) => b.document_type === "cancellation")!.gross_amount)).toBe(-50);
  });

  test("AC Guthaben: der Betrag steht dem Kunden mit nachvollziehbarer Herkunft zur Verfügung", async ({
    page,
  }) => {
    const rechnung = await legeRechnungAn(`${KENNUNG}-E`, 30);

    await login(page, ADMIN);
    await oeffneHeutigeRechnungen(page);
    const zeile = page.getByRole("row").filter({ hasText: rechnung.invoice_number });
    await zeile.getByRole("button", { name: "Stornieren" }).click();
    await page.getByLabel("Grund").fill("Versehentlich berechnet");
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "Stornieren", exact: true }).last().click();
    await page.waitForTimeout(2500);

    const { data: guthaben } = await svc
      .from("customer_credits")
      .select("amount, origin, reason")
      .eq("customer_id", kundeId)
      .eq("origin", "storno");

    expect(guthaben!.length).toBeGreaterThan(0);
    const passend = guthaben!.find((g) => Number(g.amount) === 30);
    expect(passend, "Guthaben über 30 € fehlt").toBeTruthy();
    expect(passend!.reason).toContain("Versehentlich berechnet");

    // Und der Kunde sieht es in seinem Profil.
    await login(page, KUNDE);
    await page.goto("/profil");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
    await klappeAuf(page, "Empfehlen und Guthaben");
    await expect(page.getByText("Versehentlich berechnet").first()).toBeVisible();
  });

  test("AC Kundensicht: beide Belege stehen im Archiv, die Rechnung ist als aufgehoben erkennbar", async ({
    page,
  }) => {
    const rechnung = await legeRechnungAn(`${KENNUNG}-F`, 45);

    await login(page, ADMIN);
    await oeffneHeutigeRechnungen(page);
    await page
      .getByRole("row")
      .filter({ hasText: rechnung.invoice_number })
      .getByRole("button", { name: "Stornieren" })
      .click();
    await page.getByLabel("Grund").fill("Falscher Kurs verrechnet");
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "Stornieren", exact: true }).last().click();
    await page.waitForTimeout(2500);

    const { data: beleg } = await svc
      .from("invoices")
      .select("id, invoice_number")
      .eq("cancels_invoice_id", rechnung.id)
      .single();

    await login(page, KUNDE);
    await page.goto("/profil");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    await klappeAuf(page, "Meine Rechnungen");

    // Die Nummer steht mehrfach: auf der Rechnung selbst und als Bezug des
    // Stornos. Genau das ist der Punkt — beide Belege sind zu sehen.
    await expect(page.getByText(rechnung.invoice_number).first()).toBeVisible();
    await expect(page.getByText(`Storno zu ${rechnung.invoice_number}`)).toBeVisible();
    await expect(page.getByText(beleg!.invoice_number)).toBeVisible();
    await expect(page.getByText("Aufgehoben").first()).toBeVisible();
    await expect(page.getByText("Storno").first()).toBeVisible();

    // Der Belegausdruck nennt Belegart, Bezug und Grund.
    await page.goto(`/rechnungen/${beleg!.id}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Belegnummer:")).toBeVisible();
    await expect(page.getByText(`Storno zu Rechnung ${rechnung.invoice_number}`)).toBeVisible();
    await expect(page.getByText("Falscher Kurs verrechnet")).toBeVisible();

    // Und auf der Rechnung steht, wodurch sie aufgehoben wurde.
    await page.goto(`/rechnungen/${rechnung.id}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Aufgehoben durch")).toBeVisible();
    await expect(page.getByText(beleg!.invoice_number).first()).toBeVisible();
  });

  test("AC Buchhaltung: der Export führt den Storno als eigene Zeile und verrechnet ihn in GESAMT", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === "Mobile Safari",
      "Datei-Downloads gibt es auf mobilem Safari nicht"
    );
    const rechnung = await legeRechnungAn(`${KENNUNG}-G`, 60);

    await login(page, ADMIN);
    await oeffneHeutigeRechnungen(page);
    await page
      .getByRole("row")
      .filter({ hasText: rechnung.invoice_number })
      .getByRole("button", { name: "Gutschrift" })
      .click();
    await page.getByLabel("Betrag").fill("20");
    await page.getByLabel("Grund").fill("Anteilige Erstattung");
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Gutschrift erstellen", exact: true }).last().click();
    await page.waitForTimeout(2500);

    await oeffneHeutigeRechnungen(page);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "CSV exportieren" }).click(),
    ]);
    const fs = await import("fs");
    const inhalt = fs.readFileSync((await download.path())!, "utf-8");

    expect(inhalt.split("\n")[0].slice(1)).toContain("Art;Bezug");

    const gutschriftZeile = inhalt
      .split("\n")
      .find((z) => z.includes("Gutschrift") && z.includes(rechnung.invoice_number));
    expect(gutschriftZeile, "Gutschriftszeile fehlt im Export").toBeTruthy();
    expect(gutschriftZeile).toContain("-20,00");
    expect(gutschriftZeile).toContain("Aufhebung");

    // Die GESAMT-Zeile summiert den ganzen Zeitraum, also auch die Rechnungen
    // der anderen Prüfungen in dieser Datei. Eine feste Zahl waere hier eine
    // Behauptung über den gesamten Datenbestand — die Erwartung kommt deshalb
    // aus der Datenbank.
    const { data: heutige } = await svc
      .from("invoices")
      .select("gross_amount, bounced_at, cancels_invoice_id")
      .eq("invoice_date", HEUTE);

    // Ein Beleg zu einer zurückgebuchten Rechnung zählt nicht gegen die
    // eingegangenen Einnahmen — dieselbe Regel wie im Export selbst.
    const { data: bezugsRechnungen } = await svc
      .from("invoices")
      .select("id")
      .eq("invoice_date", HEUTE)
      .not("bounced_at", "is", null);
    const gebuchteIds = new Set((bezugsRechnungen ?? []).map((r) => r.id));

    const erwartet = (heutige ?? [])
      .filter((z) => !z.bounced_at)
      .filter((z) => !z.cancels_invoice_id || !gebuchteIds.has(z.cancels_invoice_id))
      .reduce((s, z) => s + Number(z.gross_amount), 0);

    const gesamt = inhalt.split("\n").find((z) => z.includes("GESAMT"));
    expect(gesamt, "GESAMT-Zeile fehlt").toBeTruthy();
    expect(gesamt).toContain(erwartet.toFixed(2).replace(".", ","));

    // Und die Gutschrift ist darin tatsächlich abgezogen: ohne sie stünde
    // 20 € mehr in der Summe.
    const ohneGutschrift = (erwartet + 20).toFixed(2).replace(".", ",");
    expect(gesamt).not.toContain(ohneGutschrift);
  });

  test("Edge Case: der Storno einer zurückgebuchten Rechnung schließt den offenen Posten", async ({
    page,
  }) => {
    const rechnung = await legeRechnungAn(`${KENNUNG}-H`, 35, {
      bounced_at: new Date().toISOString(),
      bounce_fee: 5,
    });

    await login(page, ADMIN);
    await page.goto("/admin/offene-posten");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(rechnung.invoice_number)).toBeVisible();

    await oeffneHeutigeRechnungen(page);
    await page
      .getByRole("row")
      .filter({ hasText: rechnung.invoice_number })
      .getByRole("button", { name: "Stornieren" })
      .click();
    await page.getByLabel("Grund").fill("Forderung aufgegeben");
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "Stornieren", exact: true }).last().click();
    await page.waitForTimeout(2500);

    await page.goto("/admin/offene-posten");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    await expect(page.getByText(rechnung.invoice_number)).toHaveCount(0);

    // Die Rücklastschriftgebühr fällt mit weg.
    const { data: danach } = await svc
      .from("invoices")
      .select("settled_at, bounce_fee")
      .eq("id", rechnung.id)
      .single();
    expect(danach!.settled_at).not.toBeNull();
    expect(Number(danach!.bounce_fee)).toBe(0);
  });

  test("Sicherheit: ein Kunde darf die Storno-Funktion nicht aufrufen", async () => {
    const rechnung = await legeRechnungAn(`${KENNUNG}-I`, 25);

    const alsKunde = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { error: loginFehler } = await alsKunde.auth.signInWithPassword(KUNDE);
    expect(loginFehler).toBeNull();

    const { error } = await alsKunde.rpc("create_invoice_document", {
      p_invoice_id: rechnung.id,
      p_document_type: "cancellation",
      p_amount: 0,
      p_reason: "Ich storniere mir das selbst",
    });
    expect(error, "Ein Kunde konnte stornieren").toBeTruthy();
    expect(error!.message).toContain("not authorized");

    const { count } = await svc
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("cancels_invoice_id", rechnung.id);
    expect(count).toBe(0);

    await alsKunde.auth.signOut();
  });

  test("Sicherheit: auch eine Lehrkraft wird abgewiesen", async () => {
    const rechnung = await legeRechnungAn(`${KENNUNG}-K`, 25);

    const alsLehrkraft = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { error: loginFehler } = await alsLehrkraft.auth.signInWithPassword(LEHRER);
    expect(loginFehler).toBeNull();

    const { error } = await alsLehrkraft.rpc("create_invoice_document", {
      p_invoice_id: rechnung.id,
      p_document_type: "credit_note",
      p_amount: 10,
      p_reason: "Von der Lehrkraft",
    });
    expect(error, "Eine Lehrkraft konnte gutschreiben").toBeTruthy();
    expect(error!.message).toContain("not authorized");

    await alsLehrkraft.auth.signOut();
  });

  test("AC Gutschrift: die Summe mehrerer Gutschriften kann die Rechnung auch am Server nicht übersteigen", async () => {
    // Die Oberfläche verhindert das früh — hier zählt, dass es auch dann
    // scheitert, wenn jemand die Oberfläche umgeht.
    const rechnung = await legeRechnungAn(`${KENNUNG}-L`, 65);

    const alsAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    await alsAdmin.auth.signInWithPassword(ADMIN);

    const ersteGutschrift = await alsAdmin.rpc("create_invoice_document", {
      p_invoice_id: rechnung.id,
      p_document_type: "credit_note",
      p_amount: 50,
      p_reason: "Erste Teilgutschrift",
    });
    expect(ersteGutschrift.error).toBeNull();

    // Restbetrag ist jetzt 15 — 20 muss scheitern.
    const zweite = await alsAdmin.rpc("create_invoice_document", {
      p_invoice_id: rechnung.id,
      p_document_type: "credit_note",
      p_amount: 20,
      p_reason: "Zu viel",
    });
    expect(zweite.error, "Die Summe durfte die Rechnung nicht übersteigen").toBeTruthy();
    expect(zweite.error!.message).toContain("exceeds remaining");

    // Genau der Restbetrag ist erlaubt.
    const dritte = await alsAdmin.rpc("create_invoice_document", {
      p_invoice_id: rechnung.id,
      p_document_type: "credit_note",
      p_amount: 15,
      p_reason: "Genau der Rest",
    });
    expect(dritte.error, "Genau der Restbetrag muss erlaubt sein").toBeNull();

    // Und danach ist nichts mehr offen.
    const vierte = await alsAdmin.rpc("create_invoice_document", {
      p_invoice_id: rechnung.id,
      p_document_type: "cancellation",
      p_amount: 0,
      p_reason: "Nichts mehr da",
    });
    expect(vierte.error).toBeTruthy();
    expect(vierte.error!.message).toContain("already fully cancelled");

    const { data: belege } = await svc
      .from("invoices")
      .select("gross_amount")
      .eq("cancels_invoice_id", rechnung.id);
    expect(belege!.length).toBe(2);
    expect(belege!.reduce((s, b) => s + Number(b.gross_amount), 0)).toBe(-65);

    await alsAdmin.auth.signOut();
  });

  test("Sicherheit: auch der Admin kann einen Beleg nicht mehr ändern oder löschen", async () => {
    const rechnung = await legeRechnungAn(`${KENNUNG}-J`, 25);

    const { data: beleg } = await svc
      .from("invoices")
      .insert({
        invoice_number: `${KENNUNG}-J-STORNO`,
        invoice_date: HEUTE,
        customer_id: kundeId,
        description: "Storno",
        gross_amount: -25,
        vat_rate: 20,
        document_type: "cancellation",
        cancels_invoice_id: rechnung.id,
        reason: "Prüfung der Unveränderlichkeit",
      })
      .select("id")
      .single();

    // Der Admin ist die einzige Rolle mit einer UPDATE-Regel auf `invoices` —
    // beim Kunden greift schon RLS, hier greift der Trigger. Das ist der Weg,
    // auf dem ein Versehen tatsächlich passieren würde.
    const alsAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { error: loginFehler } = await alsAdmin.auth.signInWithPassword(ADMIN);
    expect(loginFehler).toBeNull();

    const { error: belegAendern } = await alsAdmin
      .from("invoices")
      .update({ reason: "umgeschrieben" })
      .eq("id", beleg!.id);
    expect(belegAendern, "Ein Admin konnte einen Beleg ändern").toBeTruthy();
    expect(belegAendern!.message).toContain("nicht geaendert");

    const { error: betragAendern } = await alsAdmin
      .from("invoices")
      .update({ gross_amount: 1 })
      .eq("id", rechnung.id);
    expect(betragAendern, "Ein Admin konnte den Rechnungsbetrag ändern").toBeTruthy();

    // Der Zahlungsstand muss weiterhin änderbar bleiben — daran hängen die
    // offenen Posten.
    const { error: zahlstand } = await alsAdmin
      .from("invoices")
      .update({ settled_at: new Date().toISOString() })
      .eq("id", rechnung.id);
    expect(zahlstand, "Der Zahlungsstand ließ sich nicht mehr ändern").toBeNull();

    // Und gelöscht wird gar nichts: auf `invoices` gibt es keine DELETE-Regel.
    const { error: loeschen } = await alsAdmin.from("invoices").delete().eq("id", beleg!.id);
    const { count } = await svc
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("id", beleg!.id);
    expect(loeschen === null && count === 1, "Der Beleg wurde gelöscht").toBe(true);

    await alsAdmin.auth.signOut();
  });
});
