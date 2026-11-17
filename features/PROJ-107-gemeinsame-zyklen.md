# PROJ-107: Ein gemeinsamer Zahlungszyklus für alle, eingetragen statt gerechnet

## Status: Planned
**Created:** 2026-11-17
**Last Updated:** 2026-11-17

## Dependencies
- Requires: PROJ-7 (SEPA-Lastschrift) — der Lauf, der künftig am Zyklus hängt
- Requires: PROJ-70 (Einzug nur nach Unterrichtswochen) — die Sperre, die ersetzt wird
- Requires: PROJ-96 (Kündigungsfrist bis Sonntag) — die Frist, die bleibt, aber ein Datum für alle wird
- Requires: PROJ-98 (Zahlungszyklen bei den Barzahlern) — das Vorbild: ein Zyklus als Datensatz mit erstem und letztem Tag
- Requires: PROJ-51 (Kurszeitraum und Ferien) — die Schließungen, die künftig beim Anlegen eines Zyklus berücksichtigt werden, nicht beim Rechnen
- Berührt: PROJ-91 / PROJ-97 (Upgrade-Differenz), PROJ-102 (Studierendenpreis endet mit 28), PROJ-10 (Rechnungsarchiv), PROJ-103 (die Gründe im Lauf), AGB (`terms-de.tsx`, `terms-en.tsx`)
- Löst ab: PROJ-106 (Warnung beim Verwerfen) — unnötig, sobald das Zyklusende eine eingetragene Tatsache ist und nicht aus einem Lauf gerechnet wird

## Anlass

Im Studio gibt es längst **einen** Zahlungszyklus für alle. Nur im System nicht: Dort hat
jedes Abo seinen eigenen Rhythmus, verankert an seiner letzten Abbuchung, und jede
Schließung treibt die Abos weiter auseinander. Die Abweichung ist ein Artefakt der
Software, nicht des Betriebs.

Am 2026-11-17 hat das zum ersten Mal Geld gekostet — fast. Ein Abo verschwand aus einem
Lauf, und die Suche nach dem Grund legte vier verschiedene Begriffe von „Zyklus" frei:

| Wo | Regel | Ferien |
|---|---|---|
| Einzug (PROJ-70, TypeScript) | letzter Einzug + 28 Tage + Ferientage | ja |
| Kündigung (PROJ-96, SQL) | Spiegel der obigen Regel, zweite Fassung | ja |
| Studierendenpreis (PROJ-102, `next_cycle_end`) | Ankerdatum + 28 · k | **nein** |
| Barzahler (PROJ-98) | **eingetragen**: erster und letzter Tag | entfällt |

Drei abgeleitet, einer eingetragen — und der eingetragene ist der einzige, der noch nie
Ärger gemacht hat. Die Migration zu PROJ-96 warnt selbst: „ACHTUNG: Dieselbe Regel steht
damit zweimal im Projekt", zusammengehalten nur von einem Test, der beide Fassungen über
dieselben Eingaben vergleicht. Die dritte Fassung ist nicht einmal ferienbewusst: Ein Kunde
kann von der Preisankündigung ein anderes Zyklusende genannt bekommen als vom
Kündigungsdialog — für dasselbe Abo.

Dazu kommt, was am 2026-11-17 tatsächlich passiert ist: Weil das Kündigungsdatum aus dem
jüngsten Lauf gerechnet wird, **Entwürfe mitgezählt**, stand nach dem Verwerfen eines
Entwurfs ein Enddatum da, zu dem die passende Abbuchung fehlte. Diese ganze Fehlerklasse
verschwindet, sobald der Zyklus eingetragen wird.

## Die Regel in einem Absatz

Ein **Zyklus** ist ein Datensatz: erster Tag, letzter Tag, lückenlos an den Vorgänger
anschließend, angelegt von der Verwaltung im Voraus. Vier Wochen sind nur noch der
**Vorschlag** beim Anlegen; wer schließt, verschiebt das Ende beim Anlegen von Hand. Alles
andere wird daraus abgeleitet: Ein Lauf zieht je Abo **einmal je Zyklus** ein. Eine
Kündigung wirkt zum Ende des Zyklus, in dem sie eingeht, mit Frist am letzten Sonntag
davor. Die Preisankündigung und die Upgrade-Differenz lesen dieselben Daten. Die Rechnung
nennt den Zeitraum, für den gezahlt wurde.

