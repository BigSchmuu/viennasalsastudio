# PROJ-87: Upgrade auf die Flatrate (Selbstbedienung, mit Bestätigung)

## Status: Deployed
**Created:** 2026-10-15
**Last Updated:** 2026-10-15

## Dependencies
- Requires: PROJ-9 (Abo-Selbstbedienung) — der Ort, an dem der Kunde sein Abo verwaltet
- Requires: PROJ-41 (Preisliste) — `flatrate_price` und `flatrate_student_price`
- Requires: PROJ-50/69 (`course_memberships`) — eine Flatrate trägt ihre Kurse daneben
- Requires: PROJ-7/47 (Lastschriftlauf) — der Aufschlag reist im nächsten Lauf mit
- Requires: PROJ-44 (Guthaben) — dieselbe Stelle im Lauf, dieselbe Zeile auf der Rechnung
- Requires: PROJ-16 (Benachrichtigungen) — der Kunde erfährt von der Bestätigung
- Berührt: PROJ-39 (Zähler im Menü) — offene Anfragen wollen gesehen werden

## Anlass

Ein Kunde mit einem Kursabo, der mehr tanzen will, muss heute anrufen oder schreiben. Der Betreiber
legt dann von Hand ein Abo ohne Kurs an, löscht das alte, trägt den Kursplatz nach — und die
Differenz für den laufenden Zyklus bleibt entweder liegen oder wird vergessen.

Umgekehrt soll es **nicht** gehen: Von der Flatrate zurück auf ein einzelnes Kursabo ist keine
Selbstbedienung. Das ist keine technische Einschränkung, sondern eine Entscheidung — ein Downgrade
ist eine Vertragsänderung nach unten und gehört in ein Gespräch.

## Der Vorgang

1. Der Kunde sieht in seinem Bereich am Kursabo **„Auf Flatrate upgraden"**, mit dem Preis und dem
   Hinweis, dass die Differenz für den laufenden Zyklus einmalig dazukommt.
2. Er fragt an. Sein Abo bleibt unberührt; die Anfrage ist eine Markierung daran.
3. Der Betreiber sieht die offene Anfrage, wählt **Normal- oder Studierendentarif** und bestätigt.
4. Mit der Bestätigung gilt die Flatrate **sofort**: Das Abo verliert seinen Kurs, bekommt den
   Flatrate-Preis, und der bisherige Kurs steht ab heute als Kursplatz daneben. Weitere Kurse fügt
   der Kunde selbst hinzu (PROJ-50).
5. Die **Differenz** zum bisherigen Beitrag wird als einmaliger Aufschlag festgehalten und reist im
   nächsten Lastschriftlauf mit — auf der Rechnung als eigener Satz hinter dem Abo-Namen.

Der Zyklus läuft weiter wie bisher: Derselbe Zyklusbeginn, derselbe Rhythmus, kein Einzug außer der
Reihe.

## User Stories

- Als Schüler möchte ich mein Kursabo selbst auf die Flatrate umstellen können, ohne anzurufen.
- Als Schüler möchte ich vorher wissen, was es kostet — laufend und einmalig.
- Als Schüler möchte ich erfahren, wenn mein Upgrade bestätigt ist.
- Als Schüler möchte ich eine Anfrage zurückziehen können, solange sie offen ist.
- Als Betreiber möchte ich jede Anfrage sehen und bestätigen oder ablehnen.
- Als Betreiber möchte ich beim Bestätigen den Tarif wählen — normal oder Studierende.
- Als Betreiber möchte ich, dass die Differenz für den laufenden Zyklus nicht verloren geht.

## Out of Scope

- **Downgrade.** Von der Flatrate zurück auf ein Kursabo gibt es keine Selbstbedienung. Die
  Datenbank sperrt das schon heute: `self_switch_subscription_course` verlangt `course_id is not
  null`, eine Flatrate lässt sich damit nicht in einen Kurs zurückwechseln. Der Betreiber kann es
  von Hand, wie bisher.
