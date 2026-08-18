# PROJ-25: Self-Check-In für Kursanwesenheit (Abo-Kunden)

## Status: In Progress
**Created:** 2026-08-18
**Last Updated:** 2026-08-18

## Dependencies
- Requires: PROJ-6 (Stundenplan & Kalender) — der Self-Check-In-Button erscheint auf der bestehenden `/stundenplan`-Seite
- Requires: PROJ-9 (Abo-Verwaltung) — Voraussetzung ist ein aktives, kursgebundenes Abo
- Requires: PROJ-13 (Lehrer-Ansicht, Anwesenheit) — nutzt dieselbe Anwesenheits-Datengrundlage (`course_attendance`); der Lehrer sieht Self-Check-Ins in seiner bestehenden Anwesenheitsliste

## User Stories
- Als Kunde mit einem aktiven kursgebundenen Abo möchte ich mich für meine heutige Kursstunde selbst als anwesend markieren, damit der Lehrer nicht extra bei mir nachfragen oder mich abhaken muss.
- Als Kunde möchte ich sehen, ob ich für meine heutige Stunde bereits eingecheckt bin, damit ich nicht versehentlich doppelt einchecke.
- Als Kunde möchte ich einen versehentlichen Check-In wieder rückgängig machen können, solange die Stunde noch läuft.
- Als Lehrer möchte ich schon vor Kursbeginn sehen, wer sich bereits selbst eingecheckt hat, damit ich einen Überblick habe, bevor die Stunde beginnt.
- Als Lehrer möchte ich erkennen können, ob eine Anwesenheit von mir selbst oder vom Kunden per Self-Check-In gesetzt wurde, damit ich die Angabe im Zweifel einordnen kann.

## Out of Scope
- **Self-Check-In für Probestunden-/Drop-in-Kunden** — bewusst auf aktive, kursgebundene Abo-Kunden beschränkt. Probestunden/Drop-ins bleiben wie bisher ausschließlich vom Lehrer erfasst (PROJ-13).
- **QR-Code- oder ortsbasiertes Check-In** — es gibt (anders als bei Events, PROJ-14) keine Einlasskontrolle bei regulären Kursstunden; ein einfacher Button reicht.
- **Kunden-Sicht auf die eigene Anwesenheitshistorie** — der Kunde sieht nur den heutigen Check-In-Status, keine Liste vergangener Kursbesuche. Bleibt weiterhin bewusst ausgeklammert wie schon in PROJ-13 festgehalten; eine vollständige Historie wäre ein eigenes, größeres Feature.
- **Änderung der bestehenden Lehrer-Regel aus PROJ-13** — der Lehrer kann Anwesenheit weiterhin den ganzen Kurstag über markieren (nicht erst ab 30 Minuten vor Kursbeginn). Die neue Zeitfenster-Regel gilt ausschließlich für den Kunden-Self-Check-In.
- **Kursbuchung direkt von `/stundenplan` aus** — kam im Interview als Zusatzwunsch auf, ist aber ein eigenständiges Thema (Erweiterung von PROJ-6/PROJ-8, aktuell läuft Buchung nur über `/kurse`). Wird hier nicht mitgebaut, sondern als eigene Idee vermerkt für ein künftiges Feature.
- **Dritter Anwesenheits-Status „Entschuldigt"** — wie in PROJ-13 weiterhin nur Anwesend/Abwesend (bzw. „noch nicht markiert").

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Kunde mit aktivem kursgebundenem Abo ruft `/stundenplan` an einem Tag mit eigenem Kurstermin auf, mehr als 30 Minuten vor Kursbeginn, dann sieht er bei diesem Termin noch keinen Self-Check-In-Button
- [ ] Angenommen ein Kunde mit aktivem kursgebundenem Abo ruft `/stundenplan` auf, ab 30 Minuten vor Kursbeginn seiner heutigen Stunde, dann sieht er bei diesem Termin einen „Ich bin da"-Button
- [ ] Angenommen ein Kunde klickt „Ich bin da", dann wird seine Anwesenheit sofort als „Anwesend" gespeichert und der Button zeigt einen eingecheckten Zustand
- [ ] Angenommen ein Kunde ist bereits eingecheckt und die Kursstunde läuft noch (vor Kursende), wenn er erneut klickt, dann wird der Check-In rückgängig gemacht und der Button kehrt in den „Ich bin da"-Zustand zurück
- [ ] Angenommen die Kursstunde ist bereits vorbei (nach Kursende), dann ist ein Rückgängig-Machen des Check-Ins nicht mehr möglich; ein erstmaliger Check-In (falls noch nicht erfolgt) bleibt bis Mitternacht weiterhin möglich
- [ ] Angenommen der Lehrer hat die Anwesenheit eines Kunden bereits manuell gesetzt, wenn der Kunde sich anschließend selbst eincheckt, dann überschreibt der Self-Check-In die vorherige Lehrer-Markierung auf „Anwesend"
- [ ] Angenommen ein Kunde hat sich selbst eingecheckt, wenn der zuständige Lehrer die Anwesenheitsliste dieses Kurstermins öffnet (PROJ-13), dann sieht er den Kunden als „Anwesend" markiert mit einem Hinweis, dass es sich um einen Self-Check-In handelt
- [ ] Angenommen ein Kunde hat kein aktives kursgebundenes Abo für einen an diesem Tag stattfindenden Kurs, dann sieht er für diesen Termin keinen Self-Check-In-Button
- [ ] Angenommen für den heutigen Kurstermin ist eine Pause hinterlegt (z.B. Kursausfall laut `course_schedule_pauses`), dann wird kein Self-Check-In-Button angezeigt

