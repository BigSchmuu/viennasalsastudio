# PROJ-103: Der Lastschriftlauf sagt, welches Abo er ausgelassen hat — und warum

## Status: Deployed
**Created:** 2026-11-16
**Last Updated:** 2026-11-17

## Dependencies
- Requires: PROJ-47 (Lastschriftlauf als Entwurf) — der Hinweis gehört an den Entwurf
- Requires: PROJ-70 (Kein zweiter Einzug im selben Zyklus) — einer der Gründe
- Requires: PROJ-71 (Ein Abo wird erst ab seinem Beginn eingezogen) — der zweite Grund
- Nutzt: PROJ-100 (Rückweg aus der Kundenakte) — der Kundenname im Hinweis wird ein Link
- Nutzt: PROJ-9 (`pending_status` / `pending_effective_date`) — Kündigung und Pause

## Anlass

Nach dem Anlegen eines Laufs steht auf der Seite des Entwurfs ein Satz, der eine Zahl nennt
und zwei Möglichkeiten offen lässt:

> **1 Abo nicht aufgenommen.** Entweder liegt der letzte Einzug noch keine vier Wochen
> zurück — Ferienwochen zählen dabei nicht mit — oder das Abo beginnt erst nach diesem
> Fälligkeitstag. Unter „Offene Positionen“ stehen sie mit dem jeweiligen Grund; wer trotzdem
> einziehen will, trägt sie dort von Hand ein.

Aus dem Betrieb gemeldet am 2026-11-16: Der Satz beantwortet die eine Frage nicht, die sich
stellt — **welches** Abo ist es? Um das herauszufinden, muss der Betreiber den Knopf „Position
hinzufügen“ drücken, einen Dialog öffnen und dort zwischen allem, was dem Lauf noch fehlt,
die Zeilen mit einem Hinweis heraussuchen. Beurteilen kann er den Fall erst danach.

Die Namen sind längst da. Sie stehen in `offenePositionen` mit genau dem Grund, der hier
fehlt — nur an einer Stelle, an die niemand schaut, wenn er den Hinweis liest.

Dazu kommt ein zweites, bisher ungesehenes Problem. Der Lauf lässt Abos auch aus Gründen aus,
die er **nicht zählt** und die deshalb in keinem Hinweis auftauchen:

```
src/lib/actions/admin/sepa-collections.ts:90-92
.filter((s) => s.price !== null && mandateByCustomer.has(s.customer_id))
.filter((s) => !s.pending_effective_date || s.pending_effective_date > dueDate)
```

Ein Abo ohne hinterlegten Preis fällt damit aus **jedem** Lauf, lautlos, auf Dauer — und
niemand erfährt es. Genau diese Art Fehler soll die Anwendung nicht mehr machen.

## Die Regel in einem Absatz

Ein Entwurf nennt die Abos, die er hätte einziehen können und nicht eingezogen hat,
namentlich: Kunde, Abo, Betrag, Grund. Gezeigt wird nur, was der Betreiber beurteilen soll —
ein Abo ohne SEPA-Mandat ist ein Barzahler und steht nicht darin. Jede Zeile trägt die
Handlung, die der Grund nahelegt: „Trotzdem aufnehmen“, mit Rückfrage und mit dem Grund
noch einmal daneben. Der Hinweis hängt am Lauf und nicht an der Adresse — er ist nach dem
Neuladen und an jedem älteren Entwurf noch da. Nach der Freigabe ist er weg: Dann gibt es
nichts mehr zu entscheiden.

## User Stories

- Als **Betreiber** will ich im Hinweis den Namen des ausgelassenen Abos lesen, damit ich
  beurteilen kann, ob das Auslassen richtig war, ohne einen Dialog zu durchsuchen.
- Als **Betreiber** will ich den Grund mit Datum lesen („beginnt erst am 1. 12.“), damit ich
  nicht zwischen zwei Möglichkeiten raten muss.
- Als **Betreiber** will ich erfahren, wenn ein Abo mangels Preis aus dem Lauf fällt, damit
  dieser Fehler nicht monatelang unbemerkt Geld kostet.
- Als **Betreiber** will ich ein ausgelassenes Abo an derselben Stelle aufnehmen können, an
  der ich es beurteile, damit Beurteilen und Entscheiden nicht zwei Wege sind.
