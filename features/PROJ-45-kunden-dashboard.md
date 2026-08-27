# PROJ-45: Kunden-Dashboard nach dem Login

## Status: Planned
**Created:** 2026-08-27
**Last Updated:** 2026-08-27

## Dependencies
- Requires: PROJ-2 (Auth & Kundenprofil) — eingeloggter Kunde, `getViewer()`
- Requires: PROJ-8 (Kursbuchung) — Buchungsstatus, Probestunde, gewählte Termine
- Requires: PROJ-9 (Abo-Verwaltung) — aktive Abos als Quelle des „nächsten Kurses"
- Requires: PROJ-11 (Beispiel-Videos) — Videosatz des Kurses und die Zugriffsregel
- Requires: PROJ-12 (Warteliste) — Wartelistenplatz als offener Punkt
- Requires: PROJ-14 (Events & Workshops) — „Diese Woche im Studio"
- Requires: PROJ-25 (Self-Check-in) — Einchecken am Kurstag
- Requires: PROJ-43 (Englische Sprachvariante) — alle Texte zweisprachig
- Requires: PROJ-44 (Empfehlungsprogramm) — Guthaben und Empfehlungscode

## Problemstellung

Nach dem Login landet der Kunde heute auf `/profil` — einer Seite mit neun
Verwaltungsabschnitten (Zahlungsweise, Abos, Buchungen, Warteliste, Tickets,
Guthaben, Rechnungen, Benachrichtigungen, Stammdaten). Sie beantwortet
„verwalte meinen Vertrag".

Sie beantwortet nicht: **„Was mache ich als Nächstes?"**

Wann ist mein nächster Kurs, in welchem Raum, an welchem Standort? Der
Einchecken-Knopf existiert, liegt aber im Stundenplan — niemand sucht ihn
dort, wenn er im Studio steht. Die Übungsvideos sind nur über die
Kursdetailseite erreichbar und werden deshalb kaum gefunden.

## User Stories

- Als **Kunde mit laufendem Kurs** möchte ich beim Öffnen der App sofort
  sehen, wann und wo mein nächster Kurs stattfindet, damit ich nicht im
  Stundenplan suchen muss.
- Als **Kunde am Kurstag** möchte ich mit einem Griff einchecken, damit meine
  Anwesenheit erfasst ist, ohne dass die Lehrkraft mich abhaken muss.
- Als **Kunde zwischen zwei Stunden** möchte ich die Übungsvideos meines
  Kurses direkt abspielen können, damit ich zu Hause weiterüben kann.
- Als **frisch registrierter Kunde ohne Abo** möchte ich sofort verstehen, wie
  ich anfange, damit ich nicht vor einer leeren Seite stehe.
- Als **Kunde mit einer offenen Sache** (fehlendes Mandat, unbestätigte
  Buchung, Wartelistenplatz) möchte ich davon erfahren, ohne beim Betreiber
  nachzufragen.
- Als **Kunde** möchte ich sehen, was diese Woche sonst im Studio los ist,
  damit ich Partys und Workshops nicht verpasse.
- Als **Betreiber** möchte ich, dass Kunden ihre offenen Punkte selbst sehen,
  damit ich weniger Rückfragen per Nachricht beantworte.

## Umfang

Acht Abschnitte, alle zum Start. Der Betreiber hat sich bewusst gegen eine
Aufteilung in zwei Ausbaustufen entschieden (siehe Decision Log).

**Reihenfolge auf der Seite:**

1. Begrüßung mit Vornamen
2. Offene Punkte — *nur wenn welche vorliegen*
3. Dein nächster Kurs (mit Einchecken am Kurstag)
4. Üben: Videolektionen des eigenen Kurses
5. Diese Woche im Studio (Events)
6. Anwesenheit
7. Guthaben & Empfehlungscode
8. Verweis auf `/profil` für alles Verwaltende

## Out of Scope

- **Rechnungen, Stammdaten, Zahlungsweise, Benachrichtigungseinstellungen** —
  bleiben auf `/profil`. Ein Dashboard, das alles zeigt, ist wieder nur eine
  lange Seite; dann gäbe es zwei davon.
