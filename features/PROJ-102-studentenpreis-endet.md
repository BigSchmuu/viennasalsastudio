# PROJ-102: Der Studierendenpreis endet mit 28 — angekündigt, nicht überraschend

## Status: Approved
**Created:** 2026-11-16
**Last Updated:** 2026-11-16

## Dependencies
- Requires: PROJ-101 (Geburtsdatum Pflicht) — ohne Geburtsdatum keine Altersregel
- Requires: PROJ-9 (Abo-Selbstverwaltung) — `next_cycle_end`, Kündigung zum Zyklusende
- Requires: PROJ-41 (`resolve_plan_price`) — der Normalpreis kommt aus derselben Funktion
- Requires: PROJ-16 (Benachrichtigungen) — die Ankündigung läuft über die Warteschlange
- Requires: PROJ-34 (Benachrichtigungs-Texte) — der Text ist pflegbar, nicht einbetoniert

## Anlass

PROJ-101 sperrt den Studierendenpreis bei **neuen** Anfragen. Ein Abo, das schon
läuft, merkt davon nichts: Es wird weiter zum alten Preis eingezogen, auch wenn
der Kunde längst 30 ist. Niemand sieht das, weil ein laufendes Abo gar nicht
weiß, dass es ein Studierendenabo ist — `subscriptions` kennt nur `price`. Das
Kreuz „Ich bin Student(in)“ steht allein an der ursprünglichen Anfrage.

## Die Regel in einem Absatz

Ein Abo trägt künftig die Information, dass es zum Studierendenpreis läuft.
Wird der Kunde im **nächsten** Zyklus 28, geht zu Beginn des laufenden Zyklus
eine Ankündigung hinaus: welcher Preis ab wann gilt, und dass eine Kündigung bis
dahin möglich ist. 28 Tage später stellt das System den Preis um — es sei denn,
das Abo wurde inzwischen gekündigt, pausiert oder von Hand geändert. Wer kündigt,
zahlt den neuen Preis nie: Die Kündigung wirkt genau zu dem Tag, an dem er
beginnen würde.

## User Stories

- Als **Kunde** will ich vor einer Preiserhöhung davon erfahren und entscheiden
  können, ob ich bleibe, statt eine höhere Abbuchung auf dem Konto zu finden.
- Als **Kunde** will ich im selben Text den Weg zum Kündigen finden, damit die
  Wahl echt ist und nicht bloß behauptet.
- Als **Betreiber** will ich, dass der Rabatt ausläuft, ohne dass ich jeden
  Geburtstag im Kopf habe.
- Als **Betreiber** will ich sehen, welche Umstellungen anstehen und welche
  gelaufen sind, damit mich keine Rückfrage unvorbereitet trifft.
- Als **Betreiber** will ich, dass eine von mir von Hand gesetzte Ausnahme nicht
  automatisch überschrieben wird.

## Out of Scope

- **Rückwirkung.** Wer heute schon zu alt ist, wird nicht nachbelastet: Die
  Umstellung gilt ab dem angekündigten Stichtag, nie für vergangene Zyklen.
  Angekündigt wird der Bestand aber wie jeder andere Fall — eine Liste zum
  Abhaken wäre eine zweite Mechanik für dieselbe Entscheidung.
- **Andere Preisänderungen** (allgemeine Erhöhung, Kursumwandlung). Hier geht es
  ausschließlich um das Ende des Studierendenpreises.
- **Automatische Kündigung.** Das System kündigt nie selbst; es nennt nur den
  Weg.
- **Mahnwesen/Rücklastschriften** — unverändert (PROJ-37).

## Acceptance Criteria

- [x] Angenommen ein Abo läuft zum Studierendenpreis und der Kunde wird im
  nächsten Zyklus 28, wenn der laufende Zyklus beginnt, dann geht genau eine
  Ankündigung hinaus.
- [x] Angenommen die Ankündigung geht hinaus, wenn ich sie lese, dann stehen
  darin der heutige Preis, der neue Preis, das Datum der Umstellung und ein Weg
  zum Kündigen.
- [x] Angenommen die Umstellung ist angekündigt, wenn ich mein Abo im
  Kundenbereich ansehe, dann steht derselbe Hinweis auch dort — eine Mail kann
  man übersehen.