## Edge Cases
- Kunde hat für denselben Tag mehrere aktive kursgebundene Abos für unterschiedliche Kurse → jeder Kurstermin bekommt seinen eigenen, unabhängigen Self-Check-In-Button
- Kunde pausiert oder kündigt sein Abo mit Wirkung zum heutigen Tag → maßgeblich ist derselbe „aktives Abo"-Status, den PROJ-13 bereits für die automatische Vorbefüllung verwendet; ist das Abo laut dieser Logik am Kurstag aktiv, wird der Button angezeigt
- Kunde versucht, sich für einen Kurstermin einzuchecken, dem er nicht zugeordnet ist (z.B. direkter API-Aufruf mit fremder Kurs-ID) → serverseitig abgelehnt, unabhängig davon, was die Oberfläche anzeigt
- Zwei Browser-Tabs/Geräte des gleichen Kunden gleichzeitig offen, einer checkt ein, der andere noch nicht neu geladen → nach Neuladen zeigt auch der zweite Tab den eingecheckten Zustand; kein Konflikt, da nur ein Kunde betroffen ist
- Kunde checkt sich kurz vor Mitternacht ein, für einen Kurs, der bereits vor Stunden zu Ende war → weiterhin erlaubt bis Mitternacht (siehe Zeitfenster-Entscheidung), auch wenn Rückgängig-Machen zu dem Zeitpunkt nicht mehr möglich ist

## Technical Requirements (optional)
- Security: Self-Check-In muss serverseitig durchgesetzt werden — Kunde darf ausschließlich die eigene Anwesenheit setzen, ausschließlich für einen Kurs mit eigenem aktivem Abo, ausschließlich innerhalb des erlaubten Zeitfensters. Nicht nur clientseitig verbergen (siehe Lehre aus PROJ-14 BUG-1: eine ungeschützte direkte Tabellen-Schreibberechtigung wäre hier ebenso ausnutzbar).
- Datenintegrität: nutzt dieselbe Eindeutigkeit wie PROJ-13 (ein Anwesenheits-Datensatz pro Kurs, Termin-Datum und Kunde) — kein neues Datenmodell nötig, nur ein neuer, kundenseitig nutzbarer Schreibpfad auf dieselbe Datengrundlage.

