import { describe, it, expect } from "vitest";
import {
  betragAusEingabe,
  istOfflineAdresse,
  nameGueltig,
  offlineAdresse,
  OFFLINE_DOMAIN,
} from "./offline";

describe("offlineAdresse", () => {
  it("baut eine Adresse auf der reservierten Endung", () => {
    expect(offlineAdresse("abc123")).toBe(`offline-abc123@${OFFLINE_DOMAIN}`);
    expect(OFFLINE_DOMAIN.endsWith(".invalid")).toBe(true);
  });
});

describe("istOfflineAdresse", () => {
  it("erkennt ein Konto ohne Anmeldung", () => {
    expect(istOfflineAdresse(offlineAdresse("x"))).toBe(true);
    expect(istOfflineAdresse(`OFFLINE-X@${OFFLINE_DOMAIN.toUpperCase()}`)).toBe(true);
  });

  it("lässt echte Adressen echte Adressen sein", () => {
    expect(istOfflineAdresse("anna@example.com")).toBe(false);
    expect(istOfflineAdresse("anna@viennasalsastudio.at")).toBe(false);
    expect(istOfflineAdresse(null)).toBe(false);
    expect(istOfflineAdresse("")).toBe(false);
  });

  // Der Punkt der Ableitung: Trägt die Verwaltung die echte Adresse ein, ist
  // der Kunde ein gewöhnlicher — ohne dass irgendwo ein Haken nachzuziehen ist.
  it("gilt nach dem Eintragen einer echten Adresse nicht mehr", () => {
    expect(istOfflineAdresse("herbert@example.com")).toBe(false);
  });
});

describe("nameGueltig", () => {
  it("nimmt einen gewöhnlichen Namen", () => {
    expect(nameGueltig("Herbert K.")).toBe(true);
  });

  it("weist Leeres und Einzelzeichen ab", () => {
    expect(nameGueltig("")).toBe(false);
    expect(nameGueltig("   ")).toBe(false);
    expect(nameGueltig("H")).toBe(false);
  });

  it("weist einen unsinnig langen Namen ab", () => {
    expect(nameGueltig("x".repeat(201))).toBe(false);
  });
});

describe("betragAusEingabe", () => {
  it("nimmt Punkt und Komma", () => {
    expect(betragAusEingabe("50")).toBe(50);
    expect(betragAusEingabe("49.50")).toBe(49.5);
    // Auf einem Handy tippt niemand einen Punkt.
    expect(betragAusEingabe("49,50")).toBe(49.5);
  });

  it("rundet auf Cent", () => {
    expect(betragAusEingabe("49,999")).toBe(50);
    expect(betragAusEingabe("0,125")).toBe(0.13);
  });

  it("weist ab, was kein Betrag ist", () => {
    expect(betragAusEingabe("")).toBeNull();
    expect(betragAusEingabe("   ")).toBeNull();
    expect(betragAusEingabe("abc")).toBeNull();
    expect(betragAusEingabe("0")).toBeNull();
    expect(betragAusEingabe("-20")).toBeNull();
    expect(betragAusEingabe("999999")).toBeNull();
  });
});
