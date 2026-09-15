# PROJ-55: Bilder & Videos für Events

## Status: In Progress
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

## Implementation Notes (Frontend)

**Stand 2026-09-15:** Frontend fertig. Im Browser läuft es erst mit der Migration aus `/backend` — die Seiten lesen die beiden neuen Tabellen, und der Bildspeicher existiert noch nicht. Unit-Tests 655 in 58 Dateien, Typprüfung, Lint und `npm run build` sauber.

### Gebaut
- **Gemeinsame Grundlage** `src/lib/events/medien.ts` (12 neue Tests): Grenzen (10 MB je Bild, 20 Bilder je Event, längste Kante 2000 Pixel), die Prüfung einer ausgewählten Datei samt eigener Meldung für iPhone-Fotos, die Rechnung fürs Verkleinern, die öffentliche Adresse eines Bildes und der Alternativtext, der bei leerer Beschreibung den Eventnamen einsetzt.
- **Verkleinern im Browser** `src/lib/bilder/verkleinern.ts`: Das Bild wird auf eine Leinwand neu gezeichnet und als WebP gespeichert. Damit fällt jedes Metadatenfeld weg — auch die GPS-Koordinaten —, und ein 6000-Pixel-Foto geht nicht mehr in voller Größe durchs Netz.
- **Titelbild** `event-titelbild.tsx`: auf der Karte im festen Querformat, auf der Seite ganz. Ohne Bild eine Fläche in den Studiofarben mit der Eventart statt eines leeren Rahmens.
- **Galerie** `event-galerie.tsx`: Raster, das erst beim Hinscrollen lädt, und eine Großansicht mit Blättern, Wischen, Pfeiltasten, Escape und Klick daneben. Unter dem Bild stehen Beschreibung und „Bild 2 von 7".
- **Videos** `event-videos.tsx`: dieselbe Einbettung wie die Beispiel-Videos aus PROJ-11, nicht eine zweite eigene.
- **Verwaltung** `medien-dialog.tsx`: je Zeile in Event- und Serienliste ein Knopf „Bilder & Videos". Dahinter Titelbild wählen oder ersetzen, Galerie hochladen (mehrere auf einmal), Reihenfolge, Bildbeschreibung, Entfernen — und YouTube-Links mit Titel und Reihenfolge. Oben der Hinweis auf Bildrechte und Einverständnis.
- **Server-Aktionen** `src/lib/actions/admin/event-medien.ts`: lesen, eintragen, Beschreibung ändern, entfernen, Reihenfolge tauschen — für Bilder und Videos durch dieselbe Tauschfunktion.
- **Link-Vorschau und Google** bekommen das Titelbild: die Eventseite über `openGraph.images`, die Suchmaschinen über das Feld `image` in den Event-Daten. Bei einer Serie gilt es für jeden ihrer Termine.
- **Konfiguration:** Der Bildspeicher ist als erlaubte Bildquelle eingetragen; ohne diesen Eintrag zeigte Next.js die Bilder nicht an, ohne dass etwas im Log stünde.

### Entscheidungen beim Bauen
- **Der Browser lädt die Datei direkt in den Bildspeicher, nicht durch die Server-Aktion.** Server-Aktionen sind für Formularfelder gedacht und begrenzen die Menge; ein Foto gehört nicht hindurch. Danach meldet die App das Bild.
- **Der Server glaubt dem Browser nicht.** Bevor ein Eintrag entsteht, fragt die Server-Aktion den Bildspeicher selbst nach Typ und Größe der Datei, die dort wirklich liegt. Findet sie nichts, ist der Upload steckengeblieben — dann entsteht kein Eintrag ohne Bild. Schlägt das Eintragen fehl, wird die Datei wieder weggeräumt.
- **Reihenfolge als fortlaufende Zahl, nicht aus der Uhrzeit abgeleitet.** Der erste Entwurf nahm die Millisekunden — das sortiert anfangs richtig und irgendwann falsch.
- **Titelbild ersetzen löscht das alte**, in der Datenbank und im Bildspeicher.

### Abweichungen und Offenes
- `src/lib/supabase/types.ts` ist erneut **von Hand** ergänzt (`event_images`, `event_videos`) — nach der Migration neu erzeugen und abgleichen.
- Es gibt noch **keine E2E-Tests**; sie kommen in der QA, weil sie echte Uploads gegen den Bildspeicher brauchen.
- Die Prüfung „nur Bildformate, höchstens 10 MB" steht bisher im Browser und in der Server-Aktion. Die **dritte, verlässliche Schranke gehört an den Bildspeicher selbst** (erlaubte Typen und Höchstgröße am Bereich) — das liefert `/backend`.

