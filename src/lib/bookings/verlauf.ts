/**
 * Aktuelle und frühere Buchungen auseinanderhalten (PROJ-8).
 *
 * „Meine Buchungen" zeigte jede Buchung, die je bestand: abgelehnte,
 * stornierte und bestätigte Anfragen, deren Abo längst gekündigt ist. Gemeldet
 * aus dem Betrieb am 2026-09-12 mit sieben Zeilen, von denen fünf tot waren —
 * und die bestätigte Anfrage zu einem gekündigten Abo sah aus wie eine
 * laufende Buchung.
 *
 * Gelöscht wird nichts: Die Zeile bleibt, sie rutscht nur in einen
 * zugeklappten Bereich. Der Kunde soll nachsehen können, wann er was gebucht
 * hat, ohne dass es die Liste verstopft. Der AGB-Nachweis aus PROJ-42 hängt
 * ohnehin an der Datenbankzeile und der Verwaltungsansicht, nicht an dieser
 * Anzeige.
 */
export type VerlaufsEingabe = {
  type: string;
  status: string;
  chosenDate: string;
  /** Status des Abos, das aus dieser Anfrage entstand — `null`, wenn keines. */
  aboStatus: string | null;
};

export function istFrueher(buchung: VerlaufsEingabe, heute: string): boolean {
  // Abgelehnt und storniert sind in jedem Fall vorbei.
  if (buchung.status === "cancelled" || buchung.status === "rejected") return true;

  if (buchung.type === "regular") {
    // Eine offene Anfrage wartet noch auf eine Antwort.
    if (buchung.status === "open") return false;
    // Bestätigt: Sie lebt so lange, wie das Abo daraus lebt. Ein **pausiertes**
    // Abo kommt zurück und zählt deshalb als aktuell — nur ein gekündigtes
    // oder gelöschtes ist vorbei.
    return buchung.aboStatus === null || buchung.aboStatus === "cancelled";
  }

  // Probestunde und Drop-in: Der Termin entscheidet. Am Tag selbst ist er noch
  // nicht vorbei — wer hingeht, soll seine Buchung oben finden.
  return buchung.chosenDate < heute;
}