- Als **Betreiber** will ich vom Hinweis in die Kundenakte springen und wieder auf dem Lauf
  landen, damit ich meinen Platz in der Arbeit nicht verliere.
- Als **Betreiber** will ich keine Warnung sehen, wenn es nichts zu entscheiden gibt, damit
  eine Warnung weiter etwas bedeutet.

## Out of Scope

- **Abos ohne gültiges SEPA-Mandat.** Das sind die Barzahler (PROJ-81/84). Sie würden bei
  jedem Lauf dieselbe lange Liste füllen und nichts zu beurteilen geben. Bewusst entschieden
  am 2026-11-16.
- **Der Fehlertext, wenn gar kein Lauf entsteht** („Keine offenen Beiträge: 1 Abo wurde in
  diesem Zyklus bereits eingezogen.“). Dort gibt es keinen Lauf und damit keine Seite, auf
  die der Hinweis gehört. Dieselbe Verbesserung wäre dort möglich — eigene Spezifikation.
- **Eine Vorschau vor dem Anlegen** („wer fällt bei diesem Fälligkeitsdatum heraus?“) auf der
  Lastschriften-Übersicht.
- **Ausgelassene Tickets.** Ein Event-Ticket wird einmal eingezogen; dass ein schon
  eingezogenes nicht wieder mitkommt, ist nichts zu beurteilen.
- **Die Auswahlregel selbst.** Was ein Lauf aufnimmt, bleibt unverändert. Diese
  Spezifikation macht sichtbar, sie entscheidet nicht neu.
- **Der Dialog „Position hinzufügen“** bleibt, wie er ist — mit allem, was dem Lauf fehlt,
  und mit den Hinweiszeilen, die er schon hat.
- **Benachrichtigungen.** Niemand wird über ein ausgelassenes Abo per Mail informiert.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Was der Hinweis zeigt

- [ ] Angenommen ein Entwurf hat ein aktives Abo mit gültigem Mandat ausgelassen, wenn ich die
      Seite dieses Laufs öffne, dann steht das Abo namentlich im Hinweis — mit Kundenname,
      Bezeichnung des Abos, Betrag und Grund.
- [ ] Angenommen das ausgelassene Abo beginnt erst nach dem Fälligkeitstag, wenn ich den
      Hinweis lese, dann steht dort das Beginndatum des Abos.
- [ ] Angenommen der letzte Einzug des Abos liegt noch keine vier Wochen (zuzüglich
      Ferientage) zurück, wenn ich den Hinweis lese, dann stehen dort das Datum dieses Einzugs
      und der Tag, ab dem wieder eingezogen werden darf.
- [ ] Angenommen für das Abo ist bereits ein Einzug mit einem **späteren** Fälligkeitstag im
      selben Zyklus angelegt, wenn ich den Hinweis lese, dann steht dort dieses Datum und
      dass es im selben Zyklus liegt.
- [ ] Angenommen zum Fälligkeitstag wirkt eine Kündigung oder eine Pause des Abos, wenn ich
      den Hinweis lese, dann steht dort, welche der beiden ab welchem Tag wirkt.
- [ ] Angenommen an einem sonst fälligen Abo ist kein Preis hinterlegt, wenn ich den Hinweis
      lese, dann steht dort „Kein Preis hinterlegt“ und kein Betrag.
- [ ] Angenommen mehrere Gründe treffen auf dasselbe Abo zu, wenn ich den Hinweis lese, dann
      steht dort genau ein Grund, und zwar der in der festgelegten Reihenfolge erste.
- [ ] Angenommen mehrere Abos wurden ausgelassen, wenn ich den Hinweis lese, dann stehen sie
      nach Kundenname sortiert — wie die offenen Positionen.

### Was der Hinweis nicht zeigt

- [ ] Angenommen ein aktives Abo hat kein gültiges SEPA-Mandat (Barzahler), wenn ich den
      Hinweis lese, dann steht es nicht darin.
- [ ] Angenommen der Lauf hat nichts ausgelassen, wenn ich ihn öffne, dann gibt es keinen
      Hinweis — keinen leeren Kasten und keine Null.
- [ ] Angenommen ein Lauf ist als hochgeladen bestätigt, wenn ich ihn öffne, dann gibt es
      keinen Hinweis auf ausgelassene Abos.
