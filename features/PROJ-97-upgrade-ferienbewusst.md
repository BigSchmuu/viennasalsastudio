# PROJ-97: Die Upgrade-Differenz rechnet mit Unterrichtswochen

## Status: Deployed
**Created:** 2026-11-05
**Last Updated:** 2026-11-05

## Dependencies
- Requires: PROJ-96 (Kündigungsfrist) — `naechste_faelligkeit` und `ferientage_zwischen` in SQL, die Grundlage dieser Änderung
- Requires: PROJ-87 (Upgrade auf die Flatrate) — die Differenz selbst
- Requires: PROJ-88 (Mehrere Kursabos, Differenz überschreiben) — die Anrechnung
- Requires: PROJ-91 (Differenz nur für bezahlte Zyklen) — die Funktion, um die es geht
- Requires: PROJ-70 (Einzug nur nach Unterrichtswochen) — die ferienbewusste Rechnung
- Berührt: PROJ-81 (Barzahlungen) — der Doppelschutz dort bleibt absichtlich unberührt

## Anlass

Aus der offenen Frage in PROJ-96: Im Upgrade steckt dasselbe starre 28-Tage-Fenster, das die
Kündigung gerade verloren hat. Die Frage war, ob es mitwandert. Die Recherche hat drei Dinge
gefunden — das dritte macht aus einer Zeile eine Entscheidung.

### Befund 1: Das Fenster verschenkt die Differenz

`flatrate_upgrade_zyklus_wird_abgebucht` fragt, ob der nächste Lastschriftlauf den laufenden
Zyklus noch voll abbucht. Geprüft wird das mit `r.due_date >= heute_wien() - 28`.

Eine Ferienwoche verlängert den Zyklus auf 35 Tage (PROJ-70). Ein Einzug von vor 30 Tagen
deckt dann den laufenden Zyklus — das Fenster sieht ihn aber nicht mehr:

| | Einzug vor 30 Tagen, eine Ferienwoche dazwischen |
| --- | --- |
| Wirklich | Der Zyklus ist bezahlt (65). Nächste Fälligkeit in 5 Tagen. Die Flatrate gilt ab heute, die Differenz von 80 gehört kassiert. |
| Heute gerechnet | „Noch nicht eingezogen“ → der nächste Lauf bucht voll ab → Differenz **0** |
| Folge | Der Kunde tanzt den Rest des Zyklus zum Kurspreis Flatrate. Dem Studio fehlen 80. |

### Befund 2: Ein Tag, an dem derselbe Zyklus zweimal kassiert wird

Am Rand des Fensters kippt es in die andere Richtung. Liegt der Einzug **genau** 28 Tage
zurück, sagt `>= heute_wien() - 28` noch „schon eingezogen“ — also wird eine Differenz
aufgeschlagen. Zugleich ist das Abo nach `istFaellig` an genau diesem Tag wieder fällig, der
Lauf bucht die Flatrate also voll ab. 145 plus 80.

Das ist derselbe Fehler, gegen den PROJ-91 angetreten ist (290 statt 145 am 2026-10-19), nur
auf einen einzigen Tag im Zyklus geschrumpft. Ohne Ferien trifft er den Tag der Fälligkeit
— und das ist der Tag, an dem Betreiber Läufe anlegen.

### Befund 3: Die Anrechnung muss mitwandern

`flatrate_upgrade_anrechnung` hat dasselbe Fenster, zweimal: für Lastschriften
(`r.due_date >= heute_wien() - 28`) und für Barzahlungen (`z.paid_on >= heute_wien() - 28`).
Sie liefert den **Betrag**, der angerechnet wird.

Das ist der Grund, warum Befund 1 nicht allein behoben werden darf:

| | Nur Befund 1 behoben | Beide behoben |
| --- | --- | --- |
| „Schon eingezogen?“ | ja (richtig) | ja (richtig) |
| Angerechnet | **0** — der Einzug von vor 30 Tagen fällt aus dem alten Fenster | **65** |
| Differenz | **145** | **80** |
| Folge | Der Kunde zahlt 65 zu viel | richtig |

