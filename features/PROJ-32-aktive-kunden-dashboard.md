# PROJ-32: Aktive-Kunden-Anzahl im Dashboard

## Status: Deployed
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Dependencies
- PROJ-17 (Admin-Analytics-Dashboard)

## User Stories
- Als Admin möchte ich auf meinem Dashboard die aktuelle Anzahl aktiver Kunden sehen, damit ich auf einen Blick ein Gefühl für den Geschäftsstand habe, ohne Listen durchsuchen zu müssen.

## Out of Scope
- Historischer Verlauf der aktiven Kunden über Zeit — nur eine aktuelle Momentaufnahme fürs MVP; ein Trend könnte später analog zu den bestehenden Umsatz-/Kündigungs-Trends (PROJ-17) ergänzt werden
- Aufschlüsselung nach Kurs, Level oder Tanzstil — nur die Gesamtzahl

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen es gibt Kunden mit mindestens einem Abo im Status „aktiv", wenn der Admin das Dashboard öffnet, dann zeigt eine Kachel die Anzahl dieser Kunden
- [ ] Angenommen ein Kunde hat mehrere Abos, von denen mindestens eines aktiv ist, wenn die Kachel berechnet wird, dann wird dieser Kunde nur einmal gezählt
- [ ] Angenommen ein Kunde hat nur pausierte oder gekündigte Abos, wenn die Kachel berechnet wird, dann wird dieser Kunde nicht mitgezählt
- [ ] Angenommen es gibt aktuell keine aktiven Kunden, wenn der Admin das Dashboard öffnet, dann zeigt die Kachel „0" statt eines Fehlers oder Leerzustands

## Edge Cases
- Ein Abo wechselt genau zum Zeitpunkt der Anzeige von aktiv zu pausiert (z.B. durch eine geplante Pause, die heute wirksam wird) — die Zahl muss den aktuellen Stand nach der täglichen Cron-Verarbeitung zeigen, nicht einen zwischengespeicherten alten Wert.

## Technical Requirements (optional)
- Keine besonderen Anforderungen über die üblichen Standards hinaus.

## Open Questions
- Keine offenen Fragen zum Zeitpunkt der Spec-Erstellung.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| „Aktiver Kunde" = mindestens ein Abo mit Status „aktiv" | User-bestätigte Definition, konsistent mit der Newsletter-Gruppe „Aktive Kunden" (PROJ-28) | 2026-08-21 |
| Kachel nutzt die bestehende `MetricTile`-Komponente | Konsistentes Look & Feel mit den anderen Dashboard-Kacheln (PROJ-17) | 2026-08-21 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Zählung per direkter Abfrage + Deduplizierung im Server Component, keine neue Datenbankfunktion | Admins haben bereits vollen Lesezugriff auf `subscriptions` (RLS erlaubt es); dieselbe „abfragen + im JS deduplizieren"-Technik wird im Projekt schon an anderer Stelle für ähnliche Zählungen verwendet — kein neues Backend-Objekt nötig | 2026-08-21 |
| Kachel wird als viertes Element in das bestehende Dashboard-Grid eingefügt, Grid wechselt von 3 auf 4 Spalten | Konsistent mit den bestehenden drei Kacheln (Umsatz, Auslastung, Kündigungen); vermeidet ein unschön umbrechendes Layout bei nur 3 Spalten | 2026-08-21 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Component Structure (Visual Tree)

```
Admin-Dashboard (/admin)
└── Kachel-Reihe (bisher 3, neu 4 Kacheln)
    ├── Umsatz im Zeitraum (bestehend)
    ├── Auslastung (bestehend)
    ├── Kündigungen im Zeitraum (bestehend)
    └── Aktive Kunden (NEU)
        — zeigt eine einzelne Zahl, keine Zeitraum-Abhängigkeit
        — keine Sekundärzeile (kein Vergleichswert nötig laut Spec)
```

### B) Data Model (plain language)

```
Keine neuen Felder oder Tabellen nötig.

„Aktive Kunden"-Zahl wird live berechnet aus der bestehenden
Abo-Tabelle:
- Alle Abos mit Status „aktiv" werden geladen
- Die dazugehörigen Kunden werden dedupliziert gezählt
  (ein Kunde mit mehreren aktiven Abos zählt nur einmal)

Diese Zahl ist eine Momentaufnahme zum Zeitpunkt des Seitenaufrufs,
nicht zwischengespeichert — reflektiert also automatisch den Stand
nach der täglichen Cron-Verarbeitung (z.B. wenn eine geplante Pause
heute wirksam wird).
```

### C) Tech Decisions (justified for PM)

- **Keine neue Datenbankfunktion:** Die App liest Abo-Daten für Admins bereits heute direkt und vollständig (kein eingeschränkter Zugriff). Eine einfache Abfrage plus Deduplizierung im Server-Code reicht aus — dasselbe Muster wird im Projekt schon für ähnliche Auszählungen verwendet.
- **Immer eine Live-Zahl, kein Cache:** Da die Seite bei jedem Aufruf neu geladen wird, zeigt die Kachel automatisch den aktuellen Stand — genau das im Edge Case geforderte Verhalten (kein veralteter Wert nach einer heute wirksam gewordenen Pause).
- **Vierte Kachel im bestehenden Raster statt neuer Sektion:** Passt zum etablierten Dashboard-Layout aus PROJ-17 und erfordert keine neue UI-Struktur.

### D) Dependencies (packages to install)

- Keine neuen Pakete nötig — nutzt ausschließlich bereits vorhandene Komponenten (`MetricTile`) und die bestehende Supabase-Anbindung.

## Implementation Notes (Frontend)

