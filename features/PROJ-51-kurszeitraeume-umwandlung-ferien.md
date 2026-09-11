# PROJ-51: Kurszeiträume, Umwandlung und Ferien im Stundenplan

## Status: Approved
**Created:** 2026-09-11
**Last Updated:** 2026-09-11
**Priorität:** P1

## Dependencies
- Requires: PROJ-6 (Stundenplan & Kalender) — dort wird angezeigt
- Requires: PROJ-3 (Admin: Kurse verwalten) — dort wird gepflegt
- Berührt: PROJ-9 (fällige Änderungen — derselbe nächtliche Lauf vollzieht die Umwandlung)
- Berührt: PROJ-8/PROJ-50 (Buchung und Flatrate — ein Kurs, der ausläuft, sollte nicht mehr buchbar sein)

## Problem

Kurse laufen in Staffeln von vier bis acht Wochen, und **jeder Kurs hat seinen
eigenen Zeitraum** — nicht das Studio als Ganzes. Daraus folgen drei Lücken:

**1. Der Stundenplan kennt keine Zeit.** Er zeigt eine typische Woche und darin
jeden Kurs, der einen Wochentermin hat — unabhängig davon, ob dieser Kurs noch
läuft oder erst nächsten Monat beginnt. Ein Kurs, der ausgelaufen ist, muss von
Hand entfernt werden, sonst steht er weiter da.

**2. „Aktuell oder nächste?" ist heute nicht beantwortbar.** Wenn donnerstags
um 19:00 gerade Beginner 1 läuft und ab Januar Beginner 2 dort steht, kann der
Stundenplan nur eines von beidem zeigen. Zeigt er den laufenden, plant ein
Interessent falsch; zeigt er den kommenden, findet jemand vor Ort etwas
anderes vor, als angekündigt war.

**3. Eine Staffel wird zur nächsten — mit denselben Leuten.** Aus Beginner 1
wird Beginner 2: derselbe Kurs, dieselben Kunden, derselbe Termin, nur Name und
Level ändern sich. Heute gäbe es dafür nur den Weg „neuen Kurs anlegen und alle
Kunden umhängen" — mit Abos, Kursplätzen, Anwesenheitshistorie und Notizen im
Schlepptau.

**Und die Ferien:** Dass das Studio zwischen Weihnachten und Neujahr zu hat,
steht heute als einzelner Ausfalltag an jedem Kurs — bei zwanzig Kursen und
zwei Wochen Ferien sind das bis zu vierzig Einträge von Hand.

## User Stories

- Als **Betreiber** möchte ich einem Kurs einen Zeitraum geben, damit er nach
  Ablauf von selbst aus dem Stundenplan verschwindet und ich ihn nicht
  hinterherräumen muss.
- Als **Betreiber** möchte ich einen laufenden Kurs zum Stichtag umwandeln
  (Beginner 1 → Beginner 2), damit meine Kunden dabeibleiben, ohne dass ich
  etwas umhänge.
- Als **Betreiber** möchte ich Ferien einmal eintragen, damit alle betroffenen
  Kurstermine ausfallen, statt sie einzeln bei jedem Kurs einzutragen.
- Als **Interessent** möchte ich im Stundenplan sehen, wie lange ein Kurs noch
  läuft und was danach an derselben Stelle kommt, damit ich weiß, wann ein
  Einstieg Sinn hat.
- Als **Kunde** möchte ich erfahren, wenn mein Kurs seinen Namen und sein Level
  wechselt, damit mich der neue Name in „Mein Bereich" nicht überrascht.

## Out of Scope

- **Studioweite Staffeln** — bewusst nicht: Jeder Kurs hat seinen eigenen
  Zeitraum (Entscheidung vom 2026-09-11).
- **Wochenweises Blättern im Stundenplan** — der Stundenplan bleibt die
  typische Woche. Zeiträume und Umwandlungen werden *im* Eintrag benannt, nicht
  durch Navigation aufgelöst.
- **Automatische Kursanlage für die Folgestaffel** — wer keinen bestehenden
  Kurs umwandelt, legt wie bisher einen neuen an.
- **Preisänderung bei der Umwandlung** — siehe Offene Fragen; vorerst behält
  der Kurs seinen Preis.
- **Ferien je Standort** — Ferien gelten fürs ganze Studio. Ein einzelner
  Standort, der abweicht, bleibt Handarbeit über die bestehenden Ausfalltage.

## Acceptance Criteria

**Kurszeitraum**

- [ ] Angenommen der Betreiber legt einen Kurs an oder bearbeitet ihn, wenn er
      das Formular öffnet, dann kann er „läuft von" und „läuft bis" setzen;
      beide Felder dürfen leer bleiben und bedeuten dann „unbefristet"
- [ ] Angenommen ein Kurs hat ein Enddatum in der Vergangenheit, wenn jemand
      den Stundenplan öffnet, dann erscheint dieser Kurs dort nicht mehr
- [ ] Angenommen ein Kurs beginnt in mehr als drei Wochen, wenn jemand den
      Stundenplan öffnet, dann erscheint er dort noch nicht
- [ ] Angenommen ein Kurs beginnt innerhalb der nächsten drei Wochen, wenn
      jemand den Stundenplan öffnet, dann steht er mit dem Zusatz „ab
      {Datum}" an seinem Wochentag
- [ ] Angenommen ein Kurs läuft und endet innerhalb der nächsten drei Wochen,
      wenn jemand den Stundenplan öffnet, dann steht bei ihm „noch bis {Datum}"
- [ ] Angenommen ein Kurs ist unbefristet, wenn jemand den Stundenplan öffnet,
      dann steht bei ihm kein Zeitraum — die Angabe erscheint nur, wo sie etwas
      aussagt
- [ ] Angenommen ein Kurs endet demnächst, wenn ein Kunde ihn buchen will, dann
      wird er darauf hingewiesen, bevor er bucht

**Umwandlung**

