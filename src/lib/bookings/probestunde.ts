/**
 * Wie steht es um die Probestunde dieses Kunden? (PROJ-52)
 *
 * Jeder Kunde bekommt genau eine. Daraus folgen drei Zustände, und alle drei
 * brauchen im Buchungsdialog etwas anderes:
 *
 * - **frei** — er kann eine buchen wie bisher.
 * - **offen** — sie ist gebucht, der Termin steht noch aus. Dann führt der
 *   Weg nicht zu einer zweiten Buchung, sondern zum Verschieben: auf diesen
 *   Kurs oder auf einen anderen Termin.
 * - **verbraucht** — der Termin ist vorbei. Dann steht dort ein Satz und kein
 *   gesperrter Knopf; ein toter Knopf lässt den Kunden den Fehler bei sich
 *   suchen (dieselbe Überlegung wie beim Buchungs-Hindernis aus PROJ-8).
 *
 * Vier Stellen zeigen den Buchungsdialog — Katalog, Kursdetail, Stundenplan
 * und Dashboard. Deshalb steht die Rechnung hier und nicht viermal dort: Vier
 * eigene Fassungen liefen auseinander, dieselbe Lehre wie bei `course_members`
 * aus PROJ-50.
 *
 * Storniert und abgelehnt zählen nicht mit. Das ist eine Entscheidung des
 * Betreibers, keine Vereinfachung: Eine Erkältung darf die Probestunde nicht
 * kosten. Die Datenbank sieht es genauso — beide Regeln stehen an einer Stelle
 * je Seite, aber sie sagen dasselbe.
 */
export type ProbestundenStand =
  | { art: "frei" }
  | { art: "offen"; buchungId: string; kursId: string; kursName: string; datum: string }
  | { art: "verbraucht"; datum: string };

export type ProbestundenBuchung = {
  id: string;
  type: string;
  status: string;
  chosen_date: string | null;
  course_id: string | null;
  kursName: string;
};

/** Zählt eine Buchung für die Probestunde mit? */
function zaehltMit(b: ProbestundenBuchung): boolean {
  return (
    b.type === "trial" &&
    (b.status === "open" || b.status === "confirmed") &&
    Boolean(b.chosen_date) &&
    Boolean(b.course_id)
  );
}

export function probestundenStand(
  buchungen: ProbestundenBuchung[],
  heute: string
): ProbestundenStand {
  const zaehlende = buchungen.filter(zaehltMit);
  if (zaehlende.length === 0) return { art: "frei" };

  // Der Regel nach gibt es höchstens eine — die Datenbank lässt keine zweite
  // zu. Trotzdem wird hier sortiert: Altbestand aus der Zeit vor dieser Regel
  // kann mehrere haben, und dann ist der nächste anstehende Termin der, der
  // den Kunden angeht.
  const anstehend = zaehlende
    .filter((b) => b.chosen_date! >= heute)
    .sort((a, b) => a.chosen_date!.localeCompare(b.chosen_date!));

  if (anstehend.length > 0) {
    const b = anstehend[0];
    return {
      art: "offen",
      buchungId: b.id,
      kursId: b.course_id!,
      kursName: b.kursName,
      datum: b.chosen_date!,
    };
  }

  // Sonst die jüngste vergangene: Sie ist die Probestunde, die er hatte.
  const vergangen = [...zaehlende].sort((a, b) => b.chosen_date!.localeCompare(a.chosen_date!));
  return { art: "verbraucht", datum: vergangen[0].chosen_date! };
}
