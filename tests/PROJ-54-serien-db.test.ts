import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { angemeldetAls } from "./anmeldung";
import { AGB_VERSION } from "@/lib/legal";

/**
 * PROJ-54: Regeln, die die Datenbank selbst durchsetzt.
 *
 * Dieselbe Überlegung wie bei PROJ-53: Die Oberfläche kennt die Regeln auch,
 * aber ein direkter Aufruf an ihr vorbei darf sie nicht umgehen. Hier geht es
 * um die Serientabelle, die Zuordnung der Termine, die aufgehobene Stornofrist
 * nach einer Verlegung und den Check-in gegen den ausgewählten Termin.
 *
 * Braucht die Migration 20260915100000_proj54_event_serien.sql in der
 * Testdatenbank.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const KUNDE_MAIL = "proj54-serien-kunde@viennasalsastudio.test";
const LEHRER_MAIL = "proj54-serien-lehrer@viennasalsastudio.test";
const PASSWORT = "CorrectPassword123!";
const ART_NAME = "E2E PROJ-54 Art";
const UNERLAUBTE_SERIE = "E2E PROJ-54 unerlaubt";
const STUNDE = 60 * 60 * 1000;

let service: SupabaseClient;
let kunde: string;
let lehrer: string;
let artId: string;
const eventIds: string[] = [];
const serienIds: string[] = [];

function zeitpunkt(versatzStunden: number): string {
  return new Date(Date.now() + versatzStunden * STUNDE).toISOString();
}

function tag(versatzTage: number): string {
  return new Date(Date.now() + versatzTage * 24 * STUNDE).toISOString().slice(0, 10);
}

/** Legt eine Test-Serie an; ohne Angaben eine laufende mit Tickets. Wirft den Datenbankfehler weiter. */
async function serieAnlegen(felder: Record<string, unknown> = {}): Promise<string> {
  const nummer = serienIds.length + 1;
  const { data, error } = await service
    .from("event_series")
    .insert({
      name: `E2E PROJ-54 Serie ${nummer}`,
      slug: `e2e-proj54-serie-${nummer}-${Date.now()}`,
      event_type_id: artId,
      sales_mode: "tickets",
      weekday: 4,
      start_time: "21:00",
      end_time: "02:00",
      starts_on: tag(-7),
      capacity: 50,
      price_normal: 12,
      price_student: 9,
      ...felder,
    })
    .select("id")
    .single();
  if (error) throw error;
  serienIds.push(data.id);
  return data.id;
}

/** Legt ein Test-Event an; ohne Angaben ein einzelnes mit Tickets, morgen. */
async function eventAnlegen(felder: Record<string, unknown> = {}): Promise<string> {
  const nummer = eventIds.length + 1;
  const { data, error } = await service
    .from("events")
    .insert({
      name: `E2E PROJ-54 Termin ${nummer}`,
      slug: `e2e-proj54-termin-${nummer}-${Date.now()}`,
      event_type_id: artId,
      sales_mode: "tickets",
      capacity: 50,
      price_normal: 12,
      price_student: 9,
      starts_at: zeitpunkt(24),
      ...felder,
    })
    .select("id")
    .single();
  if (error) throw error;
  eventIds.push(data.id);
  return data.id;
}

async function angemeldet(mail: string): Promise<SupabaseClient> {
  return angemeldetAls(URL, ANON, mail, PASSWORT);
}

/** Kauft ein Ticket als Kunde und gibt dessen Kennung zurück. */
async function ticketKaufen(eventId: string): Promise<string> {
  const c = await angemeldet(KUNDE_MAIL);
  const { data, error } = await c.rpc("purchase_event_ticket", {
    p_event_id: eventId,
    p_payment_method: "onsite",
    p_wants_student_price: false,
    p_terms_accepted: true,
    p_terms_version: AGB_VERSION,
  });
  if (error) throw error;
  return data.id;
}

async function nutzerAnlegen(mail: string, rolle?: string): Promise<string> {
  const { data: vorhanden } = await service.auth.admin.listUsers({ perPage: 300 });
  const alt = vorhanden.users.find((u) => u.email === mail);
  if (alt) await service.auth.admin.deleteUser(alt.id);

  const { data, error } = await service.auth.admin.createUser({
    email: mail,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error) throw error;

  if (rolle) {
    // Der Trigger gegen Rollenerhöhung lässt den Service-Zugang durch, weil
    // dort keine Kennung am Aufruf hängt.
    const { error: rollenFehler } = await service.from("profiles").update({ role: rolle }).eq("id", data.user.id);
    if (rollenFehler) throw rollenFehler;
  }
  return data.user.id;
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });

  kunde = await nutzerAnlegen(KUNDE_MAIL);
  lehrer = await nutzerAnlegen(LEHRER_MAIL, "teacher");

  // Reste eines abgebrochenen Laufs: Termine und Serien zuerst, sonst sperrt
  // die Art das Löschen.
  const { data: alteArt } = await service.from("event_types").select("id").eq("name", ART_NAME).maybeSingle();
  if (alteArt) {
    await service.from("events").delete().eq("event_type_id", alteArt.id);
    await service.from("event_series").delete().eq("event_type_id", alteArt.id);
    await service.from("event_types").delete().eq("id", alteArt.id);
  }

  const { data: art, error: artFehler } = await service
    .from("event_types")
    .insert({ name: ART_NAME })
    .select("id")
    .single();
  if (artFehler) throw artFehler;
  artId = art.id;
}, 60000);

