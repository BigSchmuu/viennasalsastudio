# PROJ-14: Events & Workshops (Tickets, QR-Check-in)

## Status: In Review
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
- [x] Technischer Mechanismus für SEPA-Ticket-Beträge — gelöst in `/architecture`: bestehende `sepa_collection_items`-Tabelle (PROJ-7) wird um eine optionale Ticket-Verknüpfung erweitert, kein neuer Sammellauf-Typ (siehe Technical Decisions)

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
| Kapazitäts-Prüfung + Ticket-Reservierung laufen über eine SECURITY-DEFINER-Datenbankfunktion, die die Event-Zeile für die Dauer der Prüfung sperrt (row lock) | Löst die offene Frage aus dem Spec-Interview zur Race-Condition-Sicherheit — exakt dasselbe bewährte Muster, das bereits bei der regulären Kursbuchung (`create_regular_course_booking`, PROJ-8) verwendet wird | 2026-08-18 |
| `sepa_collection_items` (PROJ-7) wird erweitert: `subscription_id` wird optional, eine neue optionale Spalte `event_ticket_id` kommt hinzu (genau eine der beiden muss gesetzt sein) | Löst die offene Frage aus dem Spec-Interview zum SEPA-Mechanismus — SEPA-Tickets nutzen dieselbe „wird beim nächsten Sammellauf automatisch mit erfasst"-Logik wie Abo-Zahlungen, statt eine komplett neue Sammel-Logik zu bauen | 2026-08-18 |
| Event-Ort ist ein freies Textfeld, keine Verknüpfung zur bestehenden „Standorte"-Tabelle | Events finden nicht immer in den festen Studio-Räumen statt (z.B. angemietete Location für einen Workshop) — eine Pflicht-Verknüpfung zur Studio-Standort-Tabelle wäre zu einschränkend | 2026-08-18 |
| QR-Code enthält direkt die Ticket-ID (UUID), kein zusätzliches Geheim-Token nötig | UUIDs sind bereits ausreichend unvorhersehbar (128 Bit Zufall) — ein zusätzliches Token wäre doppelte Absicherung ohne echten Mehrwert, analog dazu, wie andere IDs im Projekt bereits verwendet werden | 2026-08-18 |
| Neue Rolle-Prüfung `requireAdminOrTeacher()` für die Check-in-Seite | Bestehende Helfer (`requireAdmin`, `requireTeacher` aus PROJ-13) decken nur je eine Rolle ab; Check-in braucht beide | 2026-08-18 |
| Neuer Ereignistyp `event_ticket` in der bestehenden PROJ-16-Warteschlange, deckt Bestätigung UND Absage über ein Status-Feld im Payload ab | Exakt dasselbe Muster wie `buchungsstatus` (bestätigt/abgelehnt als eine Einstellungsgruppe) — keine neue Infrastruktur, nur ein weiterer Eintrag in der bestehenden Ereignistyp-Liste | 2026-08-18 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Component Structure (Visual Tree)

```
/events (neu, öffentlich, analog zu /kurse)
+-- Event-Karten: Name, Termin, Ort, Preis, Kapazitäts-Hinweis ("Noch X Plätze" / "Ausgebucht")
+-- Ticket-Kauf-Dialog (Login-geschützt)
    +-- Normal-/Studierendenpreis-Auswahl
    +-- Zahlungsart-Auswahl (SEPA-Lastschrift nur bei vorhandenem Mandat / Vor Ort zahlen)
    +-- Bestätigung

Profil-Seite — NEU: Abschnitt "Meine Tickets"
+-- Ticket-Karte je Event: Name, Termin, Status (reserviert/bestätigt/eingecheckt), QR-Code
+-- Stornieren-Button (nur innerhalb der Frist, wie bei Buchungen)

/admin/events (neu, analog zu /admin/kurse)
+-- Event-Liste: anlegen, bearbeiten, absagen
+-- Je Event: Gästeliste (Name, Zahlungsart, Status, Check-in-Zeitpunkt)

/checkin (neu, Zugriff: Admin + Lehrer)
+-- Event-Auswahl (bei mehreren aktuell laufenden/anstehenden Events)
+-- Kamera-Scan-Ansicht (Handy-Browser)
+-- Manuelle Namenssuche als Fallback
+-- Scan-Ergebnis: Erfolg / "Bereits eingecheckt um HH:MM" / Ungültiger Code

Admin-Navigation
+-- NEU: Nav-Link "Events"

Profil-Benachrichtigungs-Abschnitt (PROJ-16)
+-- NEU: 5. Zeile "Event-Tickets" in der bestehenden Einstellungs-Tabelle
```

