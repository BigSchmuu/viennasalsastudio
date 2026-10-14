# PROJ-83: Barzahlungen in Teilbeträgen — und erfassen in der Verwaltung

## Status: Deployed
**Created:** 2026-10-14
**Last Updated:** 2026-10-14

## Dependencies
- Requires: PROJ-81 (Barzahler-Liste) — hebt deren Einschränkung „ganz oder nicht" auf
- Requires: PROJ-70 (`istFaellig`/`naechsteFaelligkeit`) — erzeugt die Fälligkeitstage des Solls
- Requires: PROJ-9 (Pausieren und Kündigen) — eine Pause darf keine Schuld ansammeln
- Requires: PROJ-82 (Barzahler von Hand) — dieselben zwei Rollen dürfen erfassen
- Berührt: PROJ-44 (Guthaben) — bleibt bewusst getrennt, siehe Produktentscheidungen
- Berührt: PROJ-37 (Offene Posten) — dieselbe Frage für Lastschriften, anderes Mittel

## Anlass

Zwei Lücken aus dem Betrieb von PROJ-81, beide an derselben Stelle.

**Erstens zahlt nicht jeder auf einmal.** PROJ-81 hakt den Beitrag eines Zyklus ganz oder nicht ab —
der Betrag kommt fest aus dem Abo, und ein Wächter verbietet eine zweite Zahlung innerhalb von 28
Tagen. Wer am Kursabend 40 von 89 € gibt, lässt sich damit nicht erfassen. In der Praxis landet die
Zahlung dann wieder auf einem Zettel, und genau den sollte PROJ-81 ersetzen.

**Zweitens gibt es den Knopf nur im Kurs.** Erfasst wird ausschließlich in der Lehreransicht
(`/lehrer/[courseId]`). Die Übersicht in der Verwaltung ist nur lesend. Daraus folgen zwei Fälle ohne
Ausweg: eine Flatrate, die gerade in keinem Kurs hängt, steht dauerhaft auf „Offen" ohne jede
Möglichkeit abzuhaken — und Geld, das im Büro über den Tisch geht, muss über eine Kursseite
eingetragen werden. Die Datenbank erlaubt dem Admin das Erfassen längst
(`record_cash_payment` prüft `current_role() = 'admin'` **oder** Lehrkraft des Kurses); es fehlt
allein die Schaltfläche.

Beides zusammen in einer Spezifikation, weil es **eine** Handlung ist — eine Zahlung aufzeichnen —,
an zwei Orten, mit einem Datenmodell. Getrennt gebaut müsste die Verwaltungsmaske zweimal entstehen:
einmal für den festen Beitrag, einmal für den freien.

## Das Modell: Soll und Haben je Abo

Heute ist „bezahlt" eine **Datumsfrage**: Gibt es in diesem Zyklus eine Zahlung? Beträge spielen
keine Rolle. Mit Teilbeträgen genügt das nicht mehr — aus der Datumsfrage wird eine Rechnung.

- **Soll:** Je Abo entsteht an jedem Fälligkeitstag eine Soll-Zeile über den Beitrag. Die
  Fälligkeitstage sind dieselben wie beim Lastschriftlauf: vier Wochen Abstand, durch Ferien
  verlängert.
- **Haben:** Jede erfasste Barzahlung, in beliebiger Höhe.
- **Saldo:** Soll minus Haben. Größer als null heißt offen, kleiner als null ist Guthaben.

Daraus folgt alles Weitere von selbst: Ein Rest bleibt stehen, bis er bezahlt ist, und addiert sich
mit dem nächsten Beitrag. Eine Überzahlung deckt den nächsten Beitrag ab.

**Der Stichtag.** Die App beginnt bei null. Alles, was vor der Freigabe liegt, gilt als abgerechnet —
es steht auf den Papierlisten des Betreibers, und in der Datenbank stehen Barzahlungen erst seit
PROJ-81. Ohne diesen Schnitt erschiene jeder langjährige Barzahler mit einer Schuld über alle Monate,
die er längst bezahlt hat.

## User Stories

- Als Lehrkraft möchte ich einen Teilbetrag eintragen können, wenn jemand nicht alles dabei hat.
- Als Lehrkraft möchte ich sehen, was dieser Mensch insgesamt noch offen hat — nicht nur den Beitrag
  dieses Monats.
- Als Lehrkraft möchte ich den häufigsten Fall weiterhin mit einem Druck erledigen: alles bezahlt.
- Als Betreiber möchte ich eine Barzahlung auch in der Verwaltung erfassen, ohne über eine Kursseite
  zu gehen.