- **Rücklastschrift / offener Betrag als offener Punkt** — bewusst
  ausgeschlossen. `sepa_collection_items` ist heute per RLS nur für Admins
  lesbar; eine kundenseitige Anzeige bräuchte eine eigene SECURITY-DEFINER-RPC.
  Später als eigenes Feature denkbar.
- **„Die Lektion zur letzten Stunde"** — nicht möglich: `video_set_lessons`
  kennt nur `position` und `created_at`, es gibt keine Verknüpfung zwischen
  Lektion und Kurstermin. Bräuchte ein neues Feld und Pflegeaufwand in der
  Kursverwaltung.
- **Umbau von `/profil`** — die Seite bleibt unverändert. Nur die Landung nach
  dem Login wechselt.
- **Push-Benachrichtigungen aus dem Dashboard heraus** — PROJ-16 bleibt
  zuständig.
- **Eigene Dashboard-Ansicht für Lehrer und Admin** — Lehrer haben
  `/lehrer`, Admins `/admin`. Beide behalten ihre bisherige Landung.

## Acceptance Criteria

### Zugang und Landung

- [ ] Angenommen ein Kunde meldet sich an, wenn die Anmeldung erfolgreich ist, dann landet er auf `/mein-bereich` statt auf `/profil`
- [ ] Angenommen ein Admin meldet sich an, wenn die Anmeldung erfolgreich ist, dann landet er unverändert auf `/admin`
- [ ] Angenommen jemand ist nicht angemeldet, wenn er `/mein-bereich` aufruft, dann wird er zur Anmeldung geleitet und nach dem Login dorthin zurückgebracht
- [ ] Angenommen ein Kunde ist angemeldet, wenn er die Navigation betrachtet, dann sieht er „Mein Bereich" und „Profil" als getrennte Einträge
- [ ] Angenommen die Sprache steht auf Englisch, wenn der Kunde das Dashboard öffnet, dann sind alle Texte englisch und die Adresse lautet `/en/my-area`

### Leerzustand (neu registriert, kein Abo, keine Buchung)

- [ ] Angenommen ein Kunde hat weder Abo noch Buchung, wenn er das Dashboard öffnet, dann sieht er einen hervorgehobenen Aufruf zur Probestunde als wichtigstes Element der Seite
- [ ] Angenommen ein Kunde hat weder Abo noch Buchung, wenn er den Probestunden-Aufruf anklickt, dann öffnet sich die Terminauswahl für eine Probestunde
- [ ] Angenommen ein Kunde hat weder Abo noch Buchung, wenn er das Dashboard öffnet, dann sieht er unter dem Aufruf bis zu drei Kurse der untersten Levels mit ihrem nächsten Termin
- [ ] Angenommen ein Kunde hat weder Abo noch Buchung, wenn er das Dashboard öffnet, dann erscheinen die Abschnitte „Dein nächster Kurs", „Üben" und „Anwesenheit" gar nicht — statt leer

### Dein nächster Kurs

- [ ] Angenommen ein Kunde hat ein aktives Abo, wenn er das Dashboard öffnet, dann sieht er genau eine Karte mit dem zeitlich nächsten Kurstermin
- [ ] Angenommen ein Kunde hat mehrere aktive Abos, wenn er das Dashboard öffnet, dann zeigt die Karte den zeitlich nächsten Termin über alle Abos hinweg und darunter eine Zeile „Danach: [Wochentag] [Uhrzeit] · [Kurs]"
- [ ] Angenommen ein Kunde hat einen nächsten Kurs, wenn er die Karte betrachtet, dann stehen dort Kursname, Wochentag, Datum, Uhrzeit von–bis, Raum und Standort
- [ ] Angenommen der nächste Termin ist heute, wenn der Kunde die Karte betrachtet, dann steht dort „HEUTE" statt des Datums
- [ ] Angenommen der nächste Termin ist morgen, wenn der Kunde die Karte betrachtet, dann steht dort „MORGEN"
- [ ] Angenommen ein Kurstermin fällt in eine eingetragene Pause, wenn der nächste Termin ermittelt wird, dann wird dieser Termin übersprungen
- [ ] Angenommen ein Kunde hat eine bestätigte Probestunde oder Drop-in-Buchung mit gewähltem Datum, wenn er das Dashboard öffnet, dann erscheint dieser Termin genauso in der Karte wie ein Abo-Termin
- [ ] Angenommen ein Kunde hat ein pausiertes Abo, wenn er das Dashboard öffnet, dann erscheint dessen Kurs nicht als nächster Termin

