# PROJ-74: Eigene Liste für Probestunden, Drop-Ins und Gäste

## Status: Approved
**Created:** 2026-10-05
**Last Updated:** 2026-10-05

## Dependencies
- Requires: PROJ-13 (Lehreransicht mit Anwesenheit) — die Seite, auf der die Liste erscheint
- Requires: PROJ-72 (Anwesenheitsliste in Staffeln) — die Spalten, aus denen der Termin gewählt wird
- Requires: PROJ-60 (Gasttänzer) — die dritte Art von Einmal-Besuch
- Berührt: PROJ-52 (eine Probestunde pro Kunde), PROJ-69 (ein Kursplatz gilt erst ab seinem Beginn)

## Anlass

Wunsch des Betreibers: eine eigene Anwesenheitsliste für Drop-Ins und Probestunden, und darin reicht,
„wer am selben Tag auch die Probestunde oder den Drop-In macht".

Heute stehen diese Leute als gewöhnliche Zeile in der Vier-Wochen-Matrix — mit genau *einer* von vier
Zellen, die zu ihnen gehört. Wer am Kursabend wissen will, wer neu ist, müsste jede Zelle anklicken
und im Fähnchen „Quelle: Buchung" lesen. Umgekehrt bläht jede Probestunde die Liste der
Kursteilnehmer auf: drei leere Spalten pro Zeile, Woche für Woche.

Die Daten sind längst da — die Anwesenheitsfunktion unterscheidet seit PROJ-60 zwischen Abo, Buchung
und Gast. Nur die Oberfläche macht nichts daraus.

## User Stories

- Als Lehrkraft möchte ich am Kursabend auf einen Blick sehen, wer heute zur Probestunde oder als
  Drop-In kommt — ohne Zellen aufzuklappen.
- Als Lehrkraft möchte ich diese Leute an derselben Stelle abhaken können.
- Als Lehrkraft möchte ich in der Teilnehmerliste nur die wiederkehrenden Teilnehmer sehen.
- Als Lehrkraft möchte ich vorausschauen können, wer nächste Woche zur Probestunde kommt.
- Als Verwaltung möchte ich erkennen, welcher Art ein Besuch ist: Probestunde, Drop-In oder Gast —
  ein Gastabend ist kein bezahlter Platz.

## Out of Scope

- **Tagesübersicht über alle Kurse** für den Empfang — ausdrücklich für später zurückgestellt
  (Entscheidung vom 2026-10-05). Die Liste hängt am Kurs, nicht am Tag.
- **Preis und Bezahlstatus** in der Liste. Die Buchung trägt einen Preis, aber Gutscheine,
  Studentenpreis und offene Posten liegen woanders; eine Zahl, die das nicht berücksichtigt, wäre
  schlimmer als keine.
