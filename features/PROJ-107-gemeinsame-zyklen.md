# PROJ-107: Ein gemeinsamer Zahlungszyklus für alle, eingetragen statt gerechnet

## Status: Planned
**Created:** 2026-11-17
**Last Updated:** 2026-11-17 (Architektur)

## Dependencies
- Requires: PROJ-7 (SEPA-Lastschrift) — der Lauf, der künftig am Zyklus hängt
- Requires: PROJ-70 (Einzug nur nach Unterrichtswochen) — die Sperre, die ersetzt wird
- Requires: PROJ-96 (Kündigungsfrist bis Sonntag) — die Frist, die bleibt, aber ein Datum für alle wird
- Requires: PROJ-98 (Zahlungszyklen bei den Barzahlern) — das Vorbild: ein Zyklus als Datensatz mit erstem und letztem Tag
- Requires: PROJ-51 (Kurszeitraum und Ferien) — die Schließungen, die künftig beim Anlegen eines Zyklus berücksichtigt werden, nicht beim Rechnen
- Berührt: PROJ-91 / PROJ-97 (Upgrade-Differenz), PROJ-102 (Studierendenpreis endet mit 28), PROJ-10 (Rechnungsarchiv), PROJ-103 (die Gründe im Lauf)
- Berührt die AGB in beiden Sprachen (`terms-de.tsx`, `terms-en.tsx`): Der Fristsatz, den PROJ-96 dort verankert hat, wird in Stufe 2 wieder gestrichen. Der ursprüngliche Satz — Kündigung „wird zum Ende des jeweils laufenden 4-Wochen-Zyklus wirksam" — stimmt dann wieder, mit dem Zyklus des Studios statt dem des einzelnen Abos
- Löst ab: PROJ-106 (Warnung beim Verwerfen) — unnötig, sobald das Zyklusende eine eingetragene Tatsache ist und nicht aus einem Lauf gerechnet wird

## Anlass

Im Studio gibt es längst **einen** Zahlungszyklus für alle. Nur im System nicht: Dort hat
jedes Abo seinen eigenen Rhythmus, verankert an seiner letzten Abbuchung, und jede
Schließung treibt die Abos weiter auseinander. Die Abweichung ist ein Artefakt der
Software, nicht des Betriebs.

Am 2026-11-17 hat das zum ersten Mal Geld gekostet — fast. Ein Abo verschwand aus einem
Lauf, und die Suche nach dem Grund legte vier verschiedene Begriffe von „Zyklus" frei:

| Wo | Regel | Ferien |
|---|---|---|
| Einzug (PROJ-70, TypeScript) | letzter Einzug + 28 Tage + Ferientage | ja |
| Kündigung (PROJ-96, SQL) | Spiegel der obigen Regel, zweite Fassung | ja |
| Studierendenpreis (PROJ-102, `next_cycle_end`) | Ankerdatum + 28 · k | **nein** |
| Barzahler (PROJ-98) | **eingetragen**: erster und letzter Tag | entfällt |

Drei abgeleitet, einer eingetragen — und der eingetragene ist der einzige, der noch nie
Ärger gemacht hat. Die Migration zu PROJ-96 warnt selbst: „ACHTUNG: Dieselbe Regel steht
damit zweimal im Projekt", zusammengehalten nur von einem Test, der beide Fassungen über
dieselben Eingaben vergleicht. Die dritte Fassung ist nicht einmal ferienbewusst: Ein Kunde
kann von der Preisankündigung ein anderes Zyklusende genannt bekommen als vom
Kündigungsdialog — für dasselbe Abo.

Dazu kommt, was am 2026-11-17 tatsächlich passiert ist: Weil das Kündigungsdatum aus dem
jüngsten Lauf gerechnet wird, **Entwürfe mitgezählt**, stand nach dem Verwerfen eines
Entwurfs ein Enddatum da, zu dem die passende Abbuchung fehlte. Diese ganze Fehlerklasse
verschwindet, sobald der Zyklus eingetragen wird.

## Die Regel in einem Absatz

Ein **Zyklus** ist ein Datensatz: erster Tag, letzter Tag, angelegt von der Verwaltung im
Voraus. **Kein Tag gehört zu zwei Zyklen** — das verbietet die Datenbank. Lückenlosigkeit ist
dagegen Vorbelegung und Warnung im Formular, nicht Verbot (Korrektur vom 2026-11-17, siehe
Decision Log). Vier Wochen sind nur noch der
**Vorschlag** beim Anlegen; wer schließt, verschiebt das Ende beim Anlegen von Hand. Alles
andere wird daraus abgeleitet: Ein Lauf zieht je Abo **einmal je Zyklus** ein. Eine
Kündigung wirkt zum Ende des Zyklus, in dem sie eingeht, mit Frist am letzten Sonntag
davor. Die Preisankündigung und die Upgrade-Differenz lesen dieselben Daten. Die Rechnung
nennt den Zeitraum, für den gezahlt wurde.

