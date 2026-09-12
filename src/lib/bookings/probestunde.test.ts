import { describe, it, expect } from "vitest";
import { probestundenStand, type ProbestundenBuchung } from "./probestunde";

const HEUTE = "2026-09-12";

const buchung = (ueber: Partial<ProbestundenBuchung> = {}): ProbestundenBuchung => ({
  id: "b1",
  type: "trial",
  status: "confirmed",
  chosen_date: "2026-09-20",
  course_id: "k1",
  kursName: "Salsa Beginner 1",
  ...ueber,
});

describe("probestundenStand", () => {
  it("ist frei, wenn es keine Buchungen gibt", () => {
    expect(probestundenStand([], HEUTE)).toEqual({ art: "frei" });
  });

  it("ist frei, wenn nur Drop-ins gebucht sind", () => {
    // Drop-ins sind bezahlt und bleiben unbegrenzt.
    expect(probestundenStand([buchung({ type: "dropin" })], HEUTE).art).toBe("frei");
  });

  it("ist offen, solange der Termin noch aussteht", () => {
    const stand = probestundenStand([buchung()], HEUTE);
    expect(stand).toEqual({
      art: "offen",
      buchungId: "b1",
      kursId: "k1",
      kursName: "Salsa Beginner 1",
      datum: "2026-09-20",
    });
  });

  it("ist heute noch offen, nicht schon verbraucht", () => {
    // Am Kurstag selbst findet die Stunde noch statt.
    expect(probestundenStand([buchung({ chosen_date: HEUTE })], HEUTE).art).toBe("offen");
  });

  it("ist verbraucht, wenn der Termin vorbei ist", () => {
    const stand = probestundenStand([buchung({ chosen_date: "2026-09-05" })], HEUTE);
    expect(stand).toEqual({ art: "verbraucht", datum: "2026-09-05" });
  });

  it("ist wieder frei nach einer Stornierung", () => {
    // Entscheidung des Betreibers: Eine Erkältung darf die Probestunde nicht
    // kosten.
    expect(probestundenStand([buchung({ status: "cancelled" })], HEUTE).art).toBe("frei");
  });

  it("ist wieder frei, wenn der Betreiber abgelehnt hat", () => {
    expect(probestundenStand([buchung({ status: "rejected" })], HEUTE).art).toBe("frei");
  });

  it("nennt bei Altbestand den nächsten anstehenden Termin", () => {
    // Vor dieser Regel konnte ein Kunde mehrere haben. Ihn interessiert der,
    // zu dem er noch hingehen kann.
    const stand = probestundenStand(
      [
        buchung({ id: "alt", chosen_date: "2026-09-01" }),
        buchung({ id: "spaeter", chosen_date: "2026-10-01" }),
        buchung({ id: "naechste", chosen_date: "2026-09-15" }),
      ],
      HEUTE
    );
    expect(stand.art).toBe("offen");
    expect(stand.art === "offen" && stand.buchungId).toBe("naechste");
  });

  it("nennt bei mehreren vergangenen die jüngste", () => {
    const stand = probestundenStand(
      [buchung({ chosen_date: "2026-08-01" }), buchung({ chosen_date: "2026-09-05" })],
      HEUTE
    );
    expect(stand).toEqual({ art: "verbraucht", datum: "2026-09-05" });
  });

  it("übergeht Buchungen ohne Termin", () => {
    expect(probestundenStand([buchung({ chosen_date: null })], HEUTE).art).toBe("frei");
  });
});
