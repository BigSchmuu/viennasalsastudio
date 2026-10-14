# PROJ-84: Barzahlungen — Einträge von Hand

## Status: Deployed
**Created:** 2026-10-14
**Last Updated:** 2026-10-14

## Dependencies
- Ersetzt: PROJ-81 (abgeleitete Barzahler-Liste) und PROJ-83 (Soll-Zeilen, Saldo, Stichtag)
- Behält: PROJ-82 (Barzahler von Hand anlegen) — liefert Kunden samt Abo für die Auswahl
- Requires: PROJ-50/69 (`course_members`) — wer gehört zu diesem Kurs
- Requires: PROJ-13/72 (Lehreransicht) — der Ort, an dem kassiert wird

## Anlass

PROJ-81 bis 83 haben die Frage „wer zahlt bar?" aus den Daten **abgeleitet**: Wer kein SEPA-Mandat
hat, ist Barzahler; was er schuldet, entsteht aus Zyklus, Preis und Ferien; ein täglicher Lauf
schreibt Soll-Zeilen; ein Stichtag grenzt die Aufzeichnung ab. Das ist mehr Mechanik, als die
Aufgabe hat — und sie entscheidet Dinge, die der Betreiber selbst entscheiden will.

Gewollt ist eine Liste, die von Hand geführt wird: Kunde eintragen, Abo wählen, Betrag festlegen,
Zahlungen erfassen, offenen Rest sehen. Im neuen Zahlungszyklus wird die Liste geleert und neu
befüllt. **In der App steckt danach keine einzige Datumsregel mehr** — sie hält fest, was ihr gesagt
wird, und zählt zusammen.

## Das Modell

Ein **Eintrag** ist eine Zeile auf der Liste: ein Kunde, sein Abo (Kurs oder Flatrate), der Betrag,
den er in diesem Zyklus zahlen soll. Daran hängen die Zahlungen, einzeln und in beliebiger Höhe.
Offen ist, was vom Betrag noch fehlt.

Ein Eintrag verschwindet, wenn ihn jemand entfernt — einzeln oder über „Zyklus abschließen" für die
ganze Liste. Die erfassten **Zahlungen bleiben aufgezeichnet**: Sie sind der Nachweis, dass Geld
geflossen ist, und stehen weiterhin unter „Eingesammelt".

Kein Mandat-Filter, kein Zyklus, kein Stichtag, kein täglicher Lauf.

**Flatrater stehen in jedem Kurs.** Wer eine Flatrate hat, kann in jedem Kurs auftauchen — also muss
jede Lehrkraft bei ihm kassieren können, auch wenn er für diesen Kurs nicht angemeldet ist. Auf der
Kursseite stehen deshalb zwei Gruppen: die Einträge der Teilnehmer **dieses** Kurses, offen
sichtbar, und darunter eingeklappt alle übrigen Flatrate-Einträge, aufzuklappen über „Flatrater
anzeigen“. Gezeigt werden nur Leute, die auf der Liste stehen — nicht alle Flatrate-Kunden.

## User Stories

- Als Betreiber möchte ich einen Kunden auf die Barzahler-Liste setzen und dabei festlegen, wie viel
  er in diesem Zyklus zahlen soll.
- Als Betreiber möchte ich beim Eintragen auswählen, um welches Abo es geht — einen Kurs oder die
  Flatrate.
- Als Lehrkraft möchte ich am Kursabend sehen, wer aus meinem Kurs bar zahlt und wie viel noch offen
  ist.
- Als Lehrkraft möchte ich eine Zahlung erfassen, auch wenn jemand nur einen Teil dabei hat.
- Als Lehrkraft möchte ich auch bei einem Flatrater kassieren können, der heute in meinem Kurs
  steht, ohne für ihn angemeldet zu sein — ohne dass diese Leute meine Kursliste zuwachsen lassen.
- Als Betreiber und als Lehrkraft möchte ich einen Eintrag entfernen können, wenn er nicht
  hingehört.
- Als Betreiber möchte ich zu Beginn eines neuen Zahlungszyklus die Liste in einem Zug leeren.
- Als Betreiber möchte ich sehen, was in einem Zeitraum eingesammelt wurde und von wem.

