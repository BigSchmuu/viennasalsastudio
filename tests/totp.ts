import { createHmac } from "node:crypto";

/**
 * Sechsstellige Codes erzeugen, wie eine Authenticator-App sie zeigt (PROJ-58).
 *
 * Nur für die Tests: Die Anwendung selbst erzeugt nie einen Code, sie lässt
 * Supabase prüfen. Ohne diesen Generator ließe sich der Anmeldeweg aber nicht
 * automatisch durchspielen — und genau der Teil täte am meisten weh, wenn er
 * klemmt.
 *
 * Verfahren: RFC 6238 (TOTP) über RFC 4226 (HOTP), SHA-1, 30-Sekunden-Fenster.
 * Die Prüfwerte aus dem RFC stehen in totp.test.ts.
 */

/** Base32 nach RFC 4648 — so gibt Supabase den Schlüssel heraus. */
function ausBase32(schluessel: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const sauber = schluessel.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();

  let bits = 0;
  let wert = 0;
  const bytes: number[] = [];

  for (const zeichen of sauber) {
    const index = alphabet.indexOf(zeichen);
    if (index === -1) throw new Error(`Kein Base32-Zeichen: ${zeichen}`);
    wert = (wert << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((wert >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Der Code für einen Zeitpunkt. `jetzt` in Millisekunden, damit die Tests
 * feste Zeitpunkte einsetzen können.
 */
export function totpCode(schluessel: string, jetzt: number = Date.now(), ziffern = 6): string {
  const zaehler = Math.floor(jetzt / 1000 / 30);

  // Der Zähler geht als 8 Byte in Netzwerkreihenfolge hinein.
  const block = Buffer.alloc(8);
  block.writeUInt32BE(Math.floor(zaehler / 2 ** 32), 0);
  block.writeUInt32BE(zaehler >>> 0, 4);

  const hash = createHmac("sha1", ausBase32(schluessel)).update(block).digest();

  // Dynamische Verkürzung: Die letzten vier Bit zeigen, wo die vier Bytes
  // stehen, aus denen der Code gebildet wird.
  const versatz = hash[hash.length - 1] & 0x0f;
  const zahl =
    ((hash[versatz] & 0x7f) << 24) |
    ((hash[versatz + 1] & 0xff) << 16) |
    ((hash[versatz + 2] & 0xff) << 8) |
    (hash[versatz + 3] & 0xff);

  return String(zahl % 10 ** ziffern).padStart(ziffern, "0");
}

/**
 * Wie lange das aktuelle Fenster noch gilt, in Millisekunden.
 *
 * Wer einen Code kurz vor dem Wechsel abliest, tippt ihn nach dem Wechsel ein
 * — und Supabase lehnt ihn zu Recht ab. Im Test sähe das aus wie ein Fehler in
 * der Anwendung.
 */
export function restDesFensters(jetzt: number = Date.now()): number {
  return 30_000 - (jetzt % 30_000);
}
