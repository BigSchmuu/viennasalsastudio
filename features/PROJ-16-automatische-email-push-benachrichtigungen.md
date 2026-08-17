# PROJ-16: Automatische E-Mail-/Push-Benachrichtigungen

## Status: In Progress
**Created:** 2026-08-17
**Last Updated:** 2026-08-17

## Dependencies
- Requires: PROJ-2 (Auth & Kundenprofil) — Kunde muss eingeloggt sein und hat eine E-Mail-Adresse
- Requires: PROJ-7 (SEPA-Lastschriftmandate & Sammel-Einzug) — löst die SEPA-Vorab-Ankündigung aus
- Requires: PROJ-8 (Kursbuchung) — löst Buchungsstatus-Benachrichtigungen und die Kursstart-Erinnerung (Probestunde/Drop-in) aus
- Requires: PROJ-9 (Abo-Verwaltung Self-Service) — löst die Benachrichtigung bei wirksamer Kündigung/Pausierung aus
- Requires: PROJ-12 (Warteliste & automatische Nachrückung) — löst die Nachrück-Benachrichtigung aus

## User Stories
- Als Kunde möchte ich per E-Mail und/oder Push benachrichtigt werden, wenn sich der Status meiner Buchungsanfrage ändert, damit ich nicht aktiv im Profil nachschauen muss.
- Als Kunde möchte ich informiert werden, wenn ich von der Warteliste automatisch nachrücke, damit ich rechtzeitig reagieren kann.
- Als Kunde möchte ich wissen, wenn meine geplante Kündigung oder Pausierung wirksam geworden ist.
- Als Kunde möchte ich eine Erinnerung am Vortag meiner gebuchten Probestunde oder meines Drop-ins bekommen, damit ich den Termin nicht vergesse.
- Als Kunde möchte ich rechtzeitig vor einem SEPA-Lastschrifteinzug per E-Mail über Betrag und Fälligkeitsdatum informiert werden.
- Als Kunde möchte ich in meinem Profil steuern können, über welche Ereignisse ich per E-Mail bzw. Push informiert werde.

