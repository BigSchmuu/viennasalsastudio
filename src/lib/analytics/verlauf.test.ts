import { describe, it, expect } from "vitest";
import { kalendertagInWien, zaehleJeZeitraum } from "./verlauf";
import type { Bucket } from "./period";

const OKTOBER: Bucket = { key: "2026-10", label: "Okt 26", from: "2026-10-01", to: "2026-10-31" };
const NOVEMBER: Bucket = { key: "2026-11", label: "Nov 26", from: "2026-11-01", to: "2026-11-30" };

describe("kalendertagInWien", () => {
  it("nimmt bei einer reinen Datumsangabe denselben Tag", () => {
    expect(kalendertagInWien("2026-10-31")).toBe("2026-10-31");
  });

  // Der Fall, um den es geht: Ein Abschluss kurz vor Mitternacht Wiener Zeit
  // steht in der Datenbank mit dem UTC-Tag davor.
  it("rechnet einen Zeitstempel auf den Wiener Tag um", () => {
    // 31.10. um 23:30 Wiener Zeit (UTC+1 ab dem Sommerzeitende)
    expect(kalendertagInWien("2026-10-31T22:30:00Z")).toBe("2026-10-31");
    // 1.11. um 00:30 Wiener Zeit — in UTC noch der 31.10.
    expect(kalendertagInWien("2026-10-31T23:30:00Z")).toBe("2026-11-01");
  });
});

describe("zaehleJeZeitraum", () => {
  it("zählt je Zeitraum getrennt", () => {
    const zahlen = zaehleJeZeitraum(
      [OKTOBER, NOVEMBER],
      ["2026-10-05", "2026-10-20", "2026-11-02"]
    );
    expect(zahlen).toEqual([2, 1]);
  });

  it("zählt den ersten und den letzten Tag eines Zeitraums mit", () => {
    expect(zaehleJeZeitraum([OKTOBER], ["2026-10-01", "2026-10-31"])).toEqual([2]);
  });

  it("lässt alles außerhalb weg", () => {
    expect(zaehleJeZeitraum([OKTOBER], ["2026-09-30", "2026-11-01"])).toEqual([0]);
  });

  // Ein Abo ohne Kündigungsdatum ist nicht gekündigt.
  it("überspringt leere Werte", () => {
    expect(zaehleJeZeitraum([OKTOBER], [null, undefined, "", "2026-10-07"])).toEqual([1]);
  });

  // Genau die Grenze, an der die alte Zeile aus zehn Zeichen falsch zählte.
  it("ordnet einen Zeitstempel an der Monatsgrenze dem Wiener Tag zu", () => {
    const zahlen = zaehleJeZeitraum([OKTOBER, NOVEMBER], ["2026-10-31T23:30:00Z"]);
    expect(zahlen).toEqual([0, 1]);
  });

  it("kommt ohne Zeitpunkte und ohne Zeiträume zurecht", () => {
    expect(zaehleJeZeitraum([OKTOBER], [])).toEqual([0]);
    expect(zaehleJeZeitraum([], ["2026-10-07"])).toEqual([]);
  });
});
