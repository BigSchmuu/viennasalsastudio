# PROJ-24: Globale Navigation & Login-Status

## Status: In Progress
**Created:** 2026-08-16
**Last Updated:** 2026-08-16

## Dependencies
- Requires: PROJ-2 (Auth & Kundenprofil) — Login-Status und `LogoutButton` werden wiederverwendet
- Requires: PROJ-5 (Kurskatalog), PROJ-6 (Stundenplan) — Zielseiten der Navigation

## User Stories
- Als Besucher möchte ich von jeder Seite aus zu den Kursen und zum Stundenplan navigieren können, damit ich die App nutzen kann, ohne die URL zu kennen.
- Als nicht eingeloggter Besucher möchte ich von überall aus zum Login gelangen können, damit ich mich schnell anmelden kann.
- Als eingeloggter Kunde möchte ich von überall aus zu meinem Profil wechseln oder mich ausloggen können, damit ich meinen Account jederzeit erreiche, ohne zurückzunavigieren.
- Als eingeloggter Admin möchte ich von den öffentlichen Seiten aus direkt in den Verwaltungsbereich wechseln können, damit ich nicht manuell die `/admin`-URL eintippen muss.
- Als Erstbesucher möchte ich auf „/" eine einfache Willkommensseite mit den wichtigsten Links sehen, statt der aktuellen Next.js-Platzhalterseite.

## Out of Scope
- Marketing-Inhalte auf „/" (Hero-Bilder, Testimonials, SEO-Text etc.) — die eigentliche Marketing-Website ist eine separate, bestehende Website; „/" in dieser App bekommt nur eine schlichte Willkommensseite mit Links
- Navigation innerhalb von `/admin/*` — bleibt unverändert bei der bestehenden `AdminNav`, keine doppelte Navigation
- Eigener „Registrieren"-Link in der Nav-Leiste — Registrierung bleibt wie bisher über die Login-Seite erreichbar (bestehendes Muster aus PROJ-2)
- Lehrer-spezifische Navigationslinks — es gibt aktuell keine Lehrer-Ansicht (kommt erst mit PROJ-13), daher auch kein Lehrer-Link
- Breadcrumbs oder Sub-Navigation innerhalb einzelner Seiten — nur die oberste globale Ebene

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Besucher ist nicht eingeloggt, wenn er eine öffentliche Seite (`/`, `/kurse`, `/stundenplan`, `/login`, `/registrieren`) aufruft, dann sieht er eine Nav-Leiste mit „Kurse", „Stundenplan" und „Login"
- [ ] Angenommen ein Kunde ist eingeloggt, wenn er eine öffentliche Seite aufruft, dann zeigt die Nav-Leiste „Kurse", „Stundenplan", „Mein Profil" und „Logout" statt „Login"
- [ ] Angenommen ein Admin ist eingeloggt, wenn er eine öffentliche Seite aufruft, dann zeigt die Nav-Leiste zusätzlich einen „Admin"-Link zu `/admin`
- [ ] Angenommen ein eingeloggter Kunde klickt in der Nav-Leiste auf „Logout", dann wird er ausgeloggt und die Nav-Leiste zeigt wieder den ausgeloggten Zustand
- [ ] Angenommen ein Besucher befindet sich auf einer der Nav-Zielseiten, wenn die Nav-Leiste angezeigt wird, dann ist der Link zur aktuellen Seite optisch als aktiv hervorgehoben
- [ ] Angenommen ein Besucher ruft `/admin` oder eine Unterseite davon auf, wenn die Seite lädt, dann erscheint weiterhin nur die bestehende `AdminNav`, nicht zusätzlich die neue globale Nav-Leiste
- [ ] Angenommen ein Besucher öffnet die App auf einem schmalen Bildschirm (Mobile), wenn er auf das Menü-Icon tippt, dann klappen die Nav-Links aus; ein erneuter Tap schließt sie wieder
- [ ] Angenommen ein Besucher ruft „/" auf, wenn die Seite lädt, dann sieht er eine schlichte Willkommensseite mit Studio-Namen, kurzer Beschreibung und Links zu Kurse/Stundenplan/Login (statt des bisherigen Next.js-Boilerplates)

