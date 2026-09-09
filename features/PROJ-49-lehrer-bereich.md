# PROJ-49: Eigener Bereich für Lehrer

## Status: Deployed
**Created:** 2026-09-09
**Last Updated:** 2026-09-09

## Dependencies
- Requires: PROJ-13 (Lehrer-Ansicht) — liefert „Meine Kurse", die Anwesenheitsmatrix und die Notizen
- Requires: PROJ-45 (Kunden-Dashboard) — stellt `/mein-bereich`, dessen Inhalt für Lehrer ersetzt wird
- Requires: PROJ-23 (Videosätze) — das Lehrmaterial, seit 2026-09-08 auf der Kursseite sichtbar
- Requires: PROJ-31 (Geburtstags-Erinnerung) — liefert die Datumslogik samt Zeitfenster
- Requires: PROJ-30 (Leader/Follower) — liefert die erfasste Rolle je Buchung
- Requires: PROJ-40 (Admin auch als Lehrer) — bestimmt, wer als Lehrer gilt

## Problem
`/mein-bereich` zeigt jedem dasselbe: nächster Kurs, diese Woche, Anwesenheit,
Übungsvideos, Guthaben. Für einen Lehrer ist davon fast nichts brauchbar — er
unterrichtet die Kurse, statt sie zu besuchen. Was er tatsächlich braucht,
liegt heute verstreut: Seine Kurse stehen ohne Termine und Zeiten auf
`/lehrer`, die Anwesenheit zwei Klicks tiefer, das Lehrmaterial dahinter, und
ob heute jemand Geburtstag hat, erfährt er erst in der Anwesenheitsliste.

## User Stories
- Als Lehrer möchte ich nach dem Login sehen, welche Kurse ich in den nächsten Tagen unterrichte, damit ich weiß, was ansteht, ohne die Kursliste durchzugehen.
- Als Lehrer möchte ich von dort mit einem Klick in die Anwesenheitsliste des Kurses kommen, damit ich zu Stundenbeginn nicht suchen muss.
- Als Lehrer möchte ich von dort das Lehrmaterial meines Kurses erreichen, damit ich mich vorbereiten kann.
- Als Lehrer möchte ich sehen, welche meiner Schüler in den nächsten Tagen Geburtstag haben, damit ich gratulieren oder eine Kleinigkeit mitbringen kann.
- Als Lehrer möchte ich vorher wissen, wenn jemand zur Probestunde kommt, damit ich mich auf einen neuen Menschen einstellen kann statt vor einem unbekannten Gesicht zu stehen.
- Als Lehrer möchte ich erinnert werden, wenn ich für eine gehaltene Stunde keine Anwesenheit erfasst habe, damit die Zahlen des Studios vollständig bleiben.
- Als Lehrer möchte ich meine letzte Notiz zum nächsten Kurs sehen, damit ich dort weitermache, wo ich aufgehört habe.
- Als Lehrer möchte ich die Verteilung von Leadern und Followern kennen, bevor ich die Stunde plane.

## Out of Scope
- **Kurs ausfallen lassen durch den Lehrer** — bleibt Admin-Sache (PROJ-38). Ein Ausfall verschickt Mails an alle Teilnehmer; wer das darf, ist eine eigene Entscheidung und kein Beifang eines Dashboards.
- **„Neu im Kurs seit der letzten Stunde"** — im Interview besprochen und zurückgestellt. Nett, aber der schwächste der vorgeschlagenen Blöcke.
- **Event-Check-in** (`/checkin`, PROJ-14) — nicht kursbezogen und für den Lehrer ohnehin dauerhaft in der Navigation.
- **Eigene Kundenansicht des Lehrers innerhalb dieses Bereichs** — bewusst ersetzt, und ohne Ersatzlink: Lehrer besuchen die Kurse kostenlos, haben also keine Abos, Rechnungen oder Guthaben anzuzeigen.
- **Anzeige des Alters bei Geburtstagen** — wie in PROJ-31 aus Datenschutzgründen ausgeschlossen; nur Name und Datum.
- **Bearbeiten von Notizen im Lehrer-Bereich** — nur Anzeige; geschrieben wird weiterhin auf der Kursseite.

## Acceptance Criteria

