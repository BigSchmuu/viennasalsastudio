import { describe, it, expect } from "vitest";
import {
  TEMPLATE_REGISTRY,
  getTemplateMeta,
  isTemplateKey,
  findInvalidPlaceholders,
  substitutePlain,
  substituteHtml,
} from "./template-registry";

describe("TEMPLATE_REGISTRY", () => {
  // Die feste Zahl war hier nicht die Aussage — sie musste bei jeder neuen
  // Vorlage nachgezogen werden und hätte irgendwann nur noch bestätigt, dass
  // jemand sie hochgezählt hat. Was wirklich zählt: kein Schlüssel doppelt.
  it("vergibt jeden Vorlagen-Schlüssel genau einmal", () => {
    const keys = TEMPLATE_REGISTRY.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeGreaterThan(0);
  });

  it("gives every template a boldPlaceholder that's in its own placeholders list", () => {
    for (const meta of TEMPLATE_REGISTRY) {
      expect(meta.placeholders).toContain(meta.boldPlaceholder);
    }
  });

  it("uses only declared placeholders in its own default texts", () => {
    for (const meta of TEMPLATE_REGISTRY) {
      const invalid = new Set<string>();
      for (const text of Object.values(meta.defaults)) {
        for (const name of findInvalidPlaceholders(text, meta.placeholders)) invalid.add(name);
      }
      expect([...invalid]).toEqual([]);
    }
  });
});

describe("getTemplateMeta / isTemplateKey", () => {
  it("finds a known key and returns undefined for an unknown one", () => {
    expect(getTemplateMeta("warteliste")?.eventGroupLabel).toBe("Warteliste");
    expect(getTemplateMeta("does-not-exist")).toBeUndefined();
  });

  it("distinguishes valid from invalid template keys", () => {
    expect(isTemplateKey("buchungsstatus_bestaetigt")).toBe(true);
    expect(isTemplateKey("buchungsstatus_bestaetigt_typo")).toBe(false);
  });
});

describe("findInvalidPlaceholders", () => {
  it("returns an empty list when every placeholder is allowed", () => {
    expect(findInvalidPlaceholders("Hallo {kurs}, am {datum}", ["kurs", "datum"])).toEqual([]);
  });

  it("flags a typo'd placeholder", () => {
    expect(findInvalidPlaceholders("Hallo {kurss}", ["kurs"])).toEqual(["kurss"]);
  });

  it("flags a placeholder borrowed from a different template", () => {
    expect(findInvalidPlaceholders("Dein Abo {abo} für {kurs}", ["kurs"])).toEqual(["abo"]);
  });

  it("de-duplicates repeated invalid placeholders", () => {
    expect(findInvalidPlaceholders("{foo} und nochmal {foo}", [])).toEqual(["foo"]);
  });

  it("returns an empty list for plain text with no placeholders at all", () => {
    expect(findInvalidPlaceholders("Kein Platzhalter hier.", ["kurs"])).toEqual([]);
  });
});

describe("substitutePlain", () => {
  it("replaces every known placeholder without escaping", () => {
    expect(substitutePlain("Hallo {kurs}!", { kurs: "Salsa & Co" })).toBe("Hallo Salsa & Co!");
  });

  it("leaves an unknown placeholder untouched rather than crashing", () => {
    expect(substitutePlain("Hallo {unbekannt}!", { kurs: "Salsa" })).toBe("Hallo {unbekannt}!");
  });
});

describe("substituteHtml", () => {
  it("escapes the substituted value", () => {
    const result = substituteHtml("Kurs: {kurs}", { kurs: '<img src=x onerror="alert(1)">' }, "kurs");
    expect(result).not.toContain("<img");
    expect(result).toContain("&lt;img");
  });

  it("bold-wraps only the designated placeholder, not others", () => {
    const result = substituteHtml("{kurs} am {datum}", { kurs: "Salsa", datum: "07.09.2026" }, "kurs");
    expect(result).toBe("<strong>Salsa</strong> am 07.09.2026");
  });
});
