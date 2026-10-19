# PROJ-91: Die Upgrade-Differenz nur für einen Zyklus, der schon abgebucht ist

## Status: In Progress
**Created:** 2026-10-19
**Last Updated:** 2026-10-19

## Dependencies
- Korrigiert: PROJ-87 (Upgrade auf die Flatrate) — die Differenz
- Korrigiert: PROJ-88 (Upgrade mit mehreren Kursabos) — die Anrechnung
- Berührt: PROJ-70 (Kein zweiter Einzug im selben Zyklus) — die Fälligkeit, die hier zählt

## Anlass

Aus dem Betrieb gemeldet (2026-10-19): Ein Lastschriftlauf buchte **290 € statt 145 €** — die
Flatrate zweimal.

Die Rechnung dahinter:

| | |
|---|---|
| Position im Lauf | 145 € — der laufende Zyklus, für dieses Abo noch nie eingezogen, also fällig (PROJ-70) |
| Aufschlag obendrauf | 145 € — die „Differenz" aus der Bestätigung |
| Summe | **290 €** |

Beides bezahlte denselben Zyklus. Die Differenz aus PROJ-87 war für einen anderen Fall gedacht: Der
laufende Zyklus ist **schon zum alten Preis abgebucht** — 65 kassiert, 145 gilt, also 80 nach. Ist er
noch nicht abgebucht, bucht der nächste Lauf die Flatrate ohnehin voll ab.

Die Karte riet dabei ausdrücklich falsch: „Im laufenden Zyklus ist nichts eingegangen — die ganze
Differenz kommt dazu." Und das Feld war mit dem ganzen Preis vorbelegt. Der Betreiber hat die Zahl
übernommen, die ihm die Anwendung als die richtige vorgelegt hat.

## User Stories

- Als Betreiber möchte ich, dass nach einem Upgrade nicht derselbe Zyklus zweimal abgebucht wird.
- Als Betreiber möchte ich an der Anfrage lesen, **warum** eine Differenz entsteht oder nicht.
- Als Betreiber möchte ich erfahren, wenn im Zyklus Geld für ein Abo einging, das mit dem Upgrade
  endet — damit ich über ein Guthaben entscheiden kann.
- Als Schüler möchte ich in der Anfrage keinen Zusatzbetrag angekündigt sehen, der nicht kommt.

## Out of Scope

- **Ein automatisches Guthaben.** Wenn im Zyklus für ein endendes Abo abgebucht wurde, sagt die App
  es — gebucht wird es von Hand. Bei Geld entscheidet der Betreiber (siehe PROJ-88).
- **Die Rechnung aus dem Lauf selbst beziehen.** Der Lauf entsteht später und kennt die Entscheidung
  nicht; die Differenz muss im Augenblick der Bestätigung stimmen.
- **Rückwirkende Korrektur.** Ein bereits angelegter Aufschlag bleibt, wie er ist — den korrigiert
  der Betreiber im Entwurf des Laufs (PROJ-47) oder löscht ihn.
- **Ferienverlängerte Zyklen exakt treffen.** Das 28-Tage-Fenster bleibt eine Näherung, wie bei der
  Anrechnung. Deshalb bleibt die Zahl überschreibbar.

## Acceptance Criteria

- [ ] Angenommen für ein Abo wurde im laufenden Zyklus noch nicht eingezogen und der Kunde hat ein
      Mandat, wenn der Betreiber das Upgrade bestätigt, dann entsteht **kein** Aufschlag.
- [ ] Angenommen derselbe Fall, wenn der nächste Lauf entsteht, dann steht dort **einmal** der
      Flatrate-Preis.
- [ ] Angenommen für das Abo wurde im Zyklus zum alten Preis abgebucht, wenn der Betreiber
      bestätigt, dann entsteht ein Aufschlag über `Flatrate − Abgebuchtes` — unverändert.
- [ ] Angenommen der Kunde hat **kein** Mandat, wenn der Betreiber bestätigt, dann entsteht der
      Aufschlag über die ganze Differenz — er ist der Weg in die Barzahler-Übersicht.
- [ ] Angenommen der Zyklus wird noch voll abgebucht, wenn der Betreiber die Anfrage ansieht, dann
      steht dort „Der laufende Zyklus wurde für dieses Abo noch nicht eingezogen — der nächste Lauf
      bucht die Flatrate voll ab. Es kommt nichts dazu."
