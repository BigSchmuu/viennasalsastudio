import { describe, it, expect } from "vitest";
import {
  STAPEL_MAX,
  brauchtAbo,
  istAuswaehlbar,
  rabattierterPreis,
  stapelBericht,
  stapelHindernis,
  vorschlagFuer,
  type VorschlagsBuchung,
} from "./stapel";

const basis: VorschlagsBuchung = {
  id: "b1",
  type: "regular",
  status: "open",
  courseName: "Salsa Level 2",
  price: 65,
  coursePrice: 70,
  coupon: null,
};

describe("PROJ-48: rabattierterPreis", () => {
  it("zieht Prozente ab", () => {
    expect(rabattierterPreis(65, { code: "X", discountType: "percent", discountAmount: 20 })).toBe(52);
  });

  it("zieht feste Beträge ab", () => {
    expect(rabattierterPreis(65, { code: "X", discountType: "fixed", discountAmount: 15 })).toBe(50);
  });

  it("fällt nie unter null", () => {
    // Ein Gutschein über mehr als den Preis ergibt kein negatives Abo.
    expect(rabattierterPreis(20, { code: "X", discountType: "fixed", discountAmount: 50 })).toBe(0);
  });

  it("rundet auf Cent", () => {
    expect(rabattierterPreis(65, { code: "X", discountType: "percent", discountAmount: 33 })).toBe(43.55);
  });
});

describe("PROJ-48: vorschlagFuer", () => {
  it("nimmt den bei der Anfrage gezeigten Preis, nicht den heutigen Kurspreis", () => {
    // Eine spätere Preisänderung am Kurs darf den Vorschlag nicht verschieben.
    expect(vorschlagFuer(basis).preis).toBe(65);
  });

  it("fällt auf den Kurspreis zurück, wenn die Anfrage keinen trägt", () => {
    expect(vorschlagFuer({ ...basis, price: null }).preis).toBe(70);
  });

  it("schlägt den Kursnamen als Abo-Namen vor", () => {
    expect(vorschlagFuer(basis).aboName).toBe("Salsa Level 2");
  });

  it("rechnet einen Gutschein ein und weist ihn aus", () => {
    const vorschlag = vorschlagFuer({
      ...basis,
      coupon: { code: "SOMMER20", discountType: "percent", discountAmount: 20 },
    });
    expect(vorschlag.preis).toBe(52);
    expect(vorschlag.gutscheinCode).toBe("SOMMER20");
  });

  it("liefert null statt einer Null, wenn gar kein Preis zu ermitteln ist", () => {
    // Ein Abo über 0 EUR bucht jeden Monat nichts ab und faellt niemandem auf.
    const vorschlag = vorschlagFuer({ ...basis, price: null, coursePrice: null });
    expect(vorschlag.preis).toBeNull();
  });

  it("behält einen echten Preis von 0 als 0", () => {
    expect(vorschlagFuer({ ...basis, price: 0 }).preis).toBe(0);
  });
});

describe("PROJ-48: istAuswaehlbar", () => {
  it("erlaubt nur offene Buchungen", () => {
    expect(istAuswaehlbar({ status: "open" })).toBe(true);
    for (const status of ["confirmed", "rejected", "cancelled"]) {
      expect(istAuswaehlbar({ status })).toBe(false);
    }
  });
});

describe("PROJ-48: brauchtAbo", () => {
  it("gilt für Buchungsanfragen, nicht für Drop-ins", () => {
    expect(brauchtAbo({ type: "regular" })).toBe(true);
    expect(brauchtAbo({ type: "dropin" })).toBe(false);
    expect(brauchtAbo({ type: "trial" })).toBe(false);
  });
});

describe("PROJ-48: stapelHindernis", () => {
  it("nennt kein Hindernis bei einem gewöhnlichen Stapel", () => {
    expect(stapelHindernis({ anzahl: 5, ohnePreis: 0 })).toBeNull();
  });

  it("verhindert den leeren Stapel", () => {
    expect(stapelHindernis({ anzahl: 0, ohnePreis: 0 })).toBe("leer");
  });

  it("lässt genau die Obergrenze zu, erst darüber nicht mehr", () => {
    expect(stapelHindernis({ anzahl: STAPEL_MAX, ohnePreis: 0 })).toBeNull();
    expect(stapelHindernis({ anzahl: STAPEL_MAX + 1, ohnePreis: 0 })).toBe("zu_gross");
  });

  it("verhindert den Stapel, sobald einer Buchung der Preis fehlt", () => {
    expect(stapelHindernis({ anzahl: 5, ohnePreis: 1 })).toBe("preis_fehlt");
  });

  it("nennt die Größe vor dem fehlenden Preis", () => {
    // Ein zu großer Stapel ist das gröbere Problem und zuerst zu beheben.
    expect(stapelHindernis({ anzahl: STAPEL_MAX + 1, ohnePreis: 3 })).toBe("zu_gross");
  });
});

describe("PROJ-48: stapelBericht", () => {
  it("meldet den glatten Fall ohne Zusatz", () => {
    expect(stapelBericht({ erledigt: 3, uebersprungen: [] }, "bestätigt")).toBe("3 Buchungen bestätigt.");
  });

  it("nennt die Einzahl in der Einzahl", () => {
    expect(stapelBericht({ erledigt: 1, uebersprungen: [] }, "abgelehnt")).toBe("1 Buchung abgelehnt.");
  });

  it("verschweigt Übersprungenes nicht", () => {
    const bericht = stapelBericht(
      { erledigt: 2, uebersprungen: [{ buchungId: "x", kundenname: "A", grund: "nicht mehr offen" }] },
      "bestätigt"
    );
    expect(bericht).toBe("2 Buchungen bestätigt, 1 übersprungen.");
  });

  it("meldet keinen Erfolg, wenn alles scheiterte", () => {
    const bericht = stapelBericht(
      {
        erledigt: 0,
        uebersprungen: [
          { buchungId: "x", kundenname: "A", grund: "nicht mehr offen" },
          { buchungId: "y", kundenname: "B", grund: "nicht mehr offen" },
        ],
      },
      "bestätigt"
    );
    expect(bericht).toBe("Keine Buchung bestätigt — 2 übersprungen.");
  });
});
