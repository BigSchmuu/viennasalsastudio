# PROJ-98: Zahlungszyklen bei den Barzahlern — Archiv und Abschluss mit Datum

## Status: Deployed
**Created:** 2026-11-05
**Last Updated:** 2026-11-05

## Dependencies
- Requires: PROJ-84 (Barzahlungen als Einträge von Hand) — `cash_entries`, `cash_payments`, `close_cash_cycle`
- Requires: PROJ-86 (Notiz am Eintrag) — die Notiz wandert ins Archiv mit
- Requires: PROJ-95 (Pass bei den Barzahlern) — die Lehreransicht, die hier eine Angabe dazubekommt
- Berührt: PROJ-82 (Kunden ohne Konto), PROJ-44 (Guthaben — bewusst nicht)

## Anlass

Zwei Wünsche des Betreibers, und sie haben dieselbe Wurzel.

**„Eine bessere Übersicht, für welchen Zyklus der Kunde gezahlt hat.“** Heute ist diese Frage
nicht beantwortbar, und zwar grundsätzlich: Ein Zyklus ist in der Datenbank nichts. Die Liste
`cash_entries` **ist** der laufende Zyklus, sie trägt kein Datum, und
„Zyklus abschließen“ löscht sie vollständig (`delete from cash_entries`). Die Zahlungen
überleben, verlieren aber ihren Bezug (`entry_id` wird NULL). Was bleibt, ist ein Zahltag ohne
Zusammenhang.

**„Beim Abschließen ein Enddatum wählen, damit die schon Gezahlten nicht rausfliegen.“** Der
Fall aus dem Betrieb: Der Zyklus endet, abgeschlossen wird ein paar Tage später. In diesen
Tagen zahlen Leute — für den **neuen** Zyklus. Das Abschließen löscht ihren Eintrag mit; ihre
Zahlung hängt danach an nichts, und auf der neuen Liste stehen sie als „offen“. Entweder
zahlen sie zweimal oder der Betreiber muss es sich gemerkt haben.

Beides löst dieselbe Maßnahme: Der Zyklus wird ein Datensatz mit Anfang und Ende, die Liste
wird beim Abschließen **archiviert statt gelöscht**, und das Enddatum entscheidet, welche
Zahlung zu welchem Zyklus gehört.

### Was PROJ-84 bewusst nicht wollte — und warum das hier kein Widerspruch ist

PROJ-84 hat „jede Form von Datumslogik“ ausgeschlossen: kein Zyklus, kein Stichtag, kein
täglicher Lauf. Das war die Korrektur an PROJ-83, wo die App **abgeleitet** hat, wer wie viel
schuldet.

Diese Spezifikation nimmt das nicht zurück. Der Betrag bleibt von Hand, wer auf der Liste
steht bleibt von Hand, und nichts rechnet selbständig ein Soll aus. Hinzu kommt nur eine
Angabe, die der Betreiber beim Abschließen **selbst eintippt** — und ein Archiv, das aufhebt,
was ohnehin schon dastand. Die Grenze ist dieselbe wie überall im Projekt: gerechnet wird
nicht, aufgeschrieben wird.

## Die Regel in einem Absatz

Ein Zyklus hat einen Anfang und ein Ende. Beim Abschließen wählt der Betreiber das Ende
(vorbelegt mit heute, Vergangenheit erlaubt, Zukunft nicht). Die Liste wird mit diesem Zyklus
archiviert. Von der Liste **verschwindet genau, wer bis einschließlich Enddatum voll bezahlt
hat** — alles andere bleibt stehen: wer noch offen ist, und wer nach dem Enddatum gezahlt hat.
Eine Zahlung gehört zu dem Zyklus, in dessen Zeitraum ihr Zahltag fällt; sie wird nicht
zugeordnet, sondern erkannt.

## User Stories

- Als **Betreiber** will ich einen Zyklus mit dem Datum abschließen, an dem er wirklich endete
  — nicht mit dem Tag, an dem ich dazu komme.
- Als **Betreiber** will ich, dass jemand, der für den neuen Zyklus schon gezahlt hat, auf der
  Liste stehen bleibt und als bezahlt zu sehen ist.
- Als **Betreiber** will ich einen abgeschlossenen Zyklus aufschlagen und sehen, wer darauf
  stand, was er schuldete und was er gezahlt hat.
- Als **Betreiber** will ich einen Fehlgriff zurücknehmen können — falsches Datum, zu früh
  gedrückt —, solange seither nichts kassiert wurde.
- Als **Lehrkraft** will ich am Eintrag sehen, ob die Zahlung zum laufenden Zyklus gehört oder
  noch zum vorigen, damit ich nicht doppelt kassiere.