### Einchecken

- [ ] Angenommen der nächste Kurs ist heute und das Check-in-Fenster ist offen, wenn der Kunde die Karte betrachtet, dann enthält sie einen Einchecken-Knopf
- [ ] Angenommen der Kunde hat eingecheckt, wenn er die Karte betrachtet, dann ist der Zustand als „eingecheckt" erkennbar und lässt sich bis Kursende rückgängig machen
- [ ] Angenommen das Check-in-Fenster ist noch nicht offen, wenn der Kunde die Karte betrachtet, dann sieht er statt des Knopfes den Hinweis, ab wann das Einchecken möglich ist
- [ ] Angenommen der Kunde hat für diesen Kurs kein aktives Abo, wenn der Kurs heute stattfindet, dann erscheint kein Einchecken-Knopf

### Üben: Videolektionen

- [ ] Angenommen ein Kunde hat ein aktives kursgebundenes Abo und der Kurs hat einen Videosatz, wenn er das Dashboard öffnet, dann sieht er die Lektionen des Kurses als Titelliste in Kursreihenfolge
- [ ] Angenommen die Lektionsliste wird angezeigt, wenn der Kunde einen Titel anklickt, dann wird das Video eingebettet abgespielt, ohne die Seite zu verlassen
- [ ] Angenommen der Kurs hat mehr als fünf Lektionen, wenn der Kunde das Dashboard öffnet, dann sieht er die ersten fünf und einen Verweis „Alle [N] Lektionen ansehen"
- [ ] Angenommen ein Kunde hat ein aktives Flatrate-Abo ohne Kursbezug, wenn er das Dashboard öffnet, dann sieht er die Lektionen des Kurses, dessen Termin als nächster ansteht
- [ ] Angenommen eine Lektion hat kein Kunden-Video hinterlegt, wenn die Liste aufgebaut wird, dann erscheint sie nicht
- [ ] Angenommen ein Kunde hat kein aktives Abo, wenn er das Dashboard öffnet, dann erscheint der Abschnitt „Üben" nicht

### Offene Punkte

- [ ] Angenommen ein Kunde hat keinen der drei offenen Punkte, wenn er das Dashboard öffnet, dann erscheint der Abschnitt gar nicht — auch keine Überschrift
- [ ] Angenommen ein Kunde hat kein gültiges SEPA-Mandat, wenn er das Dashboard öffnet, dann sieht er einen offenen Punkt mit Verweis auf die Mandatserteilung
- [ ] Angenommen ein Kunde hat eine Buchungsanfrage mit Status „offen", wenn er das Dashboard öffnet, dann sieht er einen offenen Punkt mit Kursname und Datum der Anfrage
- [ ] Angenommen ein Kunde steht auf einer Warteliste, wenn er das Dashboard öffnet, dann sieht er einen offenen Punkt mit dem Kurs, auf den er wartet
- [ ] Angenommen ein Kunde hat mehrere offene Punkte, wenn er das Dashboard öffnet, dann stehen sie untereinander, das fehlende Mandat zuoberst

### Diese Woche im Studio

- [ ] Angenommen es finden in den nächsten sieben Tagen Events statt, wenn der Kunde das Dashboard öffnet, dann sieht er sie mit Datum, Uhrzeit und Name
- [ ] Angenommen der Kunde hat für ein Event bereits ein Ticket, wenn es angezeigt wird, dann ist das erkennbar und der Kaufknopf entfällt
- [ ] Angenommen ein Event ist abgesagt, wenn die Liste aufgebaut wird, dann erscheint es nicht
- [ ] Angenommen es finden in den nächsten sieben Tagen keine Events statt, wenn der Kunde das Dashboard öffnet, dann erscheint der Abschnitt nicht
- [ ] Angenommen ein Event ist ausgebucht, wenn es angezeigt wird, dann ist das erkennbar und der Kaufknopf entfällt

### Anwesenheit

