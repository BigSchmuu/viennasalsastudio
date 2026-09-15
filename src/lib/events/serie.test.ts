import { describe, it, expect } from "vitest";
import { serientermine, naechsterTermin, ferienpauseBis, uhrzeitKurz, type SerienRegel } from "./serie";

// Donnerstag, 2026-10-01. Der Freitag der Serie ist also der 02.10.
const JETZT = new Date("2026-10-01T09:00:00Z");

const freitags: SerienRegel = {
  weekday: 4, // 0 = Montag, also 4 = Freitag
  startsOn: "2026-09-01",
  endsOn: null,
  pausiertInFerien: true,
};

describe("serientermine", () => {
  it("liefert jeden Freitag im Vorschaufenster von vier Wochen", () => {
    // Das Fenster endet 28 Tage nach heute, also am 29.10. — der Freitag
    // darauf gehört nicht mehr dazu.
    expect(serientermine(freitags, { ferien: [], jetzt: JETZT })).toEqual([
      "2026-10-02",
      "2026-10-09",
      "2026-10-16",
      "2026-10-23",
    ]);
  });

  it("überspringt Studioferien, wenn die Serie darauf eingestellt ist", () => {
    const ferien = [{ von: "2026-10-05", bis: "2026-10-18" }];
    expect(serientermine(freitags, { ferien, jetzt: JETZT })).toEqual(["2026-10-02", "2026-10-23"]);
  });

  it("lässt eine Serie ohne Ferienpause durchlaufen", () => {
    const ferien = [{ von: "2026-10-05", bis: "2026-10-18" }];
    const durchlaeufer = { ...freitags, pausiertInFerien: false };
    expect(serientermine(durchlaeufer, { ferien, jetzt: JETZT })).toContain("2026-10-09");
  });

  it("hört mit dem Ende der Serie auf", () => {
    const befristet = { ...freitags, endsOn: "2026-10-12" };
    expect(serientermine(befristet, { ferien: [], jetzt: JETZT })).toEqual(["2026-10-02", "2026-10-09"]);
  });

  it("beginnt frühestens mit dem ersten Termin der Serie", () => {
    const spaeter = { ...freitags, startsOn: "2026-10-20" };
    expect(serientermine(spaeter, { ferien: [], jetzt: JETZT })).toEqual(["2026-10-23"]);
  });

  it("gibt nichts zurück, wenn die Serie schon beendet ist", () => {
    const beendet = { ...freitags, endsOn: "2026-09-30" };
    expect(serientermine(beendet, { ferien: [], jetzt: JETZT })).toEqual([]);
  });
});

describe("naechsterTermin", () => {
  it("nennt den nächsten stattfindenden Termin", () => {
    expect(naechsterTermin(freitags, { ferien: [], jetzt: JETZT })).toBe("2026-10-02");
  });

  it("ist null, wenn im Fenster keiner mehr liegt", () => {
    expect(naechsterTermin({ ...freitags, endsOn: "2026-09-30" }, { ferien: [], jetzt: JETZT })).toBeNull();
  });
});

describe("ferienpauseBis", () => {
  it("nennt das Ende der Ferien, wenn der nächste reguläre Termin hineinfällt", () => {
    const ferien = [{ von: "2026-10-01", bis: "2026-10-18" }];
    expect(ferienpauseBis(freitags, { ferien, jetzt: JETZT })).toBe("2026-10-18");
  });

  it("schweigt, wenn der nächste Termin stattfindet", () => {
    const ferien = [{ von: "2026-10-05", bis: "2026-10-18" }];
    expect(ferienpauseBis(freitags, { ferien, jetzt: JETZT })).toBeNull();
  });

  it("schweigt bei einer Serie, die in den Ferien durchläuft", () => {
    const ferien = [{ von: "2026-10-01", bis: "2026-10-18" }];
    expect(ferienpauseBis({ ...freitags, pausiertInFerien: false }, { ferien, jetzt: JETZT })).toBeNull();
  });
});

describe("uhrzeitKurz", () => {
  it("lässt die Sekunden aus der Datenbank weg", () => {
    expect(uhrzeitKurz("21:00:00")).toBe("21:00");
    expect(uhrzeitKurz("02:00")).toBe("02:00");
  });
});
