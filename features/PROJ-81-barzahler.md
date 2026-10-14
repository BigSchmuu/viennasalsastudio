# PROJ-81: Barzahler — Liste für die Lehrkraft, Überblick für die Verwaltung

> **Abgelöst von PROJ-84** (2026-10-14): Die abgeleitete Liste — kein Mandat heißt Barzahler, der
> Betrag kommt aus dem Abo — ist durch Einträge von Hand ersetzt. Der Anlass und die Entscheidungen
> hier bleiben lesenswert; die Mechanik gilt nicht mehr.

## Status: Deployed
**Created:** 2026-10-13
**Last Updated:** 2026-10-13

## Dependencies
- Requires: PROJ-8 (SEPA-Mandat) — das Fehlen eines Mandats *ist* die Unterscheidung
- Requires: PROJ-70 (kein zweiter Einzug im Zyklus) — `istFaellig` entscheidet auch hier
- Requires: PROJ-13/72/74 (Lehreransicht) — der Ort, an dem eingesammelt wird
- Requires: PROJ-50/69 (`course_members`) — wer gehört zu diesem Kurs
- Berührt: PROJ-37 (Offene Posten) — dieselbe Frage für Lastschriften

## Anlass

Der Betreiber führt die Barzahler auf **Papier** und möchte sie den Tanzlehrern bereitstellen,
getrennt von den Lastschriften.

Die Unterscheidung existiert in den Daten längst: Wer ein SEPA-Mandat hat, wird eingezogen; wer keines
hat, zahlt bar — der Lastschriftlauf nimmt genau diese Leute nicht mit
(`actions/admin/sepa-collections.ts`). Gezeigt wurde das niemandem, und am Kursabend steht die
Lehrkraft mit einem Blatt Papier da, das am Tag nach dem Ausdrucken veraltet ist.

Gegen eine Tabelle bei Google sprach vor allem der Datenschutz: Namen samt Zahlungsstand wären
personenbezogene Daten an einem Ort ohne Auftragsverarbeitungsvertrag, und die Lehrkräfte würden
Empfänger außerhalb der Zugriffskontrolle der App — wer den Link einmal hat, hat ihn für immer.

## User Stories

- Als Lehrkraft möchte ich am Kursabend sehen, wer bar zahlt und wie viel.
- Als Lehrkraft möchte ich das eingesammelte Geld sofort abhaken, auf dem Handy, an derselben Stelle,
  an der ich die Anwesenheit erfasse.
- Als Lehrkraft möchte ich einen Fehlgriff zurücknehmen können.
- Als Betreiber möchte ich über alle Kurse sehen, wer noch offen ist.
- Als Betreiber möchte ich sehen, wer wann wie viel eingesammelt hat.

## Out of Scope

- **Belege über Bargeld** und der Buchhaltungs-Export. Das berührt in Österreich die
  Registrierkassen- und Belegerteilungspflicht und gehört vor den Steuerberater, nicht in diese Spec.
  Die Liste hält fest, dass Geld geflossen ist — sie stellt keinen Beleg aus.
- **Teilzahlungen.** Abgehakt wird der Beitrag eines Zyklus, ganz oder nicht.
- **Barzahlung für Drop-ins und Probestunden.** Die stehen seit PROJ-74 schon am Kursabend in ihrer
  eigenen Liste; dort geht es um einen einzelnen Abend, nicht um einen Zyklus.
- **Ein Zahlungsart-Feld am Abo.** „Kein Mandat" ist die Unterscheidung, und sie ist immer aktuell.
  Ein zweites Feld daneben könnte ihr widersprechen.
- **Mahnen.** Wer offen ist, steht in der Liste; eine Erinnerung daraus ist eine eigene Entscheidung.
- **Events.** Die kennen Barzahlung längst, je Ticket (PROJ-14).

## Acceptance Criteria

- [ ] Angenommen ein Kurs hat Teilnehmer ohne SEPA-Mandat, wenn die Lehrkraft die Kursseite öffnet,
      dann stehen sie in einem eigenen Abschnitt „Barzahler" mit Name und Betrag.
