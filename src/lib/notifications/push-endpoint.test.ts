import { describe, it, expect } from "vitest";
import { isTrustedPushEndpoint } from "./push-endpoint";

describe("isTrustedPushEndpoint", () => {
  it("accepts real browser push service endpoints", () => {
    expect(isTrustedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc123")).toBe(true);
    expect(isTrustedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/xyz")).toBe(true);
    expect(isTrustedPushEndpoint("https://web.push.apple.com/foo")).toBe(true);
    expect(isTrustedPushEndpoint("https://wns2-abc1.notify.windows.com/w/foo")).toBe(true);
  });

  // BUG-1 regression: a malicious client could otherwise register any URL as
  // its own "push endpoint" and have the server later POST notification
  // content to it (SSRF) — see push.ts's sendPushToCustomer.
  it("rejects endpoints outside the known push-service allowlist", () => {
    expect(isTrustedPushEndpoint("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isTrustedPushEndpoint("https://attacker.example.com/collect")).toBe(false);
    expect(isTrustedPushEndpoint("http://localhost:3000/internal")).toBe(false);
  });

  it("rejects non-HTTPS push service URLs", () => {
    expect(isTrustedPushEndpoint("http://fcm.googleapis.com/fcm/send/abc123")).toBe(false);
  });

  it("rejects malformed URLs without throwing", () => {
    expect(isTrustedPushEndpoint("not-a-url")).toBe(false);
    expect(isTrustedPushEndpoint("")).toBe(false);
  });
});