- [ ] Angenommen ein Abo fehlt im Lauf, ohne dass ein Grund dafür vorliegt — etwa weil ich die
      Position selbst entfernt habe —, wenn ich den Hinweis lese, dann steht es nicht darin;
      es bleibt im Dialog „Position hinzufügen“ erreichbar.

### Beständigkeit

- [ ] Angenommen ich lade die Seite des Entwurfs neu, wenn der Lauf ein Abo ausgelassen hat,
      dann ist der Hinweis noch da.
- [ ] Angenommen ich öffne einen Entwurf, den ich vor Tagen angelegt habe, wenn er ein Abo
      ausgelassen hat, dann ist der Hinweis da — ohne dass ich den Lauf neu anlegen muss.
- [ ] Angenommen die Zahl im Hinweis und die genannten Abos könnten auseinanderlaufen, wenn
      ich den Hinweis lese, dann stimmen sie überein, weil Anlegen und Anzeigen dieselbe Regel
      benutzen.

### Handeln

- [ ] Angenommen ich will ein ausgelassenes Abo trotzdem einziehen, wenn ich in seiner Zeile
      „Trotzdem aufnehmen“ wähle, dann erscheint eine Rückfrage mit Kunde, Abo, Grund und dem
      vorgeschlagenen Betrag, und erst meine Bestätigung legt die Position an.
- [ ] Angenommen das ausgelassene Abo hat keinen Preis, wenn ich es trotzdem aufnehmen will,
      dann ist das Betragsfeld leer, und ohne gültigen Betrag bleibt der Knopf gesperrt.
- [ ] Angenommen ich trage einen unplausiblen Betrag ein, wenn ich bestätigen will, dann gilt
      dieselbe Grenze wie überall im Lauf (höchstens 1000 €) und der Knopf bleibt gesperrt.
- [ ] Angenommen ich habe ein ausgelassenes Abo aufgenommen, wenn die Seite sich aktualisiert,
      dann steht es unter den Positionen des Laufs und nicht mehr im Hinweis.
- [ ] Angenommen das Mandat des Kunden wurde widerrufen, nachdem die Seite geladen war, wenn
      ich das Abo trotzdem aufnehmen will, dann lehnt die Anwendung ab und sagt, warum.
- [ ] Angenommen der Lauf wurde in der Zwischenzeit freigegeben, wenn ich das Abo trotzdem
      aufnehmen will, dann lehnt die Anwendung ab.
- [ ] Angenommen ich bin nicht als Verwaltung angemeldet, wenn ich die Aktion aufrufe, dann
      wird sie abgelehnt.

### Weg zurück

- [ ] Angenommen ich klicke im Hinweis auf den Kundennamen, wenn ich in der Kundenakte fertig
      bin, dann führt mich der Rückweg auf diesen Lastschriftlauf zurück.

## Edge Cases

- **Mehrere Gründe gleichzeitig.** Festgelegte Reihenfolge, vom entscheidendsten zum
  harmlosesten: (1) Kündigung oder Pause wirkt — zum Fälligkeitstag ist es kein laufendes Abo
  mehr, alles andere wäre dann gegenstandslos; (2) beginnt erst später — es gibt es noch
  nicht; (3) Zyklus noch nicht um — es gibt es, aber es ist schon bezahlt; (4) kein Preis
  hinterlegt — es wäre fällig, aber der Betrag fehlt.
- **Ein Einzug in der Zukunft.** `istFaellig` sperrt in beide Richtungen; in der
  Testdatenbank liegt ein Lauf im Jahr 2028. Der Grund muss das aussprechen, statt von einem
  „letzten Einzug“ zu reden, der noch nicht stattgefunden hat.
- **Preis 0.** Das ist kein fehlender Preis, sondern eine bewusste Null (Freiplatz). Der Lauf
  nimmt sie heute auf; daran ändert sich nichts.
- **Abo ohne Kundenprofil.** Der Name fehlt — dann steht „Unbenannt“, wie in den offenen
  Positionen.
- **Zwei Entwürfe zum selben Fälligkeitstag.** Jeder rechnet für sich; ein Abo, das im einen
  Entwurf steht, ist im anderen aus dem Grund „im selben Zyklus schon angelegt“ ausgelassen.
  Das ist richtig so — es soll nicht zweimal abgebucht werden.
