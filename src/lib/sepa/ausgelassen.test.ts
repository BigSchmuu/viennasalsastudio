import { describe, it, expect } from "vitest";
import {
  auslassGrund,
  auslassText,
  auslassZusammenfassung,
  istDatenfehler,
  type AboZumPruefen,
} from "./ausgelassen";

const KEINE_FERIEN: { von: string; bis: string }[] = [];
const FAELLIG = "2026-11-16";

function abo(teile: Partial<AboZumPruefen> = {}): AboZumPruefen {
  return {
    price: 45,
    cycle_anchor_date: "2026-01-05",
    pending_status: null,
    pending_effective_date: null,
    ...teile,
  };
}

describe("PROJ-103: Warum ein Lauf ein Abo auslässt", () => {
  it("lässt ein laufendes, fälliges Abo mit Preis nicht aus", () => {
    expect(auslassGrund(abo(), FAELLIG, [], KEINE_FERIEN)).toBeNull();
    expect(auslassGrund(abo(), FAELLIG, undefined, KEINE_FERIEN)).toBeNull();
  });

  it("nennt die Kündigung, die zum Fälligkeitstag wirkt", () => {
    const grund = auslassGrund(
      abo({ pending_status: "cancelled", pending_effective_date: FAELLIG }),
      FAELLIG,
      [],
      KEINE_FERIEN
    );
    expect(grund).toEqual({ art: "aenderung_wirkt", was: "cancelled", ab: FAELLIG });
  });

  it("nennt die Pause genauso", () => {
    const grund = auslassGrund(
      abo({ pending_status: "paused", pending_effective_date: "2026-11-01" }),
      FAELLIG,
      [],
      KEINE_FERIEN
    );
    expect(grund).toMatchObject({ art: "aenderung_wirkt", was: "paused" });
  });

  it("lässt ein Abo drin, dessen Änderung erst nach dem Fälligkeitstag wirkt", () => {
    const grund = auslassGrund(
      abo({ pending_status: "cancelled", pending_effective_date: "2026-11-17" }),
      FAELLIG,
      [],
      KEINE_FERIEN
    );
    expect(grund).toBeNull();
  });

  it("nennt den späteren Beginn mit Datum", () => {
    const grund = auslassGrund(abo({ cycle_anchor_date: "2026-12-01" }), FAELLIG, [], KEINE_FERIEN);
    expect(grund).toEqual({ art: "beginnt_spaeter", beginn: "2026-12-01" });
  });

  it("nennt beim offenen Zyklus den sperrenden Einzug und den Tag danach", () => {
    // Neun Tage vorher eingezogen: wieder möglich am 28. Tag danach.
    const grund = auslassGrund(abo(), FAELLIG, ["2026-11-07"], KEINE_FERIEN);
    expect(grund).toEqual({
      art: "zyklus_offen",
      letzterEinzug: "2026-11-07",
      wiederAb: "2026-12-05",
    });
  });

  it("rechnet Ferientage in den Tag „wieder möglich ab“ ein", () => {
    const ferien = [{ von: "2026-11-09", bis: "2026-11-15" }];
    const grund = auslassGrund(abo(), FAELLIG, ["2026-11-07"], ferien);
    expect(grund).toMatchObject({ art: "zyklus_offen", wiederAb: "2026-12-12" });
  });

  it("nennt den nächstliegenden sperrenden Einzug, nicht den ältesten", () => {
    const grund = auslassGrund(abo(), FAELLIG, ["2026-11-02", "2026-11-10"], KEINE_FERIEN);
    expect(grund).toMatchObject({ art: "zyklus_offen", letzterEinzug: "2026-11-10" });
  });

  it("redet nicht von einem letzten Einzug, wenn der sperrende noch kommt", () => {
    // Der Lauf von 2028 in der Testdatenbank war genau dieser Fall.
    const grund = auslassGrund(abo(), FAELLIG, ["2026-11-25"], KEINE_FERIEN);
    expect(grund).toEqual({ art: "zyklus_vorgemerkt", kuenftigerEinzug: "2026-11-25" });
  });

  it("übergeht einen Einzug, der weit genug weg ist", () => {
    const grund = auslassGrund(abo(), FAELLIG, ["2026-10-19", "2028-03-01"], KEINE_FERIEN);
    expect(grund).toBeNull();
  });

  it("nennt den fehlenden Preis — der stille Fall bis PROJ-103", () => {
    expect(auslassGrund(abo({ price: null }), FAELLIG, [], KEINE_FERIEN)).toEqual({
      art: "kein_preis",
    });
  });

  it("hält einen Preis von null für eine Null und nicht für ein Versehen", () => {
    expect(auslassGrund(abo({ price: 0 }), FAELLIG, [], KEINE_FERIEN)).toBeNull();
  });

  describe("Reihenfolge, wenn mehreres zutrifft", () => {
    const alles = abo({
      price: null,
      cycle_anchor_date: "2026-12-01",
      pending_status: "cancelled",
      pending_effective_date: "2026-11-10",
    });

    it("stellt die wirksame Änderung vor alles andere", () => {
      expect(auslassGrund(alles, FAELLIG, ["2026-11-07"], KEINE_FERIEN)).toMatchObject({
        art: "aenderung_wirkt",
      });
    });

    it("stellt den späteren Beginn vor den Zyklus und vor den fehlenden Preis", () => {
      const ohneAenderung = abo({
        price: null,
        cycle_anchor_date: "2026-12-01",
      });
      expect(auslassGrund(ohneAenderung, FAELLIG, ["2026-11-07"], KEINE_FERIEN)).toMatchObject({
        art: "beginnt_spaeter",
      });
    });

    it("stellt den Zyklus vor den fehlenden Preis", () => {
      expect(auslassGrund(abo({ price: null }), FAELLIG, ["2026-11-07"], KEINE_FERIEN)).toMatchObject(
        { art: "zyklus_offen" }
      );
    });
  });
});