Wer **mitten im Zyklus** einsteigt, zahlt den **vollen** Beitrag für diesen Zyklus. Wer das
nicht will, bucht bis zum nächsten Zyklus Einzelstunden (`dropin_pricing` gibt es bereits)
und startet das Abo dann. Es gibt keine Teilbeträge — das ist die Entscheidung, die dieses
Vorhaben überhaupt klein hält.

**Der erste Zyklus im System ist 30.11.2026 bis 10.01.2027.** 42 Kalendertage: vier
Kurswochen (28 Tage) plus die zweiwöchige Weihnachtspause. Es gibt nichts zu überbrücken —
der laufende Zyklus wird noch mit dem bestehenden Verfahren eingezogen, ab dem 30.11. starten
alle Abos gemeinsam. Der Folgezyklus beginnt am 11.01.2027.

Diese Angaben des Betreibers stimmen auf den Tag mit der bestehenden Rechnung überein
(30.11. + 28 Tage = 28.12., plus 14 Schließtage = 11.01.2027 als erster Tag des Folgezyklus).
**Die Formel war nie falsch — nur ihr Anker.** Jedes Abo hing an seiner eigenen letzten
Abbuchung statt am Zyklus des Studios.

## User Stories

1. **Als Betreiber** will ich die Zahlungszyklen im Voraus eintragen, damit Einzug,
   Kündigungsfrist und Preisankündigung alle von denselben zwei Daten sprechen.
2. **Als Betreiber** will ich ein Zyklusende beim Anlegen verschieben können, wenn das
   Studio geschlossen hat, statt mich auf eine Rechnung zu verlassen, die ich nicht sehe.
3. **Als Betreiber** will ich einen Lauf zu einem Zyklus anlegen und darauf vertrauen, dass
   jedes Abo darin genau einmal vorkommt.
4. **Als Betreiber** will ich beim Anlegen eines Abos wählen, ob es im laufenden Zyklus
   beginnt (voller Beitrag) oder erst im nächsten.
5. **Als Betreiber** will ich eine Kündigungsfrist, die für alle derselbe Tag ist, damit ich
   sie aushängen und ankündigen kann.
6. **Als Kunde** will ich auf meiner Rechnung sehen, für welchen Zeitraum ich gezahlt habe.
7. **Als Kunde** will ich im Profil ein Zyklusende sehen, das mit dem übereinstimmt, das mir
   bei einer Preisänderung genannt wird.

## Out of Scope

- **Keine Teilbeträge, keine anteilige Abrechnung.** Betreiberentscheidung 2026-11-17: Wer
  mitten im Zyklus einsteigt, zahlt voll oder bucht Einzelstunden. Daran hängt der ganze
  Umfang dieses Vorhabens.
- **Keine Umstellung von Bestandsabos.** Es gibt keine Lücke und keinen Überhang: Der
  gemeinsame Rhythmus existiert im Betrieb schon, der laufende Zyklus wird wie bisher
  eingezogen, ab dem 30.11.2026 zählt der eingetragene Zyklus.
- **Die Barzahler-Zyklen (PROJ-98) bleiben zunächst getrennt.** Sie zusammenzuführen ist
  naheliegend und steht als offene Frage — aber es ändert den Arbeitsablauf beim
  Abschließen, und das gehört nicht in dieselbe Auslieferung wie der Umstieg.
- **Kein automatisches Anlegen von Zyklen.** Vorschlagen ja, selbständig anlegen nein; ein
  Zyklus entscheidet über Geld.
- **Kein Rückdatieren oder Ändern eines Zyklus, in dem schon eingezogen wurde.** Sonst
  ändert sich im Nachhinein, wofür jemand bezahlt hat.
- **Keine Kundensicht auf die Zyklusliste.** Der Kunde sieht sein Zyklusende und seine
  Frist, nicht die Tabelle.
- **`cycle_anchor_date` wird nicht entfernt.** Es bleibt als Beitrittsdatum stehen und
  verliert nur seine Rolle in der Abrechnung.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Stufe 1 — was der Umstieg am 30.11.2026 braucht