- **Ferien.** Der Abstand von vier Wochen verlängert sich um Ferientage. Der genannte Tag
  „wieder möglich ab“ muss die Ferien einrechnen, sonst widerspricht er dem, was der Lauf
  tatsächlich tut.
- **Lange Liste.** Bei vielen ausgelassenen Abos bleibt der Hinweis lesbar: eine Zeile je
  Abo, nach Kundenname sortiert, kein eigenes Blättern.

## Open Questions

- [x] Soll derselbe namentliche Hinweis auch dort erscheinen, wo **kein** Lauf entsteht
      (Fehlertext „Keine offenen Beiträge“)? → Nein, aber der Text nennt jetzt die Gründe mit
      Anzahl statt immer „bereits eingezogen“ zu behaupten (2026-11-16).
- [ ] Ein Abo ohne hinterlegten Preis ist ein Datenfehler, der auch ohne Lastschriftlauf
      auffallen sollte — gehört er zusätzlich auf das Verwaltungs-Dashboard?

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Der Hinweis nennt Namen statt einer Zahl | Die Zahl beantwortet nicht die Frage, die sich beim Lesen stellt; die Namen liegen schon vor | 2026-11-16 |
| Barzahler (kein Mandat) bleiben draußen | Sie würden bei jedem Lauf dieselbe Liste füllen und geben nichts zu beurteilen | 2026-11-16 |
| Kündigung/Pause und fehlender Preis kommen dazu | Beide lassen heute lautlos ein Abo aus jedem Lauf fallen — der fehlende Preis dauerhaft | 2026-11-16 |
| Jede Zeile trägt „Trotzdem aufnehmen“ | Beurteilen und Entscheiden gehören an dieselbe Stelle; der Dialog bleibt als zweiter Weg | 2026-11-16 |
| Rückfrage vor dem Aufnehmen, mit dem Grund daneben | Das Aufnehmen ist genau der Doppeleinzug, den PROJ-70 verhindern soll — es muss eine bewusste Entscheidung sein | 2026-11-16 |
| Der Hinweis hängt am Lauf, nicht an der Adresse | `?uebersprungen=2` verschwand beim Neuladen und fehlte an jedem älteren Entwurf | 2026-11-16 |
| Nach der Freigabe kein Hinweis | Eine Handlungsaufforderung ohne Handlung; der Lauf ist nicht mehr änderbar | 2026-11-16 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Eine gemeinsame Regel für Anlegen und Anzeigen | Anlegen zählt und Anzeigen listet. Zwei Kopien derselben Regel würden auseinanderlaufen, und dann widerspricht der Hinweis dem Lauf — bisher stand die Regel zweimal da | 2026-11-16 |
| Der Grund als Datenstruktur, nicht als Satz | Der Satz entsteht erst in der Anzeige; so lässt sich die Reihenfolge der Gründe prüfen, ohne Texte zu vergleichen | 2026-11-16 |
| Kein `?uebersprungen=` mehr in der Adresse | Die Seite rechnet selbst; der Parameter war nur ein Transportmittel für eine Zahl | 2026-11-16 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design

### Die Regel wandert an eine Stelle

Bisher stand die Auswahlregel zweimal im Code: beim Anlegen des Laufs, wo sie **zählte**, und
auf der Seite des Entwurfs, wo sie **Gründe aufschrieb**. Der Kommentar dort warnte selbst
davor, dass zwei Regeln auseinanderlaufen. Solange der Hinweis nur eine Zahl zeigte, war das
ein Schönheitsfehler; sobald er Abos **namentlich** nennt, wäre eine Abweichung eine
Falschaussage über Geld.

Deshalb gibt es `src/lib/sepa/ausgelassen.ts` mit einer reinen Funktion über **ein** Abo:

```
auslassGrund(abo, fälligkeitsdatum, bisherigeEinzüge, ferien)
  → null                                        das Abo kommt in den Lauf
  → { art: "aenderung_wirkt", was, ab }         Kündigung oder Pause wirkt
  → { art: "beginnt_spaeter", beginn }          PROJ-71
  → { art: "zyklus_offen", letzterEinzug, wiederAb }      PROJ-70
  → { art: "zyklus_vorgemerkt", kuenftigerEinzug }        PROJ-70, andere Richtung
  → { art: "kein_preis" }                       der stille Fall
```

