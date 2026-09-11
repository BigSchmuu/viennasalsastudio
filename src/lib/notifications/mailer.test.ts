import { describe, it, expect, vi, beforeEach } from "vitest";

const createTransport = vi.fn();
vi.mock("nodemailer", () => ({
  default: { createTransport: (...args: unknown[]) => createTransport(...args) },
}));

/**
 * Der Versand läuft mitten in der Handlung, nicht im Hintergrund: Die
 * Server-Aktionen warten ihn ab. Ein Mailserver ohne Zeitlimit hängt damit die
 * Buchung eines Kunden mit — deshalb sind die Limits kein Beiwerk, sondern der
 * Grund, warum diese Datei geprüft wird.
 */
describe("mailer", () => {
  beforeEach(() => {
    vi.resetModules();
    createTransport.mockReset().mockReturnValue({ sendMail: vi.fn() });
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "absender@example.test";
    process.env.SMTP_PASS = "geheim";
  });

  it("setzt Zeitlimits für Verbindung, Begrüßung und Socket", async () => {
    const { sendNotificationEmail } = await import("./mailer");
    await sendNotificationEmail("kunde@example.test", "Betreff", "<p>Text</p>");

    const optionen = createTransport.mock.calls[0][0] as Record<string, unknown>;
    expect(optionen.connectionTimeout, "Verbindungsaufbau ohne Limit").toBe(10_000);
    expect(optionen.greetingTimeout, "Begrüßung ohne Limit").toBe(10_000);
    expect(optionen.socketTimeout, "Socket ohne Limit").toBe(20_000);
  });

  it("baut die Verbindung nur einmal auf", async () => {
    const { sendNotificationEmail } = await import("./mailer");
    await sendNotificationEmail("a@example.test", "Eins", "<p>1</p>");
    await sendNotificationEmail("b@example.test", "Zwei", "<p>2</p>");
    expect(createTransport).toHaveBeenCalledTimes(1);
  });

  it("scheitert deutlich, wenn SMTP nicht eingerichtet ist", async () => {
    delete process.env.SMTP_HOST;
    const { sendNotificationEmail } = await import("./mailer");
    await expect(sendNotificationEmail("a@example.test", "B", "<p>T</p>")).rejects.toThrow(
      /SMTP ist nicht konfiguriert/
    );
    expect(createTransport, "Ohne Zugangsdaten darf kein Transport entstehen").not.toHaveBeenCalled();
  });

  it("nimmt SMTP_FROM als Absender, sonst den Benutzernamen", async () => {
    const sendMail = vi.fn();
    createTransport.mockReturnValue({ sendMail });
    delete process.env.SMTP_FROM;
    const { sendNotificationEmail } = await import("./mailer");
    await sendNotificationEmail("kunde@example.test", "Betreff", "<p>Text</p>");
    expect(sendMail.mock.calls[0][0].from).toBe("absender@example.test");
  });
});
