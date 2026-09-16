import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";
import { totpCode, restDesFensters } from "./totp";

/**
 * Die zweite Stufe für die Testkonten (PROJ-58).
 *
 * Seit die Verwaltung eine Authenticator-App verlangt, kommt kein Test mehr
 * nach `/admin`, ohne einen gültigen Code einzugeben. Diese Datei richtet die
 * App vor dem Lauf für jedes Verwaltungskonto ein und hält den Schlüssel
 * bereit, damit die Tests Codes erzeugen können.
 *
 * Bewusst über den normalen Weg: Supabase kann einen Faktor nicht von außen
 * anlegen, und das ist gut so. Also meldet sich der Aufbau als das jeweilige
 * Konto an und durchläuft dieselbe Einrichtung wie ein Mensch.
 */

const ABLAGE = "test-results/zweite-stufe.json";
const TEST_PASSWORT = "CorrectPassword123!";

type Schluessel = Record<string, string>;

let gemerkt: Schluessel | null = null;

/** Die Schlüssel aus dem Lauf-Aufbau. Leer, wenn noch nichts eingerichtet wurde. */
export function schluessel(): Schluessel {
  if (gemerkt) return gemerkt;
  gemerkt = existsSync(ABLAGE) ? (JSON.parse(readFileSync(ABLAGE, "utf8")) as Schluessel) : {};
  return gemerkt;
}

/**
 * Für jedes Verwaltungskonto der Testdatenbank eine Authenticator-App
 * hinterlegen. Läuft einmal vor der gesamten Suite.
 */
export async function richteVerwaltungskontenEin(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const dienst = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const { data: verwaltungskonten, error } = await dienst
    .from("profiles")
    .select("id")
    .eq("role", "admin");
  if (error) throw new Error(`Verwaltungskonten konnten nicht gelesen werden: ${error.message}`);

  const ergebnis: Schluessel = {};

  for (const konto of verwaltungskonten ?? []) {
    const { data: nutzer } = await dienst.auth.admin.getUserById(konto.id);
    const mail = nutzer?.user?.email;
    if (!mail) continue;

    // Reste aus früheren Läufen entfernen — sonst blockiert ein alter,
    // unbestätigter Eintrag den Namen, und die Einrichtung scheitert an etwas,
    // das mit dem Vorgang nichts zu tun hat.
    const { data: alte } = await dienst.auth.admin.mfa.listFactors({ userId: konto.id });
    for (const faktor of alte?.factors ?? []) {
      await dienst.auth.admin.mfa.deleteFactor({ id: faktor.id, userId: konto.id });
    }

    const alsKonto = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error: anmeldeFehler } = await alsKonto.auth.signInWithPassword({
      email: mail,
      password: TEST_PASSWORT,
    });
    if (anmeldeFehler) {
      throw new Error(`Aufbau der zweiten Stufe: Anmeldung scheiterte (${anmeldeFehler.message})`);
    }

    const { data: eingerichtet, error: enrollFehler } = await alsKonto.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "E2E",
    });
    if (enrollFehler || !eingerichtet) {
      throw new Error(`Aufbau der zweiten Stufe: Einrichtung scheiterte (${enrollFehler?.message})`);
    }

    const geheim = eingerichtet.totp.secret;
    const { error: pruefFehler } = await alsKonto.auth.mfa.challengeAndVerify({
      factorId: eingerichtet.id,
      code: totpCode(geheim),
    });
    if (pruefFehler) {
      throw new Error(`Aufbau der zweiten Stufe: Code wurde abgelehnt (${pruefFehler.message})`);
    }

    ergebnis[mail] = geheim;

    // Die Anmeldedrosselung von Supabase hat diese Suite schon einmal reihenweise
    // rot gefärbt (siehe tests/anmeldung.ts). Zwölf Anmeldungen am Stück sind
    // ihr das nicht wert, ein kurzer Abstand kostet nichts.
    await new Promise((fertig) => setTimeout(fertig, 400));
  }

  mkdirSync("test-results", { recursive: true });
  writeFileSync(ABLAGE, JSON.stringify(ergebnis, null, 2));
  gemerkt = ergebnis;
}

/**
 * Nach dem Klick auf „Einloggen": Ist das ein Verwaltungskonto, kommt jetzt die
 * Code-Abfrage. Für Kundenkonten tut diese Funktion nichts.
 *
 * Das Häkchen „Diesem Gerät 30 Tage vertrauen" bleibt leer — jeder Test soll
 * denselben Weg gehen wie eine frische Anmeldung.
 */
export async function zweiteStufeErledigen(page: Page, mail: string): Promise<void> {
  const geheim = schluessel()[mail];
  if (!geheim) return;

  // Erst die Anmeldeseite verlassen lassen, dann nachsehen, wo wir gelandet
  // sind. Beides mit `catch`, weil dieselbe Zeile auch in Tests steht, die eine
  // *misslungene* Anmeldung prüfen — dort kommt die Code-Abfrage nie, und das
  // ist richtig so. Ein stures Warten würde solche Tests nur verzögern und dann
  // mit einer irreführenden Meldung zum Scheitern bringen.
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 }).catch(() => {});
  await page.waitForURL(/\/sicherheit\/code/, { timeout: 5000 }).catch(() => {});
  if (!page.url().includes("/sicherheit/code")) return;

  // Nicht im letzten Moment eines Fensters ablesen: Der Code wäre beim
  // Absenden schon abgelaufen, und der Test sähe aus wie ein Fehler der
  // Anwendung.
  if (restDesFensters() < 3000) {
    await page.waitForTimeout(restDesFensters() + 200);
  }

  await page.getByRole("textbox").first().fill(totpCode(geheim));
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page).not.toHaveURL(/\/sicherheit\/code/, { timeout: 20000 });
}
