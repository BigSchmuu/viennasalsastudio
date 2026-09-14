import { heuteInWien, tagesendeInWien } from "@/lib/constants/zeitzone";
import { TICKET_CANCELLATION_LEAD_DAYS } from "@/lib/constants/events";

/**
 * Was ein Event gerade anzeigen soll (PROJ-53).
 *
 * Dasselbe Event erscheint an drei Stellen: als Karte in der Übersicht, auf
 * seiner eigenen Seite und in „Mein Bereich". Stünde die Entscheidung dreimal
 * da, liefen die Fassungen auseinander — genau das ist bei den Kursknöpfen
 * passiert (siehe lib/bookings/knopfzustand.ts). Deshalb steht sie hier.
 */

export const SALES_MODES = ["display", "tickets"] as const;
export type SalesMode = (typeof SALES_MODES)[number];

export type EventZustand =
  | "abgesagt"
  | "vorbei"
  | "ticketVorhanden"
  | "nurAnzeigen"
  | "ausgebucht"
  | "kaufen";

export type EventLage = {
  status: string;
  salesMode: SalesMode;
  startsAt: string;
  endsAt: string | null;
  capacity: number | null;
  occupied: number;
  hatTicket: boolean;
};

/**
 * Wann ein Event vorbei ist: zum eingetragenen Ende — ohne Ende zum Ende des
 * Veranstaltungstags in Wien.
 */
export function eventEnde(startsAt: string, endsAt: string | null): Date {
  return endsAt ? new Date(endsAt) : tagesendeInWien(new Date(startsAt));
}

export function eventZustand(lage: EventLage, jetzt: Date): EventZustand {
  // Die Reihenfolge ist eine Aussage darüber, was am meisten zählt. Eine Absage
  // steht über allem, auch über einem gekauften Ticket. Ein vergangenes Event
  // bietet nichts mehr an. Wer ein Ticket hat, soll das sehen, auch wenn das
  // Event inzwischen ausgebucht ist.
  if (lage.status === "abgesagt") return "abgesagt";
  if (jetzt >= eventEnde(lage.startsAt, lage.endsAt)) return "vorbei";
  if (lage.hatTicket) return "ticketVorhanden";
  if (lage.salesMode === "display") return "nurAnzeigen";
  if (lage.capacity !== null && lage.occupied >= lage.capacity) return "ausgebucht";
  // Kein Blick auf den Beginn: Tickets sind bis zum Ende kaufbar, auch
  // während die Party schon läuft (Betreiberentscheidung 2026-09-14).
  return "kaufen";
}

/** Freie Plätze; `null`, wenn das Event keine Kapazität hat. */
export function freiePlaetze(lage: Pick<EventLage, "capacity" | "occupied">): number | null {
  return lage.capacity === null ? null : Math.max(0, lage.capacity - lage.occupied);
}

/**
 * Ob ein jetzt gekauftes Ticket noch selbst storniert werden kann.
 *
 * Dieselbe Rechnung wie `cancel_event_ticket` in der Datenbank: Wiener
 * Kalendertag des Beginns minus heutiger Wiener Kalendertag, mindestens
 * `TICKET_CANCELLATION_LEAD_DAYS`. Rechnete die Anzeige anders, versprächen
 * Kaufdialog und Stornoknopf zwei verschiedene Fristen.
 */
export function stornierbar(startsAt: string, jetzt: Date): boolean {
  return tageZwischen(heuteInWien(jetzt), heuteInWien(new Date(startsAt))) >= TICKET_CANCELLATION_LEAD_DAYS;
}

function tageZwischen(von: string, bis: string): number {
  return Math.round((Date.parse(`${bis}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`)) / 86_400_000);
}