- [ ] Angenommen ein Teilnehmer hat ein Mandat, dann steht er **nicht** in dieser Liste.
- [ ] Angenommen für einen Barzahler ist der Beitrag dieses Zyklus fällig, dann ist er als offen
      gekennzeichnet und die Lehrkraft kann „Bezahlt" drücken.
- [ ] Angenommen die Lehrkraft drückt „Bezahlt", dann ist die Zahlung mit Betrag, Tag und Name der
      Lehrkraft festgehalten und die Zeile zeigt sie an.
- [ ] Angenommen der Beitrag dieses Zyklus ist schon bezahlt, dann steht das da — mit dem Tag — und
      es gibt keinen zweiten Knopf.
- [ ] Angenommen die Lehrkraft hat sich vertippt, dann kann sie eine **heute** erfasste Zahlung
      zurücknehmen.
- [ ] Angenommen es sind vier Wochen seit der letzten Barzahlung vergangen (Ferien verlängern), dann
      ist der Beitrag wieder fällig — nach derselben Regel wie beim Lastschriftlauf.
- [ ] Angenommen ein Kurs hat keine Barzahler, dann sagt ein Satz das — keine leere Fläche.
- [ ] Angenommen eine Flatrate ohne Mandat läuft über mehrere Kurse, dann erscheint sie in jedem
      davon, mit dem Hinweis, dass der Betrag für die ganze Flatrate gilt — und ist sie einmal
      bezahlt, sehen alle Lehrkräfte sie als bezahlt.
- [ ] Angenommen der Betreiber öffnet „Barzahlungen" in der Verwaltung, dann sieht er, wer offen ist
      (Kunde, Kurs, Betrag, letzte Zahlung) und was im Zeitraum eingesammelt wurde (mit Lehrkraft).
- [ ] Angenommen jemand ohne Anmeldung ruft die Funktionen auf, dann wird er abgewiesen; eine
      Lehrkraft darf nur für ihre eigenen Kurse abhaken.

## Edge Cases

- **Doppeltes Antippen**: Ein Trigger lässt innerhalb von vier Wochen keine zweite Zahlung zu. Das
  ist ein Netz gegen den Fehlgriff, nicht die fachliche Regel — die steht in `istFaellig` und
  berücksichtigt zusätzlich die Ferien. Eine Zahlung, die weniger als vier Wochen nach der letzten
  käme, ist nach dieser Regel ohnehin nie fällig.
- **Ferien**: verlängern den Zyklus, wie beim Einzug. Wer im August zwei Wochen geschlossen hat,
  sammelt im September nicht trotzdem pünktlich ein.
- **Mandat kommt dazu**: Der Kunde verschwindet aus der Barliste und wird beim nächsten Lauf
  eingezogen. Bereits erfasste Barzahlungen bleiben stehen — sie sind passiert.
- **Mandat widerrufen**: Der Kunde erscheint in der Barliste. Ob der letzte Einzug den laufenden
  Zyklus abdeckt, entscheidet `istFaellig` — dafür zählen Einzüge **und** Barzahlungen zusammen.
- **Abo ohne Preis** (`price` ist null): Er steht in der Liste, aber ohne Betrag — und abhaken lässt
  sich nichts, was keinen Betrag hat. Die Lehrkraft sieht den Hinweis, der Betreiber den fehlenden
  Preis.
