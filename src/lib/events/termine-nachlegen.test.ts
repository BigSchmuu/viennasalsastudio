import { describe, it, expect } from "vitest";
import { geerbteSpalten, terminZeitpunkte } from "@/lib/events/termine-nachlegen";

describe("terminZeitpunkte", () => {
  it("liest die Uhrzeit als Wiener Zeit, nicht als UTC", () => {
    // 21:00 in Wien ist im Sommer 19:00 UTC.
    expect(terminZeitpunkte("2026-09-25", "21:00", null).starts_at).toBe("2026-09-25T19:00:00.000Z");
  });

  it("legt ein Ende vor dem Beginn auf den Folgetag", () => {
    // Eine Party von 21:00 bis 02:00 ist ein Abend, keine 19 Stunden.
    const { starts_at, ends_at } = terminZeitpunkte("2026-09-25", "21:00", "02:00");
    expect(starts_at).toBe("2026-09-25T19:00:00.000Z");
    expect(ends_at).toBe("2026-09-26T00:00:00.000Z");
  });

  it("lässt das Ende offen, wenn die Serie keines nennt", () => {
    expect(terminZeitpunkte("2026-09-25", "21:00", null).ends_at).toBeNull();
  });

  it("rechnet auch über den Wechsel auf Winterzeit richtig", () => {
    // Die Umstellung ist in der Nacht auf den 25.10.2026: davor UTC+2, danach UTC+1.
    expect(terminZeitpunkte("2026-10-23", "21:00", null).starts_at).toBe("2026-10-23T19:00:00.000Z");
    expect(terminZeitpunkte("2026-10-30", "21:00", null).starts_at).toBe("2026-10-30T20:00:00.000Z");
  });
});

describe("geerbteSpalten", () => {
  const serie = {
    id: "s1",
    name: "Freitagsparty",
    slug: "freitagsparty",
    description: "Jede Woche",
    location: "Studio",
    event_type_id: "art-1",
    sales_mode: "tickets",
    weekday: 4,
    start_time: "21:00",
    end_time: "02:00",
    starts_on: "2026-09-04",
    ends_on: null,
    pause_in_holidays: true,
    capacity: 80,
    price_normal: 15,
    price_student: 10,
  };

  it("gibt dem Termin weiter, was für den Kunden sichtbar ist", () => {
    expect(geerbteSpalten(serie)).toEqual({
      name: "Freitagsparty",
      description: "Jede Woche",
      location: "Studio",
      event_type_id: "art-1",
      sales_mode: "tickets",
      capacity: 80,
      price_normal: 15,
      price_student: 10,
    });
  });

  it("vererbt nichts, was nur die Regel betrifft", () => {
    // Wochentag, Zeitraum und Ferienpause gehören der Serie: Ein einzeln
    // verlegter Termin darf vom Rhythmus abweichen, ohne ihn zu ändern.
    const spalten = geerbteSpalten(serie) as Record<string, unknown>;
    for (const feld of ["weekday", "starts_on", "ends_on", "pause_in_holidays", "slug", "id"]) {
      expect(spalten).not.toHaveProperty(feld);
    }
  });
});