## Open Questions
- [x] Zeitfenster-Grenzen — geklärt im Interview: Check-In ab 30 Min. vor Kursbeginn bis Mitternacht; Rückgängig-Machen nur bis Kursende möglich

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Self-Check-In als einfacher Button, kein QR-Code/Ortscheck | Reguläre Kursstunden haben anders als Events (PROJ-14) keine Einlasskontrolle; ein Button reicht und hält den Umfang klein | 2026-08-18 |
| Beschränkt auf Kunden mit aktivem kursgebundenem Abo | Entspricht der ursprünglichen Anfrage „bei Abos"; Probestunden/Drop-ins bleiben lehrer-erfasst wie bisher | 2026-08-18 |
| Zeitfenster: ab 30 Minuten vor Kursbeginn bis Mitternacht | Ermöglicht dem Lehrer schon vor Kursbeginn einen Überblick, wer da ist; verhindert Check-In lange im Voraus „auf Verdacht" | 2026-08-18 |
| Bestehende Lehrer-Zeitregel aus PROJ-13 bleibt unverändert (ganzer Kurstag) | Kein Verhaltens-Downgrade an einem bereits produktiven, getesteten Feature nur wegen der neuen Kunden-Funktion | 2026-08-18 |
| Rückgängig-Machen nur bis Kursende möglich, Erst-Check-In bis Mitternacht | Verhindert nachträgliches Ändern der Meinung Stunden nach Kursende, erlaubt aber weiterhin späten Erst-Check-In für Nachzügler | 2026-08-18 |
| Self-Check-In überschreibt eine vorherige Lehrer-Markierung | Der Kunde checkt gerade aktiv ein — das ist die aktuellere, verlässlichere Information; der Lehrer kann bei Bedarf weiterhin manuell korrigieren | 2026-08-18 |
| Lehrer sieht Kennzeichnung „Self-Check-In" in der Anwesenheitsliste | Schafft Nachvollziehbarkeit, ohne die Anzeige zu überladen | 2026-08-18 |
| Kunde sieht nur den heutigen Status, keine Anwesenheitshistorie | Hält das Feature fokussiert; deckt sich mit der bewussten Auslassung „Kunden-Sicht auf eigene Anwesenheit" aus PROJ-13 | 2026-08-18 |
| Ort: `/stundenplan`, nicht im Profil | Dort schaut der Kunde ohnehin nach, wann sein Kurs stattfindet | 2026-08-18 |
| Kursbuchung direkt von `/stundenplan` aus wird NICHT Teil dieses Features | Eigenständiges Thema (Erweiterung von PROJ-6/PROJ-8), vom Kunden im Interview als Zusatzidee genannt, aber nicht Self-Check-In-Anwesenheit | 2026-08-18 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Self-Check-In läuft über eine eigene, serverseitig abgesicherte Datenbankfunktion, kein direkter Tabellen-Schreibzugriff für Kunden | Verhindert dieselbe Art von Sicherheitslücke wie PROJ-14 BUG-1 (ungeschützte direkte Tabellenschreibrechte ließen dort beliebige Spaltenänderungen zu); Zeitfenster- und Berechtigungsprüfung müssen serverseitig, nicht nur in der Oberfläche, durchgesetzt werden | 2026-08-18 |
| Kein neues Datenbank-Feld für „Self-Check-In vs. Lehrer-Markierung" | Die bestehende Spalte „wer zuletzt gesetzt hat" aus PROJ-13 reicht bereits aus, um Kunde von Lehrer/Admin zu unterscheiden — kein Schema-Update nötig | 2026-08-18 |
| Wiederverwendung derselben „aktives Abo"-Prüfung, die schon PROJ-13s automatische Vorbefüllung steuert | Vermeidet zwei unterschiedliche Definitionen von „aktives Abo" zwischen Lehrer-Ansicht und Kunden-Self-Check-In | 2026-08-18 |
| Zeitfenster-Berechnung nutzt `course_schedule.start_time`/`end_time` (bereits vorhanden) statt eines neuen Zeit-Feldes | Jeder Kurs hat schon eine feste Start-/Endzeit hinterlegt (PROJ-3) — daraus lässt sich „30 Minuten vor Kursbeginn" und „bis Kursende" direkt ableiten | 2026-08-18 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Component Structure (Visual Tree)

```
/stundenplan (bestehend, PROJ-6) — erweitert
+-- Bestehende Kurstermin-Liste
    +-- NEU: Self-Check-In-Bereich bei eigenem, heutigem Kurstermin
        +-- Zustand "Ich bin da" (Zeitfenster aktiv, noch nicht eingecheckt)
        +-- Zustand "✓ Eingecheckt" (bereits eingecheckt; Klick = Rückgängig, nur bis Kursende möglich)
        +-- Kein Self-Check-In-Bereich sichtbar (außerhalb Zeitfenster / kein aktives Abo für diesen Kurs / Kurs pausiert)

Lehrer-Ansicht — Anwesenheitsliste (bestehend, PROJ-13) — erweitert
+-- Bestehende Teilnehmerzeile
    +-- NEU: kleines Hinweis-Icon/Tooltip „Self-Check-In" bei Einträgen, die der Kunde selbst gesetzt hat
```

### B) Data Model (plain language)

