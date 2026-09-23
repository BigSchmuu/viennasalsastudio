import { describe, it, expect } from "vitest";
import { nurAdresse, ortMitAdresse } from "./ort";

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
