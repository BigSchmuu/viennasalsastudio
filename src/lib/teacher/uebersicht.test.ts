import { describe, it, expect } from "vitest";
import {
  naechsteTermine,
  fehlendeAnwesenheit,
  geburtstage,
  rollenVerteilung,
  type KursEingabe,
} from "./uebersicht";

/** Mittwoch, 9. September 2026, mittags — fester Bezugspunkt für alle Tests. */
const JETZT = new Date("2026-09-09T12:00:00Z");
const HEUTE = "2026-09-09";

const kurs = (ueber: Partial<KursEingabe> = {}): KursEingabe => ({
  id: "k1",
  name: "Salsa Beginner 1",
  ort: "Studio Nord",
  weekday: 3, // Donnerstag (0 = Montag)
  startZeit: "19:00",
  endZeit: "20:00",
  pausen: [],
  hatVideosatz: true,
  fragtRolleAb: false,
  ...ueber,
});

describe("naechsteTermine", () => {
  it("nennt den nächsten Termin eines wöchentlichen Kurses", () => {
    const t = naechsteTermine([kurs()], HEUTE, JETZT);
    expect(t).toHaveLength(1);
    expect(t[0].datum).toBe("2026-09-10");
    expect(t[0].kursName).toBe("Salsa Beginner 1");
  });

  it("zeigt einen Kurs höchstens einmal, auch wenn zwei Termine berechnet werden", () => {
    // Wöchentlich heißt: im Sieben-Tage-Fenster genau einmal. Der zweite
    // berechnete Termin liegt außerhalb und wird verworfen.
    expect(naechsteTermine([kurs()], HEUTE, JETZT)).toHaveLength(1);
  });

  it("lässt einen ausgefallenen Termin aus und nimmt den nächsten nur, wenn er noch ins Fenster passt", () => {
    const mitPause = kurs({ pausen: ["2026-09-10"] });
    // Der nächste wäre der 17.9. — außerhalb der sieben Tage.
    expect(naechsteTermine([mitPause], HEUTE, JETZT)).toHaveLength(0);
  });

  it("übergeht Kurse ohne hinterlegten Wochentermin", () => {
    expect(naechsteTermine([kurs({ weekday: null })], HEUTE, JETZT)).toEqual([]);
  });

  it("sortiert über alle Kurse hinweg nach Datum, dann nach Uhrzeit", () => {
    const donnerstagSpaet = kurs({ id: "a", name: "Spät", weekday: 3, startZeit: "20:00" });
    const donnerstagFrueh = kurs({ id: "b", name: "Früh", weekday: 3, startZeit: "18:00" });
    const freitag = kurs({ id: "c", name: "Freitag", weekday: 4, startZeit: "10:00" });

    const namen = naechsteTermine([donnerstagSpaet, freitag, donnerstagFrueh], HEUTE, JETZT).map(
      (t) => t.kursName
    );
    expect(namen).toEqual(["Früh", "Spät", "Freitag"]);
  });

  it("zählt einen Kurs, der heute stattfindet, als anstehend", () => {
    // Die Anwesenheit wird ja erst während der Stunde erfasst.
    const heutigerKurs = kurs({ weekday: 2 }); // Mittwoch = heute
    expect(naechsteTermine([heutigerKurs], HEUTE, JETZT)[0].datum).toBe(HEUTE);
  });
});

describe("fehlendeAnwesenheit", () => {
  it("nennt Termine ohne Eintrag, jüngster zuerst", () => {
    const offen = fehlendeAnwesenheit([kurs()], new Set(), JETZT);
    expect(offen).toHaveLength(4);
    expect(offen[0].datum > offen[1].datum).toBe(true);
  });

  it("übergeht Termine, für die es Einträge gibt", () => {
    const alle = fehlendeAnwesenheit([kurs()], new Set(), JETZT);
    const erfasst = new Set([`k1|${alle[0].datum}`]);
    const offen = fehlendeAnwesenheit([kurs()], erfasst, JETZT);
    expect(offen.map((o) => o.datum)).not.toContain(alle[0].datum);
    expect(offen).toHaveLength(3);
  });

  it("mahnt ausgefallene Stunden nicht an", () => {
    // Eine Stunde, die nicht stattgefunden hat, kann keine Anwesenheit haben.
    const alle = fehlendeAnwesenheit([kurs()], new Set(), JETZT);
    const ausgefallen = alle[0].datum;
    const offen = fehlendeAnwesenheit([kurs({ pausen: [ausgefallen] })], new Set(), JETZT);
    expect(offen.map((o) => o.datum)).not.toContain(ausgefallen);
  });

  it("schweigt, wenn alles erfasst ist", () => {
    const alle = fehlendeAnwesenheit([kurs()], new Set(), JETZT);
    const erfasst = new Set(alle.map((o) => `k1|${o.datum}`));
    expect(fehlendeAnwesenheit([kurs()], erfasst, JETZT)).toEqual([]);
  });
});

describe("geburtstage", () => {
  it("nennt Schüler mit Geburtstag im Fenster, nächster zuerst", () => {
    const g = geburtstage(
      [
        { id: "1", name: "Weit weg", geburtsdatum: "1990-12-01" },
        { id: "2", name: "Übermorgen", geburtsdatum: "1990-09-11" },
        { id: "3", name: "Morgen", geburtsdatum: "1985-09-10" },
      ],
      JETZT
    );
    expect(g.map((x) => x.name)).toEqual(["Morgen", "Übermorgen"]);
  });

  it("übergeht Schüler ohne hinterlegtes Geburtsdatum", () => {
    expect(geburtstage([{ id: "1", name: "Ohne", geburtsdatum: null }], JETZT)).toEqual([]);
  });

  it("gibt nur Name und Datum zurück, kein Alter", () => {
    const [g] = geburtstage([{ id: "1", name: "Morgen", geburtsdatum: "1985-09-10" }], JETZT);
    expect(Object.keys(g).sort()).toEqual(["datum", "id", "name"]);
  });
});

describe("rollenVerteilung", () => {
  it("zählt Leader, Follower und beides", () => {
    expect(rollenVerteilung(["leader", "leader", "follower", "both", null])).toEqual({
      leader: 2,
      follower: 1,
      beides: 1,
    });
  });

  it("kommt mit einer leeren Liste zurecht", () => {
    expect(rollenVerteilung([])).toEqual({ leader: 0, follower: 0, beides: 0 });
  });
});