## Out of Scope

- **Jede Form von Datumslogik.** Kein Zyklus, keine Ferienrechnung, kein Stichtag, kein täglicher
  Lauf. Wann ein Zyklus endet, entscheidet der Knopf „Zyklus abschließen".
- **Ableiten aus dem Mandat.** Wer bar zahlt, steht auf der Liste, weil jemand ihn eingetragen hat.
  Ein gültiges Mandat **verhindert** den Eintrag nicht — es gibt nur einen Hinweis, weil dann auch
  die Lastschrift zugreift.
- **Ein Rest, der von selbst mitwandert.** Bleibt am Zyklusende etwas offen, wird der Rest beim
  nächsten Eintragen in den Betrag hineingerechnet — von Hand und sichtbar.
- **Guthaben und Vorauszahlung.** Eine Zahlung kann nicht höher sein als der offene Betrag. Wer
  vorauszahlen will, bekommt einen entsprechend höheren Betrag eingetragen.
- **Belege über Bargeld** und der Buchhaltungs-Export — unverändert aus PROJ-81: Das berührt die
  Registrierkassen- und Belegerteilungspflicht und gehört vor den Steuerberater.
- **Mahnen.** Wer offen ist, steht auf der Liste.
- **Drop-ins und Probestunden.** Die haben seit PROJ-74 ihre eigene Liste und keinen Zyklus.
- **Teilbeträge bei Lastschriften.** Ein Einzug geht ganz oder er platzt (PROJ-37).

## Acceptance Criteria

### Eintragen

- [ ] Angenommen der Betreiber ist in der Barzahlungs-Übersicht, wenn er einen Kunden, dessen Abo und
      einen Betrag einträgt, dann steht die Zeile mit Name, Abo, Betrag und „offen" auf der Liste.
- [ ] Angenommen ein Kunde hat mehrere Abos, wenn er eingetragen wird, dann wählt der Eintragende das
      Abo aus — Kurs oder Flatrate — und das gewählte Abo steht in der Zeile.
- [ ] Angenommen am Abo ist ein Preis hinterlegt, wenn das Abo gewählt wird, dann ist der Betrag damit
      vorbelegt und bleibt überschreibbar.
- [ ] Angenommen der Betrag ist keine gültige Zahl, null, negativ oder über 10.000, wenn der Eintrag
      abgeschickt wird, dann erscheint eine Fehlermeldung und es entsteht kein Eintrag.
- [ ] Angenommen für dieses Abo steht schon ein Eintrag auf der Liste, wenn derselbe noch einmal
      eingetragen wird, dann wird das abgewiesen — ein Abo steht höchstens einmal offen.
- [ ] Angenommen der Kunde hat ein gültiges SEPA-Mandat, wenn er eingetragen wird, dann erscheint ein
      Hinweis, dass dieses Abo auch eingezogen wird — der Eintrag entsteht trotzdem.
- [ ] Angenommen die Lehrkraft ist auf ihrer Kursseite, wenn sie einen Teilnehmer ihres Kurses
      einträgt, dann gilt dasselbe wie in der Verwaltung.

### Zahlen und sehen

- [ ] Angenommen ein Eintrag über 89 € ist offen, wenn eine Zahlung über 40 € erfasst wird, dann
      zeigt die Zeile 40 € bezahlt und 49 € offen.
- [ ] Angenommen 49 € sind offen, wenn 49 € erfasst werden, dann gilt der Eintrag als bezahlt und
      zeigt das.
- [ ] Angenommen 49 € sind offen, wenn jemand 60 € erfassen will, dann wird das mit dem Hinweis
      abgewiesen, dass höchstens 49 € offen sind.
- [ ] Angenommen eine Zahlung wurde falsch erfasst, wenn sie zurückgenommen wird, dann steigt der
      offene Betrag wieder um diesen Betrag.
- [ ] Angenommen der Betrag war zu niedrig angesetzt, wenn der Eintragende ihn ändert, dann rechnet
      der offene Betrag mit dem neuen Wert — niemals unter das, was schon bezahlt ist.
