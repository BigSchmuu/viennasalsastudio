import { describe, it, expect } from "vitest";
import {
  anmeldefehler,
  registrierungsfehler,
  bestaetigungsfehler,
  zuruecksetzfehler,
  fehlertext,
} from "./fehler";
import de from "../../../messages/de.json";
import en from "../../../messages/en.json";

describe("Auth-Fehler", () => {
  it("unterscheidet beim Anmelden nicht zwischen falschem Passwort und unbekannter Adresse", () => {
    // Sonst ließe sich über das Formular prüfen, wer Kunde ist.
    expect(anmeldefehler("invalid_credentials")).toBe("errInvalidCredentials");
    expect(anmeldefehler(undefined)).toBe("errInvalidCredentials");
  });

  it("lässt die unbestätigte Adresse als eigenen Fall durch", () => {
    expect(anmeldefehler("email_not_confirmed")).toBe("email_not_confirmed");
  });

  it("benennt ein erreichtes Mailversand-Limit — überall gleich", () => {
    // Der gemeldete Fall: „Registrierung fehlgeschlagen, bitte erneut" —
    // und der nächste Versuch scheiterte genauso.
    for (const f of [anmeldefehler, registrierungsfehler, bestaetigungsfehler, zuruecksetzfehler]) {
      expect(f("over_email_send_rate_limit")).toBe("errEmailRateLimit");
      expect(f("over_request_rate_limit")).toBe("errRequestRateLimit");
    }
  });

  it("erkennt ein schwaches Passwort bei Registrierung und Zurücksetzen", () => {
    expect(registrierungsfehler("weak_password")).toBe("weakPassword");
    expect(zuruecksetzfehler("weak_password")).toBe("weakPassword");
  });

  it("fällt auf die jeweilige Vorgangsmeldung zurück", () => {
    expect(registrierungsfehler("irgendwas")).toBe("errSignupFailed");
    expect(bestaetigungsfehler("irgendwas")).toBe("errResendFailed");
    expect(zuruecksetzfehler("irgendwas")).toBe("errLinkExpired");
  });

  it("hat für jeden Schlüssel einen deutschen und einen englischen Text", () => {
    const schluessel = [
      "errInvalidCredentials",
      "errSignupFailed",
      "errResendFailed",
      "errLinkExpired",
      "errEmailRateLimit",
      "errRequestRateLimit",
      "errInvalidInput",
      "weakPassword",
      "valEmailRequired",
      "valEmailInvalid",
      "valPasswordRequired",
      "valConfirmRequired",
      "valPasswordsDiffer",
      "passwordHint",
    ];
    for (const [sprache, texte] of [["de", de.auth], ["en", en.auth]] as const) {
      const fehlend = schluessel.filter((k) => !(k in texte));
      expect(fehlend, `Fehlt in ${sprache}.json`).toEqual([]);
    }
  });

  it("zeigt Unbekanntes unverändert statt einer leeren Stelle", () => {
    const t = Object.assign((k: string) => `übersetzt:${k}`, { has: (k: string) => k === "bekannt" });
    expect(fehlertext(t, "bekannt")).toBe("übersetzt:bekannt");
    expect(fehlertext(t, "roher Text")).toBe("roher Text");
  });
});