Wer **mitten im Zyklus** einsteigt, zahlt den **vollen** Beitrag für diesen Zyklus. Wer das
nicht will, bucht bis zum nächsten Zyklus Einzelstunden (`dropin_pricing` gibt es bereits)
und startet das Abo dann. Es gibt keine Teilbeträge — das ist die Entscheidung, die dieses
Vorhaben überhaupt klein hält.

**Der erste Zyklus im System beginnt am 30.11.2026.** Es gibt nichts zu überbrücken: Der
laufende Zyklus wird noch mit dem bestehenden Verfahren eingezogen, und ab dem 30.11.
starten alle Abos gemeinsam.

## User Stories

1. **Als Betreiber** will ich die Zahlungszyklen im Voraus eintragen, damit Einzug,
   Kündigungsfrist und Preisankündigung alle von denselben zwei Daten sprechen.
2. **Als Betreiber** will ich ein Zyklusende beim Anlegen verschieben können, wenn das
   Studio geschlossen hat, statt mich auf eine Rechnung zu verlassen, die ich nicht sehe.
3. **Als Betreiber** will ich einen Lauf zu einem Zyklus anlegen und darauf vertrauen, dass
   jedes Abo darin genau einmal vorkommt.
4. **Als Betreiber** will ich beim Anlegen eines Abos wählen, ob es im laufenden Zyklus
   beginnt (voller Beitrag) oder erst im nächsten.
5. **Als Betreiber** will ich eine Kündigungsfrist, die für alle derselbe Tag ist, damit ich
   sie aushängen und ankündigen kann.
6. **Als Kunde** will ich auf meiner Rechnung sehen, für welchen Zeitraum ich gezahlt habe.
7. **Als Kunde** will ich im Profil ein Zyklusende sehen, das mit dem übereinstimmt, das mir
   bei einer Preisänderung genannt wird.

## Out of Scope

- **Keine Teilbeträge, keine anteilige Abrechnung.** Betreiberentscheidung 2026-11-17: Wer
  mitten im Zyklus einsteigt, zahlt voll oder bucht Einzelstunden. Daran hängt der ganze
  Umfang dieses Vorhabens.
- **Keine Umstellung von Bestandsabos.** Es gibt keine Lücke und keinen Überhang: Der
  gemeinsame Rhythmus existiert im Betrieb schon, der laufende Zyklus wird wie bisher
  eingezogen, ab dem 30.11.2026 zählt der eingetragene Zyklus.
- **Die Barzahler-Zyklen (PROJ-98) bleiben zunächst getrennt.** Sie zusammenzuführen ist
  naheliegend und steht als offene Frage — aber es ändert den Arbeitsablauf beim
  Abschließen, und das gehört nicht in dieselbe Auslieferung wie der Umstieg.
- **Kein automatisches Anlegen von Zyklen.** Vorschlagen ja, selbständig anlegen nein; ein
  Zyklus entscheidet über Geld.
- **Kein Rückdatieren oder Ändern eines Zyklus, in dem schon eingezogen wurde.** Sonst
  ändert sich im Nachhinein, wofür jemand bezahlt hat.
- **Keine Kundensicht auf die Zyklusliste.** Der Kunde sieht sein Zyklusende und seine
  Frist, nicht die Tabelle.
- **`cycle_anchor_date` wird nicht entfernt.** Es bleibt als Beitrittsdatum stehen und
  verliert nur seine Rolle in der Abrechnung.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Stufe 1 — was der Umstieg am 30.11.2026 braucht

