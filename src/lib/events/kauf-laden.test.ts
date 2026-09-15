import { describe, it, expect } from "vitest";
import { einfacherKauf, ticketartenAus, type EventKaufZeile } from "@/lib/events/kauf-laden";

const leer: EventKaufZeile = {
  payment_methods: "both",
  cancellation_lead_days: 1,
  role_query_enabled: false,
  event_ticket_types: null,
  event_units: null,
};

describe("ticketartenAus", () => {
  it("tritt mit dem Preis des Events ein, wenn es keine Ticketart gibt", () => {
    // So sind Serientermine gebaut und alles, was vor PROJ-56 entstanden ist.
    const arten = ticketartenAus(leer, { id: "event-1", name: "Freitagsparty", priceNormal: 12, priceStudent: 9 });
    expect(arten).toHaveLength(1);
    expect(arten[0]).toMatchObject({ name: "Freitagsparty", preisNormal: 12, preisStudierend: 9 });
  });

  it("kennzeichnet diese ersatzweise Art als solche", () => {
    // Ihre Kennung ist die des Events und steht in keiner Tabelle. Wird sie
    // beim Kauf mitgeschickt, weist die Datenbank ihn ab — genau das ist
    // passiert, und die volle Suite hat es gefunden.
    const arten = ticketartenAus(leer, { id: "event-1", name: "Party", priceNormal: 10, priceStudent: 8 });
    expect(arten[0].implizit).toBe(true);
    expect(arten[0].id).toBe("event-1");
  });

  it("kennzeichnet echte Ticketarten nicht", () => {
    const mitArten: EventKaufZeile = {
      ...leer,
      event_ticket_types: [
        {
          id: "art-1",
          name: "Full Pass",
          price_normal: 60,
          price_student: 50,
          quota: null,
          scope: "all",
          on_sale: true,
          position: 0,
        },
      ],
    };
    const arten = ticketartenAus(mitArten, { id: "event-1", name: "Workshop", priceNormal: 0, priceStudent: 0 });
    expect(arten[0].implizit).toBeUndefined();
    expect(arten[0].id).toBe("art-1");
  });

  it("nimmt die verkauften Stückzahlen mit, wenn sie vorliegen", () => {
    const mitArten: EventKaufZeile = {
      ...leer,
      event_ticket_types: [
        {
          id: "art-1",
          name: "Full Pass",
          price_normal: 60,
          price_student: 50,
          quota: 10,
          scope: "all",
          on_sale: true,
          position: 0,
        },
      ],
    };
    const arten = ticketartenAus(
      mitArten,
      { id: "event-1", name: "Workshop", priceNormal: 0, priceStudent: 0 },
      new Map([["art-1", 7]])
    );
    expect(arten[0].verkauft).toBe(7);
  });

  it("sortiert die Arten nach ihrer Reihenfolge", () => {
    const mitArten: EventKaufZeile = {
      ...leer,
      event_ticket_types: [
        { id: "b", name: "Zweite", price_normal: 1, price_student: 1, quota: null, scope: "all", on_sale: true, position: 1 },
        { id: "a", name: "Erste", price_normal: 1, price_student: 1, quota: null, scope: "all", on_sale: true, position: 0 },
      ],
    };
    const arten = ticketartenAus(mitArten, { id: "event-1", name: "Workshop", priceNormal: 0, priceStudent: 0 });
    expect(arten.map((art) => art.id)).toEqual(["a", "b"]);
  });
});

describe("einfacherKauf", () => {
  it("baut eine ersatzweise Art ohne Einheiten — für Serientermine", () => {
    const kauf = einfacherKauf({ id: "termin-1", name: "Freitagsparty", priceNormal: 12, priceStudent: 9 });
    expect(kauf.einheiten).toEqual([]);
    expect(kauf.ticketarten[0].implizit).toBe(true);
    expect(kauf.rolleAbfragen).toBe(false);
  });

  it("übernimmt Zahlungsart und Frist des Events, wenn sie mitkommen", () => {
    const kauf = einfacherKauf({
      id: "termin-1",
      name: "Party",
      priceNormal: 12,
      priceStudent: 9,
      zahlungswahl: "onsite",
      stornofristTage: 3,
    });
    expect(kauf.zahlungswahl).toBe("onsite");
    expect(kauf.stornofristTage).toBe(3);
  });
});
