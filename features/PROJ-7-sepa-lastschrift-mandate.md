# PROJ-7: SEPA-Lastschriftmandate & Sammel-Einzug

## Status: Planned
**Created:** 2026-08-14
**Last Updated:** 2026-08-14

## Dependencies
- Requires: PROJ-2 (Auth & Kundenprofil) — Kunde muss eingeloggt sein, um ein Mandat zu hinterlegen
- Requires: PROJ-4 (Admin: Kunden-/Mitgliederverwaltung) — nutzt die bestehende `subscriptions`-Tabelle (Name, Preis, Status) als Grundlage für den SEPA-Sammel-Export

## User Stories
- Als Kunde möchte ich in meinem Profil ein SEPA-Lastschriftmandat mit meiner IBAN hinterlegen, damit meine monatlichen Abo-Gebühren automatisch eingezogen werden können, ohne dass ich selbst überweisen muss.
- Als Kunde möchte ich mein hinterlegtes Mandat jederzeit einsehen oder entfernen können, damit ich die Kontrolle über meine Zahlungsdaten behalte (z. B. bei Bankwechsel).
- Als Admin möchte ich zu einem gewählten Fälligkeitsdatum eine SEPA-Sammellastschrift-XML-Datei für alle Kunden mit aktivem Abo und hinterlegtem Mandat erzeugen, damit ich sie direkt in mein Online-Banking hochladen kann, ohne Beträge manuell zusammenzusuchen.
- Als Admin möchte ich sehen, welche Lastschriftläufe ich bereits erzeugt habe, damit ich keinen Kunden versehentlich doppelt in einem Zeitraum abrechne.
- Als Admin möchte ich nachträglich einzelne Kunden in einem Lauf als „rückgebucht" markieren können, damit ich den Überblick behalte, welche Einzüge tatsächlich erfolgreich waren.
- Als Admin möchte ich auf der Kundendetailseite sehen, ob und welche Zahlungsmethode ein Kunde hinterlegt hat, damit ich beim Support sofort den Status einschätzen kann.

