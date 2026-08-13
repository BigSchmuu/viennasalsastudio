# PROJ-6: Stundenplan & Kalender

## Status: Deployed
**Created:** 2026-08-14
**Last Updated:** 2026-08-14

## Dependencies
- Requires: PROJ-3 (Admin: Kurse, Levels, Locations & Tanzstile verwalten) — Wochentermin wird direkt im bestehenden Kurs-Formular gepflegt, ein Kurs bleibt beim Level-Wechsel derselbe Datensatz
- Requires: PROJ-1 (Supabase Infrastructure Setup) — `class_sessions`-Tabelle als Ausgangspunkt für das Datenmodell

## User Stories
- Als Admin möchte ich für einen Kurs einen wiederkehrenden Wochentermin (Wochentag, Start- und Endzeit) festlegen können, damit Kunden wissen, wann der Kurs stattfindet.
- Als Admin möchte ich einen bestehenden Wochentermin bearbeiten oder entfernen können, damit ich auf Änderungen reagieren kann.
- Als Admin möchte ich eine einzelne Woche gezielt als Pause markieren können, damit Kunden nicht zu einem ausfallenden Termin erscheinen (z. B. Feiertag oder Übergang zwischen zwei Kursblöcken).
- Als Besucher (auch ohne Login) möchte ich eine wöchentliche Stundenplan-Übersicht sehen, damit ich weiß, wann welcher Kurs stattfindet.
- Als Besucher möchte ich die Wochentage nebeneinander durchblättern (swipebar) können, damit ich auf dem Handy bequem den ganzen Wochenplan durchsehen kann.

## Out of Scope
- Buchung von Terminen — eigenes Feature PROJ-8
- Ausweichtermine/Alternativtermine bei mehreren Kursen desselben Levels — mögliche zukünftige Erweiterung über Abo-Berechtigungen (PROJ-8/PROJ-9), nicht Teil von PROJ-6
- Mehrere Wochentermine pro Kurs — aktuell hat jeder Kurs genau einen festen Wochentermin; bei Bedarf später erweiterbar
- Enddatum/Blockgrenzen pro Wochentermin — der Kurs bleibt beim Level-Wechsel derselbe Datensatz (nur Name/Level/Video werden über PROJ-3 geändert), der Wochentermin läuft dauerhaft weiter, keine Kopplung an 8-Wochen-Blöcke nötig
- Kalender-Grid mit Monatsansicht — eine Wochen-Agenda-Ansicht (Wochentage nebeneinander, swipebar) reicht im MVP
- Konflikterkennung bei Raum-/Zeitüberschneidung zwischen zwei Kursen — Admin ist im MVP selbst dafür verantwortlich
- Automatische Erinnerungen/Benachrichtigungen zu Terminen — eigenes Feature PROJ-16

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen der Admin bearbeitet einen Kurs, wenn er Wochentag, Start- und Endzeit einträgt und speichert, dann wird der Wochentermin gespeichert und erscheint im Stundenplan
- [ ] Angenommen ein Kurs hat einen Wochentermin, wenn der Admin ihn ändert, dann ist die Änderung sofort im Stundenplan sichtbar
- [ ] Angenommen ein Kurs hat einen Wochentermin, wenn der Admin ihn entfernt, dann verschwindet der Kurs aus dem Stundenplan, bleibt aber weiterhin im Kurskatalog (PROJ-5) sichtbar
- [ ] Angenommen ein Kurs hat einen Wochentermin, wenn der Admin eine bestimmte Woche als Pause markiert, dann erscheint der Termin in dieser einen Woche nicht im Stundenplan, in der Folgewoche aber wieder normal
- [ ] Angenommen ein Besucher (auch ohne Login) ruft den Stundenplan auf, dann sieht er alle terminierten Kurse mit Wochentag, Uhrzeit, Name, Tanzstil, Level, Standort und Lehrer, gruppiert nach Wochentag
- [ ] Angenommen der Stundenplan wird auf einem schmalen Bildschirm angezeigt, wenn der Besucher zwischen Wochentagen wechseln will, dann kann er horizontal durch die Tage blättern/swipen
- [ ] Angenommen an einem Wochentag findet kein terminierter Kurs statt, wenn der Besucher zu diesem Tag blättert, dann erscheint ein verständlicher Hinweis statt einer leeren Fläche
- [ ] Angenommen der Admin trägt eine Endzeit vor der Startzeit ein, wenn er speichern will, dann erscheint eine Validierungsfehlermeldung und der Termin wird nicht gespeichert
- [ ] Angenommen ein Pflichtfeld (Wochentag, Start- oder Endzeit) fehlt, wenn der Admin einen Wochentermin speichern will, dann erscheint eine Validierungsfehlermeldung