- Als Betreiber möchte ich einen Barzahler abhaken können, der gerade in keinem Kurs sitzt.
- Als Betreiber möchte ich nachvollziehen können, woraus ein offener Betrag besteht.
- Als Betreiber möchte ich, dass niemand eine Schuld bekommt, die nur daher kommt, dass seine
  Zahlungen auf Papier stehen.

## Out of Scope

- **Belege über Bargeld** und der Buchhaltungs-Export. Unverändert aus PROJ-81: Das berührt die
  Registrierkassen- und Belegerteilungspflicht und gehört vor den Steuerberater. Die Liste hält fest,
  dass Geld geflossen ist — sie stellt keinen Beleg aus.
- **Ein Startsaldo aus den Papierlisten.** Ausdrücklich verworfen (siehe Entscheidungen). Wer heute
  noch etwas schuldet, wird beim nächsten Kursabend kassiert; die App rechnet ab dem Stichtag.
- **Mahnen.** Wer offen ist, steht in der Liste. Eine Erinnerung daraus ist eine eigene Entscheidung.
- **Verrechnung mit dem Guthaben aus PROJ-44.** Das ist der Topf für Gutschriften bei der
  Lastschrift. Zwei Töpfe, die sich gegenseitig verrechnen, wären eine Quelle für Doppelbuchungen.
- **Teilbeträge bei Lastschriften.** Ein Einzug geht ganz oder er platzt — dann ist er ein offener
  Posten (PROJ-37).
- **Rückwirkende Korrektur eines Preises.** Eine Soll-Zeile trägt den Preis ihres Tages. Wer einen
  Beitrag ändert, ändert damit die kommenden Zeilen, nicht die vergangenen.
- **Drop-ins und Probestunden.** Die haben seit PROJ-74 ihre eigene Liste und keinen Zyklus.

## Acceptance Criteria

### Teilbeträge erfassen

- [ ] Angenommen ein Barzahler hat 89 € offen, wenn die Lehrkraft „Teilbetrag" wählt und 40 € einträgt,
      dann ist eine Zahlung über 40 € festgehalten und die Zeile zeigt „noch 49 € offen".
- [ ] Angenommen ein Barzahler hat 49 € offen, wenn die Lehrkraft 49 € einträgt, dann gilt der Zyklus
      als bezahlt und die Zeile zeigt das.
- [ ] Angenommen ein Barzahler hat 89 € offen, wenn die Lehrkraft „Bezahlt" drückt, dann wird der
      **gesamte offene Betrag** erfasst — ein Druck, wie bisher.
- [ ] Angenommen ein Barzahler hat aus dem Vorzyklus 49 € offen und ein neuer Beitrag ist fällig,
      wenn die Lehrkraft die Liste öffnet, dann steht dort der Gesamtbetrag (138 €) und woraus er
      besteht.
- [ ] Angenommen jemand gibt mehr als offen ist, wenn der Betrag erfasst wird, dann steht der
      Überschuss als Guthaben und der nächste fällige Beitrag gilt daraus als gedeckt.
- [ ] Angenommen ein Betrag ist keine gültige Zahl, null oder negativ, wenn er abgeschickt wird, dann
      erscheint eine Fehlermeldung und nichts wird gespeichert.
- [ ] Angenommen die Lehrkraft tippt den Knopf zweimal, wenn beide Druckvorgänge ankommen, dann wird
      die Zahlung nur einmal verbucht.

### Erfassen in der Verwaltung

- [ ] Angenommen der Betreiber ist in der Barzahlungs-Übersicht, wenn er bei einer offenen Zeile
      „Bezahlt" oder einen Teilbetrag erfasst, dann ist die Zahlung festgehalten und die Liste
      aktualisiert sich.
- [ ] Angenommen ein Barzahler mit Flatrate sitzt in keinem Kurs, wenn der Betreiber die Übersicht
      öffnet, dann kann er dessen Zahlung dort erfassen.
- [ ] Angenommen eine Zahlung wurde falsch erfasst, wenn der Betreiber sie zurücknimmt, dann steigt
      der offene Betrag wieder um diesen Betrag.
- [ ] Angenommen eine Lehrkraft ruft die Verwaltungsseite auf, dann sieht sie sie nicht.

### Soll und Stichtag

- [ ] Angenommen ein Abo besteht seit Monaten und hat in der App keine erfasste Zahlung, wenn der
      Stichtag erreicht ist, dann ist sein Saldo null — keine rückwirkende Schuld.
