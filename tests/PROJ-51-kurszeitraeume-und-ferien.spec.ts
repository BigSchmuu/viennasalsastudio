import { test, expect } from "@playwright/test";
import { gehZu } from "./navigation";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

try {
  ladeTestUmgebung();
} catch {
  // Schon geladen — unkritisch.
}

/**
 * Eigene Kurse und eigene Ferien.
 *
 * Diese Suite verändert Zeiträume und legt studioweite Ferien an — beides
 * wirkt auf **jeden** Kurstermin im ganzen Projekt. Geteilte Fixtures wären
 * hier besonders gefährlich: Ein liegengebliebener Ferienzeitraum ließe in
 * jeder anderen Suite Termine ausfallen, die stattfinden sollten.
 */
const KURS_LAEUFT = "E2E51 Kurs laeuft";
const KURS_BEGINNT_BALD = "E2E51 Kurs beginnt bald";
const KURS_BEGINNT_SPAETER = "E2E51 Kurs beginnt spaeter";
const KURS_VORBEI = "E2E51 Kurs vorbei";
const FERIEN_NAME = "E2E51 Ferien";
const ALLE_NAMEN = [KURS_LAEUFT, KURS_BEGINNT_BALD, KURS_BEGINNT_SPAETER, KURS_VORBEI];

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", passwort: "CorrectPassword123!" };
/** Bestehende Lehrkraft aus PROJ-13 — die Kurse dieser Suite hängt sie sich
 *  nur für den einen Fall an und danach wieder ab. */
const LEHRER = { email: "e2e13-lehrer-a@viennasalsastudio.test", passwort: "CorrectPassword123!" };
const LEHRER_NAME = "E2E13 Lehrer A";

/**
 * Ein eigener Kunde, kein geteilter.
 *
 * Sein Abo hängt an einem Kurs, der vorbei ist — genau der Zustand, den die
 * Kriterien zum ausgelaufenen Kurs beschreiben. An einem geteilten Konto wäre
 * dieses Abo für jede andere Suite ein unerwarteter Eintrag.
 */
const KUNDE = { email: "e2e51-kunde@viennasalsastudio.test", passwort: "CorrectPassword123!" };
const KUNDE_NAME = "E2E51 Kunde Vorbei";
const ABO_NAME = "E2E51 Abo am beendeten Kurs";

