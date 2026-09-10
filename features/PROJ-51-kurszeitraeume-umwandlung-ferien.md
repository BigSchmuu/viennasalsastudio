# PROJ-51: Kurszeiträume, Umwandlung und Ferien im Stundenplan

## Status: Planned
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
- [ ] **Ändert sich bei einer Umwandlung der Preis?** Vorerst nein — falls
      Beginner 2 anders kostet, müsste die Vormerkung auch den Preis tragen und
      die laufenden Abos anfassen.
- [ ] **Sollen Ferien die Kurszeiträume verlängern?** Wenn ein Achtwochenkurs
      zwei Ferienwochen enthält, endet er nach zehn Kalenderwochen — soll das
      Enddatum automatisch nachrücken oder trägt der Betreiber es selbst ein?
- [ ] Wie viele Tage vorher soll die Benachrichtigung über eine Umwandlung
      hinausgehen?

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
| Kein wochenweises Blättern im Stundenplan | Der Stundenplan beantwortet „was gibt es?", nicht „was ist am 14. Januar?". Zeiträume gehören in den Eintrag, nicht in eine Navigation | 2026-09-11 |

### Technical Decisions

_Wird von `/architecture` ergänzt._
