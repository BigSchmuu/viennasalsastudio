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
- [ ] Der genaue Wortlaut des SEPA-Mandatstexts (inkl. verkürzter Vorabankündigungsfrist von 5 Tagen) sollte vor dem Launch von einem Steuerberater oder der kontoführenden Bank geprüft werden — ich kann die rechtliche Korrektheit des Texts nicht verifizieren
- [x] Auf wie viele Tage soll die verkürzte Vorabankündigungsfrist im Mandatstext festgelegt werden? → 5 Tage (2026-08-14)

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

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Mandat-Wechsel = altes Mandat widerrufen + neues mit frischer Mandatsreferenz anlegen (nicht überschreiben) | Bewahrt die Historie widerrufener Mandate für die SEPA-Aufbewahrungspflicht (mind. 14 Monate nach letzter Nutzung); „nur ein aktives Mandat" wird über eine Datenbankregel erzwungen, die pro Kunde höchstens ein nicht-widerrufenes Mandat zulässt | 2026-08-14 |
| Betrag, IBAN, Kontoinhaber und Mandatsreferenz werden pro Kunde als Momentaufnahme in der jeweiligen Lastschriftposition gespeichert, nicht live aus Mandat/Abo nachgeladen | Ein Lastschriftlauf muss dauerhaft exakt widerspiegeln, was zum Erzeugungszeitpunkt tatsächlich eingezogen wurde — auch wenn der Kunde sein Mandat später ändert oder der Abo-Preis sich ändert (siehe Edge Case „Mandat-Änderung nach Export") | 2026-08-14 |
| SEPA-XML-Datei wird bei Bedarf aus den gespeicherten Momentaufnahme-Daten neu generiert statt als Datei-Blob abgelegt | Erzeugung ist deterministisch aus den gespeicherten Positionsdaten; spart Speicherplatz und vermeidet eine zusätzliche Datei-Storage-Anbindung für ein Feature, das ohnehin nur lokal heruntergeladen wird | 2026-08-14 |
| Doppel-Lauf-Warnung als weiche Prüfung (Abfrage auf existierende Läufe mit demselben Fälligkeitsdatum), kein harter Datenbank-Constraint | Spec verlangt explizit, dass der Admin einen zweiten Lauf für dasselbe Datum bestätigt bekommen, aber notfalls trotzdem auslösen kann (z. B. Korrekturlauf) | 2026-08-14 |
| „Mandat entfernt — Abo prüfen"-Hinweis wird live berechnet (aktives Abo ohne aktives Mandat), keine eigene Flag-Spalte | Vermeidet eine zusätzliche Zustandsquelle, die aus dem Takt geraten könnte; der Hinweis ist bei jedem Seitenaufruf automatisch korrekt | 2026-08-14 |
| IBAN-Validierung über Standard-Prüfsummenalgorithmus (ISO 7064 MOD 97-10), client- und serverseitig, ohne zusätzliches Fremdpaket | Ausreichend zuverlässig für Formatprüfung, keine zusätzliche Abhängigkeit nötig | 2026-08-14 |
| Vorabankündigungsfrist im Mandatstext auf 5 Tage festgelegt | Nutzerentscheidung im Architektur-Interview; schließt die zuvor offene Frage aus dem Spec-Interview | 2026-08-14 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Komponentenstruktur

**Kundenseite — Erweiterung von `/profil`:**
```
/profil
└── Zahlungsmethode (neue Sektion)
    ├── Kein Mandat hinterlegt
    │   └── Mandats-Formular (IBAN, Kontoinhaber, Mandatstext + Zustimmungs-Checkbox)
    └── Mandat vorhanden
        ├── Anzeige: maskierte IBAN, Kontoinhaber, hinterlegt seit
        └── "Mandat entfernen"-Button (mit Bestätigungsdialog)
```

**Admin — Erweiterung von `/admin/kunden/[id]` (aus PROJ-4):**
```
Kundendetailseite
└── Zahlungsmethoden-Status (read-only Badge)
    ├── "SEPA-Mandat hinterlegt seit [Datum]"
    ├── "Kein Mandat hinterlegt"
    └── "Mandat entfernt — Abo prüfen" (wenn aktives Abo ohne Mandat)
```

**Admin — neue Seite `/admin/lastschriften`:**
```
/admin/lastschriften
├── "Neuen Lauf erstellen"
│   ├── Fälligkeitsdatum-Auswahl
│   └── Warnhinweis + Bestätigung bei Datums-Kollision
├── Lauf-Historie (Tabelle: Fälligkeitsdatum, Anzahl Kunden, Gesamtbetrag, erstellt am)
└── Lauf-Detail
    ├── Positionsliste (Kunde, Abo, Betrag, Status offen/rückgebucht)
    ├── "Als rückgebucht markieren"-Aktion pro Position
    └── "SEPA-XML herunterladen"-Button
```
Admin-Nav wird um „Lastschriften" ergänzt.

### B) Datenmodell (fachlich)

**SEPA-Mandat** — pro Kunde höchstens ein aktives Mandat gleichzeitig:
- Zugehöriger Kunde
- IBAN
- Name des Kontoinhabers
- Eindeutige Mandatsreferenz (automatisch vergeben)
- Zeitpunkt der Zustimmung zum Mandatstext
- Widerrufszeitpunkt (leer, solange das Mandat aktiv ist — beim Ersetzen durch ein neues Mandat wird das alte widerrufen statt gelöscht, damit die SEPA-Aufbewahrungspflicht eingehalten wird)

**Lastschriftlauf** — ein Sammel-Einzug zu einem Fälligkeitsdatum:
- Fälligkeitsdatum
- Zeitpunkt der Erstellung

**Lastschriftposition** — eine einzelne Buchung innerhalb eines Laufs (ein Kunde kann mehrere Positionen haben, wenn er mehrere aktive Abos hat):
- Zugehöriger Lauf
- Zugehöriger Kunde
- Zugehöriges Abo (aus PROJ-4)
- Betrag (Momentaufnahme des damaligen Abo-Preises)
- IBAN, Kontoinhaber, Mandatsreferenz (Momentaufnahme des damaligen Mandats)
- Rückbuchungs-Status (offen / rückgebucht) inkl. Zeitpunkt der Markierung

Gespeichert in: Supabase/PostgreSQL, wie alle bisherigen Features. Zugriff ausschließlich per Server Actions, kein REST-API-Layer.

### C) Tech-Entscheidungen (Begründung)

- **Mandat wird bei Ersetzung widerrufen statt gelöscht:** SEPA verlangt, Mandatsdaten mindestens 14 Monate nach letzter Nutzung aufzubewahren. Ein hartes Löschen würde diese Nachweispflicht verletzen. „Nur ein aktives Mandat pro Kunde" wird trotzdem sauber erzwungen, indem pro Kunde nur ein nicht-widerrufenes Mandat gleichzeitig existieren darf.
- **Lastschriftpositionen speichern eine Momentaufnahme, keine Live-Referenz:** Ändert ein Kunde später sein Mandat oder der Admin den Abo-Preis, darf sich ein bereits erzeugter Lastschriftlauf rückwirkend nicht mehr verändern — genau das verlangt der in der Spec dokumentierte Edge Case.
- **Kein Datei-Storage für die XML-Datei:** Da die Positionsdaten vollständig gespeichert sind, kann die SEPA-XML jederzeit deterministisch neu erzeugt werden. Das spart eine zusätzliche Storage-Anbindung für eine Datei, die ohnehin nur einmalig heruntergeladen und ins Online-Banking hochgeladen wird.
- **Doppel-Lauf-Prüfung als weicher Hinweis, kein Constraint:** Die Spec verlangt eine Warnung mit Bestätigungsmöglichkeit, keinen harten Stopp — ein Admin muss z. B. einen Korrekturlauf für dasselbe Datum auslösen können.
- **IBAN-Prüfsummenvalidierung ohne Fremdpaket:** Der IBAN-Prüfsummenalgorithmus (ISO 7064 MOD 97-10) ist ein öffentlich standardisierter, kurzer Algorithmus — eine zusätzliche Abhängigkeit dafür ist nicht nötig.

### D) Abhängigkeiten (Pakete)
Keine neuen Fremdpakete nötig. Die SEPA-XML-Erzeugung (ISO-20022-Format „pain.008") wird als einfache Textvorlage serverseitig zusammengesetzt; IBAN-Prüfsummenvalidierung ist ein kurzer Standardalgorithmus ohne externe Bibliothek. Bestehende Werkzeuge (Zod, Supabase, shadcn/ui) decken den Rest ab.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
