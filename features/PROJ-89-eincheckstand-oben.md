# PROJ-89: Der Eincheck-Stand über der Anwesenheitsliste

## Status: In Progress
**Created:** 2026-10-16
**Last Updated:** 2026-10-16

## Dependencies
- Requires: PROJ-13/72 (Anwesenheitsmatrix) — der Ort
- Requires: PROJ-74 (Einmal-Gäste) — die Trennung, über die gezählt wird
- Berührt: PROJ-25 (Self-Check-In) — die Zahl, die dabei entsteht

## Anlass

Am Kursabend will die Lehrkraft eine Frage beantwortet haben: **Sind alle da?** Heute muss sie dafür
die Spalte des Abends durchzählen und daneben die Zeilen zählen. Bei zwölf Teilnehmern geht das, bei
zwanzig zählt niemand zweimal nach — und seit dem Self-Check-In (PROJ-25) checken sich Leute selbst
ein, ohne dass die Lehrkraft es gesehen hat.

Die Zahl gibt es schon: Das Admin-Dashboard zeigt sie seit PROJ-75 („x von y anwesend"). Nur an der
Stelle, an der eingecheckt wird, fehlt sie.

## User Stories

- Als Lehrkraft möchte ich über der Liste sehen, wie viele für diesen Abend eingecheckt sind.
- Als Lehrkraft möchte ich daneben sehen, wie viele überhaupt im Kurs sind — damit ich vergleichen
  kann, ohne zu zählen.
- Als Lehrkraft möchte ich erkennen, auf welchen Abend sich die Zahl bezieht.

## Out of Scope

- **Eine Zahl je Abend in der Tabelle.** Die Spalten bleiben, wie sie sind; gezählt wird der
  **gewählte** Termin.
- **Gäste im Nenner.** Ein Drop-in ist nicht „im Kurs" — er erscheint getrennt, damit die
  Vergleichszahl stimmt.
- **Eine Anzeige für die Verwaltung.** Die hat sie im Dashboard (PROJ-75).
- **Abwesend als eigene Pflichtangabe.** Wer nicht eingecheckt ist, ist nicht automatisch abwesend;
  gemeldete Abwesenheiten stehen daneben, aber die Lehrkraft muss nichts ausfüllen.

## Acceptance Criteria

- [ ] Angenommen ein Termin ist gewählt, wenn die Lehrkraft die Kursseite öffnet, dann steht über der
      Liste „x von y eingecheckt" samt dem Datum dieses Termins.
- [ ] Angenommen sieben von zwölf Kursteilnehmern sind für diesen Abend als anwesend markiert, dann
      steht dort „7 von 12 eingecheckt".
- [ ] Angenommen jemand ist als abwesend markiert, dann zählt er **nicht** als eingecheckt, und die
      Zahl der Abwesenden steht daneben.
- [ ] Angenommen für diesen Abend ist ein Drop-in oder Gast anwesend, dann steht er **getrennt**
      dahinter („+ 1 Gast") und nicht im Nenner.
- [ ] Angenommen die Lehrkraft wählt einen anderen Termin, dann rechnet die Zahl auf diesen Abend um.
- [ ] Angenommen sie checkt jemanden ein oder nimmt es zurück, dann ändert sich die Zahl sofort —
      ohne Neuladen.
- [ ] Angenommen für diesen Abend ist noch niemand erfasst, dann steht „0 von 12 eingecheckt" und
      nicht eine leere Zeile.

## Edge Cases

- **Kein Termin gewählt** (etwa nach dem Blättern): Dann erscheint die Zeile nicht — eine Zahl ohne
  Abend behauptet etwas über nichts.
- **Niemand im Kurs**: „0 von 0" wäre richtig, aber nutzlos; dann bleibt die Zeile weg.
- **Ein Gast, der später ein Abo bekommt** (PROJ-74): Er zählt ab dann im Nenner — die Trennung
  stammt aus `teileZeilen`, nicht aus einer zweiten Regel hier.

## Decision Log

### Product Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Über der Liste, nicht in der Tabelle | „Ganz oben" war die Bitte, und die Frage „sind alle da?" stellt sich vor dem Blick in die Spalte. | 2026-10-16 |
| Gezählt wird der **gewählte** Termin | Die Matrix zeigt mehrere Abende. Eine Zahl ohne Bezug wäre die gefährlichste Variante: Sie sieht richtig aus. | 2026-10-16 |
| Gäste getrennt, nicht im Nenner | „Wie viele sind im Kurs" meint die Kursteilnehmer. Ein Drop-in im Nenner verschöbe die Vergleichszahl jeden Abend anders. | 2026-10-16 |
| Abwesende werden genannt, aber nicht verlangt | Sie sind die Erklärung für eine Lücke („7 von 12, 2 abwesend gemeldet"). Eine Pflicht daraus zu machen wäre Arbeit für die Lehrkraft ohne Nutzen für den Abend. | 2026-10-16 |

### Technical Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Eine reine Funktion `eincheckStand(zeilen, termin)` in `lib/teacher/einmal-gaeste.ts` | Dort steht schon, wer Kursteilnehmer und wer Einmal-Gast ist (`teileZeilen`). Die Zahl dieselbe Trennung zweimal zu lehren, hieße zwei Wahrheiten zu pflegen. | 2026-10-16 |
| Gerechnet im Browser, aus den Zeilen, die schon da sind | Die Matrix hält den Stand bereits als Zustand — nach dem Einchecken ohne Neuladen aktuell. Ein zweiter Abruf wäre langsamer und könnte abweichen. | 2026-10-16 |

## Open Questions

- [ ] Soll die Zahl farbig werden, wenn alle da sind? Vorerst nicht — Farbe als Belohnung lenkt vom
      Vergleich ab, um den es geht.

## Umsetzung (2026-10-16)

Ohne Datenbank — die Zahl steht schon im Browser.

**Gerechnet:** `eincheckStand(zeilen, termin)` und `eincheckText(stand)` in
[einmal-gaeste.ts](../src/lib/teacher/einmal-gaeste.ts) — dort, wo auch
`teileZeilen` wohnt, das über Kursteilnehmer und Gast entscheidet. Beide Zahlen
kommen damit aus derselben Trennung; eine zweite Regel hätte eine zweite
Wahrheit bedeutet.

**Angezeigt:** eine Zeile über der Tabelle in
[attendance-matrix.tsx](../src/components/teacher/attendance-matrix.tsx) — Datum
klein darüber, der Stand darunter in Ziffernbreite (`tabular-nums`), das Ganze
mit `aria-live="polite"`, damit ein Häkchen auch vorgelesen wird. Gerechnet aus
`rows`, dem Zustand der Komponente: Nach einem Häkchen stimmt die Zahl sofort,
ohne zweiten Abruf.

**Geprüft:** 16 neue Vitest-Fälle in
[einmal-gaeste.test.ts](../src/lib/teacher/einmal-gaeste.test.ts) (Nenner,
Abwesende, Gäste getrennt, Umrechnen auf den gewählten Abend, Zeile ohne Zelle,
Pluralformen) und fünf Browserprüfungen in
[PROJ-89-eincheckstand.spec.ts](../tests/PROJ-89-eincheckstand.spec.ts) — darunter
„1 von 3 eingecheckt" mit einem anwesenden Gast daneben, der den Nenner **nicht**
auf 4 schiebt, und „2 von 3" unmittelbar nach einem Häkchen ohne Neuladen.
