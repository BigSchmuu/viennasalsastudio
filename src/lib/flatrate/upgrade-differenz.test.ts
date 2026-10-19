import { describe, it, expect } from "vitest";
import { nichtAngerechnet, vorgeschlageneDifferenz } from "./upgrade-differenz";

describe("vorgeschlageneDifferenz", () => {
  // Der Fall aus dem Betrieb (2026-10-19): zwei Abos à 65, nichts eingezogen,
  // Mandat vorhanden. Vorgeschlagen wurden 145, abgebucht 290.
  it("ist null, wenn der nächste Lauf den Zyklus ohnehin voll abbucht", () => {
    expect(
      vorgeschlageneDifferenz({ preis: 145, angerechnet: 0, zyklusWirdAbgebucht: true })
    ).toBe(0);
  });

  it("ist der Aufpreis, wenn der Zyklus schon zum alten Preis abgebucht ist", () => {
    expect(
      vorgeschlageneDifferenz({ preis: 145, angerechnet: 65, zyklusWirdAbgebucht: false })
    ).toBe(80);
  });

  // Zwei Abos einzeln gezahlt: Beides ist schon da (PROJ-88).
  it("rechnet gegen die Summe aller Einzüge des Zyklus", () => {
    expect(
      vorgeschlageneDifferenz({ preis: 145, angerechnet: 130, zyklusWirdAbgebucht: false })
    ).toBe(15);
  });

  // Ein Barzahler hat kein Mandat und bekommt keine Position. Bei ihm ist die
  // ganze Differenz richtig — sie ist der Weg in die Barzahler-Übersicht.
  it("bleibt bei der ganzen Differenz, wenn keine Abbuchung kommt", () => {
    expect(
      vorgeschlageneDifferenz({ preis: 145, angerechnet: 0, zyklusWirdAbgebucht: false })
    ).toBe(145);
  });

  it("wird nie negativ", () => {
    expect(
      vorgeschlageneDifferenz({ preis: 145, angerechnet: 200, zyklusWirdAbgebucht: false })
    ).toBe(0);
  });

  it("ist null, solange der Flatrate-Preis fehlt", () => {
    expect(
      vorgeschlageneDifferenz({ preis: null, angerechnet: 65, zyklusWirdAbgebucht: false })
    ).toBe(0);
  });

  it("rundet auf Cent", () => {
    expect(
      vorgeschlageneDifferenz({ preis: 145.1, angerechnet: 64.55, zyklusWirdAbgebucht: false })
    ).toBe(80.55);
  });
});

describe("nichtAngerechnet", () => {
  // Für ein Abo, das mit dem Upgrade endet, wurden 65 abgebucht; das upgradete
  // steht noch aus. Der Lauf bucht 145, die 65 liegen daneben.
  it("nennt das Geld, das neben der vollen Abbuchung liegt", () => {
    expect(nichtAngerechnet({ preis: 145, angerechnet: 65, zyklusWirdAbgebucht: true })).toBe(65);
  });

  it("schweigt, wenn die Differenz das Eingegangene ohnehin verrechnet", () => {
    expect(nichtAngerechnet({ preis: 145, angerechnet: 65, zyklusWirdAbgebucht: false })).toBe(0);
  });

  it("schweigt, wenn nichts eingegangen ist", () => {
    expect(nichtAngerechnet({ preis: 145, angerechnet: 0, zyklusWirdAbgebucht: true })).toBe(0);
  });
});
