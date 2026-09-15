import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
    const { error } = await client.auth.signInWithPassword({ email: mail, password: passwort });
    if (error) throw error;
    return client;
  })();

  // Scheitert die Anmeldung, darf der Fehlschlag nicht im Gedächtnis bleiben —
  // sonst schlüge jede weitere Prüfung mit demselben Fehler fehl.
  versprechen.catch(() => offen.delete(schluessel));
  offen.set(schluessel, versprechen);
  return versprechen;
}
