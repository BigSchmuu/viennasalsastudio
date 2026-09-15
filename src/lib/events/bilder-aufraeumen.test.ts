import { describe, it, expect } from "vitest";
import { verwaisteDateien } from "@/lib/events/bilder-aufraeumen";

const JETZT = new Date("2026-09-15T12:00:00Z");
const vorStunden = (stunden: number) => new Date(JETZT.getTime() - stunden * 3_600_000).toISOString();

describe("verwaisteDateien", () => {
  it("nennt eine Datei, zu der kein Eintrag mehr gehört", () => {
    const gefunden = [{ pfad: "events/a/1.webp", erstellt: vorStunden(48) }];
    expect(verwaisteDateien(new Set(), gefunden, JETZT)).toEqual(["events/a/1.webp"]);
  });

  it("lässt eine Datei mit Eintrag in Ruhe", () => {
    const gefunden = [{ pfad: "events/a/1.webp", erstellt: vorStunden(48) }];
    expect(verwaisteDateien(new Set(["events/a/1.webp"]), gefunden, JETZT)).toEqual([]);
  });

  it("rührt frisch Hochgeladenes nicht an", () => {
    // Zwischen dem Ankommen der Datei und ihrem Eintrag liegen Sekunden — der
    // Lauf darf nicht ausgerechnet dann zuschlagen.
    const gefunden = [{ pfad: "events/a/neu.webp", erstellt: vorStunden(1) }];
    expect(verwaisteDateien(new Set(), gefunden, JETZT)).toEqual([]);
  });

  it("trennt genau an der Schonfrist", () => {
    const gefunden = [
      { pfad: "knapp-davor.webp", erstellt: vorStunden(23) },
      { pfad: "knapp-danach.webp", erstellt: vorStunden(25) },
    ];
    expect(verwaisteDateien(new Set(), gefunden, JETZT)).toEqual(["knapp-danach.webp"]);
  });

  it("räumt mehrere auf einmal weg und lässt die eingetragenen stehen", () => {
    const gefunden = [
      { pfad: "events/a/1.webp", erstellt: vorStunden(48) },
      { pfad: "events/a/2.webp", erstellt: vorStunden(48) },
      { pfad: "serien/b/3.webp", erstellt: vorStunden(48) },
    ];
    const eingetragen = new Set(["events/a/2.webp"]);
    expect(verwaisteDateien(eingetragen, gefunden, JETZT)).toEqual(["events/a/1.webp", "serien/b/3.webp"]);
  });
});