## Edge Cases
- Kurs ohne Wochentermin → erscheint nicht im Stundenplan, aber weiterhin im Kurskatalog aus PROJ-5
- Kein Kurs an einem bestimmten Wochentag → verständlicher Leerzustand für diesen Tag statt leerer Fläche
- Pause-Eintrag für eine bereits vergangene Woche → kein besonderes Verhalten nötig, Pause-Einträge können frei angelegt/gelöscht werden
- Zwei Kurse mit überlappenden Zeiten am selben Standort/Raum → kein Konfliktcheck im MVP
- Gleichzeitige Bearbeitung durch zwei Admins → kein spezielles Konflikthandling im MVP (Last-Write-Wins), analog zu PROJ-3

## Technical Requirements (optional)
- Security: Nur lesender, öffentlicher Zugriff auf den Stundenplan; Schreibzugriff auf Wochentermine/Pausen nur für Rolle „admin"
- Performance: Stundenplan muss auch für nicht eingeloggte Besucher performant laden

## Open Questions
<!-- Unresolved questions from the spec interview. Close them in /refine when answered. -->
- [x] Admin-Verwaltung und Kalenderansicht in einem Feature oder getrennt? → Beides in PROJ-6 (2026-08-14)
- [x] Wiederkehrendes Muster oder manuelle Einzeltermine? → Wiederkehrendes Wochenmuster (2026-08-14)
- [x] Enddatum pro Termin für 8-Wochen-Blöcke? → Nein, Kurs bleibt derselbe Datensatz über Level-Wechsel hinweg, Termin läuft dauerhaft (2026-08-14)
- [x] Umgang mit gelegentlichen Pausenwochen? → Admin kann einzelne Wochen gezielt aussetzen (2026-08-14)
- [x] Mehrere Wochentermine pro Kurs möglich? → Nein, aktuell genau einer pro Kurs (2026-08-14)
- [x] Start- und Endzeit oder nur Startzeit? → Start- und Endzeit (2026-08-14)
- [x] Kalender-Stil? → Wochen-Agenda, Wochentage nebeneinander/swipebar statt untereinander (2026-08-14)
- [x] Wo wird der Wochentermin gepflegt? → Direkt im bestehenden Kurs-Formular aus PROJ-3 (2026-08-14)
- [ ] Ausweichtermine bei mehreren Kursen desselben Levels (Idee des Nutzers) — zurückgestellt, gehört eher zu PROJ-8/PROJ-9 (Abo-Berechtigungen), dort bei Bedarf erneut aufgreifen