- [ ] Angenommen die Lehrkraft öffnet ihre Kursseite, dann stehen dort die Einträge der Teilnehmer
      dieses Kurses — die eines anderen Kurses nicht.
- [ ] Angenommen ein Kunde hat eine Flatrate und sitzt in drei Kursen, wenn sein Eintrag bezahlt wird,
      dann ist er in allen drei Kursen als bezahlt zu sehen — es ist ein Eintrag, nicht drei.

### Flatrater in jedem Kurs

- [ ] Angenommen ein Flatrate-Eintrag steht auf der Liste und der Kunde ist für diesen Kurs **nicht**
      angemeldet, wenn die Lehrkraft die Kursseite öffnet, dann ist er nicht sofort sichtbar, sondern
      hinter „Flatrater anzeigen“ eingeklappt.
- [ ] Angenommen die Lehrkraft klappt „Flatrater anzeigen“ auf, dann stehen dort alle offenen
      Flatrate-Einträge mit Name, Betrag und offenem Rest — und sie kann dort Zahlungen erfassen.
- [ ] Angenommen ein Flatrater ist für diesen Kurs angemeldet, dann steht er in der oberen Gruppe und
      **nicht** zusätzlich im eingeklappten Teil.
- [ ] Angenommen es gibt keinen offenen Flatrate-Eintrag außerhalb dieses Kurses, dann erscheint der
      Abschnitt „Flatrater anzeigen“ gar nicht.
- [ ] Angenommen ein Kurs-Abo-Eintrag gehört zu einem anderen Kurs, dann ist er hier nirgends zu
      sehen — eingeklappt stehen nur Flatraten.

### Entfernen und abschließen

- [ ] Angenommen ein Eintrag steht auf der Liste, wenn er entfernt wird, dann ist er von der Liste
      weg und die dazu erfassten Zahlungen stehen weiterhin unter „Eingesammelt".
- [ ] Angenommen die Liste hat Einträge, wenn der Betreiber „Zyklus abschließen" wählt und bestätigt,
      dann ist die Liste leer und die Zahlungen stehen weiterhin unter „Eingesammelt".
- [ ] Angenommen „Zyklus abschließen" wurde gewählt, wenn die Bestätigung abgebrochen wird, dann
      bleibt die Liste unverändert.
- [ ] Angenommen ein Eintrag ist noch nicht vollständig bezahlt, wenn der Zyklus abgeschlossen wird,
      dann verschwindet er trotzdem — und die Bestätigung sagt vorher, wie viele offene Einträge
      betroffen sind und über welche Summe.

### Rechte

- [ ] Angenommen eine Lehrkraft ist für diesen Kurs eingetragen, dann darf sie Einträge dieses Kurses
      anlegen, ändern, entfernen und Zahlungen erfassen.
- [ ] Angenommen eine Lehrkraft unterrichtet diesen Kurs **nicht**, dann kann sie dessen Einträge
      weder sehen noch ändern.
- [ ] Angenommen jemand ist nicht angemeldet, dann sieht er von Einträgen und Zahlungen nichts.
- [ ] Angenommen ein Kunde ist angemeldet, dann sieht er höchstens seine eigenen Zahlungen, nie die
      eines anderen.

## Edge Cases

- **Zwei Lehrkräfte kassieren gleichzeitig.** Zwei Teilzahlungen am selben Tag addieren sich.
  Derselbe Betrag zweimal innerhalb von zwei Minuten gilt als Doppeltipp und wird abgewiesen.
- **Abo ohne Preis.** Der Betrag ist dann nicht vorbelegt, muss aber eingegeben werden — der Eintrag
  entsteht trotzdem. Anders als bisher blockiert ein fehlender Preis am Abo nichts mehr.
- **Gekündigtes Abo.** Ein Eintrag bleibt stehen, bis ihn jemand entfernt. Er lebt nicht vom Abo,
  sondern von der Liste.
- **Gelöschter Kunde.** Die Zahlung bleibt aufgezeichnet; der Eintrag verschwindet mit dem Kunden.
- **Flatrate in mehreren Kursen.** Ein Eintrag, sichtbar in jedem Kurs, in dem der Kunde einen Platz
  hat. Wer am Dienstag kassiert, hat für Donnerstag mitkassiert — sichtbar an „bezahlt".
