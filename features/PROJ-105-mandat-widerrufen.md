# PROJ-105: Ein widerrufenes Mandat bleibt sichtbar — und zieht nicht mehr ein

## Status: Planned
**Created:** 2026-11-17
**Last Updated:** 2026-11-17

## Dependencies
- Requires: PROJ-7 (SEPA-Lastschrift und Mandate) — `sepa_mandates`, `revoked_at`, `generateRunXml`
- Requires: PROJ-103 (Der Lauf nennt die ausgelassenen Abos) — die Liste, neben die diese tritt, und die gemeinsame Regel `auslassGrund`
- Requires: PROJ-70 (Einzug nur nach Unterrichtswochen) — `istFaellig`, die Frage „wäre überhaupt etwas offen"
- Requires: PROJ-84 / PROJ-98 (Barzahlungen) — `add_cash_entry`, die Liste, auf die ein Betrag ohne Mandat gehört
- Berührt: PROJ-96 (Kündigungsfrist) — das Enddatum, das begrenzt, wie lange ein offener Zyklus noch holbar ist
- Berührt: PROJ-87 (Aufschlag auch ohne Beitrag) — dort wurde dasselbe Muster für Aufschläge schon einmal gelöst

## Anlass

Am 2026-11-17, vor einem Einzug, fiel dem Betreiber auf, dass ein Abo „plötzlich nicht mehr
im Lastschriftlauf" stand. Die Kette dahinter, rekonstruiert aus vier Daten:

| Schritt | |
|---|---|
| 1 | Lauf zum **18.11.** angelegt, das Abo war darin |
| 2 | Kunde kündigt → Enddatum aus genau diesem Lauf gerechnet: 18.11. + 28 = **16.12.** |
| 3 | Kunde entfernt im Profil die Bankdaten → Mandat auf widerrufen |
| 4 | Entwurf verworfen und neu angelegt → **das Abo ist in keiner Liste mehr** |

Bezahlt war bis 14.11. (Einzug am 18.10.), das Abo läuft bis 16.12. Offen ist genau ein
Zyklus — und er stand nirgends. Keine Zeile, kein Grund, keine Zahl. Ohne den Zufall, dass
der Betreiber nachgefragt hat, wäre der Beitrag verloren gewesen: Ab einem Fälligkeitstag
am oder nach dem 16.12. greift die Kündigungssperre, und das Abo fällt zu Recht und
dauerhaft aus jedem Lauf.

### Befunde aus dem Code, die den Umfang bestimmen

