import { describe, it, expect } from "vitest";
import { ferientageZwischen, istFaellig, naechsteFaelligkeit, ZYKLUS_TAGE } from "./faelligkeit";

const KEINE_FERIEN: { von: string; bis: string }[] = [];

describe("PROJ-70: Der Abstand zwischen zwei Einzügen", () => {
  it("sind vier Wochen, wenn nichts dazwischenkommt", () => {
    expect(naechsteFaelligkeit("2026-09-01", KEINE_FERIEN)).toBe("2026-09-29");
    expect(ZYKLUS_TAGE).toBe(28);
  });

  it("verschiebt sich um eine Ferienwoche", () => {
    // Sieben Ferientage im Fenster: aus dem 29.09. wird der 06.10.
    const ferien = [{ von: "2026-09-07", bis: "2026-09-13" }];
    expect(naechsteFaelligkeit("2026-09-01", ferien)).toBe("2026-10-06");
  });

  it("zählt nur die Ferientage, die wirklich im Fenster liegen", () => {
    // Die Ferien beginnen erst nach dem Fenster — sie verschieben nichts.
    const ferien = [{ von: "2026-10-05", bis: "2026-10-11" }];
    expect(naechsteFaelligkeit("2026-09-01", ferien)).toBe("2026-09-29");
  });

  it("rechnet nach, wenn die Verschiebung in weitere Ferien läuft", () => {
    // Erste Woche schiebt den Termin in die zweite Ferienwoche hinein — die
    // muss dann ebenfalls zählen, sonst wäre nur die halbe Schließung
    // berücksichtigt.
    const ferien = [
      { von: "2026-09-07", bis: "2026-09-13" },
      { von: "2026-10-01", bis: "2026-10-07" },
    ];
    // 28 Tage + 7 (erste Woche) = 06.10.; darin liegen 6 weitere Ferientage
    // (01.-06.10.) → 12.10., darin der siebte → 13.10.
    expect(naechsteFaelligkeit("2026-09-01", ferien)).toBe("2026-10-13");
  });

  it("zählt den Tag des letzten Einzugs nicht mit", () => {
    // Fielen die Ferien genau auf den Einzugstag, wäre das kein verlorener
    // Kurstag mehr — er ist ja schon abgerechnet.
    const ferien = [{ von: "2026-09-01", bis: "2026-09-01" }];
    expect(naechsteFaelligkeit("2026-09-01", ferien)).toBe("2026-09-29");
  });

  it("nimmt auch teilweise überlappende Ferien nur anteilig", () => {
    // Ferien vom 27.09. bis 03.10., Fenster endet am 29.09. → 3 Tage drin.
    const ferien = [{ von: "2026-09-27", bis: "2026-10-03" }];
    expect(ferientageZwischen("2026-09-01", "2026-09-29", ferien)).toBe(3);
  });
});

describe("PROJ-70: Darf dieses Abo in den Lauf?", () => {
  it("ja, wenn es noch nie eingezogen wurde", () => {
    expect(istFaellig("2026-09-01", null, KEINE_FERIEN)).toBe(true);
    expect(istFaellig("2026-09-01", undefined, KEINE_FERIEN)).toBe(true);
  });

  it("nein, wenn der letzte Einzug noch keine vier Wochen her ist", () => {
    // Genau der gemeldete Fall: zweiter Lauf im selben Monat.
    expect(istFaellig("2026-09-20", "2026-09-01", KEINE_FERIEN)).toBe(false);
  });

  it("ja, sobald der Abstand erreicht ist", () => {
    expect(istFaellig("2026-09-29", "2026-09-01", KEINE_FERIEN)).toBe(true);
    expect(istFaellig("2026-09-30", "2026-09-01", KEINE_FERIEN)).toBe(true);
  });

  it("nein, wenn eine Ferienwoche den Abstand verlängert", () => {
    const ferien = [{ von: "2026-09-07", bis: "2026-09-13" }];
    expect(istFaellig("2026-09-29", "2026-09-01", ferien)).toBe(false);
    expect(istFaellig("2026-10-06", "2026-09-01", ferien)).toBe(true);
  });

  it("lässt einen Lauf am selben Tag nicht doppelt zu", () => {
    expect(istFaellig("2026-09-01", "2026-09-01", KEINE_FERIEN)).toBe(false);
  });

  it("stört sich nicht an einem Einzug, der weit in der Zukunft liegt", () => {
    // Ein erster Entwurf verglich nur mit dem jüngsten Einzug. In der
    // Testdatenbank liegt ein Lauf im Jahr 2028 — dagegen war jeder Lauf
    // davor „zu früh", und kein Abo kam mehr in einen Lauf.
    expect(istFaellig("2026-12-15", ["2028-01-15"], KEINE_FERIEN)).toBe(true);
  });

  it("prüft gegen alle Einzüge, nicht nur den letzten", () => {
    // Der Lauf am 20.09. kollidiert mit dem vom 01.09., auch wenn danach noch
    // ein viel späterer folgt.
    expect(istFaellig("2026-09-20", ["2026-09-01", "2028-01-15"], KEINE_FERIEN)).toBe(false);
  });

  it("erlaubt einen Lauf zwischen zwei weit entfernten Einzügen", () => {
    expect(istFaellig("2026-11-01", ["2026-09-01", "2027-06-01"], KEINE_FERIEN)).toBe(true);
  });

  it("nimmt eine leere Liste wie „noch nie eingezogen“", () => {
    expect(istFaellig("2026-09-20", [], KEINE_FERIEN)).toBe(true);
  });
});
