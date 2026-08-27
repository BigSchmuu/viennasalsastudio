/**
 * Füllt die Testdatenbank mit den Fixtures, die die E2E-Suite braucht.
 *
 * Kopiert sie aus der Produktion — mit denselben Kennungen, damit jede
 * Verknüpfung erhalten bleibt und die Fixtures sich genau so verhalten wie
 * bisher. Die Testkonten behalten ihre Adressen und das gemeinsame Passwort.
 *
 * **Echte Personen bleiben draußen.** Kopiert wird ausschließlich, was zu
 * einem Konto auf @viennasalsastudio.test gehört. Kundennamen, Geburtsdaten
 * und Bankdaten echter Kunden haben in einer Testdatenbank nichts verloren —
 * sie ist absichtlich weniger geschützt, und ein Zweck bestünde ohnehin nicht.
 * Kurse, Standorte und Säle sind keine personenbezogenen Daten und kommen
 * vollständig mit; drei Kurs-Lehrer-Zuordnungen auf echte Personen entfallen
 * dabei, was kein Test prüft.
 *
 * Aufruf: node scripts/seed-testdb.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

/**
 * Beide Umgebungen ausdrücklich einlesen statt über process.env.
 *
 * process.loadEnvFile() überschreibt bereits gesetzte Werte nicht — nach dem
 * zweiten Aufruf zeigten Quelle und Ziel beide auf die Produktion. Die
 * Abbruchprüfung darunter hat das gefangen; hier wird die Ursache beseitigt.
 */
function leseUmgebung(datei) {
  const werte = {};
  for (const zeile of readFileSync(datei, "utf8").split("\n")) {
    const t = zeile.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0) werte[t.slice(0, i)] = t.slice(i + 1);
  }
  return werte;
}

const produktion = leseUmgebung(".env.local");
const testumgebung = leseUmgebung(".env.test");

const PROD_URL = produktion.NEXT_PUBLIC_SUPABASE_URL;
const PROD_KEY = produktion.SUPABASE_SERVICE_ROLE_KEY;
const TEST_URL = testumgebung.NEXT_PUBLIC_SUPABASE_URL;
const TEST_KEY = testumgebung.SUPABASE_SERVICE_ROLE_KEY;

if (!PROD_URL || !TEST_URL) throw new Error("Zugangsdaten fehlen (.env.local / .env.test)");
if (PROD_URL === TEST_URL) throw new Error("Quelle und Ziel sind dieselbe Datenbank — Abbruch.");

const prod = createClient(PROD_URL, PROD_KEY, { auth: { persistSession: false } });
const test = createClient(TEST_URL, TEST_KEY, { auth: { persistSession: false } });

const TEST_DOMAIN = "@viennasalsastudio.test";

/**
 * Die Suite benutzt zwei Passwörter — die PROJ-11-Konten ein eigenes.
 *
 * In der Produktion liegen Passwörter nur als Prüfwert vor, kopieren geht
 * also nicht; sie müssen hier gesetzt werden. Welches wohin gehört, steht in
 * den Tests selbst. Ein einheitliches Passwort hat beim ersten Lauf fünf
 * PROJ-11-Tests scheitern lassen: Die Anmeldung schlug fehl, die Seite zeigte
 * dem nicht angemeldeten Besucher keine Videolektionen, und der Test meldete
 * „Videolektionen nicht gefunden" — ein Datenproblem war es nicht.
 */
const PASSWORT_STANDARD = "CorrectPassword123!";
const PASSWORT_PROJ11 = "TestPassword123!";
const passwortFuer = (email) => (email.startsWith("e2e11-") ? PASSWORT_PROJ11 : PASSWORT_STANDARD);

function log(...t) { console.log(...t); }

async function alleZeilen(client, tabelle, spalten = "*") {
  const { data, error } = await client.from(tabelle).select(spalten);
  if (error) throw new Error(`${tabelle} lesen: ${error.message}`);
  return data ?? [];
}

async function schreibe(tabelle, zeilen) {
  if (zeilen.length === 0) { log(`  ${tabelle}: 0`); return; }
  for (let i = 0; i < zeilen.length; i += 500) {
    const { error } = await test.from(tabelle).insert(zeilen.slice(i, i + 500));
    if (error) throw new Error(`${tabelle} schreiben: ${error.message}`);
  }
  log(`  ${tabelle}: ${zeilen.length}`);
}

