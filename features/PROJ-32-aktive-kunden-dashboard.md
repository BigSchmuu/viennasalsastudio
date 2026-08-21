# PROJ-32: Aktive-Kunden-Anzahl im Dashboard

## Status: In Progress
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
_To be added by /qa_

## Deployment
_To be added by /deploy_