## Edge Cases
- Besucher ist auf `/profil` eingeloggt, Session läuft während des Besuchs ab → nächste Server-seitige Navigation greift den fehlenden Login serverseitig ab (bestehendes Verhalten aus PROJ-2), die Nav-Leiste zeigt nach einem Reload korrekt den ausgeloggten Zustand
- Sehr lange Namen/viele Links auf mittelbreiten Bildschirmen (Tablet) → Nav-Leiste nutzt denselben Breakpoint-Ansatz wie das bestehende Design-System, fällt bei Bedarf auf das Mobile-Hamburger-Menü zurück
- Admin loggt sich aus, während er auf einer öffentlichen Seite mit sichtbarem „Admin"-Link ist → Link verschwindet nach dem Logout, da der Login-Status bei jedem Seitenaufruf serverseitig neu geprüft wird
- Nicht eingeloggter Besucher versucht direkt `/profil` aufzurufen → weiterhin durch die bestehende Middleware aus PROJ-1/PROJ-2 zu `/login` umgeleitet, unabhängig von dieser Nav-Leiste

## Technical Requirements (optional)
- Performance: Login-Status wird serverseitig ermittelt (kein sichtbares Aufblitzen des falschen Zustands beim Laden)
- Security: Der „Admin"-Link ist rein kosmetisch — der eigentliche Zugriffsschutz für `/admin` bleibt vollständig bei der bestehenden `requireAdmin()`-Prüfung

## Open Questions
- [ ] Keine offenen Fragen

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Startseite „/" bekommt eine schlichte Willkommensseite statt echtem Marketing-Content | Die eigentliche Marketing-Website ist eine separate, bestehende Website; „/" in dieser App muss nur als Einstiegspunkt in die Kunden-Self-Service-Funktionen dienen | 2026-08-16 |
| Kein separater „Registrieren"-Link in der Nav | Registrierung bleibt über die Login-Seite erreichbar, bestehendes Muster aus PROJ-2, vermeidet Redundanz | 2026-08-16 |
| Eingeloggter Admin sieht zusätzlichen „Admin"-Link auf öffentlichen Seiten | Praktische Abkürzung, spart manuelles Eintippen der `/admin`-URL | 2026-08-16 |
| Globale Nav erscheint NICHT innerhalb von `/admin/*` | Admin-Bereich hat bereits eine eigene, funktionierende `AdminNav`; doppelte Navigation wäre verwirrend | 2026-08-16 |
| Mobile: Hamburger-Menü statt permanent sichtbarer Links | Standardmuster für responsive Navigation, passt zur bestehenden Mobile-First-Anforderung im Design-System | 2026-08-16 |
| Priorität P0 | Blockiert den praktischen Zugang zu allen bereits deployten Kunden-Features (PROJ-2, PROJ-5, PROJ-6, PROJ-7, PROJ-8), da bisher nur über direkte URLs erreichbar | 2026-08-16 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Neuer, zweiter gemeinsamer Seitenrahmen nur für öffentliche/Kunden-Seiten, statt Ergänzung im ganz übergeordneten Rahmen | Verhindert, dass die neue Nav-Leiste automatisch auch im Admin-Bereich erscheint, der bereits sein eigenes, unverändertes Layout mit `AdminNav` hat; reine Datei-Organisationsfrage ohne Auswirkung auf bestehende URLs | 2026-08-16 |
| Login-Status/Rolle serverseitig ermittelt, nicht client-seitig nachgeladen | Vermeidet sichtbares Aufblitzen des falschen Zustands beim Laden | 2026-08-16 |
| Aktive-Seite-Hervorhebung und Mobile-Menü folgen demselben Muster wie die bestehende `AdminNav` | Wiederverwendung eines bereits bewährten Ansatzes statt einer neuen Lösung | 2026-08-16 |
| Kein neuer Datenspeicher — Nav liest ausschließlich bestehende Login-Session und `role`-Feld | Es gibt keine neue fachliche Information, die diese Funktion benötigt | 2026-08-16 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Komponentenstruktur

**Neue Nav-Leiste, erscheint auf allen öffentlichen/Kunden-Seiten (nicht auf `/admin/*`):**
```
Seiten-Header
├── Studio-Name/Logo (Link zu "/")
├── Desktop: Nav-Links nebeneinander
│   ├── Kurse
│   ├── Stundenplan
│   ├── Admin (nur sichtbar, wenn eingeloggter Admin)
│   └── Login  ODER  Mein Profil + Logout (je nach Login-Status)
└── Mobile: Menü-Icon
    └── Aufklappbares Menü mit denselben Links
```

**Neue Willkommensseite auf „/":**
```
Willkommensseite
├── Studio-Name
├── Kurzbeschreibung (1–2 Sätze)
└── Buttons: „Kurse ansehen", „Stundenplan ansehen", „Login"
```

### B) Datenmodell (fachlich)
Kein neuer Datenspeicher nötig. Die Nav-Leiste liest ausschließlich bereits vorhandene Informationen:
- Ob ein Besucher eingeloggt ist (bestehende Login-Session aus PROJ-2)
- Die Rolle des eingeloggten Nutzers — Kunde oder Admin (bestehendes `role`-Feld aus PROJ-1)

