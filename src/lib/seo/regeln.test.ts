import { describe, it, expect } from "vitest";
import { eventDarfInDenIndex, eventNochNichtVorbei } from "@/lib/seo/regeln";

// `sprachAdressen` fehlt hier mit Absicht: Die Adressberechnung der App zieht
// next-intls Navigation herein, die im Unit-Test nicht aufzulösen ist. Geprüft
// wird sie in der QA am ausgelieferten Seitenkopf — dort zählt sie.

const JETZT = new Date("2026-10-01T12:00:00Z");

function event(felder: Partial<Parameters<typeof eventDarfInDenIndex>[0]> = {}) {
  return {
    status: "geplant",
    startsAt: "2026-10-05T19:00:00Z",
    endsAt: "2026-10-05T23:00:00Z",
    seriesId: null,
    ...felder,
  };
}

describe("eventDarfInDenIndex", () => {
  it("nimmt ein kommendes Einzelevent auf", () => {
    expect(eventDarfInDenIndex(event(), JETZT)).toBe(true);
  });

  it("lässt einen Serientermin draußen", () => {
    // Sonst stünden binnen eines Jahres fünfzig fast gleiche Seiten derselben
    // Party im Index — die Serienseite vertritt sie.
    expect(eventDarfInDenIndex(event({ seriesId: "serie-1" }), JETZT)).toBe(false);
  });

  it("lässt ein abgesagtes Event draußen", () => {
    expect(eventDarfInDenIndex(event({ status: "abgesagt" }), JETZT)).toBe(false);
  });

  it("lässt ein vergangenes Event draußen", () => {
    // Wer zuerst einen Termin von vor einem Jahr findet, hält das Studio für
    // eingeschlafen.
    const vorbei = event({ startsAt: "2026-09-20T19:00:00Z", endsAt: "2026-09-20T23:00:00Z" });
    expect(eventDarfInDenIndex(vorbei, JETZT)).toBe(false);
  });

  it("nimmt ein laufendes Event noch auf", () => {
    const laufend = event({ startsAt: "2026-10-01T10:00:00Z", endsAt: "2026-10-01T18:00:00Z" });
    expect(eventDarfInDenIndex(laufend, JETZT)).toBe(true);
  });
});

describe("eventNochNichtVorbei", () => {
  it("gibt einem Event ohne Ende einen Tag", () => {
    // Dieselbe Grenze wie beim Ticketverkauf (PROJ-53).
    expect(eventNochNichtVorbei("2026-10-01T02:00:00Z", null, JETZT)).toBe(true);
    expect(eventNochNichtVorbei("2026-09-29T02:00:00Z", null, JETZT)).toBe(false);
  });

  it("hält sich sonst an das Ende", () => {
    expect(eventNochNichtVorbei("2026-09-01T10:00:00Z", "2026-10-01T18:00:00Z", JETZT)).toBe(true);
    expect(eventNochNichtVorbei("2026-09-01T10:00:00Z", "2026-10-01T11:00:00Z", JETZT)).toBe(false);
  });
});