- [ ] Angenommen ein Lehrer ist angemeldet, wenn er `/mein-bereich` aufruft, dann sieht er den Lehrer-Bereich und nicht die Kundenansicht
- [ ] Angenommen ein Kunde ohne Lehrerzuweisung ist angemeldet, wenn er `/mein-bereich` aufruft, dann sieht er unverändert die bisherige Kundenansicht
- [ ] Angenommen ein Admin unterrichtet mindestens einen Kurs, wenn er `/mein-bereich` aufruft, dann sieht er den Lehrer-Bereich
- [ ] Angenommen ein Admin unterrichtet keinen Kurs, wenn er `/mein-bereich` aufruft, dann sieht er die Kundenansicht
- [ ] Angenommen ein Lehrer unterrichtet Kurse mit Terminen in den nächsten 7 Tagen, wenn er den Bereich öffnet, dann sieht er diese Termine in zeitlicher Reihenfolge mit Datum, Uhrzeit, Kursname und Ort
- [ ] Angenommen ein Termin wird angezeigt, wenn der Lehrer die Aktion „Anwesenheit" wählt, dann landet er auf der Kursseite bei der Anwesenheitsmatrix
- [ ] Angenommen der Kurs hat einen Videosatz, wenn der Lehrer die Aktion „Lehrmaterial" wählt, dann landet er auf der Kursseite beim Lehrmaterial
- [ ] Angenommen der Kurs hat keinen Videosatz, wenn der Termin angezeigt wird, dann erscheint die Aktion „Lehrmaterial" nicht
- [ ] Angenommen ein Schüler aus einem Kurs des Lehrers hat in den nächsten 7 Tagen Geburtstag, wenn der Lehrer den Bereich öffnet, dann sieht er Name und Datum — ohne Altersangabe
- [ ] Angenommen ein Kunde hat für einen Kurs des Lehrers eine Probestunde in den nächsten 7 Tagen gebucht, wenn der Lehrer den Bereich öffnet, dann sieht er Name, Kurs und Termin
- [ ] Angenommen für einen der letzten vier Termine eines Kurses wurde keine Anwesenheit erfasst, wenn der Lehrer den Bereich öffnet, dann wird dieser Termin genannt und führt auf die Kursseite
- [ ] Angenommen für alle letzten vier Termine wurde Anwesenheit erfasst, wenn der Lehrer den Bereich öffnet, dann erscheint der Hinweis gar nicht
- [ ] Angenommen zum nächsten Kurs existiert eine Notiz aus einer früheren Stunde, wenn der Lehrer den Bereich öffnet, dann sieht er deren Text beim Termin
- [ ] Angenommen ein Kurs fragt die Tanzrolle ab, wenn ein Termin dieses Kurses angezeigt wird, dann steht dabei die Verteilung von Leadern, Followern und „beides"
- [ ] Angenommen ein Kurs fragt die Tanzrolle nicht ab, wenn ein Termin dieses Kurses angezeigt wird, dann erscheint keine Verteilung
- [ ] Angenommen ein Lehrer hat in den nächsten 7 Tagen keinen Termin, wenn er den Bereich öffnet, dann sieht er einen erklärenden Leerzustand statt einer leeren Seite

## Edge Cases
- **Kurs ohne hinterlegten Wochentermin** — taucht in der 7-Tage-Liste nicht auf; er hat keinen Termin. Kein Fehler, aber auch kein stiller Verlust: Die Kursliste auf `/lehrer` zeigt ihn weiterhin.
- **Ausgefallener Termin** (`course_schedule_pauses`) — wird nicht als anstehender Termin gezeigt und **nicht** als fehlende Anwesenheit angemahnt. Eine Stunde, die nicht stattgefunden hat, kann keine Anwesenheit haben.
- **Lehrer ohne jede Kurszuweisung** — kommt vor (`/lehrer` leitet ihn heute weg). Er sieht die Kundenansicht, nicht einen leeren Lehrer-Bereich.
- **Schüler ohne hinterlegtes Geburtsdatum** — erscheint schlicht nicht in der Geburtstagsliste.
- **Zwei Lehrer im selben Kurs** — beide sehen denselben Termin, dieselbe Notiz, dieselbe Anwesenheitslücke. Kein Besitzanspruch auf eine Notiz.
- **Probestunde am selben Tag gebucht** — erscheint sofort, nicht erst am nächsten Tag.
- **Termin heute, Stunde läuft gerade** — zählt als anstehend, nicht als vergangen; die Anwesenheit wird ja erst währenddessen erfasst.

