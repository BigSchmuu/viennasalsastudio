# PROJ-99: Die Auswahl beim Eintragen — gedeckte Abos und die Zahler des vorigen Zyklus

## Status: Deployed
**Created:** 2026-11-05
**Last Updated:** 2026-11-05

## Dependencies
- Requires: PROJ-84 (Barzahlungen als Einträge von Hand) — `get_course_cash_candidates`, die Auswahl
- Requires: PROJ-93/95 (Pass und Stilgrenze) — `deckt_abo_kurs`, die Deckungsregel
- Requires: PROJ-98 (Zahlungszyklen und Archiv) — **nur** für die Gruppe „im vorigen Zyklus“
- Berührt: PROJ-82 (Barzahler von Hand eintragen) — der Weg, der heute zur Doppelanlage führt
- Berührt: PROJ-50/69 (Kursplätze, `course_members`)

## Anlass

Der Betreiber: „Sollte ein Barzahler bereits einmal angelegt sein, sollte er auch auswählbar sein
mit den entsprechenden Pässen.“ Dahinter stecken zwei verschiedene Lücken.

### Befund 1: Ein Pass-Inhaber ohne Kursplatz ist nicht auswählbar

`get_course_cash_candidates` bietet nur Leute an, die in `course_members` **dieses Kurses**
stehen. Diese Sicht vereint kursgebundene Abos und eingetragene Kursplätze (PROJ-50/69). Ein
Pass-Inhaber hat ein Abo **ohne** Kurs — er steht dort also nur, wenn für ihn ein Kursplatz
eingetragen wurde. Fehlt der, kann die Lehrkraft ihn nicht auswählen.

Was sie dann tut, ist der eigentliche Schaden: Sie legt ihn als **neuen Gast** an. PROJ-82
erzeugt dabei einen echten Kunden samt Profil, Abo und Kursplatz — die Person ist danach
zweimal im System, mit zwei Abos. Anwesenheit, Kursgrenze und Auswertung zählen sie doppelt.

Dass die Lehrkraft den Pass überhaupt anbieten kann, ist seit PROJ-95 so — aber nur im
Dialog „Gast anlegen“. Genau dort führt der Weg in die Doppelanlage.

Die Regel, nach der ein kursloses Abo einen Kurs deckt, gibt es schon: `deckt_abo_kurs`
(PROJ-93) — die volle Flatrate deckt jeden Kurs, ein Pass nur Kurse seiner Stilrichtung. Nach
ihr erscheinen Pässe heute bereits **eingeklappt in der Liste** (PROJ-95,
`get_course_cash_payers`). Nur die Auswahl kennt sie nicht. Zwei Antworten auf
„wer gehört hier dazu“ — und nur eine ist richtig.

### Befund 2: Nach dem Abschließen beginnt die Suche von vorn

Ist ein Zyklus abgeschlossen, ist die Liste fast leer (PROJ-98 lässt nur die Offenen und die
späten Zahler stehen). Die Stammzahler müssen wieder eingetragen werden — jeder einzeln aus
einer Auswahl, die alle aktiven Abos führt, in alphabetischer Ordnung, ohne Gedächtnis dafür,
wer letzten Monat bar gezahlt hat.

## Die Regel in einem Absatz

Die Auswahl beim Eintragen bietet an, wessen Abo diesen Kurs **deckt** — Kursteilnehmer wie
bisher, dazu Flatraten und Pässe der passenden Stilrichtung, auch ohne eingetragenen
Kursplatz. Wer im vorigen Zyklus auf der Liste stand, steht in einer eigenen Gruppe **oben**,
mit dem Betrag von damals vorbelegt. Angelegt wird weiter einzeln und von Hand.

## User Stories

- Als **Lehrkraft** will ich einen Pass-Inhaber, den es schon gibt, auswählen können — nicht
  als neuen Gast anlegen müssen und ihn damit doppelt erzeugen.
- Als **Lehrkraft** will ich an der Auswahl sehen, um welches Produkt es geht (Kurs, Flatrate,
  „Bachata Pass“), damit ich den richtigen Betrag nehme.
- Als **Betreiber** will ich nach dem Abschließen die Zahler des vorigen Zyklus oben in der
  Auswahl finden, mit ihrem Betrag vorbelegt.