- **Anteilige Differenz.** Ein Zyklus, ein Preis. Wer spät im Zyklus wechselt, zahlt die ganze
  Differenz — wer das nicht will, bestätigt erst zum Fälligkeitstag.
- **Ein Einzug außer der Reihe.** Der Aufschlag wartet auf den nächsten Lauf. Mitten im Zyklus
  abzubuchen gibt es in dieser App nicht, und dafür ist das hier kein Anlass.
- **Mehrere Kursabos zusammenführen.** Wer zwei aktive Kursabos hat, bekommt den Knopf nicht, sondern
  einen Hinweis. Zwei Abos zu einem zu verschmelzen ist eine Entscheidung über Geld, die niemand
  nebenbei treffen soll.
- **Ein dauerhaftes Studierenden-Merkmal am Kunden.** Gibt es nicht und entsteht hier nicht; der
  Tarif wird bei der Bestätigung gewählt.
- **Den Preis frei eingeben.** Bei der Bestätigung gibt es die beiden Listenpreise, keinen Textfeld.
  Eine Sonderabsprache trägt der Betreiber danach am Abo ein, wo er es immer tut.
- **Upgrade während einer geplanten Änderung.** Wer pausiert oder gekündigt hat, kann nicht upgraden,
  solange die Änderung aussteht.

## Acceptance Criteria

### Anfragen

- [ ] Angenommen ein Kunde hat genau ein aktives, kursgebundenes Abo und die Flatrate hat einen
      Preis, wenn er seinen Bereich öffnet, dann steht dort „Auf Flatrate upgraden" mit dem
      Flatrate-Preis und der einmaligen Differenz.
- [ ] Angenommen er drückt den Knopf, dann ist die Anfrage festgehalten, sein Abo **unverändert**,
      und er sieht „Anfrage läuft" samt der Möglichkeit, sie zurückzuziehen.
- [ ] Angenommen eine Anfrage läuft, wenn er sie zurückzieht, dann ist sie weg und der Knopf steht
      wieder da.
- [ ] Angenommen er hat schon eine Flatrate, dann erscheint der Knopf nicht.
- [ ] Angenommen er hat zwei aktive Kursabos, dann erscheint statt des Knopfs ein Hinweis, sich zu
      melden.
- [ ] Angenommen für sein Abo steht eine Pause oder Kündigung aus, dann erscheint der Knopf nicht,
      sondern der Grund.
- [ ] Angenommen in der Preisliste fehlt der Flatrate-Preis, dann erscheint der Knopf nicht — und der
      Betreiber sieht in der Verwaltung, dass der Preis fehlt.

### Bestätigen

- [ ] Angenommen eine Anfrage ist offen, wenn der Betreiber das Dashboard öffnet, dann steht sie dort
      mit Name, bisherigem Beitrag, beiden Flatrate-Preisen und der jeweiligen Differenz.
- [ ] Angenommen er bestätigt mit dem Normaltarif, dann trägt das Abo keinen Kurs mehr, heißt
      „Flatrate", kostet den Normalpreis, und der bisherige Kurs steht ab heute als Kursplatz daneben.
- [ ] Angenommen er bestätigt mit dem Studierendentarif, dann gilt derselbe Vorgang mit diesem Preis.
- [ ] Angenommen er bestätigt, dann ist ein Aufschlag über die Differenz festgehalten — und zwar
      genau einer.
- [ ] Angenommen die Flatrate ist nicht teurer als das bisherige Abo, dann entsteht **kein**
      Aufschlag.
- [ ] Angenommen er bestätigt, dann bleibt `cycle_anchor_date` unverändert — es entsteht kein Einzug
      außer der Reihe.
- [ ] Angenommen er bestätigt, dann wird der Kunde benachrichtigt.
- [ ] Angenommen er lehnt ab, dann ist die Anfrage weg, das Abo unverändert, und der Kunde
      benachrichtigt.
- [ ] Angenommen ein Kunde ruft die Bestätigung selbst auf, dann wird er abgewiesen.

