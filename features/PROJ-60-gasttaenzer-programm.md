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
- [ ] Angenommen ein Kurs ist aus der Balance, wenn der Betreiber ausschreibt, dann wählt er Termin, Rolle, Anzahl der Plätze und die Mindeststufe
- [ ] Angenommen der Betreiber schreibt aus, wenn der Dialog erscheint, dann ist die Mindeststufe mit „eine Stufe über dem Kurs" vorbelegt und änderbar
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
_To be added by /architecture_

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
