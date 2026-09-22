# PROJ-63: Bildausschnitt für das Event-Titelbild

## Status: Planned
**Created:** 2026-09-22
**Last Updated:** 2026-09-22

## Dependencies
- Requires: PROJ-55 (Bilder & Videos für Events) — Titelbild, Bilder-Dialog, `event_images`
- Berührt: PROJ-53 (Veranstaltungsprogramm) — die Event-Karte in der Übersicht
- Berührt: PROJ-54 (Event-Serien) — eine Serie hat ein eigenes Titelbild

## Anlass

Auf der Eventseite wird das Titelbild ganz gezeigt. In der Übersicht unter „Events" sitzt es in
einer Karte im festen Querformat 16:9, damit alle Karten gleich hoch sind — und dort wird es
zugeschnitten, immer mittig. Bei einem hochformatigen Flyer sieht man deshalb den Mittelstreifen:
Der Titel oben und das Datum unten fallen weg, obwohl gerade sie die Karte verkaufen sollen.

Der Betreiber kann das heute nur umgehen, indem er den Flyer außerhalb der App zuschneidet und das
zugeschnittene Bild hochlädt — dann fehlt derselbe Teil aber auch auf der Eventseite.

## User Stories

- Als Admin möchte ich beim Titelbild festlegen, welcher Teil in der Übersicht zu sehen ist, damit
  der Titel des Flyers auf der Karte nicht abgeschnitten wird.
- Als Admin möchte ich schon beim Einstellen sehen, wie die Karte später aussieht, damit ich nicht
  zwischen Verwaltung und Website hin- und herspringen muss.
- Als Admin möchte ich für ein Serien-Titelbild dasselbe tun können, weil die Serienkarte genauso
  zuschneidet.
- Als Admin möchte ich nichts einstellen müssen, wenn mir der mittige Ausschnitt passt.
- Als Besucherin möchte ich auf der Eventseite weiterhin den ganzen Flyer sehen, auch wenn die Karte
  nur einen Teil zeigt.

## Out of Scope

- **Freies Verschieben in beide Richtungen** — ein Regler je Bild genügt; welche Richtung er
  bewegt, entscheidet das Seitenverhältnis (siehe Acceptance Criteria).
- **Zoom oder freies Zuschneiden** (Größe des Ausschnitts wählen) — der Ausschnitt bleibt immer die
  volle Breite bzw. Höhe des Bildes im Kartenformat.
- **Galeriebilder** — die Vorschaubilder der Galerie sind quadratisch und ebenfalls zugeschnitten,
  aber ein Klick zeigt das ganze Bild. Ein Regler je Galeriebild würde den Dialog überladen.
- **Das Bild selbst verändern** — es wird nichts zugeschnitten und nichts neu gespeichert, nur die
  Anzeige verschoben. Das Original bleibt unangetastet.
- **Vorschaubild beim Teilen** (WhatsApp, Facebook) — dort schneidet der jeweilige Dienst selbst zu;
  darauf hat die App keinen Einfluss, solange sie das Bild nicht serverseitig zuschneidet.
- **Kurse und Lehrerbilder** — dieses Projekt betrifft ausschließlich Event- und Serien-Titelbilder.

## Acceptance Criteria

- [ ] Angenommen ein Event hat ein Titelbild, wenn der Admin den Bilder-Dialog öffnet, dann steht
      unter dem Titelbild ein Schieberegler „Bildausschnitt" samt einer Vorschau im Kartenformat
      (16:9), die genau den Teil zeigt, der später auf der Karte erscheint.
- [ ] Angenommen der Admin bewegt den Regler, wenn er ihn loslässt, dann ist der Wert gespeichert
      und eine kurze Rückmeldung bestätigt das.
- [ ] Angenommen der Admin bewegt den Regler, wenn er ihn noch hält, dann folgt die Vorschau der
      Bewegung sofort, ohne Speichern.
- [ ] Angenommen ein Titelbild ist hochformatig oder quadratisch (schmäler als 16:9), wenn der Admin
      den Regler bewegt, dann verschiebt sich der sichtbare Teil nach oben oder unten.
- [ ] Angenommen ein Titelbild ist breiter als 16:9, wenn der Admin den Regler bewegt, dann
      verschiebt sich der sichtbare Teil nach links oder rechts, und die Beschriftung sagt das.
- [ ] Angenommen ein Bild ist genau 16:9, wenn der Admin den Dialog öffnet, dann erscheint kein
      Regler, sondern der Hinweis, dass hier nichts zugeschnitten wird.
- [ ] Angenommen der Admin hat einen Ausschnitt eingestellt, wenn eine Besucherin die Übersicht
      „Events" aufruft, dann zeigt die Karte genau diesen Ausschnitt.