- **Die Notiz aus der Buchung** („komme mit einer Freundin") — steht unter Probestunden in der
  Verwaltung.
- **Drucken** der Liste.
- **Anwesenheit für künftige Termine.** Die Datenbank verbietet das seit PROJ-13 und bleibt dabei.

## Acceptance Criteria

- [ ] Angenommen am gezeigten Termin ist eine Probestunde gebucht, wenn die Lehrkraft die Kursseite
      öffnet, dann steht diese Person in einer eigenen Liste unter der Anwesenheitsliste, mit dem
      Vermerk „Probestunde".
- [ ] Angenommen es ist ein Drop-In, dann lautet der Vermerk „Drop-In"; bei einem Gasttänzer „Gast".
- [ ] Angenommen jemand steht in dieser Liste, wenn die Lehrkraft die Matrix ansieht, dann steht er
      dort nicht mehr.
- [ ] Angenommen jemand nimmt über ein Abo oder eine Mitgliedschaft teil, dann steht er weiterhin in
      der Matrix und nicht in der Extra-Liste.
- [ ] Angenommen die Lehrkraft markiert jemanden in der Extra-Liste als anwesend, wenn die Seite neu
      geladen wird, dann steht die Markierung noch da.
- [ ] Angenommen am gezeigten Termin ist niemand als Probestunde, Drop-In oder Gast gebucht, dann
      steht dort ein Satz, der genau das sagt — keine leere Fläche.
- [ ] Angenommen die Lehrkraft klickt in der Matrix auf das Datum einer anderen Spalte, dann zeigt
      die Extra-Liste die Gäste dieses Termins.
- [ ] Angenommen der heutige Termin liegt in der gezeigten Staffel, wenn die Seite geöffnet wird,
      dann ist er vorausgewählt.
- [ ] Angenommen der heutige Termin liegt nicht in der gezeigten Staffel, dann ist der nächste
      anstehende Termin vorausgewählt — und liegt die ganze Staffel in der Vergangenheit, der letzte.
- [ ] Angenommen die Lehrkraft lädt frühere oder spätere Termine nach und der ausgewählte Termin ist
      nicht mehr dabei, dann wählt die Liste selbst einen gezeigten Termin.
- [ ] Angenommen der gewählte Termin liegt in der Zukunft, dann sind die Namen zu sehen, das Abhaken
      bleibt aber verwehrt — wie in der Matrix.
- [ ] Angenommen ein Gast hat sich selbst eingecheckt, dann ist das in der Extra-Liste zu erkennen.
- [ ] Angenommen der Kurs fragt nach der Rolle, dann steht sie auch in der Extra-Liste.

## Edge Cases

- **Abo *und* alte Probestunde im selben Kurs**: Die Person gehört in die Matrix. Das Abo gewinnt —
  es gilt über alle Termine, die Probestunde galt für einen.
- **Ein Gasttänzer, der später ein Abo bekommt**: ab dann Matrix, davor Extra-Liste. Entschieden
  wird je Termin, nicht je Person.
- **Von Hand hinzugefügte Person** (Quelle „manuell"): Matrix. Sie wurde dort hinzugefügt, dort
  gehört sie hin.
- **Zwischen Auslieferung und Einspielen der SQL-Änderung** liefert die Datenbank noch die gröbere
  Quelle „Buchung" statt „Probestunde"/„Drop-In". Die Liste muss diese Person trotzdem zeigen,
  sonst verschwindet sie für ein paar Stunden aus *beiden* Listen.
- **Niemand im ganzen Kurs**: Die Matrix sagt das schon („keine Kursteilnehmer erfasst"); die
  Extra-Liste sagt es für ihren Termin getrennt.
- **Ein Termin in den Ferien oder vor Kursbeginn** steht gar nicht in den Spalten (PROJ-51/PROJ-72)
  und kann deshalb auch nicht gewählt werden.

## Technical Requirements

- Eine Migration: die Anwesenheitsfunktion unterscheidet Probestunde und Drop-In, statt beides
  „Buchung" zu nennen. Rechte danach neu vergeben (`.claude/rules/backend.md`).
- Keine zusätzliche Abfrage pro Termin — die Aufteilung entsteht aus den Daten, die die Seite schon
  lädt.
- Sicherheit: unverändert. Wer die Liste sehen darf, entscheidet weiterhin die Datenbankfunktion
  (Lehrkraft dieses Kurses oder Verwaltung).

## Open Questions
- Keine offen.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Die Liste hängt am Kurs im Lehrerbereich | Dort wird abgehakt. Eine eigene Tagesseite hieße, zwischen zwei Seiten zu wechseln, während zwanzig Leute im Raum stehen. | 2026-10-05 |
| Gasttänzer kommen mit in die Liste | Für den Abend ist ein Gast dasselbe wie ein Drop-In: einmal da, kein Platz im Kurs. Was er ist, steht daneben. | 2026-10-05 |
| Einmal-Gäste verschwinden aus der Matrix | Drei leere Spalten pro Zeile sind kein Hinweis, sondern Rauschen. Abgehakt wird in der Extra-Liste. | 2026-10-05 |
| Der Termin ist wählbar, nicht fest „heute" | So sieht die Lehrkraft vorab, wer nächste Woche zur Probestunde kommt — und an einem Tag ohne Kurs ist die Liste nicht einfach leer. | 2026-10-05 |
| Die Rollenübersicht zählt weiterhin nur die Kursteilnehmer | Sie beschreibt den Kurs, nicht den einzelnen Abend. Die Rollen der Einmal-Gäste stehen in deren Liste. | 2026-10-05 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Die bestehende Anwesenheitsfunktion wird feiner, statt eine zweite daneben zu stellen | Zwei Funktionen über dieselben Zeilen hätten früher oder später zwei verschiedene Antworten gegeben. Der Rückgabetyp bleibt gleich, nur die Werte werden genauer — `create or replace` genügt. | 2026-10-05 |
| „Buchung" bleibt als Einmal-Quelle gültig | Zwischen Auslieferung und Migration kommt dieser Wert noch aus der Datenbank. Wer ihn nicht kennt, lässt die Person aus beiden Listen fallen. | 2026-10-05 |
| Die Aufteilung ist eine eigene, prüfbare Regel ohne Oberfläche | Dieselbe Lehre wie bei den Staffeln (PROJ-72): Was entscheidet, wer wo steht, gehört nicht in eine Komponente mit 450 Zeilen. | 2026-10-05 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Was sich wo ändert

```
Lehrerseite eines Kurses
+-- Lehrmaterial                                (unverändert)
+-- Anwesenheitsliste (Matrix, 4 Wochen)
|   +-- Spaltenkopf: Datum ist jetzt anklickbar  → wählt den Termin
|   +-- Zeilen: nur noch Abos, Mitgliedschaften, von Hand Hinzugefügte
+-- NEU: „Probestunden, Drop-Ins & Gäste am <Datum>"
    +-- Name · Art · Rolle · Selbst-Check-In · Anwesend/Abwesend
    +-- oder ein Satz, dass für diesen Termin niemand gebucht ist
```

### Die Regel, wer wo steht

Die Anwesenheitsfunktion liefert zu jedem Termin je Person eine **Quelle**: Abo, Probestunde,
Drop-In, Gast oder manuell. Daraus entsteht die Aufteilung:

- **Matrix**: jede Person, die an *mindestens einem* der gezeigten Termine über ein Abo, eine
  Mitgliedschaft oder von Hand dabei ist.
- **Extra-Liste**: die übrigen Personen des *gewählten* Termins.

Dass „mindestens einem" dort steht, ist die Antwort auf den Grenzfall „Gast wird später
Abo-Teilnehmer": Sobald sie zum Kurs gehört, gehört sie in die Matrix — auch wenn sie am Anfang der
Staffel noch Gast war.

Diese Regel liegt als eigenes, geprüftes Stück Logik neben der Oberfläche, nicht darin.

### Datenmodell

Keine neue Tabelle, keine neue Spalte. Eine Migration ändert in der Anwesenheitsfunktion nur die
Bezeichnung der Quelle: aus „Buchung" wird „Probestunde" oder „Drop-In", je nach Buchungsart. Alles
andere — wer gezeigt wird, ab wann ein Platz gilt, wer die Liste sehen darf — bleibt Wort für Wort
stehen.

### Abhängigkeiten

Keine neuen Pakete.

### Reihenfolge beim Ausliefern

Die Oberfläche kennt „Buchung" weiterhin als Einmal-Quelle. Dadurch ist die Reihenfolge frei: Wird
erst ausgeliefert und die Migration später eingespielt, stehen die Gäste in der richtigen Liste, nur
mit dem gröberen Vermerk „Buchung".

## QA Test Results (2026-10-05)

**Empfehlung: bereit für die Produktion.** Eine Migration, in der Testdatenbank eingespielt und
geprüft; die Produktion fehlt noch.

| | |
|---|---|
| Regeln (Unit) | 22 für die Aufteilung und die Terminwahl |
| Datenbank | 6 für die Quellen, inklusive Rechteprüfung |
| Browser (E2E) | 5 neu, in Chromium und Mobile Safari grün (10 Läufe) |
| Rückblick | PROJ-13 (Lehreransicht) und PROJ-30 (Rollen): 25 Prüfungen, grün |
| Gesamt | 1091 Unit- und Datenbankprüfungen grün (1 übersprungen) |
| Produktfehler gefunden | 0 — zwei Mängel an der Prüfkette (siehe unten) |

### Was geprüft ist

**Die Aufteilung** an ihren Grenzen: Probestunde an einem Termin, Abo über mehrere, der Fall „Gast
wird später Abo-Teilnehmerin" (gehört in die Matrix), die eben von Hand hinzugefügte Person ohne
jede Zelle (gehört *nicht* in die Gästeliste), und die alte, gröbere Quelle `buchung`.

**Die Terminwahl**: heute, wenn dabei; sonst der nächste anstehende; sonst der letzte; und das
Nachwählen, wenn der gewählte Termin nach dem Blättern nicht mehr gezeigt wird.

**Die Datenbank**: jede der vier Quellen beim richtigen Namen — `probestunde`, `dropin`, `gast`
(PROJ-60 unverändert), `abo` (PROJ-69 unverändert) —, dass „buchung" nicht mehr vorkommt, und dass
die Funktion ohne Anmeldung verschlossen bleibt. Letzteres, weil `create or replace function` die
Rechte zurücksetzt; das ist der häufigste Fehler bei genau dieser Art von Migration.

**Der Weg im Browser**, über „Meine Kurse" statt per Adresse: Die Liste zeigt Probestunde, Drop-In
und Gast jeweils **in derselben Zeile wie den Namen**; der Drop-In der Vorwoche steht nicht dabei;
die Matrix zeigt nur die Abo-Teilnehmerin; ein Klick auf ein anderes Datum tauscht die Liste; ein
Häkchen überlebt das Neuladen; ein Termin ohne Gäste sagt es in einem Satz.

### Zwei Mängel an der Prüfkette — keiner im Produkt

**PROJ-13 las die Spaltenbeschriftung über `span`.** Das Datum ist jetzt ein Knopf. Die Beschriftung
bleibt deshalb in einem `span` *innerhalb* des Knopfs — der Nachbartest bleibt gültig, und ein
anklickbares Datum ist trotzdem ein Knopf.

**Der Markup-Prüfer hielt ein selbstschließendes `<span … />` für geöffnet** und meldete alles bis
zum nächsten `</span>` als verschachtelt. Die Suche schließt selbstschließende Tags jetzt aus — und
zwei Proben im Test selbst halten fest, dass sie das gesuchte Muster weiterhin findet. Ohne die wäre
nicht zu unterscheiden, ob das Projekt sauber ist oder die Suche nichts mehr findet.

### Was offen bleibt

- Die **Migration in der Produktion**.
- Die **Tagesübersicht für den Empfang** (Out of Scope, bewusst zurückgestellt).


## Deployment
_To be added by /deploy_
