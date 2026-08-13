# PROJ-6: Stundenplan & Kalender

## Status: Planned
**Created:** 2026-08-14
**Last Updated:** 2026-08-14

## Dependencies
- Requires: PROJ-3 (Admin: Kurse, Levels, Locations & Tanzstile verwalten) — Wochentermin wird direkt im bestehenden Kurs-Formular gepflegt, ein Kurs bleibt beim Level-Wechsel derselbe Datensatz
- Requires: PROJ-1 (Supabase Infrastructure Setup) — `class_sessions`-Tabelle als Ausgangspunkt für das Datenmodell

## User Stories
- Als Admin möchte ich für einen Kurs einen wiederkehrenden Wochentermin (Wochentag, Start- und Endzeit) festlegen können, damit Kunden wissen, wann der Kurs stattfindet.
- Als Admin möchte ich einen bestehenden Wochentermin bearbeiten oder entfernen können, damit ich auf Änderungen reagieren kann.
- Als Admin möchte ich eine einzelne Woche gezielt als Pause markieren können, damit Kunden nicht zu einem ausfallenden Termin erscheinen (z. B. Feiertag oder Übergang zwischen zwei Kursblöcken).
- Als Besucher (auch ohne Login) möchte ich eine wöchentliche Stundenplan-Übersicht sehen, damit ich weiß, wann welcher Kurs stattfindet.
- Als Besucher möchte ich die Wochentage nebeneinander durchblättern (swipebar) können, damit ich auf dem Handy bequem den ganzen Wochenplan durchsehen kann.

## Out of Scope
- Buchung von Terminen — eigenes Feature PROJ-8
- Ausweichtermine/Alternativtermine bei mehreren Kursen desselben Levels — mögliche zukünftige Erweiterung über Abo-Berechtigungen (PROJ-8/PROJ-9), nicht Teil von PROJ-6
- Mehrere Wochentermine pro Kurs — aktuell hat jeder Kurs genau einen festen Wochentermin; bei Bedarf später erweiterbar
- Enddatum/Blockgrenzen pro Wochentermin — der Kurs bleibt beim Level-Wechsel derselbe Datensatz (nur Name/Level/Video werden über PROJ-3 geändert), der Wochentermin läuft dauerhaft weiter, keine Kopplung an 8-Wochen-Blöcke nötig
- Kalender-Grid mit Monatsansicht — eine Wochen-Agenda-Ansicht (Wochentage nebeneinander, swipebar) reicht im MVP
- Konflikterkennung bei Raum-/Zeitüberschneidung zwischen zwei Kursen — Admin ist im MVP selbst dafür verantwortlich
- Automatische Erinnerungen/Benachrichtigungen zu Terminen — eigenes Feature PROJ-16

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen der Admin bearbeitet einen Kurs, wenn er Wochentag, Start- und Endzeit einträgt und speichert, dann wird der Wochentermin gespeichert und erscheint im Stundenplan
- [ ] Angenommen ein Kurs hat einen Wochentermin, wenn der Admin ihn ändert, dann ist die Änderung sofort im Stundenplan sichtbar
- [ ] Angenommen ein Kurs hat einen Wochentermin, wenn der Admin ihn entfernt, dann verschwindet der Kurs aus dem Stundenplan, bleibt aber weiterhin im Kurskatalog (PROJ-5) sichtbar
- [ ] Angenommen ein Kurs hat einen Wochentermin, wenn der Admin eine bestimmte Woche als Pause markiert, dann erscheint der Termin in dieser einen Woche nicht im Stundenplan, in der Folgewoche aber wieder normal
- [ ] Angenommen ein Besucher (auch ohne Login) ruft den Stundenplan auf, dann sieht er alle terminierten Kurse mit Wochentag, Uhrzeit, Name, Tanzstil, Level, Standort und Lehrer, gruppiert nach Wochentag
- [ ] Angenommen der Stundenplan wird auf einem schmalen Bildschirm angezeigt, wenn der Besucher zwischen Wochentagen wechseln will, dann kann er horizontal durch die Tage blättern/swipen
- [ ] Angenommen an einem Wochentag findet kein terminierter Kurs statt, wenn der Besucher zu diesem Tag blättert, dann erscheint ein verständlicher Hinweis statt einer leeren Fläche
- [ ] Angenommen der Admin trägt eine Endzeit vor der Startzeit ein, wenn er speichern will, dann erscheint eine Validierungsfehlermeldung und der Termin wird nicht gespeichert
- [ ] Angenommen ein Pflichtfeld (Wochentag, Start- oder Endzeit) fehlt, wenn der Admin einen Wochentermin speichern will, dann erscheint eine Validierungsfehlermeldung

