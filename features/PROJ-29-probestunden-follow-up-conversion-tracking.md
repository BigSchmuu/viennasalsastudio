# PROJ-29: Probestunden-Follow-up & Conversion-Tracking

## Status: Planned
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Dependencies
- PROJ-8 (Kursbuchung) — Datenmodell für Probestunden (`course_bookings.type = 'trial'`)

## User Stories
- Als Admin möchte ich eine Übersicht aller Probestunden-Buchungen sehen, damit ich nachverfolgen kann, wer noch nicht regulär gebucht hat.
- Als Admin möchte ich einen Kunden als „kontaktiert" markieren und eine Notiz hinterlegen können, damit ich meine Follow-up-Bemühungen dokumentiere.
- Als Admin möchte ich eine Gesamt-Conversion-Rate (Probestunde → reguläre Buchung) sehen, damit ich beurteilen kann, wie gut der Probestunden-Trichter funktioniert.

## Out of Scope
- Automatisierte Erinnerungs-Mails an Admin oder Kunden — rein manuelle Nachverfolgung fürs MVP
- Conversion-Rate-Trend über Zeit/Diagramme — nur eine aktuelle Gesamtzahl für einen wählbaren Zeitraum
- Zuordnung von Follow-ups an einzelne Mitarbeiter — Solo-Administration, kein Team-Feature nötig

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Kunde hat eine Probestunde gebucht, wenn der Admin die Probestunden-Übersicht öffnet, dann erscheint der Kunde mit Kursname, Datum der Probestunde und Status (offen/kontaktiert/konvertiert)
- [ ] Angenommen ein Kunde hat nach seiner Probestunde eine reguläre Buchung oder ein Abo abgeschlossen, wenn der Admin die Übersicht öffnet, dann ist dieser Kunde automatisch als „konvertiert" markiert
- [ ] Angenommen ein Kunde ist noch nicht konvertiert, wenn der Admin den Haken „kontaktiert" setzt und optional eine Notiz einträgt, dann wird dies gespeichert und bleibt beim erneuten Öffnen sichtbar
- [ ] Angenommen die Probestunden-Übersicht ist offen, wenn der Admin sie betrachtet, dann sieht er eine Gesamt-Conversion-Rate (Anteil konvertierter Probestunden an allen Probestunden) für einen wählbaren Zeitraum
- [ ] Angenommen eine Probestunde liegt mehr als 14 Tage zurück ohne dass „kontaktiert" gesetzt wurde und ohne Konvertierung, wenn der Admin die Übersicht öffnet, dann wird dieser Eintrag als „Follow-up überfällig" hervorgehoben
- [ ] Angenommen der Admin filtert nach Status „Offen", wenn er den Filter anwendet, dann werden nur weder kontaktierte noch konvertierte Probestunden angezeigt

## Edge Cases
- Ein Kunde bucht mehrere Probestunden in verschiedenen Kursen — jede wird als eigener Eintrag geführt; Konvertierung prüft, ob nach der jeweiligen Probestunde irgendeine reguläre Buchung erfolgte.
- Probestunden vor Einführung dieses Features werden rückwirkend erfasst, da sie auf den bestehenden `course_bookings`-Daten basieren — keine neue Datenerfassung nötig.
- Ein Kunde konvertiert, storniert später aber sein Abo wieder — bleibt trotzdem als „konvertiert" markiert, da die Konvertierung ein historisches Ereignis ist, kein aktueller Status.

## Technical Requirements (optional)
- Conversion-Berechnung basiert auf bestehenden `course_bookings`-Daten, keine neue Tabelle für die Buchungen selbst — nur für den Kontaktiert-Status/Notiz nötig.

## Open Questions
- Keine offenen Fragen zum Zeitpunkt der Spec-Erstellung.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Conversion = irgendeine reguläre Buchung/Abo nach der Probestunde, kein festes Zeitfenster | Einfacher als ein Zeitfenster zu pflegen; Admin sieht das Datum und kann selbst beurteilen | 2026-08-21 |
| Manuelle Nachverfolgung (Haken + Notiz) statt automatischer Erinnerungs-Mails | User-Entscheidung: reduziert Scope, keine Überschneidung mit dem Newsletter-Feature (PROJ-28) | 2026-08-21 |
| „Follow-up überfällig" ab 14 Tagen ohne Kontakt/Konvertierung | Sinnvoller Standardwert als fixe Konstante fürs MVP | 2026-08-21 |

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
