# PROJ-72: Anwesenheitsliste in Staffeln

## Status: In Review
**Created:** 2026-10-04
**Last Updated:** 2026-10-04

## Dependencies
- Requires: PROJ-13 (Lehrer-Ansicht) — die Anwesenheitsmatrix
- Requires: PROJ-51 (Kurszeitraum und Ferien) — `runs_from`, Pausen, Ferien
- Berührt: PROJ-49 (Lehrerbereich), PROJ-31 (Geburtstage), PROJ-30 (Rollen) — dieselbe Matrix

## Anlass

Die Anwesenheitsliste zeigte die letzten **acht** Termine und lud auf Klick vier weitere in die
Vergangenheit. Künftige Termine kannte sie nicht. Für den Betrieb ist das die falsche Einteilung:
Kurse laufen in Staffeln von vier Wochen, und genau eine davon hat der Lehrer vor sich.

Wunsch des Betreibers: die laufende Staffel zeigen, frühere und spätere auf Klick.

## User Stories

- Als Lehrer möchte ich die laufende Staffel sehen, ohne durch acht Wochen zu scrollen.
- Als Lehrer möchte ich eine frühere Staffel aufrufen können, um etwas nachzutragen.
- Als Lehrer möchte ich die nächste Staffel sehen können — zum Vorbereiten.
- Als Betreiber möchte ich, dass die Grenzen vier Wochen lang dieselben bleiben und sich mit der
  Abrechnung decken.

## Out of Scope

- **Anwesenheit für künftige Termine eintragen** — die Spalten erscheinen, das Eintragen bleibt wie
  es ist. Ob ein Häkchen in der Zukunft sinnvoll ist, entscheidet der Lehrer.
- **Staffellänge je Kurs einstellbar** — vier Wochen, wie der Abo-Zyklus. Eine Einstellung dafür
  wäre eine Schraube ohne Anlass.
- **Sprungmarken zu einer bestimmten Staffel** — zwei Knöpfe reichen; wer weiter zurück will, klickt
  zweimal.

## Acceptance Criteria

- [ ] Angenommen ein Kurs hat einen hinterlegten Beginn, wenn der Lehrer die Liste öffnet, dann sieht
      er genau die Staffel, in der der heutige Tag liegt — höchstens vier Termine.
- [ ] Angenommen heute ist Kurstag, dann ist der heutige Termin Teil der gezeigten Staffel.
- [ ] Angenommen es gibt eine Staffel davor, wenn der Lehrer „Frühere Termine" wählt, dann erscheinen
      ihre Termine links von den bisherigen, chronologisch.
- [ ] Angenommen es gibt eine Staffel danach, wenn er „Spätere Termine" wählt, dann erscheinen ihre
      Termine rechts.
- [ ] Angenommen der Kursbeginn ist erreicht, dann ist „Frühere Termine" nicht mehr anklickbar.
- [ ] Angenommen der Kurs hat kein hinterlegtes Beginndatum, wenn der Lehrer die Liste öffnet, dann
      endet die gezeigte Staffel am jüngsten vergangenen Termin.
- [ ] Angenommen ein künftiger Termin kommt hinzu, wenn der Kurs kein Beginndatum hat, dann bleibt
      die gezeigte Staffel dieselbe.

## Edge Cases

- **Kein Beginndatum**: Dann gibt es keinen Anker. Die Einteilung richtet sich am heutigen Tag aus —
  Vergangenes von hinten geschnitten, Künftiges von vorn. Sonst hinge sie am zufälligen Ende des
  Vorschaufensters, und zwei Wochen später sähe der Lehrer eine andere Aufteilung derselben Stunden.
- **Angebrochene Staffel**: Läuft der Kurs mitten in einer Staffel, hat sie weniger als vier
  Termine. Das ist richtig — sie läuft noch.
- **Kurs noch nicht begonnen**: Gezeigt wird die erste Staffel, alle Termine liegen in der Zukunft.
- **Ferien und Ausfälle**: zählen nicht als Termin, wie überall. Eine Staffel kann damit mehr als
  vier Kalenderwochen umfassen.
- **Tag nach dem letzten Termin einer Staffel**: Gezeigt wird noch diese, nicht schon die nächste —
  zum Nachtragen.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Staffeln ab Kursbeginn, nicht rollierend | Entscheidung des Betreibers. Die Grenzen bleiben vier Wochen lang dieselben und decken sich mit der Abrechnung; eine rollierende Grenze wandert jede Woche. | 2026-10-04 |
| Vier Termine, nicht vier Kalenderwochen | Ferien und Ausfälle sollen eine Staffel nicht verkürzen — der Lehrer will vier *Stunden* sehen. | 2026-10-04 |
| Zwei Knöpfe statt einer Auswahl | Wer weiter zurück will, klickt zweimal. Eine Liste aller Staffeln wäre mehr Oberfläche für denselben Weg. | 2026-10-04 |

### Technical Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Der Staffelplan entsteht auf der Seite, nicht in der Nachlade-Aktion | Vorher rechnete die Aktion ihre vier Termine selbst aus. Zwei Rechnungen hätten früher oder später zwei verschiedene Staffeln ergeben — die Aktion holt jetzt nur, was im Plan steht. | 2026-10-04 |
| Neue reine Funktion `occurrencesBetween` | Die bestehenden Terminrechnungen zählen von **heute** aus, vorwärts oder rückwärts. Für Staffeln ab Kursbeginn braucht es zwei feste Grenzen. | 2026-10-04 |
| Die Einteilung selbst ist eine reine Funktion | `staffelplan` entscheidet ohne Datenbank und ist damit an allen Rändern prüfbar — angebrochene Staffeln, kein Beginndatum, Kurs in der Zukunft. | 2026-10-04 |

---

## QA Test Results (2026-10-04)

**Empfehlung: bereit für die Produktion.** Keine Migration.

| | |
|---|---|
| Regeln (Unit) | 17 für die Staffeln, 5 für `occurrencesBetween` |
| Browser (E2E) | 4 neu, 14 in PROJ-13 angepasst und grün |
| Produktfehler gefunden | 0 |

### Was geprüft ist

**Die Einteilung** an allen Rändern: mit und ohne Kursbeginn, angebrochene Staffel, Kurs noch nicht
begonnen, Kurs vorbei, Tag nach dem letzten Termin, und die Stabilität ohne Beginndatum, wenn ein
künftiger Termin dazukommt.

**Die Liste im Browser**: vier Spalten zu sehen, „Frühere Termine" fügt links an und bleibt
chronologisch, „Spätere Termine" fügt rechts an, und am Kursbeginn ist der Knopf nicht mehr
anklickbar. Zur Gegenprobe wurde die Staffellänge einmal auf acht gestellt — die Prüfung fiel
sofort.

### Was angepasst werden musste

**PROJ-13** hatte die alte Regel als Kriterium („letzte 8 Termine", Knopf „Mehr laden"). Beide Tests
sind auf die neue Regel umgeschrieben; der Nachtrag im Spec von PROJ-13 hält fest, dass AC3b/AC6
ersetzt ist.

Und die Fixture dort säte auf **feste Daten aus 2026** — die lagen schon vorher am Rand des Fensters
und wären mit vier Terminen endgültig draußen. Sie sät jetzt auf den jüngsten vergangenen Termin.
