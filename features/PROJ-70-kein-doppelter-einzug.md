# PROJ-70: Kein zweiter Einzug im selben Zyklus

## Status: In Review
**Created:** 2026-09-25
**Last Updated:** 2026-09-25

## Dependencies
- Requires: PROJ-7 (SEPA-Mandate & Sammel-Einzug) — der Lauf und seine Positionen
- Requires: PROJ-47 (Lauf korrigieren) — die Liste „Offene Positionen"
- Berührt: PROJ-51 (Ferien) — die Ferienzeiträume verlängern den Abstand

## Anlass

Aus dem Betrieb gemeldet (2026-09-24): Ein zweiter Lastschriftlauf im selben Monat nahm alle Abos
noch einmal mit. Bei den Event-Tickets gab es diese Sperre längst — ein Ticket, das schon in einer
Position steht, kommt nicht wieder —, bei den Abos fehlte sie. Gewarnt wurde nur, wenn ein Lauf mit
**demselben Fälligkeitsdatum** existierte.

## User Stories

- Als Betreiber möchte ich einen zweiten Lauf anlegen können, ohne dass jemand doppelt belastet wird.
- Als Betreiber möchte ich sehen, welche Abos ein Lauf ausgelassen hat und warum.
- Als Betreiber möchte ich ein ausgelassenes Abo trotzdem von Hand nachtragen können — etwa nach
  einer Rücklastschrift.
- Als Kunde möchte ich in einem Monat mit Ferienwoche nicht früher wieder belastet werden, nur weil
  vier Wochen abgelaufen sind.

## Out of Scope

- **Rückwirkende Bereinigung** bereits doppelt eingezogener Beträge — das ist Buchhaltung, kein Code.
  Stornos und Gutschriften gibt es seit PROJ-46.
- **Eine eigene Zyklusverwaltung je Abo** — gerechnet wird aus den tatsächlichen Einzügen, nicht aus
  einem zweiten, gepflegten Datum, das auseinanderlaufen könnte.
- **Automatisches Nachholen** eines vergessenen Monats — der Betreiber legt den Lauf an, die App
  rechnet nur nach, ob er fällig ist.

## Acceptance Criteria

- [ ] Angenommen ein Abo war im letzten Lauf dabei, wenn der Betreiber neun Tage später einen
      weiteren Lauf anlegt, dann ist dieses Abo nicht darin.
- [ ] Angenommen ein Lauf hat Abos ausgelassen, wenn er sich öffnet, dann steht dort, wie viele es
      waren und warum.
- [ ] Angenommen ein Abo wurde ausgelassen, wenn der Betreiber „Position hinzufügen" öffnet, dann
      steht es dort — mit dem Datum des Einzugs, der dagegen spricht.
- [ ] Angenommen seit dem letzten Einzug sind vier Wochen vergangen, dann ist das Abo wieder dabei.
- [ ] Angenommen zwischen zwei Einzügen liegt eine Ferienwoche, dann verschiebt sich der nächste
      Einzug um genau diese Tage.
- [ ] Angenommen ein Abo wurde noch nie eingezogen, dann ist es immer dabei.
- [ ] Angenommen ein Einzug liegt weit in der Zukunft, wenn ein Lauf für einen früheren Zeitpunkt
      entsteht, dann sperrt dieser späte Einzug ihn nicht.
- [ ] Angenommen alle Abos sind bereits eingezogen, wenn der Betreiber einen Lauf anlegt, dann sagt
      die Meldung, dass es keine offenen Beiträge gibt — und wie viele ausgelassen wurden.

## Edge Cases

- **Entwürfe zählen mit**: Ein Abo, das in einem nicht verworfenen Entwurf steht, gilt als
  eingeplant. Zwei Entwürfe zum selben Zeitraum wären sonst zwei Abbuchungen, sobald beide bestätigt
  werden. Verwerfen räumt den Entwurf weg und gibt das Abo wieder frei.
- **Ferien am Rand**: Gezählt werden nur die Ferientage, die wirklich im Fenster liegen; der Tag des
  letzten Einzugs zählt nicht mit.
- **Ferien, die in die Verschiebung fallen**: Eine Woche schiebt den Termin nach hinten — liegt dort
  die nächste Ferienwoche, zählt auch sie. Die Rechnung läuft deshalb, bis sie sich nicht mehr
  ändert.
