import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AGB_VERSION } from "@/lib/legal";

/**
 * PROJ-53: Regeln, die die Datenbank selbst durchsetzt.
 *
 * Die Oberfläche kennt dieselben Regeln. Aber ein direkter Aufruf der
 * Kauffunktion oder ein Update an der Verwaltung vorbei darf sie nicht
 * umgehen — bei PROJ-52 (BUG-1) war genau das möglich. Deshalb wird hier
 * geprüft, wo die Regeln gelten.
 *
 * Braucht die Migration 20260914100000_proj53_veranstaltungsprogramm.sql in
 * der Testdatenbank.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const MAIL = "proj53-events-kunde@viennasalsastudio.test";
const PASSWORT = "CorrectPassword123!";
const ART_NAME = "E2E PROJ-53 Art";
const UNERLAUBTE_ART = "E2E PROJ-53 unerlaubt";
const STUNDE = 60 * 60 * 1000;

let service: SupabaseClient;
let kunde: string;
let artId: string;
const eventIds: string[] = [];

function zeitpunkt(versatzStunden: number): string {
  return new Date(Date.now() + versatzStunden * STUNDE).toISOString();
}

/** Legt ein Test-Event an; ohne Angaben eines mit Tickets, morgen. Wirft den Datenbankfehler weiter. */
async function eventAnlegen(felder: Record<string, unknown>): Promise<string> {
  const nummer = eventIds.length + 1;
  const { data, error } = await service
    .from("events")
    .insert({
      name: `E2E PROJ-53 Event ${nummer}`,
      slug: `e2e-proj53-event-${nummer}-${Date.now()}`,
      event_type_id: artId,
      sales_mode: "tickets",
      capacity: 10,
      price_normal: 10,
      price_student: 8,
      starts_at: zeitpunkt(24),
      ...felder,
    })
    .select("id")
    .single();
  if (error) throw error;
  eventIds.push(data.id);
  return data.id;
}

async function alsKunde(): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: MAIL, password: PASSWORT });
  if (error) throw error;
  return c;
}

async function kaufen(eventId: string) {
  const c = await alsKunde();
  return c.rpc("purchase_event_ticket", {
    p_event_id: eventId,
    p_payment_method: "onsite",
    p_wants_student_price: false,
    p_terms_accepted: true,
    p_terms_version: AGB_VERSION,
  });
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });

  const { data: vorhanden } = await service.auth.admin.listUsers({ perPage: 300 });
  const alt = vorhanden.users.find((u) => u.email === MAIL);
  if (alt) await service.auth.admin.deleteUser(alt.id);
  const { data, error } = await service.auth.admin.createUser({
    email: MAIL,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error) throw error;
  kunde = data.user.id;

  // Reste eines abgebrochenen Laufs: Events zuerst, sonst sperrt die Art das Löschen.
  const { data: alteArt } = await service.from("event_types").select("id").eq("name", ART_NAME).maybeSingle();
  if (alteArt) {
    await service.from("events").delete().eq("event_type_id", alteArt.id);
    await service.from("event_types").delete().eq("id", alteArt.id);
  }
  await service.from("event_types").delete().eq("name", UNERLAUBTE_ART);

  const { data: art, error: artFehler } = await service
    .from("event_types")
    .insert({ name: ART_NAME })
    .select("id")
    .single();
  if (artFehler) throw artFehler;
  artId = art.id;
}, 60000);

afterAll(async () => {
  // Tickets und frühere Adressen hängen mit „on delete cascade" an den Events.
  if (eventIds.length > 0) await service.from("events").delete().in("id", eventIds);
  if (artId) await service.from("event_types").delete().eq("id", artId);
  await service.from("event_types").delete().eq("name", UNERLAUBTE_ART);
  if (kunde) await service.auth.admin.deleteUser(kunde);
});

