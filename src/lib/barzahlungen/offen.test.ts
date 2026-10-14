import { describe, it, expect } from "vitest";
import { barzahlerZeilen, offeneSumme, zustandText, type Barzahler } from "./offen";

const EUR = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

function zahler(felder: Partial<Barzahler> = {}): Barzahler {
  return {
    kundeId: "kunde-1",
    kundeName: "Anna Beispiel",
    aboId: "abo-1",
    aboName: "Kursabo",
    betrag: 89,
    istFlatrate: false,
    soll: 0,
    haben: 0,
    letzteZahlung: null,
    ...felder,
  };
}

describe("barzahlerZeilen", () => {
  it("meldet einen fällig gewordenen Beitrag als offen", () => {
    const [zeile] = barzahlerZeilen([zahler({ soll: 89 })]);
    expect(zeile.offen).toBe(true);
    expect(zeile.saldo).toBe(89);
    expect(zeile.teilweise).toBe(false);
  });

  it("gilt als bezahlt, wenn Soll und Haben sich decken", () => {
    const [zeile] = barzahlerZeilen([zahler({ soll: 89, haben: 89, letzteZahlung: "2026-10-14" })]);
    expect(zeile.offen).toBe(false);
    expect(zeile.saldo).toBe(0);
  });

  it("bleibt nach einem Teilbetrag offen — über den Rest", () => {
    const [zeile] = barzahlerZeilen([zahler({ soll: 89, haben: 40, letzteZahlung: "2026-10-14" })]);
    expect(zeile.offen).toBe(true);
    expect(zeile.teilweise).toBe(true);
    expect(zeile.saldo).toBe(49);
  });

  it("addiert den Rest zum nächsten Beitrag — das ist der Kern der Umstellung", () => {
    // Zwei Zyklen fällig (178), bezahlt sind 40.
    const [zeile] = barzahlerZeilen([zahler({ soll: 178, haben: 40 })]);
    expect(zeile.saldo).toBe(138);
    expect(zeile.offen).toBe(true);
  });

  it("macht aus einer Überzahlung ein Guthaben und nicht eine offene Zeile", () => {
    const [zeile] = barzahlerZeilen([zahler({ soll: 89, haben: 178 })]);
    expect(zeile.offen).toBe(false);
    expect(zeile.saldo).toBe(-89);
    expect(zeile.guthaben).toBe(89);
  });

  it("verrechnet ein Guthaben mit dem nächsten Beitrag", () => {
    // Vorausgezahlt, dann wird der nächste Beitrag fällig: wieder bei null.
    const [zeile] = barzahlerZeilen([zahler({ soll: 178, haben: 178 })]);
    expect(zeile.offen).toBe(false);
    expect(zeile.guthaben).toBe(0);
  });

  it("hält einen Rest von einem Cent nicht für offen", () => {
    // 89 in drei Teilen ist nicht glatt teilbar. Ohne Toleranz stünde die Zeile
    // ewig auf „offen" — über 0,004 Euro.
    const [zeile] = barzahlerZeilen([zahler({ soll: 89, haben: 29.67 * 3 })]);
    expect(zeile.offen).toBe(false);
  });

  it("stellt offene nach vorn, den größten Betrag zuerst", () => {
    const zeilen = barzahlerZeilen([
      zahler({ aboId: "a", kundeName: "Bezahlt", soll: 89, haben: 89 }),
      zahler({ aboId: "b", kundeName: "Wenig offen", soll: 89, haben: 60 }),
      zahler({ aboId: "c", kundeName: "Viel offen", soll: 178, haben: 0 }),
    ]);
    expect(zeilen.map((z) => z.aboId)).toEqual(["c", "b", "a"]);
  });

  it("sortiert bei gleichem Betrag nach Namen", () => {
    const zeilen = barzahlerZeilen([
      zahler({ aboId: "b", kundeName: "Zora", soll: 89 }),
      zahler({ aboId: "a", kundeName: "Anton", soll: 89 }),
    ]);
    expect(zeilen.map((z) => z.kundeName)).toEqual(["Anton", "Zora"]);
  });
});

describe("zustandText", () => {
  function text(felder: Partial<Barzahler>): string {
    return zustandText(barzahlerZeilen([zahler(felder)])[0]);
  }

  it("sagt bei einem Abo ohne Preis, dass nichts abzuhaken ist", () => {
    expect(text({ betrag: null, soll: 0 })).toBe("Kein Preis am Abo");
  });

  it("nennt beim Teilbetrag das Bezahlte und das Ganze", () => {
    // Nur „noch 49 € offen" ließe die Lehrkraft den vollen Beitrag verlangen.
    expect(text({ soll: 89, haben: 40 })).toContain("40,00");
    expect(text({ soll: 89, haben: 40 })).toContain("89,00");
  });

  it("nennt den Tag der letzten Zahlung", () => {
    expect(text({ soll: 89, haben: 89, letzteZahlung: "2026-10-14" })).toBe("Bezahlt am 14.10.2026");
  });

  it("nennt ein Guthaben als solches", () => {
    // Mit derselben Formatierung verglichen: de-AT setzt das Zeichen voran und
    // trennt mit einem geschützten Leerzeichen, nicht mit einem gewöhnlichen.
    expect(text({ soll: 89, haben: 150 })).toBe(`Guthaben ${EUR.format(61)}`);
  });

  it("unterscheidet „nichts fällig“ von „bezahlt“", () => {
    // Vor dem ersten Fälligkeitstag ist nichts offen — aber auch nichts bezahlt.
    expect(text({ soll: 0, haben: 0 })).toBe("Nichts fällig");
  });
});

describe("offeneSumme", () => {
  it("zählt nur offene Zeilen und nur deren Rest", () => {
    const zeilen = barzahlerZeilen([
      zahler({ aboId: "a", soll: 89, haben: 40 }),
      zahler({ aboId: "b", soll: 89, haben: 89 }),
      zahler({ aboId: "c", soll: 89, haben: 0 }),
    ]);
    expect(offeneSumme(zeilen)).toBe(138);
  });

  it("lässt ein Guthaben die Summe nicht schmälern", () => {
    // Sonst sammelte die Lehrkraft weniger ein, als die offenen Zeilen ausmachen.
    const zeilen = barzahlerZeilen([
      zahler({ aboId: "a", soll: 89, haben: 0 }),
      zahler({ aboId: "b", soll: 0, haben: 50 }),
    ]);
    expect(offeneSumme(zeilen)).toBe(89);
  });
});
