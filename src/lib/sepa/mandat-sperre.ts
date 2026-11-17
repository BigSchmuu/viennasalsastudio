/**
 * Keine Lastschrift gegen ein widerrufenes Mandat (PROJ-105).
 *
 * Eine Position trägt IBAN und Mandatsreferenz **vom Anlegen des Laufs**. Wird
 * das Mandat danach widerrufen, stand die Lastschrift trotzdem in der Datei:
 * Beim Erzeugen wurden die Mandate nur noch wegen des Unterschriftsdatums
 * gelesen, `revoked_at` kam in der Abfrage nicht vor.
 *
 * Am 2026-11-17 ist genau das beinahe passiert. Es hat nur deshalb nicht
 * stattgefunden, weil der Betreiber den Entwurf verworfen hat.
 *
 * Ein Einzug nach Widerruf ist eine nicht autorisierte Lastschrift — der Kunde
 * kann sie 13 Monate lang zurückholen, und recht hat er dabei.
 *
 * Die Regel steht hier als reine Funktion, damit sie an einer Stelle ist und
 * ohne Datenbank geprüft werden kann: Sie sperrt sowohl das Erzeugen der Datei
 * als auch das Bestätigen des Uploads.
 */

export type ZuPruefendePosition = {
  mandate_reference: string;
  account_holder_name: string;
};

export type MandatsStand = {
  mandate_reference: string;
  revoked_at: string | null;
};

/**
 * Die Kontoinhaber der Positionen, deren Mandat widerrufen ist — alphabetisch
 * und ohne Wiederholung, damit die Meldung lesbar bleibt.
 *
 * Positionen, deren Mandatsreferenz in `mandate` gar nicht vorkommt, gelten
 * hier **nicht** als gesperrt. Das ist eine andere Lücke (dann wird das
 * Unterschriftsdatum durch den Fälligkeitstag ersetzt) und bewusst nicht
 * Gegenstand dieser Sperre — siehe Open Questions in PROJ-105.
 */
export function widerrufeneInhaber(
  positionen: ZuPruefendePosition[],
  mandate: MandatsStand[]
): string[] {
  const widerrufen = new Set(
    mandate.filter((m) => m.revoked_at !== null).map((m) => m.mandate_reference)
  );
  const inhaber = new Set(
    positionen
      .filter((p) => widerrufen.has(p.mandate_reference))
      .map((p) => p.account_holder_name)
  );
  return [...inhaber].sort((a, b) => a.localeCompare(b, "de"));
}

/**
 * Die Meldung dazu.
 *
 * Sie nennt den Weg zurück, und zwar den **richtigen**: Position entfernen und
 * neu eintragen. Hat der Kunde inzwischen neue Bankdaten hinterlegt, greift
 * dabei das aktuelle Mandat; hat er keine, lehnt das Eintragen ab und der
 * Betrag gehört auf die Barzahlungsliste. Ohne diesen Satz würde der Betreiber
 * den ganzen Entwurf verwerfen — und damit Kündigungsdaten verwaisen lassen.
 */
export function widerrufeneMeldung(inhaber: string[]): string {
  const wer = inhaber.join(", ");
  const einer = inhaber.length === 1;
  return (
    `Für ${einer ? "diese Position" : "diese Positionen"} wurde das SEPA-Mandat widerrufen: ${wer}. ` +
    `Gegen einen Widerruf darf nicht abgebucht werden. Entferne ${einer ? "die Position" : "die Positionen"} ` +
    `und trage ${einer ? "sie" : "sie"} neu ein — dann greift das aktuelle Mandat, oder das Eintragen lehnt ab ` +
    `und der Betrag gehört auf die Barzahlungsliste.`
  );
}
