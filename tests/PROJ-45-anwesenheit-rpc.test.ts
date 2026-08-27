import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * PROJ-45: count_my_recent_attendance.
 *
 * Läuft direkt gegen die Datenbank statt durch die Oberfläche — der Punkt
 * dieser Funktion ist eine Zugangsregel, und die prüft man dort, wo sie gilt.
 * course_attendance hat RLS aktiv und keine einzige Policy; wäre die Funktion
 * zu großzügig, käme man über sie an fremde Anwesenheiten.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const MAIL_A = "proj45-anwesenheit-a@viennasalsastudio.test";
const MAIL_B = "proj45-anwesenheit-b@viennasalsastudio.test";
const PASSWORT = "CorrectPassword123!";

let service: SupabaseClient;
let kundeA: string;
let kundeB: string;
let kursId: string;

/** Kalendertag in Wien, mit Versatz in Tagen — dieselbe Rechnung wie heute_wien(). */
function tagInWien(versatz: number): string {
  const d = new Date(Date.now() + versatz * 24 * 60 * 60 * 1000);
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Vienna" });
}

async function anlegen(mail: string): Promise<string> {
  const { data: vorhanden } = await service.auth.admin.listUsers({ perPage: 300 });
  const alt = vorhanden.users.find((u) => u.email === mail);
  if (alt) await service.auth.admin.deleteUser(alt.id);
  const { data, error } = await service.auth.admin.createUser({
    email: mail,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

async function alsKunde(mail: string): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: mail, password: PASSWORT });
  if (error) throw error;
  return c;
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });

  kundeA = await anlegen(MAIL_A);
  kundeB = await anlegen(MAIL_B);

  const { data: kurs } = await service.from("courses").select("id").limit(1).single();
  kursId = kurs!.id;

  await service.from("course_attendance").delete().in("customer_id", [kundeA, kundeB]);
  await service.from("course_attendance").insert([
    // Kunde A: drei Anwesenheiten im Fenster …
    { course_id: kursId, customer_id: kundeA, occurrence_date: tagInWien(-1), status: "present" },
    { course_id: kursId, customer_id: kundeA, occurrence_date: tagInWien(-14), status: "present" },
    { course_id: kursId, customer_id: kundeA, occurrence_date: tagInWien(-55), status: "present" },
    // … eine Abwesenheit, die nicht zählen darf …
    { course_id: kursId, customer_id: kundeA, occurrence_date: tagInWien(-3), status: "absent" },
    // … und eine Anwesenheit knapp außerhalb der acht Wochen.
    { course_id: kursId, customer_id: kundeA, occurrence_date: tagInWien(-70), status: "present" },
    // Kunde B hat genau eine.
    { course_id: kursId, customer_id: kundeB, occurrence_date: tagInWien(-2), status: "present" },
  ]);
}, 60000);

afterAll(async () => {
  await service.from("course_attendance").delete().in("customer_id", [kundeA, kundeB]);
  for (const id of [kundeA, kundeB]) if (id) await service.auth.admin.deleteUser(id);
});

describe("count_my_recent_attendance", () => {
  it("zählt nur Anwesenheiten, nicht Abwesenheiten", async () => {
    const c = await alsKunde(MAIL_A);
    const { data, error } = await c.rpc("count_my_recent_attendance");
    expect(error).toBeNull();
    // -1, -14, -55 zählen; -3 ist 'absent', -70 liegt außerhalb.
    expect(data).toBe(3);
  });

  it("zählt für jeden Kunden nur die eigenen", async () => {
    const c = await alsKunde(MAIL_B);
    const { data } = await c.rpc("count_my_recent_attendance");
    expect(data).toBe(1);
  });

  it("gibt anonymen Aufrufern gar keinen Zugang", async () => {
    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    const { error } = await anon.rpc("count_my_recent_attendance");
    // Kein Ausführungsrecht für anon — die Funktion ist nicht erreichbar.
    expect(error).not.toBeNull();
  });

  it("gibt keinen Weg an fremde Anwesenheiten frei", async () => {
    // Die Funktion nimmt kein Argument. Der eigentliche Schutz ist aber, dass
    // die Tabelle selbst verschlossen bleibt — sonst wäre die Funktion nur
    // eine Höflichkeit.
    const c = await alsKunde(MAIL_A);
    const { data } = await c.from("course_attendance").select("*").eq("customer_id", kundeB);
    expect(data ?? []).toHaveLength(0);
  });
});