- Als **Betreiber** will ich, dass jemand, der aufgehört hat, mir dabei auffällt — also kein
  Sammelknopf, der ihn stillschweigend wieder einsetzt.

## Out of Scope

- **Ein Sammelknopf „alle aus dem vorigen Zyklus“.** Entschieden: einzeln auswählen. Bei Geld
  lieber jede Zeile einmal angesehen — und wer aufgehört hat, fällt so von selbst auf.
- **Doppelanlagen aufräumen, die es schon gibt.** Diese Änderung verhindert neue. Bestehende
  Doppel​gänger zusammenzuführen ist Handarbeit an echten Daten und eine eigene Entscheidung.
- **Die Gastanlage abschaffen.** Wer wirklich neu ist, wird weiter als Gast angelegt — der Weg
  bleibt, er ist nur nicht mehr der einzige.
- **Suchen und Filtern in der Auswahl.** Die Auswahl bleibt eine Liste. Wächst sie dem
  Betreiber über den Kopf, ist das eine eigene Aufgabe.
- **Der Betrag als Rechnung.** Vorbelegt wird der Betrag des vorigen Zyklus, sonst der Preis
  des Abos. Beides ist ein Vorschlag, der überschrieben werden kann — nichts rechnet.
- **Die Verwaltungsseite um die Deckungsregel erweitern.** Dort werden ohnehin **alle** aktiven
  Abos angeboten; die Lücke ist eine der Lehreransicht. Die Gruppe „voriger Zyklus“ bekommt die
  Verwaltungsseite trotzdem, denn dort wird abgeschlossen.

## Acceptance Criteria

### Wer in der Auswahl steht

- [x] Angenommen ein Kunde hat einen Pass der Stilrichtung dieses Kurses und keinen
      eingetragenen Kursplatz, wenn die Lehrkraft die Auswahl öffnet, dann steht er darin.
- [x] Angenommen ein Kunde hat einen Pass einer **anderen** Stilrichtung, wenn die Lehrkraft
      die Auswahl öffnet, dann steht er nicht darin.
- [x] Angenommen ein Kunde hat eine volle Flatrate, wenn die Lehrkraft die Auswahl eines
      beliebigen Kurses öffnet, dann steht er darin.
- [x] Angenommen ein Kunde steht schon auf der Liste dieses Zyklus, wenn die Lehrkraft die
      Auswahl öffnet, dann steht er nicht darin — unverändert zu heute.
- [x] Angenommen ein Kunde ist Teilnehmer dieses Kurses, wenn die Lehrkraft die Auswahl
      öffnet, dann steht er darin — unverändert zu heute.
- [x] Angenommen ein Eintrag steht in der Auswahl, wenn die Lehrkraft ihn ansieht, dann ist das
      Produkt genannt: der Kursname, „Flatrate“ oder „<Stil> Pass“.

### Die Zahler des vorigen Zyklus

- [x] Angenommen ein Kunde stand im vorigen Zyklus auf der Liste und steht jetzt nicht darauf,
      wenn der Betreiber die Auswahl öffnet, dann steht er in einer eigenen Gruppe oben.
- [x] Angenommen ein solcher Kunde wird ausgewählt, wenn das Betragsfeld erscheint, dann steht
      dort der Betrag, den er im vorigen Zyklus schuldete.
- [x] Angenommen es gibt noch keinen abgeschlossenen Zyklus, wenn der Betreiber die Auswahl
      öffnet, dann gibt es diese Gruppe nicht — und keinen leeren Abschnitt.
- [x] Angenommen ein Kunde des vorigen Zyklus hat sein Abo beendet, wenn der Betreiber die
      Auswahl öffnet, dann steht er nicht darin — ohne aktives Abo gibt es nichts einzutragen.

### Rechte

- [x] Angenommen eine Lehrkraft öffnet die Auswahl eines Kurses, den sie nicht unterrichtet,
      wenn sie die Funktion ruft, dann wird sie abgewiesen — unverändert zu PROJ-84.
- [x] Angenommen die Auswahl nennt Pässe fremder Kurse, wenn die Lehrkraft sie liest, dann
      stehen darin keine Angaben, die sie nicht sehen darf — kein Mandat, keine IBAN, kein
      fremder Kurs.

## Edge Cases