- [x] Angenommen es gibt noch keinen Zyklus, wenn der Betreiber einen anlegt, dann gibt er ersten und letzten Tag ein und die Liste zeigt ihn an
- [x] Angenommen ein Zyklus ist angelegt, wenn der Betreiber den nächsten anlegt, dann sind erster Tag (Tag nach dem Vorgänger) und letzter Tag (vier Wochen später) vorgeschlagen und beide änderbar
- [x] Angenommen für den Zeitraum sind Schließungen eingetragen, wenn der Betreiber das Formular öffnet, dann enthält der vorgeschlagene letzte Tag diese Schließtage und die Rechnung dazu ist sichtbar
- [x] Angenommen der Betreiber ändert das vorgeschlagene Ende, wenn er speichert, dann gilt sein Datum
- [x] Angenommen ein Zyklus würde sich mit einem bestehenden überschneiden, wenn der Betreiber speichert, dann wird es abgelehnt und der Grund genannt — E2E + DB-Test, sechs Lagen der Überschneidung
- [x] Angenommen der Beginn lässt eine Lücke zum letzten Zyklus, wenn der Betreiber das Feld ausfüllt, dann wird die Lücke in Tagen benannt, bevor er speichert, und das Anlegen bleibt möglich — E2E
- [x] Angenommen das Ende liegt vor dem Beginn, wenn der Betreiber speichert, dann nennt die Meldung diese Ursache und nicht eine andere — DB-Test
- [x] Angenommen in einem Zyklus wurde schon eingezogen, wenn der Betreiber ihn ändern oder löschen will, dann wird es abgelehnt
- [x] Angenommen ein Abo wurde in diesem Zyklus noch nicht eingezogen, wenn der Betreiber einen Lauf mit einem Fälligkeitstag in diesem Zyklus anlegt, dann ist das Abo darin
- [x] Angenommen ein Abo wurde in diesem Zyklus schon eingezogen, wenn der Betreiber einen zweiten Lauf im selben Zyklus anlegt, dann steht das Abo unter „Nicht aufgenommen" mit dem Grund „In diesem Zyklus schon eingezogen am [Datum]"
- [x] Angenommen ein Abo wurde im **vorigen** Zyklus eingezogen, wenn ein Lauf im neuen Zyklus angelegt wird, dann ist das Abo darin — unabhängig davon, wie viele Tage dazwischen liegen
- [x] Angenommen für den Fälligkeitstag ist kein Zyklus eingetragen, wenn ein Lauf angelegt wird, dann gilt die bisherige Vier-Wochen-Regel und der Betreiber wird darauf hingewiesen
- [ ] Angenommen ein Abo beginnt erst in einem späteren Zyklus, wenn ein Lauf angelegt wird, dann steht es unter „Nicht aufgenommen" mit diesem Grund

### Stufe 2 — der Rest

- [x] Angenommen ein Kunde kündigt an einem Tag innerhalb des laufenden Zyklus, wenn er bestätigt, dann wirkt die Kündigung zum Ende genau dieses Zyklus, und dieses Datum steht in der Tabelle der Zyklen
- [x] Angenommen ein Kunde kündigt am letzten Tag des Zyklus, wenn er bestätigt, dann wirkt sie noch zum Ende dieses Zyklus
- [ ] Angenommen im Profil wird die Kündigung angeboten, wenn der Kunde sie öffnet, dann ist von keiner Frist mehr die Rede — genannt wird der letzte Tag des laufenden Zyklus
- [ ] Angenommen der Betreiber hat für den neuen Zyklus schon einen Lauf angelegt, wenn ein Kunde danach noch rechtzeitig kündigt, dann steht seine Position noch im Entwurf und muss entfernt werden — die Verwaltung weist im Entwurf darauf hin
- [ ] Angenommen der Betreiber verschiebt ein künftiges Zyklusende, wenn ein Kunde danach kündigt, dann nennt das Profil das verschobene Datum
- [ ] Angenommen ein Kunde wird im nächsten Zyklus zu alt für den Studierendenpreis, wenn die Ankündigung erzeugt wird, dann nennt sie denselben Zyklusbeginn, den die Zyklusliste nennt
- [ ] Angenommen für ein Abo wird eine Upgrade-Differenz berechnet, wenn der Zyklus schon abgebucht ist, dann richtet sich die Rechnung nach dem eingetragenen Zyklus
- [ ] Angenommen eine Rechnung entsteht für einen Abobeitrag, wenn der Kunde sie öffnet, dann nennt die Position den Zeitraum, für den gezahlt wurde
- [ ] Angenommen das Studio schließt für eine Woche, wenn der Betreiber das Zyklusende entsprechend später ansetzt, dann verschieben sich Einzug und Kündigungsfrist für alle gemeinsam
- [ ] Angenommen ein Abo wird mitten im Zyklus angelegt und der Betreiber wählt „laufender Zyklus", wenn der Lauf angelegt wird, dann steht der volle Beitrag darin
- [ ] Angenommen er wählt „nächster Zyklus", wenn der Lauf für den laufenden angelegt wird, dann ist das Abo nicht darin

## Edge Cases

1. **Zwei Läufe im selben Zyklus** — der zweite nimmt nur, was fehlt. Das ist der
   Rücklastschrift-Fall und muss weiter möglich sein.
