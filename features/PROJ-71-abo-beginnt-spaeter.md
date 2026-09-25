# PROJ-71: Ein Abo wird erst ab seinem Beginn eingezogen

## Status: In Review
**Created:** 2026-09-25
**Last Updated:** 2026-09-25

## Dependencies
- Requires: PROJ-7 (SEPA-Sammel-Einzug) — die Auswahl der Positionen
- Requires: PROJ-9 (Abo-Verwaltung) — `cycle_anchor_date` als Einstiegstermin
- Berührt: PROJ-70 (kein zweiter Einzug im Zyklus) — dieselbe Auswahlstelle
- Verwandt: PROJ-69 (Kursplatz gilt erst ab dem Starttermin) — dieselbe Lücke, andere Stelle

## Anlass

Frage des Betreibers: Soll ein Lauf Abos einbeziehen, die erst in der Zukunft starten? Er tat es —
ohne jede Prüfung. Ein Abo mit Beginn am 1. Dezember stand im September-Lauf, sobald es bestätigt
war. Der Kunde zahlte, bevor er tanzt.

Dass die Gegenrichtung längst geprüft wurde, macht es deutlicher: Ein Abo, dessen **Kündigung** zum
Fälligkeitstag wirksam wird, fliegt aus dem Lauf. Der Beginn wurde nur eben nie betrachtet.

Dieselbe Lücke hatte PROJ-69 einen Tag zuvor beim Einchecken geschlossen — dort galt ein Kursplatz
ab der Bestätigung statt ab dem Starttermin. Die Ursache ist dieselbe Denkweise: „aktiv" wurde mit
„läuft schon" verwechselt.

## User Stories

- Als Kunde möchte ich erst ab meinem Einstiegstermin zahlen.
- Als Betreiber möchte ich nicht erklären müssen, warum im September abgebucht wurde, obwohl der
  Kurs erst im Dezember beginnt.
- Als Betreiber möchte ich ein solches Abo trotzdem bewusst einziehen können, wenn ein Kunde
  ausdrücklich im Voraus zahlen will.

## Out of Scope

- **Anteilige Beträge** für einen Einstieg mitten im Zyklus — der Preis steht am Abo und bleibt.
- **Automatische Vorauszahlung** kurz vor dem Beginn — wer den Lauf ein paar Tage vor Monatsbeginn
  anlegt, nimmt den Neustarter noch nicht mit. Das ist die bewusste Entscheidung des Betreibers;
  von Hand geht es trotzdem.
- **Rückwirkende Korrektur** bereits zu früh eingezogener Beträge — Buchhaltung, kein Code.

## Acceptance Criteria

- [ ] Angenommen ein Abo beginnt nach dem Fälligkeitsdatum des Laufs, wenn der Betreiber den Lauf
      anlegt, dann ist es nicht darin.
- [ ] Angenommen ein Abo beginnt am Fälligkeitstag selbst, dann ist es dabei.
- [ ] Angenommen ein Abo beginnt vor dem Fälligkeitstag, dann ist es dabei — wie bisher.
- [ ] Angenommen ein Abo wurde wegen seines Beginns ausgelassen, wenn der Betreiber „Position
      hinzufügen" öffnet, dann steht es dort mit dem Satz „Beginnt erst am …".
- [ ] Angenommen ein Lauf hat Abos ausgelassen, dann nennt der Hinweis oben beide möglichen Gründe:
      Zyklus oder Beginn.

## Edge Cases

- **Beginn genau am Fälligkeitstag**: dabei. Der Vergleich ist „nicht nach dem Fälligkeitstag".
- **Beginn und Kündigung am selben Tag**: Die Kündigungsregel greift zuerst und nimmt es heraus —
  beides zusammen ergibt ohnehin kein Abo, das läuft.
- **Kein Beginn hinterlegt**: kann nicht vorkommen, `cycle_anchor_date` ist Pflichtfeld mit
  Vorgabewert „heute".

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Einbezogen wird ab dem Starttermin, nicht vorher | Entscheidung des Betreibers. Spiegelbild der bestehenden Kündigungsregel und in einem Satz erklärbar: Wer im Oktober anfängt, zahlt im Oktober. | 2026-09-25 |
| Von Hand bleibt es möglich | Ein Kunde, der im Voraus zahlen will, soll nicht an der Regel scheitern. Der Hinweis daneben verhindert, dass es versehentlich passiert. | 2026-09-25 |

### Technical Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Prüfung an derselben Stelle wie die Zyklussperre | Beide beantworten „gehört dieses Abo in diesen Lauf?". Getrennte Stellen liefen auseinander. | 2026-09-25 |
| Keine Migration | `cycle_anchor_date` steht seit PROJ-9 an jedem Abo. | 2026-09-25 |

---

## QA Test Results (2026-09-25)

**Empfehlung: bereit für die Produktion.** Keine Migration.

| | |
|---|---|
| Browser (E2E) | 2 neu, 7 in der Suite insgesamt |
| Lastschrift-Suiten | PROJ-7, PROJ-10, PROJ-44, PROJ-47 unverändert grün |
| Produktfehler gefunden | 0 |

### Was geprüft ist

Ein Abo mit Beginn im August steht nicht im Lauf vom Juni — und ab September sehr wohl. In der
Liste „Offene Positionen" erscheint es mit dem Satz „Beginnt erst am …", ist also bewusst
nachtragbar. Zur Gegenprobe wurde die Regel einmal entfernt: Die Prüfung fiel sofort mit „Zu früh
eingezogen".

### Nicht geprüft

Ob in der Produktion bereits zu früh eingezogen wurde. Das steht in den Läufen und Rechnungen.

## Deployment

**Produktion:** https://app.viennasalsastudio.at · **Ausgerollt:** 2026-09-25 · **Tag:** `v1.70.0-PROJ-71`

Keine Migration — reiner Code. `cycle_anchor_date` steht seit PROJ-9 an jedem Abo.

### Was erst beim nächsten Lauf sichtbar wird

Bestehende Läufe bleiben unverändert. Beim nächsten Anlegen zeigt sich, ob Abos wegen ihres Beginns
ausgelassen werden — der Hinweis steht dann oben auf der Laufseite, der Grund je Abo unter „Offene
Positionen".

### Zurückrollen

Gefahrlos: Die vorige Fassung nimmt wieder alle aktiven Abos mit, unabhängig vom Beginn.