## Edge Cases
- Kurs ohne Wochentermin → erscheint nicht im Stundenplan, aber weiterhin im Kurskatalog aus PROJ-5
- Kein Kurs an einem bestimmten Wochentag → verständlicher Leerzustand für diesen Tag statt leerer Fläche
- Pause-Eintrag für eine bereits vergangene Woche → kein besonderes Verhalten nötig, Pause-Einträge können frei angelegt/gelöscht werden
- Zwei Kurse mit überlappenden Zeiten am selben Standort/Raum → kein Konfliktcheck im MVP
- Gleichzeitige Bearbeitung durch zwei Admins → kein spezielles Konflikthandling im MVP (Last-Write-Wins), analog zu PROJ-3

## Technical Requirements (optional)
- Security: Nur lesender, öffentlicher Zugriff auf den Stundenplan; Schreibzugriff auf Wochentermine/Pausen nur für Rolle „admin"
- Performance: Stundenplan muss auch für nicht eingeloggte Besucher performant laden

## Open Questions
<!-- Unresolved questions from the spec interview. Close them in /refine when answered. -->
- [x] Admin-Verwaltung und Kalenderansicht in einem Feature oder getrennt? → Beides in PROJ-6 (2026-08-14)
- [x] Wiederkehrendes Muster oder manuelle Einzeltermine? → Wiederkehrendes Wochenmuster (2026-08-14)
- [x] Enddatum pro Termin für 8-Wochen-Blöcke? → Nein, Kurs bleibt derselbe Datensatz über Level-Wechsel hinweg, Termin läuft dauerhaft (2026-08-14)
- [x] Umgang mit gelegentlichen Pausenwochen? → Admin kann einzelne Wochen gezielt aussetzen (2026-08-14)
- [x] Mehrere Wochentermine pro Kurs möglich? → Nein, aktuell genau einer pro Kurs (2026-08-14)
- [x] Start- und Endzeit oder nur Startzeit? → Start- und Endzeit (2026-08-14)
- [x] Kalender-Stil? → Wochen-Agenda, Wochentage nebeneinander/swipebar statt untereinander (2026-08-14)
- [x] Wo wird der Wochentermin gepflegt? → Direkt im bestehenden Kurs-Formular aus PROJ-3 (2026-08-14)
- [ ] Ausweichtermine bei mehreren Kursen desselben Levels (Idee des Nutzers) — zurückgestellt, gehört eher zu PROJ-8/PROJ-9 (Abo-Berechtigungen), dort bei Bedarf erneut aufgreifen

## Decision Log
<!-- Record of conscious decisions made and why. Added to by /write-spec and /architecture. -->

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Admin-Terminverwaltung und Kunden-Kalenderansicht in einem Feature | Anders als bei PROJ-3/PROJ-5 gibt es noch keine bestehende Admin-Verwaltung für Termine, auf die man getrennt aufbauen könnte — beides gehört hier untrennbar zusammen | 2026-08-14 |
| Wiederkehrender Wochentermin ohne Enddatum, dauerhaft am Kurs hängend | Der Kurs bleibt beim Level-Wechsel (z. B. Beginner → Improver nach 8 Wochen) derselbe Datensatz — nur Name/Level/Video ändern sich über PROJ-3, der Termin selbst muss nicht neu angelegt werden | 2026-08-14 |
| Gezieltes Aussetzen einzelner Wochen statt Blockgrenzen | Bildet Feiertage/Übergangspausen realistisch ab, ohne die Dauerhaftigkeit des Wochentermins aufzugeben | 2026-08-14 |
| Genau ein Wochentermin pro Kurs im MVP | Entspricht der aktuellen Realität der Tanzschule; Mehrfachtermine sind eine mögliche spätere Erweiterung | 2026-08-14 |
| Wochentermin wird im bestehenden Kurs-Formular (PROJ-3) gepflegt, keine eigene Verwaltungsseite | 1:1-Beziehung zum Kurs macht eine separate Seite unnötig, Admin bleibt an einem Ort | 2026-08-14 |
| Ausweichtermin-Idee zurückgestellt | Betrifft eher Buchungs-/Abo-Berechtigungen als die reine Terminanzeige — passt besser zu PROJ-8/PROJ-9 | 2026-08-14 |
| Wochen-Agenda mit nebeneinander liegenden, swipebaren Wochentagen statt Kalender-Grid oder vertikaler Liste | Nutzerwunsch, gut für mobile Nutzung, deutlich weniger Aufwand als ein echtes Kalender-Grid | 2026-08-14 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