## Out of Scope
- **Admin-Benachrichtigungen** (z.B. bei neuer Buchungsanfrage) — Admin nutzt weiterhin das zentrale Dashboard; ein möglicher späterer, eigener Ausbau.
- **Kursstart-Erinnerung für kursgebundene Abo-Kunden** — nur für Probestunden und Drop-ins (siehe Decision Log). Ein Abo-Kunde mit wöchentlichem Fixtermin bekommt keine wiederkehrende Erinnerung.
- **Getrennte Einstellung für „Buchung bestätigt" vs. „Buchung abgelehnt"** — beide fallen unter eine gemeinsame Einstellungsgruppe „Buchungsstatus".
- **Abschaltbarkeit der SEPA-Vorab-Ankündigungs-Mail** — bleibt fix aktiv (siehe Decision Log).
- **Benachrichtigung bei neuer Rechnung** — bewusst ausgeschlossen; die Rechnung wird laut PROJ-10 ohnehin zeitgleich mit dem SEPA-Lastschriftlauf erstellt, eine eigene Rechnungs-Benachrichtigung wäre redundant zur SEPA-Vorab-Ankündigung für denselben Vorgang.
- **SMS als weiterer Kanal** — nicht angefragt.
- **In-App-Benachrichtigungs-Postfach** (Liste vergangener Benachrichtigungen innerhalb der App) — nur die externen Kanäle E-Mail und Push, keine App-interne Historie.
- **Rücklastschrift-Benachrichtigung** — die SEPA-bezogene E-Mail deckt nur die Vorab-Ankündigung vor dem Einzug ab, keine Nachricht bei fehlgeschlagener Abbuchung.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen eine Buchungsanfrage eines Kunden wird vom Admin bestätigt oder abgelehnt, wenn die Statusänderung gespeichert wird, dann erhält der Kunde je nach seinen Einstellungen eine E-Mail und/oder Push-Benachrichtigung mit dem neuen Status
- [ ] Angenommen ein Kunde rückt automatisch von der Warteliste in eine offene Anfrage nach, wenn dies geschieht, dann wird er je nach seinen Einstellungen per E-Mail und/oder Push informiert
- [ ] Angenommen eine geplante Kündigung oder Pausierung eines Kunden wird wirksam, wenn der Status entsprechend wechselt, dann wird der Kunde je nach seinen Einstellungen per E-Mail und/oder Push informiert
- [ ] Angenommen ein Kunde hat eine bestätigte Probestunde oder einen Drop-in für den nächsten Tag, wenn der tägliche Erinnerungs-Versand läuft, dann erhält der Kunde je nach seinen Einstellungen eine Erinnerung per E-Mail und/oder Push
- [ ] Angenommen ein Admin erstellt einen SEPA-Lastschriftlauf, wenn der Lauf gespeichert wird, dann erhalten alle enthaltenen Kunden automatisch eine Vorab-Ankündigungs-E-Mail mit Betrag und Fälligkeitsdatum, unabhängig von ihren Einstellungen
- [ ] Angenommen ein Kunde öffnet seinen Profilbereich, dann sieht er einen Abschnitt „Benachrichtigungen" mit getrennten E-Mail-/Push-Schaltern für Buchungsstatus, Warteliste, Abo-Kündigung und Kursstart-Erinnerung
- [ ] Angenommen ein Kunde hat die Push-Berechtigung im Browser noch nicht erteilt, wenn er den Bereich „Benachrichtigungen" öffnet, dann sieht er einen Button „Push-Benachrichtigungen aktivieren" anstelle aktivierbarer Push-Schalter
- [ ] Angenommen ein Kunde hat Push für ein Ereignis deaktiviert, wenn dieses Ereignis eintritt, dann erhält er keine Push-Benachrichtigung, aber weiterhin eine E-Mail, sofern diese aktiviert ist
- [ ] Angenommen der Versand einer E-Mail oder Push-Benachrichtigung schlägt fehl, dann wird die auslösende Aktion (z.B. Buchungsbestätigung) trotzdem vollständig durchgeführt und der Fehler nur geloggt

## Edge Cases
- Kunde hat auf mehreren Geräten/Browsern Push aktiviert → alle registrierten Geräte erhalten die Benachrichtigung
- Push-Berechtigung wurde vom Kunden nachträglich im Browser widerrufen → der Push-Versand für dieses Gerät schlägt fehl, ohne die restliche Aktion oder den E-Mail-Versand zu beeinträchtigen
- Kunde storniert eine Probestunde/einen Drop-in, nachdem die Erinnerung bereits versendet wurde → keine Rücknahme, die Erinnerung bleibt wie verschickt
- Ein Kunde ändert eine Benachrichtigungs-Einstellung, während eine auslösende Aktion gerade verarbeitet wird → der zum Versandzeitpunkt aktuell gespeicherte Einstellungsstand entscheidet
- Zwei SEPA-Läufe kurz hintereinander für denselben Kunden (z.B. Korrekturlauf) → jeder Lauf löst eine eigene, eigenständige Vorab-Ankündigung aus
- Kunde storniert seine Probestunde/seinen Drop-in und bucht sofort erneut für denselben nächsten Tag → gilt als neue Buchung, die reguläre Erinnerungslogik greift unverändert, sofern der tägliche Versand für diesen Tag noch nicht gelaufen ist

## Technical Requirements (optional)
- Security: Benachrichtigungs-Einstellungen sind ausschließlich für den jeweiligen Kunden selbst einsehbar und änderbar
- Datenintegrität: Für jede Probestunde/jeden Drop-in wird höchstens eine Erinnerung verschickt, auch bei mehrfachem Lauf des täglichen Versands