- Als **Betreiber** will ich auf der Kundenseite sehen, für welche Zyklen dieser Mensch bar
  gezahlt hat — bei einer Reklamation ist der Kunde der Einstieg, nicht der Zyklus.

## Out of Scope

- **Vorauszahlung und Guthaben.** Eine Zahlung bleibt auf den offenen Betrag begrenzt.
  Entschieden: Der häufige Fall — jemand zahlt in der ersten Woche des neuen Zyklus — wird
  durch das Enddatum gelöst; Guthaben ist PROJ-44s Thema.
- **Den offenen Rest in den neuen Betrag hineinrechnen.** Der Rest aus dem vorigen Zyklus steht
  **daneben**, nicht drin. Eine Zahl, die zwei Zyklen vermischt, ist beim Kassieren nicht mehr
  auseinanderzunehmen.
- **Das Archiv bearbeiten.** Ein abgeschlossener Zyklus ist ein Nachweis. Zurücknehmen geht
  — ändern nicht.
- **Zahlungen nachdatieren.** `paid_on` ist weiterhin der Tag der Erfassung. Wer einen falschen
  Tag korrigieren will, nimmt die Zahlung zurück und erfasst sie neu.
- **Eine Zahlung einzeln einem Zyklus zuordnen.** Der Hebel ist das Enddatum, nicht die
  Einzelzahlung. (Siehe Edge Case 1 — das hat einen Preis, und er ist benannt.)
- **Das Kundenprofil.** Der Barzahler sieht seine Zyklen nicht. Bewusst: Das wäre Kundentext
  samt englischer Fassung und eine eigene Entscheidung.
- **Zyklen bei den Lastschriften.** Die haben ihren Rhythmus aus PROJ-70/96 und brauchen kein
  Archiv.
- **Export und Belege.** Unverändert aus PROJ-81: Registrierkassenpflicht, gehört vor den
  Steuerberater.
- **Automatisches Abschließen.** Kein Cron. Der Knopf bleibt ein Knopf.

## Acceptance Criteria

### Abschließen mit Datum

- [x] Angenommen auf der Liste steht ein Eintrag, der bis einschließlich des gewählten
      Enddatums voll bezahlt wurde, wenn der Betreiber abschließt, dann verschwindet dieser
      Eintrag von der Liste.
- [x] Angenommen auf der Liste steht ein Eintrag mit einer Zahlung **nach** dem gewählten
      Enddatum, wenn der Betreiber abschließt, dann bleibt der Eintrag stehen und diese Zahlung
      zählt für den neuen Zyklus.
- [x] Angenommen ein Eintrag ist noch offen, wenn der Betreiber abschließt, dann bleibt er
      stehen und der offene Rest des abgeschlossenen Zyklus steht als eigene Angabe daneben —
      nicht im neuen Betrag.
- [x] Angenommen der Betreiber öffnet den Abschluss-Dialog, wenn er nichts ändert, dann steht
      dort das heutige Datum.
- [x] Angenommen der Betreiber wählt ein Datum in der Zukunft, wenn er abschließen will, dann
      wird es abgewiesen mit der Begründung, dass dieser Zyklus noch läuft.
- [x] Angenommen der Betreiber wählt ein Datum vor dem Anfang des laufenden Zyklus, wenn er
      abschließen will, dann wird es abgewiesen.
- [x] Angenommen der Betreiber hat ein Enddatum gewählt, wenn der Dialog offen ist, dann nennt
      er, wie viele Einträge archiviert werden und wie viele stehen bleiben.

### Das Archiv

- [x] Angenommen ein Zyklus wurde abgeschlossen, wenn der Betreiber die Barzahlungen öffnet,
      dann steht dieser Zyklus mit Zeitraum, Zahl der Einträge, eingesammelter Summe und offen
      Gebliebenem in einer Liste.
- [x] Angenommen der Betreiber schlägt einen abgeschlossenen Zyklus auf, dann sieht er je
      Eintrag Kunde, Abo, geschuldeten Betrag und was in diesem Zyklus gezahlt wurde.
- [x] Angenommen der Betrag eines Eintrags wird nach dem Abschluss geändert, wenn der
      Betreiber den alten Zyklus aufschlägt, dann steht dort der Betrag, der beim Abschließen
      galt.
- [x] Angenommen noch kein Zyklus wurde abgeschlossen, wenn der Betreiber die Seite öffnet,
      dann steht statt einer leeren Tabelle ein Satz, dass es noch kein Archiv gibt.

### Das Archiv am Kunden

