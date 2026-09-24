import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { angemeldetAls } from "./anmeldung";

/**
 * PROJ-68: Trägt die Vorabankündigung, wofür abgebucht wird?
 *
 * Die Entscheidung fällt in der Datenbank, beim Freigeben des Laufs — dort
 * liegt die Position noch vor, beim Versand ist nur die Warteschlangenzeile
 * da. Geprüft wird deshalb genau dort: Ein Lauf mit einem Abo und einem
 * Event-Ticket muss zwei Ankündigungen erzeugen, die sich unterscheiden.
 *
 * Braucht die Migration 20260924080000_proj68_ankuendigung_art.sql.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN = "e2e8-admin@viennasalsastudio.test";
const PASSWORT = "CorrectPassword123!";

let service: SupabaseClient;
let alsAdmin: SupabaseClient;
let laufId = "";
let aboId: string | null = null;
let ticketId: string | null = null;

/** Ein Fälligkeitsdatum weit weg von allem, was andere Prüfungen zählen. */
const FAELLIG = "2029-11-15";

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  alsAdmin = await angemeldetAls(URL, ANON, ADMIN, PASSWORT);

  const { data: abo } = await service.from("subscriptions").select("id, customer_id").limit(1).maybeSingle();
  const { data: ticket } = await service.from("event_tickets").select("id, customer_id").limit(1).maybeSingle();
  aboId = abo?.id ?? null;
  ticketId = ticket?.id ?? null;

  const { data: lauf, error } = await service
    .from("sepa_collection_runs")
    .insert({ due_date: FAELLIG })
    .select("id")
    .single();
  if (error) throw new Error(`Lauf: ${error.message}`);
  laufId = lauf.id;

  const positionen = [];
  if (abo) {
    positionen.push({
      run_id: laufId,
      customer_id: abo.customer_id,
      subscription_id: abo.id,
      amount: 40,
      iban: "AT611904300234573201",
      account_holder_name: "E2E68 Abo",
      mandate_reference: `E2E68-ABO-${Date.now()}`,
    });
  }
  if (ticket) {
    positionen.push({
      run_id: laufId,
      customer_id: ticket.customer_id,
      event_ticket_id: ticket.id,
      amount: 25,
      iban: "AT611904300234573201",
      account_holder_name: "E2E68 Ticket",
      mandate_reference: `E2E68-TICKET-${Date.now()}`,
    });
  }
  if (positionen.length > 0) {
    const { error: posFehler } = await service.from("sepa_collection_items").insert(positionen);
    if (posFehler) throw new Error(`Positionen: ${posFehler.message}`);
  }
});

afterAll(async () => {
  if (!laufId) return;
  // In der Reihenfolge der Abhängigkeiten: erst die Nachrichten, dann die
  // Rechnungen, die die Freigabe erzeugt hat, dann Positionen und Lauf.
  await service.from("notification_queue").delete().like("dedupe_key", `%:${laufId}`);
  const { data: rechnungen } = await service
    .from("invoices")
    .select("id, collection_item_id, sepa_collection_items!inner(run_id)")
    .eq("sepa_collection_items.run_id", laufId);
  for (const r of rechnungen ?? []) await service.from("invoices").delete().eq("id", r.id);
  await service.from("sepa_collection_items").delete().eq("run_id", laufId);
  await service.from("sepa_collection_runs").delete().eq("id", laufId);
});

async function ankuendigungen() {
  const { data } = await service
    .from("notification_queue")
    .select("payload, dedupe_key")
    .eq("event_type", "sepa_ankuendigung")
    .like("dedupe_key", `%:${laufId}`);
  return data ?? [];
}

describe("PROJ-68: Die Vorabankündigung kennt die Art der Position", () => {
  it("erzeugt beim Freigeben für jede Position eine Ankündigung mit Art", async () => {
    if (!aboId && !ticketId) {
      throw new Error("Weder Abo noch Ticket in der Testdatenbank — Seed nicht gelaufen?");
    }

    const { error } = await alsAdmin.rpc("release_collection_run", { p_run_id: laufId });
    expect(error?.message ?? null, "Freigabe fehlgeschlagen").toBeNull();

    const zeilen = await ankuendigungen();
    expect(zeilen.length, "Keine Ankündigung erzeugt").toBeGreaterThan(0);

    for (const zeile of zeilen) {
      const art = (zeile.payload as Record<string, unknown>).art;
      expect(["abo", "ticket"], `Unbekannte Art: ${String(art)}`).toContain(art);
    }
  });

  it("nennt beim Abo „abo“ und beim Ticket „ticket“", async () => {
    const zeilen = await ankuendigungen();
    const arten = new Map<string, unknown>();
    for (const zeile of zeilen) {
      const schluessel = zeile.dedupe_key.split(":")[1];
      arten.set(schluessel, (zeile.payload as Record<string, unknown>).art);
    }

    if (aboId) expect(arten.get(aboId), "Abo nicht als solches erkannt").toBe("abo");
    if (ticketId) expect(arten.get(ticketId), "Ticket nicht als solches erkannt").toBe("ticket");
  });
});
