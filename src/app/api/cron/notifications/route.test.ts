import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const runDailyChecks = vi.fn();
const drainPendingQueue = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/notifications/dispatch", () => ({
  runDailyChecks: (...args: unknown[]) => runDailyChecks(...args),
  drainPendingQueue: (...args: unknown[]) => drainPendingQueue(...args),
}));

describe("GET /api/cron/notifications", () => {
  beforeEach(() => {
    vi.resetModules();
    runDailyChecks.mockReset().mockResolvedValue({ reminders: 2, effective: 1 });
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

  it("runs daily checks and drains the queue when authorized", async () => {
    const { GET } = await import("./route");
    const request = new NextRequest("http://localhost/api/cron/notifications", {
      headers: { authorization: "Bearer test-secret" },
    });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(runDailyChecks).toHaveBeenCalledTimes(1);
    expect(drainPendingQueue).toHaveBeenCalledTimes(1);
    expect(body).toEqual({ reminders: 2, effective: 1, processed: 3 });
  });
});
