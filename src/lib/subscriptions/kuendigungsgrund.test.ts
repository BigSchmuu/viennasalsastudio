import { describe, it, expect } from "vitest";
import {
  grundLabel,
  istKuendigungsgrund,
  KUENDIGUNGSGRUENDE,
  zaehleGruende,
} from "./kuendigungsgrund";

describe("istKuendigungsgrund", () => {
  it("erkennt jeden Wert der Liste", () => {
    for (const grund of KUENDIGUNGSGRUENDE) {
      expect(istKuendigungsgrund(grund.wert)).toBe(true);
    }
  });

  it("weist alles andere ab", () => {
    expect(istKuendigungsgrund("mir_doch_egal")).toBe(false);
    expect(istKuendigungsgrund("")).toBe(false);
    expect(istKuendigungsgrund(null)).toBe(false);
    expect(istKuendigungsgrund(42)).toBe(false);
  });
});

describe("grundLabel", () => {
  it("nennt den Grund auf Deutsch und auf Englisch", () => {
    expect(grundLabel("zu_teuer")).toBe("Zu teuer");
    expect(grundLabel("zu_teuer", "en")).toBe("Too expensive");
  });

  it("sagt „Keine Angabe“, wo keiner genannt ist", () => {
    expect(grundLabel(null)).toBe("Keine Angabe");
    expect(grundLabel(undefined)).toBe("Keine Angabe");
    expect(grundLabel("")).toBe("Keine Angabe");
  });

  // Ein roher Wert ist ein Fehler, den man sieht; „—" wäre einer, den niemand
  // bemerkt.
  it("lässt einen unbekannten Wert unverändert durch", () => {
    expect(grundLabel("aus_einer_spaeteren_migration")).toBe("aus_einer_spaeteren_migration");
  });

  it("hat für jeden Grund eine englische Beschriftung", () => {
    for (const grund of KUENDIGUNGSGRUENDE) {
      const en = grundLabel(grund.wert, "en");
      expect(en, `englische Beschriftung für ${grund.wert}`).not.toBe(grund.wert);
      expect(en).not.toBe(grund.label);
    }
  });
});

describe("zaehleGruende", () => {
  it("zählt je Grund und nennt den häufigsten zuerst", () => {
    const zaehlung = zaehleGruende(["zu_teuer", "keine_zeit", "keine_zeit", "umzug"]);
    expect(zaehlung.gruende.map((g) => `${g.label} ${g.anzahl}`)).toEqual([
      "Keine Zeit mehr 2",
      "Zu teuer 1",
      "Umzug 1",
    ]);
  });

  // Sonst springen zwei gleich häufige Gründe bei jedem Laden.
  it("ordnet Gleichstand nach der Reihenfolge der Liste", () => {
    const zaehlung = zaehleGruende(["umzug", "zu_teuer"]);
    expect(zaehlung.gruende.map((g) => g.wert)).toEqual(["zu_teuer", "umzug"]);
  });

  // „Ohne Angabe" ist kein Grund, sondern die Antwort auf „wie belastbar ist
  // das hier?".
  it("zählt Kündigungen ohne Grund getrennt mit", () => {
    const zaehlung = zaehleGruende(["zu_teuer", null, undefined, ""]);
    expect(zaehlung.gesamt).toBe(4);
    expect(zaehlung.mitGrund).toBe(1);
    expect(zaehlung.gruende).toHaveLength(1);
  });

  it("kommt ohne Kündigungen zurecht", () => {
    expect(zaehleGruende([])).toEqual({ gruende: [], gesamt: 0, mitGrund: 0 });
  });

  it("sortiert einen unbekannten Wert nach hinten", () => {
    const zaehlung = zaehleGruende(["aus_der_zukunft", "zu_teuer"]);
    expect(zaehlung.gruende.map((g) => g.wert)).toEqual(["zu_teuer", "aus_der_zukunft"]);
  });
});
