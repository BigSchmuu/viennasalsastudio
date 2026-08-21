# PROJ-29: Probestunden-Follow-up & Conversion-Tracking

## Status: Planned
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Dependencies
- PROJ-8 (Kursbuchung) — Datenmodell für Probestunden (`course_bookings.type = 'trial'`)

## User Stories
- Als Admin möchte ich eine Übersicht aller Probestunden-Buchungen sehen, damit ich nachverfolgen kann, wer noch nicht regulär gebucht hat.
- Als Admin möchte ich einen Kunden als „kontaktiert" markieren und eine Notiz hinterlegen können, damit ich meine Follow-up-Bemühungen dokumentiere.
- Als Admin möchte ich eine Gesamt-Conversion-Rate (Probestunde → reguläre Buchung) sehen, damit ich beurteilen kann, wie gut der Probestunden-Trichter funktioniert.

## Out of Scope
- Automatisierte Erinnerungs-Mails an Admin oder Kunden — rein manuelle Nachverfolgung fürs MVP
- Conversion-Rate-Trend über Zeit/Diagramme — nur eine aktuelle Gesamtzahl für einen wählbaren Zeitraum
- Zuordnung von Follow-ups an einzelne Mitarbeiter — Solo-Administration, kein Team-Feature nötig

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Kunde hat eine Probestunde gebucht, wenn der Admin die Probestunden-Übersicht öffnet, dann erscheint der Kunde mit Kursname, Datum der Probestunde und Status (offen/kontaktiert/konvertiert)
- [ ] Angenommen ein Kunde hat nach seiner Probestunde eine reguläre Buchung oder ein Abo abgeschlossen, wenn der Admin die Übersicht öffnet, dann ist dieser Kunde automatisch als „konvertiert" markiert
- [ ] Angenommen ein Kunde ist noch nicht konvertiert, wenn der Admin den Haken „kontaktiert" setzt und optional eine Notiz einträgt, dann wird dies gespeichert und bleibt beim erneuten Öffnen sichtbar
- [ ] Angenommen die Probestunden-Übersicht ist offen, wenn der Admin sie betrachtet, dann sieht er eine Gesamt-Conversion-Rate (Anteil konvertierter Probestunden an allen Probestunden) für einen wählbaren Zeitraum
- [ ] Angenommen eine Probestunde liegt mehr als 14 Tage zurück ohne dass „kontaktiert" gesetzt wurde und ohne Konvertierung, wenn der Admin die Übersicht öffnet, dann wird dieser Eintrag als „Follow-up überfällig" hervorgehoben
- [ ] Angenommen der Admin filtert nach Status „Offen", wenn er den Filter anwendet, dann werden nur weder kontaktierte noch konvertierte Probestunden angezeigt

## Edge Cases
- Ein Kunde bucht mehrere Probestunden in verschiedenen Kursen — jede wird als eigener Eintrag geführt; Konvertierung prüft, ob nach der jeweiligen Probestunde irgendeine reguläre Buchung erfolgte.
- Probestunden vor Einführung dieses Features werden rückwirkend erfasst, da sie auf den bestehenden `course_bookings`-Daten basieren — keine neue Datenerfassung nötig.
- Ein Kunde konvertiert, storniert später aber sein Abo wieder — bleibt trotzdem als „konvertiert" markiert, da die Konvertierung ein historisches Ereignis ist, kein aktueller Status.

## Technical Requirements (optional)
- Conversion-Berechnung basiert auf bestehenden `course_bookings`-Daten, keine neue Tabelle für die Buchungen selbst — nur für den Kontaktiert-Status/Notiz nötig.

