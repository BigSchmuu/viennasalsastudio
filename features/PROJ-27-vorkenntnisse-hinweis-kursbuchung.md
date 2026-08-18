# PROJ-27: Vorkenntnisse-Hinweis bei Kursbuchung

## Status: Architected
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
| Neues, optionales Textfeld direkt an der bestehenden Kurs-Tabelle (PROJ-3), keine neue Tabelle | Der Hinweis ist einfach ein weiteres Attribut eines Kurses, genau wie Name oder Preis — eine eigene Tabelle wäre unnötige Komplexität für ein einzelnes optionales Feld | 2026-08-18 |
| Die Bestätigung selbst wird nicht dauerhaft gespeichert — nur im Moment der Buchung serverseitig geprüft | Laut Spec keine Audit-Anforderung („wer hat wann bestätigt") — die serverseitige Prüfung reicht aus, um zu verhindern, dass eine Buchung ohne Bestätigung durchgeht, ohne zusätzliche Datenhaltung | 2026-08-18 |
| Bestehende Buchungslogik (PROJ-8) wird um eine zusätzliche Pflichtprüfung erweitert, kein separater neuer Buchungsweg | Genau wie andere Pflichtfelder dort (z.B. gewähltes Datum) bereits serverseitig geprüft werden — konsistentes, etabliertes Muster statt einer komplett neuen Prüf-Logik | 2026-08-18 |
| Der Hinweistext wird in die ohnehin schon bestehenden Kurs-Abfragen auf Kurskatalog, Stundenplan und im Buchungsdialog mit aufgenommen, keine neue eigene Abfrage | Diese drei Stellen laden bereits alle anderen Kursdaten (Name, Preis, Level, ...) — der neue Hinweistext ist einfach ein weiteres Feld derselben Abfrage | 2026-08-18 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Component Structure (Visual Tree)

```
Admin-Kursformular (bestehend, PROJ-3) — erweitert
+-- NEU: Feld „Vorkenntnisse-Hinweis" (optional, Freitext)

Kurskarte (bestehend — Kurskatalog PROJ-5, Stundenplan PROJ-6/PROJ-26) — erweitert
+-- NEU: Hinweis-Anzeige auf der Karte, ausschließlich wenn ein Text hinterlegt ist

Buchungsdialog (bestehend, PROJ-8, wiederverwendet von /kurse UND /stundenplan) — erweitert
+-- NEU (nur wenn Hinweis vorhanden, bei allen drei Tabs Anmeldung/Probestunde/Drop-in):
    +-- Info-Anzeige mit dem Admin-Hinweistext
    +-- Bestätigungs-Checkbox mit festem Text
    +-- Absenden-Button bleibt gesperrt, bis die Checkbox aktiviert ist
```

### B) Data Model (plain language)

- Jeder Kurs bekommt ein neues, optionales Feld „Vorkenntnisse-Hinweis" (Freitext). Leer = kein Hinweis, komplett unsichtbares Feature für diesen Kurs.
- Die Bestätigung selbst wird nicht gespeichert — es gibt keinen neuen Datensatz „Kunde X hat am Datum Y bestätigt". Die Prüfung passiert einmalig im Moment der Buchung: Hat der Kurs einen Hinweis, muss die Buchungsanfrage eine Bestätigung mitschicken, sonst wird sie abgelehnt.

### C) Tech Decisions (justified for PM)

- **Ein weiteres Feld an der bestehenden Kurs-Tabelle statt einer neuen Tabelle**: Der Hinweis gehört inhaltlich zum Kurs, genau wie Name, Level oder Preis — technisch am selben Ort abgelegt wie diese, keine zusätzliche Struktur nötig.
- **Keine dauerhafte Speicherung der Bestätigung**: Die Spec verlangt keine Nachverfolgung, wer wann bestätigt hat — nur, dass ohne Bestätigung keine Buchung zustande kommt. Das lässt sich als reine Prüfung im Moment der Buchung lösen, ohne zusätzliche Datenhaltung.
- **Serverseitige Pflichtprüfung nach demselben Muster wie bestehende Pflichtfelder**: Der bestehende Buchungsweg (PROJ-8) prüft bereits heute z.B., ob ein Termin gewählt wurde, bevor er eine Buchung akzeptiert. Die neue Bestätigung wird nach demselben Muster ergänzt — kein neuer, eigenständiger Prüfmechanismus.
- **Wiederverwendung bestehender Abfragen statt neuer eigener Abfrage**: Kurskatalog, Stundenplan und Buchungsdialog laden schon heute alle Kursdaten in einem Rutsch — der neue Hinweistext wird dort einfach als zusätzliches Feld mitgeladen.

### D) Dependencies (packages to install)
- Keine neuen Pakete.

### Voraussetzung vor `/deploy`
Keine neuen externen Dienste oder Umgebungsvariablen.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
