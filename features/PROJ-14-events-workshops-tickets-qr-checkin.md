# PROJ-14: Events & Workshops (Tickets, QR-Check-in)

## Status: Planned
**Created:** 2026-08-18
**Last Updated:** 2026-08-18

## Dependencies
- Requires: PROJ-2 (Auth & Kundenprofil) — Ticket-Kauf erfordert Login
- Requires: PROJ-7 (SEPA-Lastschriftmandate & Sammel-Einzug) — für die Zahlungsart „SEPA-Lastschrift" (Mandat-Prüfung, Aufnahme in den nächsten Sammellauf)
- Requires: PROJ-13 (Lehrer-Ansicht) — Lehrer-Rolle darf beim Check-in mitscannen
- Requires: PROJ-16 (Automatische E-Mail-/Push-Benachrichtigungen) — wird um einen neuen Ereignistyp „Event-Tickets" (Bestätigung + Absage) erweitert

## User Stories
- Als Besucher (auch nicht eingeloggt) möchte ich auf einer öffentlichen Seite kommende Events/Workshops durchstöbern, um zu sehen, was das Studio anbietet.
- Als Kunde möchte ich ein Ticket für ein Event kaufen und dabei zwischen „SEPA-Lastschrift" (falls Mandat vorhanden) und „Vor Ort zahlen" wählen können.
- Als Kunde möchte ich mein Ticket mit QR-Code in meinem Profil sehen, um es beim Einlass vorzuzeigen.
- Als Kunde möchte ich mein Ticket bis zu einer Frist vor dem Event selbst stornieren können.
- Als Admin möchte ich Events mit Termin, Preis und Kapazität anlegen, bearbeiten und bei Bedarf absagen können.
- Als Admin oder Lehrer möchte ich beim Einlass die QR-Codes der Gäste per Handy-Kamera scannen, um sie einzuchecken — bei Vor-Ort-Zahlung gleichzeitig als bezahlt markiert.

## Out of Scope
- **Warteliste für ausgebuchte Events** — anders als bei Kursen (PROJ-12) gibt es für Events nur einen „Ausgebucht"-Hinweis, keine automatische Nachrück-Logik. Events sind meist einmalig, eine Warteliste lohnt sich hier weniger.
- **Mehrere Einzeltermine pro Event** — ein Event hat einen Termin bzw. einen zusammenhängenden Zeitraum (Start-/Enddatum für mehrtägige Workshops), nicht mehrere separate Sessions mit je eigenem Check-in.
- **Automatisierte Rückerstattung** bei Stornierung oder Event-Absage — läuft außerhalb der App (Bar-Rückerstattung bzw. manuelle SEPA-Rückerstattung durch den Betreiber), wie alle SEPA-bezogenen Rückerstattungen in diesem Projekt.
- **CSV-Export von Ticket-/Gästelisten** — nicht Teil des ersten Wurfs.
- **Admin-Analytics-Integration** (Event-Umsatz im PROJ-17-Dashboard) — eigener, späterer Ausbau.
- **Getrennte Benachrichtigungs-Einstellung für „Ticket bestätigt" vs. „Event abgesagt"** — beide fallen unter eine gemeinsame Einstellungsgruppe „Event-Tickets" (analog zu „Buchungsstatus" in PROJ-16).
- **Bearbeitbarer Ticket-Kauf** (z.B. Zahlungsart nachträglich ändern) — Kunde muss stornieren und neu kaufen.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Besucher (eingeloggt oder nicht) ruft die Event-Übersichtsseite auf, dann sieht er alle kommenden, nicht abgesagten Events mit Termin, Preis und Hinweis auf freie Kapazität
- [ ] Angenommen ein nicht eingeloggter Besucher versucht, ein Ticket zu kaufen, dann wird er zum Login/zur Registrierung weitergeleitet
- [ ] Angenommen ein eingeloggter Kunde mit hinterlegtem SEPA-Mandat kauft ein Ticket und wählt „SEPA-Lastschrift", dann wird das Ticket sofort automatisch bestätigt und die Kapazität reduziert
- [ ] Angenommen ein eingeloggter Kunde ohne hinterlegtes SEPA-Mandat kauft ein Ticket, dann ist nur „Vor Ort zahlen" wählbar
- [ ] Angenommen ein Kunde wählt „Vor Ort zahlen", dann wird das Ticket mit Status „reserviert" angelegt und die Kapazität sofort reduziert
- [ ] Angenommen ein Event ist ausgebucht, dann zeigt die Event-Seite „Ausgebucht" an und ein weiterer Ticket-Kauf ist nicht mehr möglich
- [ ] Angenommen ein Ticket wurde gekauft, dann sieht der Kunde es mit QR-Code unter „Meine Tickets" in seinem Profil
- [ ] Angenommen ein Admin oder Lehrer scannt einen gültigen, noch nicht eingecheckten QR-Code, dann wird das Ticket als eingecheckt markiert — bei einem „Vor Ort zahlen"-Ticket zusätzlich als bezahlt
- [ ] Angenommen ein bereits eingechecktes Ticket wird erneut gescannt, dann erscheint ein Hinweis „Bereits eingecheckt um HH:MM" statt eines erneuten Check-ins
- [ ] Angenommen ein Kunde storniert sein Ticket innerhalb der Stornierungsfrist, dann wird die Kapazität sofort freigegeben
- [ ] Angenommen ein Kunde versucht, sein Ticket nach Ablauf der Stornierungsfrist zu stornieren, dann wird dies verhindert und eine Erklärung angezeigt
- [ ] Angenommen ein Admin sagt ein Event ab, dann werden alle Ticket-Inhaber benachrichtigt (Event-Tickets-Benachrichtigung) und das Event verschwindet von der öffentlichen Seite
- [ ] Angenommen ein Kunde hat die Event-Tickets-Benachrichtigung in seinen Profil-Einstellungen deaktiviert, dann erhält er weiterhin sein Ticket im Profil, aber keine E-Mail/Push dazu
- [ ] Angenommen ein Kunde ohne Admin- oder Lehrer-Rolle ruft die Check-in-Seite direkt auf, dann wird der Zugriff verweigert