- **Pausiertes Abo**: kein Barzahler. Es wird auch nicht eingezogen.
- **Gekündigtes Abo**: bis zum Stichtag läuft es und ist zu zahlen; danach nicht mehr.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Keine Tabelle bei Google | Namen und Zahlungsstand ohne AVV, Lehrkräfte als Empfänger außerhalb der Zugriffskontrolle, und eine zweite Wahrheit, die am Tag nach dem Ausdrucken veraltet. | 2026-10-13 |
| Barzahler = Abo-Kunde ohne Mandat | Entscheidung des Betreibers. Dieselbe Unterscheidung, nach der der Lastschriftlauf auswählt — damit kann sie nicht auseinanderlaufen. | 2026-10-13 |
| Die Lehrkraft sieht Beträge | Entscheidung des Betreibers. Sie sammelt das Geld ein; ohne Betrag müsste sie fragen. | 2026-10-13 |
| Abgehakt wird dort, wo die Anwesenheit erfasst wird | Die Lehrkraft hat die Kursseite am Abend ohnehin offen. Ein zweiter Ort wäre ein zweiter, den man vergisst. | 2026-10-13 |
| Zurücknehmen nur für heute (Lehrkraft) | Ein Fehlgriff fällt sofort auf. Was älter ist, gehört in die Verwaltung — sonst verschwindet Geld aus der Aufzeichnung, das längst eingesammelt wurde. | 2026-10-13 |
| Kein Beleg, kein Export | Registrierkassen- und Belegerteilungspflicht sind eine Frage für den Steuerberater. Die Liste hält fest, dass Geld geflossen ist. | 2026-10-13 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| `istFaellig` aus PROJ-70 entscheidet auch über die Barzahlung | Sonst bedeuteten „Zyklus" und „bezahlt" bei Bar und Lastschrift Verschiedenes — und zwar unbemerkt. Eine Barzahlung zählt dabei wie ein Einzug. | 2026-10-13 |
| Die Lehrkraft kommt nur über `security definer`-Funktionen an die Daten | Für Lehrkräfte sind `subscriptions` und `sepa_mandates` gesperrt (PROJ-49). Beträge über eine Funktion mit eigener Rechteprüfung — nicht über eine neue Leseregel auf einer Tabelle mit IBANs. | 2026-10-13 |
| Eine eigene Tabelle `cash_payments`, eine Zeile je Zahlung | Kein „bezahlt"-Häkchen am Abo: Das wüsste nicht, *wann* und *von wem*, und beim nächsten Zyklus müsste es jemand zurücksetzen. | 2026-10-13 |
| Vier-Wochen-Sperre als Trigger in der Datenbank | Netz gegen das doppelte Antippen. Bewusst ohne Ferienrechnung: Die ist in SQL eine zweite Wahrheit, und eine Zahlung unter vier Wochen ist ohnehin nie fällig. | 2026-10-13 |
| Kein Zahlungsart-Feld am Abo | „Kein Mandat" ist immer aktuell; ein Feld daneben könnte widersprechen — und widersprechende Felder gewinnt immer das falsche. | 2026-10-13 |

---

## Tech Design (Solution Architect)

```
Lehrerseite eines Kurses
+-- Lehrmaterial                          (unverändert)
+-- Anwesenheitsliste (Staffel)           (unverändert)
+-- Probestunden, Drop-Ins & Gäste        (PROJ-74)
+-- NEU: Barzahler
    Name · Betrag · Zustand               → [Bezahlt]  bzw.  „bezahlt am 03.10. ✓ zurücknehmen"

Verwaltung → Finanzen → Barzahlungen
+-- Offen (über alle Kurse)      Kunde · Kurs · Betrag · letzte Zahlung
+-- Eingesammelt im Zeitraum     Kunde · Betrag · Tag · Lehrkraft
```

**Die Daten.** Eine Tabelle `cash_payments`: je Zahlung eine Zeile mit Abo, Kunde, Tag, Betrag und
der Person, die sie erfasst hat. Kein Häkchen am Abo — das wüsste nicht, wann und von wem.

**Die Regel, ob jemand jetzt zahlen muss,** ist dieselbe wie beim Lastschriftlauf: `istFaellig` aus
PROJ-70, gefüttert mit **allen** bisherigen Zahlungen dieses Abos — Einzügen *und* Barzahlungen. Vier
Wochen Abstand, Ferien verlängern.

**Der Zugriff.** Die Lehrkraft erreicht nichts davon direkt: `subscriptions` und `sepa_mandates` sind
für sie gesperrt, und in der Mandatstabelle stehen IBANs. Also zwei Funktionen mit eigener
Rechteprüfung (`is_course_teacher(…) or current_role() = 'admin'`), wie bei der Anwesenheitsliste:
eine, die die Barzahler eines Kurses samt Betrag und bisherigen Zahlungen liefert, und eine, die eine
Zahlung erfasst. Eine dritte nimmt sie zurück — für die Lehrkraft nur am selben Tag.

### Migration

Eine Tabelle samt RLS (nur Verwaltung liest direkt), drei Funktionen, Rechte. Muss vor der
Auslieferung eingespielt werden.