### Abrechnen

- [ ] Angenommen ein Aufschlag ist offen, wenn der Betreiber einen Lastschriftlauf anlegt, dann ist
      er auf die Position dieses Abos aufgeschlagen.
- [ ] Angenommen ein Aufschlag ist in einem Lauf berücksichtigt, wenn derselbe Lauf noch einmal
      angelegt wird, dann wird er **nicht** zweimal gezählt.
- [ ] Angenommen ein Entwurf wird verworfen, dann ist der Aufschlag wieder offen und kommt in den
      nächsten Lauf.
- [ ] Angenommen für eine Position wurde ein Aufschlag berücksichtigt, wenn die Rechnung entsteht,
      dann steht die Differenz als eigener Satz in der Beschreibung — wie das verrechnete Guthaben
      bei PROJ-44.
- [ ] Angenommen ein Kunde hat Guthaben und einen Aufschlag, dann wird zuerst aufgeschlagen und dann
      Guthaben verrechnet — das Guthaben mindert also auch die Differenz.

## Edge Cases

- **Zwei Anfragen gleichzeitig.** Die Markierung sitzt am Abo; eine zweite Anfrage überschreibt
  nichts und legt nichts doppelt an.
- **Der Kunde kündigt, während die Anfrage offen ist.** Die Kündigung gewinnt: Die Anfrage verfällt
  mit ihr, und der Betreiber sieht sie nicht mehr.
- **Das Abo wird pausiert, während die Anfrage offen ist.** Ebenso — bestätigen lässt sich nur ein
  aktives, kursgebundenes Abo.
- **Der Kurs des bisherigen Abos ist ausgelaufen** (PROJ-51). Der Kursplatz entsteht trotzdem; er
  endet mit dem Kurs wie jeder andere.
- **Die Kursgrenze.** Der Platz ersetzt den, den das Kursabo belegt hat — die Belegung bleibt gleich,
  deshalb wird hier nichts gegen `max_participants` geprüft.
- **Kündigung, bevor der Aufschlag abgerechnet ist.** Der Lauf nimmt ein Abo nicht mit, dessen
  Änderung zum Fälligkeitstag wirkt (`pending_effective_date > due_date`) — ohne Position gäbe es
  nichts, woran der Aufschlag hängen könnte. Deshalb legt `apply_surcharges_to_run` in diesem Fall
  eine **eigene Position über genau den Aufschlag** an. Dasselbe gilt, wenn der Beitrag in diesem
  Lauf schlicht nicht fällig ist (PROJ-70). Wer kein Mandat hat, bekommt keine Position; sein
  Aufschlag bleibt offen und steht in der Barzahler-Übersicht.
- **Der Aufschlag und eine Rücklastschrift.** Platzt der Einzug, ist die Rechnung ein offener Posten
  wie jede andere (PROJ-37); der Aufschlag steckt darin und wird nicht zweimal erhoben.
- **Barzahler ohne Mandat.** Sie kommen in keinen Lastschriftlauf, der Aufschlag bliebe also ewig
  offen. Deshalb erscheint er für sie in der Barzahler-Übersicht als Hinweis am Eintrag, statt still
  liegen zu bleiben.

## Decision Log

