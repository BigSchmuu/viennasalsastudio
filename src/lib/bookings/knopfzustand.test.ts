import { describe, it, expect } from "vitest";
import { buchungsknopf, knopfText } from "./knopfzustand";

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

describe("knopfText", () => {
  const t = (s: string) => s;

  it("nennt jeden Zustand", () => {
    expect(knopfText("eingeschrieben", t, "Jetzt buchen")).toBe("btnEnrolled");
    expect(knopfText("anfrageOffen", t, "Jetzt buchen")).toBe("btnPending");
    expect(knopfText("warteliste", t, "Jetzt buchen")).toBe("btnWaitlist");
  });

  it("lässt dem Aufrufer den Buchen-Text", () => {
    // Der Katalog sagt „Jetzt buchen", die enge Stundenplan-Karte nur
    // „Buchen" — der einzige erlaubte Unterschied zwischen den drei Orten.
    expect(knopfText("buchen", t, "Buchen")).toBe("Buchen");
    expect(knopfText("buchen", t, "Jetzt buchen")).toBe("Jetzt buchen");
  });
});