- [ ] Angenommen der Betreiber öffnet einen laufenden Kurs, wenn er „Kurs
      umwandeln" wählt, dann kann er neuen Namen, neues Level und einen Stichtag
      angeben
- [ ] Angenommen eine Umwandlung ist vorgemerkt, wenn der Betreiber den Kurs
      ansieht, dann steht dort, was sich wann ändert — und er kann die
      Vormerkung wieder zurücknehmen
- [ ] Angenommen eine Umwandlung ist vorgemerkt und der Stichtag liegt
      innerhalb der nächsten drei Wochen, wenn jemand den Stundenplan öffnet,
      dann steht beim Kurs zusätzlich „ab {Datum}: {neuer Name}"
- [ ] Angenommen der Stichtag ist erreicht, wenn der nächtliche Lauf durchläuft,
      dann heißt der Kurs neu, hat das neue Level, und **alle Kunden sind
      weiterhin eingeschrieben**
- [ ] Angenommen ein Kurs wurde umgewandelt, wenn der Lehrer die
      Anwesenheitsliste öffnet, dann steht die Historie aus der Zeit davor
      unverändert da
- [ ] Angenommen ein Kurs wurde umgewandelt, wenn ein betroffener Kunde „Mein
      Bereich" öffnet, dann sieht er den neuen Namen — und er wurde vorher
      darüber benachrichtigt

**Ausgelaufener Kurs**

- [ ] Angenommen das Abo eines Kunden hängt an einem Kurs, dessen Zeitraum
      abgelaufen ist, wenn er „Mein Bereich" oder „Mein Profil" öffnet, dann
      sieht er, dass dieser Kurs beendet ist — und wird zum Umbuchen geführt
- [ ] Angenommen ein Kurs ist ausgelaufen, wenn ein Kunde mit Abo darauf sein
      Dashboard öffnet, dann wird für diesen Kurs **kein** nächster Termin mehr
      berechnet
- [ ] Angenommen ein Kurs ist ausgelaufen, wenn der Lehrer seinen Bereich
      öffnet, dann steht dieser Kurs weder unter den nächsten Terminen noch
      unter fehlender Anwesenheit
- [ ] Angenommen ein Kurs ist ausgelaufen, wenn der Betreiber die Kundenliste
      oder die Abo-Verwaltung öffnet, dann erkennt er die betroffenen Abos als
      solche

**Ferien**

- [ ] Angenommen der Betreiber trägt Ferien mit Von- und Bis-Datum ein, wenn er
      speichert, dann fallen alle Kurstermine in diesem Zeitraum aus
- [ ] Angenommen Ferien sind eingetragen, wenn jemand den Stundenplan öffnet,
      dann steht dort ein Hinweis, dass das Studio in diesem Zeitraum
      geschlossen ist
- [ ] Angenommen ein Termin fällt in die Ferien, wenn ein Kunde „Mein Bereich"
      öffnet, dann wird dieser Termin nicht als nächster Kurs angezeigt
- [ ] Angenommen ein Termin fällt in die Ferien, wenn der Lehrer seinen Bereich
      öffnet, dann wird dieser Termin weder als anstehend noch als fehlende
      Anwesenheit genannt
- [ ] Angenommen der Betreiber löscht einen Ferienzeitraum, wenn er speichert,
      dann finden die Termine wieder statt — **ohne** die einzeln gepflegten
      Ausfalltage anzutasten, die es vorher schon gab

## Edge Cases

- **Umwandlung am selben Tag wie ein Kurstermin** — der Termin gehört zum neuen
  Namen: Wer an dem Abend erscheint, ist in Beginner 2.
- **Zwei Umwandlungen hintereinander vorgemerkt** — nicht möglich; es gibt
  höchstens eine offene Vormerkung je Kurs. Die zweite wird erst nach Vollzug
  der ersten angelegt.
- **Umwandlung mit Stichtag in der Vergangenheit** — wird beim Speichern
  abgelehnt; ein rückwirkender Namenswechsel würde die Anwesenheitshistorie
  umdeuten.
- **Kurs endet, während Kunden ein aktives Abo haben** — das Abo läuft weiter.
  Der Kunde zahlt dann aber für einen Kurs, den es nicht mehr gibt: Er muss
  merken, dass er umbuchen sollte. Deshalb die beiden Kriterien unter
  „Ausgelaufener Kurs" — ohne sie wäre die Entscheidung „Abo läuft weiter"
  eine stille Falle.
- **Ferien überlappen mit bereits gepflegten Ausfalltagen** — der Termin fällt
  einmal aus, nicht zweimal; beim Löschen der Ferien bleibt der einzeln
  gepflegte Ausfalltag bestehen.
- **Ferien beginnen mitten in der Woche** — nur die Termine ab dem Von-Datum
  fallen aus, nicht die ganze Woche.
- **Kurs beginnt erst nach den Ferien** — er erscheint mit „ab {Datum}", die
  Ferien davor betreffen ihn nicht.

## Technical Requirements
- Die Umwandlung folgt dem Muster der Abo-Änderungen aus PROJ-9: eine
  Vormerkung mit Stichtag, vollzogen vom bestehenden nächtlichen Lauf. Ein
  zweiter Mechanismus für dieselbe Sache würde früher oder später anders
  antworten.
- Der Kurs behält beim Umwandeln **seine Identität** (dieselbe Zeile in
  `courses`). Nur so bleiben Abos, Kursplätze, Anwesenheit und Notizen ohne
  Zutun daran hängen.
- Ferien **und Kurszeiträume** wirken auf jede Stelle, die Kurstermine
  berechnet — Stundenplan, Kunden-Dashboard, Lehrer-Bereich, fehlende
  Anwesenheit, Selbst-Check-in. Wie bei PROJ-50 gilt: eine gemeinsame Antwort,
  nicht mehrere Rechnungen. Konkret bedeutet das, dass
  `upcomingOccurrences()` künftig auch den Kurszeitraum und die Ferien kennen
  muss — sonst rechnet jede Stelle, die sie aufruft, an ihnen vorbei.