Der Grund ist eine **Datenstruktur**, kein Satz. Der Satz entsteht erst in der Anzeige
(`auslassText`), damit sich die Reihenfolge der Gründe prüfen lässt, ohne Texte zu
vergleichen. Entschieden wird nichts neu: Wer in den Lauf kommt, ist unverändert — alle
Gründe zusammen sind genau die bisherigen Filter.

### Zwei Richtungen beim Zyklus

`istFaellig` sperrt in beide Richtungen: Ein Einzug im selben Zyklus zählt auch, wenn er
**nach** dem neuen Fälligkeitstag liegt (in der Testdatenbank steht ein Lauf im Jahr 2028).
Von einem „letzten Einzug“ zu reden, der noch nicht stattgefunden hat, wäre falsch — daher
zwei Gründe. Genannt wird der nächstliegende sperrende Einzug in der Vergangenheit; gibt es
nur künftige, der früheste davon.

### Was sich sichtbar ändert

```
vorher (nur direkt nach dem Anlegen, aus ?uebersprungen=2):

  2 Abos nicht aufgenommen. Entweder liegt der letzte Einzug noch keine vier
  Wochen zurück — Ferienwochen zählen dabei nicht mit — oder das Abo beginnt
  erst nach diesem Fälligkeitstag. Unter „Offene Positionen“ stehen sie …

nachher (an jedem Entwurf, auch nach dem Neuladen):

  4 Abos nicht aufgenommen. Hier stehen sie mit dem Grund. …

  Anna Berger                                        € 42,00   [Trotzdem aufnehmen]
  Salsa Level 2
  Einzug am 7.11.2026 — keine vier Wochen Abstand; wieder möglich ab 5.12.2026

  Bea Fischer                                        € 43,00   [Trotzdem aufnehmen]
  Bachata Basics
  Beginnt erst am 1.12.2026 — nach diesem Fälligkeitstag.

  Carl Weber                                         € 44,00   [Trotzdem aufnehmen]
  Flatrate
  Gekündigt zum 1.11.2026 — ab diesem Tag wird nicht mehr eingezogen.

  Dora Klein                                              —     [Trotzdem aufnehmen]
  Salsa Level 1
  Kein Preis am Abo hinterlegt — der Lauf kann keinen Betrag abbuchen.
```

Der fehlende Preis steht in der Warnfarbe der Anwendung, die übrigen Gründe gedämpft: Die
anderen vier sind richtig so und brauchen einen Blick, dieser ist ein Datenfehler.

### Zwei Listen, ein Durchgang

Die Seite des Entwurfs rechnet beides aus derselben Abfrage:

| Liste | Inhalt | Wo |
| --- | --- | --- |
| **ausgelassen** | alle fünf Gründe | der Kasten oben |
| **offene** | kein Grund + die drei nachtragbaren Gründe (mit Hinweis) | Dialog „Position hinzufügen“, wie bisher |

Ein gekündigtes Abo und eines ohne Preis stehen also **nicht** im Dialog — sie haben in ihrer
Zeile oben einen eigenen Weg, mit dem Grund neben der Entscheidung. Der Dialog bleibt im
Übrigen unverändert.

### Dateien

| Datei | Was |
| --- | --- |
| `src/lib/sepa/ausgelassen.ts` | neu — die Regel, die Gründe, die Sätze; reine Funktionen |
| `src/lib/sepa/ausgelassen.test.ts` | neu — Reihenfolge der Gründe, Ferien, beide Zyklus-Richtungen, Sätze |
| `src/components/admin/sepa/ausgelassene-abos.tsx` | neu — der Kasten, die Zeilen, der Rückfragedialog |
| `src/app/admin/lastschriften/[id]/page.tsx` | `laufLuecken` liefert zwei Listen; `searchParams` entfällt |
| `src/lib/actions/admin/sepa-collections.ts` | benutzt `auslassGrund`; der Fehlertext beim leeren Lauf nennt die Gründe |
| `src/components/admin/sepa/collection-run-list.tsx` | kein `?uebersprungen=` mehr in der Adresse |
| `src/lib/navigation/herkunft.ts` | „zum Lastschriftlauf“ — die Zeile, die PROJ-100 schon beschrieb, aber nicht hatte |
| `tests/PROJ-103-ausgelassene-abos.spec.ts` | neu — fünf Abos, fünf Gründe, im Browser |

