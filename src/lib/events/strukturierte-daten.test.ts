import { describe, it, expect } from "vitest";
import { eventDaten, alsSkriptInhalt, type EventFuerSuchmaschinen } from "./strukturierte-daten";

const workshop: EventFuerSuchmaschinen = {
  name: "Salsa Workshop",
  description: "Drehungen für Fortgeschrittene",
  location: "Studio Saal 1",
  startsAt: "2026-10-03T08:00:00Z",
  endsAt: "2026-10-03T12:00:00Z",
  priceNormal: 25,
  zustand: "kaufen",
  url: "https://app.example.test/events/salsa-workshop",
  siteUrl: "https://app.example.test",
};

describe("eventDaten", () => {
  it("beschreibt ein geplantes Event mit Ort, Zeit, Preis und Veranstalter", () => {
    expect(eventDaten(workshop)).toMatchObject({
      "@type": "Event",
      name: "Salsa Workshop",
      startDate: "2026-10-03T08:00:00Z",
      endDate: "2026-10-03T12:00:00Z",
      eventStatus: "https://schema.org/EventScheduled",
      location: { "@type": "Place", name: "Studio Saal 1" },
      offers: { price: 25, priceCurrency: "EUR", availability: "https://schema.org/InStock" },
      organizer: { name: "Vienna Salsa Studio" },
    });
  });

  it("kennzeichnet Absagen und ausgebuchte Events", () => {
    expect(eventDaten({ ...workshop, zustand: "abgesagt" }).eventStatus).toBe("https://schema.org/EventCancelled");
    expect(eventDaten({ ...workshop, zustand: "ausgebucht" }).offers).toMatchObject({
      availability: "https://schema.org/SoldOut",
    });
  });

  it("lässt fehlende Angaben weg, statt leere Felder zu liefern", () => {
    const daten = eventDaten({ ...workshop, endsAt: null, location: null, description: null, priceNormal: null });
    expect(daten).not.toHaveProperty("endDate");
    expect(daten).not.toHaveProperty("location");
    expect(daten).not.toHaveProperty("description");
    expect(daten).not.toHaveProperty("offers");
  });
});

describe("alsSkriptInhalt", () => {
  it("lässt keinen Eventnamen den Skriptblock beenden", () => {
    const inhalt = alsSkriptInhalt(eventDaten({ ...workshop, name: "</script><script>alert(1)</script>" }));
    expect(inhalt).not.toContain("</script>");
    expect(JSON.parse(inhalt).name).toBe("</script><script>alert(1)</script>");
  });
});