- Die Suche nach den betroffenen Stellen läuft vollständig, nicht als Stichprobe.
  Bei PROJ-50 kamen drei Lesestellen erst durch eine Meldung aus dem Betrieb
  ans Licht, weil die erste Liste aus Vermutungen bestand.

## Open Questions

- [x] **Was passiert mit laufenden Abos, wenn ein Kurs endet, ohne umgewandelt
      zu werden?** → Das Abo läuft weiter, unabhängig vom Kurs. Es ist die
      Zahlungsbeziehung; der Kurs ist nur der Ort, an dem gerade getanzt wird —
      und lässt sich über das bestehende Umbuchen (PROJ-9) wechseln
      (2026-09-11)
- [x] **Ändert sich bei einer Umwandlung der Preis?** → Nein. Sonst müsste die
      Vormerkung laufende Abos anfassen, und eine Preisänderung an einem
      bestehenden Vertrag ist etwas anderes als ein neuer Kursname (2026-09-11)
- [x] **Sollen Ferien die Kurszeiträume verlängern?** → Nein, der Betreiber
      trägt das Ende selbst ein. Er kennt die Ferien beim Planen; eine
      automatische Verschiebung liefe im Hintergrund und wäre später nicht
      nachvollziehbar (2026-09-11)
- [x] **Wie viele Tage vorher soll die Benachrichtigung über eine Umwandlung
      hinausgehen?** → Sieben. Das ist der Abstand zum letzten Kurstermin unter
      dem alten Namen. Die drei Wochen des Stundenplans wären zu früh für eine
      Nachricht: Was man liest und erst in drei Wochen braucht, hat man
      vergessen. Der Wert steht als `ANKUENDIGUNG_TAGE` an einer Stelle und
      lässt sich ändern (2026-09-11)

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|---|---|---|
| Jeder Kurs hat seinen eigenen Zeitraum, keine studioweite Staffel | Vom Betreiber entschieden. Kurse laufen vier bis acht Wochen und starten zu verschiedenen Terminen; eine gemeinsame Klammer gäbe es nur auf dem Papier | 2026-09-11 |
| Der Stundenplan zeigt laufende **und** kommende Kurse, beide datiert | Löst die Frage „aktuell oder nächste?" auf, statt sie zu entscheiden. Wer donnerstags um sieben vor der Tür steht, findet den laufenden Kurs — ein Stundenplan, der etwas anderes behauptet, wäre falsch. Wer plant, sieht daneben, was danach kommt | 2026-09-11 |
| Vorschau: drei Wochen | Vom Betreiber gewählt. Lang genug zum Planen, kurz genug, dass der Plan nicht zur Prognose wird | 2026-09-11 |
| Umwandeln statt neu anlegen und umhängen | Aus Beginner 1 wird Beginner 2 mit denselben Kunden. Es ist derselbe Kurs mit neuem Namen — und weil er seine Identität behält, bleiben Abos, Kursplätze, Anwesenheit und Notizen ohne Zutun daran | 2026-09-11 |
| Ferien gelten fürs ganze Studio | Weihnachten ist zu, für alle. Ferien je Standort wären eine zweite Regel für einen Fall, den es noch nicht gibt | 2026-09-11 |
| Ferien lassen die bestehenden Ausfalltage unberührt | Zwei Wege, einen Termin ausfallen zu lassen — der eine darf den anderen nicht überschreiben. Sonst löscht das Entfernen der Ferien einen Ausfall, der nichts damit zu tun hatte | 2026-09-11 |
| Ein Abo läuft unabhängig vom Kurs weiter | Vom Betreiber entschieden. Das Abo ist die Zahlungsbeziehung, der Kurs nur der Ort — und über das bestehende Umbuchen (PROJ-9) wechselbar. Kehrseite, bewusst mitgenommen: Der Kunde zahlt weiter für einen Kurs, den es nicht mehr gibt, also muss die App ihn darauf stoßen | 2026-09-11 |
| Ankündigung der Umwandlung sieben Tage vorher | Der Abstand zum letzten Kurstermin unter dem alten Namen. Drei Wochen — der Vorlauf des Stundenplans — wären zu früh für eine Nachricht; was man liest und erst in drei Wochen braucht, hat man vergessen | 2026-09-11 |
| Kein wochenweises Blättern im Stundenplan | Der Stundenplan beantwortet „was gibt es?", nicht „was ist am 14. Januar?". Zeiträume gehören in den Eintrag, nicht in eine Navigation | 2026-09-11 |

### Technical Decisions