- [ ] Angenommen im Zyklus ging Geld für ein Abo ein, das mit der Bestätigung endet, wenn der
      Betreiber die Anfrage ansieht, dann wird der Betrag genannt und auf ein Guthaben hingewiesen.
- [ ] Angenommen der Zyklus wird noch voll abgebucht, wenn der Kunde den Upgrade-Kasten liest, dann
      wird ihm **kein** Zusatzbetrag angekündigt.
- [ ] Angenommen der Betreiber trägt trotz allem eine Zahl ein, wenn er bestätigt, dann gilt seine
      Zahl — auch die Null.

## Edge Cases

- **Rückbuchung:** Zurückgebuchtes Geld ist nicht angekommen, aber der Lauf bucht deshalb nicht noch
  einmal ab. Für die Fälligkeit zählt die Position also **mit**; der offene Betrag steht in den
  offenen Posten (PROJ-37). Die Anrechnung lässt sie weiterhin außen vor — zwei Fragen, zwei
  Antworten.
- **Freigegebener Lauf mit künftiger Fälligkeit:** deckt den Zyklus schon ab, obwohl noch nichts
  eingegangen ist. Zählt deshalb mit, anders als bei der Anrechnung.
- **Noch nicht freigegebener Entwurf:** zählt nicht — ausgezahltes Geld ist er nicht. Steht ein
  Entwurf zum alten Preis offen, sieht der Betreiber ihn im Lauf und entscheidet dort.
- **Mehrere Abos, eines abgebucht, das andere nicht:** Wird das **nicht** abgebuchte upgradet, bucht
  der Lauf die Flatrate voll ab — und das Geld des anderen Abos liegt daneben. Genau dafür der
  Hinweis auf ein Guthaben.
- **Barzahler mit Flatrate-Upgrade:** kein Mandat, keine Position, ganze Differenz als Aufschlag —
  unverändert.

## Decision Log

### Product Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Die Differenz ist null, wenn der Lauf den Zyklus noch voll abbucht | Alles andere ist derselbe Zyklus zum zweiten Mal. Genau das ist in Produktion passiert. | 2026-10-19 |
| Der Satz auf der Karte sagt jetzt, was der Lauf tut | Der alte Satz („die ganze Differenz kommt dazu") hat den Betreiber in den Fehler geführt. Ein Vorschlag, der nicht erklärt, wird geglaubt. | 2026-10-19 |
| Überzähliges Geld wird genannt, nicht verbucht | Ein Guthaben ist eine Entscheidung über Geld — die trifft der Betreiber (wie in PROJ-88). | 2026-10-19 |
| Die Zahl bleibt überschreibbar | Das 28-Tage-Fenster und die Entwurfsfrage bleiben Näherungen. Wer rechnet, muss korrigieren können. | 2026-10-19 |

### Technical Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Eine eigene Frage in der Datenbank: `flatrate_upgrade_zyklus_wird_abgebucht` | „Ist Geld angekommen?" und „bucht der Lauf noch ab?" sind verschiedene Fragen mit verschiedenen Antworten (Rückbuchung, künftige Fälligkeit). Sie in die Anrechnung zu quetschen hätte eine von beiden verdorben. | 2026-10-19 |
| Mandat als zweite Bedingung | Ohne Mandat gibt es keine Position, also nichts, was doppelt wäre. Der Aufschlag ist dort der einzige Weg, auf dem die Differenz sichtbar wird. | 2026-10-19 |
| Die Regel als reine Funktion in `lib/flatrate/upgrade-differenz.ts` | Sie stand in drei Fassungen: Kundenkarte, Verwaltungskarte, Datenbank. Zwei davon in TypeScript — die gehören in eine prüfbare Datei, auf die die Migration zeigt. | 2026-10-19 |
| `released_at is not null`, kein oberes Datumsende | Freigegeben heißt: geht zur Bank. Ob die Fälligkeit morgen liegt, ändert nichts daran, dass der Zyklus gedeckt ist. | 2026-10-19 |

## Open Questions

- [ ] Soll ein offener **Entwurf**, der dieses Abo zum alten Preis enthält, an der Anfrage genannt
      werden? Heute sieht der Betreiber ihn nur im Lauf. Erst beobachten, ob der Fall vorkommt.
