import { test, expect } from "@playwright/test";

/**
 * Dateien, die keine Seiten sind.
 *
 * Diese Suite gibt es, weil dieselbe Falle dreimal zugeschlagen hat:
 *
 *   2026-09-09  manifest.webmanifest — die Sprachweiche schickte sie auf einen
 *               Sprachpfad, die auf dem Home-Bildschirm gespeicherte App verlor
 *               dadurch ihre Angaben.
 *   2026-09-16  robots.txt und sitemap.xml — beide lieferten die 404-Seite,
 *               Google hätte nie eine davon zu sehen bekommen.
 *   2026-09-16  sw.js — der Service Worker wurde nie ausgeliefert. Damit hat
 *               seit PROJ-16 **keine einzige** Push-Benachrichtigung
 *               funktioniert, und niemand hat es gemerkt: Die Registrierung
 *               scheiterte lautlos, die Oberfläche bot den Knopf trotzdem an.
 *
 * Jedes Mal war die Ursache dieselbe, jedes Mal fiel es erst in der Produktion
 * auf. Wer eine Datei ergänzt, die keine Seite ist, ergänzt hier eine Zeile —
 * dann schlägt sie beim nächsten Lauf fehl statt beim nächsten Kunden.
 */

const DATEIEN: Array<{ pfad: string; typ: RegExp; zweck: string }> = [
  { pfad: "/sw.js", typ: /javascript/, zweck: "Push-Benachrichtigungen" },
  { pfad: "/manifest.webmanifest", typ: /manifest|json/, zweck: "App auf dem Home-Bildschirm" },
  { pfad: "/robots.txt", typ: /text\/plain/, zweck: "Suchmaschinen" },
  { pfad: "/sitemap.xml", typ: /xml/, zweck: "Suchmaschinen" },
];

test.describe("Dateien, die keine Seiten sind", () => {
  for (const { pfad, typ, zweck } of DATEIEN) {
    test(`${pfad} wird ausgeliefert, nicht auf einen Sprachpfad geschickt (${zweck})`, async ({
      request,
    }) => {
      const antwort = await request.get(pfad);

      expect(antwort.status(), `${pfad} muss 200 liefern`).toBe(200);

      const inhaltstyp = antwort.headers()["content-type"] ?? "";
      expect(inhaltstyp, `${pfad} kam als "${inhaltstyp}"`).toMatch(typ);

      // Der verräterische Fall: Statuszeile 200, aber die 404-Seite im Bauch.
      const text = await antwort.text();
      expect(text, `${pfad} enthält die 404-Seite`).not.toContain("<!DOCTYPE html>");
    });
  }

  test("Der Service Worker enthält wirklich einen Push-Empfänger", async ({ request }) => {
    // Eine Datei auszuliefern genügt nicht — sie muss auch die Sache tun.
    const text = await (await request.get("/sw.js")).text();
    expect(text).toContain("push");
  });
});
