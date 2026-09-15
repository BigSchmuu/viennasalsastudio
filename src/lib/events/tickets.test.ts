import { describe, it, expect } from "vitest";
import {
  artZustand,
  einheitImEvent,
  einheitenFuerArt,
  erlaubteZahlungsarten,
  freiePlaetzeEinheit,
  istKostenlos,
  nachZeit,
  restKontingent,
  rollePasst,
  stornierbarMitFrist,
  vorgeschlageneEinheit,
  waehlbareEinheiten,
  type Einheit,
  type Ticketart,
} from "@/lib/events/tickets";

function einheit(felder: Partial<Einheit> & { id: string }): Einheit {
  return {
    titel: `Einheit ${felder.id}`,
    startsAt: "2026-10-03T12:00:00Z",
    endsAt: null,
    kapazitaet: 20,
    belegt: 0,
    ...felder,
  };
}

function art(felder: Partial<Ticketart> = {}): Ticketart {
  return {
    id: "art-1",
    name: "Full Pass",
    preisNormal: 60,
    preisStudierend: 50,
    kontingent: null,
    geltung: "all",
    einheitIds: [],
    imVerkauf: true,
    verkauft: 0,
    ...felder,
  };
}

describe("einheitenFuerArt", () => {
  const alle = [einheit({ id: "a" }), einheit({ id: "b" }), einheit({ id: "c" })];

  it("gibt bei „alle Einheiten“ das ganze Programm", () => {
    expect(einheitenFuerArt(art(), alle).map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("gibt bei fester Auswahl nur die genannten", () => {
    const auswahl = art({ geltung: "selected", einheitIds: ["a", "c"] });
    expect(einheitenFuerArt(auswahl, alle).map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("gibt bei „Kunde wählt“ alle zur Auswahl", () => {
    expect(einheitenFuerArt(art({ geltung: "choice" }), alle)).toHaveLength(3);
  });
});

describe("freiePlaetzeEinheit und restKontingent", () => {
  it("rechnet freie Plätze aus Kapazität und Belegung", () => {
    expect(freiePlaetzeEinheit(einheit({ id: "a", kapazitaet: 20, belegt: 18 }))).toBe(2);
  });

  it("lässt eine Einheit ohne Kapazität unbegrenzt", () => {
    expect(freiePlaetzeEinheit(einheit({ id: "a", kapazitaet: null, belegt: 99 }))).toBeNull();
  });

  it("wird nie negativ, wenn die Kapazität nachträglich gesenkt wurde", () => {
    // Verkaufte Tickets bleiben gültig; verkauft wird bloß nichts mehr.
    expect(freiePlaetzeEinheit(einheit({ id: "a", kapazitaet: 10, belegt: 14 }))).toBe(0);
  });

  it("rechnet den Rest eines Kontingents", () => {
    expect(restKontingent(art({ kontingent: 30, verkauft: 28 }))).toBe(2);
    expect(restKontingent(art({ kontingent: null, verkauft: 99 }))).toBeNull();
  });
});

describe("artZustand", () => {
  it("ist kaufbar, solange Kontingent und Plätze reichen", () => {
    expect(artZustand(art(), [einheit({ id: "a" })])).toBe("kaufbar");
  });

  it("ist ausverkauft, wenn das Kontingent erschöpft ist", () => {
    expect(artZustand(art({ kontingent: 5, verkauft: 5 }), [einheit({ id: "a" })])).toBe("ausverkauft");
  });

  it("ist bei fester Geltung schon ausverkauft, wenn eine einzige Einheit voll ist", () => {
    // Ein Full Pass, dessen zweite Einheit voll ist, ist kein halber Full Pass.
    const einheiten = [einheit({ id: "a" }), einheit({ id: "b", kapazitaet: 10, belegt: 10 })];
    expect(artZustand(art(), einheiten)).toBe("ausverkauft");
  });

  it("bleibt bei „Kunde wählt“ kaufbar, solange eine Einheit Platz hat", () => {
    const einheiten = [einheit({ id: "a", kapazitaet: 10, belegt: 10 }), einheit({ id: "b" })];
    expect(artZustand(art({ geltung: "choice" }), einheiten)).toBe("kaufbar");
  });

  it("nennt eine vom Verkauf genommene Art beim Namen", () => {
    // Nicht „ausverkauft": Verkauft wird sie nicht mehr, aber voll ist sie nicht.
    expect(artZustand(art({ imVerkauf: false }), [einheit({ id: "a" })])).toBe("nichtImVerkauf");
  });

  it("ist ohne Einheiten allein vom Kontingent abhängig", () => {
    expect(artZustand(art(), [])).toBe("kaufbar");
    expect(artZustand(art({ kontingent: 1, verkauft: 1 }), [])).toBe("ausverkauft");
  });
});

describe("waehlbareEinheiten", () => {
  it("bietet nur Einheiten mit Platz an", () => {
    const einheiten = [einheit({ id: "a", kapazitaet: 5, belegt: 5 }), einheit({ id: "b" })];
    expect(waehlbareEinheiten(art({ geltung: "choice" }), einheiten).map((e) => e.id)).toEqual(["b"]);
  });

  it("gibt nichts zurück, wenn der Kunde gar nicht wählt", () => {
    expect(waehlbareEinheiten(art(), [einheit({ id: "a" })])).toEqual([]);
  });
});

describe("stornierbarMitFrist", () => {
  const jetzt = new Date("2026-10-01T09:00:00Z");

  it("erlaubt das Stornieren außerhalb der Frist", () => {
    expect(stornierbarMitFrist("2026-10-08T18:00:00Z", 3, jetzt)).toBe(true);
  });

  it("sperrt es innerhalb der Frist", () => {
    expect(stornierbarMitFrist("2026-10-02T18:00:00Z", 3, jetzt)).toBe(false);
  });

  it("trennt genau an der Frist", () => {
    expect(stornierbarMitFrist("2026-10-04T18:00:00Z", 3, jetzt)).toBe(true);
    expect(stornierbarMitFrist("2026-10-03T18:00:00Z", 3, jetzt)).toBe(false);
  });

  it("lässt bei einer Frist von 0 Tagen bis zum Beginn stornieren", () => {
    expect(stornierbarMitFrist("2026-10-01T20:00:00Z", 0, jetzt)).toBe(true);
    expect(stornierbarMitFrist("2026-10-01T08:00:00Z", 0, jetzt)).toBe(false);
  });
});

describe("Zahlungsarten", () => {
  it("gibt genau das weiter, was das Event erlaubt", () => {
    expect(erlaubteZahlungsarten("sepa")).toEqual(["sepa"]);
    expect(erlaubteZahlungsarten("onsite")).toEqual(["onsite"]);
    expect(erlaubteZahlungsarten("both")).toEqual(["sepa", "onsite"]);
  });

  it("erkennt eine kostenlose Ticketart", () => {
    expect(istKostenlos({ preisNormal: 0, preisStudierend: 0 })).toBe(true);
    expect(istKostenlos({ preisNormal: 0, preisStudierend: 5 })).toBe(false);
  });
});

describe("rollePasst", () => {
  it("lässt alles durch, wenn kein Abstand eingestellt ist", () => {
    expect(rollePasst("leader", { leader: 10, follower: 0 }, null)).toBe(true);
  });

  it("lässt die Rolle zu, solange der Abstand bleibt", () => {
    expect(rollePasst("leader", { leader: 5, follower: 4 }, 2)).toBe(true);
  });

  it("weist die Rolle ab, die den Abstand sprengt", () => {
    expect(rollePasst("leader", { leader: 6, follower: 4 }, 2)).toBe(false);
    // Die andere Rolle bringt die Runde näher zusammen und geht.
    expect(rollePasst("follower", { leader: 6, follower: 4 }, 2)).toBe(true);
  });

  it("lässt „Beide“ immer zu", () => {
    expect(rollePasst("both", { leader: 20, follower: 0 }, 1)).toBe(true);
  });
});

describe("einheitImEvent", () => {
  const event = { startsAt: "2026-10-03T08:00:00Z", endsAt: "2026-10-03T18:00:00Z" };

  it("nimmt eine Einheit im Zeitraum an", () => {
    expect(einheitImEvent({ startsAt: "2026-10-03T10:00:00Z", endsAt: "2026-10-03T12:00:00Z" }, event)).toBe(true);
  });

  it("weist eine Einheit vor dem Event ab", () => {
    expect(einheitImEvent({ startsAt: "2026-10-03T07:00:00Z", endsAt: null }, event)).toBe(false);
  });

  it("weist eine Einheit ab, die über das Ende hinausragt", () => {
    expect(einheitImEvent({ startsAt: "2026-10-03T17:00:00Z", endsAt: "2026-10-03T19:00:00Z" }, event)).toBe(false);
  });

  it("weist ein Ende vor dem Beginn ab", () => {
    expect(einheitImEvent({ startsAt: "2026-10-03T12:00:00Z", endsAt: "2026-10-03T10:00:00Z" }, event)).toBe(false);
  });

  it("gibt einem Event ohne Ende einen Tag Spielraum", () => {
    const offen = { startsAt: "2026-10-03T08:00:00Z", endsAt: null };
    expect(einheitImEvent({ startsAt: "2026-10-03T20:00:00Z", endsAt: null }, offen)).toBe(true);
    expect(einheitImEvent({ startsAt: "2026-10-05T10:00:00Z", endsAt: null }, offen)).toBe(false);
  });
});

describe("vorgeschlageneEinheit", () => {
  const einheiten = [
    { id: "b", startsAt: "2026-10-03T14:00:00Z", endsAt: "2026-10-03T16:00:00Z" },
    { id: "a", startsAt: "2026-10-03T10:00:00Z", endsAt: "2026-10-03T12:00:00Z" },
  ];

  it("sortiert das Programm nach Zeit", () => {
    expect(nachZeit(einheiten).map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("schlägt die laufende Einheit vor", () => {
    expect(vorgeschlageneEinheit(einheiten, new Date("2026-10-03T11:00:00Z"))?.id).toBe("a");
  });

  it("schlägt vor dem Beginn die erste vor", () => {
    expect(vorgeschlageneEinheit(einheiten, new Date("2026-10-03T08:00:00Z"))?.id).toBe("a");
  });

  it("schlägt in der Pause die nächste vor", () => {
    expect(vorgeschlageneEinheit(einheiten, new Date("2026-10-03T13:00:00Z"))?.id).toBe("b");
  });

  it("bleibt nach der letzten bei der letzten", () => {
    // Am Einlass räumt man nach: Wer spät kommt, gehört zur letzten Einheit.
    expect(vorgeschlageneEinheit(einheiten, new Date("2026-10-03T20:00:00Z"))?.id).toBe("b");
  });

  it("gibt ohne Einheiten nichts zurück", () => {
    expect(vorgeschlageneEinheit([], new Date())).toBeNull();
  });
});
