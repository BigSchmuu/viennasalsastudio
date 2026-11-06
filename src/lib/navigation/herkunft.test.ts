import { describe, it, expect } from "vitest";
import {
  KUNDENLISTE,
  kuerze,
  kundenakteMitHerkunft,
  kursIdAusHerkunft,
  loeseHerkunftAuf,
} from "./herkunft";

const KURS = "11111111-2222-3333-4444-555555555555";

describe("loeseHerkunftAuf — der Name des Rückwegs", () => {
  it("nennt die Seite, aus der der Klick kam", () => {
    // Mit Artikel: „← Zurück zu den Buchungen“, nicht „zu Buchungen“.
    expect(loeseHerkunftAuf("/admin/buchungen")?.text).toBe("zu den Buchungen");
    expect(loeseHerkunftAuf("/admin/offene-posten")?.text).toBe("zu den offenen Posten");
    expect(loeseHerkunftAuf("/admin/rechnungen")?.text).toBe("zu den Rechnungen");
    expect(loeseHerkunftAuf("/checkin")?.text).toBe("zum Check-in");
  });

  it("nennt bei der Anwesenheitsliste den Kurs", () => {
    const herkunft = loeseHerkunftAuf(`/lehrer/${KURS}`, "Salsa Level 2");
    expect(herkunft?.text).toBe("zur Anwesenheit: Salsa Level 2");
    expect(herkunft?.pfad).toBe(`/lehrer/${KURS}`);
  });

  it("bleibt bei der Art der Seite, wenn der Kursname fehlt", () => {
    // Gelöschter Kurs, nicht lesbarer Kurs: besser schlicht als leer.
    expect(loeseHerkunftAuf(`/lehrer/${KURS}`)?.text).toBe("zur Anwesenheitsliste");
    expect(loeseHerkunftAuf(`/lehrer/${KURS}`, null)?.text).toBe("zur Anwesenheitsliste");
    expect(loeseHerkunftAuf(`/lehrer/${KURS}`, "")?.text).toBe("zur Anwesenheitsliste");
  });

  it("kürzt einen sehr langen Kursnamen, statt den Kopf zu sprengen", () => {
    const lang = "Salsa Cubana für Fortgeschrittene mit Rueda und Partnerwechsel";
    const text = loeseHerkunftAuf(`/lehrer/${KURS}`, lang)?.text ?? "";
    expect(text.startsWith("zur Anwesenheit: Salsa Cubana")).toBe(true);
    expect(text.endsWith("…")).toBe(true);
    expect(text.length).toBeLessThan("zur Anwesenheit: ".length + 41);
  });

  it("nimmt den Suchteil mit, damit Filter und Suche zurückkommen", () => {
    const herkunft = loeseHerkunftAuf("/admin/buchungen?status=open&seite=2");
    expect(herkunft?.pfad).toBe("/admin/buchungen?status=open&seite=2");
    expect(herkunft?.text).toBe("zu den Buchungen");
  });

  it("findet das längere Muster, nicht das kürzere", () => {
    // /admin/lastschriften darf nicht beim Eintrag /admin hängenbleiben.
    expect(loeseHerkunftAuf("/admin/lastschriften/abc")?.text).toBe("zu den Lastschriften");
    expect(loeseHerkunftAuf("/admin/lehrer")?.text).toBe("zu den Lehrerrollen");
    expect(loeseHerkunftAuf("/admin")?.text).toBe("zur Übersicht");
  });
});

describe("loeseHerkunftAuf — wann es keinen benannten Rückweg gibt", () => {
  it("ohne Angabe", () => {
    expect(loeseHerkunftAuf(undefined)).toBeNull();
    expect(loeseHerkunftAuf(null)).toBeNull();
    expect(loeseHerkunftAuf("")).toBeNull();
  });

  it("bei einem fremden Ziel — ein Rückweg darf nicht aus der App führen", () => {
    expect(loeseHerkunftAuf("https://example.com/pwned")).toBeNull();
    expect(loeseHerkunftAuf("//example.com")).toBeNull();
    expect(loeseHerkunftAuf("/\\example.com")).toBeNull();
    expect(loeseHerkunftAuf("javascript:alert(1)")).toBeNull();
    expect(loeseHerkunftAuf("/admin\tvon-woanders")).toBeNull();
    expect(loeseHerkunftAuf("admin/buchungen")).toBeNull();
  });

  it("bei einem internen, aber unbekannten Pfad", () => {
    // Sicher, aber ohne Namen. Lieber der gewohnte Weg als „Zurück zu /admin/ferien“.
    // /admin/ferien darf sich den Namen des Dashboards nicht leihen.
    expect(loeseHerkunftAuf("/admin/ferien")).toBeNull();
    expect(loeseHerkunftAuf("/profil")).toBeNull();
    expect(loeseHerkunftAuf("/kurse")).toBeNull();
  });

  it("bei einer Kundenakte — kein Rückweg im Kreis", () => {
    expect(loeseHerkunftAuf(`${KUNDENLISTE}/${KURS}`)).toBeNull();
    expect(loeseHerkunftAuf(`${KUNDENLISTE}/${KURS}?von=%2Fadmin`)).toBeNull();
  });
});

