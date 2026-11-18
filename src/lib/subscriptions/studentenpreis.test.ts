import { describe, it, expect } from "vitest";
import {
  ZYKLUS_TAGE,
  umstellungAusZyklen,
  lohntUmstellung,
  umstellungsDatum,
  zuAltAm,
} from "./studentenpreis";

describe("umstellungsDatum", () => {
  it("nimmt das nächste Zyklusende, wenn ein voller Zyklus Vorlauf bleibt", () => {
    // Heute ist der erste Tag des Zyklus: genau 28 Tage bis zum Ende.
    expect(umstellungsDatum("2026-12-14", "2026-11-16")).toBe("2026-12-14");
  });

  it("geht einen Zyklus weiter, wenn der Vorlauf nicht reicht", () => {
    // Nur noch 13 Tage: Eine Kündigung käme zu spät, um den neuen Beitrag zu
    // vermeiden. Dann lieber einen Zyklus später — versprochen ist ein voller.
    expect(umstellungsDatum("2026-11-29", "2026-11-16")).toBe("2026-12-27");
  });

  it("ist an der Grenze eindeutig", () => {
    // Genau 28 Tage reichen; 27 nicht.
    expect(umstellungsDatum("2026-12-14", "2026-11-16")).toBe("2026-12-14");
    expect(umstellungsDatum("2026-12-13", "2026-11-16")).toBe("2027-01-10");
  });

  it("rechnet über den Monats- und Jahreswechsel", () => {
    expect(umstellungsDatum("2026-12-20", "2026-12-19")).toBe("2027-01-17");
    expect(umstellungsDatum("2027-01-15", "2026-12-18")).toBe("2027-01-15");
  });

  it("hält den Zyklus an einer Stelle", () => {
    expect(ZYKLUS_TAGE).toBe(28);
  });
});

describe("zuAltAm", () => {
  it("fragt nach dem Alter am Umstellungstag, nicht nach dem heutigen", () => {
    // Geburtstag zwischen Ankündigung und Umstellung: Genau dieser Fall ist
    // der Anlass der ganzen Mechanik.
    expect(zuAltAm("1998-12-01", "2026-11-16")).toBe(false);
    expect(zuAltAm("1998-12-01", "2026-12-14")).toBe(true);
  });

  it("lässt 27 in Ruhe und greift ab 28", () => {
    expect(zuAltAm("1999-06-15", "2026-12-14")).toBe(false);
    expect(zuAltAm("1998-06-15", "2026-12-14")).toBe(true);
  });

  it("sagt nein, wo kein Geburtsdatum steht", () => {
    // Ohne Datum passiert nichts — keine stille Erhöhung.
    expect(zuAltAm(null, "2026-12-14")).toBe(false);
    expect(zuAltAm("", "2026-12-14")).toBe(false);
    expect(zuAltAm(undefined, "2026-12-14")).toBe(false);
  });

  it("kommt mit dem 29. Februar zurecht", () => {
    expect(zuAltAm("2000-02-29", "2028-02-28")).toBe(false);
    expect(zuAltAm("2000-02-29", "2028-02-29")).toBe(true);
  });
});

describe("lohntUmstellung", () => {
  it("ja, wenn der Normalpreis höher ist", () => {
    expect(lohntUmstellung(45, 60)).toBe(true);
  });

  it("nein, wenn nichts zu erhöhen ist", () => {
    // Der Rettungsanker für ein ungenaues Kennzeichen: Hat die Verwaltung das
    // Abo ohnehin zum Normalpreis bestätigt, passiert nichts — keine
    // Ankündigung, keine Mail.
    expect(lohntUmstellung(60, 60)).toBe(false);
    expect(lohntUmstellung(70, 60)).toBe(false);
  });

  it("nein bei fehlenden Zahlen", () => {
    expect(lohntUmstellung(null, 60)).toBe(false);
    expect(lohntUmstellung(45, null)).toBe(false);
    expect(lohntUmstellung(null, null)).toBe(false);
  });

  it("zählt einen halben Cent nicht als Erhöhung", () => {
    expect(lohntUmstellung(60, 60.004)).toBe(false);
    expect(lohntUmstellung(60, 60.01)).toBe(true);
  });
});

describe("PROJ-107: Der Umstellungstag kommt aus den eingetragenen Zyklen", () => {
  /** Die echte Lage des Studios: 42 Tage, weil die Weihnachtspause darin liegt. */
  const ZYKLEN = [
    { von: "2026-11-30", bis: "2027-01-10" },
    { von: "2027-01-11", bis: "2027-02-07" },
    { von: "2027-02-08", bis: "2027-03-07" },
  ];

  it("nennt den Beginn des nächsten Zyklus", () => {
    expect(umstellungAusZyklen(ZYKLEN, "2026-12-01")).toBe("2027-01-11");
  });

  it("geht einen Zyklus weiter, wenn der Vorlauf nicht reicht", () => {
    // Vier Tage vor dem Zyklusende: Der nächste Beginn liegt zu nah, also
    // beginnt der neue Preis erst mit dem übernächsten Zyklus.
    expect(umstellungAusZyklen(ZYKLEN, "2027-01-07")).toBe("2027-02-08");
  });

  it("nimmt den nächsten Beginn, sobald der Vorlauf genau reicht", () => {
    // Genau 28 Tage vor dem 11.01. — die Zusage ist eingehalten.
    expect(umstellungAusZyklen(ZYKLEN, "2026-12-14")).toBe("2027-01-11");
    expect(umstellungAusZyklen(ZYKLEN, "2026-12-15")).toBe("2027-02-08");
  });

  it("gibt für alle Abos denselben Tag — das ist der Zweck", () => {
    // Bis PROJ-107 hing der Tag am Ankerdatum des einzelnen Abos. Jetzt gibt
    // es nur noch einen, und er hängt an nichts am Abo.
    expect(umstellungAusZyklen(ZYKLEN, "2026-12-01")).toBe(
      umstellungAusZyklen(ZYKLEN, "2026-12-02")
    );
  });

  it("rechnet die Weihnachtspause mit, weil sie im Zyklus steht", () => {
    // Der laufende Zyklus ist 42 Tage lang. Die alte Rechnung kannte nur 28
    // und hätte zwei Wochen zu früh umgestellt — mitten in den Zyklus hinein.
    const ende = umstellungAusZyklen(ZYKLEN, "2026-12-01");
    expect(ende).toBe("2027-01-11");
    expect(ende).not.toBe("2026-12-29");
  });

  it("liefert nichts, wenn für heute kein Zyklus eingetragen ist", () => {
    expect(umstellungAusZyklen(ZYKLEN, "2026-11-20")).toBeNull();
  });

  it("liefert nichts, wenn der Folgezyklus fehlt und der Vorlauf nicht reicht", () => {
    // Ohne den nächsten Zyklus ist der übernächste Beginn unbekannt. Raten
    // wäre hier eine Behauptung über ein Datum, an dem ein Preis steigt.
    const nurEiner = [{ von: "2026-11-30", bis: "2027-01-10" }];
    expect(umstellungAusZyklen(nurEiner, "2027-01-07")).toBeNull();
    // Reicht der Vorlauf dagegen, genügt der laufende Zyklus allein.
    expect(umstellungAusZyklen(nurEiner, "2026-12-01")).toBe("2027-01-11");
  });
});