- [x] Angenommen der Tag der Umstellung ist erreicht und das Abo ist unverändert
  aktiv, wenn der Lauf durchgeht, dann steht am Abo der Normalpreis derselben
  Stufe.
- [x] Angenommen ich kündige nach der Ankündigung, wenn die Kündigung wirksam
  wird, dann ist das genau der Tag der Umstellung und ich zahle den neuen Preis
  nie.
- [x] Angenommen ich pausiere nach der Ankündigung, wenn der Tag der Umstellung
  kommt, dann wird der Preis nicht geändert und die Ankündigung verfällt.
- [x] Angenommen der Betreiber hat den Preis nach der Ankündigung von Hand
  geändert, wenn der Tag der Umstellung kommt, dann bleibt seine Zahl stehen.
- [x] Angenommen eine Umstellung steht an, wenn der Betreiber die Verwaltung
  öffnet, dann sieht er die Liste der angekündigten Umstellungen mit Datum.
- [x] Angenommen ein Abo läuft zum Studierendenpreis und der Kunde ist **heute
  schon** über 27, wenn der Betreiber die Liste öffnet, dann steht dieser
  Altbestand gesondert da — zum Entscheiden, nicht zum automatischen Umstellen.
- [x] Angenommen der Lauf fällt einmal aus (Ausfall, Fehler), wenn er am
  nächsten Tag wieder läuft, dann wird die Ankündigung nachgeholt und nicht
  doppelt verschickt.
- [x] Angenommen ein Abo hat kein Geburtsdatum am Kunden, wenn der Lauf
  durchgeht, dann passiert nichts und der Fall steht in der Liste für den
  Betreiber.
- [ ] Angenommen die Umstellung ist gelaufen, wenn die nächste Rechnung entsteht,
  dann trägt sie den neuen Preis und die SEPA-Vorabankündigung nennt ihn.
- [ ] Angenommen ich bin Kunde eines fremden Abos, wenn ich die Umstellung über
  die Schnittstelle anzustoßen versuche, dann wird das abgewiesen.
- [x] Angenommen eine Umstellung ist angekündigt und mein Flatrate-Upgrade wird
  bestätigt, wenn der Tag der Umstellung kommt, dann passiert nichts mehr — der
  Preis des Upgrades gilt.
- [x] Angenommen meine Studierenden-Flatrate läuft und ich werde im nächsten
  Zyklus 28, wenn der laufende Zyklus beginnt, dann wird sie genauso
  angekündigt und umgestellt wie ein Studierenden-Kursabo.

## Edge Cases

- **Geburtstag genau am Zyklusbeginn.** Dann ist der Kunde beim Start des
  nächsten Zyklus bereits 28 — die Ankündigung gehört in den Zyklus davor.
  Maßgeblich ist das Alter am **Tag der Umstellung**, nicht am Tag der
  Ankündigung.
- **Zwei Abos desselben Kunden.** Jedes bekommt seine eigene Ankündigung mit
  seinem eigenen Datum; die Zyklen können verschieden liegen.
- **Pass statt Abo.** Der Pass (`dance_styles.pass_student_price`) ist kein
  laufendes Abo und wird hier nicht berührt — beim nächsten Kauf greift
  PROJ-101.
- **Abo ohne Kursbindung (Flatrate).** Der Normalpreis kommt aus derselben
  Funktion, nur mit `false`. Eine **Studierenden-Flatrate** läuft damit genauso
  aus wie ein Studierenden-Kursabo — sie ist derselbe Rabatt in einer anderen
  Stufe.
- **Upgrade nach der Ankündigung.** Das Upgrade setzt einen neuen Preis; der
  gilt. Die angekündigte Umstellung wird dabei verworfen
  (`pending_price`/`pending_price_date` geleert), und `student_price` richtet
  sich nach dem Preis, den das Upgrade gesetzt hat. Wer über 27 ist, bekommt
  dort ohnehin nur den Normalpreis (PROJ-101).
- **Der Kunde nimmt die Kündigung zurück.** Dann greift die Umstellung wieder —
  die Ankündigung war nicht an die Kündigung gebunden.
- **Zwei Läufe am selben Tag** (Wiederholung nach einem Fehler) dürfen keine
  zweite Mail erzeugen: Das Kennzeichen am Abo ist die Sperre, nicht der
  Zeitpunkt des Laufs.

## Tech Design

### Was das Abo künftig weiß