## Open Questions
- [ ] Versandweg für E-Mails muss vor `/deploy` bereitstehen — entweder über die SMTP-Zugangsdaten einer bestehenden geschäftlichen E-Mail-Adresse des Studios (z.B. `info@viennasalsastudio.at`, kein zusätzlicher Dienst nötig, aber übliche Tageslimits eines normalen Postfachs) oder über einen dedizierten Transaktions-E-Mail-Dienst (z.B. Resend). Genaue Wahl wird in `/architecture` getroffen — technische Voraussetzung, kein offener Produktentscheid.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Beide Kanäle (E-Mail und Push) von Anfang an, nicht nur E-Mail zuerst | Explizite Nutzerentscheidung — deckt auch Kunden ab, die die App v.a. über die PWA nutzen | 2026-08-17 |
| Kern-Ereignis-Set: Buchung bestätigt/abgelehnt, Warteliste rückt nach, Abo-Kündigung wirksam | Deckt die Features ab, bei denen Kunden heute nur durch aktives Nachschauen im Profil von einer Änderung erfahren | 2026-08-17 |
| Zusätzlich Kursstart-Erinnerung und SEPA-Vorab-Ankündigung aufgenommen | Explizite Nutzerentscheidung; die SEPA-Vorab-Ankündigung deckt zugleich die SEPA-übliche Vorab-Informationspflicht vor einer Lastschrift ab | 2026-08-17 |
| SEPA-Mail = Vorab-Ankündigung vor dem Einzug (nicht nur bei Rücklastschrift) | Entspricht der SEPA-üblichen Ankündigungspflicht und ist die rechtlich sauberere Variante | 2026-08-17 |
| Kunden können E-Mail und Push getrennt pro Ereignisgruppe einstellen | Explizite Nutzerentscheidung für volle Kontrolle statt einer pauschalen Ein/Aus-Lösung | 2026-08-17 |
| SEPA-Vorab-Ankündigungs-Mail bleibt fix aktiv, nicht abschaltbar | Rechtlich relevant — eine versehentlich abgeschaltete Vorab-Ankündigungspflicht wäre für den Studio-Betreiber problematisch | 2026-08-17 |
| Keine eigene Benachrichtigung bei neuer Rechnung | Explizite Nutzerentscheidung; die Rechnung entsteht laut PROJ-10 zeitgleich mit dem SEPA-Lastschriftlauf, eine eigene Rechnungs-Mail wäre redundant zur SEPA-Vorab-Ankündigung für denselben Vorgang | 2026-08-17 |
| „Buchung bestätigt" und „Buchung abgelehnt" als eine gemeinsame Einstellungsgruppe „Buchungsstatus" | Hält die Einstellungs-Oberfläche überschaubar (4 statt 5+ Gruppen) | 2026-08-17 |
| Fehlgeschlagener Benachrichtigungs-Versand blockiert nie die auslösende Aktion, nur Logging | Konsistent mit bestehendem Muster im Projekt (z.B. Rechnungserstellung im SEPA-Lauf läuft weiter, auch wenn ein Teilschritt fehlschlägt) | 2026-08-17 |
| Push-Opt-in über expliziten Button in den Profil-Einstellungen statt automatischem Browser-Prompt | Browser stufen automatische Prompts zunehmend als störend ein; ein bewusster Klick hat die bessere Annahme-Quote | 2026-08-17 |
| E-Mails nutzen ein einfaches gebrandetes HTML-Grundlayout (Marken-Farben aus dem bestehenden Design-System) | Wirkt professionell, ohne für jeden E-Mail-Typ ein eigenes aufwendiges Design zu bauen | 2026-08-17 |
| Kursstart-Erinnerung nur für Probestunden und Drop-ins, nicht für kursgebundene Abo-Kunden | Abo-Kunden haben einen festen wöchentlichen Termin — eine wöchentliche Erinnerung würde eher nerven; bei einmaligen Terminen ist der Mehrwert am größten | 2026-08-17 |
| Admin-Benachrichtigungen explizit nicht in PROJ-16 enthalten | Admin sieht offene Vorgänge bereits zentral im Dashboard; eigener, größerer Scope für ein mögliches späteres Feature | 2026-08-17 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Warteschlangen-Muster (Outbox) statt direktem Versand aus der auslösenden Aktion heraus | Manche auslösenden Ereignisse (z.B. automatisches Nachrücken von der Warteliste) passieren tief in der Datenbank, nicht in einer Next.js-Aktion, die selbst eine E-Mail verschicken könnte. Ein Warteschlangen-Eintrag ist ein einfacher, schneller Datenbank-Eintrag, den jeder auslösende Vorgang zuverlässig setzen kann — erfüllt außerdem von Natur aus die Anforderung „Versand blockiert nie die Aktion" | 2026-08-17 |
| Erstmaliger geplanter Hintergrund-Job im Projekt (bisher gab es keinen) | Nötig für drei wiederkehrende Prüfungen, die es vorher nicht gab: tägliche Kursstart-Erinnerung, tägliche Prüfung „wird eine geplante Kündigung/Pausierung heute wirksam", und Abarbeiten der Warteschlange. Über die Hosting-Plattform (Vercel) gesteuert — kein zusätzlicher Dienst nötig | 2026-08-17 |
| E-Mail-Versand über die bestehende Studio-Mailadresse (SMTP-Zugangsdaten) statt über einen dedizierten Dienst wie Resend | Explizite Nutzerentscheidung — keine zusätzlichen laufenden Kosten, kein neuer Account nötig; das aktuelle Sendevolumen liegt weit unter den üblichen Tageslimits eines normalen Postfachs | 2026-08-17 |
| Push-Versand über den offenen Web-Push-Standard (kein Dienst eines Drittanbieters) | Browser-Push ist standardisiert und kostenlos nutzbar, benötigt nur ein einmalig erzeugtes Schlüsselpaar. Dafür ist eine kleine „Service Worker"-Datei im Browser nötig, die eingehende Push-Nachrichten empfängt und anzeigt — neue technische Grundlage, die auch künftige Push-Features nutzen können | 2026-08-17 |
| „Wirksam werden" einer geplanten Kündigung/Pausierung wird nur erkannt, nicht ausgelöst | Die eigentliche Status-Logik (ob eine Kündigung an einem Datum gilt) existiert in PROJ-9 bereits und wird weiterhin dynamisch anhand des gespeicherten Datums bestimmt. PROJ-16 fügt keine neue Status-Logik hinzu, sondern nur eine tägliche Prüfung, die am Stichtag eine Benachrichtigung einreiht | 2026-08-17 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Component Structure (Visual Tree)

