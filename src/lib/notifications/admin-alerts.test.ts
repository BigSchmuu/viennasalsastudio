import { describe, it, expect } from "vitest";
import { isTestAccountEmail } from "./admin-alerts";

describe("isTestAccountEmail (PROJ-39 BUG-2)", () => {
  it("recognises the fixture accounts used by the E2E suite", () => {
    expect(isTestAccountEmail("e2e8-customer@viennasalsastudio.test")).toBe(true);
    expect(isTestAccountEmail("e2e30-admin@viennasalsastudio.test")).toBe(true);
  });

  it("leaves real customers alone — they must still alert the admin", () => {
    expect(isTestAccountEmail("maria.huber@gmail.com")).toBe(false);
    expect(isTestAccountEmail("samuelg.kramer@yahoo.de")).toBe(false);
  });

  // A .test address may arrive with different casing or stray whitespace;
  // missing those would silently let test bookings ring the operator's phone.
  it("ignores casing and surrounding whitespace", () => {
    expect(isTestAccountEmail("E2E8-Customer@ViennaSalsaStudio.TEST")).toBe(true);
    expect(isTestAccountEmail("  e2e8-customer@viennasalsastudio.test  ")).toBe(true);
  });

  it("treats a missing address as a real customer rather than skipping silently", () => {
    // Suppressing an alert is the damaging direction: a real booking would go
    // unnoticed. When in doubt, notify.
    expect(isTestAccountEmail(undefined)).toBe(false);
    expect(isTestAccountEmail(null)).toBe(false);
    expect(isTestAccountEmail("")).toBe(false);
  });

  // ".test" must be the actual top-level domain, not merely somewhere in the
  // string — otherwise a real address could accidentally be silenced.
  it("does not match addresses that only contain 'test' elsewhere", () => {
    expect(isTestAccountEmail("test@gmail.com")).toBe(false);
    expect(isTestAccountEmail("anna@test.com")).toBe(false);
    expect(isTestAccountEmail("protest@example.org")).toBe(false);
  });
});
