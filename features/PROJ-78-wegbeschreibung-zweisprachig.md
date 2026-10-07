# PROJ-78: Die Wegbeschreibung auch auf Englisch

## Status: Architected
**Created:** 2026-10-07
**Last Updated:** 2026-10-07

## Dependencies
- Requires: PROJ-77 (Wegbeschreibung in der Erinnerung) — der Satz, dem die Sprache fehlte
- Requires: PROJ-43 (Englische Sprachvariante) — dort wurde dieser Fall ausdrücklich zurückgestellt
- Requires: PROJ-3 (Standortverwaltung) — das Formular, das das zweite Feld bekommt

## Anlass

Rückmeldung des Betreibers zu PROJ-77, am Tag der Auslieferung: „Das hat funktioniert. Allerdings ist
die Beschreibung momentan noch einsprachig."

Zutreffend, und es stand sogar in meinem eigenen Test: Die *Einleitung* des Satzes ist zweisprachig
(„So findest du uns" / „Here is how to find us"), der Text danach kam aus einem einzigen Feld. Ein
englischsprachiger Kunde las eine englische Einleitung und danach Deutsch.

PROJ-43 hatte zweisprachige Datenbankinhalte — „Kursnamen, Tanzstile, **Standorte**, Raumnamen,
Event-Namen und -Beschreibungen, Vorkenntnis-Hinweise" — ausdrücklich zurückgestellt: „Sie erscheinen
in beiden Sprachen so, wie sie eingetragen sind. **Nachrüstbar, wenn es im Betrieb stört.**" Mit
PROJ-77 ist einer dieser Inhalte erstmals in einer Kundenmail gelandet, und damit stört er.

## User Stories

- Als englischsprachiger Kunde möchte ich die Wegbeschreibung in meiner Sprache lesen.
- Als Betreiber möchte ich die englische Fassung dort pflegen, wo auch die deutsche steht.
- Als Betreiber möchte ich sie **nicht** pflegen müssen: Fehlt sie, soll die deutsche Fassung gelten,
  nicht nichts.

## Out of Scope

- **Die übrigen zweisprachigen Inhalte** aus der Liste von PROJ-43: Kursnamen, Kursbeschreibungen,
  Tanzstile, Raumnamen, Event-Texte, Vorkenntnis-Hinweise. Sie stehen im Kundenbereich weiterhin so da,
  wie sie eingetragen sind. Jeder einzelne ist derselbe Handgriff; sinnvoll, sobald er stört.
- **Eine dritte Sprache.** Eine Spalte mehr trägt zwei Sprachen; eine dritte wäre der Zeitpunkt für
  eine eigene Tabelle.
- **Automatische Übersetzung.** Eine Wegbeschreibung mit Klingelschild und Hinterhof ist genau der
  Text, den eine Maschine falsch überträgt.
- **Der Name und die Anschrift** des Standorts. Beide sind Eigennamen und bleiben, wie sie sind.

## Acceptance Criteria

- [ ] Angenommen die Verwaltung bearbeitet einen Standort, dann gibt es neben „Beschreibung" ein Feld
      „Beschreibung (englisch)" mit dem Hinweis, dass die deutsche Fassung gilt, wenn es leer bleibt.
- [ ] Angenommen beide Felder sind gefüllt, wenn der Standort gespeichert und erneut geöffnet wird,
      dann stehen beide Fassungen noch da.
- [ ] Angenommen ein englischsprachiger Kunde bekommt die Erinnerung und die englische Fassung ist
      hinterlegt, dann steht sie in der Mail.
- [ ] Angenommen die englische Fassung fehlt, dann steht die deutsche in der englischen Mail — mit
      englischer Einleitung.
- [ ] Angenommen die englische Fassung enthält nur Leerzeichen, dann gilt sie als fehlend.
- [ ] Angenommen ein deutschsprachiger Kunde bekommt die Erinnerung, dann bleibt es bei der deutschen
      Fassung, auch wenn eine englische hinterlegt ist.
- [ ] Angenommen beide Fassungen fehlen, dann steht in beiden Sprachen kein Satz zur Wegfindung.

## Edge Cases

- **Nur Leerzeichen im englischen Feld**: gilt als leer. Geprüft wird auf Inhalt, nicht auf
  Vorhandensein — ein Feld mit einem Leerzeichen hätte sonst die deutsche Fassung verdrängt und dem
  englischen Kunden gar nichts gelassen.
- **Zeilenumbrüche**: werden in beiden Fassungen zu Leerzeichen (PROJ-77).
- **Reihenfolge beim Ausliefern**: Diesmal **nicht** frei. Der Versand liest die neue Spalte, und die
  Standortverwaltung schreibt sie — ohne Migration scheitert beides. Erst die Migration, dann die
  Auslieferung.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Fehlt die englische Fassung, gilt die deutsche | Eine Wegbeschreibung hilft auch in der falschen Sprache noch zur Tür. Dieselbe Abwägung, die das Projekt bei den Benachrichtigungs-Vorlagen schon getroffen hat: „eine Benachrichtigung in der falschen Sprache ist besser als keine". | 2026-10-07 |
| Das englische Feld ist freiwillig | Sonst müsste der Betreiber jeden Standort zweimal beschreiben, bevor er ihn speichern kann. | 2026-10-07 |
| Nur die Wegbeschreibung, nicht die ganze Liste aus PROJ-43 | Sie ist der einzige dieser Inhalte, der in einer Kundenmail landet. Der Rest bleibt, bis er stört. | 2026-10-07 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Eine Spalte `description_en`, keine Übersetzungstabelle | Zwei Sprachen, ein Verwendungsort. Eine Tabelle wäre Mechanik für einen Fall, der nicht ansteht — und eine dritte Sprache wäre ohnehin der Zeitpunkt, es anders zu bauen. | 2026-10-07 |
| Erst säubern, dann die Sprache wählen | Ein Feld mit nur Leerzeichen ist in JavaScript „vorhanden". Die erste Fassung wählte danach und ließ den englischen Kunden leer ausgehen — der Test hat es sofort gemeldet. | 2026-10-07 |
| `types.ts` von Hand nachgezogen | Dasselbe Vorgehen wie bei PROJ-62: Die Typdatei wird aus der Datenbank erzeugt, die neue Spalte stand dort noch nicht. | 2026-10-07 |

---

## Tech Design (Solution Architect)

```
Standortverwaltung
+-- Name, Adresse                     (unverändert)
+-- Beschreibung                      → deutsche Wegbeschreibung
+-- Beschreibung (englisch)   NEU     → leer = die deutsche gilt
        │
        ▼
Versand der Erinnerung
  wählt nach der Sprache des Empfängers, säubert, setzt den Satz:
     deutsch  → „So findest du uns: …"
     englisch → „Here is how to find us: …"  (englische Fassung, sonst deutsche)
```

Eine Spalte, ein Feld im Formular, eine Zeile Sprachwahl im Baustein aus PROJ-77. Die Entscheidung
„welche Fassung" liegt dort, wo auch der Satz entsteht — nicht im Versand und nicht in der Vorlage.

### Migration

`20261007150000_proj78_standort_beschreibung_englisch.sql` — eine Spalte, keine Rechteänderung.
**Muss vor der Auslieferung eingespielt werden:** Die Standortverwaltung schreibt die Spalte und der
Versand liest sie; fehlt sie, scheitert beides (die Erinnerung läuft dann als „nicht zugestellt" auf).

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