```
subscriptions
  + student_price        boolean not null default false
  + pending_price        numeric            -- der angekündigte neue Preis
  + pending_price_date   date               -- ab wann er gilt
  + price_notice_sent_at timestamptz        -- die Sperre gegen Doppelversand
```

`student_price` wird beim Bestätigen einer Buchung gesetzt (dort ist das Kreuz
bekannt) und für den Bestand einmalig aus `course_bookings.wants_student_price`
abgeleitet, soweit die Anfrage noch zuzuordnen ist. Was sich nicht zuordnen
lässt, bleibt `false` und taucht in der Liste für den Betreiber auf — geraten
wird nicht.

### Der tägliche Lauf

```
für jedes aktive Abo mit student_price und bekanntem Geburtsdatum:
    umstellung := next_cycle_end(cycle_anchor_date)      -- Ende des laufenden Zyklus
    wenn alter_am(geburtsdatum, umstellung) >= 28
       und price_notice_sent_at ist leer:
         pending_price      := resolve_plan_price(kurs, plan, false)
         pending_price_date := umstellung
         Benachrichtigung einreihen; price_notice_sent_at setzen

für jedes Abo mit pending_price_date <= heute:
    wenn status = 'active' und keine Pause/Kündigung wirksam
       und price = der angekündigte alte Preis:
         price := pending_price
    pending_* leeren
```

Die letzte Bedingung ist der Schutz vor dem Überschreiben: Hat der Betreiber den
Preis nach der Ankündigung von Hand geändert, passt er nicht mehr zum
angekündigten alten Preis — dann bleibt seine Zahl stehen und der Fall landet in
der Liste.

### Die Benachrichtigung

Neuer `event_type` `studentenpreis_endet` — das ist eine **Migration**, weil
`notification_queue.event_type` eine CHECK-Liste hat; ohne sie scheitert das
Einreihen lautlos. Der Text wird über PROJ-34 gepflegt und nennt: alter Preis,
neuer Preis, Datum, Link zum Abo.

### Dateien

| Datei | Was |
| --- | --- |
| `supabase/migrations/…_proj102_studentenpreis_endet.sql` | Spalten, `event_type`, der Lauf als Funktion, Rechte |
| `src/app/api/cron/notifications/route.ts` | ruft den Lauf im Tageslauf auf |
| `src/components/customer/…` | der Hinweis am Abo im Kundenbereich |
| `src/components/admin/…` | die Liste der angekündigten und der offenen Fälle |
| `tests/PROJ-102-…-db.test.ts` | die Regel: Ankündigung, Umstellung, die drei Fälle, in denen nichts passiert |

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Ein voller Zyklus (28 Tage) Vorlauf | Nur so wirkt eine Kündigung genau zum Umstellungstag — der Kunde zahlt den neuen Preis nie | 2026-11-16 |
| Automatische Umstellung statt Liste zum Abhaken | Ausdrückliche Entscheidung des Betreibers; die Ankündigung mit Kündigungsmöglichkeit ist die Absicherung | 2026-11-16 |
| Kein Nachbelasten des Bestands | Rückwirkend Geld zu fordern, das nie angekündigt war, kostet mehr Vertrauen als es bringt | 2026-11-16 |
| Hinweis zusätzlich im Kundenbereich | Eine Mail kann im Spam landen; das Abo selbst lügt nicht | 2026-11-16 |
| Von Hand gesetzte Preise werden nie überschrieben | Sonst wäre jede Ausnahme des Betreibers 28 Tage später wieder weg | 2026-11-16 |
| Nach einem Upgrade gilt der Preis des Upgrades | Entscheidung des Betreibers; zwei Preisänderungen für denselben Zyklus wären nicht erklärbar | 2026-11-16 |
| Die Studierenden-Flatrate läuft genauso aus | Derselbe Rabatt, nur eine andere Stufe | 2026-11-16 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Kennzeichen am Abo statt Rückschluss auf die alte Anfrage | Die Anfrage kann fehlen, gelöscht oder mehrfach sein; der Preis gehört zum Abo | 2026-11-16 |
| Neuer Preis aus `resolve_plan_price(..., false)` | Dieselbe Quelle wie beim Buchen; ein zweiter Rechenweg driftet | 2026-11-16 |
| `price_notice_sent_at` als Doppelversand-Sperre | Ein wiederholter Lauf darf keine zweite Mail erzeugen | 2026-11-16 |
| Umstellung an `next_cycle_end`, nicht am Geburtstag | Abgerechnet wird in 28-Tage-Zyklen; ein Preiswechsel mitten im Zyklus wäre anteilig zu rechnen | 2026-11-16 |

