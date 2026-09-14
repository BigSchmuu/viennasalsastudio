import type { EventZustand } from "@/lib/events/event-zustand";

/**
 * Event-Daten für Suchmaschinen nach schema.org (PROJ-53).
 *
 * Google liest sie aus dem Quelltext der Eventseite und kann das Event dann
 * mit Datum und Ort direkt in der Suche zeigen. Sie beschreiben das Event für
 * alle Besucher gleich — der Zustand darf deshalb kein persönliches Ticket
 * enthalten, sonst stünde in der ausgelieferten Seite, ob der Betrachter eines
 * hat.
 */

export type EventFuerSuchmaschinen = {
  name: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  priceNormal: number | null;
  zustand: Exclude<EventZustand, "ticketVorhanden">;
  url: string;
  siteUrl: string;
};

export function eventDaten(event: EventFuerSuchmaschinen): Record<string, unknown> {
  const daten: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.name,
    startDate: event.startsAt,
    eventStatus:
      event.zustand === "abgesagt" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url: event.url,
    organizer: { "@type": "Organization", name: "Vienna Salsa Studio", url: event.siteUrl },
  };

  if (event.endsAt) daten.endDate = event.endsAt;
  if (event.description) daten.description = event.description;
  if (event.location) {
    daten.location = { "@type": "Place", name: event.location, address: event.location };
  }
  if (event.priceNormal !== null) {
    daten.offers = {
      "@type": "Offer",
      price: event.priceNormal,
      priceCurrency: "EUR",
      availability:
        event.zustand === "ausgebucht" ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      url: event.url,
    };
  }

  return daten;
}

/**
 * Als Inhalt eines `<script type="application/ld+json">`. Das `<` wird
 * maskiert: Ein Eventname wie „</script><script>…" beendete sonst den Block,
 * und der Rest liefe als Code.
 */
export function alsSkriptInhalt(daten: unknown): string {
  return JSON.stringify(daten).replace(/</g, "\\u003c");
}