1. **Ein Kunde mit Pass **und** Kursabo in diesem Kurs.** Zwei Abos, zwei mögliche Einträge —
   die Auswahl führt beide, unterscheidbar am Produkt. `cash_entries` lässt je Abo einen
   Eintrag zu, also ist beides nebeneinander möglich und auch richtig: Es sind zwei Produkte.
2. **Der Pass ist abgelaufen oder das Abo gekündigt.** Nur aktive Abos stehen in der Auswahl —
   dieselbe Grenze wie heute.
3. **Ein Zahler des vorigen Zyklus ist in der Lehreransicht nicht sichtbar**, weil sein Abo
   diesen Kurs nicht deckt. Dann erscheint er dort auch nicht in der Gruppe — die Gruppe fügt
   niemanden hinzu, den die Deckungsregel aussortiert. Auf der Verwaltungsseite steht er.
4. **Derselbe Mensch steht als Doppelgänger im System** (aus der Zeit vor dieser Änderung).
   Die Auswahl führt beide Profile; welches gemeint ist, entscheidet der Betreiber. Aufräumen
   ist Out of Scope.
5. **Der Betrag des vorigen Zyklus ist höher, weil damals ein Rest mit drinsteckte.** Der
   Vorschlag ist dann zu hoch. Deshalb ist er ein Vorschlag — und deshalb steht in PROJ-98 der
   Rest **daneben** statt im Betrag.

## Tech Design

### Die Auswahl bekommt die Deckungsregel, die die Liste schon hat

`get_course_cash_candidates` fragt heute nach Kursmitgliedschaft. Sie muss zusätzlich fragen,
wessen kursloses Abo diesen Kurs deckt — nach derselben Regel, die `get_course_cash_payers`
für die eingeklappten Pässe benutzt. Diese Regel steht als Funktion (`deckt_abo_kurs`) und an
einer zweiten Stelle als `where`-Bedingung; der Kommentar an der Funktion sagt das schon und
verlangt, beide zusammen zu ändern. **Mit dieser Änderung wäre es die dritte Stelle.** Deshalb
gehört zur Aufgabe, dass die Auswahl die **Funktion** benutzt statt die Bedingung zu kopieren.

### Woher die Gruppe „voriger Zyklus“ kommt

Aus der Abschrift des jüngsten abgeschlossenen Zyklus (PROJ-98): Abo, Kunde, geschuldeter
Betrag. Gefiltert auf Abos, die noch aktiv sind und nicht schon auf der Liste stehen. Der
Betrag von damals wird als Vorschlag mitgegeben.

### Was die Oberfläche zeigt

```
Auswahl beim Eintragen (Lehreransicht und Verwaltung)
+-- Im vorigen Zyklus          <- nur wenn es einen gibt
|   +-- Name · Produkt · Betrag von damals
+-- Alle anderen
    +-- Name · Produkt · Preis des Abos
```

Das Produkt steht an **einer** Stelle im Code (`produktText` in
`src/lib/barzahlungen/offen.ts`) und wird schon von beiden Ansichten benutzt — es kommt kein
zweiter Beschriftungsweg dazu.

### Erforderliche Tests

- Datenbank: Pass der passenden Stilrichtung steht in der Auswahl, Pass einer anderen nicht,
  Flatrate in jedem Kurs, Kursteilnehmer wie bisher, wer auf der Liste steht nicht; Lehrkraft
  eines fremden Kurses abgewiesen; `anon` ohne Ausführungsrecht.
- Datenbank: die Gruppe „voriger Zyklus“ — enthält den Zahler von damals, nicht den mit
  beendetem Abo, nicht den, der schon auf der Liste steht; leer, wenn es keinen Zyklus gibt.
- Browser: Die Lehrkraft trägt einen Pass-Inhaber ohne Kursplatz ein, **ohne** einen Gast
  anzulegen — der Beweis für Befund 1. Und: der vorbelegte Betrag aus dem vorigen Zyklus.

## Decision Log

### Produkt

