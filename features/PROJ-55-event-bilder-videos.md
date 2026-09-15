# PROJ-55: Bilder & Videos für Events

## Status: Architected
**Created:** 2026-09-14
**Last Updated:** 2026-09-15

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
- [x] Größenlimit und Höchstzahl → 10 MB je Bild, 20 Bilder je Event; der Vorschlag aus der Spezifikation wird übernommen (2026-09-15)
- [x] Muss die Datenschutzerklärung ergänzt werden? → Nein. Die Bilder liegen bei Supabase, das dort schon als Auftragsverarbeiter für die Datenspeicherung steht (2026-09-15)
- [ ] Sollen Bilder älterer Events nach einer Weile verschwinden? Fotos von Gästen dauerhaft öffentlich zu zeigen, ist eine Entscheidung für sich — heute bleiben sie, bis sie jemand entfernt

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
| Bilder liegen im Bildspeicher von Supabase | Kein neuer Auftragsverarbeiter, also keine Änderung an der Datenschutzerklärung; Supabase steht dort schon für die Datenspeicherung | 2026-09-15 |
| Verkleinern und Neuzeichnen passiert im Browser, vor dem Hochladen | Löst Upload bei schwachem Netz, große Handyfotos und die Standortdaten in einem Zug; der Server prüft Typ und Größe. Grenze: Wer die App umgeht, kann Metadaten hochladen — hochladen darf aber nur ein Admin | 2026-09-15 |
| Ausgeliefert wird über den Bild-Dienst von Next.js, gespeichert nur das Original | Eine Übersicht mit zehn Karten lüde sonst zehn große Bilder | 2026-09-15 |
| Ein Eintrag je Bild mit einer Rolle (Titelbild oder Galerie) statt zweier Wege | Ein Weg zum Hochladen, Löschen und Rechteprüfen; zwei liefen auseinander — wie bei den Serienterminen in PROJ-54 | 2026-09-15 |
| Bilder hängen am Event oder an der Serie, nie am einzelnen Serientermin | Folgt der Produktentscheidung „eine Serie teilt ihre Bilder" | 2026-09-15 |
| Titelbild auf der Karte im festen Querformat, auf der Eventseite ganz | Gleich hohe Karten halten die Übersicht ruhig; der Flyer wird auf der Karte bewusst beschnitten | 2026-09-15 |
| Ersetzen und Löschen räumen die Datei im Bildspeicher mit weg | Sonst sammelte sich, was niemand mehr sieht — und das Studio bewahrte Fotos ohne Grund auf | 2026-09-15 |
| Keine neuen Pakete | Browser, Next.js und Supabase bringen alles Nötige mit | 2026-09-15 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
PROJ-55 braucht Frontend **und** Backend. Der Kern in einem Satz: Ein Event bekommt ein Titelbild, eine Galerie und Videos — und eine Serie genauso, damit jeder ihrer Termine dieselben Bilder zeigt, ohne sie zwanzig Mal hochzuladen.

Es ist die erste Stelle der App, an der jemand eine Datei hochlädt. Bisher entstehen alle Dateien in der App selbst (SEPA-Datei, Rechnungen, QR-Codes). Das meiste am Entwurf dreht sich deshalb darum, wo die Bilder liegen, wie sie klein genug ankommen und wie sie wieder verschwinden.

### A) Komponentenstruktur

**Übersicht**
```
Event-Übersicht
+-- Event-Karte
|   +-- Titelbild im festen Querformat — oder, wenn keines da ist,
|       eine gestaltete Fläche in den Studiofarben mit der Eventart
+-- Serien-Karte (dasselbe, mit dem Titelbild der Serie)
```

**Eventseite und Serienseite**
```
Eventseite
+-- Titelbild, ganz — ein hochformatiger Flyer bleibt hochformatig
+-- Kopf, Beschreibung, Kauf (unverändert)
+-- Bereich „Bilder"
|   +-- Galerie als Raster; die Bilder laden erst beim Hinscrollen
|   +-- Großansicht: blättern, wischen, schließen mit X oder Escape
+-- Bereich „Videos"
    +-- dieselbe datensparsame YouTube-Einbettung wie bei den Beispiel-Videos
```

**Verwaltung**
```
/admin/events
+-- Eventliste: je Zeile ein neuer Knopf „Bilder & Videos"
+-- Serienliste: derselbe Knopf — genau wie „Termine" bei Serien
+-- Dialog „Bilder & Videos"
    +-- Hinweis auf Bildrechte und das Einverständnis der Abgebildeten
    +-- Titelbild: Vorschau, „Ersetzen", „Entfernen"
    +-- Galerie: mehrere Bilder auf einmal hochladen, Reihenfolge ändern,
    |   Bildbeschreibung eintragen, einzeln entfernen
    +-- Videos: YouTube-Link hinzufügen, Reihenfolge ändern, entfernen
```

### B) Datenmodell (in Worten)

**Bild** (neu)
- gehört zu einem Event **oder** zu einer Serie — genau eines von beiden
- Rolle: Titelbild oder Galeriebild
- wo die Datei im Bildspeicher liegt
- Bildbeschreibung für Menschen, die die Seite vorlesen lassen (optional; fehlt sie, tritt der Eventname ein)
- Breite und Höhe, damit die Seite den Platz kennt, bevor das Bild geladen ist — sonst springt der Text beim Laden
- Reihenfolge in der Galerie
- angelegt am

