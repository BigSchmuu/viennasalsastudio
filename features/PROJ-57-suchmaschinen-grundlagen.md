# PROJ-57: Suchmaschinen-Grundlagen für öffentliche Seiten

## Status: Planned
**Created:** 2026-09-16
**Last Updated:** 2026-09-16

## Dependencies
- Requires: PROJ-53 (Veranstaltungsprogramm) — eigene Adressen und Event-Daten je Event
- Requires: PROJ-54 (Event-Serien) — Serienseiten und Serientermine
- Requires: PROJ-55 (Bilder & Videos) — Titelbild für die Link-Vorschau
- Requires: PROJ-43 (Zweisprachigkeit) — deutsche und englische Fassung jeder öffentlichen Seite

## User Stories
- Als Studio möchte ich, dass unsere Events bei Google gefunden werden, damit jemand, der „Salsa Party Wien" sucht, bei uns landet und nicht bei der Konkurrenz.
- Als Studio möchte ich, dass die App **nicht** mit unserer Website um dieselben Begriffe konkurriert — zwei Seiten desselben Studios schaden einander.
- Als englischsprachiger Besucher in Wien möchte ich die englische Fassung einer Eventseite finden, ohne erst auf die deutsche zu stoßen.
- Als Besucher möchte ich einen geteilten Link mit Bild, Name und Termin sehen, bevor ich ihn öffne.
- Als Betreiber möchte ich, dass vergangene Events aus der Suche verschwinden, damit niemand das Studio für eingeschlafen hält.

## Out of Scope
- **Inhaltliche Suchmaschinenoptimierung** — Texte umschreiben, Suchbegriffe einarbeiten, Überschriften umbauen
- **Kurs- und Stundenplanseiten im Index** — bewusst draußen, das deckt die Website ab
- **Google Search Console und Analytics einrichten** — ein Schritt außerhalb des Codes, siehe Open Questions
- **Strukturierte Daten über Events hinaus** — kein Organization-, LocalBusiness- oder Breadcrumb-Eintrag
- **Verweise von anderen Seiten aufbauen** — das ist Öffentlichkeitsarbeit, keine Programmieraufgabe
- **Eine eigene Galerieseite für vergangene Events** — kam im Gespräch auf, bleibt für später
- **Eigene Vorschaubilder je Seite** (Open Graph Images erzeugen) — das Titelbild aus PROJ-55 genügt

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Sitemap
- [ ] Angenommen eine Suchmaschine ruft `/sitemap.xml` auf, dann findet sie alle kommenden Einzelevents und alle laufenden Serien, jeweils in beiden Sprachen
- [ ] Angenommen ein Event ist vorbei oder abgesagt, dann steht es nicht in der Sitemap
- [ ] Angenommen eine Serie hat Termine, dann steht nur die Serienseite in der Sitemap, nicht die einzelnen Termine
- [ ] Angenommen eine Serie ist beendet und hat keine kommenden Termine mehr, dann steht sie nicht mehr in der Sitemap
- [ ] Angenommen ein Event wird angelegt oder abgesagt, dann bildet die Sitemap das ohne Zutun ab — niemand pflegt sie von Hand
- [ ] Angenommen die Sitemap wird abgerufen, dann enthält sie keine Seite, die eine Anmeldung verlangt

### robots.txt
- [ ] Angenommen eine Suchmaschine ruft `/robots.txt` auf, dann findet sie den Verweis auf die Sitemap
- [ ] Angenommen eine Suchmaschine liest `/robots.txt`, dann sind Verwaltung, Check-in, Lehrerbereich, „Mein Bereich", Profil und Rechnungen ausdrücklich ausgeschlossen

### Was nicht in den Index soll
- [ ] Angenommen eine Suchmaschine besucht Startseite, Kurse, Stundenplan, Login, Registrieren oder die Passwort-Seiten, dann sagt die Seite „nicht aufnehmen"
- [ ] Angenommen eine Suchmaschine besucht AGB, Datenschutz oder Impressum, dann sagt die Seite „nicht aufnehmen"
- [ ] Angenommen ein Event ist vorbei oder abgesagt, dann sagt seine Seite „nicht aufnehmen", bleibt aber erreichbar — geteilte Links laufen nicht ins Leere
- [ ] Angenommen eine Seite gehört zu einem einzelnen Serientermin, dann sagt sie „nicht aufnehmen", bleibt aber erreichbar und teilbar

### Sprachen
- [ ] Angenommen eine indexierte Seite wird abgerufen, dann nennt sie ihre Entsprechung in der anderen Sprache, und zwar wechselseitig
- [ ] Angenommen eine Suchmaschine kann die Sprache eines Besuchers nicht zuordnen, dann führt die Vorgabe auf die deutsche Fassung
- [ ] Angenommen eine Seite gibt es in beiden Sprachen, dann verweist jede Fassung als kanonische Adresse auf sich selbst, nicht auf die andere