| Entscheidung | Begründung | Datum |
| --- | --- | --- |
| Die Auswahl bietet beides: gedeckte Abos und die Zahler des vorigen Zyklus | Entscheidung des Betreibers. Die eine Lücke führt zur Doppelanlage, die andere kostet jeden Zyklus Sucharbeit. | 2026-11-05 |
| Kein Sammelknopf | Entscheidung des Betreibers: Bei Geld lieber jede Zeile einmal angesehen; wer aufgehört hat, fällt so auf. | 2026-11-05 |
| Der Betrag von damals wird vorbelegt | Ein Griff weniger im häufigen Fall. Es bleibt ein Vorschlag — ein vorbelegtes Feld ist ein Rat, der stimmen muss, und deshalb steht der alte Rest in PROJ-98 daneben statt drin. | 2026-11-05 |
| Bestehende Doppelgänger werden nicht aufgeräumt | Handarbeit an echten Daten, eigene Entscheidung. Diese Änderung verhindert neue. | 2026-11-05 |

### Technik

| Entscheidung | Begründung | Datum |
| --- | --- | --- |
| Die Auswahl benutzt `deckt_abo_kurs`, nicht eine Kopie der Bedingung | Die Deckungsregel steht schon an zwei Stellen, und der Kommentar an der Funktion verlangt, sie zusammen zu ändern. Eine dritte Kopie wäre die, die vergessen wird. | 2026-11-05 |
| Eigene Spezifikation statt Teil von PROJ-98 | Unabhängig prüf- und auslieferbar: Befund 1 braucht kein Archiv. Projektregel „ein Spec = eine testbare, auslieferbare Einheit“. | 2026-11-05 |

## Open Questions

- [ ] **Soll die Verwaltungsseite die Deckungsregel auch bekommen?** Dort werden heute alle
      aktiven Abos angeboten, die Lücke gibt es also nicht. Sobald die Liste dort lang wird,
      wäre eine Vorsortierung nach „deckt diesen Kurs“ aber dieselbe Hilfe — nur hat die
      Verwaltungsseite keinen Kurs, auf den sie sich bezieht. Offen gelassen, weil die Antwort
      von der Zahl der Abos abhängt.

## Umsetzung (2026-11-05)

Gebaut, noch nicht geprüft — wie PROJ-98: Die Prüfungen laufen erst, wenn
`20261105180000_proj99_barzahler_auswahl.sql` (und PROJ-98s Migration davor) eingespielt ist.

### Die Deckungsregel bleibt an einer Stelle

`get_course_cash_candidates` vereinigt zwei Mengen: die Teilnehmer dieses Kurses wie bisher und
die kurslosen Abos, die ihn decken. Die zweite Menge kommt aus **`deckt_abo_kurs`** — also aus
der Funktion, nicht aus einer Kopie ihrer `where`-Bedingung. Die Zahl der Stellen, an denen die
Regel steht, bleibt damit bei zwei (Funktion und `get_course_cash_payers`), und der Kommentar an
der Funktion nennt jetzt beide namentlich.

**Eine Eigenschaft der Funktion wird dadurch sichtbar:** Sie liefert je Kunde **ein** deckendes
Abo — das älteste. Wer gleichzeitig eine Flatrate und einen Pass hat, bekommt in der Auswahl
nur eines von beiden angeboten. Das ist bei zwei kurslosen Abos derselben Person so selten, dass
eine zweite Antwort auf „welches Abo deckt diesen Kurs" teurer wäre als der Fall; es steht als
Kommentar in der Migration.

### Was sich an der Oberfläche ändert

- Die Auswahl heißt nicht mehr „Teilnehmer", sondern **„Kunde und Abo"** — in ihr stehen jetzt
  Leute, die in diesem Kurs keinen Platz haben. Wer sie weiter „Teilnehmer" nennt, schickt die
  Lehrkraft wieder zu „Gast anlegen". Der Browsertest von PROJ-84 wurde entsprechend
  nachgezogen.
- **Gruppe „Im vorigen Zyklus"** oben, mit dem Betrag von damals in der Zeile und als
  vorbelegter Wert. Sie fehlt ganz, wenn es keinen abgeschlossenen Zyklus gibt.
- Die Verwaltungsseite bekommt dieselbe Gruppe — dort wird abgeschlossen, dort beginnt die
  Sucharbeit. Sie liest den Betrag aus dem Archiv, das sie ohnehin schon geladen hat.
- `voriger_betrag` ist **ein** Feld für zwei Dinge: der Vorschlag für den Betrag und das
  Merkmal, an dem die Gruppe erkannt wird. Eine zweite Angabe „stand damals drauf" könnte davon
  abweichen.

### Der Beweis für Befund 1

