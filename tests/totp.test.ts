import { describe, it, expect } from "vitest";
import { totpCode, restDesFensters } from "./totp";

/**
 * Die Prüfwerte aus RFC 6238, Anhang B. Schlüssel dort: die ASCII-Zeichen
 * „12345678901234567890" — hier in Base32, so wie Supabase ihn herausgibt.
 */
const RFC_SCHLUESSEL = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("totpCode — Prüfwerte aus RFC 6238", () => {
  const faelle: Array<[number, string]> = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ];

  for (const [sekunden, erwartet] of faelle) {
    it(`bei T=${sekunden} ergibt ${erwartet}`, () => {
      expect(totpCode(RFC_SCHLUESSEL, sekunden * 1000, 8)).toBe(erwartet);
    });
  }
});

describe("totpCode — Form", () => {
  it("liefert sechs Ziffern", () => {
    expect(totpCode(RFC_SCHLUESSEL, 59_000)).toMatch(/^\d{6}$/);
  });

  it("liefert die letzten sechs Stellen des achtstelligen Codes", () => {
    expect(totpCode(RFC_SCHLUESSEL, 59_000)).toBe("287082");
  });

  it("bleibt innerhalb eines 30-Sekunden-Fensters gleich", () => {
    expect(totpCode(RFC_SCHLUESSEL, 30_000)).toBe(totpCode(RFC_SCHLUESSEL, 59_999));
  });

  it("wechselt mit dem Fenster", () => {
    expect(totpCode(RFC_SCHLUESSEL, 59_999)).not.toBe(totpCode(RFC_SCHLUESSEL, 60_000));
  });

  it("kommt mit Leerzeichen und Kleinschreibung im Schlüssel zurecht", () => {
    expect(totpCode("gezd gnbv gy3t qojq gezd gnbv gy3t qojq", 59_000)).toBe("287082");
  });
});

describe("restDesFensters", () => {
  it("meldet am Anfang eines Fensters die vollen 30 Sekunden", () => {
    expect(restDesFensters(60_000)).toBe(30_000);
  });

  it("meldet kurz vor dem Wechsel wenig", () => {
    expect(restDesFensters(59_500)).toBe(500);
  });
});