## Decision Log
<!-- Record of conscious decisions made and why. Added to by /write-spec and /architecture. -->

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Admin-Terminverwaltung und Kunden-Kalenderansicht in einem Feature | Anders als bei PROJ-3/PROJ-5 gibt es noch keine bestehende Admin-Verwaltung für Termine, auf die man getrennt aufbauen könnte — beides gehört hier untrennbar zusammen | 2026-08-14 |
| Wiederkehrender Wochentermin ohne Enddatum, dauerhaft am Kurs hängend | Der Kurs bleibt beim Level-Wechsel (z. B. Beginner → Improver nach 8 Wochen) derselbe Datensatz — nur Name/Level/Video ändern sich über PROJ-3, der Termin selbst muss nicht neu angelegt werden | 2026-08-14 |
| Gezieltes Aussetzen einzelner Wochen statt Blockgrenzen | Bildet Feiertage/Übergangspausen realistisch ab, ohne die Dauerhaftigkeit des Wochentermins aufzugeben | 2026-08-14 |
| Genau ein Wochentermin pro Kurs im MVP | Entspricht der aktuellen Realität der Tanzschule; Mehrfachtermine sind eine mögliche spätere Erweiterung | 2026-08-14 |
| Wochentermin wird im bestehenden Kurs-Formular (PROJ-3) gepflegt, keine eigene Verwaltungsseite | 1:1-Beziehung zum Kurs macht eine separate Seite unnötig, Admin bleibt an einem Ort | 2026-08-14 |
| Ausweichtermin-Idee zurückgestellt | Betrifft eher Buchungs-/Abo-Berechtigungen als die reine Terminanzeige — passt besser zu PROJ-8/PROJ-9 | 2026-08-14 |
| Wochen-Agenda mit nebeneinander liegenden, swipebaren Wochentagen statt Kalender-Grid oder vertikaler Liste | Nutzerwunsch, gut für mobile Nutzung, deutlich weniger Aufwand als ein echtes Kalender-Grid | 2026-08-14 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Neue Tabellen für Wochentermine/Pausen statt Wiederverwendung von `class_sessions` | `class_sessions` bildet einzelne datierte Termine ab (für PROJ-8 vorgesehen), PROJ-6 braucht ein datumsloses Wochenmuster — getrennte Konzepte vermeiden Verwechslung | 2026-08-14 |
| Ein Wochentermin pro Kurs per Datenbank-Constraint erzwungen | Verhindert versehentliche Mehrfachtermine, nicht nur clientseitig geprüft | 2026-08-14 |
| Pausierte Wochen als eigene Tabelle statt Freitextfeld | Erlaubt mehrere Pausen und sauberes Nachschlagen beim Laden des Stundenplans | 2026-08-14 |
| Öffentlicher Lesezugriff, Schreibzugriff nur Admin | Gleiches Muster wie Kurse/Tanzstile/Standorte aus PROJ-1/PROJ-3 | 2026-08-14 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Component Structure
```
Admin-Seite (erweitert das bestehende Kurs-Formular aus PROJ-3)
Kurs-Formular
└── Neuer Abschnitt „Wochentermin" (optional)
    ├── Wochentag-Auswahl (Montag–Sonntag)
    ├── Startzeit
    ├── Endzeit
    └── Pausierte Wochen
        ├── Liste bereits pausierter Termine (mit Datum, löschbar)
        └── „Woche pausieren" (Datumsauswahl)

App
└── /stundenplan (öffentliche Route, kein Login nötig)
    └── Wochen-Agenda (Wochentage nebeneinander, auf schmalen
        Bildschirmen swipebar/durchblätterbar)
        └── pro Wochentag: Liste der Termine (Uhrzeit, Kursname,
            Tanzstil, Level, Standort, Lehrer)
            oder Leerzustand „Keine Kurse an diesem Tag"
```

### B) Data Model (plain language)
```
Neue Tabelle: Wochentermine
├── Gehört zu genau einem Kurs (ein Wochentermin pro Kurs, wie in der
│   Spec festgelegt — ein Kurs kann nicht zwei Wochentermine haben)
├── Wochentag (Montag–Sonntag)
├── Startzeit
└── Endzeit

Neue Tabelle: Pausierte Wochen
├── Gehört zu einem Wochentermin
└── Datum der konkreten Woche, die ausgesetzt wird

Die bestehende Tabelle „class_sessions" aus PROJ-1 (einzelne, datierte
Termine) wird von PROJ-6 bewusst NICHT verwendet — sie ist für später
gedacht (PROJ-8, konkrete buchbare Termine mit festem Datum). PROJ-6
bildet dagegen ein wiederkehrendes Wochenmuster ohne Datumsbezug ab.
Beide Konzepte bleiben getrennt, bis PROJ-8 klärt, wie aus dem
Wochenmuster konkrete buchbare Termine werden.
```