Gespeichert in: nichts Neues — reine Anzeige-Logik auf Basis bestehender Daten.

### C) Tech-Entscheidungen (Begründung)

- **Die Nav-Leiste wird NICHT im bestehenden, ganz übergeordneten Seitenrahmen ergänzt, sondern in einem neuen, zweiten Seitenrahmen, der nur die öffentlichen/Kunden-Seiten umfasst:** Der Admin-Bereich hat sein eigenes, unverändertes Layout mit der bestehenden `AdminNav`. Würde die neue Nav-Leiste ganz oben (auf Ebene der gesamten App) ergänzt, würde sie automatisch auch über der Admin-Nav erscheinen — das widerspricht der Entscheidung, den Admin-Bereich unverändert zu lassen. Technisch handelt es sich um eine reine Organisationsfrage, welche Seiten sich einen gemeinsamen Rahmen teilen — keine Auswirkung auf die URLs der bestehenden Seiten.
- **Login-Status und Rolle werden serverseitig ermittelt, bevor die Seite an den Besucher ausgeliefert wird:** Verhindert ein kurzes Aufblitzen des falschen Zustands (z. B. „Login" statt „Mein Profil"), das entstehen würde, wenn der Status erst nachträglich im Browser nachgeladen würde.
- **Aktive-Seite-Hervorhebung und Mobile-Menü-Verhalten folgen demselben Muster wie die bestehende `AdminNav`:** Wiederverwendung eines bereits bewährten, funktionierenden Ansatzes statt einer neuen Lösung.
- **Der „Admin"-Link in der Nav ist rein kosmetisch:** Der eigentliche Zugriffsschutz für `/admin` bleibt vollständig bei der bestehenden Prüfung aus PROJ-1 — die Nav-Leiste entscheidet nicht über Berechtigungen, sie zeigt nur situativ einen praktischen Link an.

### D) Abhängigkeiten (Pakete)
Keine neuen Fremdpakete nötig — alle UI-Bausteine (Menü-Button, aufklappbares Mobile-Menü) sind mit den bereits installierten shadcn/ui-Komponenten umsetzbar.

## Implementation Notes (Frontend)

**Datei-Umstrukturierung:** Alle öffentlichen/Kunden-Seiten (`/`, `/kurse`, `/stundenplan`, `/profil`, `/login`, `/registrieren`, `/passwort-vergessen`, `/passwort-zuruecksetzen`) wurden per `git mv` in eine neue Route-Group `src/app/(site)/` verschoben (Next.js Route Groups ändern keine URLs, nur die Datei-Organisation). `/admin/*` und `/auth/confirm` bleiben unverändert außerhalb dieser Gruppe. `npm run build` bestätigt identische Routen-Liste vor/nach der Umstrukturierung.

**Neue Bausteine:** `src/app/(site)/layout.tsx` (Server Component, ermittelt Login-Status + Rolle serverseitig, kein Aufblitzen des falschen Zustands), `src/components/nav/site-header.tsx` (Client Component: Desktop-Nav mit Aktiv-Hervorhebung nach `AdminNav`-Muster, Mobile-Hamburger-Menü via shadcn `Sheet`).

**Startseite:** `src/app/(site)/page.tsx` ersetzt das bisherige, unveränderte Next.js-Boilerplate durch eine schlichte Willkommensseite mit Studio-Name, Kurzbeschreibung und Buttons zu Kurse/Stundenplan/Login.

**Live end-to-end getestet** (Playwright, echte Supabase-Instanz, Testkonten danach gelöscht):
- Ausgeloggt: „Kurse", „Stundenplan", „Login" sichtbar
- Eingeloggter Kunde: „Login" verschwindet, „Mein Profil" + Logout erscheinen, kein „Admin"-Link
- Eingeloggter Admin: zusätzlicher „Admin"-Link sichtbar
- Logout über die Nav-Leiste funktioniert, leitet zu „/" um, Nav zeigt danach wieder den ausgeloggten Zustand
- Aktive-Seite-Hervorhebung korrekt (geprüfte CSS-Klasse wechselt mit der aktuellen Route)
- `/admin` zeigt weiterhin ausschließlich die bestehende `AdminNav`, keine doppelte Navigation
- Mobile (375px): Desktop-Nav ausgeblendet, Hamburger-Button vorhanden, Sheet öffnet mit denselben Links, Navigation darüber funktioniert, kein horizontales Overflow
- Keine `pageerror`-Events in allen Testläufen

**Nicht in dieser Session final geklärt:** Keine.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
