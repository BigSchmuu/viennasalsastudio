import { describe, it, expect } from "vitest";
import {
  ZYKLUS_TAGE,
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
