import type { NotificationEventGroup } from "@/lib/constants/notifications";
import {
  getTemplateMeta,
  substitutePlain,
  substituteHtml,
  type TemplateKey,
  type TemplateFields,
} from "@/lib/notifications/template-registry";

export type NotificationContent = {
  subject: string;
  emailHtml: string;
  pushTitle: string;
  pushBody: string;
  url: string;
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://viennasalsastudio.vercel.app";

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Events store a full timestamp (not just a date), unlike everything else here. */
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Escapes text for safe interpolation into HTML — course/subscription names
 *  are admin-provided, not hardcoded, so must never be embedded raw (BUG-3). */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emailShell(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="background: linear-gradient(135deg, #ff3b30, #ffb000); padding: 16px 20px; border-radius: 12px 12px 0 0;">
        <span style="color: #fff; font-weight: 700; font-size: 16px;">Vienna Salsa Studio</span>
      </div>
      <div style="border: 1px solid #eee; border-top: none; border-radius: 0 0 12px 12px; padding: 24px 20px;">
        <h1 style="font-size: 18px; margin: 0 0 12px; color: #0b1020;">${escapeHtml(title)}</h1>
        ${bodyHtml}
        <p style="margin-top: 24px;">
          <a href="${SITE_URL}/profil" style="color: #ff3b30; text-decoration: none; font-weight: 600;">Zu meinem Profil →</a>
        </p>
      </div>
    </div>
  `;
}

/** Renders a template variant (PROJ-34: admin-editable `override`, falling back to
 *  the registry default) against `values` into the four content fields shared by
 *  every case below. `extraBodyHtml` is fixed, non-editable markup appended after
 *  the rendered body (e.g. the "jetzt buchen" link on probestunde_nachfassung). */
function renderTemplate(
  key: TemplateKey,
  values: Record<string, string>,
  override: TemplateFields | undefined,
  extraBodyHtml = "",
  locale = "de"
): { subject: string; emailHtml: string; pushTitle: string; pushBody: string } {
  const meta = getTemplateMeta(key);
  if (!meta) throw new Error(`Unknown template key: ${key}`);
  // PROJ-43: Eine angepasste Fassung des Betreibers geht vor. Fehlt sie, gilt
  // die Vorlage in der Sprache des Empfängers — und fehlt die englische, die
  // deutsche: eine Benachrichtigung in der falschen Sprache ist besser als
  // keine.
  const fields = override ?? (locale === "en" ? meta.defaultsEn ?? meta.defaults : meta.defaults);

  const subject = substitutePlain(fields.emailSubject, values);
  const bodyHtml = `<p>${substituteHtml(fields.emailBody, values, meta.boldPlaceholder)}</p>${extraBodyHtml}`;
  return {
    subject,
    emailHtml: emailShell(subject, bodyHtml),
    pushTitle: substitutePlain(fields.pushTitle, values),
    pushBody: substitutePlain(fields.pushBody, values),
  };
}

export type BuchungsstatusDetails = { courseName: string; newStatus: "confirmed" | "rejected" };
export type WartelisteDetails = { courseName: string; chosenDate: string };
export type AboKuendigungDetails = {
  subscriptionName: string;
  newStatus: "paused" | "cancelled";
  effectiveDate: string;
};
export type KursstartErinnerungDetails = { courseName: string; chosenDate: string; type: "trial" | "dropin" };
export type SepaAnkuendigungDetails = { amount: number; dueDate: string };
/** PROJ-37: invoice amount and bank fee stay separate so the customer can see
 *  why more is owed than the invoice says. */
/** PROJ-38: which course, and which date fell through. */
export type KursausfallDetails = { courseName: string; pauseDate: string };
export type ZahlungserinnerungDetails = { invoiceNumber: string; grossAmount: number; bounceFee: number };
export type EventTicketDetails =
  | { subType: "purchased"; eventName: string; startsAt: string; ticketStatus: "confirmed" | "reserved" }
  | { subType: "event_cancelled"; eventName: string; startsAt: string };
export type ProbestundeNachfassungDetails = {
  subType: "abend" | "naechster_termin";
  courseName: string;
  courseId: string;
};
export type NewsletterDetails = { subject: string; body: string };
/** PROJ-39: internal alert to the admin, not a customer-facing message. */
export type NeueBuchungDetails = { customerName: string; courseName: string; bookingType: "regular" | "dropin" };

/** PROJ-34: resolves which of the 12 editable template variants a given
 *  (eventType, details) pair renders as — e.g. so a caller can look up an
 *  override row before calling `buildNotificationContent`. Returns null for
 *  "newsletter", which has its own admin-authored text (PROJ-28), not a
 *  registry template. */
export function resolveTemplateKey(
  eventType: NotificationEventGroup | "sepa_ankuendigung" | "zahlungserinnerung" | "kursausfall",
  details:
    | BuchungsstatusDetails
    | WartelisteDetails
    | AboKuendigungDetails
    | KursstartErinnerungDetails
    | SepaAnkuendigungDetails
    | ZahlungserinnerungDetails
    | KursausfallDetails
    | EventTicketDetails
    | ProbestundeNachfassungDetails
    | NewsletterDetails
): TemplateKey | null {
  switch (eventType) {
    case "buchungsstatus":
      return (details as BuchungsstatusDetails).newStatus === "confirmed"
        ? "buchungsstatus_bestaetigt"
        : "buchungsstatus_abgelehnt";
    case "warteliste":
      return "warteliste";
    case "abo_kuendigung":
      return (details as AboKuendigungDetails).newStatus === "paused" ? "abo_pausiert" : "abo_gekuendigt";
    case "kursstart_erinnerung":
      return "kursstart_erinnerung";
    case "sepa_ankuendigung":
      return "sepa_ankuendigung";
    case "zahlungserinnerung":
      return "zahlungserinnerung";
    case "kursausfall":
      return "kursausfall";
    case "event_tickets": {
      const d = details as EventTicketDetails;
      if (d.subType === "event_cancelled") return "event_abgesagt";
      return d.ticketStatus === "confirmed" ? "event_ticket_bestaetigt" : "event_ticket_reserviert";
    }
    case "probestunde_nachfassung":
      return (details as ProbestundeNachfassungDetails).subType === "abend"
        ? "probestunde_nachfassung_abend"
        : "probestunde_nachfassung_naechster_termin";
    case "newsletter":
      return null;
  }
}

/** PROJ-34: an admin-authored override for the one template variant this call
 *  will actually render — the caller resolves which `TemplateKey` applies
 *  (e.g. confirmed vs. rejected) and passes the matching row, if any. */
export function buildNotificationContent(
  eventType:
    | NotificationEventGroup
    | "sepa_ankuendigung"
    | "neue_buchung"
    | "zahlungserinnerung"
    | "kursausfall",
  details:
    | BuchungsstatusDetails
    | WartelisteDetails
    | AboKuendigungDetails
    | KursstartErinnerungDetails
    | SepaAnkuendigungDetails
    | ZahlungserinnerungDetails
    | KursausfallDetails
    | EventTicketDetails
    | ProbestundeNachfassungDetails
    | NewsletterDetails
    | NeueBuchungDetails,
  override?: TemplateFields,
  /** Sprache des Empfängers, aus profiles.language (PROJ-43). */
  locale = "de"
): NotificationContent {
  switch (eventType) {
    case "buchungsstatus": {
      const d = details as BuchungsstatusDetails;
      const confirmed = d.newStatus === "confirmed";
      const key: TemplateKey = confirmed ? "buchungsstatus_bestaetigt" : "buchungsstatus_abgelehnt";
      return { ...renderTemplate(key, { kurs: d.courseName }, override, "", locale), url: "/profil" };
    }
    case "warteliste": {
      const d = details as WartelisteDetails;
      return {
        ...renderTemplate("warteliste", { kurs: d.courseName, datum: formatDate(d.chosenDate) }, override, "", locale),
        url: "/profil",
      };
    }
    case "abo_kuendigung": {
      const d = details as AboKuendigungDetails;
      const key: TemplateKey = d.newStatus === "paused" ? "abo_pausiert" : "abo_gekuendigt";
      return {
        ...renderTemplate(key, { abo: d.subscriptionName, datum: formatDate(d.effectiveDate) }, override, "", locale),
        url: "/profil",
      };
    }
    case "kursstart_erinnerung": {
      const d = details as KursstartErinnerungDetails;
      const label = d.type === "trial" ? "Probestunde" : "Drop-in";
      return {
        ...renderTemplate(
          "kursstart_erinnerung",
          { kurs: d.courseName, datum: formatDate(d.chosenDate), typ: label },
          override,
          "",
          locale
        ),
        url: "/profil",
      };
    }
    case "sepa_ankuendigung": {
      const d = details as SepaAnkuendigungDetails;
      const amountText = d.amount.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
      return {
        ...renderTemplate("sepa_ankuendigung", { betrag: amountText, datum: formatDate(d.dueDate) }, override, "", locale),
        url: "/rechnungen",
      };
    }
    case "kursausfall": {
      const d = details as KursausfallDetails;
      return {
        ...renderTemplate("kursausfall", { kurs: d.courseName, datum: formatDate(d.pauseDate) }, override, "", locale),
        url: "/stundenplan",
      };
    }
    case "zahlungserinnerung": {
      const d = details as ZahlungserinnerungDetails;
      const euro = (n: number) => n.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
      return {
        ...renderTemplate(
          "zahlungserinnerung",
          {
            rechnungsnummer: d.invoiceNumber,
            betrag: euro(d.grossAmount),
            gebuehr: euro(d.bounceFee),
            gesamt: euro(d.grossAmount + d.bounceFee),
          },
          override,
          "",
          locale
        ),
        url: "/rechnungen",
      };
    }
    case "kursausfall": {
      const d = details as KursausfallDetails;
      return {
        ...renderTemplate("kursausfall", { kurs: d.courseName, datum: formatDate(d.pauseDate) }, override, "", locale),
        url: "/stundenplan",
      };
    }
    case "zahlungserinnerung": {
      const d = details as ZahlungserinnerungDetails;
      const euro = (n: number) => n.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
      return {
        ...renderTemplate(
          "zahlungserinnerung",
          {
            rechnungsnummer: d.invoiceNumber,
            betrag: euro(d.grossAmount),
            gebuehr: euro(d.bounceFee),
            gesamt: euro(d.grossAmount + d.bounceFee),
          },
          override,
          "",
          locale
        ),
        url: "/rechnungen",
      };
    }
    case "event_tickets": {
      const d = details as EventTicketDetails;
      const whenText = formatDateTime(d.startsAt);

      if (d.subType === "event_cancelled") {
        return {
          ...renderTemplate("event_abgesagt", { event: d.eventName, zeitpunkt: whenText }, override, "", locale),
          url: "/profil",
        };
      }

      const key: TemplateKey = d.ticketStatus === "confirmed" ? "event_ticket_bestaetigt" : "event_ticket_reserviert";
      return {
        ...renderTemplate(key, { event: d.eventName, zeitpunkt: whenText }, override, "", locale),
        url: "/profil",
      };
    }
    case "probestunde_nachfassung": {
      const d = details as ProbestundeNachfassungDetails;
      const url = `/kurse/${d.courseId}`;
      const linkHtml = `<p><a href="${SITE_URL}${url}" style="color: #ff3b30; text-decoration: none; font-weight: 600;">${escapeHtml(d.courseName)} jetzt buchen →</a></p>`;
      const key: TemplateKey =
        d.subType === "abend" ? "probestunde_nachfassung_abend" : "probestunde_nachfassung_naechster_termin";
      return { ...renderTemplate(key, { kurs: d.courseName }, override, linkHtml, locale), url };
    }
    // PROJ-39: goes to the admin, not to a customer. Deliberately not part of
    // the PROJ-34 template registry — that editor manages customer-facing
    // texts, and an internal work alert there would only blur the picture.
    // Push-only in practice (see dispatch.ts); subject/emailHtml exist solely
    // to satisfy the shared NotificationContent shape.
    case "neue_buchung": {
      const d = details as NeueBuchungDetails;
      const label = d.bookingType === "dropin" ? "Drop-in-Anfrage" : "Buchungsanfrage";
      const subject = `Neue ${label}: ${d.customerName}`;
      return {
        subject,
        emailHtml: emailShell(subject, `<p>${escapeHtml(d.customerName)} — ${escapeHtml(d.courseName)}</p>`),
        pushTitle: `Neue ${label}`,
        pushBody: `${d.customerName} — ${d.courseName}`,
        url: "/admin/buchungen",
      };
    }
    case "newsletter": {
      const d = details as NewsletterDetails;
      const bodyHtml = d.body
        .split(/\n{2,}/)
        .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
        .join("");
      return {
        subject: d.subject,
        emailHtml: emailShell(d.subject, bodyHtml),
        // Newsletter is email-only (no push channel) — these are never sent, kept
        // only so this case still satisfies the shared NotificationContent shape.
        pushTitle: d.subject,
        pushBody: d.subject,
        url: "/profil",
      };
    }
  }
}

/** PROJ-34: renders one of the 12 editable template variants against
 *  representative sample data — used for the admin editor's live preview and
 *  test-send, so both go through the exact same render path (`buildNotificationContent`)
 *  as a real dispatch, just with fixture data instead of a real customer's. */
export function buildPreviewContent(key: TemplateKey, fields: TemplateFields): NotificationContent {
  switch (key) {
    case "buchungsstatus_bestaetigt":
      return buildNotificationContent(
        "buchungsstatus",
        { courseName: "Salsa Beginner 1", newStatus: "confirmed" },
        fields
      );
    case "buchungsstatus_abgelehnt":
      return buildNotificationContent(
        "buchungsstatus",
        { courseName: "Salsa Beginner 1", newStatus: "rejected" },
        fields
      );
    case "warteliste":
      return buildNotificationContent(
        "warteliste",
        { courseName: "Salsa Beginner 1", chosenDate: "2026-09-07" },
        fields
      );
    case "abo_pausiert":
      return buildNotificationContent(
        "abo_kuendigung",
        { subscriptionName: "1x pro Woche", newStatus: "paused", effectiveDate: "2026-09-07" },
        fields
      );
    case "abo_gekuendigt":
      return buildNotificationContent(
        "abo_kuendigung",
        { subscriptionName: "1x pro Woche", newStatus: "cancelled", effectiveDate: "2026-09-07" },
        fields
      );
    case "kursstart_erinnerung":
      return buildNotificationContent(
        "kursstart_erinnerung",
        { courseName: "Salsa Beginner 1", chosenDate: "2026-09-07", type: "trial" },
        fields
      );
    case "sepa_ankuendigung":
      return buildNotificationContent("sepa_ankuendigung", { amount: 40, dueDate: "2026-09-15" }, fields);
    case "kursausfall":
      return buildNotificationContent(
        "kursausfall",
        { courseName: "Salsa Beginner 1", pauseDate: "2026-12-01" },
        fields
      );
    case "zahlungserinnerung":
      return buildNotificationContent(
        "zahlungserinnerung",
        { invoiceNumber: "2026-0042", grossAmount: 40, bounceFee: 4.5 },
        fields
      );
    case "event_ticket_bestaetigt":
      return buildNotificationContent(
        "event_tickets",
        { subType: "purchased", eventName: "Salsa Sommer Workshop", startsAt: "2026-09-20T19:00:00Z", ticketStatus: "confirmed" },
        fields
      );
    case "event_ticket_reserviert":
      return buildNotificationContent(
        "event_tickets",
        { subType: "purchased", eventName: "Salsa Sommer Workshop", startsAt: "2026-09-20T19:00:00Z", ticketStatus: "reserved" },
        fields
      );
    case "event_abgesagt":
      return buildNotificationContent(
        "event_tickets",
        { subType: "event_cancelled", eventName: "Salsa Sommer Workshop", startsAt: "2026-09-20T19:00:00Z" },
        fields
      );
    case "probestunde_nachfassung_abend":
      return buildNotificationContent(
        "probestunde_nachfassung",
        { subType: "abend", courseName: "Salsa Beginner 1", courseId: "00000000-0000-0000-0000-000000000000" },
        fields
      );
    case "probestunde_nachfassung_naechster_termin":
      return buildNotificationContent(
        "probestunde_nachfassung",
        { subType: "naechster_termin", courseName: "Salsa Beginner 1", courseId: "00000000-0000-0000-0000-000000000000" },
        fields
      );
  }
}