## Technical Requirements
- Zugriff nur für angemeldete Nutzer mit Lehrer-Eigenschaft (`isTeachingUser`, PROJ-40) — dieselbe Prüfung wie in der Navigation und auf `/lehrer`, damit es nicht zwei Wahrheiten gibt.
- Alle Zeitangaben in Wiener Zeit (`heuteInWien`), nicht UTC.
- Die Daten anderer Lehrer bleiben unsichtbar: Geburtstage, Probestunden und Notizen nur zu Kursen, denen der Lehrer zugewiesen ist.

## Open Questions
- [x] Zählen als „Schüler" für die Geburtstage nur Kunden mit aktivem Abo im jeweiligen Kurs? → Ja, nur aktive Abos. Probestunden- und Drop-in-Gäste bleiben außen vor (2026-09-09)
- [x] Soll der Lehrer-Bereich einen Link „Zur Kundenansicht" bekommen? → Nein. Lehrer besuchen die Kurse des Studios kostenlos und haben deshalb keine Abos, Rechnungen oder Guthaben; die Kundenansicht wäre für sie ohnehin weitgehend leer (2026-09-09)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| `/mein-bereich` **ersetzt** die Kundenansicht für Lehrer, statt sie zu ergänzen | Vom Betreiber gewählt. Klarer und aufgeräumter; die eigentlichen Daten eines Lehrers mit eigenem Abo (Abos, Rechnungen, Buchungen, Guthaben, Tickets, Warteliste) liegen ohnehin vollständig unter „Mein Profil", das in der Navigation für jeden sichtbar bleibt | 2026-09-09 |
| Zeitfenster nach vorn: 7 Tage | Die Kurse laufen wöchentlich — in sieben Tagen erscheint jeder Kurs genau einmal, ohne Wiederholung. Deckt sich mit dem Admin-Dashboard bei den Geburtstagen und lässt Vorlauf für eine Geste | 2026-09-09 |
| „Check-in" führt zur **Kursanwesenheit**, nicht zum Event-Check-in | Im Interview auseinandergehalten: `/checkin` ist der QR-Scanner für Events (PROJ-14) und nicht kursbezogen. Der Handgriff, den ein Lehrer in jeder Stunde braucht, ist die Anwesenheitsmatrix | 2026-09-09 |
| Fehlende Anwesenheit nur für die letzten vier Termine | Etwa ein Monat: lang genug, dass eine vergessene Woche auffällt, kurz genug, dass keine Dauermahnung entsteht. Eine lange Liste alter Termine wird ignoriert — und dann auch die neuen darin | 2026-09-09 |
| Sieben Blöcke in der ersten Fassung statt einer schlanken Erstversion | Vom Betreiber gewählt; alle vier zusätzlich vorgeschlagenen Blöcke aufgenommen. Sie greifen auf bereits erfasste Daten zu, es entsteht kein neues Erfassungsverfahren | 2026-09-09 |
| Kein Link „Zur Kundenansicht" | Lehrer besuchen die Kurse kostenlos. Ohne Abo gibt es weder Rechnung noch Guthaben noch Übungsvideos zu einem eigenen Kurs — die Ansicht hätte nichts zu zeigen. Das nimmt der Entscheidung „Ersetzen" ihren Preis | 2026-09-09 |
| Kurs ausfallen lassen bleibt draußen | Verschickt Mails an alle Teilnehmer. Wer das darf, gehört bewusst entschieden statt nebenbei erweitert | 2026-09-09 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Die Weiche sitzt in der Seite, nicht in einer neuen Adresse | „Mein Bereich" bleibt der eine Ort nach dem Login. Eine zweite Adresse hiesse, dass Lehrer zwei Startseiten im Kopf behalten müssten | 2026-09-09 |
| Die bestehende Frage „unterrichtet diese Person?" wird wiederverwendet | Navigation und „Meine Kurse" stellen sie bereits. Zwei Antworten auf dieselbe Frage laufen früher oder später auseinander — dann stünde der Menüpunkt da, während der Bereich ihn nicht kennt | 2026-09-09 |
| Terminberechnung wiederverwenden statt neu schreiben | Wochentermin minus Ausfälle ist bereits gelöst und getestet. Eine zweite Rechnung würde bei Kursausfällen anders antworten als die Kursseite | 2026-09-09 |
| Rolle, Notiz und Aktionen stehen im Termin, nicht in eigenen Blöcken | Wer eine Stunde vorbereitet, soll nicht drei Listen nebeneinanderlegen müssen | 2026-09-09 |
| Derselbe Block-Rahmen wie im Kunden-Dashboard | Bringt die Regel „ein Block ohne Inhalt erscheint gar nicht" mit. Ein Lehrer ohne Probestunde sieht dann keine leere Überschrift | 2026-09-09 |
| Alle Daten in einem Rutsch und über alle Kurse gemeinsam | Sonst summieren sich die Wartezeiten, und ein Lehrer mit sechs Kursen wartet sechsmal so lang wie einer mit einem | 2026-09-09 |
| „Schüler" für die Geburtstage = Kunden mit aktivem Abo im jeweiligen Kurs | Vom Betreiber entschieden. Ein Probestunden- oder Drop-in-Gast ist niemand, dessen Geburtstag man kennt — und eine Liste, die jeden einmaligen Besucher enthält, wird ignoriert | 2026-09-09 |
| Keine neue Tabelle, keine neue Berechtigung | Alles ist für eine zugewiesene Lehrkraft schon lesbar. Der Bereich zeigt nur zusammen, was verstreut lag | 2026-09-09 |

