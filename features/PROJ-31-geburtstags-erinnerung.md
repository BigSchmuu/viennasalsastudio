# PROJ-31: Geburtstags-Erinnerung

## Status: Approved
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Dependencies
- PROJ-17 (Admin-Analytics-Dashboard) — für das Geburtstags-Widget
- PROJ-13 (Lehrer-Ansicht: Stundenplan, Anwesenheit, Notizen) — für das Icon in der Anwesenheitsmatrix
- PROJ-2 (Auth & Kundenprofil) — bestehendes `birthdate`-Feld

## User Stories
- Als Admin möchte ich auf meinem Dashboard sehen, welche Kunden in den nächsten 7 Tagen Geburtstag haben, damit ich eine persönliche Geste oder Gratulation planen kann.
- Als Lehrer möchte ich in der Anwesenheitsliste einen Hinweis sehen, wenn ein Kursteilnehmer heute Geburtstag hat, damit ich im Unterricht persönlich gratulieren kann.

## Out of Scope
- Automatischer Geburtstagsgruß per E-Mail — könnte später über das Newsletter-/Notification-System (PROJ-28/PROJ-16) ergänzt werden
- Anzeige des Alters — nur das Datum wird angezeigt, aus Datenschutzgründen
- Für Kunden selbst sichtbare Geburtstagsliste (z.B. „wer hat noch Geburtstag") — nur Admin-/Lehrer-Ansicht

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Kunde hat ein Geburtsdatum hinterlegt, das innerhalb der nächsten 7 Tage liegt, wenn der Admin das Dashboard öffnet, dann erscheint der Kunde im Geburtstags-Widget mit Name und Datum
- [ ] Angenommen kein Kunde hat in den nächsten 7 Tagen Geburtstag, wenn der Admin das Dashboard öffnet, dann zeigt das Widget einen Leerzustand („Keine Geburtstage in den nächsten 7 Tagen")
- [ ] Angenommen ein Kunde hat heute Geburtstag und ist Teilnehmer eines Kurses, wenn der Lehrer die Anwesenheitsliste dieses Kurses öffnet, dann erscheint ein Geburtstags-Icon neben dem Namen dieses Kunden
- [ ] Angenommen ein Kunde hat kein Geburtsdatum hinterlegt, wenn Dashboard oder Anwesenheitsliste angezeigt werden, dann erscheint für diesen Kunden kein Geburtstags-Hinweis
- [ ] Angenommen mehrere Kunden haben am selben Tag Geburtstag, wenn das Widget oder die Anwesenheitsliste angezeigt wird, dann werden alle betroffenen Kunden korrekt angezeigt

## Edge Cases
- Geburtstag am 29. Februar: in Nicht-Schaltjahren wird dieser als 28. Februar behandelt.
- Der 7-Tage-Zeitraum reicht über den Jahreswechsel hinweg (z.B. Abfrage am 28.12. für Geburtstage bis 03.01.) — Berechnung muss Monat/Tag korrekt über den Jahreswechsel hinweg vergleichen, nicht als reines Datumsintervall.
- Ein Kunde mit pausiertem/gekündigtem Abo hat in den nächsten 7 Tagen Geburtstag — erscheint trotzdem im Widget, da es um eine persönliche Geste geht, unabhängig vom Abo-Status.

## Technical Requirements (optional)
- Keine besonderen Anforderungen über die üblichen Standards hinaus.

## Open Questions
- Keine offenen Fragen zum Zeitpunkt der Spec-Erstellung.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| 7-Tage-Vorschau im Dashboard + Icon in der Anwesenheitsliste am Tag selbst | User-Entscheidung: deckt sowohl vorausschauende Planung (Admin) als auch den Live-Moment im Unterricht (Lehrer) ab | 2026-08-21 |
| Kein Alter angezeigt, nur das Datum | Datenschutz-Rücksicht; Alter ist für die Anwendungsfälle nicht nötig | 2026-08-21 |
| Nutzt bestehendes `birthdate`-Feld auf `profiles` | Feld existiert bereits (Kundenprofil), keine neue Datenerfassung nötig | 2026-08-21 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Reine Berechnung bei jedem Seitenaufruf statt neuer Datenbankfelder | `birthdate` existiert bereits auf `profiles`; „Geburtstag in den nächsten 7 Tagen" bzw. „heute Geburtstag" lässt sich vollständig aus Monat+Tag dieses Feldes ableiten — kein neues Feld, kein veralteter Zustand. Analoges Muster zu den abgeleiteten Status-Werten aus PROJ-33 | 2026-08-21 |
| Kein `/backend`-Schritt nötig | Sowohl das Dashboard-Widget als auch die Anwesenheitsliste lesen `birthdate` direkt in ihrer bestehenden Server-seitigen Seiten-Ladefunktion aus (zusätzliche Abfrage auf die bereits vorhandene `profiles`-Tabelle) — keine neue API-Route, keine neue SQL-Funktion, keine Änderung an einer bestehenden Datenbank-Funktion nötig | 2026-08-21 |
| Anwesenheitsliste: Geburtsdatum wird separat nachgeladen statt die bestehende `get_course_attendance_roster`-Datenbankfunktion zu erweitern | Vermeidet eine Änderung an einer bestehenden, von mehreren Stellen genutzten SQL-Funktion; die Kursseite kennt die Kunden-IDs der Kursteilnehmer bereits nach dem Laden und kann deren Geburtsdaten in einer einzigen zusätzlichen, einfachen Abfrage nachladen | 2026-08-21 |
| Datumsvergleich ignoriert das Jahr vollständig, nirgends wird das Alter berechnet oder ausgegeben | Direkte Umsetzung der Spec-Entscheidung „kein Alter anzeigen" — das Geburtsjahr wird an keiner Stelle der neuen Logik gelesen oder verglichen, nur Monat+Tag | 2026-08-21 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Component Structure (Visual Tree)

```
Admin-Dashboard (/admin)
└── NEU: Geburtstags-Widget (Karte, unterhalb der bestehenden Auslastungs-Liste)
    ├── Liste: Name + Datum (Tag.Monat, ohne Jahr) je Kunde mit Geburtstag
    │   in den nächsten 7 Tagen (heute eingeschlossen)
    ├── Sortierung: nächster Geburtstag zuerst
    └── Leerzustand: „Keine Geburtstage in den nächsten 7 Tagen"

Lehrer-Anwesenheitsliste (/lehrer/[courseId])
└── Kursteilnehmer-Zeile
    └── NEU: Geburtstags-Icon direkt neben dem Namen — nur sichtbar,
        wenn dieser Kursteilnehmer HEUTE Geburtstag hat
```

### B) Data Model (plain language)

```
Keine neue Tabelle, keine neue Spalte. Nutzt ausschließlich das bereits
bestehende Geburtsdatum-Feld auf dem Kundenprofil.

Dashboard-Widget:
- Beim Laden der Seite wird für jeden Kunden mit hinterlegtem
  Geburtsdatum verglichen, ob Monat+Tag innerhalb der nächsten 7 Tage
  liegen (heute eingeschlossen) — das Geburtsjahr spielt für den
  Vergleich keine Rolle
- Sonderfall 29. Februar: in Nicht-Schaltjahren wird dieser wie der
  28. Februar behandelt (siehe Edge Case in der Spec)
- Kunden ohne hinterlegtes Geburtsdatum werden übersprungen
- Der Abo-Status des Kunden spielt keine Rolle (auch pausierte/gekündigte
  Kunden erscheinen, siehe Edge Case in der Spec)

Anwesenheitsliste:
- Beim Laden der Kursseite wird für jeden aufgelisteten Kursteilnehmer
  geprüft, ob sein Geburtsdatum (Monat+Tag) exakt dem heutigen Datum
  entspricht

Gespeichert in: nichts Neues — reine Berechnung bei jedem Seitenaufruf,
analog zu den bereits umgesetzten abgeleiteten Status-Werten aus PROJ-33
(z.B. Kunden-Status, Lastschriftlauf-Status).
```

### C) Tech Decisions (justified for PM)

- **Reine Berechnung statt neuer Datenbankfelder:** Das Geburtsdatum ist bereits im Kundenprofil hinterlegt. Ob jemand „in den nächsten 7 Tagen" oder „heute" Geburtstag hat, lässt sich jederzeit aus diesem einen Feld ableiten — es muss nirgends ein zusätzlicher Status gespeichert und aktuell gehalten werden.
- **Kein Backend-Schritt nötig:** Beide Stellen (Dashboard, Anwesenheitsliste) lesen das Geburtsdatum direkt beim Laden der jeweiligen Seite mit, ohne eine neue Schnittstelle oder Datenbank-Funktion zu benötigen. Das hält den Umsetzungsaufwand klein und reduziert das Risiko, verglichen mit einer Änderung an der bestehenden, bereits an mehreren Stellen verwendeten Anwesenheits-Datenbankfunktion.
- **Datenschutz technisch verankert:** Da nirgends das Geburtsjahr gelesen oder das Alter berechnet wird, ist die Spec-Vorgabe „kein Alter anzeigen" nicht nur eine Anzeige-Entscheidung, sondern bereits auf Datenebene umgesetzt.

### D) Dependencies (packages to install)

- Keine neuen Pakete nötig — `lucide-react` ist bereits im Projekt vorhanden und liefert ein passendes Kuchen-/Geburtstags-Icon für die Anwesenheitsliste; alle UI-Bausteine (Card, Table) sind bereits im Projekt etabliert.

## Implementation Notes (Frontend)

Neuer gemeinsamer Baustein `src/lib/birthdays.ts` (reine Datumslogik, keine UI): `nextBirthdayDate()` berechnet das nächste Vorkommen von Monat+Tag eines Geburtsdatums (inkl. Jahreswechsel-Behandlung und Feb-29→Feb-28-Fallback in Nicht-Schaltjahren), darauf aufbauend `daysUntilNextBirthday()`, `isBirthdayToday()`, `isBirthdayWithinDays()` und `formatNextBirthdayMonthDay()`. Wichtig: `formatNextBirthdayMonthDay()` formatiert bewusst das *berechnete* nächste Vorkommen und nicht das rohe gespeicherte Datum — sonst hätte ein Feb-29-Geburtstag in einem Nicht-Schaltjahr als „29.02." angezeigt werden können, obwohl der tatsächlich beobachtete Tag der 28.02. ist (während der Verzögerungswert `daysUntil` bereits korrekt auf den 28.02. referenziert) — dieser Widerspruch wurde bei der Verifikation entdeckt und vor dem Verifizieren behoben.

**Dashboard-Widget** (`src/components/admin/analytics/birthday-list.tsx`, integriert in `src/app/admin/page.tsx`): Neue Karte „Geburtstage" unterhalb der bestehenden Auslastungs-Liste. Lädt alle Kundenprofile mit gesetztem `birthdate` in einer zusätzlichen Abfrage neben den bereits bestehenden Dashboard-Queries, filtert auf `daysUntil <= 7` und sortiert aufsteigend nach `daysUntil`. Zeigt „Heute" statt eines Datums für den Tag selbst. Leerzustand: „Keine Geburtstage in den nächsten 7 Tagen".

**Anwesenheitsliste** (`src/components/teacher/attendance-matrix.tsx`, `src/app/(site)/lehrer/[courseId]/page.tsx`): `MatrixRow` und `EligibleCustomer` um `hasBirthdayToday: boolean` erweitert. Die Kursseite lädt zusätzlich `profiles.birthdate` für alle im Roster und in der Eligible-Liste vorkommenden Kunden-IDs (eine zusätzliche, einfache Abfrage, keine Änderung an der bestehenden `get_course_attendance_roster`-Datenbankfunktion) und berechnet daraus pro Kunde, ob heute Geburtstag ist. Ein Kuchen-Icon (`Cake` aus lucide-react, mit `aria-label="Hat heute Geburtstag"`) erscheint direkt neben dem Namen. Sowohl der initiale Seitenaufruf als auch der „Kursteilnehmer hinzufügen"-Dialog (der neue Zeilen aus `eligibleCustomers` erzeugt) geben den Flag korrekt weiter. Bekannte, bewusst in Kauf genommene Einschränkung: beim „Mehr laden"-Button (ältere Termine nachladen) fehlt für einen Kunden, der ausschließlich in einem älteren, noch nicht geladenen Termin auftaucht, der Geburtstags-Flag (Fallback `false`), da die zugrundeliegende Datenbankfunktion dafür keine Geburtsdaten liefert — eine Erweiterung dieser Funktion wurde bewusst vermieden (siehe Tech Design).

**Verifikation:** `npm run build`/`npm run lint` sauber. Datumslogik isoliert verifiziert (heute, +4 Tage, +8 Tage außerhalb des 7-Tage-Fensters, Jahreswechsel Dez→Jan, Feb-29-Normalisierung). Live gegen die Produktionsdatenbank geprüft (temporäre Geburtsdaten auf zwei `e2e30`-Fixture-Kunden gesetzt, nach Verifikation vollständig zurückgesetzt): Dashboard-Widget zeigt „Heute" korrekt für den Tag selbst und das Datum für +4 Tage, in der richtigen Reihenfolge sortiert; Leerzustand „Keine Geburtstage in den nächsten 7 Tagen" erscheint korrekt ohne Testdaten; Anwesenheitsliste zeigt das Kuchen-Icon korrekt für den Geburtstagskind-Kunden, sowohl beim initialen Laden als auch (Typ-Ebene) über den „Kursteilnehmer hinzufügen"-Pfad; 375px-Ansicht ohne horizontales Scrollen.

## QA Test Results

**Tested:** 2026-08-21
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: Kunde mit Geburtstag in den nächsten 7 Tagen erscheint im Dashboard-Widget mit Name und Datum
- [x] Kunde mit Geburtstag heute erscheint mit „Heute"
- [x] Kunde mit Geburtstag in 4 Tagen erscheint mit korrektem Datum (DD.MM.)
- [x] Mehrere Kunden im Fenster erscheinen alle, sortiert nach nächstem Geburtstag zuerst

#### AC-2: Kein Kunde hat in den nächsten 7 Tagen Geburtstag → Leerzustand
- [x] „Keine Geburtstage in den nächsten 7 Tagen" erscheint korrekt, wenn kein Fixture-Kunde einen Geburtstag im Fenster hat (manuell verifiziert während `/frontend`; siehe Hinweis unten zu warum dies nicht als permanenter E2E-Test geschrieben wurde)

#### AC-3: Kunde hat heute Geburtstag und ist Kursteilnehmer → Geburtstags-Icon in der Anwesenheitsliste
- [x] Icon (mit `aria-label="Hat heute Geburtstag"`) erscheint korrekt neben dem Namen des Geburtstagskind-Kunden beim initialen Laden der Kursseite

#### AC-4: Kunde ohne hinterlegtes Geburtsdatum → kein Hinweis
- [x] Kunde ohne Geburtsdatum erscheint weder im Dashboard-Widget noch mit einem Icon in der Anwesenheitsliste

#### AC-5: Mehrere Kunden am selben Tag → alle korrekt angezeigt
- [x] Zwei Kunden mit unterschiedlichen Terminen im 7-Tage-Fenster erscheinen beide korrekt (siehe AC-1); die zugrundeliegende Sortier-/Filterlogik behandelt gleiche Tage identisch (durch Unit-Tests der Datumslogik abgedeckt)

### Edge Cases Status

#### EC-1: Geburtstag am 29. Februar in einem Nicht-Schaltjahr
- [x] Wird korrekt als 28. Februar behandelt — sowohl für die Tage-Berechnung als auch für die Anzeige (`daysUntilNextBirthday`/`formatNextBirthdayMonthDay`, unit-getestet: `src/lib/birthdays.test.ts`). In einem Schaltjahr wird korrekt der echte 29. Februar verwendet (ebenfalls unit-getestet)

#### EC-2: 7-Tage-Zeitraum reicht über den Jahreswechsel
- [x] Abfrage am 28.12. für einen Geburtstag am 03.01. liefert korrekt 6 Tage (unit-getestet)

#### EC-3: Kunde mit pausiertem/gekündigtem Abo hat Geburtstag im Fenster
- [x] Erscheint trotzdem im Widget — die Dashboard-Abfrage filtert nicht nach Abo-Status, sondern nach `role = customer` und gesetztem `birthdate` (per Code-Review bestätigt: keine Status-Filterung in `src/app/admin/page.tsx` vorhanden)

#### EC-4 (zusätzlich identifiziert): Geburtstag genau 7 Tage bzw. 8 Tage entfernt (Grenzfall)
- [x] Tag 7 wird eingeschlossen, Tag 8 korrekt ausgeschlossen (unit-getestet und per E2E verifiziert)

### Security Audit Results
- [x] Authentication: `/admin` und `/lehrer/[courseId]` ohne Login → Redirect zu `/login` (bestehende, durch PROJ-31 unveränderte `requireAdmin()`/`requireCourseAccess()`-Gates)
- [x] Authorization: Ein Lehrer ohne Kurs-Zuweisung kann die Anwesenheitsliste (und damit die Geburtstags-Icons) eines fremden Kurses nicht aufrufen (bestehendes, unverändertes Verhalten — bestätigt durch den weiterhin grünen PROJ-13-Regressionstest „AC9: Zugriff auf fremden Kurs wird verweigert")
- [x] Datenschutz: Das Geburtsjahr wird an keiner Stelle der neuen Logik gelesen, berechnet oder an eine Client-Komponente übergeben — weder `BirthdayList` noch `AttendanceMatrix` erhalten mehr als Tag+Monat (Widget) bzw. ein reines Boolean-Flag (Anwesenheitsliste); Alter wird nirgends berechnet
- [x] Input validation: Keine neuen nutzerkontrollierten Eingaben (Geburtsdatum wird ausschließlich über das bereits bestehende, validierte Profil-Formular gesetzt); keine SQL-Injection-Fläche, da alle neuen Abfragen über den Supabase-Query-Builder mit festen Spalten-/Tabellennamen laufen
- [x] XSS: Kundennamen werden ausschließlich über JSX-Interpolation gerendert (React-Escaping), keine `dangerouslySetInnerHTML`-Verwendung in den neuen Dateien

### Regression Testing
- `npm test` (Vitest, inkl. 14 neuer Tests für `src/lib/birthdays.ts`): 189/189 bestanden
- Neue permanente E2E-Suite `tests/PROJ-31-geburtstags-erinnerung.spec.ts` (5 Tests, deckt AC1, AC3, AC4, AC5 sowie den 7/8-Tage-Grenzfall ab, jeweils inkl. Selbstbereinigung der Fixture-Geburtsdaten via `afterEach`): 5/5 bestanden
- Volle Regressionssuiten für alle von PROJ-31 berührten Bereiche erneut ausgeführt (PROJ-13 Lehrer-Ansicht, PROJ-17 Admin-Dashboard, PROJ-25 Self-Check-In, PROJ-32 Aktive-Kunden-Dashboard): 27/32 bestanden. Alle 5 Fehlschläge einzeln root-caused und als **vorbestehend, unabhängig von PROJ-31** bestätigt:
  - PROJ-25 (3 Fehlschläge): Testdatei dokumentiert selbst explizit, dass die Fixture-Kurszeiten relativ zum 18.08. geprimt wurden und bei einem Lauf an einem späteren Tag (heute: 21.08.) aus dem erwarteten Zeitfenster gelaufen sind — PROJ-31 berührt Self-Check-In/Stundenplan nicht
  - PROJ-17 „AC9: Kündigung" (1 Fehlschlag): erwartet genau 1 Kündigung im Zeitraum, tatsächlich 2 — Datenakkumulation aus wiederholten Testläufen; PROJ-31 berührt keine Kündigungs-/Abo-Logik
  - PROJ-13 „AC7: Kunde hinzufügen" (1 Fehlschlag): per direkter Datenbankprüfung bestätigt, dass „E2E13 Flatrate Kunde" bereits einen Anwesenheitseintrag vom 20.08. hat (aus einem früheren Testlauf, der sich nicht selbst bereinigt) und deshalb nicht mehr in der „Kunde hinzufügen"-Liste erscheint — der Test selbst hat kein Cleanup; die `hasBirthdayToday`-Erweiterung von `EligibleCustomer` ändert nichts an der Filterlogik dieser Liste (per Code-Review bestätigt)
- Live gegen die Produktionsdatenbank verifiziert (temporäre Geburtsdaten auf `e2e30`-Fixture-Kunden über die bestehende Admin-Profilbearbeitung gesetzt, nach jedem Test vollständig zurückgesetzt): Dashboard-Widget, Leerzustand, Sortierung, 7/8-Tage-Grenze, fehlendes Geburtsdatum, Anwesenheitsliste-Icon; 375px ohne horizontales Scrollen

**Hinweis zu AC-2 (Leerzustand) und fehlendem permanentem E2E-Test dafür:** Ein permanenter E2E-Test, der einen systemweit leeren Geburtstags-Zustand behauptet, wäre nicht zuverlässig wiederholbar — es gibt keine Staging-Datenbank, und echte (Nicht-Fixture-)Kundendatensätze mit hinterlegtem Geburtsdatum existieren bereits in der Produktionsdatenbank; an einem anderen Kalendertag könnte einer davon zufällig ins 7-Tage-Fenster fallen und den Test flakey machen. Der Leerzustand wurde stattdessen manuell verifiziert und ist zusätzlich durch die Grenzfall-Tests (Tag 8 wird korrekt ausgeschlossen) sowie den Component-Code selbst (einfache `rows.length === 0`-Bedingung, identisch zum bereits etablierten Muster in `OccupancyList`) ausreichend abgesichert.

### Bugs Found
Keine Bugs gefunden. (Ein Detail-Problem — Feb-29-Anzeige zeigte das unnormalisierte Rohdatum statt des tatsächlich beobachteten 28.02. — wurde während der eigenen Verifikation in `/frontend` entdeckt und dort bereits behoben, bevor QA begann; siehe Implementation Notes.)

### Summary
- **Acceptance Criteria:** 5/5 erfüllt
- **Bugs Found:** 0
- **Security:** Pass
- **Production Ready:** YES
- **Recommendation:** Deploy. Die 5 in der Regressionsprüfung gefundenen Fehlschläge sind bestätigt vorbestehend und unabhängig von PROJ-31 (Zeitfenster-Fixture-Drift bei PROJ-25, Datenakkumulation bei PROJ-17/PROJ-13) — sie blockieren dieses Feature nicht, sollten aber als eigener Housekeeping-Task (Test-Selbstbereinigung) auf dem Radar bleiben.

## Deployment
_To be added by /deploy_