## Out of Scope
- Kreditkarten-Zahlungen — der ursprüngliche Feature-Titel („Stripe-Zahlungsinfrastruktur") wurde im Spec-Interview verworfen; Vor-Ort-Zahlungen laufen weiterhin bar oder per SumUp, außerhalb der App
- Automatischer elektronischer Rückmeldekanal für Rücklastschriften (z. B. Bank-API-Anbindung) — es gibt keine Bank-Anbindung; Rückbuchungen werden vom Admin manuell anhand des Kontoauszugs erfasst
- Automatischer E-Mail-Versand der Vorabankündigung an Kunden vor jedem Einzug — echter E-Mail-Versand folgt mit PROJ-16 (Automatische E-Mail-/Push-Benachrichtigungen); die verkürzte Frist wird für PROJ-7 ausschließlich über den Mandatstext rechtlich abgesichert
- Automatisches Ändern des Abo-Status bei Mandat-Entfernung — Abo-Status bleibt admin-gepflegt wie in PROJ-4, es erscheint nur ein In-App-Hinweis
- Tarif-/Produktkatalog, Rechnungsstellung, Rechnungsarchiv — gehört zu PROJ-10
- Self-Service Pause/Kündigung des Abos selbst — gehört zu PROJ-9
- Buchung neuer Kurse/Abos — gehört zu PROJ-8

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Kunde ist eingeloggt und hat noch kein Mandat hinterlegt, wenn er auf `/profil` IBAN, Kontoinhaber und Zustimmung zum Mandatstext ausfüllt und absendet, dann wird das Mandat gespeichert und auf `/profil` als aktiv angezeigt
- [ ] Angenommen ein Kunde gibt eine ungültige IBAN ein (falsches Format oder falsche Prüfziffer), wenn er das Formular absendet, dann erscheint eine Validierungsfehlermeldung und es wird kein Mandat gespeichert
- [ ] Angenommen ein Kunde hat bereits ein Mandat, wenn er ein neues Mandat mit anderer IBAN anlegt, dann ersetzt das neue Mandat das alte vollständig
- [ ] Angenommen ein Kunde hat ein aktives Mandat, wenn er es entfernt, dann verschwindet es aus seiner Ansicht, sein Abo-Status in PROJ-4 bleibt unverändert, und auf den Admin-Kundenseiten erscheint ein Hinweis „Mandat entfernt — Abo prüfen"
- [ ] Angenommen der Admin öffnet die Kundendetailseite, wenn ein Kunde ein Mandat hinterlegt hat, dann sieht der Admin „SEPA-Mandat hinterlegt" inkl. Datum; hat der Kunde keins, sieht er „Kein Mandat hinterlegt"
- [ ] Angenommen der Admin öffnet die neue Lastschrift-Übersicht, wenn er ein Fälligkeitsdatum wählt und die Erstellung startet, dann erzeugt die App eine SEPA-XML-Datei mit allen Kunden, die zu diesem Zeitpunkt Status „aktiv" (PROJ-4) UND ein hinterlegtes Mandat haben, mit dem jeweiligen Abo-Preis als Betrag
- [ ] Angenommen kein Kunde erfüllt beide Bedingungen (aktives Abo + Mandat), wenn der Admin die Erstellung startet, dann erscheint ein Hinweis „Keine Kunden für diesen Lauf gefunden" statt einer leeren Datei
- [ ] Angenommen ein Lastschriftlauf für ein bestimmtes Fälligkeitsdatum wurde bereits erzeugt, wenn der Admin versucht, für dasselbe Datum erneut einen Lauf zu erzeugen, dann warnt die App vor doppeltem Einzug und lässt den Admin explizit bestätigen
- [ ] Angenommen ein Lastschriftlauf existiert, wenn der Admin die Lauf-Übersicht öffnet, dann sieht er alle enthaltenen Kunden mit Betrag und kann einzelne Einträge als „rückgebucht" markieren
- [ ] Angenommen ein Kunde ohne Login versucht `/profil` aufzurufen, wenn die Seite lädt, dann greift der bestehende Login-Redirect aus PROJ-2 unverändert

## Edge Cases
- Kunde ändert sein Mandat, nachdem ein Lauf für ein zukünftiges Fälligkeitsdatum bereits exportiert wurde → die bereits exportierte XML-Datei ist ein Snapshot und ändert sich nicht rückwirkend; das neue Mandat gilt erst für den nächsten Lauf
- Kunde hat mehrere aktive Abos (laut PROJ-4 möglich) → alle aktiven Abo-Beträge dieses Kunden werden im selben Lauf als separate Buchungspositionen mit derselben Mandatsreferenz berücksichtigt
- Kunde hat ein Mandat, aber kein aktives Abo (z. B. nur „pausiert" oder „gekündigt") → wird nicht in den Lauf aufgenommen
- IBAN aus einem Nicht-EU/Nicht-SEPA-Land → wird von der Formatprüfung abgelehnt, da außerhalb des SEPA-Raums kein Lastschrifteinzug möglich ist
- Admin erzeugt einen Lauf, storniert ihn aber gedanklich, bevor die Datei tatsächlich hochgeladen wurde → es gibt keinen expliziten „Stornieren"-Status für PROJ-7 MVP; der Lauf bleibt als Datensatz bestehen (Historie), nur einzelne Kunden können als rückgebucht markiert werden

## Technical Requirements (optional)
- Security: Alle Mandatsdaten (IBAN, Kontoinhaber) nur für den Kunden selbst und Admins lesbar (RLS-Muster aus PROJ-1/PROJ-4); IBAN wird nie an Dritte außer der erzeugten XML-Datei weitergegeben
- Compliance: Mandatstext muss die verkürzte Vorabankündigungsfrist explizit enthalten und vom Kunden aktiv bestätigt werden (Zeitstempel der Zustimmung wird gespeichert)

## Open Questions
- [ ] Der genaue Wortlaut des SEPA-Mandatstexts (inkl. verkürzter Vorabankündigungsfrist) sollte vor dem Launch von einem Steuerberater oder der kontoführenden Bank geprüft werden — ich kann die rechtliche Korrektheit des Texts nicht verifizieren
- [ ] Auf wie viele Tage soll die verkürzte Vorabankündigungsfrist im Mandatstext festgelegt werden (z. B. 2, 5 Tage)? Wird in `/architecture` oder spätestens vor Launch final entschieden

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Kein Stripe, stattdessen selbst erzeugte SEPA-XML-Sammellastschrift | Nutzer hat bereits eine eigene Gläubiger-ID; spart laufende Transaktionsgebühren gegenüber Stripe, akzeptiert dafür manuellen monatlichen Bank-Upload und manuelle Rücklastschrift-Erfassung | 2026-08-14 |
| Kreditkarten-Zahlung komplett aus dem Scope entfernt | Vor-Ort-Zahlungen laufen bar/SumUp außerhalb der App; ursprünglicher Feature-Titel („...Kreditkarte") war ein Platzhalter aus `/init`, nicht mehr zutreffend | 2026-08-14 |
| Nur eine aktive Zahlungsmethode (Mandat) pro Kunde, neues ersetzt altes | Ein SEPA-Mandat gilt pro Bankverbindung; passt zum bestehenden Ein-Kunde-mehrere-Abos-Modell aus PROJ-4, ein Mandat deckt alle Abos eines Kunden ab | 2026-08-14 |
| Zahlungsmethoden-Sektion auf bestehender `/profil`-Seite statt neuer Route | Es gibt noch kein „Mein Tanzbereich"-Dashboard (kommt erst mit PROJ-8/9/10); vermeidet eine verfrühte Navigationsstruktur | 2026-08-14 |
| Admin sieht Mandat-Status (nicht die volle IBAN) auf Kundendetailseite | Nützlich für Support/Übersicht während der Übergangsphase mit den manuellen PROJ-4-Abos, ohne sensible Daten unnötig im Admin-UI zu exponieren | 2026-08-14 |
| Verkürzte Vorabankündigungsfrist im Mandatstext statt gesetzlicher 14-Tage-Frist mit externer Ankündigung | Ermöglicht kurzfristigere, planbare Abbuchungstermine für den Admin; automatischer E-Mail-Versand wird erst mit PROJ-16 nachgezogen, keine verfrühte Notification-Infrastruktur | 2026-08-14 |
| Admin wählt nur ein Fälligkeitsdatum, App sammelt automatisch alle aktiven Abos mit Mandat | Reduziert monatlichen manuellen Aufwand gegenüber Einzelauswahl pro Kunde, passt zum Ziel „Nimbuscloud-Workaround durch Self-Service/Automatisierung ersetzen" | 2026-08-14 |
| Lastschriftläufe werden als Datensatz mit enthaltenen Kunden gespeichert, inkl. manueller „rückgebucht"-Markierung | Verhindert versehentlichen Doppel-Einzug im selben Zeitraum; da keine Bank-Anbindung existiert, ist eine manuelle Rückmeldung die einzig mögliche Lösung für PROJ-7 | 2026-08-14 |
| Mandat-Entfernung ändert Abo-Status nicht automatisch, nur In-App-Hinweis für Admin | Abo-Status bleibt bewusst admin-gepflegt wie in PROJ-4 etabliert; echte E-Mail-Benachrichtigung wäre verfrühter Vorgriff auf PROJ-16 | 2026-08-14 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