---

## Tech Design (Solution Architect)

### Wo die Weiche sitzt

„Mein Bereich" bleibt eine einzige Adresse. Beim Aufruf wird einmal gefragt, ob
diese Person unterrichtet — dieselbe Frage, die schon die Navigation und die
Seite „Meine Kurse" stellen. Je nach Antwort erscheint der Lehrer-Bereich oder
die bisherige Kundenansicht.

Die Frage wird bewusst **nicht** neu formuliert, sondern die bestehende genutzt:
Zwei Stellen, die „unterrichtet diese Person?" unterschiedlich beantworten,
würden früher oder später auseinanderlaufen — dann stünde „Meine Kurse" in der
Navigation, während „Mein Bereich" die Kundenansicht zeigt.

### Aufbau der Seite

```
Mein Bereich
+-- unterrichtet diese Person?
    |
    +-- nein --> Kundenansicht            (unverändert, PROJ-45)
    |
    +-- ja ----> Lehrer-Bereich           (neu)
                 |
                 +-- Nächste Kurse (7 Tage)
                 |    +-- je Termin: Datum, Uhrzeit, Kurs, Ort
                 |    +-- je Termin: „Anwesenheit" und „Lehrmaterial"
                 |    +-- je Termin: Leader/Follower  (nur wo der Kurs danach fragt)
                 |    +-- beim nächsten Termin: die letzte Notiz
                 |
                 +-- Probestunden (7 Tage)
                 +-- Geburtstage (7 Tage)
                 +-- Fehlende Anwesenheit (letzte 4 Termine)
```

Rolle, Notiz und die beiden Aktionen stehen **im** jeweiligen Termin, nicht als
eigene Blöcke daneben. Wer die Stunde vorbereitet, will nicht drei Listen
nebeneinanderlegen, um zu wissen, was ihn erwartet.

Für die vier Blöcke wird derselbe Rahmen verwendet wie im Kunden-Dashboard. Er
bringt eine Regel mit, die hier genauso gilt: **Ein Block, der nichts zu sagen
hat, erscheint gar nicht.** Ein Lehrer ohne anstehende Probestunde sieht keine
leere Überschrift, sondern nichts.

### Was die Seite wissen muss

In Alltagssprache, ohne neue Datenstrukturen:

1. **Welche Kurse unterrichtet diese Person?** — steht bereits in der Zuordnung
   von Lehrkräften zu Kursen.
2. **Wann finden sie statt?** — aus dem Wochentermin des Kurses, abzüglich der
   eingetragenen Ausfälle. Diese Rechnung existiert schon und wird
   wiederverwendet, statt sie ein zweites Mal zu schreiben.
3. **Wurde die Anwesenheit erfasst?** — für jeden der letzten vier Termine die
   Frage „gibt es dazu Einträge?".
4. **Wer kommt zur Probestunde?** — Buchungen vom Typ Probestunde mit einem
   Termin im Fenster.
5. **Wer hat Geburtstag?** — die Schüler der eigenen Kurse, mit Geburtsdatum im
   Fenster. Ohne Altersangabe.
6. **Was stand zuletzt in den Notizen?** — die jüngste Notiz je Kurs.
7. **Wie verteilen sich Leader und Follower?** — aus der bei der Buchung
   erfassten Rolle, nur für Kurse, die danach fragen.

**Keine neue Tabelle, keine neue Berechtigung.** Alles davon darf eine
zugewiesene Lehrkraft heute schon lesen. Der Bereich zeigt nur zusammen, was
bisher verstreut lag.