## Open Questions
- Keine offenen Fragen zum Zeitpunkt der Spec-Erstellung.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Conversion = irgendeine reguläre Buchung/Abo nach der Probestunde, kein festes Zeitfenster | Einfacher als ein Zeitfenster zu pflegen; Admin sieht das Datum und kann selbst beurteilen | 2026-08-21 |
| Manuelle Nachverfolgung (Haken + Notiz) statt automatischer Erinnerungs-Mails | User-Entscheidung: reduziert Scope, keine Überschneidung mit dem Newsletter-Feature (PROJ-28) | 2026-08-21 |
| „Follow-up überfällig" ab 14 Tagen ohne Kontakt/Konvertierung | Sinnvoller Standardwert als fixe Konstante fürs MVP | 2026-08-21 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Neue, kleine Tabelle nur für „kontaktiert"-Status und Notiz statt Erweiterung der bestehenden Buchungstabelle | Diese beiden Felder sind ausschließlich für Probestunden relevant — eine Erweiterung der allgemeinen Buchungstabelle würde für alle anderen Buchungstypen (regulär, Drop-in) dauerhaft leere Spalten anlegen | 2026-08-21 |
| Konvertierungs- und „Follow-up überfällig"-Status sind reine Berechnungen, kein gespeicherter Status | Konsistent mit dem bereits etablierten Muster abgeleiteter Status-Werte aus PROJ-31/PROJ-33 — verhindert, dass ein Status „veraltet", weil er nie gespeichert, sondern bei jedem Seitenaufruf live berechnet wird | 2026-08-21 |
| `/backend` nötig (neue Tabelle + Berechtigungen + Speicherfunktion für „kontaktiert"/Notiz) | Im Unterschied zu PROJ-31/PROJ-33 wird hier erstmals ein neuer, admin-schreibbarer Zustand dauerhaft gespeichert (nicht nur gelesen/abgeleitet) — das erfordert eine neue Datenbanktabelle mit Zugriffsregeln und eine Speicherfunktion, kein reines Frontend-Feature | 2026-08-21 |
| Konvertierung = irgendeine reguläre Buchung ODER ein Abo für denselben Kunden nach dem Probestunden-Termin | Bestätigt durch Code-Review des bestehenden Bestätigungs-Ablaufs: Eine bestätigte reguläre Buchungsanfrage legt automatisch ein Abo an — beide Signale zusammen decken „hat regulär gebucht" vollständig ab | 2026-08-21 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Component Structure (Visual Tree)

```
Neue Admin-Seite: /admin/probestunden ("Probestunden" in der Admin-Navigation)
├── Zeitraum-Filter (wiederverwendet den bestehenden Zeitraum-Baustein aus PROJ-17)
├── Conversion-Rate-Kachel — Anteil konvertierter Probestunden im gewählten Zeitraum
├── Status-Filter: Alle / Offen / Kontaktiert / Konvertiert
└── Probestunden-Tabelle
    ├── Spalten: Kunde, Kurs, Datum der Probestunde, Status-Badge
    │   (Offen / Kontaktiert / Konvertiert)
    ├── „Follow-up überfällig"-Hervorhebung für offene Einträge, deren
    │   Probestunden-Termin mehr als 14 Tage zurückliegt
    └── Zeilen-Aktion (nur bei nicht-konvertierten Einträgen):
        „Kontaktiert"-Haken + optionales Notizfeld, sofort speicherbar
```

### B) Data Model (plain language)

```
Neue Tabelle „Probestunden-Nachverfolgung" — genau ein Eintrag pro
Probestunden-Buchung:
- Verweis auf die zugehörige Probestunden-Buchung
- Kontaktiert: Ja/Nein
- Notiz: Freitext, optional
- Zeitpunkt der Kontaktierung

Alles andere wird bei jedem Seitenaufruf direkt aus den bereits
bestehenden Buchungsdaten berechnet, analog zum etablierten Muster
abgeleiteter Status-Werte (PROJ-31, PROJ-33):
- Konvertiert = für diesen Kunden existiert nach dem Probestunden-Termin
  mindestens eine reguläre Buchung oder ein Abo
- Follow-up überfällig = Probestunden-Termin liegt mehr als 14 Tage
  zurück UND weder kontaktiert noch konvertiert
- Conversion-Rate im Zeitraum = konvertierte Probestunden im Zeitraum
  geteilt durch alle Probestunden im Zeitraum

Gespeichert in: bestehende Buchungsdaten unverändert; nur der
Kontaktiert-Status/Notiz landet in der neuen, kleinen Tabelle.
```

### C) Tech Decisions (justified for PM)

- **Nur eine neue, kleine Tabelle statt einer großen Umstrukturierung:** Kunde, Kurs, Datum und der Konvertierungs-Status kommen bereits vollständig aus den vorhandenen Buchungsdaten. Es muss wirklich nur der manuelle „kontaktiert"-Haken samt Notiz irgendwo gespeichert werden — dafür reicht eine schlanke, zusätzliche Tabelle.
- **Konvertierung und „überfällig" werden nie gespeichert, sondern immer live berechnet:** Damit kann der Status nie im Hintergrund veralten (z.B. wenn ein Kunde erst Tage nach der Probestunde konvertiert) — jede Anzeige ist automatisch aktuell.
- **Diesmal mit `/backend`-Schritt:** Anders als bei den letzten beiden Features (PROJ-31, PROJ-33) wird hier zum ersten Mal ein neuer, admin-editierbarer Zustand dauerhaft gespeichert (der „kontaktiert"-Haken und die Notiz), nicht nur aus bestehenden Daten abgeleitet — dafür braucht es eine neue Datenbanktabelle mit passenden Zugriffsregeln.

### D) Dependencies (packages to install)

- Keine neuen Pakete nötig — nutzt bereits vorhandene shadcn/ui-Bausteine (Table, Badge, Checkbox, Textarea) und den bestehenden Zeitraum-Filter-Baustein aus dem Admin-Dashboard (PROJ-17).

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
