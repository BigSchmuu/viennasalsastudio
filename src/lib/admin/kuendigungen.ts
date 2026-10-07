/**
 * Der Überblick der Kündigungen (PROJ-79).
 *
 * Bewusst ohne Datenbankbezug: Die Laufzeit eines Abos und die Trennung in
 * „angekündigt" und „beendet" lassen sich mit erfundenen Daten prüfen — dieselbe
 * Trennung wie in lib/teacher/uebersicht.ts und lib/dashboard/heutige-kurse.ts.
 */

export type Kuendigung = {
  aboId: string;
  kundeId: string;
  kundeName: string;
  /** Der Kursname oder „Flatrate" — was gekündigt wurde. */
  aboName: string;
  /** Beginn des Abos; Grundlage der Laufzeit. */
  beginn: string | null;
  /**
   * Der Tag, an dem die Kündigung wirkt: bei einer angekündigten der Stichtag,
   * bei einer beendeten das Kündigungsdatum.
   */
  wirksamAb: string | null;
  /** Nur bei angekündigten: Die Kündigung ist noch nicht vollzogen. */
  angekuendigt: boolean;
};

/** Kalendertage zwischen zwei Datumsangaben — negativ, wenn `bis` davor liegt. */
function alsUtc(datum: string): number {
  const [jahr, monat, tag] = datum.split("-").map(Number);
  // `Date.UTC` zählt Monate ab null, die Zeichenkette ab eins. Der Versatz hebt
  // sich **nicht** auf, wenn man ihn auf beiden Seiten stehen lässt: Monate sind
  // verschieden lang, und aus dem 15.01. bis 14.02. (30 Tage) würde der 15.02.
  // bis 14.03. (27 Tage). Genau das stand hier, bis der Test es meldete.
  return Date.UTC(jahr, monat - 1, tag);
}

function tageZwischen(von: string, bis: string): number {
  return Math.round((alsUtc(bis) - alsUtc(von)) / 86_400_000);
}

/** Ganze Monate zwischen zwei Datumsangaben, kalendergenau. */
function monateZwischen(von: string, bis: string): number {
  const [vj, vm, vt] = von.split("-").map(Number);
  const [bj, bm, bt] = bis.split("-").map(Number);
  const monate = (bj - vj) * 12 + (bm - vm);
  // Der Monat ist erst voll, wenn der Tag erreicht ist: 15.01. bis 14.02. sind
  // noch keine vier Wochen und erst recht kein Monat.
  return bt >= vt ? monate : monate - 1;
}

/**
 * Wie lange das Abo gelaufen ist — als Satzbaustein.
 *
 * Tage unter einem Monat, danach Monate, ab einem Jahr Jahre samt Restmonaten.
 * Die Zahl soll beantworten, ob jemand nach zwei Monaten geht oder nach zwei
 * Jahren; auf den einzelnen Tag kommt es dabei nicht an.
 */
export function laufzeit(von: string | null | undefined, bis: string | null | undefined): string {
  if (!von || !bis) return "—";

  const tage = tageZwischen(von, bis);
  // Ein Abo, das vor seinem Beginn gekündigt wird, hat keine Laufzeit — und
  // „-12 Tage" wäre keine Auskunft, sondern ein Rätsel.
  if (tage < 0) return "Noch nicht gestartet";
  if (tage === 0) return "Am Starttag";
  if (tage === 1) return "1 Tag";

  const monate = monateZwischen(von, bis);
  if (monate < 1) return `${tage} Tage`;
  if (monate === 1) return "1 Monat";
  if (monate < 12) return `${monate} Monate`;

  const jahre = Math.floor(monate / 12);
  const restMonate = monate % 12;
  const jahrText = jahre === 1 ? "1 Jahr" : `${jahre} Jahre`;
  if (restMonate === 0) return jahrText;
  return `${jahrText} ${restMonate === 1 ? "1 Monat" : `${restMonate} Monate`}`;
}

/**
 * Die beiden Listen, jede in der Reihenfolge, in der man sie liest.
 *
 * Angekündigte nach vorn und zeitlich **aufsteigend**: Was zuerst endet,
 * verlangt zuerst eine Entscheidung. Beendete absteigend: zuletzt Beendetes
 * zuerst, wie überall sonst in der Verwaltung.
 */
export function teileKuendigungen(kuendigungen: Kuendigung[]): {
  angekuendigt: Kuendigung[];
  beendet: Kuendigung[];
} {
  const angekuendigt = kuendigungen
    .filter((k) => k.angekuendigt)
    .sort(
      (a, b) =>
        (a.wirksamAb ?? "").localeCompare(b.wirksamAb ?? "") ||
        a.kundeName.localeCompare(b.kundeName, "de")
    );

  const beendet = kuendigungen
    .filter((k) => !k.angekuendigt)
    .sort(
      (a, b) =>
        (b.wirksamAb ?? "").localeCompare(a.wirksamAb ?? "") ||
        a.kundeName.localeCompare(b.kundeName, "de")
    );

  return { angekuendigt, beendet };
}
