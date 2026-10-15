import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { totpCode, restDesFensters } from "./totp";
import { schluessel, merkeSchluessel } from "./zweite-stufe-speicher";

/**
 * Angemeldete Clients für die Datenbanktests — einmal je Konto.
 *
 * Vorher meldete sich jede Prüfung neu an. Bei mehreren Testdateien lief das
 * in die Drosselung von Supabase („Request rate limit reached"), und zwar
 * unzuverlässig: mal ging es, mal nicht. Ein Client je Konto genügt — die
 * Sitzung bleibt für den ganzen Lauf gültig.
 */
const offen = new Map<string, Promise<SupabaseClient>>();

/** Warten, ohne eine Testbibliothek dafür zu brauchen. */
function warte(ms: number): Promise<void> {
  return new Promise((fertig) => setTimeout(fertig, ms));
}

/**
 * **Der Client ist geteilt.** Niemals `signOut()` darauf aufrufen.
 *
 * Playwright läuft hier mit einem einzigen Arbeiter, und der Modulzustand
 * überlebt die Dateigrenze: Was eine Spec-Datei hier anmeldet, bekommt jede
 * später laufende Datei zurück. Ein `signOut()` hinterlässt deshalb einen
 * toten Client für alle anderen — und die Datenbank antwortet einem
 * abgemeldeten Client nicht mit einem Fehler, sondern mit null betroffenen
 * Zeilen. Ein Test, der ein Verbot prüft, meldet dann grün.
 */
export function angemeldetAls(url: string, anonKey: string, mail: string, passwort: string): Promise<SupabaseClient> {
  const schluessel = `${url}|${mail}`;
  const vorhanden = offen.get(schluessel);
  if (vorhanden) return vorhanden;

  const versprechen = (async () => {
    const client = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email: mail, password: passwort });
    if (error) throw error;
    await zweiteStufeFallsNoetig(client, url, data.user.id);
    return client;
  })();

  // Scheitert die Anmeldung, darf der Fehlschlag nicht im Gedächtnis bleiben —
  // sonst schlüge jede weitere Prüfung mit demselben Fehler fehl.
  versprechen.catch(() => offen.delete(schluessel));
  offen.set(schluessel, versprechen);
  return versprechen;
}

/**
 * Verwaltungskonten auf die zweite Stufe heben (PROJ-58).
 *
 * Seit die Datenbank für Admins einen bestätigten Code verlangt, reicht ein
 * Passwort nicht mehr: `current_role()` antwortet dann schlicht nicht mit
 * 'admin', und jede Regel, die das verlangt, greift nicht — zuletzt aufgefallen
 * beim Hochladen eines Eventbildes, wo die Speicher-Regel genau danach fragt.
 *
 * Für Kunden- und Lehrerkonten passiert hier nichts.
 *
 * Ein bestehender Faktor wird verworfen und neu angelegt: Sein Schlüssel ist
 * nicht mehr auslesbar, und ohne Schlüssel gibt es keinen Code. Das ist
 * ausdrücklich so gewollt — deshalb der Umweg.
 */