| Decision | Rationale | Date |
|---|---|---|
| Kurszeitraum und Ferien werden **Pflichtangaben** der Terminrechnung | 14 Aufrufstellen in 10 Dateien fragen „wann findet dieser Kurs statt?". Optional wäre die Angabe genau so lange, bis eine Stelle sie vergisst — und dann rechnet sie still falsch. Als Pflicht listet der Compiler alle 14 auf, und keine kann übersehen werden. Genau so hat sich heute schon `hasFlatrate` durch die Aufrufer gearbeitet | 2026-09-11 |
| Die Terminrechnung bleibt in TypeScript, nicht in der Datenbank | Sie ist dort mit Unit-Tests abgedeckt (Wochentagskonvention, Wiener Zeit, Tagesgrenzen). In SQL verschoben wäre sie zwar unumgehbar, aber ohne diese Prüfungen — und der Zwang entsteht hier ohnehin über den Compiler | 2026-09-11 |
| Ferien als eigener studioweiter Zeitraum, nicht als viele Ausfalltage | Ein Eintrag statt vierzig. Und sie bleiben unterscheidbar: Wer die Ferien löscht, löscht keinen Ausfalltag, den jemand aus anderem Grund gesetzt hat | 2026-09-11 |
| Die Umwandlung ist eine Vormerkung am Kurs, kein neuer Kurs | Der Kurs behält seine Identität. Abos, Kursplätze, Anwesenheit und Notizen hängen an der Kurs-Kennung — bei einem neuen Kurs müsste all das umgehängt werden, und jede vergessene Verknüpfung wäre stiller Datenverlust | 2026-09-11 |
| Vollzogen vom bestehenden nächtlichen Lauf | Dort werden bereits fällige Abo-Änderungen vollzogen, mit Fehlerbehandlung und Sentry-Meldung je Schritt. Ein zweiter Mechanismus für „etwas wird zum Stichtag wirksam" würde früher oder später anders antworten | 2026-09-11 |
| Der alte Kursname verschwindet mit der Umwandlung | Bewusst in Kauf genommen: Eine Anwesenheitsliste vom November zeigt danach den neuen Namen. Den alten mitzuführen hieße, jeden Termin mit seinem damaligen Namen zu versehen — viel Maschinerie für eine Zeile, die niemand vermisst. Rechnungen und Abos tragen ohnehin eigene Bezeichnungen und bleiben unberührt | 2026-09-11 |
| Preis bleibt bei der Umwandlung unverändert | Vom Betreiber entschieden. Sonst müsste die Vormerkung auch laufende Abos anfassen — eine Preisänderung an einem bestehenden Vertrag ist etwas anderes als ein neuer Kursname und gehört ausdrücklich angekündigt | 2026-09-11 |
| Die Ankündigung bekommt jeder Teilnehmer, unabhängig von seinen Benachrichtigungs-Einstellungen | Wie beim Kursausfall betrieblich notwendig: Wer sie abgeschaltet hat, stünde sonst vor einem Kurs, den es unter diesem Namen nicht mehr gibt | 2026-09-11 |
| Der nächtliche Lauf liest die Teilnehmer aus der Sicht `course_members`, nicht über `get_course_member_ids` | Jene Funktion prüft auf Lehrkraft oder Verwaltung, und im nächtlichen Lauf sitzt niemand. Die Prüfung schlüge fehl und lieferte eine leere Liste — ohne Fehler, also unbemerkt. Die Definition ist dieselbe; nur die Tür ist eine andere | 2026-09-11 |
| Namen und Datum stehen in der Nutzlast der Benachrichtigung, statt nachgeschlagen zu werden | Am Stichtag löscht der Vollzug die Vormerkung. Ein später wiederholter Versand fände nichts mehr vor und verschickte eine leere Nachricht | 2026-09-11 |
| Ferien verlängern den Kurszeitraum nicht | Vom Betreiber entschieden. Der Betreiber kennt die Ferien beim Planen; eine automatische Verschiebung wäre eine Rechnung im Hintergrund, die niemand nachvollzieht, wenn sie einmal anders ausfällt als gedacht | 2026-09-11 |

---

## Tech Design (Solution Architect)

### Die Kernfrage: eine Rechnung, die niemand umgehen kann

„Wann findet dieser Kurs statt?" wird an **14 Stellen in 10 Dateien** gefragt —
Stundenplan, Kurskatalog, Kursdetail, Kunden-Dashboard, Profil, Lehrer-Bereich,
Buchung, Benachrichtigungen. Alle rufen dieselbe Funktion auf, und das ist gut
so: Es gibt bereits eine gemeinsame Rechnung.

Nur weiß sie zwei Dinge nicht, die sie künftig wissen muss: **wie lange ein Kurs
läuft** und **wann das Studio zu ist**.

Die naheliegende Lösung wäre, beides als zusätzliche, optionale Angabe
anzubieten. Genau davor warnt die Erfahrung aus PROJ-50: Optional heißt, dass
es funktioniert, bis eine Stelle es vergisst — und dann rechnet sie still
falsch, ohne Fehlermeldung. Drei solche Stellen kamen dort erst durch eine
Meldung aus dem Betrieb ans Licht.

**Deshalb werden beide Angaben zur Pflicht.** Wer die Terminrechnung aufruft,
muss sagen, in welchem Zeitraum der Kurs läuft und welche Ferien gelten. Der
Compiler zeigt beim Umbau alle 14 Stellen auf einmal an; eine zu übersehen ist
nicht möglich. Dieselbe Mechanik hat sich in diesem Projekt gestern schon
bewährt, als eine neue Pflichtangabe sich durch die Aufrufer gearbeitet hat.

Damit nicht jede Stelle die Ferien anders beschafft, gibt es **einen
gemeinsamen Weg**, sie zu laden — so wie es für die Kurszugehörigkeit bereits
einen gibt.

### Zwei Regeln, die nicht dasselbe sind

Beim Entwurf fiel auf, dass hier zwei Fragen leicht verwechselt werden:

| Frage | Gilt für | Regel |
|---|---|---|
| **Findet dieser Termin statt?** | Dashboard, Lehrer-Bereich, Check-in, Erinnerungen, fehlende Anwesenheit | Nur innerhalb des Kurszeitraums, nie in den Ferien |
| **Zeige ich diesen Kurs im Stundenplan?** | nur der Stundenplan | Laufende Kurse — und solche, die innerhalb von drei Wochen beginnen |

Die erste ist eine Wahrheit über die Wirklichkeit: Ein Termin außerhalb des
Zeitraums existiert nicht. Die zweite ist eine Anzeigeentscheidung: Ein Kurs,
der in fünf Wochen beginnt, existiert sehr wohl — er steht nur noch nicht im
Plan.

Sie getrennt zu halten ist wichtig, weil sonst die Vorschau von drei Wochen
irgendwann in die Terminrechnung sickert und dort etwas verbirgt.

### Datenmodell

**Der Kurs bekommt einen Zeitraum.** „Läuft von" und „läuft bis", beide dürfen
leer bleiben — dann ist der Kurs unbefristet und verhält sich wie heute. Ein
Kurs, dessen Ende vorbei ist, verschwindet aus dem Stundenplan und liefert
keine Termine mehr.

**Der Kurs bekommt eine Vormerkung.** Neuer Name, neues Level, Stichtag — die
drei gehören zusammen: entweder alle oder keine. Höchstens eine offene
Vormerkung je Kurs. Der Preis bleibt außen vor.

