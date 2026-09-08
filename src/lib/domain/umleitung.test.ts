import { describe, it, expect } from "vitest";
import { umleitungsZiel, ZIEL_HOST } from "./umleitung";

const ziel = (adresse: string, host: string) =>
  umleitungsZiel(new URL(adresse), host)?.toString() ?? null;

describe("umleitungsZiel", () => {
  it("leitet die feste Produktionsadresse auf die eigene Domain", () => {
    expect(ziel("https://viennasalsastudio.vercel.app/kurse", "viennasalsastudio.vercel.app")).toBe(
      `https://${ZIEL_HOST}/kurse`
    );
  });

  it("behält Pfad und Abfrage", () => {
    // Auf ausgestellten Tickets stehen QR-Codes mit der alten Adresse.
    expect(
      ziel(
        "https://viennasalsastudio.vercel.app/checkin?ticket=abc-123",
        "viennasalsastudio.vercel.app"
      )
    ).toBe(`https://${ZIEL_HOST}/checkin?ticket=abc-123`);
  });

  it("lässt Vorschau-Bereitstellungen in Ruhe", () => {
    // Würden sie mitumgeleitet, könnte man vor dem Ausrollen nichts mehr ansehen.
    expect(
      ziel(
        "https://viennasalsastudio-n2r0ouzko-vienna-salsa-studio.vercel.app/kurse",
        "viennasalsastudio-n2r0ouzko-vienna-salsa-studio.vercel.app"
      )
    ).toBeNull();
  });

  it("leitet die Zieladresse nicht auf sich selbst um", () => {
    expect(ziel(`https://${ZIEL_HOST}/kurse`, ZIEL_HOST)).toBeNull();
  });

  it("lässt die Entwicklung auf localhost unberührt", () => {
    expect(ziel("http://localhost:3100/kurse", "localhost:3100")).toBeNull();
  });

  it("erkennt den Host unabhängig von Groß- und Kleinschreibung und Port", () => {
    expect(ziel("https://viennasalsastudio.vercel.app/", "ViennaSalsaStudio.vercel.app:443")).toBe(
      `https://${ZIEL_HOST}/`
    );
  });

  it("kommt ohne Host-Kopf zurecht", () => {
    expect(ziel("https://viennasalsastudio.vercel.app/", "")).toBeNull();
    expect(umleitungsZiel(new URL("https://viennasalsastudio.vercel.app/"), null)).toBeNull();
  });

  it("leitet auch die Git-Adresse des Hauptzweigs um", () => {
    expect(
      ziel(
        "https://viennasalsastudio-git-main-vienna-salsa-studio.vercel.app/profil",
        "viennasalsastudio-git-main-vienna-salsa-studio.vercel.app"
      )
    ).toBe(`https://${ZIEL_HOST}/profil`);
  });
  // Regression vom 2026-09-08: Eine noch offene Seite der alten Adresse schickte
  // ihre Server Action per POST dorthin. Die Umleitung machte daraus eine
  // Anfrage an eine fremde Herkunft — der Browser brach mit „Failed to fetch"
  // ab, und das Passwort-Formular meldete einen Fehler.
  it("leitet ein abgeschicktes Formular nicht um", () => {
    expect(
      umleitungsZiel(
        new URL("https://viennasalsastudio.vercel.app/passwort-vergessen"),
        "viennasalsastudio.vercel.app",
        "POST"
      )
    ).toBeNull();
  });

  it("leitet HEAD wie GET um", () => {
    expect(
      umleitungsZiel(
        new URL("https://viennasalsastudio.vercel.app/kurse"),
        "viennasalsastudio.vercel.app",
        "HEAD"
      )?.toString()
    ).toBe(`https://${ZIEL_HOST}/kurse`);
  });
});
