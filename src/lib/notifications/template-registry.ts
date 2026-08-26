export type TemplateKey =
  | "buchungsstatus_bestaetigt"
  | "buchungsstatus_abgelehnt"
  | "warteliste"
  | "abo_pausiert"
  | "abo_gekuendigt"
  | "kursstart_erinnerung"
  | "sepa_ankuendigung"
  | "event_ticket_bestaetigt"
  | "event_ticket_reserviert"
  | "event_abgesagt"
  | "probestunde_nachfassung_abend"
  | "probestunde_nachfassung_naechster_termin"
  | "zahlungserinnerung"
  | "kursausfall"
  | "empfehlung_gutgeschrieben";

export type TemplateFields = {
  emailSubject: string;
  emailBody: string;
  pushTitle: string;
  pushBody: string;
};

export type TemplateMeta = {
  key: TemplateKey;
  eventGroupLabel: string;
  variantLabel: string;
  placeholders: string[];
  /** Which placeholder gets bold-wrapped in the rendered email body — matches the
   *  single "primary entity" each original hardcoded template highlighted in <strong>. */
  boldPlaceholder: string;
  /** Display-only sample values, shown in the editor as a hint (e.g. "{kurs} → Salsa Beginner 1"). */
  samples: Record<string, string>;
  defaults: TemplateFields;
  /**
   * Englische Fassung (PROJ-43). Welche gilt, entscheidet die am Kundenkonto
   * gespeicherte Sprache — nicht die des Browsers: eine Benachrichtigung
   * entsteht, wenn niemand vor dem Bildschirm sitzt.
   */
  defaultsEn: TemplateFields;
};