- **Ein Einzug in der Zukunft**: kann in der Produktion kaum vorkommen, in der Testdatenbank aber
  sehr wohl. Die Regel fragt deshalb nicht „wann war der letzte?", sondern „gibt es in diesem
  Zeitraum schon einen?".

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Vier Wochen Abstand, verlängert um Ferientage | Wunsch des Betreibers. In einer Woche ohne Unterricht läuft kein Zyklus weiter — der Kunde soll dafür nicht früher zahlen. | 2026-09-25 |
| Ausgelassene Abos bleiben unter „Offene Positionen", mit Hinweis | Ausfiltern hätte die Möglichkeit genommen, nach einer Rücklastschrift bewusst nachzutragen. Der Hinweis verhindert, dass es versehentlich passiert. | 2026-09-25 |
| Entwürfe zählen mit | Ein Entwurf ist die Absicht, einzuziehen. Zwei Entwürfe zum selben Zeitraum wären zwei Abbuchungen. | 2026-09-25 |

### Technical Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Die Regel steht in einer eigenen Datei, nicht in der Aktion | Sie entscheidet an zwei Stellen — beim Anlegen und in der Liste „Offene Positionen". Zwei Fassungen liefen auseinander, und die Liste böte an, was der Lauf gerade ausgelassen hat. | 2026-09-25 |
| Prüfung gegen **alle** Einzüge, in beide Richtungen | Ein erster Entwurf verglich nur mit dem jüngsten. Ein Lauf mit Datum 2028 in der Testdatenbank sperrte damit jeden früheren Lauf vollständig. Gefunden von den bestehenden Suiten, nicht von mir. | 2026-09-25 |
| Keine Migration | Alles steht schon da: die Fälligkeitsdaten der Läufe und die Ferienzeiträume. | 2026-09-25 |

---

## QA Test Results (2026-09-25)

**Empfehlung: bereit für die Produktion.** Keine Migration, keine Datenbankänderung.

| | |
|---|---|
| Regeln (Unit) | 15 |
| Browser (E2E) | 5 neu, 57 in den Lastschrift-Suiten insgesamt |
| Regeln und Datenbank gesamt | 997 grün |
| Produktfehler gefunden | 1 in der eigenen Regel (behoben, siehe unten) |

### Was geprüft ist

**Die Rechnung** an allen Rändern: vier Wochen ohne Ferien, mit einer Ferienwoche, mit Ferien, die
erst durch die Verschiebung ins Fenster geraten, mit teilweise überlappenden Ferien, ohne vorherigen
Einzug, und mit einem Einzug weit in der Zukunft.

**Der Weg durch die Verwaltung**: erster Lauf nimmt das Abo mit, ein zweiter neun Tage später lässt
es aus und sagt das, von Hand geht es trotzdem — mit sichtbarem Grund —, nach vier Wochen ist es
wieder dabei, und eine Ferienwoche verschiebt den Termin.

**Die bestehenden Lastschrift-Suiten** (PROJ-7, PROJ-10, PROJ-44, PROJ-47) laufen mit der neuen
Regel durch. Ihre Fälligkeitsdaten lagen teils wenige Tage auseinander — was jetzt zu Recht nicht
mehr geht; sie haben eigene Zyklen bekommen.

### Was die Tests gefunden haben

**Ein Denkfehler in der ersten Fassung**: Verglichen wurde mit dem **jüngsten** Einzug. Ein Lauf mit
Datum 2028 in der Testdatenbank machte damit jeden früheren Lauf unmöglich — kein einziges Abo kam
mehr hinein. In der Produktion wäre das beim Nachholen eines vergessenen Monats aufgefallen.
Behoben: Die Regel prüft gegen alle Einzüge und in beide Richtungen.

### Nicht geprüft

Ob in der Produktion bereits doppelt eingezogen wurde. Das steht in den Läufen und Rechnungen und
ist Buchhaltung, kein Code.

## Deployment

**Produktion:** https://app.viennasalsastudio.at · **Ausgerollt:** 2026-09-25 · **Tag:** `v1.69.0-PROJ-70`

Keine Migration — reiner Code. Die Regel rechnet aus dem, was ohnehin dasteht: den
Fälligkeitsdaten der Läufe und den Ferienzeiträumen.

### Was erst beim nächsten Lauf sichtbar wird

Bestehende Läufe ändern sich nicht. Beim nächsten Anlegen zeigt sich, ob Abos ausgelassen werden —
der Hinweis steht dann oben auf der Laufseite.

### Zurückrollen

Gefahrlos: Die vorige Fassung nimmt wieder alle aktiven Abos mit. An den Daten ändert sich nichts.
