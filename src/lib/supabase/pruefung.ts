import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Eine Verbindung, die *nichts* mitschreibt — zum Gegenprüfen eines Passworts
 * (PROJ-73).
 *
 * Warum nicht der gewöhnliche Server-Client: Der schreibt die Sitzungscookies.
 * Eine Anmeldung darüber ersetzte die laufende Sitzung durch eine frische auf
 * der *ersten* Stufe. Ein Verwaltungskonto würde damit mitten im Speichern auf
 * die Code-Seite geschickt (PROJ-58) — und hätte danach ein unverändertes
 * Passwort. Hier wird deshalb weder ein Cookie gesetzt noch eine Sitzung
 * aufbewahrt oder aufgefrischt.
 *
 * Mit dem öffentlichen Schlüssel, nicht mit dem Service-Schlüssel: Geprüft
 * wird mit demselben Recht, das jeder Anmeldung zusteht.
 */
export function createPruefClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
}
