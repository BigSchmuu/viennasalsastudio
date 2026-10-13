import { describe, it, expect } from "vitest";
import { barzahlerZeilen, offeneSumme, zustandText, type Barzahler } from "./offen";

const HEUTE = "2026-10-13";

function zahler(felder: Partial<Barzahler> = {}): Barzahler {
  return {
    kundeId: "kunde-1",
    kundeName: "Anna Beispiel",
    aboId: "abo-1",
    aboName: "Kursabo",
    betrag: 50,
    istFlatrate: false,
    einzuege: [],
    barzahlungen: [],
    ...felder,
  };
}

describe("barzahlerZeilen", () => {
  it("meldet den ersten Beitrag als offen — er wartet auf nichts", () => {
    const [zeile] = barzahlerZeilen([zahler()], HEUTE, []);
    expect(zeile.offen).toBe(true);
    expect(zeile.letzteBarzahlung).toBeNull();
  });

  it("gilt als bezahlt, solange der Zyklus läuft", () => {
    // Vor zehn Tagen bezahlt: vier Wochen sind nicht um.
    const [zeile] = barzahlerZeilen([zahler({ barzahlungen: ["2026-10-03"] })], HEUTE, []);
    expect(zeile.offen).toBe(false);
    expect(zeile.letzteBarzahlung).toBe("2026-10-03");
  });

  it("ist nach vier Wochen wieder offen", () => {
    const [zeile] = barzahlerZeilen([zahler({ barzahlungen: ["2026-09-15"] })], HEUTE, []);
    expect(zeile.offen).toBe(true);
  });

  // Ferien verlängern den Zyklus — dieselbe Regel wie beim Einzug.
  it("verschiebt die Fälligkeit um Ferientage nach hinten", () => {
    const ferien = [{ von: "2026-09-21", bis: "2026-09-27" }];
    const [ohneFerien] = barzahlerZeilen([zahler({ barzahlungen: ["2026-09-15"] })], HEUTE, []);
    const [mitFerien] = barzahlerZeilen([zahler({ barzahlungen: ["2026-09-15"] })], HEUTE, ferien);
    expect(ohneFerien.offen).toBe(true);
    expect(mitFerien.offen).toBe(false);
  });

  // Wer eingezogen wurde und dann sein Mandat widerruft, hat den Zyklus bezahlt
  // — egal auf welchem Weg.
  it("rechnet Einzüge und Barzahlungen zusammen", () => {
    const [zeile] = barzahlerZeilen([zahler({ einzuege: ["2026-10-05"] })], HEUTE, []);
    expect(zeile.offen).toBe(false);
    expect(zeile.letzteBarzahlung).toBeNull();
  });

  it("nimmt die jüngste Barzahlung, nicht die erste", () => {
    const [zeile] = barzahlerZeilen(
      [zahler({ barzahlungen: ["2026-08-01", "2026-10-03", "2026-09-01"] })],
      HEUTE,
      []
    );
    expect(zeile.letzteBarzahlung).toBe("2026-10-03");
  });

  // Das ist die Arbeit des Abends.
  it("stellt offene nach vorn, dann nach Namen", () => {
    const zeilen = barzahlerZeilen(
      [
        zahler({ aboId: "bezahlt-z", kundeName: "Zoe", barzahlungen: ["2026-10-03"] }),
        zahler({ aboId: "offen-m", kundeName: "Moritz" }),
        zahler({ aboId: "bezahlt-a", kundeName: "Anna", barzahlungen: ["2026-10-03"] }),
        zahler({ aboId: "offen-b", kundeName: "Bert" }),
      ],
      HEUTE,
      []
    );
    expect(zeilen.map((z) => z.aboId)).toEqual(["offen-b", "offen-m", "bezahlt-a", "bezahlt-z"]);
  });

  it("kommt ohne Barzahler zurecht", () => {
    expect(barzahlerZeilen([], HEUTE, [])).toEqual([]);
  });
});

describe("zustandText", () => {
  const [offen] = barzahlerZeilen([zahler()], HEUTE, []);
  const [bezahlt] = barzahlerZeilen([zahler({ barzahlungen: ["2026-10-03"] })], HEUTE, []);
  const [durchEinzug] = barzahlerZeilen([zahler({ einzuege: ["2026-10-05"] })], HEUTE, []);

  it("nennt offen, bezahlt mit Datum und den Einzug", () => {
    expect(zustandText(offen)).toBe("Offen");
    expect(zustandText(bezahlt)).toBe("Bezahlt am 03.10.2026");
    expect(zustandText(durchEinzug)).toBe("Durch Einzug gedeckt");
  });

  // Einen Knopf anzubieten, der nichts bewirken kann, wäre schlimmer als der
  // Hinweis.
  it("sagt es, wenn am Abo kein Preis steht", () => {
    const [ohnePreis] = barzahlerZeilen([zahler({ betrag: null })], HEUTE, []);
    expect(zustandText(ohnePreis)).toBe("Kein Preis am Abo");
    const [nullPreis] = barzahlerZeilen([zahler({ betrag: 0 })], HEUTE, []);
    expect(zustandText(nullPreis)).toBe("Kein Preis am Abo");
  });
});

describe("offeneSumme", () => {
  it("zählt nur die offenen Beträge", () => {
    const zeilen = barzahlerZeilen(
      [
        zahler({ aboId: "a", betrag: 50 }),
        zahler({ aboId: "b", betrag: 80 }),
        zahler({ aboId: "c", betrag: 50, barzahlungen: ["2026-10-03"] }),
      ],
      HEUTE,
      []
    );
    expect(offeneSumme(zeilen)).toBe(130);
  });

  it("verträgt ein Abo ohne Preis", () => {
    const zeilen = barzahlerZeilen([zahler({ betrag: null })], HEUTE, []);
    expect(offeneSumme(zeilen)).toBe(0);
  });

  it("ist null, wenn alles bezahlt ist", () => {
    const zeilen = barzahlerZeilen([zahler({ barzahlungen: ["2026-10-03"] })], HEUTE, []);
    expect(offeneSumme(zeilen)).toBe(0);
  });
});
