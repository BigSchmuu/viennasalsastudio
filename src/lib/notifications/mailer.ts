import nodemailer from "nodemailer";

/**
 * Zeitlimits für den Mailversand.
 *
 * Ohne sie gelten die Vorgaben von Nodemailer: bis zu zwei Minuten für den
 * Verbindungsaufbau und zehn Minuten Leerlauf am Socket. Das wäre folgenlos,
 * wenn der Versand im Hintergrund liefe — er läuft aber mitten in der
 * Handlung: `enqueueAndDispatch` wird in den Server-Aktionen abgewartet, also
 * hängt bei einem klemmenden Mailserver die Buchung eines Kunden, eine
 * Registrierung oder eine Bestätigung in der Verwaltung genauso lange.
 *
 * Der Fehlerfall wird dadurch nicht stiller: Auch ohne Limit endet ein
 * hängender Versand im Fehler, nur eben nach Minuten statt Sekunden. Der
 * Aufrufer behandelt ihn ohnehin (`trySendEmail` fängt und protokolliert),
 * die auslösende Handlung läuft weiter.
 *
 * Gefunden im QA-Durchgang zu PROJ-51 am 2026-09-11: In langen Testläufen
 * fielen genau die Fälle um, die beim Absenden eine Benachrichtigung
 * auslösen — und zwar in wechselnder Zusammensetzung.
 */
const VERBINDUNGSLIMIT_MS = 10_000;
const BEGRUESSUNGSLIMIT_MS = 10_000;
const SOCKETLIMIT_MS = 20_000;

let transporter: nodemailer.Transporter | null | undefined;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter !== undefined) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    transporter = null;
    return transporter;
  }

  const port = Number(SMTP_PORT) || 587;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: VERBINDUNGSLIMIT_MS,
    greetingTimeout: BEGRUESSUNGSLIMIT_MS,
    socketTimeout: SOCKETLIMIT_MS,
  });
  return transporter;
}

export async function sendNotificationEmail(to: string, subject: string, html: string): Promise<void> {
  const client = getTransporter();
  if (!client) {
    throw new Error("SMTP ist nicht konfiguriert (SMTP_HOST/SMTP_USER/SMTP_PASS fehlen).");
  }

  await client.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });
}
