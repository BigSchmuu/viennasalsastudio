import { describe, it, expect } from "vitest";
import { bestaetigtesKonto } from "./bestehendes-konto";

describe("bestaetigtesKonto", () => {
  const konten = [
    { id: "bestaetigt", email: "tanz@example.test", email_confirmed_at: "2026-08-01T10:00:00Z" },
    { id: "unbestaetigt", email: "halb@example.test", email_confirmed_at: null },
  ];

  it("findet ein bestätigtes Konto, unabhängig von Groß-/Kleinschreibung und Leerzeichen", () => {
    expect(bestaetigtesKonto(konten, " Tanz@Example.test ")).toBe("bestaetigt");
  });

  it("übergeht ein nie bestätigtes Konto — dort schickt Supabase die Bestätigung selbst", () => {
    expect(bestaetigtesKonto(konten, "halb@example.test")).toBeNull();
  });

  it("liefert für eine unbekannte Adresse nichts", () => {
    expect(bestaetigtesKonto(konten, "neu@example.test")).toBeNull();
  });
});
