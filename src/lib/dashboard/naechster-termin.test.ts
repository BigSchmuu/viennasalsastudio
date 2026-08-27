import { describe, it, expect } from "vitest";
import { naechsteTermine, sammleTermine, type AboEingabe, type BuchungEingabe } from "./naechster-termin";

// 27.08.2026 ist ein Donnerstag. Wochentagskonvention: 0=Montag..6=Sonntag.
const DONNERSTAG = 3;
const FREITAG = 4;

function abo(over: Partial<AboEingabe> = {}): AboEingabe {
  return {
    kursId: "kurs-salsa",
    kursName: "Salsa Level 2",
    wochentag: DONNERSTAG,
    startZeit: "19:00:00",
    endZeit: "20:00:00",
    raum: "Saal 1",
    standort: "Mariahilf",
    pausenTage: [],
    ...over,
  };
}

function buchung(over: Partial<BuchungEingabe> = {}): BuchungEingabe {
  return {
    kursId: "kurs-bachata",
    kursName: "Bachata Level 1",
    datum: "2026-08-28",
    startZeit: "20:00:00",
    endZeit: "21:00:00",
    raum: "Saal 2",
    standort: "Mariahilf",
    ...over,
  };
}

describe("naechsteTermine", () => {
  it("findet den heutigen Kurs, solange er nicht vorbei ist", () => {
    // 27.08. 16:00 Wiener Zeit, Kurs von 19:00 bis 20:00.
    const { naechste } = naechsteTermine([abo()], [], new Date("2026-08-27T14:00:00Z"));
    expect(naechste).toHaveLength(1);
    expect(naechste[0].datum).toBe("2026-08-27");
  });

  it("zeigt einen laufenden Kurs weiterhin an, nicht schon den der Folgewoche", () => {
    // 19:30 Wiener Zeit — mitten im Kurs.
    const { naechste } = naechsteTermine([abo()], [], new Date("2026-08-27T17:30:00Z"));
    expect(naechste[0].datum).toBe("2026-08-27");
  });

  it("springt nach Kursende auf die Folgewoche", () => {
    // 20:30 Wiener Zeit — der Kurs ist seit einer halben Stunde vorbei.
    const { naechste } = naechsteTermine([abo()], [], new Date("2026-08-27T18:30:00Z"));
    expect(naechste[0].datum).toBe("2026-09-03");
  });

  it("überspringt Termine, die in eine eingetragene Pause fallen", () => {
    const { naechste } = naechsteTermine(
      [abo({ pausenTage: ["2026-08-27", "2026-09-03"] })],
      [],
      new Date("2026-08-27T06:00:00Z")
    );
    expect(naechste[0].datum).toBe("2026-09-10");
  });

  it("nimmt bei mehreren Abos den zeitlich nächsten und nennt den übernächsten", () => {
    const { naechste, danach } = naechsteTermine(
      [abo(), abo({ kursId: "kurs-bachata", kursName: "Bachata Level 1", wochentag: FREITAG })],
      [],
      new Date("2026-08-27T06:00:00Z")
    );
    expect(naechste).toHaveLength(1);
    expect(naechste[0].kursName).toBe("Salsa Level 2");
    expect(danach?.kursName).toBe("Bachata Level 1");
  });

  it("behandelt eine gebuchte Probestunde wie einen Abo-Termin", () => {
    const { naechste } = naechsteTermine([], [buchung()], new Date("2026-08-27T06:00:00Z"));
    expect(naechste[0].kursName).toBe("Bachata Level 1");
    expect(naechste[0].quelle).toBe("buchung");
  });

  it("zeigt denselben Kurstag nur einmal, wenn Abo und Buchung ihn beide liefern", () => {
    const alle = sammleTermine(
      [abo()],
      [buchung({ kursId: "kurs-salsa", kursName: "Salsa Level 2", datum: "2026-08-27", startZeit: "19:00:00", endZeit: "20:00:00" })],
      new Date("2026-08-27T06:00:00Z")
    );
    const am27 = alle.filter((t) => t.datum === "2026-08-27");
    expect(am27).toHaveLength(1);
    // Das Abo gewinnt, denn daran haengt der Check-in.
    expect(am27[0].quelle).toBe("abo");
  });

  it("zeigt zwei gleichzeitige Termine beide, statt willkürlich einen zu wählen", () => {
    const { naechste, danach } = naechsteTermine(
      [abo(), abo({ kursId: "kurs-zweit", kursName: "Bachata Level 1", raum: "Saal 2" })],
      [],
      new Date("2026-08-27T06:00:00Z")
    );
    expect(naechste).toHaveLength(2);
    expect(naechste.map((t) => t.kursName).sort()).toEqual(["Bachata Level 1", "Salsa Level 2"]);
    // Der „Danach" ist dann der Termin der Folgewoche, nicht der Zwilling.
    expect(danach?.datum).toBe("2026-09-03");
  });

  it("liefert nichts, wenn es weder Abo noch Buchung gibt", () => {
    expect(naechsteTermine([], [], new Date("2026-08-27T06:00:00Z"))).toEqual({ naechste: [], danach: null });
  });

  it("rechnet Kurszeiten als Wiener Wandzeit, nicht als UTC", () => {
    const { naechste } = naechsteTermine([abo()], [], new Date("2026-08-27T06:00:00Z"));
    // 19:00 Wiener Sommerzeit = 17:00 UTC.
    expect(naechste[0].beginn.toISOString()).toBe("2026-08-27T17:00:00.000Z");
  });

  it("lässt eine Buchung fallen, deren Termin vorbei ist", () => {
    const { naechste } = naechsteTermine([], [buchung({ datum: "2026-08-20" })], new Date("2026-08-27T06:00:00Z"));
    expect(naechste).toHaveLength(0);
  });
});
