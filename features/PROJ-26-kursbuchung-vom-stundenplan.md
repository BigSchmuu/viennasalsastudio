# PROJ-26: Kursbuchung direkt von /stundenplan aus

## Status: Planned
**Created:** 2026-08-18
**Last Updated:** 2026-08-18

## Dependencies
- Requires: PROJ-6 (Stundenplan & Kalender) — der „Buchen"-Button erscheint auf der bestehenden `/stundenplan`-Seite
- Requires: PROJ-8 (Kursbuchung) — nutzt den bestehenden `BookingDialog` und die bestehende Buchungslogik (`createBooking`, `joinWaitlist`) vollständig wieder, keine neue Logik
- Requires: PROJ-25 (Self-Check-In für Kursanwesenheit) — Wechselwirkung: bei aktivem Abo für einen Kurs erscheint dort der Self-Check-In-Button statt eines Buchen-Buttons

## User Stories
- Als Kunde möchte ich einen Kurs direkt aus der Stundenplan-Ansicht heraus buchen können (Abo/Probestunde/Drop-in), ohne erst zur Kursdetailseite (`/kurse/[id]`) wechseln zu müssen.
- Als nicht eingeloggter Besucher möchte ich beim Klick auf „Buchen" zum Login weitergeleitet werden und nach erfolgreichem Login wieder auf `/stundenplan` landen.
- Als Kunde mit bereits aktivem Abo für einen Kurs möchte ich dort keinen zusätzlichen Buchen-Button sehen, da ich schon Teilnehmer bin — ich sehe stattdessen den Self-Check-In-Button (PROJ-25).
- Als Kunde möchte ich bei einem ausgebuchten Kurs direkt auf der Stundenplan-Karte erkennen, dass er voll ist, bevor ich den Dialog überhaupt öffne.
- Als Kunde möchte ich, dass eine über den Stundenplan abgeschlossene Buchung sich genauso verhält wie eine über `/kurse` (gleiche Bestätigung, gleiche Sichtbarkeit unter „Meine Buchungen").

## Out of Scope
- **Neue Buchungslogik oder -validierung** — vollständige Wiederverwendung des bestehenden `BookingDialog` samt `createBooking`/`joinWaitlist` aus PROJ-8, keine Änderungen an bestehendem Buchungsverhalten.
- **Verlinkung zur vollständigen Kursdetailseite** (`/kurse/[id]`) von der Stundenplan-Karte aus — bleibt eine mögliche spätere Ergänzung, hier nur der direkte Buchen-Button.
- **Änderung der bestehenden `/kurse`-Seite** — bleibt unverändert bestehen; dies ist ein zusätzlicher, alternativer Zugriffsweg, kein Ersatz.
- **Buchen-Button trotz aktivem Abo** — bewusst ausgeblendet, um die Karte nicht mit zwei Call-to-Actions (Buchen + Self-Check-In) zu überladen; siehe Product Decision.
- **Anzeige für Kurse ohne Wochentermin** — betrifft `/stundenplan` nicht, da dort ohnehin nur Kurse mit hinterlegtem Wochentermin erscheinen (bestehendes PROJ-6-Verhalten).

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein eingeloggter Kunde ohne aktives Abo für einen im Stundenplan angezeigten Kurs, wenn er `/stundenplan` aufruft, dann sieht er bei diesem Kurstermin einen „Buchen"-Button
- [ ] Angenommen der Kunde klickt „Buchen", dann öffnet sich derselbe Buchungsdialog wie auf `/kurse` mit den drei Optionen Abo/Probestunde/Drop-in
- [ ] Angenommen ein nicht eingeloggter Besucher klickt auf „Buchen", dann wird er zum Login weitergeleitet und landet nach erfolgreichem Login wieder auf `/stundenplan`
- [ ] Angenommen ein Kunde hat bereits ein aktives Abo für einen Kurs, dann sieht er bei diesem Kurstermin keinen Buchen-Button
- [ ] Angenommen ein Kurs mit begrenzter Kapazität ist ausgebucht, dann zeigt die Stundenplan-Karte einen „Ausgebucht"-Hinweis, analog zu `/kurse`
- [ ] Angenommen eine Buchung wird über den Stundenplan-Dialog erfolgreich abgeschlossen, dann verhält sie sich identisch zu einer Buchung über `/kurse` (gleiche Bestätigungs-/Wartelisten-Logik, gleiche Sichtbarkeit unter „Meine Buchungen" im Profil)
- [ ] Angenommen ein Kurstermin erscheint an mehreren Wochentagen, dann hat jede Karte ihren eigenen, unabhängig funktionierenden Buchen-Button für denselben Kurs

## Edge Cases
- Kurs ohne Kapazitätsbegrenzung (`max_participants` nicht gesetzt) → nie „Ausgebucht", wie auf `/kurse`
- Kunde hat bereits eine offene Anfrage für den regulären Kurs → Dialog verhält sich identisch zu `/kurse` (bestehende Sperre/Hinweis im Abo-Tab, keine neue Logik nötig)
- Ausgebuchter Kurs mit Warteliste → Dialog zeigt die bestehende Wartelisten-Beitrittsoption (PROJ-12), wie auf `/kurse`
- Kunde pausiert oder kündigt sein Abo für einen Kurs → sobald kein aktives Abo mehr vorliegt, erscheint der Buchen-Button wieder (gleiche „aktives Abo"-Logik wie in PROJ-25 bereits verwendet)

## Technical Requirements (optional)
- Datenkonsistenz: Alle für den Buchen-Button und den Dialog nötigen Zustände (Kapazität/„Ausgebucht", offene Anfrage, Wartelisten-Status, aktives Abo) müssen pro Kurs korrekt und aktuell ermittelt werden — keine widersprüchlichen Anzeigen zwischen `/stundenplan` und `/kurse` für denselben Kurs.

## Open Questions
- [ ] Keine offenen Fragen

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Alle drei Buchungsarten (Abo/Probestunde/Drop-in) wie auf `/kurse`, kein reduzierter Umfang | Explizite Nutzerentscheidung — bestehende Logik/Dialog aus PROJ-8 soll eins zu eins wiederverwendet werden, nicht neu gebaut oder vereinfacht | 2026-08-18 |
| Buchen-Button erscheint bei jedem Kurstermin über die ganze Woche, nicht nur „heute" | Konsistent mit dem bestehenden Verhalten auf `/kurse`, wo ebenfalls jederzeit gebucht werden kann; eine Einschränkung auf „heute" würde sich fälschlich an die PROJ-25-Self-Check-In-Logik anlehnen, die hier nicht passt | 2026-08-18 |
| Nicht eingeloggte Besucher werden beim Klick auf „Buchen" zum Login weitergeleitet (mit Rücksprung zu `/stundenplan`) | Konsistent mit dem bestehenden `/kurse`-Muster, kein neuer Sonderfall | 2026-08-18 |
| Buchen-Button wird ausgeblendet, wenn der Kunde bereits ein aktives Abo für den Kurs hat | Verhindert zwei widersprüchliche Call-to-Actions (Buchen + Self-Check-In, PROJ-25) auf derselben Karte — der Kunde ist bereits Teilnehmer | 2026-08-18 |
| „Ausgebucht"-Hinweis direkt auf der Stundenplan-Karte | Konsistent mit der bestehenden Anzeige auf `/kurse` und dem gleichartigen Muster bei Events (PROJ-14) | 2026-08-18 |
| Keine Verlinkung zur vollständigen Kursdetailseite von der Karte aus | Hält den Umfang auf die eigentliche Anfrage (Schnellbuchung) fokussiert; eine Detailseiten-Verlinkung wäre eine separate, spätere Ergänzung | 2026-08-18 |

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
