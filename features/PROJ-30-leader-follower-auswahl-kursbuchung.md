# PROJ-30: Leader/Follower-Auswahl bei Kursbuchung

## Status: Planned
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Dependencies
- PROJ-3 (Admin: Kurse verwalten) — für die Pro-Kurs-Konfiguration
- PROJ-8 (Kursbuchung) / PROJ-26 (Kursbuchung vom Stundenplan) — Buchungsdialog

## User Stories
- Als Kunde möchte ich beim Buchen eines Partnertanz-Kurses angeben, ob ich Leader, Follower oder beides tanze, damit der Lehrer eine ausgewogene Klasse planen kann.
- Als Admin möchte ich pro Kurs festlegen, ob diese Abfrage überhaupt erscheint, damit sie bei Kursen ohne Partnertanz-Bezug (z.B. Ladies Styling) nicht unnötig auftaucht.
- Als Admin/Lehrer möchte ich die Leader/Follower-Verteilung eines Kurses auf einen Blick sehen, damit ich die Klasse entsprechend planen kann.

## Out of Scope
- Automatisches Balancing oder rollenbasierte Wartelisten-Priorisierung — reine Anzeige der Verteilung fürs MVP, keine Automatik
- Rollenwechsel durch den Kunden im Self-Service nach der Buchung (Admin kann die Angabe aber im Buchungsdetail korrigieren)
- Rollenabfrage bei Event-/Workshop-Ticketkauf (PROJ-14) — nur bei regulären Kursbuchungen

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Admin bearbeitet einen Kurs, wenn er „Leader/Follower-Abfrage aktivieren" einschaltet, dann wird beim Buchen dieses Kurses die Rollenauswahl angezeigt
- [ ] Angenommen ein Kurs hat die Rollenabfrage nicht aktiviert, wenn ein Kunde diesen Kurs bucht, dann erscheint keine Rollenauswahl im Buchungsdialog
- [ ] Angenommen ein Kurs hat die Rollenabfrage aktiviert, wenn ein Kunde den Buchungsdialog öffnet, dann kann er zwischen Leader, Follower und Beide wählen; das Feld ist optional
- [ ] Angenommen ein Kunde hat beim Buchen eine Rolle gewählt, wenn der Admin die Teilnehmerliste des Kurses öffnet, dann sieht er die Rolle je Teilnehmer sowie eine Zusammenfassung (z.B. „6 Leader / 4 Follower / 2 Beide")
- [ ] Angenommen ein Kunde hat keine Rolle angegeben, wenn der Admin die Teilnehmerliste öffnet, dann wird dieser Kunde als „keine Angabe" geführt

## Edge Cases
- Admin deaktiviert die Rollenabfrage, nachdem bereits Buchungen mit Rollenangabe existieren — bestehende Angaben bleiben erhalten, nur neue Buchungen fragen nicht mehr.
- Ein Kurs wechselt von „keine Abfrage" zu „Abfrage aktiv" — betrifft nur neue Buchungen ab Aktivierung; bestehende Buchungen zeigen weiterhin „keine Angabe".

## Technical Requirements (optional)
- Keine besonderen Anforderungen über die üblichen Standards hinaus.

## Open Questions
- Keine offenen Fragen zum Zeitpunkt der Spec-Erstellung.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Pro Kurs konfigurierbar statt global aktiviert | User-Entscheidung: nicht alle Kurse sind Partnertänze | 2026-08-21 |
| Dritte Option „Beide" zusätzlich zu Leader/Follower | Viele Tänzer tanzen ohne feste Rolle; erzwingt keine künstliche Festlegung | 2026-08-21 |
| Optionales statt Pflichtfeld | Reduziert Buchungs-Reibung; Admin bekommt trotzdem eine vollständige Teilnehmerliste inkl. „keine Angabe" | 2026-08-21 |

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
