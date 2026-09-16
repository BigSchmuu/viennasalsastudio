import { describe, it, expect } from "vitest";
import { sepaKennung, pruefeKennung, SEPA_MAX_KENNUNG } from "./kennungen";

const UUID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

describe("sepaKennung", () => {
  it("bleibt deutlich unter der Grenze", () => {
    expect(sepaKennung("VSS", UUID).length).toBeLessThanOrEqual(SEPA_MAX_KENNUNG);
  });

  it("bleibt auch mit Zusatz unter der Grenze", () => {
    expect(sepaKennung("VSS", UUID, "FRST").length).toBeLessThanOrEqual(SEPA_MAX_KENNUNG);
  });

  it("benutzt nur erlaubte Zeichen", () => {
    expect(sepaKennung("VSS", UUID, "RCUR")).toMatch(/^[A-Z0-9-]+$/);
  });

  it("liefert für dieselbe Kennung dasselbe Ergebnis", () => {
    expect(sepaKennung("VSS", UUID)).toBe(sepaKennung("VSS", UUID));
  });

  it("unterscheidet verschiedene Kennungen", () => {
    const andere = "9a0c0305-e82c-3301-4f89-11d33f2504e0";
    expect(sepaKennung("VSS", UUID)).not.toBe(sepaKennung("VSS", andere));
  });

  it("trennt FRST und RCUR desselben Laufs", () => {
    expect(sepaKennung("VSS", UUID, "FRST")).not.toBe(sepaKennung("VSS", UUID, "RCUR"));
  });

  it("wirft, wenn das Präfix die Kennung über die Grenze treibt", () => {
    expect(() => sepaKennung("X".repeat(30), UUID)).toThrow(/erlaubt sind 35/);
  });
});

describe("pruefeKennung", () => {
  it("lässt eine gültige Kennung durch", () => {
    expect(() => pruefeKennung("VSS-3F2504E04F8911D3", "MsgId")).not.toThrow();
  });

  it("nennt Feld und Länge, wenn es zu lang ist", () => {
    // Genau der Fall, der die Bank hat abbrechen lassen: „VSS-" plus UUID.
    expect(() => pruefeKennung(`VSS-${UUID}`, "MsgId")).toThrow(/MsgId ist 40 Zeichen/);
  });

  it("lässt Kleinbuchstaben zu — die Norm erlaubt sie", () => {
    expect(() => pruefeKennung("vss-run-1", "MsgId")).not.toThrow();
  });

  it("weist Zeichen ab, an denen Banken sich stoßen", () => {
    expect(() => pruefeKennung("VSS:123", "MsgId")).toThrow(/unerlaubte Zeichen/);
    expect(() => pruefeKennung("VSS 123", "MsgId")).toThrow(/unerlaubte Zeichen/);
    expect(() => pruefeKennung("VSS-ÄÖÜ", "MsgId")).toThrow(/unerlaubte Zeichen/);
  });

  it("weist eine leere Kennung ab", () => {
    expect(() => pruefeKennung("", "MsgId")).toThrow(/ist leer/);
  });
});
