import { describe, it, expect } from "vitest";
import {
  eintragsZeilen,
  offeneSumme,
  teileNachKurs,
  zustandText,
  type Eintrag,
} from "./offen";

const EUR = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

function eintrag(felder: Partial<Eintrag> = {}): Eintrag {
  return {
    eintragId: "eintrag-1",
    kundeId: "kunde-1",
    kundeName: "Anna Beispiel",
    aboId: "abo-1",
    aboName: "Salsa Mittwoch",
    istFlatrate: false,
    betrag: 89,
    bezahlt: 0,
    letzteZahlung: null,
    letzteZahlungId: null,
    notiz: null,
    eigenerKurs: true,
    ...felder,
  };
}

describe("eintragsZeilen", () => {
  it("meldet einen frischen Eintrag als offen über den ganzen Betrag", () => {
    const [zeile] = eintragsZeilen([eintrag()]);
    expect(zeile.istOffen).toBe(true);
    expect(zeile.offen).toBe(89);
    expect(zeile.teilweise).toBe(false);
  });

  it("bleibt nach einem Teilbetrag offen — über den Rest", () => {
    const [zeile] = eintragsZeilen([eintrag({ bezahlt: 40 })]);
    expect(zeile.offen).toBe(49);
    expect(zeile.teilweise).toBe(true);
  });

  it("gilt als bezahlt, wenn der Betrag voll da ist", () => {
    const [zeile] = eintragsZeilen([eintrag({ bezahlt: 89, letzteZahlung: "2026-10-14" })]);
    expect(zeile.istOffen).toBe(false);
    expect(zeile.offen).toBe(0);
  });

  it("hält einen Rest von einem Cent nicht für offen", () => {
    // 89 in drei Teilen ist nicht glatt teilbar. Ohne Toleranz stünde die Zeile
    // ewig auf „offen" — über 0,004 Euro.
    const [zeile] = eintragsZeilen([eintrag({ bezahlt: 29.67 * 3 })]);
    expect(zeile.istOffen).toBe(false);
  });

  it("stellt offene nach vorn, den größten Betrag zuerst", () => {
    const zeilen = eintragsZeilen([
      eintrag({ eintragId: "a", kundeName: "Bezahlt", bezahlt: 89 }),
      eintrag({ eintragId: "b", kundeName: "Wenig offen", bezahlt: 60 }),
      eintrag({ eintragId: "c", kundeName: "Viel offen", betrag: 178 }),
    ]);
    expect(zeilen.map((z) => z.eintragId)).toEqual(["c", "b", "a"]);
  });

  it("sortiert bei gleichem Betrag nach Namen", () => {
    const zeilen = eintragsZeilen([
      eintrag({ eintragId: "b", kundeName: "Zora" }),
      eintrag({ eintragId: "a", kundeName: "Anton" }),
    ]);
    expect(zeilen.map((z) => z.kundeName)).toEqual(["Anton", "Zora"]);
  });
});

describe("zustandText", () => {
  function text(felder: Partial<Eintrag>): string {
    return zustandText(eintragsZeilen([eintrag(felder)])[0]);
  }

  it("sagt „Offen“, solange nichts da ist", () => {
    expect(text({})).toBe("Offen");
  });

  it("nennt beim Teilbetrag das Bezahlte und das Ganze", () => {
    // Nur „noch 49 € offen" ließe die Lehrkraft den vollen Betrag verlangen.
    const gesagt = text({ bezahlt: 40 });
    expect(gesagt).toContain(EUR.format(40));
    expect(gesagt).toContain(EUR.format(89));
  });

  it("nennt den Tag der letzten Zahlung", () => {
    expect(text({ bezahlt: 89, letzteZahlung: "2026-10-14" })).toBe("Bezahlt am 14.10.2026");
  });

  it("sagt auch ohne Tag, dass bezahlt ist", () => {
    // Kommt vor, wenn die Zahlung über den Dienstschlüssel angelegt wurde.
    expect(text({ bezahlt: 89 })).toBe("Bezahlt");
  });
});

describe("teileNachKurs", () => {
  it("trennt die Teilnehmer dieses Kurses von den übrigen Flatratern", () => {
    const zeilen = eintragsZeilen([
      eintrag({ eintragId: "eigen", eigenerKurs: true }),
      eintrag({ eintragId: "fremd", eigenerKurs: false, istFlatrate: true }),
    ]);
    const { eigene, fremde } = teileNachKurs(zeilen);
    expect(eigene.map((z) => z.eintragId)).toEqual(["eigen"]);
    expect(fremde.map((z) => z.eintragId)).toEqual(["fremd"]);
  });

  it("zählt einen Flatrater dieses Kurses zu den eigenen — nicht doppelt", () => {
    // Sonst stünde er oben **und** im eingeklappten Teil.
    const zeilen = eintragsZeilen([
      eintrag({ eintragId: "flat", istFlatrate: true, eigenerKurs: true }),
    ]);
    const { eigene, fremde } = teileNachKurs(zeilen);
    expect(eigene).toHaveLength(1);
    expect(fremde).toHaveLength(0);
  });
});

describe("offeneSumme", () => {
  it("zählt nur offene Zeilen und nur deren Rest", () => {
    const zeilen = eintragsZeilen([
      eintrag({ eintragId: "a", bezahlt: 40 }),
      eintrag({ eintragId: "b", bezahlt: 89 }),
      eintrag({ eintragId: "c" }),
    ]);
    expect(offeneSumme(zeilen)).toBe(138);
  });

  it("ist null, wenn alles bezahlt ist", () => {
    const zeilen = eintragsZeilen([eintrag({ bezahlt: 89 })]);
    expect(offeneSumme(zeilen)).toBe(0);
  });
});