// ---------------------------------------------------------------- aufräumen
/**
 * In umgekehrter Abhängigkeitsreihenfolge, damit keine Fremdschlüssel brechen.
 *
 * Je Tabelle die Spalte, über die alles gelöscht wird. Nicht jede hat eine
 * id — die Tabellen mit zusammengesetztem Schlüssel brauchen eine eigene,
 * und sie zu raten hat beim ersten Versuch danebengegriffen.
 */
const LEEREN = [
  ["notification_queue", "id"],
  ["notification_preferences", "customer_id"],
  ["push_subscriptions", "id"],
  ["invoices", "id"],
  ["customer_credits", "id"],
  ["sepa_collection_items", "id"],
  ["sepa_collection_runs", "id"],
  ["course_attendance", "course_id"],
  ["course_session_notes", "course_id"],
  ["tickets", "id"],
  ["events", "id"],
  ["waitlist_entries", "id"],
  ["course_bookings", "id"],
  ["subscriptions", "id"],
  ["sepa_mandates", "id"],
  ["course_teachers", "course_id"],
  ["course_entry_dates", "id"],
  ["course_schedule_pauses", "id"],
  ["course_schedule", "id"],
  ["courses", "id"],
  ["video_set_lesson_videos", "id"],
  ["video_set_lessons", "id"],
  ["video_sets", "id"],
  ["rooms", "id"],
  ["locations", "id"],
  ["dance_styles", "id"],
  ["coupons", "id"],
];

async function leeren() {
  log("Testdatenbank leeren…");
  for (const [tabelle, spalte] of LEEREN) {
    const { error } = await test.from(tabelle).delete().not(spalte, "is", null);
    if (error) throw new Error(`${tabelle} leeren: ${error.message}`);
  }
  const { error: zaehler } = await test.from("invoice_number_counters").delete().gte("year", 0);
  if (zaehler) throw new Error(`invoice_number_counters leeren: ${zaehler.message}`);

  const { data: vorhandene } = await test.auth.admin.listUsers({ perPage: 1000 });
  for (const u of vorhandene.users) await test.auth.admin.deleteUser(u.id);
  log(`  ${vorhandene.users.length} Konten entfernt`);
}

// ------------------------------------------------------------------ konten
async function konten() {
  log("Konten anlegen…");
  const { data: alle } = await prod.auth.admin.listUsers({ perPage: 1000 });
  const testKonten = alle.users.filter((u) => u.email?.endsWith(TEST_DOMAIN));
  const profile = await alleZeilen(prod, "profiles");
  const profilNach = new Map(profile.map((p) => [p.id, p]));

  let angelegt = 0;
  for (const u of testKonten) {
    // Den Bestätigungsstand mitnehmen: Ein Konto ist absichtlich
    // unbestätigt, damit PROJ-2 den Hinweis „bitte E-Mail bestätigen"
    // prüfen kann. Alle bestätigt anzulegen hat genau diesen Test gekippt.
    const { error } = await test.auth.admin.createUser({
      id: u.id,
      email: u.email,
      password: passwortFuer(u.email),
      email_confirm: Boolean(u.email_confirmed_at),
    });
    if (error) throw new Error(`Konto ${u.email}: ${error.message}`);
    angelegt++;
    // Der Trigger legt das Profil als 'customer' an; Name und Rolle nachziehen.
    const p = profilNach.get(u.id);
    if (p) {
      const { error: e } = await test.from("profiles").update({
        full_name: p.full_name, role: p.role, phone: p.phone,
        birthdate: p.birthdate, gender: p.gender,
        referral_source: p.referral_source, language: p.language,
      }).eq("id", u.id);
      if (e) throw new Error(`Profil ${u.email}: ${e.message}`);
    }
  }
  log(`  ${angelegt} Testkonten (echte Personen übersprungen: ${alle.users.length - testKonten.length})`);
  return new Set(testKonten.map((u) => u.id));
}

