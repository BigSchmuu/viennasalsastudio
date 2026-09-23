import { describe, it, expect } from "vitest";
import { TEMPLATE_REGISTRY } from "./template-registry";
import { buildPreviewContent } from "./templates";

/**
 * Jeder angebotene Platzhalter muss in der Vorschau auch einen Wert bekommen.
 *
 * Die Vorschau hat eigene Beispieldaten — getrennt von den Beispielwerten, die
 * in der Verwaltung neben der Platzhalterliste stehen. Läuft beides
 * auseinander, bietet der Editor einen Platzhalter an, der in der Vorschau
 * eine Lücke hinterlässt; der Betreiber hält ihn dann für kaputt und lässt ihn
 * weg. Genau das ist bei PROJ-67 passiert.
 *
 * Geprüft wird stur: Für jeden Platzhalter jeder Vorlage wird ein Text gebaut,
 * der **nur** aus diesem Platzhalter besteht. Bleibt davon nichts übrig, fehlt
 * der Wert.
 */

describe("PROJ-67: Die Vorschau kennt jeden angebotenen Platzhalter", () => {
  for (const meta of TEMPLATE_REGISTRY) {
    for (const platzhalter of meta.placeholders) {
      it(`${meta.key} → {${platzhalter}}`, () => {
        const nurDieser = `{${platzhalter}}`;
        const inhalt = buildPreviewContent(meta.key, {
          emailSubject: nurDieser,
          emailBody: nurDieser,
          pushTitle: nurDieser,
          pushBody: nurDieser,
        });

        expect(inhalt.subject.trim(), `Betreff ohne Wert für {${platzhalter}}`).not.toBe("");
        expect(inhalt.pushBody.trim(), `Mitteilung ohne Wert für {${platzhalter}}`).not.toBe("");
      });
    }
  }
});