async function zweiteStufeFallsNoetig(client: SupabaseClient, url: string, kennung: string): Promise<void> {
  const { data: profil, error: rollenFehler } = await client
    .from("profiles")
    .select("role")
    .eq("id", kennung)
    .maybeSingle();

  // Ein Lesefehler darf hier nicht als „kein Admin“ durchgehen. Vorher stand
  // nur `data` da: Schlug die Abfrage fehl — im Volllauf unter Last durchaus
  // möglich —, war `profil` null, die Funktion kehrte still zurück, und der
  // Client blieb auf der ersten Stufe. Jede Admin-Änderung danach traf
  // lautlos null Zeilen, und PostgREST meldet das nicht als Fehler. Genau so
  // ist PROJ-47 „ein freigegebener Lauf lässt sich nicht ändern“ in zwei
  // Vollläufen rot geworden: Der Test hielt ein ausbleibendes Verbot für eine
  // fehlende Sperre.
  if (rollenFehler) {
    throw new Error(`tests: Rolle von ${kennung} nicht lesbar (${rollenFehler.message})`);
  }
  if (profil?.role !== "admin") return;

  const { data: nutzer } = await client.auth.getUser();
  const mail = nutzer?.user?.email ?? "";

  // Zuerst den bekannten Schlüssel versuchen. Der Lauf-Aufbau von Playwright
  // legt ihn an, und ein neuer Faktor würde ihn ungültig machen — die
  // Browsertests blieben dann auf der Code-Seite hängen. Genau das ist beim
  // ersten Versuch passiert.
  const bekannt = schluessel()[mail];
  if (bekannt) {
    const { data: vorhandene } = await client.auth.mfa.listFactors();
    const bestaetigt = (vorhandene?.totp ?? []).find((f) => f.status === "verified");
    if (bestaetigt) {
      // Bis zu drei Fenster versuchen, **bevor** der Faktor angetastet wird.
      //
      // Ein abgelehnter Code heißt fast nie „falscher Schlüssel", sondern
      // „dieser Code war schon dran": Supabase nimmt denselben Code nicht
      // zweimal, und in einem Volllauf melden mehrere Arbeiter innerhalb
      // derselben dreißig Sekunden dasselbe Konto an. Der Ausweg ist das
      // nächste Fenster, nicht ein neuer Faktor.
      //
      // Das Löschen darunter ist nämlich **destruktiv**: Es nimmt dem Konto
      // alle Faktoren, und bestehende Sitzungen anderer Arbeiter fallen beim
      // nächsten Auffrischen auf die erste Stufe zurück. Danach gilt der
      // Client der Datenbank nicht mehr als Admin, jede Admin-Änderung trifft
      // lautlos null Zeilen — genau so sind PROJ-47 und PROJ-58 im Volllauf
      // rot geworden, dreimal in Folge.
      for (let versuch = 0; versuch < 3; versuch++) {
        if (versuch > 0) {
          await warte(restDesFensters() + 500);
        }
        const { error } = await client.auth.mfa.challengeAndVerify({
          factorId: bestaetigt.id,
          code: totpCode(bekannt),
        });
        if (!error) {
          await pruefeZweiteStufe(client, mail);
          return;
        }
      }
      // Drei Fenster abgelehnt: Dann passt der Schlüssel wirklich nicht mehr,
      // und unten wird frisch eingerichtet.
    }
  }

  const dienst = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data: alte } = await dienst.auth.admin.mfa.listFactors({ userId: kennung });
  for (const faktor of alte?.factors ?? []) {
    await dienst.auth.admin.mfa.deleteFactor({ id: faktor.id, userId: kennung });
  }

  const { data: neu, error: enrollFehler } = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `DB-Test ${Date.now()}`,
  });
  if (enrollFehler || !neu) {
    throw new Error(`tests: zweite Stufe konnte nicht eingerichtet werden (${enrollFehler?.message})`);
  }

  const { error: pruefFehler } = await client.auth.mfa.challengeAndVerify({
    factorId: neu.id,
    code: totpCode(neu.totp.secret),
  });
  if (pruefFehler) throw new Error(`tests: Code wurde abgelehnt (${pruefFehler.message})`);

  // Merken, damit die andere Testwelt denselben Schlüssel benutzt.
  if (mail) merkeSchluessel(mail, neu.totp.secret);

  await pruefeZweiteStufe(client, mail);
}

/**
 * Nachsehen, dass die Sitzung wirklich auf der zweiten Stufe steht.
 *
 * Ohne diese Kontrolle ist der Unterschied zwischen „Admin“ und „angemeldet“
 * unsichtbar: Die Datenbank antwortet einem Client auf der ersten Stufe nicht
 * mit einem Fehler, sondern mit null betroffenen Zeilen. Ein Test, der ein
 * Verbot prüfen soll, sieht dann Erfolg, wo er Scheitern messen wollte.
 */
async function pruefeZweiteStufe(client: SupabaseClient, mail: string): Promise<void> {
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) {
    throw new Error(`tests: Stufe von ${mail} nicht feststellbar (${error.message})`);
  }
  if (data?.currentLevel !== "aal2") {
    throw new Error(
      `tests: ${mail} steht auf ${data?.currentLevel ?? "unbekannt"} statt aal2 — ` +
        "als Admin gilt dieser Client der Datenbank nicht"
    );
  }
}