### C) Tech Decisions (justified for PM)
- **Neue, von `class_sessions` getrennte Datenstruktur:** `class_sessions` ist für einzelne, datierte Termine gedacht (relevant für spätere Buchungen in PROJ-8). PROJ-6 braucht dagegen ein wiederkehrendes Wochenmuster ohne festes Datum — beides zu vermischen würde das Datenmodell verwirrend machen.
- **Ein Wochentermin pro Kurs wird auf Datenbankebene erzwungen** (nicht nur im Formular geprüft), damit die Regel „genau ein Termin pro Kurs" nicht versehentlich verletzt werden kann.
- **Pausierte Wochen als eigene, kleine Tabelle statt Freitextfeld:** ermöglicht mehrere Pausen gleichzeitig und ein sauberes Nachschlagen „ist die aktuell angezeigte Woche pausiert?" beim Laden des Stundenplans.
- **Öffentlicher Lesezugriff auf Wochentermine und Pausen**, Schreibzugriff nur für Admin — gleiches, bereits etabliertes Muster wie bei Kursen/Tanzstilen/Standorten aus PROJ-1/PROJ-3.
- **Keine neuen npm-Pakete:** Die für die swipebare Wochenansicht benötigte Tabs-Komponente ist im Projekt bereits installiert.

### D) Dependencies
- Keine neuen npm-Pakete — nutzt die bereits vorhandene shadcn/ui-Tabs-Komponente für die Wochentag-Navigation sowie Input/Select/Button/Card für Formular und Anzeige.

## Implementation Notes
_Added by /frontend, 2026-08-14_

