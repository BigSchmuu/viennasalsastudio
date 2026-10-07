import { describe, it, expect } from "vitest";
import { nurAdresse, ortMitAdresse, wegbeschreibung } from "./ort";

describe("PROJ-67: Der Standort in der Erinnerung", () => {
  it("setzt Name und Anschrift zusammen", () => {
    expect(ortMitAdresse({ name: "Studio Nord", adresse: "Musterstraße 1, 1020 Wien" })).toBe(
      "Studio Nord, Musterstraße 1, 1020 Wien"
    );
  });

  it("lässt das Komma weg, wenn keine Anschrift hinterlegt ist", () => {
    // Sonst stünde in der Mail „Studio Nord," und dahinter nichts.
    expect(ortMitAdresse({ name: "Studio Nord", adresse: null })).toBe("Studio Nord");
    expect(ortMitAdresse({ name: "Studio Nord", adresse: "   " })).toBe("Studio Nord");
  });

  it("nimmt die Anschrift allein, wenn der Name fehlt", () => {
    expect(ortMitAdresse({ name: null, adresse: "Musterstraße 1" })).toBe("Musterstraße 1");
  });

  it("bleibt leer, wenn es nichts zu sagen gibt", () => {
    expect(ortMitAdresse(null)).toBe("");
    expect(ortMitAdresse(undefined)).toBe("");
    expect(ortMitAdresse({ name: null, adresse: null })).toBe("");
  });

  it("räumt Leerzeichen an den Rändern weg", () => {
    expect(ortMitAdresse({ name: "  Studio Süd  ", adresse: " Hauptstraße 2 " })).toBe(
      "Studio Süd, Hauptstraße 2"
    );
  });

  it("gibt die Anschrift auch einzeln heraus", () => {
    expect(nurAdresse({ name: "Studio Nord", adresse: "Musterstraße 1" })).toBe("Musterstraße 1");
    expect(nurAdresse({ name: "Studio Nord", adresse: null })).toBe("");
    expect(nurAdresse(null)).toBe("");
  });
});

describe("wegbeschreibung (PROJ-77)", () => {
  const nord = {
    name: "Studio Nord",
    adresse: "Musterstraße 1",
    beschreibung: "Eingang über den Hof, zweiter Stock.",
  };

  it("macht aus der Beschreibung einen fertigen Satz", () => {
    expect(wegbeschreibung(nord)).toBe(
      "So findest du uns: Eingang über den Hof, zweiter Stock."
    );
  });

  it("sagt denselben Satz auf Englisch", () => {
    expect(wegbeschreibung(nord, "en")).toBe(
      "Here is how to find us: Eingang über den Hof, zweiter Stock."
    );
  });

  // Der Fall, um den es geht: Ohne Beschreibung darf *nichts* entstehen, sonst
  // bliebe im Vorlagentext eine Einleitung ohne Fortsetzung stehen.
  it("bleibt leer, wenn keine Beschreibung hinterlegt ist", () => {
    expect(wegbeschreibung({ name: "Studio Süd", adresse: "Beispielweg 4" })).toBe("");
    expect(wegbeschreibung({ name: "Studio Süd", adresse: null, beschreibung: null })).toBe("");
    expect(wegbeschreibung({ name: null, adresse: null, beschreibung: "   " })).toBe("");
    expect(wegbeschreibung(null)).toBe("");
    expect(wegbeschreibung(undefined)).toBe("");
  });

  // Der E-Mail-Text ist ein Absatz; ein Umbruch wäre dort unsichtbar und zwei
  // ergäben eine Lücke mitten im Satz.
  it("macht aus Umbrüchen und Leerzeilen einzelne Leerzeichen", () => {
    const mehrzeilig = {
      name: "Studio Nord",
      adresse: null,
      beschreibung: "Eingang über den Hof.\n\n  Zweiter Stock,\nKlingel „Studio“.",
    };
    expect(wegbeschreibung(mehrzeilig)).toBe(
      "So findest du uns: Eingang über den Hof. Zweiter Stock, Klingel „Studio“."
    );
  });
});