- [x] Angenommen ein Kunde stand in einem abgeschlossenen Zyklus auf der Liste, wenn der
      Betreiber dessen Kundenseite öffnet, dann stehen dort seine Zyklen mit Zeitraum,
      geschuldetem Betrag und dem, was er in diesem Zyklus gezahlt hat.
- [x] Angenommen ein Kunde war nie Barzahler, wenn der Betreiber seine Kundenseite öffnet,
      dann steht dort kein leerer Abschnitt, sondern gar keiner.
- [x] Angenommen ein Kunde hat in einem Zyklus nur teilweise gezahlt, wenn der Betreiber seine
      Kundenseite öffnet, dann ist das an diesem Zyklus zu sehen.

### Zurücknehmen

- [x] Angenommen ein Zyklus wurde gerade abgeschlossen und seither wurde nichts kassiert und
      kein Eintrag angelegt, wenn der Betreiber den Abschluss zurücknimmt, dann steht die
      Liste wieder wie davor und der Zyklus ist aus dem Archiv verschwunden.
- [x] Angenommen nach dem Abschluss wurde eine Zahlung erfasst, wenn der Betreiber
      zurücknehmen will, dann wird es abgewiesen mit der Begründung, dass seither kassiert
      wurde.
- [x] Angenommen es gibt mehrere abgeschlossene Zyklen, wenn der Betreiber zurücknimmt, dann
      betrifft das nur den jüngsten.

### Die Lehreransicht

- [x] Angenommen ein Eintrag wurde im laufenden Zyklus bezahlt, wenn die Lehrkraft die Liste
      öffnet, dann steht am Eintrag, dass für diesen Zyklus bezahlt ist.
- [x] Angenommen ein Eintrag hat einen offenen Rest aus dem vorigen Zyklus, wenn die Lehrkraft
      die Liste öffnet, dann steht das als eigene Angabe da und nicht im Betrag dieses Zyklus.

### Rechte

- [x] Angenommen eine Lehrkraft versucht abzuschließen oder zurückzunehmen, wenn sie die
      Funktion ruft, dann wird sie abgewiesen — das bleibt Sache der Verwaltung.
- [x] Angenommen ein Kunde ruft das Archiv ab, wenn er es versucht, dann sieht er höchstens
      seine eigenen Zeilen und keine fremden.

## Edge Cases

1. **Wer zu spät für den alten Zyklus zahlt, wird dem neuen zugerechnet.** Zahltag ist immer
   der Tag der Erfassung, und die Zuordnung hängt allein am Datum. Zahlt jemand am 5. seine
   Schuld aus dem Zyklus, der am 3. endete, zählt das Geld für den neuen. Der Preis dafür,
   dass der Hebel ein einziges Datum ist. **Abgefedert:** Der Dialog nennt vor dem Abschließen,
   welche Zahlungen nach dem Enddatum liegen, mit Namen und Tag — wer dort falsch steht,
   bekommt ein anderes Enddatum oder wird vorher von Hand geradegezogen.
2. **Abschließen mit leerer Liste.** Erlaubt. Es entsteht ein Zyklus ohne Einträge — das ist
   eine Aussage über den Zeitraum und kein Fehler.
3. **Zweimal am selben Tag abschließen.** Der zweite Zyklus wäre einen Tag lang oder leer; das
   Datum muss nach dem Anfang des laufenden Zyklus liegen, also nach dem Ende des vorigen.
4. **Ein Eintrag wurde vor dem Abschließen von Hand entfernt.** Seine Zahlungen hängen schon
   an nichts (`entry_id` NULL) und kommen nicht ins Archiv. Unter „Eingesammelt“ stehen sie
   weiter — unverändert zu heute.
5. **Der Kunde wird gelöscht.** Seine Archivzeilen gehen mit, wie heute schon seine Zahlungen
   (`on delete cascade`). Ein Archiv, das Namen von gelöschten Konten aufhebt, wäre eine
   eigene Entscheidung.
6. **Der erste Abschluss.** Es gibt noch keinen Vorgänger, also keinen Anfang. Genommen wird
   der Tag der ältesten Zahlung, die an einem Eintrag der Liste hängt; gibt es keine, der Tag
   des Abschlusses selbst.
7. **Zurücknehmen, nachdem ein Eintrag angelegt wurde.** Abgewiesen — sonst träfe die
   wiederhergestellte Zeile auf eine neue für dasselbe Abo, und `cash_entries` lässt je Abo
   nur eine zu.
8. **Eine Zahlung wird zurückgenommen, nachdem ihr Zyklus abgeschlossen ist.** Die Summe im
   Archiv ändert sich mit — sie wird aus den Zahlungen gerechnet, nicht beim Abschluss
   festgeschrieben. Nur der **geschuldete** Betrag ist eingefroren.

