import { describe, it, expect } from "vitest";
import { leseGlaeubigerAdresse, ADRESS_GRENZEN } from "./glaeubiger-adresse";

describe("PROJ-104: Die Gläubigeradresse aus der Konfiguration", () => {
  const vollstaendig = {
    strasse: "Beispielgasse",
    hausnummer: "1a",
    top: "Top 6",
    plz: "1010",
    ort: "Wien",
    land: "AT",
  };

  it("nimmt eine vollständige Adresse", () => {
    expect(leseGlaeubigerAdresse(vollstaendig)).toEqual({ adresse: vollstaendig });
  });

  it("lässt die Adresse weg, wenn nichts gesetzt ist — das ist erlaubt", () => {
    expect(leseGlaeubigerAdresse({})).toEqual({ adresse: null });
    expect(
      leseGlaeubigerAdresse({
        strasse: "",
        hausnummer: " ",
        top: " ",
        plz: null,
        ort: undefined,
        land: "",
      })
    ).toEqual({ adresse: null });
  });

  it("nimmt ein „Top“ allein als Anlass, eine Adresse zu wollen", () => {
    // Nur die Nummer im Haus gesetzt: Gemeint war eine Adresse, und ohne Ort
    // und Land wird daraus keine. Lieber abbrechen als still verschweigen.
    const ergebnis = leseGlaeubigerAdresse({ top: "Top 6" });
    expect("fehler" in ergebnis && ergebnis.fehler).toContain("SEPA_CREDITOR_TOWN");
  });

  it("genügt mit Ort und Land — mehr ist empfohlen, nicht verlangt", () => {
    expect(leseGlaeubigerAdresse({ ort: "Wien", land: "AT" })).toEqual({
      adresse: {
        strasse: undefined,
        hausnummer: undefined,
        top: undefined,
        plz: undefined,
        ort: "Wien",
        land: "AT",
      },
    });
  });

  it("weist eine halbe Adresse ohne Ort ab, statt sie still zu verschweigen", () => {
    const ergebnis = leseGlaeubigerAdresse({ strasse: "Beispielgasse", hausnummer: "1a", land: "AT" });
    expect(ergebnis).toHaveProperty("fehler");
    expect("fehler" in ergebnis && ergebnis.fehler).toContain("SEPA_CREDITOR_TOWN");
  });

  it("weist eine Adresse ohne Land ab", () => {
    const ergebnis = leseGlaeubigerAdresse({ ort: "Wien" });
    expect("fehler" in ergebnis && ergebnis.fehler).toContain("SEPA_CREDITOR_COUNTRY");
  });

  it("macht aus „at“ ein „AT“ — das war offensichtlich gemeint", () => {
    expect(leseGlaeubigerAdresse({ ort: "Wien", land: "at" })).toMatchObject({
      adresse: { land: "AT" },
    });
  });

  it("weist ein Länderkürzel ab, das keines ist", () => {
    for (const land of ["Österreich", "A", "AUT", "A1"]) {
      const ergebnis = leseGlaeubigerAdresse({ ort: "Wien", land });
      expect("fehler" in ergebnis, `„${land}“ hätte abgewiesen werden müssen`).toBe(true);
      expect("fehler" in ergebnis && ergebnis.fehler).toContain("zwei Buchstaben");
    }
  });

  it("schneidet Leerzeichen weg", () => {
    expect(leseGlaeubigerAdresse({ ort: "  Wien  ", land: " at " })).toMatchObject({
      adresse: { ort: "Wien", land: "AT" },
    });
  });

  it("weist zu lange Werte ab, statt die eigene Adresse zu kürzen", () => {
    const faelle: [keyof typeof ADRESS_GRENZEN, string][] = [
      ["strasse", "SEPA_CREDITOR_STREET"],
      ["hausnummer", "SEPA_CREDITOR_BUILDING"],
      ["top", "SEPA_CREDITOR_ROOM"],
      ["plz", "SEPA_CREDITOR_POSTCODE"],
      ["ort", "SEPA_CREDITOR_TOWN"],
    ];
    for (const [feld, name] of faelle) {
      const zuLang = "x".repeat(ADRESS_GRENZEN[feld] + 1);
      const ergebnis = leseGlaeubigerAdresse({ ...vollstaendig, [feld]: zuLang });
      expect("fehler" in ergebnis, `${feld} hätte abgewiesen werden müssen`).toBe(true);
      expect("fehler" in ergebnis && ergebnis.fehler).toContain(name);
    }
  });

  it("nimmt Werte genau an der Grenze", () => {
    const ergebnis = leseGlaeubigerAdresse({
      ...vollstaendig,
      ort: "x".repeat(ADRESS_GRENZEN.ort),
    });
    expect(ergebnis).toHaveProperty("adresse");
  });

  it("hält die Grenzen des Schemas fest", () => {
    // Aus der EPC-Richtlinie: StrtNm Max70Text, BldgNb Max16Text,
    // PstCd Max16Text, TwnNm Max35Text.
    // Aus der EPC-Richtlinie: StrtNm Max70Text, BldgNb Max16Text,
    // Room Max70Text, PstCd Max16Text, TwnNm Max35Text.
    expect(ADRESS_GRENZEN).toEqual({ strasse: 70, hausnummer: 16, top: 70, plz: 16, ort: 35 });
  });
});