- **Eintrag ohne Zahlung entfernt.** Nichts bleibt zurück: Es ist nichts geflossen.
- **Kunde ohne Konto** (PROJ-82). Wird wie bisher mit Namen und Beitrag angelegt, bekommt ein Abo und
  steht danach in der Auswahl wie jeder andere.

## Decision Log

### Product Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Einträge von Hand statt abgeleiteter Liste | Vom Betreiber nach dem Betrieb von PROJ-81/83 entschieden: Wer was schuldet, ist seine Entscheidung und nicht die einer Herleitung aus Mandat, Zyklus und Ferien. | 2026-10-14 |
| Entfernen von Hand, plus „Zyklus abschließen" für alle | Vom Betreiber gewählt. Damit enthält die App keine Datumsregel mehr. Der Knopf für die ganze Liste ist nötig, weil dreißig Einträge einzeln zu löschen keine Arbeit ist, die man jemandem zumutet. | 2026-10-14 |
| Zahlungen bleiben nach dem Entfernen aufgezeichnet | Ein Eintrag ist eine Absicht, eine Zahlung ist eine Tatsache. Tatsachen werden nicht beim Aufräumen gelöscht. | 2026-10-14 |
| Lehrkraft **und** Verwaltung dürfen alles | Vom Betreiber gewählt. Am Kursabend ist damit niemand auf den Betreiber angewiesen; der Preis dafür ist, dass der Soll-Betrag nicht allein seine Entscheidung bleibt. | 2026-10-14 |
| Kein mitwandernder Rest mehr | Folgt aus dem Modell: Mit dem Eintrag endet der Zyklus. Ein Rest wird beim nächsten Eintragen in den Betrag hineingerechnet — von Hand, dafür sichtbar. | 2026-10-14 |
| Eine Zahlung darf den offenen Betrag nicht übersteigen | Ohne Zyklus gibt es kein „nächstes Mal", mit dem ein Guthaben verrechnet würde. Zugleich fängt die Grenze den Vertipper um drei Nullen. Wer vorauszahlen will, bekommt einen höheren Betrag eingetragen. | 2026-10-14 |
| Ein gültiges Mandat hindert nicht, warnt nur | Es kommt vor, dass jemand einmal bar zahlt, obwohl er sonst eingezogen wird. Ein Verbot wäre hier eine Annahme über den Betrieb; ein Hinweis genügt. | 2026-10-14 |
| Höchstens ein offener Eintrag je Abo | Zwei Einträge für dasselbe Abo wären zwei Antworten auf „wie viel schuldet er" — genau die Doppeldeutigkeit, die die Liste vermeiden soll. | 2026-10-14 |
| Flatrate-Einträge sind in **jedem** Kurs erreichbar, eingeklappt | Vom Betreiber gewünscht: Ein Flatrater kann in jeden Kurs kommen, und dann soll die Lehrkraft dort kassieren können. Eingeklappt, weil die Liste sonst in jedem Kurs um Leute wächst, die mit diesem Kursabend nichts zu tun haben. | 2026-10-14 |
| Jede Lehrkraft sieht damit alle Flatrate-Barzahler samt Beträgen | Folge der Entscheidung darüber, und ausdrücklich so gewollt — ohne die Namen könnte sie dort nicht kassieren. Kurs-Abo-Einträge fremder Kurse bleiben verborgen; sie gehören zu einem Abend, an dem diese Lehrkraft nicht steht. | 2026-10-14 |