### Product Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Anfrage mit Bestätigung, nicht automatisch | Vom Betreiber gewählt. Ein Upgrade ändert den Beitrag, und über Geld entscheidet er selbst — dieselbe Haltung wie bei den Barzahlern (PROJ-84). | 2026-10-15 |
| Die Flatrate gilt sofort mit der Bestätigung | Vom Betreiber gewählt. Wer bestätigt, hat entschieden; den Zeitpunkt steuert er, indem er früher oder später bestätigt. Eine zweite Terminlogik im Abo wäre ein Feld, das niemand pflegen will. | 2026-10-15 |
| Die ganze Differenz des laufenden Zyklus, nicht anteilig | Vom Betreiber gewählt: ein Zyklus, ein Preis. Eine Tagesrechnung hinge zusätzlich an der Ferienliste und wäre für den Kunden nicht nachprüfbar. | 2026-10-15 |
| Der Kunde sieht den Normalpreis plus Hinweis auf den Studierendentarif | Vom Betreiber gewählt. Den Tarif aus dem bisherigen Beitrag zu erraten geht daneben, sobald ein Preis von Hand abweicht — und dann stünde beim Kunden eine Zahl, die der Betreiber nicht bestätigen will. | 2026-10-15 |
| Kein Downgrade in der Selbstbedienung | Vom Betreiber vorgegeben. Nach unten ist eine Vertragsänderung und gehört in ein Gespräch. | 2026-10-15 |
| Kein Knopf bei mehreren Kursabos | Zwei Abos zu einem zu verschmelzen ist eine Geldentscheidung; ein Hinweis ist ehrlicher als eine Automatik, die einen Beitrag stillschweigend kassiert oder verliert. | 2026-10-15 |

### Technical Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Die Anfrage ist eine Spalte am Abo (`upgrade_requested_at`), keine eigene Tabelle | Es gibt genau zwei Zustände — offen oder nicht — und die Spur des Vorgangs steckt danach im Aufschlag und am Abo selbst. Eine Tabelle mit Status-Feld wäre Verwaltung ohne Erkenntnis. | 2026-10-15 |
| Dasselbe Abo wird umgestellt, kein neues angelegt | `cycle_anchor_date` bleibt und damit der Rhythmus. Ein neues Abo hätte keinen Einzug in der Vergangenheit und wäre nach PROJ-70 **sofort fällig** — der Kunde bekäme unerwartet eine Abbuchung. | 2026-10-15 |
| Eigene Tabelle für den Aufschlag (`subscription_surcharges`) | Geld braucht eine Zeile, die man lesen kann: wer, wie viel, warum, und in welchem Lauf er gelandet ist. | 2026-10-15 |
| Die Verbindung zur Laufposition hängt mit `on delete set null` | Ein verworfener Entwurf löscht seine Positionen, und damit wird der Aufschlag von selbst wieder offen. Kein Rückabwicklungspfad, der eigene Fehler mitbringt — anders als bei der Guthabenverrechnung, die genau dafür eine zweite Funktion braucht. | 2026-10-15 |
| Der Aufschlag bekommt eine eigene Position, wenn das Abo nicht im Lauf ist | Sonst fällt er lautlos weg, sobald jemand zum nächsten Fälligkeitstag kündigt — und der Hinweis in der Barzahler-Übersicht greift nicht, weil der Kunde ein Mandat hat. Aufgefallen durch die Frage des Betreibers, nicht durch einen Test. | 2026-10-15 |
| Erst aufschlagen, dann Guthaben verrechnen | Sonst mindert Guthaben nur den Abo-Preis, und die Differenz bliebe unberührt stehen — was niemand erklären könnte. | 2026-10-15 |
| Die Rechnung nennt die Differenz in der Beschreibung | Dieselbe Stelle und derselbe Satzbau wie das verrechnete Guthaben (PROJ-44). Rechnungen haben hier eine Beschreibung und einen Betrag, keine Positionen. | 2026-10-15 |
| Neuer Benachrichtigungs-Anlass `abo_upgrade` | `notification_queue.event_type` hat eine CHECK-Liste; ohne Migration scheitert das Einreihen lautlos. | 2026-10-15 |

## Umsetzung und QA (2026-10-15)

### Datenbank

`20261015160000_proj87_upgrade_auf_flatrate.sql` und die Nachträge
`20261015190000_proj87_aufschlaege_im_lauf.sql` und
`20261015210000_proj87_aufschlag_auch_ohne_beitrag.sql`:

- `subscriptions.upgrade_requested_at` — die Anfrage als Markierung am Abo.
- `subscription_surcharges` — der einmalige Aufschlag, `collection_item_id` mit `on delete set
  null`; offen heißt „noch keine Position“.