### Wie die Daten geholt werden

Alle Angaben werden in **einem Rutsch** geholt, nicht Block für Block. Der
Kunden-Bereich macht das heute schon so; würde jeder Block einzeln nachfragen,
summierten sich die Wartezeiten sichtbar auf.

Ebenso werden die Fragen **über alle Kurse gemeinsam** gestellt, nicht je Kurs
einzeln. Ein Lehrer mit sechs Kursen soll nicht sechsmal so lange warten wie
einer mit einem.

### Zugriffsschutz

Der Bereich zeigt nur, was zu den eigenen Kursen gehört: keine Geburtstage
fremder Schüler, keine fremden Probestunden, keine fremden Notizen. Das ist
keine zusätzliche Prüfung, sondern ergibt sich daraus, dass alle Fragen bei den
eigenen Kurszuordnungen beginnen — und die Datenbank denselben Zaun ohnehin
zieht.

### Neue Pakete

Keine.

### Was danach zu prüfen ist

- Ein Lehrer mit **vielen** Kursen: Bleibt die Seite schnell? Die Antwort hängt
  daran, dass gebündelt gefragt wird, nicht je Kurs.
- Der Übergang von Sommer- zu Wintersemester: Kurse ohne Wochentermin fallen aus
  der Liste, ohne dass etwas kaputtgeht.

## QA Test Results

**Geprüft:** 2026-09-09
**Gegen:** lokale Testumgebung (Port 3100) + Produktion für die Erreichbarkeit
**Prüfer:** QA (AI)

### Akzeptanzkriterien: 16 von 16 bestanden

| # | Kriterium | Ergebnis | Nachweis |
|---|---|---|---|
| 1 | Lehrer sieht den Lehrer-Bereich | ✅ | E2E AC1 |
| 2 | Kunde sieht die Kundenansicht | ✅ | E2E AC2 |
| 3 | Admin, der unterrichtet, sieht den Lehrer-Bereich | ✅ | **neu** E2E AC3 |
| 4 | Admin ohne Kurs sieht die Kundenansicht | ✅ | **neu** E2E AC4 |
| 5 | Termine mit Datum, Uhrzeit, Kursname, Ort | ✅ | E2E AC5 |
| 6 | „Anwesenheit" führt zur Anwesenheitsmatrix | ✅ | E2E AC6 + Messung |
| 7 | „Lehrmaterial" führt zum Lehrmaterial | ✅ | **neu** E2E AC7 |
| 8 | Ohne Videosatz keine Aktion „Lehrmaterial" | ✅ | E2E AC8 |
| 9 | Geburtstag ohne Altersangabe | ✅ | E2E AC9 |
| 10 | Probestunde mit Name, Kurs, Termin | ✅ | E2E AC10 |
| 11 | Fehlende Anwesenheit wird genannt | ✅ | E2E AC11 |
| 12 | Ist alles erfasst, erscheint der Hinweis nicht | ✅ | **neu** E2E AC12 |
| 13 | Letzte Notiz beim nächsten Termin | ✅ | E2E AC13 |
| 14 | Rollenverteilung, wo der Kurs sie abfragt | ✅ | E2E AC14 |
| 15 | Keine Verteilung, wo er sie nicht abfragt | ✅ | E2E AC14 |
| 16 | Leerzustand statt leerer Seite | ✅ | E2E AC16 |

Zu AC6 und AC7: Beide Aktionen führen auf dieselbe Adresse `/lehrer/{kursId}`.
Gemessen statt angenommen — auf der Kursseite steht das Lehrmaterial bei y=266,
die Anwesenheitsmatrix bei y=376, bei Viewport-Höhen von 664 (iPhone 13) und
720 px. **Beides liegt ohne Scrollen im Bild**, das Kriterium „landet bei …" ist
damit erfüllt. Ein Anker wäre unnötige Mechanik.

### Edge Cases

| Fall | Ergebnis |
|---|---|
| Kurs ohne hinterlegten Wochentermin | ✅ erscheint nicht als Termin, bleibt aber unter „Meine Kurse" erreichbar (**neu** getestet) |
| Ausgefallener Termin (Pause) | ✅ Unit-Tests `uebersicht.test.ts` |
| Lehrer ohne jede Kurszuweisung | ✅ E2E AC16 |
| Schüler ohne Geburtsdatum | ✅ Unit-Test |
| Zwei Lehrer im selben Kurs | ✅ PROJ-13 AC8 (dieselbe Notiz für beide) |
| Probestunde am selben Tag | ✅ Fenster beginnt bei `heuteInWien` |
| Termin heute, Stunde läuft | ✅ Unit-Test |

