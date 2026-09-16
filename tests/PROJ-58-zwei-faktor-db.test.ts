import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { totpCode } from "./totp";

/**
 * PROJ-58: Was die Datenbank selbst durchsetzt.
 *
 * Die Oberfläche kann man umgehen. Adresse und öffentlicher Zugangsschlüssel
 * stehen in jeder ausgelieferten Seite, also könnte jemand mit einem erbeuteten
 * Admin-Passwort an den Seiten vorbei direkt mit der Datenbank sprechen. Genau
 * dagegen ist diese Schicht gebaut — und genau deshalb wird sie hier geprüft
 * und nicht nur im Browser.
 *
 * Braucht beide Migrationen:
 *   20260916120000_proj58_zweite_stufe_grundlage.sql
 *   20260916121000_proj58_zweite_stufe_erzwingen.sql
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const ADMIN = "proj58-admin@viennasalsastudio.test";
const KUNDE = "proj58-kunde@viennasalsastudio.test";
const PASSWORT = "CorrectPassword123!";

let service: SupabaseClient;
/** Angemeldet, aber ohne bestätigten Code — der Zustand nach dem Passwort. */
let ohneCode: SupabaseClient;
/** Angemeldet und bestätigt. */
let mitCode: SupabaseClient;
let alsKunde: SupabaseClient;
const nutzer: Record<string, string> = {};

async function kontoAnlegen(mail: string, rolle: "admin" | "customer"): Promise<string> {
  const { data: vorhandene } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = vorhandene?.users.find((u) => u.email === mail);
  if (alt) await service.auth.admin.deleteUser(alt.id);

  const { data, error } = await service.auth.admin.createUser({
    email: mail,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-58 Konto ${mail}: ${error?.message}`);

  await service.from("profiles").update({ role: rolle, full_name: "E2E58 DB-Prüfkonto" }).eq("id", data.user.id);
  nutzer[mail] = data.user.id;
  return data.user.id;
}

async function anmelden(mail: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: mail, password: PASSWORT });
  if (error) throw new Error(`PROJ-58 Anmeldung ${mail}: ${error.message}`);
  return client;
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });
  await kontoAnlegen(ADMIN, "admin");
  await kontoAnlegen(KUNDE, "customer");

  // Erst die Anmeldung *ohne* Code: Ihr Token entsteht, bevor irgendein Faktor
  // besteht, und bleibt damit auf der ersten Stufe — genau der Zustand, den
  // jemand mit erbeutetem Passwort hätte.
  ohneCode = await anmelden(ADMIN);

  mitCode = await anmelden(ADMIN);
  const { data: eingerichtet, error: enrollFehler } = await mitCode.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "DB-Prüfung",
  });
  if (enrollFehler || !eingerichtet) throw new Error(`PROJ-58 Einrichtung: ${enrollFehler?.message}`);

  const { error: pruefFehler } = await mitCode.auth.mfa.challengeAndVerify({
    factorId: eingerichtet.id,
    code: totpCode(eingerichtet.totp.secret),
  });
  if (pruefFehler) throw new Error(`PROJ-58 Codeprüfung: ${pruefFehler.message}`);

  alsKunde = await anmelden(KUNDE);
}, 60_000);

afterAll(async () => {
  for (const kennung of Object.values(nutzer)) {
    await service.auth.admin.deleteUser(kennung).catch(() => {});
  }
});

describe("PROJ-58: Die Datenbank verlangt die zweite Stufe", () => {
  it("ohne bestätigten Code sieht ein Admin nur seine eigene Profilzeile", async () => {
    const { data } = await ohneCode.from("profiles").select("id");
    expect(data).toHaveLength(1);
    expect(data![0].id).toBe(nutzer[ADMIN]);
  });

  it("mit bestätigtem Code sieht derselbe Admin alle Profile", async () => {
    const { data } = await mitCode.from("profiles").select("id");
    expect(data!.length).toBeGreaterThan(1);
  });

  it("ohne bestätigten Code kommt ein Admin an keine Bankdaten", async () => {
    const { data } = await ohneCode.from("sepa_mandates").select("id");
    expect(data).toHaveLength(0);
  });

  it("ohne bestätigten Code darf ein Admin keine fremden Sitzungen beenden", async () => {
    const { error } = await ohneCode.rpc("admin_sitzungen_beenden", { p_user_id: nutzer[KUNDE] });
    expect(error?.message).toContain("Nur Administratoren");
  });

  it("mit bestätigtem Code darf er es", async () => {
    const { error } = await mitCode.rpc("admin_sitzungen_beenden", { p_user_id: nutzer[KUNDE] });
    expect(error).toBeNull();
  });

  it("auch mit bestätigtem Code nicht das eigene Konto", async () => {
    const { error } = await mitCode.rpc("admin_sitzungen_beenden", { p_user_id: nutzer[ADMIN] });
    expect(error?.message).toContain("eigene Konto");
  });

  it("ohne bestätigten Code kann ein Admin keine Rolle vergeben", async () => {
    const { error } = await ohneCode
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", nutzer[KUNDE]);
    // Entweder der Trigger schlägt Alarm oder die Zeile ist für ihn unsichtbar —
    // beides hält ihn auf. Was nicht passieren darf: eine stille Beförderung.
    const { data: danach } = await service.from("profiles").select("role").eq("id", nutzer[KUNDE]).single();
    expect(danach!.role).toBe("customer");
    if (error) expect(error.message).toBeTruthy();
  });

  it("für ein Kundenkonto ändert sich nichts", async () => {
    const { data } = await alsKunde.from("profiles").select("id");
    expect(data).toHaveLength(1);
    expect(data![0].id).toBe(nutzer[KUNDE]);
  });
});
