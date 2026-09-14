# PROJ-53: Veranstaltungsprogramm

## Status: In Review
**Created:** 2026-09-14
**Last Updated:** 2026-09-14

## Dependencies
- Requires: PROJ-14 (Events & Workshops) — baut auf Events, Ticketkauf und Check-in auf
- Requires: PROJ-3 (Admin: Stammdaten) — Eventarten werden im selben Muster gepflegt wie Tanzstile und Levels
- Requires: PROJ-43 (Englische Sprachvariante) — Übersicht und Eventseite in beiden Sprachen
- Requires: PROJ-45 (Kunden-Dashboard) — Abschnitt „Diese Woche im Studio" in „Mein Bereich" wird erweitert
- Wird erweitert durch: PROJ-54 (Event-Serien), PROJ-55 (Bilder & Videos), PROJ-56 (Ticketarten & Pässe)

## User Stories
- Als Besucher (auch nicht eingeloggt) möchte ich auf einen Blick sehen, welche regelmäßigen Veranstaltungen und besonderen Events das Studio anbietet, damit ich weiß, wann ich vorbeikommen kann.
- Als Besucher möchte ich das Programm nach Eventart filtern (z. B. nur Partys oder nur Workshops), damit ich schnell finde, was mich interessiert.
- Als Besucher möchte ich zu jedem Event eine eigene Seite mit allen Infos öffnen und ihren Link teilen, damit ich Freunde einladen kann.
- Als Interessent möchte ich Events des Studios über Google finden, damit ich auch ohne die App zu kennen davon erfahre.
- Als Admin möchte ich Eventarten selbst anlegen, umbenennen und entfernen, damit das Programm zu unserem Angebot passt.
- Als Admin möchte ich pro Event festlegen, ob es nur angezeigt wird (Eintritt vor Ort) oder Tickets in der App verkauft, damit Partys ohne Anmeldung und Workshops mit Tickets in derselben Übersicht stehen.
- Als Kunde möchte ich in „Mein Bereich" die nächsten Events sehen und direkt dorthin gelangen, und dabei erkennen, wofür ich schon ein Ticket habe.

## Out of Scope
- **Wiederkehrende Termine (Serien)** → PROJ-54. Hier ist jedes Event wie bisher ein Einzeltermin oder zusammenhängender Zeitraum; der Bereich „Regelmäßig" wird erst mit PROJ-54 befüllt.
- **Bilder und Videos** → PROJ-55
- **Ticketarten, Pässe, Einheiten, Zahlungsarten und Stornofrist pro Event** → PROJ-56
- **Sitemap, robots.txt und die Verknüpfung von deutscher und englischer Seite für Suchmaschinen** → PROJ-57, für alle öffentlichen Seiten (auch Kurse und Stundenplan)
- **Programm auf der Startseite** — nur in „Mein Bereich"
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
- [ ] Angenommen die Seite wird auf Englisch aufgerufen, dann erscheinen Eventarten mit demselben Namen wie auf Deutsch

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
- [ ] Angenommen ein Event hat bereits begonnen, dann bleibt es bis zu seinem Ende im Programm, und Tickets sind bis zum Ende kaufbar; ohne gesetztes Ende gilt das Ende des Veranstaltungstags (Wiener Zeit)

### Eventseite (öffentlich)
- [ ] Angenommen ein Besucher öffnet die Eventseite, dann sieht er Name, Eventart, Termin bzw. Zeitraum, Ort, die vollständige Beschreibung mit ihren Absätzen, die Preise und je nach Verkaufsart den Kauf-Knopf oder „Eintritt vor Ort"
- [ ] Angenommen ein Besucher teilt den Link der Eventseite, dann öffnet er ohne Login dieselbe Seite, und die Link-Vorschau (z. B. in WhatsApp) zeigt Eventname und Termin
- [ ] Angenommen ein Event ist abgesagt oder vorbei, wenn jemand seine Eventseite öffnet, dann sieht er den Hinweis „Abgesagt" bzw. „Hat bereits stattgefunden" statt eines Kauf-Knopfs — kein „Seite nicht gefunden", damit geteilte Links nicht ins Leere führen
- [ ] Angenommen ein nicht eingeloggter Besucher tippt „Zum Kaufen einloggen", dann kehrt er nach dem Login auf dieselbe Eventseite in seiner Sprache zurück
- [ ] Angenommen ein eingeloggter Kunde hat für das Event bereits ein gültiges Ticket, dann zeigen Karte und Eventseite „Du hast ein Ticket" mit einem Link zum Ticket statt „Ticket kaufen"
- [ ] Angenommen die Seite wird auf Englisch aufgerufen, dann sind alle festen Texte englisch; Eventname und Beschreibung erscheinen so, wie der Admin sie eingegeben hat

### Google-Suche
- [ ] Angenommen ein Event wird angelegt, dann bekommt seine Seite eine lesbare Adresse aus dem Eventnamen (z. B. `/events/salsa-workshop-oktober`); ist der Name schon vergeben, wird die Adresse eindeutig ergänzt
- [ ] Angenommen ein Admin benennt ein Event um, dann führen alte Links weiterhin auf die Eventseite, per Weiterleitung auf die neue Adresse
- [ ] Angenommen eine Suchmaschine ruft eine Eventseite auf, dann findet sie einen eigenen Seitentitel und eine Beschreibung des Events sowie strukturierte Event-Daten (Name, Beginn, Ende, Ort, Preis, Verfügbarkeit, Veranstalter), damit Google das Event mit Datum und Ort in der Suche zeigen kann
- [ ] Angenommen ein Event ist abgesagt oder ausgebucht, dann geben die Event-Daten das an
- [ ] Angenommen ein Event steht auf „Nur anzeigen", dann nennen die Event-Daten den Eintrittspreis (falls angegeben) ohne Ticketverkauf in der App