- [ ] Angenommen der Admin hat einen Ausschnitt eingestellt, wenn eine Besucherin die Eventseite
      aufruft, dann ist dort weiterhin das ganze Bild zu sehen.
- [ ] Angenommen ein Titelbild wurde vor diesem Projekt hochgeladen, wenn niemand etwas einstellt,
      dann bleibt es mittig zugeschnitten wie bisher.
- [ ] Angenommen der Admin hat einen Ausschnitt eingestellt, wenn er das Titelbild durch ein anderes
      ersetzt, dann beginnt das neue Bild wieder mittig.
- [ ] Angenommen eine Serie hat ein Titelbild, wenn der Admin den Regler dort benutzt, dann wirkt er
      auf der Serienkarte genauso wie bei einem Event.
- [ ] Angenommen jemand ohne Verwaltungsrechte versucht, den Wert zu setzen, dann weist die
      Datenbank ihn ab.

## Edge Cases

- **Sehr schmales Hochformat** (z. B. 9:16): Der Regler bewegt viel Bild durch ein kleines Fenster.
  Die Vorschau ist hier besonders wichtig — ohne sie träfe niemand den Titel.
- **Bild genau im Kartenformat**: Es gibt nichts zu verschieben. Statt eines wirkungslosen Reglers
  steht dort ein Satz, der das erklärt.
- **Kein Titelbild**: Der Regler erscheint gar nicht — die Karte zeigt dann die Farbfläche mit der
  Eventart.
- **Zwei Verwaltungskonten gleichzeitig am selben Event**: Der zuletzt losgelassene Regler gewinnt.
  Das ist unkritisch, weil der Wert eine einzelne Zahl ist und jederzeit neu gesetzt werden kann.
- **Ausschnitt eingestellt, dann Bild ersetzt**: Der alte Wert darf nicht am neuen Bild kleben — er
  gehört zum Bild, nicht zum Event, und verschwindet deshalb mit ihm.
- **Sehr alte Bilder ohne gespeicherte Maße**: Kommt nicht vor, `width`/`height` sind seit PROJ-55
  Pflichtfelder. Die Richtung des Reglers lässt sich daraus immer bestimmen.

## Technical Requirements

- Die Vorschau arbeitet mit dem bereits geladenen Bild — kein zusätzlicher Serverabruf beim Ziehen.
- Der Wert wird gespeichert, wenn der Regler losgelassen wird, nicht bei jeder Bewegung.
- Der Regler ist mit der Tastatur bedienbar (Pfeiltasten) und hat eine sprechende Beschriftung.
- Die Karte darf durch die Änderung nicht langsamer werden: Der Ausschnitt ist eine Angabe an das
  bestehende Bildelement, kein zweites Bild und keine serverseitige Bearbeitung.
- Schreiben darf nur die Verwaltung; die Regel dafür gehört in die Datenbank, nicht nur ins
  Formular.

## Open Questions

- [ ] Soll später auch das Vorschaubild beim Teilen (WhatsApp/Facebook) dem eingestellten Ausschnitt
      folgen? Das bräuchte serverseitiges Zuschneiden und wäre ein eigenes Projekt.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Ein Regler statt eines Zuschneide-Rahmens zum Ziehen | Bei einem festen 16:9-Fenster ist nur eine Richtung überhaupt verschiebbar. Ein Regler gibt dieselbe Freiheit, ist mit dem Finger und mit der Tastatur bedienbar und in den Browsertests deutlich verlässlicher als Ziehen. | 2026-09-22 |
| Richtung automatisch aus dem Seitenverhältnis | Hochformat schneidet oben/unten ab, Panorama links/rechts. Ein fest senkrechter Regler wäre bei breiten Bildern wirkungslos, zwei Regler stünden meistens zur Hälfte nutzlos da. | 2026-09-22 |
| Der Ausschnitt gilt nur für die Karte, nicht für die Eventseite | Die Eventseite zeigt den Flyer bewusst ganz (PROJ-55). Ein Ausschnitt dort würde genau das zerstören, wofür die Seite da ist. | 2026-09-22 |
| Standard bleibt „mittig" | So sieht alles Bestehende unverändert aus; niemand muss etwas nachpflegen. | 2026-09-22 |
| Der Wert gehört zum Bild, nicht zum Event | Ein neues Bild bringt einen neuen Ausschnitt mit. Am Event gespeichert, würde der alte Wert am neuen Bild kleben. | 2026-09-22 |
| Galeriebilder bleiben außen vor | Ihre Vorschaubilder sind klein, und ein Klick zeigt ohnehin das ganze Bild. Ein Regler je Galeriebild würde den Dialog überladen. | 2026-09-22 |