afterAll(async () => {
  // Tickets hängen mit „on delete cascade" an den Events; die Termine einer
  // Serie überleben deren Löschung, deshalb beide ausdrücklich.
  await service.from("events").delete().eq("event_type_id", artId);
  await service.from("event_series").delete().eq("event_type_id", artId);
  if (artId) await service.from("event_types").delete().eq("id", artId);
  for (const id of [kunde, lehrer]) if (id) await service.auth.admin.deleteUser(id);
});

describe("Regeln der Tabelle event_series (PROJ-54)", () => {
  it("verlangt bei Tickets in der App Kapazität und Preise", async () => {
    await expect(serieAnlegen({ capacity: null })).rejects.toMatchObject({ code: "23514" });
    await expect(serieAnlegen({ price_student: null })).rejects.toMatchObject({ code: "23514" });
  });

  it("erlaubt bei „Nur anzeigen“ leere Kapazität und Preise", async () => {
    await expect(
      serieAnlegen({ sales_mode: "display", capacity: null, price_normal: null, price_student: null })
    ).resolves.toBeTruthy();
  });

  it("lässt das Ende einer Serie nicht vor ihrem Beginn liegen", async () => {
    await expect(serieAnlegen({ starts_on: tag(14), ends_on: tag(7) })).rejects.toMatchObject({ code: "23514" });
  });

  it("nimmt nur Wochentage von Montag bis Sonntag an", async () => {
    await expect(serieAnlegen({ weekday: 7 })).rejects.toMatchObject({ code: "23514" });
  });

  it("nimmt nur lesbare Adressen an", async () => {
    await expect(serieAnlegen({ slug: "Freitags Party" })).rejects.toMatchObject({ code: "23514" });
  });

  it("sperrt das Löschen einer Eventart, der noch Serien zugeordnet sind", async () => {
    await serieAnlegen();
    const { error } = await service.from("event_types").delete().eq("id", artId);
    expect(error?.code).toBe("23503");
  });
});

describe("Serientermine an der Tabelle events (PROJ-54)", () => {
  it("lässt je Serie und Kalendertag nur einen Termin zu", async () => {
    const serieId = await serieAnlegen();
    const datum = tag(3);
    await eventAnlegen({ series_id: serieId, occurrence_date: datum });
    await expect(eventAnlegen({ series_id: serieId, occurrence_date: datum })).rejects.toMatchObject({
      code: "23505",
    });
  });

  it("erlaubt denselben Kalendertag in zwei verschiedenen Serien", async () => {
    const datum = tag(4);
    const eine = await serieAnlegen();
    const andere = await serieAnlegen();
    await expect(eventAnlegen({ series_id: eine, occurrence_date: datum })).resolves.toBeTruthy();
    await expect(eventAnlegen({ series_id: andere, occurrence_date: datum })).resolves.toBeTruthy();
  });

  it("lässt einen Serientermin ohne Kalendertag nicht zu", async () => {
    const serieId = await serieAnlegen();
    await expect(eventAnlegen({ series_id: serieId })).rejects.toMatchObject({ code: "23514" });
  });

  it("lässt den Abend samt Ticket stehen, wenn die Serie gelöscht wird", async () => {
    const serieId = await serieAnlegen();
    const eventId = await eventAnlegen({ series_id: serieId, occurrence_date: tag(5) });
    const ticketId = await ticketKaufen(eventId);

    const { error } = await service.from("event_series").delete().eq("id", serieId);
    expect(error).toBeNull();

    const { data: termin } = await service.from("events").select("id, series_id").eq("id", eventId).maybeSingle();
    expect(termin).toMatchObject({ id: eventId, series_id: null });
    const { data: ticket } = await service.from("tickets").select("status").eq("id", ticketId).maybeSingle();
    expect(ticket?.status).toBe("reserved");
  });
});

