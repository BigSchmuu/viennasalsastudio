import { describe, it, expect } from "vitest";
import { buildNotificationContent } from "./templates";

describe("buildNotificationContent", () => {
  it("builds a confirmation message for buchungsstatus", () => {
    const content = buildNotificationContent("buchungsstatus", {
      courseName: "Salsa Cubana",
      newStatus: "confirmed",
    });
    expect(content.subject).toContain("bestätigt");
    expect(content.subject).toContain("Salsa Cubana");
    expect(content.emailHtml).toContain("Salsa Cubana");
    expect(content.pushBody).toContain("bestätigt");
  });

  it("builds a rejection message for buchungsstatus", () => {
    const content = buildNotificationContent("buchungsstatus", {
      courseName: "Salsa Cubana",
      newStatus: "rejected",
    });
    expect(content.subject).toContain("abgelehnt");
  });

  it("builds a waitlist promotion message", () => {
    const content = buildNotificationContent("warteliste", {
      courseName: "Bachata Grundkurs",
      chosenDate: "2026-09-01",
    });
    expect(content.subject).toContain("Bachata Grundkurs");
    expect(content.emailHtml).toContain("01.09.2026");
  });

  it("distinguishes cancellation from pause in abo_kuendigung", () => {
    const cancelled = buildNotificationContent("abo_kuendigung", {
      subscriptionName: "Flatrate",
      newStatus: "cancelled",
      effectiveDate: "2026-09-01",
    });
    const paused = buildNotificationContent("abo_kuendigung", {
      subscriptionName: "Flatrate",
      newStatus: "paused",
      effectiveDate: "2026-09-01",
    });
    expect(cancelled.subject).toContain("Kündigung");
    expect(paused.subject).toContain("Pausierung");
  });

  it("builds a day-before reminder distinguishing trial from dropin", () => {
    const trial = buildNotificationContent("kursstart_erinnerung", {
      courseName: "Salsa Cubana",
      chosenDate: "2026-09-01",
      type: "trial",
    });
    expect(trial.subject).toContain("Probestunde");

    const dropin = buildNotificationContent("kursstart_erinnerung", {
      courseName: "Salsa Cubana",
      chosenDate: "2026-09-01",
      type: "dropin",
    });
    expect(dropin.subject).toContain("Drop-in");
  });

  it("formats the SEPA pre-notification with amount and due date", () => {
    const content = buildNotificationContent("sepa_ankuendigung", {
      amount: 40,
      dueDate: "2026-09-05",
    });
    expect(content.emailHtml).toContain("05.09.2026");
    expect(content.pushBody).toContain("05.09.2026");
    expect(content.url).toBe("/rechnungen");
  });
});
