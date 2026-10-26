import { describe, it, expect } from "vitest";
import { darfVideosSehen, decktKurs, type Kurszugehoerigkeit } from "./kurszugehoerigkeit";

const BACHATA = "stil-bachata";
const SALSA = "stil-salsa";

function zugehoerigkeit(over: Partial<Kurszugehoerigkeit> = {}): Kurszugehoerigkeit {
  return {
    hatFlatrate: false,
    passStilId: null,
    kursIds: new Set<string>(),
    videoKursIds: new Set<string>(),
    ...over,
  };
}

describe("decktKurs (PROJ-93)", () => {
  it("deckt mit der vollen Flatrate jeden Kurs", () => {
    const z = zugehoerigkeit({ hatFlatrate: true, passStilId: null });
    expect(decktKurs(z, BACHATA)).toBe(true);
    expect(decktKurs(z, SALSA)).toBe(true);
    expect(decktKurs(z, null)).toBe(true);
  });

  it("deckt mit einem Bachata-Pass nur Bachata", () => {
    const z = zugehoerigkeit({ hatFlatrate: true, passStilId: BACHATA });
    expect(decktKurs(z, BACHATA)).toBe(true);
    expect(decktKurs(z, SALSA)).toBe(false);
  });

  // Sonst käme ein Kurs ohne Zuordnung versehentlich in jeden Pass.
  it("deckt mit einem Pass keinen Kurs ohne Stilrichtung", () => {
    expect(decktKurs(zugehoerigkeit({ hatFlatrate: true, passStilId: BACHATA }), null)).toBe(false);
  });

  it("deckt ohne kursloses Abo gar nichts", () => {
    expect(decktKurs(zugehoerigkeit(), BACHATA)).toBe(false);
  });
});

describe("darfVideosSehen mit Pass (PROJ-93)", () => {
  it("öffnet mit der vollen Flatrate alle Videos — wie bisher", () => {
    expect(darfVideosSehen(zugehoerigkeit({ hatFlatrate: true }), "kurs-1")).toBe(true);
  });

  // Die zurückhaltende Lesart: Ein Pass ist keine Flatrate. Er sieht die
  // Videos seiner Kurse, wie jeder mit Kursabo.
  it("öffnet mit einem Pass nur die Videos der eigenen Kurse", () => {
    const z = zugehoerigkeit({
      hatFlatrate: true,
      passStilId: BACHATA,
      videoKursIds: new Set(["kurs-1"]),
    });
    expect(darfVideosSehen(z, "kurs-1")).toBe(true);
    expect(darfVideosSehen(z, "kurs-2")).toBe(false);
  });
});