export const TEMPLATE_REGISTRY: TemplateMeta[] = [
  {
    key: "buchungsstatus_bestaetigt",
    eventGroupLabel: "Buchungsstatus",
    variantLabel: "Bestätigt",
    placeholders: ["kurs"],
    boldPlaceholder: "kurs",
    samples: { kurs: "Salsa Beginner 1" },
    defaults: {
      emailSubject: "Buchung bestätigt: {kurs}",
      emailBody: "Deine Buchungsanfrage für {kurs} wurde bestätigt.",
      pushTitle: "Buchung bestätigt: {kurs}",
      pushBody: "{kurs} ist bestätigt.",
    },
    defaultsEn: {
      emailSubject: "Booking confirmed: {kurs}",
      emailBody:
        "Your booking request for {kurs} has been confirmed.",
      pushTitle: "Booking confirmed: {kurs}",
      pushBody: "{kurs} is confirmed.",
    },
  },
  {
    key: "buchungsstatus_abgelehnt",
    eventGroupLabel: "Buchungsstatus",
    variantLabel: "Abgelehnt",
    placeholders: ["kurs"],
    boldPlaceholder: "kurs",
    samples: { kurs: "Salsa Beginner 1" },
    defaults: {
      emailSubject: "Buchung abgelehnt: {kurs}",
      emailBody: "Deine Buchungsanfrage für {kurs} wurde leider abgelehnt.",
      pushTitle: "Buchung abgelehnt: {kurs}",
      pushBody: "{kurs} wurde abgelehnt.",
    },
    defaultsEn: {
      emailSubject: "Booking declined: {kurs}",
      emailBody:
        "Unfortunately your booking request for {kurs} was declined.",
      pushTitle: "Booking declined: {kurs}",
      pushBody: "{kurs} was declined.",
    },
  },
  {
    key: "warteliste",
    eventGroupLabel: "Warteliste",
    variantLabel: "Nachgerückt",
    placeholders: ["kurs", "datum"],
    boldPlaceholder: "kurs",
    samples: { kurs: "Salsa Beginner 1", datum: "07.09.2026" },
    defaults: {
      emailSubject: "Du bist nachgerückt: {kurs}",
      emailBody:
        "Ein Platz in {kurs} ist frei geworden — du bist automatisch von der Warteliste nachgerückt für den {datum}.",
      pushTitle: "Du bist nachgerückt: {kurs}",
      pushBody: "Du bist in {kurs} nachgerückt.",
    },
    defaultsEn: {
      emailSubject: "You're in: {kurs}",
      emailBody:
        "A spot in {kurs} has opened up — you've moved up from the waiting list automatically for {datum}.",
      pushTitle: "You're in: {kurs}",
      pushBody: "You've moved up into {kurs}.",
    },
  },
  {
    key: "abo_pausiert",
    eventGroupLabel: "Abo-Kündigung",
    variantLabel: "Pausiert",
    placeholders: ["abo", "datum"],
    boldPlaceholder: "abo",
    samples: { abo: "1x pro Woche", datum: "07.09.2026" },
    defaults: {
      emailSubject: "Pausierung wirksam: {abo}",
      emailBody: "Deine Pausierung von {abo} ist seit {datum} wirksam.",
      pushTitle: "Pausierung wirksam: {abo}",
      pushBody: "{abo} ist jetzt pausiert.",
    },
    defaultsEn: {
      emailSubject: "Pause in effect: {abo}",
      emailBody:
        "Your pause of {abo} has been in effect since {datum}.",
      pushTitle: "Pause in effect: {abo}",
      pushBody: "{abo} is now paused.",
    },
  },
  {
    key: "abo_gekuendigt",
    eventGroupLabel: "Abo-Kündigung",
    variantLabel: "Gekündigt",
    placeholders: ["abo", "datum"],
    boldPlaceholder: "abo",
    samples: { abo: "1x pro Woche", datum: "07.09.2026" },
    defaults: {
      emailSubject: "Kündigung wirksam: {abo}",
      emailBody: "Deine Kündigung von {abo} ist seit {datum} wirksam.",
      pushTitle: "Kündigung wirksam: {abo}",
      pushBody: "{abo} ist gekündigt.",
    },
    defaultsEn: {
      emailSubject: "Cancellation in effect: {abo}",
      emailBody:
        "Your cancellation of {abo} has been in effect since {datum}.",
      pushTitle: "Cancellation in effect: {abo}",
      pushBody: "{abo} has been cancelled.",
    },
  },
  {
    key: "kursstart_erinnerung",
    eventGroupLabel: "Kursstart-Erinnerung",
    variantLabel: "Erinnerung",
    placeholders: ["kurs", "datum", "typ"],
    boldPlaceholder: "kurs",
    samples: { kurs: "Salsa Beginner 1", datum: "07.09.2026", typ: "Probestunde" },
    defaults: {
      emailSubject: "Erinnerung: {typ} morgen in {kurs}",
      emailBody: "Denk dran: Morgen, {datum}, hast du deine {typ} in {kurs}.",
      pushTitle: "Erinnerung: {typ} morgen in {kurs}",
      pushBody: "Morgen: {typ} in {kurs}.",
    },
    defaultsEn: {
      emailSubject: "Reminder: {typ} tomorrow in {kurs}",
      emailBody:
        "A quick reminder: tomorrow, {datum}, you have your {typ} in {kurs}.",
      pushTitle: "Reminder: {typ} tomorrow in {kurs}",
      pushBody: "Tomorrow: {typ} in {kurs}.",
    },
  },
  {
    key: "empfehlung_gutgeschrieben",
    eventGroupLabel: "Empfehlung hat gezählt",
    variantLabel: "Guthaben gutgeschrieben",
    placeholders: ["betrag", "guthaben"],
    boldPlaceholder: "betrag",
    samples: { betrag: "15,00 €", guthaben: "30,00 €" },
    defaults: {
      emailSubject: "Deine Empfehlung hat gezählt: {betrag} Guthaben",
      emailBody:
        "Jemand hat mit deinem Empfehlungscode gebucht und den ersten Beitrag bezahlt. Dafür schreiben wir dir {betrag} gut. Dein Guthaben beträgt jetzt {guthaben} und wird automatisch von deinem nächsten Abo-Beitrag abgezogen.",
      pushTitle: "Deine Empfehlung hat gezählt: {betrag} Guthaben",
      pushBody: "Dein Guthaben beträgt jetzt {guthaben}.",
    },
    defaultsEn: {
      emailSubject: "Your referral counted: {betrag} credit",
      emailBody:
        "Someone booked with your referral code and paid their first membership fee. We've credited you {betrag}. Your credit is now {guthaben} and will be deducted automatically from your next membership payment.",
      pushTitle: "Your referral counted: {betrag} credit",
      pushBody: "Your credit is now {guthaben}.",
    },
  },
  {
    key: "sepa_ankuendigung",
    eventGroupLabel: "SEPA-Ankündigung",
    variantLabel: "Ankündigung",
    placeholders: ["betrag", "datum"],
    boldPlaceholder: "betrag",
    samples: { betrag: "40,00 €", datum: "15.09.2026" },
    defaults: {
      emailSubject: "Bevorstehender Lastschrifteinzug: {betrag}",
      emailBody: "Am {datum} ziehen wir {betrag} per SEPA-Lastschrift von deinem Konto ein.",
      pushTitle: "Bevorstehender Lastschrifteinzug: {betrag}",
      pushBody: "{betrag} am {datum}.",
    },
    defaultsEn: {
      emailSubject: "Upcoming direct debit: {betrag}",
      emailBody:
        "On {datum} we'll collect {betrag} from your account by SEPA direct debit.",
      pushTitle: "Upcoming direct debit: {betrag}",
      pushBody: "{betrag} on {datum}.",
    },
  },
  {
    key: "event_ticket_bestaetigt",
    eventGroupLabel: "Event-Tickets",
    variantLabel: "Bestätigt",
    placeholders: ["event", "zeitpunkt"],
    boldPlaceholder: "event",
    samples: { event: "Salsa Sommer Workshop", zeitpunkt: "20.09.2026, 19:00" },
    defaults: {
      emailSubject: "Ticket bestätigt: {event}",
      emailBody:
        "Dein Ticket für {event} am {zeitpunkt} ist bestätigt. Den QR-Code für den Einlass findest du in deinem Profil.",
      pushTitle: "Ticket bestätigt: {event}",
      pushBody: "{event} ist bestätigt.",
    },
    defaultsEn: {
      emailSubject: "Ticket confirmed: {event}",
      emailBody:
        "Your ticket for {event} on {zeitpunkt} is confirmed. You'll find the QR code for entry in your profile.",
      pushTitle: "Ticket confirmed: {event}",
      pushBody: "{event} is confirmed.",
    },
  },
  {
    key: "event_ticket_reserviert",
    eventGroupLabel: "Event-Tickets",
    variantLabel: "Reserviert",
    placeholders: ["event", "zeitpunkt"],
    boldPlaceholder: "event",
    samples: { event: "Salsa Sommer Workshop", zeitpunkt: "20.09.2026, 19:00" },
    defaults: {
      emailSubject: "Ticket reserviert: {event}",
      emailBody:
        "Dein Ticket für {event} am {zeitpunkt} ist reserviert. Bitte den Betrag vor Ort bezahlen — den QR-Code für den Einlass findest du in deinem Profil.",
      pushTitle: "Ticket reserviert: {event}",
      pushBody: "{event} ist reserviert — vor Ort zahlen.",
    },
    defaultsEn: {
      emailSubject: "Ticket reserved: {event}",
      emailBody:
        "Your ticket for {event} on {zeitpunkt} is reserved. Please pay on site — you'll find the QR code for entry in your profile.",
      pushTitle: "Ticket reserved: {event}",
      pushBody: "{event} is reserved — pay on site.",
    },
  },
  {
    key: "event_abgesagt",
    eventGroupLabel: "Event-Tickets",
    variantLabel: "Event abgesagt",
    placeholders: ["event", "zeitpunkt"],
    boldPlaceholder: "event",
    samples: { event: "Salsa Sommer Workshop", zeitpunkt: "20.09.2026, 19:00" },
    defaults: {
      emailSubject: "Event abgesagt: {event}",
      emailBody:
        "Das Event {event} am {zeitpunkt} wurde leider abgesagt. Dein Ticket ist damit hinfällig; eine eventuelle Rückerstattung erfolgt außerhalb der App.",
      pushTitle: "Event abgesagt: {event}",
      pushBody: "{event} wurde abgesagt.",
    },
    defaultsEn: {
      emailSubject: "Event cancelled: {event}",
      emailBody:
        "Unfortunately {event} on {zeitpunkt} has been cancelled. Your ticket is void; any refund is handled outside the app.",
      pushTitle: "Event cancelled: {event}",
      pushBody: "{event} has been cancelled.",
    },
  },
  {
    key: "probestunde_nachfassung_abend",
    eventGroupLabel: "Probestunden-Follow-up",
    variantLabel: "Am selben Abend",
    placeholders: ["kurs"],
    boldPlaceholder: "kurs",
    samples: { kurs: "Salsa Beginner 1" },
    defaults: {
      emailSubject: "Wie war deine Probestunde in {kurs}?",
      emailBody:
        "Wir hoffen, dir hat die Probestunde in {kurs} gefallen! Wenn du dabei bleiben möchtest, kannst du direkt buchen.",
      pushTitle: "Wie war deine Probestunde in {kurs}?",
      pushBody: "Jetzt {kurs} buchen?",
    },
    defaultsEn: {
      emailSubject: "How was your trial class in {kurs}?",
      emailBody:
        "We hope you enjoyed your trial class in {kurs}! If you'd like to stay, you can book right away.",
      pushTitle: "How was your trial class in {kurs}?",
      pushBody: "Book {kurs} now?",
    },
  },
  {
    key: "probestunde_nachfassung_naechster_termin",
    eventGroupLabel: "Probestunden-Follow-up",
    variantLabel: "Vor dem nächsten Termin",
    placeholders: ["kurs"],
    boldPlaceholder: "kurs",
    samples: { kurs: "Salsa Beginner 1" },
    defaults: {
      emailSubject: "Der nächste Termin von {kurs} steht bevor",
      emailBody: "Der nächste Termin von {kurs} steht bald an — noch nicht zu spät, um dabei zu sein!",
      pushTitle: "Der nächste Termin von {kurs} steht bevor",
      pushBody: "Nächster Termin von {kurs} steht bevor.",
    },
    defaultsEn: {
      emailSubject: "The next session of {kurs} is coming up",
      emailBody:
        "The next session of {kurs} is coming up soon — it's not too late to join!",
      pushTitle: "The next session of {kurs} is coming up",
      pushBody: "Next session of {kurs} is coming up.",
    },
  },
  {
    key: "zahlungserinnerung",
    eventGroupLabel: "Zahlungserinnerung",
    variantLabel: "Rücklastschrift",
    placeholders: ["rechnungsnummer", "betrag", "gebuehr", "gesamt"],
    boldPlaceholder: "gesamt",
    samples: {
      rechnungsnummer: "2026-0042",
      betrag: "40,00 €",
      gebuehr: "4,50 €",
      gesamt: "44,50 €",
    },
    defaults: {
      emailSubject: "Offene Zahlung: Rechnung {rechnungsnummer}",
      emailBody:
        "die Lastschrift für Rechnung {rechnungsnummer} über {betrag} wurde von deiner Bank zurückgebucht. Dafür ist uns eine Rücklastschrift-Gebühr von {gebuehr} entstanden. Offen sind damit {gesamt}. Bitte überweise den Betrag oder melde dich bei uns, wenn etwas nicht stimmt.",
      pushTitle: "Offene Zahlung: {gesamt}",
      pushBody: "Rechnung {rechnungsnummer} wurde zurückgebucht.",
    },
    defaultsEn: {
      emailSubject: "Outstanding payment: invoice {rechnungsnummer}",
      emailBody:
        "the direct debit for invoice {rechnungsnummer} of {betrag} was returned by your bank. This left us with a return fee of {gebuehr}, so {gesamt} is now outstanding. Please transfer the amount or get in touch if something isn't right.",
      pushTitle: "Outstanding payment: {gesamt}",
      pushBody: "Invoice {rechnungsnummer} was returned.",
    },
  },
  {
    key: "kursausfall",
    eventGroupLabel: "Kursausfall",
    variantLabel: "Termin fällt aus",
    placeholders: ["kurs", "datum"],
    boldPlaceholder: "datum",
    samples: { kurs: "Salsa Beginner 1", datum: "01.12.2026" },
    defaults: {
      emailSubject: "{kurs} fällt am {datum} aus",
      emailBody:
        "der Termin von {kurs} am {datum} muss leider entfallen. Alle weiteren Termine finden wie geplant statt. Wir freuen uns, dich beim nächsten Mal wiederzusehen!",
      pushTitle: "{kurs} fällt aus",
      pushBody: "Der Termin am {datum} entfällt.",
    },
    defaultsEn: {
      emailSubject: "{kurs} is cancelled on {datum}",
      emailBody:
        "the session of {kurs} on {datum} unfortunately has to be cancelled. All other sessions take place as planned. We look forward to seeing you next time!",
      pushTitle: "{kurs} is cancelled",
      pushBody: "The session on {datum} is cancelled.",
    },
  },
];

