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

function emailShell(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="background: linear-gradient(135deg, #ff3b30, #ffb000); padding: 16px 20px; border-radius: 12px 12px 0 0;">
        <span style="color: #fff; font-weight: 700; font-size: 16px;">Vienna Salsa Studio</span>
      </div>
      <div style="border: 1px solid #eee; border-top: none; border-radius: 0 0 12px 12px; padding: 24px 20px;">
        <h1 style="font-size: 18px; margin: 0 0 12px; color: #0b1020;">${title}</h1>
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

export function buildNotificationContent(
  eventType: NotificationEventGroup | "sepa_ankuendigung",
  details:
    | BuchungsstatusDetails
    | WartelisteDetails
    | AboKuendigungDetails
    | KursstartErinnerungDetails
    | SepaAnkuendigungDetails
): NotificationContent {
  switch (eventType) {
    case "buchungsstatus": {
      const d = details as BuchungsstatusDetails;
      const confirmed = d.newStatus === "confirmed";
      const subject = confirmed
        ? `Buchung bestätigt: ${d.courseName}`
        : `Buchung abgelehnt: ${d.courseName}`;
      const body = confirmed
        ? `<p>Deine Buchungsanfrage für <strong>${d.courseName}</strong> wurde bestätigt.</p>`
        : `<p>Deine Buchungsanfrage für <strong>${d.courseName}</strong> wurde leider abgelehnt.</p>`;
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
      const subject = `Du bist nachgerückt: ${d.courseName}`;
      return {
        subject,
        emailHtml: emailShell(
          subject,
          `<p>Ein Platz in <strong>${d.courseName}</strong> ist frei geworden — du bist automatisch von der Warteliste nachgerückt für den ${formatDate(d.chosenDate)}.</p>`
        ),
        pushTitle: subject,
        pushBody: `Du bist in ${d.courseName} nachgerückt.`,
        url: "/profil",
      };
    }
    case "abo_kuendigung": {
      const d = details as AboKuendigungDetails;
      const paused = d.newStatus === "paused";
      const subject = paused
        ? `Pausierung wirksam: ${d.subscriptionName}`
        : `Kündigung wirksam: ${d.subscriptionName}`;
      const body = paused
        ? `<p>Deine Pausierung von <strong>${d.subscriptionName}</strong> ist seit ${formatDate(d.effectiveDate)} wirksam.</p>`
        : `<p>Deine Kündigung von <strong>${d.subscriptionName}</strong> ist seit ${formatDate(d.effectiveDate)} wirksam.</p>`;
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
      const label = d.type === "trial" ? "Probestunde" : "Drop-in";
      const subject = `Erinnerung: ${label} morgen in ${d.courseName}`;
      return {
        subject,
        emailHtml: emailShell(
          subject,
          `<p>Denk dran: Morgen, ${formatDate(d.chosenDate)}, hast du deine ${label} in <strong>${d.courseName}</strong>.</p>`
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
  }
}
