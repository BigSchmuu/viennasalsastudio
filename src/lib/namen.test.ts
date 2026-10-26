import { describe, it, expect } from "vitest";
import { teileName, zusammengesetzterName } from "./namen";

describe("teileName", () => {
  it("teilt den häufigen Fall", () => {
    expect(teileName("Anna Müller")).toEqual({ vorname: "Anna", nachname: "Müller" });
  });

  // Zweit- und Drittvornamen sind häufiger als mehrteilige Nachnamen.
  it("teilt am letzten Leerzeichen, nicht am ersten", () => {
    expect(teileName("Anna Maria Müller")).toEqual({ vorname: "Anna Maria", nachname: "Müller" });
  });

  // Niemand wird wegen eines fehlenden Nachnamens gesperrt.
  it("macht aus einem einzelnen Wort den Vornamen", () => {
    expect(teileName("Lisa")).toEqual({ vorname: "Lisa", nachname: "" });
  });

  it("räumt Leerzeichen auf", () => {
    expect(teileName("  Anna   Müller  ")).toEqual({ vorname: "Anna", nachname: "Müller" });
  });

  it("verträgt leer, null und undefined", () => {
    for (const wert of ["", "   ", null, undefined]) {
      expect(teileName(wert)).toEqual({ vorname: "", nachname: "" });
    }
  });

  // Die bekannte Grenze der Regel, hier festgehalten statt verschwiegen: So
  // sieht man beim Lesen des Tests, was die Verwaltung nachbessern muss.
  it("trifft ein Namenspräfix nicht — bekannt und in Kauf genommen", () => {
    expect(teileName("Jan van der Berg")).toEqual({ vorname: "Jan van der", nachname: "Berg" });
  });
});

describe("zusammengesetzterName", () => {
  it("setzt beide Teile zusammen", () => {
    expect(zusammengesetzterName("Anna", "Müller")).toBe("Anna Müller");
  });

  it("lässt einen fehlenden Teil weg, ohne ein Leerzeichen zu hinterlassen", () => {
    expect(zusammengesetzterName("Lisa", "")).toBe("Lisa");
    expect(zusammengesetzterName(null, "Müller")).toBe("Müller");
  });

  // Eine leere Zeichenkette in einer Liste sieht aus wie ein Fehler.
  it("gibt null, wenn nichts übrig bleibt", () => {
    expect(zusammengesetzterName("", "")).toBeNull();
    expect(zusammengesetzterName(null, undefined)).toBeNull();
  });

  it("ist das Gegenstück zum Teilen", () => {
    const geteilt = teileName("Anna Maria Müller");
    expect(zusammengesetzterName(geteilt.vorname, geteilt.nachname)).toBe("Anna Maria Müller");
  });
});
