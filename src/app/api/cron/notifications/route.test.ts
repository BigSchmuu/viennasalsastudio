import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const runDailyChecks = vi.fn();
const runFollowupChecks = vi.fn();
const runEveningChecks = vi.fn();
const drainPendingQueue = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({})),
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
    expect(body).toEqual({ reminders: 2, effective: 1, followup: 1, processed: 3 });
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
    expect(body).toEqual({ evening: 4, processed: 3 });
  });

  it("still requires the bearer token on the evening run", async () => {
    const { GET } = await import("./route");
    const request = new NextRequest("http://localhost/api/cron/notifications?run=evening");
    const response = await GET(request);
    expect(response.status).toBe(401);
    expect(runEveningChecks).not.toHaveBeenCalled();
  });
});
