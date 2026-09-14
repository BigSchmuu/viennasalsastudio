# PROJ-54: Event-Serien (regelmäßige Veranstaltungen)

## Status: Planned
**Created:** 2026-09-14
**Last Updated:** 2026-09-14

## Dependencies
- Requires: PROJ-53 (Veranstaltungsprogramm) — Eventarten, Verkaufsart, Bereich „Regelmäßig" in der Übersicht
- Requires: PROJ-51 (Kurszeiträume, Umwandlung und Ferien) — Studioferien
- Requires: PROJ-14 (Events & Workshops) — Ticketkauf, QR-Check-in
- Requires: PROJ-16 (Benachrichtigungen) — Absage und Verlegung einzelner Termine an Ticket-Inhaber

## User Stories
- Als Admin möchte ich eine regelmäßige Party einmal als Serie anlegen (z. B. „jeden Freitag 21:00" oder „jeden 1. Samstag im Monat"), damit ich nicht jeden Termin einzeln pflegen muss.
- Als Admin möchte ich einzelne Termine einer Serie absagen oder verlegen (andere Uhrzeit, anderes Datum, anderer Ort), ohne die ganze Serie zu ändern.
- Als Admin möchte ich pro Serie festlegen, ob sie in den Studioferien pausiert.
- Als Besucher möchte ich im Programm sehen, wann die regelmäßige Party das nächste Mal stattfindet und welche Termine folgen.
- Als Kunde möchte ich bei einer Serie mit Tickets ein Ticket für einen bestimmten Termin kaufen.
- Als Ticket-Inhaber möchte ich benachrichtigt werden, wenn mein Termin abgesagt oder verlegt wird.

## Out of Scope
- **Mehrfachkarten, Saisonkarten oder ein Party-Abo** über mehrere Termine
- **Andere Rhythmen** als wöchentlich und monatlich am n-ten Wochentag (siehe Open Questions)
- **Unterschiedliche Preise je Termin** — eine Serie hat einheitliche Preise
- **Eigene Bilder je Termin** — eine Serie teilt ihre Bilder (PROJ-55)
- **Ferien einzelner Locations** — es zählen nur die Studioferien
- **Warteliste** — bleibt ausgeschlossen

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Serie anlegen und ändern
- [ ] Angenommen ein Admin legt eine Serie an, dann gibt er Name, Eventart, Rhythmus (wöchentlich an einem Wochentag oder monatlich am n-ten Wochentag), Uhrzeit von–bis, Ort, Beschreibung, Preise, Verkaufsart, den ersten Termin und optional ein Ende der Serie an
- [ ] Angenommen eine Serie ist gespeichert, dann erscheinen ihre kommenden Termine automatisch im Programm, ohne dass einzelne Termine angelegt werden
- [ ] Angenommen eine Serie hat ein Ende, dann gibt es danach keine Termine mehr, und nach dem letzten Termin verschwindet sie aus dem Programm
- [ ] Angenommen ein Admin ändert Rhythmus, Uhrzeit oder Ort der Serie, dann gilt das für alle künftigen Termine; betroffene Termine mit verkauften Tickets zeigt die App vor dem Speichern an, und deren Ticket-Inhaber werden wie bei einer Verlegung benachrichtigt
- [ ] Angenommen ein Admin beendet eine Serie, deren künftige Termine Tickets haben, dann nennt die App vor dem Bestätigen die Zahl der betroffenen Tickets, und nach dem Bestätigen werden deren Inhaber benachrichtigt

### Einzelne Termine
- [ ] Angenommen ein Admin sagt einen einzelnen Termin ab, dann erscheint dieser Termin in der Terminliste der Serie als „Fällt aus", alle anderen Termine bleiben unverändert
- [ ] Angenommen der abgesagte Termin hatte verkaufte Tickets, dann gelten diese als storniert, und ihre Inhaber werden benachrichtigt (Event-Tickets-Benachrichtigung)
- [ ] Angenommen ein Admin verlegt einen einzelnen Termin (Datum, Uhrzeit oder Ort), dann zeigt das Programm den geänderten Termin mit dem Hinweis „Geändert", und Ticket-Inhaber werden benachrichtigt
- [ ] Angenommen ein Admin nimmt eine Absage zurück, bevor der Termin stattgefunden hat, dann erscheint der Termin wieder regulär
- [ ] Angenommen ein Termin wurde verlegt, dann darf ein Ticket-Inhaber sein Ticket unabhängig von der Stornofrist stornieren

### Studioferien
- [ ] Angenommen eine Serie ist auf „In Studioferien pausieren" gestellt, dann entfallen ihre Termine in den Studioferien automatisch, und das Programm zeigt bei der Serie „Ferienpause bis …", solange der nächste reguläre Termin in die Ferien fällt
- [ ] Angenommen eine Serie ist nicht auf Ferienpause gestellt, dann finden ihre Termine auch in den Studioferien statt
- [ ] Angenommen Studioferien werden nachträglich eingetragen und betreffen einen Termin mit verkauften Tickets, dann bleibt dieser Termin bestehen, und der Admin sieht einen Hinweis, dass er ihn ausdrücklich absagen muss

