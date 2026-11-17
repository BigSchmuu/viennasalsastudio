import { describe, it, expect } from "vitest";
import {
  auslassGrund,
  auslassText,
  auslassZusammenfassung,
  istDatenfehler,
  type AboZumPruefen,
  type Zyklus,
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

/**
 * PROJ-107: Die Sperre hängt am Zyklus, nicht am Abstand.
 *
 * Gerechnet wird mit dem echten ersten Zyklus des Studios: 30.11.2026 bis
 * 10.01.2027 — vier Kurswochen plus zwei Wochen Weihnachtspause, also 42
 * Kalendertage. Gerade dieser Zyklus zeigt beide Richtungen des Unterschieds:
 * Er ist länger als vier Wochen (die alte Regel würde zu früh freigeben) und
 * der Einzug für den Zyklus davor liegt zwölf Tage vor seinem Beginn (die alte
 * Regel würde zu lange sperren).
 */
describe("PROJ-107: Ein Einzug je Abo je Zyklus", () => {
  const ZYKLUS1: Zyklus = { id: "z1", von: "2026-11-30", bis: "2027-01-10" };
  const BEGINN = "2026-11-30";

  it("sperrt, wenn in diesem Zyklus schon eingezogen wurde", () => {
    const grund = auslassGrund(
      abo(),
      "2026-12-07",
      [{ faellig: BEGINN, zyklusId: "z1" }],
      KEINE_FERIEN,
      ZYKLUS1
    );
    expect(grund).toEqual({ art: "zyklus_eingezogen", am: BEGINN, zyklusBis: "2027-01-10" });
  });

  it("lässt den Umstieg zu: der Einzug davor liegt im vorigen Zeitraum", () => {
    // Der Lauf zum 18.11.2026 hat den laufenden Zyklus bezahlt, zwölf Tage vor
    // dem 30.11. Mit Zyklus ist das Abo fällig — ohne Zyklus nicht.
    const einzuege = [{ faellig: "2026-11-18", zyklusId: null }];

    expect(auslassGrund(abo(), BEGINN, einzuege, KEINE_FERIEN, ZYKLUS1)).toBeNull();

    const ohneZyklus = auslassGrund(abo(), BEGINN, einzuege, KEINE_FERIEN);
    expect(ohneZyklus).toMatchObject({ art: "zyklus_offen", letzterEinzug: "2026-11-18" });
  });

  it("sperrt den ganzen langen Zyklus, auch nach mehr als vier Wochen", () => {
    // 36 Tage nach dem Einzug, aber noch im selben Zyklus. Die alte Regel
    // hätte hier freigegeben und damit zweimal für dieselbe Zeit abgebucht.
    const einzuege = [{ faellig: BEGINN, zyklusId: "z1" }];

    expect(auslassGrund(abo(), "2027-01-05", einzuege, KEINE_FERIEN, ZYKLUS1)).toMatchObject({
      art: "zyklus_eingezogen",
    });
    expect(auslassGrund(abo(), "2027-01-05", einzuege, KEINE_FERIEN)).toBeNull();
  });

  it("rechnet einen Lauf ohne Zyklus mit, wenn sein Tag im Zeitraum liegt", () => {
    // Ein Entwurf aus der Zeit vor der Umstellung, mitten im neuen Zyklus.
    // Ihn zu übergehen wäre ein Doppeleinzug.
    const grund = auslassGrund(
      abo(),
      "2026-12-28",
      [{ faellig: "2026-12-14", zyklusId: null }],
      KEINE_FERIEN,
      ZYKLUS1
    );
    expect(grund).toMatchObject({ art: "zyklus_eingezogen", am: "2026-12-14" });
  });

  it("übergeht einen Einzug aus einem anderen Zyklus", () => {
    const grund = auslassGrund(
      abo(),
      "2026-12-07",
      [{ faellig: "2027-02-01", zyklusId: "z2" }],
      KEINE_FERIEN,
      ZYKLUS1
    );
    expect(grund).toBeNull();
  });

  it("nennt den frühesten Einzug des Zyklus, nicht den letzten", () => {
    const grund = auslassGrund(
      abo(),
      "2026-12-28",
      [
        { faellig: "2026-12-14", zyklusId: "z1" },
        { faellig: BEGINN, zyklusId: "z1" },
      ],
      KEINE_FERIEN,
      ZYKLUS1
    );
    expect(grund).toMatchObject({ art: "zyklus_eingezogen", am: BEGINN });
  });

  it("stellt eine wirksame Kündigung vor den Zyklus", () => {
    const grund = auslassGrund(
      abo({ pending_status: "cancelled", pending_effective_date: "2026-12-01" }),
      "2026-12-07",
      [{ faellig: BEGINN, zyklusId: "z1" }],
      KEINE_FERIEN,
      ZYKLUS1
    );
    expect(grund).toMatchObject({ art: "aenderung_wirkt" });
  });

  it("stellt den Zyklus vor den fehlenden Preis", () => {
    const grund = auslassGrund(
      abo({ price: null }),
      "2026-12-07",
      [{ faellig: BEGINN, zyklusId: "z1" }],
      KEINE_FERIEN,
      ZYKLUS1
    );
    expect(grund).toMatchObject({ art: "zyklus_eingezogen" });
  });

  it("nennt im Satz den Einzug und das Ende des Zyklus", () => {
    const text = auslassText({
      art: "zyklus_eingezogen",
      am: BEGINN,
      zyklusBis: "2027-01-10",
    });
    expect(text).toBe(
      "In diesem Zyklus schon eingezogen am 30.11.2026 — der Zyklus läuft bis 10.1.2027."
    );
  });

  it("hält den neuen Grund nicht für einen Datenfehler", () => {
    expect(istDatenfehler({ art: "zyklus_eingezogen", am: BEGINN, zyklusBis: "2027-01-10" })).toBe(
      false
    );
  });

  it("fasst den neuen Grund in der Zusammenfassung mit", () => {
    const text = auslassZusammenfassung([
      { art: "zyklus_eingezogen", am: BEGINN, zyklusBis: "2027-01-10" },
      { art: "zyklus_eingezogen", am: BEGINN, zyklusBis: "2027-01-10" },
    ]);
    expect(text).toBe("2 Abos in diesem Zyklus schon eingezogen");
  });
});
