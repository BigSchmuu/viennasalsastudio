# PROJ-53: Veranstaltungsprogramm

## Status: Planned
**Created:** 2026-09-14
**Last Updated:** 2026-09-14

## Dependencies
- Requires: PROJ-14 (Events & Workshops) — baut auf Events, Ticketkauf und Check-in auf
- Requires: PROJ-3 (Admin: Stammdaten) — Eventarten werden im selben Muster gepflegt wie Tanzstile und Levels
- Requires: PROJ-43 (Englische Sprachvariante) — Übersicht und Eventseite in beiden Sprachen
- Wird erweitert durch: PROJ-54 (Event-Serien), PROJ-55 (Bilder & Videos), PROJ-56 (Ticketarten & Pässe)

## User Stories
- Als Besucher (auch nicht eingeloggt) möchte ich auf einen Blick sehen, welche regelmäßigen Veranstaltungen und besonderen Events das Studio anbietet, damit ich weiß, wann ich vorbeikommen kann.
- Als Besucher möchte ich das Programm nach Eventart filtern (z. B. nur Partys oder nur Workshops), damit ich schnell finde, was mich interessiert.
- Als Besucher möchte ich zu jedem Event eine eigene Seite mit allen Infos öffnen und ihren Link teilen, damit ich Freunde einladen kann.
- Als Admin möchte ich Eventarten selbst anlegen, umbenennen und entfernen, damit das Programm zu unserem Angebot passt.
- Als Admin möchte ich pro Event festlegen, ob es nur angezeigt wird (Eintritt vor Ort) oder Tickets in der App verkauft, damit Partys ohne Anmeldung und Workshops mit Tickets in derselben Übersicht stehen.
- Als Kunde mit Ticket möchte ich im Programm sehen, dass ich für ein Event schon ein Ticket habe, statt erneut „Ticket kaufen" angeboten zu bekommen.

## Out of Scope
- **Wiederkehrende Termine (Serien)** → PROJ-54. Hier ist jedes Event wie bisher ein Einzeltermin oder zusammenhängender Zeitraum; der Bereich „Regelmäßig" wird erst mit PROJ-54 befüllt.
- **Bilder und Videos** → PROJ-55
- **Ticketarten, Pässe, Einheiten, Zahlungsarten und Stornofrist pro Event** → PROJ-56
- **Eventarten mit eigenen Feldern** (z. B. Reise mit Unterkunft) — alle Arten haben dieselben Felder
- **Kalenderansicht** — bewusst zugunsten der Listen-Übersicht verworfen
- **Archiv vergangener Events** und Freitextsuche
- **Warteliste** — bleibt ausgeschlossen (siehe PROJ-14)

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Eventarten (Admin)
- [ ] Angenommen ein Admin legt eine Eventart mit Namen an, dann steht sie beim Anlegen und Bearbeiten eines Events zur Auswahl
- [ ] Angenommen ein Admin benennt eine Eventart um, dann erscheint der neue Name bei allen zugeordneten Events, im Filter und auf den Eventseiten
- [ ] Angenommen eine Eventart ist noch Events zugeordnet, wenn der Admin sie entfernen will, dann wird das verhindert und angezeigt, wie viele Events sie noch nutzen
- [ ] Angenommen ein Admin speichert ein Event ohne Eventart, dann erscheint ein Validierungsfehler — jedes Event hat genau eine Art

### Verkaufsart (Admin)
- [ ] Angenommen ein Admin legt ein Event an, dann wählt er „Nur anzeigen" oder „Tickets in der App"; vorausgewählt ist „Tickets in der App"
- [ ] Angenommen ein Event steht auf „Nur anzeigen", dann sind Kapazität und Preise optional, und es kann kein Ticket gekauft werden
- [ ] Angenommen für ein Event wurden bereits Tickets verkauft, wenn der Admin es auf „Nur anzeigen" umstellen will, dann wird das verhindert, mit Hinweis auf die Zahl der verkauften Tickets