async function anmelden(page: import("@playwright/test").Page, konto: { email: string; passwort: string }) {
  await gehZu(page, "/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(konto.email);
  await page.getByLabel("Passwort").fill(konto.passwort);
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL(/\/(mein-bereich|profil|admin)$/, { timeout: 20000 });
}

const dienst = (): SupabaseClient =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

function tagePlus(tage: number): string {
  const d = new Date();
  d.setDate(d.getDate() + tage);
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Vienna" });
}

/** 0 = Montag … 6 = Sonntag — die Konvention des Projekts. */
function wochentagIn(tage: number): number {
  const d = new Date();
  d.setDate(d.getDate() + tage);
  return (d.getDay() + 6) % 7;
}

const WOCHENTAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

let wochentag = 0;
let kundeId = "";

test.beforeAll(async () => {
  const service = dienst();
  await service.from("courses").delete().in("name", ALLE_NAMEN);
  await service.from("studio_holidays").delete().eq("name", FERIEN_NAME);

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  if (!raum) throw new Error("PROJ-51: Kein Raum vorhanden");
  // Vollständige Kurse, nicht nur die Pflichtspalten der Datenbank: Das
  // Kursformular verlangt außerdem Tanzstil und Level. Ohne sie scheitert es
  // daran zuerst, und eine Prüfung des Zeitraums käme nie zum Zug.
  const { data: stil } = await service.from("dance_styles").select("id").limit(1).single();
  if (!stil) throw new Error("PROJ-51: Kein Tanzstil vorhanden");

  // Alle vier auf denselben Wochentag, damit ein Reiter sie zusammen zeigt.
  // Zwei Tage voraus: So liegt der Tag sicher in derselben Woche wie heute und
  // ist noch nicht vorbei.
  wochentag = wochentagIn(2);

  const { data: kurse, error } = await service
    .from("courses")
    .insert([
      { name: KURS_LAEUFT, room_id: raum.id, dance_style_id: stil.id, level: "beginner", role_query_enabled: false, runs_until: tagePlus(10) },
      { name: KURS_BEGINNT_BALD, room_id: raum.id, dance_style_id: stil.id, level: "beginner", role_query_enabled: false, runs_from: tagePlus(9) },
      { name: KURS_BEGINNT_SPAETER, room_id: raum.id, dance_style_id: stil.id, level: "beginner", role_query_enabled: false, runs_from: tagePlus(40) },
      { name: KURS_VORBEI, room_id: raum.id, dance_style_id: stil.id, level: "beginner", role_query_enabled: false, runs_until: tagePlus(-1) },
    ])
    .select("id, name");
  if (error) throw new Error(`PROJ-51 Testkurse: ${error.message}`);

  await service.from("course_schedule").insert(
    (kurse ?? []).map((k) => ({
      course_id: k.id,
      weekday: wochentag,
      start_time: "18:00",
      end_time: "19:00",
    }))
  );

  // Der Kunde und sein Abo am ausgelaufenen Kurs.
  const { data: alle } = await service.auth.admin.listUsers({ perPage: 400 });
  const alt = alle.users.find((u) => u.email === KUNDE.email);
  if (alt) await service.auth.admin.deleteUser(alt.id);
  const { data: angelegt, error: anlageFehler } = await service.auth.admin.createUser({
    email: KUNDE.email,
    password: KUNDE.passwort,
    email_confirm: true,
  });
  if (anlageFehler) throw new Error(`PROJ-51 Testkunde: ${anlageFehler.message}`);
  kundeId = angelegt.user.id;
  await service.from("profiles").update({ full_name: KUNDE_NAME }).eq("id", kundeId);

  const vorbei = (kurse ?? []).find((k) => k.name === KURS_VORBEI);
  const { error: aboFehler } = await service.from("subscriptions").insert({
    customer_id: kundeId,
    course_id: vorbei!.id,
    name: ABO_NAME,
    status: "active",
    price: 45,
    cycle_anchor_date: tagePlus(-30),
  });
  if (aboFehler) throw new Error(`PROJ-51 Testabo: ${aboFehler.message}`);
});

test.afterAll(async () => {
  const service = dienst();
  // Erst das Abo, dann der Kurs: Das Abo verweist auf ihn.
  if (kundeId) {
    await service.from("subscriptions").delete().eq("customer_id", kundeId);
    await service.auth.admin.deleteUser(kundeId);
  }
  await service.from("courses").delete().in("name", ALLE_NAMEN);
  await service.from("studio_holidays").delete().eq("name", FERIEN_NAME);
});

/**
 * Der Katalog ist seitenweise (12 je Seite, „Mehr laden") und nach Anlagedatum
 * sortiert — die Kurse dieser Suite entstehen zuletzt und stehen deshalb hinten.
 */
async function oeffneKatalog(page: import("@playwright/test").Page) {
  await gehZu(page, "/kurse");
  await page.waitForTimeout(1500);
  const mehr = page.getByRole("button", { name: /Mehr laden/ });
  for (let i = 0; i < 10 && (await mehr.count()) > 0; i++) {
    await mehr.click();
    await page.waitForTimeout(500);
  }
}

async function oeffneTag(page: import("@playwright/test").Page) {
  await gehZu(page, "/stundenplan");
  await page.waitForTimeout(1800);
  await page.getByRole("tab", { name: new RegExp(WOCHENTAGE[wochentag]) }).click();
  await page.waitForTimeout(800);
}

test.describe("PROJ-51: Kurszeiträume und Ferien im Stundenplan", () => {
  test("AC: Ein laufender Kurs steht im Plan, ein ausgelaufener nicht mehr", async ({ page }) => {
    await oeffneTag(page);
    await expect(page.getByText(KURS_LAEUFT, { exact: true })).toBeVisible();
    // Vorher musste der Betreiber einen ausgelaufenen Kurs von Hand entfernen.
    await expect(page.getByText(KURS_VORBEI, { exact: true })).toHaveCount(0);
  });

  test("AC: Ein Kurs, der bald beginnt, wird mit Startdatum genannt — einer in sechs Wochen nicht", async ({
    page,
  }) => {
    await oeffneTag(page);
    await expect(page.getByText(KURS_BEGINNT_BALD, { exact: true })).toBeVisible();
    await expect(page.getByText(KURS_BEGINNT_SPAETER, { exact: true })).toHaveCount(0);

    // Auf Seitenebene geprüft, nicht auf die Karte eingegrenzt: Der Versuch,
    // die Karte über verschachtelte divs zu greifen, trifft den falschen.
    // Eindeutig ist es trotzdem — nur die Kurse dieser Suite haben überhaupt
    // einen Zeitraum, alle anderen sind unbefristet.
    await expect(page.getByText(/^ab /).first()).toBeVisible();
  });

  test("AC: Bei einem Kurs, der demnächst endet, steht das Enddatum dabei", async ({ page }) => {
    await oeffneTag(page);
    await expect(page.getByText(/^noch bis /).first()).toBeVisible();
  });

  test("AC: Eine vorgemerkte Umwandlung steht beim Kurs und geht dem Ende vor", async ({ page }) => {
    const service = dienst();
    await service
      .from("courses")
      .update({
        pending_name: "E2E51 Fortgeschritten",
        pending_level: "intermediate",
        pending_effective_date: tagePlus(11),
      })
      .eq("name", KURS_LAEUFT);

    try {
      await oeffneTag(page);
      // „Wird zu …" sagt mehr als „endet" — der Kurs hört ja nicht auf.
      await expect(page.getByText(/^ab .*E2E51 Fortgeschritten/)).toBeVisible();
      await expect(page.getByText(/^noch bis /)).toHaveCount(0);
    } finally {
      await service
        .from("courses")
        .update({ pending_name: null, pending_level: null, pending_effective_date: null })
        .eq("name", KURS_LAEUFT);
    }
  });

  test("Ein Kurs in der Lücke zwischen zwei Staffeln bleibt mit seinem Hinweis stehen", async ({
    page,
  }) => {
    // Vorher verschwand er ab dem Kursende aus dem Plan — samt „ab {Datum}:
    // {neuer Name}", ausgerechnet in den Wochen, in denen die Frage am
    // dringendsten ist (gemeldet 2026-09-11).
    const service = dienst();
    await service
      .from("courses")
      .update({
        pending_name: "E2E51 Fortgeschritten",
        pending_level: "intermediate",
        pending_effective_date: tagePlus(9),
      })
      .eq("name", KURS_VORBEI);

    try {
      await oeffneTag(page);
      await expect(page.getByText(KURS_VORBEI, { exact: true })).toBeVisible();
      await expect(page.getByText(/^ab .*E2E51 Fortgeschritten/)).toBeVisible();
    } finally {
      await service
        .from("courses")
        .update({ pending_name: null, pending_level: null, pending_effective_date: null })
        .eq("name", KURS_VORBEI);
    }
  });

  test("Bei einer Pause von mehr als drei Wochen bleibt er verschwunden", async ({ page }) => {
    // Eine so lange Abwesenheit ist keine Lücke mehr, sondern ein Ende mit
    // Neuanfang — sonst stünde ein toter Kurs monatelang im Plan.
    const service = dienst();
    await service
      .from("courses")
      .update({
        pending_name: "E2E51 Fortgeschritten",
        pending_level: "intermediate",
        pending_effective_date: tagePlus(40),
      })
      .eq("name", KURS_VORBEI);

    try {
      await oeffneTag(page);
      await expect(page.getByText(KURS_VORBEI, { exact: true })).toHaveCount(0);
    } finally {
      await service
        .from("courses")
        .update({ pending_name: null, pending_level: null, pending_effective_date: null })
        .eq("name", KURS_VORBEI);
    }
  });

  test("Der Kunde sieht die Umwandlung auch in „Mein Bereich“", async ({ page }) => {
    // Der Hinweis hing nur an der Stundenplan-Karte: Wer seine eigenen Kurse
    // ansieht statt den Gesamtplan, erfuhr es erst per E-Mail.
    const service = dienst();
    const { data: kurs } = await service.from("courses").select("id").eq("name", KURS_LAEUFT).single();
    const { data: abo } = await service
      .from("subscriptions")
      .insert({
        customer_id: kundeId,
        course_id: kurs!.id,
        name: "E2E51 Abo laufend",
        status: "active",
        price: 45,
        cycle_anchor_date: tagePlus(-30),
      })
      .select("id")
      .single();
    await service
      .from("courses")
      .update({
        pending_name: "E2E51 Fortgeschritten",
        pending_level: "intermediate",
        pending_effective_date: tagePlus(9),
      })
      .eq("name", KURS_LAEUFT);

    try {
      await anmelden(page, KUNDE);
      await gehZu(page, "/mein-bereich");
      await page.waitForTimeout(2500);
      await expect(page.getByText(/heißt dieser Kurs E2E51 Fortgeschritten/)).toBeVisible();
    } finally {
      await service
        .from("courses")
        .update({ pending_name: null, pending_level: null, pending_effective_date: null })
        .eq("name", KURS_LAEUFT);
      if (abo) await service.from("subscriptions").delete().eq("id", abo.id);
    }
  });

  test("AC: Ferien stehen als Hinweis über dem Plan", async ({ page }) => {
    const service = dienst();
    await service
      .from("studio_holidays")
      .insert({ name: FERIEN_NAME, starts_on: tagePlus(5), ends_on: tagePlus(8) });

    try {
      await gehZu(page, "/stundenplan");
      await page.waitForTimeout(1800);
      await expect(page.getByText(new RegExp(`${FERIEN_NAME}.*geschlossen`))).toBeVisible();
    } finally {
      await service.from("studio_holidays").delete().eq("name", FERIEN_NAME);
    }
  });

  test("AC: Der Betreiber trägt Ferien ein und wieder aus", async ({ page }) => {
    await anmelden(page, ADMIN);
    await page.goto("/admin/ferien");
    await page.waitForTimeout(1500);

    await page.getByLabel("Anlass").fill(FERIEN_NAME);
    await page.getByLabel("Von").fill(tagePlus(5));
    await page.getByLabel("Bis").fill(tagePlus(8));
    await page.getByRole("button", { name: "Ferien eintragen" }).click();
    await page.waitForTimeout(2500);

    await expect(page.getByText(FERIEN_NAME)).toBeVisible();

    // Und wieder weg — mit Rückfrage, denn danach finden die Termine wieder statt.
    await page.getByRole("button", { name: "Entfernen" }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Entfernen" }).click();
    await page.waitForTimeout(2500);
    await expect(page.getByText(FERIEN_NAME)).toHaveCount(0);
  });

  test("AC: Der Betreiber merkt eine Umwandlung vor und nimmt sie zurück", async ({ page }) => {
    await anmelden(page, ADMIN);
    await page.goto("/admin/kurse");
    await page.waitForTimeout(2000);

    await page.locator("tr", { hasText: KURS_LAEUFT }).getByRole("button", { name: "Bearbeiten" }).click();
    await page.waitForTimeout(1200);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Kurs umwandeln")).toBeVisible();
    await dialog.getByLabel("Neuer Name").fill("E2E51 Fortgeschritten");
    await dialog.getByLabel("Neues Level").click();
    await page.getByRole("option").first().click();
    await dialog.getByLabel("Ab wann").fill(tagePlus(12));
    await dialog.getByLabel("Neue Staffel läuft bis (optional)").fill(tagePlus(50));
    await dialog.getByRole("button", { name: "Umwandlung vormerken" }).click();
    await page.waitForTimeout(2500);

    const service = dienst();
    try {
      const { data: nachher } = await service
        .from("courses")
        .select("pending_name, pending_effective_date, pending_runs_until, pending_announced_at")
        .eq("name", KURS_LAEUFT)
        .single();
      expect(nachher?.pending_name, "Die Umwandlung wurde nicht vorgemerkt").toBe(
        "E2E51 Fortgeschritten"
      );
      // Ohne den Zeitraum der neuen Staffel behielte der Kurs das Ende der
      // alten und verschwände am Tag seiner Umwandlung (BUG-1).
      expect(nachher?.pending_runs_until, "Der neue Zeitraum fehlt").toBe(tagePlus(50));

      // Der Dialog zeigt die Vormerkung sofort — ohne ihn neu zu öffnen.
      // Vorher hielt er den Kurs fest, wie er beim Öffnen aussah.
      await expect(dialog.getByText(/heißt .*dann/)).toBeVisible();
      await dialog.getByRole("button", { name: "Vormerkung zurücknehmen" }).click();
      await page.waitForTimeout(2500);

      const { data: danach } = await service
        .from("courses")
        .select("pending_name, pending_runs_until, pending_announced_at")
        .eq("name", KURS_LAEUFT)
        .single();
      expect(danach?.pending_name, "Die Vormerkung blieb bestehen").toBeNull();
      expect(danach?.pending_runs_until, "Der neue Zeitraum blieb stehen").toBeNull();
      // BUG-2: Bleibt die Spur der Ankündigung stehen, hält der nächtliche
      // Lauf die *nächste* Vormerkung für erledigt und schweigt.
      expect(danach?.pending_announced_at, "Die Ankündigungsspur blieb stehen").toBeNull();
    } finally {
      // Ohne dieses Aufräumen vergiftet ein Fehlschlag hier den nächsten Fall —
      // genau das ist beim ersten Lauf passiert.
      await service
        .from("courses")
        .update({ pending_name: null, pending_level: null, pending_effective_date: null })
        .eq("name", KURS_LAEUFT);
    }
  });

  test("AC: Wer einen bald endenden Kurs buchen will, erfährt es vorher", async ({ page }) => {
    await anmelden(page, KUNDE);
    await oeffneKatalog(page);

    // Der Hinweis steht im Dialog, nicht auf der Karte: Er gehört an die
    // Stelle, an der die Entscheidung fällt.
    await page
      .locator(".rounded-lg.border.bg-card")
      .filter({ has: page.getByText(KURS_LAEUFT, { exact: true }) })
      .getByRole("button", { name: "Jetzt buchen" })
      .click();
    await page.waitForTimeout(1200);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/läuft nur noch bis/)).toBeVisible();

    // Der Satz über das Abo gehört in den Reiter, in dem eines entsteht — bei
    // Probestunde und Drop-in gibt es keines (BUG-4). Der Hinweis auf das
    // Kursende steht über allen dreien.
    await dialog.getByRole("tab", { name: "Probestunde" }).click();
    await page.waitForTimeout(600);
    await expect(dialog.getByText(/läuft nur noch bis/)).toBeVisible();
    await expect(dialog.getByText(/Dein Abo läuft danach weiter/)).toHaveCount(0);

    await dialog.getByRole("tab", { name: "Anmeldung" }).click();
    await page.waitForTimeout(600);
    await expect(dialog.getByText(/Dein Abo läuft danach weiter/)).toBeVisible();
  });

  test("AC: Ein ausgelaufener Kurs steht auch im Katalog nicht mehr", async ({ page }) => {
    // Sonst führte der Stundenplan ihn zu Recht nicht mehr — und der Katalog
    // ließe ihn weiter buchen.
    await oeffneKatalog(page);
    await expect(page.getByText(KURS_LAEUFT, { exact: true })).toBeVisible();
    await expect(page.getByText(KURS_VORBEI, { exact: true })).toHaveCount(0);
  });

  test("Ein ausgelaufener Kurs hat auch keine Detailseite mehr", async ({ page }) => {
    // Über einen alten Link oder ein Lesezeichen ließ er sich weiter buchen
    // und zur Flatrate hinzufügen, obwohl Plan und Katalog ihn verstecken
    // (QA 2026-09-11, BUG-5).
    const service = dienst();
    const { data: kurs } = await service.from("courses").select("id").eq("name", KURS_VORBEI).single();

    await gehZu(page, `/kurse/${kurs!.id}`);
    await page.waitForTimeout(1500);
    await expect(page.getByText(KURS_VORBEI, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Jetzt buchen|Flatrate/ })).toHaveCount(0);

    // Der laufende dagegen schon — die Prüfung trifft nicht zu viel.
    const { data: laeuft } = await service.from("courses").select("id").eq("name", KURS_LAEUFT).single();
    await gehZu(page, `/kurse/${laeuft!.id}`);
    await page.waitForTimeout(1500);
    await expect(page.getByText(KURS_LAEUFT, { exact: true }).first()).toBeVisible();
  });

  test("AC: Der Kunde sieht im Profil, dass sein Kurs beendet ist — und kann umbuchen", async ({
    page,
  }) => {
    await anmelden(page, KUNDE);
    await gehZu(page, "/profil");
    await page.waitForTimeout(2000);

    await page.getByRole("button", { name: "Mein Abo" }).click();
    await page.waitForTimeout(800);

    await expect(page.getByText(/Dieser Kurs ist beendet/)).toBeVisible();
    // Der Hinweis allein hilft nicht — der Weg heraus muss danebenstehen.
    await expect(page.getByRole("button", { name: "Umbuchen", exact: true })).toBeVisible();

    // Und er führt nicht in die nächste Sackgasse: Ein Kurs, dessen Zeitraum
    // ebenfalls vorbei ist, steht nicht zur Wahl.
    await page.getByRole("button", { name: "Umbuchen", exact: true }).click();
    await page.waitForTimeout(800);
    await page.getByRole("dialog").getByRole("combobox").click();
    await page.waitForTimeout(500);
    await expect(page.getByRole("option", { name: KURS_VORBEI })).toHaveCount(0);
    await expect(page.getByRole("option", { name: KURS_LAEUFT })).toBeVisible();
  });

  test("Ein gekündigtes Abo bekommt keinen Handlungsaufruf mehr", async ({ page }) => {
    // „Buche auf einen laufenden Kurs um — dein Abo bleibt bestehen" stimmte
    // bei einem gekündigten Abo in beiden Hälften nicht, und der Knopf dazu
    // fehlt dort ohnehin (QA 2026-09-11, BUG-3).
    const service = dienst();
    await service.from("subscriptions").update({ status: "cancelled" }).eq("name", ABO_NAME);

    try {
      await anmelden(page, KUNDE);
      await gehZu(page, "/profil");
      await page.waitForTimeout(2000);
      await page.getByRole("button", { name: "Mein Abo" }).click();
      await page.waitForTimeout(800);

      await expect(page.getByText(ABO_NAME)).toBeVisible();
      await expect(page.getByText(/Dieser Kurs ist beendet/)).toHaveCount(0);
    } finally {
      await service.from("subscriptions").update({ status: "active" }).eq("name", ABO_NAME);
    }
  });

  test("AC: Das Dashboard stößt auf den beendeten Kurs und rechnet keinen Termin mehr", async ({
    page,
  }) => {
    await anmelden(page, KUNDE);
    await gehZu(page, "/mein-bereich");
    await page.waitForTimeout(2500);

    await expect(page.getByText("Dein Kurs ist beendet")).toBeVisible();
    await expect(page.getByText(new RegExp(`${KURS_VORBEI}.*läuft nicht mehr`))).toBeVisible();

    // Der Kurs hat einen Wochentermin in zwei Tagen — außerhalb seines
    // Zeitraums darf daraus trotzdem kein „nächster Kurs" werden.
    await expect(page.getByText(KURS_VORBEI, { exact: true })).toHaveCount(0);
  });

  test("AC: Der Betreiber erkennt das betroffene Abo in Liste und Kundenprofil", async ({ page }) => {
    await anmelden(page, ADMIN);
    await page.goto("/admin/kunden?q=E2E51");
    await page.waitForTimeout(2000);

    const zeile = page.locator("tr", { hasText: KUNDE_NAME });
    await expect(zeile.getByText("Kurs beendet")).toBeVisible();

    await zeile.getByRole("link", { name: KUNDE_NAME }).click();
    await page.waitForTimeout(2500);
    await expect(page.getByText("Kurs beendet — Umbuchen nötig")).toBeVisible();
  });

  test("AC: Ein Termin in den Ferien ist kein nächster Kurs mehr", async ({ page }) => {
    const service = dienst();
    // Das Abo nur für diesen Fall: Wäre es dauerhaft da, könnte derselbe Kunde
    // den Kurs nicht mehr buchen — und der Hinweis-Test oben liefe ins Leere.
    const { data: kurs } = await service.from("courses").select("id").eq("name", KURS_LAEUFT).single();
    const { data: abo } = await service
      .from("subscriptions")
      .insert({
        customer_id: kundeId,
        course_id: kurs!.id,
        name: "E2E51 Abo laufend",
        status: "active",
        price: 45,
        cycle_anchor_date: tagePlus(-30),
      })
      .select("id")
      .single();

    try {
      // Erst ohne Ferien: Der Termin ist da. Ohne diese Hälfte wäre die zweite
      // wertlos — „nicht sichtbar" könnte auch heißen, dass nie etwas da war.
      await anmelden(page, KUNDE);
      await gehZu(page, "/mein-bereich");
      await page.waitForTimeout(2500);
      await expect(page.getByText(KURS_LAEUFT, { exact: true }).first()).toBeVisible();

      await service
        .from("studio_holidays")
        .insert({ name: FERIEN_NAME, starts_on: tagePlus(1), ends_on: tagePlus(9) });

      await gehZu(page, "/mein-bereich");
      await page.waitForTimeout(2500);
      await expect(page.getByText(KURS_LAEUFT, { exact: true })).toHaveCount(0);
    } finally {
      await service.from("studio_holidays").delete().eq("name", FERIEN_NAME);
      if (abo) await service.from("subscriptions").delete().eq("id", abo.id);
    }
  });

  test("AC: Der Lehrer sieht weder den ausgelaufenen Kurs noch einen Ferientermin", async ({
    page,
  }) => {
    const service = dienst();
    const { data: lehrer } = await service
      .from("teacher_directory")
      .select("id")
      .eq("full_name", LEHRER_NAME)
      .single();
    const { data: kurse } = await service
      .from("courses")
      .select("id, name")
      .in("name", [KURS_LAEUFT, KURS_VORBEI]);

    await service.from("course_teachers").insert(
      (kurse ?? []).map((k) => ({ course_id: k.id, teacher_id: lehrer!.id }))
    );

    try {
      await anmelden(page, LEHRER);
      await gehZu(page, "/mein-bereich");
      await page.waitForTimeout(2500);

      // Auf den Abschnitt eingegrenzt: Derselbe Kursname steht weiter unten
      // auch unter „Anwesenheit nachtragen", und dort gehört er hin —
      // vergangene Stunden haben stattgefunden.
      const anstehend = page.locator("section").filter({
        has: page.getByRole("heading", { name: "Deine nächsten Kurse" }),
      });
      await expect(anstehend.getByText(KURS_LAEUFT, { exact: true }).first()).toBeVisible();

      // Ein ausgelaufener Kurs steht nirgends mehr: weder unter den nächsten
      // Terminen noch unter fehlender Anwesenheit.
      await expect(page.getByText(KURS_VORBEI, { exact: true })).toHaveCount(0);

      await service
        .from("studio_holidays")
        .insert({ name: FERIEN_NAME, starts_on: tagePlus(1), ends_on: tagePlus(9) });

      await gehZu(page, "/mein-bereich");
      await page.waitForTimeout(2500);
      // Der Termin liegt in den Ferien — der Abschnitt kennt ihn nicht mehr.
      // Bleibt kein Termin übrig, fehlt der Abschnitt ganz; beides ist recht.
      await expect(
        page
          .locator("section")
          .filter({ has: page.getByRole("heading", { name: "Deine nächsten Kurse" }) })
          .getByText(KURS_LAEUFT, { exact: true })
      ).toHaveCount(0);
    } finally {
      await service.from("studio_holidays").delete().eq("name", FERIEN_NAME);
      for (const k of kurse ?? []) {
        await service.from("course_teachers").delete().eq("course_id", k.id);
      }
    }
  });

  test("AC: Ferien zu löschen lässt die einzeln gepflegten Ausfalltage unberührt", async () => {
    const service = dienst();
    const { data: kurs } = await service.from("courses").select("id").eq("name", KURS_LAEUFT).single();
    const { data: plan } = await service
      .from("course_schedule")
      .select("id")
      .eq("course_id", kurs!.id)
      .single();

    // Ein Ausfalltag aus ganz anderem Grund — der Lehrer ist krank.
    const ausfalltag = tagePlus(16);
    await service
      .from("course_schedule_pauses")
      .insert({ schedule_id: plan!.id, pause_date: ausfalltag });

    try {
      await service
        .from("studio_holidays")
        .insert({ name: FERIEN_NAME, starts_on: tagePlus(1), ends_on: tagePlus(9) });
      await service.from("studio_holidays").delete().eq("name", FERIEN_NAME);

      const { count } = await service
        .from("course_schedule_pauses")
        .select("id", { count: "exact", head: true })
        .eq("schedule_id", plan!.id)
        .eq("pause_date", ausfalltag);
      expect(count, "Das Löschen der Ferien nahm einen fremden Ausfalltag mit").toBe(1);
    } finally {
      await service.from("studio_holidays").delete().eq("name", FERIEN_NAME);
      await service
        .from("course_schedule_pauses")
        .delete()
        .eq("schedule_id", plan!.id)
        .eq("pause_date", ausfalltag);
    }
  });

  test("AC: Ein Kursende vor dem Beginn wird abgelehnt", async ({ page }) => {
    await anmelden(page, ADMIN);
    await page.goto("/admin/kurse");
    await page.waitForTimeout(2000);

    await page.locator("tr", { hasText: KURS_LAEUFT }).getByRole("button", { name: "Bearbeiten" }).click();
    await page.waitForTimeout(1200);

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Läuft von (optional)", { exact: true }).fill(tagePlus(20));
    await dialog.getByLabel("Läuft bis (optional)", { exact: true }).fill(tagePlus(10));
    await dialog.getByRole("button", { name: /Speichern|Anlegen/ }).click();
    await page.waitForTimeout(1500);

    await expect(dialog.getByText("Das Kursende darf nicht vor dem Beginn liegen")).toBeVisible();
  });
});