`tests/PROJ-99-barzahler-auswahl.spec.ts` trägt einen Pass-Inhaber **ohne** Kursplatz über die
Auswahl ein und zählt danach Profile und Abos dieses Menschen: beides muss 1 bleiben. Dass der
Eintrag entsteht, wäre nur die halbe Aussage — der Schaden war die zweite Person.

## Offene Fragen

- [ ] **Soll die Verwaltungsseite die Deckungsregel auch bekommen?** Unverändert offen: Dort
      werden alle aktiven Abos angeboten, die Lücke gibt es also nicht, und die Seite hat keinen
      Kurs, auf den sie sich beziehen könnte. Die Antwort hängt an der Zahl der Abos.

## QA (2026-11-05)

**Umgebung:** lokal gegen die Testdatenbank, beide Migrationen eingespielt. Browser: Chromium
und Mobile Safari.

| Prüfung | Ergebnis |
| --- | --- |
| `tests/PROJ-99-barzahler-auswahl-db.test.ts` | **15/15** |
| `tests/PROJ-99-barzahler-auswahl.spec.ts` | **4/4** (2 Fälle × 2 Browser) |
| `tests/PROJ-95-pass-bei-barzahlern-db.test.ts` (Regression auf dieselbe Funktion) | **12/12** |
| `tests/PROJ-84-barzahlungs-eintraege.spec.ts` mit umbenannter Auswahl | grün |

**Alle 12 Kriterien haben einen Test.** Zwei hatten zuerst keinen und wurden nachgeholt:

- **„Ohne abgeschlossenen Zyklus gibt es die Gruppe nicht"** — jetzt im Browser geprüft, dass
  die Gruppe „Im vorigen Zyklus" in dieser Lage nicht nur leer, sondern **nicht vorhanden**
  ist.
- **„Keine Angaben, die die Lehrkraft nicht sehen darf"** — geprüft über die **Spaltenliste** der
  Funktion und nicht über einzelne Werte. Dieser Test wird rot, sobald jemand der Auswahl eine
  Angabe hinzufügt, ohne sich zu fragen, wer sie lesen darf. Ein Test auf „kein Mandat
  enthalten" hätte das nie gemerkt.

**Der eigentliche Beweis** steht in `PROJ-99-barzahler-auswahl.spec.ts`: Die Lehrkraft trägt
einen Pass-Inhaber **ohne** Kursplatz über die Auswahl ein, und danach zählt der Test seine
Profile und seine Abos — beides bleibt 1. Dass der Eintrag entsteht, wäre nur die halbe
Aussage; der Schaden war die zweite Person.

**Keine Befunde. Urteil: produktionsreif.** Abhängigkeit: PROJ-98s Migration muss zuerst
eingespielt sein, weil die Auswahl den Betrag aus dem Archiv liest.

## Deployment (2026-11-06)

Ausgeliefert nach https://app.viennasalsastudio.at

| | |
| --- | --- |
| Commit | `0462175` feat(PROJ-98, PROJ-99) |
| Tag | `v1.99.0-PROJ-99` |
| Migration | `20261105180000_proj99_barzahler_auswahl.sql` — vom Betreiber **vor** dem Push in der Produktion eingespielt, nach der von PROJ-98 |
| Build | „Compiled successfully in 12.5s“, keine Warnung |
| Deployment | `dpl_CwxK1JAJpvgx6wSZEbx357dXEAmY`, gemeinsam mit PROJ-98 |

Gemeinsamer Commit mit PROJ-98 — Begründung dort.

## Für den Betrieb

- **Die Gruppe „Im vorigen Zyklus" erscheint erst nach dem ersten Abschluss.** Vorher gibt es
  kein Archiv, aus dem sie sich speisen könnte, und sie fehlt dann ganz statt leer zu sein.
- **Der vorbelegte Betrag ist ein Vorschlag, kein Beschluss.** Er kommt aus dem letzten
  Zyklus und steht im Feld, damit der häufige Fall ein Tippen weniger kostet. Ändert sich der
  Preis, muss er überschrieben werden.
- **Bekannte Grenze:** `deckt_abo_kurs` gibt je Kunde **ein** deckendes Abo zurück (das
  älteste). Wer zwei kursfreie Abos hat, die denselben Kurs decken, erscheint mit dem älteren.
  In der Praxis gibt es diesen Fall nicht; falls doch, ist es eine Zeile in der Funktion.