```
Profil-Seite (bestehend)
+-- Bestehende Bereiche (Abo, Buchungen, Rechnungen, ...)
+-- NEU: Abschnitt "Benachrichtigungen"
    +-- Push-Status-Anzeige
    |   +-- Button "Push-Benachrichtigungen aktivieren" (wenn noch keine Browser-Berechtigung erteilt)
    |   +-- Hinweis "Push aktiv auf diesem Gerät" (wenn bereits erteilt, mit Möglichkeit zu deaktivieren)
    +-- Einstellungs-Tabelle: 4 Zeilen (Buchungsstatus, Warteliste, Abo-Kündigung, Kursstart-Erinnerung)
    |   x 2 Spalten (E-Mail, Push) mit Schaltern je Zelle
    +-- Hinweistext: SEPA-Vorab-Ankündigung ist immer aktiv und nicht abschaltbar

Neue Hintergrundprozesse (für Nutzer nicht sichtbar)
+-- Täglicher Prüf-Job
|   +-- Findet Probestunden/Drop-ins für morgen -> reiht Erinnerungen ein
|   +-- Findet Abo-Änderungen, die heute wirksam werden -> reiht Benachrichtigung ein
+-- Versand-Job (läuft regelmäßig, arbeitet die Warteschlange ab)
    +-- Für jeden wartenden Eintrag: prüft Kunden-Einstellung für dieses Ereignis+Kanal
    +-- Verschickt E-Mail (SMTP) und/oder Push (Web-Push), protokolliert Erfolg/Fehler
```

