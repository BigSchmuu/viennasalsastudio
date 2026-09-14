import { describe, it, expect } from "vitest";
import { linkTyp, linkZweck } from "./einmal-link";

describe("linkTyp", () => {
  it("kennt die Typen aus den Supabase-Mails", () => {
    expect(linkTyp("signup")).toBe("signup");
    expect(linkTyp("recovery")).toBe("recovery");
    expect(linkTyp("invite")).toBe("invite");
  });

  it("weist Leeres, Unbekanntes und falsche Schreibweisen ab", () => {
    // Ein leerer Typ war 2026-08 der Fehler in der Mailvorlage.
    for (const wert of [null, undefined, "", "admin", "Recovery"]) {
      expect(linkTyp(wert)).toBeNull();
    }
  });
});

describe("linkZweck", () => {
  it("verspricht auf dem Knopf, was der Link tut", () => {
    expect(linkZweck("recovery")).toBe("passwort");
    expect(linkZweck("invite")).toBe("einladung");
    expect(linkZweck("magiclink")).toBe("anmelden");
    expect(linkZweck("signup")).toBe("bestaetigen");
    expect(linkZweck("email")).toBe("bestaetigen");
    expect(linkZweck("email_change")).toBe("bestaetigen");
  });
});