### Technical Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Neue Tabelle `cash_entries`; `cash_dues` und `cash_ledger` fallen weg | Das Soll steht jetzt am Eintrag und entsteht nicht mehr aus einer Rechnung. Eine Tabelle, die nichts mehr füllt, und eine Sicht, die nichts mehr addiert, bleiben nicht stehen. | 2026-10-14 |
| `cash_payments` bleibt und bekommt `entry_id` (`on delete set null`) | Die Zahlungen sind der Nachweis und haben Bestand. Die Verbindung zum Eintrag ist nützlich, solange er existiert, und darf mit ihm verschwinden. | 2026-10-14 |
| Der Cron-Schritt `barzahlung-soll` und der Stichtag werden entfernt | Beide hatten nur eine Aufgabe: Soll-Zeilen zu erzeugen. Ohne Soll-Rechnung gibt es nichts nachzutragen und nichts abzugrenzen. | 2026-10-14 |
| Offen wird am Eintrag gerechnet, nicht in einer Sicht | Betrag minus Summe der Zahlungen — das ist eine Zeile und zwei Zahlen. Eine eigene Sicht dafür wäre mehr Apparat als Rechnung. | 2026-10-14 |
| Der Schreibwächter unterscheidet zwei Fälle | Bei einem Kurs-Abo: Lehrkraft **dieses** Kurses oder Admin, wie bisher. Bei einer Flatrate: jede Lehrkraft oder Admin — sonst könnte der eingeklappte Abschnitt angezeigt, aber nicht bedient werden. | 2026-10-14 |
| Schreiben weiterhin über `security definer`-Funktionen | Unverändert aus PROJ-81: Für eine Lehrkraft sind `subscriptions` und `sepa_mandates` gesperrt, und die Prüfung „Lehrkraft dieses Kurses" ist in einer Regel nicht zu haben. | 2026-10-14 |

## Was zurückgebaut wird

Die Migration dieser Spec nimmt zurück, was PROJ-83 heute eingeführt hat:

- `cash_dues` (Tabelle samt Regel und Eindeutigkeit) — **entfällt**
- `cash_ledger` (Sicht) — **entfällt**
- `record_cash_payment(uuid, numeric)` — wird auf den Eintrag umgestellt
- `get_course_cash_payers(uuid)` — liefert Einträge statt abgeleiteter Barzahler
- `lib/barzahlungen/soll-nachtragen.ts` samt Stichtag und der Cron-Schritt `barzahlung-soll` —
  **entfallen**
- Der Doppeltipp-Wächter auf `cash_payments` — **bleibt**

In Produktion sind dabei **keine Daten in Gefahr**: Der Stichtag (15.10.) ist noch nicht erreicht, es
existiert keine einzige Soll-Zeile, und `cash_payments` wird nicht angetastet.

## Umsetzung (2026-10-14)

### Datenbank — `20261014160000_proj84_barzahlungs_eintraege.sql`

Zuerst der Rückbau: `cash_dues`, `cash_ledger` und die beiden PROJ-83-Funktionen fallen weg.

- **`cash_entries`**: Kunde, Abo, Betrag. Eindeutig je Abo — zwei Einträge wären zwei Antworten auf
  dieselbe Frage. RLS: eigene Zeile lesen oder Verwaltung; **keine** Schreibregel, geschrieben wird
  nur über die Funktionen.
- **`cash_payments.entry_id`** (`on delete set null`): Die Zahlung hängt am Eintrag und überlebt ihn.
- **`darf_barzahlung_fuehren(abo)`**: Admin immer; Lehrkraft bei einer Flatrate immer, bei einem
  Kursabo nur für ihren Kurs. Diese eine Funktion bewächt alle fünf Vorgänge.
- **`add_cash_entry`**, **`update_cash_entry`** (nie unter das Bezahlte), **`remove_cash_entry`**,
  **`close_cash_cycle`** (nur Verwaltung), **`record_cash_payment(entry, betrag)`** (ohne Betrag der
  ganze Rest, nie mehr als offen), **`undo_cash_payment`** (ohne Tagesgrenze).
- **`get_course_cash_payers`** gibt beide Gruppen in einer Antwort: `eigener_kurs` für die
  Teilnehmer dieses Kurses, dazu alle übrigen Flatrate-Einträge. Kursabo-Einträge fremder Kurse
  kommen nicht mit.
- **`get_course_cash_candidates`**: wen die Lehrkraft hier noch eintragen kann, mit dem Abo-Preis als
  Vorschlag.
- Der Doppeltipp-Wächter auf `cash_payments` bleibt unverändert.

### Anwendung

- `lib/barzahlungen/offen.ts`: `eintragsZeilen`, `zustandText`, `offeneSumme`, `teileNachKurs` —
  Betrag minus Gezahltes, keine Datumsrechnung mehr. `soll-nachtragen.ts` ist gelöscht, der
  Cron-Schritt `barzahlung-soll` aus dem Morgenlauf entfernt.