## Tech Design

### Was dazukommt

| | |
| --- | --- |
| **Ein Zyklus** | Anfang, Ende, wann und von wem abgeschlossen. Nur **abgeschlossene** Zyklen sind Datensätze; der laufende ist „alles nach dem letzten Ende“ und braucht keine Zeile. |
| **Eine Archivzeile je Eintrag** | Eine Abschrift der Liste im Moment des Abschließens: Kunde, Abo, geschuldeter Betrag, Notiz. Die Abschrift ist nötig, weil der Betrag danach noch geändert werden kann und der Eintrag verschwinden darf. |

### Was **nicht** dazukommt

Keine Spalte an den Zahlungen. Zu welchem Zyklus eine Zahlung gehört, sagt ihr Zahltag: Sie
fällt in genau einen Zeitraum. Eine zweite Angabe daneben wäre eine zweite Wahrheit — und die
erste, die beim nächsten Umbau auseinanderläuft.

### Abschließen, in Worten

Prüfen (Verwaltung, Datum nicht in der Zukunft, Datum nach dem Anfang des laufenden Zyklus),
den Zyklus anlegen, die Liste abschreiben, und dann **nur** die Einträge von der Liste nehmen,
die bis einschließlich Enddatum voll bezahlt sind. Zurück kommt, wie viele archiviert wurden
und wie viele geblieben sind — die Zahl, die der Betreiber im Hinweis liest.

Die Regel ist absichtlich eine einzige: *voll bezahlt bis zum Enddatum* verlässt die Liste.
Beide Wünsche fallen daraus heraus, ohne einen zweiten Fall — wer nach dem Enddatum gezahlt
hat, ist bis dahin nicht voll bezahlt und bleibt deshalb stehen.

### Zurücknehmen, in Worten

Nur der jüngste Zyklus, nur solange seit dem Abschluss keine Zahlung erfasst und kein Eintrag
angelegt wurde. Die abgeschriebenen Einträge kommen zurück auf die Liste, der Zyklus und seine
Abschrift verschwinden. Die zweite Bedingung ist nicht Vorsicht, sondern Notwendigkeit: Ein
neu angelegter Eintrag für dasselbe Abo stände der Wiederherstellung im Weg.

### Was die Oberfläche zeigt

```
Verwaltung → Barzahlungen
+-- Laufender Zyklus seit TT.MM.
|   +-- Die Liste (wie heute)
|   |   +-- an einem übernommenen Eintrag: "Aus dem Zyklus bis TT.MM. offen: X €"
|   +-- Knopf "Zyklus abschließen" → Dialog mit Datum, Vorschau, Abfrage
+-- Abgeschlossene Zyklen
    +-- je Zeile: Zeitraum, Einträge, eingesammelt, offen geblieben
    +-- aufgeklappt: die Abschrift, je Eintrag Kunde, Abo, Betrag, gezahlt
    +-- am jüngsten: "Abschluss zurücknehmen", solange erlaubt

Lehreransicht am Kursabend
+-- am Eintrag: "Für diesen Zyklus bezahlt" statt nur "Bezahlt am TT.MM."
+-- darunter, wenn vorhanden: "Aus dem vorigen Zyklus offen: X €"

Verwaltung → Kunden → ein Kunde
+-- Abschnitt "Barzahlungen", nur wenn er je auf einer Liste stand
    +-- je Zyklus: Zeitraum, geschuldet, gezahlt
```

Der Abschnitt am Kunden liest dieselbe Abschrift wie das Archiv der Barzahlungsseite — andere
Richtung, keine zweite Quelle. Dass er bei jemandem, der nie bar gezahlt hat, **ganz
verschwindet** statt leer dazustehen, ist dieselbe Linie wie überall in der Verwaltung: Ein
leerer Abschnitt sieht aus wie ein Fehler.

Der Zustandstext steht an **einer** Stelle (`src/lib/barzahlungen/offen.ts`) und wird von
beiden Ansichten benutzt. Er bekommt die neue Unterscheidung, nicht jede Ansicht für sich.

### Erforderliche Tests

- Datenbank: die eine Regel über alle vier Lagen (voll bezahlt vor dem Datum, Zahlung nach dem
  Datum, teilweise bezahlt, nichts bezahlt); Zukunftsdatum und Datum vor dem Anfang abgewiesen;
  der erste Abschluss ohne Vorgänger; die Abschrift behält den alten Betrag, nachdem der
  Eintrag geändert wurde; Zurücknehmen erlaubt und in beiden Fällen abgewiesen; Lehrkraft und
  Kunde abgewiesen; `anon` ohne Ausführungsrecht.
