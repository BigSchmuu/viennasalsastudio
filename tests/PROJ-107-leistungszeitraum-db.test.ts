import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { angemeldetAls } from "./anmeldung";

/**
 * PROJ-107 Stufe 2: Die Rechnung nennt den Leistungszeitraum.
 *
 * Bis hierher stand in der Position nur der Name des Abos. Bei einem
 * Mitgliedsbeitrag ist aber der Zeitraum die Angabe, auf die es ankommt — er
 * beantwortet „wofür war das?" und ist bei einer Rückfrage das Dokument, das
 * man vorlegt.
 *
 * Drei Fälle, und die beiden letzten sind die wichtigeren: Wo der Zeitraum
 * **nicht** hingehört, darf er auch nicht stehen. Eine erfundene Angabe auf
 * einer Rechnung ist schlimmer als gar keine.
 *
 * Aufgerufen als **Verwaltung**, nicht mit dem Dienstschlüssel: Die Funktion
 * prüft `current_role() = 'admin'` selbst.
 *
 * Braucht die Migration 20261118100000_proj107_leistungszeitraum.sql.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORT = "CorrectPassword123!";
const ADMIN = "e2e8-admin@viennasalsastudio.test";

const marke = Date.now();
const KUNDE = `proj107z-${marke}@viennasalsastudio.test`;

/** Weit hinter allen anderen Lastschrift-Suiten. */
const ZYKLUS_VON = "2035-02-05";
const ZYKLUS_BIS = "2035-03-04";
const OHNE_ZYKLUS = "2035-04-10";
const ERWARTET = "05.02.2035 – 04.03.2035";

let service: SupabaseClient;
let alsAdmin: SupabaseClient;

let kundeId = "";
let aboId = "";
let zyklusId = "";
let laufMitZyklus = "";
let laufOhneZyklus = "";
let artId = "";
let eventId = "";
let ticketId = "";
const positionen: string[] = [];

