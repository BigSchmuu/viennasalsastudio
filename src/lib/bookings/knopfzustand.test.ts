import { describe, it, expect } from "vitest";
import { buchungsknopf } from "./knopfzustand";

const kurs = (ueber: Partial<Parameters<typeof buchungsknopf>[0]> = {}) => ({
  hasActiveSubscription: false,
  hasOpenRegularBooking: false,
  isOnWaitlist: false,
  ...ueber,
});

describe("buchungsknopf", () => {
  it("lädt zum Buchen ein, wenn nichts dagegensteht", () => {
    expect(buchungsknopf(kurs())).toBe("buchen");
  });

  it("nennt die offene Anfrage", () => {
    // Bisher stand auch dann „Jetzt buchen" da, und der Kunde erfuhr es erst
    // im Dialog — nach einem Klick, der ins Leere führte.
    expect(buchungsknopf(kurs({ hasOpenRegularBooking: true }))).toBe("anfrageOffen");
  });

  it("nennt den Wartelistenplatz", () => {
    expect(buchungsknopf(kurs({ isOnWaitlist: true }))).toBe("warteliste");
  });

  it("nennt die Einschreibung vor allem anderen", () => {
    expect(
      buchungsknopf(kurs({ hasActiveSubscription: true, hasOpenRegularBooking: true, isOnWaitlist: true }))
    ).toBe("eingeschrieben");
  });

  it("stellt die offene Anfrage vor den Wartelistenplatz", () => {
    // Die Anfrage ist der Vorgang, auf den der Wartelistenplatz wartet.
    expect(buchungsknopf(kurs({ hasOpenRegularBooking: true, isOnWaitlist: true }))).toBe(
      "anfrageOffen"
    );
  });
});
