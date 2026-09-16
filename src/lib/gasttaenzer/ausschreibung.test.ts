import { describe, it, expect } from "vitest";
import {
  freiePlaetze,
  laeuft,
  rollePasst,
  darfEingeladenWerden,
  zusageHindernis,
  type Ausschreibung,
  type Gast,
} from "./ausschreibung";

const JETZT = new Date("2026-10-06T18:00:00Z");
const SPAETER = "2026-10-06T19:00:00Z";
const FRUEHER = "2026-10-06T17:00:00Z";

const ausschreibung = (u: Partial<Ausschreibung> = {}): Ausschreibung => ({
  plaetze: 2,
  zusagen: 0,
  rolle: "follower",
  mindeststufe: "intermediate",
  zurueckgezogenAm: null,
  kursBeginn: SPAETER,
  ...u,
});

const gast = (u: Partial<Gast> = {}): Gast => ({
  imProgramm: true,
  ausgeschlossen: false,
  rolle: "follower",
  level: "advanced",
  schonImKurs: false,
  ...u,
});

describe("freiePlaetze", () => {
  it("zieht die Zusagen ab", () => {
    expect(freiePlaetze({ plaetze: 3, zusagen: 1 })).toBe(2);
  });

  it("wird nicht negativ, falls doch einmal mehr zugesagt wurde", () => {
    expect(freiePlaetze({ plaetze: 1, zusagen: 3 })).toBe(0);
  });
});

describe("laeuft", () => {
  it("läuft bis zum Kursbeginn", () => {
    expect(laeuft({ zurueckgezogenAm: null, kursBeginn: SPAETER }, JETZT)).toBe(true);
  });

  it("endet mit dem Kursbeginn", () => {
    expect(laeuft({ zurueckgezogenAm: null, kursBeginn: FRUEHER }, JETZT)).toBe(false);
  });

  it("endet sofort, wenn zurückgezogen", () => {
    expect(laeuft({ zurueckgezogenAm: "2026-10-05T10:00:00Z", kursBeginn: SPAETER }, JETZT)).toBe(false);
  });
});

describe("rollePasst", () => {
  it("passt bei gleicher Rolle", () => {
    expect(rollePasst("follower", "follower")).toBe(true);
  });

  it("passt nicht bei anderer Rolle", () => {
    expect(rollePasst("leader", "follower")).toBe(false);
  });

  it("wer beides tanzt, passt immer", () => {
    expect(rollePasst("both", "leader")).toBe(true);
    expect(rollePasst("both", "follower")).toBe(true);
  });

  it("ohne Rolle passt nichts", () => {
    expect(rollePasst(null, "leader")).toBe(false);
  });
});

describe("darfEingeladenWerden", () => {
  it("lädt den passenden Gast ein", () => {
    expect(darfEingeladenWerden(ausschreibung(), gast())).toBe(true);
  });

  it("lädt niemanden ein, der an dem Abend ohnehin im Kurs sitzt", () => {
    expect(darfEingeladenWerden(ausschreibung(), gast({ schonImKurs: true }))).toBe(false);
  });

  it("lädt keinen Ausgeschlossenen ein", () => {
    expect(darfEingeladenWerden(ausschreibung(), gast({ ausgeschlossen: true }))).toBe(false);
  });

  it("lädt die falsche Rolle nicht ein", () => {
    expect(darfEingeladenWerden(ausschreibung(), gast({ rolle: "leader" }))).toBe(false);
  });

  it("lädt unter der Mindeststufe nicht ein", () => {
    expect(darfEingeladenWerden(ausschreibung(), gast({ level: "improver" }))).toBe(false);
  });

  it("kümmert sich nicht um freie Plätze — beim Ausschreiben sind alle frei", () => {
    expect(darfEingeladenWerden(ausschreibung({ zusagen: 2 }), gast())).toBe(true);
  });
});

describe("zusageHindernis", () => {
  it("lässt die gültige Zusage durch", () => {
    expect(zusageHindernis(ausschreibung(), gast(), JETZT)).toBeNull();
  });

  it("nennt volle Plätze", () => {
    expect(zusageHindernis(ausschreibung({ zusagen: 2 }), gast(), JETZT)).toBe("keine_plaetze");
  });

  it("nennt den begonnenen Kurs", () => {
    expect(zusageHindernis(ausschreibung({ kursBeginn: FRUEHER }), gast(), JETZT)).toBe("begonnen");
  });

  it("nennt die zurückgezogene Ausschreibung", () => {
    expect(zusageHindernis(ausschreibung({ zurueckgezogenAm: "2026-10-05" }), gast(), JETZT)).toBe(
      "zurueckgezogen"
    );
  });

  it("nennt das fehlende Programm", () => {
    expect(zusageHindernis(ausschreibung(), gast({ imProgramm: false }), JETZT)).toBe("nicht_im_programm");
  });

  it("sagt einem Ungeeigneten nicht, er sei nur zu spät gewesen", () => {
    // Beides trifft zu: falsche Rolle *und* keine Plätze mehr. Die Rolle wiegt
    // schwerer — „zu spät" wäre eine freundliche Unwahrheit.
    const hindernis = zusageHindernis(ausschreibung({ zusagen: 2 }), gast({ rolle: "leader" }), JETZT);
    expect(hindernis).toBe("rolle");
  });

  it("nennt beim Ausgeschlossenen den Ausschluss, nicht die Plätze", () => {
    expect(zusageHindernis(ausschreibung({ zusagen: 2 }), gast({ ausgeschlossen: true }), JETZT)).toBe(
      "ausgeschlossen"
    );
  });

  it("weist den ab, der an dem Abend ohnehin im Kurs sitzt", () => {
    expect(zusageHindernis(ausschreibung(), gast({ schonImKurs: true }), JETZT)).toBe("schon_dabei");
  });

  it("lässt jedes Level durch, wenn keine Mindeststufe gesetzt ist", () => {
    const a = ausschreibung({ mindeststufe: null });
    expect(zusageHindernis(a, gast({ level: "beginner" }), JETZT)).toBeNull();
  });
});
