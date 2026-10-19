/**
 * Was beim Upgrade auf die Flatrate einmalig dazukommt (PROJ-87/88/91).
 *
 * Die Zahl steht an zwei Stellen in der Oberfläche — beim Kunden in der Anfrage
 * und beim Betreiber in der Bestätigung — und ein drittes Mal in
 * `confirm_flatrate_upgrade`. Die Datenbank entscheidet; diese Funktion sagt,
 * was angezeigt und vorgeschlagen wird. Wer eine ändert, ändert beide; die
 * Migration zeigt auf diese Datei.
 *
 * Gerechnet wurde ursprünglich `Preis − Eingegangenes`. Das stimmt nur, wenn
 * der laufende Zyklus **schon zum alten Preis abgebucht** ist: 65 kassiert,
 * 145 gilt, also 80 nach. Ist er noch nicht abgebucht, nimmt der nächste Lauf
 * das Abo regulär mit und bucht die Flatrate voll ab — ein Aufschlag darauf
 * wäre derselbe Zyklus zum zweiten Mal. Genau das ist am 2026-10-19 in
 * Produktion passiert: 290 statt 145.
 */

export type DifferenzLage = {
  /** Der neue Flatrate-Preis; `null`, wenn in der Preisliste ungepflegt. */
  preis: number | null;
  /** Was im laufenden Zyklus für die Kursabos des Kunden einging. */
  angerechnet: number;
  /**
   * Bucht der nächste Lauf den laufenden Zyklus dieses Abos noch voll ab?
   *
   * Kommt aus `flatrate_upgrade_zyklus_wird_abgebucht` — Mandat vorhanden und
   * für dieses Abo im laufenden Zyklus noch nicht eingezogen.
   */
  zyklusWirdAbgebucht: boolean;
};

/** Der Betrag, der in den nächsten Lauf aufgeschlagen wird. */
export function vorgeschlageneDifferenz({
  preis,
  angerechnet,
  zyklusWirdAbgebucht,
}: DifferenzLage): number {
  if (preis === null) return 0;
  if (zyklusWirdAbgebucht) return 0;
  return Math.max(Math.round((preis - angerechnet) * 100) / 100, 0);
}

/**
 * Geld, das für diesen Zyklus schon da ist und auf die Flatrate **nicht**
 * angerechnet werden kann.
 *
 * Der Fall: Im Zyklus wurde für ein anderes Abo abgebucht — eines, das mit dem
 * Upgrade endet —, während das upgradete Abo noch aussteht. Dann bucht der
 * nächste Lauf die Flatrate voll ab, und das Eingegangene liegt daneben. Die
 * Automatik entscheidet darüber nichts: Bei Geld entscheidet der Betreiber, und
 * ein Guthaben (PROJ-44) ist seine Sache.
 */
export function nichtAngerechnet({ angerechnet, zyklusWirdAbgebucht }: DifferenzLage): number {
  if (!zyklusWirdAbgebucht) return 0;
  return Math.max(Math.round(angerechnet * 100) / 100, 0);
}
