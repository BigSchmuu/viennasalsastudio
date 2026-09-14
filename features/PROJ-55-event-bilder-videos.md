# PROJ-55: Bilder & Videos für Events

## Status: Planned
**Created:** 2026-09-14
**Last Updated:** 2026-09-14

## Dependencies
- Requires: PROJ-53 (Veranstaltungsprogramm) — Event-Karte und Eventseite
- Requires: PROJ-11 (Beispiel-Videos) — bestehende, datensparsame YouTube-Einbettung
- Berührt: PROJ-54 (Event-Serien) — eine Serie teilt ihre Bilder über alle Termine

## User Stories
- Als Admin möchte ich zu einem Event ein Titelbild hochladen (z. B. den Flyer), damit das Event in der Übersicht auffällt.
- Als Admin möchte ich weitere Bilder hochladen, die als Galerie auf der Eventseite erscheinen, z. B. Fotos der letzten Party.
- Als Admin möchte ich die Galerie sortieren und einzelne Bilder wieder entfernen.
- Als Admin möchte ich YouTube-Videos zu einem Event hinzufügen, die auf der Eventseite abspielbar sind.
- Als Besucher möchte ich Bilder groß ansehen und Videos abspielen, um einen Eindruck von der Veranstaltung zu bekommen.

## Out of Scope
- **Videos hochladen** — nur YouTube-Links
- **Bildbearbeitung** in der App (Zuschneiden, Filter)
- **Uploads durch Besucher**, Kommentare oder Likes
- **Bilder für Kurse** oder andere Bereiche — nur Events
- **Instagram- oder Facebook-Einbettungen**
- **Eigene Bilder je Serientermin**

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Titelbild
- [ ] Angenommen ein Admin lädt bei einem Event ein Titelbild hoch (JPG, PNG oder WebP), dann erscheint es auf der Karte in der Übersicht und oben auf der Eventseite
- [ ] Angenommen ein Event hat kein Titelbild, dann zeigt die Karte eine gestaltete Fläche in den Studiofarben mit der Eventart — kein kaputtes Bild
- [ ] Angenommen ein Admin ersetzt das Titelbild, dann erscheint sofort das neue, und das alte wird gelöscht
- [ ] Angenommen ein Event wird geteilt, dann zeigt die Link-Vorschau das Titelbild

### Galerie
- [ ] Angenommen ein Admin lädt weitere Bilder hoch, dann erscheinen sie als Galerie auf der Eventseite
- [ ] Angenommen ein Admin ändert die Reihenfolge der Galeriebilder, dann erscheint die Galerie in dieser Reihenfolge
- [ ] Angenommen ein Admin entfernt ein Bild, dann ist es sofort nicht mehr sichtbar und dauerhaft gelöscht
- [ ] Angenommen ein Besucher tippt auf ein Galeriebild, dann öffnet es sich groß; er kann zum nächsten Bild wischen oder blättern und die Ansicht mit X oder Escape schließen

### Hochladen
- [ ] Angenommen ein Admin lädt eine zu große Datei oder ein anderes Format hoch, dann erscheint eine verständliche Fehlermeldung mit dem erlaubten Format und der Größe, und nichts wird gespeichert
- [ ] Angenommen ein Foto enthält Standortdaten (z. B. GPS vom Handy), dann werden diese beim Speichern entfernt
- [ ] Angenommen ein Admin lädt ein sehr großes Foto hoch (z. B. 6000 px vom Handy), dann lädt die Seite am Telefon trotzdem schnell, weil Bilder in passender Größe ausgeliefert werden
- [ ] Angenommen ein Admin gibt eine Bildbeschreibung ein, dann dient sie als Alternativtext; ohne Beschreibung wird der Eventname verwendet
- [ ] Angenommen der Admin öffnet den Upload, dann weist ein kurzer Hinweis darauf hin, nur Fotos zu verwenden, für die das Studio die Rechte und das Einverständnis der abgebildeten Personen hat
- [ ] Angenommen eine Person ohne Admin-Rolle versucht, Bilder hochzuladen, zu ändern oder zu löschen, dann wird das verweigert

### Videos
- [ ] Angenommen ein Admin fügt einen YouTube-Link hinzu, dann erscheint das Video auf der Eventseite; ein Link, der kein YouTube-Video ist, wird beim Speichern abgelehnt
- [ ] Angenommen ein Besucher öffnet eine Eventseite mit Video, dann wird es so datensparsam eingebettet wie die Beispiel-Videos (PROJ-11)
- [ ] Angenommen ein Admin entfernt ein Video oder ändert die Reihenfolge mehrerer Videos, dann zeigt die Eventseite das sofort

## Edge Cases
- Ein iPhone-Foto kommt im HEIC-Format an → verständliche Meldung, das Bild als JPG hochzuladen (die meisten Browser wandeln beim Hochladen selbst um)
- Der Upload bricht bei schwachem Netz ab → kein halb gespeichertes Bild, Fehlermeldung, erneuter Versuch möglich
- Dasselbe Bild wird zweimal hochgeladen → erlaubt, keine Duplikatprüfung
- Ein Event wird abgesagt → Bilder und Videos bleiben erhalten, die Eventseite zeigt den Absage-Hinweis
- Ein YouTube-Video wird später gelöscht oder auf privat gestellt → YouTube zeigt seinen eigenen Hinweis, die Eventseite funktioniert weiter
- Die Galerie hat die Höchstzahl an Bildern erreicht → der Upload-Knopf nennt die Grenze statt kommentarlos zu scheitern
- Ein Titelbild im Hochformat (Flyer) → die Karte zeigt einen sinnvollen Ausschnitt, die Eventseite das ganze Bild

## Technical Requirements (optional)
- Datenschutz: Standort-Metadaten entfernen; die Datenschutzerklärung um den Bildspeicher ergänzen, falls ein neuer Anbieter Daten verarbeitet
- Performance: Bilder in passenden Größen, Galerie lädt erst beim Hinscrollen
- Security: Hochladen, Ändern und Löschen nur für Admins; nur Bildformate; Größenlimit
- Barrierefreiheit: Alternativtexte, Galerie per Tastatur bedienbar

## Open Questions
- [ ] Größenlimit und Höchstzahl: Vorschlag 10 MB je Bild und 20 Bilder je Event
- [ ] Muss die Datenschutzerklärung für den Bildspeicher ergänzt werden? Klärt `/architecture` mit der Wahl des Speichers.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Bilder werden im Admin hochgeladen, nicht verlinkt | Betreiberentscheidung — Bilder sollen nicht verschwinden, wenn eine fremde Quelle sie löscht | 2026-09-14 |
| Titelbild plus Galerie | Betreiberentscheidung — Titelbild für die Übersicht, Galerie für den Eindruck | 2026-09-14 |
| Videos nur als YouTube-Link | Betreiberwunsch „Bilder/Videos"; die datensparsame Einbettung aus PROJ-11 existiert, eigene Videos zu speichern wäre teuer | 2026-09-14 |
| Standort-Metadaten werden beim Speichern entfernt | Handyfotos enthalten oft GPS-Koordinaten — auf einer öffentlichen Seite ein Datenschutzproblem | 2026-09-14 (Vorschlag) |
| Eine Serie teilt ihre Bilder über alle Termine | Einfacher, und eine regelmäßige Party sieht jede Woche gleich aus | 2026-09-14 (Vorschlag) |

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