describe("PROJ-103: Der Grund als Satz", () => {
  it("sagt bei der Kündigung, ab wann nicht mehr eingezogen wird", () => {
    expect(auslassText({ art: "aenderung_wirkt", was: "cancelled", ab: "2026-11-16" })).toBe(
      "Gekündigt zum 16.11.2026 — ab diesem Tag wird nicht mehr eingezogen."
    );
  });

  it("unterscheidet die Pause von der Kündigung", () => {
    expect(auslassText({ art: "aenderung_wirkt", was: "paused", ab: "2026-12-01" })).toContain(
      "Pause ab 1.12.2026"
    );
  });

  it("behält bei einem unbekannten Zustand einen wahren Satz", () => {
    expect(auslassText({ art: "aenderung_wirkt", was: "unbekannt", ab: "2026-12-01" })).toContain(
      "Eine Änderung wirkt ab"
    );
  });

  it("nennt beim Beginn das Datum", () => {
    expect(auslassText({ art: "beginnt_spaeter", beginn: "2026-12-01" })).toBe(
      "Beginnt erst am 1.12.2026 — nach diesem Fälligkeitstag."
    );
  });

  it("behält die Formulierung aus PROJ-70 und ergänzt den Tag danach", () => {
    const text = auslassText({
      art: "zyklus_offen",
      letzterEinzug: "2026-11-07",
      wiederAb: "2026-12-05",
    });
    // Dieselbe Wortwahl wie im Dialog „Position hinzufügen“ — der E2E-Test von
    // PROJ-70 prüft genau diesen Satzteil.
    expect(text).toMatch(/Einzug am .* keine vier Wochen Abstand/);
    expect(text).toContain("wieder möglich ab 5.12.2026");
  });

  it("sagt beim künftigen Einzug nicht „zuletzt“", () => {
    const text = auslassText({ art: "zyklus_vorgemerkt", kuenftigerEinzug: "2028-03-01" });
    expect(text).toContain("schon ein Einzug angelegt");
    expect(text).not.toContain("zuletzt");
  });

  it("nennt den fehlenden Preis als das, was er ist", () => {
    expect(auslassText({ art: "kein_preis" })).toContain("Kein Preis am Abo hinterlegt");
  });

  it("hebt allein den fehlenden Preis als Datenfehler hervor", () => {
    expect(istDatenfehler({ art: "kein_preis" })).toBe(true);
    expect(istDatenfehler({ art: "beginnt_spaeter", beginn: "2026-12-01" })).toBe(false);
    expect(
      istDatenfehler({ art: "aenderung_wirkt", was: "cancelled", ab: "2026-12-01" })
    ).toBe(false);
  });
});

describe("PROJ-103: Die Zusammenfassung für den leeren Lauf", () => {
  it("zählt je Grund und beugt die Mehrzahl", () => {
    const text = auslassZusammenfassung([
      { art: "beginnt_spaeter", beginn: "2026-12-01" },
      { art: "zyklus_offen", letzterEinzug: "2026-11-07", wiederAb: "2026-12-05" },
      { art: "zyklus_vorgemerkt", kuenftigerEinzug: "2026-11-25" },
    ]);
    expect(text).toBe("1 Abo beginnt erst später, 2 Abos im selben Zyklus schon eingezogen");
  });

  it("wirft die beiden Zyklus-Gründe zusammen — für den Leser ist es derselbe", () => {
    const text = auslassZusammenfassung([
      { art: "zyklus_offen", letzterEinzug: "2026-11-07", wiederAb: "2026-12-05" },
      { art: "zyklus_vorgemerkt", kuenftigerEinzug: "2026-11-25" },
    ]);
    expect(text).toBe("2 Abos im selben Zyklus schon eingezogen");
  });

  it("bleibt bei nichts leer", () => {
    expect(auslassZusammenfassung([])).toBe("");
  });
});