**Datenbank-Migration** (`proj6_course_schedule_and_pauses`): neue Tabellen `course_schedule` (mit `unique(course_id)` — erzwingt „genau ein Termin pro Kurs" auf DB-Ebene, plus Check-Constraint `end_time > start_time`) und `course_schedule_pauses` (mit `unique(schedule_id, pause_date)` gegen doppelte Pause-Einträge). RLS: öffentlich lesbar, Schreiben nur Admin — identisches Muster wie `courses`/`dance_styles` aus PROJ-1/3.

**Seiten:** `/stundenplan` (öffentlich, kein Login nötig) mit Wochentag-Tabs (shadcn Tabs, horizontal scrollbar für die geforderte swipebare Wochenansicht), Standard-Tab = heutiger Wochentag. Wochentermin-Verwaltung direkt im bestehenden Kurs-Formular aus PROJ-3 (`CourseScheduleSection`), nur sichtbar beim Bearbeiten eines bestehenden Kurses (nicht bei der Neuanlage, da noch keine `course_id` existiert).

**Server Actions** (`src/lib/actions/admin/course-schedule.ts`): `upsertCourseSchedule`, `deleteCourseSchedule`, `addSchedulePause`, `deleteSchedulePause` — alle mit `requireAdmin()`-Check.

**Pausenlogik:** Für die aktuell angezeigte Woche wird pro Wochentag das konkrete Kalenderdatum berechnet (Montag der laufenden Woche + Offset) und mit den hinterlegten `pause_date`-Einträgen abgeglichen. Ein pausierter Kurs verschwindet nur für diese eine Woche aus dem Stundenplan, taucht aber automatisch in der Folgewoche wieder auf (kein manuelles Zurücksetzen nötig, da die Pause an ein festes Datum gebunden ist).

### Bugs gefunden und behoben (eigene Tests vor QA-Übergabe)

- **Bug: Wochentermin/Pausen erschienen nach dem Speichern nicht im offenen Dialog.** Die erste Fassung von `CourseScheduleSection` rief nur `router.refresh()` nach dem Speichern auf — das aktualisiert zwar die serverseitig geladenen Daten der Seite, aber nicht den bereits im Speicher gehaltenen `editing`-State des übergeordneten `CourseManager` (eine React-`useState`-Referenz auf das beim Öffnen des Dialogs erfasste Kurs-Objekt), da ein Server-Re-Render nicht automatisch in bereits gemountete Client-Komponenten-States zurückfließt. Live reproduziert: Termin wurde korrekt in der Datenbank gespeichert (beim Schließen und erneuten Öffnen des Dialogs sichtbar), aber im selben Dialog-Durchlauf blieb die Ansicht auf dem alten Stand („Termin anlegen" statt „Termin speichern", keine „Pausierte Wochen"-Sektion). **Fix:** Die Server Actions geben jetzt die gespeicherten Datensätze direkt zurück; `CourseScheduleSection` hält Termin und Pausen in eigenem lokalen State, der direkt aus den Aktions-Ergebnissen aktualisiert wird, unabhängig vom Prop-Refresh der Elternkomponente. Live erneut verifiziert: Termin- und Pause-Anlage/-Löschung wirken jetzt sofort im selben Dialog-Durchlauf.

**Live end-to-end getestet** (Playwright, echte Supabase-Instanz, echter Kurs des Nutzers): Wochentermin anlegen (Freitag 19:00–20:00) und sofort im Dialog sichtbar, Woche pausieren und sofortiges Verschwinden aus dem heutigen Stundenplan-Tab, Pause entfernen und Kurs erscheint wieder korrekt mit Uhrzeit, Wochentag-Tabs wechseln (Montag zeigt Leerzustand, Freitag zeigt den Kurs), Endzeit-vor-Startzeit-Validierung, Wochentermin komplett entfernen → verschwindet aus `/stundenplan`, bleibt aber weiterhin im Kurskatalog aus PROJ-5 sichtbar (AC explizit bestätigt).

**Regressionsprüfung:** `npm test` 15/15 grün, `npm run build` fehlerfrei, `/stundenplan`-Route korrekt in der Routenliste.

**Noch nicht umgesetzt:** Eigene E2E-Testdatei für PROJ-6 (folgt in `/qa`).

## Backend Review (2026-08-14)
_Added by /backend_

Fokus: Schema/RLS/Server Actions wurden bereits im `/frontend`-Durchgang umgesetzt — dieser Durchgang war eine gezielte Verifikation der Datenbank-Constraints und Zugriffsrechte, inklusive der aus PROJ-5 gelernten Lehre (Standard-Rechte bei neuen Relationen genau prüfen).

- **Alle drei DB-Constraints live getestet, nicht nur die Zod-Validierung im Formular:** `end_time > start_time`-Check-Constraint lehnt einen direkten SQL-Insert mit vertauschten Zeiten korrekt ab (`23514`); `unique(course_id)` auf `course_schedule` verhindert einen zweiten Wochentermin für denselben Kurs auch bei direktem SQL-Insert (`23505`); `unique(schedule_id, pause_date)` verhindert doppelte Pause-Einträge für dasselbe Datum (`23505`) — alle drei Regeln greifen unabhängig vom Frontend, nicht nur clientseitig.
- **Schreibschutz für `anon` live bestätigt:** `UPDATE`/`INSERT` auf `course_schedule` als `anon` werden von RLS korrekt verhindert (0 betroffene Zeilen bzw. `42501`), Lesezugriff funktioniert weiterhin für beide neuen Tabellen.
- **Kein Wiederauftreten des PROJ-5-Fehlers:** Anders als der `teacher_directory`-View sind `course_schedule`/`course_schedule_pauses` normale Tabellen mit aktivierter RLS — dort ist das Standard-Grant-Verhalten von Supabase (breite Rechte + RLS als alleiniger Gatekeeper) korrekt und unproblematisch, das Risiko betraf spezifisch Views mit implizitem `SECURITY DEFINER`-Verhalten. Zur Sicherheit trotzdem gegengeprüft — keine überschüssigen Rechte gefunden.
- **Server-Actions-Review:** Alle vier Funktionen in `course-schedule.ts` rufen `requireAdmin()` als erste Zeile auf.
- **Security-Advisor geprüft:** Keine neuen Findings durch die PROJ-6-Schema-Änderungen — nur die bereits bekannten, akzeptierten Hinweise aus PROJ-1/2/5.
- `npx tsc --noEmit`, `npm test` (15/15) und `npm run build` laufen fehlerfrei.

## QA Test Results

**Tested:** 2026-08-14
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: Wochentermin anlegen erscheint im Stundenplan
- [x] Mittwoch 17:00–18:00 angelegt, sofort im Dialog sichtbar und auf `/stundenplan` unter „Mittwoch"

#### AC-2: Wochentermin ändern ist sofort sichtbar
- [x] Startzeit-Änderung sofort im Stundenplan sichtbar

#### AC-3: Wochentermin entfernen — Kurs verschwindet aus Stundenplan, bleibt im Katalog
- [x] Nach Entfernen nicht mehr unter „Montag" im Stundenplan, weiterhin im Kurskatalog (PROJ-5) sichtbar

#### AC-4: Woche als Pause markieren
- [x] Kurs verschwindet für die aktuelle Woche aus dem Stundenplan, nach Entfernen der Pause sofort wieder sichtbar (Folgewoche-Verhalten durch die datumsbasierte Logik strukturell abgedeckt, siehe Implementation Notes)

#### AC-5: Anonymer Besucher sieht alle terminierten Kurse gruppiert nach Wochentag
- [x] Name, Uhrzeit, Tanzstil, Level, Standort, Lehrer-Platzhalter korrekt sichtbar

#### AC-6: Wochentage horizontal durchblätterbar
- [x] Tab-Wechsel zwischen Wochentagen funktioniert (Montag/Freitag/Sonntag getestet); Tab-Leiste ist horizontal scrollbar für schmale Bildschirme

#### AC-7: Leerzustand für Tag ohne Kurs
- [x] „Keine Kurse an diesem Tag" korrekt angezeigt (Sonntag)

#### AC-8: Endzeit vor Startzeit wird abgelehnt
- [x] Validierungsfehler „Endzeit muss nach der Startzeit liegen" korrekt angezeigt

#### AC-9: Pflichtfeld-Validierung
- [x] Per Code-Review bestätigt: „Termin anlegen/speichern"-Button ist deaktiviert, solange Wochentag, Start- oder Endzeit fehlen (identisches Muster wie AC-8, nicht separat per E2E gegengetestet)

### Edge Cases Status

#### EC-1: Kurs ohne Wochentermin
- [x] „E2E6 Kurs Ohne Termin" blieb während des gesamten Tests nicht im Stundenplan sichtbar, aber im Kurskatalog — passt

#### EC-2: Kein Kurs an einem Wochentag
- [x] Siehe AC-7

#### EC-3: Pause-Eintrag für vergangene Woche
- [x] Per Code-Review bestätigt: keine Datums-Einschränkung beim Anlegen einer Pause, nicht separat getestet

#### EC-4: Überlappende Zeiten am selben Standort/Raum
- [x] Laut Spec bewusst kein Konfliktcheck im MVP — kein Fehlerverhalten, wie spezifiziert

#### EC-5: Gleichzeitige Bearbeitung durch zwei Admins
- [x] Laut Spec bewusst kein spezielles Konflikthandling im MVP (Last-Write-Wins) — nicht separat getestet

### Security Audit Results
- [x] Authorization (Defense-in-Depth): `course_schedule`/`course_schedule_pauses` live gegen `anon` getestet — Lesen funktioniert (öffentlich wie vorgesehen), Schreiben wird von RLS blockiert (bereits im Backend-Review bestätigt, hier erneut über den öffentlichen Lesezugriff verifiziert)
- [x] Input validation: Diese Seite hat keine Freitext-Eingabefelder (Wochentag = Auswahl, Start-/Endzeit/Pause-Datum = typisierte `<input type="time/date">`-Felder) — kein XSS-Angriffsvektor durch PROJ-6 selbst; angezeigte Kurs-/Tanzstil-/Standort-Namen sind admin-verwaltete Inhalte, deren XSS-Sicherheit bereits in PROJ-3/5 bestätigt wurde
- [x] DB-Constraints als zweite Verteidigungslinie bereits im Backend-Review live bestätigt (Endzeit>Startzeit, ein Termin pro Kurs, keine doppelten Pausen)
- [ ] BUG-1 (Low): Kein Rate-Limiting auf der öffentlichen `/stundenplan`-Route — identisches, bereits aus PROJ-3/4/5/23 bekanntes Muster

### Bugs Found

#### BUG-1: Kein Rate-Limiting auf der öffentlichen Stundenplan-Route
- **Severity:** Low
- **Kontext:** Rein lesende, öffentliche Seite ohne Formulare — geringes Missbrauchsrisiko im MVP
- **Priority:** Nice to have, ggf. gebündelt vor PROJ-8/PROJ-9 angehen

### Summary
- **Acceptance Criteria:** 9/9 vollständig erfüllt
- **Edge Cases:** 5/5 bestätigt (3 davon per Code-Review, siehe oben)
- **Bugs Found:** 1 total (0 Critical, 0 High, 0 Medium, 1 Low)
- **Automated Tests:** `npm test` 15/15 grün · `npx playwright test tests/PROJ-6-*.spec.ts` 7/7 grün, zweimal in Folge von sauberem DB-Zustand aus verifiziert (Stabilität bestätigt) · `npm run build` fehlerfrei
- **Security:** Pass — keine Critical/High-Findings, DB-Constraints und RLS als doppelte Absicherung bestätigt
- **Production Ready:** YES
- **Recommendation:** Deploy

## Deployment

**Deployed:** 2026-08-14
**Production URL:** https://viennasalsastudio.vercel.app
**Git tag:** v1.0.0-PROJ-6
**Commit:** de6d38a

**Pre-Deployment Checks:**
- `npm run build`: erfolgreich (inkl. TypeScript-Check), neue Route `/stundenplan` vorhanden
- `npm run lint`: weiterhin nicht ausführbar — bekanntes, bereits bei PROJ-3 dokumentiertes repo-weites Problem, durch PROJ-6 nicht verschlimmert
- QA: Approved (9/9 AC, 7/7 E2E-Tests, Security Audit clean)
- Migrationen: bereits während `/frontend`/`/backend` angewendet (`course_schedule`, `course_schedule_pauses` inkl. Constraints)
- Keine Secrets im Commit

**Post-Deployment Verification (Production):**
- `/stundenplan` lädt korrekt (Leerzustand, da noch kein echter Kurs des Nutzers einen Termin hatte), keine Console-Errors
- Live mit dem echten Kurs „Salsa Beginner 1" verifiziert: Wochentermin (Montag 18:00–19:00) angelegt, sofort korrekt auf `/stundenplan` sichtbar — danach zu Testzwecken wieder entfernt, damit die Produktionsdaten des Nutzers unverändert bleiben

**Bekannte offene Punkte (nicht blockierend):**
- BUG-1 aus QA (kein Rate-Limiting auf der öffentlichen Route) — Low
- ESLint-Flat-Config-Migration weiterhin ausstehend (repo-weit, siehe PROJ-3-Deployment-Notiz)