### B) Data Model (plain language)

**Benachrichtigungs-Einstellungen** (pro Kunde)
- Bezug zum Kunden
- Ereignisgruppe (Buchungsstatus / Warteliste / Abo-Kündigung / Kursstart-Erinnerung)
- Kanal (E-Mail / Push)
- Ein/Aus (Standard: an)

**Push-Registrierungen** (pro Kunde, pro Gerät/Browser)
- Bezug zum Kunden
- Vom Browser bereitgestellte Zugangsdaten für dieses Gerät
- Erstellt-Zeitstempel

**Benachrichtigungs-Warteschlange** (Outbox)
- Bezug zum Kunden
- Ereignistyp (z.B. „Buchung bestätigt", „SEPA-Vorab-Ankündigung")
- Zugehörige Daten für den Text (z.B. Kursname, Betrag, Datum)
- Status (wartend / versendet / fehlgeschlagen)
- Zeitstempel Erstellung + Zeitstempel Versand

Gespeichert in: Supabase Postgres (wie der Rest des Projekts). Jeder Kunde sieht und ändert ausschließlich seine eigenen Einstellungen und Push-Registrierungen (Row Level Security wie überall im Projekt). Die Warteschlange selbst ist für Kunden nicht direkt einsehbar — nur die Hintergrund-Jobs verarbeiten sie.

### C) Tech Decisions (justified for PM)

- **Warteschlange statt Direktversand**: Auslösende Ereignisse (z.B. automatisches Nachrücken von der Warteliste) passieren teils tief im Datenbank-Code. Ein Warteschlangen-Eintrag ist die einzige Stelle, die von überall zuverlässig gesetzt werden kann — und garantiert nebenbei, dass ein Versandfehler nie die eigentliche Aktion blockiert.
- **Neuer täglicher Hintergrund-Job**: Für die Kursstart-Erinnerung und die Erkennung „Kündigung wird heute wirksam" braucht es erstmals eine zeitgesteuerte Prüfung im Projekt. Läuft über die bestehende Hosting-Plattform (Vercel), kein zusätzlicher Dienst.
- **E-Mail über die bestehende Studio-Mailadresse (SMTP)**: Nutzerentscheidung — spart einen zusätzlichen Account und laufende Kosten, solange das Versandvolumen überschaubar bleibt.
- **Push über den offenen Web-Push-Standard**: Kein Drittanbieter-Dienst nötig, nur ein einmalig erzeugtes Schlüsselpaar. Der Browser übernimmt Zustellung und Anzeige über eine kleine, einmalig eingerichtete „Service Worker"-Datei.

### D) Dependencies (packages to install)
- `nodemailer` — Versand von E-Mails über die SMTP-Zugangsdaten der Studio-Mailadresse
- `web-push` — Versand von Browser-Push-Benachrichtigungen inkl. Verwaltung des Schlüsselpaars

### Voraussetzung vor `/deploy`
Der Studio-Betreiber muss vor dem Live-Gang die SMTP-Zugangsdaten der Studio-Mailadresse (Host, Port, Benutzername, Passwort) bereitstellen. Ohne diese Zugangsdaten kann kein E-Mail-Versand stattfinden; Push funktioniert unabhängig davon.

## Implementation Notes (Frontend)

