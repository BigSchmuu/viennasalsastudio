import type { NotificationEventGroup } from "@/lib/constants/notifications";

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

export type BuchungsstatusDetails = { courseName: string; newStatus: "confirmed" | "rejected" };
export type WartelisteDetails = { courseName: string; chosenDate: string };
export type AboKuendigungDetails = {
  subscriptionName: string;
  newStatus: "paused" | "cancelled";
  effectiveDate: string;
};
export type KursstartErinnerungDetails = { courseName: string; chosenDate: string; type: "trial" | "dropin" };
export type SepaAnkuendigungDetails = { amount: number; dueDate: string };
export type EventTicketDetails =
  | { subType: "purchased"; eventName: string; startsAt: string; ticketStatus: "confirmed" | "reserved" }
  | { subType: "event_cancelled"; eventName: string; startsAt: string };
export type ProbestundeNachfassungDetails = {
  subType: "abend" | "naechster_termin";
  courseName: string;
  courseId: string;
};
export type NewsletterDetails = { subject: string; body: string };

export function buildNotificationContent(
  eventType: NotificationEventGroup | "sepa_ankuendigung",
  details:
    | BuchungsstatusDetails
    | WartelisteDetails
    | AboKuendigungDetails
    | KursstartErinnerungDetails
    | SepaAnkuendigungDetails
    | EventTicketDetails
    | ProbestundeNachfassungDetails
    | NewsletterDetails
): NotificationContent {
  switch (eventType) {
    case "buchungsstatus": {
      const d = details as BuchungsstatusDetails;
      const courseNameHtml = escapeHtml(d.courseName);
      const confirmed = d.newStatus === "confirmed";
      const subject = confirmed
        ? `Buchung bestätigt: ${d.courseName}`
        : `Buchung abgelehnt: ${d.courseName}`;
      const body = confirmed
        ? `<p>Deine Buchungsanfrage für <strong>${courseNameHtml}</strong> wurde bestätigt.</p>`
        : `<p>Deine Buchungsanfrage für <strong>${courseNameHtml}</strong> wurde leider abgelehnt.</p>`;
      return {
        subject,
        emailHtml: emailShell(subject, body),
        pushTitle: subject,
        pushBody: confirmed ? `${d.courseName} ist bestätigt.` : `${d.courseName} wurde abgelehnt.`,
        url: "/profil",
      };
    }
    case "warteliste": {
      const d = details as WartelisteDetails;
      const courseNameHtml = escapeHtml(d.courseName);
      const subject = `Du bist nachgerückt: ${d.courseName}`;
      return {
        subject,
        emailHtml: emailShell(
          subject,
          `<p>Ein Platz in <strong>${courseNameHtml}</strong> ist frei geworden — du bist automatisch von der Warteliste nachgerückt für den ${formatDate(d.chosenDate)}.</p>`
        ),
        pushTitle: subject,
        pushBody: `Du bist in ${d.courseName} nachgerückt.`,
        url: "/profil",
      };
    }
    case "abo_kuendigung": {
      const d = details as AboKuendigungDetails;
      const subscriptionNameHtml = escapeHtml(d.subscriptionName);
      const paused = d.newStatus === "paused";
      const subject = paused
        ? `Pausierung wirksam: ${d.subscriptionName}`
        : `Kündigung wirksam: ${d.subscriptionName}`;
      const body = paused
        ? `<p>Deine Pausierung von <strong>${subscriptionNameHtml}</strong> ist seit ${formatDate(d.effectiveDate)} wirksam.</p>`
        : `<p>Deine Kündigung von <strong>${subscriptionNameHtml}</strong> ist seit ${formatDate(d.effectiveDate)} wirksam.</p>`;
      return {
        subject,
        emailHtml: emailShell(subject, body),
        pushTitle: subject,
        pushBody: paused ? `${d.subscriptionName} ist jetzt pausiert.` : `${d.subscriptionName} ist gekündigt.`,
        url: "/profil",
      };
    }
    case "kursstart_erinnerung": {
      const d = details as KursstartErinnerungDetails;
      const courseNameHtml = escapeHtml(d.courseName);
      const label = d.type === "trial" ? "Probestunde" : "Drop-in";
      const subject = `Erinnerung: ${label} morgen in ${d.courseName}`;
      return {
        subject,
        emailHtml: emailShell(
          subject,
          `<p>Denk dran: Morgen, ${formatDate(d.chosenDate)}, hast du deine ${label} in <strong>${courseNameHtml}</strong>.</p>`
        ),
        pushTitle: subject,
        pushBody: `Morgen: ${label} in ${d.courseName}.`,
        url: "/profil",
      };
    }
    case "sepa_ankuendigung": {
      const d = details as SepaAnkuendigungDetails;
      const amountText = d.amount.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
      const subject = `Bevorstehender Lastschrifteinzug: ${amountText}`;
      return {
        subject,
        emailHtml: emailShell(
          subject,
          `<p>Am ${formatDate(d.dueDate)} ziehen wir <strong>${amountText}</strong> per SEPA-Lastschrift von deinem Konto ein.</p>`
        ),
        pushTitle: subject,
        pushBody: `${amountText} am ${formatDate(d.dueDate)}.`,
        url: "/rechnungen",
      };
    }
    case "event_tickets": {
      const d = details as EventTicketDetails;
      const eventNameHtml = escapeHtml(d.eventName);
      const whenText = formatDateTime(d.startsAt);

      if (d.subType === "event_cancelled") {
        const subject = `Event abgesagt: ${d.eventName}`;
        return {
          subject,
          emailHtml: emailShell(
            subject,
            `<p>Das Event <strong>${eventNameHtml}</strong> am ${whenText} wurde leider abgesagt. Dein Ticket ist damit hinfällig; eine eventuelle Rückerstattung erfolgt außerhalb der App.</p>`
          ),
          pushTitle: subject,
          pushBody: `${d.eventName} wurde abgesagt.`,
          url: "/profil",
        };
      }

      const confirmed = d.ticketStatus === "confirmed";
      const subject = confirmed ? `Ticket bestätigt: ${d.eventName}` : `Ticket reserviert: ${d.eventName}`;
      const body = confirmed
        ? `<p>Dein Ticket für <strong>${eventNameHtml}</strong> am ${whenText} ist bestätigt. Den QR-Code für den Einlass findest du in deinem Profil.</p>`
        : `<p>Dein Ticket für <strong>${eventNameHtml}</strong> am ${whenText} ist reserviert. Bitte den Betrag vor Ort bezahlen — den QR-Code für den Einlass findest du in deinem Profil.</p>`;
      return {
        subject,
        emailHtml: emailShell(subject, body),
        pushTitle: subject,
        pushBody: confirmed ? `${d.eventName} ist bestätigt.` : `${d.eventName} ist reserviert — vor Ort zahlen.`,
        url: "/profil",
      };
    }
    case "probestunde_nachfassung": {
      const d = details as ProbestundeNachfassungDetails;
      const courseNameHtml = escapeHtml(d.courseName);
      const url = `/kurse/${d.courseId}`;
      const linkHtml = `<p><a href="${SITE_URL}${url}" style="color: #ff3b30; text-decoration: none; font-weight: 600;">${escapeHtml(d.courseName)} jetzt buchen →</a></p>`;

      if (d.subType === "abend") {
        const subject = `Wie war deine Probestunde in ${d.courseName}?`;
        return {
          subject,
          emailHtml: emailShell(
            subject,
            `<p>Wir hoffen, dir hat die Probestunde in <strong>${courseNameHtml}</strong> gefallen! Wenn du dabei bleiben möchtest, kannst du direkt buchen.</p>${linkHtml}`
          ),
          pushTitle: subject,
          pushBody: `Jetzt ${d.courseName} buchen?`,
          url,
        };
      }

      const subject = `Der nächste Termin von ${d.courseName} steht bevor`;
      return {
        subject,
        emailHtml: emailShell(
          subject,
          `<p>Der nächste Termin von <strong>${courseNameHtml}</strong> steht bald an — noch nicht zu spät, um dabei zu sein!</p>${linkHtml}`
        ),
        pushTitle: subject,
        pushBody: `Nächster Termin von ${d.courseName} steht bevor.`,
        url,
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