## Edge Cases
- Zwei Kunden versuchen gleichzeitig, den letzten verfügbaren Platz zu buchen → nur einer bekommt den Platz, der andere sieht „Ausgebucht"
- Ein QR-Code wird als Screenshot an eine andere Person weitergegeben → Doppel-Scan-Schutz verhindert Mehrfach-Einlass, nur der erste Scan zählt
- Admin reduziert die Kapazität eines Events nachträglich auf einen Wert unterhalb der bereits verkauften Tickets → bereits verkaufte Tickets bleiben gültig, keine neuen Tickets verkaufbar, bis wieder Kapazität frei ist
- Ein Kunde hat ein SEPA-Mandat, das zwischen Ticket-Kauf und Event-Termin widerrufen wird → das Ticket bleibt gültig (bereits bestätigt); ob der Betrag tatsächlich eingezogen wird, hängt vom Mandat-Status zum Zeitpunkt des nächsten SEPA-Sammellaufs ab (gleiche Logik wie bei Abo-Zahlungen)
- Kamera-Zugriff im Browser wird verweigert oder ist nicht verfügbar → manuelle Namenssuche in der Gästeliste als Fallback nutzbar
- Admin versucht, ein Event mit einem Datum in der Vergangenheit anzulegen → Validierungsfehler
- Ein „reserviertes" (Vor-Ort-Zahlung, noch nicht eingecheckt) Ticket wird storniert → Kapazität wird freigegeben, keine Zahlung war je erfolgt, keine Rückerstattung nötig

