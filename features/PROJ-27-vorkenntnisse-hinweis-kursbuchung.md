# PROJ-27: Vorkenntnisse-Hinweis bei Kursbuchung

## Status: Planned
**Created:** 2026-08-18
**Last Updated:** 2026-08-18

## Dependencies
- Requires: PROJ-3 (Admin: Kurse, Levels, Locations & Tanzstile verwalten) — der neue Hinweis-Text wird im bestehenden Kurs-Formular gepflegt
- Requires: PROJ-8 (Kursbuchung) — die neue Bestätigungs-Checkbox erscheint im bestehenden `BookingDialog`
- Requires: PROJ-5 (Kurskatalog) — der Hinweis wird zusätzlich auf der Kurskarte in `/kurse` angezeigt
- Requires: PROJ-6 (Stundenplan & Kalender) / PROJ-26 (Kursbuchung von /stundenplan aus) — derselbe `BookingDialog` wird dort ebenfalls wiederverwendet, Checkbox und Hinweis erscheinen automatisch auch dort

## User Stories
- Als Admin möchte ich bei einem Kurs einen freien Hinweistext hinterlegen können (z.B. „Baut auf Salsa Beginner 1 auf"), damit Kunden vor der Buchung über empfohlene Vorkenntnisse informiert sind.
- Als Besucher möchte ich diesen Hinweis schon beim Durchstöbern des Kurskatalogs auf der Kurskarte sehen, nicht erst wenn ich den Buchungsdialog öffne.
- Als Kunde möchte ich beim Buchen aktiv bestätigen müssen, dass ich die genannte Voraussetzung erfülle, bevor ich die Buchung abschließen kann — bei allen drei Buchungsarten (Anmeldung, Probestunde, Drop-in).
- Als Admin möchte ich für Kurse ohne besondere Voraussetzungen (die meisten) keinerlei zusätzlichen Schritt sehen — der Hinweis ist rein optional.

## Out of Scope
- **Automatische Prüfung gegen Anwesenheits- oder Buchungshistorie** — es wird nicht technisch geprüft, ob der Kunde den Vorgänger-Kurs tatsächlich besucht hat. Reine Selbstbestätigung per Checkbox. Eine echte Verifizierung wäre ein separates, deutlich aufwändigeres Feature.
- **Strukturierte Verknüpfung zwischen Kursen** (z.B. „Beginner 2 hat als Vorgänger-Kurs Beginner 1") — der Hinweis bleibt bewusst freier Text, keine Kurs-zu-Kurs-Relation im Datenmodell. Wurde im Vorgespräch als Alternative erwogen, aber verworfen, da keine automatische Prüfung gewünscht ist.
- **Rückwirkende Bestätigung für bereits bestehende Buchungen/Abos** — der Hinweis gilt nur für neue Buchungsversuche ab dem Zeitpunkt, an dem der Admin ihn hinterlegt; bestehende Kunden werden nicht nachträglich zur Bestätigung aufgefordert.
- **Mehrsprachigkeit oder strukturierte Voraussetzungs-Kategorien** — einfacher Freitext reicht für den beschriebenen Anwendungsfall.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Admin bearbeitet einen Kurs, wenn er im Kurs-Formular einen Vorkenntnisse-Hinweis einträgt und speichert, dann wird dieser Text dem Kurs zugeordnet
- [ ] Angenommen ein Kurs hat einen Vorkenntnisse-Hinweis hinterlegt, wenn ein Besucher die Kurskarte auf `/kurse` oder `/stundenplan` sieht, dann wird der Hinweistext sichtbar auf der Karte angezeigt
- [ ] Angenommen ein Kurs hat KEINEN Vorkenntnisse-Hinweis hinterlegt, dann erscheint weder auf der Kurskarte noch im Buchungsdialog irgendein zusätzlicher Hinweis oder eine zusätzliche Checkbox
- [ ] Angenommen ein Kunde öffnet den Buchungsdialog für einen Kurs mit Vorkenntnisse-Hinweis, dann sieht er den Hinweistext sowie eine Checkbox mit einem festen Bestätigungssatz, unabhängig davon, welchen der drei Tabs (Anmeldung/Probestunde/Drop-in) er wählt
- [ ] Angenommen die Checkbox ist nicht aktiviert, wenn der Kunde versucht abzusenden, dann bleibt der Absenden-Button deaktiviert bzw. die Buchung wird verhindert
- [ ] Angenommen der Kunde aktiviert die Checkbox, dann kann er die Buchung wie gewohnt abschließen (identisches Verhalten zu einer Buchung ohne Hinweis, abgesehen von der zusätzlichen Bestätigung)
- [ ] Angenommen ein Admin entfernt einen zuvor gesetzten Vorkenntnisse-Hinweis wieder, dann verschwindet die Checkbox und der Hinweis bei allen zukünftigen Buchungsversuchen für diesen Kurs

## Edge Cases
- Kurs ohne Vorkenntnisse-Hinweis (die meisten Kurse) → keine Änderung am bestehenden Buchungsablauf, keine Checkbox
- Admin ändert den Hinweistext nachträglich → gilt sofort für neue Buchungsversuche; bereits bestehende Buchungen/Abos werden nicht rückwirkend berührt
- Sehr langer Hinweistext → wird wie andere Freitextfelder im Admin-Bereich auf eine sinnvolle Zeichenzahl begrenzt
- Kunde bucht über `/stundenplan` (PROJ-26) statt `/kurse` → identisches Verhalten, da derselbe Buchungsdialog wiederverwendet wird

## Technical Requirements (optional)
- Validierung: Checkbox-Bestätigung wird serverseitig durchgesetzt (nicht nur der Absenden-Button clientseitig deaktiviert) — eine Buchungsanfrage ohne Bestätigung bei einem Kurs mit Vorkenntnisse-Hinweis darf nicht durchgehen, selbst bei direktem API-Aufruf unter Umgehung der Oberfläche.

## Open Questions
- [ ] Keine offenen Fragen

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Reine Selbstbestätigung per Checkbox, keine automatische Prüfung gegen Anwesenheits-/Buchungshistorie | Explizite Nutzerentscheidung — der Betreiber möchte keine automatische Sperr-Logik, nur eine bewusste Bestätigung durch den Kunden | 2026-08-18 |
| Freier Hinweistext statt strukturierter Kurs-zu-Kurs-Verknüpfung | Da keine automatische Prüfung stattfindet, reicht ein einfaches Textfeld völlig aus — eine formale Vorgänger-Kurs-Relation wäre unnötiger Aufwand für den gewünschten Umfang | 2026-08-18 |
| Checkbox erscheint bei allen drei Buchungsarten (Anmeldung/Probestunde/Drop-in), nicht nur bei der regulären Anmeldung | Explizite Nutzerentscheidung, gegen die ursprüngliche Empfehlung (nur Anmeldung) — konsistentes Verhalten über alle Buchungswege hinweg gewünscht | 2026-08-18 |
| Hinweis erscheint zusätzlich sichtbar auf der Kurskarte (nicht nur im Buchungsdialog) | Adressiert den ursprünglichen Wunsch, die Kursfolge „deutlicher zu machen" — der Kunde soll den Hinweis schon beim Durchstöbern sehen, nicht erst im Buchungsmoment | 2026-08-18 |
| Checkbox hat einen festen, immer gleichen Bestätigungssatz; der Admin-Hinweistext wird separat als Info angezeigt | Admin muss keine perfekt formulierten Ich-Bestätigungssätze schreiben, nur eine kurze Beschreibung der Voraussetzung — reduziert Fehlerquellen bei der Eingabe | 2026-08-18 |
| Kein rückwirkender Effekt auf bestehende Buchungen/Abos | Der Hinweis ist ein Vorab-Check für neue Buchungsentscheidungen, keine nachträgliche Kontrolle bestehender Teilnehmer | 2026-08-18 |

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
