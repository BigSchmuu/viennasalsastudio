import * as Sentry from "@sentry/nextjs";

/**
 * Das Ergebnis eines Laufschritts: der Wert, und im Fehlerfall die Ursache.
 */
export type SchrittErgebnis<T> = {
  wert: T;
  fehler?: string;
};

/**
 * Einen Schritt des Tageslaufs ausführen, ohne den Rest mitzureißen.
 *
 * Vorher liefen die Schritte ungeschützt hintereinander. Warf einer, blieb
 * alles danach ungetan — auch der Vollzug fälliger Kündigungen, und der heißt
 * im Klartext: es wird weiter abgebucht. Ein Fehler soll den betroffenen
 * Schritt kosten, nicht den ganzen Lauf.
 *
 * Gemeldet wird trotzdem: der Fehler geht an Sentry und steht in der Antwort,
 * damit ein halb gelungener Lauf nicht wie ein gelungener aussieht.
 */
export async function fuehreSchrittAus<T>(
  name: string,
  ersatz: T,
  arbeit: () => Promise<T>
): Promise<SchrittErgebnis<T>> {
  try {
    return { wert: await arbeit() };
  } catch (fehler) {
    Sentry.captureException(fehler, {
      tags: { cron: "notifications", schritt: name },
    });
    const ursache = fehler instanceof Error ? fehler.message : String(fehler);
    return { wert: ersatz, fehler: `${name}: ${ursache}` };
  }
}

/**
 * Sammelt die Fehlermeldungen mehrerer Schritte und reicht die Werte durch.
 *
 * Ohne diese Klammer müsste jede Aufrufstelle `.wert` auspacken und `.fehler`
 * von Hand einsammeln — vier Mal dasselbe, und beim fünften Schritt vergisst
 * es jemand.
 */
export function laufSammler() {
  const fehler: string[] = [];
  return {
    nimm<T>(ergebnis: SchrittErgebnis<T>): T {
      if (ergebnis.fehler) fehler.push(ergebnis.fehler);
      return ergebnis.wert;
    },
    get fehler(): string[] {
      return fehler;
    },
  };
}