### Sicherheitsprüfung (Red Team)

Neu: `tests/PROJ-49-lehrer-bereich-sicherheit.spec.ts` — 14 Fälle, alle bestanden.

Die fünf neuen Funktionen laufen als `SECURITY DEFINER` und umgehen damit die
Zeilenregeln der Tabellen. Der Zaun steckt allein in ihrem `where`, deshalb wurde
jede einzeln geprüft:

- ✅ Eine **Lehrkraft ohne Zuweisung** bekommt aus jeder der sechs Funktionen
  nichts — kein Fehler, keine Zeile.
- ✅ Ein **Kunde** bekommt aus jeder nichts.
- ✅ **Gegenprobe:** Der zugewiesene Lehrer bekommt Daten. Ohne diese Probe
  bestünde jede Verweigerung oben aus dem falschen Grund.
- ✅ **Ohne Anmeldung** gibt keine Funktion Daten heraus.
- ⚠️ Aber: drei Funktionen sind ohne Anmeldung *aufrufbar* → BUG-2.

Keine personenbezogenen Daten in Antworten, die nicht hingehören; Geburtstage
werden ohne Jahrgang gerendert (`datum.slice`), das Alter erreicht den Browser
gar nicht.

### Responsive

| Breite | Ergebnis |
|---|---|
| 375 px | ✅ kein Überlauf |
| 768 px | ❌ horizontaler Überlauf → BUG-1 |
| 1440 px | ✅ kein Überlauf |

### Regression

- E2E: 60 Fälle über beide Browser (PROJ-49 + Sicherheit), alle grün
- Unit: 462 Tests in 37 Dateien, alle grün
- Vollständiger Durchgang zuvor: 912 bestanden, 2 übersprungen, 0 Fehlschläge

---

### Gefundene Fehler

#### BUG-1: Seite läuft bei Tablet-Breite seitlich über (Lehrer und Admin)
- **Schweregrad:** Medium
- **Gehört zu:** PROJ-24 (globale Navigation), nicht zu PROJ-49
- **Schritte:**
  1. Als Lehrer oder Admin anmelden
  2. Fenster auf 768 px Breite stellen (iPad im Hochformat)
  3. Erwartet: Seite passt in die Breite
  4. Tatsächlich: `scrollWidth` 863 px bei `clientWidth` 768 px — die Seite
     lässt sich seitlich schieben
- **Gemessen:** Überlauf von 768 px bis rund 862 px; ab 900 px verschwindet er.
  **Kunden sind nicht betroffen** (bei keiner Breite).
