import { describe, it, expect } from "vitest";
import {
  AUSSCHNITT_STANDARD,
  ausschnittEnden,
  ausschnittPosition,
  ausschnittrichtung,
  begrenzeAusschnitt,
  KARTE_VERHAELTNIS,
} from "./ausschnitt";

describe("PROJ-63: Richtung des Ausschnitts", () => {
  it("schiebt hochformatige Bilder senkrecht", () => {
    expect(ausschnittrichtung(1080, 1350)).toBe("senkrecht");
    expect(ausschnittrichtung(1000, 1000)).toBe("senkrecht");
    expect(ausschnittrichtung(1200, 900)).toBe("senkrecht"); // 4:3 ist schmäler als 16:9
  });

  it("schiebt sehr breite Bilder waagrecht", () => {
    expect(ausschnittrichtung(2100, 900)).toBe("waagrecht");
  });

  it("lässt ein Bild im Kartenformat in Ruhe", () => {
    expect(ausschnittrichtung(1600, 900)).toBe("keine");
    // Knapp daneben zählt als gleich: ein Regler ohne sichtbare Wirkung wäre
    // schlimmer als keiner.
    expect(ausschnittrichtung(1600, 901)).toBe("keine");
  });

  it("gibt bei unsinnigen Maßen keine Richtung", () => {
    expect(ausschnittrichtung(0, 900)).toBe("keine");
    expect(ausschnittrichtung(1600, 0)).toBe("keine");
    expect(ausschnittrichtung(Number.NaN, 900)).toBe("keine");
  });

  it("richtet sich nach dem übergebenen Fenster", () => {
    // Im quadratischen Fenster der Galerie liegt 4:3 auf der anderen Seite.
    expect(ausschnittrichtung(1200, 900, 1)).toBe("waagrecht");
    expect(ausschnittrichtung(900, 1200, 1)).toBe("senkrecht");
  });

  it("kennt das Kartenformat", () => {
    expect(KARTE_VERHAELTNIS).toBe(16 / 9);
  });
});

describe("PROJ-63: Grenzen des Werts", () => {
  it("lässt gültige Werte durch", () => {
    expect(begrenzeAusschnitt(0)).toBe(0);
    expect(begrenzeAusschnitt(50)).toBe(50);
    expect(begrenzeAusschnitt(100)).toBe(100);
  });

  it("schneidet ab, was außerhalb liegt", () => {
    expect(begrenzeAusschnitt(-20)).toBe(0);
    expect(begrenzeAusschnitt(1000)).toBe(100);
  });

  it("rundet und fällt bei Unsinn auf mittig zurück", () => {
    expect(begrenzeAusschnitt(33.4)).toBe(33);
    expect(begrenzeAusschnitt("70")).toBe(70);
    expect(begrenzeAusschnitt("oben")).toBe(AUSSCHNITT_STANDARD);
    expect(begrenzeAusschnitt(null)).toBe(AUSSCHNITT_STANDARD);
    expect(begrenzeAusschnitt(undefined)).toBe(AUSSCHNITT_STANDARD);
    // Number("") und Number([]) sind 0 — und 0 hieße hier „ganz oben".
    expect(begrenzeAusschnitt("")).toBe(AUSSCHNITT_STANDARD);
    expect(begrenzeAusschnitt("   ")).toBe(AUSSCHNITT_STANDARD);
    expect(begrenzeAusschnitt([])).toBe(AUSSCHNITT_STANDARD);
  });
});

describe("PROJ-63: Angabe für die Anzeige", () => {
  it("bewegt bei hochformatigen Bildern die Höhe", () => {
    expect(ausschnittPosition(0, "senkrecht")).toBe("50% 0%");
    expect(ausschnittPosition(100, "senkrecht")).toBe("50% 100%");
  });

  it("bewegt bei breiten Bildern die Seite", () => {
    expect(ausschnittPosition(25, "waagrecht")).toBe("25% 50%");
  });

  it("bleibt mittig, wo es nichts zu schieben gibt", () => {
    expect(ausschnittPosition(0, "keine")).toBe("50% 50%");
    expect(ausschnittPosition(100, "keine")).toBe("50% 50%");
  });

  it("hält sich auch hier an die Grenzen", () => {
    expect(ausschnittPosition(-5, "senkrecht")).toBe("50% 0%");
    expect(ausschnittPosition(140, "waagrecht")).toBe("100% 50%");
  });
});

describe("PROJ-63: Beschriftung der Enden", () => {
  it("benennt die Richtung, in die geschoben wird", () => {
    expect(ausschnittEnden("senkrecht")).toEqual({ anfang: "oben", ende: "unten" });
    expect(ausschnittEnden("waagrecht")).toEqual({ anfang: "links", ende: "rechts" });
  });

  it("schweigt, wo es nichts zu schieben gibt", () => {
    expect(ausschnittEnden("keine")).toBeNull();
  });
});
