import { describe, it, expect } from "vitest";
import { istFrueher, type VerlaufsEingabe } from "./verlauf";

const HEUTE = "2026-09-12";
const b = (ueber: Partial<VerlaufsEingabe> = {}): VerlaufsEingabe => ({
  type: "regular",
  status: "confirmed",
  chosenDate: "2026-09-20",
  aboStatus: "active",
  ...ueber,
});

describe("istFrueher", () => {
  it("hält eine offene Anfrage für aktuell", () => {
    expect(istFrueher(b({ status: "open" }), HEUTE)).toBe(false);
  });

  it("hält eine bestätigte Anfrage mit laufendem Abo für aktuell", () => {
    expect(istFrueher(b(), HEUTE)).toBe(false);
  });

  it("hält eine bestätigte Anfrage mit gekündigtem Abo für vorbei", () => {
    // Der gemeldete Fall: Nach dem Kündigen stand sie weiter als „Bestätigt" da
    // und sah aus wie eine laufende Buchung.
    expect(istFrueher(b({ aboStatus: "cancelled" }), HEUTE)).toBe(true);
  });

  it("hält ein pausiertes Abo für aktuell", () => {
    // Eine Pause kommt zurück — die Buchung dahinter lebt weiter.
    expect(istFrueher(b({ aboStatus: "paused" }), HEUTE)).toBe(false);
  });

  it("hält eine bestätigte Anfrage ohne Abo für vorbei", () => {
    expect(istFrueher(b({ aboStatus: null }), HEUTE)).toBe(true);
  });

  it("hält Abgelehntes und Storniertes immer für vorbei", () => {
    expect(istFrueher(b({ status: "rejected" }), HEUTE)).toBe(true);
    expect(istFrueher(b({ status: "cancelled" }), HEUTE)).toBe(true);
    expect(istFrueher(b({ type: "trial", status: "cancelled" }), HEUTE)).toBe(true);
  });

  it("hält eine Probestunde bis zu ihrem Termin für aktuell", () => {
    expect(istFrueher(b({ type: "trial", aboStatus: null }), HEUTE)).toBe(false);
    // Am Tag selbst noch nicht vorbei: Wer hingeht, soll sie oben finden.
    expect(istFrueher(b({ type: "trial", chosenDate: HEUTE, aboStatus: null }), HEUTE)).toBe(false);
  });

  it("hält eine vergangene Probestunde für vorbei", () => {
    expect(istFrueher(b({ type: "trial", chosenDate: "2026-09-05", aboStatus: null }), HEUTE)).toBe(true);
  });

  it("behandelt Drop-ins wie Probestunden", () => {
    expect(istFrueher(b({ type: "dropin", chosenDate: "2026-09-05", aboStatus: null }), HEUTE)).toBe(true);
    expect(istFrueher(b({ type: "dropin", chosenDate: "2026-09-20", aboStatus: null }), HEUTE)).toBe(false);
  });
});