describe("Zugriff auf Serien (PROJ-54)", () => {
  it("lässt Besucher ohne Konto die Serien lesen", async () => {
    const serieId = await serieAnlegen();
    // Fehlte die Leseregel, käme hier stumm eine leere Liste zurück —
    // deshalb wird eine Zeile erwartet, nicht nur „kein Fehler".
    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data } = await anon.from("event_series").select("id").eq("id", serieId);
    expect(data).toEqual([{ id: serieId }]);
  });

  it("lässt Kunden keine Serie anlegen", async () => {
    const c = await angemeldet(KUNDE_MAIL);
    const { error } = await c.from("event_series").insert({
      name: UNERLAUBTE_SERIE,
      slug: `e2e-proj54-unerlaubt-${Date.now()}`,
      event_type_id: artId,
      weekday: 4,
      start_time: "21:00",
      starts_on: tag(1),
      capacity: 10,
      price_normal: 10,
      price_student: 8,
    });
    expect(error).not.toBeNull();
  });
});

/**
 * Ein Zeitpunkt, der sicher **heute** liegt (Wiener Kalendertag).
 *
 * „In einer Stunde" reicht dafür nicht: Kurz vor Mitternacht landet das im
 * nächsten Tag, und eine Prüfung mit dem Namen „am Veranstaltungstag" misst
 * dann das Gegenteil dessen, was sie soll. Am 2026-09-16 um 23:20 ist genau
 * das passiert.
 */
function heuteSpaet(): string {
  const heute = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Vienna" });
  return new Date(`${heute}T23:59:00+02:00`).toISOString();
}

describe("cancel_event_ticket nach einer Verlegung (PROJ-54)", () => {
  async function stornieren(ticketId: string) {
    const c = await angemeldet(KUNDE_MAIL);
    return c.rpc("cancel_event_ticket", { p_ticket_id: ticketId });
  }

  it("sperrt das Stornieren am Veranstaltungstag", async () => {
    const eventId = await eventAnlegen({ starts_at: heuteSpaet(), ends_at: heuteSpaet() });
    const ticketId = await ticketKaufen(eventId);
    const { error } = await stornieren(ticketId);
    expect(error?.message).toContain("cancellation deadline passed");
  });

  it("lässt nach einer Verlegung ohne Frist stornieren", async () => {
    const eventId = await eventAnlegen({ starts_at: heuteSpaet(), ends_at: heuteSpaet() });
    const ticketId = await ticketKaufen(eventId);
    await service.from("events").update({ moved_at: new Date().toISOString() }).eq("id", eventId);

    const { data, error } = await stornieren(ticketId);
    expect(error).toBeNull();
    expect(data).toMatchObject({ id: ticketId, status: "cancelled" });
  });

  it("storniert auch nach einer Verlegung nicht, wenn der Abend begonnen hat", async () => {
    const eventId = await eventAnlegen({ starts_at: zeitpunkt(-1), ends_at: zeitpunkt(2) });
    const ticketId = await ticketKaufen(eventId);
    await service.from("events").update({ moved_at: new Date().toISOString() }).eq("id", eventId);

    const { error } = await stornieren(ticketId);
    expect(error?.message).toContain("cancellation deadline passed");
  });
});

describe("checkin_event_ticket gegen den ausgewählten Termin (PROJ-54)", () => {
  async function einchecken(mail: string, ticketId: string, eventId: string) {
    const c = await angemeldet(mail);
    return c.rpc("checkin_event_ticket", { p_ticket_id: ticketId, p_event_id: eventId });
  }

  it("checkt ein Ticket am zugehörigen Termin ein", async () => {
    const eventId = await eventAnlegen();
    const ticketId = await ticketKaufen(eventId);
    const { data, error } = await einchecken(LEHRER_MAIL, ticketId, eventId);
    expect(error).toBeNull();
    expect(data).toMatchObject({ id: ticketId, status: "checked_in" });
  });

  it("weist ein Ticket ab, das zu einem anderen Termin gehört", async () => {
    // Genau der Fall aus einer Serie: Zwei Abende, gleicher Name, das Ticket
    // der Vorwoche am heutigen Termin.
    const serieId = await serieAnlegen();
    const vorwoche = await eventAnlegen({ series_id: serieId, occurrence_date: tag(6) });
    const heute = await eventAnlegen({ series_id: serieId, occurrence_date: tag(7) });
    // Gekauft, solange der Abend offen war — danach rückt er in die Vorwoche.
    const ticketId = await ticketKaufen(vorwoche);
    await service.from("events").update({ starts_at: zeitpunkt(-24 * 6) }).eq("id", vorwoche);

    const { error } = await einchecken(LEHRER_MAIL, ticketId, heute);
    expect(error?.message).toContain("ticket for other event");

    // Und das Ticket bleibt unangetastet.
    const { data: ticket } = await service.from("tickets").select("status").eq("id", ticketId).maybeSingle();
    expect(ticket?.status).toBe("reserved");
  });

  it("lässt einen Kunden nicht einchecken, auch nicht sein eigenes Ticket", async () => {
    const eventId = await eventAnlegen();
    const ticketId = await ticketKaufen(eventId);
    const { error } = await einchecken(KUNDE_MAIL, ticketId, eventId);
    expect(error?.message).toContain("not authorized");
  });
});
