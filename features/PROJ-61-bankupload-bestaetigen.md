# PROJ-61: Bankupload bestätigen, bevor die Rechnungen entstehen

## Status: Planned
**Created:** 2026-09-16
**Last Updated:** 2026-09-16

## Dependencies
- Requires: PROJ-7 (SEPA-Lastschrift) — Läufe, Datei, Rechnungen
- Requires: PROJ-47 (Lauf korrigieren) — die Freigabe und die Sperre
- Betrifft: PROJ-59 (Ticket stornieren) — dort entscheidet `released_at`, ob ein Betrag als abgebucht gilt

## Anlass
Aus dem Betrieb am 2026-09-16: Der Betreiber gab einen Lauf frei, lud die Datei herunter — und die
Bank wies sie ab. Die Rechnungen standen da bereits, die Ankündigungen an die Kunden waren
eingereiht, und der Lauf war gesperrt.

Der Grund war ein Formatfehler in der Datei, der inzwischen behoben ist. Die Schwäche im Ablauf
bleibt: **Die Freigabe erledigt alles, bevor irgendjemand weiß, ob die Bank die Datei annimmt.**

## Der Befund

Die Freigabe tut fachlich genau das Richtige — sie sperrt den Lauf, erzeugt die Rechnungen und reiht
die Ankündigungen ein. Falsch ist nur der **Zeitpunkt**, zu dem der Betreiber sie auslöst: vor dem
Upload statt danach. Die Datei lässt sich ohnehin jederzeit herunterladen, auch ohne Freigabe.

Deshalb braucht dieses Projekt **keine Schemaänderung**. Es braucht einen Namen, der sagt, was der
Klick bedeutet, eine Rückfrage, die die Folgen benennt, und eine Oberfläche, die die Reihenfolge
nahelegt.

## User Stories
- Als Betreiber möchte ich erst bestätigen, dass die Bank die Datei angenommen hat, bevor Rechnungen entstehen — damit eine abgelehnte Datei keine Buchhaltung hinterlässt.
- Als Betreiber möchte ich einen abgelehnten Lauf noch korrigieren können, ohne ihn zu verwerfen und neu aufzubauen.
- Als Betreiber möchte ich beim Bestätigen schwarz auf weiß lesen, was gleich passiert — wie viele Rechnungen entstehen und dass die Kunden benachrichtigt werden.
- Als Kunde möchte ich keine Ankündigung für eine Abbuchung bekommen, die nie stattfindet.

## Out of Scope
- **Rückgängig machen der Bestätigung** — bewusst verworfen, Begründung im Decision Log
- **Automatisches Erkennen, ob die Bank die Datei angenommen hat** — dafür müsste die App bei der Bank anfragen; das ist ein eigenes, viel größeres Vorhaben
- **Ein Datumsfeld für den Zeitpunkt des Uploads** — bewusst verworfen
- **Änderungen am Format der Datei** — das war ein eigener Fehler und ist behoben (PROJ-7, 2026-09-16)
- **Eine Schemaänderung** — `released_at` bedeutet künftig „bestätigt hochgeladen"; die Spalte bleibt

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Die Reihenfolge
- [ ] Angenommen ein Lauf ist angelegt, wenn der Betreiber ihn ansieht, dann steht das Herunterladen der Datei vor dem Bestätigen — in dieser Reihenfolge und sichtbar als Abfolge
- [ ] Angenommen ein Lauf ist noch nicht bestätigt, wenn der Betreiber ihn ansieht, dann lässt er sich weiterhin ändern: Positionen entfernen, Beträge anpassen, Positionen hinzufügen
- [ ] Angenommen ein Lauf ist noch nicht bestätigt, wenn die Bank die Datei abgelehnt hat, dann kann der Betreiber korrigieren und erneut herunterladen, ohne den Lauf zu verwerfen
- [ ] Angenommen ein Lauf wurde bestätigt, wenn der Betreiber etwas ändern will, dann ist der Lauf gesperrt — wie bisher nach der Freigabe

### Die Bestätigung
- [ ] Angenommen der Betreiber wählt „Bei der Bank hochgeladen", wenn die Rückfrage erscheint, dann nennt sie die Zahl der entstehenden Rechnungen, die Gesamtsumme und dass die Kunden benachrichtigt werden
- [ ] Angenommen die Rückfrage erscheint, wenn sie gelesen wird, dann steht darin, dass der Schritt nicht rückgängig zu machen ist
- [ ] Angenommen der Betreiber bestätigt, wenn der Vorgang durchläuft, dann entstehen die Rechnungen, die Ankündigungen werden eingereiht und der Lauf ist gesperrt — alles wie bisher bei der Freigabe
- [ ] Angenommen der Betreiber bricht ab, wenn er den Dialog schließt, dann ist nichts geschehen
- [ ] Angenommen ein Lauf ist bereits bestätigt, wenn jemand es erneut versucht, dann wird das abgewiesen — wie bisher

### Was der Betreiber sieht
- [ ] Angenommen ein Lauf ist noch nicht bestätigt, wenn der Betreiber die Liste der Läufe ansieht, dann ist erkennbar, dass dieser Lauf noch offen ist
- [ ] Angenommen ein Lauf ist bestätigt, wenn der Betreiber ihn ansieht, dann steht dort, wann und durch wen
- [ ] Angenommen ein Lauf ist bestätigt, wenn ein Ticket desselben Kunden storniert wird, dann gilt der Betrag als abgebucht (PROJ-59) — und vorher nicht

