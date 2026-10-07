import { describe, it, expect } from "vitest";
import {
  einchecksStand,
  heutigeKurse,
  laeuftJetzt,
  standText,
  uhrzeitInWien,
} from "./heutige-kurse";
import type { KursEingabe } from "@/lib/teacher/uebersicht";

const DIENSTAG = "2026-10-06";
/** 0 = Montag … 6 = Sonntag (Zählweise des Projekts). */
const DI = 1;
const MI = 2;

/**
 * Die Vorgaben werden **überschrieben**, nicht mit `??` ergänzt: `null ?? DI`
 * ergibt DI, und ein Test für „Kurs ohne Wochentermin" hätte damit stillschweigend
 * einen Dienstagskurs geprüft.
 */
function kurs(felder: Partial<KursEingabe> = {}): KursEingabe {
  return {
    id: "k1",
    name: "Salsa Beginner",
    ort: "Studio 1",
    weekday: DI,
    startZeit: "19:00:00",
    endZeit: "20:00:00",
    pausen: [],
    zeitraum: { von: null, bis: null },
    hatVideosatz: false,
    fragtRolleAb: false,
    ...felder,
  };
}

const MITTAGS = new Date("2026-10-06T10:00:00Z");

describe("heutigeKurse", () => {
  it("nimmt den Kurs des heutigen Wochentags", () => {
    const liste = heutigeKurse([kurs()], DIENSTAG, [], MITTAGS);
    expect(liste.map((k) => k.kursName)).toEqual(["Salsa Beginner"]);
  });

  it("lässt einen Kurs an einem anderen Wochentag weg", () => {
    expect(heutigeKurse([kurs({ weekday: MI })], DIENSTAG, [], MITTAGS)).toEqual([]);
  });

  it("lässt einen Kurs ohne Wochentermin weg", () => {
    expect(heutigeKurse([kurs({ weekday: null })], DIENSTAG, [], MITTAGS)).toEqual([]);
  });

  // Der Betreiber soll nicht auf eine Stunde klicken, die nicht stattfindet.
  it("lässt einen ausgefallenen Termin weg", () => {
    expect(heutigeKurse([kurs({ pausen: [DIENSTAG] })], DIENSTAG, [], MITTAGS)).toEqual([]);
  });

  it("lässt einen Termin in den Ferien weg", () => {
    const ferien = [{ von: "2026-10-05", bis: "2026-10-11" }];
    expect(heutigeKurse([kurs()], DIENSTAG, ferien, MITTAGS)).toEqual([]);
  });

  it("lässt einen Kurs weg, der erst später beginnt", () => {
    const spaeter = kurs({ zeitraum: { von: "2026-11-01", bis: null } });
    expect(heutigeKurse([spaeter], DIENSTAG, [], MITTAGS)).toEqual([]);
  });

  it("lässt einen ausgelaufenen Kurs weg", () => {
    const vorbei = kurs({ zeitraum: { von: null, bis: "2026-09-30" } });
    expect(heutigeKurse([vorbei], DIENSTAG, [], MITTAGS)).toEqual([]);
  });

  it("sortiert nach Uhrzeit, bei gleicher Uhrzeit nach Namen", () => {
    const liste = heutigeKurse(
      [
        kurs({ id: "c", name: "Bachata", startZeit: "20:00:00", endZeit: "21:00:00" }),
        kurs({ id: "b", name: "Zouk", startZeit: "19:00:00" }),
        kurs({ id: "a", name: "Salsa", startZeit: "19:00:00" }),
      ],
      DIENSTAG,
      [],
      MITTAGS
    );
    expect(liste.map((k) => k.kursName)).toEqual(["Salsa", "Zouk", "Bachata"]);
  });

  // Eingecheckt wird oft erst nach der Stunde — eine Liste, die den Kurs um
  // 20:01 verschwinden lässt, nimmt den Weg weg, wenn er gebraucht wird.
  it("behält einen Kurs, der heute schon vorbei ist", () => {
    const abends = new Date("2026-10-06T21:30:00Z");
    expect(heutigeKurse([kurs()], DIENSTAG, [], abends).map((k) => k.kursName)).toEqual([
      "Salsa Beginner",
    ]);
  });
});

describe("einchecksStand", () => {
  it("zählt erwartet, anwesend und erfasst getrennt", () => {
    const stand = einchecksStand([
      { status: "present" },
      { status: "present" },
      { status: "absent" },
      { status: null },
    ]);
    expect(stand).toEqual({ erwartet: 4, anwesend: 2, erfasst: 3 });
  });

  it("kommt mit einer leeren Liste zurecht", () => {
    expect(einchecksStand([])).toEqual({ erwartet: 0, anwesend: 0, erfasst: 0 });
  });
});

describe("standText", () => {
  it("unterscheidet „nichts getan“ von „niemand da“", () => {
    expect(standText({ erwartet: 12, anwesend: 0, erfasst: 0 })).toBe("Noch nicht erfasst");
    expect(standText({ erwartet: 0, anwesend: 0, erfasst: 0 })).toBe("Niemand erwartet");
  });

  it("nennt die Zahlen, sobald etwas erfasst ist", () => {
    expect(standText({ erwartet: 12, anwesend: 3, erfasst: 5 })).toBe("3 von 12 anwesend");
  });

  // Eine Null nach einem Lesefehler wäre eine Behauptung.
  it("sagt bei einem Lesefehler, dass der Stand unbekannt ist", () => {
    expect(standText(null)).toBe("Stand unbekannt");
  });
});

describe("uhrzeitInWien", () => {
  it("gibt die Wiener Wanduhrzeit zweistellig zurück", () => {
    expect(uhrzeitInWien(new Date("2026-10-07T06:05:00Z"))).toBe("08:05:00");
  });

  // Nicht „24:00:00": Ein Vergleich von Zeichenketten hielte jeden Kurs dann
  // für längst vorbei.
  it("nennt Mitternacht 00:00:00", () => {
    expect(uhrzeitInWien(new Date("2026-10-07T22:00:00Z"))).toBe("00:00:00");
  });
});

describe("laeuftJetzt", () => {
  const laufend = { startZeit: "19:00:00", endZeit: "20:00:00" };

  it("erkennt den laufenden Kurs", () => {
    // 19:30 Wiener Zeit
    expect(laeuftJetzt(laufend, new Date("2026-10-06T17:30:00Z"))).toBe(true);
  });

  it("zählt Beginn und Ende mit", () => {
    expect(laeuftJetzt(laufend, new Date("2026-10-06T17:00:00Z"))).toBe(true);
    expect(laeuftJetzt(laufend, new Date("2026-10-06T18:00:00Z"))).toBe(true);
  });

  it("sagt vor und nach dem Kurs nein", () => {
    expect(laeuftJetzt(laufend, new Date("2026-10-06T16:59:00Z"))).toBe(false);
    expect(laeuftJetzt(laufend, new Date("2026-10-06T18:01:00Z"))).toBe(false);
  });

  it("sagt ohne hinterlegte Zeiten nein", () => {
    expect(laeuftJetzt({ startZeit: null, endZeit: null }, new Date())).toBe(false);
    expect(laeuftJetzt({ startZeit: "19:00:00", endZeit: null }, new Date())).toBe(false);
  });
});
