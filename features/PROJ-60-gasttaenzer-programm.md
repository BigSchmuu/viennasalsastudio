# PROJ-60: Gasttänzer-Programm

## Status: Planned
**Created:** 2026-09-16
**Last Updated:** 2026-09-16

## Dependencies
- Requires: PROJ-8 (Kursbuchung) — Buchungen hängen an einem Kurs und einem Termin
- Requires: PROJ-30 (Leader/Follower) — die Rollen und die eingestellte Höchstdifferenz je Kurs
- Requires: PROJ-16 (Benachrichtigungen) — die Einladung an die Gasttänzer
  *Hinweis für /architecture: `notification_queue.event_type` hat eine CHECK-Liste. Eine neue
  Benachrichtigungsart ohne Migration wird lautlos verworfen.*
- Requires: PROJ-13 (Lehrer-Ansicht) — der Gast muss auf der Anwesenheitsliste stehen
- Requires: PROJ-3 (Kurse) — die Level `beginner`, `improver`, `intermediate`, `advanced`, `open_level`

## Anlass
In einem Paartanz-Kurs entscheidet nicht die Teilnehmerzahl, ob ein Abend gut wird, sondern das
Verhältnis von Leadern zu Followern. Fehlen an einem Abend drei Follower, tanzen drei Leader
abwechselnd an der Wand. Die App kennt die Differenz bereits (PROJ-30), nutzt sie aber nur, um
Buchungen zu begrenzen — sie tut nichts, um die Lücke zu füllen.

Gleichzeitig gibt es erfahrene Tänzerinnen und Tänzer, die gern einspringen. Bisher läuft das über
Zuruf und WhatsApp.

## User Stories
- Als Betreiber möchte ich sehen, in welchen Kursen das Rollenverhältnis aus dem Ruder läuft, damit ich nicht selbst mitzählen muss.
- Als Betreiber möchte ich mit einem Klick Gastplätze für einen bestimmten Abend ausschreiben, damit sich jemand meldet, bevor der Abend da ist.
- Als Betreiber möchte ich auch dann ausschreiben können, wenn die App nichts meldet — etwa weil ich weiß, dass am Dienstag drei Follower krank sind.
- Als erfahrener Tänzer möchte ich mich einmal fürs Programm anmelden und danach nur Einladungen bekommen, die zu meiner Rolle und meinem Können passen — sonst lese ich sie nach zwei Wochen nicht mehr.
- Als Gasttänzer möchte ich mit einem Klick zusagen und sofort wissen, wann und wo ich sein soll.
- Als Lehrkraft möchte ich den Gast auf meiner Anwesenheitsliste sehen, damit ich weiß, wer da ist und warum.
- Als Betreiber möchte ich jemanden wieder aus dem Programm nehmen können, ohne das Programm für alle zu ändern.

