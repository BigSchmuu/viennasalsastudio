/**
 * Wer bekommt die Nachricht „Du hast bereits ein Konto bei uns"?
 *
 * Nur der Inhaber eines bestätigten Kontos. Zwei Fälle bekommen sie nicht:
 *
 * - Eine neue Adresse. Klingt selbstverständlich, war es aber nicht: Bis
 *   2026-09-13 wurde erst *nach* der Registrierung gesucht — und da fand sich
 *   das eben angelegte Konto. Jede Neuregistrierung bekam zwei Mails, und die
 *   zweite schickte den Kunden zum Passwort-Zurücksetzen statt zur Bestätigung.
 * - Ein Konto, das nie bestätigt wurde. Hier verschickt Supabase die
 *   Bestätigungsmail selbst noch einmal; „du hast schon ein Konto" daneben
 *   widerspräche ihr.
 */

export type KontoEintrag = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
};

/** Die ID des bestätigten Kontos mit dieser Adresse — oder `null`. */
export function bestaetigtesKonto(konten: KontoEintrag[], email: string): string | null {
  const gesucht = email.trim().toLowerCase();
  const konto = konten.find((k) => k.email?.trim().toLowerCase() === gesucht);
  return konto?.email_confirmed_at ? konto.id : null;
}
