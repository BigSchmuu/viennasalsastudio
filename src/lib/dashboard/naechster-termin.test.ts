import { describe, it, expect } from "vitest";
import { naechsteTermine, sammleTermine, type AboEingabe, type BuchungEingabe } from "./naechster-termin";
import { UNBEFRISTET } from "@/lib/scheduling/ferien";

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
    zeitraum: UNBEFRISTET,
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
    const { naechste } = naechsteTermine([abo()], [], [], new Date("2026-08-27T14:00:00Z"));
    expect(naechste).toHaveLength(1);
    expect(naechste[0].datum).toBe("2026-08-27");
  });

  it("zeigt einen laufenden Kurs weiterhin an, nicht schon den der Folgewoche", () => {
    // 19:30 Wiener Zeit — mitten im Kurs.
    const { naechste } = naechsteTermine([abo()], [], [], new Date("2026-08-27T17:30:00Z"));
    expect(naechste[0].datum).toBe("2026-08-27");
  });

  // PROJ-90: Bis 22:59 bleibt der Abend stehen — sonst gibt es nach Kursende
  // keinen Knopf zum Einchecken, obwohl die Datenbank es erlaubt.
  it("lässt den heutigen Kurs nach Kursende zum Nachtragen stehen", () => {
    // 20:30 Wiener Zeit — der Kurs ist seit einer halben Stunde vorbei.
    const { naechste } = naechsteTermine([abo()], [], [], new Date("2026-08-27T18:30:00Z"));
    expect(naechste[0].datum).toBe("2026-08-27");
  });

  it("springt nach 23 Uhr auf die Folgewoche", () => {
    // 23:30 Wiener Zeit.
    const { naechste } = naechsteTermine([abo()], [], [], new Date("2026-08-27T21:30:00Z"));
    expect(naechste[0].datum).toBe("2026-09-03");
  });

  // Die Grenze darf nie *vor* dem Kursende greifen.
  it("zeigt einen Kurs, der bis nach 23 Uhr läuft, während des Unterrichts", () => {
    const spaet = abo({ startZeit: "22:00:00", endZeit: "23:30:00" });
    const { naechste } = naechsteTermine([spaet], [], [], new Date("2026-08-27T21:10:00Z"));
    expect(naechste[0].datum).toBe("2026-08-27");
  });

  // Nachtragen gilt dem heutigen Kurstag. Am nächsten Morgen ist gestern zu.
  it("zeigt den Kurs von gestern am nächsten Tag nicht mehr", () => {
    const { naechste } = naechsteTermine([abo()], [], [], new Date("2026-08-28T06:00:00Z"));
    expect(naechste[0].datum).toBe("2026-09-03");
  });

  // An einer Probestunde ist nichts nachzutragen — es gibt dafür keinen
  // Selbst-Check-in. Eine Karte ohne Knopf erklärte sich nicht.
  it("lässt eine vorbei gegangene Buchung nicht stehen", () => {
    const heutigeBuchung = buchung({ datum: "2026-08-27", startZeit: "19:00:00", endZeit: "20:00:00" });
    const { naechste } = naechsteTermine([], [heutigeBuchung], [], new Date("2026-08-27T18:30:00Z"));
    expect(naechste).toHaveLength(0);
  });

  it("überspringt Termine, die in eine eingetragene Pause fallen", () => {
    const { naechste } = naechsteTermine([abo({ pausenTage: ["2026-08-27", "2026-09-03"] })], [], [], new Date("2026-08-27T06:00:00Z"));
    expect(naechste[0].datum).toBe("2026-09-10");
  });

  it("nimmt bei mehreren Abos den zeitlich nächsten und nennt den übernächsten", () => {
    const { naechste, danach } = naechsteTermine([abo(), abo({ kursId: "kurs-bachata", kursName: "Bachata Level 1", wochentag: FREITAG })], [], [], new Date("2026-08-27T06:00:00Z"));
    expect(naechste).toHaveLength(1);
    expect(naechste[0].kursName).toBe("Salsa Level 2");
    expect(danach?.kursName).toBe("Bachata Level 1");
  });

  it("behandelt eine gebuchte Probestunde wie einen Abo-Termin", () => {
    const { naechste } = naechsteTermine([], [buchung()], [], new Date("2026-08-27T06:00:00Z"));
    expect(naechste[0].kursName).toBe("Bachata Level 1");
    expect(naechste[0].quelle).toBe("buchung");
  });

  it("zeigt denselben Kurstag nur einmal, wenn Abo und Buchung ihn beide liefern", () => {
    const alle = sammleTermine([abo()], [buchung({ kursId: "kurs-salsa", kursName: "Salsa Level 2", datum: "2026-08-27", startZeit: "19:00:00", endZeit: "20:00:00" })], [], new Date("2026-08-27T06:00:00Z"));
    const am27 = alle.filter((t) => t.datum === "2026-08-27");
    expect(am27).toHaveLength(1);
    // Das Abo gewinnt, denn daran haengt der Check-in.
    expect(am27[0].quelle).toBe("abo");
  });

  it("zeigt alle Kurse desselben Tages, auch wenn sie nacheinander liegen", () => {
    // Wunsch aus dem Betrieb (2026-09-10): Wer an einem Abend zwei Kurse
    // hintereinander hat, sah nur den ersten — der zweite stand bloß als
    // Zeile „Danach: …". Ein Kurstag ist die Einheit, in der man plant.
    const { naechste, danach } = naechsteTermine([
        abo(),
        abo({
          kursId: "kurs-spaet",
          kursName: "Bachata Level 1",
          startZeit: "20:15:00",
          endZeit: "21:15:00",
        }),
      ], [], [], new Date("2026-08-27T06:00:00Z"));

    expect(naechste).toHaveLength(2);
    // In zeitlicher Reihenfolge, nicht in der Reihenfolge der Abos.
    expect(naechste.map((t) => t.startZeit)).toEqual(["19:00:00", "20:15:00"]);
    expect(naechste.every((t) => t.datum === "2026-08-27")).toBe(true);
    // Der Ausblick zeigt den nächsten Kurs*tag*, nicht die nächste Stunde.
    expect(danach?.datum).toBe("2026-09-03");
  });

  it("zeigt zwei gleichzeitige Termine beide, statt willkürlich einen zu wählen", () => {
    const { naechste, danach } = naechsteTermine([abo(), abo({ kursId: "kurs-zweit", kursName: "Bachata Level 1", raum: "Saal 2" })], [], [], new Date("2026-08-27T06:00:00Z"));
    expect(naechste).toHaveLength(2);
    expect(naechste.map((t) => t.kursName).sort()).toEqual(["Bachata Level 1", "Salsa Level 2"]);
    // Der „Danach" ist dann der Termin der Folgewoche, nicht der Zwilling.
    expect(danach?.datum).toBe("2026-09-03");
  });

  it("liefert nichts, wenn es weder Abo noch Buchung gibt", () => {
    expect(naechsteTermine([], [], [], new Date("2026-08-27T06:00:00Z"))).toEqual({ naechste: [], danach: null });
  });

  it("rechnet Kurszeiten als Wiener Wandzeit, nicht als UTC", () => {
    const { naechste } = naechsteTermine([abo()], [], [], new Date("2026-08-27T06:00:00Z"));
    // 19:00 Wiener Sommerzeit = 17:00 UTC.
    expect(naechste[0].beginn.toISOString()).toBe("2026-08-27T17:00:00.000Z");
  });

  it("lässt eine Buchung fallen, deren Termin vorbei ist", () => {
    const { naechste } = naechsteTermine([], [buchung({ datum: "2026-08-20" })], [], new Date("2026-08-27T06:00:00Z"));
    expect(naechste).toHaveLength(0);
  });
});