Added directly to `src/app/admin/page.tsx`: a fourth query (`subscriptions` where `status = 'active'`, selecting `customer_id` only) fetched alongside the existing dashboard queries, deduplicated via `new Set(...).size`. Dashboard grid changed from `sm:grid-cols-3` to `sm:grid-cols-2 lg:grid-cols-4` to fit the new "Aktive Kunden" `MetricTile` without an awkward wrap. No backend work needed — matches the architecture design exactly.

**Verification:** `npm run build` / `npm run lint` clean. Live-checked in the browser: dashboard shows "Aktive Kunden: 17", matching a direct `select count(distinct customer_id) from subscriptions where status = 'active'` reference query against the same production data.

## QA Test Results

**Tested:** 2026-08-21
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: Kachel zeigt Anzahl aktiver Kunden
- [x] Kachel „Aktive Kunden" ist sichtbar und zeigt eine Zahl (live gegen Produktionsdaten: 17)

#### AC-2: Kunde mit mehreren aktiven Abos zählt nur einmal
- [x] Verifiziert direkt gegen echte Produktionsdaten: 24 rohe „aktiv"-Abo-Zeilen (4 Kunden mit 2–3 aktiven Abos gleichzeitig), aber nur 17 distincte Kunden — die Kachel zeigt korrekt 17, nicht 24

#### AC-3: Kunde mit nur pausierten/gekündigten Abos wird nicht mitgezählt
- [x] Verifiziert per Datenabgleich: mehrere Kunden mit ausschließlich „paused"/„cancelled"-Status existieren in den Produktionsdaten und sind in den 17 nicht enthalten (durch den serverseitigen `status = 'active'`-Filter bereits by construction ausgeschlossen)

#### AC-4: Keine aktiven Kunden → Kachel zeigt „0"
- [x] Verifiziert per Code-Review statt Live-Test: `new Set([]).size` ergibt garantiert `0`, `MetricTile` rendert `value` immer unbedingt (keine Sonderbehandlung für leere/0-Werte, kein Error-Boundary-Risiko). Ein Live-Test hätte bedeutet, alle 24 aktiven Abos in der gemeinsamen Produktions-DB temporär zu pausieren — als unverhältnismäßig destruktiv verworfen (siehe Projekt-Grundsatz: keine systemweiten Leerzustands-Annahmen/-Manipulationen ohne Staging-Umgebung).

### Edge Cases Status

#### EC-1: Abo wechselt genau zum Anzeigezeitpunkt von aktiv zu pausiert
- [x] Verifiziert per Code-Review: die Zahl wird bei jedem Seitenaufruf frisch aus der Datenbank geladen (kein Cache, kein `unstable_cache`), reflektiert also automatisch den Stand nach der täglichen Cron-Verarbeitung

### Security Audit Results
- [x] Autorisierung: Kachel liegt auf `/admin`, geschützt durch dieselbe bestehende Admin-Prüfung wie die restlichen PROJ-17-Kacheln (durch PROJ-17s eigenen AC12-Test „Nicht-Admin wird vom Dashboard weggeleitet" mitabgedeckt, unverändert von dieser Änderung)
- [x] Keine neue Angriffsfläche: rein lesende Aggregatzahl, kein neuer Nutzereingabe-Pfad, kein neuer Server Action, keine neuen client-seitig kontrollierbaren Parameter

### Regression Testing
- [x] `npm test`: 175/175 Unit-Tests grün
- [x] PROJ-17-Regressionssuite (`tests/PROJ-17-admin-analytics-dashboard.spec.ts`): 7/8 grün — 1 Fehlschlag gefunden, aber **nicht durch diese Änderung verursacht**: „AC9: Eigener Zeitraum zeigt hinterlegte Kündigung" erwartet genau 1 Kündigung im August, findet aber 2, da ein PROJ-8-Fixture-Kunde („E2E8 Kunde Heute") eine Kündigung mit dem heutigen Datum trägt, das zufällig in PROJ-17s Testzeitraum (1.–31. August) fällt. Diese Änderung liest ausschließlich `subscriptions.status`, nie `cancelled_at` — bestätigt unabhängig. Vorbestehendes, funktionsübergreifendes Test-Datum-Kollisionsproblem, dem Nutzer transparent mitgeteilt, nicht behoben (außerhalb des Scopes dieser QA-Runde).
- [x] Responsive (375px/768px/1440px): keine horizontale Überlappung, alle vier Kacheln sichtbar auf allen drei Breakpoints

### Bugs Found

Keine Bugs in PROJ-32 selbst gefunden.

### Summary
- **Acceptance Criteria:** 4/4 passed
- **Bugs Found:** 0
- **Security:** Pass — keine neue Angriffsfläche
- **Production Ready:** YES
- **Recommendation:** Deploy. Ein vorbestehender, unabhängiger Regressionsfund in PROJ-17s eigener Testsuite (Datumskollision mit einem PROJ-8-Fixture) sollte separat vom Nutzer priorisiert werden, blockiert aber nicht den Rollout von PROJ-32.

## Deployment

- **Deployed:** 2026-08-21
- **Production URL:** https://viennasalsastudio.vercel.app
- **Git tag:** `v1.0.0-PROJ-32`
- **Commit:** `02c6fcf`
- **Deployment method:** Push to `main` → Vercel auto-deploy (already deployed automatically when the QA commit was pushed; this step confirmed the build succeeded and verified the feature live)
- **Post-deployment verification:** Confirmed live in production via Playwright — "Aktive Kunden" tile shows "17", matching the value seen locally against the same shared production database. All three existing PROJ-17 tiles (Umsatz, Auslastung, Kündigungen) remain visible alongside it. No new environment variables required for this feature.
