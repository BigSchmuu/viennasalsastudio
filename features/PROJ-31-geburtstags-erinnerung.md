# PROJ-31: Geburtstags-Erinnerung

## Status: Planned
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Dependencies
- PROJ-17 (Admin-Analytics-Dashboard) — für das Geburtstags-Widget
- PROJ-13 (Lehrer-Ansicht: Stundenplan, Anwesenheit, Notizen) — für das Icon in der Anwesenheitsmatrix
- PROJ-2 (Auth & Kundenprofil) — bestehendes `birthdate`-Feld

## User Stories
- Als Admin möchte ich auf meinem Dashboard sehen, welche Kunden in den nächsten 7 Tagen Geburtstag haben, damit ich eine persönliche Geste oder Gratulation planen kann.
- Als Lehrer möchte ich in der Anwesenheitsliste einen Hinweis sehen, wenn ein Kursteilnehmer heute Geburtstag hat, damit ich im Unterricht persönlich gratulieren kann.

## Out of Scope
- Automatischer Geburtstagsgruß per E-Mail — könnte später über das Newsletter-/Notification-System (PROJ-28/PROJ-16) ergänzt werden
- Anzeige des Alters — nur das Datum wird angezeigt, aus Datenschutzgründen
- Für Kunden selbst sichtbare Geburtstagsliste (z.B. „wer hat noch Geburtstag") — nur Admin-/Lehrer-Ansicht

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Kunde hat ein Geburtsdatum hinterlegt, das innerhalb der nächsten 7 Tage liegt, wenn der Admin das Dashboard öffnet, dann erscheint der Kunde im Geburtstags-Widget mit Name und Datum
- [ ] Angenommen kein Kunde hat in den nächsten 7 Tagen Geburtstag, wenn der Admin das Dashboard öffnet, dann zeigt das Widget einen Leerzustand („Keine Geburtstage in den nächsten 7 Tagen")
- [ ] Angenommen ein Kunde hat heute Geburtstag und ist Teilnehmer eines Kurses, wenn der Lehrer die Anwesenheitsliste dieses Kurses öffnet, dann erscheint ein Geburtstags-Icon neben dem Namen dieses Kunden
- [ ] Angenommen ein Kunde hat kein Geburtsdatum hinterlegt, wenn Dashboard oder Anwesenheitsliste angezeigt werden, dann erscheint für diesen Kunden kein Geburtstags-Hinweis
- [ ] Angenommen mehrere Kunden haben am selben Tag Geburtstag, wenn das Widget oder die Anwesenheitsliste angezeigt wird, dann werden alle betroffenen Kunden korrekt angezeigt

## Edge Cases
- Geburtstag am 29. Februar: in Nicht-Schaltjahren wird dieser als 28. Februar behandelt.
- Der 7-Tage-Zeitraum reicht über den Jahreswechsel hinweg (z.B. Abfrage am 28.12. für Geburtstage bis 03.01.) — Berechnung muss Monat/Tag korrekt über den Jahreswechsel hinweg vergleichen, nicht als reines Datumsintervall.
- Ein Kunde mit pausiertem/gekündigtem Abo hat in den nächsten 7 Tagen Geburtstag — erscheint trotzdem im Widget, da es um eine persönliche Geste geht, unabhängig vom Abo-Status.

## Technical Requirements (optional)
- Keine besonderen Anforderungen über die üblichen Standards hinaus.

## Open Questions
- Keine offenen Fragen zum Zeitpunkt der Spec-Erstellung.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| 7-Tage-Vorschau im Dashboard + Icon in der Anwesenheitsliste am Tag selbst | User-Entscheidung: deckt sowohl vorausschauende Planung (Admin) als auch den Live-Moment im Unterricht (Lehrer) ab | 2026-08-21 |
| Kein Alter angezeigt, nur das Datum | Datenschutz-Rücksicht; Alter ist für die Anwendungsfälle nicht nötig | 2026-08-21 |
| Nutzt bestehendes `birthdate`-Feld auf `profiles` | Feld existiert bereits (Kundenprofil), keine neue Datenerfassung nötig | 2026-08-21 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
