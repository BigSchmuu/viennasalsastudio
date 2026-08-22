# PROJ-36: Buchhaltungs-Export mit Summen

## Status: Planned
**Created:** 2026-08-22
**Last Updated:** 2026-08-22

## Dependencies
- Requires: PROJ-10 (Rechnungsarchiv) — liefert die Rechnungen, den bestehenden CSV-Export und den USt-Satz aus den Rechnungseinstellungen.

## User Stories
- Als Betreiber möchte ich im CSV-Export sofort die Gesamtsumme sehen, statt jede Kundenzeile selbst zusammenrechnen zu müssen.
- Als Betreiber möchte ich die Summen nach Steuersatz getrennt sehen, damit ich sie direkt für die Umsatzsteuer-Voranmeldung verwenden kann.
- Als Betreiber möchte ich einen abgeschlossenen Monat mit einem Klick exportieren, statt jedes Mal Von-/Bis-Datum von Hand zu setzen.
- Als Betreiber möchte ich, dass mein Steuerberater eine Datei bekommt, die ohne Rückfragen verständlich ist.

## Out of Scope
- **Bar- und Vor-Ort-Zahlungen.** Der Export enthält ausschließlich Rechnungen, und Rechnungen entstehen aktuell **nur** aus SEPA-Lastschriftläufen. Drop-in-Stunden und vor Ort bezahlte Event-Tickets erzeugen keine Rechnung und tauchen deshalb **nicht** im Export auf. Das ist eine bekannte Lücke (siehe Decision Log) — sie zu schließen wäre ein eigenes Feature ("Kassenbuch"), das bewusst zurückgestellt wurde.
- **Monatssperre / Festschreibung.** Ein exportierter Monat wird nicht gegen spätere Änderungen gesperrt.
- **DATEV- oder sonstiges Steuerberater-Spezialformat.** Es bleibt bei CSV.
- **Automatischer Versand an den Steuerberater** (z.B. monatliche E-Mail) — Datei wird manuell heruntergeladen.
- **Einnahmen-Ausgaben-Rechnung / Ausgabenseite.** Nur Einnahmen aus Rechnungen.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Summen im CSV
- [ ] Angenommen der Admin exportiert Rechnungen als CSV, wenn er die Datei öffnet, dann steht unter den Einzelzeilen eine Zeile "GESAMT" mit der Summe von Netto, USt-Betrag und Brutto.
- [ ] Angenommen die exportierten Rechnungen haben unterschiedliche USt-Sätze, wenn der Admin die Datei öffnet, dann gibt es zusätzlich pro USt-Satz eine Zwischensummen-Zeile (z.B. "Zwischensumme 20%") mit Netto, USt-Betrag und Brutto.
- [ ] Angenommen alle Rechnungen haben denselben USt-Satz, wenn der Admin exportiert, dann erscheint trotzdem die Zwischensummen-Zeile für diesen Satz (einheitliches Format, keine Sonderfälle für den Steuerberater).
- [ ] Angenommen der Export enthält Rücklastschriften, wenn die Summen gebildet werden, dann werden diese **separat** ausgewiesen und nicht in die reguläre Gesamtsumme eingerechnet (siehe Edge Cases).
- [ ] Angenommen der Export enthält keine einzige Rechnung, wenn der Admin exportiert, dann enthält die Datei die Kopfzeile und eine GESAMT-Zeile mit 0,00 — keine leere Datei und kein Fehler.

### Monats-Export
- [ ] Angenommen der Admin ist im Rechnungsarchiv, wenn er einen Monat aus einer Auswahl wählt (z.B. "August 2026"), dann werden Von-/Bis-Datum automatisch auf den ersten und letzten Tag dieses Monats gesetzt.
- [ ] Angenommen ein Monat ist gewählt, wenn der Admin exportiert, dann heißt die Datei erkennbar nach diesem Monat (z.B. `rechnungsjournal-2026-08.csv`) statt immer gleich.
- [ ] Angenommen der Admin nutzt weiterhin freie Von-/Bis-Datumsfelder, wenn er exportiert, dann funktioniert das unverändert wie bisher.