### Was `/backend` liefern muss
- Tabellen **`event_images`** und **`event_videos`** mit RLS: lesen alle, schreiben nur Admins. Beide hängen wahlweise an einem Event oder an einer Serie — genau eines von beiden, und mit Löschweitergabe, damit nichts zurückbleibt.
- **Bildspeicher-Bereich `event-bilder`**: öffentlich lesbar, schreiben und löschen nur für Admins, erlaubte Typen JPG/PNG/WebP, Höchstgröße 10 MB.
- **Aufräumen beim Löschen:** Verschwindet ein Event oder eine Serie, müssen auch die Dateien im Bildspeicher gehen — die Datenbank allein räumt dort nichts weg.
- Danach `types.ts` erzeugen und mit der Handfassung abgleichen.

## Implementation Notes (Backend)

**Stand 2026-09-15:** Backend fertig. Migration `supabase/migrations/20260915180000_proj55_event_bilder_videos.sql` — erst einspielen, dann den Code ausliefern. Unit-Tests 660 in 59 Dateien, Typprüfung, Lint und `npm run build` sauber.

### Datenbank
- **`event_images`**: Ziel (Event **oder** Serie, durch eine Sperre genau eines von beiden), Rolle Titelbild oder Galerie, Ablageort, Bildbeschreibung, Breite, Höhe, Reihenfolge. Die Maße stehen mit in der Zeile, damit die Seite den Platz kennt, bevor das Bild geladen ist — sonst springt der Text. Indizes auf beide Ziele.
- **Höchstens ein Titelbild je Event und je Serie**, als Sperre in der Datenbank. Die Verwaltung tauscht es aus; ohne die Sperre stünden nach zwei gleichzeitigen Versuchen zwei da, und die Karte zeigte das zufällig erste.
- **`event_videos`**: Ziel wie oben, die YouTube-Kennung (auf ihre Form geprüft), Titel, Reihenfolge. Gespeichert wird die Kennung, nicht der ganze Link — daraus baut die App die Einbettung ohne Cookies.
- **Löschweitergabe:** Verschwindet ein Event oder eine Serie, gehen Bild- und Videoeinträge mit.
- **RLS auf beiden Tabellen:** lesen alle (es sind die Bilder öffentlicher Seiten), schreiben nur Admins.

### Bildspeicher
- Bereich **`event-bilder`**: öffentlich lesbar, Höchstgröße 10 MB, erlaubte Typen JPG, PNG und WebP. **Hier sitzt die verlässliche Schranke** — die Prüfung im Browser ist bequem, aber umgehbar.
- Rechte am Bildspeicher wie an den Tabellen: lesen alle, hochladen, ändern und löschen nur Admins.

### Aufräumen
- **Nächtlicher Schritt „verwaiste-bilder"** `src/lib/events/bilder-aufraeumen.ts` (5 Tests): Er entfernt Dateien, zu denen kein Eintrag gehört. Nötig, weil die Datenbank im Bildspeicher nichts wegräumt — verschwindet ein Event, ist der Eintrag weg und die Datei bleibt liegen. Derselbe Schritt fängt den anderen Fall mit: Jemand schließt den Browser, nachdem die Datei angekommen ist, aber bevor die App davon erfährt.
- **Eine Schonfrist von einem Tag** gehört dazu: Zwischen dem Ankommen einer Datei und ihrem Eintrag liegen Sekunden, und der Lauf darf nicht ausgerechnet dann zuschlagen.
- Die Prüfung der Bildeinträge ist ausdrücklich abgesichert: Eine leere Liste ohne Fehlerprüfung sähe aus wie „kein Bild ist eingetragen" — und der Lauf löschte den ganzen Bestand.

### Nach der Migration noch offen
- `src/lib/supabase/types.ts` neu erzeugen und mit der Handfassung abgleichen (`event_images`, `event_videos`). Der MCP-Zugang war am 2026-09-15 nicht verbunden (HTTP 401).

### Bewusst nicht gebaut
- **Kein Auslöser in der Datenbank, der Dateien löscht.** Das ginge nur über einen Netzaufruf aus der Datenbank heraus, samt Zugangsschlüssel in der Datenbank. Der nächtliche Schritt erledigt dasselbe, ohne ein Geheimnis an einen zweiten Ort zu legen.
- **Keine Bildbearbeitung auf dem Server.** Verkleinert wird auf dem Gerät; der Server prüft nur, was angekommen ist.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