### Übersicht (öffentlich)
- [ ] Angenommen ein Besucher öffnet die Event-Übersicht, dann sieht er den Bereich „Regelmäßig" (Serien, ab PROJ-54) und darunter „Besondere Events" mit allen kommenden, nicht abgesagten Einzelevents, nach Beginn aufsteigend sortiert
- [ ] Angenommen es gibt keine regelmäßigen Veranstaltungen, dann entfällt der Bereich „Regelmäßig" ganz — keine leere Überschrift
- [ ] Angenommen ein Besucher wählt im Filter eine Eventart, dann zeigen beide Bereiche nur Events dieser Art, und die Auswahl steht in der Adresse, sodass ein geteilter Link denselben Filter öffnet
- [ ] Angenommen der Filter bietet Eventarten an, dann nur solche, zu denen es kommende Events gibt
- [ ] Angenommen ein Filter liefert keine Events, dann erscheint ein Hinweis mit einem Knopf, der den Filter zurücksetzt
- [ ] Angenommen es gibt überhaupt keine kommenden Events, dann erscheint ein freundlicher Leerzustand
- [ ] Angenommen ein Besucher sieht eine Event-Karte, dann zeigt sie Eventart, Name, Termin, Ort, Preis und bei „Tickets in der App" die Verfügbarkeit („noch X Plätze" oder „Ausgebucht"), eine gekürzte Beschreibung, und ein Tipp auf die Karte öffnet die Eventseite
- [ ] Angenommen ein Event liegt an einem Tag, dann zeigt die Karte Datum und Uhrzeit von–bis (falls ein Ende gesetzt ist); liegt es über mehrere Tage, dann den Zeitraum von–bis
- [ ] Angenommen ein Event steht auf „Nur anzeigen", dann zeigt die Karte statt der Verfügbarkeit „Eintritt vor Ort" und keinen Kauf-Knopf
- [ ] Angenommen ein Event hat bereits begonnen, dann bleibt es bis zu seinem Ende im Programm sichtbar; der Ticketkauf endet mit dem Beginn

### Eventseite (öffentlich)
- [ ] Angenommen ein Besucher öffnet die Eventseite, dann sieht er Name, Eventart, Termin bzw. Zeitraum, Ort, die vollständige Beschreibung mit ihren Absätzen, die Preise und je nach Verkaufsart den Kauf-Knopf oder „Eintritt vor Ort"
- [ ] Angenommen ein Besucher teilt den Link der Eventseite, dann öffnet er ohne Login dieselbe Seite, und die Link-Vorschau (z. B. in WhatsApp) zeigt Eventname und Termin
- [ ] Angenommen ein Event ist abgesagt oder vorbei, wenn jemand seine Eventseite öffnet, dann sieht er den Hinweis „Abgesagt" bzw. „Hat bereits stattgefunden" statt eines Kauf-Knopfs — kein „Seite nicht gefunden", damit geteilte Links nicht ins Leere führen
- [ ] Angenommen ein nicht eingeloggter Besucher tippt „Zum Kaufen einloggen", dann kehrt er nach dem Login auf dieselbe Eventseite in seiner Sprache zurück
- [ ] Angenommen ein eingeloggter Kunde hat für das Event bereits ein gültiges Ticket, dann zeigen Karte und Eventseite „Du hast ein Ticket" mit einem Link zum Ticket statt „Ticket kaufen"
- [ ] Angenommen die Seite wird auf Englisch aufgerufen, dann sind alle festen Texte englisch; Eventname und Beschreibung erscheinen so, wie der Admin sie eingegeben hat