**Neu: Ferien.** Ein Name, ein Von- und ein Bis-Datum, gültig fürs ganze Studio.
Öffentlich lesbar, denn der Stundenplan zeigt sie auch anonymen Besuchern.

**Was unverändert bleibt:** die einzeln gepflegten Ausfalltage je Kurs. Sie sind
etwas anderes als Ferien — ein einzelner Abend, an dem der Lehrer krank ist,
hat mit Weihnachten nichts zu tun. Beide lassen einen Termin ausfallen, keiner
löscht den anderen.

### Der Vollzug zum Stichtag

Die Umwandlung wird vorgemerkt und wirkt zum Stichtag — genau wie eine geplante
Abo-Pause oder -Kündigung. Der nächtliche Lauf, der jene bereits vollzieht,
bekommt einen Schritt dazu. Er bringt seine Fehlerbehandlung mit: Scheitert ein
Schritt, meldet er es und die anderen laufen weiter.

Vorher geht eine Benachrichtigung an die betroffenen Kunden — ihr Kurs wechselt
Name und Level, und der neue Name soll sie in „Mein Bereich" nicht überraschen.

### Was sich in der Bedienung ändert

```
Admin → Kurse → Kurs bearbeiten
+-- (bestehendes Formular)
+-- NEU: Zeitraum
|   +-- „läuft von" · „läuft bis"   (beide optional)
+-- NEU: Kurs umwandeln
    +-- neuer Name · neues Level · ab wann
    +-- [Vormerkung besteht] → „Ab 7.1. wird daraus: Salsa Beginner 2"
                               + „Vormerkung zurücknehmen"

Admin → Kurse (Liste)
+-- NEU: Spalte/Hinweis „läuft bis …" bzw. „ab …"

Admin → NEU: Ferien
+-- Liste der Zeiträume (Name, von, bis)
+-- Anlegen · Entfernen

Stundenplan (öffentlich)
+-- NEU: Hinweisleiste bei anstehenden Ferien
|   „Vom 23.12. bis 6.1. ist das Studio geschlossen."
+-- Wochentag
    +-- Kurskarte
        +-- [läuft, Ende in Sicht]  „noch bis 21.12."
        +-- [beginnt demnächst]     „ab 7.1."
        +-- [Umwandlung vorgemerkt] „ab 7.1.: Salsa Beginner 2"
        +-- [unbefristet]           (keine Angabe — sie sagt hier nichts aus)

Mein Bereich / Mein Profil
+-- NEU: Hinweis bei einem Abo, dessen Kurs ausgelaufen ist
    „Dieser Kurs ist beendet." + Weg zum Umbuchen
```

Für Kurse ohne Zeitraum ändert sich **nichts** — weder in der Anzeige noch im
Verhalten. Das ist Absicht: Der Betreiber soll die Zeiträume nachziehen können,
wo sie ihm nützen, statt sie überall gleichzeitig pflegen zu müssen.

### Wo die Arbeit wirklich liegt

Nicht in den drei neuen Feldern und nicht in der Ferienverwaltung. Sondern
darin, die 14 Aufrufstellen umzustellen, ohne dass eine falsch versorgt wird —
und in der Absicherung: **je ein Test pro Stelle, der einen Kurs außerhalb
seines Zeitraums oder einen Termin in den Ferien benutzt.** Ohne das bleibt
jeder dieser Tests grün, egal was passiert.

### Neue Pakete

Keine. Formulare, Listen, Datumsfelder und Hinweisleisten sind vorhanden.


---

## Implementation Notes

**Stand 2026-09-11 — Frontend und Backend gebaut, Migrationen teils offen.**

### Was gebaut wurde

| Teil | Wo |
|---|---|
| Zeitraum und Ferien in der Terminrechnung | `src/lib/scheduling/dates.ts` (`zeitraum`/`ferien` als Pflichtparameter), `src/lib/scheduling/ferien.ts` |
| Anzeigeentscheidung für den Stundenplan | `src/lib/scheduling/kursanzeige.ts` (`VORSCHAU_TAGE`, `imStundenplan`, `zeitraumhinweis`, `anstehendeFerien`) |
| Stundenplan mit Hinweisen und Ferienleiste | `src/app/[locale]/(site)/stundenplan/page.tsx`, `src/components/schedule/weekly-schedule-view.tsx` |
| Zeitraumfelder und „Kurs umwandeln" im Kursformular | `src/components/admin/courses/course-manager.tsx`, `src/components/admin/courses/course-conversion-section.tsx` |
| Ferienverwaltung | `src/app/admin/ferien/`, `src/components/admin/ferien/`, `src/lib/actions/admin/ferien.ts` |
| Hinweis auf den ausgelaufenen Kurs | `src/components/subscription/my-subscriptions-section.tsx`, `src/components/dashboard/open-items-section.tsx`, Kundenliste und Kundenprofil im Admin |
| Ankündigung und Vollzug der Umwandlung | `src/lib/courses/umwandlungen.ts`, eingehängt in `src/app/api/cron/notifications/route.ts` |
| Nachrichtentext (DE/EN) | `src/lib/notifications/template-registry.ts` (`kursumwandlung`), über PROJ-34 im Admin änderbar |

### Migrationen

- `20260911030000_proj51_kurszeitraum_und_ferien.sql` — Zeitraum, Vormerkung, `studio_holidays`
- `20260911040000_proj51_umwandlung_ankuendigen.sql` — `courses.pending_announced_at`, neuer Ereignistyp `kursumwandlung`

### Abweichungen vom Entwurf

- Die Umbuchen-Liste im Profil bietet **keine ausgelaufenen Kurse** mehr an.
  Im Entwurf nicht vorgesehen, aber ohne das führte der Weg aus der Sackgasse
  in die nächste.
- Das Kriterium „der Betreiber erkennt die betroffenen Abos" ist an **zwei**
  Stellen umgesetzt statt an einer: Kundenliste *und* Kundenprofil. Nur im
  Profil hieße, fünfzig Profile zu öffnen, um die drei zu finden.