describe("loeseHerkunftAuf — die Kundenliste als Ursprung", () => {
  it("bekommt keinen zweiten Link, aber ihren Filter zurück", () => {
    const herkunft = loeseHerkunftAuf("/admin/kunden?suche=anna");
    expect(herkunft).toEqual({
      pfad: "/admin/kunden?suche=anna",
      text: "zu Kunden",
      istKundenliste: true,
    });
  });

  it("auch ohne Filter", () => {
    expect(loeseHerkunftAuf("/admin/kunden")?.istKundenliste).toBe(true);
  });
});

describe("Jede verlinkende Stelle hat einen Namen", () => {
  // PROJ-100: 19 Stellen führen in die Kundenakte. Dieser Test wird rot,
  // sobald eine Seite dazukommt, die in die Akte verlinkt, ohne in der
  // Tabelle zu stehen — der Rückweg wäre dort stumm.
  const URSPRUENGE: Array<[string, string]> = [
    [`/lehrer/${KURS}`, "zur Anwesenheitsliste"], // Anwesenheitsliste + Einmal-Gäste
    ["/lehrer", "zu meinen Kursen"],
    ["/checkin", "zum Check-in"],
    ["/admin", "zur Übersicht"], // Geburtstage + Upgrade-Anfragen
    ["/admin/kunden", "zu Kunden"],
    ["/admin/rechnungen", "zu den Rechnungen"],
    ["/admin/buchungen", "zu den Buchungen"],
    ["/admin/offene-posten", "zu den offenen Posten"],
    ["/admin/barzahlungen", "zu den Barzahlungen"],
    ["/admin/lastschriften/4711", "zu den Lastschriften"],
    ["/admin/kuendigungen", "zu den Kündigungen"],
    ["/admin/kurse", "zu den Kursen"], // Warteliste-Dialog
    ["/admin/events", "zu den Events"], // Gästeliste
    ["/admin/gasttaenzer", "zu den Gasttänzern"],
    ["/admin/probestunden", "zu den Probestunden"],
    ["/admin/lehrer", "zu den Lehrerrollen"],
  ];

  it.each(URSPRUENGE)("%s heißt „Zurück %s“", (pfad, text) => {
    expect(loeseHerkunftAuf(pfad)?.text).toBe(text);
  });
});

describe("kursIdAusHerkunft", () => {
  it("holt die Kurs-ID aus der Anwesenheitsliste", () => {
    expect(kursIdAusHerkunft(`/lehrer/${KURS}`)).toBe(KURS);
    expect(kursIdAusHerkunft(`/lehrer/${KURS}?tag=2026-11-04`)).toBe(KURS);
  });

  it("gibt nichts her, was keine Kurs-ID ist", () => {
    expect(kursIdAusHerkunft("/lehrer")).toBeNull();
    expect(kursIdAusHerkunft("/lehrer/nicht-echt")).toBeNull();
    expect(kursIdAusHerkunft(`/lehrer/${KURS}/mehr`)).toBeNull();
    expect(kursIdAusHerkunft("/admin/buchungen")).toBeNull();
    expect(kursIdAusHerkunft("https://example.com/lehrer/" + KURS)).toBeNull();
  });
});

describe("kundenakteMitHerkunft", () => {
  it("hängt den Ursprung an und schützt den Suchteil", () => {
    expect(kundenakteMitHerkunft("abc", "/admin/buchungen?status=open")).toBe(
      "/admin/kunden/abc?von=%2Fadmin%2Fbuchungen%3Fstatus%3Dopen"
    );
  });

  it("bleibt ohne Ursprung der schlichte Pfad", () => {
    expect(kundenakteMitHerkunft("abc", null)).toBe("/admin/kunden/abc");
  });
});

describe("kuerze", () => {
  it("lässt kurze Namen in Ruhe", () => {
    expect(kuerze("Salsa Level 2")).toBe("Salsa Level 2");
  });

  it("schneidet mit Auslassungszeichen", () => {
    expect(kuerze("abcdefghij", 5)).toBe("abcd…");
  });
});
