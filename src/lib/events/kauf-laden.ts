import type { Einheit, Ticketart, Zahlungswahl } from "@/lib/events/tickets";
import { GELTUNG_ALLE, STANDARD_STORNOFRIST_TAGE } from "@/lib/events/tickets";

/**
 * Die Angaben, die der Kaufdialog braucht — aus den Zeilen der Datenbank
 * (PROJ-56).
 *
 * Eine Tür für Übersicht, Eventseite, Serienseite und „Mein Bereich". Ohne sie
 * baute jede Seite das Ticketmodell selbst zusammen, und eine davon vergäße
 * die Zahlungsarten — dann böte eine Karte Barzahlung an, wo das Event nur
 * SEPA erlaubt.
 */

/** Die Spalten, die eine Seite mitladen muss, um den Kauf anzubieten. */
export const KAUF_SPALTEN =
  "payment_methods, cancellation_lead_days, role_query_enabled, max_role_difference, " +
  "event_ticket_types(id, name, price_normal, price_student, quota, scope, on_sale, position, " +
  "event_ticket_type_units(unit_id)), " +
  "event_units(id, title, starts_at, ends_at, capacity)";

export type TicketartZeile = {
  id: string;
  name: string;
  price_normal: number;
  price_student: number;
  quota: number | null;
  scope: string;
  on_sale: boolean;
  position: number;
  /** Nur bei fester Geltung gefüllt (QA-Befund BUG-2). */
  event_ticket_type_units?: { unit_id: string }[] | null;
};

export type EinheitZeile = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
};

export type EventKaufZeile = {
  payment_methods: string;
  cancellation_lead_days: number;
  role_query_enabled: boolean;
  event_ticket_types: TicketartZeile[] | null;
  event_units: EinheitZeile[] | null;
};

/**
 * Die Ticketarten eines Events.
 *
 * Hat ein Event (noch) keine, tritt eine aus seinen eigenen Preisen ein. Das
 * ist der Zustand zwischen Auslieferung und Migration — und der Fall, in dem
 * jemand die letzte Art gelöscht hat.
 */
export function ticketartenAus(
  zeile: EventKaufZeile,
  ersatz: { id: string; name: string; priceNormal: number | null; priceStudent: number | null },
  verkauftJeArt?: Map<string, number>
): Ticketart[] {
  const zeilen = (zeile.event_ticket_types ?? []).slice().sort((a, b) => a.position - b.position);
  if (zeilen.length === 0) {
    return [
      {
        id: ersatz.id,
        name: ersatz.name,
        preisNormal: ersatz.priceNormal ?? 0,
        preisStudierend: ersatz.priceStudent ?? ersatz.priceNormal ?? 0,
        kontingent: null,
        geltung: GELTUNG_ALLE,
        einheitIds: [],
        imVerkauf: true,
        verkauft: 0,
      },
    ];
  }

  return zeilen.map((art) => ({
    id: art.id,
    name: art.name,
    preisNormal: Number(art.price_normal),
    preisStudierend: Number(art.price_student),
    kontingent: art.quota,
    geltung: art.scope as Ticketart["geltung"],
    // Ohne diese Zuordnung gälte eine Art mit fester Geltung als unbegrenzt —
    // sie wäre nie ausverkauft, und die Aufzählung fehlte (QA-Befund BUG-2).
    einheitIds: (art.event_ticket_type_units ?? []).map((zeile) => zeile.unit_id),
    imVerkauf: art.on_sale,
    verkauft: verkauftJeArt?.get(art.id) ?? 0,
  }));
}

export function einheitenAus(zeile: EventKaufZeile, belegt?: Map<string, number>): Einheit[] {
  return (zeile.event_units ?? [])
    .slice()
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map((einheit) => ({
      id: einheit.id,
      titel: einheit.title,
      startsAt: einheit.starts_at,
      endsAt: einheit.ends_at,
      kapazitaet: einheit.capacity,
      belegt: belegt?.get(einheit.id) ?? 0,
    }));
}

export function zahlungswahlAus(zeile: EventKaufZeile): Zahlungswahl {
  return (zeile.payment_methods as Zahlungswahl) ?? "both";
}

export function stornofristAus(zeile: EventKaufZeile): number {
  return zeile.cancellation_lead_days ?? STANDARD_STORNOFRIST_TAGE;
}

export type KaufAngaben = {
  id: string;
  name: string;
  ticketarten: Ticketart[];
  einheiten: Einheit[];
  zahlungswahl: Zahlungswahl;
  rolleAbfragen: boolean;
  stornofristTage: number;
};

/** Alles, was der Kaufdialog braucht, aus einer Eventzeile. */
export function kaufAngaben(
  event: { id: string; name: string; price_normal: number | null; price_student: number | null } & EventKaufZeile,
  zaehlungen?: { verkauftJeArt?: Map<string, number>; belegtJeEinheit?: Map<string, number> }
): KaufAngaben {
  return {
    id: event.id,
    name: event.name,
    ticketarten: ticketartenAus(
      event,
      { id: event.id, name: event.name, priceNormal: event.price_normal, priceStudent: event.price_student },
      zaehlungen?.verkauftJeArt
    ),
    einheiten: einheitenAus(event, zaehlungen?.belegtJeEinheit),
    zahlungswahl: zahlungswahlAus(event),
    rolleAbfragen: event.role_query_enabled ?? false,
    stornofristTage: stornofristAus(event),
  };
}

/**
 * Derselbe Bau ohne Programm — für Serientermine und Listen, die Einheiten und
 * Ticketarten nicht mitladen. Ein Serientermin hat nach der Entscheidung aus
 * PROJ-56 ohnehin keine Einheiten.
 */
export function einfacherKauf(event: {
  id: string;
  name: string;
  priceNormal: number | null;
  priceStudent: number | null;
  zahlungswahl?: Zahlungswahl;
  stornofristTage?: number;
}): KaufAngaben {
  return {
    id: event.id,
    name: event.name,
    ticketarten: ticketartenAus({ payment_methods: "both", cancellation_lead_days: STANDARD_STORNOFRIST_TAGE, role_query_enabled: false, event_ticket_types: null, event_units: null }, {
      id: event.id,
      name: event.name,
      priceNormal: event.priceNormal,
      priceStudent: event.priceStudent,
    }),
    einheiten: [],
    zahlungswahl: event.zahlungswahl ?? "both",
    rolleAbfragen: false,
    stornofristTage: event.stornofristTage ?? STANDARD_STORNOFRIST_TAGE,
  };
}