- Der **Kurskatalog** filtert ausgelaufene Kurse ebenfalls heraus, mit
  derselben Funktion wie der Stundenplan (`imStundenplan`). Im Entwurf stand
  nur der Stundenplan; ein Kurs, den der Plan nicht mehr kennt, aber der
  Katalog weiter zum Buchen anbietet, wäre die gefährlichere Hälfte gewesen.
- Der Buchungsdialog weist auf ein nahes Kursende hin. `runsUntil` ist dafür
  **Pflichtfeld** an `BookingDialogCourse` — der Compiler hat dadurch alle
  sieben Aufrufstellen aufgezählt.
- **Abwägung beim Lehrerbereich:** Das Kriterium „ein ausgelaufener Kurs steht
  nicht unter fehlender Anwesenheit" ist umgesetzt — aber es hat einen Preis.
  Die letzten Stunden eines Kurses haben stattgefunden; fehlt dort die
  Anwesenheit, fehlt sie wirklich. Mit dem Kursende verschwindet die
  Erinnerung daran. Dagegen stand: Sonst bliebe eine Liste stehen, die niemand
  mehr abarbeiten kann. Nachtragen geht weiterhin über die Kursseite. Falls
  sich das im Betrieb als falsch erweist, wäre eine Schonfrist von ein paar
  Wochen nach Kursende die naheliegende Korrektur.

---

## QA Test Results

**Getestet:** 2026-09-11
**Umgebung:** lokal gegen die Testdatenbank (beide Migrationen eingespielt)
**Prüfer:** QA Engineer (AI)

### Akzeptanzkriterien

#### Kurszeitraum — 7/7
- [x] „Läuft von"/„läuft bis" im Kursformular, beide leer = unbefristet
- [x] Kurs mit Ende in der Vergangenheit steht nicht mehr im Stundenplan
- [x] Kurs, der in mehr als drei Wochen beginnt, erscheint noch nicht
- [x] Kurs, der binnen drei Wochen beginnt, steht mit „ab {Datum}" da
- [x] Kurs, der binnen drei Wochen endet, steht mit „noch bis {Datum}" da
- [x] Unbefristeter Kurs bekommt keine Zeitraumzeile
- [x] Hinweis auf ein nahes Kursende im Buchungsdialog — **mit Einschränkung**,
      siehe BUG-4

#### Umwandlung — 5/6
- [x] „Kurs umwandeln" nimmt Namen, Level und Stichtag entgegen
- [x] Vormerkung ist sichtbar und zurücknehmbar
- [x] Stundenplan zeigt „ab {Datum}: {neuer Name}" und stellt es dem Ende voran
- [x] Stichtag erreicht → neuer Name, neues Level, alle Kunden weiter eingeschrieben
- [x] Anwesenheitshistorie bleibt unverändert (die Kurs-Kennung ändert sich nicht)
- [ ] **BUG-1:** Der Kunde wird vorher benachrichtigt — aber bei einem Kurs mit
      gesetztem Enddatum führt die Ankündigung ins Leere, weil der Kurs
      unsichtbar bleibt

#### Ausgelaufener Kurs — 3/4
- [ ] **BUG-3:** Hinweis in „Mein Bereich"/„Mein Profil" erscheint auch bei
      gekündigten Abos, wo er nicht stimmt
- [x] Dashboard rechnet für einen ausgelaufenen Kurs keinen Termin mehr
- [x] Lehrerbereich zeigt ihn weder als Termin noch als fehlende Anwesenheit
- [x] Betreiber erkennt die betroffenen Abos in Kundenliste und Kundenprofil

#### Ferien — 5/5
- [x] Eingetragene Ferien lassen alle Kurstermine darin ausfallen
- [x] Hinweisleiste über dem Stundenplan
- [x] Termin in den Ferien ist kein „nächster Kurs" im Kundenbereich
- [x] Termin in den Ferien fehlt auch im Lehrerbereich
- [x] Ferien löschen lässt die einzeln gepflegten Ausfalltage unberührt

### Randfälle

- [x] **Umwandlung mit Stichtag in der Vergangenheit** — wird beim Speichern abgelehnt
- [x] **Kursende vor dem Kursbeginn** — wird abgelehnt, zusätzlich per DB-CHECK
- [x] **Ferienende vor dem Ferienbeginn** — wird abgelehnt, zusätzlich per DB-CHECK
- [x] **Verpasster Stichtag** (nächtlicher Lauf fiel aus) — wird nachgeholt (`lte`, nicht `eq`)
- [x] **Zweiter Lauf am selben Tag** — ändert nichts und kündigt nicht erneut an
- [x] **Ferien über Jahrzehnte** — keine Endlosschleife, `MAX_WOCHEN = 520` greift
- [x] **Kurs ohne Wochentermin** — taucht nirgends als Termin auf
- [ ] **BUG-2:** Vormerkung ankündigen → zurücknehmen → neu vormerken

### Sicherheitsprüfung

- [x] **Authentifizierung:** `/admin/ferien` liegt unter dem Admin-Layout, das
      `requireAdmin()` aufruft; die Ferien-Aktionen prüfen zusätzlich selbst
- [x] **Autorisierung:** `studio_holidays` hat RLS — öffentlich lesbar (der
      Stundenplan zeigt Ferien auch anonym), Schreiben nur für `current_role() = 'admin'`.
      Die Server-Aktionen benutzen den Client des Nutzers, nicht `service_role` —
      RLS bleibt also die letzte Instanz, auch wenn eine Prüfung im Code fehlte
- [x] **Eingabeprüfung / XSS:** Platzhalterwerte in Benachrichtigungen laufen
      durch `escapeHtml` (`substituteHtml`), ein Kursname mit `<script>` landet
      escaped in der E-Mail. Im Stundenplan escapet React
- [x] **Cron-Endpunkt:** `/api/cron/notifications` verlangt den Bearer-Token;
      ohne ihn 401 und kein Vollzug (durch Test abgedeckt)
