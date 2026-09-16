# PROJ-57: Suchmaschinen-Grundlagen für öffentliche Seiten

## Status: In Progress
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
| „Nicht aufnehmen" wird zentral voreingestellt; Eventseiten widersprechen ausdrücklich | Die Gegenrichtung wäre eine Liste, die beim nächsten neuen Bereich jemand zu ergänzen vergisst — und dann steht „Mein Bereich" bei Google | 2026-09-16 |
| Sitemap wird bei jedem Abruf neu gerechnet, nicht zwischengespeichert | Google holt sie selten; eine Sitemap, die ein abgesagtes Event noch nennt, ist schlimmer als eine, die eine halbe Sekunde braucht | 2026-09-16 |
| Bei einem Lesefehler ein Fehler statt einer leeren Sitemap | „Keine Seiten" wäre für Google eine Aussage — es hielte die bekannten Adressen für erledigt. „Gerade nicht verfügbar" ist keine | 2026-09-16 |
| Die Sprachverknüpfung nutzt die vorhandene Adressberechnung | Deutsch ohne Präfix, Englisch mit — das von Hand zusammenzubauen ist in PROJ-53 schon einmal schiefgegangen | 2026-09-16 |
| Keine neuen Pakete, keine neue Tabelle, keine Migration | Next.js bringt Sitemap und robots.txt mit; die Daten stehen seit PROJ-53 und PROJ-54 bereit | 2026-09-16 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
PROJ-57 braucht **kein Backend im üblichen Sinn**: keine neue Tabelle, keine Migration, keine neuen Daten. Es liest nur, was seit PROJ-53 bis PROJ-56 ohnehin da ist, und sagt Suchmaschinen, was sie damit tun sollen.

Der Kern in einem Satz: **Nicht aufnehmen ist ab jetzt die Voreinstellung**, und nur Eventseiten und Serienseiten nehmen sich davon aus.

### A) Was gebaut wird

```
App
+-- /sitemap.xml     — erzeugt bei jedem Abruf aus der Datenbank
|   +-- kommende Einzelevents, je Sprache
|   +-- laufende Serien, je Sprache
|
+-- /robots.txt      — feste Regeln plus Verweis auf die Sitemap
|   +-- Verwaltung, Check-in, Lehrerbereich, Mein Bereich, Profil,
|       Rechnungen: ausgeschlossen
|
+-- Angaben je Seite
    +-- „nicht aufnehmen" als Voreinstellung für die ganze App
    +-- Eventseite und Serienseite nehmen sich ausdrücklich aus —
    |   solange das Event kommt und nicht abgesagt ist
    +-- Sprachverknüpfung: deutsch ↔ englisch, wechselseitig
    +-- kanonische Adresse: jede Fassung zeigt auf sich selbst
```

Es entsteht **kein einziger sichtbarer Baustein**. Wer die App im Browser benutzt, merkt von diesem Projekt nichts — außer dass eine geteilte Eventseite in WhatsApp weiterhin gut aussieht.

### B) Datenmodell (in Worten)
**Nichts Neues.** Die Sitemap fragt bei jedem Abruf:

- welche Einzelevents kommen noch und sind nicht abgesagt (Serientermine ausgenommen)
- welche Serien laufen noch

Beides steht seit PROJ-53 und PROJ-54 in der Datenbank. Gespeichert wird nichts, gemerkt wird nichts.

### C) Technische Entscheidungen (für den Betreiber erklärt)

- **„Nicht aufnehmen" ist die Voreinstellung, nicht die Ausnahme.** Die App sagt einmal zentral: nichts in den Index. Eventseiten und Serienseiten widersprechen dem ausdrücklich. Andersherum — jede Seite einzeln ausschließen — wäre eine Liste, die beim nächsten neuen Bereich jemand zu ergänzen vergisst, und dann steht „Mein Bereich" bei Google. Diese Richtung ist die sichere: Wer eine Seite in den Index will, muss es sagen.
- **Die Sitemap wird bei jedem Abruf neu gerechnet**, statt zwischengespeichert. Google holt sie selten, die Abfrage ist klein, und eine Sitemap, die ein abgesagtes Event noch nennt, ist schlimmer als eine, die eine halbe Sekunde braucht.
- **Geht die Abfrage schief, gibt es einen Fehler — keine leere Sitemap.** Für Google wäre „keine Seiten" eine Aussage: Es würde beginnen, die bekannten Adressen für erledigt zu halten. „Gerade nicht verfügbar" ist keine Aussage; Google kommt wieder.
- **Die Sprachverknüpfung entsteht aus der Adressberechnung, die es schon gibt.** Deutsch läuft ohne Präfix, Englisch mit — das zusammenzubauen ist schon einmal falsch gemacht worden (PROJ-53, der Link ins falsche Profil). Es gibt genau eine Stelle, die Adressen baut, und die wird benutzt.
- **Vergangene, abgesagte und Serientermin-Seiten bleiben erreichbar**, sagen aber „nicht aufnehmen". Ein geteilter Link soll nicht ins Leere laufen, nur weil das Event vorbei ist.
- **Keine neuen Pakete.** Next.js bringt beides mit; Sitemap und robots.txt sind dort vorgesehene Bausteine.