- Browser: abschließen mit zurückdatiertem Enddatum und sehen, dass der späte Zahler stehen
  bleibt und als bezahlt gilt; das Archiv aufschlagen; zurücknehmen; die Lehreransicht mit
  einem übernommenen Eintrag.

## Decision Log

### Produkt

| Entscheidung | Begründung | Datum |
| --- | --- | --- |
| Der Zyklus wird ein Datensatz, die Liste wird archiviert statt gelöscht | Ohne Zyklus ist „für welchen Zyklus hat er gezahlt“ nicht beantwortbar, und ein Löschen macht das Abschließen unwiderruflich. Beide Wünsche hängen daran. | 2026-11-05 |
| Wer nach dem Enddatum gezahlt hat, bleibt auf der Liste | Der Anlass der Änderung. Er muss nicht neu eingetragen werden und steht sofort als bezahlt da. | 2026-11-05 |
| Offene Einträge bleiben stehen, der Rest steht daneben | Entscheidung des Betreibers gegen das Hineinrechnen: Eine Zahl aus zwei Zyklen ist beim Kassieren nicht mehr zu trennen. | 2026-11-05 |
| Keine Vorauszahlung, kein Guthaben | Das Enddatum löst den häufigen Fall. Guthaben ist größer und gehört zu PROJ-44. | 2026-11-05 |
| Enddatum vorbelegt mit heute, Vergangenheit erlaubt, Zukunft nicht | Der häufige Fall bleibt ein Druck; zurückdatieren ist der Zweck der Übung; ein Zyklus, der noch läuft, lässt sich nicht abschließen. | 2026-11-05 |
| Der letzte Abschluss ist zurücknehmbar | Fängt den Fehlgriff, ohne eine Zeitmaschine zu bauen. | 2026-11-05 |
| Sichtbar in der Verwaltung und in der Lehreransicht, nicht im Kundenprofil | Entscheidung des Betreibers. Das Profil wäre Kundentext samt englischer Fassung. | 2026-11-05 |
| Das Archiv ist auch am Kunden auffindbar | Bei einer Reklamation ist der Kunde der Einstieg, nicht der Zyklus. Dieselbe Abschrift, andere Richtung. | 2026-11-05 |
| Der erste Zyklus beginnt an der ältesten Zahlung der Liste | Gibt dem Archiv ohne Zutun ein Datum, das zu den vorhandenen Daten passt. | 2026-11-05 |

### Technik

| Entscheidung | Begründung | Datum |
| --- | --- | --- |
| Zahlung → Zyklus wird über das Datum erkannt, nicht gespeichert | Eine Angabe statt zwei. Eine zweite Spalte wäre die erste, die beim nächsten Umbau von den Zeiträumen abweicht. | 2026-11-05 |
| Der geschuldete Betrag wird abgeschrieben, das Gezahlte nicht | Der Betrag kann sich ändern und der Eintrag verschwinden — deshalb eingefroren. Zahlungen stehen ohnehin für sich; wird eine zurückgenommen, soll das Archiv das zeigen. | 2026-11-05 |
| Nur abgeschlossene Zyklen sind Zeilen | Der laufende ist „alles nach dem letzten Ende“. Eine Zeile für ihn wäre ein Zustand, der mit der Liste synchron gehalten werden muss. | 2026-11-05 |
| Eine einzige Bedingung entscheidet, wer die Liste verlässt | „Voll bezahlt bis zum Enddatum“ deckt beide Wünsche ab. Zwei Regeln wären zwei Stellen, an denen sie auseinanderlaufen. | 2026-11-05 |
| Der Zustandstext bleibt an einer Stelle | `offen.ts` dient Verwaltung und Lehreransicht. Die Unterscheidung gehört dorthin, nicht in zwei Ansichten. | 2026-11-05 |

## Open Questions

- [x] **Soll das Archiv je Kunde auffindbar sein?** → **Ja.** Entscheidung des Betreibers;
      aufgenommen als eigener Abschnitt auf der Kundenseite. (2026-11-05)

Aus demselben Gespräch entstanden, aber bewusst **nicht** hier: Die Auswahl beim Eintragen soll
künftig auch Pass-Inhaber ohne Kursplatz anbieten und die Zahler des vorigen Zyklus oben
führen. Das ist eigenständig prüf- und auslieferbar und steht als **PROJ-99**. Nur der Teil
„Zahler des vorigen Zyklus“ braucht das Archiv von hier.