### Warum kein neuer Datenbankzustand

Ein „ausgelassen“-Vermerk in der Datenbank wäre schnell geschrieben und ab dem ersten
Preisfehler falsch: Trägt der Betreiber den Preis nach, ist der Grund weg, der Vermerk aber
nicht. Die Seite rechnet deshalb bei jedem Aufruf — es sind dieselben Abfragen, die sie für
den Dialog ohnehin macht.

## Umsetzung (2026-11-16)

### Was es jetzt gibt

- **Eine Regel statt zweier.** `auslassGrund` in `src/lib/sepa/ausgelassen.ts` entscheidet für
  das Anlegen des Laufs **und** für die Anzeige. Die drei Filter im Server-Vorgang und die
  zweite Kopie der Regel auf der Seite sind beide verschwunden.
- **Der Kasten nennt Namen.** Kunde (als Link in die Kundenakte), Abo, Grund mit Datum,
  Betrag. Sortiert nach Kundenname, eine Zeile je Abo.
- **Zwei stille Fälle sind sichtbar geworden.** Eine wirksame Kündigung oder Pause und ein Abo
  ohne hinterlegten Preis wurden bis hierher ohne jede Meldung ausgelassen — der fehlende
  Preis auf Dauer, in jedem Lauf.
- **„Trotzdem aufnehmen“ in der Zeile.** Rückfrage mit dem Grund daneben, Preis des Abos als
  Vorschlag, bei fehlendem Preis ein leeres Feld und ein gesperrter Knopf.
- **Der Hinweis hängt am Lauf.** `?uebersprungen=` ist weg; die Seite rechnet selbst. Damit ist
  er nach dem Neuladen und an jedem älteren Entwurf da — und nach der Freigabe nicht mehr.
- **Der Rückweg heißt jetzt richtig.** `/admin/lastschriften/<id>` ergibt „← Zurück zum
  Lastschriftlauf“ statt „zu den Lastschriften“. Diese Zeile stand in der Tech-Design-Tabelle
  von PROJ-100 schon drin — gebaut war sie nie.

### Abweichungen von der Spezifikation

- **Keine.** Die vier Reihenfolge-Regeln, der ausgeschlossene Barzahler und der Verzicht auf
  einen Datenbankzustand sind so umgesetzt wie beschrieben.

### Was beim Bauen auffiel

- **Der Fehlertext beim leeren Lauf log.** Entstand kein Lauf, hieß es immer „… wurden in
  diesem Zyklus bereits eingezogen“ — auch wenn das Abo gekündigt war oder keinen Preis hatte.
  Er nennt jetzt die Gründe mit Anzahl (`auslassZusammenfassung`). Die Abos **namentlich** zu
  nennen bleibt dort außerhalb des Umfangs: Es gibt keinen Lauf und damit keine Seite.
- **Die Wortwahl von PROJ-70 ist absichtlich erhalten.** „Einzug am … — keine vier Wochen
  Abstand“ steht genau so im Dialog „Position hinzufügen“; neu ist nur „wieder möglich ab …“.
  So lernt niemand zwei Formulierungen für dieselbe Sache, und der E2E-Test von PROJ-70 prüft
  weiter denselben Satzteil.
- **Ein Preis von 0 ist kein fehlender Preis.** Er bleibt ein Freiplatz und kommt wie bisher
  mit 0,00 € in den Lauf. Festgehalten im Unit-Test.

## QA (2026-11-16)

### Stand der Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| `src/lib/sepa/ausgelassen.test.ts` (neu) | 26/26 — Reihenfolge der Gründe, Ferien, beide Zyklus-Richtungen, jeder Satz |
| `src/lib/navigation/herkunft.test.ts` | 35/35 — darin die neue Zeile „zum Lastschriftlauf“ |
| Gesamte Einheiten- und Datenbanksuite | 1595 bestanden, 2 übersprungen, 120 Dateien |
| `tests/PROJ-103-ausgelassene-abos.spec.ts` (neu) | 7/7 auf Chromium **und** 7/7 auf Mobile Safari |
| Regression PROJ-70, PROJ-47, PROJ-100 (Browser) | 27/27 |
| Regression PROJ-7 (Browser) | 15/15 — nach dem Aufräumen eines fremden Entwurfs, siehe unten |
| `tsc --noEmit`, `eslint .`, `next build` | ohne Beanstandung |

