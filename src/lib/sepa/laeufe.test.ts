import { describe, it, expect } from "vitest";
import {
  POSITION_BETRAG_MAX,
  betragAusEingabe,
  freigabeHindernis,
  istAenderbar,
  istUeberfaelligerEntwurf,
  laufZustand,
  positionenSumme,
  pruefePositionsbetrag,
} from "./laeufe";

describe("PROJ-47: pruefePositionsbetrag", () => {
  it("nimmt einen gewöhnlichen Betrag an", () => {
    expect(pruefePositionsbetrag("65")).toEqual([]);
    expect(pruefePositionsbetrag("65,50")).toEqual([]);
    expect(pruefePositionsbetrag("65.50")).toEqual([]);
  });

  it("weist null und negative Beträge ab — eine Lastschrift über 0 € gibt es nicht", () => {
    expect(pruefePositionsbetrag("0")).toContain("betrag_ungueltig");
    expect(pruefePositionsbetrag("-5")).toContain("betrag_ungueltig");
  });

  it("weist Text ab", () => {
    expect(pruefePositionsbetrag("fünfundsechzig")).toContain("betrag_ungueltig");
    expect(pruefePositionsbetrag("")).toContain("betrag_ungueltig");
  });

  it("fängt den Vertipper ab, um den es geht: 4500 statt 45,00", () => {
    expect(pruefePositionsbetrag("4500")).toContain("betrag_zu_hoch");
    expect(pruefePositionsbetrag("45,00")).toEqual([]);
  });

  it("lässt genau die Obergrenze zu, erst darüber nicht mehr", () => {
    expect(pruefePositionsbetrag(String(POSITION_BETRAG_MAX))).toEqual([]);
    expect(pruefePositionsbetrag(String(POSITION_BETRAG_MAX + 0.01))).toContain("betrag_zu_hoch");
  });
});

describe("PROJ-47: betragAusEingabe", () => {
  it("versteht Komma wie Punkt", () => {
    expect(betragAusEingabe("12,50")).toBe(12.5);
    expect(betragAusEingabe("12.50")).toBe(12.5);
  });

  it("übergeht Leerzeichen am Rand", () => {
    expect(betragAusEingabe("  65 ")).toBe(65);
  });
});

describe("PROJ-47: laufZustand", () => {
  it("ist Entwurf, solange nicht freigegeben wurde", () => {
    expect(laufZustand(null, false)).toBe("entwurf");
  });

  it("bleibt Entwurf, auch wenn eine Position als rückgebucht markiert wäre", () => {
    // Ohne Freigabe wurde nichts eingezogen, also kann nichts zurückgebucht
    // sein. Der Entwurf hat Vorrang — sonst zeigte die Liste einen Zustand,
    // den es gar nicht geben kann.
    expect(laufZustand(null, true)).toBe("entwurf");
  });

  it("unterscheidet nach der Freigabe zwischen eingezogen und rückgebucht", () => {
    expect(laufZustand("2026-09-06T10:00:00Z", false)).toBe("eingezogen");
    expect(laufZustand("2026-09-06T10:00:00Z", true)).toBe("rueckgebucht");
  });
});

describe("PROJ-47: istAenderbar", () => {
  it("erlaubt Änderungen nur vor der Freigabe", () => {
    expect(istAenderbar(null)).toBe(true);
    expect(istAenderbar("2026-09-06T10:00:00Z")).toBe(false);
  });
});

describe("PROJ-47: freigabeHindernis", () => {
  it("nennt kein Hindernis bei einem gefüllten Entwurf", () => {
    expect(freigabeHindernis(null, 3)).toBeNull();
  });

  it("verhindert die zweite Freigabe", () => {
    expect(freigabeHindernis("2026-09-06T10:00:00Z", 3)).toBe("bereits_freigegeben");
  });

  it("verhindert die Freigabe eines leeren Entwurfs", () => {
    // Wer die letzte Position entfernt, hätte sonst eine Bankdatei ohne Zeilen.
    expect(freigabeHindernis(null, 0)).toBe("keine_positionen");
  });

  it("nennt die bereits erfolgte Freigabe zuerst, auch wenn der Lauf leer ist", () => {
    expect(freigabeHindernis("2026-09-06T10:00:00Z", 0)).toBe("bereits_freigegeben");
  });
});

describe("PROJ-47: positionenSumme", () => {
  it("summiert die Beträge", () => {
    expect(positionenSumme([{ amount: 65 }, { amount: 45 }, { amount: 35 }])).toBe(145);
  });

  it("ist bei einem leeren Lauf null", () => {
    expect(positionenSumme([])).toBe(0);
  });

  it("nimmt Beträge auch als Zeichenkette an — so liefert sie Postgres über PostgREST", () => {
    expect(positionenSumme([{ amount: "65.50" as unknown as number }])).toBe(65.5);
  });
});

describe("PROJ-47: istUeberfaelligerEntwurf", () => {
  it("warnt, wenn das Fälligkeitsdatum verstrichen ist", () => {
    expect(istUeberfaelligerEntwurf("2026-09-01", null, "2026-09-06")).toBe(true);
  });

  it("warnt am Fälligkeitstag selbst noch nicht", () => {
    // Der Tag gehört noch dem Betreiber — erst wenn er vorbei ist, ist etwas
    // versäumt.
    expect(istUeberfaelligerEntwurf("2026-09-06", null, "2026-09-06")).toBe(false);
  });

  it("warnt nicht bei einem Datum in der Zukunft", () => {
    expect(istUeberfaelligerEntwurf("2026-10-01", null, "2026-09-06")).toBe(false);
  });

  it("warnt nie bei einem freigegebenen Lauf", () => {
    // Der ist eingezogen; ein verstrichenes Datum ist dort das Normale.
    expect(istUeberfaelligerEntwurf("2026-01-01", "2026-01-01T10:00:00Z", "2026-09-06")).toBe(false);
  });
});
