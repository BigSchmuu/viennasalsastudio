# PROJ-69: Ein Kursplatz gilt erst ab seinem Starttermin

## Status: In Review
**Created:** 2026-09-24
**Last Updated:** 2026-09-24

## Dependencies
- Requires: PROJ-50 (Flatrate-Kursplätze) — die gemeinsame Antwort `course_members`
- Requires: PROJ-25 (Self-Check-In) — der Knopf und die Datenbankregel dahinter
- Berührt: PROJ-13/PROJ-49 (Anwesenheitsliste), PROJ-60 (Gäste auf der Liste)

## Anlass

Aus dem Betrieb gemeldet am 2026-09-24: Ein Kunde hatte die Flatrate **für Oktober** gebucht und
konnte sich noch im September in einen Kurs einchecken.

Die Ursache saß in der gemeinsamen Antwort auf „wer ist in diesem Kurs?". Sie kannte nur „Abo aktiv"
und „Platz nicht beendet" — das Startdatum kam darin nicht vor, obwohl es an beiden Quellen steht:
beim kursgebundenen Abo als `cycle_anchor_date`, beim Flatrate-Platz als `started_on` (gesetzt aus
dem gewünschten Einstiegstermin).

Betroffen war deshalb nicht nur das Einchecken: Derselbe Kunde stand auch schon auf der
**Anwesenheitsliste des Lehrers** — nachgewiesen im Test, bevor die Korrektur griff.

## User Stories

- Als Kunde möchte ich mich erst ab meinem Einstiegstermin einchecken können, damit ich nicht
  versehentlich in einer Stunde stehe, für die ich noch nicht zahle.
- Als Lehrer möchte ich auf der Anwesenheitsliste nur die sehen, die heute dazugehören.
- Als Betreiber möchte ich, dass ein gebuchter Platz trotzdem sofort belegt ist, damit ich den Kurs
  nicht überbuche.

## Out of Scope

- **Ein Hinweis „ab 01.10." im Kundenbereich** — der Kurs erscheint dort schlicht erst ab dem
  Starttermin. Bis dahin sieht der Kunde seine Buchung im Profil unter „Meine Buchungen". Ein
  eigener Vorab-Zustand wäre ein eigenes Projekt.
- **Videos und Buchungssperre** — wer ab Oktober gebucht hat, gilt weiterhin sofort als „schon im
  Kurs" (keine Doppelbuchung) und darf die Videos sehen. Beides ist gewollt.
- **Rückwirkende Bereinigung** — wer sich vor der Korrektur zu früh eingecheckt hat, bleibt
  eingetragen. Das ist eine Handvoll Zeilen und gehört dem Lehrer, nicht einer Migration.

## Acceptance Criteria

- [ ] Angenommen ein Kunde hat einen Kursplatz, der erst später beginnt, wenn er sich einchecken
      will, dann weist die Datenbank ihn ab.
- [ ] Angenommen derselbe Kunde ruft „Mein Bereich" auf, dann erscheint der Kurs dort gar nicht —
      und damit auch kein Eincheck-Knopf.
- [ ] Angenommen der Lehrer öffnet die Anwesenheitsliste des heutigen Tages, dann steht der Kunde
      nicht darauf.
- [ ] Angenommen der Starttermin ist erreicht, wenn der Kunde „Mein Bereich" aufruft, dann ist der
      Kurs da und das Einchecken geht.
- [ ] Angenommen der Starttermin ist erreicht, dann steht der Kunde auch auf der Anwesenheitsliste,
      mit der Quelle „abo".
- [ ] Angenommen ein Platz beginnt erst später, wenn der Betreiber die freien Plätze sieht, dann ist
      er bereits belegt.
- [ ] Angenommen jemand ohne Konto ruft die Datenbankfunktionen auf, dann bleiben sie verschlossen.

## Edge Cases

- **Zwei Plätze im selben Kurs** (Abo und Flatrate nebeneinander): Es zählt der frühere Beginn.
- **Ein alter Tab**: Der Knopf könnte noch stehen, wenn der Kurs seit dem Laden ausgeblendet wurde.
  Der Klick läuft dann in eine eigene Meldung statt in „kein aktives Abo".
- **Mitternacht**: Der Vergleich läuft über den Wiener Kalendertag, wie überall im Projekt.
- **Manuell eingetragen**: Trägt der Lehrer jemanden von Hand ein, dessen Platz noch nicht gilt,
  erscheint er als „manuell" — die Ausschlussliste in der Anwesenheitsliste rechnet mit derselben
  Grenze, sonst verschwände er aus beiden Quellen.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Der Platz bleibt ab der Bestätigung belegt | Entscheidung des Betreibers: Sonst ließe sich der Kurs überbuchen, weil der Oktober-Platz nicht mitzählte. | 2026-09-24 |
| Der Kurs erscheint vor dem Einstieg gar nicht unter „Mein Bereich" | Ein ausgegrauter Knopf mit Erklärung wäre freundlicher, aber der Kunde sieht seine Buchung ohnehin im Profil. Nachrüstbar. | 2026-09-24 |

### Technical Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| `gilt_ab` in die gemeinsame Sicht statt in jede Lesestelle | Zehn Stellen beantworteten diese Frage früher getrennt; genau dagegen gibt es die Sicht. Jetzt entscheidet jede Lesestelle bewusst, ob sie den Beginn beachtet. | 2026-09-24 |
| Nur Check-in und Anwesenheitsliste beachten ihn | Beides bezieht sich auf einen **Tag**. Kursgrenze, Teilnehmerliste und Rollenbalance beziehen sich auf den Kurs als Ganzes. | 2026-09-24 |
| Eigene Fehlermeldung `membership not started` | „Kein aktives Abo" wäre gelogen — er hat eines, es gilt nur noch nicht. | 2026-09-24 |

---

## QA Test Results (2026-09-24)

**Empfehlung: bereit für die Produktion**, sobald die Migration eingespielt ist.

| | |
|---|---|
| Datenbank | 6 |
| Browser (E2E) | 2 |
| Regeln und Datenbank gesamt | 989 grün, 1 übersprungen |
| Produktfehler gefunden | 1 (der gemeldete) + 1 mitentdeckter (Anwesenheitsliste) |

### Was geprüft ist

**Der gemeldete Fall**, nachgestellt mit einem Platz, der morgen beginnt: Einchecken wird abgewiesen,
der Kunde steht nicht auf der heutigen Anwesenheitsliste, sein Platz zählt aber gegen die
Kursgrenze. Ab dem Starttermin geht beides. Der Test lief vor der Migration rot und meldete genau
die beiden Befunde.

**Was der Kunde sieht**: Vor dem Einstieg steht der Kurs nicht unter „Mein Bereich", danach schon —
samt Eincheck-Knopf. Zur Gegenprobe wurde der Filter einmal entfernt: Die Prüfung fiel sofort.

**Die Rechte**: Beide ersetzten Funktionen bleiben für anonyme Aufrufer verschlossen. Das ist die
Falle aus `.claude/rules/backend.md` — `create or replace function` setzt die Rechte zurück.

### Nicht geprüft

Ob in der Produktion jemand vor der Korrektur zu früh eingecheckt hat. Diese Einträge bleiben
stehen; der Lehrer kann sie in der Anwesenheitsliste entfernen.