Eine halbe Korrektur verwandelt also den Verlust des Studios in eine Überzahlung des Kunden.
Deshalb wandern beide zusammen oder keins von beiden.

## Die Regel in einem Absatz

Ein Einzug oder eine Barzahlung gehört zum laufenden Zyklus, solange ihre **nächste
Fälligkeit noch in der Zukunft liegt** — `naechste_faelligkeit(Tag) > heute`. Das ist genau
die Rechnung, nach der der Lauf selbst entscheidet (PROJ-70), und seit PROJ-96 steht sie in
SQL. An die Stelle von „in den letzten 28 Tagen“ tritt „deckt heute noch ab“. Ohne Ferien ist
das dasselbe, nur ohne den Randtag aus Befund 2.

## User Stories

- Als **Betreiber** will ich beim Bestätigen eines Upgrades die Differenz sehen, die auch nach
  einer Studioschließung stimmt — damit ich die Zahl nicht gegen den Kalender nachrechnen muss.
- Als **Betreiber** will ich nach einer Ferienwoche nicht auf die Differenz verzichten müssen,
  nur weil der Zyklus länger war.
- Als **Kunde** will ich beim Upgrade angerechnet bekommen, was ich für den laufenden Zyklus
  schon bezahlt habe — auch wenn er wegen Ferien länger ist.
- Als **Kunde** will ich denselben Zyklus nicht zweimal bezahlen, auch nicht am Tag der
  Fälligkeit.

## Out of Scope

- **Der Doppelschutz bei Barzahlungen (PROJ-81).** `cash_payment_nicht_doppelt` prüft
  ebenfalls 28 Tage, und das ist dort **mit Begründung so gebaut**: Es ist ein Netz gegen den
  zweiten Druck auf den Knopf, keine fachliche Regel. Ferienbewusst gemacht, würde es eine
  Zahlung blockieren, die der Kunde ein paar Tage zu früh bringt. Bleibt.
- **Anteiliges Rechnen.** Wer mitten im Zyklus upgradet, zahlt die Differenz ganz — so
  entschieden in PROJ-87, unverändert.
- **Schon angelegte Aufschläge.** Was gebucht ist, bleibt gebucht. Keine Nachrechnung von
  Bestandsfällen; bei Geld entscheidet der Betreiber, und er kann jede Zahl überschreiben
  (PROJ-88).
- **Die obere Grenze der Anrechnung.** Ein freigegebener Lauf mit Fälligkeit in der Zukunft
  zählt bei der Anrechnung nicht (`due_date <= heute`), bei der Ja/Nein-Frage schon. Beides
  ist in PROJ-88/91 bewusst entschieden und bleibt.
- **Der SEPA-Lauf selbst.** Er rechnet schon ferienbewusst. Er wird nicht angefasst.

## Acceptance Criteria

### Die Ja/Nein-Frage

- [x] Angenommen ein Abo wurde vor 30 Tagen eingezogen und dazwischen liegt eine Ferienwoche,
      wenn gefragt wird, ob der Zyklus noch abgebucht wird, dann lautet die Antwort **nein**
      — der Zyklus ist gedeckt.
- [x] Angenommen dasselbe Abo ohne Ferien dazwischen, wenn gefragt wird, dann lautet die
      Antwort **ja** — der Zyklus ist abgelaufen und der nächste Lauf bucht voll ab.
- [x] Angenommen der Einzug liegt genau einen Zyklus zurück, ist also heute wieder fällig,
      wenn gefragt wird, dann lautet die Antwort **ja** — kein Aufschlag neben einer vollen
      Abbuchung.

### Die Anrechnung

- [x] Angenommen ein Einzug liegt 30 Tage zurück und dazwischen liegt eine Ferienwoche, wenn
      die Anrechnung gerechnet wird, dann ist der Betrag angerechnet.