## Edge Cases
- **Bestätigen, ohne je heruntergeladen zu haben:** Möglich, und die Rückfrage ist die einzige Hürde. Siehe Open Questions.
- **Zwei Admins bestätigen gleichzeitig:** Genau einer setzt den Lauf um; der zweite bekommt „bereits bestätigt" statt eines Fehlers. Das verhält sich schon heute so.
- **Die Bank nimmt nur einen Teil an:** Kommt bei SEPA nicht vor — entweder die Datei geht durch oder sie wird ganz abgelehnt.
- **Der Betreiber vergisst zu bestätigen:** Die Abbuchung läuft trotzdem, aber es gibt keine Rechnungen. Die Liste der Läufe muss das sichtbar machen, sonst fällt es erst beim Jahresabschluss auf.
- **Ein Lauf wird nie bestätigt und soll weg:** Das Verwerfen eines Entwurfs gibt es bereits (PROJ-47).

## Technical Requirements
- Keine Schemaänderung: `released_at` und `released_by` bedeuten künftig „bestätigt hochgeladen"
- Die Sperre und die Erzeugung der Rechnungen bleiben unverändert an diesem Zeitpunkt
- Sprache: Deutsch (Verwaltung)

## Open Questions
- [ ] Soll sich der Lauf erst bestätigen lassen, **nachdem** die Datei mindestens einmal heruntergeladen wurde? Das wäre eine echte Hürde statt einer Rückfrage, kostet aber eine Spalte. Vorschlag: vorerst nicht, und beobachten, ob es je vorkommt
- [ ] Soll die Liste der Läufe einen Hinweis zeigen, wenn ein Lauf seit mehr als ein paar Tagen unbestätigt ist? Vorschlag: später, falls es vorkommt

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Der Lauf bleibt bis zur Bestätigung änderbar | Genau der Fall vom 2026-09-16: Lehnt die Bank ab, will man korrigieren und neu herunterladen, nicht den ganzen Lauf verwerfen und wieder aufbauen | 2026-09-16 |
| Die Bestätigung ist endgültig | Jede Rechnung verbraucht eine fortlaufende Nummer. Sie einfach zu löschen risse Lücken in die Nummernfolge; ein Irrtum wird deshalb über das Stornieren der Rechnungen bereinigt (PROJ-46), wie jeder andere Rechnungsfehler auch | 2026-09-16 |
| Kein Datumsfeld, nur eine Bestätigung | Der Klick passiert unmittelbar nach dem Upload. Ein Feld, das in 99 von 100 Fällen „heute" enthält, ist ein Feld zu viel | 2026-09-16 |
| Keine Schemaänderung | Die Freigabe tut bereits fachlich das Richtige; falsch war nur der Zeitpunkt, zu dem sie ausgelöst wird. Ein neuer Zustand neben `released_at` würde zwei Wahrheiten schaffen, wo eine genügt | 2026-09-16 |
| Die Ankündigungen gehen erst mit der Bestätigung raus | Sie tun es schon heute — und das ist richtig: Niemand soll eine Abbuchung angekündigt bekommen, die nie stattfindet | 2026-09-16 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Keine Schemaänderung, keine Migration | Die Freigabe tat fachlich bereits das Richtige. Falsch war nur der Zeitpunkt, zu dem der Betreiber sie auslöste — und der steckte in der Oberfläche: Den Herunterladen-Knopf gab es erst **nach** der Freigabe, der Ablauf zwang also in die falsche Reihenfolge | 2026-09-16 |
| `released_at` behält seinen Namen | Es bedeutet jetzt „bestätigt hochgeladen". Ein zweiter Zustand daneben hätte zwei Wahrheiten geschaffen — und die Ticket-Stornierung aus PROJ-59 liest daran ab, ob Geld geflossen ist. Mit der neuen Bedeutung wird sie genauer, nicht ungenauer | 2026-09-16 |
| Die Server-Handlung heißt `bestaetigeBankupload` | `gibLaufFrei` beschrieb, was technisch passiert. Der neue Name beschreibt, was der Mensch tut — und daran hing das Missverständnis | 2026-09-16 |
| Die Knöpfe tragen Nummern („1. … / 2. …") | Die Reihenfolge ist der ganze Punkt dieses Projekts. Zwei gleichrangige Knöpfe nebeneinander hätten sie wieder dem Zufall überlassen | 2026-09-16 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Der Befund in einem Satz

Der Fehler saß nicht in der Logik, sondern in der Reihenfolge, die die Oberfläche vorgab: Den
Knopf „SEPA-XML herunterladen" gab es **erst nach** der Freigabe. Wer die Datei wollte, musste
vorher buchen.

### Was sich ändert

```
vorher                              nachher
─────────────────────────────       ─────────────────────────────
Entwurf                             Entwurf
  Position hinzufügen                 Position hinzufügen
  Entwurf verwerfen                   Entwurf verwerfen
  [Lauf freigeben] ───┐               [1. SEPA-XML herunterladen]
                      │               [2. Bei der Bank hochgeladen] ───┐
Freigegeben ◄─────────┘                                               │
  [SEPA-XML herunterladen]          Bestätigt ◄─────────────────────────┘
                                      [SEPA-XML herunterladen]
```

Fachlich passiert beim zweiten Knopf genau dasselbe wie vorher bei der Freigabe: sperren,
Rechnungen erzeugen, Ankündigungen einreihen. Nur der Moment ist ein anderer.

### Was gleich bleibt

Die Datenbankfunktion, die Spalten, die Sperre, die Rechnungserzeugung, die Ankündigungen. Keine
Migration. Das Risiko dieses Projekts liegt damit nicht im Code, sondern in den Texten — deshalb
sind sie der eigentliche Gegenstand.

### Backend nötig?

Nein. Eine umbenannte Server-Handlung, sonst nur Oberfläche.

### Zusätzliche Pakete

Keine.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