async function legePositionAn(runId: string, felder: Record<string, unknown>): Promise<string> {
  const { data, error } = await service
    .from("sepa_collection_items")
    .insert({
      run_id: runId,
      customer_id: kundeId,
      amount: 55,
      iban: "AT611904300234573201",
      account_holder_name: `E2E107Z ${marke}`,
      mandate_reference: `E2E107Z-${marke}`.slice(0, 35),
      ...felder,
    })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-107 Position: ${error.message}`);
  positionen.push(data!.id);
  return data!.id;
}

async function beschreibungZu(positionId: string): Promise<string> {
  const { data, error } = await service
    .from("invoices")
    .select("description")
    .eq("collection_item_id", positionId)
    .single();
  if (error) throw new Error(`PROJ-107 Rechnung: ${error.message}`);
  return data!.description;
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });

  const { data: konto, error: kontoFehler } = await service.auth.admin.createUser({
    email: KUNDE,
    password: PASSWORT,
    email_confirm: true,
  });
  if (kontoFehler || !konto.user) throw new Error(`PROJ-107 Konto: ${kontoFehler?.message}`);
  kundeId = konto.user.id;

  const { data: abo, error: aboFehler } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: null,
      status: "active",
      name: "E2E107Z Flatrate",
      price: 55,
      cycle_anchor_date: "2035-01-08",
    })
    .select("id")
    .single();
  if (aboFehler) throw new Error(`PROJ-107 Abo: ${aboFehler.message}`);
  aboId = abo!.id;

  const { data: zyklus, error: zyklusFehler } = await service
    .from("billing_cycles")
    .insert({ starts_on: ZYKLUS_VON, ends_on: ZYKLUS_BIS })
    .select("id")
    .single();
  if (zyklusFehler) throw new Error(`PROJ-107 Zyklus: ${zyklusFehler.message}`);
  zyklusId = zyklus!.id;

  const { data: mit, error: mitFehler } = await service
    .from("sepa_collection_runs")
    .insert({ due_date: ZYKLUS_VON, cycle_id: zyklusId })
    .select("id")
    .single();
  if (mitFehler) throw new Error(`PROJ-107 Lauf mit Zyklus: ${mitFehler.message}`);
  laufMitZyklus = mit!.id;

  const { data: ohne, error: ohneFehler } = await service
    .from("sepa_collection_runs")
    .insert({ due_date: OHNE_ZYKLUS, cycle_id: null })
    .select("id")
    .single();
  if (ohneFehler) throw new Error(`PROJ-107 Lauf ohne Zyklus: ${ohneFehler.message}`);
  laufOhneZyklus = ohne!.id;

  // Ein Ticket, damit die Gegenprobe echt ist: Es hängt an einer
  // Veranstaltung, nicht an einem Zeitraum.
  const { data: art, error: artFehler } = await service
    .from("event_types")
    .insert({ name: `E2E107Z Art ${marke}` })
    .select("id")
    .single();
  if (artFehler) throw new Error(`PROJ-107 Eventart: ${artFehler.message}`);
  artId = art!.id;

  const { data: event, error: eventFehler } = await service
    .from("events")
    .insert({
      name: "E2E107Z Abend",
      slug: `e2e107z-${marke}`,
      event_type_id: artId,
      sales_mode: "tickets",
      starts_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      capacity: 20,
      price_normal: 18,
      price_student: 15,
      status: "geplant",
    })
    .select("id")
    .single();
  if (eventFehler) throw new Error(`PROJ-107 Event: ${eventFehler.message}`);
  eventId = event!.id;

  const { data: ticket, error: ticketFehler } = await service
    .from("tickets")
    .insert({
      event_id: eventId,
      customer_id: kundeId,
      payment_method: "sepa",
      price: 18,
      status: "confirmed",
    })
    .select("id")
    .single();
  if (ticketFehler) throw new Error(`PROJ-107 Ticket: ${ticketFehler.message}`);
  ticketId = ticket!.id;

  alsAdmin = await angemeldetAls(URL, ANON, ADMIN, PASSWORT);
});

afterAll(async () => {
  for (const id of positionen) await service.from("invoices").delete().eq("collection_item_id", id);
  for (const id of positionen) await service.from("sepa_collection_items").delete().eq("id", id);
  for (const id of [laufMitZyklus, laufOhneZyklus]) {
    if (id) await service.from("sepa_collection_runs").delete().eq("id", id);
  }
  if (zyklusId) await service.from("billing_cycles").delete().eq("id", zyklusId);
  if (ticketId) await service.from("tickets").delete().eq("id", ticketId);
  if (eventId) await service.from("events").delete().eq("id", eventId);
  if (artId) await service.from("event_types").delete().eq("id", artId);
  if (aboId) await service.from("subscriptions").delete().eq("id", aboId);
  if (kundeId) await service.auth.admin.deleteUser(kundeId).catch(() => {});
});

describe("PROJ-107: Der Leistungszeitraum auf der Rechnung", () => {
  it("nennt am Abo den Zeitraum des Zyklus", async () => {
    const position = await legePositionAn(laufMitZyklus, { subscription_id: aboId });
    const { error } = await alsAdmin.rpc("create_invoices_for_collection_run", {
      p_run_id: laufMitZyklus,
    });
    expect(error).toBeNull();

    const beschreibung = await beschreibungZu(position);
    expect(beschreibung).toBe(`E2E107Z Flatrate (${ERWARTET})`);
  });

  it("nennt am Ticket keinen Zeitraum — es gilt für einen Abend", async () => {
    const position = await legePositionAn(laufMitZyklus, {
      event_ticket_id: ticketId,
      amount: 18,
    });
    const { error } = await alsAdmin.rpc("create_invoices_for_collection_run", {
      p_run_id: laufMitZyklus,
    });
    expect(error).toBeNull();

    const beschreibung = await beschreibungZu(position);
    expect(beschreibung).toBe("E2E107Z Abend");
    expect(beschreibung).not.toContain("2035");
  });

  it("lässt die Position unverändert, wenn der Lauf an keinem Zyklus hängt", async () => {
    // Die Zeit vor dem 30.11.2026 und jede Lücke: Lieber keine Angabe als
    // eine erfundene.
    const position = await legePositionAn(laufOhneZyklus, { subscription_id: aboId });
    const { error } = await alsAdmin.rpc("create_invoices_for_collection_run", {
      p_run_id: laufOhneZyklus,
    });
    expect(error).toBeNull();

    const beschreibung = await beschreibungZu(position);
    expect(beschreibung).toBe("E2E107Z Flatrate");
  });

  it("lässt niemanden ausser der Verwaltung Rechnungen erzeugen", async () => {
    const alsKunde = await angemeldetAls(URL, ANON, KUNDE, PASSWORT);
    const { error } = await alsKunde.rpc("create_invoices_for_collection_run", {
      p_run_id: laufMitZyklus,
    });
    expect(error?.message ?? "").toContain("not authorized");
  });
});