- [x] Angenommen derselbe Einzug ohne Ferien dazwischen, wenn die Anrechnung gerechnet wird,
      dann ist nichts angerechnet — der Zyklus ist vorbei.
- [x] Angenommen eine Barzahlung liegt 30 Tage zurück und dazwischen liegt eine Ferienwoche,
      wenn die Anrechnung gerechnet wird, dann ist sie angerechnet wie ein Einzug.

### Beides zusammen

- [x] Angenommen ein Abo über 65 wurde vor 30 Tagen eingezogen, dazwischen liegt eine
      Ferienwoche und die Flatrate kostet 145, wenn der Betreiber das Upgrade bestätigt, dann
      entsteht ein Aufschlag von **80** — nicht 0 und nicht 145.
- [x] Angenommen der Betreiber gibt einen Betrag von Hand ein, wenn er bestätigt, dann gilt
      seiner unverändert.

### Rechte

- [x] Angenommen ein Kunde fragt die Lage eines fremden Abos ab, wenn er die Funktion ruft,
      dann wird er abgewiesen — unverändert zu PROJ-91.
- [x] Angenommen die Funktionen wurden neu angelegt, wenn die Rechte geprüft werden, dann hat
      `anon` kein EXECUTE.

## Edge Cases

1. **Kein Einzug, keine Zahlung.** Unverändert: „wird abgebucht“ = ja, angerechnet 0,
   Differenz 0. Der nächste Lauf nimmt das Abo regulär mit.
2. **Einzug in der Zukunft** (freigegebener Lauf, Fälligkeit in drei Tagen). Deckt den Zyklus
   ab — `naechste_faelligkeit` liegt dann weit in der Zukunft. Wie bisher.
3. **Ferien nach dem Einzug eingetragen.** Die Zahl ändert sich beim nächsten Aufruf mit.
   Anders als beim Kündigungsdatum ist das richtig: Hier ist nichts zugesagt, die Differenz
   wird erst beim Bestätigen festgeschrieben.
4. **Zwei Kursabos mit verschiedenen Einzugstagen.** Jede Position wird einzeln gefragt — die
   Anrechnung ist eine Liste, kein Zeitfenster.
5. **Rückbuchung.** Zählt bei der Ja/Nein-Frage mit, bei der Anrechnung nicht. Unverändert
   (PROJ-91), die Änderung betrifft nur die Zeitgrenze.
6. **Lange Schließung** (mehr als 13 Runden Nachrechnen). `naechste_faelligkeit` bricht nach
   13 Runden ab — dieselbe Grenze wie in TypeScript, dieselbe Ungenauigkeit nach einem Jahr
   Ferien.

## QA (2026-11-05)

Die Migration liegt in der Testdatenbank. Danach gelaufen:

| Lauf | Ergebnis |
| --- | --- |
| `tests/PROJ-97-upgrade-ferienbewusst-db.test.ts` | **9/9** |
| PROJ-87/88/91, PROJ-84, PROJ-96 und alle Einheitstests | **1162/1162** |
| PROJ-87, PROJ-50, PROJ-84, Dashboard im Browser | **96/96** |
| `tsc --noEmit`, `eslint` | sauber |

### Der Beweis liegt im Lauf davor

Vor der Migration waren **5 der 9** Fälle rot, nach ihr alle grün — ohne dass eine Erwartung
angepasst wurde. Die fünf roten waren genau die drei Befunde:

| Fall | rot, weil |
| --- | --- |
| Zyklus abgelaufen, sobald die Fälligkeit erreicht ist | Befund 2: Das alte Fenster sagte am Fälligkeitstag noch „schon eingezogen“ |
| Die Ferienwoche dreht die Antwort | Befund 1 |
| Einzug im verlängerten Zyklus wird angerechnet | Befund 3 |
| Barzahlung im verlängerten Zyklus wird angerechnet | Befund 3 |
| Der Aufschlag ist die Differenz, nicht der ganze Preis | Befund 1 und 3 zusammen — es gab gar keinen Aufschlag |