- [ ] Angenommen ein Fälligkeitstag ist erreicht, wenn der Morgenlauf durchläuft, dann existiert für
      dieses Abo eine Soll-Zeile über den heutigen Beitrag.
- [ ] Angenommen der Morgenlauf ist einen Tag ausgefallen, wenn er am Folgetag läuft, dann entstehen
      die versäumten Soll-Zeilen nach — und keine doppelt.
- [ ] Angenommen ein Abo ist pausiert, wenn Fälligkeitstage vorübergehen, dann entsteht kein Soll.
- [ ] Angenommen am Abo ist kein Preis hinterlegt, dann entsteht kein Soll und die Zeile sagt „Kein
      Preis am Abo" statt einen Knopf anzubieten.

## Edge Cases

- **Gekündigtes Abo mit Restschuld.** Nach der Kündigung entsteht kein neues Soll. Ein offener Rest
  bleibt in der Verwaltungsübersicht sichtbar und gekennzeichnet — sonst verschwindet Geld aus der
  Aufzeichnung. In der Lehreransicht erscheint die Person nicht mehr; sie hat keinen Kursplatz.
- **Mandat nachträglich erteilt.** Der Mensch ist kein Barzahler mehr und fällt aus der Kursliste.
  Ein offener Rest bleibt in der Verwaltungsübersicht stehen, bis er beglichen ist.
- **Ferien.** Verlängern den Abstand zwischen zwei Soll-Zeilen, genau wie beim Lastschriftlauf. Eine
  zweiwöchige Schließung verschiebt die nächste Fälligkeit um zwei Wochen.
- **Preisänderung mitten im Lauf.** Jede Soll-Zeile trägt den Preis ihres Fälligkeitstages. Eine
  Erhöhung wirkt vorwärts.
- **Einzug und Barzahlung gemischt.** Wer eingezogen wurde und dann sein Mandat widerruft, bekommt
  für die Zeit mit Mandat **kein** Soll: Solange eingezogen wird, entsteht keine Soll-Zeile, und die
  Rechnung beginnt am Tag des Widerrufs. Ein Einzug muss also nichts abdecken, weil es nichts zu
  decken gibt — beim Bauen stellte sich das als die einfachere und zugleich sichere Form derselben
  Zusicherung heraus (siehe Technische Entscheidungen).
- **Flatrate in mehreren Kursen.** Saldo und Zahlungen hängen am Abo, nicht am Kurs. Wer am Dienstag
  kassiert, hat für Donnerstag mitkassiert — unverändert aus PROJ-81, jetzt auch für Teilbeträge.
- **Zwei Lehrkräfte gleichzeitig.** Zwei Teilzahlungen am selben Tag sind erlaubt und addieren sich;
  identische Beträge innerhalb weniger Sekunden gelten als Doppeltipp und werden abgewiesen.

## Decision Log

