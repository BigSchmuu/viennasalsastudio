/**
 * Die Adresse des Gläubigers für die Lastschriftdatei (PROJ-104).
 *
 * Seit der Umstellung auf ISO-2019 (`pain.008.001.08`) verlangt der
 * Zahlungsverkehr **strukturierte** Adressen: Straße, Hausnummer, PLZ, Ort und
 * Land in eigenen Feldern statt als Textzeile. Die EPC-Richtlinie (EPC130-08,
 * SDD Core C2PSP IGs 2025 V1.0, Element 2.21) schreibt dazu:
 *
 *   „STRUCTURED ADDRESS: Usage is recommended. 'Town Name' and 'Country' are
 *   mandatory. 'Address Line' is not allowed."
 *
 * Empfohlen, nicht Pflicht — eine Datei ohne Adresse bleibt gültig. Was
 * **nicht** gültig ist: eine halbe Adresse. Deshalb die Unterscheidung hier
 * zwischen „nichts gesetzt" (eine Entscheidung) und „Ort fehlt" (ein
 * Versehen). Ein stiller Verzicht auf die Adresse wäre genau der Fehler, den
 * niemand merkt: Der Betreiber hätte sie eingetragen und sie stünde nicht in
 * der Datei.
 *
 * Die Adresse des **Zahlungspflichtigen** kommt hier nicht vor. Die Richtlinie
 * führt sie als „only mandatory when the Creditor PSP or the Debtor PSP is
 * located in a non-EEA SEPA country or territory" (Element 2.168, AT-P005) —
 * bei österreichischen Konten auf beiden Seiten also nicht. Es braucht keine
 * Adresserhebung bei den Kunden.
 */

/** Die Längengrenzen des Schemas, Element für Element. */
export const ADRESS_GRENZEN = {
  strasse: 70, // StrtNm, Max70Text
  hausnummer: 16, // BldgNb, Max16Text
  top: 70, // Room, Max70Text — die Wohnungs- oder Geschäftsnummer im Haus
  plz: 16, // PstCd, Max16Text
  ort: 35, // TwnNm, Max35Text
} as const;

/** Ort und Land sind Pflicht, sobald überhaupt eine Adresse mitgeht. */
export type GlaeubigerAdresse = {
  strasse?: string;
  hausnummer?: string;
  /**
   * Die Nummer im Haus („Top 6"). Das Schema führt sie als `Room`, ISO-Definition
   * „Building room number" — das ist der nächstliegende Platz dafür. In die
   * Hausnummer gehört sie nicht: Die bezeichnet das Haus an der Straße.
   */
  top?: string;
  plz?: string;
  ort: string;
  /** Zwei Großbuchstaben, `[A-Z]{2,2}` nach dem Schema. */
  land: string;
};

export type RohAdresse = {
  strasse?: string | null;
  hausnummer?: string | null;
  top?: string | null;
  plz?: string | null;
  ort?: string | null;
  land?: string | null;
};

/**
 * `adresse: null` heißt „bewusst keine" — die Datei bleibt damit gültig.
 * `fehler` heißt: Es war eine gemeint, und sie ist unbrauchbar.
 */
export type AdressErgebnis = { adresse: GlaeubigerAdresse | null } | { fehler: string };

const FELDNAME: Record<keyof typeof ADRESS_GRENZEN, string> = {
  strasse: "SEPA_CREDITOR_STREET",
  hausnummer: "SEPA_CREDITOR_BUILDING",
  top: "SEPA_CREDITOR_ROOM",
  plz: "SEPA_CREDITOR_POSTCODE",
  ort: "SEPA_CREDITOR_TOWN",
};

function sauber(wert: string | null | undefined): string | undefined {
  const getrimmt = (wert ?? "").trim();
  return getrimmt === "" ? undefined : getrimmt;
}

export function leseGlaeubigerAdresse(roh: RohAdresse): AdressErgebnis {
  const strasse = sauber(roh.strasse);
  const hausnummer = sauber(roh.hausnummer);
  const top = sauber(roh.top);
  const plz = sauber(roh.plz);
  const ort = sauber(roh.ort);
  const land = sauber(roh.land)?.toUpperCase();

  // Nichts gesetzt: Die Adresse ist empfohlen, nicht Pflicht.
  if (!strasse && !hausnummer && !top && !plz && !ort && !land) {
    return { adresse: null };
  }

  if (!ort) {
    return {
      fehler:
        "SEPA-Gläubigeradresse unvollständig: Ohne Ort darf keine Adresse in die Datei. Bitte SEPA_CREDITOR_TOWN setzen oder alle Adressfelder leeren.",
    };
  }
  if (!land) {
    return {
      fehler:
        "SEPA-Gläubigeradresse unvollständig: Ohne Land darf keine Adresse in die Datei. Bitte SEPA_CREDITOR_COUNTRY setzen (zwei Buchstaben, etwa AT) oder alle Adressfelder leeren.",
    };
  }
  if (!/^[A-Z]{2}$/.test(land)) {
    return {
      fehler: `SEPA-Gläubigeradresse: „${land}" ist kein Länderkürzel. SEPA_CREDITOR_COUNTRY braucht genau zwei Buchstaben, etwa AT.`,
    };
  }

  // Zu lange Werte abweisen statt kürzen: Es ist die eigene Adresse, der
  // Betreiber kann sie kürzer schreiben — und eine stillschweigend
  // abgeschnittene Adresse stünde dauerhaft falsch in jeder Datei.
  const laengen: [keyof typeof ADRESS_GRENZEN, string | undefined][] = [
    ["strasse", strasse],
    ["hausnummer", hausnummer],
    ["top", top],
    ["plz", plz],
    ["ort", ort],
  ];
  for (const [feld, wert] of laengen) {
    const grenze = ADRESS_GRENZEN[feld];
    if (wert && wert.length > grenze) {
      return {
        fehler: `SEPA-Gläubigeradresse: ${FELDNAME[feld]} ist ${wert.length} Zeichen lang, erlaubt sind ${grenze}.`,
      };
    }
  }

  return { adresse: { strasse, hausnummer, top, plz, ort, land } };
}
