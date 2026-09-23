import { describe, it, expect } from "vitest";
import { buildNotificationContent,
  zweiteStufeZurueckgesetztInhalt,
  ticketStorniertInhalt,
} from "./templates";

/**
 * Der Mailkopf trägt seit dem Logo ein eigenes Bild.
 *
 * Die Prüfungen unten wollen wissen, ob **fremder** Text — Kurs- und
 * Veranstaltungsnamen aus der Verwaltung — maskiert wird. Sie schneiden
 * deshalb die Kopfzeile weg, statt die Zusicherung aufzuweichen: Ein Bild,
 * das aus einem Kursnamen stammt, muss weiterhin auffallen.
 */
function ohneKopfzeile(html: string): string {
  const ende = html.indexOf("</table>");
  return ende === -1 ? html : html.slice(ende);
}

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

  it("nennt in der Kursstart-Erinnerung den Standort mit Anschrift (PROJ-67)", () => {
    // Zwei Häuser: Ohne diese Angabe steht in der Erinnerung nur der Kursname,
    // und wer beide Standorte kennt, rät.
    const content = buildNotificationContent("kursstart_erinnerung", {
      courseName: "Salsa Cubana",
      chosenDate: "2026-09-01",
      type: "trial",
      ort: "Studio Nord, Musterstraße 1, 1020 Wien",
      adresse: "Musterstraße 1, 1020 Wien",
    });

    expect(content.emailHtml).toContain("Studio Nord");
    expect(content.emailHtml).toContain("Musterstraße 1, 1020 Wien");
    // Auch auf dem Sperrbildschirm, dort zählt jede Zeile.
    expect(content.pushBody).toContain("Studio Nord");
  });

  it("bleibt lesbar, wenn zu einem Kurs kein Standort hinterlegt ist", () => {
    // Der Versand sorgt dafür, dass hier nie nichts ankommt: Fehlt der
    // Standort, tritt der Raumname an seine Stelle. Diese Prüfung hält die
    // Untergrenze fest — die Erinnerung geht raus und nennt ihren Kurs, statt
    // an einer fehlenden Angabe zu scheitern.
    const content = buildNotificationContent("kursstart_erinnerung", {
      courseName: "Salsa Cubana",
      chosenDate: "2026-09-01",
      type: "trial",
    });

    expect(content.subject).toContain("Salsa Cubana");
    expect(content.emailHtml).not.toContain("undefined");
    expect(content.pushBody).not.toContain("undefined");
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
    expect(ohneKopfzeile(content.emailHtml)).not.toContain("<img");
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

  // PROJ-56: Der Kunde soll in der Bestätigung sehen, was er gekauft hat —
  // vorher musste er dafür ins Profil.
  it("nennt in der Ticketbestätigung Ticketart, Einheit, Preis und Stornofrist", () => {
    const content = buildNotificationContent("event_tickets", {
      subType: "purchased",
      eventName: "Salsa Weekender",
      startsAt: "2026-09-01T20:00:00Z",
      ticketStatus: "confirmed",
      ticketType: "Full Pass",
      unit: "Styling",
      price: 60,
      cancellationLeadDays: 3,
    });
    expect(content.emailHtml).toContain("Ticketart: Full Pass");
    expect(content.emailHtml).toContain("Einheit: Styling");
    expect(content.emailHtml).toContain("Preis:");
    expect(content.emailHtml).toContain("Stornieren bis 3 Tage vor Beginn möglich");
  });

  it("sagt bei einer Frist von 0 Tagen, dass es bis zum Beginn geht", () => {
    const content = buildNotificationContent("event_tickets", {
      subType: "purchased",
      eventName: "Freitagsparty",
      startsAt: "2026-09-01T20:00:00Z",
      ticketStatus: "reserved",
      cancellationLeadDays: 0,
    });
    expect(content.emailHtml).toContain("Stornieren bis zum Beginn möglich");
  });

  it("nennt eine kostenlose Ticketart als kostenlos, nicht als 0,00 €", () => {
    const content = buildNotificationContent("event_tickets", {
      subType: "purchased",
      eventName: "Offene Probe",
      startsAt: "2026-09-01T20:00:00Z",
      ticketStatus: "confirmed",
      ticketType: "Gast",
      price: 0,
    });
    expect(content.emailHtml).toContain("kostenlos");
  });

  it("lässt die Liste weg, wenn nichts davon bekannt ist", () => {
    // Tickets von vor PROJ-56 tragen keine dieser Angaben — dann sieht die
    // Nachricht aus wie bisher, statt eine leere Liste zu zeigen.
    const content = buildNotificationContent("event_tickets", {
      subType: "purchased",
      eventName: "Altes Ticket",
      startsAt: "2026-09-01T20:00:00Z",
      ticketStatus: "reserved",
    });
    expect(content.emailHtml).not.toContain("<ul");
  });

  it("schreibt die Einzelheiten auf Englisch, wenn der Kunde Englisch spricht", () => {
    const content = buildNotificationContent(
      "event_tickets",
      {
        subType: "purchased",
        eventName: "Salsa Weekender",
        startsAt: "2026-09-01T20:00:00Z",
        ticketStatus: "confirmed",
        ticketType: "Full Pass",
        cancellationLeadDays: 2,
      },
      undefined,
      "en"
    );
    expect(content.emailHtml).toContain("Ticket type: Full Pass");
    expect(content.emailHtml).toContain("2 days before the start");
  });

  it("maskiert eine Ticketart, die wie Auszeichnung aussieht", () => {
    const content = buildNotificationContent("event_tickets", {
      subType: "purchased",
      eventName: "Workshop",
      startsAt: "2026-09-01T20:00:00Z",
      ticketStatus: "confirmed",
      ticketType: '<img src=x onerror=alert(1)>',
    });
    expect(content.emailHtml).not.toContain("<img src=x");
    expect(content.emailHtml).toContain("&lt;img");
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

  // PROJ-54: Ein verlegter Termin muss den neuen Zeitpunkt nennen und darauf
  // hinweisen, dass die Stornofrist dafür nicht gilt — genau das ist der
  // Unterschied zur Absage.
  it("builds a moved-occurrence message with the new date and the waived deadline", () => {
    const content = buildNotificationContent("event_tickets", {
      subType: "event_moved",
      eventName: "Freitagsparty",
      startsAt: "2026-09-26T19:00:00Z",
    });
    expect(content.subject).toContain("Freitagsparty");
    expect(content.emailHtml).toContain("verlegt");
    expect(content.emailHtml).toContain("Frist");
    expect(content.url).toBe("/profil");
  });

  it("escapes HTML in event names before embedding them in the email body", () => {
    const content = buildNotificationContent("event_tickets", {
      subType: "purchased",
      eventName: '<img src=x onerror=alert(1)>"Congress"',
      startsAt: "2026-09-01T20:00:00Z",
      ticketStatus: "confirmed",
    });
    expect(ohneKopfzeile(content.emailHtml)).not.toContain("<img");
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
    expect(ohneKopfzeile(content.emailHtml)).not.toContain("<img");
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
    expect(ohneKopfzeile(content.emailHtml)).not.toContain("<img");
    expect(content.emailHtml).not.toContain("<script>");
    expect(content.emailHtml).toContain("&lt;script&gt;");
  });

  // PROJ-39: internal admin alert. The admin must be able to decide from the
  // lock screen alone whether this needs attention, so name and course both
  // have to be in the push body.
  it("names customer and course in the new-booking alert", () => {
    const content = buildNotificationContent("neue_buchung", {
      customerName: "Maria Huber",
      courseName: "Salsa Beginner 2",
      bookingType: "regular",
    });
    expect(content.pushBody).toContain("Maria Huber");
    expect(content.pushBody).toContain("Salsa Beginner 2");
  });

  it("distinguishes a drop-in request from a regular booking request", () => {
    const regular = buildNotificationContent("neue_buchung", {
      customerName: "Maria Huber",
      courseName: "Salsa Beginner 2",
      bookingType: "regular",
    });
    const dropin = buildNotificationContent("neue_buchung", {
      customerName: "Maria Huber",
      courseName: "Salsa Beginner 2",
      bookingType: "dropin",
    });
    expect(regular.pushTitle).toContain("Buchungsanfrage");
    expect(dropin.pushTitle).toContain("Drop-in");
    expect(regular.pushTitle).not.toEqual(dropin.pushTitle);
  });

  it("sends the admin to the bookings page, not the customer profile", () => {
    const content = buildNotificationContent("neue_buchung", {
      customerName: "Maria Huber",
      courseName: "Salsa Beginner 2",
      bookingType: "regular",
    });
    expect(content.url).toBe("/admin/buchungen");
  });

  // The customer picks their own name, so it is attacker-controlled input.
  it("escapes HTML in a customer-supplied name", () => {
    const content = buildNotificationContent("neue_buchung", {
      customerName: '<img src=x onerror=alert(1)>',
      courseName: "Salsa Beginner 2",
      bookingType: "regular",
    });
    expect(ohneKopfzeile(content.emailHtml)).not.toContain("<img");
    expect(content.emailHtml).toContain("&lt;img");
  });
});

describe("zweiteStufeZurueckgesetztInhalt (PROJ-58)", () => {
  it("nennt den Namen dessen, der zurückgesetzt hat", () => {
    const inhalt = zweiteStufeZurueckgesetztInhalt("Lisa");
    expect(inhalt.emailHtml).toContain("von Lisa zurückgesetzt");
  });

  it("nennt ohne Namen eine neutrale Umschreibung", () => {
    expect(zweiteStufeZurueckgesetztInhalt(null).emailHtml).toContain("einem anderen Verwaltungskonto");
    expect(zweiteStufeZurueckgesetztInhalt("   ").emailHtml).toContain("einem anderen Verwaltungskonto");
  });

  it("maskiert HTML im Namen, statt es in die Mail zu lassen", () => {
    const name = '<img src=x onerror="alert(1)">';
    const inhalt = zweiteStufeZurueckgesetztInhalt(name);
    // Geprüft wird genau die Eigenschaft, auf die es ankommt: Der Name steht
    // maskiert in der Mail und nirgends unverändert. Nicht auf „<img" oder
    // „onerror" prüfen — der Briefkopf trägt selbst ein Bild, und das Wort
    // steht als harmloser Text im maskierten Namen.
    expect(inhalt.emailHtml).toContain("&lt;img");
    expect(inhalt.emailHtml).not.toContain(name);
  });

  it("fordert zum Melden auf, wenn es niemand veranlasst hat", () => {
    expect(zweiteStufeZurueckgesetztInhalt("Lisa").emailHtml).toContain("melde dich bitte sofort im Studio");
  });

  it("führt zur Einrichtung, nicht ins Profil", () => {
    expect(zweiteStufeZurueckgesetztInhalt("Lisa").url).toBe("/sicherheit/einrichten");
  });
});

describe("ticketStorniertInhalt (PROJ-59)", () => {
  const basis = { eventName: "Salsa Party", startsAt: "2026-10-03T20:00:00Z", grund: null, gutschrift: 0 };

  it("nennt Event und Termin", () => {
    const inhalt = ticketStorniertInhalt(basis);
    expect(inhalt.subject).toContain("Salsa Party");
    expect(inhalt.emailHtml).toContain("03.10.2026");
  });

  it("nennt den Grund, wenn einer angegeben wurde", () => {
    expect(ticketStorniertInhalt({ ...basis, grund: "Auf deinen Wunsch" }).emailHtml).toContain(
      "Auf deinen Wunsch"
    );
  });

  it("lässt die Zeile weg, wenn kein Grund angegeben wurde", () => {
    expect(ticketStorniertInhalt(basis).emailHtml).not.toContain("Grund:");
  });

  it("nennt den Betrag, wenn ein Guthaben gutgeschrieben wurde", () => {
    const inhalt = ticketStorniertInhalt({ ...basis, gutschrift: 18 });
    expect(inhalt.emailHtml).toContain("18,00");
    expect(inhalt.emailHtml).toContain("Guthaben");
  });

  it("schweigt vom Guthaben, wenn keines gutgeschrieben wurde", () => {
    expect(ticketStorniertInhalt(basis).emailHtml).not.toContain("Guthaben");
  });

  it("maskiert HTML im Grund", () => {
    const grund = '<script>alert(1)</script>';
    const inhalt = ticketStorniertInhalt({ ...basis, grund });
    expect(inhalt.emailHtml).not.toContain(grund);
    expect(inhalt.emailHtml).toContain("&lt;script&gt;");
  });

  it("antwortet auf Englisch, wenn der Kunde Englisch eingestellt hat", () => {
    const inhalt = ticketStorniertInhalt({ ...basis, gutschrift: 18 }, "en");
    expect(inhalt.subject).toContain("cancelled");
    expect(inhalt.emailHtml).toContain("has been cancelled by the studio");
    expect(inhalt.emailHtml).toContain("offset against your next booking");
  });

  it("führt zu den eigenen Tickets", () => {
    expect(ticketStorniertInhalt(basis).url).toBe("/profil#tickets");
  });
});
