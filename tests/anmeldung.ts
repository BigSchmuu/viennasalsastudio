import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { totpCode } from "./totp";
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
  const { data: profil } = await client.from("profiles").select("role").eq("id", kennung).maybeSingle();
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
      const { error } = await client.auth.mfa.challengeAndVerify({
        factorId: bestaetigt.id,
        code: totpCode(bekannt),
      });
      if (!error) return;
      // Passt der Schlüssel nicht mehr, wird unten frisch eingerichtet.
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
}
