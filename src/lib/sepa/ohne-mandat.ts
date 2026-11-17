import type { AuslassGrund } from "@/lib/sepa/ausgelassen";

/**
 * Mandat widerrufen, Beitrag offen (PROJ-105).
 *
 * Bis hierher verschwand ein Abo ohne gültiges Mandat aus **beiden** Listen des
 * Entwurfs: keine Zeile, kein Grund, keine Zahl. Für einen echten Barzahler ist
 * das richtig — er stünde bei jedem Lauf da und gäbe nichts zu beurteilen. Für
 * ein Abo, dessen Mandat **widerrufen** wurde, ist es falsch: Da ist ein
 * Beitrag offen, und zwar einmalig.
 *
 * Am 2026-11-17 ist das im Betrieb aufgefallen — und nur, weil der Betreiber
 * nachgefragt hat. Ohne die Frage wäre ein Zyklus Beitrag verloren gewesen:
 * Ab dem Wirksamkeitstag der Kündigung fällt ein Abo ohnehin aus jedem Lauf.
 */

/**
 * Gehört dieses Abo in die Liste?
 *
 * Die Trennlinie zum echten Barzahler ist `hatteJeMandat`: Wer nie ein Mandat
 * erteilt hat, zahlt bar und soll die Liste nicht füllen. Wer eines hatte,
 * hat per Lastschrift gezahlt — bis er die Bankdaten entfernt hat.
 *
 * Ein fehlender Preis schließt nicht aus, sondern ein: Ohne Mandat **und**
 * ohne Preis stünde das Abo sonst in gar keiner Liste, und das wäre der
 * nächste blinde Fleck.
 */
export function beitragOffenOhneMandat(
  hatGueltigesMandat: boolean,
  hatteJeMandat: boolean,
  grund: AuslassGrund | null
): boolean {
  if (hatGueltigesMandat) return false;
  if (!hatteJeMandat) return false;
  return grund === null || grund.art === "kein_preis";
}

function tag(datum: string): string {
  return new Date(`${datum}T00:00:00Z`).toLocaleDateString("de-AT", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Der Satz zur Zeile: woran man erkennt, wie viel offen ist und wie lange noch
 * Zeit bleibt.
 *
 * `letzterTag` ist die eigentliche Frist — das Datum, zu dem eine Kündigung
 * oder Pause wirkt. Ab da fällt das Abo nach der Regel aus jedem Lauf, und
 * dann ist der Zyklus endgültig nur noch über die Barzahlungsliste holbar.
 *
 * Bewusst neutral formuliert: Bei einer Kündigung endet das Abo, bei einer
 * Pause nicht — die Frist für den Einzug ist in beiden Fällen dieselbe, und
 * ein Satz, der nur für einen der beiden Fälle stimmt, wäre an einer Stelle,
 * an der es um Geld geht, eine Falschaussage.
 */
export function ohneMandatText(letzterEinzug: string | null, letzterTag: string | null): string {
  const teile = [
    letzterEinzug
      ? `Letzter Einzug am ${tag(letzterEinzug)}.`
      : "Für dieses Abo wurde noch nie eingezogen.",
    "Das SEPA-Mandat ist widerrufen — per Lastschrift ist der Beitrag nicht mehr holbar.",
  ];
  if (letzterTag) {
    teile.push(`Ab dem ${tag(letzterTag)} wird ohnehin nicht mehr eingezogen.`);
  }
  return teile.join(" ");
}
