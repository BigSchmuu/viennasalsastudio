import { describe, it, expect } from "vitest";
import { buchungsHindernis, type BuchungsZustand } from "./hindernis";

/** Eine Probestunde, bei der alles ausgefüllt ist. */
const probestunde: BuchungsZustand = {
  art: "trial",
  terminGewaehlt: true,
  aboArtGewaehlt: false,
  rolleFehlt: false,
  vorkenntnisseOffen: false,
  herkunftFehlt: false,
  agbAkzeptiert: true,
  hatMandat: false,
  bereitsAngefragt: false,
  bereitsEingeschrieben: false,
  aufWarteliste: false,
};

describe("buchungsHindernis", () => {
  it("gibt nichts zurück, wenn alles beisammen ist", () => {
    expect(buchungsHindernis(probestunde)).toBeNull();
  });

  it("verlangt für Probestunde und Drop-in kein Mandat", () => {
    // Das ist der ganze Sinn dieser beiden Buchungsarten: reinschnuppern,
    // ohne vorher die Bankverbindung herzugeben.
    expect(buchungsHindernis({ ...probestunde, hatMandat: false })).toBeNull();
    expect(buchungsHindernis({ ...probestunde, art: "dropin", hatMandat: false })).toBeNull();
  });

  it("nennt die offene Herkunftsfrage", () => {
    // Der gemeldete Fall: ein vom Admin angelegtes Konto hat kein
    // referral_source, also erscheint die Frage — und sperrte stumm den Knopf.
    expect(buchungsHindernis({ ...probestunde, herkunftFehlt: true })).toBe("herkunft");
  });

  it("nennt das fehlende AGB-Häkchen", () => {
    expect(buchungsHindernis({ ...probestunde, agbAkzeptiert: false })).toBe("agb");
  });

  it("nennt den fehlenden Termin zuerst", () => {
    // Leserichtung: Der Termin steht oben, die Angaben darunter. Ein Hinweis,
    // der ans Ende des Formulars zeigt, während oben noch etwas fehlt, schickt
    // den Leser in die falsche Richtung.
    const nichts = { ...probestunde, terminGewaehlt: false, agbAkzeptiert: false, herkunftFehlt: true };
    expect(buchungsHindernis(nichts)).toBe("termin");
  });

  it("nennt bei der regulären Buchung das fehlende Mandat", () => {
    const regulaer: BuchungsZustand = { ...probestunde, art: "regular", aboArtGewaehlt: true };
    expect(buchungsHindernis({ ...regulaer, hatMandat: false })).toBe("mandat");
    expect(buchungsHindernis({ ...regulaer, hatMandat: true })).toBeNull();
  });

  it("stellt die Gründe, die den ganzen Kurs betreffen, nach vorn", () => {
    // „Du bist schon eingeschrieben" zu melden ist hilfreicher als
    // „bitte Termin wählen", wenn ohnehin nichts mehr zu buchen ist.
    const regulaer: BuchungsZustand = {
      ...probestunde,
      art: "regular",
      hatMandat: true,
      terminGewaehlt: false,
      bereitsEingeschrieben: true,
    };
    expect(buchungsHindernis(regulaer)).toBe("bereitsEingeschrieben");
  });

  it("verlangt die Abo-Art nur bei der regulären Buchung", () => {
    const regulaer: BuchungsZustand = { ...probestunde, art: "regular", hatMandat: true, aboArtGewaehlt: false };
    expect(buchungsHindernis(regulaer)).toBe("aboArt");
    expect(buchungsHindernis({ ...probestunde, aboArtGewaehlt: false })).toBeNull();
  });

  it("nennt Rolle und Vorkenntnisse, wenn der Kurs sie verlangt", () => {
    expect(buchungsHindernis({ ...probestunde, rolleFehlt: true })).toBe("rolle");
    expect(buchungsHindernis({ ...probestunde, vorkenntnisseOffen: true })).toBe("vorkenntnisse");
  });
});