describe("purchase_event_ticket (PROJ-53)", () => {
  it("verkauft auch nach dem Beginn, solange das Event läuft", async () => {
    const id = await eventAnlegen({ starts_at: zeitpunkt(-1), ends_at: zeitpunkt(2) });
    const { data, error } = await kaufen(id);
    expect(error).toBeNull();
    expect(data).toMatchObject({ event_id: id, status: "reserved" });
  });

  it("verkauft nach dem Ende nicht mehr", async () => {
    const id = await eventAnlegen({ starts_at: zeitpunkt(-5), ends_at: zeitpunkt(-1) });
    const { error } = await kaufen(id);
    expect(error?.message).toContain("event not open");
  });

  it("zählt ein Event ohne Ende nach Mitternacht Wiener Zeit als vorbei", async () => {
    // Vor 25 Stunden begonnen: Die Mitternacht nach seinem Veranstaltungstag
    // liegt in jedem Fall schon hinter uns.
    const id = await eventAnlegen({ starts_at: zeitpunkt(-25), ends_at: null });
    const { error } = await kaufen(id);
    expect(error?.message).toContain("event not open");
  });

  it("verkauft bei „Nur anzeigen“ nichts, auch nicht per direktem Aufruf", async () => {
    const id = await eventAnlegen({ sales_mode: "display", capacity: null, price_normal: null, price_student: null });
    const { error } = await kaufen(id);
    expect(error?.message).toContain("event not open");
  });
});

describe("Regeln der Tabelle events (PROJ-53)", () => {
  it("lässt „Nur anzeigen“ nicht zu, solange gültige Tickets bestehen", async () => {
    const id = await eventAnlegen({});
    const { error: kaufFehler } = await kaufen(id);
    expect(kaufFehler).toBeNull();

    // Auch mit Service-Rechten, also an jeder Regel der Oberfläche vorbei.
    const { error } = await service.from("events").update({ sales_mode: "display" }).eq("id", id);
    expect(error?.message).toContain("event has valid tickets");
  });

  it("verlangt bei Tickets in der App Kapazität und Preise", async () => {
    await expect(eventAnlegen({ capacity: null })).rejects.toMatchObject({ code: "23514" });
    await expect(eventAnlegen({ price_student: null })).rejects.toMatchObject({ code: "23514" });
  });

  it("erlaubt bei „Nur anzeigen“ leere Kapazität und Preise", async () => {
    await expect(
      eventAnlegen({ sales_mode: "display", capacity: null, price_normal: null, price_student: null })
    ).resolves.toBeTruthy();
  });

  it("nimmt nur lesbare Adressen an", async () => {
    await expect(eventAnlegen({ slug: "Salsa Party" })).rejects.toMatchObject({ code: "23514" });
  });

  it("sperrt das Löschen einer Eventart, der noch Events zugeordnet sind", async () => {
    await eventAnlegen({});
    const { error } = await service.from("event_types").delete().eq("id", artId);
    expect(error?.code).toBe("23503");
  });
});

describe("Zugriff (PROJ-53)", () => {
  it("lässt Besucher ohne Konto Eventarten und frühere Adressen lesen", async () => {
    const id = await eventAnlegen({});
    const fruehere = `e2e-proj53-frueher-${Date.now()}`;
    const { error: merkFehler } = await service.from("event_previous_slugs").insert({ event_id: id, slug: fruehere });
    expect(merkFehler).toBeNull();

    // Eine Tabelle ohne passende Regel lieferte hier stumm eine leere Liste —
    // deshalb wird eine Zeile erwartet, nicht nur „kein Fehler".
    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    const arten = await anon.from("event_types").select("id").eq("id", artId);
    expect(arten.data).toHaveLength(1);
    const frueher = await anon.from("event_previous_slugs").select("event_id").eq("slug", fruehere);
    expect(frueher.data).toEqual([{ event_id: id }]);
  });

  it("lässt Kunden keine Eventart anlegen", async () => {
    const c = await alsKunde();
    const { error } = await c.from("event_types").insert({ name: UNERLAUBTE_ART });
    expect(error).not.toBeNull();
  });
});