// ------------------------------------------------------------------- daten
async function daten(erlaubteKunden) {
  const nurErlaubte = (zeilen, feld = "customer_id") => zeilen.filter((z) => erlaubteKunden.has(z[feld]));

  /**
   * Leert Verweise auf Konten, die es hier nicht gibt.
   *
   * „Wer hat die Anwesenheit eingetragen" zeigt in der Produktion teils auf
   * echte Lehrer. Die kopiere ich nicht — statt das Konto mitzunehmen, geht
   * die Spur verloren. Für einen Test spielt sie keine Rolle; für den
   * Datenschutz schon.
   */
  const ohneFremde = (zeilen, feld) =>
    zeilen.map((z) => (z[feld] && !erlaubteKunden.has(z[feld]) ? { ...z, [feld]: null } : z));

  log("Stammdaten…");
  await schreibe("dance_styles", await alleZeilen(prod, "dance_styles"));
  await schreibe("locations", await alleZeilen(prod, "locations"));
  await schreibe("rooms", await alleZeilen(prod, "rooms"));
  await schreibe("video_sets", await alleZeilen(prod, "video_sets"));
  await schreibe("video_set_lessons", await alleZeilen(prod, "video_set_lessons"));
  await schreibe("video_set_lesson_videos", await alleZeilen(prod, "video_set_lesson_videos"));
  await schreibe("courses", await alleZeilen(prod, "courses"));
  await schreibe("course_schedule", await alleZeilen(prod, "course_schedule"));
  await schreibe("course_schedule_pauses", await alleZeilen(prod, "course_schedule_pauses"));
  await schreibe("course_entry_dates", await alleZeilen(prod, "course_entry_dates"));
  await schreibe("course_teachers", nurErlaubte(await alleZeilen(prod, "course_teachers"), "teacher_id"));
  await schreibe("events", await alleZeilen(prod, "events"));
  await schreibe("coupons", await alleZeilen(prod, "coupons"));

  log("Kundenbezogene Daten…");
  await schreibe("sepa_mandates", nurErlaubte(await alleZeilen(prod, "sepa_mandates")));
  await schreibe("subscriptions", nurErlaubte(await alleZeilen(prod, "subscriptions")));
  await schreibe("course_bookings", nurErlaubte(await alleZeilen(prod, "course_bookings")));
  await schreibe("waitlist_entries", nurErlaubte(await alleZeilen(prod, "waitlist_entries")));
  await schreibe("tickets", ohneFremde(nurErlaubte(await alleZeilen(prod, "tickets")), "checked_in_by"));
  await schreibe("course_attendance", ohneFremde(nurErlaubte(await alleZeilen(prod, "course_attendance")), "marked_by"));
  await schreibe("course_session_notes", ohneFremde(await alleZeilen(prod, "course_session_notes"), "updated_by"));

  /**
   * Lastschriftläufe samt Rechnungen gehören mit.
   *
   * PROJ-10 legt einen festen Lauf zum 15.01.2028 an, aber nur, wenn es ihn
   * noch nicht gibt — und PROJ-36 rechnet mit genau dessen drei Rechnungen.
   * Ohne den Lauf im Seed legte ihn PROJ-10 neu an, und weil hier alle Abos
   * und Mandate von Anfang an existieren, erfasste er acht statt drei
   * Positionen. Die Summen im Buchhaltungsexport stimmten dann nicht mehr.
   */
  const laeufe = ohneFremde(await alleZeilen(prod, "sepa_collection_runs"), "created_by");
  await schreibe("sepa_collection_runs", laeufe);
  const positionen = nurErlaubte(await alleZeilen(prod, "sepa_collection_items"));
  await schreibe("sepa_collection_items", positionen);
  const erlaubtePositionen = new Set(positionen.map((z) => z.id));
  const rechnungen = nurErlaubte(await alleZeilen(prod, "invoices")).filter(
    (r) => r.collection_item_id === null || erlaubtePositionen.has(r.collection_item_id)
  );
  await schreibe("invoices", rechnungen);
  // Der Zähler bestimmt die nächste Rechnungsnummer — ohne ihn liefe die
  // Nummernfolge in bereits vergebene Nummern hinein.
  await schreibe("invoice_number_counters", await alleZeilen(prod, "invoice_number_counters"));
  await schreibe("customer_credits", nurErlaubte(await alleZeilen(prod, "customer_credits")));
  await schreibe("notification_preferences", nurErlaubte(await alleZeilen(prod, "notification_preferences")));

  log("Einstellungen…");
  const [preise] = await alleZeilen(prod, "dropin_pricing");
  if (preise) {
    const { id, ...rest } = preise;
    const { error } = await test.from("dropin_pricing").update(rest).not("id", "is", null);
    if (error) throw new Error(`dropin_pricing: ${error.message}`);
    log("  dropin_pricing: aktualisiert");
  }
  const [rechnung] = await alleZeilen(prod, "invoice_settings");
  if (rechnung) {
    const { id, ...rest } = rechnung;
    const { error } = await test.from("invoice_settings").update(rest).not("id", "is", null);
    if (error) throw new Error(`invoice_settings: ${error.message}`);
    log("  invoice_settings: aktualisiert");
  }
}

// -------------------------------------------------------------------- lauf
log(`Quelle:  ${PROD_URL}`);
log(`Ziel:    ${TEST_URL}\n`);
await leeren();
const erlaubte = await konten();
await daten(erlaubte);
log("\nFertig.");
