# PROJ-31: Geburtstags-Erinnerung

## Status: In Progress
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
_To be added by /qa_

## Deployment
_To be added by /deploy_