- `flatrate_upgrade_moeglich` — die Voraussetzungen an einer Stelle, von drei Seiten gefragt.
- `request_` / `withdraw_` (Kunde) und `confirm_` / `decline_flatrate_upgrade` (Verwaltung).
- `apply_surcharges_to_run` — legt die Aufschläge auf die Positionen **in der Datenbank**.
- `create_invoices_for_collection_run` nennt die Differenz in der Beschreibung.
- CHECK-Liste `notification_queue.event_type` um `abo_upgrade` erweitert.

### Anwendung

- Kundenbereich: Knopf samt Preis und Differenz, zweisprachig; „Anfrage zurückziehen“ solange sie
  offen ist.
- Dashboard: Karte **Upgrade auf Flatrate** mit beiden Tarifen als Knopf, jeweils mit der Differenz.
- Lastschriftlauf: Aufschläge **vor** der Guthabenverrechnung; danach werden die Beträge neu
  gelesen, damit Guthaben gegen den gewachsenen Betrag verrechnet.
- Barzahler-Übersicht: Hinweis auf Aufschläge von Leuten ohne Mandat — die kommen in keinen Lauf.
- Benachrichtigung in beiden Sprachen, über die Textverwaltung änderbar (PROJ-34).

| Prüfung | Umfang | Ergebnis |
|---|---|---|
| Voller Vitest-Lauf | 1263 | grün |
| Datenbank — `PROJ-87-upgrade-flatrate-db.test.ts` | 22 | grün |
| Browser — `PROJ-87-upgrade-flatrate.spec.ts` | 4 | grün |
| Regression — PROJ-9, PROJ-47, PROJ-44, PROJ-84 | 37 | grün |

### Was belegt ist

- Die Anfrage lässt das Abo unberührt: Kurs, Preis und Zyklusbeginn bleiben, nur die Markierung ist
  da. Ein fremdes Abo lässt sich nicht anfragen.
- Kein Knopf bei zwei Kursabos, bei ausstehender Änderung, bei bestehender Flatrate.
- Die Bestätigung stellt um, legt den Kursplatz **ab heute** daneben und lässt
  `cycle_anchor_date` unberührt — kein Einzug außer der Reihe.
- Genau **ein** Aufschlag über die ganze Differenz; keiner, wenn die Flatrate nicht teurer ist.
- Der Studierendentarif greift, wenn er gewählt ist. Ein Kunde kann nicht selbst bestätigen.
- Der nächste Lauf schlägt die Differenz auf **und stempelt sie** — ein zweiter Lauf nimmt sie
  nicht noch einmal mit. Auf der Rechnung steht „zzgl. … € Upgrade-Differenz“, und der Bruttobetrag
  stimmt mit der Position überein.
- Zurück geht es nicht: `self_switch_subscription_course` weist die Flatrate ab.
- Ein Kunde liest seinen Aufschlag, einen fremden nicht.

### Was beim Prüfen gefunden wurde

- **Die CHECK-Liste der Benachrichtigungsarten war aus einer alten Migration abgeschrieben** und
  hätte zwölf Arten stillschweigend verboten — jede Benachrichtigung dieser Art wäre beim
  Einreihen gescheitert. Gefunden von `src/lib/constants/notifications.test.ts`.
- **Der Stempel auf dem Aufschlag traf null Zeilen.** Betrag und Stempel kamen aus der Anwendung;
  `subscription_surcharges` hat nur eine Leseregel, und PostgREST meldet eine Änderung ohne Treffer
  nicht als Fehler. Der Aufschlag wäre offen geblieben und beim nächsten Lauf ein zweites Mal
  gekommen. Behoben mit `apply_surcharges_to_run` (Nachtrags-Migration).
- **Ein Aufschlag wäre lautlos weggefallen**, wenn der Kunde zum nächsten Fälligkeitstag kündigt:
  Der Lauf nimmt das Abo dann nicht mit, es gab keine Position, der Aufschlag blieb offen — und das
  Abo kam danach in keinen Lauf mehr. Aufgefallen durch die Frage des Betreibers („wird die Differenz
  dennoch abgebucht?“). Behoben in `20261015210000_proj87_aufschlag_auch_ohne_beitrag.sql`: eine
  eigene Position über den Aufschlag, aber nur mit gültigem Mandat.
