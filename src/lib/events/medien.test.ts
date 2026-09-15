import { describe, it, expect } from "vitest";
import { bildBeschriftung, bildFehler, MAX_BILD_BYTES, zielGroesse } from "@/lib/events/medien";

function datei(felder: Partial<{ type: string; size: number; name: string }> = {}) {
  return { type: "image/jpeg", size: 1000, name: "flyer.jpg", ...felder };
}

describe("bildFehler", () => {
  it("lässt JPG, PNG und WebP durch", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(bildFehler(datei({ type }))).toBeNull();
    }
  });

  it("weist ein PDF als falsches Format ab", () => {
    expect(bildFehler(datei({ type: "application/pdf", name: "flyer.pdf" }))).toBe("typ");
  });

  it("erkennt ein iPhone-Foto und meldet es eigens", () => {
    // Der eigene Hinweis erspart die Suche nach dem Grund: Umwandeln kann das
    // Telefon selbst.
    expect(bildFehler(datei({ type: "image/heic", name: "IMG_0042.HEIC" }))).toBe("heic");
    expect(bildFehler(datei({ type: "", name: "IMG_0042.heif" }))).toBe("heic");
  });

  it("weist eine zu große Datei ab", () => {
    expect(bildFehler(datei({ size: MAX_BILD_BYTES + 1 }))).toBe("zuGross");
    expect(bildFehler(datei({ size: MAX_BILD_BYTES }))).toBeNull();
  });

  it("prüft zuerst das Format, dann die Größe", () => {
    // Sonst hörte der Admin „zu groß" und lüde dieselbe HEIC-Datei kleiner
    // noch einmal hoch.
    expect(bildFehler(datei({ type: "image/heic", name: "x.heic", size: MAX_BILD_BYTES + 1 }))).toBe("heic");
  });
});

describe("zielGroesse", () => {
  it("verkleinert die längste Kante auf das Maß", () => {
    expect(zielGroesse(6000, 4000, 2000)).toEqual({ breite: 2000, hoehe: 1333 });
  });

  it("rechnet Hochformat genauso", () => {
    expect(zielGroesse(3000, 4500, 2000)).toEqual({ breite: 1333, hoehe: 2000 });
  });

  it("lässt ein kleines Bild in Ruhe", () => {
    // Aus einem 800-Pixel-Flyer würde sonst ein unscharfer 2000-Pixel-Flyer.
    expect(zielGroesse(800, 600, 2000)).toEqual({ breite: 800, hoehe: 600 });
  });

  it("lässt ein Bild genau auf dem Maß unverändert", () => {
    expect(zielGroesse(2000, 1200, 2000)).toEqual({ breite: 2000, hoehe: 1200 });
  });

  it("macht aus keiner Kante eine Null", () => {
    // Ein sehr flaches Bild würde sonst auf die Höhe 0 gerundet — und wäre weg.
    expect(zielGroesse(4000, 1, 2000)).toEqual({ breite: 2000, hoehe: 1 });
  });
});

describe("bildBeschriftung", () => {
  it("nimmt die Beschreibung, wenn es eine gibt", () => {
    expect(bildBeschriftung("Tanzfläche am Freitag", "Freitagsparty")).toBe("Tanzfläche am Freitag");
  });

  it("tritt mit dem Eventnamen ein, wenn das Feld leer blieb", () => {
    expect(bildBeschriftung(null, "Freitagsparty")).toBe("Freitagsparty");
    expect(bildBeschriftung("   ", "Freitagsparty")).toBe("Freitagsparty");
  });
});