### B) Data Model (plain language)

**Events** (neu)
- Name, Beschreibung, Ort (freier Text)
- Start-Zeitpunkt, optionaler End-Zeitpunkt (für mehrtägige Workshops)
- Kapazität (Pflichtfeld, anders als bei Kursen — ein Event ohne feste Obergrenze ergibt hier keinen Sinn)
- Preis normal / Preis Studierende
- Status: geplant oder abgesagt

**Tickets** (neu)
- Bezug zu Event und Kunde
- Gewählte Zahlungsart (SEPA-Lastschrift / Vor Ort)
- Ob Studierendenpreis gewählt wurde, tatsächlicher Preis zum Kaufzeitpunkt (Preisänderungen am Event wirken sich nicht auf bereits gekaufte Tickets aus — wie bei bestehenden Kurs-Buchungen)
- Status: reserviert (Vor-Ort, noch nicht eingecheckt) / bestätigt (SEPA, automatisch) / eingecheckt / storniert
- Zeitpunkt und durchführende Person des Check-ins (Admin oder Lehrer)

**SEPA-Sammellauf-Positionen** (bestehende Tabelle aus PROJ-7, erweitert)
- Kann jetzt entweder zu einem Abo ODER zu einem Event-Ticket gehören, nicht mehr nur zu Abos

**Benachrichtigungs-Einstellungen** (bestehende Tabelle aus PROJ-16, erweitert)
- Neue fünfte Ereignisgruppe „Event-Tickets" neben den bestehenden vier

### C) Tech Decisions (justified for PM)

- **Race-Condition-sichere Kapazität**: Wiederverwendung desselben bewährten Sperr-Mechanismus, der schon verhindert, dass zwei Kunden gleichzeitig den letzten Kursplatz bekommen (PROJ-8) — hier auf Events übertragen.
- **SEPA-Tickets fließen in den bestehenden Sammellauf-Mechanismus ein**: Kein zweites, paralleles Abrechnungssystem — der Admin erstellt weiterhin nur EINEN Sammellauf-Typ (PROJ-7), der jetzt zusätzlich fällige Ticket-Zahlungen mit erfasst.
- **Freier Ort statt Standort-Pflichtfeld**: Events können auch außerhalb der festen Studio-Räume stattfinden.
- **Check-in für Admin und Lehrer**: nutzt die bereits bestehende Rollen-Unterscheidung aus PROJ-13, keine neue Rolle nötig.
- **Benachrichtigung nutzt bestehende PROJ-16-Infrastruktur**: kein neues Zustellsystem, nur ein weiterer Ereignistyp in der bereits bestehenden Warteschlange.

### D) Dependencies (packages to install)
- `qrcode` — erzeugt den QR-Code für die Ticket-Anzeige im Profil
- Eine Kamera-Scan-Bibliothek (z.B. `html5-qrcode`) — liest QR-Codes über die Handy-Kamera im Browser beim Check-in aus

### Voraussetzung vor `/deploy`
Keine neuen externen Dienste oder Umgebungsvariablen — beide neuen Pakete laufen vollständig im Browser bzw. serverseitig ohne externe API.

## Implementation Notes (Frontend)