- [ ] Angenommen es gibt noch keinen Zyklus, wenn der Betreiber einen anlegt, dann gibt er ersten und letzten Tag ein und die Liste zeigt ihn an
- [ ] Angenommen ein Zyklus ist angelegt, wenn der Betreiber den nächsten anlegt, dann sind erster Tag (Tag nach dem Vorgänger) und letzter Tag (vier Wochen später) vorgeschlagen und beide änderbar
- [ ] Angenommen der Betreiber ändert das vorgeschlagene Ende, wenn er speichert, dann gilt sein Datum
- [ ] Angenommen ein Zyklus würde sich mit einem bestehenden überschneiden oder eine Lücke lassen, wenn der Betreiber speichert, dann wird es abgelehnt und der Grund genannt
- [ ] Angenommen in einem Zyklus wurde schon eingezogen, wenn der Betreiber ihn ändern oder löschen will, dann wird es abgelehnt
- [ ] Angenommen ein Abo wurde in diesem Zyklus noch nicht eingezogen, wenn der Betreiber einen Lauf mit einem Fälligkeitstag in diesem Zyklus anlegt, dann ist das Abo darin
- [ ] Angenommen ein Abo wurde in diesem Zyklus schon eingezogen, wenn der Betreiber einen zweiten Lauf im selben Zyklus anlegt, dann steht das Abo unter „Nicht aufgenommen" mit dem Grund „In diesem Zyklus schon eingezogen am [Datum]"
- [ ] Angenommen ein Abo wurde im **vorigen** Zyklus eingezogen, wenn ein Lauf im neuen Zyklus angelegt wird, dann ist das Abo darin — unabhängig davon, wie viele Tage dazwischen liegen
- [ ] Angenommen für den Fälligkeitstag ist kein Zyklus eingetragen, wenn ein Lauf angelegt wird, dann gilt die bisherige Vier-Wochen-Regel und der Betreiber wird darauf hingewiesen
- [ ] Angenommen ein Abo beginnt erst in einem späteren Zyklus, wenn ein Lauf angelegt wird, dann steht es unter „Nicht aufgenommen" mit diesem Grund

### Stufe 2 — der Rest

- [ ] Angenommen ein Kunde kündigt innerhalb der Frist, wenn er bestätigt, dann wirkt die Kündigung zum Ende des laufenden Zyklus, und dieses Datum steht in der Tabelle der Zyklen
- [ ] Angenommen ein Kunde kündigt nach der Frist, wenn er bestätigt, dann wirkt sie zum Ende des nächsten Zyklus
- [ ] Angenommen der Betreiber verschiebt ein künftiges Zyklusende, wenn ein Kunde danach kündigt, dann nennt das Profil das verschobene Datum
- [ ] Angenommen ein Kunde wird im nächsten Zyklus zu alt für den Studierendenpreis, wenn die Ankündigung erzeugt wird, dann nennt sie denselben Zyklusbeginn, den die Zyklusliste nennt
- [ ] Angenommen für ein Abo wird eine Upgrade-Differenz berechnet, wenn der Zyklus schon abgebucht ist, dann richtet sich die Rechnung nach dem eingetragenen Zyklus
- [ ] Angenommen eine Rechnung entsteht für einen Abobeitrag, wenn der Kunde sie öffnet, dann nennt die Position den Zeitraum, für den gezahlt wurde
- [ ] Angenommen das Studio schließt für eine Woche, wenn der Betreiber das Zyklusende entsprechend später ansetzt, dann verschieben sich Einzug und Kündigungsfrist für alle gemeinsam
- [ ] Angenommen ein Abo wird mitten im Zyklus angelegt und der Betreiber wählt „laufender Zyklus", wenn der Lauf angelegt wird, dann steht der volle Beitrag darin
- [ ] Angenommen er wählt „nächster Zyklus", wenn der Lauf für den laufenden angelegt wird, dann ist das Abo nicht darin

## Edge Cases

1. **Zwei Läufe im selben Zyklus** — der zweite nimmt nur, was fehlt. Das ist der
   Rücklastschrift-Fall und muss weiter möglich sein.
2. **Ein Lauf mit Fälligkeitstag außerhalb jedes eingetragenen Zyklus** — darf nicht still
   auf die alte Regel zurückfallen, ohne es zu sagen.
