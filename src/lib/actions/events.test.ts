import { describe, it, expect, vi, beforeEach } from "vitest";
import de from "../../../messages/de.json";
import en from "../../../messages/en.json";

const getUser = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: (...args: unknown[]) => getUser(...args) },
    rpc: (...args: unknown[]) => rpc(...args),
  })),
}));
vi.mock("@/lib/notifications/dispatch", () => ({ enqueueAndDispatch: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("purchaseTicket — Fehler als Schlüssel (PROJ-53, BUG-2)", () => {
  beforeEach(() => {
    getUser.mockReset().mockResolvedValue({ data: { user: { id: "kunde" } } });
    rpc.mockReset();
  });

  it("meldet einen fehlenden Login", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { purchaseTicket } = await import("./events");
    expect(await purchaseTicket("event", "onsite", false, true)).toEqual({ error: "errNotLoggedIn" });
  });

  it("verlangt die AGB-Zustimmung, bevor die Datenbank gefragt wird", async () => {
    const { purchaseTicket } = await import("./events");
    expect(await purchaseTicket("event", "onsite", false, false)).toEqual({ error: "errTermsRequired" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("ordnet jede Ablehnung der Datenbank zu", async () => {
    const { purchaseTicket } = await import("./events");
    const ablehnung = (message: string) => rpc.mockResolvedValueOnce({ data: null, error: { message } });

    // Abgesagt, vorbei oder „Nur anzeigen" — die Datenbank sagt dazu „event not open".
    ablehnung("event not open");
    expect(await purchaseTicket("event", "onsite", false, true)).toEqual({ error: "errEventClosed" });

    ablehnung("event is full");
    expect(await purchaseTicket("event", "onsite", false, true)).toEqual({ full: true });

    ablehnung("no active mandate");
    expect(await purchaseTicket("event", "sepa", false, true)).toEqual({ needsMandate: true });

    ablehnung("etwas Unerwartetes");
    expect(await purchaseTicket("event", "onsite", false, true)).toEqual({ error: "errPurchaseFailed" });
  });

  it("hat für jeden Schlüssel einen deutschen und einen englischen Text", () => {
    const schluessel = ["errNotLoggedIn", "errTermsRequired", "errEventClosed", "errPurchaseFailed"];
    for (const [sprache, texte] of [
      ["de", de.events],
      ["en", en.events],
    ] as const) {
      expect(
        schluessel.filter((k) => !(k in texte)),
        `Fehlt in ${sprache}.json`
      ).toEqual([]);
    }
  });
});