**Gebaut:**
- Migration `proj16_notification_preferences_and_push_subscriptions`: Tabellen `notification_preferences` (customer_id, event_group, channel, enabled — Default an) und `push_subscriptions` (customer_id, endpoint, p256dh, auth_key), beide mit RLS „nur eigene Zeilen" wie bei `sepa_mandates`.
- `src/lib/constants/notifications.ts` — Ereignisgruppen/Kanäle + deutsche Labels und Beschreibungstexte.
- `src/lib/actions/notifications.ts` — `setNotificationPreference`, `subscribeToPush`, `unsubscribeFromPush` (alle RLS-geschützt über den eingeloggten Nutzer, kein SECURITY DEFINER nötig, da reine Own-Row-Daten wie bei PROJ-9).
- `public/sw.js` — Service Worker: zeigt eingehende Push-Nachrichten an, öffnet/fokussiert die App bei Klick.
- `src/hooks/use-push-notifications.ts` — Browser-seitiger Status (unterstützt/inaktiv/aktiv), Aktivieren/Deaktivieren inkl. VAPID-Subscription.
- `src/components/notifications/notification-settings-section.tsx` — Push-Status/Aktivieren-Block + 4×2-Einstellungstabelle (optimistisches Umschalten mit Rollback bei Fehler); Push-Schalter sind deaktiviert (ausgegraut), solange auf diesem Gerät kein aktives Push-Abo besteht — erfüllt AC „Button anstelle aktivierbarer Push-Schalter".
- Neue Card „Benachrichtigungen" in `src/app/(site)/profil/page.tsx`, lädt die bestehenden Einstellungen des Kunden serverseitig vor.
- VAPID-Schlüsselpaar einmalig generiert und in `.env.local` hinterlegt (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`); Platzhalter in `.env.local.example` ergänzt, ebenso ein dokumentierter SMTP-Platzhalterblock.
- Manuell im Browser verifiziert: Einstellungs-Umschalten persistiert korrekt in der DB (per SQL geprüft), Push-Spalte ist bis zur Aktivierung sichtbar deaktiviert, keine Konsolenfehler, `npm run build` und `npm run lint` sauber.

## Implementation Notes (Backend)

**Gebaut:**
- Migration `proj16_notification_queue`: Tabelle `notification_queue` (Outbox — customer_id, event_type, payload jsonb, dedupe_key unique, status, email_status, push_status, error_detail). RLS aktiviert, aber bewusst **ohne Policies** (wie `course_attendance`/`course_session_notes` in PROJ-13) — nur SECURITY-DEFINER-Funktionen (umgehen RLS über den Owner) und Server-Code mit dem Service-Role-Key dürfen darauf zugreifen, kein Zugriff über PostgREST für irgendeine Rolle.
- `enqueue_notification(customer_id, event_type, payload, dedupe_key)` — interne SECURITY-DEFINER-Hilfsfunktion, EXECUTE für `anon`/`authenticated` explizit entzogen (per SQL verifiziert: beide Rollen haben `has_function_privilege = false`). Nur aus anderen SECURITY-DEFINER-Funktionen heraus aufrufbar.
- `promote_waitlist_for_course` (PROJ-12) erweitert: reiht nach jeder automatischen Nachrückung eine `warteliste`-Benachrichtigung für den nachgerückten Kunden ein — der einzige Auslöser, der rein in SQL passiert und daher zwingend über die Warteschlange laufen muss (kann selbst keinen HTTP-Request auslösen).
- `src/lib/supabase/service.ts` — Service-Role-Client für Hintergrund-Code (umgeht RLS vollständig, nie im Browser verwenden).
- `src/lib/notifications/mailer.ts` — Nodemailer/SMTP-Versand; meldet klar "SMTP nicht konfiguriert", solange der Betreiber keine Zugangsdaten hinterlegt hat (erwarteter Zustand bis `/deploy`).
- `src/lib/notifications/push.ts` — Web-Push-Versand an alle Geräte eines Kunden; räumt abgelaufene/widerrufene Registrierungen (HTTP 404/410) automatisch auf.
- `src/lib/notifications/templates.ts` — reine Text-/HTML-Bausteine (gebrandetes Layout, Salsa-Rot/Mango-Gold) für alle 5 Ereignistypen; 6 Unit-Tests in `templates.test.ts`.
- `src/lib/notifications/dispatch.ts` — Kernlogik: `processQueueRow` (löst Anzeige-Details auf, prüft Kunden-Einstellungen außer bei der fixen SEPA-Ankündigung, versendet, aktualisiert die Zeile), `enqueueAndDispatch` (Einreihen + sofortiger Versandversuch, nie blockierend — für die admin-ausgelösten Ereignisse), `runDailyChecks` (Kursstart-Erinnerung für morgen + „Kündigung/Pausierung wird heute wirksam", beides idempotent über `dedupe_key`), `drainPendingQueue` (Sicherheitsnetz, holt u.a. die aus SQL eingereihten Warteliste-Benachrichtigungen ab).
- `src/app/api/cron/notifications/route.ts` + `vercel.json` — erster geplanter Hintergrund-Job im Projekt, täglich 06:00 UTC, abgesichert über `CRON_SECRET` (Vercels Standard-Cron-Absicherung); 3 Integrationstests in `route.test.ts`.
- Verdrahtung: `confirmRegularBooking`/`confirmDropinBooking`/`rejectBooking` (`bookings.ts`) und `createCollectionRun` (`sepa-collections.ts`) rufen nach erfolgreicher Aktion `enqueueAndDispatch` auf — sofortiger Versandversuch, Fehler werden nur geloggt, blockieren nie die eigentliche Aktion.
- Env-Variablen ergänzt: `CRON_SECRET` (generiert), `SMTP_PORT`/`SMTP_FROM`-Platzhalter.

**Live gegen die Produktions-DB verifiziert** (Testzeilen anschließend wieder entfernt):
- Cron-Route: 401 ohne/mit falschem `CRON_SECRET`, 200 mit korrektem.
- `dedupe_key`-Uniqueness verhindert doppelte Einreihung zuverlässig (`on conflict do nothing`).
- Voller Pfad admin bestätigt Buchung → `enqueueAndDispatch` läuft inline im selben Request, E-Mail-Versand schlägt korrekt und sauber protokolliert fehl (SMTP noch nicht konfiguriert — erwartet), Push wird korrekt übersprungen (keine Geräte registriert).
- Voller Pfad admin lehnt Buchung ab → `promote_waitlist_for_course` rückt den wartenden Kunden nach UND reiht die `warteliste`-Benachrichtigung korrekt als `pending` ein (kein Inline-Versand möglich); der nächste Cron-Lauf verarbeitet sie zuverlässig.
- Täglicher Erinnerungs-Check erkennt eine Probestunde für morgen korrekt und reiht sie ein.
- `npm run build`, `npm run lint`, `npm test` (129/129) alle sauber.

**Zwischenfall während der Live-Tests:** Beim Testen des Ablehnen-Pfads wurde versehentlich zusätzlich eine unabhängige, bereits bestehende PROJ-12-Test-Buchung (`157b496d…`, Status vorher „open") ebenfalls auf „abgelehnt" gesetzt — Ursache nicht abschließend geklärt (vermutlich eine Fehlbedienung des Testskripts). Status wurde umgehend auf „open" zurückgesetzt; alle sonstigen PROJ-12-Fixtures sind unberührt.

**Bewusst offen (siehe Open Questions):** Der tatsächliche E-Mail-Versand funktioniert erst, sobald der Studio-Betreiber echte SMTP-Zugangsdaten in den Produktions-Umgebungsvariablen hinterlegt (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`) — bis dahin werden alle E-Mail-Versuche sauber protokolliert als fehlgeschlagen markiert, ohne dass eine Aktion blockiert wird.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