## Umsetzung (2026-11-05)

Gebaut, noch nicht geprüft: Die Migration ist geschrieben, die Tests sind geschrieben, gelaufen
ist noch keiner — die Testdatenbank kennt die neuen Tabellen erst, wenn der Betreiber
`20261105160000_proj98_barzahlung_zyklen.sql` einspielt.

### Was in der Datenbank dazukommt

| | |
| --- | --- |
| `cash_cycles` | Zeitraum, wann und von wem abgeschlossen. `ends_on` ist **eindeutig** — der nächste Zyklus beginnt am Tag danach, also wächst das Ende streng, und „der jüngste Zyklus" ist dadurch eine Zeile und keine Frage der Sortierung. |
| `cash_cycle_entries` | Die Abschrift: Kunde, Abo, geschuldeter Betrag, Notiz. |
| `letztes_barzyklus_ende()`, `laufender_barzyklus_beginn()` | Die Grenze zwischen „vorher" und „jetzt" an genau einer Stelle. |
| `barzahlung_bezahlt_laufend(eintrag)` | Was an einem Eintrag **in diesem Zyklus** bezahlt wurde. |
| `barzahlung_rest_vorher(abo)` | Was aus dem vorigen offen blieb. |
| `get_cash_cycle_preview(ende)` | Der Dialog: wer geht, wer bleibt, wer nach dem Enddatum gezahlt hat. Ändert nichts. |
| `close_cash_cycle(ende)` | Ersetzt die parameterlose Fassung — die ist **gelöscht**. |
| `undo_cash_cycle()` | Der letzte Abschluss zurück. |
| `get_cash_cycles()`, `get_cash_archive_entries(kunde?)` | Das Archiv — ein Parameter für beide Richtungen. |

Zwei neue Tabellen heißt zwei neue RLS-Regeln: `cash_cycles` liest nur die Verwaltung,
`cash_cycle_entries` die eigene Zeile oder die Verwaltung (dieselbe Regel wie an
`cash_entries`). Geschrieben wird an beiden ausschließlich über die Funktionen.

### Was sich am bestehenden Verhalten ändert — und warum es ändern musste

- **„Bezahlt" heißt ab jetzt „in diesem Zyklus bezahlt".** In `get_course_cash_payers`, auf der
  Verwaltungsseite, in `record_cash_payment` und in `update_cash_entry`. Ohne das letzte beiden
  wäre die Änderung eine Falle: Ein Eintrag, der einen Abschluss überlebt, hätte mit dem Geld
  von letztem Monat als bezahlt dagestanden (`nothing open` beim Kassieren) und sich nicht mehr
  senken lassen (`amount below payments`).
- **`letzte_zahlung` und `letzte_zahlung_id` zählen ebenfalls nur den laufenden Zyklus.** Damit
  greift „Zurücknehmen" am Eintrag nie in einen abgeschlossenen Zyklus. Ältere Zahlungen bleiben
  über „Eingesammelt" korrigierbar.
- **`close_cash_cycle()` ohne Datum gibt es nicht mehr.** Ein Standardwert hätte den Aufruf
  zweideutig gemacht, und ein stiller Rückfall auf „ganze Liste löschen" ist genau das, was
  verschwinden sollte.
- **Zurücknehmen stellt auch die stehengebliebenen Einträge auf ihren damaligen Betrag und ihre
  damalige Notiz zurück.** Das stand nicht in der Spezifikation, folgt aber aus ihrem Satz „dann
  steht die Liste wieder wie davor": Wer nach dem Abschluss einen Betrag für den neuen Zyklus
  eingetippt hat, soll ihn nicht behalten, wenn es diesen neuen Zyklus nicht mehr gibt.

### Zwei bestehende Prüfungen mussten mitgeändert werden

Beide prüften das alte Versprechen „Zyklus abschließen leert die ganze Liste":

- `tests/PROJ-84-barzahlungs-eintraege-db.test.ts` — prüft jetzt, dass die Lehrkraft abgewiesen
  wird, der bezahlte Eintrag geht und der **offene stehen bleibt**, und dass beide im Archiv
  stehen. Räumt den Zyklus selbst weg.
- `tests/PROJ-84-barzahlungs-eintraege.spec.ts` — dasselbe im Browser, dazu das vorbelegte
  Enddatum.

Das ist kein Kollateralschaden, sondern die Stelle, an der man sieht, dass sich der Vertrag
geändert hat.

### Abweichungen von der Spezifikation