- Der eigene Datenbanktest räumte das Abo auf, ohne vorher die Laufpositionen zu löschen — der
  Fremdschlüssel verhinderte das Löschen, und der **nicht geprüfte Fehler** ließ ein zweites,
  altes Abo stehen. Damit war kein Upgrade mehr möglich, und zwei Prüfungen wurden rot, ohne dass
  die Ursache am Ergebnis zu sehen war. Dieselbe Lehre wie in `.claude/rules/backend.md`, diesmal im
  Test.
- Der eigene Browsertest war nicht wiederholbar: Ein eingezogener Beitrag ist im selben Zyklus nicht
  mehr fällig (PROJ-70), also kam der zweite Lauf ohne Position zurück. Jetzt räumt der Test seine
  Einzüge vorher weg und sucht sich einen freien Fälligkeitstag.

### Nicht geprüft

- Der **Volllauf** über alle Browser — nach der Bündelregel erst nach dem nächsten Feature-Bündel.

### Produktionsreife

**JA** — keine kritischen oder hohen Fehler offen.

## Open Questions

- [ ] Soll der Betreiber beim Ablehnen einen Grund mitgeben können, der beim Kunden ankommt? Vorerst
      nicht — eine Ablehnung dürfte ein Anruf sein, nicht eine Textzeile.
- [ ] Braucht der Aufschlag eine eigene Übersicht in der Verwaltung („was ist noch nicht
      abgerechnet")? Vorerst nicht: Er steht am Kunden und landet im nächsten Lauf. Sichtbar wird er
      nötig, sobald jemand ohne Mandat einen Aufschlag hat.

## Deployment

- **Ausgeliefert:** 2026-10-15
- **Produktion:** https://app.viennasalsastudio.at
- **Commit:** `5936f69`, Tag `v1.87.0-PROJ-87`
- **Migrationen**, in dieser Reihenfolge vor dem Deploy in Test und Produktion eingespielt:
  1. `20261015160000_proj87_upgrade_auf_flatrate.sql` — Spalte, Tabelle, die fünf Funktionen, die
     Rechnung, die CHECK-Liste.
  2. `20261015190000_proj87_aufschlaege_im_lauf.sql` — `apply_surcharges_to_run`, weil der Stempel
     aus der Anwendung null Zeilen traf.
  3. `20261015210000_proj87_aufschlag_auch_ohne_beitrag.sql` — eigene Position für den Aufschlag,
     wenn das Abo nicht im Lauf ist.
- **Nachgesehen:** Vercel-Deployment `Ready`; Startseite 200, `/profil` und `/admin` antworten mit
  307 auf die Anmeldung.

### Für den Betrieb

- **Der Knopf erscheint nur**, wenn der Kunde genau ein aktives Kursabo hat, keine Pause oder
  Kündigung aussteht, er noch keine Flatrate hat — und wenn in der Preisliste ein Flatrate-Preis
  steht. Fehlt der Preis, sagt die Karte im Dashboard das.
- **Die Anfragen stehen im Dashboard**, über den Kennzahlen. Beide Tarife sind je ein Knopf, mit der
  Differenz daneben.
- **Mit der Bestätigung gilt die Flatrate sofort.** Willst du, dass sie erst zum Fälligkeitstag
  gilt, bestätige erst dann — den Zeitpunkt steuerst du so ohne zweites Feld.
- **Der Aufschlag kommt in den nächsten Lauf**, auch wenn der Beitrag selbst nicht fällig ist oder
  der Kunde gekündigt hat. Wer **kein Mandat** hat, bekommt keine Lastschrift — sein Aufschlag steht
  unter Barzahlungen und wird dort eingesammelt.
- **Sonderabsprachen** trägst du wie bisher nach der Bestätigung am Abo ein.
