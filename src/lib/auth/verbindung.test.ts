import { describe, it, expect } from "vitest";
import { mitVerbindung, istVerbindungsabbruch, VERBINDUNG_ABGEBROCHEN } from "./verbindung";

describe("istVerbindungsabbruch", () => {
  // Die drei Wortlaute, mit denen die Browser einen gescheiterten fetch melden.
  it("erkennt den gescheiterten fetch in jedem Browser", () => {
    expect(istVerbindungsabbruch(new TypeError("Load failed"))).toBe(true);
    expect(istVerbindungsabbruch(new TypeError("Failed to fetch"))).toBe(true);
    expect(
      istVerbindungsabbruch(new TypeError("NetworkError when attempting to fetch resource."))
    ).toBe(true);
  });

  // Der Grund, warum hier überhaupt unterschieden wird.
  it("hält einen Fehler aus der Server-Action nicht dafür", () => {
    const ausDerAktion = new Error("An error occurred in the Server Components render");
    expect(istVerbindungsabbruch(ausDerAktion)).toBe(false);
  });
});

describe("mitVerbindung", () => {
  it("gibt das Ergebnis durch, wenn nichts dazwischenkommt", async () => {
    expect(await mitVerbindung(async () => ({ role: "customer" }))).toEqual({ role: "customer" });
  });

  it("gibt auch den Fachfehler unverändert durch", async () => {
    expect(await mitVerbindung(async () => ({ error: "errInvalidCredentials" }))).toEqual({
      error: "errInvalidCredentials",
    });
  });

  it("macht aus dem Abbruch ein Ergebnis in der gewohnten Gestalt", async () => {
    const ergebnis = await mitVerbindung(async () => {
      throw new TypeError("Load failed");
    });
    expect(ergebnis).toEqual({ error: VERBINDUNG_ABGEBROCHEN });
  });

  // Sonst stünde vor dem Kunden „Verbindung abgebrochen", während der echte
  // Fehler nie in Sentry ankommt.
  it("lässt einen echten Programmfehler weiterfliegen", async () => {
    await expect(
      mitVerbindung(async () => {
        throw new Error("Spalte fehlt");
      })
    ).rejects.toThrow("Spalte fehlt");
  });
});