## QA Test Results (2026-10-14)

**Empfehlung: bereit für die Produktion.** Migration vom Betreiber in Test und Produktion eingespielt.

| | |
|---|---|
| Regeln (Unit) | 13 für „wer muss jetzt zahlen": erster Beitrag, laufender Zyklus, vier Wochen, Ferien, Einzug statt Barzahlung, Reihenfolge, Summe, fehlender Preis |
| Datenbank | 9 für die drei Funktionen |
| Browser (E2E) | 3 für diesen Teil, in Chromium und Mobile Safari grün |
| Rückblick | PROJ-13, PROJ-74, PROJ-49, PROJ-16: 38 Prüfungen grün (PROJ-13 angepasst, siehe unten) |
| Gesamt | 1218 Unit- und Datenbankprüfungen grün |
| Produktfehler gefunden | 0 |

### Was geprüft ist

**Die Regel** an jedem Rand: Der erste Beitrag wartet auf nichts; zehn Tage nach einer Zahlung ist
nichts fällig; nach vier Wochen schon; eine Ferienwoche dazwischen verschiebt es nach hinten; und ein
**Einzug** deckt den Zyklus genauso ab wie eine Barzahlung — der Fall „Mandat gerade widerrufen".

**Die Funktionen** gegen die echte Datenbank: Der Barzahler steht mit Betrag in der Liste, der Kunde
mit Mandat nicht — und sobald das Mandat widerrufen ist, erscheint er. Erfasst wird mit dem Betrag
**aus dem Abo**, nicht mit einem übergebenen. Ein zweiter Druck im selben Zyklus wird abgewiesen. Die
Lehrkraft kann die heutige Zahlung zurücknehmen, eine 40 Tage alte nicht — die Verwaltung schon. Ohne
Anmeldung geht nichts, und ein Abo ohne Preis lässt sich nicht abhaken.

**Im Browser**: Die Lehrkraft hakt ab, und danach wird **in der Datenbank** nachgesehen — Betrag,
Tag und die Kennung der Lehrkraft. Dann das Zurücknehmen, ebenfalls mit Gegenprobe. Und die
Verwaltungsseite: eingesammelt steht unter „Eingesammelt", nicht mehr unter „Offen".

### Was angepasst werden musste

**PROJ-13** suchte Namen und Spaltenköpfe seitenweit. Auf der Kursseite stehen jetzt drei Tabellen
(Matrix, Einmal-Gäste, Barzahler), und ein Barzahler steht in zwei davon — vier Prüfungen trafen
deshalb zwei Elemente oder zählten acht Spalten statt vier. Die Eingrenzung auf die Matrix steht
jetzt an **einer** Stelle in der Datei, als Helfer: Dieselbe Falle hatte vorher schon PROJ-72 und
PROJ-74 erwischt.


## Deployment

**Produktion:** https://app.viennasalsastudio.at — ausgeliefert am 2026-10-14, 01:37
**Tag:** `v1.81.0-PROJ-81-82` (Commit `ac1956d`)
**Vercel:** `…e7qeeztj5`, Ready, als Produktion aliasiert

**Migration:** `20261013100000_proj81_barzahlungen.sql` — vom Betreiber in Test *und* Produktion
eingespielt, **vor** der Auslieferung.

### Für den Betrieb

Die Papierliste kann weg, sobald du geprüft hast, dass alle Barzahler auch in der App ein Abo mit
**Preis** haben: Ohne Preis steht die Person in der Liste, aber „Kein Preis am Abo" — abhaken lässt
sich nichts, was keinen Betrag hat. Das ist der einzige Handgriff, der nötig sein könnte.

Und ein Hinweis zur Flatrate: Sie gilt für alle Kurse. Die Zeile erscheint deshalb in jedem Kurs des
Kunden, mit dem Kennzeichen „Flatrate" — hakt eine Lehrkraft ab, sehen alle anderen sie als bezahlt.

`/lehrer` und `/admin/barzahlungen` antworten mit der Login-Umleitung; beide Oberflächen liegen
dahinter und sind durch die Browsertests belegt, die den Weg der Lehrkraft gehen und jedes Ergebnis
in der Datenbank nachprüfen.