### Was der Browsertest aufstellt

Fünf Abos derselben Kundschaft, jedes aus einem anderen Grund draußen, plus eines, das zahlt:

```
Abo A   im ersten Lauf eingezogen        → Zyklus, mit „wieder möglich ab"
Abo B   Beginn 1.6.2032                  → beginnt später
Abo C   Kündigung wirksam 1.2.2032       → gekündigt      (vorher: lautlos)
Abo D   kein Preis                       → kein Preis     (vorher: lautlos)
Abo E   kein SEPA-Mandat (Barzahler)     → steht nicht in der Liste
Abo F   Beginn zwischen beiden Läufen    → zahlt, steht in den Positionen
```

### Zwei Befunde, die nicht zu dieser Änderung gehören

**PROJ-7 fiel an einem fremden Entwurf.** Drei Prüfungen in
`tests/PROJ-7-sepa-lastschrift-mandate.spec.ts` waren rot. Ursache: PROJ-9 legt einen Lauf zum
24.12.2026 an und lässt ihn absichtlich liegen — aufgeräumt wird er erst beim **nächsten**
Start von PROJ-9. Beide Abos von PROJ-7 standen deshalb schon in diesem Entwurf, und ein Lauf
zum 15.12.2026 liegt neun Tage daneben: Die Vier-Wochen-Sperre aus PROJ-70 greift, der Lauf
hat keine Position, und drei aufeinander aufbauende Prüfungen fallen. Nach dem Verwerfen des
Fremdentwurfs — auf dem Weg, den die Anwendung selbst nimmt, Guthaben zuerst zurück — ist
PROJ-7 15/15. Kein Fehler in der Anwendung, sondern eine Kopplung zwischen zwei
Testdateien; in der Dateireihenfolge läuft PROJ-7 **vor** PROJ-9, sieht also stets den Rest
des vorigen Laufs. Gehört in eine eigene Aufräumrunde.

**PROJ-54 war tageszeitabhängig rot.** Zwei Prüfungen in `tests/PROJ-54-serien-db.test.ts`
scheiterten mit „event not open“. Der Termin „heute spät am Abend“ war fest auf `+02:00`
gerechnet; im Winter liegt das auf 22:59 Ortszeit, und von da an war der Termin vorbei — schon
der Ticketkauf scheiterte. Dieselbe Stelle ist am 2026-09-16 um 23:20 schon einmal verrottet.
Jetzt wird der Versatz nachgesehen statt geraten, und der Ticketkauf liegt **vor** dem
Verschieben auf heute. Um 23:39 CET, also mitten im vorher roten Fenster: 18/18. Eigener
Commit `fix(PROJ-54)`.

### Was in meinen eigenen Tests zweimal schiefging

- **404 auf `/login`.** Gegen einen frisch gestarteten Entwicklungsserver antwortet `/login`
  beim allerersten Aufruf mit 404: Die Sprachweiche in der Middleware ist noch nicht
  übersetzt, und ohne sie gibt es diesen Pfad nicht (die Seite liegt unter `/[locale]/login`).
  Die Anmeldung versucht es deshalb bis zu dreimal.
- **Die Adresse vor dem Wechsel gelesen.** Nach dem Klick auf den Rückweg stand noch die
  Kundenakte in der Adresse — `waitForLoadState("networkidle")` kehrt zurück, bevor der Link
  navigiert hat. Jetzt wird auf die Navigation gewartet.
- **Eine feste Wartezeit für das Anlegen.** 2,5 Sekunden reichen nicht, wenn der
  Entwicklungsserver die Serveraktion erst übersetzt; der Test hielt das für „kein Lauf
  entstanden“. Jetzt wird auf die Navigation gewartet.

### Erfüllte Kriterien: 17 von 23 durch einen Test belegt

Nicht neu geprüft (jeweils mit dem Grund):

- **Sortierung nach Kundenname** — umgesetzt, aber von keinem Test festgehalten; die
  Reihenfolge entsteht in der Seite, nicht in einer reinen Funktion.