Kein neues Datenmodell — der Self-Check-In schreibt in dieselbe Anwesenheits-Datengrundlage, die PROJ-13 bereits für den Lehrer eingeführt hat:
- Ein Anwesenheits-Eintrag besteht weiterhin aus: Kurs, Termin-Datum, Kunde, Status (Anwesend/Abwesend), sowie wer die Markierung zuletzt gesetzt hat.
- Neu ist ausschließlich die Erlaubnis: der Kunde darf jetzt selbst — aber nur für seinen EIGENEN Eintrag (eigener Kurs, heutiges Termin-Datum, vorausgesetzt aktives Abo und erlaubtes Zeitfenster) — den Status auf „Anwesend" setzen bzw. wieder zurücknehmen. Bisher konnte das ausschließlich der zuständige Lehrer oder der Admin.
- Über das bestehende Feld „wer zuletzt gesetzt hat" lässt sich anschließend ableiten, ob ein Eintrag vom Kunden selbst (Self-Check-In) oder von Lehrer/Admin stammt — genau darüber zeigt die Lehrer-Ansicht die neue Kennzeichnung an.

### C) Tech Decisions (justified for PM)

- **Eigene, serverseitig abgesicherte Schreib-Funktion statt direktem Tabellenzugriff**: Analog zu den bereits bestehenden geschützten Abläufen in der App (z.B. Ticket-Kauf/-Check-in aus PROJ-14) bekommt der Self-Check-In einen eigenen, geschützten Schreibweg. Das ist keine Standard-Vorsichtsmaßnahme, sondern eine gezogene Lehre: genau ein ungeschützter direkter Tabellenzugriff hatte bei PROJ-14 zu einer kritischen Sicherheitslücke geführt (Kunden konnten beliebige Spalten der eigenen Zeile ändern) — das wird hier von Anfang an vermieden.
- **Zeitfenster-Prüfung (30 Min. vorher, Rückgängig nur bis Kursende) läuft serverseitig bei jedem Schreibversuch**, nicht nur beim Anzeigen des Buttons in der Oberfläche — verhindert, dass ein Kunde außerhalb des erlaubten Fensters trickst (z.B. über einen direkten API-Aufruf).
- **Wiederverwendung der bestehenden „aktives Abo"-Logik aus PROJ-13**: kein neuer, abweichender Begriff von „aktivem Abo" — vermeidet Inkonsistenzen zwischen Lehrer-Ansicht und Kunden-Self-Check-In.
- **Self-Check-In nutzt dieselbe Konfliktregel „letzter Schreibzugriff gewinnt"**, die auch sonst im Anwesenheits-Datenmodell gilt (siehe PROJ-13 „Zwei Lehrer bearbeiten gleichzeitig..."), jetzt erweitert um: ein Self-Check-In gilt als der zuletzt gewinnende Schreibzugriff gegenüber einer vorher gesetzten Lehrer-Markierung.

### D) Dependencies (packages to install)
- Keine neuen Pakete — reine Erweiterung bestehender Seiten/Komponenten (`/stundenplan`, Lehrer-Anwesenheitsliste) mit vorhandenen shadcn-Bausteinen und den bereits vorhandenen Datums-/Zeit-Hilfsfunktionen aus PROJ-8/PROJ-13.

### Voraussetzung vor `/deploy`
Keine neuen externen Dienste oder Umgebungsvariablen.

## Implementation Notes

Gebaut in einem Durchgang (Datenbank + Server-seitige Logik + UI), analog zu PROJ-13 — kein separater `/backend`-Schritt nötig, da diese Funktion (anders als PROJ-14) keine Anbindung an andere Features wie SEPA-Abrechnung oder Benachrichtigungen benötigt.

**Datenbank (Migration `proj25_self_checkin`):**
- Neue Funktion `self_toggle_attendance(p_course_id)` (SECURITY DEFINER) — prüft nacheinander: eingeloggt, Kurs findet heute statt (Wochentag-Abgleich), kein Kursausfall laut `course_schedule_pauses`, aktives kursgebundenes Abo vorhanden, Zeitfenster (ab 30 Min. vor Kursbeginn). Ohne bestehenden Eintrag: legt `course_attendance` mit `status='present', marked_by=<eigene ID>` an. Mit bestehendem `status='present'`: löscht den Eintrag wieder (Rückgängig), aber nur, wenn die Kursstunde laut `end_time` noch nicht vorbei ist — sonst Fehler.
- Folgt bewusst derselben Konvention wie `purchase_event_ticket()`/`checkin_event_ticket()` (PROJ-14): eigene, schmal zugeschnittene Funktion statt einer direkten `UPDATE`-Policy auf `course_attendance` — genau das hatte bei PROJ-14 BUG-1 zu einer kritischen Sicherheitslücke geführt (Kunden konnten beliebige Spalten der eigenen Zeile ändern). `course_attendance` hat weiterhin RLS aktiviert, aber bewusst keine einzige Policy (PROJ-13-Konvention) — auch für Kunden läuft jeder Zugriff über eine Funktion.
- Neue Funktion `get_my_todays_attendance()` — liefert dem eingeloggten Kunden ausschließlich seine eigenen Anwesenheits-Einträge für heute (für die Button-Anzeige im UI).
- `get_course_attendance_roster()` (PROJ-13) um eine neue Ausgabespalte `self_checked_in` erweitert (`marked_by = customer_id`) — Signaturänderung erforderte `DROP FUNCTION` vor `CREATE`.
- Zeitfenster-Berechnung interpretiert `start_time`/`end_time` korrekt als Wien-Ortszeit (nicht naive UTC) via `AT TIME ZONE 'Europe/Vienna'` — ohne diese Korrektur wäre das 30-Minuten-Fenster um 1–2 Stunden (je nach Sommer-/Winterzeit) verschoben gewesen.

