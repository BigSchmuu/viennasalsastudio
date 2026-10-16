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

export type EincheckStand = {
  /** Wie viele Kursteilnehmer die Liste kennt — der Nenner. */
  imKurs: number;
  /** Davon für diesen Abend als anwesend erfasst. */
  eingecheckt: number;
  /** Für diesen Abend ausdrücklich als abwesend gemeldet. */
  abwesend: number;
  /** Einmal-Gäste dieses Abends, die anwesend sind — **nicht** im Nenner. */
  gaeste: number;
};

/**
 * „Wie viele sind schon da?" für **einen** Abend (PROJ-89).
 *
 * Die Lehrkraft stellt diese Frage am Kursabend, und bisher musste sie dafür
 * zweimal zählen: die Häkchen in der Spalte und die Zeilen daneben. Seit dem
 * Self-Check-In (PROJ-25) checken sich Leute auch ohne sie ein, also stimmt
 * das Gezählte nicht lange.
 *
 * Gezählt wird der **gewählte** Termin, nicht „heute": Die Matrix zeigt
 * mehrere Abende, und eine Zahl ohne Bezug wäre die gefährlichste Variante —
 * sie sieht richtig aus.
 *
 * Gäste zählen getrennt. „Wie viele sind im Kurs" meint die Kursteilnehmer;
 * ein Drop-in im Nenner verschöbe die Vergleichszahl jeden Abend anders. Die
 * Trennung stammt aus `teileZeilen` und nicht aus einer zweiten Regel hier —
 * sonst gäbe es zwei Wahrheiten darüber, wer Gast ist.
 */
export function eincheckStand<T extends Zeile>(zeilen: T[], datum: string): EincheckStand {
  const { kursteilnehmer, einmal } = teileZeilen(zeilen);
  const stand: EincheckStand = { imKurs: kursteilnehmer.length, eingecheckt: 0, abwesend: 0, gaeste: 0 };

  for (const zeile of kursteilnehmer) {
    const status = zeile.cells[datum]?.status;
    if (status === "present") stand.eingecheckt += 1;
    else if (status === "absent") stand.abwesend += 1;
  }

  for (const zeile of einmal) {
    if (zeile.cells[datum]?.status === "present") stand.gaeste += 1;
  }

  return stand;
}

/**
 * Der Satz über der Liste.
 *
 * Abwesende werden genannt, weil sie die Erklärung für eine Lücke sind
 * („7 von 12, 2 abwesend gemeldet"), aber nichts ist Pflicht: Wer nicht
 * eingecheckt ist, gilt nicht automatisch als abwesend.
 */
export function eincheckText(stand: EincheckStand): string {
  const teile = [`${stand.eingecheckt} von ${stand.imKurs} eingecheckt`];
  if (stand.abwesend > 0) teile.push(`${stand.abwesend} abwesend gemeldet`);
  if (stand.gaeste > 0) teile.push(`+ ${stand.gaeste} ${stand.gaeste === 1 ? "Gast" : "Gäste"}`);
  return teile.join(" · ");
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
