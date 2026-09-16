import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { angemeldetAls } from "./anmeldung";

/**
 * PROJ-59: Stornieren und Gutschreiben, wie die Datenbank es durchsetzt.
 *
 * Hier geht es um Geld. Eine Oberfläche, die sich vertut, ärgert; eine
 * Datenbankfunktion, die sich vertut, kostet. Deshalb wird jede der Lagen
 * einzeln geprüft — besonders die, in der ein Lastschriftlauf zwar existiert,
 * aber noch nicht freigegeben ist.
 *
 * Braucht die Migration 20260916140000_proj59_ticket_storno.sql.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORT = "CorrectPassword123!";

const ADMIN = "proj59-admin@viennasalsastudio.test";
const KUNDE = "proj59-kunde@viennasalsastudio.test";

let service: SupabaseClient;
let alsAdmin: SupabaseClient;
let alsKunde: SupabaseClient;
const nutzer: Record<string, string> = {};
let artId: string;
let eventId: string;
const aufraeumen: { tickets: string[]; laeufe: string[] } = { tickets: [], laeufe: [] };

async function kontoAnlegen(mail: string, rolle: "admin" | "customer"): Promise<string> {
  const { data: alle } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = alle?.users.find((u) => u.email === mail);
  if (alt) await service.auth.admin.deleteUser(alt.id);

  const { data, error } = await service.auth.admin.createUser({
    email: mail,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-59 Konto ${mail}: ${error?.message}`);
  await service.from("profiles").update({ role: rolle, full_name: `E2E59 ${rolle}` }).eq("id", data.user.id);
  nutzer[mail] = data.user.id;
  return data.user.id;
}

/** Ein Ticket anlegen — über den Dienstzugang, die Kaufregeln sind hier nicht das Thema. */
async function ticketAnlegen(preis: number, zahlungsart: "sepa" | "onsite" = "sepa"): Promise<string> {
  const { data, error } = await service
    .from("tickets")
    .insert({
      event_id: eventId,
      customer_id: nutzer[KUNDE],
      payment_method: zahlungsart,
      price: preis,
      status: "confirmed",
      cancellation_lead_days: 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-59 Ticket: ${error.message}`);
  aufraeumen.tickets.push(data.id);
  return data.id;
}

/** Einen Lastschriftlauf mit diesem Ticket darin — freigegeben oder nicht. */
async function laufMitTicket(ticketId: string, freigegeben: boolean): Promise<void> {
  // Erst offen anlegen, Position hinzufügen, dann freigeben. Andersherum geht
  // es nicht: Die Datenbank verweigert eine Position in einem freigegebenen
  // Lauf — zu Recht, denn die Datei ist dann schon bei der Bank (PROJ-47).
  const { data: lauf, error } = await service
    .from("sepa_collection_runs")
    .insert({ due_date: "2026-10-01" })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-59 Lauf: ${error.message}`);
  aufraeumen.laeufe.push(lauf.id);

  const { error: postenFehler } = await service.from("sepa_collection_items").insert({
    run_id: lauf.id,
    customer_id: nutzer[KUNDE],
    subscription_id: null,
    event_ticket_id: ticketId,
    amount: 18,
    iban: "AT611904300234573201",
    account_holder_name: "E2E59 Kunde",
    mandate_reference: `E2E59-${Date.now()}`,
  });
  if (postenFehler) throw new Error(`PROJ-59 Posten: ${postenFehler.message}`);

  if (freigegeben) {
    const { error: freigabeFehler } = await service
      .from("sepa_collection_runs")
      .update({ released_at: new Date().toISOString() })
      .eq("id", lauf.id);
    if (freigabeFehler) throw new Error(`PROJ-59 Freigabe: ${freigabeFehler.message}`);
  }
}

/**
 * Die Freigabe eines Laufs aus einem Posten lesen.
 *
 * Der Testclient ist untypisiert, deshalb weiß er nicht, dass hinter einem
 * Posten genau ein Lauf steht — er hält es für eine Liste. Der Anwendungscode
 * arbeitet mit dem typisierten Client und sieht dort ein einzelnes Objekt.
 * Diese Hilfe nimmt beides.
 */
function freigabeVon(posten: { sepa_collection_runs: unknown }): string | null {
  const lauf = posten.sepa_collection_runs as
    | { released_at: string | null }
    | { released_at: string | null }[]
    | null;
  if (!lauf) return null;
  return Array.isArray(lauf) ? (lauf[0]?.released_at ?? null) : lauf.released_at;
}

async function guthabenZeilen(): Promise<{ amount: number; origin: string; reason: string | null }[]> {
  const { data } = await service
    .from("customer_credits")
    .select("amount, origin, reason")
    .eq("customer_id", nutzer[KUNDE]);
  return data ?? [];
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });
  await kontoAnlegen(ADMIN, "admin");
  await kontoAnlegen(KUNDE, "customer");

  const { data: art } = await service
    .from("event_types")
    .insert({ name: `E2E59 Art ${Date.now()}` })
    .select("id")
    .single();
  artId = art!.id;

  const { data: event } = await service
    .from("events")
    .insert({
      name: "E2E59 Storno-Event",
      slug: `e2e59-${crypto.randomUUID().slice(0, 8)}`,
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
  eventId = event!.id;

  alsAdmin = await angemeldetAls(URL, ANON, ADMIN, PASSWORT);
  alsKunde = await angemeldetAls(URL, ANON, KUNDE, PASSWORT);
}, 60_000);