### Vorschau und Event-Daten
- [ ] Angenommen eine indexierte Seite wird geteilt, dann trägt die Vorschau Name, Kurzbeschreibung und — sofern vorhanden — das Titelbild
- [ ] Angenommen ein Event hat kein Titelbild, dann erscheint die Vorschau ohne Bild statt mit einem kaputten

## Edge Cases
- Ein Event wird abgesagt, nachdem Google es aufgenommen hat → die Seite sagt „nicht aufnehmen"; Google entfernt sie beim nächsten Besuch, die Sitemap nennt sie sofort nicht mehr
- Ein Event wird umbenannt → die alte Adresse leitet dauerhaft weiter (PROJ-53), die Sitemap nennt nur die neue
- Ein Serientermin wird verlegt oder abgesagt → ändert nichts, Serientermine stehen ohnehin nicht im Index
- Eine Serie pausiert in den Ferien → sie bleibt in der Sitemap, solange sie läuft; die Pause ist kein Ende
- Sehr viele Events → die Sitemap bleibt eine Datei; die Grenze von 50.000 Adressen ist für ein Studio nicht erreichbar
- Die Datenbank ist nicht erreichbar, wenn die Sitemap abgerufen wird → lieber ein Fehler als eine leere Sitemap: „keine Seiten" wäre für Google eine Aussage, „gerade nicht verfügbar" nicht
- Ein Event ohne Beschreibung → die Vorschau nutzt Eventart und Termin, wie schon in PROJ-53

## Technical Requirements (optional)
- Sitemap und robots.txt erzeugt die App aus ihren Daten, nichts wird von Hand gepflegt
- Die Sitemap darf keine Adresse enthalten, die eine Anmeldung verlangt
- Keine neuen Pakete und kein neuer Dienst erwartet

## Open Questions
- [ ] Soll die Google Search Console für `app.viennasalsastudio.at` eingerichtet werden? Das ist ein Schritt im Browser, kein Code — aber ohne sie sieht niemand, ob Google die Sitemap überhaupt liest
- [ ] Eine eigene Galerieseite für vergangene Events, damit die Fotos aus PROJ-55 sichtbar bleiben, ohne dass alte Eventseiten im Index stehen — eigenes Projekt?

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Nur Eventseiten und Serienseiten kommen in den Index | Die App soll nicht mit der Website um dieselben Begriffe konkurrieren — zwei Seiten desselben Studios teilen die Signale auf, und Google entscheidet selbst, welche es zeigt | 2026-09-16 |
| Von einer Serie kommt nur die Serienseite in den Index, nicht die einzelnen Termine | Sonst stünden binnen eines Jahres fünfzig fast gleiche Seiten derselben Party im Index, von denen achtundvierzig nicht mehr existieren | 2026-09-16 |
| Vergangene und abgesagte Events sagen „nicht aufnehmen" | Wer nach einem Workshop sucht und als erstes einen Termin von vor einem Jahr findet, hält das Studio für eingeschlafen. Gegenargument war, dass diese Seiten jetzt Fotos tragen — dafür wäre eine Galerieseite der bessere Ort | 2026-09-16 |
| Die übrigen öffentlichen Seiten bekommen ein ausdrückliches „nicht aufnehmen", nicht bloß ein Fehlen in der Sitemap | Google findet Seiten über die Navigation, und die verlinkt von jeder Seite auf Kurse und Stundenplan. Eine Sitemap hält nichts draußen, sie lädt nur ein | 2026-09-16 |
| Beide Sprachen werden indexiert, Deutsch als Vorgabe für Unzuordenbare | In Wien suchen genug Leute auf Englisch | 2026-09-16 |
| Bewusst aufgegeben: Kursseiten der App tauchen bei Google nie auf | Folgt aus der ersten Entscheidung. Es ist ein Verzicht auf Sichtbarkeit, und er ist gewollt — die Website deckt Kurse ab | 2026-09-16 |

### Was dieses Projekt nicht leisten kann
Im Gespräch kam die Frage auf, ob Sichtbarkeit bei Google über Besucherzahlen entsteht. Der Vollständigkeit halber festgehalten, weil es die Erwartung an dieses Projekt bestimmt:

- **Besucherzahlen sind kein Ranking-Faktor.** Tausend Besucher über Instagram heben eine Seite in der Suche nicht — Google zählt nicht, wer vorbeikommt.
- **Verweise von anderen Seiten zählen.** Ein Wiener Veranstaltungskalender, der auf eine Eventseite verlinkt, ist das starke Signal. Das ist Öffentlichkeitsarbeit, nicht Code.
- **Ein Zwischending:** Google wertet aus, wie Leute mit den Suchergebnissen selbst umgehen — belegt durch Unterlagen aus dem US-Kartellverfahren, auch wenn Google es öffentlich kleinredet. Es betrifft Klicks aus der Suche, nicht Besuche von woanders.

PROJ-57 macht die Eventseiten **auffindbar und sauber teilbar**. Ob sie bei „Salsa Party Wien" auf Seite eins landen, entscheidet sich an Dingen außerhalb dieses Projekts.

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
