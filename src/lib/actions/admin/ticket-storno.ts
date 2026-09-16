"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { eventEnde } from "@/lib/events/event-zustand";

/**
 * Was der Storno-Dialog über ein Ticket wissen muss (PROJ-59).
 *
 * Der wichtigste Wert ist `abgebuchtAm`. Davon hängt ab, ob dem Betreiber eine
 * Gutschrift vorgeschlagen wird — und eine falsche Antwort kostet bares Geld.
 */
export type StornoLage = {
  name: string;
  ticketart: string | null;
  einheit: string | null;
  preis: number;
  zahlungsart: "sepa" | "onsite";
  /** Gesetzt, sobald das Ticket in einem **freigegebenen** Lauf steht. */
  abgebuchtAm: string | null;
  /** Steht in einem erzeugten, aber noch nicht freigegebenen Lauf. */
  imOffenenLauf: boolean;
  eingecheckt: boolean;
  eventVorbei: boolean;
};

/**
 * Die Geldlage eines Tickets ermitteln.
 *
 * „Abgebucht" heißt nicht „steht in einem Lastschriftlauf", sondern „steht in
 * einem Lauf, der freigegeben wurde". Den Zustand hat PROJ-47 eingeführt: Erst
 * mit der Freigabe geht die Datei an die Bank. Ein Ticket in einem erzeugten,
 * aber nicht freigegebenen Lauf gilt deshalb als **nicht** abgebucht — sonst
 * bekäme der Betreiber eine Gutschrift für Geld vorgeschlagen, das er nie
 * eingenommen hat, und die Zeile ließe sich obendrein noch aus dem Lauf nehmen
 * (PROJ-47).
 */
export async function getStornoLage(ticketId: string): Promise<StornoLage | null> {
  const { supabase } = await requireAdmin();

  const { data: ticket } = await supabase
    .from("tickets")
    .select(
      "price, payment_method, checked_in_at, profiles(full_name), event_ticket_types(name), event_units(title), events(starts_at, ends_at)"
    )
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket) return null;

  const { data: posten } = await supabase
    .from("sepa_collection_items")
    .select("id, sepa_collection_runs(released_at)")
    .eq("event_ticket_id", ticketId);

  const freigegeben = (posten ?? []).find((p) => p.sepa_collection_runs?.released_at);
  const offen = (posten ?? []).some((p) => !p.sepa_collection_runs?.released_at);

  return {
    name: ticket.profiles?.full_name || "Unbenannter Kunde",
    ticketart: ticket.event_ticket_types?.name ?? null,
    einheit: ticket.event_units?.title ?? null,
    preis: ticket.price,
    zahlungsart: ticket.payment_method as "sepa" | "onsite",
    abgebuchtAm: freigegeben?.sepa_collection_runs?.released_at ?? null,
    imOffenenLauf: offen,
    eingecheckt: ticket.checked_in_at !== null,
    eventVorbei: ticket.events
      ? eventEnde(ticket.events.starts_at, ticket.events.ends_at) <= new Date()
      : false,
  };
}

/**
 * Ein Ticket durch die Verwaltung stornieren (PROJ-59).
 *
 * NOCH NICHT UMGESETZT — wird im Backend-Schritt gebaut.
 *
 * Stornierung und Gutschrift müssen als **ein** Schritt in der Datenbank
 * laufen: Sonst könnte ein abgebrochener Vorgang ein storniertes Ticket ohne
 * Gutschrift hinterlassen, und der Kunde hätte weder Platz noch Geld. Das
 * verlangt eine neue Datenbankfunktion samt Migration — beides gehört in
 * /backend, nicht hierher.
 */
export async function ticketStornieren(
  _ticketId: string,
  _angaben: { grund: string; guthabenGutschreiben: boolean }
): Promise<{ error: string } | { success: true }> {
  await requireAdmin();
  return { error: "Das Stornieren wird gerade gebaut und ist noch nicht scharf geschaltet." };
}
