import { describe, it, expect } from "vitest";
import { eventAdresse, eindeutigeAdresse } from "./adresse";

describe("eventAdresse", () => {
  it("schreibt Umlaute aus und verbindet Wörter mit Bindestrichen", () => {
    expect(eventAdresse("Salsa-Nacht für Anfänger")).toBe("salsa-nacht-fuer-anfaenger");
    expect(eventAdresse("Großer Tanzabend")).toBe("grosser-tanzabend");
  });

  it("lässt Sonderzeichen weg und führt Akzente auf den Grundbuchstaben zurück", () => {
    expect(eventAdresse("Bachata & Kizomba Weekend 2026!")).toBe("bachata-kizomba-weekend-2026");
    expect(eventAdresse("Café Latino")).toBe("cafe-latino");
  });

  it("beginnt und endet nie mit einem Bindestrich", () => {
    expect(eventAdresse("  ¡Salsa!  ")).toBe("salsa");
  });

  it("kürzt lange Namen, ohne mit einem Bindestrich aufzuhören", () => {
    const adresse = eventAdresse(`${"wort ".repeat(30)}ende`);
    expect(adresse.length).toBeLessThanOrEqual(80);
    expect(adresse.endsWith("-")).toBe(false);
  });

  it("gibt einem Namen ohne Buchstaben trotzdem eine Adresse", () => {
    expect(eventAdresse("!!!")).toBe("event");
    expect(eventAdresse("")).toBe("event");
  });
});

describe("eindeutigeAdresse", () => {
  it("behält eine freie Adresse", () => {
    expect(eindeutigeAdresse("salsa-workshop", new Set())).toBe("salsa-workshop");
  });

  it("hängt die erste freie Zahl an", () => {
    const vergeben = new Set(["salsa-workshop", "salsa-workshop-2"]);
    expect(eindeutigeAdresse("salsa-workshop", vergeben)).toBe("salsa-workshop-3");
  });
});