### Technical Decisions
<!-- Added by /architecture -->

| Decision | Rationale | Date |
|----------|-----------|------|
| Eine Zahl (0–100) statt zweier Koordinaten | In einem festen 16:9-Fenster ist immer nur **eine** Richtung verschiebbar; welche, verrät das gespeicherte Seitenverhältnis. Zwei Zahlen wären eine davon immer 50. | 2026-09-22 |
| Die Angabe steht am Bild, nicht am Event | Ein neues Titelbild bringt einen neuen Ausschnitt mit. Am Event gespeichert, würde der alte Wert am neuen Bild kleben — und niemand käme darauf, warum das Bild schief sitzt. | 2026-09-22 |
| Anzeige verschieben statt Bild zuschneiden | Kein zweites Bild, kein Speicherplatz, keine Serverarbeit, sofort wirksam, jederzeit zurücknehmbar. Serverseitiges Zuschneiden wäre nur nötig, wenn auch das Teilen-Vorschaubild folgen soll — das ist bewusst offen. | 2026-09-22 |
| Der Ausschnitt lebt im gemeinsamen Titelbild-Baustein | Karte, Serienkarte und die Vorschau im Dialog zeichnen dasselbe Bauteil. So kann die Vorschau nicht anders aussehen als die Karte. | 2026-09-22 |
| Speichern beim Loslassen, nicht beim Ziehen | Aus einer Bewegung wird ein Speichervorgang statt dreißig. Die Vorschau bleibt trotzdem sofort. | 2026-09-22 |
| Keine neue Schreibregel in der Datenbank | Bilder darf bereits nur die Verwaltung ändern; die neue Angabe erbt das. Jede zusätzliche Regel wäre eine weitere, die auseinanderlaufen kann. | 2026-09-22 |

---

## Tech Design (Solution Architect)

### Was neu gebaut wird — und was bleibt

```
Bilder-Dialog (Verwaltung)
├── Titelbild
│   ├── Vorschau im Kartenformat 16:9   ← neu: zeigt live genau den Kartenausschnitt
│   ├── Regler „Bildausschnitt"          ← neu: eine Richtung, aus dem Bild abgeleitet
│   └── Hinweis statt Regler             ← neu: wenn das Bild schon 16:9 ist
│   (Titelbild wählen/ersetzen/entfernen, Beschreibung — unverändert)
└── Galerie, Videos                      — unverändert

Öffentliche Seiten
├── Event-Übersicht → Event-Karte  ── Titelbild mit dem gespeicherten Ausschnitt
├── Event-Übersicht → Serien-Karte ── dasselbe
└── Eventseite / Serienseite       ── ganzes Bild, unverändert
```

Der Baustein, der das Titelbild zeichnet, ist schon heute **einer für beide Auftritte** (Karte und
Seite). Genau dort kommt der Ausschnitt hinein — damit gilt er überall, wo eine Karte gezeigt wird,
ohne dass jede Seite es einzeln wissen muss. Die Vorschau im Dialog benutzt denselben Baustein.
Vorschau und Wirklichkeit können deshalb gar nicht auseinanderlaufen.

### Welche Angabe gespeichert wird

Zu jedem Bild kommt **eine einzige Zahl** dazu:

```
Bild (bereits vorhanden: Datei, Beschreibung, Breite, Höhe, Reihenfolge)
└── Ausschnitt: eine Zahl von 0 bis 100, Standard 50
    0   = am oberen bzw. linken Rand
    50  = mittig (das heutige Verhalten)
    100 = am unteren bzw. rechten Rand
```

Welche der beiden Bedeutungen gilt, muss **nicht** gespeichert werden: Ob ein Bild oben/unten oder
links/rechts beschnitten wird, ergibt sich aus Breite und Höhe, und die stehen seit PROJ-55 ohnehin
am Bild. Eine Zahl genügt also für beide Fälle.

Die Zahl steht **am Bild**, nicht am Event. Wird das Titelbild ersetzt, verschwindet sie mit dem
alten Bild — das neue beginnt wieder mittig, so wie es die Spec verlangt.

Gespeichert wird in der bestehenden Bildertabelle. Wer schreiben darf, ist dort bereits geregelt:
Bilder darf nur die Verwaltung ändern. Die neue Angabe erbt diese Regel, ohne dass eine zweite
dazukommt — eine Regel weniger, die auseinanderlaufen kann.

### Wie der Ausschnitt auf die Karte kommt

Es wird **nichts zugeschnitten und nichts neu gespeichert**. Die Karte zeigt weiterhin dieselbe
Bilddatei; die Zahl sagt dem Browser nur, welcher Teil davon im Kartenfenster liegen soll. Das ist
dieselbe Technik, die heute schon „mittig" bewirkt — sie war bisher nur fest eingestellt.