**Frontend-Baustein:** `src/lib/scheduling/dates.ts` um `selfCheckinWindow()` ergänzt (JS-seitiges Gegenstück zur SQL-Zeitzonen-Korrektur, für die Button-Sichtbarkeit) — nutzt einen Intl-basierten Rundreise-Trick statt einer festen Offset-Zahl, damit Sommer-/Winterzeit korrekt automatisch erkannt wird (durch dedizierte Unit-Tests für beide Fälle abgesichert).

**Server Action:** `src/lib/actions/self-checkin.ts` (`selfToggleAttendance`) — dünner Wrapper um die RPC mit freundlichen Fehlermeldungen je Ablehnungsgrund.

**Seiten & Komponenten:**
- `/stundenplan` (PROJ-6, `page.tsx`) erweitert: lädt bei eingeloggtem Kunden zusätzlich dessen aktive kursgebundene Abos sowie den heutigen Check-in-Status; berechnet je Termin, der heute stattfindet und zu einem eigenen Abo gehört, das Zeitfenster und hängt es an den `ScheduleEntry` an.
- `src/components/schedule/weekly-schedule-view.tsx`: `ScheduleEntry` um optionales `selfCheckin`-Feld erweitert, `ScheduleCard` rendert bei Vorhandensein die neue `SelfCheckinButton`-Komponente.
- `src/components/schedule/self-checkin-button.tsx` (neu) — rendert nichts vor Fensteröffnung; „Ich bin da" wenn offen und nicht eingecheckt; „✓ Eingecheckt" klickbar (Rückgängig) solange vor Kursende, danach als deaktivierter Zustand.
- `src/components/teacher/attendance-roster.tsx`: neues `selfCheckedIn`-Feld in `RosterEntry`, zeigt ein kleines „Self-Check-In"-Badge; lokaler State setzt `selfCheckedIn` korrekt auf `false` zurück, sobald der Lehrer manuell markiert (spiegelt die Server-Logik).

**Live verifiziert (direkt gegen die Produktions-DB mit Wegwerf-Testdaten, danach entfernt):**
- Erfolgreicher Check-in innerhalb des Zeitfensters, `get_my_todays_attendance()` spiegelt den Status korrekt
- Rückgängig-Machen vor Kursende funktioniert, erneutes Einchecken danach ebenfalls
- Zu früher Check-in-Versuch (Kurs beginnt erst in ~7h) korrekt mit „too early" abgelehnt
- Kunde ohne aktives Abo für den Kurs korrekt mit „no active subscription" abgelehnt
- Später Erst-Check-in für eine bereits beendete Stunde funktioniert weiterhin (erlaubt bis Mitternacht); ein anschließender Rückgängig-Versuch wird korrekt mit „cannot undo after class end" abgelehnt
- Pausierter Kurstag korrekt mit „course paused today" abgelehnt, unabhängig vom bestehenden Anwesenheitsstatus
- Rollenliste (`get_course_attendance_roster`) zeigt `self_checked_in: true` nach Self-Check-In; nach manueller Lehrer-Markierung („Abwesend") korrekt wieder `false`
- Konfliktregel in beide Richtungen bestätigt: Lehrer-Markierung wird durch nachfolgenden Self-Check-In überschrieben (zurück auf „Anwesend", `self_checked_in: true`)
- Vollständiger Browser-Durchlauf (Playwright, gegen `localhost:3000`): Kunde loggt sich ein, sieht „Ich bin da" auf `/stundenplan`, klickt, sieht „✓ Eingecheckt"; Admin sieht auf der Lehrer-Anwesenheitsseite denselben Kunden mit „Self-Check-In"-Badge
- `npm run build`, `npm run lint`, `npm test` (162/162, davon 3 neue Tests für `selfCheckinWindow` inkl. Sommer-/Winterzeit-Regressionstest) alle sauber

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