### D) Abhängigkeiten (Pakete)
Keine.

### Auswirkungen auf Bestehendes
- **Die Startseite, Kurse und der Stundenplan verschwinden aus Google**, soweit sie je darin waren. Das ist die Entscheidung aus der Spezifikation, hier noch einmal als sichtbare Folge.
- **Die App braucht eine feste Grundadresse** in ihren Angaben, damit aus relativen Pfaden vollständige Adressen werden. Die gibt es als Einstellung bereits; sie wird jetzt auch für die Seitenangaben benutzt.
- **Die Eventseite hat ihre kanonische Adresse schon** (PROJ-53); dazu kommt die Verknüpfung der Sprachen.
- **Tests:** Sitemap und robots.txt lassen sich wie jede andere Adresse abrufen und prüfen — welche Seiten drinstehen, welche nicht, und ob ein abgesagtes Event verschwindet. Die Angaben je Seite prüft man am ausgelieferten Seitenkopf.

## Implementation Notes (Frontend)

**Stand 2026-09-16:** Fertig. Kein Backend nötig — keine Migration, keine neuen Daten, keine neuen Pakete. Unit-Tests 763 in 64 Dateien, Typprüfung, Lint und `npm run build` sauber.

### Gebaut
- **Regeln** `src/lib/seo/regeln.ts` (7 Tests): was in den Index darf, die Voreinstellung „nicht aufnehmen" und der ausdrückliche Widerspruch. Drei Gründe dagegen — Serientermin, abgesagt, vorbei — jeweils mit derselben Zeitgrenze wie der Ticketverkauf.
- **Adressberechnung** `src/lib/seo/adressen.ts`: die Sprachfassungen einer Seite, gebaut mit der Adressberechnung der App. Deutsch ohne Präfix, Englisch mit, Deutsch als Vorgabe für Unzuordenbare.
- **`/sitemap.xml`**: kommende Einzelevents und laufende Serien, je Eintrag beide Sprachen plus Vorgabe. Bei jedem Abruf neu gerechnet. Ein Lesefehler wirft — eine leere Sitemap wäre für Google die Aussage, es gebe nichts mehr.
- **`/robots.txt`**: die Bereiche hinter der Anmeldung, dazu der Verweis auf die Sitemap.
- **Voreinstellung** im Wurzel-Layout: „nicht aufnehmen" für die ganze App, dazu die Grundadresse für vollständige Links.
- **Eventseite und Serienseite** widersprechen ausdrücklich — die Eventseite nur, solange das Event kommt, nicht abgesagt ist und kein Serientermin ist.

### Gefunden beim Bauen: dieselbe Falle ein zweites Mal
Der erste Aufruf von `/robots.txt` lieferte die 404-Seite als HTML. Ursache war die Sprachweiche: Sie behandelte beide Dateien wie Seiten und schickte sie auf einen Sprachpfad. **Google hätte weder das eine noch das andere je zu sehen bekommen** — und ohne den Versuch am laufenden Server wäre das erst in der Produktion aufgefallen, wo niemand hinsieht.

Genau dieselbe Falle steht seit dem 2026-09-09 im Kommentar über der betroffenen Zeile, damals für `manifest.webmanifest`. Der Kommentar ist jetzt erweitert: Wer dort eine Datei ergänzt, die keine Seite ist, gehört in diese Liste.

### Am laufenden Server geprüft
Gegen die Testdatenbank, nicht die Produktion:
- `/robots.txt` liefert die Regeln und den Verweis auf die Sitemap
- `/sitemap.xml` liefert 11 Einträge mit `hreflang` für beide Sprachen
- Startseite und Kursseite: `noindex, follow`
- Eventseite: `index, follow`, kanonisch auf sich selbst, `hreflang` de/en/x-default
- Englische Fassung: kanonisch auf die englische Adresse, nicht auf die deutsche
- Vergangenes Event: `noindex, follow`

### Abweichungen und Offenes
- **Die Sprachadressen haben keinen Unit-Test.** Die Adressberechnung der App zieht die Navigation von next-intl herein, und daran scheitert jeder Test, der bloß Pfade vergleichen will. Geprüft ist sie am ausgelieferten Seitenkopf — dort zählt sie; die QA hält das als E2E fest.
- **Noch keine E2E-Tests**; sie kommen in der QA.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
