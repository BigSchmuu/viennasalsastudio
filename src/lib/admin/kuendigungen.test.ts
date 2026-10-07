import { describe, it, expect } from "vitest";
import { laufzeit, teileKuendigungen, type Kuendigung } from "./kuendigungen";

function kuendigung(felder: Partial<Kuendigung> = {}): Kuendigung {
  return {
    aboId: "abo-1",
    kundeId: "kunde-1",
    kundeName: "Anna Beispiel",
    aboName: "Salsa Beginner",
    beginn: "2026-01-15",
    wirksamAb: "2026-10-31",
    angekuendigt: false,
    ...felder,
  };
}

describe("laufzeit", () => {
  it("nennt Tage, solange kein Monat voll ist", () => {
    expect(laufzeit("2026-10-01", "2026-10-02")).toBe("1 Tag");
    expect(laufzeit("2026-10-01", "2026-10-19")).toBe("18 Tage");
  });

  // Der Monat ist erst voll, wenn der Tag erreicht ist.
  it("zählt einen Monat erst ab dem Tag des Monats", () => {
    expect(laufzeit("2026-01-15", "2026-02-14")).toBe("30 Tage");
    expect(laufzeit("2026-01-15", "2026-02-15")).toBe("1 Monat");
  });

  it("nennt Monate bis zum Jahr", () => {
    expect(laufzeit("2026-01-15", "2026-05-15")).toBe("4 Monate");
    expect(laufzeit("2026-01-15", "2026-12-15")).toBe("11 Monate");
  });

  it("nennt ab einem Jahr Jahre samt Restmonaten", () => {
    expect(laufzeit("2025-01-15", "2026-01-15")).toBe("1 Jahr");
    expect(laufzeit("2025-01-15", "2026-04-15")).toBe("1 Jahr 3 Monate");
    expect(laufzeit("2025-01-15", "2026-02-15")).toBe("1 Jahr 1 Monat");
    expect(laufzeit("2024-01-15", "2026-01-15")).toBe("2 Jahre");
  });

  // „-12 Tage" wäre keine Auskunft, sondern ein Rätsel.
  it("sagt es, wenn das Abo vor dem Beginn gekündigt wurde", () => {
    expect(laufzeit("2026-11-01", "2026-10-15")).toBe("Noch nicht gestartet");
  });

  it("kommt mit dem Starttag selbst zurecht", () => {
    expect(laufzeit("2026-10-01", "2026-10-01")).toBe("Am Starttag");
  });

  it("sagt nichts, wo nichts zu sagen ist", () => {
    expect(laufzeit(null, "2026-10-01")).toBe("—");
    expect(laufzeit("2026-10-01", null)).toBe("—");
    expect(laufzeit(undefined, undefined)).toBe("—");
  });

  // Über den Jahreswechsel und über einen Februar — die beiden Stellen, an denen
  // eine Monatsrechnung gern daneben liegt.
  it("rechnet über Jahreswechsel und Februar richtig", () => {
    expect(laufzeit("2025-12-20", "2026-01-20")).toBe("1 Monat");
    expect(laufzeit("2026-01-31", "2026-03-01")).toBe("1 Monat");
    expect(laufzeit("2024-02-29", "2024-03-29")).toBe("1 Monat");
  });
});

describe("teileKuendigungen", () => {
  it("trennt angekündigte von beendeten", () => {
    const { angekuendigt, beendet } = teileKuendigungen([
      kuendigung({ aboId: "a", angekuendigt: true }),
      kuendigung({ aboId: "b", angekuendigt: false }),
    ]);
    expect(angekuendigt.map((k) => k.aboId)).toEqual(["a"]);
    expect(beendet.map((k) => k.aboId)).toEqual(["b"]);
  });

  // Was zuerst endet, verlangt zuerst eine Entscheidung.
  it("sortiert angekündigte aufsteigend nach Stichtag", () => {
    const { angekuendigt } = teileKuendigungen([
      kuendigung({ aboId: "spaet", angekuendigt: true, wirksamAb: "2026-12-31" }),
      kuendigung({ aboId: "frueh", angekuendigt: true, wirksamAb: "2026-10-31" }),
    ]);
    expect(angekuendigt.map((k) => k.aboId)).toEqual(["frueh", "spaet"]);
  });

  it("sortiert beendete absteigend — zuletzt beendet zuerst", () => {
    const { beendet } = teileKuendigungen([
      kuendigung({ aboId: "alt", wirksamAb: "2026-08-31" }),
      kuendigung({ aboId: "neu", wirksamAb: "2026-09-30" }),
    ]);
    expect(beendet.map((k) => k.aboId)).toEqual(["neu", "alt"]);
  });

  it("ordnet bei gleichem Datum nach Namen", () => {
    const { beendet } = teileKuendigungen([
      kuendigung({ aboId: "z", kundeName: "Zoe Zuletzt" }),
      kuendigung({ aboId: "a", kundeName: "Anna Anfang" }),
    ]);
    expect(beendet.map((k) => k.aboId)).toEqual(["a", "z"]);
  });

  it("kommt ohne Kündigungen zurecht", () => {
    expect(teileKuendigungen([])).toEqual({ angekuendigt: [], beendet: [] });
  });
});