- **Kein Hinweis, wenn nichts ausgelassen wurde** — in der Testdatenbank stehen immer Abos
  anderer Suiten, und ein systemweit leerer Zustand lässt sich dort nicht herstellen. Belegt
  ist das Gegenstück: Nach der Freigabe ist der Kasten weg.
- **Pause statt Kündigung** — im Einheitentest belegt, im Browser nur die Kündigung.
- **Ein künftiger Einzug im selben Zyklus** (`zyklus_vorgemerkt`) — im Einheitentest belegt,
  im Browser nicht aufgebaut.
- **Höchstbetrag 1000 €** — dieselbe Prüfung wie überall im Lauf
  (`pruefePositionsbetrag`), die ihre eigenen Einheitentests hat.
- **Widerrufenes Mandat, freigegebener Lauf, fehlende Verwaltungsrechte beim Aufnehmen** —
  alle drei Sperren sitzen in `fuegeLaufPositionHinzu` und gelten seit PROJ-47 für jeden Weg
  in den Lauf; PROJ-47 prüft den freigegebenen Lauf. Für diese Zeile sind sie ungeprüft.

### Produktionsreif: ja

Keine Migration, keine Änderung an Zugriffsregeln, keine neue Abfrage — die Seite rechnet aus
Daten, die sie für den Dialog ohnehin lädt. Nichts an der Auswahl der Abos hat sich geändert:
Was ein Lauf einzieht, ist vor und nach dieser Änderung dasselbe.

## Deployment (2026-11-17)

| | |
| --- | --- |
| Produktion | https://app.viennasalsastudio.at |
| Commits | `feat(PROJ-103)`, `fix(PROJ-54)` (Testreparatur, eigener Commit), `deploy(PROJ-103)` |
| Tag | `v1.103.0-PROJ-103` |
| Migration | **keine** |

### Vor dem Ausliefern

- `npm run build` ohne Beanstandung, `eslint .` leer, `tsc --noEmit` leer
- Einheiten- und Datenbanksuite: 1595 bestanden, 2 übersprungen, 120 Dateien
- PROJ-103 im Browser: 7/7 auf Chromium, 7/7 auf Mobile Safari
- Regression: PROJ-70, PROJ-47, PROJ-100 — 27/27; PROJ-7 — 15/15
- Keine neuen Umgebungsvariablen, keine Änderung an Zugriffsregeln

## Für den Betrieb

**Es ändert sich nichts daran, wer abgebucht wird.** Diese Änderung macht sichtbar, was der
Lauf ohnehin tat — sie entscheidet nicht neu. Wer vor der Änderung in einem Lauf stand, steht
auch danach darin.

**Was du jetzt am Entwurf siehst.** Oben steht, welche Abos der Lauf ausgelassen hat, mit
Kunde, Abo, Grund und Betrag. Vier der fünf Gründe sind richtig so und brauchen nur einen
Blick:

| Grund | Was zu tun ist |
| --- | --- |
| Einzug im selben Zyklus | nichts — der Tag, ab dem es wieder geht, steht daneben |
| Beginnt erst später | nichts — das Abo läuft noch nicht |
| Gekündigt oder Pause ab … | nichts |
| **Kein Preis am Abo hinterlegt** | **Preis nachtragen**, sonst fehlt es in jedem Lauf |

Der letzte steht in Warnfarbe. Er ist der Grund, aus dem diese Änderung mehr geworden ist als
eine Namensanzeige: Ein Abo ohne Preis fiel bisher lautlos aus **jedem** Lauf.

**„Trotzdem aufnehmen" ist für die Ausnahme**, etwa nach einer Rücklastschrift. Es fragt nach
und zeigt den Grund noch einmal — ein Abo aufzunehmen, das der Lauf aus gutem Grund
ausgelassen hat, ist der Doppeleinzug, den PROJ-70 verhindern soll. Bei einem Abo ohne Preis
ist das Feld leer; der dort eingetragene Betrag gilt nur für diesen Lauf, das Abo bleibt ohne
Preis.

**Barzahler stehen nicht in der Liste.** Wer kein SEPA-Mandat hat, gehört nicht in einen
Lastschriftlauf; er stünde sonst bei jedem Lauf da und gäbe nichts zu beurteilen.