## Open Questions
- [ ] Soll der Betreiber eine eigene Benachrichtigung bekommen, wenn eine
  Umstellung ansteht, oder reicht die Liste in der Verwaltung?
- [x] Was passiert, wenn der Kunde nach der Ankündigung ein Upgrade auf
  Flatrate beantragt (PROJ-87)? → Der Preis des Upgrades gilt, die angekündigte
  Umstellung entfällt. Und die Altersregel greift auch dort: Wer über 27 ist,
  bekommt die Flatrate zum Normalpreis, nicht als Studierenden-Flatrate
  (2026-11-16).
- [ ] Soll die Umstellung auch greifen, wenn das Abo pausiert ist und **nach**
  dem Umstellungstag wieder anläuft?

## Umsetzung (2026-11-16)

### Was es jetzt gibt

| Datei | Was |
| --- | --- |
| `supabase/migrations/20261116120000_proj102_studentenpreis_endet.sql` | fünf Spalten, der abgeleitete Bestand, `abo_normalpreis`, die neue Benachrichtigungsart, `confirm_flatrate_upgrade` |
| `src/lib/subscriptions/studentenpreis.ts` + Test | der Lauf: ankündigen und umstellen, 13 Prüfungen auf die Rechnung |
| `src/app/api/cron/notifications/route.ts` | im Morgenlauf, **nach** dem Abo-Vollzug |
| `src/lib/notifications/template-registry.ts` | die Vorlage, deutsch und englisch, über PROJ-34 pflegbar |
| `src/lib/notifications/dispatch.ts` | Inhalt bauen und **ohne Einstellungen** verschicken |
| `src/components/subscription/my-subscriptions-section.tsx` | der Hinweis am Abo, über dem Kündigen-Knopf |
| `src/components/admin/analytics/studentenpreis-liste.tsx` | die Karte in der Verwaltung |
| `src/lib/actions/admin/bookings.ts` | das Kennzeichen beim Bestätigen, einzeln und stapelweise |

### Abweichung von der Spezifikation: der Lauf steht in TypeScript

Die Spezifikation sah den Lauf als SQL-Funktion vor. Umgesetzt ist er als
TypeScript-Modul, das der Tageslauf ruft — dort, wo
`vollzieheFaelligeAenderungen` und `vollzieheFaelligeUmwandlungen` schon
stehen. Ein zweiter Mechanismus für „etwas wird zum Stichtag wirksam" würde
früher oder später anders antworten; außerdem ist die Rechnung so ohne
Datenbank prüfbar (`umstellungsDatum`, `zuAltAm`, `lohntUmstellung`).

In SQL geblieben ist, was dort hingehört: `abo_normalpreis` — der Normalpreis
der Stufe, auf der ein Abo läuft, aus derselben Quelle wie beim Buchen.

### Der Vorlauf ist eher größer als versprochen

Zugesagt ist **ein voller Zyklus**. Fällt das nächste Zyklusende näher als 28
Tage, geht die Ankündigung einen Zyklus weiter — sonst käme eine Kündigung zu
spät, um den neuen Beitrag zu vermeiden. In der Praxis heißt das: beim ersten
Lauf nach dem Ausliefern bekommen die meisten Kunden rund sechs bis acht Wochen
Vorlauf statt vier. Das ist Absicht; zu früh ist hier billiger als zu spät.

### Ein Befund, den der Test der Cron-Route gefunden hat

Die Antwort des Tageslaufs ist eine **flache** Zusammenfassung aller Schritte.
Mein Lauf meldete zuerst `angekuendigt` — genau wie die Kursumwandlung. Da er
später gemischt wird, hätte seine Null deren Zahl **überschrieben**: eine
stille Untererfassung in der einzigen Übersicht, die der Betrieb von diesem
Lauf hat. Die Zahlen heißen jetzt `studentenpreisAngekuendigt` und so weiter.

### Zwei Vorkehrungen, die über die Spezifikation hinausgehen

