import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const runDailyChecks = vi.fn();
const runFollowupChecks = vi.fn();
const runEveningChecks = vi.fn();
const drainPendingQueue = vi.fn();
const vollzieheFaelligeAenderungen = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/subscriptions/faellige-aenderungen", () => ({
  vollzieheFaelligeAenderungen: (...args: unknown[]) => vollzieheFaelligeAenderungen(...args),
}));
vi.mock("@/lib/notifications/dispatch", () => ({
  runDailyChecks: (...args: unknown[]) => runDailyChecks(...args),
  runFollowupChecks: (...args: unknown[]) => runFollowupChecks(...args),
  runEveningChecks: (...args: unknown[]) => runEveningChecks(...args),
  drainPendingQueue: (...args: unknown[]) => drainPendingQueue(...args),
}));

describe("GET /api/cron/notifications", () => {
  beforeEach(() => {
    vi.resetModules();
    runDailyChecks.mockReset().mockResolvedValue({ reminders: 2, effective: 1 });
    runFollowupChecks.mockReset().mockResolvedValue({ followup: 1 });
    runEveningChecks.mockReset().mockResolvedValue({ evening: 4 });
    drainPendingQueue.mockReset().mockResolvedValue({ processed: 3 });
    vollzieheFaelligeAenderungen
      .mockReset()
      .mockResolvedValue({ vollzogen: 2, gekuendigt: 1, freigewordeneKurse: [] });
    process.env.CRON_SECRET = "test-secret";
  });

  it("rejects requests without the correct bearer token", async () => {
    const { GET } = await import("./route");
    const request = new NextRequest("http://localhost/api/cron/notifications");
    const response = await GET(request);
    expect(response.status).toBe(401);
    expect(runDailyChecks).not.toHaveBeenCalled();
  });

  it("rejects requests with a wrong bearer token", async () => {
    const { GET } = await import("./route");
    const request = new NextRequest("http://localhost/api/cron/notifications", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("runs the morning checks (daily + PROJ-29 followup) and drains the queue by default", async () => {
    const { GET } = await import("./route");
    const request = new NextRequest("http://localhost/api/cron/notifications", {
      headers: { authorization: "Bearer test-secret" },
    });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(runDailyChecks).toHaveBeenCalledTimes(1);
    expect(runFollowupChecks).toHaveBeenCalledTimes(1);
    expect(runEveningChecks).not.toHaveBeenCalled();
    expect(drainPendingQueue).toHaveBeenCalledTimes(1);
    // Der Morgenlauf vollzieht faellige Abo-Aenderungen; die freigewordenen
    // Kurse gehoeren in die Nachrueckung, nicht in die Antwort.
    expect(vollzieheFaelligeAenderungen).toHaveBeenCalledTimes(1);
    expect(body).toEqual({
      reminders: 2,
      effective: 1,
      followup: 1,
      vollzogen: 2,
      gekuendigt: 1,
      freigewordeneKurse: [],
      processed: 3,
    });
  });

  it("runs only the PROJ-29 evening check when ?run=evening, not the morning checks", async () => {
    const { GET } = await import("./route");
    const request = new NextRequest("http://localhost/api/cron/notifications?run=evening", {
      headers: { authorization: "Bearer test-secret" },
    });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(runEveningChecks).toHaveBeenCalledTimes(1);
    expect(runDailyChecks).not.toHaveBeenCalled();
    expect(runFollowupChecks).not.toHaveBeenCalled();
    expect(drainPendingQueue).toHaveBeenCalledTimes(1);
    // Der Abendlauf vollzieht nichts: Ein Stichtag gehoert an den Tagesanfang,
    // und zweimal taeglich braucht es nicht.
    expect(vollzieheFaelligeAenderungen).not.toHaveBeenCalled();
    expect(body).toEqual({ evening: 4, vollzogen: 0, gekuendigt: 0, processed: 3 });
  });

  it("still requires the bearer token on the evening run", async () => {
    const { GET } = await import("./route");
    const request = new NextRequest("http://localhost/api/cron/notifications?run=evening");
    const response = await GET(request);
    expect(response.status).toBe(401);
    expect(runEveningChecks).not.toHaveBeenCalled();
  });
  // Bis September 2026 lief der Tageslauf ungeschuetzt durch: warf ein Schritt,
  // blieb alles danach ungetan -- auch der Vollzug faelliger Kuendigungen, und
  // das heisst im Klartext, dass weiter abgebucht wird.
  it("laesst den Rest des Laufs weiterlaufen, wenn der Tageslauf ausfaellt", async () => {
    runDailyChecks.mockRejectedValue(new Error("Verbindung abgebrochen"));
    const { GET } = await import("./route");
    const request = new NextRequest("http://localhost/api/cron/notifications", {
      headers: { authorization: "Bearer test-secret" },
    });
    const response = await GET(request);
    const body = await response.json();

    expect(runFollowupChecks).toHaveBeenCalledTimes(1);
    expect(vollzieheFaelligeAenderungen).toHaveBeenCalledTimes(1);
    expect(drainPendingQueue).toHaveBeenCalledTimes(1);
    expect(body.vollzogen).toBe(2);
    expect(body.processed).toBe(3);
    expect(body.fehler).toEqual(["tageslauf: Verbindung abgebrochen"]);
  });

  it("meldet einen ausgefallenen Schritt mit Statuscode 500", async () => {
    // Vercel zeigt in der Cron-Uebersicht nur den Statuscode -- ein halb
    // gelungener Lauf darf dort nicht wie ein gelungener aussehen.
    drainPendingQueue.mockRejectedValue(new Error("Warteschlange klemmt"));
    const { GET } = await import("./route");
    const request = new NextRequest("http://localhost/api/cron/notifications", {
      headers: { authorization: "Bearer test-secret" },
    });
    const response = await GET(request);

    expect(response.status).toBe(500);
    expect((await response.json()).fehler).toEqual(["warteschlange: Warteschlange klemmt"]);
  });

  it("haelt die Warteschlange am Laufen, wenn der Abo-Vollzug ausfaellt", async () => {
    vollzieheFaelligeAenderungen.mockRejectedValue(new Error("Sperre"));
    const { GET } = await import("./route");
    const request = new NextRequest("http://localhost/api/cron/notifications", {
      headers: { authorization: "Bearer test-secret" },
    });
    const response = await GET(request);
    const body = await response.json();

    expect(drainPendingQueue).toHaveBeenCalledTimes(1);
    expect(body.processed).toBe(3);
    expect(body.vollzogen).toBe(0);
    expect(body.fehler).toEqual(["abo-vollzug: Sperre"]);
  });

  it("nennt jeden ausgefallenen Schritt, nicht nur den ersten", async () => {
    runFollowupChecks.mockRejectedValue(new Error("eins"));
    drainPendingQueue.mockRejectedValue(new Error("zwei"));
    const { GET } = await import("./route");
    const request = new NextRequest("http://localhost/api/cron/notifications", {
      headers: { authorization: "Bearer test-secret" },
    });
    const body = await (await GET(request)).json();

    expect(body.fehler).toEqual(["nachfassen: eins", "warteschlange: zwei"]);
  });
});