- [ ] Angenommen ein Kunde war in den letzten acht Wochen mindestens einmal anwesend, wenn er das Dashboard öffnet, dann sieht er, wie oft er in diesem Zeitraum da war
- [ ] Angenommen ein Kunde hat noch nie eine Anwesenheit, wenn er das Dashboard öffnet, dann erscheint der Abschnitt nicht
- [ ] Angenommen ein Kunde sieht seinen Anwesenheitszähler, wenn er ihn betrachtet, dann bezieht er sich ausschließlich auf ihn selbst und nennt keine anderen Kunden

### Guthaben & Empfehlungscode

- [ ] Angenommen ein Kunde hat Guthaben, wenn er das Dashboard öffnet, dann sieht er den aktuellen Stand als Betrag
- [ ] Angenommen ein Kunde hat kein Guthaben, wenn er das Dashboard öffnet, dann wird der Betrag nicht angezeigt, der Empfehlungscode aber schon
- [ ] Angenommen ein Kunde sieht seinen Empfehlungscode, wenn er ihn anklickt, dann wird er in die Zwischenablage kopiert und das wird bestätigt
- [ ] Angenommen ein Kunde betrachtet den Guthaben-Abschnitt, wenn er ihn liest, dann findet er den Hinweis, dass Guthaben nicht ausgezahlt, sondern mit der nächsten Kursgebühr verrechnet wird

## Edge Cases

- **Kunde mit Abo, aber der Kurs hat keinen Stundenplan-Eintrag.** Es gibt
  keinen nächsten Termin. Der Abschnitt „Dein nächster Kurs" entfällt, das
  Abo bleibt auf `/profil` sichtbar.
- **Alle kommenden Termine liegen in Pausen** (z. B. Sommerpause). Es wird
  kein nächster Termin gefunden. Statt einer leeren Karte ein Hinweis, wann
  es weitergeht — oder der Abschnitt entfällt.
- **Der Kurs läuft gerade.** Zwischen Beginn und Ende zeigt die Karte den
  laufenden Termin, nicht schon den nächsten der Folgewoche.
- **Mitternacht bis 02:00 Wiener Zeit.** Alle Tagesberechnungen laufen über
  `heuteInWien()` bzw. `public.heute_wien()`, nicht über `new Date()` oder
  `current_date` — siehe [docs/zeitzone.md](../docs/zeitzone.md).
- **Kunde mit gekündigtem Abo, dessen Kündigung noch nicht wirksam ist.**
  Der Kurs läuft weiter, der nächste Termin wird angezeigt.
- **Kunde bucht eine Probestunde für einen Kurs, in dem er bereits ein Abo
  hat.** Beide Quellen liefern denselben Tag; der Termin darf nur einmal
  erscheinen.
- **Videosatz ohne einzige Lektion mit Kunden-Video.** Der Abschnitt „Üben"
  entfällt vollständig statt einer leeren Liste.
- **Zwei Termine zur selben Zeit** (zwei Abos, gleicher Wochentag und
  Uhrzeit). Beide werden gezeigt statt willkürlich einer.
- **Kunde öffnet das Dashboard mit sehr langsamer Verbindung.** Die
  Abschnitte dürfen nicht nacheinander einspringen und die Seite umsortieren.
- **Frisch registriert, aber es gibt gar keine Anfängerkurse.** Der
  Probestunden-Aufruf bleibt, die Kursliste darunter entfällt.

## Technical Requirements

- Authentifizierung erforderlich; alle Daten ausschließlich die des
  angemeldeten Kunden (RLS greift bereits).
- Alle Texte zweisprachig (Deutsch/Englisch) über next-intl, PROJ-43-Konvention.
- Alle Datumsberechnungen in `Europe/Vienna` — siehe [docs/zeitzone.md](../docs/zeitzone.md).
- Mobil zuerst: das Dashboard wird überwiegend am Telefon geöffnet, oft im
  Studio kurz vor Kursbeginn. Der Einchecken-Knopf muss ohne Scrollen
  erreichbar sein, wenn der Kurs heute ist.
- Die Seite lädt ihre Daten serverseitig in einem Zug, nicht in acht
  Nachladevorgängen.

## Open Questions

- [ ] Soll „Diese Woche im Studio" auch Events zeigen, für die der Kunde nach
      Levelanforderung gar nicht in Frage kommt? (Heute haben Events keine
      Levelbindung — die Frage stellt sich erst, wenn sie eine bekämen.)