### Mein Bereich
- [ ] Angenommen ein Kunde öffnet „Mein Bereich", dann zeigt der Abschnitt „Diese Woche im Studio" die kommenden Events wie bisher, und ein Tipp auf ein Event öffnet dessen Eventseite
- [ ] Angenommen in dieser Woche findet kein Event statt, dann zeigt der Abschnitt stattdessen die nächsten drei kommenden Events, damit das Programm auch in ruhigen Wochen sichtbar ist
- [ ] Angenommen ein Event steht auf „Nur anzeigen", dann zeigt der Abschnitt „Eintritt vor Ort" statt eines Kauf-Knopfs
- [ ] Angenommen der Kunde hat für ein Event ein Ticket, dann zeigt der Abschnitt das wie bisher an
- [ ] Angenommen „Mein Bereich" wird auf Englisch aufgerufen, dann führt der Link zum ganzen Programm auf die englische Übersicht

## Edge Cases
- Eine Eventart wird umbenannt, nachdem jemand einen gefilterten Link geteilt hat → der Link zeigt weiterhin die richtige Art
- Eine Eventart hat nur vergangene oder abgesagte Events → sie erscheint nicht im Filter
- Ein Event hat keinen Ort → die Karte zeigt keine leere Ortszeile
- Ein Event hat eine sehr lange Beschreibung → die Karte kürzt sie, die Eventseite zeigt sie vollständig
- Jemand öffnet die Adresse eines Events, das es nicht gibt → „Seite nicht gefunden"
- Zwei Events heißen gleich (z. B. zweimal „Salsa Workshop") → beide bekommen unterschiedliche, lesbare Adressen
- Ein Event wird mehrmals umbenannt → alle früheren Adressen führen weiterhin auf die Eventseite
- Ein Event steht auf „Nur anzeigen" und hat keinen Preis → die Karte zeigt keine Preiszeile
- Ein Admin stellt ein Event ohne verkaufte Tickets von „Tickets in der App" auf „Nur anzeigen" → erlaubt, der Kauf-Knopf verschwindet sofort
- Ein Kunde kauft während einer laufenden Veranstaltung ein Ticket → erlaubt; der Kaufdialog sagt, dass das Ticket nicht mehr selbst storniert werden kann, weil die Stornofrist abgelaufen ist
- Ein Event ist ausgebucht, und ein Kunde storniert → die Verfügbarkeit wird sofort wieder angezeigt (wie PROJ-14)
- Bestehende Events aus der Testphase haben keine Eventart und keine lesbare Adresse → sie bekommen beim Umbau beides (in Produktion gibt es nur Testdaten)

## Technical Requirements (optional)
- Übersicht und Eventseiten öffentlich ohne Login, in Deutsch und Englisch (PROJ-43), für Suchmaschinen indexierbar
- Jede Eventseite hat eine dauerhafte, teilbare Adresse
- Mobile first (375 px), Touch-Ziele mindestens 44 px
- Öffentliche Seiten zeigen keine personenbezogenen Daten; die Belegung erscheint nur als Zahl

## Open Questions
- [x] Werden Eventarten-Namen zweisprachig gepflegt? → Nein, ein Name für beide Sprachen; die englische Seite zeigt ihn unverändert (2026-09-14)
- [x] Sprechende Adresse für die Eventseite? → Ja, lesbar mit Weiterleitung nach Umbenennung; dazu Seitentitel, Beschreibung und Event-Daten für Google. Sitemap und DE/EN-Verknüpfung → PROJ-57 (2026-09-14)
- [x] Programm zusätzlich an anderer Stelle? → Ja, in „Mein Bereich" über den bestehenden Abschnitt „Diese Woche im Studio"; nicht auf der Startseite (2026-09-14)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Aus „Events mit Tickets" wird ein Veranstaltungsprogramm | Betreiber: Kunden sollen vor allem sehen, welche Veranstaltungen das Studio anbietet — wöchentliche und monatliche Party, Workshops und mehr | 2026-09-14 |
| Aufteilung in PROJ-53 bis PROJ-56, Reihenfolge Programm → Serien → Bilder & Videos → Ticketarten | Die Übersicht war das wichtigste Ziel; nach PROJ-53 und PROJ-54 stehen die Partys als Programm online | 2026-09-14 |
| Eventarten als Liste im Admin, alle Arten mit denselben Feldern | Betreiberentscheidung — flexibel ohne Code-Änderung; eigene Felder je Art wären deutlich mehr Aufwand | 2026-09-14 |
| Eventarten haben einen Namen für beide Sprachen | Betreiberentscheidung — Namen wie „Party" oder „Workshop" funktionieren auch auf der englischen Seite | 2026-09-14 |
| Verkaufsart pro Event: „Nur anzeigen" oder „Tickets in der App" | Betreiberentscheidung — Partys meist mit Eintritt an der Abendkasse, Workshops mit Tickets, beides in einer Verwaltung | 2026-09-14 |
| Übersicht: „Regelmäßig" oben, „Besondere Events" nach Datum darunter, Filter nach Eventart | Betreiberentscheidung — das Dauerangebot steht vorn, einmalige Events gehen nicht darin unter | 2026-09-14 |
| Eigene, teilbare Seite pro Event mit lesbarer Adresse | Betreiberentscheidung — Events werden weitergeleitet und geteilt; lesbare Links werden eher geklickt | 2026-09-14 |
| Tickets sind bis zum Ende der Veranstaltung kaufbar | Betreiberentscheidung — auch wer später dazukommt, soll noch ein Ticket kaufen können | 2026-09-14 |
| Seitentitel, Beschreibung und Event-Daten für Google in PROJ-53; Sitemap und DE/EN-Verknüpfung als eigenes Feature PROJ-57 | Betreiberentscheidung — Event-Daten bringen für Events am meisten; Sitemap und Sprachverknüpfung betreffen alle öffentlichen Seiten | 2026-09-14 |
| „Mein Bereich" zeigt das Programm im bestehenden Abschnitt „Diese Woche im Studio" | Betreiberentscheidung; ein zweiter Event-Abschnitt würde sich mit dem bestehenden doppeln | 2026-09-14 |
| Abgesagte und vergangene Events zeigen auf ihrer Seite einen Hinweis statt „nicht gefunden" | Geteilte Links sollen nicht ins Leere führen — vorgeschlagen, ohne Einwand übernommen | 2026-09-14 |
| Vorauswahl beim Anlegen: „Tickets in der App" | Entspricht dem bisherigen Verhalten — vorgeschlagen, ohne Einwand übernommen | 2026-09-14 |
| Kunden mit Ticket sehen „Du hast ein Ticket" statt „Ticket kaufen" | Gleiches Prinzip wie der Buchungsknopf bei Kursen (PROJ-8/26) — vorgeschlagen, ohne Einwand übernommen | 2026-09-14 |
| Ist die Woche ohne Event, zeigt „Mein Bereich" die nächsten drei Events | Mitglieder sollen das Programm auch in ruhigen Wochen sehen — vom Betreiber bestätigt | 2026-09-14 |
| Umbau ohne Datenübernahme echter Tickets | In der Produktion gibt es nur Test-Events | 2026-09-14 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Eventarten als eigene Liste nach dem Muster der Tanzstile: für alle lesbar, nur Admins schreiben, Löschen sperrt die Datenbank selbst, solange Events zugeordnet sind | Bewährtes Muster aus PROJ-3; die Sperre gilt auch, wenn jemand die Oberfläche umgeht | 2026-09-14 |
| Kaufgrenze „bis Ende" und die Sperre für „Nur anzeigen" sitzen in der Kauffunktion der Datenbank | Dort wird heute schon geprüft (ab Beginn gesperrt); eine reine Oberflächenprüfung ließe sich umgehen, vgl. PROJ-52 BUG-1 | 2026-09-14 |
| Events ohne Ende gelten bis zum Ende des Veranstaltungstags in Wiener Zeit | Die Datenbank rechnet in UTC — ohne feste Zeitzone endete der Tag im Sommer um 2 Uhr Wiener Zeit | 2026-09-14 |
| Umstellen auf „Nur anzeigen" bei verkauften Tickets verhindert die Datenbank, nicht nur das Formular | Sonst gäbe es gültige Tickets für ein Event ohne Ticketverkauf | 2026-09-14 |
| Lesbare Adresse wird beim Anlegen aus dem Namen erzeugt (Umlaute ausgeschrieben, z. B. „fuer"), in der Datenbank eindeutig; frühere Adressen bleiben in einer eigenen Liste und leiten weiter | Dauerhafte, teilbare Links; eine Umbenennung bricht keinen geteilten Link | 2026-09-14 |
| Dieselbe Adresse für Deutsch und Englisch (`/events/…` und `/en/events/…`) | Eventnamen werden nicht übersetzt; eine Adresse je Event genügt | 2026-09-14 |
| Seitentitel, Beschreibung, Link-Vorschau und Event-Daten nach schema.org werden von der Eventseite serverseitig ausgeliefert; absolute Links aus der bestehenden `NEXT_PUBLIC_SITE_URL` | Suchmaschinen und Messenger lesen nur den ausgelieferten Quelltext; keine neue Bibliothek nötig | 2026-09-14 |
| Belegung sehen Besucher weiter nur über die bestehende Zählfunktion `get_event_occupancy` | Tickets sind per RLS privat; eine direkte Abfrage als Besucher liefert stumm eine leere Liste | 2026-09-14 |
| Eine gemeinsame Status-Regel entscheidet für Karte, Eventseite und „Mein Bereich", was angezeigt wird | Sonst zeigen drei Stellen unterschiedliche Knöpfe — genau das passierte bei den Kursknöpfen (PROJ-8/26) | 2026-09-14 |
| Der Filter steht in der Adresse als Kennung der Eventart, nicht als Name | Geteilte Filter-Links überstehen eine Umbenennung | 2026-09-14 |
| „Du hast ein Ticket" verlinkt auf `/profil#tickets` | Dasselbe Sprunganker-Muster wie `#abo` und `#buchungen` aus „Mein Bereich" | 2026-09-14 |
| Alle Links zu Events laufen über die sprachbewusste Navigation (PROJ-43) | Beheben den Fehler, dass Login-Link und „Alle Events" englische Besucher ins Deutsche zurückwarfen | 2026-09-14 |
| Auslieferung: erst Migration mit Startwerten für bestehende Events, dann Code | Der neue Code liest neue Spalten; im kurzen Zwischenraum sollte kein Event angelegt werden | 2026-09-14 |
| Keine neuen Pakete | Alles mit Next.js, Supabase und vorhandenen shadcn-Bausteinen umsetzbar | 2026-09-14 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
PROJ-53 braucht Frontend **und** Backend: neue und erweiterte Daten in Supabase, eine neue Admin-Seite, eine neue öffentliche Eventseite und Änderungen an drei bestehenden Stellen (Übersicht, Event-Verwaltung, „Mein Bereich"). Es baut auf dem auf, was PROJ-14 schon hat — Kaufdialog, Tickets, Check-in, SEPA-Posten und Benachrichtigungen bleiben unverändert.

### A) Komponentenstruktur

**Öffentliche Übersicht** — `/events` und `/en/events` (bestehend, umgebaut)
```
Event-Übersicht
+-- Kopf (Überschrift, ein Satz zum Programm)
+-- Filter nach Eventart (Auswahlchips; nur Arten mit kommenden Events; Auswahl steht in der Adresse)
+-- Bereich „Regelmäßig" (ohne Serien ausgeblendet; befüllt ab PROJ-54)
+-- Bereich „Besondere Events"
|   +-- Event-Karte (ganze Karte führt zur Eventseite)
|       +-- Eventart, Name, Termin bzw. Zeitraum, Ort, Preis
|       +-- gekürzte Beschreibung
|       +-- Status: Ticket kaufen · Du hast ein Ticket · Ausgebucht · noch X Plätze · Eintritt vor Ort
+-- Leerzustand „keine kommenden Events"
+-- Leerzustand „Filter ohne Treffer" mit Knopf „Filter zurücksetzen"
```

**Eventseite** — `/events/[lesbare-adresse]` und `/en/events/[lesbare-adresse]` (neu)
```
Eventseite
+-- Hinweisband „Abgesagt" oder „Hat bereits stattgefunden" (nur dann)
+-- Kopf: Eventart, Name, Termin bzw. Zeitraum, Ort
+-- Beschreibung mit Absätzen
+-- Kaufbereich
|   +-- Preise (normal / Studierende)
|   +-- Ticket kaufen → bestehender Kaufdialog
|   +-- Zum Kaufen einloggen → Login, danach zurück auf diese Seite in derselben Sprache
|   +-- Du hast ein Ticket → Profil, Abschnitt Tickets
|   +-- Ausgebucht · Eintritt vor Ort
|   +-- Hinweis im Kaufdialog, falls die Stornofrist schon abgelaufen ist
+-- Für Besucher unsichtbar: Seitentitel, Beschreibung, Link-Vorschau, Event-Daten für Google
```
Alte Adressen nach einer Umbenennung leiten auf die aktuelle weiter; unbekannte Adressen zeigen „Seite nicht gefunden".

**Admin: Eventarten** — `/admin/eventarten` (neu, wie `/admin/tanzstile`)
```
Eventarten
+-- Tabelle: Name, Zahl der zugeordneten Events
+-- Anlegen · Umbenennen
+-- Entfernen (Bestätigungsdialog; bei zugeordneten Events abgelehnt mit Hinweis)
```

**Admin: Event-Verwaltung** — `/admin/events` (bestehend, erweitert)
```
Event-Verwaltung
+-- Tabelle: + Spalte Eventart, + Link „Seite ansehen"
+-- Formular „Event anlegen/bearbeiten"
    +-- + Eventart (Pflicht)
    +-- + Verkaufsart: Nur anzeigen / Tickets in der App (vorausgewählt)
    +-- Kapazität und Preise: Pflicht bei „Tickets in der App", sonst optional
    +-- Fehlermeldung, wenn bei verkauften Tickets auf „Nur anzeigen" umgestellt wird
```

**Mein Bereich** — Abschnitt „Diese Woche im Studio" (bestehend, erweitert)
```
Diese Woche im Studio
+-- Events der nächsten 7 Tage — ist das leer: die nächsten drei Events
+-- Zeile führt zur Eventseite
+-- Ticket vorhanden · Ausgebucht · Kaufen · Eintritt vor Ort
+-- „Alle Events" → Übersicht in der aktuellen Sprache
```

**Gemeinsame Status-Regel** (keine sichtbare Komponente): Eine Stelle entscheidet aus Verkaufsart, Beginn/Ende, Belegung, Absage und eigenem Ticket, was Karte, Eventseite und „Mein Bereich" anzeigen — kaufbar, Ticket vorhanden, ausgebucht, nur anzeigen, abgesagt oder vorbei, und ob beim Kauf die Stornofrist schon abgelaufen ist.

### B) Datenmodell (in Worten)

**Eventarten** (neu)
- Kennung, Name (eindeutig, unabhängig von Groß-/Kleinschreibung), Anlagedatum
- Für alle lesbar, nur für Admins änderbar
- Solange Events zugeordnet sind, lässt die Datenbank das Löschen nicht zu

**Events** (bestehend, erweitert)
- Neu: Eventart (Pflicht)
- Neu: Verkaufsart — „nur anzeigen" oder „Tickets in der App"
- Neu: lesbare Adresse (eindeutig)
- Kapazität und Preise sind nur bei „Tickets in der App" Pflicht
- Unverändert: Name, Beschreibung, Ort, Beginn, Ende, Status (geplant/abgesagt)

**Frühere Adressen** (neu)
- Event, frühere Adresse
- Nur für die Weiterleitung alter Links; für alle lesbar, geschrieben beim Umbenennen

**Unverändert:** Tickets, SEPA-Posten, Check-in, Benachrichtigungen

**Bestehende Test-Events** bekommen bei der Migration eine Start-Eventart (z. B. „Workshop", danach umbenennbar), die Verkaufsart „Tickets in der App" und eine lesbare Adresse aus ihrem Namen.

Gespeichert in: Supabase (PostgreSQL) mit Row Level Security auf jeder neuen Tabelle.

### C) Technische Entscheidungen (für den Betreiber erklärt)

- **Eventarten wie Tanzstile.** Dasselbe Muster wie bei Tanzstilen und Levels: eine einfache Liste, eine Admin-Seite, eine Löschsperre, die die Datenbank selbst durchsetzt. Nichts Neues zu lernen, und die Sperre lässt sich nicht umgehen.
- **Die Kaufgrenze gehört in die Datenbank.** Die Kauffunktion prüft heute schon, ob ein Event begonnen hat, und blockiert dann. Genau dort wird „bis Ende" eingestellt, dazu die Sperre für „Nur anzeigen". Eine Prüfung nur im Formular wäre mit einem direkten Aufruf zu umgehen.
- **Wiener Zeit für „Ende des Tages".** Die Datenbank rechnet in UTC. Ohne feste Zeitzone endete ein Veranstaltungstag im Sommer um 2 Uhr früh Wiener Zeit statt um Mitternacht.
- **Lesbare Adressen mit Gedächtnis.** Aus „Salsa-Nacht für Anfänger" wird `salsa-nacht-fuer-anfaenger`. Heißen zwei Events gleich, bekommt das zweite einen Zusatz. Beim Umbenennen merkt sich die App die alte Adresse und leitet sie weiter — geteilte Links in WhatsApp oder Instagram bleiben gültig.
- **Google liest den Quelltext.** Titel, Beschreibung, Link-Vorschau und die Event-Daten (Name, Beginn, Ende, Ort, Preis, Verfügbarkeit, Veranstalter) liefert der Server direkt mit der Seite aus. So sehen Google und Messenger dieselben Angaben wie Besucher, ohne dass eine Zusatzbibliothek nötig ist.
- **Belegung ohne Namen.** Besucher sehen freie Plätze weiter über die bestehende Zählfunktion, die nur Zahlen herausgibt. Tickets selbst bleiben privat.
- **Eine Regel für alle Anzeigen.** Ob „Ticket kaufen", „Du hast ein Ticket" oder „Eintritt vor Ort" erscheint, entscheidet eine gemeinsame Stelle. Bei den Kursknöpfen zeigten zuvor verschiedene Seiten unterschiedliche Zustände; das soll hier gar nicht erst entstehen.
- **Filter-Links überstehen Umbenennungen.** In der Adresse steht die Kennung der Eventart, nicht ihr Name.
- **Sprache bleibt erhalten.** Alle Links zu Events laufen über die sprachbewusste Navigation aus PROJ-43. Das behebt nebenbei, dass „Zum Kaufen einloggen" und „Alle Events" englische Besucher ins Deutsche zurückwarfen.

### D) Abhängigkeiten (Pakete)
Keine neuen Pakete.

### Auswirkungen auf Bestehendes
- **Auslieferung in zwei Schritten:** erst die Migration (neue Liste, neue Felder, Startwerte, geänderte Kauffunktion), dann der Code. In den Minuten dazwischen sollte kein Event angelegt werden.
- **Kauffunktion:** Beim Ersetzen müssen ihre bisherigen Berechtigungen erhalten bleiben; die Zustimmung zu den AGB (PROJ-42) bleibt Teil des Kaufs.
- **Tests:** Die E2E-Tests zu PROJ-14 (Eventkarten, Kaufgrenze) und PROJ-45 („Diese Woche im Studio") müssen an Karten mit Link, die neue Kaufgrenze und die Verkaufsart angepasst werden.
- **Navigation:** Der Admin-Bereich bekommt den Eintrag „Eventarten"; der öffentliche Link „Events" bleibt.

## Implementation Notes (Frontend)

**Stand 2026-09-14:** Frontend fertig. Im Browser läuft es erst mit der Migration aus `/backend` — die Seiten lesen die neuen Felder. Unit-Tests (586), Typprüfung und Lint grün.

### Gebaut
- **Gemeinsame Status-Regel** `src/lib/events/event-zustand.ts`: abgesagt, vorbei, Ticket vorhanden, nur anzeigen, ausgebucht, kaufen. Stornierbarkeit rechnet wie `cancel_event_ticket` in Wiener Kalendertagen. Ein Event ohne Ende gilt bis Mitternacht Wien (`tagesendeInWien` in `src/lib/constants/zeitzone.ts`, auch am Tag der Zeitumstellung getestet).
- **Terminzeile** `src/lib/events/termin.ts`: ohne Ende, ein Abend (Ende am Folgetag vor 6 Uhr zählt noch dazu) oder Zeitraum über mehrere Tage.
- **Lesbare Adressen** `src/lib/events/adresse.ts`: Umlaute ausgeschrieben, bei Doppelung mit angehängter Zahl.
- **Event-Daten für Google** `src/lib/events/strukturierte-daten.ts`: schema.org `Event` mit Status, Ort, Angebot und Veranstalter; ohne persönliches Ticket; `<` maskiert.
- **Übersicht `/events`**: Filter-Chips (`?art=<Kennung>`, nur Arten mit kommenden Events), Bereich „Besondere Events", Leerzustand und Filter-Leerzustand mit „Filter zurücksetzen", Seitentitel und Beschreibung. Laufende Events bleiben bis zu ihrem Ende sichtbar.
- **Eventseite `/events/[adresse]`** (neu): Hinweis bei Absage oder vorbei, Beschreibung mit Absätzen, Kaufbereich, Seitentitel, Beschreibung, Link-Vorschau, Canonical, Event-Daten. Frühere Adressen leiten dauerhaft weiter, unbekannte zeigen „nicht gefunden".
- **Gemeinsame Bausteine** `event-aktion.tsx` (Knopf: kaufen, einloggen, Zum Ticket, ausgebucht) und `event-angaben.tsx` (Preis, Verfügbarkeit). Die ganze Karte führt zur Eventseite, der Knopf bleibt eigenständig bedienbar.
- **Kaufdialog**: Hinweis, wenn die Stornofrist beim Kauf schon abgelaufen ist; alle festen Texte übersetzt.
- **Admin `/admin/eventarten`** (neu, Muster Tanzstile): Löschen wird gar nicht erst angeboten, solange Events zugeordnet sind, und nennt deren Zahl; Eintrag in der Admin-Navigation.
- **Admin Event-Formular**: Eventart (Pflicht), Verkaufsart, Kapazität und Preise bei „Nur anzeigen" optional, Hinweis zu Partys über Mitternacht. Tabelle mit Eventart, „Nur anzeigen" statt Belegung und „Seite ansehen".
- **Admin-Aktionen**: Adresse beim Anlegen (zweiter Versuch bei gleichzeitiger Vergabe); beim Umbenennen wird die alte Adresse gemerkt, eine Rückbenennung räumt sie wieder auf; Umstellen auf „Nur anzeigen" mit gültigen Tickets wird mit deren Zahl abgelehnt.
- **Mein Bereich**: dieselbe Status-Regel, Zeilen führen zur Eventseite, „Eintritt vor Ort"; ist die Woche leer, die nächsten drei Events unter „Demnächst im Studio".

### Nebenbei behoben
- **Profil-Anker öffneten nichts:** „Mein Bereich" verlinkte auf `#abo`, `#buchungen` und `#warteliste`, aber kein Abschnitt trug diese Kennung, und keiner klappte auf. Jetzt trägt jeder Abschnitt seine Kennung, und `ProfilAkkordeon` öffnet den Abschnitt aus der Adresse.
- **„Mandat hinterlegen"** zeigte auf `#zahlungsweise`; der Abschnitt heißt `zahlungsmethode`.
- **Sprache:** Kaufdialog, „Diese Woche im Studio", „Zu erledigen" und der Login-Link der Eventkarte liefen über `next/link` und warfen englische Besucher ins Deutsche.

### Abweichungen und Offenes
- Der Bereich „Regelmäßig" wird noch nicht gerendert — ohne Serien (PROJ-54) entfällt er laut Kriterium ohnehin.
- `src/lib/supabase/types.ts` ist **vorläufig von Hand** um `event_types`, `event_previous_slugs` und die neuen Event-Spalten ergänzt, weil die Supabase-Verbindung getrennt war. Nach der Migration neu erzeugen und abgleichen.
- Fehlermeldungen der Server-Aktion beim Ticketkauf bleiben wie bisher deutsch.
- E2E-Tests zu PROJ-14 und PROJ-45 sind noch nicht angepasst → `/qa`.

### Was `/backend` liefern muss
- Tabelle **`event_types`**: Name eindeutig unabhängig von Groß-/Kleinschreibung; RLS lesen für alle, schreiben nur Admin.
- **`events`**: `event_type_id` (Pflicht, Fremdschlüssel mit Löschsperre), `sales_mode` (`display` oder `tickets`, Vorgabe `tickets`), `slug` (Pflicht, eindeutig); `capacity`, `price_normal`, `price_student` dürfen leer sein, bei `tickets` sind sie Pflicht.
- Tabelle **`event_previous_slugs`**: `slug` eindeutig; RLS lesen für alle, schreiben nur Admin.
- **Sperre in der Datenbank**, die `display` ablehnt, solange gültige Tickets bestehen.
- **`purchase_event_ticket`**: Kauf bis zum Ende (ohne Ende bis Mitternacht Wien), `display` ablehnen; Berechtigungen und AGB-Prüfung (PROJ-42) erhalten.
- **Bestandsdaten**: Start-Eventart und Adresse aus dem Namen für bestehende Test-Events.
- Danach `types.ts` erzeugen und mit der Handfassung abgleichen.

## Implementation Notes (Backend)

**Stand 2026-09-14:** Die Migration `supabase/migrations/20260914100000_proj53_veranstaltungsprogramm.sql` ist in der **Testdatenbank** eingespielt (vom Betreiber). Alle Unit- und Datenbanktests sind grün: 53 Dateien, 597 Tests, davon 11 neue in `tests/PROJ-53-events-db.test.ts`. In der Produktion ist sie noch **nicht** eingespielt.

### Datenbank
- **`event_types`**: Name 1–60 Zeichen, eindeutig ohne Groß-/Kleinschreibung; RLS lesen für alle, schreiben nur Admin (Muster Tanzstile).
- **`events`**: neu `event_type_id` (Pflicht, Fremdschlüssel mit Löschsperre), `sales_mode` (`display` oder `tickets`, Vorgabe `tickets`) und `slug` (Pflicht, eindeutig, Format `a-z0-9` mit Bindestrichen). `capacity`, `price_normal` und `price_student` dürfen leer sein; die Prüfregel `events_tickets_vollstaendig` verlangt sie bei `tickets`.
- **`event_previous_slugs`**: frühere Adressen mit Verweis aufs Event (bei dessen Löschung mit gelöscht), `slug` eindeutig; RLS lesen für alle, schreiben nur Admin.
- **Bestand**: Die Test-Events bekamen die Start-Eventart „Workshop" und eine Adresse aus ihrem Namen; gleich lautende Namen den Anfang ihrer Kennung angehängt.
- **Trigger `events_verkaufsart_pruefen`**: lehnt den Wechsel auf `display` ab, solange gültige Tickets bestehen. Läuft als SECURITY DEFINER — mit den Rechten des Aufrufers könnte eine RLS-Regel die Tickets verbergen, und die Sperre ließe stumm durch.
- **`purchase_event_ticket`**: kaufbar bis zum Ende, ohne Ende bis Mitternacht Wiener Zeit; bei `display` abgelehnt; Kapazität nur geprüft, wenn gesetzt. Gleiche Signatur wie in PROJ-42, deshalb `create or replace` ohne `drop` — die Berechtigungen der Funktion bleiben erhalten, die AGB-Prüfung ebenso.

### Server
- Keine neuen API-Routen: Events laufen wie bisher über Server-Aktionen und RLS.
- Die Admin-Aktion übersetzt den Trigger-Fehler in dieselbe Meldung wie ihre Vorabprüfung — für den Fall, dass zwischen Prüfung und Speichern ein Ticket verkauft wird.

### Tests gegen die Testdatenbank (`tests/PROJ-53-events-db.test.ts`)
- Kauf während eines laufenden Events klappt; nach dem Ende und bei einem Event ohne Ende nach Mitternacht Wiener Zeit nicht.
- „Nur anzeigen" verkauft nichts, auch nicht per direktem Aufruf der Kauffunktion.
- Der Wechsel auf „Nur anzeigen" ist mit gültigen Tickets gesperrt, auch mit Service-Rechten.
- Bei Tickets sind Kapazität und Preise Pflicht, bei „Nur anzeigen" nicht; Adressen nur im lesbaren Format.
- Eine Eventart mit zugeordneten Events lässt sich nicht löschen.
- Besucher ohne Konto lesen Eventarten und frühere Adressen (geprüft an einer echten Zeile, nicht nur „kein Fehler"); Kunden können keine Eventart anlegen.

### Auslieferung
- **Produktion: erst die Migration** (Betreiber, SQL-Editor), **dann der Code**. Der bisher ausgelieferte Code legt Events ohne Eventart und Adresse an und scheitert nach der Migration daran — in den Minuten dazwischen kein Event anlegen.
- `src/lib/supabase/types.ts` ist weiterhin von Hand ergänzt. Tabellen- und Spaltennamen stimmen mit der eingespielten Migration überein (der Datenbanktest verwendet dieselben); neu erzeugen, sobald die Supabase-Verbindung wieder steht.

### Offen für `/qa`
- E2E-Tests zu PROJ-14 und PROJ-45 an die neuen Karten, die Überschrift „Events & Partys", die Kaufgrenze und die Verkaufsart anpassen.
- Neue E2E-Tests für Eventseite, Filter, Weiterleitung früherer Adressen, Admin „Eventarten", Profil-Anker und die englische Seite.

## QA Test Results

**Getestet:** 2026-09-14
**Umgebung:** lokaler Testserver (Port 3100) gegen die Testdatenbank mit eingespielter Migration `20260914100000_proj53_veranstaltungsprogramm.sql`
**Browser:** Chromium (Desktop, 1280 px) und Mobile Safari (iPhone 13, 390 px). Firefox ist in Playwright nicht eingerichtet; Tablet (768 px) nicht eigens geprüft.
**Tester:** QA Engineer (AI)

### Automatisierte Tests
- **Unit- und Datenbanktests:** 53 Dateien, 597 Tests grün. Neu: Status-Regel, Terminzeile, Adressen, Event-Daten, Schema und 11 Datenbanktests (`tests/PROJ-53-events-db.test.ts`).
- **Neue E2E-Tests** `tests/PROJ-53-veranstaltungsprogramm.spec.ts`: 19 Tests × 2 Browser, 38/38 grün.
- **Regression** (PROJ-2, PROJ-8, PROJ-14, PROJ-42, PROJ-43, PROJ-45): 216/222 im ersten Lauf. Zwei Tests (je beide Browser) erwarteten die alte Überschrift „Events & Workshops" bzw. „Events & workshops" — gewollte Textänderung, Tests angepasst, im Nachtest grün. PROJ-14 „AC5, AC10" bleibt in beiden Browsern rot → BUG-1.
- **Komplette E2E-Suite:** bewusst noch nicht gelaufen. Sie läuft einmal nach PROJ-54 bis PROJ-56, vor dem gemeinsamen Deploy (Absprache mit dem Betreiber vom 2026-09-14).

### Acceptance Criteria Status

#### Eventarten (Admin)
- [x] Anlegen, danach im Event-Formular wählbar (E2E)
- [x] Umbenennen erscheint bei allen zugeordneten Events (E2E Umbenennen; die Anzeige kommt über die Verknüpfung)
- [x] Entfernen gesperrt, solange Events zugeordnet sind, mit Anzahl (E2E und Datenbanktest)
- [x] Event ohne Eventart ergibt einen Validierungsfehler (E2E und Unit)
- [x] Englische Seite zeigt denselben Namen (E2E)

#### Verkaufsart (Admin)
- [x] Wahl „Nur anzeigen" oder „Tickets in der App", vorausgewählt „Tickets in der App" (Code und E2E Anlegen)
- [x] „Nur anzeigen": Kapazität und Preise optional, kein Kauf (E2E und Datenbanktest)
- [x] Umstellen mit verkauften Tickets verhindert, mit Zahl (E2E; Datenbank-Sperre zusätzlich im Datenbanktest)

#### Übersicht
- [x] „Besondere Events": nur kommende, nicht abgesagte, nach Beginn sortiert (E2E)
- [x] Ohne Serien kein Bereich „Regelmäßig" (E2E)
- [x] Filter steht in der Adresse, ein geteilter Link öffnet denselben Filter (E2E)
- [x] Filter nur mit Arten, zu denen es kommende Events gibt (E2E)
- [x] Filter ohne Treffer: Hinweis und „Filter zurücksetzen" (E2E)
- [x] Leerzustand ohne kommende Events (Code geprüft — in der geteilten Testdatenbank nicht herstellbar)
- [ ] **BUG-1:** Die Karte soll bei „Tickets in der App" die Verfügbarkeit zeigen — für Kunden mit Ticket fehlt sie
- [x] Termin: ein Abend als von–bis, mehrere Tage als Zeitraum (Unit)
- [x] „Nur anzeigen": „Eintritt vor Ort" statt Verfügbarkeit, kein Kaufknopf (E2E)
- [x] Laufendes Event bleibt sichtbar und bis zum Ende kaufbar (E2E und Datenbanktest)

#### Eventseite
- [x] Name, Eventart, Termin, Ort, vollständige Beschreibung mit Absätzen, Preise, Knopf (E2E)
- [x] Ohne Login erreichbar; Link-Vorschau mit Name und Termin (E2E für den Titel der Vorschau)
- [x] Abgesagt oder vorbei: Hinweis statt Kaufknopf, kein „nicht gefunden" (E2E)
- [x] Nach dem Login zurück auf dieselbe Eventseite in derselben Sprache (E2E, Englisch)
- [x] „Du hast ein Ticket" statt „Ticket kaufen", mit Link in den geöffneten Ticket-Abschnitt (E2E)
- [ ] **BUG-2:** Auf Englisch sollen alle festen Texte englisch sein — die Fehlermeldungen beim Ticketkauf sind deutsch

#### Google-Suche
- [x] Lesbare Adresse aus dem Namen (E2E Anlegen), eindeutig bei gleichem Namen (Unit und eindeutige Spalte)
- [x] Umbenennen: alte Links leiten dauerhaft (308) weiter (E2E über die Verwaltung und über eine gespeicherte frühere Adresse)
- [x] Seitentitel, Beschreibung, Canonical und Event-Daten (E2E)
- [x] Abgesagt und ausgebucht stehen in den Event-Daten (Unit)
- [x] „Nur anzeigen" mit Eintrittspreis in den Event-Daten (Unit)

#### Mein Bereich
- [x] Events der Woche; eine Zeile führt zur Eventseite (E2E)
- [x] Leere Woche zeigt die nächsten drei unter „Demnächst im Studio" (Code geprüft — in der geteilten Testdatenbank nicht herstellbar)
- [x] „Nur anzeigen" steht als „Eintritt vor Ort" (E2E)
- [x] Vorhandenes Ticket wie bisher (bestehende PROJ-45-Tests grün)
- [x] Link zum Programm behält die Sprache (Code geprüft: sprachbewusste Navigation)

### Edge Cases Status
- [x] Eventart umbenannt, Filter-Link geteilt: Der Filter arbeitet mit der Kennung (Code)
- [x] Art nur mit vergangenen Events erscheint nicht im Filter (E2E)
- [x] Event ohne Ort zeigt keine leere Ortszeile (E2E)
- [x] Sehr lange Beschreibung: Karte gekürzt, Eventseite vollständig (E2E)
- [x] Unbekannte Adresse liefert 404 (E2E)
- [x] Zwei gleiche Namen bekommen verschiedene Adressen (Unit)
- [x] Mehrfaches Umbenennen: Jede frühere Adresse wird gespeichert (Code; E2E für eine Umbenennung)
- [x] „Nur anzeigen" ohne Preis zeigt keine Preiszeile (E2E)
- [x] Umstellen ohne verkaufte Tickets ist erlaubt (Code; die Datenbank-Sperre greift nur bei gültigen Tickets)
- [x] Kauf während einer laufenden Veranstaltung nennt die abgelaufene Stornofrist (E2E)
- [ ] Nicht bestätigt: Ausgebucht, dann Storno zeigt die Verfügbarkeit sofort wieder — der PROJ-14-Test bricht vorher an BUG-1 ab
- [x] Bestand ohne Art und Adresse: Die Migration vergibt beides (Pflichtfelder in der Testdatenbank gesetzt)

### Security Audit Results
- [x] **Autorisierung:** Admin-Aktionen für Eventarten und Events prüfen die Admin-Rolle vor jedem Schreiben; RLS lässt nur Admins schreiben (Datenbanktest: ein Kunde kann keine Eventart anlegen)
- [x] **Umgehung der Oberfläche:** Die Kauffunktion lehnt „Nur anzeigen" und vergangene Events auch bei direktem Aufruf ab (Datenbanktest)
- [x] **Stumm leere Prüfungen:** Die Datenbank-Sperre für „Nur anzeigen" läuft als SECURITY DEFINER mit festem `search_path` — RLS kann sie nicht leerlaufen lassen
- [x] **XSS:** Ein Skript in Eventname und Beschreibung wird nicht ausgeführt; die Event-Daten maskieren `<` (E2E und Unit)
- [x] **Datenschutz:** Öffentlich nur die Belegung als Zahl; frühere Adressen enthalten nichts als Adressen
- [x] **Injection:** Eingaben aus der Adresse (`art`, Eventadresse) werden nur verglichen oder parametrisiert abgefragt
- [x] **Offene Weiterleitung:** Der Login-Rückweg führt nur auf eigene Pfade (bestehende Prüfung `safeRedirectPath`)

### Bugs Found

#### BUG-1: Kunden mit Ticket sehen keine freien Plätze mehr
- **Severity:** High — als Regression gewertet: bricht den bestehenden PROJ-14-Test „AC5, AC10" und ein Kriterium der Karte. Die Auswirkung für Kunden ist gering.
- **Steps to Reproduce:**
  1. Als Kunde für ein Event mit Tickets ein Ticket kaufen
  2. `/events` oder die Eventseite öffnen
  3. Expected: „Du hast ein Ticket" ersetzt nur den Kaufknopf, „Noch X Plätze frei" bleibt sichtbar
  4. Actual: „Du hast ein Ticket" steht an der Stelle der Verfügbarkeit, die freien Plätze fehlen
- **Ursache:** `EventVerfuegbarkeit` (`src/components/events/event-angaben.tsx`) zeigt bei „ticketVorhanden" nur das Abzeichen statt zusätzlich die Verfügbarkeit.
- **Priority:** Fix before deployment

#### BUG-2: Fehlermeldungen beim Ticketkauf auf der englischen Seite deutsch
- **Severity:** Low
- **Steps to Reproduce:**
  1. `/en/events/…` öffnen, einloggen und ein Ticket kaufen, während das Event gerade schließt oder die AGB-Zustimmung fehlt
  2. Expected: englische Fehlermeldung
  3. Actual: z. B. „Dieses Event ist nicht mehr buchbar." — die Server-Aktion `purchaseTicket` liefert feste deutsche Sätze. Bestand schon vor PROJ-53; „ausgebucht" und „Mandat fehlt" sind bereits übersetzt.
- **Priority:** Nice to have — vor dem gemeinsamen Deploy sinnvoll, weil PROJ-53 englische Texte zusagt

### Beobachtungen ohne Befund
- Der Testserver meldet beim PROJ-43-Test „Rücksetz-Link aus der E-Mail" wiederholt „aborted": Der Test verlässt die Seite, während sie noch lädt. Kein Zusammenhang mit PROJ-53.
- Der abgebrochene PROJ-14-Test hinterlässt je Browser ein reserviertes Ticket für „E2E14 Kaufen Event"; das Zurücksetzen der Testdaten in PROJ-14 storniert es beim nächsten Lauf.

### Summary
- **Acceptance Criteria:** 32/34 bestanden
- **Bugs Found:** 2 (0 Critical, 1 High, 0 Medium, 1 Low)
- **Security:** bestanden
- **Production Ready:** NEIN — BUG-1 vorher beheben
- **Recommendation:** BUG-1 und BUG-2 beheben, gezielt nachtesten (PROJ-14, PROJ-53); die komplette Suite nach PROJ-54 bis PROJ-56

## Deployment
_To be added by /deploy_
