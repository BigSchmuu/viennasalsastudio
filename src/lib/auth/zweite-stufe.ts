/**
 * Gemeinsames Wissen über die zweite Stufe der Anmeldung (PROJ-58).
 *
 * Bewusst ohne Supabase- und ohne Serverbezug: Einrichtungsseite, Code-Seite
 * und Tests greifen gleichermaßen darauf zu, und ein Test soll dafür keine
 * Sitzung aufbauen müssen.
 */

/** So viele Ziffern liefert eine Authenticator-App. */
export const CODE_LAENGE = 6;

/** Die beiden Seiten. Stehen hier, weil Weiche, Torwächter und Formulare sie brauchen. */
export const WEG_EINRICHTEN = "/sicherheit/einrichten";
export const WEG_CODE = "/sicherheit/code";

/** Merker im Browser: „Diese Anmeldung darf das Schließen überdauern." Enthält kein Geheimnis. */
export const MERKER_NAME = "vss_geraet_gemerkt";

/** 30 Tage in Sekunden — die Frist aus dem Spec. */
export const MERKER_DAUER = 60 * 60 * 24 * 30;

/**
 * Alles außer Ziffern entfernen.
 *
 * Wer den Code aus der App kopiert, bringt häufig ein Leerzeichen in der Mitte
 * mit („123 456"), und beim automatischen Ausfüllen hängt mitunter eines
 * hinten dran. Beides ließe die Prüfung scheitern, ohne dass jemand sähe warum
 * — der Code sieht ja richtig aus.
 */
export function nurZiffern(eingabe: string): string {
  return eingabe.replace(/\D/g, "").slice(0, CODE_LAENGE);
}

export function codeVollstaendig(code: string): boolean {
  return nurZiffern(code).length === CODE_LAENGE;
}

/**
 * Den Schlüssel in Vierergruppen setzen.
 *
 * Er wird nur abgetippt, wenn die Kamera nicht mitspielt — und zweiunddreißig
 * Zeichen am Stück tippt niemand fehlerfrei ab.
 */
export function schluesselLesbar(schluessel: string): string {
  return (schluessel.match(/.{1,4}/g) ?? []).join(" ");
}

/**
 * Ab wann der Hinweis auf die Uhrzeit des Handys erscheint.
 *
 * Nicht beim ersten Fehlschlag: Da ist der häufigste Grund ein Tippfehler, und
 * wer dann über Uhrzeiten liest, sucht an der falschen Stelle. Ab dem zweiten
 * Mal kehrt sich das um — eine falsch gehende Uhr verwirft jeden einzelnen
 * Code, und darauf käme von allein niemand.
 */
export function uhrzeitHinweisZeigen(fehlversuche: number): boolean {
  return fehlversuche >= 2;
}

/**
 * Aus einer Supabase-Fehlermeldung einen Satz machen, der jemandem weiterhilft.
 *
 * Der Grundfall bleibt bewusst vage: Ob der Code falsch war oder abgelaufen
 * ist, geht niemanden etwas an, der ihn nicht selbst erzeugt hat.
 */
export function codeFehlertext(fehler?: { message?: string } | null): string {
  const roh = fehler?.message?.toLowerCase() ?? "";
  if (roh.includes("rate limit") || roh.includes("too many")) {
    return "Zu viele Versuche. Bitte warte einen Moment und versuche es dann erneut.";
  }
  return "Der Code stimmt nicht. Lies ihn frisch aus deiner App ab — er wechselt alle 30 Sekunden.";
}