- Kursseite: zwei Gruppen, die zweite in einem `Collapsible` — „Flatrater anzeigen (N)“. Je Zeile
  `Bezahlt € …`, `Teilbetrag`, der Betrag selbst anklickbar zum Ändern, und ein Papierkorb.
- Verwaltung: dieselbe Liste über alle Kurse, Eintragsformular mit Kunde/Abo-Auswahl und
  Mandatshinweis, `Zyklus abschließen` mit Bestätigung, die vorher nennt, wie viel offen
  verschwindet.
- PROJ-82 (Gast ohne Konto) legt jetzt zusätzlich den Listeneintrag an — sonst wäre der Gast
  angelegt, stünde aber auf keiner Liste.

### Tests

- `src/lib/barzahlungen/offen.test.ts` (14) und `barzahler-anlegen.test.ts` (12, um den Listeneintrag
  erweitert) — grün. Voller Vitest-Lauf ohne den PROJ-84-Datenbanktest: **1212 grün**.
- `tests/PROJ-84-barzahlungs-eintraege-db.test.ts` (22) und `tests/PROJ-84-barzahlungs-eintraege.spec.ts`
  (10) — warten auf die Migration in der Testdatenbank.
- **Entfernt**, weil sie ein Modell prüften, das es nicht mehr gibt: `PROJ-81-barzahlungen-db.test.ts`
  und `PROJ-83-teilbetraege-db.test.ts` samt `PROJ-83-teilbetraege.spec.ts`. Aus
  `PROJ-81-barzahler-spec.spec.ts` wurde `PROJ-82-barzahler-von-hand.spec.ts`: Der PROJ-82-Teil gilt
  weiter, der PROJ-81-Teil (Mandat heißt kein Barzahler, Betrag aus dem Abo) nicht.

## QA Test Results (2026-10-15)

Beide Migrationen in Test **und** Produktion eingespielt. `npx tsc --noEmit`, `npm run lint` und
`npm run build` laufen sauber durch.

| Prüfung | Umfang | Ergebnis |
|---|---|---|
| Unit — `offen.test.ts` | 14 | grün |
| Unit — `barzahler-anlegen.test.ts` | 12 | grün |
| Voller Vitest-Lauf | 1212 | grün |
| Datenbank — `PROJ-84-barzahlungs-eintraege-db.test.ts` | 22 | grün |
| Browser — `PROJ-84-barzahlungs-eintraege.spec.ts` | 10 | grün |
| Browser — `PROJ-82-barzahler-von-hand.spec.ts` | 2 | grün |
| Regression — PROJ-13, 25, 50, 75 | 40 | grün |

### Was belegt ist

- Der Betrag kommt aus der Eingabe, nicht aus dem Abo: Eintrag über 55 € an einem Abo, das 89 €
  trägt.
- Ein zweiter Eintrag fürs selbe Abo wird abgewiesen; Beträge ≤ 0 und > 10.000 ebenso.
- Der Betrag lässt sich nachträglich erhöhen, aber nicht unter das schon Bezahlte senken.
- Teilbeträge addieren sich; ohne Betrag wird der ganze Rest erfasst; mehr als offen wird abgewiesen.
- Derselbe Betrag im selben Augenblick gilt als Doppeltipp, ein anderer Betrag nicht.
- Ein entfernter Eintrag ist weg, **die Zahlung bleibt** — mit `entry_id` auf null.
- „Zyklus abschließen“ leert die Liste, nur für die Verwaltung; die Bestätigung nennt vorher Anzahl
  und offene Summe, und „Abbrechen“ ändert nichts.
- Ein Flatrate-Eintrag steht in jedem Kurs eingeklappt und ist dort kassierbar; ein Kursabo-Eintrag
  eines fremden Kurses ist weder sichtbar noch bezahlbar.
- `cash_entries` liefert der Lehrkraft leer — die Zahlen kommen nur über die Funktion; der Kunde
  sieht seine eigene Zeile, ein nicht Angemeldeter nichts.