- [x] **Keine personenbezogenen Daten** in der Nutzlast der neuen
      Benachrichtigung — nur Kursnamen und ein Datum
- [x] **Keine neuen API-Routen**, keine neuen Geheimnisse, keine `service_role`
      im Browser

### Automatisierte Tests

| Lauf | Ergebnis |
|---|---|
| `npm test` (Vitest) | 485 bestanden, 38 Dateien |
| `npm run test:e2e` (Chromium + Mobile Safari) | **1066 bestanden, 4 übersprungen, 0 Fehler** (1,9 h) |
| `npx tsc --noEmit` | sauber |
| `npm run lint` | sauber |
| `npm run build` | erfolgreich |

Neu in dieser Runde: 16 E2E-Fälle in `tests/PROJ-51-kurszeitraeume-und-ferien.spec.ts`,
5 in `tests/kursumwandlung-vollzug.spec.ts`, 14 Unit-Tests für `kursanzeige`,
1 für `fehlendeAnwesenheit` bei ausgelaufenem Kurs.

**Browser:** Chromium und Mobile Safari (WebKit) laufen in der Projekt-Konfiguration.
Firefox ist dort nicht eingerichtet und wurde **nicht** geprüft.

### Gefundene Fehler

#### BUG-1: Ein Kurs mit Enddatum verschwindet, wenn man ihn umwandelt
- **Schwere:** Hoch
- **Schritte:**
  1. Kurs „Beginner 1" mit „läuft bis 21.12." speichern
  2. Umwandlung nach „Beginner 2" zum 07.01. vormerken
  3. Erwartet: Ab dem 07.01. steht „Beginner 2" im Stundenplan
  4. Tatsächlich: Ab dem 22.12. fällt der Kurs aus dem Plan (`imStundenplan`
     prüft `runs_until < heute`). Der nächtliche Lauf benennt ihn am 07.01. um,
     rührt `runs_until` aber nicht an — der Kurs bleibt für immer unsichtbar.
     Die Kunden haben vorher die Ankündigung bekommen, dass es weitergeht.
- **Warum das der Hauptweg ist:** Genau diese Kombination steht als Beispiel im
  Entwurf dieser Spec („noch bis 21.12." und „ab 7.1.: Salsa Beginner 2").