- [ ] Anwesenheitszähler: acht Wochen sind gesetzt, aber ungeprüft. Nach dem
      Start anhand echter Zahlen nachjustieren.
- [ ] Braucht der Leerzustand eine Unterscheidung zwischen „gerade registriert"
      und „Abo ausgelaufen, war früher mal da"? Zweiteres gibt es zum Start
      noch nicht.
- [ ] Anwesenheitszähler: nur die Gesamtzahl, oder aufgeschlüsselt nach Kurs?
      (Aus dem Architektur-Entwurf, 2026-08-27)
- [ ] Kursvorschläge im Leerzustand: nach Level sortieren oder nach dem
      nächsten Starttermin? (Aus dem Architektur-Entwurf, 2026-08-27)

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Eigene Seite `/mein-bereich`, `/profil` bleibt unverändert | Ein Dashboard, das auch die Verwaltung trägt, ist wieder nur eine lange Seite. Die Trennung „was mache ich als Nächstes" / „verwalte meinen Vertrag" ist der eigentliche Zweck. | 2026-08-27 |
| Name knüpft an „Mein Tanzbereich" aus dem PRD an | Bestehende Sprache des Projekts statt eines neuen Begriffs. `/start` wurde verworfen, weil es sprachlich mit der öffentlichen Startseite auf `/` kollidiert. | 2026-08-27 |
| Leerzustand: Probestunde als Hauptaufruf, Kursliste darunter | Ein frisch registrierter Kunde soll genau eine offensichtliche nächste Handlung haben. Die Kursauswahl allein überlässt ihm die Entscheidung, wie er einsteigt — das ist der Punkt, an dem Leute abspringen. | 2026-08-27 |
| Nur *ein* nächster Termin, nicht eine Karte je Abo | Klarste Antwort auf „wo muss ich als Nächstes hin". Die Zeile „Danach: …" verhindert, dass der zweite Kurs verlorengeht. | 2026-08-27 |
| Offene Punkte: Mandat, unbestätigte Buchung, Warteliste | Alle drei liegen kundenseitig bereits vor und ersparen dem Betreiber Rückfragen. | 2026-08-27 |
| Rücklastschriften *nicht* als offener Punkt | `sepa_collection_items` ist per RLS nur für Admins lesbar. Eine Kundenanzeige bräuchte eine eigene RPC — der Nutzen rechtfertigt den Aufwand vor dem Start nicht. | 2026-08-27 |
| Videolektionen als kompakte, direkt abspielbare Liste | Hält den Kunden auf dem Dashboard. Eine einzelne hervorgehobene „aktuelle" Lektion wurde verworfen: die Daten geben nicht her, welche Lektion dran ist. | 2026-08-27 |
| Abschnitte ohne Inhalt verschwinden ganz | Ein Kästchen mit „nichts vorhanden" ist Platzverschwendung, besonders am Telefon. | 2026-08-27 |
| Alle acht Abschnitte zum Start statt Kern zuerst | Entscheidung des Betreibers. Ich hatte zu „Kern zuerst, Rest danach" geraten, weil acht Abschnitte mit je eigenem Leerzustand in zwei Wochen samt QA knapp sind; der Betreiber hat sich bewusst dagegen entschieden. Das Risiko liegt im Zeitplan, nicht in der Sache. | 2026-08-27 |
| Verwaltendes bleibt auf `/profil` | Rechnungen, Stammdaten, Zahlungsweise und Benachrichtigungen sind seltene Vorgänge; sie gehören nicht auf die Seite, die täglich geöffnet wird. | 2026-08-27 |

