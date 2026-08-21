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

  // BUG-3 regression: course/subscription names are admin-provided text and
  // must never be embedded raw into the email HTML.
  it("escapes HTML in course names before embedding them in the email body", () => {
    const content = buildNotificationContent("buchungsstatus", {
      courseName: '<img src=x onerror=alert(1)>"Salsa"',
      newStatus: "confirmed",
    });
    expect(content.emailHtml).not.toContain("<img");
    expect(content.emailHtml).toContain("&lt;img");
  });

  it("escapes HTML in subscription names before embedding them in the email body", () => {
    const content = buildNotificationContent("abo_kuendigung", {
      subscriptionName: "<a href=evil>Klick hier</a>",
      newStatus: "cancelled",
      effectiveDate: "2026-09-01",
    });
    expect(content.emailHtml).not.toContain("<a href=evil>");
    expect(content.emailHtml).toContain("&lt;a href=evil&gt;");
  });

  it("distinguishes confirmed (SEPA) from reserved (onsite) ticket purchases", () => {
    const confirmed = buildNotificationContent("event_tickets", {
      subType: "purchased",
      eventName: "Salsa Congress",
      startsAt: "2026-09-01T20:00:00Z",
      ticketStatus: "confirmed",
    });
    const reserved = buildNotificationContent("event_tickets", {
      subType: "purchased",
      eventName: "Salsa Congress",
      startsAt: "2026-09-01T20:00:00Z",
      ticketStatus: "reserved",
    });
    expect(confirmed.subject).toContain("bestätigt");
    expect(reserved.subject).toContain("reserviert");
    expect(reserved.emailHtml).toContain("vor Ort bezahlen");
  });

  it("builds an event-cancellation ticket message mentioning refunds happen outside the app", () => {
    const content = buildNotificationContent("event_tickets", {
      subType: "event_cancelled",
      eventName: "Salsa Congress",
      startsAt: "2026-09-01T20:00:00Z",
    });
    expect(content.subject).toContain("abgesagt");
    expect(content.emailHtml).toContain("außerhalb der App");
  });

  it("escapes HTML in event names before embedding them in the email body", () => {
    const content = buildNotificationContent("event_tickets", {
      subType: "purchased",
      eventName: '<img src=x onerror=alert(1)>"Congress"',
      startsAt: "2026-09-01T20:00:00Z",
      ticketStatus: "confirmed",
    });
    expect(content.emailHtml).not.toContain("<img");
    expect(content.emailHtml).toContain("&lt;img");
  });

  it("builds the same-evening trial follow-up with a direct booking link", () => {
    const content = buildNotificationContent("probestunde_nachfassung", {
      subType: "abend",
      courseName: "Salsa Cubana",
      courseId: "course-123",
    });
    expect(content.subject).toContain("Probestunde");
    expect(content.subject).toContain("Salsa Cubana");
    expect(content.emailHtml).toContain("/kurse/course-123");
    expect(content.url).toBe("/kurse/course-123");
  });

  it("builds a distinct message for the next-occurrence trial follow-up", () => {
    const evening = buildNotificationContent("probestunde_nachfassung", {
      subType: "abend",
      courseName: "Salsa Cubana",
      courseId: "course-123",
    });
    const nextOccurrence = buildNotificationContent("probestunde_nachfassung", {
      subType: "naechster_termin",
      courseName: "Salsa Cubana",
      courseId: "course-123",
    });
    expect(nextOccurrence.subject).not.toBe(evening.subject);
    expect(nextOccurrence.subject).toContain("nächste");
    expect(nextOccurrence.emailHtml).toContain("/kurse/course-123");
  });

  it("escapes HTML in the course name for the trial follow-up", () => {
    const content = buildNotificationContent("probestunde_nachfassung", {
      subType: "abend",
      courseName: '<img src=x onerror=alert(1)>"Cubana"',
      courseId: "course-123",
    });
    expect(content.emailHtml).not.toContain("<img");
    expect(content.emailHtml).toContain("&lt;img");
  });

  it("builds a newsletter message using the admin-authored subject and body verbatim", () => {
    const content = buildNotificationContent("newsletter", {
      subject: "Neue Kurse im Herbst",
      body: "Wir starten drei neue Kurse ab September.",
    });
    expect(content.subject).toBe("Neue Kurse im Herbst");
    expect(content.emailHtml).toContain("Wir starten drei neue Kurse ab September.");
  });

  it("splits newsletter body paragraphs on blank lines and line breaks on single newlines", () => {
    const content = buildNotificationContent("newsletter", {
      subject: "Update",
      body: "Erster Absatz.\n\nZweiter Absatz,\nmit Zeilenumbruch.",
    });
    expect(content.emailHtml).toContain("<p>Erster Absatz.</p>");
    expect(content.emailHtml).toContain("Zweiter Absatz,<br />");
  });

  it("escapes HTML in the newsletter subject and body", () => {
    const content = buildNotificationContent("newsletter", {
      subject: '<img src=x onerror=alert(1)> Angebot',
      body: '<script>alert("xss")</script>',
    });
    expect(content.emailHtml).not.toContain("<img");
    expect(content.emailHtml).not.toContain("<script>");
    expect(content.emailHtml).toContain("&lt;script&gt;");
  });
});