## Technical Requirements (optional)
- Security: Ticket-Kauf erfordert Login; Check-in-Seite ist ausschließlich für Admin- und Lehrer-Rolle zugänglich; ein QR-Code darf keine Rückschlüsse auf andere Kunden oder deren Daten zulassen, wenn er abfotografiert/weitergegeben wird
- Datenintegrität: Kapazitäts-Prüfung und Ticket-Reservierung müssen race-condition-sicher sein (siehe Edge Case „gleichzeitiger letzter Platz")

## Open Questions
- [ ] Genauer technischer Mechanismus, wie SEPA-Ticket-Beträge in einen SEPA-Sammellauf (PROJ-7) aufgenommen werden (Erweiterung der bestehenden Sammellauf-Erstellung um Ticket-Positionen vs. eigener Mechanismus) — wird in `/architecture` festgelegt

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Event = eigenständige, meist einmalige Veranstaltung mit Ticket-Verkauf, unabhängig vom wiederkehrenden Kursplan | Klare Abgrenzung zu PROJ-3/PROJ-6 (reguläre Kurse) | 2026-08-18 |
| Zahlungsart wird vom Kunden beim Kauf gewählt: „SEPA-Lastschrift" (nur bei vorhandenem Mandat) oder „Vor Ort zahlen" | Es gibt keine Kreditkarten-Zahlung in der App; SEPA nutzt die bestehende Mandat-Infrastruktur (PROJ-7), „Vor Ort" deckt Kunden ohne Mandat und Erstbesucher ab | 2026-08-18 |
| SEPA-Tickets werden sofort automatisch bestätigt, kein manueller Admin-Schritt nötig | Ein bestehendes Mandat ist eine verlässliche Zahlungszusage — analog zur sofortigen Bestätigung von Probestunden | 2026-08-18 |
| „Vor Ort zahlen"-Tickets reservieren die Kapazität sofort bei der Anfrage, nicht erst nach Bestätigung | Verhindert, dass zwei Personen um denselben Platz konkurrieren, während einer auf Zahlungsbestätigung wartet — die Anfrage IST die Reservierung | 2026-08-18 |
| QR-Check-in dient bei „Vor Ort zahlen"-Tickets gleichzeitig als Zahlungsbestätigung (ein Scan = eingecheckt UND bezahlt) | Entspricht dem tatsächlichen Ablauf an der Tür (Kunde zahlt bar, Admin scannt) und spart einen separaten Bestätigungs-Schritt im Vorfeld | 2026-08-18 |
| Kunde kann sein Ticket selbst stornieren, mit Frist (analog `BOOKING_CANCELLATION_LEAD_DAYS`) | Konsistent mit bestehendem Self-Service-Muster bei Probestunden/Drop-ins (PROJ-8) | 2026-08-18 |
| Ein Event hat einen Termin bzw. einen zusammenhängenden Zeitraum, keine mehreren Einzeltermine | Deutlich einfacher für den ersten Wurf, deckt sowohl einmalige Veranstaltungen als auch mehrtägige Workshops (als Zeitraum) ab | 2026-08-18 |
| Eigene öffentliche Event-Übersichtsseite, analog zu `/kurse` | Sichtbarkeit/Marketing für Sonderveranstaltungen auch bei nicht eingeloggten Besuchern | 2026-08-18 |
| Normal-/Studierendenpreis pro Event, analog zu Drop-ins | Explizite Nutzerentscheidung — Konsistenz mit bestehendem Preismuster | 2026-08-18 |
| Keine Warteliste für ausgebuchte Events, nur „Ausgebucht"-Hinweis | Events sind meist einmalig; eine Nachrück-Logik wie bei wiederkehrenden Kursen (PROJ-12) lohnt sich hier weniger — reduziert den Umfang für den ersten Wurf | 2026-08-18 |
| Check-in per Browser-Kamera-Scan, mit manueller Namenssuche als Fallback | Kein separates Scan-Gerät nötig; Fallback deckt technische Probleme an der Tür ab | 2026-08-18 |
| Check-in-Berechtigung für Admin UND Lehrer-Rolle | Ermöglicht Check-in auch, wenn der Admin selbst nicht vor Ort ist | 2026-08-18 |
| Bei Event-Absage: Event wird als „abgesagt" markiert (nicht gelöscht), alle Ticket-Inhaber werden benachrichtigt, Event verschwindet von der öffentlichen Seite | Erhält den Datensatz für Nachvollziehbarkeit; Rückerstattung läuft bewusst außerhalb der App | 2026-08-18 |
| Ticket-Bestätigung/-Absage wird ein neuer, vom Kunden ein-/ausschaltbarer Ereignistyp in PROJ-16 (E-Mail + Push) | Explizite Nutzerentscheidung — keine rechtliche Informationspflicht wie bei SEPA, daher wie die übrigen Ereignisse einstellbar statt fix | 2026-08-18 |

### Technical Decisions
<!-- Added by /architecture -->
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
