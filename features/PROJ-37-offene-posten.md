# PROJ-37: Offene Posten (Rücklastschriften-Übersicht)

## Status: Planned
**Created:** 2026-08-22
**Last Updated:** 2026-08-22

## Dependencies
- Requires: PROJ-10 (Rechnungsarchiv) — Rücklastschriften werden dort bereits markiert (`invoices.bounced_at`).
- Requires: PROJ-7 (SEPA-Lastschriftmandate) — der Lastschriftlauf erzeugt die Rechnungen, die zurückgebucht werden können.

## User Stories
- Als Betreiber möchte ich auf einen Blick sehen, welche Kunden mir noch Geld schulden, statt das Rechnungsarchiv durchzusehen.
- Als Betreiber möchte ich die Gesamthöhe der offenen Beträge kennen, um einschätzen zu können, wie viel Geld tatsächlich fehlt.
- Als Betreiber möchte ich einen betroffenen Kunden mit einem Klick per E-Mail an die offene Zahlung erinnern können.
- Als Betreiber möchte ich einen Posten als erledigt markieren können, wenn der Kunde anders bezahlt hat (z.B. bar oder per Überweisung).

## Out of Scope
- **Unbezahlte Vor-Ort-Zahlungen.** Drop-ins und reservierte Event-Tickets werden nirgends als "bezahlt/unbezahlt" erfasst — es gibt schlicht keine Datenbasis dafür. Bewusste Entscheidung (siehe Decision Log); nur Rücklastschriften gelten als offener Posten.
- **Automatisches Mahnwesen** (Mahnstufen, Fristen, Mahngebühren, automatischer Versand nach X Tagen). Erinnerungen werden manuell ausgelöst.
- **Erneuter Lastschrifteinzug** eines zurückgebuchten Betrags aus der App heraus.
- **Verbuchung von Zahlungseingängen.** "Erledigt" ist ein Haken, keine Buchung — die App führt kein Konto.
- **Rücklastschrift-Gebühren** weiterberechnen.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Übersicht
- [ ] Angenommen ein Admin ist eingeloggt, wenn er im Admin-Menü "Offene Posten" öffnet, dann sieht er eine Liste aller zurückgebuchten Rechnungen mit Kunde, Rechnungsnummer, Datum, Betrag und wie lange der Posten schon offen ist.
- [ ] Angenommen es gibt offene Posten, wenn die Seite geladen wird, dann zeigt eine Kachel die Anzahl und die Gesamtsumme der offenen Beträge.
- [ ] Angenommen es gibt keine offenen Posten, wenn der Admin die Seite öffnet, dann sieht er einen Leerzustand ("Keine offenen Posten") statt einer leeren Tabelle.
- [ ] Angenommen ein Posten ist bereits als erledigt markiert, wenn die Seite geladen wird, dann erscheint er **nicht** mehr in der Liste der offenen Posten.
- [ ] Angenommen ein nicht-Admin ruft die Seite direkt per URL auf, dann wird der Zugriff verweigert.

### Erinnerung senden
- [ ] Angenommen ein offener Posten ist gelistet, wenn der Admin auf "Erinnerung senden" klickt und bestätigt, dann erhält der Kunde eine E-Mail mit Rechnungsnummer, Betrag und dem Hinweis, dass die Lastschrift zurückgebucht wurde.
- [ ] Angenommen eine Erinnerung wurde bereits verschickt, wenn der Admin die Liste ansieht, dann sieht er, wann zuletzt erinnert wurde.
- [ ] Angenommen der Admin klickt erneut auf "Erinnerung senden", dann ist das möglich (kein Limit), der Zeitstempel wird aktualisiert.
- [ ] Angenommen der E-Mail-Versand schlägt fehl, wenn der Admin auf "Erinnerung senden" klickt, dann erscheint eine Fehlermeldung und der Posten wird **nicht** als erinnert markiert.

### Erledigt markieren
- [ ] Angenommen ein Kunde hat anderweitig bezahlt, wenn der Admin den Posten als "erledigt" markiert und bestätigt, dann verschwindet er aus der Liste und die Gesamtsumme sinkt entsprechend.
- [ ] Angenommen ein Posten wurde versehentlich als erledigt markiert, wenn der Admin ihn in einer Ansicht "auch erledigte anzeigen" wieder öffnet, dann kann er die Markierung zurücknehmen.

## Edge Cases
- Was passiert, wenn dieselbe Rechnung mehrfach zurückgebucht wird? → Es bleibt ein Posten pro Rechnung; das Rückbuchungsdatum wird aktualisiert.
- Was passiert, wenn der Kunde inzwischen gekündigt hat oder sein Konto gelöscht wurde? → Der Posten bleibt sichtbar (das Geld fehlt trotzdem); fehlt der Kundenname, wird "Unbekannt" angezeigt statt eines Fehlers.
- Was passiert, wenn der Kunde keine E-Mail-Adresse hat? → "Erinnerung senden" ist deaktiviert mit erklärendem Hinweis.
- Was passiert, wenn ein Admin einen Posten erledigt markiert, während ein anderer gerade eine Erinnerung sendet? → Letzter Schreibvorgang gewinnt; kein Sperrmechanismus (kleines Team, gleiche Begründung wie bei den übrigen Admin-Bereichen).
- Wie wird "wie lange offen" berechnet? → Ab dem Datum der Rückbuchung, nicht ab Rechnungsdatum.

## Technical Requirements (optional)
- Security: Nur Admins (`requireAdmin`), wie alle `/admin`-Bereiche.
- Die Erinnerungs-E-Mail läuft über die bestehende Benachrichtigungs-Infrastruktur (PROJ-16), damit Zustellung und Protokollierung einheitlich bleiben.

## Open Questions
- [ ] Soll die Erinnerungs-E-Mail über PROJ-34 (Benachrichtigungs-Texte) frei anpassbar sein? → Naheliegend, aber erst in `/architecture` entscheiden.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| "Offen" = nur Rücklastschriften | Unbezahlte Vor-Ort-Zahlungen werden im System gar nicht erfasst; sie hier aufzunehmen würde eine Datenbasis erfordern, die es nicht gibt (eigenes Feature "Kassenbuch") | 2026-08-22 |
| Erinnerung manuell auslösen, kein automatisches Mahnwesen | Bei der Größe des Studios ist der persönliche Weg üblich; automatische Mahnstufen wären unangemessen und aufwendig | 2026-08-22 |
| "Erledigt" ist eine reine Markierung, keine Buchung | Die App ist kein Buchhaltungssystem; der Haken dokumentiert nur, dass der Fall für den Betreiber abgeschlossen ist | 2026-08-22 |
| Erledigte Posten bleiben einsehbar und rücknehmbar | Fehlklicks passieren; ein unwiderruflicher Haken auf einer Geldforderung wäre riskant | 2026-08-22 |

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
