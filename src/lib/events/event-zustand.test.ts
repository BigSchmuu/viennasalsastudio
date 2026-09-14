import { describe, it, expect } from "vitest";
import { eventEnde, eventZustand, freiePlaetze, stornierbar, type EventLage } from "./event-zustand";
import { tagesendeInWien } from "@/lib/constants/zeitzone";

// Samstag, 03.10.2026, 21:00 bis Sonntag 02:00 Wiener Zeit (Sommerzeit, UTC+2).
const party: EventLage = {
  status: "geplant",
  salesMode: "tickets",
  startsAt: "2026-10-03T19:00:00Z",
  endsAt: "2026-10-04T00:00:00Z",
  capacity: 20,
  occupied: 5,
  hatTicket: false,
};

const vorher = new Date("2026-10-03T12:00:00Z");

describe("eventZustand", () => {
  it("bietet Tickets an, solange Plätze frei sind", () => {
    expect(eventZustand(party, vorher)).toBe("kaufen");
  });

  it("verkauft auch nach dem Beginn weiter — bis zum Ende", () => {
    expect(eventZustand(party, new Date("2026-10-03T21:30:00Z"))).toBe("kaufen");
  });

  it("ist mit dem Ende vorbei", () => {
    expect(eventZustand(party, new Date("2026-10-04T00:00:00Z"))).toBe("vorbei");
  });

  it("gilt ohne eingetragenes Ende bis Mitternacht Wiener Zeit", () => {
    const ohneEnde = { ...party, endsAt: null };
    expect(eventZustand(ohneEnde, new Date("2026-10-03T21:59:00Z"))).toBe("kaufen");
    expect(eventZustand(ohneEnde, new Date("2026-10-03T22:00:00Z"))).toBe("vorbei");
  });

  it("stellt eine Absage über alles, auch über ein Ticket und die Vergangenheit", () => {
    const abgesagt = { ...party, status: "abgesagt", hatTicket: true };
    expect(eventZustand(abgesagt, vorher)).toBe("abgesagt");
    expect(eventZustand(abgesagt, new Date("2026-12-01T00:00:00Z"))).toBe("abgesagt");
  });

  it("zeigt ein vorhandenes Ticket, auch wenn das Event ausgebucht ist", () => {
    expect(eventZustand({ ...party, occupied: 20, hatTicket: true }, vorher)).toBe("ticketVorhanden");
  });

  it("verkauft bei „Nur anzeigen“ nichts, auch ohne Kapazität", () => {
    expect(eventZustand({ ...party, salesMode: "display", capacity: null }, vorher)).toBe("nurAnzeigen");
  });

  it("ist ausgebucht, sobald die Kapazität erreicht ist", () => {
    expect(eventZustand({ ...party, occupied: 20 }, vorher)).toBe("ausgebucht");
  });

  it("bleibt ohne Kapazität kaufbar", () => {
    expect(eventZustand({ ...party, capacity: null, occupied: 500 }, vorher)).toBe("kaufen");
  });
});

describe("freiePlaetze", () => {
  it("rechnet die Differenz und wird nie negativ", () => {
    expect(freiePlaetze({ capacity: 20, occupied: 5 })).toBe(15);
    expect(freiePlaetze({ capacity: 20, occupied: 23 })).toBe(0);
  });

  it("gibt ohne Kapazität keine Zahl an", () => {
    expect(freiePlaetze({ capacity: null, occupied: 3 })).toBeNull();
  });
});

describe("stornierbar", () => {
  it("erlaubt das Stornieren bis zum Vortag", () => {
    expect(stornierbar(party.startsAt, new Date("2026-10-02T10:00:00Z"))).toBe(true);
  });

  it("verbietet es am Veranstaltungstag", () => {
    expect(stornierbar(party.startsAt, new Date("2026-10-03T08:00:00Z"))).toBe(false);
  });

  it("zählt nach Wiener Kalender: 00:30 in Wien ist schon der Veranstaltungstag", () => {
    // 02.10. 22:30 UTC = 03.10. 00:30 Wien
    expect(stornierbar(party.startsAt, new Date("2026-10-02T22:30:00Z"))).toBe(false);
  });
});

describe("eventEnde und tagesendeInWien", () => {
  it("nimmt das eingetragene Ende", () => {
    expect(eventEnde(party.startsAt, party.endsAt).toISOString()).toBe("2026-10-04T00:00:00.000Z");
  });

  it("endet im Sommer um 22:00 UTC, im Winter um 23:00 UTC", () => {
    expect(tagesendeInWien(new Date("2026-09-18T19:00:00Z")).toISOString()).toBe("2026-09-18T22:00:00.000Z");
    expect(tagesendeInWien(new Date("2026-12-05T20:00:00Z")).toISOString()).toBe("2026-12-05T23:00:00.000Z");
  });

  it("rechnet am Tag der Zeitumstellung richtig", () => {
    // In der Nacht auf den 25.10.2026 endet die Sommerzeit.
    expect(tagesendeInWien(new Date("2026-10-24T19:00:00Z")).toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(tagesendeInWien(new Date("2026-10-25T19:00:00Z")).toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });
});