**Video** (neu)
- gehört zu einem Event **oder** zu einer Serie
- die YouTube-Kennung des Videos
- ein Titel (optional)
- Reihenfolge

**Unverändert:** Events, Serien, Eventarten, Tickets.

Gespeichert in Supabase: die Angaben in der Datenbank, die Bilddateien im Bildspeicher desselben Anbieters. Lesen darf jeder — es sind die Bilder öffentlicher Seiten. Hochladen, ändern und löschen dürfen nur Admins, und zwar an zwei Stellen abgesichert: an der Datenbank und am Bildspeicher.

### C) Technische Entscheidungen (für den Betreiber erklärt)

- **Die Bilder liegen bei Supabase, nicht bei einem neuen Anbieter.** Damit ändert sich an der Datenschutzerklärung nichts: Supabase steht dort bereits als Auftragsverarbeiter für „Datenbank, Authentifizierung und Datenspeicherung". Ein eigener Bilddienst wäre ein weiterer Vertrag, ein weiterer Eintrag und ein weiterer Ort, an dem etwas ausfallen kann. **Damit ist die offene Frage aus der Spezifikation beantwortet.**
- **Das Bild wird schon auf dem Gerät verkleinert und neu gespeichert, bevor es hochgeladen wird.** Das löst drei Dinge auf einmal: Ein 6000-Pixel-Handyfoto wird auf eine vernünftige Kantenlänge gebracht, der Upload gelingt auch bei schwachem Netz, und sämtliche Metadaten — auch die GPS-Koordinaten — fallen dabei weg, weil das Bild neu gezeichnet wird. *Grenze, die dazugehört:* Das passiert im Browser. Wer sich auskennt, könnte die App umgehen und ein Bild mit Standortdaten hochladen — aber hochladen darf ohnehin nur ein Admin, und der tut es nicht gegen sich selbst. Der Server prüft, was ankommt: Typ, Größe und dass es überhaupt ein Bild ist.
- **Ausgeliefert wird in der Größe, die die Seite gerade braucht.** Gespeichert wird ein Bild, die passenden Fassungen für Telefon und Bildschirm entstehen beim Ausliefern. Ohne das lüde die Übersicht mit zehn Karten zehn große Bilder.
- **Ein Titelbild im festen Querformat auf der Karte.** So bleiben alle Karten gleich hoch und die Übersicht ruhig; das ganze Bild sieht man auf der Eventseite. Ein hochformatiger Flyer wird auf der Karte also beschnitten — das ist gewollt.
- **Ein Eintrag je Bild, mit einer Rolle.** Titelbild und Galeriebild sind dasselbe Ding an derselben Stelle, nur anders eingesetzt. Zwei getrennte Wege zum Hochladen, Löschen und Rechteprüfen würden früher oder später auseinanderlaufen — dieselbe Überlegung wie bei den Serienterminen in PROJ-54.
- **Bilder hängen am Event oder an der Serie.** Ein Serientermin hat keine eigenen; er zeigt die seiner Serie. Genau das war die Produktentscheidung, und es erspart der Verwaltung, jede Woche dieselben Fotos neu hochzuladen.
- **Videos bleiben Links.** Die datensparsame Einbettung aus PROJ-11 wird wiederverwendet, statt eine zweite zu bauen.
- **Ein Titelbild ersetzen heißt: das alte verschwindet.** Es wird nicht nur ausgeblendet, sondern gelöscht — sonst füllte sich der Speicher mit Bildern, die niemand mehr sieht, und das Studio bewahrte Fotos auf, für die es keinen Grund mehr hat.
- **Wird ein Event oder eine Serie gelöscht, gehen die Bilder mit.** Auch im Bildspeicher, nicht nur in der Datenbank.
- **Grenzen: 10 MB je Bild, 20 Bilder je Event** — der Vorschlag aus der Spezifikation. Der Knopf nennt die Grenze, bevor er sie durchsetzt.
- **Das Titelbild geht auch an Google und an die Link-Vorschau.** Die Eventseite meldet ihre Daten schon an Suchmaschinen (PROJ-53); das Bild kommt dort dazu, ohne dass etwas Neues gebaut werden muss.

### D) Abhängigkeiten (Pakete)
Keine neuen Pakete. Das Verkleinern erledigt der Browser, das Ausliefern in passender Größe erledigt Next.js, den Bildspeicher bringt Supabase mit.

### Auswirkungen auf Bestehendes
- **Migration:** zwei neue Tabellen und ein Bereich im Bildspeicher samt Regeln. Auslieferung wie gehabt: erst Migration, dann Code.
- **Konfiguration:** Der Bildspeicher muss einmalig als erlaubte Bildquelle eingetragen werden — sonst zeigt die Seite nichts an.
- **Die Event-Karte sieht anders aus.** Die Tests aus PROJ-53 prüfen ihren Inhalt und brauchen einen Blick.
- **Datenschutzerklärung:** keine Änderung nötig (siehe oben).
- **Bilder ohne Beschreibung** bekommen den Eventnamen als Alternativtext — die Seite bleibt vorlesbar, auch wenn jemand das Feld leer lässt.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
