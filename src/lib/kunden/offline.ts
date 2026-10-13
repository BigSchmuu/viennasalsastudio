/**
 * Kunden ohne eigene Anmeldung (PROJ-82).
 *
 * Ein Kunde *ist* in dieser App ein Konto: `profiles` hängt an `auth.users`,
 * und ein Profil entsteht nur, wenn ein Konto entsteht. Wer vor der Lehrkraft
 * steht, bar zahlt und sich nie registriert hat, braucht deshalb trotzdem ein
 * Konto — nur eines, an das niemand Post schicken kann.
 *
 * Dafür ist `.invalid` da: Die Endung ist durch RFC 2606 reserviert und wird
 * nie an jemanden vergeben. Eine erfundene echte Adresse wäre schlimmer als
 * keine — irgendwann gehört sie jemandem.
 */

export const OFFLINE_DOMAIN = "viennasalsastudio.invalid";

/** Eine Adresse, die niemandem gehört und keine zweite Chance braucht. */
export function offlineAdresse(kennung: string): string {
  return `offline-${kennung}@${OFFLINE_DOMAIN}`;
}

/**
 * Gehört diese Adresse einem Konto ohne Anmeldung?
 *
 * Abgeleitet aus der Adresse und nicht aus einem eigenen Feld: Trägt die
 * Verwaltung später die echte Adresse ein, ist der Kunde damit automatisch ein
 * gewöhnlicher — ohne dass irgendwo ein Haken nachzuziehen wäre. Ein Feld
 * daneben könnte der Adresse widersprechen, und widersprechende Felder gewinnt
 * immer das falsche.
 */
export function istOfflineAdresse(adresse: string | null | undefined): boolean {
  return (adresse ?? "").trim().toLowerCase().endsWith(`@${OFFLINE_DOMAIN}`);
}

/** Was als Name durchgeht. Ein leerer Name wäre eine Zeile, die niemand zuordnet. */
export function nameGueltig(name: string): boolean {
  const sauber = name.trim();
  return sauber.length >= 2 && sauber.length <= 200;
}

/**
 * Der Betrag, wie er am Abo landet.
 *
 * `null` für alles, was kein verwendbarer Betrag ist — der Aufrufer entscheidet
 * dann, ob er das als Fehler behandelt. Kommas werden akzeptiert: Auf einem
 * Handy tippt niemand einen Punkt.
 */
export function betragAusEingabe(eingabe: string): number | null {
  const sauber = eingabe.trim().replace(",", ".");
  if (sauber === "") return null;
  const zahl = Number(sauber);
  if (!Number.isFinite(zahl) || zahl <= 0 || zahl > 10000) return null;
  // Auf Cent gerundet: Ein Betrag mit vier Nachkommastellen stünde später in
  // einer Summe, die niemand nachrechnen kann.
  return Math.round(zahl * 100) / 100;
}
