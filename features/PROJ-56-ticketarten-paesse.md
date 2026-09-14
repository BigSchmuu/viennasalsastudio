# PROJ-56: Ticketarten, Pässe & Einheiten

## Status: Planned
**Created:** 2026-09-14
**Last Updated:** 2026-09-14

## Dependencies
- Requires: PROJ-53 (Veranstaltungsprogramm) — Verkaufsart „Tickets in der App", Eventseite
- Requires: PROJ-14 (Events & Workshops) — Ticketkauf, QR-Code, Check-in, Gästeliste
- Requires: PROJ-7 (SEPA-Lastschriftmandate & Sammel-Einzug) — Ticketbeträge im Sammellauf
- Requires: PROJ-42 (Rechtssichere Buchungsbestätigung) — Zustimmung und Bestätigung beim Kauf
- Requires: PROJ-16 (Benachrichtigungen) — Ticketbestätigung und Änderungen an Einheiten
- Berührt: PROJ-54 (Event-Serien) — Ticketarten gelten auch für Serientermine

## User Stories
- Als Admin möchte ich für einen Workshop mehrere Einheiten mit Titel, Datum und Uhrzeit anlegen (z. B. „Samstag 14:00 Styling"), damit Kunden das Programm sehen.
- Als Admin möchte ich Ticketarten anlegen (z. B. „Full Pass", „Einzelne Einheit") mit Normal- und Studierendenpreis, optionalem Kontingent und den Einheiten, für die sie gelten.
- Als Kunde möchte ich beim Kauf eine Ticketart wählen und, falls sie das vorsieht, die Einheit wählen.
- Als Admin möchte ich pro Event festlegen, ob Kunden per SEPA-Lastschrift, bar vor Ort oder beides zahlen können.
- Als Admin möchte ich pro Event die Stornofrist festlegen, damit Workshops eine längere Frist haben können als Partys.
- Als Admin oder Lehrer möchte ich beim Einlass zu jeder Einheit scannen und sehen, ob das Ticket für diese Einheit gilt.

## Out of Scope
- **Frühbucherpreise, Mengenrabatte** und Rabattcodes beim Ticketkauf
- **Mehrere Tickets in einem Kauf** (z. B. für Tanzpartner) — siehe Open Questions
- **Leader/Follower-Auswahl** bei Workshop-Tickets — siehe Open Questions
- **Wechsel der Ticketart** nach dem Kauf (z. B. Upgrade auf Full Pass) — der Kunde storniert und kauft neu, wie in PROJ-14
- **Online-Zahlung** und automatisierte Rückerstattung — Rückerstattung bleibt manuell
- **Warteliste** — bleibt ausgeschlossen

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Einheiten
- [ ] Angenommen ein Admin legt bei einem Event mit Tickets Einheiten an (Titel, Datum, Beginn, Ende, optional Kapazität), dann erscheinen sie nach Zeit sortiert als Programm auf der Eventseite
- [ ] Angenommen eine Einheit liegt außerhalb des Event-Zeitraums, dann erscheint beim Speichern ein Validierungsfehler
- [ ] Angenommen ein Event hat keine Einheiten, dann funktioniert es wie bisher als ein Termin, und Ticketarten gelten für das ganze Event
- [ ] Angenommen für eine Einheit gelten bereits verkaufte Tickets, wenn der Admin sie löschen will, dann wird das verhindert; verschiebt er sie, werden die betroffenen Ticket-Inhaber benachrichtigt

### Ticketarten
- [ ] Angenommen ein Admin legt eine Ticketart an, dann gibt er Name, Normal- und Studierendenpreis, optional ein Kontingent und den Geltungsbereich an: alle Einheiten, bestimmte Einheiten oder „Kunde wählt eine Einheit"
- [ ] Angenommen ein Event verkauft Tickets in der App, dann hat es mindestens eine Ticketart; ein neues Event startet mit einer Ticketart „Ticket" für alle Einheiten
- [ ] Angenommen eine Ticketart kostet 0 €, dann ist sie kostenlos: Die Zahlungsartwahl entfällt, und das Ticket ist sofort bestätigt
- [ ] Angenommen eine Ticketart hat bereits verkaufte Tickets, dann lassen sich Preis und Geltungsbereich nicht mehr ändern, der Name schon; der Admin kann sie aber vom Verkauf nehmen, und verkaufte Tickets bleiben gültig

### Kauf
- [ ] Angenommen ein Kunde öffnet den Kauf, dann sieht er alle Ticketarten mit Preis und dem, was enthalten ist; ausverkaufte Arten sind sichtbar, aber nicht wählbar
- [ ] Angenommen der Kunde wählt eine Ticketart mit „Kunde wählt eine Einheit", dann muss er eine Einheit wählen; volle Einheiten sind nicht wählbar
- [ ] Angenommen das Kontingent der Ticketart oder die Kapazität einer Einheit, für die das Ticket gilt, ist erschöpft, dann ist der Kauf nicht möglich; kaufen zwei Kunden gleichzeitig den letzten Platz, bekommt ihn nur einer
- [ ] Angenommen ein Ticket gilt für mehrere Einheiten, dann belegt es in jeder dieser Einheiten einen Platz
- [ ] Angenommen ein Kunde kauft ein Ticket, dann nennen Bestätigung, „Meine Tickets" und die Benachrichtigung Ticketart, Preis, die enthaltenen Einheiten und die Stornofrist
- [ ] Angenommen ein Kunde möchte den Studierendenpreis, dann wählt er ihn wie bisher beim Kauf

### Zahlungsarten
- [ ] Angenommen ein Admin legt die Zahlungsarten eines Events fest (SEPA-Lastschrift, bar vor Ort oder beides), dann bietet der Kauf nur diese an; mindestens eine muss gewählt sein
- [ ] Angenommen ein Event erlaubt nur SEPA und der Kunde hat kein Mandat, dann sieht er den Hinweis, dass dafür ein SEPA-Mandat nötig ist, mit Link zum Hinterlegen, und kann nicht kaufen
- [ ] Angenommen ein Event erlaubt nur bar vor Ort, dann wird SEPA nicht angeboten, auch wenn der Kunde ein Mandat hat
- [ ] Angenommen der Admin ändert die Zahlungsarten nachträglich, dann bleiben verkaufte Tickets mit ihrer Zahlungsart gültig

### Stornofrist
- [ ] Angenommen ein Admin legt die Stornofrist in Tagen fest (Vorgabe: 1 Tag), dann können Kunden bis so viele Tage vor Beginn des Events bzw. des Serientermins selbst stornieren
- [ ] Angenommen die Frist ist abgelaufen, dann ist Stornieren nicht möglich, und der Kunde sieht, bis wann es möglich gewesen wäre
- [ ] Angenommen der Admin ändert die Frist, dann behalten bereits verkaufte Tickets die Frist, die beim Kauf galt

### Check-in
- [ ] Angenommen ein Event hat Einheiten, dann wählt die Person am Einlass vor dem Scannen die Einheit; vorgeschlagen ist die laufende oder nächste Einheit
- [ ] Angenommen ein Ticket gilt für die gewählte Einheit und ist dort noch nicht eingecheckt, dann wird es für diese Einheit eingecheckt; bei „bar vor Ort" wird beim ersten Check-in des Tickets die Zahlung als erhalten markiert
- [ ] Angenommen ein Ticket gilt nicht für die gewählte Einheit, dann erscheint „Gilt nicht für diese Einheit" mit den Einheiten, für die es gilt
- [ ] Angenommen ein Ticket ist für diese Einheit schon eingecheckt, dann erscheint „Bereits eingecheckt um HH:MM" statt eines erneuten Check-ins
- [ ] Angenommen ein Event hat keine Einheiten, dann funktioniert der Check-in wie bisher mit einem Scan
- [ ] Angenommen die Kamera ist nicht verfügbar, dann lässt sich wie bisher per Namenssuche einchecken, ebenfalls je Einheit

## Edge Cases
- Ein Full Pass und ein Einzelticket konkurrieren um den letzten Platz einer Einheit → nur einer bekommt ihn
- Die Kapazität einer Einheit wird unter die bereits belegten Plätze gesenkt → verkaufte Tickets bleiben gültig, bis wieder Platz frei ist, wird nichts verkauft (wie PROJ-14)
- Ein Kunde versucht, für dieselbe Einheit ein zweites Ticket zu kaufen → wird verhindert, solange Mehrfachkäufe ausgeschlossen sind
- Ein SEPA-Mandat wird nach dem Kauf widerrufen → das Ticket bleibt gültig, der Einzug folgt der Logik von PROJ-14
- Die Stornofrist ist 0 Tage → Stornieren ist bis zum Beginn möglich
- Eine Ticketart wird vom Verkauf genommen → verkaufte Tickets bleiben gültig und scannbar
- Der Admin stellt ein Event auf „nur bar", nachdem SEPA-Tickets verkauft wurden → diese bleiben SEPA-Tickets und kommen weiterhin in den Sammellauf
- Bestehende Test-Events → erhalten beim Umbau die Ticketart „Ticket" mit ihren bisherigen Preisen, beide Zahlungsarten und 1 Tag Stornofrist

## Technical Requirements (optional)
- Kontingent- und Kapazitätsprüfung race-condition-sicher (wie PROJ-14)
- SEPA-Tickets kommen mit dem Preis der Ticketart in den nächsten Sammellauf (PROJ-7)
- Kauf mit Zustimmung und rechtssicherer Bestätigung (PROJ-42), einschließlich Stornofrist
- Check-in nur für Admin und Lehrer

## Open Questions
- [ ] Kapazität je Einheit plus optionales Kontingent je Ticketart — trifft das euren Ablauf? (Vorschlag in den Kriterien oben)
- [ ] Mehrere Tickets in einem Kauf, z. B. für den Tanzpartner oder eine Begleitung?
- [ ] Leader/Follower-Auswahl bei Workshop-Tickets, wie bei Kursen (PROJ-30)?
- [ ] Brauchen Serientermine auch Einheiten? Vorschlag: nein, Einheiten nur bei Einzelevents

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Ticketarten mit eigenem Preis und Kontingent („Pässe mit Auswahl") | Betreiberentscheidung — ein einzelner Pass deckt auch „ein Ticket für alles" ab | 2026-09-14 |
| Normal- und Studierendenpreis je Ticketart, 0 € bedeutet kostenlos | Betreiberentscheidung — gleiches Preismuster wie bisher | 2026-09-14 |
| Check-in je Einheit | Betreiberentscheidung — ein geteilter Pass fällt auf | 2026-09-14 |
| Zahlungsarten pro Event: SEPA-Lastschrift, bar vor Ort oder beides | Betreiberentscheidung | 2026-09-14 |
| Stornofrist pro Event, Vorgabe 1 Tag | Betreiberentscheidung — Workshops brauchen längere Fristen als Partys | 2026-09-14 |
| Verkaufte Tickets behalten Zahlungsart und Stornofrist vom Kaufzeitpunkt | Vertragsbedingungen ändern sich nicht nachträglich (PROJ-42) | 2026-09-14 (Vorschlag) |
| Bar-Zahlung gilt beim ersten Check-in des Tickets als erhalten | Führt die PROJ-14-Regel „Scan = bezahlt" für Pässe fort | 2026-09-14 (Vorschlag) |
| Kapazität je Einheit, ein Ticket belegt einen Platz in jeder Einheit, für die es gilt | Räume haben je Einheit begrenzten Platz, Full-Pass-Inhaber sind in jeder Einheit | 2026-09-14 (Vorschlag) |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