### Technical Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Seite laedt serverseitig in einem Zug, Abfragen gleichzeitig | Wird am Telefon kurz vor Kursbeginn geoeffnet. Nacheinander einspringende Abschnitte verschieben den Einchecken-Knopf genau dann, wenn es schnell gehen muss. | 2026-08-27 |
| Bestehende Bausteine wiederverwenden statt nachbauen | Gleiches Verhalten an beiden Stellen (Stundenplan und Dashboard), und das Verhalten ist bereits geprueft. | 2026-08-27 |
| Anwesenheitszaehler bekommt einen eigenen, eng gefassten Zugang | Anwesenheiten sind bewusst abgeschottet (RLS aktiv, keine Policies — jeder Zugriff ueber eine eigene Funktion). Diese Absicherung wird nicht gelockert; der Kunde bekommt genau eine Antwort ueber sich selbst. | 2026-08-27 |
| Tagesberechnung ausschliesslich mit ausdruecklicher Wiener Zeitzone | Server und Datenbank laufen in UTC, der Browser in der Zeitzone des Kunden. Siehe docs/zeitzone.md. | 2026-08-27 |
| Leerzustand entsteht aus fehlenden Daten, nicht aus einem Schalter | Er kann so nicht veralten, waehrend der eingerichtete Zustand gepflegt wird. | 2026-08-27 |
| Abschnittsreihenfolge fest, nicht konfigurierbar | Aufwand ohne erkennbaren Nutzen zum Start. | 2026-08-27 |
| Keine neuen Pakete | Alles Noetige ist im Projekt vorhanden. | 2026-08-27 |

---

## Tech Design (Solution Architect)

### A) Aufbau der Seite

Jeder Abschnitt erscheint nur, wenn er etwas zu sagen hat. Was in eckigen
Klammern steht, existiert bereits und wird wiederverwendet.

```
Mein Bereich  (/mein-bereich)
|
+-- Begruessung mit Vornamen
|
+-- Offene Punkte                     nur wenn welche vorliegen
|   +-- Kein Zahlungsmittel hinterlegt
|   +-- Buchung wartet auf Bestaetigung
|   +-- Platz auf der Warteliste
|
+-- Dein naechster Kurs               nur mit Abo oder gebuchtem Termin
|   +-- Terminkarte: Kurs, Tag, Uhrzeit, Raum, Standort
|   +-- Einchecken                    [bestehender Einchecken-Knopf]
|   +-- Zeile "Danach: ..."           nur bei mehreren Kursen
|
+-- Einstieg                          nur ohne Abo und ohne Buchung
|   +-- Aufruf zur Probestunde        [bestehender Buchungsdialog]
|   +-- bis zu drei Anfaengerkurse
|
+-- Ueben                             nur mit Abo und vorhandenem Videosatz
|   +-- Liste der Lektionen
|   +-- Abspielen                     [bestehende Video-Einbettung]
|
+-- Diese Woche im Studio             nur wenn Events anstehen
|   +-- Eventzeile mit Ticketkauf     [bestehende Eventkarte + Kaufdialog]
|
+-- Anwesenheit                       nur wenn je anwesend
|
+-- Guthaben & Empfehlungscode
|   +-- Guthabenstand                 [bestehender Guthaben-Abschnitt, verkleinert]
|   +-- Code zum Kopieren
|
+-- Verweis auf das Profil
```

Der Leerzustand ist kein eigener Bildschirm, sondern ergibt sich: „Einstieg"
erscheint, „Dein naechster Kurs" und „Ueben" erscheinen nicht.

### B) Welche Informationen die Seite braucht

Fast alles liegt bereits vor und ist fuer den Kunden lesbar:

| Was die Seite zeigt | Woher es kommt | Vorhanden? |
|---|---|---|
| Vorname, Empfehlungscode | Profil des Kunden | ja |
| Laufende Kurse | Abos des Kunden | ja |
| Wann ein Kurs stattfindet | Stundenplan des Kurses samt eingetragener Pausen | ja |
| Wo er stattfindet | Raum und Standort des Kurses | ja |
| Einzeln gebuchte Termine | Buchungen des Kunden (Probestunde, Drop-in) | ja |
| Habe ich heute eingecheckt | bestehende Abfrage der heutigen Anwesenheit | ja |
| Uebungsvideos | Videosatz des Kurses, bestehende Zugriffsregel | ja |
| Events der naechsten sieben Tage | Eventliste samt Belegung | ja |
| Meine Tickets | Tickets des Kunden | ja |
| Guthabenstand | bestehende Guthaben-Berechnung | ja |
| Fehlendes Zahlungsmittel | Mandat des Kunden | ja |
| Offene Buchung, Wartelistenplatz | Buchungen und Wartelisteneintraege | ja |
| **Wie oft war ich in den letzten acht Wochen da** | Anwesenheiten | **nein — neu** |