2. **Ein Lauf mit Fälligkeitstag außerhalb jedes eingetragenen Zyklus** — darf nicht still
   auf die alte Regel zurückfallen, ohne es zu sagen.
3. **Die Umstellung selbst** — der 30.11.2026 liegt zwölf Tage nach dem Einzug für den
   laufenden Zyklus. Die alte Regel würde jedes Abo sperren („wieder möglich ab 16.12."),
   die neue nicht. Genau deshalb muss Stufe 1 vorher ausgeliefert sein; die Rückfallebene
   ist das Nachtragen von Hand über „Trotzdem aufnehmen".
4. **Kündigung in der Übergangszeit** — mit Zyklusgrenzen 30.11.–27.12. nennt die alte
   Rechnung ebenfalls den 28.12. Alte und neue Fassung fallen zusammen, es gibt also kein
   Fenster mit zwei Wahrheiten. Das ist Glück und wird vom Test festgehalten, nicht
   vorausgesetzt.
5. **Kündigung nach dem Anlegen des Laufs** — ohne Frist kann sie bis zum letzten Tag des
   Zyklus eingehen, also auch noch, wenn der Lauf für den Folgezyklus schon als Entwurf
   steht. Die Position muss dann entfernt werden; der Entwurf weist darauf hin. Deshalb die
   Regel: Lauf am ersten Tag des Zyklus anlegen, nicht vorher.
6. **Ein Abo ohne Mandat** — bleibt ein Barzahler und kommt in keinen Lauf (siehe
   PROJ-105).
7. **Ein Zyklus wird angelegt, der in der Vergangenheit liegt** — erlaubt, solange er nicht
   mit einem Zyklus kollidiert, in dem schon eingezogen wurde. Für das Nachtragen der
   Historie.
8. **Eine Kündigung, die vor dem 30.11.2026 gespeichert wurde** — ihr Datum bleibt stehen,
   auch wenn es nicht auf eine Zyklusgrenze fällt. Dem Kunden wurde dieses Datum genannt.

## Technical Requirements

- Die Zyklusliste wird bei jedem Lauf, jeder Kündigung und jeder Preisankündigung gelesen —
  sie muss billig zu lesen sein und an genau einer Stelle stehen.
- Lückenlosigkeit und Eindeutigkeit des Endes gehören in die Datenbank, nicht in das
  Formular: PROJ-98 hat das bei `cash_cycles` so gelöst und es hat sich getragen.
- Security: Anlegen und Ändern nur Verwaltung. Kunden lesen die Tabelle nicht.
- Die alte Vier-Wochen-Rechnung bleibt als Rückfallebene erhalten, bis für alle Zeiträume
  Zyklen eingetragen sind.

## Open Questions

- [ ] Sollen die Barzahler-Zyklen (PROJ-98) dieselben Zyklen werden? Vorschlag: ja, aber in
      einer eigenen Auslieferung — es nimmt dem Abschließen die Wahl des Enddatums und
      ändert damit einen eingespielten Arbeitsablauf.
- [ ] Was wird aus `next_cycle_end`? Nach Stufe 2 hat es keine Aufrufer mehr. Vorschlag:
      stehen lassen und den Kommentar auf „ohne Aufrufer" setzen, wie PROJ-96 es schon
      einmal getan hat.
- [x] Die Frist fiel mit dem Zyklusende zusammen, weil alle Zyklen montags beginnen und
      sonntags enden — null Tage Vorlauf, genau das Problem, das PROJ-96 lösen sollte.
      Vorgeschlagen war eine Woche vorher. → **Entschieden: keine Frist. Eine Kündigung bis
      zum letzten Tag des Zyklus wirkt zum Ende dieses Zyklus.** Der Fristbegriff aus
      PROJ-96 entfällt damit ganz (2026-11-17).
- [ ] `src/lib/supabase/types.ts` ist für `billing_cycles` und `cycle_id` **von Hand**
      ergänzt, weil der MCP-Zugang zum Neugenerieren die ganze Sitzung abgewiesen wurde. Beim
      nächsten echten Generieren prüfen, insbesondere ob der Verweis vom Lauf auf den Zyklus
      als Objekt und nicht als Liste typisiert wird; die Handfassung trägt diese Verknüpfung
      nicht, der Browsertest fragt deshalb getrennt ab.
- [ ] Sollen vergangene Läufe rückwirkend einem Zyklus zugeordnet werden? Vorschlag: nein,
      erst ab dem 30.11.2026 — ein nachträglich erfundener Zyklus wäre eine Behauptung über
      einen Zeitraum, für den niemand so abgerechnet hat.
- [ ] Soll die Zyklen-Seite auch die Ferien anzeigen, damit beim Verschieben eines Endes
      sichtbar ist, welche Schließung dahintersteckt? Vorschlag: ja, als Lesehilfe ohne
      Bearbeitung — aber erst in Stufe 2.
- [ ] Bis wann sind Zyklen im Voraus einzutragen, und soll das System warnen, wenn der
      letzte eingetragene Zyklus näher als vier Wochen rückt? Vorschlag: ja, als Hinweis im
      Dashboard.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Ein gemeinsamer Zyklus für alle, nicht ein eingetragener Zyklus je Abo | Der gemeinsame Rhythmus existiert im Betrieb längst; das System war das einzige, das pro Abo rechnete | 2026-11-17 |
| Zyklen werden von Hand eingetragen, vier Wochen nur als Vorschlag | Damit verschwindet die Ferienarithmetik aus der Abrechnung — der eigentliche Gewinn. Wer schließt, verschiebt ein Datum, statt einer Rechnung zu vertrauen, die er nicht sieht | 2026-11-17 |
| Mitten im Zyklus: voller Beitrag, Alternative Einzelstunde | Betreiberentscheidung. Verhindert Teilbeträge und hält das Vorhaben klein; der Einzelstundenpreis ist bereits vorhanden | 2026-11-17 |
| Keine Überbrückung für Bestandsabos | Es gibt keine Lücke: der laufende Zyklus wird wie bisher eingezogen, ab 30.11.2026 zählt der eingetragene | 2026-11-17 |
| Zwei Stufen, Stufe 1 vor dem 30.11.2026 | Nur Tabelle, Formular und die neue Sperre sind für den Umstieg nötig. Alles andere unter Zeitdruck an Geldcode zu bauen wäre das größere Risiko | 2026-11-17 |
| Ein Zyklus, in dem eingezogen wurde, ist unveränderlich | Sonst ändert sich im Nachhinein, wofür jemand bezahlt hat | 2026-11-17 |
| Kündigungen von vor dem Umstieg behalten ihr Datum | Dem Kunden wurde dieses Datum genannt | 2026-11-17 |
| Keine Kündigungsfrist mehr — Kündigung bis zum letzten Tag des Zyklus | Betreiberentscheidung 2026-11-17, nach dem Hinweis, dass damit null Tage Vorlauf bleiben: die kundenfreundliche und einfachst erklärbare Regel. Der Fristbegriff aus PROJ-96 entfällt, die Sonntagsrechnung wird nicht ersetzt, sondern gestrichen | 2026-11-17 |
| Ein Lauf wird am ersten Tag des Zyklus oder später angelegt, nicht vorher | Folgt zwingend aus der Entscheidung oben: Wer am 8.1. einen Lauf für den Zyklus ab 11.1. freigibt, hat eine Kündigung vom 10.1. nicht mehr darin | 2026-11-17 |
| Lückenlosigkeit ist Vorschlag und Warnung, nicht Datenbankregel | Als Datenbankregel machte sie das Feature unprüfbar: Die echte Kette beginnt am 30.11.2026, ein Test für 2032 hätte achtzig Zyklen dazwischen gebraucht. Eine Regel, die Tests verhindert, schützt kein Geld. Die Überschneidung bleibt verboten — sie gäbe der Frage „zu welchem Zyklus gehört dieser Lauf" zwei Antworten | 2026-11-17 |
| Vierter Zustand „nicht abgerechnet" für einen vergangenen Zyklus ohne Lauf | Beim Bauen fiel auf, dass dieser Fall als „künftig" beschriftet war. Es ist aber genau die Lage, die dieses Vorhaben ausgelöst hat: ein Zeitraum, für den niemand eingezogen hat | 2026-11-17 |
| Datumsschreibweise der Auslassgründe angeglichen, zweistellig mit Jahr | In derselben Zeile stand „am 6.3.2034", in der Tabelle daneben „06.03.2034". Zwei Schreibweisen für dasselbe Datum sind bei Geld keine Kleinigkeit | 2026-11-17 |
| Die Rechnung nennt den Leistungszeitraum | Heute steht in der Position nur der Aboname. Bei einem Mitgliedsbeitrag ist der Zeitraum die Angabe, auf die es ankommt | 2026-11-17 |

### Technical Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Zyklen als eigene Liste, kein Datum am Abo | Ein Datum je Abo müsste bei jedem Wechsel für jeden Kunden fortgeschrieben werden, und einzelne Schreibvorgänge können scheitern; eine Liste gilt für alle gleichzeitig, auch für künftige Abos | 2026-11-17 |
| Nur die Überschneidung in der Datenbank, Lückenlosigkeit im Formular | Die erste Fassung verlangte eine lückenlose Kette und machte das Feature unprüfbar (siehe Produktentscheidung). Was niemals wahr sein darf, bleibt in der Datenbank; was normalerweise gelten soll, wird vorbelegt und gewarnt | 2026-11-17 (korrigiert) |
| Der Lauf verweist auf den Zyklus, statt ihn aus dem Fälligkeitstag abzuleiten | Ein um einen Tag verschobener Bankeinzug soll den gemeinten Zyklus nicht wechseln | 2026-11-17 |
| Am Abo wird kein Zyklus und kein „bezahlt bis" gespeichert | Jede zweite Wahrheit über Geld ist das Problem, das dieses Vorhaben beseitigt; die Antwort steht in den Positionen der Läufe | 2026-11-17 |
| Entwürfe zählen weiterhin als Einzug | Zwei Entwürfe zum selben Zyklus wären zwei Abbuchungen, sobald beide bestätigt werden (unverändert aus PROJ-70) | 2026-11-17 |
| Alte Vier-Wochen-Rechnung bleibt als Rückfallebene, mit Hinweis | Die Vergangenheit hat keine Zyklen, und ein verschobener Umstieg darf nichts brechen; stillschweigend zurückfallen darf sie nicht | 2026-11-17 |
| Stufe 1 lässt das Kündigungsfenster unberührt | In der Übergangszeit ergeben alte Rechnung und Zyklusgrenze dasselbe Datum; so gilt pro Frage eine Regel, und vor dem 30.11. wird nicht an Zusagen an Kunden gebaut | 2026-11-17 |
| Der Zustand einer Zyklus-Zeile wird abgeleitet, nicht gespeichert | Eine gespeicherte Markierung könnte veralten | 2026-11-17 |
| Eigene Seite „Zyklen", Vorschau auf der Lastschriften-Seite; Lauf anlegen über Zyklus-Auswahl mit vorbelegtem, änderbarem Fälligkeitstag | Betreiberentscheidung 2026-11-17: Der Zyklus trägt auch Fristen und Preisankündigungen, gehört also nicht unter „Lastschriften"; der Fälligkeitstag ist ein Bankdatum und muss um einen Tag verschiebbar bleiben | 2026-11-17 |
| Keine neuen Fremdpakete | Liste, Formular und Auswahl entstehen aus vorhandenen Bausteinen; Vorbild ist die Ferien-Verwaltung | 2026-11-17 |

---
<!-- Sections below are added by subsequent skills -->

## Umsetzung — Stufe 2, erster Teil (2026-11-18)

Das Kündigungsfenster liest den eingetragenen Zyklus. Damit steht die
Zyklusrechnung nur noch einmal im Projekt — die zweite Fassung in SQL, vor der
die Migration zu PROJ-96 im Kommentar selbst warnte, ist ihre Aufgabe los.

| Teil | Wo |
|---|---|
| `abo_kuendigungsfenster` liest `billing_cycles` | `supabase/migrations/20261117230000_proj107_kuendigung_am_zyklus.sql` |
| AGB in beiden Sprachen, Stand auf 2026-11 | `terms-de.tsx`, `terms-en.tsx`, `src/lib/legal.ts` |
| Tests | `tests/PROJ-107-kuendigung-am-zyklus-db.test.ts` (4) |

**Keine Änderung an der Oberfläche.** Der Satz im Profil lautet schon
„Kündigung oder Pause bis {Datum} — wirkt dann zum {Datum}", und beide Angaben
stimmen im neuen Modell: Das erste ist das Zyklusende, das zweite der Tag
danach. Die Spalten `frist` und `frist_abgelaufen` bleiben deshalb in der
Signatur — `frist` trägt das Zyklusende, `frist_abgelaufen` ist mit Zyklus
immer falsch.

**Der Rückfall bleibt wörtlich erhalten** und ist geprüft: Ohne eingetragenen
Zyklus für den heutigen Tag gilt die Rechnung aus PROJ-96 unverändert. Deshalb
laufen deren sechs Browser- und elf Datenbankprüfungen weiter; beide Dateien
haben einen Nachtrag bekommen, der sie einordnet.

Offen aus Stufe 2: Studierendenpreis (PROJ-102), Upgrade-Differenz
(PROJ-91/97), Leistungszeitraum auf der Rechnung.

## Umsetzung — Stufe 1 (2026-11-17)

Vollständig: Fundament, Regel, Oberfläche, Tests.

| Teil | Wo |
|---|---|
| Tabelle, Trigger, `cycle_id` am Lauf | `supabase/migrations/20261117140000_proj107_zahlungszyklen.sql` |
| Korrektur: nur Überschneidung verboten | `supabase/migrations/20261117170000_proj107_nur_ueberschneidung_verboten.sql` |
| Die Regel „ein Einzug je Abo je Zyklus" | `src/lib/sepa/ausgelassen.ts` (`zyklus_eingezogen`) |
| Zyklus lesen, Einzüge je Abo | `src/lib/sepa/zyklus.ts` |
| Vorschlagsrechnung, offengelegt | `src/lib/sepa/zyklus-vorschlag.ts` |
| Aktionen | `src/lib/actions/admin/zyklen.ts` |
| Seite und Formular | `src/app/admin/zyklen/page.tsx`, `src/components/admin/zyklen/zyklen-manager.tsx` |
| Lauf hängt am Zyklus | `src/lib/actions/admin/sepa-collections.ts`, `src/app/admin/lastschriften/[id]/page.tsx` |
| Tests | `ausgelassen.test.ts` (+11), `zyklus-vorschlag.test.ts` (10), `tests/PROJ-107-zyklen-db.test.ts` (11), `tests/PROJ-107-zyklen.spec.ts` (10) |

**Noch nicht in der Produktion.** Beide Migrationen liegen auf dem Testprojekt; die Produktion
spielt der Betreiber ein.

**Für den Betrieb:** Der erste Zyklus (30.11.2026–10.01.2027) wird über `/admin/zyklen`
eingetragen, nicht einmigriert. Damit der Vorschlag stimmt, muss die zweiwöchige
Weihnachtspause unter „Ferien" stehen.

## Tech Design (Solution Architect)

_Erstellt 2026-11-17. Beschreibt **Stufe 1** im Detail — das, was der Umstieg am 30.11.2026
braucht — und skizziert Stufe 2 nur so weit, dass Stufe 1 ihr nicht im Weg steht._

### A) Was an Oberfläche entsteht

```
Verwaltung
├── Zyklen  (neue Seite, wie „Ferien")
│   ├── Liste: erster Tag · letzter Tag · Dauer · Zustand
│   │        Zustand ist eine von drei Auskünften:
│   │        „abgerechnet"  — in diesem Zyklus wurde schon eingezogen
│   │        „laufend"      — enthält den heutigen Tag
│   │        „künftig"      — noch nicht begonnen
│   ├── Formular „Zyklus anlegen"
│   │        erster Tag  = Tag nach dem letzten Zyklus (vorbelegt, bei leerer Liste frei)
│   │        letzter Tag = vier Kurswochen später (vorbelegt, änderbar) —
│   │                      gerechnet mit den eingetragenen Schließungen und
│   │                      offengelegt: „27.12.2026 + 14 Schließtage = 10.01.2027"
│   ├── Ändern und Löschen — nur bei „künftig"
│   └── Hinweis, wenn der letzte eingetragene Zyklus weniger als vier Wochen Vorlauf hat
│
├── Lastschriften  (bestehende Seite)
│   ├── Die nächsten Zyklen zum Mitlesen (neu) + Verweis auf die Zyklen-Seite
│   └── Formular „Lauf anlegen"  (geändert)
│            Zyklus        = Auswahl aus der Liste
│            Fälligkeitstag = erster Tag des Zyklus (vorbelegt, änderbar)
│
└── Lauf-Entwurf  (bestehende Seite)
    └── „Nicht aufgenommen" — ein Grund wird neu formuliert:
             statt „keine vier Wochen Abstand"
             künftig „In diesem Zyklus schon eingezogen am [Datum]"
```

Neu ist eine Seite und ein Abschnitt. Alles andere sind Änderungen an Formularen und
Sätzen, die es schon gibt — bewusst: Der Umstieg soll nichts verschieben, was du schon
kennst.

### B) Welche Angaben gespeichert werden

**Ein Zyklus** besteht aus vier Angaben: erster Tag, letzter Tag, wann angelegt, von wem.
Keine Nummer und kein Name — das Datum ist der Name. Vier Regeln hängen daran, und sie
gelten in der Datenbank, nicht im Formular:

1. Der letzte Tag liegt nicht vor dem ersten.
2. Der erste Tag ist der Tag nach dem letzten Tag des Vorgängers. Damit gibt es weder eine
   Lücke noch eine Überschneidung — und keinen Tag, der zu zwei Zyklen gehört.
3. Jedes Ende kommt nur einmal vor. So ist „der jüngste Zyklus" eine eindeutige Zeile und
   nicht eine Frage der Sortierung.
4. Ein Zyklus, in dem eingezogen wurde, ist unveränderlich.

**Ein Lastschriftlauf** merkt sich zusätzlich, zu welchem Zyklus er gehört. Heute trägt er
nur ein Fälligkeitsdatum; der Zyklus daneben macht aus „einmal je Zyklus" eine Nachfrage
statt einer Rechnung — und erlaubt es später, auf der Rechnung den Zeitraum zu nennen, ohne
ihn erneut zu ermitteln.

**Am Abo wird nichts gespeichert.** Kein „aktueller Zyklus", kein „bezahlt bis". Das wäre
ein Zustand, der mit der Zyklusliste synchron gehalten werden müsste — und jede zweite
Wahrheit über Geld ist genau das, was dieses Vorhaben beseitigen soll. Ob ein Abo in diesem
Zyklus schon eingezogen wurde, steht in den Positionen der Läufe, dort wo es herkommt.

**Entwürfe zählen mit**, wie bisher: Zwei offene Entwürfe zum selben Zyklus wären sonst zwei
Abbuchungen, sobald beide bestätigt werden.

**Für Zeiträume ohne eingetragenen Zyklus** gilt weiter die bisherige Vier-Wochen-Rechnung.
Das ist die Vergangenheit — und die Rückfallebene, falls der Umstieg verschoben werden muss.
Sie greift nicht stillschweigend: Wer einen Lauf für einen Tag ohne Zyklus anlegt, wird
darauf hingewiesen.

### C) Entscheidungen und warum

**Zyklen als eigene Liste, nicht als Datum am Abo.** Ein Datum an jedem Abo müsste bei jedem
Zykluswechsel für jeden Kunden fortgeschrieben werden — und jeder dieser Schreibvorgänge
kann scheitern, während die anderen gelingen. Eine Liste mit lückenlosen Zeiträumen gilt für
alle gleichzeitig, auch für Abos, die es heute noch nicht gibt.

**Lückenlosigkeit gehört in die Datenbank.** Bei den Barzahlern (PROJ-98) ist es genauso
gelöst und hat sich getragen. Eine Prüfung nur im Formular wäre wirkungslos, sobald Zyklen
einmal anders entstehen — aus einem Skript, einem Import, einer Reparatur von Hand.

**Der Lauf zeigt auf den Zyklus, statt dass man ihn aus dem Datum errät.** Verschiebst du
einen Fälligkeitstag um einen Tag über die Zyklusgrenze, soll der Lauf trotzdem zum
gemeinten Zyklus gehören. Ein Datumsvergleich würde das falsch beantworten, ein Verweis
nicht.

**Stufe 1 lässt das Kündigungsfenster absichtlich unberührt.** Die Rechnung „letzter Einzug
+ vier Wochen" ergibt in der Übergangszeit dasselbe Datum wie die Zyklusgrenze, solange die
Einzüge auf den Zyklusanfang fallen. Damit gilt pro Frage genau eine Regel — und in der
Woche vor dem 30.11. wird nicht an dem Teil gebaut, der Kunden etwas zusagt.

**Die Ferienrechnung bleibt im Code, verliert aber ihre Rolle in der Abrechnung.** Gelöscht
wird sie erst, wenn für alle Zeiträume Zyklen eingetragen sind. Ein Ausbau, der heute nichts
gewinnt, ist in der Woche vor einem Einzug kein guter Tausch.

**Der vorgeschlagene letzte Tag rechnet die Schließungen mit — und zeigt die Rechnung.**
Die vorhandene ferienbewusste Rechnung wird nicht abgeschafft, sondern degradiert: vom
Gesetz zum Vorschlag. Sie liefert den Vorbelegungswert, legt ihre Zwischenschritte offen
(„vier Wochen wären der 27.12., dazu 14 eingetragene Schließtage"), und der Betreiber
bestätigt oder überschreibt. Das ist der Unterschied zwischen einer Rechnung, der man
ausgeliefert ist, und einer, die man prüfen kann.

**Daraus folgt eine Voraussetzung, die nichts mit Code zu tun hat:** Schließungen müssen
unter „Ferien" eingetragen sein — sonst schlägt das Formular einen zu frühen letzten Tag
vor. In der Übergangszeit gilt das doppelt, weil bis Stufe 2 auch die Kündigungsdaten noch
aus dieser Rechnung kommen. Fehlt die Weihnachtspause dort, nennt das Profil einem
kündigenden Kunden den 28.12.2026 statt des 11.01.2027 — zwei Wochen zu früh.

**Der Zustand einer Zyklus-Zeile wird abgeleitet, nicht gespeichert.** „abgerechnet",
„laufend", „künftig" ergeben sich aus dem heutigen Tag und den Positionen der Läufe. Eine
gespeicherte Markierung könnte veralten.

### D) Fremdpakete

Keine. Liste, Formular und Auswahl entstehen aus den vorhandenen Bausteinen; die
Zyklen-Seite folgt dem Aufbau der Ferien-Verwaltung.

### Was Stufe 2 danach erbt

Kündigungsfenster, Studierendenpreis, Upgrade-Differenz und der Leistungszeitraum auf der
Rechnung lesen dann dieselbe Liste. Jede dieser Stellen rechnet heute selbst — die Umstellung
ist also jeweils ein Ersetzen, kein Hinzufügen. Erst danach verschwinden die doppelten
Fassungen, vor denen die Migration zu PROJ-96 im Kommentar warnt.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