afterAll(async () => {
  await service.from("customer_credits").delete().eq("customer_id", nutzer[KUNDE]);
  await service.from("sepa_collection_items").delete().in("event_ticket_id", aufraeumen.tickets);
  await service.from("sepa_collection_runs").delete().in("id", aufraeumen.laeufe);
  await service.from("tickets").delete().eq("event_id", eventId);
  await service.from("events").delete().eq("id", eventId);
  await service.from("event_types").delete().eq("id", artId);
  for (const kennung of Object.values(nutzer)) {
    await service.auth.admin.deleteUser(kennung).catch(() => {});
  }
});

describe("PROJ-59: Stornieren durch die Verwaltung", () => {
  it("storniert und schreibt auf Wunsch gut", async () => {
    const ticket = await ticketAnlegen(18);
    const { data, error } = await alsAdmin.rpc("admin_ticket_stornieren", {
      p_ticket_id: ticket,
      p_grund: "Auf Wunsch des Kunden",
      p_guthaben: true,
    });

    expect(error).toBeNull();
    expect((data as { status: string }).status).toBe("storniert");
    expect(Number((data as { gutschrift: number }).gutschrift)).toBe(18);

    const { data: danach } = await service
      .from("tickets")
      .select("status, cancelled_at, cancelled_by, cancellation_reason")
      .eq("id", ticket)
      .single();
    expect(danach!.status).toBe("cancelled");
    expect(danach!.cancelled_at).not.toBeNull();
    expect(danach!.cancelled_by).toBe(nutzer[ADMIN]);
    expect(danach!.cancellation_reason).toBe("Auf Wunsch des Kunden");

    const guthaben = await guthabenZeilen();
    expect(guthaben).toHaveLength(1);
    expect(Number(guthaben[0].amount)).toBe(18);
    expect(guthaben[0].origin).toBe("storno");
    expect(guthaben[0].reason).toContain("E2E59 Storno-Event");

    await service.from("customer_credits").delete().eq("customer_id", nutzer[KUNDE]);
  });

  it("storniert ohne Gutschrift, wenn das Häkchen nicht gesetzt war", async () => {
    const ticket = await ticketAnlegen(18);
    await alsAdmin.rpc("admin_ticket_stornieren", { p_ticket_id: ticket, p_guthaben: false });

    expect(await guthabenZeilen()).toHaveLength(0);
  });

  it("schreibt bei einer Freikarte nichts gut, auch wenn das Häkchen gesetzt ist", async () => {
    const ticket = await ticketAnlegen(0);
    const { error } = await alsAdmin.rpc("admin_ticket_stornieren", {
      p_ticket_id: ticket,
      p_guthaben: true,
    });

    // Die Guthaben-Tabelle lässt keine Nullbeträge zu — ohne die Abfrage in der
    // Funktion wäre das hier ein Fehler statt einer sauberen Stornierung.
    expect(error).toBeNull();
    expect(await guthabenZeilen()).toHaveLength(0);
  });

  it("lässt einen leeren Grund als „kein Grund\" stehen, nicht als Leerzeichen", async () => {
    const ticket = await ticketAnlegen(18);
    await alsAdmin.rpc("admin_ticket_stornieren", { p_ticket_id: ticket, p_grund: "   " });

    const { data } = await service.from("tickets").select("cancellation_reason").eq("id", ticket).single();
    expect(data!.cancellation_reason).toBeNull();
  });

  it("meldet ein bereits storniertes Ticket, statt zu scheitern", async () => {
    const ticket = await ticketAnlegen(18);
    await alsAdmin.rpc("admin_ticket_stornieren", { p_ticket_id: ticket, p_guthaben: false });

    const { data, error } = await alsAdmin.rpc("admin_ticket_stornieren", {
      p_ticket_id: ticket,
      p_guthaben: true,
    });
    expect(error).toBeNull();
    expect((data as { status: string }).status).toBe("bereits_storniert");
    // Und kein zweites Guthaben.
    expect(await guthabenZeilen()).toHaveLength(0);
  });

  it("erzeugt bei zwei gleichzeitigen Stornierungen genau eine Gutschrift", async () => {
    const ticket = await ticketAnlegen(18);
    const [a, b] = await Promise.all([
      alsAdmin.rpc("admin_ticket_stornieren", { p_ticket_id: ticket, p_guthaben: true }),
      alsAdmin.rpc("admin_ticket_stornieren", { p_ticket_id: ticket, p_guthaben: true }),
    ]);

    const zustaende = [a.data, b.data].map((d) => (d as { status: string }).status);
    expect(zustaende).toContain("storniert");
    expect(zustaende).toContain("bereits_storniert");
    expect(await guthabenZeilen()).toHaveLength(1);

    await service.from("customer_credits").delete().eq("customer_id", nutzer[KUNDE]);
  });

  it("weist ein Kundenkonto ab", async () => {
    const ticket = await ticketAnlegen(18);
    const { error } = await alsKunde.rpc("admin_ticket_stornieren", {
      p_ticket_id: ticket,
      p_guthaben: true,
    });

    expect(error?.message).toContain("not authorized");
    const { data } = await service.from("tickets").select("status").eq("id", ticket).single();
    expect(data!.status).toBe("confirmed");
  });

  it("meldet ein unbekanntes Ticket", async () => {
    const { error } = await alsAdmin.rpc("admin_ticket_stornieren", {
      p_ticket_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(error?.message).toContain("ticket not found");
  });

  it("nimmt ein storniertes Ticket aus dem nächsten Lastschriftlauf", async () => {
    const ticket = await ticketAnlegen(18);
    await alsAdmin.rpc("admin_ticket_stornieren", { p_ticket_id: ticket, p_guthaben: false });

    // Der Lauf sammelt nur 'confirmed' und 'checked_in'.
    const { data } = await service
      .from("tickets")
      .select("id")
      .eq("id", ticket)
      .in("status", ["confirmed", "checked_in"]);
    expect(data).toHaveLength(0);
  });
});

describe("PROJ-59: Ist das Geld schon weg?", () => {
  it("ein freigegebener Lauf bedeutet: abgebucht", async () => {
    const ticket = await ticketAnlegen(18);
    await laufMitTicket(ticket, true);

    const { data } = await service
      .from("sepa_collection_items")
      .select("sepa_collection_runs(released_at)")
      .eq("event_ticket_id", ticket);
    expect(data!.some((p) => freigabeVon(p))).toBe(true);
  });

  it("ein erzeugter, aber nicht freigegebener Lauf bedeutet: noch nichts abgebucht", async () => {
    const ticket = await ticketAnlegen(18);
    await laufMitTicket(ticket, false);

    const { data } = await service
      .from("sepa_collection_items")
      .select("sepa_collection_runs(released_at)")
      .eq("event_ticket_id", ticket);
    // Der Posten existiert — aber das Geld ist noch im Haus. Wer hier „abgebucht"
    // meldet, drängt dem Betreiber eine Gutschrift für Geld auf, das er nie
    // eingenommen hat.
    expect(data).toHaveLength(1);
    expect(data!.every((p) => !freigabeVon(p))).toBe(true);
  });
});