## Out of Scope
- **Vergütung für Gasttänzer** — der Abend ist gratis, mehr gibt es nicht
- **Automatische Ausschreibung ohne Freigabe** — bewusst verworfen, Begründung im Decision Log
- **Gastplätze für Events und Workshops** — nur laufende Kurse
- **Warteliste für Gastplätze** — wer zu spät kommt, sieht „schon vergeben"
- **Wiederkehrende Gastplätze** („jeden Dienstag derselbe") — jede Ausschreibung gilt für einen Abend
- **Bewertung oder Rückmeldung zu Gasttänzern** — wer nicht passt, wird ausgeschlossen, das genügt
- **Eine feste Obergrenze pro Person** — bewusst verworfen, siehe Decision Log
- **Gasttänzer als eigene Rolle im System** — sie bleiben Kunden mit einem Häkchen

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Anmeldung zum Programm
- [ ] Angenommen ein Kunde ist angemeldet, wenn er sein Profil öffnet, dann findet er dort das Gasttänzer-Programm mit einer Erklärung, worum es geht
- [ ] Angenommen ein Kunde meldet sich an, wenn er das Formular ausfüllt, dann gibt er seine Rolle (Leader, Follower oder beides) und sein höchstes Level an
- [ ] Angenommen ein Kunde ist im Programm, wenn er Rolle oder Level ändert, dann gilt das ab der nächsten Ausschreibung
- [ ] Angenommen ein Kunde ist im Programm, wenn er sich abmeldet, dann bekommt er keine Einladungen mehr und behält bereits zugesagte Abende
- [ ] Angenommen jemand hat ein Konto, wenn er sich anmelden will, dann kann er das — ein laufendes Abo ist nicht nötig

### Der Betreiber sieht die Schieflage
- [ ] Angenommen ein Kurs fragt nach der Rolle, wenn die Differenz die eingestellte Grenze überschreitet, dann erscheint er in der Verwaltung mit der fehlenden Rolle und der Anzahl
- [ ] Angenommen ein Kurs fragt nicht nach der Rolle, dann taucht er dort nicht auf — ohne Rollen gibt es keine Schieflage
- [ ] Angenommen kein Kurs ist aus der Balance, wenn der Betreiber nachsieht, dann steht dort, dass gerade nichts zu tun ist

### Ausschreiben
- [ ] Angenommen ein Kurs fragt nach der Rolle, wenn der Betreiber ausschreiben will, dann geht das jederzeit — auch ohne dass die App eine Schieflage meldet
- [ ] Angenommen ein Kurs fragt **nicht** nach der Rolle, wenn der Betreiber ausschreiben will, dann steht dieser Kurs nicht zur Wahl — ohne Rollen gibt es nichts zu suchen
- [ ] Angenommen der Betreiber kommt aus der Vorschlagsliste, wenn der Dialog erscheint, dann sind Kurs, Rolle und Anzahl bereits ausgefüllt
- [ ] Angenommen der Betreiber schreibt aus, wenn der Dialog erscheint, dann wählt er Termin, Rolle, Anzahl der Plätze und die Mindeststufe
- [ ] Angenommen der Dialog erscheint, wenn die Mindeststufe gesetzt wird, dann ist sie mit „eine Stufe über dem Kurs" vorbelegt und änderbar
- [ ] Angenommen der Kurs ist bereits voll, wenn der Betreiber ausschreiben will, dann warnt die App und lässt ihn trotzdem
- [ ] Angenommen an dem Termin fällt der Kurs aus oder ist Ferienpause, wenn der Betreiber ihn wählt, dann lässt sich dafür nichts ausschreiben
- [ ] Angenommen eine Ausschreibung läuft, wenn der Betreiber sie zurückzieht, dann bekommt niemand mehr etwas angeboten und bereits Zugesagte werden benachrichtigt

### Die Einladung
- [ ] Angenommen eine Ausschreibung geht raus, wenn sie zugestellt wird, dann erreicht sie nur Programmteilnehmer mit passender Rolle und mindestens der geforderten Stufe
- [ ] Angenommen ein Programmteilnehmer ist an diesem Termin schon im Kurs gebucht, dann bekommt er keine Einladung — er ist ja da
- [ ] Angenommen eine Einladung kommt an, wenn sie gelesen wird, dann nennt sie Kurs, Termin, Uhrzeit, Ort, gesuchte Rolle und dass der Abend nichts kostet
- [ ] Angenommen jemand ist aus dem Programm ausgeschlossen, dann erreicht ihn keine Einladung mehr

### Zusagen
- [ ] Angenommen ein Gasttänzer sagt zu, wenn er bestätigt, dann bestätigt er zugleich ausdrücklich, dass er das Level für diesen Kurs mitbringt
- [ ] Angenommen ein Gasttänzer sagt zu, wenn die Zusage durchläuft, dann ist ein Platz der Ausschreibung vergeben und er steht als Teilnehmer dieses Abends fest
- [ ] Angenommen ein Gasttänzer hat zugesagt, wenn er seine Bestätigung ansieht, dann kostet der Abend nichts und es entsteht keine Rechnung
- [ ] Angenommen der letzte Platz ist vergeben, wenn jemand anderes zusagen will, dann erfährt er, dass die Plätze weg sind
- [ ] Angenommen zwei sagen im selben Moment für den letzten Platz zu, dann bekommt genau einer ihn
- [ ] Angenommen der Kurs hat begonnen, wenn jemand noch zusagen will, dann geht es nicht mehr
- [ ] Angenommen ein Gasttänzer hat zugesagt, wenn er wieder absagt, dann wird der Platz erneut angeboten und der Betreiber erfährt davon

### Im Kurs
- [ ] Angenommen ein Gasttänzer hat zugesagt, wenn die Lehrkraft die Anwesenheitsliste öffnet, dann steht er dort und ist als Gast erkennbar
- [ ] Angenommen ein Gasttänzer steht auf der Liste, wenn die Lehrkraft Anwesenheit einträgt, dann geht das wie bei allen anderen
- [ ] Angenommen ein Gasttänzer war da, wenn der Betreiber später nachsieht, dann ist erkennbar, dass es ein Gastabend war und kein bezahlter Platz

### Ausschließen
- [ ] Angenommen ein Betreiber sieht einen Programmteilnehmer, wenn er ihn ausschließt, dann ist er aus dem Programm und kann sich nicht erneut anmelden
- [ ] Angenommen jemand ist ausgeschlossen, wenn er sein Profil öffnet, dann bekommt er keine falsche Hoffnung — das Programm erscheint ihm nicht als offen

## Edge Cases
- **Zwei sagen gleichzeitig für den letzten Platz zu:** Genau einer bekommt ihn, der andere eine verständliche Meldung. Die Vergabe muss unteilbar sein.
- **Der Kurs fällt aus, nachdem jemand zugesagt hat:** Der Gast muss davon erfahren wie jeder andere Teilnehmer auch (PROJ-38).
- **Die Rolle füllt sich von selbst:** Zwischen Ausschreibung und Abend bucht jemand regulär die gesuchte Rolle. Die Ausschreibung bleibt bestehen — ob sie noch gebraucht wird, entscheidet der Betreiber, nicht die App.
- **Der Gast ist bereits Teilnehmer des Kurses:** Er bekommt keine Einladung, und eine Zusage muss auch über Umwege scheitern.
- **Jemand senkt sein Level nach einer Zusage:** Die Zusage bleibt — sie galt zum Zeitpunkt der Bestätigung.
- **Ein Kurs ohne Rollenabfrage:** Kommt für das Programm nicht in Frage, weder in der Übersicht noch beim Ausschreiben.
- **Niemand sagt zu:** Die Ausschreibung läuft mit Kursbeginn aus. Der Betreiber sieht das, es passiert sonst nichts.
- **Der Gast sagt eine Stunde vorher ab:** Der Platz wird wieder angeboten, auch wenn realistisch niemand mehr einspringt. Der Betreiber erfährt es, damit er nicht überrascht wird.
- **Ein Ausgeschlossener hat noch eine offene Zusage:** Sie bleibt gültig; der Ausschluss wirkt nach vorn.

## Technical Requirements
- Sicherheit: Wer eine Zusage abgibt, darf damit keinen fremden Platz belegen und keinen bezahlten Platz in einen Gastplatz verwandeln
- Sicherheit: Ausschreiben, Zurückziehen und Ausschließen sind Verwaltungsrechte und müssen auch in der Datenbank darauf beschränkt sein
- Die Vergabe des letzten Platzes muss unteilbar sein
- Sprache: Kundenseitig zweisprachig, Verwaltung deutsch
- Bedienung: Die Zusage muss am Handy in wenigen Sekunden möglich sein — sie passiert unterwegs

## Open Questions
- [ ] Soll ein Gastabend in der Anwesenheitsstatistik des Kunden auftauchen, oder getrennt gezählt werden? Vorschlag: getrennt, weil er nichts über seine Kurstreue sagt
- [ ] Sollen Gasttänzer sehen, wie oft sie schon eingesprungen sind? Vorschlag: ja, eine schlichte Zahl im Profil — es ist ein Dankeschön-Programm
- [ ] Wie erfährt jemand überhaupt vom Programm? Vorschlag: ein Hinweis im Kundenbereich; ein Aufruf per Newsletter ist Sache des Betreibers

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Die App schlägt vor, der Betreiber gibt frei | Die App kennt die Anmeldungen, nicht den Abend. Sind drei Follower krank und zwei Leader im Urlaub, weiß sie nichts davon — ob ein Abend jemanden braucht, weiß nur der Betreiber | 2026-09-16 |
| Ausschreiben geht auch **ohne** Vorschlag, für jeden Kurs mit Rollenabfrage | Nachgetragen am 2026-09-16 auf Nachfrage des Betreibers. Der Vorschlag ist eine Abkürzung, kein Tor: Genau im wichtigsten Fall — drei Follower sind krank — meldet die App nichts, weil alle drei angemeldet sind. Wäre die Liste der einzige Weg, fehlte die Funktion ausgerechnet dann | 2026-09-16 |
| Kurse ohne Rollenabfrage bleiben außen vor | Eine Ausschreibung sucht „2 Follower". Ohne Rollen gibt es nichts zu suchen — und einen Gratisplatz ohne Rollenbezug zu verschenken wäre ein anderes Vorhaben | 2026-09-16 |
| Rolle wird bei der Anmeldung angegeben | Wer nur Leader tanzt, soll keine Follower-Plätze angeboten bekommen. Einladungen, die nicht passen, werden nach zwei Wochen nicht mehr gelesen — und dann auch die passenden nicht | 2026-09-16 |
| Level wird angegeben und gefiltert, **mindestens eine Stufe über dem Kurs** | Ein Gasttänzer soll tragen, nicht selbst kämpfen. Wer auf dem Niveau des Kurses steht, hilft dem Abend nicht | 2026-09-16 |
| Die Mindeststufe ist je Ausschreibung einstellbar | „Eine Stufe drüber" scheitert an Advanced (nichts darüber) und Open Level (keine Stufe). Statt Sonderregeln zu erfinden, die irgendwann nicht passen, entscheidet der Betreiber im Einzelfall — vorbelegt mit der Regel | 2026-09-16 |
| Gasttänzer zählen gegen die Teilnehmerzahl, der Betreiber darf darüber hinaus | Der Raum hat eine Größe. Aber genau dann, wenn ein Kurs voll ist und trotzdem Follower fehlen, wäre eine starre Sperre im Weg | 2026-09-16 |
| Zusagen bis Kursbeginn möglich | Wer um 19:58 zusagt und um 20:05 da ist, hat immer noch geholfen. Eine frühere Frist verschenkt Abende, die noch zu retten wären | 2026-09-16 |
| Offen für jeden mit Konto, kein laufendes Abo nötig | Der größere Pool findet eher jemanden für den Dienstagabend — und gute Tänzer ohne Abo sind genau die, die man sich wünscht | 2026-09-16 |
| Keine feste Obergrenze, dafür Ausschluss im Einzelfall | Der Betreiber gibt jede Ausschreibung selbst frei und sieht in der Teilnehmerliste, wer kommt. Eine Zahl träfe auch den, der dreimal aus der Patsche geholfen hat | 2026-09-16 |
| Gasttänzer dürfen absagen | Sie tun einen Gefallen. Jemanden festzuhalten, der nicht kann, bringt niemandem etwas — und der Betreiber erfährt es lieber vorher als im Saal | 2026-09-16 |
| Der Gast steht auf der Anwesenheitsliste, als Gast erkennbar | Die Lehrkraft muss wissen, wer im Raum ist und warum. Und beim Nachrechnen darf ein Gastabend nicht wie ein bezahlter Platz aussehen | 2026-09-16 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Eine Zusage ist eine **Buchung** der neuen Art „Gast", keine eigene Tabelle | Buchungen hängen bereits an Kurs und Termin, zählen gegen die Kapazität, erscheinen auf der Anwesenheitsliste und lassen sich stornieren. Eine eigene Tabelle hieße, all das ein zweites Mal zu bauen — und ein Gast, der irgendwo fehlt, fällt erst im Saal auf | 2026-09-16 |
| Preis 0 statt „kein Preis" | Ein Nullbetrag rechnet sich überall mit, ein fehlender Wert muss überall abgefangen werden. Und in der Auswertung ist sichtbar, dass der Abend nichts gekostet hat, statt dass er fehlt | 2026-09-16 |
| Die Vergabe des letzten Platzes läuft in einer Datenbankfunktion mit gesperrter Zeile | Dieselbe Bauart wie bei der Stornierung in PROJ-59, wo sich gezeigt hat, dass sie hält. Zwei gleichzeitige Zusagen dürfen nicht beide den letzten Platz bekommen | 2026-09-16 |
| Die Rangfolge der Level steht in der Datenbank | „Mindestens eine Stufe drüber" muss beim Filtern der Empfänger ausgewertet werden, also dort, wo die Empfänger ermittelt werden. `open_level` bekommt bewusst **keinen** Rang — deshalb ist die Mindeststufe je Ausschreibung einstellbar | 2026-09-16 |
| Die Anwesenheitsliste bekommt eine vierte Quelle „Gast" | Sie kennt bereits `abo`, `buchung` und `manuell` samt Rangfolge. Eine vierte Quelle fügt sich ein, statt daneben ein zweites Verfahren zu schaffen | 2026-09-16 |
| Die Schieflage wird genauso gezählt wie beim Buchen | PROJ-30 zählt aktive Abos plus offene reguläre Buchungen je Rolle. Eine zweite, eigene Rechnung würde früher oder später eine andere Zahl liefern als die, die eine Buchung ablehnt | 2026-09-16 |
| Einladungen gehen als einzelne Benachrichtigungen, nicht als Rundschreiben | Jede Einladung braucht einen eigenen Zustand — gelesen, angenommen, verfallen — und der Empfängerkreis ist gefiltert. Ein Newsletter kann beides nicht | 2026-09-16 |
| Keine neuen Pakete | Alles Nötige ist vorhanden | 2026-09-16 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Die Grundidee

Eine Zusage ist **eine Buchung wie jede andere** — nur mit der neuen Art „Gast" und dem Preis 0.
Das ist die wichtigste Entscheidung des Entwurfs, denn daran hängt alles Weitere: Buchungen sind
schon mit einem Kurs und einem Termin verknüpft, zählen gegen die Teilnehmerzahl, erscheinen auf der
Anwesenheitsliste und lassen sich absagen. Eine eigene Gasttänzer-Tabelle hieße, all das ein zweites
Mal zu bauen — und ein Gast, der in einer dieser Listen fehlt, fällt erst im Saal auf.

Neu sind damit nur zwei Dinge: wer im Programm ist, und was gerade ausgeschrieben ist.

### Was gespeichert wird

**Wer im Programm ist** — je Kunde eine Zeile: Rolle (Leader, Follower oder beides), höchstes Level,
seit wann dabei, und ob ausgeschlossen. Der Ausschluss wird vermerkt, nicht gelöscht: Sonst könnte
sich derselbe Mensch am nächsten Tag neu anmelden, und niemand wüsste, warum er weg war.

**Was ausgeschrieben ist** — je Ausschreibung: Kurs, Termin, gesuchte Rolle, Anzahl der Plätze,
Mindeststufe, wer sie freigegeben hat, und ob sie zurückgezogen wurde. Wie viele Plätze noch frei
sind, wird **nicht** gespeichert, sondern gezählt: Ein mitgeführter Zähler und die tatsächlichen
Zusagen driften irgendwann auseinander, und dann glaubt man dem falschen.

**Neu in der Liste der Benachrichtigungsarten** ein Eintrag für die Einladung. Diese Liste ist in der
Datenbank festgeschrieben; fehlt der Eintrag, verschwindet die Einladung lautlos. Das ist in diesem
Projekt bereits dreimal passiert.

### Die Rangfolge der Level

„Mindestens eine Stufe über dem Kurs" muss dort ausgewertet werden, wo die Empfänger ermittelt
werden — also in der Datenbank. Die Rangfolge lautet:

```
beginner (1) < improver (2) < intermediate (3) < advanced (4)
open_level: kein Rang
```

`open_level` bekommt bewusst keinen Platz in dieser Reihe, weil es keinen hat: Ein Open-Level-Kurs
mischt alle Stufen. Genau deshalb ist die Mindeststufe je Ausschreibung einstellbar — der Betreiber
entscheidet dort, wo die Regel nicht greift, statt dass sich die App etwas ausdenkt.

### Was gebaut wird

```
Profil → neuer Abschnitt „Gasttänzer-Programm"
+-- Noch nicht dabei: kurze Erklärung, Rolle und höchstes Level, „Mitmachen"
+-- Dabei: Rolle und Level ändern, „Nicht mehr mitmachen"
+-- Offene Einladungen: Kurs, Termin, Uhrzeit, Ort, gesuchte Rolle
|   +-- „Ich springe ein" mit der Bestätigung zum Level
+-- Zugesagte Abende, mit „Doch nicht"

Verwaltung → neue Seite „Gasttänzer"
+-- Aus der Balance: Kurse, deren Differenz die Grenze überschreitet
|   +-- je Zeile: fehlende Rolle, Anzahl, „Plätze ausschreiben" (vorausgefüllt)
+-- „Plätze ausschreiben" auch ohne Vorschlag — jeder Kurs mit Rollenabfrage
+-- Laufende Ausschreibungen: Kurs, Termin, Rolle, „2 von 3 vergeben", „Zurückziehen"
+-- Programmteilnehmer: Rolle, Level, seit wann, „Ausschließen"

Ausschreiben-Dialog
+-- Kurs · Termin (nur Tage, an denen der Kurs wirklich stattfindet)
+-- Rolle · Anzahl der Plätze
+-- Mindeststufe, vorbelegt mit „eine Stufe über dem Kurs"
+-- Hinweis, falls der Kurs bereits voll ist — er hält niemanden auf

Lehrerbereich → Anwesenheitsliste (Erweiterung)
+-- Der Gast steht dort mit der Quelle „Gast"
```

### Warum die Zusage in die Datenbank gehört

Beim letzten freien Platz entscheidet sich, ob die Funktion taugt. Zwei Menschen, die im selben
Moment auf „Ich springe ein" tippen, dürfen nicht beide einen Platz bekommen, den es nur einmal
gibt. Deshalb läuft die Vergabe in einer Datenbankfunktion, die die Ausschreibung sperrt, die
bisherigen Zusagen zählt und erst dann die Buchung anlegt — dieselbe Bauart wie die Stornierung in
PROJ-59, wo sich gezeigt hat, dass sie hält.

Dieselbe Funktion prüft auch, was die Oberfläche nur anzeigt: dass die Ausschreibung noch läuft,
dass der Kurs noch nicht begonnen hat, dass der Zusagende im Programm und nicht ausgeschlossen ist,
und dass er nicht ohnehin schon in diesem Kurs sitzt.

### Wie die Schieflage gezählt wird

Genauso, wie beim Buchen gezählt wird: aktive Abos plus offene reguläre Buchungen, je Rolle. Diese
Rechnung steckt bereits in der Buchungsfunktion aus PROJ-30. Eine zweite, eigene Rechnung würde
früher oder später eine andere Zahl liefern als die, die eine Buchung ablehnt — und dann stünde in
der Verwaltung „im Gleichgewicht", während ein Kunde gerade hört, er dürfe wegen der Balance nicht
buchen.

### Backend nötig?

Ja, und es ist der größere Teil: zwei neue Tabellen, die neue Buchungsart, die Rangfolge der Level,
die Vergabefunktion, die Auskunft über die Schieflage, die vierte Quelle in der Anwesenheitsliste
und die Einladung samt Migration.

### Zusätzliche Pakete

Keine.

## Umsetzung — Backend (2026-09-16)

### Gebaut

- **Zwei Migrationen.** Die erste bringt die beiden Tabellen, die Buchungsart `guest`, die Rangfolge
  der Level, die Vergabe, den Empfängerkreis und die vierte Quelle „gast" auf der Anwesenheitsliste.
  Die zweite die Auskunft über die Schieflage.
- **Die Regeln als eigenes Stück Code** (`src/lib/gasttaenzer/`) — dieselben Regeln entscheiden über
  Empfängerkreis und Zusage, deshalb stehen sie an einer Stelle. 37 Tests.
- **Server-Handlungen** für beide Seiten: anmelden, ändern, abmelden, zusagen, absagen — und
  ausschreiben, zurückziehen, ausschließen, wieder zulassen.
- **Die Einladung**, zweisprachig, mit einer zweiten Fassung für den Fall, dass eine Ausschreibung
  zurückgezogen wird.

### Geprüft

15 Prüfungen an der Testdatenbank, im ersten Anlauf grün. Die wichtigste: **Zwei gleichzeitige
Zusagen auf einen einzigen Platz — genau eine kommt durch.** Dazu jede Abweisung einzeln und der
Gast auf der Anwesenheitsliste. Insgesamt 875 Unit- und Datenbanktests grün.

### Entscheidungen beim Bauen

**Eine zurückgezogene Ausschreibung sagt bestehende Zusagen mit ab**, nicht nur die Ausschreibung
selbst. Wer zugesagt hat, stünde sonst am Dienstag umsonst im Studio — und auf der Anwesenheitsliste
der Lehrkraft.

**Die Einladung liest Kurs, Uhrzeit und Ort erst beim Zustellen**, nicht beim Einreihen. Sie sollen
stimmen, wenn die Nachricht ankommt.

**Die Typdatei wurde aus der Testdatenbank erzeugt**, nicht von Hand nachgezogen. Nebenbei hat das
bestätigt, dass die handgeschriebenen Einträge aus PROJ-58 und PROJ-59 mit dem wirklichen Schema
übereinstimmten.

### Offen für /frontend

Die gesamte Oberfläche: der Profilabschnitt (zweisprachig), die Verwaltungsseite mit Schieflage-Liste
und Ausschreiben-Dialog, und die Kennzeichnung des Gasts auf der Anwesenheitsliste.

## Umsetzung — Frontend (2026-09-16)

### Gebaut

- **Verwaltung → Gasttänzer** (`/admin/gasttaenzer`): Schieflage-Liste, Ausschreiben-Dialog, laufende
  Ausschreibungen mit Zusagenzähler und „Zurückziehen", Programmteilnehmer mit Ausschluss.
- **Profil → Gasttänzer-Programm**, zweisprachig: anmelden mit Rolle und Level, Angaben ändern,
  austreten, offene Einladungen mit Level-Bestätigung, zugesagte Abende mit „Doch nicht".
- **Anwesenheitsliste**: Die vierte Quelle heißt dort „Gast".

### Entscheidungen beim Bauen

**Die möglichen Termine werden auf dem Server gerechnet, nicht im Dialog.** Ferien, ausgefallene
Abende und ein beendeter Kurs fallen dabei heraus — ein Termin, an dem der Kurs gar nicht
stattfindet, steht damit nicht zur Wahl, statt erst beim Abschicken abgelehnt zu werden.

**Die Einladungen im Profil sind schon gefiltert, wenn sie ankommen** — mit denselben Regeln, die
auch die Datenbank beim Zusagen anwendet. Eine Einladung zu sehen, die man nicht annehmen kann, wäre
die ärgerlichste Form dieses Features.

**Der Ausschreiben-Dialog setzt sich über einen Schlüssel zurück**, statt seinen Zustand in einem
Effekt nachzuziehen. Dasselbe Muster wie beim Storno-Dialog aus PROJ-59, und aus demselben Grund:
Der Linter verbietet es zu Recht, und beim Wechsel der Vorbelegung stünden sonst kurz die Zahlen des
vorigen Kurses da.

**Beim Zurückziehen mit bestehenden Zusagen fragt die Oberfläche nach**, und zwar mit der Anzahl.
Dass dabei Menschen abgesagt werden, soll niemand aus Versehen auslösen.

### Noch offen

Der QA-Durchgang mit E2E-Prüfungen über die Oberfläche. Die Regeln und die Datenbank sind belegt
(37 + 15 Prüfungen), der Weg durch den Browser noch nicht.

## QA Test Results (2026-09-16)

**Empfehlung: bereit für die Produktion.** Beide Migrationen laufen in der Testdatenbank, alle drei
Prüfebenen sind grün.

| | |
|---|---|
| Regeln (Unit) | 37 |
| Datenbank | 15 |
| Browser (E2E) | 7 |
| Unit- und Datenbanktests gesamt | 875 |
| Produktfehler gefunden | 1 (Regression, behoben) |

### Was geprüft ist

**Die Regeln** entscheiden über Empfängerkreis und Zusage aus einer Quelle — geprüft sind die
Rangfolge der Level (einschließlich der beiden Stellen, an denen „eine Stufe drüber" nicht greift)
und die Reihenfolge der Absagegründe.

**Die Datenbank** lässt bei zwei gleichzeitigen Zusagen genau eine durch und weist jeden Sonderfall
einzeln ab. Kein Weg führt an ihr vorbei.

**Der Browser** deckt den Weg ab, den ein Mensch geht: anmelden mit Rolle und Level, ausschreiben
ohne Vorschlag, Einladung sehen, ohne Bestätigung nicht zusagen können, mit Bestätigung zusagen,
falsche Rolle sieht nichts, Zurückziehen sagt bestehende Zusagen mit ab, Ausgeschlossene sehen einen
Hinweis statt des Formulars.

### Die eine Regression

**„Rollenfeld ist nicht vorhanden" aus PROJ-2 wurde rot.** Der Test prüft, dass ein Kunde im Profil
seine **Kontorolle** nicht ändern kann — und fing per Teilzeichenkette auch das neue Feld „Deine
Rolle" aus dem Gasttänzer-Programm.

Zwei Dinge waren hier richtig, beide gemacht: Das Feld heißt jetzt **„Deine Tanzrolle"** — treffender,
weil „Rolle" in dieser App auch die Kontorolle meint. Und die Behauptung im Test ist jetzt **genau**
statt teilweise: Gemeint war immer ein Feld, das schlicht „Rolle" heißt.

### Zwei Fehler in meinen Prüfungen

Die Anmeldung als Kunde lief weiter, bevor sie fertig war: `zweiteStufeErledigen` wartet nur dort,
wo es eine Code-Abfrage gibt. Sechs Prüfungen landeten deshalb wieder auf der Anmeldeseite — der
Admin-Test bestand als einziger, genau deswegen.

Und eine Behauptung war wertlos: „Zugesagt" ist auch die Überschrift des Abschnitts und steht immer
da. Geprüft wird jetzt, dass die Einladung **verschwindet** — wer an dem Abend im Kurs ist, bekommt
keine mehr. Das tritt nur bei Erfolg ein.

### Was ungeprüft bleibt

Die Einladung als E-Mail wurde nicht ausgelöst; geprüft sind nur ihre Bausteine. Der Gast auf der
Anwesenheitsliste ist an der Datenbank belegt, nicht im Lehrerbereich angeklickt. Firefox ist im
Projekt weiterhin nicht eingerichtet.

## Deployment

**Produktion:** https://app.viennasalsastudio.at · **Ausgerollt:** 2026-09-16 · **Tag:** `v1.59.0-PROJ-60`

### Reihenfolge

1. `20260916160000_proj60_gasttaenzer.sql` — Tabellen, Buchungsart, Vergabe, Anwesenheitsliste
2. `20260916170000_proj60_schieflage.sql` — die Auskunft über die Balance
3. Code ausgerollt (Vercel, 2 Minuten Build)

Die Migrationen mussten zuerst laufen: Der Profilabschnitt fragt die neuen Tabellen für **jeden**
Kunden ab, und die Buchungsart `guest` steht in einer Prüfliste der Datenbank — ohne sie ließe sich
keine einzige Zusage speichern.

### Besonders beobachtet

Die erste Migration **ersetzt `get_course_attendance_roster`**, um die vierte Quelle „Gast"
aufzunehmen. Das ist die einzige bestehende Funktion, die dieses Projekt angefasst hat; der Rest
ihres Rumpfs wurde unverändert übernommen. Der Betreiber hat den Lehrerbereich nach dem Ausrollen
geprüft — die Teilnehmerlisten stehen wie zuvor.

Der eingebaute Prüfblock gegen eine anders benannte Typ-Prüfbedingung hat nicht ausgelöst.

### Nachgeprüft

Öffentlich, von außen: Startseite, Kurse, Events, Stundenplan und die englische Fassung liefern 200,
12 Kurse im Katalog, `/admin/gasttaenzer` weist Nicht-Angemeldete ab.
Verwaltung, Lehrerbereich und Profil vom Betreiber bestätigt.

### Hinweis für den Betrieb

Das Programm ist da, aber leer: Solange sich niemand anmeldet, gibt es niemanden einzuladen. Ein
Aufruf per Newsletter oder im Kurs ist der nächste Schritt — und liegt außerhalb der App.

## Nachtrag (2026-09-18): Der Vorschlag war blind

Im Volllauf vom 2026-09-17 stand 22-mal in der Serverausgabe:

```
Schieflage nicht lesbar { code: '42702', message: 'column reference "course_id" is ambiguous' }
```

`get_course_role_balance()` gibt eine Tabelle mit einer Spalte `course_id` zurück — und damit legt
PL/pgSQL eine **Variable** dieses Namens an. Die beiden Zählungen der offenen regulären Buchungen
schrieben `where course_id = c.id` ohne Tabellenpräfix, und Postgres wies den ganzen Aufruf ab.

Sichtbar war davon nichts: `getSchieflage()` protokolliert den Fehler und liefert eine leere Liste,
woraufhin die Seite „Gerade ist nichts zu tun — kein Kurs überschreitet seine Grenze" schreibt. Die
halbe Idee des Programms — die Verwaltung muss nicht selbst nachzählen — hat vom Ausrollen am
2026-09-16 bis zur Korrektur nie funktioniert.

**Warum kein Test das gemeldet hat:** Alle sieben E2E-Prüfungen schrieben selbst aus (über
„Plätze ausschreiben" oben rechts) und prüften danach die Zusage. Keine prüfte den Vorschlag selbst.
Ein leerer, gültig aussehender Zustand ist für einen Test nicht von einem richtigen zu unterscheiden.

**Behoben mit** `20260917214500_proj60_schieflage_spalten.sql` — gleiche Signatur, Spalten überall
mit Tabellenpräfix. Eingespielt in Test und Produktion am 2026-09-18.

**Neu geprüft:** `tests/PROJ-60-gasttaenzer.spec.ts` → „Die Verwaltung sieht, welche Rolle im Kurs
fehlt" baut eine Schieflage (ein offener Leader-Platz, Grenze 0), erwartet „1 × Follower" in der
Zeile des Kurses und öffnet den Ausschreiben-Dialog aus dieser Zeile — mit dem Kurs schon
eingetragen. Der Test wurde vor dem Einspielen des SQL absichtlich rot laufen gelassen.