**Der einzige neue Baustein.** Anwesenheitsdaten sind heute bewusst
abgeschottet: nur Lehrkraft und Betreiber kommen an sie heran, und zwar
ausschliesslich ueber eigens dafuer gebaute Zugaenge. Statt diese Absicherung
zu lockern, bekommt der Kunde einen eng gefassten eigenen Zugang, der genau
eine Frage beantwortet — „wie oft war *ich* da" — und nichts sonst. Keine
Namen anderer Kunden, keine Termine, keine Kursbelegung.

### C) Technische Entscheidungen und warum

**Die Seite laedt in einem Zug, nicht in acht Nachladevorgaengen.**
Das Dashboard wird ueberwiegend am Telefon geoeffnet, oft im Studio kurz vor
Kursbeginn, gelegentlich mit schlechtem Empfang. Wuerden die acht Abschnitte
nacheinander einspringen, waere der Einchecken-Knopf mal oben, mal unten —
genau dann, wenn es schnell gehen muss. Die Abfragen laufen deshalb
gleichzeitig und die fertige Seite geht als Ganzes raus, so wie es die
Profilseite heute bereits macht.

**Bestehende Bausteine werden wiederverwendet, nicht nachgebaut.**
Einchecken-Knopf, Video-Einbettung, Buchungsdialog, Eventkarte und
Guthaben-Anzeige gibt es bereits. Das hat zwei Vorteile: das Verhalten ist an
beiden Stellen identisch — ein Kunde, der im Stundenplan eingecheckt hat,
findet denselben Knopf im Dashboard wieder —, und die Testarbeit halbiert
sich, weil das Verhalten selbst schon geprueft ist.

**„Welcher Tag ist heute" wird an einer Stelle beantwortet, mit ausdruecklicher
Wiener Zeitzone.** Server und Datenbank laufen in UTC. Wuerde der naechste
Termin im Browser berechnet, kaeme bei einem Kunden im Urlaub dessen Ortszeit
heraus. Die Regel steht in `docs/zeitzone.md` und gilt hier ohne Ausnahme.

**Der Leerzustand ist kein Sonderfall im Code, sondern die Abwesenheit von
Daten.** Es gibt keine zweite Seite und keinen Schalter. Wer kein Abo hat,
sieht „Einstieg"; wer eines hat, sieht „Dein naechster Kurs". Damit kann der
Leerzustand nicht veralten, waehrend der eingerichtete Zustand gepflegt wird.

**Die Reihenfolge der Abschnitte ist fest.** Sie fuer den Kunden umsortierbar
zu machen, kostet Aufwand und Einstellungen, ohne dass zum Start jemand
danach gefragt haette.

**`/profil` bleibt unangetastet.** Kein Umzug von Inhalten, keine geaenderten
Adressen, keine toten Lesezeichen. Wer heute einen Link auf sein Profil hat,
landet weiterhin dort.

### D) Neue Pakete

**Keine.** Alles, was das Dashboard braucht, ist bereits im Projekt: die
Oberflaechenbausteine, die Video-Einbettung, die Uebersetzungen und der
Datenzugriff. Der einzige Zuwachs ist der eng gefasste Zugang zu den eigenen
Anwesenheiten.

### E) Aufwandseinschaetzung

| Abschnitt | Aufwand | Begruendung |
|---|---|---|
| Dein naechster Kurs + Einchecken | mittel | Terminlogik ueber mehrere Abos und Buchungen hinweg, Pausen beruecksichtigen |
| Einstieg / Leerzustand | mittel | eigener Aufruf, Kursauswahl, gestalterisch der wichtigste Bildschirm |
| Ueben | klein | Liste plus bestehende Einbettung |
| Offene Punkte | klein | drei Abfragen, alle vorhanden |
| Diese Woche im Studio | klein | bestehende Eventkarte |
| Guthaben & Empfehlungscode | klein | bestehender Abschnitt, verkleinert |
| Anwesenheit | mittel | einziger neuer Backend-Baustein samt Rechtepruefung |
| Zweisprachigkeit aller Texte | mittel | acht Abschnitte, jeder mit eigenem Leerzustand |


## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
