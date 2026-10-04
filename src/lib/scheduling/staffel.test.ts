import { describe, it, expect } from "vitest";
import { aktuelleStaffel, staffelSpanne, staffeln, staffelplan, STAFFEL_LAENGE } from "./staffel";

const ZEHN = [
  "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28",
  "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26",
  "2026-11-02", "2026-11-09",
];

describe("PROJ-72: Termine in Staffeln schneiden", () => {
  it("schneidet ab Kursbeginn in Vierer-Blöcke", () => {
    const bloecke = staffeln(ZEHN, { abKursbeginn: true });
    expect(bloecke).toHaveLength(3);
    expect(bloecke[0]).toEqual(["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"]);
    expect(bloecke[2]).toEqual(["2026-11-02", "2026-11-09"]);
  });

  it("lässt den Rest ab Kursbeginn am Ende offen", () => {
    // Zehn Termine, Staffeln von vier: die letzte hat zwei. Das ist richtig —
    // die Staffel läuft noch.
    const bloecke = staffeln(ZEHN, { abKursbeginn: true });
    expect(bloecke[bloecke.length - 1]).toHaveLength(2);
  });

  it("schneidet ohne Kursbeginn vom letzten Termin nach hinten", () => {
    // Dann muss die *jüngste* Staffel vollständig sein, nicht die älteste.
    const bloecke = staffeln(ZEHN, { abKursbeginn: false });
    expect(bloecke[bloecke.length - 1]).toEqual([
      "2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09",
    ]);
    expect(bloecke[0]).toEqual(["2026-09-07", "2026-09-14"]);
  });

  it("kommt mit leeren und unsinnigen Eingaben zurecht", () => {
    expect(staffeln([], { abKursbeginn: true })).toEqual([]);
    expect(staffeln(ZEHN, { abKursbeginn: true, laenge: 0 })).toEqual([]);
  });

  it("rechnet mit vier Wochen", () => {
    expect(STAFFEL_LAENGE).toBe(4);
  });
});

describe("PROJ-72: Welche Staffel heute gilt", () => {
  const bloecke = staffeln(ZEHN, { abKursbeginn: true });

  it("die, in der der jüngste vergangene Termin liegt", () => {
    expect(aktuelleStaffel(bloecke, "2026-10-14")).toBe(1);
  });

  it("bleibt bei der laufenden, bis der erste Termin der nächsten da ist", () => {
    // Am Tag nach dem letzten Termin einer Staffel will der Lehrer noch diese
    // sehen, um nachzutragen.
    expect(aktuelleStaffel(bloecke, "2026-09-29")).toBe(0);
    expect(aktuelleStaffel(bloecke, "2026-10-04")).toBe(0);
    expect(aktuelleStaffel(bloecke, "2026-10-05")).toBe(1);
  });

  it("nimmt die erste, wenn der Kurs noch nicht begonnen hat", () => {
    expect(aktuelleStaffel(bloecke, "2026-08-01")).toBe(0);
  });

  it("nimmt die letzte, wenn der Kurs vorbei ist", () => {
    expect(aktuelleStaffel(bloecke, "2027-01-01")).toBe(2);
  });

  it("meldet ohne Termine, dass es nichts gibt", () => {
    expect(aktuelleStaffel([], "2026-10-14")).toBe(-1);
  });
});

describe("PROJ-72: Spanne einer Staffel", () => {
  it("nennt ersten und letzten Termin", () => {
    expect(staffelSpanne(["2026-10-05", "2026-10-12"])).toEqual({
      von: "2026-10-05",
      bis: "2026-10-12",
    });
  });

  it("ist bei einem einzelnen Termin beides derselbe Tag", () => {
    expect(staffelSpanne(["2026-10-05"])).toEqual({ von: "2026-10-05", bis: "2026-10-05" });
  });

  it("ist leer, wenn die Staffel leer ist", () => {
    expect(staffelSpanne([])).toBeNull();
  });
});

describe("PROJ-72: Der ganze Staffelplan", () => {
  it("schneidet mit Kursbeginn vom ersten Termin nach vorn", () => {
    const plan = staffelplan(ZEHN, { heute: "2026-10-14", kursbeginn: true });
    expect(plan[0]).toEqual(["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"]);
    expect(aktuelleStaffel(plan, "2026-10-14")).toBe(1);
  });

  it("teilt ohne Kursbeginn am heutigen Tag", () => {
    // Vergangenes von hinten: Die laufende Staffel ist vollständig und endet
    // am jüngsten Termin. Künftiges von vorn.
    const plan = staffelplan(ZEHN, { heute: "2026-10-14", kursbeginn: false });
    const laufend = plan[aktuelleStaffel(plan, "2026-10-14")];
    expect(laufend).toEqual(["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"]);
    expect(plan[plan.length - 1]).toEqual(["2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09"]);
  });

  it("hängt ohne Kursbeginn nicht am Ende des Vorschaufensters", () => {
    // Dieselben vergangenen Termine, ein künftiger mehr: Die laufende Staffel
    // muss dieselbe bleiben.
    const mitMehr = [...ZEHN, "2026-11-16"];
    const a = staffelplan(ZEHN, { heute: "2026-10-14", kursbeginn: false });
    const b = staffelplan(mitMehr, { heute: "2026-10-14", kursbeginn: false });
    expect(b[aktuelleStaffel(b, "2026-10-14")]).toEqual(a[aktuelleStaffel(a, "2026-10-14")]);
  });

  it("kommt mit einem Kurs klar, der noch nicht begonnen hat", () => {
    const plan = staffelplan(ZEHN, { heute: "2026-08-01", kursbeginn: false });
    expect(plan[0]).toEqual(["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"]);
    expect(aktuelleStaffel(plan, "2026-08-01")).toBe(0);
  });
});
