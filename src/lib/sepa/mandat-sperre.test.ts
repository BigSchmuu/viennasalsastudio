import { describe, it, expect } from "vitest";
import { widerrufeneInhaber, widerrufeneMeldung } from "./mandat-sperre";

const POS = (ref: string, name: string) => ({ mandate_reference: ref, account_holder_name: name });
const MANDAT = (ref: string, widerrufen: string | null) => ({
  mandate_reference: ref,
  revoked_at: widerrufen,
});

describe("PROJ-105: Keine Lastschrift gegen ein widerrufenes Mandat", () => {
  it("lässt einen Lauf mit gültigen Mandaten durch", () => {
    const inhaber = widerrufeneInhaber(
      [POS("M1", "Anna Berger"), POS("M2", "Bodo Christ")],
      [MANDAT("M1", null), MANDAT("M2", null)]
    );
    expect(inhaber).toEqual([]);
  });

  it("nennt den Kontoinhaber der gesperrten Position", () => {
    const inhaber = widerrufeneInhaber(
      [POS("M1", "Anna Berger"), POS("M2", "Bodo Christ")],
      [MANDAT("M1", null), MANDAT("M2", "2026-11-17T18:00:00Z")]
    );
    expect(inhaber).toEqual(["Bodo Christ"]);
  });

  it("nennt jeden Inhaber einmal, auch bei mehreren Positionen", () => {
    const inhaber = widerrufeneInhaber(
      [POS("M1", "Anna Berger"), POS("M1", "Anna Berger")],
      [MANDAT("M1", "2026-11-17T18:00:00Z")]
    );
    expect(inhaber).toEqual(["Anna Berger"]);
  });

  it("sortiert nach deutschem Alphabet, damit die Meldung lesbar bleibt", () => {
    const inhaber = widerrufeneInhaber(
      [POS("M1", "Örtlich Zweite"), POS("M2", "Anna Erste"), POS("M3", "Übrig Dritte")],
      [
        MANDAT("M1", "2026-11-17T18:00:00Z"),
        MANDAT("M2", "2026-11-17T18:00:00Z"),
        MANDAT("M3", "2026-11-17T18:00:00Z"),
      ]
    );
    expect(inhaber).toEqual(["Anna Erste", "Örtlich Zweite", "Übrig Dritte"]);
  });

  it("hält eine Position ohne bekanntes Mandat nicht für gesperrt", () => {
    // Eine andere Lücke, bewusst nicht Gegenstand dieser Sperre.
    expect(widerrufeneInhaber([POS("M9", "Ohne Mandat")], [])).toEqual([]);
  });

  it("nennt in der Meldung den Namen und den Weg zurück", () => {
    const text = widerrufeneMeldung(["Bodo Christ"]);
    expect(text).toContain("Bodo Christ");
    expect(text).toContain("darf nicht abgebucht werden");
    expect(text).toContain("neu ein");
    expect(text).toContain("Barzahlungsliste");
  });

  it("spricht bei mehreren in der Mehrzahl", () => {
    const text = widerrufeneMeldung(["Anna Berger", "Bodo Christ"]);
    expect(text).toContain("diese Positionen");
    expect(text).toContain("Anna Berger, Bodo Christ");
  });
});
