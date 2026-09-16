import { describe, it, expect } from "vitest";
import {
  CODE_LAENGE,
  codeFehlertext,
  codeVollstaendig,
  nurZiffern,
  schluesselLesbar,
  uhrzeitHinweisZeigen,
} from "./zweite-stufe";

describe("nurZiffern", () => {
  it("entfernt das Leerzeichen, das kopierte Codes mitbringen", () => {
    expect(nurZiffern("123 456")).toBe("123456");
  });

  it("entfernt ein angehängtes Leerzeichen vom automatischen Ausfüllen", () => {
    expect(nurZiffern("123456 ")).toBe("123456");
  });

  it("kürzt auf die Codelänge, statt mehr durchzulassen", () => {
    expect(nurZiffern("1234567890")).toHaveLength(CODE_LAENGE);
  });

  it("lässt von Buchstaben nichts übrig", () => {
    expect(nurZiffern("abcdef")).toBe("");
  });
});

describe("codeVollstaendig", () => {
  it("erkennt den fertigen Code auch mit Leerzeichen", () => {
    expect(codeVollstaendig("123 456")).toBe(true);
  });

  it("gilt bei fünf Ziffern noch nicht als fertig", () => {
    expect(codeVollstaendig("12345")).toBe(false);
  });

  it("gilt bei leerer Eingabe nicht als fertig", () => {
    expect(codeVollstaendig("")).toBe(false);
  });
});

describe("schluesselLesbar", () => {
  it("setzt Vierergruppen", () => {
    expect(schluesselLesbar("ABCDEFGH1234")).toBe("ABCD EFGH 1234");
  });

  it("lässt eine angebrochene letzte Gruppe stehen", () => {
    expect(schluesselLesbar("ABCDEF")).toBe("ABCD EF");
  });

  it("kommt mit einem leeren Schlüssel zurecht", () => {
    expect(schluesselLesbar("")).toBe("");
  });
});

describe("uhrzeitHinweisZeigen", () => {
  it("schweigt beim ersten Fehlschlag — meist ein Tippfehler", () => {
    expect(uhrzeitHinweisZeigen(1)).toBe(false);
  });

  it("meldet sich ab dem zweiten Fehlschlag", () => {
    expect(uhrzeitHinweisZeigen(2)).toBe(true);
  });
});

describe("codeFehlertext", () => {
  it("benennt ein erreichtes Limit, statt es als falschen Code auszugeben", () => {
    expect(codeFehlertext({ message: "Request rate limit reached" })).toContain("Zu viele Versuche");
  });

  it("verrät im Grundfall nicht, ob der Code falsch oder abgelaufen war", () => {
    const text = codeFehlertext({ message: "Invalid TOTP code entered" });
    expect(text).toContain("stimmt nicht");
    expect(text.toLowerCase()).not.toContain("abgelaufen");
  });

  it("kommt ohne Fehlerobjekt zurecht", () => {
    expect(codeFehlertext(null)).toBeTruthy();
  });
});
