import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

try {
  ladeTestUmgebung();
} catch {
  // Schon geladen — unkritisch.
}

const PASSWORT = "CorrectPassword123!";
const LEHRER_MIT_KURS = "e2e13-lehrer-a@viennasalsastudio.test";
const LEHRER_OHNE_KURS = "e2e13-lehrer-c@viennasalsastudio.test";
const KUNDE = "e2e8-customer@viennasalsastudio.test";
const KURS_ID = "6032ce07-b19c-445b-9f42-f45921df557e"; // gehört Lehrer A und B

const HEUTE = new Date().toISOString().slice(0, 10);
const IN_EINEM_JAHR = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);

/**
 * Die fünf Funktionen, über die der Lehrer-Bereich seine Daten holt.
 *
 * Sie laufen als `SECURITY DEFINER` und umgehen damit die Zeilenregeln der
 * Tabellen — der Zaun steckt ausschließlich in ihrem eigenen `where`. Genau
 * deshalb gehören sie einzeln geprüft: Fällt er in einer davon weg, sieht
 * jede angemeldete Person die Kursdaten fremder Lehrer.
 */
const FUNKTIONEN: { name: string; argumente: Record<string, unknown> }[] = [
  { name: "get_course_participants", argumente: { p_course_ids: [KURS_ID] } },
  { name: "get_course_attendance_dates", argumente: { p_course_ids: [KURS_ID] } },
  { name: "get_course_active_subscribers", argumente: { p_course_ids: [KURS_ID] } },
  { name: "get_course_dance_roles", argumente: { p_course_ids: [KURS_ID] } },
  { name: "get_last_session_notes", argumente: { p_course_ids: [KURS_ID] } },
  {
    name: "get_course_trial_bookings",
    argumente: { p_course_ids: [KURS_ID], p_von: HEUTE, p_bis: IN_EINEM_JAHR },
  },
];

async function alsNutzer(email: string): Promise<SupabaseClient> {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORT });
  if (error) throw new Error(`Anmeldung als ${email} fehlgeschlagen: ${error.message}`);
  return client;
}

test.describe("PROJ-49 Sicherheit: Der Zaun um die Kursdaten", () => {
  // Ohne diese Gegenprobe wäre der ganze Rest wertlos: Käme auch für den
  // zugewiesenen Lehrer nichts zurück, bestünde jede Verweigerung unten
  // aus dem falschen Grund.
  test("Gegenprobe: Der zugewiesene Lehrer bekommt tatsächlich Daten", async () => {
    const client = await alsNutzer(LEHRER_MIT_KURS);
    const { data, error } = await client.rpc("get_course_participants", {
      p_course_ids: [KURS_ID],
    });
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  for (const { name, argumente } of FUNKTIONEN) {
    test(`Eine Lehrkraft ohne Zuweisung bekommt aus ${name} nichts`, async () => {
      const client = await alsNutzer(LEHRER_OHNE_KURS);
      const { data, error } = await client.rpc(name, argumente);
      expect(error, `${name} soll nicht mit Fehler antworten, sondern mit nichts`).toBeNull();
      expect(data ?? [], `${name} gibt Daten eines fremden Kurses heraus`).toEqual([]);
    });

    test(`Ein Kunde bekommt aus ${name} nichts`, async () => {
      const client = await alsNutzer(KUNDE);
      const { data, error } = await client.rpc(name, argumente);
      expect(error).toBeNull();
      expect(data ?? [], `${name} gibt Kursdaten an einen Kunden heraus`).toEqual([]);
    });
  }

  test("Ohne Anmeldung gibt keine der Funktionen Daten heraus", async () => {
    const anonym = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    // Zwei zulässige Antworten: abgewiesen oder leer. Drei der Funktionen sind
    // für Nicht-Angemeldete noch *aufrufbar* (QA-Befund vom 2026-09-09,
    // Schweregrad niedrig) — herausgeben tun sie deshalb trotzdem nichts, weil
    // der Zaun im Rumpf steckt und nicht allein im Ausführungsrecht.
    for (const { name, argumente } of FUNKTIONEN) {
      const { data, error } = await anonym.rpc(name, argumente);
      if (error) continue;
      expect(data ?? [], `${name} gibt Daten an einen anonymen Aufrufer heraus`).toEqual([]);
    }
  });
});