## Edge Cases
- Eine Eventart wird umbenannt, nachdem jemand einen gefilterten Link geteilt hat → der Link zeigt weiterhin die richtige Art
- Eine Eventart hat nur vergangene oder abgesagte Events → sie erscheint nicht im Filter
- Ein Event hat keinen Ort → die Karte zeigt keine leere Ortszeile
- Ein Event hat eine sehr lange Beschreibung → die Karte kürzt sie, die Eventseite zeigt sie vollständig
- Jemand öffnet die Adresse eines Events, das es nicht gibt → „Seite nicht gefunden"
- Ein Event steht auf „Nur anzeigen" und hat keinen Preis → die Karte zeigt keine Preiszeile
- Ein Admin stellt ein Event ohne verkaufte Tickets von „Tickets in der App" auf „Nur anzeigen" → erlaubt, der Kauf-Knopf verschwindet sofort
- Ein Event ist ausgebucht, und ein Kunde storniert → die Verfügbarkeit wird sofort wieder angezeigt (wie PROJ-14)
- Bestehende Events aus der Testphase haben keine Eventart → sie werden beim Umbau einer Art zugeordnet (in Produktion gibt es nur Testdaten)

## Technical Requirements (optional)
- Übersicht und Eventseiten öffentlich ohne Login, in Deutsch und Englisch (PROJ-43)
- Jede Eventseite hat eine dauerhafte, teilbare Adresse
- Mobile first (375 px), Touch-Ziele mindestens 44 px
- Öffentliche Seiten zeigen keine personenbezogenen Daten; die Belegung erscheint nur als Zahl

## Open Questions
- [ ] Werden Eventarten-Namen zweisprachig (Deutsch/Englisch) gepflegt oder einsprachig wie Eventnamen?
- [ ] Soll die Eventseite eine sprechende Adresse haben (z. B. `/events/salsa-workshop-oktober`) oder genügt eine technische Kennung?
- [ ] Soll das Programm zusätzlich an anderer Stelle erscheinen, z. B. „Nächste Events" auf der Startseite oder in „Mein Bereich"?

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Aus „Events mit Tickets" wird ein Veranstaltungsprogramm | Betreiber: Kunden sollen vor allem sehen, welche Veranstaltungen das Studio anbietet — wöchentliche und monatliche Party, Workshops und mehr | 2026-09-14 |
| Aufteilung in PROJ-53 bis PROJ-56, Reihenfolge Programm → Serien → Bilder & Videos → Ticketarten | Die Übersicht war das wichtigste Ziel; nach PROJ-53 und PROJ-54 stehen die Partys als Programm online | 2026-09-14 |
| Eventarten als Liste im Admin, alle Arten mit denselben Feldern | Betreiberentscheidung — flexibel ohne Code-Änderung; eigene Felder je Art wären deutlich mehr Aufwand | 2026-09-14 |
| Verkaufsart pro Event: „Nur anzeigen" oder „Tickets in der App" | Betreiberentscheidung — Partys meist mit Eintritt an der Abendkasse, Workshops mit Tickets, beides in einer Verwaltung | 2026-09-14 |
| Übersicht: „Regelmäßig" oben, „Besondere Events" nach Datum darunter, Filter nach Eventart | Betreiberentscheidung — das Dauerangebot steht vorn, einmalige Events gehen nicht darin unter | 2026-09-14 |
| Eigene, teilbare Seite pro Event | Betreiberentscheidung — Events werden weitergeleitet und geteilt | 2026-09-14 |
| Abgesagte und vergangene Events zeigen auf ihrer Seite einen Hinweis statt „nicht gefunden" | Geteilte Links sollen nicht ins Leere führen | 2026-09-14 (Vorschlag) |
| Vorauswahl beim Anlegen: „Tickets in der App" | Entspricht dem bisherigen Verhalten | 2026-09-14 (Vorschlag) |
| Events bleiben bis zu ihrem Ende im Programm, der Kauf endet mit dem Beginn | Wer während einer laufenden Party nachsieht, soll sie finden | 2026-09-14 (Vorschlag) |
| Kunden mit Ticket sehen „Du hast ein Ticket" statt „Ticket kaufen" | Gleiches Prinzip wie der Buchungsknopf bei Kursen (PROJ-8/26) | 2026-09-14 (Vorschlag) |
| Umbau ohne Datenübernahme echter Tickets | In der Produktion gibt es nur Test-Events | 2026-09-14 |

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
