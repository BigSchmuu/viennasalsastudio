# PROJ-88: Upgrade auf die Flatrate auch mit mehreren Kursabos

## Status: Deployed
**Created:** 2026-10-15
**Last Updated:** 2026-10-15

## Dependencies
- Erweitert: PROJ-87 (Upgrade auf die Flatrate) — dieselbe Anfrage, dieselbe Bestätigung
- Requires: PROJ-50/69 (`course_memberships`) — die Kurse der Flatrate
- Requires: PROJ-7/47 (Lastschriftlauf) — woraus sich „tatsächlich eingezogen" ablesen lässt
- Requires: PROJ-84 (Barzahlungen) — ein Barzahler hat keinen Einzug, aber bezahlt

## Anlass

PROJ-87 lässt nur upgraden, wer **genau ein** Kursabo hat. Wer zwei Kurse einzeln gebucht hat — also
gerade der Kunde, für den eine Flatrate sich lohnt — sieht den Knopf nicht. Und er sieht auch keinen
Hinweis: Die Bedingung blendet den Kasten aus, ohne etwas zu sagen. Das Akzeptanzkriterium aus
PROJ-87 („dann erscheint ein Hinweis, sich zu melden") ist unerfüllt geblieben; die QA hat „kein
Knopf" geprüft und den fehlenden Satz übersehen.

Der Betreiber kann das heute nur von Hand, in drei Schritten und mit einer Falle: Stellt er ein Abo
im Formular auf „Kein Kurs-Bezug", verliert der Kunde seinen Kursplatz — eine Flatrate trägt ihre
Kurse daneben.

## Das Modell

Unverändert aus PROJ-87: Der Kunde fragt an, der Betreiber bestätigt, die Flatrate gilt sofort, und
die Differenz reist im nächsten Lastschriftlauf mit.

Neu ist, was bei **mehreren** Kursabos passiert:

- Der Kunde fragt an der Karte an, an der er drückt. Dieses Abo wird die Flatrate — sein
  Zyklusbeginn bleibt, damit kein Einzug außer der Reihe entsteht.
- Die **anderen** aktiven Kursabos werden mit der Bestätigung beendet (gekündigt zum heutigen Tag).
- Aus **allen** betroffenen Kursen werden Kursplätze an der Flatrate. Der Kunde behält also beide
  Kurse und kann weitere hinzufügen.
- Die Differenz rechnet gegen das, was im laufenden Zyklus **tatsächlich bezahlt** wurde — nicht
  gegen die Summe der Listenpreise.

## „Tatsächlich bezahlt" — die Rechnung

Angerechnet wird je Abo, was in den letzten 28 Tagen für dieses Abo eingegangen ist:

- **Lastschrift:** die Beträge der Positionen, deren Lauf in diesem Zeitraum fällig war — **ohne**
  zurückgebuchte (`bounced_at` gesetzt). Geld, das zurückkam, ist nicht bezahlt.
- **Barzahlung:** die erfassten Barzahlungen desselben Zeitraums (PROJ-84). Ein Barzahler hat keinen
  Einzug, hat aber bezahlt — ihn den vollen Flatrate-Preis zahlen zu lassen wäre doppelt.

Die Differenz ist `Flatrate-Preis − angerechnete Summe`, mindestens null.

**Die Grenze dieser Rechnung, offen benannt:** Ferien verlängern einen Zyklus (PROJ-70). Liegt ein
Einzug deshalb mehr als 28 Tage zurück, obwohl er den laufenden Zyklus abdeckt, wird er **nicht**
angerechnet — der Kunde zahlt dann mehr. Deshalb zeigt die Bestätigung die Rechnung offen: je Abo
der angerechnete Betrag und der Tag, an dem er einging. Sieht es falsch aus, lehnt der Betreiber ab
und macht es von Hand.

## User Stories

- Als Schüler mit zwei Kursabos möchte ich auf die Flatrate wechseln können, ohne anzurufen.
- Als Schüler möchte ich vorher sehen, was angerechnet wird und was ich einmalig dazuzahle.
- Als Schüler möchte ich nach dem Wechsel **beide** Kurse behalten.
- Als Betreiber möchte ich beim Bestätigen sehen, welche Abos beendet werden und was ich anrechne.
- Als Betreiber möchte ich, dass ein Kunde, der gerade bar bezahlt hat, nicht doppelt zahlt.

## Out of Scope

- **Downgrade.** Unverändert gesperrt.
- **Anteilige Rechnung nach Tagen.** Angerechnet wird, was bezahlt wurde, nicht ein Bruchteil davon.
- **Mehrere Flatrates.** Wer schon eine hat, braucht kein Upgrade.
- **Die Ferienverlängerung in der Anrechnung.** Siehe oben: bewusst nicht hergeleitet, dafür
  sichtbar.
- **Ein Grund beim Ablehnen.** Wie in PROJ-87: ein Anruf, keine Textzeile.

## Acceptance Criteria

### Anfragen

- [ ] Angenommen ein Kunde hat zwei aktive Kursabos, wenn er seinen Bereich öffnet, dann steht an
      **jeder** Abo-Karte „Auf Flatrate upgraden".
- [ ] Angenommen er hat zwei Kursabos und im letzten Zyklus wurden 75 € und 60 € eingezogen, wenn er
      die Karte liest, dann steht dort der Flatrate-Preis und eine Differenz von
      `Preis − 135 €`, mindestens 0 €.
- [ ] Angenommen für eines seiner Abos wurde nichts eingezogen, dann wird dafür nichts angerechnet —
      und die Differenz ist entsprechend höher.
- [ ] Angenommen eine Zahlung wurde zurückgebucht, dann wird sie **nicht** angerechnet.
- [ ] Angenommen er hat bar bezahlt, dann wird die Barzahlung angerechnet wie ein Einzug.
- [ ] Angenommen er fragt an einer Karte an, dann ist die Anfrage an **diesem** Abo vermerkt, und die
      anderen bleiben unberührt.
- [ ] Angenommen er hat schon eine Flatrate oder für das Abo steht eine Änderung aus, dann erscheint
      kein Knopf, sondern der Grund.
- [ ] Angenommen in der Preisliste fehlt der Flatrate-Preis, dann erscheint der Grund statt des
      Knopfs.

### Bestätigen

- [ ] Angenommen eine Anfrage ist offen, wenn der Betreiber das Dashboard öffnet, dann sieht er die
      Abos, die beendet werden, die angerechneten Beträge mit ihrem Eingangstag und die Differenz.
- [ ] Angenommen er bestätigt, dann trägt das angefragte Abo keinen Kurs mehr, heißt „Flatrate" und
      kostet den gewählten Tarif; sein `cycle_anchor_date` bleibt.
- [ ] Angenommen er bestätigt, dann sind die anderen aktiven Kursabos gekündigt — mit dem heutigen
      Tag als `cancelled_at`.
- [ ] Angenommen er bestätigt, dann gibt es für **jeden** betroffenen Kurs einen Kursplatz ab heute.
- [ ] Angenommen er bestätigt, dann ist genau ein Aufschlag über `Preis − angerechnet` festgehalten —
      und keiner, wenn das Ergebnis null oder kleiner ist.
- [ ] Angenommen ein Kunde ruft die Bestätigung selbst auf, dann wird er abgewiesen.

## Edge Cases

- **Unterschiedliche Zyklen.** Der häufigste Grund für eine ungleiche Anrechnung. Sichtbar in der
  Bestätigung, nicht hergeleitet.
- **Drei oder mehr Kursabos.** Dieselbe Rechnung; alle außer dem angefragten werden beendet.
- **Ein Abo ohne Preis.** Es wird beendet wie die anderen; angerechnet wird, was eingegangen ist,
  nicht der fehlende Listenpreis.
- **Ein Kurs ist ausgelaufen** (PROJ-51). Der Kursplatz entsteht trotzdem und endet mit dem Kurs.
- **Zwei Anfragen an zwei Karten.** Die Markierung sitzt je Abo; der Betreiber bestätigt eine, und
  die Bedingung für die andere entfällt damit von selbst (es gibt dann eine Flatrate).
- **Barzahler ohne Mandat.** Sein Aufschlag kommt in keinen Lauf und steht in der
  Barzahler-Übersicht (PROJ-87).

## Decision Log

### Product Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Auch mit mehreren Kursabos anfragen dürfen (Variante B) | Vom Betreiber gewählt. Gerade wer zwei Kurse einzeln bucht, ist der Kunde für eine Flatrate — ihn anrufen zu lassen verliert genau das Geschäft, um das es geht. Die Geldentscheidung bleibt bei der Bestätigung. | 2026-10-15 |
| Angerechnet wird das tatsächlich Bezahlte, nicht die Summe der Listenpreise | Vom Betreiber gewählt. Ein Beitrag, der nie eingezogen wurde, ist nicht bezahlt — ihn anzurechnen wäre ein Geschenk, das niemand beschlossen hat. | 2026-10-15 |
| Barzahlungen zählen wie Einzüge | Meine Auslegung von „tatsächlich eingezogen": Ein Barzahler hat kein Mandat und damit keinen Einzug, aber er hat bezahlt. Ohne diese Zeile zahlte er den vollen Flatrate-Preis obendrauf. | 2026-10-15 |
| Zurückgebuchte Einzüge zählen nicht | Geld, das zurückkam, ist nicht bezahlt. Der offene Posten bleibt daneben bestehen (PROJ-37). | 2026-10-15 |
| 28 Tage als Fenster, ohne Ferienverlängerung | Eine Tagesrechnung über die Ferienliste wäre für den Kunden nicht nachprüfbar. Die Ungenauigkeit geht zu Lasten des Kunden und ist deshalb sichtbar zu machen, nicht zu verstecken: Die Bestätigung zeigt je Abo, was angerechnet wird und wann es einging. | 2026-10-15 |
| Das angefragte Abo wird die Flatrate | Der Kunde drückt an einer bestimmten Karte; diese Wahl zu übergehen wäre überraschend. Nebeneffekt: Sein Zyklus bleibt, und es entsteht kein Einzug außer der Reihe. | 2026-10-15 |
| Die anderen Abos werden gekündigt, nicht gelöscht | `cancelled_at` ist die dauerhafte Spur, über die die Auswertung zählt (PROJ-79/80). Ein gelöschtes Abo nähme seine Zahlungen mit (`on delete cascade`). | 2026-10-15 |

### Technical Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Eine Funktion `flatrate_upgrade_angerechnet(kunde)` | Dieselbe Zahl braucht der Kundenbereich, die Dashboard-Karte und die Bestätigung. Drei Rechnungen würden driften — dieselbe Begründung wie bei `flatrate_upgrade_moeglich`. | 2026-10-15 |
| Die „genau ein Abo"-Bedingung fällt, die übrigen bleiben | Aktiv, kursgebunden, keine ausstehende Änderung, keine Flatrate, Preis gepflegt — daran ändert sich nichts. | 2026-10-15 |
| Der fehlende Hinweis aus PROJ-87 wird hier mitgebaut | Er ist dasselbe Thema: Warum sehe ich den Knopf nicht. Nach dem Wegfall der Abo-Zahl bleiben drei Gründe, und die gehören benannt. | 2026-10-15 |

## Umsetzung und QA (2026-10-15)

### Datenbank — `20261015230000_proj88_upgrade_mehrere_abos.sql`

- `flatrate_upgrade_anrechnung(kunde)` — die Aufstellung: Einzüge ohne Rückbuchung und Barzahlungen
  der letzten 28 Tage, je Zeile mit Betrag, Tag und Art. Geschützt: eigene Zeilen oder Verwaltung.
- `flatrate_upgrade_angerechnet(kunde)` — die Summe **aus derselben Quelle**, damit nichts driftet.
- `flatrate_upgrade_moeglich` — ohne die Abo-Zahl; alles andere bleibt.
- `confirm_flatrate_upgrade` — legt die Kursplätze **aller** aktiven Kursabos an, beendet die
  anderen Abos (gekündigt, mit `cancelled_at`), rechnet die Differenz gegen das Bezahlte.

### Anwendung

- Kundenbereich: die Differenz kommt aus der Datenbank, nicht aus dem Preis der einzelnen Karte.
- **Der fehlende Hinweis aus PROJ-87 ist nachgebaut:** drei benannte Gründe — bestehende Flatrate,
  ausstehende Änderung, fehlender Preis — zweisprachig.
- Dashboard: die Aufstellung offen hingeschrieben („angerechnet: 75,00 € — Salsa Mittwoch, Einzug vom
  05.10.2026“), dazu welche Abos enden; kam nichts herein, steht dort ein Warnsatz.

| Prüfung | Umfang | Ergebnis |
|---|---|---|
| Voller Vitest-Lauf | 1275 | grün |
| Datenbank — PROJ-87/88 | 30 (9 neu) | grün |
| Browser — PROJ-87 | 4 | grün |
| Regression — PROJ-9, PROJ-50 | 38 | grün |

### Was belegt ist

- Mit zwei Kursabos ist das Upgrade möglich; angerechnet wird nur, was einging.
- Eine **zurückgebuchte** Lastschrift wird nicht angerechnet, eine **Barzahlung** schon.
- Ein Einzug **außerhalb** der 28 Tage wird nicht angerechnet — die bekannte Ungenauigkeit, als
  Prüfung festgehalten statt verschwiegen.
- Beim Bestätigen entstehen Kursplätze für **beide** Kurse, das zweite Abo ist **gekündigt** (mit
  `cancelled_at`), nicht gelöscht, und der Aufschlag ist Preis minus Summe beider Einzüge.
- Die Aufstellung eines fremden Kunden ist nicht lesbar.

### Was beim Prüfen angepasst werden musste

- Vier PROJ-87-Prüfungen rechneten noch gegen den **Abo-Preis**. Das ist die abgelöste Regel; sie
  rechnen jetzt gegen den Einzug des Zyklus. Eine Prüfung („kein zweites Kursabo daneben“) ist
  ersatzlos weg — sie prüfte die Bedingung, die dieses Feature aufhebt.
- Drei Fehler in den eigenen Helfern: ein `catch(() => {})` ließ ein Testkonto stehen (jetzt wird
  der Löschfehler geprüft und alles Verweisende vorher abgeräumt), zwei Einzüge am selben Tag
  löschten sich gegenseitig den Lauf, und ein monatsweise gezählter Fälligkeitstag ergab
  „2027-14-15“.
- Im Browsertest stand noch das Aufräumen aus der Zeit, als er einen echten Lauf anlegte — es
  löschte genau den Einzug, gegen den gerechnet wird.

### Produktionsreife

**JA** — keine kritischen oder hohen Fehler offen.

## Open Questions

- [ ] Soll der Kunde sehen, **welche** Abos beendet werden, bevor er anfragt? Vorerst nein: Er fragt
      „alle Kurse statt zwei" an, und was im Hintergrund zusammengelegt wird, ist eine
      Verwaltungsfrage. Der Betreiber sieht es.

## Deployment

- **Ausgeliefert:** 2026-10-15
- **Produktion:** https://app.viennasalsastudio.at
- **Commit:** `2fa54c6`, Tag `v1.88.0-PROJ-88`
- **Migration:** `20261015230000_proj88_upgrade_mehrere_abos.sql` — vor dem Deploy in Test und
  Produktion eingespielt. Nötig in dieser Reihenfolge: Die Anwendung ruft `flatrate_upgrade_angerechnet`
  und `flatrate_upgrade_anrechnung` auf.
- **Nachgesehen:** Vercel-Deployment `Ready`; Startseite 200, `/profil` und `/admin` 307.

### Für den Betrieb

- **Der Knopf steht jetzt an jeder Abo-Karte**, auch wenn jemand zwei Kurse einzeln zahlt. Welche
  Karte er drückt, entscheidet, welches Abo die Flatrate wird — der Zyklus dieses Abos bleibt.
- **Vor dem Bestätigen steht die Rechnung da:** was angerechnet wird, wann es einging, und welche
  Abos enden. Kam im laufenden Zyklus nichts herein, steht dort ein Warnsatz — dann kommt die ganze
  Differenz dazu, und das ist meist der Moment, erst einmal nachzufragen.
- **Ferienzyklen:** Liegt ein Einzug mehr als 28 Tage zurück, weil Ferien den Zyklus verlängert
  haben, wird er nicht angerechnet — der Kunde zahlte dann zu viel. Deshalb die Aufstellung lesen,
  bevor du bestätigst; im Zweifel ablehnen und von Hand umstellen.
- **Fehlt der Kasten beim Kunden**, nennt die Seite jetzt den Grund. Der häufigste wird „ausstehende
  Pause oder Kündigung“ sein.

## Nachtrag (2026-10-16): Ein Entwurfslauf zählte als bezahlt

**Der Fehler.** `flatrate_upgrade_anrechnung` verband die Positionen mit ihrem Lauf, ohne zu fragen,
ob der Lauf **freigegeben** ist. Ein vorbereiteter Entwurf — angelegt, aber nicht bei der Bank
hochgeladen — zählte damit als bezahlt. Der Kunde sah eine zu kleine Differenz, und der Betreiber
hätte Geld angerechnet, das nie geflossen ist.

**Wie er auffiel.** Nicht durch einen Test, sondern am ersten echten Fall: eine Kundin mit zwei Abos
über je 65 €, für die noch **nichts** eingezogen war — und die Karte bot „145 € (+80 €)" an. 80
statt 145 heißt: genau ein Beitrag war angerechnet. Die Frage des Betreibers („ist das in der
Anfrage noch korrekt?") war die Fehlermeldung.

**Behoben** in `20261016090000_proj88_nur_freigegebene_einzuege.sql`: `and r.released_at is not
null`. `released_at` ist auch sonst die Grenze, ab der ein Lauf Geld bedeutet — erst damit entstehen
die Rechnungen und gehen die Ankündigungen raus (PROJ-47, PROJ-61).

**Festgehalten** durch eine Prüfung: Position in einem nicht freigegebenen Lauf → angerechnet wird
null. Beim Schreiben fiel auf, dass der Testhelfer den Lauf erst freigab und dann die Position
einfügen wollte — was der Wächter aus PROJ-47 zu Recht verbietet. Jetzt: Entwurf, Position,
Freigabe.

**Was offen bleibt.** Stimmt die gerechnete Zahl nicht, kann der Betreiber sie nirgends korrigieren;
„dann von Hand" heißt drei Schritte mit der Kursplatz-Falle. Bei mehreren Abos mit verschiedenen
Zyklen kommt das vor. Ein überschreibbares Feld bei der Bestätigung steht als Vorschlag offen.
