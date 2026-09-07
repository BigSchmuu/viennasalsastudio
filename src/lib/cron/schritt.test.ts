import { describe, it, expect, vi, beforeEach } from "vitest";
import { fuehreSchrittAus, laufSammler } from "./schritt";

const captureException = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({ captureException }));

describe("fuehreSchrittAus", () => {
  beforeEach(() => captureException.mockClear());

  it("reicht das Ergebnis durch, wenn der Schritt gelingt", async () => {
    const ergebnis = await fuehreSchrittAus("tageslauf", { reminders: 0 }, async () => ({
      reminders: 3,
    }));
    expect(ergebnis).toEqual({ wert: { reminders: 3 } });
    expect(captureException).not.toHaveBeenCalled();
  });

  it("liefert den Ersatzwert und die Ursache, wenn der Schritt wirft", async () => {
    const ergebnis = await fuehreSchrittAus("warteschlange", { processed: 0 }, async () => {
      throw new Error("Verbindung abgebrochen");
    });
    expect(ergebnis.wert).toEqual({ processed: 0 });
    expect(ergebnis.fehler).toBe("warteschlange: Verbindung abgebrochen");
  });

  it("meldet den Fehler an Sentry, mit dem Schritt als Merkmal", async () => {
    // Ohne Meldung wäre ein ausgefallener Schritt genau das stille Versagen,
    // das der Umbau abstellen soll.
    await fuehreSchrittAus("abo-vollzug", null, async () => {
      throw new Error("kaputt");
    });
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][1]).toEqual({
      tags: { cron: "notifications", schritt: "abo-vollzug" },
    });
  });

  it("kommt auch mit einem geworfenen Nicht-Fehler zurecht", async () => {
    const ergebnis = await fuehreSchrittAus("abendlauf", 0, async () => {
      throw "nur ein Text";
    });
    expect(ergebnis.fehler).toBe("abendlauf: nur ein Text");
  });
});

describe("laufSammler", () => {
  it("bleibt leer, solange alles gelingt", () => {
    const sammler = laufSammler();
    expect(sammler.nimm({ wert: { a: 1 } })).toEqual({ a: 1 });
    expect(sammler.fehler).toEqual([]);
  });

  it("sammelt die Ursachen aller gescheiterten Schritte, in ihrer Reihenfolge", () => {
    const sammler = laufSammler();
    sammler.nimm({ wert: 0, fehler: "tageslauf: eins" });
    sammler.nimm({ wert: 1 });
    sammler.nimm({ wert: 0, fehler: "warteschlange: zwei" });
    expect(sammler.fehler).toEqual(["tageslauf: eins", "warteschlange: zwei"]);
  });
});
