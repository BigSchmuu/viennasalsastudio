# PROJ-16: Automatische E-Mail-/Push-Benachrichtigungen

## Status: Planned
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

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
