# PROJ-32: Aktive-Kunden-Anzahl im Dashboard

## Status: Planned
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Dependencies
- PROJ-17 (Admin-Analytics-Dashboard)

## User Stories
- Als Admin möchte ich auf meinem Dashboard die aktuelle Anzahl aktiver Kunden sehen, damit ich auf einen Blick ein Gefühl für den Geschäftsstand habe, ohne Listen durchsuchen zu müssen.

## Out of Scope
- Historischer Verlauf der aktiven Kunden über Zeit — nur eine aktuelle Momentaufnahme fürs MVP; ein Trend könnte später analog zu den bestehenden Umsatz-/Kündigungs-Trends (PROJ-17) ergänzt werden
- Aufschlüsselung nach Kurs, Level oder Tanzstil — nur die Gesamtzahl

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen es gibt Kunden mit mindestens einem Abo im Status „aktiv", wenn der Admin das Dashboard öffnet, dann zeigt eine Kachel die Anzahl dieser Kunden
- [ ] Angenommen ein Kunde hat mehrere Abos, von denen mindestens eines aktiv ist, wenn die Kachel berechnet wird, dann wird dieser Kunde nur einmal gezählt
- [ ] Angenommen ein Kunde hat nur pausierte oder gekündigte Abos, wenn die Kachel berechnet wird, dann wird dieser Kunde nicht mitgezählt
- [ ] Angenommen es gibt aktuell keine aktiven Kunden, wenn der Admin das Dashboard öffnet, dann zeigt die Kachel „0" statt eines Fehlers oder Leerzustands

## Edge Cases
- Ein Abo wechselt genau zum Zeitpunkt der Anzeige von aktiv zu pausiert (z.B. durch eine geplante Pause, die heute wirksam wird) — die Zahl muss den aktuellen Stand nach der täglichen Cron-Verarbeitung zeigen, nicht einen zwischengespeicherten alten Wert.

## Technical Requirements (optional)
- Keine besonderen Anforderungen über die üblichen Standards hinaus.

## Open Questions
- Keine offenen Fragen zum Zeitpunkt der Spec-Erstellung.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| „Aktiver Kunde" = mindestens ein Abo mit Status „aktiv" | User-bestätigte Definition, konsistent mit der Newsletter-Gruppe „Aktive Kunden" (PROJ-28) | 2026-08-21 |
| Kachel nutzt die bestehende `MetricTile`-Komponente | Konsistentes Look & Feel mit den anderen Dashboard-Kacheln (PROJ-17) | 2026-08-21 |

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