| Geplant | Gebaut | Grund |
| --- | --- | --- |
| Lehreransicht „Aus dem vorigen Zyklus offen", Verwaltung „Aus dem Zyklus bis TT.MM. offen" | **Ein** Text für beide: „Aus dem Zyklus bis TT.MM. offen: X €" (`restText` in `offen.ts`) | Zwei Formulierungen für dieselbe Zahl sind zwei Stellen, an denen sie auseinanderlaufen. Das Datum hilft auch am Kursabend: „offen" ohne Zeitraum hängt in der Luft. |
| „Bezahlt am TT.MM." | „Für diesen Zyklus bezahlt am TT.MM." — **immer**, auch wenn noch kein Zyklus abgeschlossen ist | Der Satz stimmt auch dann: Ohne Abschluss ist alles der laufende Zyklus. Eine Unterscheidung wäre eine Bedingung, die niemand prüfen kann. |
| „wie viele archiviert werden und wie viele stehen bleiben" | Drei Zahlen: abgeschrieben, entfernt, geblieben | Ins Archiv kommt die **ganze** Liste; „archiviert" und „verlässt die Liste" sind verschiedene Zahlen, und eine davon zu verschweigen hätte den Dialog falsch gemacht. |
| — | Der Knopf im Dialog heißt „Jetzt abschließen", nicht wieder „Zyklus abschließen" | Zwei Knöpfe mit demselben Namen sind für Tastatur, Vorlesesoftware und Test nicht unterscheidbar. |

### Was ohne Test bleibt

- Die Verwaltungsseite rechnet die Grenze „gehört diese Zahlung zum laufenden Zyklus" selbst
  (ein Vergleich; das Datum kommt aus der Datenbank). Das ist eine zweite Stelle neben
  `barzahlung_bezahlt_laufend` — klein, kommentiert, aber eine zweite Stelle. Sie fällt auf,
  falls die Zuordnung je komplizierter wird als ein Datumsvergleich.

### Für den Betrieb

- **Vor dem Ausliefern** muss die Migration eingespielt sein. Die Verwaltungsseite
  „Barzahlungen" liest das Archiv und bricht ohne die Tabellen ab — bewusst, denn ein leeres
  Archiv und ein fehlendes Archiv sind nicht dasselbe.
- **Der erste Abschluss** legt den Anfang des ersten Zyklus auf den Tag der ältesten Zahlung,
  die an einem Eintrag der Liste hängt. Steht heute Geld auf der Liste, das älter ist als der
  Zyklus, den du abschließen willst, sieht der erste Zyklus länger aus als er war. Einmalig und
  nur im ersten Archiveintrag.

## Offene Frage aus der Umsetzung

- [ ] **Soll der Rest aus dem vorigen Zyklus auch dann dastehen, wenn der Eintrag nur wegen
      einer späten Zahlung stehen geblieben ist?** Der Fall: Jemand zahlt am 2. seinen Beitrag,
      der Zyklus endete am 31. Nach der Regel zählt sein Geld für den neuen Zyklus — und im
      alten bleibt sein Betrag offen stehen, also trägt seine Zeile danach „Aus dem Zyklus bis
      31.10. offen: 89 €". Richtig gerechnet (er hat im alten Zyklus nichts gezahlt), aber am
      häufigen Fall vielleicht lauter als nötig. Wir sehen es nach dem ersten echten Abschluss.

## QA (2026-11-05)

**Umgebung:** lokal gegen die Testdatenbank, beide Migrationen eingespielt. Browser: Chromium
und Mobile Safari (Playwright, eigener Server auf Port 3100).

| Prüfung | Ergebnis |
| --- | --- |
| `tests/PROJ-98-barzahlung-zyklen-db.test.ts` | **25/25** |
| `tests/PROJ-98-barzahlung-zyklen.spec.ts` | **10/10** (5 Fälle × 2 Browser) |
| `tests/PROJ-84-barzahlungs-eintraege-db.test.ts` + `PROJ-95-…-db` (Regression) | **40/40** |
| `tests/PROJ-84-barzahlungs-eintraege.spec.ts`, `PROJ-82`, `PROJ-95` (Browser-Regression) | im gemeinsamen Lauf **48/48** |
| Unit-Tests (`npm test` ohne Datenbankteil), `tsc`, `eslint`, `npm run build` | 1123/1123 · sauber · sauber · „Compiled successfully" |

**Alle 21 Kriterien haben einen Test.** Drei hatten zuerst keinen und wurden nachgeholt, statt
abgehakt zu werden:

- Der Abschnitt auf der **Kundenseite** war nur auf der Datenseite belegt
  (`get_cash_archive_entries` mit Kunde). Dazu gibt es jetzt einen Browsertest, der beides
  prüft: die Zyklen bei jemandem, der bar gezahlt hat, **und** das Fehlen des Abschnitts bei
  jemandem, der es nie getan hat.