Folgen daraus, die für den Betrieb zählen:

- Kein zweites Bild, kein zusätzlicher Speicherplatz, keine Bildbearbeitung auf dem Server.
- Die Übersicht lädt keine Millisekunde langsamer.
- Eine Änderung wirkt sofort beim nächsten Aufruf der Seite; es muss nichts neu erzeugt werden.
- Das Original bleibt unangetastet — man kann jederzeit zurück auf mittig.

### Bedienung im Dialog

Der Regler erscheint nur, wenn es etwas zu verschieben gibt. Beim Ziehen bewegt sich ausschließlich
die Vorschau — gespeichert wird erst beim Loslassen, mit einer kurzen Rückmeldung. So entsteht aus
einer Bewegung ein Speichervorgang statt dreißig.

Beschriftung und Endpunkte richten sich nach der Richtung: „oben / unten" bei hochformatigen
Bildern, „links / rechts" bei sehr breiten. Die Pfeiltasten bewegen den Regler ebenfalls, damit die
Einstellung auch ohne Maus erreichbar ist.

### Benötigte Zutaten

- **Ein Regler-Baustein** aus der bereits verwendeten Oberflächen-Bibliothek (shadcn/ui `slider`) —
  im Projekt noch nicht installiert, wird einmal hinzugefügt. Kein neues Fremdpaket.
- Sonst nichts: keine Bildbibliothek, kein Zuschneide-Werkzeug, kein Dienst von außen.

### Reihenfolge beim Ausrollen

1. Die neue Angabe in der Datenbank anlegen (Standard „mittig") — danach sieht alles aus wie vorher.
2. Code ausrollen: Karte liest die Angabe, Dialog bietet den Regler an.

Beide Schritte sind für sich unauffällig: Nach Schritt 1 steht überall „mittig", nach Schritt 2 kann
der Betreiber es ändern. Ein Zurückrollen ist gefahrlos — bliebe die Angabe ungenutzt, sähen die
Karten wieder so aus wie heute.


## QA Test Results (2026-09-23)

**Empfehlung: bereit für die Produktion**, sobald die Migration auch dort eingespielt ist. Die
Testdatenbank hat sie, alle Prüfebenen sind grün.

| | |
|---|---|
| Regeln (Unit) | 15 |
| Browser (E2E) | 6, in beiden Browsern |
| Unit- und Datenbanktests gesamt | 922 |
| Produktfehler gefunden | 2 (beide behoben) |

### Was geprüft ist

**Die Regeln** entscheiden aus einer Quelle, in welche Richtung sich ein Bild schieben lässt und
welche Angabe daraus wird — geprüft an Hochformat, Quadrat, 4:3, Panorama, genau 16:9 und an
unsinnigen Maßen.

**Der Browser** geht den ganzen Weg: Titelbild hochladen, Regler **mit der Tastatur** bedienen, auf
die Bestätigung warten, den Wert in der Datenbank nachsehen und schließlich auf der öffentlichen
Karte messen, welcher Teil zu sehen ist. Dazu die Gegenprobe auf der Eventseite (ganzes Bild), der
Fall „Bild passt genau" (kein Regler, sondern ein Satz) und der Versuch, den Wert ohne
Verwaltungsrechte zu setzen.

### Gefundene Fehler

**BUG-1 (High, behoben): Der Ausschnitt klebte am ersetzten Bild.** Weil „höchstens ein Titelbild je
Event" eine Sperre in der Datenbank ist, bekommt beim Ersetzen die **vorhandene Zeile** das neue
Bild — die Beschreibung wurde dabei geleert, der Ausschnitt nicht. Ein Flyer, der auf „ganz oben"
stand, hätte den nächsten Flyer an derselben Stelle beschnitten, ohne dass jemand etwas eingestellt
hat. Gefunden von der Prüfung zu AC10, behoben in `saveEventBild`.

**BUG-2 (Medium, behoben): `null` hätte den Ausschnitt verstellt.** Die Begrenzung auf 0–100 lief
über `Number(wert)` — und `Number(null)` ist 0, also „ganz oben". Ein leeres Feld hätte damit nicht
„nichts ändern" bedeutet, sondern „ganz nach oben schieben". Gefunden von den Regeltests, behoben in
`begrenzeAusschnitt`.

### Nicht geprüft

Das Aussehen selbst — dass der gewählte Ausschnitt *gut* aussieht, entscheidet ein Mensch. Geprüft
ist, dass die Karte genau den Teil zeigt, der eingestellt wurde.

Firefox ist im Projekt weiterhin nicht eingerichtet.

