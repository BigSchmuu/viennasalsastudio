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
  | "probestunde_nachfassung_naechster_termin";

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