**Keine Ankündigung ohne Grund.** Der Lauf prüft zusätzlich, ob überhaupt etwas
zu erhöhen ist (`lohntUmstellung`). Hat die Verwaltung ein Abo mit
Studierenden-Kennzeichen ohnehin zum Normalpreis bestätigt, passiert nichts —
das ist der Rettungsanker für einen ungenau abgeleiteten Bestand.

**Keine Umstellung ohne Nachricht.** Scheitert das Einreihen der
Benachrichtigung, wird die Ankündigung am Abo zurückgenommen. Lieber im nächsten
Lauf ein zweiter Versuch als ein Preis, der am Stichtag steigt, ohne dass
jemand davon erfahren hat.

### Was nicht geprüft ist

- **Der Text in der Mail selbst.** Geprüft ist, dass die Nachricht mit allen
  vier Angaben in der Warteschlange landet und dass die Vorlage in beiden
  Sprachen rendert (Unit-Test der Vorlagen); der Versand hängt am Mailer.
- **Die englische Fassung des Hinweises am Abo.** Der Schlüssel ist in beiden
  Sprachen vorhanden, durchgeklickt ist die deutsche.
- **Ein Pass-Abo als Fall.** `abo_normalpreis` deckt ihn (Stilrichtung →
  `pass_price`), ein eigener Testfall dafür fehlt.

## QA (2026-11-16)

| Prüfung | Ergebnis |
| --- | --- |
| `tests/PROJ-102-studentenpreis-endet-db.test.ts` | **16/16**, im ersten Lauf |
| `tests/PROJ-102-studentenpreis-endet.spec.ts` (Chromium + Mobile Safari) | **8/8** |
| `src/lib/subscriptions/studentenpreis.test.ts` | **13/13** |
| `src/app/api/cron/notifications/route.test.ts` | **13/13** |
| Vorlagen (`templates`, `template-registry`, Vorschau, i18n) | **64/64** |
| Unit- und Datenbanktests gesamt | **1565 grün**, 119 Dateien |
| `tsc` · `eslint` · `build` | sauber · sauber · „Compiled successfully in 17,4s" |

**13 von 15 Kriterien sind abgehakt.** Zwei bleiben offen:

- **Die nächste Rechnung und die SEPA-Vorabankündigung** nennen den neuen
  Beitrag. Das ist gebaut — der Lauf setzt `price`, und Rechnung wie Ankündigung
  lesen genau diese Spalte —, aber nicht als eigener Test belegt. Der Weg dorthin
  führt über einen vollständigen Lastschriftlauf.
- **„Ein fremder Kunde kann die Umstellung nicht anstoßen"** ist gegenstandslos
  geworden: Es gibt keine Schnittstelle dafür. Der Lauf läuft im Tageslauf mit
  dem Dienstschlüssel; kein Kunde und keine Lehrkraft kann ihn aufrufen. Nichts
  abzuweisen ist besser als etwas abzuweisen — aber das Kriterium bleibt
  ungehakt, weil es nichts zu prüfen gibt.

### Der Befund, den der Test der Cron-Route gefunden hat

Die Antwort des Tageslaufs ist eine flache Zusammenfassung aller Schritte. Mein
Lauf meldete zuerst `angekuendigt` — genau wie die Kursumwandlung. Da er später
gemischt wird, hätte seine Null deren Zahl **überschrieben**: eine stille
Untererfassung in der einzigen Übersicht, die der Betrieb von diesem Lauf hat.
Die Zahlen heißen jetzt eindeutig.

### Zwei Prüfungen, die beim Abhaken nachgereicht wurden

Statt zwei Kriterien „im Grunde belegt" zu nennen, haben sie jetzt einen Test:
der **Text der Ankündigung** (beide Beträge, das Datum, und das Wort „kündigen"
in beiden Sprachen) und die **Studierenden-Flatrate**, die genauso ausläuft wie
ein Kursabo. Dazu der Fall, dass ein **Upgrade** die Ankündigung abräumt.

**Urteil: produktionsreif.** Reihenfolge: erst die Migration von PROJ-101, dann
die von PROJ-102, dann der Code. Der erste Tageslauf nach dem Ausliefern
kündigt an, was ansteht — und er verschickt dabei echte Mails. Wer das zuerst
sehen will, ohne dass etwas hinausgeht, schaut vorher in die Verwaltung: Die
Karte „Studierendenpreis" zeigt, welche Abos in Frage kommen.
