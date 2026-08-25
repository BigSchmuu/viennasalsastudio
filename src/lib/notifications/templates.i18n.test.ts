import { describe, it, expect } from "vitest";
import { buildNotificationContent } from "./templates";
import { TEMPLATE_REGISTRY } from "./template-registry";

/**
 * PROJ-43: Welche Sprachfassung eine Benachrichtigung bekommt, entscheidet die
 * am Kundenkonto gespeicherte Sprache — nicht die des Browsers. Eine
 * Benachrichtigung entsteht im Hintergrund, wenn niemand vor dem Bildschirm
 * sitzt.
 */
describe("Benachrichtigungen in der Sprache des Empfängers", () => {
  const buchung = { courseName: "Salsa Beginner 1", newStatus: "confirmed" as const };

  it("verschickt Deutsch, wenn keine Sprache gewählt wurde", () => {
    const inhalt = buildNotificationContent("buchungsstatus", buchung, undefined);
    expect(inhalt.subject).toContain("Buchung bestätigt");
    expect(inhalt.pushBody).toContain("ist bestätigt");
  });

  it("verschickt Englisch, wenn der Kunde Englisch gewählt hat", () => {
    const inhalt = buildNotificationContent("buchungsstatus", buchung, undefined, "en");
    expect(inhalt.subject).toContain("Booking confirmed");
    expect(inhalt.pushBody).toContain("is confirmed");
  });

  it("fällt bei einer unbekannten Sprache auf Deutsch zurück", () => {
    const inhalt = buildNotificationContent("buchungsstatus", buchung, undefined, "fr");
    expect(inhalt.subject).toContain("Buchung bestätigt");
  });

  it("lässt eine Anpassung des Betreibers vorgehen — in beiden Sprachen", () => {
    const eigene = {
      emailSubject: "Eigener Betreff",
      emailBody: "Eigener Text",
      pushTitle: "Eigener Titel",
      pushBody: "Eigener Push",
    };
    for (const locale of ["de", "en"]) {
      const inhalt = buildNotificationContent("buchungsstatus", buchung, eigene, locale);
      expect(inhalt.subject, locale).toBe("Eigener Betreff");
    }
  });

  it("hat für jede Vorlage eine englische Fassung", () => {
    for (const meta of TEMPLATE_REGISTRY) {
      expect(meta.defaultsEn, meta.key).toBeDefined();
      for (const feld of ["emailSubject", "emailBody", "pushTitle", "pushBody"] as const) {
        expect(meta.defaultsEn[feld]?.trim(), `${meta.key}.${feld}`).toBeTruthy();
      }
    }
  });

  it("behält in der englischen Fassung dieselben Platzhalter wie in der deutschen", () => {
    // Ein vergessener Platzhalter würde eine Lücke im Text hinterlassen, die
    // erst beim Empfänger auffiele.
    const platzhalter = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const meta of TEMPLATE_REGISTRY) {
      for (const feld of ["emailSubject", "emailBody", "pushTitle", "pushBody"] as const) {
        expect(platzhalter(meta.defaultsEn[feld]), `${meta.key}.${feld}`).toEqual(
          platzhalter(meta.defaults[feld])
        );
      }
    }
  });
});