### Was beim Prüfen gefunden wurde

- **`close_cash_cycle` konnte nie laufen**: `delete` ohne `where` wird von Supabase abgewiesen
  (SQLSTATE 21000). Behoben im Nachtrag `20261014180000_proj84_zyklus_abschliessen_fix.sql`.
- **Der neue Eintrag erschien nicht**: `useState(anfangsZeilen)` behält nach `router.refresh()`
  seinen ersten Wert. Behoben mit einem `useEffect`, der nachzieht.
- **„Eintragen“ war zweimal da** — nicht unterscheidbar von „Gast ohne Konto eintragen“. Der
  Gast-Knopf heißt jetzt „Gast anlegen“.
- Nebenbei: Der PROJ-75-Aufbau baute für den „laufenden Kurs“ eine Spanne über den Tageswechsel und
  scheiterte damit zwischen 00:00 und 00:30 an der Prüfregel der Tabelle. Am Tagesrand gekürzt.

### Nicht geprüft

- Der **Volllauf** über alle Browser — nach der Bündelregel erst nach dem nächsten Feature-Bündel.
  Die Seiten, die sich die Kursseite teilen, sind gezielt mitgelaufen.

### Produktionsreife

**JA** — keine kritischen oder hohen Fehler offen.

## Open Questions

- [ ] Braucht ein Eintrag ein Notizfeld („Rest aus September", „zahlt Freitag")? Sobald der Betrag von
      Hand gesetzt wird, ist der Grund dafür nicht mehr aus den Daten ablesbar — das spricht dafür.
      Vorerst nicht Teil dieser Spec.
- [ ] Soll „Zyklus abschließen" vorher eine Liste der offenen Einträge zeigen, damit man sie
      abschreiben kann, bevor sie verschwinden?
- [ ] Soll der Betreiber beim Eintragen aus einer Vorschlagsliste wählen können — etwa „alle
      Teilnehmer dieses Kurses ohne Mandat" —, um dreißig Einträge nicht einzeln anzulegen?

## Deployment

- **Ausgeliefert:** 2026-10-15
- **Produktion:** https://app.viennasalsastudio.at
- **Commit:** `3115fcb`, Tag `v1.84.0-PROJ-84`
- **Migrationen:** `20261014160000_proj84_barzahlungs_eintraege.sql` und der Nachtrag
  `20261014180000_proj84_zyklus_abschliessen_fix.sql` — beide vor dem Deploy in Test und Produktion
  eingespielt. Nötig in dieser Reihenfolge: Die erste nimmt PROJ-83 zurück und legt die Liste an,
  die zweite macht „Zyklus abschließen“ überhaupt lauffähig.
- **Nachgesehen:** Vercel-Deployment `Ready`; Startseite 200, `/admin/barzahlungen` und `/lehrer`
  antworten mit 307 auf die Anmeldung — kein 500 auf den geänderten Seiten.

### Für den Betrieb

- **Die Liste ist leer und bleibt leer, bis du einträgst.** Das ist der Unterschied zu vorher: Es
  erscheint niemand von selbst.
- **Eintragen geht an zwei Stellen** und beide dürfen alles: in der Verwaltung unter Barzahlungen
  (jedes aktive Abo) und am Kursabend auf der Kursseite (die Teilnehmer dieses Kurses).
- **Zum neuen Zahlungszyklus** drückst du „Zyklus abschließen“. Die Bestätigung sagt vorher, wie
  viele Einträge und wie viel offener Betrag verschwinden; die erfassten Zahlungen bleiben unter
  „Eingesammelt“ stehen.
- **Ein Rest wandert nicht mit.** Bleibt am Zyklusende etwas offen, rechnest du es beim nächsten
  Eintragen in den Betrag hinein — von Hand und sichtbar.
- **Eine Zahlung kann nicht höher sein als der offene Betrag.** Wer vorauszahlen will, bekommt einen
  entsprechend höheren Betrag eingetragen.
- **Jede Lehrkraft sieht alle Flatrate-Barzahler** samt Beträgen — anders ließe sich dort nicht
  kassieren. Kursabo-Einträge fremder Kurse bleiben verborgen.
