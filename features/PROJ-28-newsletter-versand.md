# PROJ-28: Newsletter-Versand mit Empfängergruppen

## Status: Planned
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Dependencies
- PROJ-16 (Automatische E-Mail-/Push-Benachrichtigungen) — nutzt bestehende Mail-/Queue-Infrastruktur und Opt-out-System
- PROJ-29 (Probestunden-Follow-up & Conversion-Tracking) — liefert die Definition für die Gruppe "Probestunde ohne Folgebuchung"
- PROJ-32 (Aktive-Kunden-Anzahl im Dashboard) — teilt sich die Definition von "aktiver Kunde"

## User Stories
- Als Admin möchte ich eine E-Mail an eine wählbare Gruppe von Kunden verschicken, damit ich Ankündigungen, Aktionen oder Terminänderungen kommunizieren kann, ohne jeden Kunden einzeln anzuschreiben.
- Als Admin möchte ich aus vordefinierten Empfängergruppen wählen (Alle Kunden, Aktive Kunden, Kunden mit Probestunde ohne Folgebuchung, Teilnehmer eines bestimmten Kurses), damit ich die richtige Zielgruppe erreiche.
- Als Kunde möchte ich Newsletter-E-Mails abbestellen können, ohne dabei wichtige transaktionale E-Mails (Buchungsbestätigung etc.) zu verlieren.

## Out of Scope
- Rich-Text/WYSIWYG-Editor mit Bildern — nur Betreff + Fließtext fürs MVP
- Öffnungs-/Klickraten-Tracking (Analytics) — nur Erfolg/Misserfolg des Versands
- Zeitgesteuerter/geplanter Versand — nur Sofortversand fürs MVP
- Weitere Segmentierung (z.B. nach Tanzstil, Level) über die 4 definierten Gruppen hinaus
- SMS/Push als Newsletter-Kanal — nur E-Mail

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen der Admin ist im Newsletter-Bereich, wenn er eine Empfängergruppe auswählt, dann wird die Anzahl der Empfänger in dieser Gruppe angezeigt, bevor er sendet
- [ ] Angenommen der Admin hat Betreff, Text und eine Gruppe ausgefüllt, wenn er auf „Senden" klickt, dann erscheint eine Bestätigungsabfrage mit Empfängeranzahl vor dem tatsächlichen Versand
- [ ] Angenommen der Versand wurde bestätigt, wenn die Newsletter-Mail verschickt wird, dann erhalten nur Kunden, die Newsletter-Benachrichtigungen nicht deaktiviert haben, die E-Mail
- [ ] Angenommen ein Kunde hat Newsletter-Benachrichtigungen in seinen Benachrichtigungseinstellungen deaktiviert, wenn ein Newsletter verschickt wird, dann erhält dieser Kunde keine E-Mail
- [ ] Angenommen die Gruppe „Aktive Kunden" ist gewählt, wenn der Newsletter verschickt wird, dann erhalten nur Kunden mit mindestens einem Abo im Status „aktiv" die E-Mail
- [ ] Angenommen die Gruppe „Probestunde ohne Folgebuchung" ist gewählt, wenn der Newsletter verschickt wird, dann erhalten nur Kunden, deren letzte Probestunden-Buchung noch nicht zu einer regulären Buchung/Abo geführt hat, die E-Mail
- [ ] Angenommen die Gruppe „Kurs-Teilnehmer" ist gewählt, wenn der Admin zusätzlich einen Kurs auswählt, dann erhalten nur aktuell in diesem Kurs gebuchte Kunden die E-Mail
- [ ] Angenommen Betreff oder Text sind leer, wenn der Admin auf „Senden" klickt, dann wird eine Validierungsfehlermeldung angezeigt und kein Versand ausgelöst
- [ ] Angenommen eine gewählte Gruppe hat 0 Empfänger, wenn der Admin senden will, dann wird ein Hinweis angezeigt und der Senden-Button bleibt deaktiviert
- [ ] Angenommen der Newsletter wurde verschickt, wenn der Admin die Versandhistorie öffnet, dann sieht er vergangene Newsletter mit Betreff, Datum, Gruppe und Empfängeranzahl

## Edge Cases
- Der Versand an hunderte Empfänger darf die Admin-UI nicht blockieren — läuft asynchron über die bestehende `notification_queue`.
- Ein Kunde gehört zu mehreren sich überschneidenden Gruppen (z.B. aktiv + Kursteilnehmer) — wird pro Versand nur einmal angeschrieben (Deduplizierung nach `customer_id`).
- Ein gewählter Kurs hat 0 Teilnehmer — Kurs bleibt auswählbar, Empfängeranzahl zeigt 0, Senden-Button bleibt deaktiviert.
- Ein Kunde ohne gültige E-Mail-Adresse wird beim Versand übersprungen, ohne den gesamten Versand abzubrechen.

## Technical Requirements (optional)
- Versand läuft über die bestehende Notification-Queue (asynchron, kein Blocking).

## Open Questions
- [ ] Soll die Versandhistorie später um Öffnungs-/Klickraten erweitert werden? → Aktuell bewusst Out of Scope, ggf. eigenes Folge-Feature.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| 4 Empfängergruppen: Alle, Aktive, Probestunde ohne Folgebuchung, pro Kurs | Deckt das genannte Follow-up-Szenario und die Kurs-Zielgruppe ab, ohne die Segmentierung zu überladen | 2026-08-21 |
| Einfacher Editor (Betreff + Fließtext) statt Rich-Text | Schneller umsetzbar, passt zum bisherigen minimalen Tooling der App | 2026-08-21 |
| Nur Sofortversand, kein geplanter Versand | Reduziert Scope fürs MVP | 2026-08-21 |
| Newsletter nutzt einen neuen `newsletter`-Event-Typ im bestehenden Opt-out-System | Konsistent mit PROJ-16, kein neues Consent-System nötig | 2026-08-21 |
| „Probestunde ohne Folgebuchung" nutzt die Conversion-Logik aus PROJ-29 | Vermeidet doppelte Definition derselben Berechnung in zwei Features | 2026-08-21 |

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