**1. Das Mandat wird vor dem Grund geprüft.** In
[sepa-collections.ts:103](../src/lib/actions/admin/sepa-collections.ts#L103) filtert
`createCollectionRun` zuerst auf ein gültiges Mandat und erst danach mit `auslassGrund`.
Der Kommentar daneben begründet das so: Ein Barzahler „gehört nicht in einen
Lastschriftlauf und auch nicht unter die ausgelassenen Abos: Dort stünde er bei jedem Lauf
und gäbe nichts zu beurteilen." Für einen echten Barzahler ist das richtig. Für ein
**widerrufenes** Mandat ist es falsch — da gibt es sehr wohl etwas zu beurteilen, und zwar
einmalig. [laufLuecken](<../src/app/admin/lastschriften/[id]/page.tsx#L112>) auf der
Entwurfsseite zieht dieselbe Grenze.

**2. Der Widerruf prüft nichts.** `revokeMandate`
([mandate.ts:114](../src/lib/actions/mandate.ts#L114)) setzt `revoked_at` und fertig —
ohne Blick darauf, ob ein aktives Abo noch einen Zyklus schuldet. Das ist als Vorgang
richtig (ein Mandat darf jederzeit widerrufen werden), nur folgenlos protokolliert.

**3. Und der schwerere Fund: Der Einzug prüft es auch nicht.** Eine Position trägt IBAN und
Mandatsreferenz **vom Anlegen des Laufs**. `generateRunXml`
([sepa-collections.ts:355](../src/lib/actions/admin/sepa-collections.ts#L355)) liest die
Mandate danach nur noch, um `consented_at` für das Unterschriftsdatum zu holen —
`revoked_at` kommt in der Abfrage nicht vor. Auch `release_collection_run` prüft es nicht.
**Wird ein Mandat zwischen Anlegen und Herunterladen widerrufen, enthält die Bankdatei
trotzdem eine Lastschrift dagegen.** Im Fall oben hat genau das nur deshalb nicht
stattgefunden, weil der Betreiber den Entwurf verworfen hat. Ein Einzug nach Widerruf ist
eine nicht autorisierte Lastschrift: Der Kunde kann sie 13 Monate lang zurückholen, und
recht hat er dabei.

## Die Regel in zwei Absätzen

**Sichtbar bleiben (Verlust verhindern).** Ein Abo kommt in eine neue, dritte Liste im
Entwurf — „Mandat widerrufen, Beitrag offen" —, wenn alle vier zutreffen:

1. Status `active`.
2. Kein gültiges Mandat (keine Zeile mit `revoked_at IS NULL`).
3. **Aber mindestens eine widerrufene Zeile** in `sepa_mandates`. Das ist die Trennlinie
   zum echten Barzahler: Der hat nie ein Mandat erteilt und soll die Liste nicht füllen.
4. `auslassGrund` liefert `null` oder `kein_preis` — das Abo wäre mit Mandat in diesen Lauf
   gekommen, der Beitrag ist also offen.

**Nicht einziehen (unerlaubten Einzug verhindern).** Ist zu einer Position im Lauf das
Mandat widerrufen, wird die Datei **nicht** erzeugt. Die Meldung nennt die betroffenen
Zeilen, die Positionen sind im Entwurf als solche gekennzeichnet, und der Betreiber
entfernt sie. Stillschweigend aus der Datei zu lassen wäre falsch: Die Freigabe erzeugt
Rechnungen aus den Positionen, und es entstünde eine Rechnung über Geld, das nie geflossen
ist.

## User Stories

1. **Als Betreiber** will ich beim Anlegen eines Laufs sehen, welche Abos ihren Beitrag
   schulden, aber kein Mandat mehr haben, damit ein Widerruf mich nicht einen Zyklus kostet.
2. **Als Betreiber** will ich in dieser Zeile den letzten Einzug und — bei angekündigter
   Kündigung — das Enddatum sehen, damit ich erkenne, wie viel offen ist und wie lange ich
   dafür noch Zeit habe.
3. **Als Betreiber** will ich den Betrag aus dieser Zeile heraus auf die Barzahlungsliste
   setzen können, weil ich ihn per Lastschrift nicht mehr holen darf.
4. **Als Betreiber** will ich, dass echte Barzahler in dieser Liste nicht auftauchen, damit
   sie mir nicht bei jedem Lauf Arbeit vortäuscht.
5. **Als Betreiber** will ich keine Datei erzeugen können, in der eine Lastschrift gegen ein
   widerrufenes Mandat steht — auch dann nicht, wenn ich es übersehe.
6. **Als Kunde**, der seine Bankdaten entfernt hat, will ich nicht gegen meinen Widerruf
   abgebucht werden.

## Out of Scope

- **Kein Einzug ohne Mandat, auch nicht einmalig.** `fuegeLaufPositionHinzu` lehnt das heute
  ab und soll es weiter ablehnen. Die bestehende Meldung bleibt.
- **Keine Bankdaten durch die Verwaltung.** Ein Mandat erteilt nur der Kontoinhaber selbst
  ([mandate.ts](../src/lib/actions/mandate.ts), `auth.uid()`). Daran wird nicht gerührt.
- **Kein Hinweis für den Kunden beim Entfernen der Bankdaten.** Bewusst zurückgestellt
  (Entscheidung 2026-11-17): Er müsste zweisprachig und juristisch sauber sein, verhindert
  den Fall nur manchmal, und die Liste trifft den Betreiber ohnehin im richtigen Moment.
- **Keine Benachrichtigung beim Widerruf.** Bräuchte eine neue Benachrichtigungsart samt
  Migration (`notification_queue.event_type` hat eine CHECK-Liste); dafür ist der Nutzen zu
  klein, solange die Liste existiert.
- **Keine Warnung beim Verwerfen** eines Entwurfs, aus dem ein Kündigungsdatum gerechnet
  wurde → **PROJ-106**.
- **Der Fall „es entsteht gar kein Lauf"** bleibt wie in PROJ-103: dort gibt es keine Seite,
  nur die zusammenfassende Zeile.
- **Keine Mahnung und keine Rechnung ohne Einzug.** Offene Posten bleiben, was sie sind:
  zurückgebuchte Rechnungen.
- **Kein Rückdatieren des Kündigungsdatums.** Dem Kunden wurde ein Datum genannt; das bleibt
  stehen.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Die Liste

- [ ] Angenommen ein aktives Abo hätte an diesem Fälligkeitstag einen Beitrag offen und sein Mandat wurde widerrufen, wenn der Betreiber den Entwurf öffnet, dann steht es unter „Mandat widerrufen, Beitrag offen" mit Kundenname, Bezeichnung und Betrag
- [ ] Angenommen dieses Abo wurde früher schon eingezogen, wenn die Zeile erscheint, dann nennt sie das Datum des letzten Einzugs
- [ ] Angenommen dieses Abo ist zusätzlich gekündigt und das Enddatum liegt in der Zukunft, wenn die Zeile erscheint, dann nennt sie das Enddatum und dass ab diesem Tag kein Einzug mehr möglich ist
- [ ] Angenommen der Kunde hat nie ein SEPA-Mandat erteilt, wenn der Entwurf geöffnet wird, dann steht sein Abo in keiner der drei Listen
- [ ] Angenommen das alte Mandat wurde durch ein neues ersetzt, wenn der Entwurf geöffnet wird, dann steht das Abo nicht in dieser Liste, sondern wird normal eingezogen
- [ ] Angenommen ein Abo mit widerrufenem Mandat wurde im selben Zyklus schon eingezogen, wenn der Entwurf geöffnet wird, dann steht es nicht in dieser Liste
- [ ] Angenommen ein Abo mit widerrufenem Mandat ist zum Fälligkeitstag gekündigt oder pausiert, wenn der Entwurf geöffnet wird, dann steht es nicht in dieser Liste
- [ ] Angenommen ein Abo mit widerrufenem Mandat hat keinen Preis hinterlegt, wenn der Entwurf geöffnet wird, dann steht es mit „—" als Betrag in dieser Liste und der fehlende Preis wird als Datenfehler benannt
- [ ] Angenommen es gibt kein solches Abo, wenn der Entwurf geöffnet wird, dann erscheint die Liste nicht
- [ ] Angenommen die Mandate lassen sich nicht lesen, wenn der Entwurf geöffnet wird, dann erscheint ein Fehler und nicht eine leere Liste

### Der Weg zur Barzahlung

- [ ] Angenommen eine Zeile dieser Liste ist zu sehen, wenn der Betreiber „Auf die Barzahlungsliste" wählt und den vorgeschlagenen Betrag bestätigt, dann entsteht ein Eintrag in der Barzahlungsliste für dieses Abo
- [ ] Angenommen der Betrag ist vorbelegt, wenn der Betreiber ihn ändert, dann gilt der geänderte Betrag
- [ ] Angenommen für dieses Abo steht schon ein Eintrag auf der Barzahlungsliste, wenn der Entwurf geöffnet wird, dann sagt die Zeile das und bietet es nicht erneut an
- [ ] Angenommen der Betreiber versucht ein Abo ohne gültiges Mandat über „Trotzdem aufnehmen" in den Lauf zu holen, wenn er bestätigt, dann lehnt die App es mit der bestehenden Meldung ab

### Die Sperre beim Einzug

- [x] Angenommen zu einer Position im Entwurf ist das Mandat widerrufen, wenn der Betreiber die SEPA-Datei herunterladen will, dann entsteht keine Datei und die Meldung nennt die betroffenen Kunden
- [x] Angenommen zu einer Position im Entwurf ist das Mandat widerrufen, wenn der Betreiber den Entwurf ansieht, dann ist diese Position erkennbar gekennzeichnet
- [x] Angenommen der Betreiber entfernt diese Position, wenn er die Datei danach erneut anfordert, dann entsteht sie
- [x] Angenommen zu allen Positionen sind die Mandate gültig, wenn der Betreiber die Datei anfordert, dann verhält sich alles wie bisher
- [x] Angenommen zu einer Position ist das Mandat widerrufen, wenn der Betreiber den Upload bestätigen will, dann wird auch das verweigert und der Lauf bleibt Entwurf — beim Bauen ergänzt: Die Bestätigung macht aus Positionen Rechnungen, und eine Rechnung über eine Lastschrift gegen einen Widerruf wäre der schlechtere Zustand von beiden
- [x] Angenommen eine Position ist durch Guthaben auf 0 € gedeckt, wenn ihr Mandat widerrufen ist, dann sperrt das nicht — sie steht in keiner Bankdatei und bucht nichts ab

## Umsetzung — die Sperre beim Einzug (2026-11-17)

Der zweite, schwerere Fund des Tages ist geschlossen. Die **dritte Liste** („Mandat
widerrufen, Beitrag offen") steht noch offen — sie verhindert einen Verlust, die Sperre
verhindert einen unerlaubten Einzug, und letzteres wog schwerer.

| Teil | Wo |
|---|---|
| Die Regel, rein und ohne Datenbank prüfbar | `src/lib/sepa/mandat-sperre.ts` |
| Sperre beim Erzeugen der Datei | `generateRunXml` in `src/lib/actions/admin/sepa-collections.ts` |
| Sperre beim Bestätigen des Uploads | `bestaetigeBankupload`, über `mandatsSperre` |
| Kennzeichnung an der Zeile | `src/app/admin/lastschriften/[id]/page.tsx`, `collection-run-detail.tsx` |
| Tests | `mandat-sperre.test.ts` (7), `tests/PROJ-105-mandat-widerrufen.spec.ts` (5) |

Die Meldung nennt den **richtigen** Weg zurück: Position entfernen und neu eintragen. Dann
greift ein inzwischen neu erteiltes Mandat, oder das Eintragen lehnt ab und der Betrag gehört
auf die Barzahlungsliste. Ohne diesen Satz würde der Betreiber den ganzen Entwurf verwerfen —
und damit Kündigungsdaten verwaisen lassen (der erste Fund desselben Tages).

Der Browsertest geht die Reihenfolge des Betriebs: Lauf anlegen, Datei holen (muss gehen),
Mandat widerrufen, Datei holen (darf nicht gehen), Position entfernen, Datei holen (muss
wieder gehen).

## Edge Cases

1. **Mehrere Abos desselben Kunden** — jedes bekommt seine eigene Zeile. Der Widerruf gilt
   für den Kunden, offen ist aber je Abo etwas anderes.
2. **Widerruf mitten im Lauf** — zwischen Anlegen und Herunterladen. Das ist der Fall, der
   die Sperre beim Einzug nötig macht; das Zeitfenster sind in der Praxis Tage.
3. **Abo ohne Preis und ohne Mandat** — fiele sonst durch alle drei Listen. Deshalb steht es
   in dieser, mit „—" und dem Datenfehler-Hinweis (siehe Acceptance Criteria).
4. **Kunde hinterlegt die Bankdaten erneut** — dann verschwindet die Zeile von selbst, und
   der Beitrag lässt sich mit „Trotzdem aufnehmen" ganz normal einziehen, solange der
   Fälligkeitstag vor dem Enddatum liegt.
5. **Beitrag steht schon auf der Barzahlungsliste** — die Zeile bleibt sichtbar, sagt es
   aber, damit nicht zweimal kassiert wird.
6. **Das Enddatum ist schon erreicht** — dann ist nichts mehr offen, und das Abo erscheint
   nicht. Der verlorene Zyklus wäre dann schon verloren; genau das soll die Liste vorher
   verhindern.
7. **Ein Ticket statt eines Abos** — Tickets ohne Mandat bleiben außen vor. Sie sind
   Einzelfälle und hängen nicht an einem Zyklus, der sonst für immer durchfällt.

## Technical Requirements

- Die Entwurfsseite lädt heute schon Mandate, Abos, Profile und frühere Einzüge in einem
  `Promise.all`. Die neue Liste soll aus demselben Durchgang kommen — keine zweite Abfrage
  und keine zweite Regel.
- Die Trennung „hatte ein Mandat" / „hatte nie eines" braucht die widerrufenen Zeilen aus
  `sepa_mandates`. Nur `customer_id` und `revoked_at`, keine IBAN.
- Security: Verwaltung, wie die übrige Lastschriftseite. `add_cash_entry` prüft die
  Berechtigung selbst (`darf_barzahlung_fuehren`).

## Open Questions

- [x] Soll die Sperre beim Einzug zuerst und getrennt kommen? → **Ja, am 2026-11-17 so
      ausgeliefert.** Sie ist der gravierendere Fund und der kleinere Eingriff; die dritte
      Liste folgt.
- [ ] Eine Position, deren Mandatsreferenz **gar keine** Zeile in `sepa_mandates` hat, läuft
      weiter durch: Das Unterschriftsdatum wird dann durch den Fälligkeitstag ersetzt
      (`signedDateByReference.get(...) ?? run.due_date`). Das ist eine zweite, kleinere
      stille Stelle derselben Art. Bewusst nicht mitgenommen, weil ältere Läufe in der
      Testdatenbank verwaiste Positionen haben könnten und ein Härten dort unbemerkt eine
      andere Suite bricht. Eigene Prüfung wert.
- [ ] Soll eine Position mit widerrufenem Mandat beim Verwerfen/Entfernen zusätzlich
      automatisch auf der Barzahlungsliste landen? Vorschlag: nein — bei Geld entscheidet
      der Betreiber, und ein Klick weiter ist zumutbar.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Dritte Liste im Lauf-Entwurf, nicht Hinweis beim Kunden und nicht Benachrichtigung | Trifft den Betreiber genau dort, wo er ohnehin hinsieht, bevor Geld bewegt wird; kein Text in zwei Sprachen und keine Migration nötig | 2026-11-17 |
| Trennlinie „hatte einmal ein Mandat" statt „hat kein Mandat" | Ohne sie stünden alle echten Barzahler bei jedem Lauf in der Liste — genau der Grund, aus dem sie in PROJ-103 bewusst ausgeschlossen wurden | 2026-11-17 |
| Abos ohne Preis gehören mit „—" in diese Liste | Sonst entsteht ein neuer blinder Fleck: ohne Mandat und ohne Preis stünde ein Abo in gar keiner Liste | 2026-11-17 |
| Kein Einzug gegen ein widerrufenes Mandat, Datei verweigert statt Position stillschweigend ausgelassen | Die Freigabe macht aus Positionen Rechnungen; eine ausgelassene Position wäre eine Rechnung über nie geflossenes Geld. Und ein Einzug nach Widerruf ist nicht autorisiert | 2026-11-17 |
| Betrag auf die Barzahlungsliste nur auf Bestätigung, vorbelegt mit dem Abopreis | Bei Geld entscheidet der Betreiber selbst; ein vorbelegtes Feld ist ein Rat, der stimmen muss | 2026-11-17 |
| Das Kündigungsdatum wird nicht rückdatiert | Dem Kunden wurde ein Datum genannt. Es nachträglich zu verschieben wäre ein Wortbruch, auch wenn die Abbuchung dazu fehlt | 2026-11-17 |

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