3. **Die Umstellung selbst** — der 30.11.2026 liegt zwölf Tage nach dem Einzug für den
   laufenden Zyklus. Die alte Regel würde jedes Abo sperren („wieder möglich ab 16.12."),
   die neue nicht. Genau deshalb muss Stufe 1 vorher ausgeliefert sein; die Rückfallebene
   ist das Nachtragen von Hand über „Trotzdem aufnehmen".
4. **Kündigung in der Übergangszeit** — mit Zyklusgrenzen 30.11.–27.12. nennt die alte
   Rechnung ebenfalls den 28.12. Alte und neue Fassung fallen zusammen, es gibt also kein
   Fenster mit zwei Wahrheiten. Das ist Glück und wird vom Test festgehalten, nicht
   vorausgesetzt.
5. **Ein Abo ohne Mandat** — bleibt ein Barzahler und kommt in keinen Lauf (siehe
   PROJ-105).
6. **Ein Zyklus wird angelegt, der in der Vergangenheit liegt** — erlaubt, solange er nicht
   mit einem Zyklus kollidiert, in dem schon eingezogen wurde. Für das Nachtragen der
   Historie.
7. **Eine Kündigung, die vor dem 30.11.2026 gespeichert wurde** — ihr Datum bleibt stehen,
   auch wenn es nicht auf eine Zyklusgrenze fällt. Dem Kunden wurde dieses Datum genannt.

## Technical Requirements

- Die Zyklusliste wird bei jedem Lauf, jeder Kündigung und jeder Preisankündigung gelesen —
  sie muss billig zu lesen sein und an genau einer Stelle stehen.
- Lückenlosigkeit und Eindeutigkeit des Endes gehören in die Datenbank, nicht in das
  Formular: PROJ-98 hat das bei `cash_cycles` so gelöst und es hat sich getragen.
- Security: Anlegen und Ändern nur Verwaltung. Kunden lesen die Tabelle nicht.
- Die alte Vier-Wochen-Rechnung bleibt als Rückfallebene erhalten, bis für alle Zeiträume
  Zyklen eingetragen sind.

## Open Questions

- [ ] Sollen die Barzahler-Zyklen (PROJ-98) dieselben Zyklen werden? Vorschlag: ja, aber in
      einer eigenen Auslieferung — es nimmt dem Abschließen die Wahl des Enddatums und
      ändert damit einen eingespielten Arbeitsablauf.
- [ ] Was wird aus `next_cycle_end`? Nach Stufe 2 hat es keine Aufrufer mehr. Vorschlag:
      stehen lassen und den Kommentar auf „ohne Aufrufer" setzen, wie PROJ-96 es schon
      einmal getan hat.
- [ ] Soll die Kündigungsfrist weiter der letzte Sonntag sein, wenn sie ohnehin für alle
      gilt? Vorschlag: ja, unverändert — ein bekannter Mechanismus, und PROJ-96 hat ihn
      gerade erst in den AGB verankert.
- [ ] Bis wann sind Zyklen im Voraus einzutragen, und soll das System warnen, wenn der
      letzte eingetragene Zyklus näher als vier Wochen rückt? Vorschlag: ja, als Hinweis im
      Dashboard.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Ein gemeinsamer Zyklus für alle, nicht ein eingetragener Zyklus je Abo | Der gemeinsame Rhythmus existiert im Betrieb längst; das System war das einzige, das pro Abo rechnete | 2026-11-17 |
| Zyklen werden von Hand eingetragen, vier Wochen nur als Vorschlag | Damit verschwindet die Ferienarithmetik aus der Abrechnung — der eigentliche Gewinn. Wer schließt, verschiebt ein Datum, statt einer Rechnung zu vertrauen, die er nicht sieht | 2026-11-17 |
| Mitten im Zyklus: voller Beitrag, Alternative Einzelstunde | Betreiberentscheidung. Verhindert Teilbeträge und hält das Vorhaben klein; der Einzelstundenpreis ist bereits vorhanden | 2026-11-17 |
| Keine Überbrückung für Bestandsabos | Es gibt keine Lücke: der laufende Zyklus wird wie bisher eingezogen, ab 30.11.2026 zählt der eingetragene | 2026-11-17 |
| Zwei Stufen, Stufe 1 vor dem 30.11.2026 | Nur Tabelle, Formular und die neue Sperre sind für den Umstieg nötig. Alles andere unter Zeitdruck an Geldcode zu bauen wäre das größere Risiko | 2026-11-17 |
| Ein Zyklus, in dem eingezogen wurde, ist unveränderlich | Sonst ändert sich im Nachhinein, wofür jemand bezahlt hat | 2026-11-17 |
| Kündigungen von vor dem Umstieg behalten ihr Datum | Dem Kunden wurde dieses Datum genannt | 2026-11-17 |
| Die Rechnung nennt den Leistungszeitraum | Heute steht in der Position nur der Aboname. Bei einem Mitgliedsbeitrag ist der Zeitraum die Angabe, auf die es ankommt | 2026-11-17 |

### Technical Decisions

_To be added by /architecture_

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