**Gebaut:**
- Migrationen: `proj14_events_and_tickets` (Tabellen `events`/`tickets`, RLS, `purchase_event_ticket()` mit Row-Lock analog zu `create_regular_course_booking`, `checkin_event_ticket()` mit atomarem Claim-Muster analog zu PROJ-16s Warteschlangen-Dispatch), `proj14_tickets_customer_id_fk_fix` (Korrektur: `customer_id` muss wie überall im Projekt auf `profiles`, nicht auf `auth.users` zeigen, sonst funktionieren keine Namens-Joins für Gästeliste/Suche), `proj14_get_event_occupancy` (öffentlich sichere Auslastungs-Funktion analog zu `get_course_occupancy`, PROJ-12)
- `src/lib/constants/events.ts`, `src/lib/validations/events.ts` (mit separatem `createEventSchema`, das die „Termin muss in der Zukunft liegen"-Regel nur beim Anlegen prüft, nicht beim nachträglichen Bearbeiten bereits vergangener Events)
- `src/lib/auth/require-admin-or-teacher.ts` (neuer Rollen-Gate für Admin+Lehrer)
- `src/lib/actions/events.ts` (`purchaseTicket`, `cancelTicket`), `src/lib/actions/admin/events.ts` (`createEvent`, `updateEvent`, `cancelEvent`, `getEventGuestList`), `src/lib/actions/checkin.ts` (`listCheckinEvents`, `searchEventTickets`, `checkinTicket`)
- `src/app/(site)/events/page.tsx` (öffentliche Übersicht) + `event-card.tsx` + `ticket-purchase-dialog.tsx`
- `src/app/(site)/profil/page.tsx` erweitert um „Meine Tickets" (`my-tickets-section.tsx` + `ticket-qr-code.tsx`, QR-Code-Erzeugung via `qrcode`, direkt die Ticket-ID als Inhalt)
- `src/app/admin/events/page.tsx` + `event-manager.tsx` (Anlegen/Bearbeiten/Absagen/Gästeliste, analog zum bestehenden `course-manager.tsx`-Muster)
- `src/app/(site)/checkin/page.tsx` + `checkin-client.tsx` + `qr-scanner.tsx` (Kamera-Scan via `html5-qrcode` + manuelle Namenssuche als Fallback)
- Navigation: „Events" (öffentlich) und „Check-in" (Admin+Lehrer) in `site-header.tsx`, „Events" in `admin-nav.tsx`

**Live verifiziert (echte Kauf-/Check-in-Durchläufe über die UI, keine direkten DB-Manipulationen):**
- Event anlegen als Admin → erscheint korrekt in der Liste
- Anonymer Besucher sieht Events, aber „Zum Ticket-Kauf einloggen" statt Kauf-Button
- Ticket-Kauf mit SEPA (Mandat vorhanden) → sofort „Bestätigt", QR-Code erscheint im Profil
- Ticket-Kauf „Vor Ort zahlen" (kein Mandat nötig) → Status „Reserviert"
- Kapazität korrekt: Event mit Kapazität 1 zeigt nach einem Kauf „Ausgebucht", Kauf-Button deaktiviert
- Check-in per manueller Namenssuche (Admin) → Ticket wird „Eingecheckt", Kunde sieht in seinem Profil keinen Stornieren-Button mehr für ein eingechecktes Ticket
- Doppel-Scan-Schutz: erneute Suche zeigt den Button deaktiviert mit „Eingecheckt HH:MM" statt eines erneuten Check-ins
- Event-Absage als Admin → Event verschwindet sofort von der öffentlichen `/events`-Seite
- Zugriffsschutz: Kunde ohne Admin/Lehrer-Rolle wird von `/checkin` weg auf „/" umgeleitet
- `npm run build`, `npm run lint`, `npm test` (148/148) alle sauber, keine Konsolenfehler bei allen obigen Durchläufen

**Bewusst noch NICHT gebaut (folgt in `/backend`, siehe Architektur-Entscheidungen):**
- SEPA-Ticket-Beträge fließen noch nicht in einen SEPA-Sammellauf ein — `sepa_collection_items` muss noch um eine optionale Ticket-Verknüpfung erweitert werden, `createCollectionRun` (PROJ-7) muss confirmed-SEPA-Tickets mit erfassen
- Keine Benachrichtigungen bei Ticket-Kauf/Event-Absage — der neue PROJ-16-Ereignistyp `event_ticket` (Warteschlange, Vorlagen, Trigger in `purchaseTicket`/`cancelEvent`) ist noch nicht angebunden
- Kamera-Berechtigungs-Fallback (`QrScanner`) wurde nicht mit einer echten Kamera getestet (Headless-Browser-Einschränkung) — nur der Verweigerungs-Fallback-Pfad über die manuelle Suche wurde end-to-end verifiziert

## Implementation Notes (Backend)

**Gebaut:**
- Migrationen: `proj14_backend_sepa_and_notifications` (`sepa_collection_items.subscription_id` nullable gemacht, neue nullable `event_ticket_id`-FK auf `tickets(id)`, Check-Constraint „genau eine der beiden Spalten gesetzt"; `notification_queue.event_type` und `notification_preferences.event_group` um `event_tickets` erweitert), `proj14_fix_event_type_naming` (Korrektur: `notification_queue.event_type` nutzte anfangs `event_ticket`/Singular statt `event_tickets`/Plural — im Projekt stimmen diese beiden Constraints an jeder anderen Stelle exakt überein, z. B. `abo_kuendigung`)
- `create_invoices_for_collection_run()` (SQL) auf `LEFT JOIN` von `subscriptions` UND `tickets→events` umgestellt, Rechnungsbeschreibung via `coalesce(s.name, e.name, 'Abo')`
- `src/lib/actions/admin/sepa-collections.ts`: `createCollectionRun` holt jetzt zusätzlich SEPA-Tickets (Status `confirmed`/`checked_in`), schließt bereits abgerechnete Tickets über einen Blick auf vorhandene `sepa_collection_items.event_ticket_id` aus (verhindert Doppel-Abrechnung über mehrere Läufe hinweg), und mischt `subscriptionItems` + `ticketItems` zu einer gemeinsamen `items`-Liste; `generateRunXml` liest zusätzlich `tickets(events(name))` und nutzt den Event-Namen als Fallback für die Zahlungsreferenz, wenn kein Abo dahintersteht
- `src/lib/constants/notifications.ts`: neue Gruppe `event_tickets` („Event-Tickets") ergänzt
- `src/lib/notifications/templates.ts`: neuer `EventTicketDetails`-Typ (Unterscheidung `purchased` vs. `event_cancelled`), neuer `formatDateTime()`-Helfer (Events speichern einen vollen Zeitstempel, nicht nur ein Datum wie die übrigen Vorlagen), neuer `case "event_tickets"` mit eigenem Wortlaut für bestätigt/reserviert/abgesagt
- `src/lib/notifications/dispatch.ts`: neuer `case "event_tickets"` in `resolveContent()` — lädt bei `sub_type: "purchased"` Ticket+Event nach, bei `sub_type: "event_cancelled"` nur das Event
- `src/lib/actions/events.ts`: `purchaseTicket` ruft nach erfolgreichem Kauf `enqueueAndDispatch` auf (Dedupe-Key `event_ticket_purchased:<ticket_id>`) — Echtzeit-Zustellung, da nur ein einzelner Kunde betroffen ist
- `src/lib/actions/admin/events.ts`: `cancelEvent` lädt nach dem Absagen alle aktiven Tickets (reserviert/bestätigt) und ruft für jedes `enqueueNotification` auf (Dedupe-Key `event_ticket_cancelled:<ticket_id>`) — nur Warteschlange, kein synchroner Versand, da hier potenziell viele Kunden gleichzeitig betroffen sind (analog zum SEPA-Sammellauf-Muster)

**Live verifiziert (direkte Abfragen gegen die Produktions-DB mit Wegwerf-Testdaten, sofort aufgeräumt):**
- Die beiden neuen `resolveContent`-Zweige (`tickets→events`-Embed für `purchased`, direktes `events`-Select für `event_cancelled`) liefern die erwarteten Felder korrekt
- Die `cancelEvent`-Abfrage für aktive Tickets liefert die richtigen Kunden-IDs
- `notification_preferences`-Lookup für die Gruppe `event_tickets` funktioniert
- DB-Constraints geprüft: `notification_queue_event_type_check` und `notification_preferences_event_group_check` beide auf `event_tickets` (Plural) ausgerichtet; `sepa_collection_items_source_check` erzwingt „genau eine von `subscription_id`/`event_ticket_id`"
- `npm run build`, `npm run lint`, `npm test` (151/151, davon 3 neue Tests für die Ticket-Benachrichtigungsvorlagen) alle sauber

**Gefundener und behobener Fehler während der Umsetzung:**
- Beim ersten Build schlug die TypeScript-Prüfung fehl: `buildNotificationContent`s Parametertyp enthielt sowohl `NotificationEventGroup` (worin `event_tickets`/Plural bereits enthalten ist) als auch ein zusätzliches, redundantes `event_ticket`/Singular — das switch-Statement hatte aber keinen Fall für `event_tickets`, wodurch die Exhaustiveness-Prüfung fehlschlug. Behoben, indem das redundante Singular entfernt und der switch-Fall sowie beide Aufrufstellen in `dispatch.ts` auf `event_tickets` (Plural) vereinheitlicht wurden.

## QA Test Results

**Tested:** 2026-08-18
**App URL:** http://localhost:3000 (dev server against production Supabase — no staging environment exists for this project)
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

- [x] AC1 — Event-Übersicht zeigt kommende Events mit Termin, Preis und Kapazitäts-Hinweis
- [x] AC2 — Nicht eingeloggter Besucher wird beim Kaufversuch zum Login weitergeleitet
- [x] AC3 — SEPA-Ticket-Kauf wird sofort automatisch bestätigt, Kapazität reduziert
- [x] AC4 — Kunde ohne SEPA-Mandat kann nur „Vor Ort zahlen" wählen
- [x] AC5 — „Vor Ort zahlen" legt Ticket als „reserviert" an, Kapazität sofort reduziert
- [x] AC6 — Ausgebuchtes Event zeigt „Ausgebucht", weiterer Kauf gesperrt
- [x] AC7 — Gekauftes Ticket erscheint mit QR-Code unter „Meine Tickets"
- [x] AC8 — Admin/Lehrer checkt gültiges Ticket per Namenssuche ein (Vor-Ort-Ticket zusätzlich als bezahlt markiert, da Check-in = Zahlungsbestätigung)
- [x] AC9 — Bereits eingechecktes Ticket zeigt bei erneuter Suche einen deaktivierten „Eingecheckt HH:MM"-Button statt eines erneuten Check-ins
- [x] AC10 — Stornierung innerhalb der Frist gibt die Kapazität sofort frei
- [x] AC11 — Stornierung nach Ablauf der Frist wird verhindert (Aktion wird ausgeblendet statt eines Fehlers nach Klick — deckt sich mit der bereits akzeptierten PROJ-8-Konvention für exakt dasselbe Frist-Muster, siehe dortiges QA-Ergebnis AC11)
- [x] AC12 — Event-Absage entfernt es von `/events` und benachrichtigt alle aktiven Ticket-Inhaber (per DB verifiziert: `notification_queue`-Eintrag mit `event_type: event_tickets`, `sub_type: event_cancelled` wurde beim echten Absagen-Klick erzeugt)
- [x] AC13 — Deaktivierte „Event-Tickets"-Benachrichtigung: Umschalten funktioniert und persistiert, Ticket bleibt im Profil sichtbar
- [x] AC14 — Zugriff auf `/checkin` ohne Admin-/Lehrer-Rolle wird verweigert (Redirect auf „/")
- [x] Zusatzcheck — Lehrer-Rolle hat ebenfalls Zugriff auf `/checkin` (nicht nur Admin)

**14/14 Acceptance Criteria passed** (plus 1 additional role-coverage check).

### Edge Cases Status

- [x] Zwei Kunden konkurrieren um den letzten Platz — durch Code-Review verifiziert: `purchase_event_ticket()` sperrt die `events`-Zeile per `for update`, bevor die Kapazität geprüft wird — exakt dasselbe Sperrmuster wie `create_regular_course_booking` (PROJ-8), das dort bereits unter echter Nebenläufigkeit geprüft wurde. Kein separater Nebenläufigkeits-Livetest für PROJ-14 nötig, da identischer, bereits bewährter Mechanismus.
- [x] Doppel-Scan-Schutz (Screenshot-Weitergabe) — abgedeckt durch AC9 (zweite Suche nach Check-in zeigt deaktivierten Button, kein erneuter Check-in möglich)
- [x] Admin reduziert Kapazität nachträglich unter bereits verkaufte Tickets — live verifiziert: Kapazität eines Events mit 1 verkauften Ticket auf 1 gesetzt, weiterer Kaufversuch korrekt mit „event is full" abgelehnt, bestehendes Ticket blieb unangetastet
- [x] SEPA-Mandat wird zwischen Kauf und Termin widerrufen — laut Design bleibt das bereits bestätigte Ticket gültig (kein erneuter Mandats-Check nach Kauf); Verhalten des nächsten Sammellaufs entspricht 1:1 der bestehenden Abo-Logik (PROJ-7), kein PROJ-14-spezifisches Risiko
- [x] Kamera-Zugriff verweigert → manuelle Namenssuche als Fallback — in AC8/AC9 ausschließlich über die manuelle Suche getestet; die eigentliche Kamera-Scan-Funktion (`html5-qrcode`) ist mangels Kamera in der Headless-Testumgebung weiterhin ungetestet (bereits in den Frontend-Implementation-Notes als bekannte Lücke dokumentiert)
- [x] Admin legt Event mit Datum in der Vergangenheit an → Validierungsfehler — durch neue Unit-Tests abgedeckt (`src/lib/validations/events.test.ts`: `createEventSchema` lehnt Vergangenheits-Termine ab, `eventSchema` erlaubt sie beim Bearbeiten weiterhin)
- [x] Reserviertes (Vor-Ort-)Ticket wird storniert, keine Zahlung war je erfolgt — abgedeckt durch AC10

### Security Audit Results

- [x] Authentication: `/checkin` ohne Login → Redirect zu `/login?redirect=/checkin`; Ticket-Kauf ohne Login zeigt nur den Login-Link, keinen Kauf-Button
- [x] Authorization: `checkin_event_ticket()`-RPC direkt als normaler Kunde aufgerufen → korrekt mit „not authorized" abgelehnt (verifiziert per Skript, nicht nur über die UI)
- [x] Authorization: `purchase_event_ticket()` mit SEPA ohne Mandat → korrekt mit „no active mandate" abgelehnt, unabhängig vom Client
- [x] Row-Level-Security: `tickets`-SELECT-Policy beschränkt auf eigene Zeile oder Admin/Lehrer — verifiziert per `pg_policies`
- [x] Input validation / XSS: Event-Name/-Beschreibung/-Ort sind Admin-only-Felder (kein Kunden-Input), werden über reguläres JSX gerendert (kein `dangerouslySetInnerHTML` in allen neuen PROJ-14-Komponenten) und in den Benachrichtigungs-Templates korrekt escaped (per bestehendem `escapeHtml`, durch die neuen Unit-Tests in `templates.test.ts` mitgeprüft)
- [ ] **BUG-1 (Critical):** Row-Level-Security auf `tickets` erlaubt Kunden, beliebige Spalten der eigenen Ticket-Zeile zu verändern — nicht nur den Stornierungs-Status. Details siehe unten.

### Bugs Found

#### BUG-1: Kunden können per direktem API-Aufruf ihr eigenes Ticket auf „eingecheckt" setzen und den Preis auf 0 ändern
- **Severity:** Critical
- **Steps to Reproduce:**
  1. Als eingeloggter Kunde ein Ticket kaufen (SEPA oder Vor-Ort), z. B. Status „reserviert" oder „bestätigt"
  2. Mit dem eigenen Supabase-Anon-Key + der eigenen Session (beides im Browser jedes Nutzers verfügbar) direkt gegen die REST-API aufrufen: `PATCH /rest/v1/tickets?id=eq.<eigene-ticket-id>` mit Body `{ "status": "checked_in", "price": 0 }`
  3. Erwartet: Die Row-Level-Security-Policy „Tickets: own cancel" sollte nur `status = 'cancelled'` erlauben (analog zur bestehenden, korrekten Policy „Course bookings: own cancel" bei PROJ-8, die exakt `WITH CHECK ((auth.uid() = customer_id) AND (status = 'cancelled'))` verwendet)
  4. Tatsächlich: Der Request gelingt vollständig — `status` wird auf „checked_in" gesetzt (obwohl der Kunde nie am Einlass gescannt wurde) und `price` auf 0 (obwohl der reguläre Preis 20€ war). Live verifiziert mit einem Wegwerf-Testticket, per Skript gegen die Produktions-DB, danach sofort zurückgesetzt.
  - **Root Cause:** Die Migration hat für die `UPDATE`-Policy „Tickets: own cancel" nur eine `USING`-Klausel (`auth.uid() = customer_id`) gesetzt, aber keine `WITH CHECK`-Klausel, die die neue Zeile validiert. Ohne explizite `WITH CHECK` übernimmt Postgres bei `UPDATE`-Policies zwar implizit die `USING`-Klausel auch als Check, aber diese prüft nur die Kunden-Zuordnung (`customer_id`), nicht welche Spalten sich ändern dürfen — der Kunde kann daher jede Spalte der eigenen Zeile beliebig setzen, solange `customer_id` unverändert bleibt.
  - **Impact:** (1) Kunden können sich selbst am Einlass vorbeischleusen, indem sie ihr Ticket ohne Scan auf „eingecheckt" setzen. (2) Kunden können den Ticketpreis vor dem nächsten SEPA-Sammellauf auf 0 setzen und so die Zahlung umgehen — verifiziert, dass `createCollectionRun` den zum Abrechnungszeitpunkt aktuellen `price`-Wert der Ticket-Zeile abfragt, eine Preis-Manipulation vor dem Lauf würde also unbemerkt zu einer Falschabrechnung führen. (3) Weitere Spalten wie `payment_method`, `checked_in_by`, `checked_in_at` sind ebenso ungeschützt und könnten zur Verschleierung genutzt werden.
  - **Empfohlener Fix (nicht von QA umgesetzt):** `WITH CHECK` an die „Tickets: own cancel"-Policy ergänzen, analog zu PROJ-8s „Course bookings: own cancel": `WITH CHECK ((auth.uid() = customer_id) AND (status = 'cancelled'))`. Das allein reicht allerdings nicht ganz aus, da eine `WITH CHECK`-Klausel nur die resultierende Zeile prüft, nicht welche der ÜBRIGEN Spalten sich zusätzlich geändert haben (ein Kunde könnte theoretisch `status` korrekt auf „cancelled" setzen und gleichzeitig `price` mitändern) — eine zusätzliche Spalten-Schutzmaßnahme (z. B. ein `BEFORE UPDATE`-Trigger, der bei Kunden-Updates alle Spalten außer `status` auf Unverändert prüft) oder das vollständige Entfernen dieser Policy zugunsten einer SECURITY-DEFINER-RPC `cancel_event_ticket()` (exakt das bereits in diesem Feature etablierte Muster von `purchase_event_ticket()`/`checkin_event_ticket()`) wird empfohlen.
- **Priority:** Fix before deployment

### Summary
- **Acceptance Criteria:** 14/14 passed (+ 1 additional check)
- **Bugs Found:** 1 total (1 Critical, 0 High, 0 Medium, 0 Low)
- **Security:** Issues found — see BUG-1
- **Production Ready:** NO
- **Recommendation:** Fix BUG-1 (RLS `WITH CHECK` gap on `tickets` UPDATE policy) before deployment, then re-run `/qa`. All functional acceptance criteria already pass and do not need to be re-tested unless the fix changes ticket-cancellation behavior.

### Automated Test Coverage
- **Unit tests:** `src/lib/validations/events.test.ts` (8 new tests: `eventSchema`/`createEventSchema` future-date rule, capacity/price validation, end-before-start rejection), `src/lib/notifications/templates.test.ts` (3 new tests for the `event_tickets` notification content: purchased confirmed vs. reserved wording, event-cancellation wording, HTML-escaping of event names). Full suite: **159/159 passing** (`npm test`).
- **E2E tests:** `tests/PROJ-14-events-workshops-tickets-qr-checkin.spec.ts` (12 tests covering all 14 ACs). **12/12 passing** on Chromium (first clean run against fresh fixtures — this project's established convention is that E2E specs are one-shot against the single shared production DB, so a second run without resetting fixtures produces expected state-dependent mismatches, not real failures; see `feedback_no_staging_test_assumptions` memory). Mobile-Safari (WebKit) automated run was blocked by a Playwright browser-install lockfile held by a concurrent, unrelated process on this machine; substituted a 375px-viewport chromium check of `/events`, `/checkin`, `/profil`, and `/admin/events` — no horizontal overflow on any of them.
- **New E2E fixtures created** (production DB, prefixed `e2e14-`/`E2E14`): 4 auth users (`e2e14-customer-mandate`, `e2e14-customer-nomandate`, `e2e14-admin`, `e2e14-teacher`), 1 SEPA mandate, 5 events (`E2E14 Kaufen Event`, `E2E14 Ausgebucht Event`, `E2E14 Checkin Event`, `E2E14 Cancel Notify Event`, `E2E14 Stornofrist Event`). These persist as the permanent regression fixtures for this spec, matching the project's established convention for other features' E2E suites.
- **Memory update:** extended the existing `gotrue-null-token-bug` memory — `auth.users.created_at`/`updated_at` also need to be set explicitly on direct-SQL test-account creation (no DB default), same failure class as the already-documented token columns.

## Deployment
_To be added by /deploy_
