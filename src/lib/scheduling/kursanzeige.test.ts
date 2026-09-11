import { describe, it, expect } from "vitest";
import { imStundenplan, zeitraumhinweis, anstehendeFerien } from "./kursanzeige";

const HEUTE = "2026-09-11";
const UNBEFRISTET = { von: null, bis: null };

describe("imStundenplan", () => {
  it("zeigt einen unbefristeten Kurs", () => {
    expect(imStundenplan(UNBEFRISTET, HEUTE)).toBe(true);
  });

  it("zeigt einen ausgelaufenen Kurs nicht mehr", () => {
    expect(imStundenplan({ von: null, bis: "2026-09-10" }, HEUTE)).toBe(false);
  });

  it("zeigt einen Kurs, der heute endet, noch", () => {
    // Heute findet er statt — wer hingeht, steht nicht vor verschlossener Tür.
    expect(imStundenplan({ von: null, bis: HEUTE }, HEUTE)).toBe(true);
  });

  it("zeigt einen Kurs, der in drei Wochen beginnt", () => {
    expect(imStundenplan({ von: "2026-10-02", bis: null }, HEUTE)).toBe(true);
  });

  it("zeigt einen Kurs, der erst in fünf Wochen beginnt, noch nicht", () => {
    expect(imStundenplan({ von: "2026-10-16", bis: null }, HEUTE)).toBe(false);
  });
});

describe("zeitraumhinweis", () => {
  it("schweigt bei einem unbefristeten Kurs ohne Vormerkung", () => {
    // Eine Angabe, die immer dasteht, sagt nichts mehr aus.
    expect(zeitraumhinweis({ zeitraum: UNBEFRISTET, umwandlung: null }, HEUTE)).toBeNull();
  });

  it("schweigt, solange das Ende weit weg ist", () => {
    expect(
      zeitraumhinweis({ zeitraum: { von: null, bis: "2026-12-21" }, umwandlung: null }, HEUTE)
    ).toBeNull();
  });

  it("nennt das nahende Ende", () => {
    expect(
      zeitraumhinweis({ zeitraum: { von: null, bis: "2026-09-24" }, umwandlung: null }, HEUTE)
    ).toEqual({ art: "endet", datum: "2026-09-24" });
  });

  it("nennt den Beginn, wenn der Kurs noch nicht läuft", () => {
    expect(
      zeitraumhinweis({ zeitraum: { von: "2026-09-24", bis: null }, umwandlung: null }, HEUTE)
    ).toEqual({ art: "beginnt", datum: "2026-09-24" });
  });

  it("der Beginn geht der Umwandlung vor", () => {
    // Wer noch gar nicht hinkann, braucht nicht zu wissen, was danach kommt.
    expect(
      zeitraumhinweis(
        {
          zeitraum: { von: "2026-09-20", bis: null },
          umwandlung: { name: "Salsa Beginner 2", datum: "2026-09-25" },
        },
        HEUTE
      )
    ).toEqual({ art: "beginnt", datum: "2026-09-20" });
  });

  it("die Umwandlung geht dem Ende vor", () => {
    // „Wird zu Beginner 2" sagt mehr als „endet" — der Kurs hört ja nicht auf.
    expect(
      zeitraumhinweis(
        {
          zeitraum: { von: null, bis: "2026-09-24" },
          umwandlung: { name: "Salsa Beginner 2", datum: "2026-09-25" },
        },
        HEUTE
      )
    ).toEqual({ art: "wirdZu", datum: "2026-09-25", neuerName: "Salsa Beginner 2" });
  });

  it("nennt eine weit entfernte Umwandlung noch nicht", () => {
    expect(
      zeitraumhinweis(
        { zeitraum: UNBEFRISTET, umwandlung: { name: "Beginner 2", datum: "2026-11-01" } },
        HEUTE
      )
    ).toBeNull();
  });
});

describe("anstehendeFerien", () => {
  const ferien = [
    { von: "2026-08-01", bis: "2026-08-14" }, // vorbei
    { von: "2026-09-20", bis: "2026-09-27" }, // steht an
    { von: "2026-12-23", bis: "2027-01-06" }, // weit weg
  ];

  it("nennt nur, was jetzt läuft oder demnächst ansteht", () => {
    expect(anstehendeFerien(ferien, HEUTE)).toEqual([{ von: "2026-09-20", bis: "2026-09-27" }]);
  });

  it("nennt laufende Ferien, auch wenn sie schon begonnen haben", () => {
    expect(anstehendeFerien(ferien, "2026-09-22")).toEqual([
      { von: "2026-09-20", bis: "2026-09-27" },
    ]);
  });
});