### Product Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Ein Rest wandert mit und addiert sich zum nächsten Beitrag | Vom Betreiber gewählt. Die Alternative — jeder Zyklus rechnet für sich — hätte den Rest aus der offenen Summe verschwinden lassen, und damit genau das Geld, dessen Erfassung der Anlass ist. | 2026-10-14 |
| Stichtag bei der Freigabe, kein Startsaldo | Vom Betreiber gewählt. Die Barzahler liefen bis PROJ-81 auf Papier; eine rückwirkende Rechnung hätte jedem langjährigen Kunden eine Schuld über längst bezahlte Monate angeschrieben. Altschulden werden am Kursabend kassiert, nicht nachgetragen. | 2026-10-14 |
| Überzahlung wird Guthaben im selben Saldo | Vom Betreiber gewählt. Vorauszahlen kommt vor („ich fahre weg"), und im Soll-Haben-Modell kostet ein negativer Saldo nichts extra. Die Alternative hätte die Vorauszahlung außerhalb der App gelassen — zurück zum Zettel. | 2026-10-14 |
| Getrennt vom Guthaben aus PROJ-44 | Zwei Töpfe, die sich gegenseitig verrechnen, verrechnen irgendwann doppelt. Das PROJ-44-Guthaben gehört der Lastschrift; dieser Saldo gehört dem Bargeld. | 2026-10-14 |
| „Bezahlt" erfasst den **gesamten** offenen Betrag, nicht einen Zyklusbeitrag | Der häufige Fall bleibt ein Druck. Stünden dort 89 € bei 138 € Schuld, bliebe nach dem Abhaken ein Rest stehen, den niemand erwartet. | 2026-10-14 |
| Lehrkraft **und** Verwaltung dürfen Teilbeträge erfassen | Wie bei PROJ-82 entschieden. Der Teilbetrag entsteht am Kursabend; ihn nur in der Verwaltung zuzulassen würde den Zettel zurückbringen. | 2026-10-14 |
| Gekündigte Abos mit Restschuld bleiben in der Verwaltung sichtbar | Eine Schuld, die aus der Liste fällt, ist verlorenes Geld. Sichtbar, gekennzeichnet, ohne neues Soll. | 2026-10-14 |

### Technical Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Das Soll als **Zeilen** in einer Tabelle, nicht als Rechnung beim Lesen | Drei Sonderfälle lösen sich damit von selbst: Eine Pause erzeugt keine Zeile, eine Preisänderung lässt alte Zeilen unberührt, und der Stichtag ist einfach „keine Zeile davor". Vor allem ist der Betrag nachvollziehbar — „woraus bestehen die 138 €" sind zwei Zeilen und keine Herleitung. | 2026-10-14 |
| Erzeugt im bestehenden Morgenlauf, als eigener Schritt | `fuehreSchrittAus` kapselt jeden Schritt einzeln ab; der Vollzug fälliger Abo-Änderungen hängt schon dort. Kein zweiter Cron, keine zweite Stelle, die ausfallen kann. | 2026-10-14 |
| Eindeutigkeit über (Abo, Fälligkeitstag) | Macht den Schritt wiederholbar: Ein ausgefallener Lauf holt nach, ein doppelter schreibt nichts Zweites. | 2026-10-14 |
| Der 28-Tage-Wächter wird durch einen Doppeltipp-Wächter ersetzt | Seine Aufgabe war „kein zweites Mal Geld im selben Zyklus" — genau das soll jetzt möglich sein. Gegen den doppelten Druck schützt stattdessen „gleiches Abo, gleicher Betrag, gleicher Tag, innerhalb weniger Sekunden". | 2026-10-14 |
| `record_cash_payment` bekommt einen Betrag als Parameter | Bisher nahm die Funktion den Preis aus dem Abo. Parameter hinzufügen heißt in Postgres überladen, und mit Standardwert wird der Aufruf zweideutig — also `drop` und neu anlegen, mit neu erteilten Rechten. | 2026-10-14 |
| Der Saldo wird in einer Funktion berechnet, nicht in zwei | Lehreransicht und Verwaltung müssen dieselbe Zahl zeigen. Zwei Rechnungen driften. | 2026-10-14 |
| Einzüge zählen gar nicht mit, statt als Haben-Seite | Erster Entwurf wollte SEPA-Positionen als Haben führen — das hätte geplätzte Einzüge, Entwürfe und Gutschriften mitrechnen müssen. Stattdessen entsteht kein Soll, solange ein Mandat besteht; die Rechnung beginnt am Tag des Widerrufs. Dieselbe Aussage, drei Sonderfälle weniger. | 2026-10-14 |
| Der Stichtag steht als Konstante im Code, nicht als Spalte am Abo | Er ist ein einmaliger Schnitt in der Aufzeichnung, kein Wert, der je Abo anders wäre. Eine Spalte hätte gepflegt werden müssen, ohne je einen zweiten Wert zu tragen. | 2026-10-14 |
| Die Verwaltung lädt nach dem Schreiben neu, die Lehreransicht rechnet nach | Am Schreibtisch kostet ein Neuaufbau nichts und die Zahl kommt aus derselben Rechnung. Am Kursabend am Handy zählt jede Sekunde — dort wird mit dem Betrag gerechnet, den die Datenbank zurückgibt, nicht mit einem selbst gerundeten. | 2026-10-14 |
| Zurücknehmen lädt neu statt nachzurechnen | Nach einem Seitenaufbau kennt die Liste nur die Kennung der heutigen Zahlung, nicht ihren Betrag. Ein Neuladen ist bei einer Ausnahme billiger als ein falscher Saldo. | 2026-10-14 |


## Umsetzung (2026-10-14)

### Datenbank — `20261014120000_proj83_teilbetraege.sql`

- **`cash_dues`**: die Soll-Seite. Eindeutig über (Abo, Tag), damit der Morgenlauf wiederholbar ist.
  RLS: lesen die eigenen Zeilen oder als Verwaltung; **keine** Schreibregel — geschrieben wird nur
  mit dem Dienstschlüssel aus dem Morgenlauf.
- **`cash_ledger`** (Sicht, `security_invoker`): Soll, Haben und Saldo je Abo. Die eine Stelle, an der
  gerechnet wird — die Verwaltung liest sie direkt, die Lehreransicht über die Funktion.
- **Der 28-Tage-Wächter ist weg**, an seiner Stelle steht `cash_payment_kein_doppeltipp`: gleiches
  Abo, gleicher Betrag, gleicher Tag, innerhalb von zwei Minuten. Zwei *verschiedene* Teilbeträge am
  selben Tag bleiben erlaubt.
- **`record_cash_payment(uuid, numeric default null)`**: ohne Betrag der gesamte offene Saldo, mit
  Betrag genau dieser (gerundet, > 0, ≤ 10.000). Neu angelegt statt ersetzt, weil ein zweiter
  Parameter in Postgres eine Überladung wäre.
- **`get_course_cash_payers`** gibt jetzt `price`, `soll`, `haben` und `letzte_zahlung` heraus statt
  der Listen von Einzugs- und Zahlungstagen.

### Anwendung

- `lib/barzahlungen/soll-nachtragen.ts`: `sollTage` (reine Rechnung, Unit-Tests) und
  `traegeFaelligesSollNach`, eingehängt als Schritt `barzahlung-soll` im Morgenlauf.
- `lib/barzahlungen/offen.ts`: von der Datums- auf die Betragsrechnung umgestellt; braucht weder
  `heute` noch Ferien mehr.
- Lehreransicht: Spalten **Beitrag** und **Offen**, Knopf `Bezahlt € …` über den ganzen Rest plus
  `Teilbetrag` mit Eingabefeld.
- Verwaltung: dieselben zwei Knöpfe je offener Zeile, `Zurücknehmen` je eingesammelter Zahlung, und
  ein Abzeichen **Restschuld** für Abos, die kein neues Soll mehr bekommen.

### Tests

- `src/lib/barzahlungen/offen.test.ts` (14) und `soll-nachtragen.test.ts` (8) — grün.
- `tests/PROJ-83-teilbetraege-db.test.ts` (17) und `tests/PROJ-83-teilbetraege.spec.ts` (7) — warten
  auf die Migration in der Testdatenbank.
- Angepasst, weil sich das Modell bewusst geändert hat: `PROJ-81-barzahlungen-db.test.ts` (Spalte
  `price`, Soll-Zeile als Voraussetzung), `PROJ-81-barzahler-spec.spec.ts` (Soll-Zeile im Aufbau),
  `api/cron/notifications/route.test.ts` (der neue Schritt).

### Offen für den Betrieb

- Die Migration muss **vor** dem Deploy eingespielt sein: Die Anwendung ruft die neue Signatur auf.
- Der Stichtag steht auf **2026-10-15**. Wird später ausgeliefert, ist der erste gezählte Beitrag
  entsprechend später — nie früher.

## QA Test Results (2026-10-14)

Migration in Test **und** Produktion eingespielt. `npm run lint`, `npx tsc --noEmit` und
`npm run build` laufen sauber durch.

| Prüfung | Umfang | Ergebnis |
|---|---|---|
| Unit — `offen.test.ts` | 16 | grün |
| Unit — `soll-nachtragen.test.ts` | 9 | grün |
| Datenbank — `PROJ-83-teilbetraege-db.test.ts` | 16 | grün |
| Datenbank — `PROJ-81-barzahlungen-db.test.ts` (angepasst) | 8 | grün |
| Browser — `PROJ-83-teilbetraege.spec.ts` | 7 | grün |
| Browser — `PROJ-81-barzahler-spec.spec.ts` (PROJ-81 + PROJ-82) | 5 | grün |
| Regression — PROJ-13, 25, 50, 75 (dieselbe Kursseite) | 38 | grün, 1 bekannt übersprungen |
| Routenlauf — `api/cron/notifications` | 13 | grün |

### Was belegt ist

- Ein Teilbetrag lässt die Zeile offen, und zwar über den **Rest** — in der Datenbank nachgesehen,
  nicht nur auf dem Schirm.
- Zwei verschiedene Teilbeträge am selben Tag addieren sich; **derselbe** Betrag im selben
  Augenblick wird abgewiesen.
- Der Rest wandert mit: zwei fällige Beiträge und 40 € bezahlt ergeben 138 € offen.
- „Bezahlt" erfasst 178 € und nicht 89 € — den ganzen Rest.
- Eine Überzahlung wird Guthaben und deckt den nächsten fälligen Beitrag ab.
- Beträge über 10.000, null und negative werden abgewiesen; ohne offenen Betrag wird nichts verbucht.
- Die Verwaltung hakt eine **Flatrate ohne Kursplatz** ab — die Lücke, die PROJ-83 schließt.
- Eine zurückgenommene Zahlung macht den Betrag wieder offen.
- Soll und Saldo sind für die Lehrkraft gesperrt (`cash_dues`, `cash_ledger` liefern ihr leer); über
  die Funktion sieht sie dieselbe Zahl. Ein Kunde sieht nur seine eigene Zeile, ein nicht
  Angemeldeter nichts.
- Eine fremde Lehrkraft kann ein Abo ohne ihren Kurs nicht abhaken; die Lehrkraft kommt nicht auf
  die Verwaltungsseite.

### Was beim Prüfen angepasst werden musste

- Drei Testfehler in meinem eigenen Test: `getByLabel("Teilbetrag von …")` trifft auch den
  OK-Knopf daneben (`… erfassen`), weil es auf Teilzeichenfolgen passt — jetzt
  `getByRole("textbox", { exact: true })`. Und eine Zahlung aus dem Vortest ließ zwei Zeilen
  denselben Rücknahme-Knopf tragen.
- Die PROJ-81-Tests setzen jetzt eine Soll-Zeile voraus: „offen" entsteht nicht mehr aus dem Fehlen
  einer Zahlung. Das ist die beabsichtigte Modelländerung, kein Fehler.

### Nicht geprüft

- Der **Volllauf** über alle Browser. Nach der Bündelregel kommt der erst nach dem nächsten
  Feature-Bündel; die Seiten, die sich diese Kursseite teilen, sind gezielt mitgelaufen.
- Der **Morgenlauf gegen echte Daten**: Der Schritt ist über den Routentest und die Unit-Tests von
  `sollTage` geprüft, nicht gegen die Testdatenbank. Die erste Soll-Zeile entsteht am ersten
  Fälligkeitstag nach dem Stichtag — sichtbar wird das im Betrieb.

### Produktionsreife

**JA** — keine kritischen oder hohen Fehler offen.

## Open Questions

- [ ] Soll die Verwaltung eine Soll-Zeile von Hand anlegen oder streichen können (etwa nach einer
      Kulanzentscheidung)? Vorerst nein — eine Streichung ist eine Zahlung über den Restbetrag mit
      einer Notiz, und eine Notiz gibt es noch nicht.
- [ ] Braucht eine Zahlung ein Notizfeld („Rest kommt Freitag")? Nicht Teil dieser Spec; erst wenn
      der Betrieb zeigt, dass die Lehrkräfte etwas dazuschreiben wollen.

## Deployment

- **Ausgeliefert:** 2026-10-14
- **Produktion:** https://app.viennasalsastudio.at
- **Commit:** `e690958`, Tag `v1.83.0-PROJ-83`
- **Migration:** `20261014120000_proj83_teilbetraege.sql` — vor dem Deploy in Test und Produktion
  eingespielt, wie nötig: Die Anwendung ruft `record_cash_payment` mit zwei Parametern auf.
- **Nachgesehen:** Vercel-Deployment `Ready`; Startseite 200, `/admin/barzahlungen` und `/lehrer`
  antworten mit 307 auf die Anmeldung — kein 500 auf den geänderten Seiten.

### Für den Betrieb

- **Der Stichtag ist der 15.10.2026.** Bis zum ersten Fälligkeitstag danach steht bei jedem
  Barzahler „Nichts fällig" — das ist richtig und kein Fehler. Die erste Soll-Zeile entsteht im
  Morgenlauf (06:00 UTC) an dem Tag, an dem der Beitrag nach dem Zyklus des Kunden fällig wird.
- **Einmal nachsehen**, sobald der erste Kunde nach dem Stichtag fällig wird: Steht der Betrag in der
  Verwaltung unter „Offen"?
- **Ein Abo ohne Preis** sammelt kein Soll an und lässt sich nicht abhaken — die Zeile sagt „Kein
  Preis am Abo". Das betrifft weiterhin jeden Barzahler, dessen Abo keinen Beitrag trägt.
- **Vorauszahlen** geht jetzt: Ein Betrag über dem Offenen steht als Guthaben und deckt den nächsten
  Beitrag ab. Dieses Guthaben ist vom Empfehlungs-Guthaben (PROJ-44) getrennt.
