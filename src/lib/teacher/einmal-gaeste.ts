/**
 * Wer steht in der Anwesenheitsliste, wer in der Liste der Einmal-Gäste?
 * (PROJ-74)
 *
 * Bewusst ohne Oberfläche und ohne Datenbankbezug — dieselbe Lehre wie bei den
 * Staffeln (PROJ-72): Die Entscheidung, wer wo auftaucht, gehört nicht in eine
 * Komponente mit 450 Zeilen, sondern dorthin, wo man sie prüfen kann.
 */

/**
 * Quellen, die einen einzelnen Abend bedeuten — keinen Platz im Kurs.
 *
 * `buchung` steht hier, obwohl die Datenbank seit PROJ-74 genauer antwortet:
 * Zwischen Auslieferung und eingespielter Migration kommt dieser Wert noch. Wer
 * ihn nicht kennt, lässt die Person aus *beiden* Listen fallen — sie wäre für
 * ein paar Stunden unsichtbar, und zwar genau an dem Abend, an dem sie kommt.
 */
export const EINMAL_QUELLEN = ["probestunde", "dropin", "gast", "buchung"] as const;

export function istEinmalQuelle(quelle: string | null | undefined): boolean {
  return !!quelle && (EINMAL_QUELLEN as readonly string[]).includes(quelle);
}

/** Was in der Liste neben dem Namen steht. */
export function einmalArt(quelle: string): string {
  if (quelle === "probestunde") return "Probestunde";
  if (quelle === "dropin") return "Drop-In";
  if (quelle === "gast") return "Gast";
  return "Buchung";
}

type Zelle = { status: "present" | "absent" | null; source: string; selfCheckedIn: boolean } | null;
type Zeile = { customerId: string; fullName: string; cells: Record<string, Zelle> };

/**
 * Ist diese Zeile ein Einmal-Gast?
 *
 * Nur wenn **alle** bekannten Termine dieser Person Einmal-Termine sind. Sobald
 * sie an einem der gezeigten Tage über ein Abo oder von Hand dabei ist, gehört
 * sie in die Anwesenheitsliste — das ist die Antwort auf „Gast wird später
 * Abo-Teilnehmer".
 *
 * Eine Zeile ohne jede Zelle ist **kein** Einmal-Gast: So sieht eine gerade von
 * Hand hinzugefügte Person aus, bevor das erste Häkchen gespeichert ist. Sie aus
 * der Liste zu werfen, in die man sie eben gesetzt hat, wäre das Verwirrendste
 * von allem.
 */
export function istEinmalZeile(zeile: Zeile): boolean {
  const zellen = Object.values(zeile.cells).filter((z): z is NonNullable<Zelle> => z !== null);
  return zellen.length > 0 && zellen.every((z) => istEinmalQuelle(z.source));
}

export function teileZeilen<T extends Zeile>(zeilen: T[]): { kursteilnehmer: T[]; einmal: T[] } {
  const kursteilnehmer: T[] = [];
  const einmal: T[] = [];
  for (const zeile of zeilen) {
    (istEinmalZeile(zeile) ? einmal : kursteilnehmer).push(zeile);
  }
  return { kursteilnehmer, einmal };
}

export type EinmalGast = {
  customerId: string;
  fullName: string;
  art: string;
  status: "present" | "absent" | null;
  selfCheckedIn: boolean;
};

/**
 * Die Einmal-Gäste **eines** Termins, nach Namen sortiert.
 *
 * „Nur die, die am selben Tag kommen" ist der ganze Zweck der Liste: Wer nächste
 * Woche zur Probestunde kommt, hat an diesem Abend nichts darin zu suchen.
 */
export function einmalGaesteAm<T extends Zeile>(zeilen: T[], datum: string): EinmalGast[] {
  return teileZeilen(zeilen)
    .einmal.flatMap((zeile) => {
      const zelle = zeile.cells[datum];
      if (!zelle) return [];
      return [
        {
          customerId: zeile.customerId,
          fullName: zeile.fullName,
          art: einmalArt(zelle.source),
          status: zelle.status,
          selfCheckedIn: zelle.selfCheckedIn,
        },
      ];
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "de"));
}

/**
 * Welcher Termin ist vorausgewählt?
 *
 * Der heutige, wenn er dabei ist — das ist der Abend, an dem jemand vor der
 * Lehrkraft steht. Sonst der nächste anstehende: So sieht sie, wer kommt. Liegt
 * die ganze Staffel in der Vergangenheit, der letzte — dort wurde zuletzt
 * abgehakt.
 */
export function standardTermin(termine: string[], heute: string): string | null {
  if (termine.length === 0) return null;
  const sortiert = [...termine].sort();
  return sortiert.find((t) => t >= heute) ?? sortiert[sortiert.length - 1];
}

/**
 * Den gewählten Termin gültig halten, wenn sich die gezeigten Termine ändern.
 *
 * Lädt die Lehrkraft eine andere Staffel nach, ist der bisher gewählte Termin
 * womöglich nicht mehr dabei. Eine Liste, die dann auf einem Tag stehen bleibt,
 * der nirgends in der Tabelle steht, behauptet etwas über einen Abend, den
 * niemand sieht.
 */
export function gueltigerTermin(
  gewaehlt: string | null,
  termine: string[],
  heute: string
): string | null {
  if (gewaehlt && termine.includes(gewaehlt)) return gewaehlt;
  return standardTermin(termine, heute);
}
