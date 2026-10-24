/**
 * Eine abgebrochene Anfrage als Ergebnis zurückgeben, statt sie fliegen zu
 * lassen (PROJ-92).
 *
 * Aus Sentry, 2026-10-23, 111 Ereignisse: Ein Kunde auf dem iPhone drückte
 * „Log in", der POST der Server-Action kam mit 200 zurück, der Antwortstrom
 * brach aber beim Lesen ab. Safari nennt das `Load failed`. Damit warf
 * `signIn()` — und weil im Formular `try`/`finally` ohne `catch` stand, reichte
 * React den Fehler aus der Form-Action an die Fehlergrenze weiter. Der Kunde
 * wollte einen Kurs buchen und bekam einen Fehlerbildschirm.
 *
 * Auf einem Mobilgerät ist das kein Ausnahmefall: Wechsel von WLAN auf
 * Mobilfunk, gesperrter Bildschirm, App-Wechsel — Safari bricht laufende
 * Anfragen dabei ab.
 *
 * Das Ergebnis hat dieselbe Gestalt, die die Formulare schon kennen
 * (`{ error: <Schlüssel> }`), damit die Meldung dort erscheint, wo die anderen
 * Fehler auch erscheinen.
 */

export const VERBINDUNG_ABGEBROCHEN = "errConnectionLost" as const;

/**
 * Ist das ein Verbindungsabbruch — oder ein Fehler, der jemanden angeht?
 *
 * Ein gescheiterter `fetch` ist in jedem Browser ein `TypeError`: „Failed to
 * fetch" (Chrome), „Load failed" (Safari), „NetworkError when attempting to
 * fetch resource." (Firefox). Ein Fehler **aus** der Server-Action kommt
 * dagegen als gewöhnlicher `Error` mit Digest beim Browser an.
 *
 * Diese Unterscheidung ist der ganze Zweck der Funktion: Ein `catch`, das
 * alles fängt, verschluckte künftige echte Programmfehler — sie würden als
 * „Verbindung abgebrochen" angezeigt und tauchten in Sentry nie auf.
 */
export function istVerbindungsabbruch(fehler: unknown): boolean {
  return fehler instanceof TypeError;
}

export async function mitVerbindung<T>(
  aufruf: () => Promise<T>
): Promise<T | { error: typeof VERBINDUNG_ABGEBROCHEN }> {
  try {
    return await aufruf();
  } catch (fehler) {
    if (!istVerbindungsabbruch(fehler)) throw fehler;
    return { error: VERBINDUNG_ABGEBROCHEN };
  }
}