export function getTemplateMeta(key: string): TemplateMeta | undefined {
  return TEMPLATE_REGISTRY.find((t) => t.key === key);
}

export function isTemplateKey(key: string): key is TemplateKey {
  return TEMPLATE_REGISTRY.some((t) => t.key === key);
}

/** Placeholder names present in `text` that aren't in `allowed` — used to block
 *  saving a template with a typo'd or foreign placeholder (e.g. {kurss}). */
export function findInvalidPlaceholders(text: string, allowed: string[]): string[] {
  const found = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  return [...new Set(found.filter((name) => !allowed.includes(name)))];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Plain substitution for subject/push text — no HTML escaping, matching the
 *  pre-existing behavior where only the email body ever escaped values. */
export function substitutePlain(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in values ? values[name] : match));
}

/** HTML-safe substitution for the email body — escapes the admin-authored
 *  template text itself (not just the substituted values; braces survive
 *  escaping unchanged, so the placeholder regex still matches afterwards),
 *  and bold-wraps the template's designated "primary" placeholder. Without
 *  escaping the literal text too, a stray "<" typed by an admin (or a
 *  deliberately injected tag) would be embedded raw into real customer
 *  emails — see PROJ-34 QA BUG-1. */
export function substituteHtml(text: string, values: Record<string, string>, boldPlaceholder: string): string {
  const escapedText = escapeHtml(text);
  return escapedText.replace(/\{(\w+)\}/g, (match, name) => {
    if (!(name in values)) return match;
    const escaped = escapeHtml(values[name]);
    return name === boldPlaceholder ? `<strong>${escaped}</strong>` : escaped;
  });
}