- Das **Zukunftsdatum** war nur in der Datenbank abgewiesen. Der Dialog sagt jetzt geprüft
  „Dieser Zyklus läuft noch", und der Knopf ist dabei nachweislich gesperrt.

**Keine Befunde.** Der Datenbanktest stand beim ersten Lauf grün — ungewöhnlich für eine
Migration dieser Größe und erklärbar: Die Spalten von `returns table` wurden vor dem Übergeben
maschinell gegengezählt (Kopf gegen Auswahlliste, Zahl und Reihenfolge), und eine
Zweideutigkeit war vorher aufgefallen: In `get_cash_cycles` heißt eine Rückgabespalte `ends_on`,
und weil die Spalten des Rückgabetyps in PL/pgSQL gleichnamige Variablen sind, wäre
`order by ends_on` beim **Aufruf** mit „column reference is ambiguous" gescheitert — nicht beim
Einspielen. Dieselbe Familie wie der Fehler aus PROJ-95, eine Variante weiter.

**Was beim Einspielen auffiel:** Die Prüfung im Supabase-SQL-Editor meldete
„creates a table without enabling Row Level Security" für `cash_cycle_entries`, obwohl RLS in
der Migration eingeschaltet wird. Sie greift offenbar nur, wenn das Einschalten **unmittelbar**
hinter `create table` steht; zuerst standen dort die Indizes, dann ein Kommentar. Beides
entfernt, Reihenfolge jetzt wie bei `cash_cycles`. Nachgeprüft wurde die Wirkung dort, wo sie
zählt — `pg_class.relrowsecurity` und `pg_policies` für beide Tabellen: eingeschaltet, je eine
Regel.

**Urteil: produktionsreif.** Zwei Dinge gehören in dieser Reihenfolge ausgeliefert — erst die
Migration, dann der Code. Die Seite „Barzahlungen" liest das Archiv und bricht ohne die
Tabellen ab.

## Deployment (2026-11-06)

Ausgeliefert nach https://app.viennasalsastudio.at

| | |
| --- | --- |
| Commit | `0462175` feat(PROJ-98, PROJ-99) |
| Tag | `v1.98.0-PROJ-98` |
| Migration | `20261105160000_proj98_barzahlung_zyklen.sql` — vom Betreiber **vor** dem Push in der Produktion eingespielt |
| Build | „Compiled successfully in 12.5s“, 66 statische Seiten, keine Warnung |
| Deployment | `dpl_CwxK1JAJpvgx6wSZEbx357dXEAmY`, rund 60 Sekunden nach dem Push live |

Ein Commit für PROJ-98 und PROJ-99, weil dieselben Dateien beides tragen
(`types.ts`, `laden.ts`, die Übersicht, die Lehrerliste). Ein getrennter Commit hätte
`main` in einem Zustand hinterlassen, zu dem keine eingespielte Datenbank passt.

**Nach dem Deployment geprüft:** die öffentlichen Seiten (Start, Kurse, `/en`) antworten mit
200, `/admin/barzahlungen` und `/admin/kunden` leiten einen anonymen Aufruf auf die Anmeldung —
die Route existiert also und bewacht sich. Was ein anonymer Aufruf **nicht** zeigen kann, ist
das Archiv selbst: dafür braucht es die Anmeldung als Verwaltung. Dieser Klick bleibt beim
Betreiber.

## Für den Betrieb

- **Der erste Abschluss ist der, der zählt.** Das Enddatum bestimmt, welche Zahlungen noch zum
  alten Zyklus gehören. Ein zu früh gewähltes Datum lässt bereits bezahlte Einträge in der
  Liste stehen; ein zu spätes nimmt Zahlungen mit, die zum neuen Zyklus gehören sollten.
  Beides ist über „Zurücknehmen" reparierbar, solange danach nichts eingetragen wurde.
- **Zurücknehmen hat ein Zeitfenster.** Sobald nach dem Abschluss eine Zahlung oder ein
  Eintrag dazukommt, verweigert die Funktion die Rücknahme mit Begründung. Das ist Absicht:
  Sie würde sonst neuere Angaben überschreiben.
- **Der Hinweis „Aus dem Zyklus bis … offen"** erscheint auch bei jemandem, der nur wegen
  einer späten Zahlung in der Liste geblieben ist. Gerechnet ist das richtig, am häufigen Fall
  ist es womöglich lauter als nötig — siehe „Offene Frage aus der Umsetzung". Das entscheidet
  sich am ersten echten Abschluss besser als an jedem Test.