- **Ursache:** Die Desktop-Navigation schaltet bei `md:` (768 px) zu. Lehrer und
  Admins haben zusätzliche Einträge („Meine Kurse", „Check-in", „Admin"), die
  Leiste misst damit 863–864 px.
- **Warum es jetzt auffällt:** PROJ-49 gibt Lehrern erstmals einen Grund, die App
  im Studio auf einem Tablet zu öffnen. 768 px ist genau das iPad im Hochformat.
- **Priorität:** vor dem Start beheben

#### BUG-2: Drei Datenbankfunktionen sind ohne Anmeldung aufrufbar
- **Schweregrad:** Low — **kein Datenabfluss**
- **Betroffen:** `get_course_participants`, `get_last_session_notes`,
  `get_course_attendance_roster`
- **Tatsächlich:** Ein anonymer Aufrufer erhält keine Daten. Der Zaun sitzt im
  Rumpf: Der Roster wirft „not authorized", die beiden anderen filtern auf null
  Zeilen. Das Ausführungsrecht als *zweite* Schranke fehlt aber.
- **Ursache:** `create or replace function` setzt die Rechte einer Funktion
  zurück, und Supabase vergibt per Default-Privileg `EXECUTE` erneut an `anon`.
  Ein `revoke ... from public` entfernt das **nicht** — `anon` ist eine eigene
  Rolle. Die vier Funktionen aus `…200000` haben `from public, anon` und sind
  darum dicht; die älteren nicht.
- **Behebung:** `revoke all on function … from anon;` für die drei Funktionen.
  Betrifft auch die Produktion, dort läuft dasselbe SQL.
- **Priorität:** nächster Zug, nicht dringend

#### BUG-3: Tippziele im Lehrer-Bereich sind 36 px statt 44 px
- **Schweregrad:** Low
- **Betrifft:** „Anwesenheit" und „Lehrmaterial" (`Button size="sm"`)
- **Gemessen:** 36 px Höhe auf allen Breiten.
- **Warum das zählt:** Das Projekt hat sich im September ausdrücklich auf 44 px
  festgelegt — nachzulesen im Kommentar in `nav/site-header.tsx`, gesetzt
  nachdem am Handy regelmäßig der Menüeintrag darüber getroffen wurde. 36 px ist
  genau die Größe, die dort das Problem war.
- **Entschärft:** Hier stehen die Knöpfe einzeln in einer Karte, nicht gestapelt
  in einer Liste — die Verwechslungsgefahr ist kleiner.
- **Priorität:** nice to have

### Zusammenfassung

| | |
|---|---|
| Akzeptanzkriterien | **16 / 16 bestanden** |
| Edge Cases | 7 / 7 |
| Sicherheit | kein Datenabfluss; 1 Härtungslücke (Low) |
| Fehler | 0 kritisch, 0 hoch, 1 mittel, 2 niedrig |

**Produktionsreif: JA.** Kein kritischer und kein hoher Fehler. BUG-1 gehört zu
PROJ-24 und trifft eine bestimmte Breite, nicht die Funktion selbst.

**Nachtrag zum Ablauf:** Der Bereich war zum Zeitpunkt dieser Prüfung bereits
ausgeliefert — der Betreiber hat sich bewusst für „erst deployen, dann QA"
entschieden. Der Status bleibt deshalb **Deployed** statt auf „In Review"
zurückgesetzt zu werden; ein Rückschritt würde den Produktionsstand falsch
beschreiben.

---

## Umsetzungsnotizen (2026-09-09)

Gebaut in drei Schichten, damit die Rechenarbeit ohne Datenbank prüfbar bleibt:

| Datei | Aufgabe |
|---|---|
| `src/lib/teacher/uebersicht.ts` | Termine, fehlende Anwesenheit, Geburtstage, Rollenverteilung — reine Rechnung, 15 Unit-Tests |
| `src/lib/teacher/laden.ts` | Holt alles in einem Rutsch über alle Kurse gemeinsam |
| `src/components/teacher/lehrer-uebersicht.tsx` | Darstellung; rechnet nichts |

Die Weiche sitzt in `mein-bereich/page.tsx` direkt nach der Frage, wer zusieht —
die Kundenabfragen laufen für Lehrer gar nicht erst an.

**Texte auf Deutsch und Englisch.** `/mein-bereich` liegt innerhalb der
Sprachebene; ein deutscher Block auf einer englischen Seite wäre schief.

### Zwei Funde beim Bauen

**Die Wochentagszählung.** Das Projekt zählt `0 = Montag … 6 = Sonntag`
(`constants/weekdays`), nicht 1–7. Die Unit-Tests haben das sofort aufgedeckt;
in der Seite verbaut wäre es als „der Kurs steht am falschen Tag" aufgefallen,
nicht als Fehler.

**Notizen liegen hinter einer Sicherheitsfunktion.** Auf
`course_session_notes` ist RLS aktiv, aber es gibt **keine Leseregel** — der
Zugriff läuft ausschließlich über `SECURITY DEFINER`-Funktionen. Eine direkte
Tabellenabfrage liefert deshalb stumm nichts. Die bestehende Funktion
beantwortet nur „welche Notiz steht an diesem Termin?"; der Bereich braucht
„was habe ich zuletzt notiert?", für mehrere Kurse auf einmal.

Dafür kam `get_last_session_notes(uuid[])` dazu — derselbe Zaun wie bei der
bestehenden Funktion (zugewiesene Lehrkraft oder Admin), Migration
`20260909180000_proj49_letzte_notizen.sql`.

### Der eigentliche Fund: vier stumm gesperrte Tabellen

Die Notizen waren nur der erste Fall. Nach dem Einbau blieben Geburtstage und
Probestunden trotzdem leer — und die Suche danach hat einen Fehler ans Licht
gebracht, der weit über PROJ-49 hinausgeht.

Für eine Lehrkraft sind **vier** Tabellen nicht lesbar:

| Tabelle | Regel |
|---|---|
| `profiles` | „eigene Zeile oder Admin" |
| `subscriptions` | „eigene Zeile oder Admin" |
| `course_bookings` | „eigene Zeile oder Admin" |
| `course_attendance` | gar keine Leseregel |

RLS lässt eine solche Abfrage nicht scheitern — sie liefert **leer, ohne
Fehler**. Im Code ist das nicht von „es gibt nichts" zu unterscheiden. Die
Folgen im Lehrer-Bereich: keine Geburtstage, keine Probestunden, „0 Leader /
0 Follower", und jede vergangene Stunde galt als nicht erfasst.

**Zwei ältere Features waren schon betroffen, ohne dass es je aufgefallen ist:**

- **PROJ-31:** Das Geburtstags-Symbol in der Anwesenheitsliste ist für Lehrer
  nie erschienen — obwohl die Nutzergeschichte ausdrücklich den Lehrer meint.
- **PROJ-30:** Dasselbe bei den Leader/Follower-Markierungen auf der Kursseite.

Beide Tests waren grün, weil sie sich als **Admin** anmelden.

Dazu kamen fünf Funktionen mit dem Wächter
`is_course_teacher(course_id) or "current_role"() = 'admin'`:
`get_course_participants`, `get_course_attendance_dates`,
`get_course_active_subscribers`, `get_course_trial_bookings`,
`get_course_dance_roles` (Migrationen `…190000` und `…200000`). Die
Kursseite aus PROJ-13 liest die Tanzrollen jetzt über dieselbe Funktion — damit
ist auch der PROJ-30-Fehler behoben.

Das Muster steht als Regel in `.claude/rules/backend.md`, damit die nächste
Abfrage nicht wieder still ins Leere greift.

### Prüfung

22 E2E-Tests (11 Fälle × 2 Browser) in `tests/PROJ-49-lehrer-bereich.spec.ts`.
Neu dazu: Geburtstage ohne Jahrgang (AC9), anstehende Probestunde (AC10),
Rollenverteilung (AC14).

**AC14 hat vorher nichts geprüft.** Der Kurs hatte keine einzige Rollenbuchung,
also stand dort „0 Leader" — und `/\d+ Leader/` passt darauf genauso wie auf
„3 Leader". Der Test wäre auch mit dem Fehler grün geblieben. Er sät jetzt seine
eigene Verteilung und prüft die Zahl; ohne die Korrektur fällt er um
(nachgestellt und bestätigt).

Beide Browser grün. Danach der vollständige Durchgang über alle 47 Dateien:
**912 bestanden, 2 übersprungen, kein Fehlschlag** (1,7 h, Maschine bei Last 4–5,
also ohne die Ausfälle, die hohe Last sonst erzeugt).

**Noch nicht durch Tests abgedeckt:** die beiden Admin-Kriterien (AC3/AC4).
Gehört in den QA-Durchgang.

### Ein Test hat einen anderen vergiftet

AC13 hat sich anfangs die *erstbeste vorhandene* Notiz des Kurses gegriffen,
überschrieben und am Ende gelöscht. Getroffen hat es die vorbereitete Notiz aus
PROJ-13, dessen AC8 danach umfiel — ein Test, der mit der Sache nichts zu tun
hat. AC13 legt jetzt einen eigenen, freien Termin an und räumt nur diesen weg;
die PROJ-13-Fixture stellt sich in `beforeAll` selbst wieder her, statt sich nur
zurücksetzen zu lassen.

---

## Deployment (2026-09-09)

Produktion: https://app.viennasalsastudio.at — Commits `ba8d869` und `cf6e871`,
Vercel-Deployment `67nnzwvxx`, Buildzeit 1 min.

Die beiden Migrationen (`…190000_proj49_kursteilnehmer_fuer_lehrer.sql` und
`…200000_proj49_lehrer_kursdaten.sql`) hat der Betreiber **vor** dem Deploy
eingespielt — die Funktionen standen also bereit, bevor Code sie aufgerufen hat.

Nach dem Deploy geprüft: öffentliche Routen (`/`, `/login`, `/kurse`,
`/stundenplan`, `/en/kurse`) antworten mit 200, geschützte (`/mein-bereich`,
`/lehrer`) mit 307 auf `/login?redirect=…`.

**Ohne QA-Durchgang deployed** — auf ausdrückliche Entscheidung des Betreibers.
AC3 und AC4 (die beiden Admin-Kriterien) sind damit weiterhin ungetestet; die
übrigen 13 Kriterien deckt die E2E-Suite ab.