### Programm
- [ ] Angenommen ein Besucher öffnet die Übersicht, dann steht jede Serie im Bereich „Regelmäßig" mit dem Rhythmus in Worten (z. B. „Jeden Freitag, 21:00–02:00"), dem nächsten stattfindenden Termin und dem Ort
- [ ] Angenommen ein Besucher öffnet die Eventseite einer Serie, dann sieht er die kommenden Termine, einschließlich „Fällt aus" und „Geändert"
- [ ] Angenommen ein Besucher filtert nach Eventart, dann gilt der Filter auch für Serien
- [ ] Angenommen die Seite wird auf Englisch aufgerufen, dann erscheint auch der Rhythmus auf Englisch (z. B. „Every Friday")

### Tickets bei Serien
- [ ] Angenommen eine Serie verkauft Tickets in der App, dann wählt der Kunde beim Kauf einen Termin, und die Kapazität gilt je Termin
- [ ] Angenommen ein Termin ist ausgebucht, dann ist nur dieser Termin nicht mehr kaufbar, die anderen bleiben es
- [ ] Angenommen ein Kunde hat ein Ticket für einen Serientermin, dann nennen „Meine Tickets", die Bestätigung und der QR-Code Datum und Uhrzeit genau dieses Termins
- [ ] Angenommen ein Ticket wird an einem anderen Termin der Serie gescannt, dann wird der Check-in abgelehnt, mit Hinweis auf den richtigen Termin

## Edge Cases
- Ein Monat hat den gewählten Wochentag nicht (z. B. einen 5. Samstag) → in diesem Monat gibt es keinen Termin
- Eine Party geht über Mitternacht (21:00–02:00) → der Termin gehört zum Starttag, das Ende liegt am Folgetag
- Sommer-/Winterzeit-Umstellung → eine Party um 21:00 bleibt 21:00 Wiener Zeit
- Ein Einzeltermin wird auf ein Datum verlegt, an dem die Serie bereits einen Termin hat → Validierungsfehler
- Studioferien werden wieder gelöscht → die betroffenen Termine erscheinen wieder, außer sie wurden einzeln abgesagt
- Der erste Termin einer neuen Serie liegt in der Vergangenheit → vergangene Termine erscheinen nicht, die Serie beginnt mit dem nächsten künftigen Termin
- Ein Kunde kauft ein Ticket, danach wird der Termin verlegt → das Ticket gilt für den neuen Zeitpunkt, der Kunde darf stornieren
- Zwei Kunden kaufen gleichzeitig den letzten Platz eines Termins → nur einer bekommt ihn (wie PROJ-14)
- Eine Serie steht auf „Nur anzeigen" → keine Kapazität, kein Kauf, Termine erscheinen nur im Programm

## Technical Requirements (optional)
- Alle Zeiten in Wiener Zeit (Europe/Vienna), einschließlich Sommer-/Winterzeit
- Kapazitätsprüfung je Termin race-condition-sicher (wie PROJ-14)
- Benachrichtigungen über die bestehende Gruppe „Event-Tickets" (PROJ-16)

## Open Questions
- [ ] Welche Monatsrhythmen braucht es: 1. bis 4. Wochentag, zusätzlich „letzter Freitag im Monat"? Braucht es auch „alle zwei Wochen"?
- [ ] Wie weit im Voraus sind Serientermine sichtbar und kaufbar? Vorschlag: 8 Wochen

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Regelmäßige Veranstaltungen als Serie mit Rhythmus, nicht als Einzeltermine | Betreiberentscheidung — einmal anlegen statt jeden Termin neu | 2026-09-14 |
| Einzelne Termine lassen sich absagen und verlegen, ohne die Serie zu ändern | Betreiberentscheidung — Ausfälle und Sondertermine kommen vor | 2026-09-14 |
| Ferienpause pro Serie wählbar | Betreiberentscheidung — manche Partys laufen auch in den Ferien weiter | 2026-09-14 |
| Tickets und Kapazität gelten je Termin | Folgt aus der Entscheidung für Serien mit Tickets | 2026-09-14 |
| Abgesagte Termine bleiben in der Terminliste als „Fällt aus" sichtbar | Stammgäste sollen den Ausfall sehen, statt zu rätseln | 2026-09-14 (Vorschlag) |
| Nachträglich eingetragene Ferien sagen Termine mit verkauften Tickets nicht automatisch ab | Eine Absage mit Folgen für zahlende Gäste braucht eine bewusste Entscheidung | 2026-09-14 (Vorschlag) |
| Nach einer Verlegung darf der Kunde unabhängig von der Stornofrist stornieren | Er hat für den ursprünglichen Termin gekauft | 2026-09-14 (Vorschlag) |

### Technical Decisions
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
