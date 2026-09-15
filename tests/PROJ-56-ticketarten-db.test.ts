import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { angemeldetAls } from "./anmeldung";
import { AGB_VERSION } from "@/lib/legal";

/**
 * PROJ-56: Regeln, die die Datenbank selbst durchsetzt.
 *
 * Der Ticketkauf ist der Ort, an dem es zählt: Kontingent, Kapazität je
 * Einheit, Zahlungsart, Tanzrolle und die eingefrorene Stornofrist entscheiden
 * hier — nicht an der Oberfläche, die man umgehen kann.
 *
 * Braucht die Migration 20260915220000_proj56_ticketarten_einheiten.sql.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const KUNDE = "proj56-kunde@viennasalsastudio.test";
const ZWEITER = "proj56-zweiter@viennasalsastudio.test";
const LEHRER = "proj56-lehrer@viennasalsastudio.test";
const PASSWORT = "CorrectPassword123!";
const ART_NAME = "E2E PROJ-56 Art";

let service: SupabaseClient;
let artId: string;
const nutzer: Record<string, string> = {};

const STUNDE = 60 * 60 * 1000;
const inStunden = (h: number) => new Date(Date.now() + h * STUNDE).toISOString();

async function eventAnlegen(felder: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await service
    .from("events")
    .insert({
      name: "E2E PROJ-56 Event",
      slug: `e2e-proj56-${crypto.randomUUID().slice(0, 8)}`,
      event_type_id: artId,
      sales_mode: "tickets",
      capacity: 100,
      price_normal: 20,
      price_student: 15,
      starts_at: inStunden(72),
      ends_at: inStunden(80),
      ...felder,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function einheitAnlegen(eventId: string, felder: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await service
    .from("event_units")
    .insert({ event_id: eventId, title: "Einheit", starts_at: inStunden(73), ...felder })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function ticketartAnlegen(eventId: string, felder: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await service
    .from("event_ticket_types")
    .insert({ event_id: eventId, name: "Full Pass", price_normal: 60, price_student: 50, ...felder })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function kaufen(
  mail: string,
  eventId: string,
  felder: Record<string, unknown> = {}
): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> {
  const c = await angemeldetAls(URL, ANON, mail, PASSWORT);
  return c.rpc("purchase_event_ticket", {
    p_event_id: eventId,
    p_payment_method: "onsite",
    p_wants_student_price: false,
    p_terms_accepted: true,
    p_terms_version: AGB_VERSION,
    ...felder,
  });
}

async function nutzerAnlegen(mail: string, rolle?: string): Promise<string> {
  const { data: vorhanden } = await service.auth.admin.listUsers({ perPage: 300 });
  const alt = vorhanden.users.find((u) => u.email === mail);
  if (alt) await service.auth.admin.deleteUser(alt.id);

  const { data, error } = await service.auth.admin.createUser({ email: mail, password: PASSWORT, email_confirm: true });
  if (error) throw error;
  if (rolle) {
    const { error: rollenFehler } = await service.from("profiles").update({ role: rolle }).eq("id", data.user.id);
    if (rollenFehler) throw rollenFehler;
  }
  return data.user.id;
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });

  for (const [mail, rolle] of [[KUNDE, undefined], [ZWEITER, undefined], [LEHRER, "teacher"]] as const) {
    nutzer[mail] = await nutzerAnlegen(mail, rolle);
  }

  const { data: alteArt } = await service.from("event_types").select("id").eq("name", ART_NAME).maybeSingle();
  if (alteArt) {
    await service.from("events").delete().eq("event_type_id", alteArt.id);
    await service.from("event_types").delete().eq("id", alteArt.id);
  }
  const { data: art, error } = await service.from("event_types").insert({ name: ART_NAME }).select("id").single();
  if (error) throw error;
  artId = art.id;
}, 60000);

afterAll(async () => {
  await service.from("events").delete().eq("event_type_id", artId);
  if (artId) await service.from("event_types").delete().eq("id", artId);
  for (const id of Object.values(nutzer)) if (id) await service.auth.admin.deleteUser(id);
});

describe("Regeln der neuen Tabellen (PROJ-56)", () => {
  it("lässt eine Einheit nicht vor ihrem Beginn enden", async () => {
    const eventId = await eventAnlegen();
    await expect(
      einheitAnlegen(eventId, { starts_at: inStunden(75), ends_at: inStunden(74) })
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("nimmt nur die drei Geltungsbereiche an", async () => {
    const eventId = await eventAnlegen();
    await expect(ticketartAnlegen(eventId, { scope: "irgendwas" })).rejects.toMatchObject({ code: "23514" });
    for (const scope of ["all", "selected", "choice"]) {
      await expect(ticketartAnlegen(eventId, { scope })).resolves.toBeTruthy();
    }
  });

  it("verlangt beim Einlass entweder ein Ticket oder einen Gast, nie beides", async () => {
    const { error } = await service.from("event_checkins").insert({ ticket_id: null, guest_id: null });
    expect(error?.code).toBe("23514");
  });
});

describe("purchase_event_ticket mit Ticketarten (PROJ-56)", () => {
  it("kauft mit der gewählten Ticketart und friert die Stornofrist ein", async () => {
    const eventId = await eventAnlegen({ cancellation_lead_days: 7 });
    const artId2 = await ticketartAnlegen(eventId);

    const { data, error } = await kaufen(KUNDE, eventId, { p_ticket_type_id: artId2 });
    expect(error).toBeNull();
    expect(data).toMatchObject({ ticket_type_id: artId2, price: 60, cancellation_lead_days: 7 });
  });

  it("weist eine Ticketart ab, die nicht im Verkauf ist", async () => {
    const eventId = await eventAnlegen();
    const stillgelegt = await ticketartAnlegen(eventId, { on_sale: false });
    const { error } = await kaufen(KUNDE, eventId, { p_ticket_type_id: stillgelegt });
    expect(error?.message).toContain("ticket type unavailable");
  });

  it("verlangt eine Wahl, wenn mehrere Arten im Verkauf sind", async () => {
    const eventId = await eventAnlegen();
    await ticketartAnlegen(eventId, { name: "Full Pass" });
    await ticketartAnlegen(eventId, { name: "Einzelticket" });
    const { error } = await kaufen(KUNDE, eventId);
    expect(error?.message).toContain("ticket type unavailable");
  });

  it("verlangt bei „Kunde wählt“ eine Einheit — und weist eine fremde ab", async () => {
    const eventId = await eventAnlegen();
    const einheit = await einheitAnlegen(eventId);
    const wahl = await ticketartAnlegen(eventId, { scope: "choice" });

    const ohne = await kaufen(KUNDE, eventId, { p_ticket_type_id: wahl });
    expect(ohne.error?.message).toContain("unit required");

    const fremdesEvent = await eventAnlegen();
    const fremdeEinheit = await einheitAnlegen(fremdesEvent);
    const falsch = await kaufen(KUNDE, eventId, { p_ticket_type_id: wahl, p_unit_id: fremdeEinheit });
    expect(falsch.error?.message).toContain("unit not valid");

    const richtig = await kaufen(KUNDE, eventId, { p_ticket_type_id: wahl, p_unit_id: einheit });
    expect(richtig.error).toBeNull();
  });

  it("weist eine Einheit ab, wo es nichts zu wählen gibt", async () => {
    // Sonst stünde am Ticket eine Angabe, die nichts bedeutet.
    const eventId = await eventAnlegen();
    const einheit = await einheitAnlegen(eventId);
    const alle = await ticketartAnlegen(eventId, { scope: "all" });
    const { error } = await kaufen(KUNDE, eventId, { p_ticket_type_id: alle, p_unit_id: einheit });
    expect(error?.message).toContain("unit not valid");
  });

  it("hält das Kontingent einer Ticketart ein", async () => {
    const eventId = await eventAnlegen();
    const knapp = await ticketartAnlegen(eventId, { quota: 1 });

    const erster = await kaufen(KUNDE, eventId, { p_ticket_type_id: knapp });
    expect(erster.error).toBeNull();
    const zweiter = await kaufen(ZWEITER, eventId, { p_ticket_type_id: knapp });
    expect(zweiter.error?.message).toContain("event is full");
  });

  it("sperrt einen Pass, sobald eine einzige seiner Einheiten voll ist", async () => {
    // Ein Full Pass, dessen zweite Einheit voll ist, ist kein halber Full Pass.
    const eventId = await eventAnlegen();
    const eins = await einheitAnlegen(eventId, { title: "Eins", capacity: 5 });
    const zwei = await einheitAnlegen(eventId, { title: "Zwei", capacity: 1, starts_at: inStunden(76) });
    const pass = await ticketartAnlegen(eventId, { name: "Full Pass", scope: "all" });
    const einzeln = await ticketartAnlegen(eventId, { name: "Einzeln", scope: "choice" });

    // Der Einzelplatz in „Zwei" ist damit weg.
    const einzelkauf = await kaufen(ZWEITER, eventId, { p_ticket_type_id: einzeln, p_unit_id: zwei });
    expect(einzelkauf.error).toBeNull();

    const passkauf = await kaufen(KUNDE, eventId, { p_ticket_type_id: pass });
    expect(passkauf.error?.message).toContain("event is full");

    // Und die Belegung zählt den Einzelplatz nur in seiner Einheit.
    const { data: belegung } = await service.rpc("get_event_unit_occupancy", { p_event_id: eventId });
    const nach = new Map((belegung ?? []).map((z: { unit_id: string; ticket_count: number }) => [z.unit_id, z.ticket_count]));
    expect(nach.get(eins)).toBe(0);
    expect(nach.get(zwei)).toBe(1);
  });

  it("bietet nur die Zahlungsarten an, die das Event erlaubt", async () => {
    const nurSepa = await eventAnlegen({ payment_methods: "sepa" });
    await ticketartAnlegen(nurSepa);
    const bar = await kaufen(KUNDE, nurSepa, { p_payment_method: "onsite" });
    expect(bar.error?.message).toContain("payment method not allowed");

    const nurBar = await eventAnlegen({ payment_methods: "onsite" });
    await ticketartAnlegen(nurBar);
    const sepa = await kaufen(KUNDE, nurBar, { p_payment_method: "sepa" });
    expect(sepa.error?.message).toContain("payment method not allowed");
  });

  it("bestätigt eine kostenlose Ticketart sofort, ohne Mandat", async () => {
    const eventId = await eventAnlegen();
    const gratis = await ticketartAnlegen(eventId, { name: "Gast", price_normal: 0, price_student: 0 });
    const { data, error } = await kaufen(KUNDE, eventId, { p_ticket_type_id: gratis });
    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "confirmed", price: 0, payment_method: "onsite" });
  });

  it("hält die Runde zwischen Leadern und Followern beisammen", async () => {
    const eventId = await eventAnlegen({ role_query_enabled: true, max_role_difference: 1 });
    const alle = await ticketartAnlegen(eventId, { scope: "all" });

    const ersterLeader = await kaufen(KUNDE, eventId, { p_ticket_type_id: alle, p_dance_role: "leader" });
    expect(ersterLeader.error).toBeNull();

    const zweiterLeader = await kaufen(ZWEITER, eventId, { p_ticket_type_id: alle, p_dance_role: "leader" });
    expect(zweiterLeader.error?.message).toContain("role imbalance");

    // Die andere Rolle bringt die Runde näher zusammen und geht.
    const follower = await kaufen(ZWEITER, eventId, { p_ticket_type_id: alle, p_dance_role: "follower" });
    expect(follower.error).toBeNull();
  });
});

describe("cancel_event_ticket mit eingefrorener Frist (PROJ-56)", () => {
  it("hält sich an die Frist, die beim Kauf galt — nicht an die von heute", async () => {
    const eventId = await eventAnlegen({ cancellation_lead_days: 7 });
    await ticketartAnlegen(eventId);
    const { data: ticket } = await kaufen(KUNDE, eventId);

    // Das Event beginnt in drei Tagen, die Frist verlangt sieben.
    await service.from("events").update({ starts_at: inStunden(72) }).eq("id", eventId);

    const c = await angemeldetAls(URL, ANON, KUNDE, PASSWORT);
    const { error } = await c.rpc("cancel_event_ticket", { p_ticket_id: (ticket as { id: string }).id });
    expect(error?.message).toContain("cancellation deadline passed");

    // Und eine spätere Änderung am Event ändert daran nichts.
    await service.from("events").update({ cancellation_lead_days: 0 }).eq("id", eventId);
    const nochmal = await c.rpc("cancel_event_ticket", { p_ticket_id: (ticket as { id: string }).id });
    expect(nochmal.error?.message).toContain("cancellation deadline passed");
  });

  it("lässt bei 0 Tagen bis zum Beginn stornieren", async () => {
    const eventId = await eventAnlegen({ cancellation_lead_days: 0, starts_at: inStunden(2), ends_at: inStunden(6) });
    await ticketartAnlegen(eventId);
    const { data: ticket } = await kaufen(KUNDE, eventId);

    const c = await angemeldetAls(URL, ANON, KUNDE, PASSWORT);
    const { data, error } = await c.rpc("cancel_event_ticket", { p_ticket_id: (ticket as { id: string }).id });
    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "cancelled" });
  });
});

describe("Check-in je Einheit (PROJ-56)", () => {
  it("checkt je Einheit einzeln ein und weist den zweiten Scan derselben ab", async () => {
    const eventId = await eventAnlegen();
    const eins = await einheitAnlegen(eventId, { title: "Eins" });
    const zwei = await einheitAnlegen(eventId, { title: "Zwei", starts_at: inStunden(76) });
    const pass = await ticketartAnlegen(eventId, { scope: "all" });
    const { data: ticket } = await kaufen(KUNDE, eventId, { p_ticket_type_id: pass });
    const ticketId = (ticket as { id: string }).id;

    const c = await angemeldetAls(URL, ANON, LEHRER, PASSWORT);
    const ersterEinlass = await c.rpc("checkin_event_ticket", {
      p_ticket_id: ticketId,
      p_event_id: eventId,
      p_unit_id: eins,
    });
    expect(ersterEinlass.error).toBeNull();
    expect(ersterEinlass.data).toMatchObject({ status: "checked_in" });

    const nochmal = await c.rpc("checkin_event_ticket", {
      p_ticket_id: ticketId,
      p_event_id: eventId,
      p_unit_id: eins,
    });
    expect(nochmal.error?.message).toContain("already checked in");

    // Die zweite Einheit steht dem Pass weiterhin offen.
    const zweiterEinlass = await c.rpc("checkin_event_ticket", {
      p_ticket_id: ticketId,
      p_event_id: eventId,
      p_unit_id: zwei,
    });
    expect(zweiterEinlass.error).toBeNull();
  });

  it("weist ein Einzelticket an einer fremden Einheit ab", async () => {
    const eventId = await eventAnlegen();
    const eins = await einheitAnlegen(eventId, { title: "Eins" });
    const zwei = await einheitAnlegen(eventId, { title: "Zwei", starts_at: inStunden(76) });
    const einzeln = await ticketartAnlegen(eventId, { scope: "choice" });
    const { data: ticket } = await kaufen(KUNDE, eventId, { p_ticket_type_id: einzeln, p_unit_id: eins });

    const c = await angemeldetAls(URL, ANON, LEHRER, PASSWORT);
    const { error } = await c.rpc("checkin_event_ticket", {
      p_ticket_id: (ticket as { id: string }).id,
      p_event_id: eventId,
      p_unit_id: zwei,
    });
    expect(error?.message).toContain("ticket not for unit");
  });

  it("checkt einen Gast von Hand ein und weist den zweiten Scan ab", async () => {
    const eventId = await eventAnlegen();
    const einheit = await einheitAnlegen(eventId);
    const { data: gast } = await service
      .from("event_guests")
      .insert({ event_id: eventId, name: "E2E56 Lehrerin" })
      .select("id")
      .single();

    const c = await angemeldetAls(URL, ANON, LEHRER, PASSWORT);
    const erster = await c.rpc("checkin_event_guest", {
      p_guest_id: gast!.id,
      p_event_id: eventId,
      p_unit_id: einheit,
    });
    expect(erster.error).toBeNull();
    expect(erster.data).toMatchObject({ name: "E2E56 Lehrerin" });

    const nochmal = await c.rpc("checkin_event_guest", {
      p_guest_id: gast!.id,
      p_event_id: eventId,
      p_unit_id: einheit,
    });
    expect(nochmal.error?.message).toContain("already checked in");
  });

  it("weist einen Gast an einer Einheit ab, für die er nicht eingetragen ist", async () => {
    const eventId = await eventAnlegen();
    const eins = await einheitAnlegen(eventId, { title: "Eins" });
    const zwei = await einheitAnlegen(eventId, { title: "Zwei", starts_at: inStunden(76) });
    const { data: gast } = await service
      .from("event_guests")
      .insert({ event_id: eventId, name: "E2E56 Nur Eins" })
      .select("id")
      .single();
    await service.from("event_guest_units").insert({ guest_id: gast!.id, unit_id: eins });

    const c = await angemeldetAls(URL, ANON, LEHRER, PASSWORT);
    const { error } = await c.rpc("checkin_event_guest", {
      p_guest_id: gast!.id,
      p_event_id: eventId,
      p_unit_id: zwei,
    });
    expect(error?.message).toContain("guest not for unit");
  });

  it("lässt einen Kunden weder Ticket noch Gast einchecken", async () => {
    const eventId = await eventAnlegen();
    await ticketartAnlegen(eventId);
    const { data: ticket } = await kaufen(KUNDE, eventId);

    const c = await angemeldetAls(URL, ANON, KUNDE, PASSWORT);
    const { error } = await c.rpc("checkin_event_ticket", {
      p_ticket_id: (ticket as { id: string }).id,
      p_event_id: eventId,
    });
    expect(error?.message).toContain("not authorized");
  });
});

describe("Zugriff (PROJ-56)", () => {
  it("lässt Besucher ohne Konto Programm und Ticketarten lesen", async () => {
    const eventId = await eventAnlegen();
    const einheit = await einheitAnlegen(eventId);
    const art = await ticketartAnlegen(eventId);

    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    const einheiten = await anon.from("event_units").select("id").eq("id", einheit);
    const arten = await anon.from("event_ticket_types").select("id").eq("id", art);
    expect(einheiten.data).toEqual([{ id: einheit }]);
    expect(arten.data).toEqual([{ id: art }]);
  });

  it("verbirgt Gästenamen und Einlass vor Kunden", async () => {
    const eventId = await eventAnlegen();
    const { data: gast } = await service
      .from("event_guests")
      .insert({ event_id: eventId, name: "E2E56 Geheim" })
      .select("id")
      .single();

    const c = await angemeldetAls(URL, ANON, KUNDE, PASSWORT);
    const gaeste = await c.from("event_guests").select("id").eq("id", gast!.id);
    const einlass = await c.from("event_checkins").select("id");
    expect(gaeste.data).toEqual([]);
    expect(einlass.data).toEqual([]);
  });

  it("lässt Kunden weder Einheiten noch Ticketarten anlegen", async () => {
    const eventId = await eventAnlegen();
    const c = await angemeldetAls(URL, ANON, KUNDE, PASSWORT);
    const einheit = await c.from("event_units").insert({ event_id: eventId, title: "Verboten", starts_at: inStunden(73) });
    const art = await c
      .from("event_ticket_types")
      .insert({ event_id: eventId, name: "Verboten", price_normal: 1, price_student: 1 });
    expect(einheit.error).not.toBeNull();
    expect(art.error).not.toBeNull();
  });
});
