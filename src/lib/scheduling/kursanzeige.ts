import type { Kurszeitraum } from "@/lib/scheduling/dates";

/**
 * Wie weit im Voraus ein noch nicht begonnener Kurs im Stundenplan erscheint.
 *
 * Vom Betreiber gewählt (PROJ-51): lang genug zum Planen, kurz genug, dass der
 * Plan nicht zur Prognose wird.
 */
export const VORSCHAU_TAGE = 21;

export type Zeitraumhinweis =
  | { art: "endet"; datum: string }
  | { art: "beginnt"; datum: string }
  | { art: "wirdZu"; datum: string; neuerName: string };

export type KursAnzeigeEingabe = {
  zeitraum: Kurszeitraum;
  umwandlung: { name: string; datum: string } | null;
};

function tagePlus(datum: string, tage: number): string {
  const d = new Date(datum + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

/**
 * Gehört dieser Kurs ins Angebot? (PROJ-51)
 *
 * Benutzt vom Stundenplan **und** vom Kurskatalog. Zwei Antworten darauf
 * liefen früher oder später auseinander — und dann stünde ein Kurs im Katalog,
 * den der Stundenplan nicht mehr kennt.
 *
 * Das ist bewusst **nicht** dieselbe Frage wie „findet dieser Termin statt?".
 * Jene ist eine Aussage über die Wirklichkeit und steckt in der
 * Terminrechnung. Diese hier ist eine Anzeigeentscheidung: Ein Kurs, der in
 * fünf Wochen beginnt, existiert sehr wohl — er steht nur noch nicht im Plan.
 *
 * Die beiden getrennt zu halten verhindert, dass die Vorschau von drei Wochen
 * irgendwann in die Terminrechnung sickert und dort etwas verbirgt.
 */
export function imStundenplan(zeitraum: Kurszeitraum, heute: string): boolean {
  if (zeitraum.bis && zeitraum.bis < heute) return false;
  if (zeitraum.von && zeitraum.von > tagePlus(heute, VORSCHAU_TAGE)) return false;
  return true;
}

/**
 * Was beim Kurs im Stundenplan dabeisteht — oder nichts.
 *
 * Die Reihenfolge ist eine Aussage darüber, was den Leser am meisten angeht:
 *
 * 1. **Beginnt erst** — dann ist alles andere nachrangig; er kann noch nicht hin.
 * 2. **Wird umgewandelt** — er kann hin, sollte aber wissen, dass es bald
 *    etwas anderes ist.
 * 3. **Endet** — er kann hin, aber nicht mehr lange.
 *
 * Ein unbefristeter Kurs ohne Vormerkung bekommt gar keinen Hinweis: Eine
 * Angabe, die immer dasteht, sagt nichts mehr aus.
 */
export function zeitraumhinweis(
  kurs: KursAnzeigeEingabe,
  heute: string
): Zeitraumhinweis | null {
  const grenze = tagePlus(heute, VORSCHAU_TAGE);

  if (kurs.zeitraum.von && kurs.zeitraum.von > heute) {
    return { art: "beginnt", datum: kurs.zeitraum.von };
  }

  if (kurs.umwandlung && kurs.umwandlung.datum <= grenze) {
    return { art: "wirdZu", datum: kurs.umwandlung.datum, neuerName: kurs.umwandlung.name };
  }

  if (kurs.zeitraum.bis && kurs.zeitraum.bis <= grenze) {
    return { art: "endet", datum: kurs.zeitraum.bis };
  }

  return null;
}

/**
 * Die Ferien, die jetzt laufen oder demnächst anstehen.
 *
 * Für die Hinweisleiste über dem Stundenplan. Vergangene Ferien interessieren
 * niemanden mehr; weit entfernte auch noch nicht.
 */
export function anstehendeFerien<T extends { von: string; bis: string }>(
  ferien: T[],
  heute: string
): T[] {
  const grenze = tagePlus(heute, VORSCHAU_TAGE);
  return ferien.filter((f) => f.bis >= heute && f.von <= grenze);
}