Die vier grünen prüften, was schon stimmte: der noch gedeckte Zyklus, dass die Grenze genau
einen Tag breit ist, dass die Aufstellung alle fünf Spalten liefert, und dass `anon` kein
Ausführungsrecht hat.

### Der Geldfall musste nachgeschärft werden

Der erste Entwurf dieses Falls setzte den Einzug auf den Grenztag — und bestand auch mit dem
alten Code, weil dieser Tag noch im 28-Tage-Fenster lag: richtig aus dem falschen Grund. Er
steht jetzt auf einem Tag, der auch dem alten Fenster entgangen wäre. Erst damit wurde er rot.

### Ein Test musste mitwandern

`tests/PROJ-87-upgrade-flatrate-db.test.ts` hatte einen Fall namens
„lässt einen Einzug außerhalb des Fensters liegen“, der die alte Ungenauigkeit als gewollt
beschrieb. Er prüft dasselbe weiter — 40 Tage sind auch nach Unterrichtswochen draußen —,
sagt aber jetzt die neue Begründung und prüft seine eigene Voraussetzung: Liegt in diesem
Zeitraum eine lange Schließung, wäre er ohne Aussage, und die Meldung sagt das.

### Wo welches Kriterium hängt

- Die Abweisung für ein **fremdes** Abo prüft nicht der neue Test, sondern der bestehende Fall
  „lässt den Kunden die eigene Lage lesen, aber keine fremde“ aus dem PROJ-91-Block. Er lief in
  den 1162 mit.
- Die Oberfläche zeigt die Zahlen aus diesen Funktionen unverändert an; die Anzeige selbst
  wurde nicht geändert. Belegt durch die 96 Browserfälle, die den Bestand prüfen — nicht
  durch einen eigenen Browserfall für die Ferienlage. Die Rechnung liegt in der Datenbank, und
  dort ist sie geprüft.

### Urteil

Produktionsreif. Keine Fehler der Schwere Kritisch oder Hoch. Anders als bei PROJ-96 bricht
hier nichts, wenn der Code vor der Migration draußen ist — die Funktionen existieren und
rechnen nur anders. Ausgeliefert werden sollte beides trotzdem zusammen, damit Anzeige und
Bestätigung dieselbe Zahl nennen.

## Deployment (2026-11-05)

Ausgeliefert nach https://app.viennasalsastudio.at

| | |
| --- | --- |
| Commit | `99aeb62` feat(PROJ-97) |
| Tag | `v1.97.0-PROJ-97` |
| Migration | `20261105100000_proj97_upgrade_ferienbewusst.sql` — vom Betreiber vor dem Push in der Produktion eingespielt |
| Build | „Compiled successfully in 11.1s“, ohne Warnung |

## Für den Betrieb

- **Zu merken ist die Änderung erst nach der nächsten Schließung.** Ohne Ferien in den letzten
  vier Wochen rechnet die neue Fassung genau wie die alte — bis auf den Randtag aus Befund 2.
- **Der Betrag bleibt dein letztes Wort.** Die Zahl beim Bestätigen ist ein Vorschlag; ein von
  Hand eingegebener Betrag gilt unverändert, die Null eingeschlossen (PROJ-88).
- **Ferien gehören in den Kalender, bevor der Zyklus läuft.** Anders als beim
  Kündigungsdatum (PROJ-96) rechnet das Upgrade bei jedem Aufruf neu — nachgetragene Ferien
  ändern den Vorschlag also noch. Festgeschrieben wird er erst beim Bestätigen.
- **Der Doppelschutz bei Barzahlungen bleibt bei 28 Tagen.** Eine zweite Barzahlung im selben,
  durch Ferien verlängerten Zyklus wird also nicht abgewiesen. Bewusst so: Das Netz soll den
  Doppelklick fangen, nicht eine Zahlung, die ein Kunde ein paar Tage zu früh bringt.

## Tech Design

### Was sich ändert

Drei Zeilen in zwei Funktionen:

| Funktion | Alt | Neu |
| --- | --- | --- |
| `flatrate_upgrade_zyklus_wird_abgebucht` | `r.due_date >= heute_wien() - 28` | `naechste_faelligkeit(r.due_date) > heute_wien()` |
| `flatrate_upgrade_anrechnung`, Lastschrift | `r.due_date >= heute_wien() - 28` | `naechste_faelligkeit(r.due_date) > heute_wien()` |
| `flatrate_upgrade_anrechnung`, Barzahlung | `z.paid_on >= heute_wien() - 28` | `naechste_faelligkeit(z.paid_on) > heute_wien()` |

`flatrate_upgrade_angerechnet` summiert nur die Liste und wird nicht angefasst — damit auch
nicht neu berechtigt.

### Was nicht neu gebaut wird

Keine neue Rechnung. `naechste_faelligkeit` kommt aus PROJ-96 und liegt in der Produktion;
ihre Parität zur TypeScript-Fassung prüft `tests/PROJ-96-kuendigungsfrist-db.test.ts`. Diese
Änderung macht nur eine vierte Stelle zu ihrem Aufrufer.

### Das Risiko beim Bauen

`flatrate_upgrade_anrechnung` ist eine `returns table`-Funktion mit **fünf** Spalten und
einem `union all`: zwei Zweige, die beide dieselben fünf in derselben Reihenfolge liefern
müssen. Genau hier ist PROJ-95 umgefallen, als eine Spalte verloren ging und die Liste
lautlos unbenutzbar wurde. Jede Auswahlzeile trägt deshalb einen Kommentar mit ihrem
Spaltennamen, und die Spalten werden vor dem Übergeben gezählt.

Dazu: `create or replace function` setzt die Rechte zurück. Beide geänderten Funktionen
brauchen `revoke ... from public, anon` und `grant execute ... to authenticated`.

### Tests

- `tests/PROJ-97-upgrade-ferienbewusst-db.test.ts`: die Ferienlage für beide Funktionen, der
  Randtag aus Befund 2, die Barzahlung, und der Geldfall — Aufschlag 80 statt 0 oder 145.
- `tests/PROJ-87-upgrade-flatrate-db.test.ts`: der Fall
  „lässt einen Einzug außerhalb des Fensters liegen“ beschreibt die alte Ungenauigkeit. Er
  bleibt grün (40 Tage ohne Ferien sind weiter draußen), aber Name und Kommentar müssen die
  neue Begründung nennen.

## Decision Log

### Produkt

| Entscheidung | Begründung | Datum |
| --- | --- | --- |
| Anrechnung und Ja/Nein-Frage wandern zusammen | Eine halbe Korrektur macht aus dem Verlust des Studios eine Überzahlung des Kunden (Befund 3). Nicht trennbar. | 2026-11-05 |
| Der Doppelschutz bei Barzahlungen bleibt starr | Er ist ein Netz gegen den Doppelklick, keine fachliche Regel — so in PROJ-81 begründet. Ferienbewusst würde er eine frühere Zahlung blockieren. | 2026-11-05 |
| Keine Nachrechnung von Bestandsfällen | Gebuchtes Geld bleibt gebucht. | 2026-11-05 |

### Technik

| Entscheidung | Begründung | Datum |
| --- | --- | --- |
| `naechste_faelligkeit(Tag) > heute` statt eines eigenen Zyklusbeginns | Dieselbe Richtung, in die der Lauf selbst rechnet, und eine Funktion statt einer zweiten Rechnung. | 2026-11-05 |
| Die obere Grenze je Funktion unverändert gelassen | Die Unterschiede zwischen Anrechnung und Ja/Nein-Frage sind in PROJ-88/91 begründet. Hier wird eine Zeitgrenze ersetzt, keine Fachregel. | 2026-11-05 |

## Open Questions

- [ ] **Sollen Ferien auch den Anrechnungszeitraum der offenen Posten (PROJ-37) betreffen?**
      Nicht geprüft, nur notiert — derselbe Befund könnte dort stecken.