- **Mögliche Richtungen:** Die Umwandlung setzt den Zeitraum mit (Formular fragt
  „läuft bis" der neuen Staffel ab), oder der Vollzug leert `runs_until`, oder
  das Formular warnt, wenn der Stichtag hinter dem Kursende liegt.
- **Priorität:** Vor dem Deploy beheben

#### BUG-2: Die zweite Vormerkung wird nie angekündigt
- **Schwere:** Mittel
- **Schritte:**
  1. Umwandlung vormerken, nächtlicher Lauf kündigt an (`pending_announced_at` gesetzt)
  2. Vormerkung zurücknehmen (etwa weil der Name falsch war)
  3. Neue Vormerkung mit korrigiertem Namen anlegen
  4. Erwartet: Die Kunden erfahren von der neuen Umwandlung
  5. Tatsächlich: `kursUmwandlungZuruecknehmen` und `kursUmwandlungVormerken`
     leeren `pending_announced_at` nicht. Der Lauf hält den Kurs für „schon
     informiert" und schweigt; umgewandelt wird trotzdem
- **Beleg:** `src/lib/actions/admin/courses.ts` — beide `update`-Aufrufe lassen
  die Spalte aus. Der Kommentar in `20260911040000` verspricht das Gegenteil
  („Wird mit der Vormerkung zusammen geleert")
- **Priorität:** Vor dem Deploy beheben

#### BUG-3: „Dieser Kurs ist beendet" erscheint auch bei gekündigten Abos
- **Schwere:** Mittel
- **Schritte:**
  1. Ein gekündigtes Abo an einem ausgelaufenen Kurs
  2. „Mein Profil" → „Mein Abo" öffnen
  3. Erwartet: kein Handlungsaufruf — es gibt nichts umzubuchen
  4. Tatsächlich: „Dieser Kurs ist beendet. Buche auf einen laufenden Kurs um —
     dein Abo bleibt bestehen." Beides stimmt nicht, und der Umbuchen-Knopf
     fehlt dort ohnehin (`canSwitch` schließt gekündigte aus)
- **Gleiches gilt für:** das Kundenprofil im Admin („Kurs beendet — Umbuchen
  nötig"). In der Kundenliste ist der Fall bereits abgefangen — die drei
  Lesestellen sind uneinheitlich
- **Priorität:** Vor dem Deploy beheben

#### BUG-4: Der Hinweis im Buchungsdialog spricht vom Abo, steht aber über allen drei Reitern
- **Schwere:** Niedrig
- **Tatsächlich:** „Dein Abo läuft danach weiter — du kannst es jederzeit auf
  einen anderen Kurs umbuchen." steht auch über „Probestunde" und „Drop-in",
  wo es kein Abo gibt
- **Priorität:** Nächste Runde

#### BUG-5: Ein ausgelaufener Kurs ist über seine Detailseite weiter buchbar
- **Schwere:** Niedrig bis Mittel
- **Schritte:**
  1. `/kurse/<id>` eines ausgelaufenen Kurses öffnen (alter Link, Lesezeichen)
  2. Tatsächlich: Die Seite lädt, Einstiegstermine stehen zur Wahl, ein
     Flatrate-Kunde kann den Kurs hinzufügen. Stundenplan und Katalog
     verstecken ihn — die Detailseite prüft den Zeitraum nicht
- **Anmerkung:** Dass Einstiegstermine nie auf die Zukunft gefiltert werden,
  stammt aus PROJ-8 und ist älter als dieses Feature
- **Priorität:** Nächste Runde

#### BUG-6: 36-px-Schaltflächen auf der Ferienseite
- **Schwere:** Niedrig
- **Tatsächlich:** „Entfernen" nutzt `size="sm"` (36 px) statt der Projektnorm
  von 44 px. Dieselbe Klasse wie PROJ-49 BUG-3, der noch offen ist
- **Priorität:** Zusammen mit PROJ-49 BUG-3

### Zusammenfassung

- **Akzeptanzkriterien:** 20 von 22 bestanden
- **Fehler:** 6 (0 kritisch, 1 hoch, 2 mittel, 3 niedrig)
- **Sicherheit:** keine Befunde
- **Regression:** keine — 1066 E2E-Fälle bestanden, 0 Fehler
- **Produktionsreif:** **NEIN** — BUG-1 muss vorher weg
- **Empfehlung:** BUG-1 bis BUG-3 beheben, dann erneut `/qa`. BUG-4 bis BUG-6
  sind vertretbar für eine spätere Runde

---

## QA Test Results — zweiter Durchgang (nach den Behebungen)

**Getestet:** 2026-09-11
**Prüfer:** QA Engineer (AI)

### Die sechs Befunde des ersten Durchgangs

| Befund | Stand | Nachgewiesen durch |
|---|---|---|
| BUG-1 Kurs verschwindet beim Umwandeln | behoben | „Die neue Staffel bringt ihren eigenen Zeitraum mit" und „Ohne neues Ende läuft die Staffel unbefristet weiter" (`kursumwandlung-vollzug`) |
| BUG-2 Zweite Vormerkung wird nicht angekündigt | behoben | „Der Betreiber merkt eine Umwandlung vor und nimmt sie zurück" prüft jetzt `pending_announced_at` |
| BUG-3 Hinweis an gekündigtem Abo | behoben | „Ein gekündigtes Abo bekommt keinen Handlungsaufruf mehr" |
| BUG-4 Abo-Satz über allen Reitern | behoben | „Wer einen bald endenden Kurs buchen will, erfährt es vorher" prüft beide Reiter |
| BUG-5 Ausgelaufener Kurs über Detailseite buchbar | behoben | „Ein ausgelaufener Kurs hat auch keine Detailseite mehr" |
| BUG-6 36-px-Tippfläche | behoben | Sichtprüfung (`min-h-11`) |

**Akzeptanzkriterien: 22 von 22 bestanden.**

### Abweichung von der beschlossenen Lösung

Bei BUG-1 war „der Stichtag wird zum Beginn der neuen Staffel" vereinbart und
zuerst auch so gebaut. Beim Nachprüfen zeigte sich, dass die Anwesenheitsliste
des Lehrers ihre Historie über `runs_from` begrenzt
(`src/app/(staff)/lehrer/[courseId]/page.tsx`): Auf den Stichtag gesetzt wäre
alles vor der Umwandlung aus der Liste verschwunden — genau das, was das
Kriterium „die Historie steht unverändert da" schützt. Umgesetzt ist deshalb
nur das Ende; der Beginn bleibt. Die Lücke zwischen zwei Staffeln trägt sich
dabei von selbst, weil bis zum Stichtag noch das alte Ende gilt.

### Automatisierte Tests

| Lauf | Ergebnis |
|---|---|
| `npm test` (Vitest) | 485 bestanden |
| `npx tsc --noEmit` / `npm run lint` / `npm run build` | sauber |
| Voller E2E-Lauf (Chromium + Mobile Safari) | **1073 bestanden, 4 übersprungen, 1 gefallen** von 1078 (2,0 h) |

Der eine Fehlschlag liegt in PROJ-12 (Warteliste), nicht in PROJ-51.

### Befund zur Testzuverlässigkeit — und ein Produktrisiko dahinter

Zwei volle Durchgänge, **verschiedene** Fehlschläge:

| Durchgang | Gefallen | In Einzelläufen |
|---|---|---|
| 1 | 9 Fälle in PROJ-8 (Kursbuchung, Chromium) | 16/16 grün; mit PROJ-51 davor 34/34 grün |
| 2 | 1 Fall in PROJ-12 (Warteliste, Chromium) | 8/8 grün |

Disjunkte Mengen, beide in Einzelläufen grün, dieselben Fälle im selben Lauf
unter Mobile Safari grün: Das ist Zeitverhalten, keine Regression. Die Ursache
ließ sich eingrenzen:

Alle betroffenen Fälle senden beim Absenden eine Benachrichtigung. Die
Server-Aktionen warten darauf **inline** (`await enqueueAndDispatch(...)` in
`admin/bookings.ts`, `waitlist`, `admin-alerts`), und der Mailversand läuft im
Test gegen echtes SMTP mit Empfängern auf `.test`. Der Nodemailer-Transport in
`src/lib/notifications/mailer.ts` setzt **keine Zeitlimits** — es gelten die
Vorgaben der Bibliothek (Verbindungsaufbau bis 2 Minuten, Socket bis 10). Wird
ein Versand langsam, läuft der Test in seine feste Wartezeit
(`waitForTimeout(800)`) und prüft, bevor die Aktion fertig ist.

**Das ist nicht nur ein Testproblem.** Dieselbe Kette bedeutet in Produktion:
Ein hängender Mailserver lässt die Buchung eines Kunden minutenlang stehen.

- **Schwere:** Mittel
- **Empfehlung:** `connectionTimeout`, `greetingTimeout` und `socketTimeout` am
  Transport setzen (wenige Sekunden). Das macht den Versandfehler schnell und
  sichtbar, statt die auslösende Handlung mitzuziehen — und nimmt der Testsuite
  ihre Hauptquelle für Zufallsfehler
- **Zuständig:** nicht PROJ-51. Gehört in ein eigenes Ticket, gefunden bei
  diesem Durchgang

### Zusammenfassung

- **Akzeptanzkriterien:** 22/22 bestanden
- **Offene Fehler aus Durchgang 1:** 0 von 6
- **Neue Fehler in PROJ-51:** keine
- **Sicherheit:** keine Befunde (siehe Durchgang 1)
- **Produktionsreif:** **JA**
- **Daneben gefunden:** fehlende SMTP-Zeitlimits (Mittel, eigenes Ticket)