### Verständlichkeit für den Steuerberater
- [ ] Angenommen der Steuerberater öffnet die Datei, wenn er sie in Excel/LibreOffice lädt, dann sind Zahlen als Zahlen erkennbar (Dezimaltrennung passend zu de-AT) und Umlaute korrekt dargestellt.
- [ ] Angenommen der Export enthält Summen, wenn der Steuerberater die Datei sortiert oder filtert, dann sind die Summenzeilen klar als solche erkennbar (eigene Beschriftung in der Kundenspalte, keine Rechnungsnummer).

## Edge Cases
- Was passiert mit Rücklastschriften in den Summen? → Sie sind **kein** vereinnahmtes Geld. Sie werden in einer eigenen Zeile ("davon Rücklastschriften") ausgewiesen und **nicht** in die GESAMT-Summe eingerechnet, damit die Zahl den tatsächlichen Zahlungseingang widerspiegelt.
- Was passiert, wenn der USt-Satz zwischenzeitlich geändert wurde und alte Rechnungen einen anderen Satz haben? → Die Zwischensummen gruppieren nach dem **auf der Rechnung gespeicherten** Satz, nicht nach dem aktuell eingestellten.
- Was passiert bei Rundungsdifferenzen (Summe der gerundeten Einzelbeträge ≠ gerundete Gesamtsumme)? → Es wird die Summe der bereits gerundeten Einzelwerte gebildet, damit die Spalte von Hand nachrechenbar ist.
- Was passiert, wenn der Kundenname ein Semikolon oder Anführungszeichen enthält? → Wird wie bisher korrekt CSV-escaped (bestehende `toCsvRow`-Logik).
- Was passiert bei einem Monat ohne Rechnungen (z.B. Sommerpause)? → Datei mit Kopfzeile und Nullsummen, kein Fehler.

## Technical Requirements (optional)
- Security: Export bleibt Admin-only (`requireAdmin`, wie bisher).
- Die Summen müssen serverseitig aus denselben Daten berechnet werden wie die Einzelzeilen — keine getrennte zweite Abfrage, die abweichen könnte.

## Open Questions
- [ ] Erwartet der Steuerberater ein bestimmtes Trennzeichen (Semikolon vs. Komma) oder eine bestimmte Zeichenkodierung? → Bei Bedarf nachfragen; Standard bleibt vorerst wie im bestehenden Export.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Summenzeile **plus** Aufschlüsselung nach USt-Satz | Der Steuerberater braucht die Trennung nach Steuersatz für die Umsatzsteuer-Voranmeldung; eine reine Gesamtsumme müsste er wieder selbst aufteilen | 2026-08-22 |
| Rücklastschriften separat ausweisen, nicht in GESAMT einrechnen | Zurückgebuchtes Geld ist nicht eingegangen — sonst wäre die Gesamtsumme schlicht falsch | 2026-08-22 |
| Keine Monatssperre/Festschreibung | Deutlich einfacher, und da Rechnungen ausschließlich automatisch aus SEPA-Läufen entstehen, verändern sich abgeschlossene Monate praktisch nicht nachträglich | 2026-08-22 |
| Kein DATEV-Format, weiterhin CSV | Kein bekannter Bedarf; CSV ist von jedem Steuerberater verarbeitbar. Kann nachgezogen werden, falls der Steuerberater es verlangt | 2026-08-22 |
| Bar-/Vor-Ort-Zahlungen bleiben außen vor | Sie werden im System nirgends erfasst — das zu ändern ist ein eigenes Feature. **Wichtig:** Der Export ist dadurch bewusst unvollständig und bildet nur den SEPA-Umsatz ab | 2026-08-22 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
