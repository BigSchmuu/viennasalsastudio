/**
 * Fehler bei Anmeldung und Registrierung — als Schlüssel, nicht als Satz.
 *
 * Die Server-Aktionen gaben fertige deutsche Sätze zurück („E-Mail oder
 * Passwort falsch"), und das Formular zeigte sie unverändert an. Auf der
 * englischen Seite stand deshalb Deutsch. Jetzt kommt ein Schlüssel aus dem
 * Namensraum `auth`, und das Formular übersetzt ihn in die Sprache der Seite.
 *
 * Zweiter Grund, und der wiegt schwerer: Jeder Supabase-Fehler außer
 * „schwaches Passwort" wurde zu derselben Meldung „Registrierung
 * fehlgeschlagen". Ein erreichtes Mailversand-Limit war davon nicht zu
 * unterscheiden — weder für den Kunden, der es immer wieder versuchte, noch
 * für den Betreiber, der den Fehler suchte. Gemeldet aus dem Betrieb am
 * 2026-09-13.
 */

/** Die Schlüssel, die eine Auth-Aktion zurückgeben kann. */
export type AuthFehler =
  | "errInvalidCredentials"
  | "errSignupFailed"
  | "errResendFailed"
  | "errLinkExpired"
  | "errEmailRateLimit"
  | "errRequestRateLimit"
  | "errInvalidInput"
  | "weakPassword"
  /** PROJ-73: beim Ändern im angemeldeten Zustand. */
  | "errCurrentPasswordWrong"
  | "errSamePassword"
  | "errSessionExpired"
  | "errPasswordChangeFailed"
  | "errReauthNeeded"
  /** Bleibt ein Code: Das Anmeldeformular zeigt dafür einen eigenen Block. */
  | "email_not_confirmed";

/**
 * Die Grenzen, die für jede Auth-Aktion gleich sind.
 *
 * Steht vor den vorgangsspezifischen Fällen: Ob die Mail wegen eines Limits
 * nicht hinausging, ist die Auskunft, die der Kunde braucht — „bitte versuche
 * es erneut" wäre hier genau falsch, denn der nächste Versuch scheitert
 * genauso.
 */
function gemeinsameGrenzen(code: string | undefined): AuthFehler | null {
  if (code === "over_email_send_rate_limit") return "errEmailRateLimit";
  if (code === "over_request_rate_limit") return "errRequestRateLimit";
  return null;
}

export function anmeldefehler(code: string | undefined): AuthFehler {
  if (code === "email_not_confirmed") return "email_not_confirmed";
  // Ein falsches Passwort und eine unbekannte Adresse bleiben bewusst dieselbe
  // Meldung: Sonst ließe sich über das Formular prüfen, wer Kunde ist.
  return gemeinsameGrenzen(code) ?? "errInvalidCredentials";
}

export function registrierungsfehler(code: string | undefined): AuthFehler {
  if (code === "weak_password") return "weakPassword";
  return gemeinsameGrenzen(code) ?? "errSignupFailed";
}

export function bestaetigungsfehler(code: string | undefined): AuthFehler {
  return gemeinsameGrenzen(code) ?? "errResendFailed";
}

/**
 * Passwort ändern im angemeldeten Zustand (PROJ-73).
 *
 * Hier gibt es keinen Grund, zurückhaltend zu sein: Wer das Formular sieht, ist
 * angemeldet und kennt sein Konto. „Das aktuelle Passwort stimmt nicht" verrät
 * ihm nichts, was er nicht selbst eingegeben hat — und ohne diesen Satz sucht
 * er den Fehler bei den neuen Feldern.
 */
export function passwortaenderungsfehler(code: string | undefined): AuthFehler {
  if (code === "weak_password") return "weakPassword";
  // Supabase nennt es `same_password`; älteren Fassungen entfährt stattdessen
  // eine Meldung mit „should be different".
  if (code === "same_password") return "errSamePassword";
  if (code === "reauthentication_needed") return "errReauthNeeded";
  return gemeinsameGrenzen(code) ?? "errPasswordChangeFailed";
}

export function zuruecksetzfehler(code: string | undefined): AuthFehler {
  // Vor der Link-Meldung prüfen: Ein abgelehntes Passwort hat mit dem Link
  // nichts zu tun, und „Link abgelaufen" schickt den Kunden auf die falsche
  // Fährte.
  if (code === "weak_password") return "weakPassword";
  return gemeinsameGrenzen(code) ?? "errLinkExpired";
}

/**
 * Den Schlüssel in der Sprache der Seite anzeigen.
 *
 * Unbekanntes kommt unverändert durch statt als leere Stelle: Ein roher Text
 * ist ein Fehler, den man sieht und melden kann — eine leere Fehlermeldung
 * ist einer, den niemand bemerkt.
 */
export function fehlertext(
  t: { (schluessel: string): string; has: (schluessel: string) => boolean },
  schluessel: string
): string {
  return t.has(schluessel) ? t(schluessel) : schluessel;
}
