import { describe, it, expect } from "vitest";
import { laufArt } from "./laufart";

describe("Welcher geplante Lauf gerade dran ist", () => {
  it("erkennt den Abendlauf", () => {
    expect(laufArt("evening")).toBe("abend");
  });

  it("erkennt den Warteschlangen-Lauf", () => {
    expect(laufArt("queue")).toBe("warteschlange");
  });

  it("ist ohne Angabe der Morgenlauf", () => {
    expect(laufArt(null)).toBe("morgen");
    expect(laufArt(undefined)).toBe("morgen");
    expect(laufArt("")).toBe("morgen");
  });

  it("nimmt Unbekanntes als Morgenlauf — so war es, bevor es den Parameter gab", () => {
    expect(laufArt("abend")).toBe("morgen");
    expect(laufArt("QUEUE")).toBe("morgen");
    expect(laufArt("warteschlange")).toBe("morgen");
  });
});
