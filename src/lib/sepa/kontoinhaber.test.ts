import { describe, it, expect } from "vitest";
import { nameWeichtAb } from "./kontoinhaber";

describe("nameWeichtAb", () => {
  it("erkennt denselben Namen", () => {
    expect(nameWeichtAb("Max Mustermann", "Max Mustermann")).toBe(false);
  });

  it("stört sich nicht an Groß- und Kleinschreibung oder Leerzeichen", () => {
    expect(nameWeichtAb("Max Mustermann", "  max   MUSTERMANN ")).toBe(false);
  });

  it("hält Müller und Mueller für dieselbe Person", () => {
    // Auf Kontoauszügen stehen Umlaute regelmäßig ausgeschrieben.
    expect(nameWeichtAb("Anna Müller", "Anna Mueller")).toBe(false);
  });

  it("stört sich nicht an der Reihenfolge", () => {
    expect(nameWeichtAb("Max Mustermann", "Mustermann Max")).toBe(false);
  });

  it("hält Anna-Lena und Anna Lena für dieselbe Person", () => {
    expect(nameWeichtAb("Anna-Lena Gruber", "Anna Lena Gruber")).toBe(false);
  });

  it("erkennt einen wirklich anderen Namen", () => {
    expect(nameWeichtAb("Max Mustermann", "Erika Beispiel")).toBe(true);
  });

  it("erkennt einen fehlenden Namensteil", () => {
    expect(nameWeichtAb("Max Mustermann", "Mustermann")).toBe(true);
  });

  it("fragt nicht, wenn im Profil kein Name steht", () => {
    // Sonst stünde die Rückfrage bei jedem, der seinen Namen nie eingetragen
    // hat — und sie wäre nicht zu beantworten.
    expect(nameWeichtAb(null, "Max Mustermann")).toBe(false);
    expect(nameWeichtAb("   ", "Max Mustermann")).toBe(false);
  });
});
