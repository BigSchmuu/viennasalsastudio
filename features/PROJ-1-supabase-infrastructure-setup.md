# PROJ-1: Supabase Infrastructure Setup

## Status: Deployed
**Created:** 2026-08-12
**Last Updated:** 2026-08-12

## Dependencies
- None

## User Stories
- Als neuer Kunde möchte ich mich mit E-Mail/Passwort registrieren und automatisch ein Kundenprofil erhalten, damit ich sofort Self-Service-Funktionen nutzen kann, ohne dass der Admin manuell etwas einrichten muss.
- Als Admin möchte ich, dass Lehrer- und Admin-Rollen nur von mir vergeben werden, damit sich niemand selbst erhöhte Rechte verschaffen kann.
- Als Website-Besucher (nicht eingeloggt) möchte ich Kurse, Stundenplan und Standorte einsehen können, damit ich die Tanzschule kennenlernen kann, bevor ich mich anmelde.
- Als Admin möchte ich Standorte mit mehreren Räumen abbilden können, damit Kurse an mehreren Studios organisiert werden können.
- Als zukünftiges Feature (PROJ-2 bis PROJ-17) möchte ich auf einem stabilen, konsistenten Datenmodell mit aktivierter RLS aufbauen, damit ich sicher und ohne Rework entwickeln kann.

## Out of Scope
- UI zur Verwaltung von Standorten/Räumen/Kursen — gehört zu PROJ-3 (Admin: Kurse, Levels, Locations & Lehrer verwalten)
- Einladungslink/Self-Service-Onboarding für Lehrer — für MVP nur manuelle Rollenzuweisung durch Admin
- Granulare Berechtigungsstufen über Kunde/Lehrer/Admin hinaus — deferred zu PROJ-21 (P2)
- Buchungslogik, Kapazitäten, Warteliste — gehört zu PROJ-8/PROJ-12
- Stripe-Kundendatensätze, Zahlungen, Rechnungen — gehört zu PROJ-7/PROJ-10
- Event-/Ticket-Tabellen — gehört zu PROJ-14
- Gutschein-Tabellen — gehört zu PROJ-15
- Anwesenheits-Tabellen — gehört zu PROJ-13
- Benachrichtigungs-Tabellen — gehört zu PROJ-16
- Social Login (Google etc.) — für MVP nur E-Mail/Passwort

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein neuer Nutzer registriert sich mit E-Mail und Passwort, wenn die Registrierung erfolgreich ist, dann wird automatisch ein `profiles`-Eintrag mit `role = 'customer'` angelegt
- [ ] Angenommen ein Besucher ist nicht eingeloggt, wenn er die Kursliste, den Stundenplan oder die Standorte abruft, dann werden diese Daten angezeigt, ohne dass ein Login erforderlich ist
- [ ] Angenommen ein Kunde ist eingeloggt, wenn er versucht, auf `profiles`, `bookings` oder `subscriptions` eines anderen Kunden zuzugreifen, dann verweigert Row Level Security den Zugriff
- [ ] Angenommen ein Admin ist eingeloggt, wenn er auf beliebige Datensätze zugreift, dann erlaubt Row Level Security vollen Lese-/Schreibzugriff
- [ ] Angenommen ein Standort hat mehrere Räume, wenn ein Kurs angelegt wird, dann kann er genau einem Raum an genau einem Standort zugeordnet werden
- [ ] Angenommen die Rolle eines Nutzers ist „customer", wenn er versucht, seine eigene Rolle auf „admin" oder „teacher" zu ändern, dann wird dies durch RLS/Policy verhindert

## Edge Cases
- Was passiert, wenn der Signup-Trigger fehlschlägt? → Es darf kein Auth-User ohne zugehöriges `profiles`-Objekt zurückbleiben (Konsistenz sicherstellen)
- Was passiert, wenn ein Standort gelöscht werden soll, dem noch Räume/Kurse zugeordnet sind? → Löschung wird verhindert (Fremdschlüssel-Constraint), bis Kurse umgezogen/archiviert sind
- Was passiert, wenn ein Raum ohne zugeordneten Standort angelegt werden soll? → nicht erlaubt, `location_id` ist Pflichtfeld bei Räumen
- Was passiert, wenn sich jemand mit einer bereits registrierten E-Mail erneut registrieren will? → Supabase Auth verhindert das nativ, Fehlermeldung wird angezeigt
- Was passiert, wenn ein Admin einem Nutzer die Rolle „teacher" zuweist, dieser aber noch keinem Kurs zugeordnet ist? → erlaubt, ein Lehrer kann ohne zugewiesene Kurse existieren

## Technical Requirements (optional)
- Security: Row Level Security (RLS) muss auf allen Tabellen aktiviert sein
- Auth: Supabase Auth mit E-Mail/Passwort (kein Social Login im MVP)

## Open Questions
<!-- Unresolved questions from the spec interview. Close them in /refine when answered. -->
- [ ] Soll es künftig einen Einladungslink für Lehrer geben statt manueller Rollenzuweisung?
- [ ] Soll Social Login (z. B. Google) später ergänzt werden?
- [ ] Soll das Kursinhalt-/Lehrmaterial-Video auch für nicht zugeordnete Lehrer (z. B. Vertretungslehrer) sichtbar sein? Aktuell nur für zugeordnete Lehrer + Admin — wird in PROJ-13 (Lehrer-Ansicht, Ersatzlehrer) im Detail geklärt.

## Decision Log

### Product Decisions
<!-- Added by /write-spec -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Schlanker Grundstock (Kern-Entitäten + Locations/Rooms) statt vollständigem Schema für alle P0-Features | Detail-Anforderungen für Waitlist/Events/Gutscheine etc. sind noch nicht interviewt; vermeidet Rework | 2026-08-12 |
| Locations/Rooms als eigene Tabellen (1:n) statt Textfeld bei Kursen | Mehrere Standorte mit jeweils mehreren Räumen | 2026-08-12 |
| Drei Rollen (Kunde/Lehrer/Admin), keine granularen Berechtigungsstufen | Granulare Rollen sind P2 (PROJ-21) | 2026-08-12 |
| Rollen „Lehrer"/„Admin" nur manuell durch Admin vergeben | Sicherheit — verhindert Selbst-Erhöhung von Rechten | 2026-08-12 |
| Katalog (Kurse, Stundenplan, Standorte) öffentlich lesbar ohne Login | Konsistent mit bestehender Website, wichtig für Neukundengewinnung | 2026-08-12 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Supabase (Postgres + Auth + RLS) statt eigenem Auth-System | Im Template bereits vorgesehen, spart Aufwand und Sicherheitsrisiko einer Eigenentwicklung | 2026-08-12 |
| Automatische Profilerstellung per Datenbank-Trigger bei Registrierung | Kunden können sich selbst registrieren, ohne dass ein Auth-Nutzer je ohne zugehöriges Profil bleibt | 2026-08-12 |
| Rolle als Spalte in `profiles` statt in Auth-Nutzer-Metadaten | RLS-Policies können serverseitig direkt darauf prüfen, statt Client-Angaben zu vertrauen | 2026-08-12 |
| Eigene `locations`/`rooms`-Tabellen (1:n) statt Textfeld | Mehrere Standorte mit je mehreren Räumen müssen abgebildet werden | 2026-08-12 |
| Skelett-Tabellen für `courses`, `class_sessions`, `bookings`, `subscriptions` | Geben späteren Features (PROJ-3, PROJ-5, PROJ-6, PROJ-8, PROJ-9) einen stabilen Bezugspunkt, ohne Details vorwegzunehmen, die noch nicht interviewt wurden | 2026-08-12 |
| Kurs-Lehrer-Zuordnung als n:m-Beziehung statt einfacher Fremdschlüssel | Mehrere Lehrer können denselben Kurs gemeinsam unterrichten | 2026-08-12 |
| Getrenntes privates Feld für Kursinhalt-/Lehrmaterial-Video vs. öffentliches Beispiel-Video (PROJ-11) | Unterschiedliche Zielgruppen (Lehrer intern vs. Kunden öffentlich) und unterschiedliche Sichtbarkeit | 2026-08-12 |
| `@supabase/ssr` als zusätzliche Abhängigkeit | Wird für korrektes Cookie-basiertes Session-Handling im Next.js App Router benötigt | 2026-08-12 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Component Structure
Keine UI-Komponenten in diesem Feature — PROJ-1 ist reine Daten- und Auth-Grundlage ohne eigene Bildschirme. Login-/Registrierungs-Oberflächen kommen mit PROJ-2, Verwaltungs-Oberflächen mit PROJ-3.

### B) Data Model (plain language)

```
profiles (1:1 mit Supabase Auth Nutzer verknüpft)
├── Name
├── Rolle (Kunde / Lehrer / Admin — Standard: Kunde)
├── Kontaktdaten (Telefon)
├── Geburtsdatum
├── Geschlecht
└── Erstellt am

locations
├── Name
├── Adresse
└── Beschreibung

rooms
├── Name/Bezeichnung
└── gehört zu genau einem Standort (Pflicht)

courses (Skelett — volle Felder folgen mit PROJ-3/PROJ-5)
├── Name, Tanzstil, Level (öffentlich lesbar)
├── gehört zu genau einem Raum (→ damit auch zu einem Standort)
├── zugeordnete Lehrer (n:m — ein Kurs kann mehrere Lehrer haben, ein Lehrer mehrere Kurse; öffentlich sichtbar, wer unterrichtet)
└── Kursinhalt-/Lehrmaterial-Video (privat — nur zugeordnete Lehrer + Admin, getrennt von öffentlichen Beispiel-Videos aus PROJ-11)

class_sessions (Skelett — volle Terminlogik folgt mit PROJ-6)
├── gehört zu einem Kurs
└── Datum/Uhrzeit

bookings (Skelett — volle Buchungslogik folgt mit PROJ-8)
├── gehört zu einem Kunden-Profil
└── gehört zu einem Termin (class_session)

subscriptions (Skelett — volle Abo-Logik folgt mit PROJ-7/PROJ-9)
├── gehört zu einem Kunden-Profil
└── Status (aktiv/pausiert/gekündigt)
```

**Zugriffsregeln (Row Level Security):**
- Öffentlich (ohne Login): `locations`, `rooms`, `courses` (Name/Stil/Level/zugeordnete Lehrer), `class_sessions` lesbar
- Kunde: voller Zugriff auf eigenes Profil, eigene Buchungen, eigenes Abo — kein Zugriff auf fremde Daten
- Lehrer: zusätzlich Lesezugriff auf das Kursinhalt-/Lehrmaterial-Video der ihm zugeordneten Kurse
- Admin: voller Lese-/Schreibzugriff auf alles

### C) Tech Decisions (justified for PM)
- **Supabase (Postgres + Auth + RLS)** statt eigenem Auth-System: Das Template bringt das schon mit, spart Aufwand und Sicherheitsrisiko einer Eigenentwicklung.
- **Automatische Profilerstellung per Datenbank-Trigger** bei Registrierung: Kunden können sich selbst registrieren, ohne dass ein Auth-Nutzer je ohne zugehöriges Profil bleibt.
- **Rolle als Spalte in `profiles`** statt in Nutzer-Metadaten: Sicherer, da Zugriffsregeln serverseitig direkt darauf prüfen können, statt Client-Angaben zu vertrauen.
- **Eigene `locations`/`rooms`-Tabellen** statt Textfeld: Notwendig, da mehrere Standorte mit je mehreren Räumen abgebildet werden müssen.
- **Skelett-Tabellen** für Kurse/Termine/Buchungen/Abos: Geben späteren Features (PROJ-3, PROJ-5, PROJ-6, PROJ-8, PROJ-9) einen stabilen Bezugspunkt, ohne dass wir jetzt schon Details festlegen, die noch nicht interviewt wurden.
- **Kurs-Lehrer als n:m-Beziehung**: Mehrere Lehrer können denselben Kurs gemeinsam unterrichten.
- **Getrenntes privates Lehrmaterial-Video-Feld**: Unterschiedliche Zielgruppen und Sichtbarkeit als die öffentlichen Beispiel-Videos aus PROJ-11.

### D) Dependencies
- `@supabase/supabase-js` — bereits installiert (Datenbankzugriff)
- `@supabase/ssr` — neu, wird benötigt, damit Login-Sessions im Next.js App Router korrekt über Cookies funktionieren (serverseitig und clientseitig)

## Implementation Notes
_Added by /backend, 2026-08-12_

**Datenbank (Supabase-Projekt "Vienna Salsa Studio", `kqdnaevyzgtrmaatinrx`):**
- Migration `proj1_core_schema`: Tabellen `profiles`, `locations`, `rooms`, `courses`, `course_teachers` (n:m-Join), `course_materials` (privates Lehrmaterial-Video), `class_sessions`, `bookings`, `subscriptions` — alle mit aktivierter RLS
- Helper-Funktion `current_role()` (SECURITY DEFINER) zur rekursionsfreien Rollenprüfung in Policies
- Trigger `on_auth_user_created` auf `auth.users` → legt automatisch `profiles`-Zeile mit `role = 'customer'` an
- Trigger `trg_prevent_role_self_escalation` auf `profiles` → verhindert Rollenänderung durch Nicht-Admins (erfüllt Acceptance Criterion zur Rollen-Selbsterhöhung)
- RLS-Policies je Tabelle wie im Tech-Design beschrieben (öffentlich lesbar: locations/rooms/courses/course_teachers/class_sessions; privat: profiles/bookings/subscriptions/course_materials)
- Migration `proj1_restrict_internal_function_execute`: interne Funktionen (`handle_new_user`, `prevent_role_self_escalation`) sind nicht mehr direkt über die REST-API aufrufbar; `current_role()` bleibt für `authenticated` verfügbar (wird von Policies benötigt)
- Migration `proj1_optimize_rls_auth_calls`: `auth.uid()`-Aufrufe in Policies auf `(select auth.uid())` umgestellt (Supabase-Performance-Empfehlung, per Advisor bestätigt)
- Security- und Performance-Advisor geprüft: keine offenen kritischen Findings (verbleibende Hinweise sind erwartet/unkritisch — `current_role()`-Aufrufbarkeit ist notwendig, "unused index" da Tabellen noch leer sind)

**Code:**
- `@supabase/ssr` installiert
- `src/lib/supabase.ts` (einfacher Einzel-Client) ersetzt durch `src/lib/supabase/client.ts` (Browser-Client) und `src/lib/supabase/server.ts` (Server-Client, cookie-basiert) — nötig für korrektes SSR-Session-Handling im App Router
- `src/lib/supabase/middleware.ts` + `src/middleware.ts` — refresht die Auth-Session bei jedem Request
- `src/lib/supabase/types.ts` — generierte TypeScript-Typen aus dem aktuellen DB-Schema, in `client.ts`/`server.ts` eingebunden für volle Typsicherheit

**Nicht Teil dieses Durchgangs:** Keine API-Routes unter `/src/app/api/` — PROJ-1 liefert nur das Datenfundament; konkrete Endpunkte kommen mit den jeweiligen Features (PROJ-3 ff.). `npm run build`/Type-Check liefen fehlerfrei (`npx tsc --noEmit`).

### Bugfixes (nach /qa, 2026-08-12)
Migration `proj1_fix_bug1_bug2_role_bootstrap_and_anon_access`:
- **BUG-1 (Critical) behoben:** `prevent_role_self_escalation()` blockiert Rollenänderungen jetzt nur noch, wenn `auth.uid()` NICHT null ist (also ein echter, eingeloggter Nutzer sie versucht) UND dieser kein Admin ist. Direkter SQL-/Service-Role-Zugriff (`auth.uid()` ist dort immer null) kann Rollen weiterhin setzen — das ist der Bootstrap-Pfad für den ersten Admin. Da Service-Role-Zugriff RLS ohnehin komplett umgeht, ist das kein neues Sicherheitsrisiko. Verifiziert: Admin-Bootstrap per SQL funktioniert jetzt; ein authentifizierter Kunde kann sich weiterhin nicht selbst befördern (Regressionstest von AC-6 bestanden).
- **BUG-2 (Medium) behoben:** `EXECUTE` auf `current_role()` wurde zusätzlich an die `anon`-Rolle erteilt. Anonyme Zugriffe auf `profiles`/`course_materials`/`bookings`/`subscriptions` liefern jetzt sauber ein leeres Array statt eines rohen `permission denied`-SQL-Fehlers. Verifiziert per REST-Aufruf.
- Security-Advisor erneut geprüft: keine neuen Findings (die verbleibende „current_role() ist von anon/authenticated aufrufbar"-Warnung ist weiterhin beabsichtigt und unkritisch, siehe oben)
- `npm test` erneut ausgeführt: 2/2 bestanden

## QA Test Results

**Tested:** 2026-08-12
**Environment:** Live Supabase-Projekt „Vienna Salsa Studio" (`kqdnaevyzgtrmaatinrx`) — direkt gegen REST/Auth-API getestet, da PROJ-1 keine eigene UI hat (Login-Oberfläche kommt erst mit PROJ-2)
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: Auto-Profilerstellung bei Registrierung
- [x] Neuer Auth-User → automatisch `profiles`-Zeile mit `role = 'customer'` angelegt (getestet mit 2 Testnutzern)

#### AC-2: Öffentlicher Katalog ohne Login
- [x] `courses`, `locations`, `rooms`, `class_sessions` ohne Login lesbar (anonyme REST-Abfrage bestätigt)

#### AC-3: Kunden-Datenisolation
- [x] Kunde A kann eigenes Profil lesen, aber nicht das von Kunde B (leeres Ergebnis)
- [x] Kunde B sieht Kunde A's Buchungen nicht
- [x] Kunde A kann keine Buchung mit fremder `customer_id` anlegen (RLS blockiert Insert)

#### AC-4: Admin-Vollzugriff
- [x] Admin sieht alle Profile und alle Buchungen

#### AC-5: Kurs gehört zu genau einem Raum/Standort
- [x] `room_id` ist Pflichtfeld bei Kursen (FK vorhanden, siehe Schema)

#### AC-6: Kunde kann eigene Rolle nicht ändern
- [x] REST-PATCH von Kunde A auf eigenes `role`-Feld → sauber blockiert mit Fehlermeldung „Only admins can change a user role"

### Edge Cases Status

#### EC-1: Signup-Trigger-Fehlschlag → kein verwaister Auth-User
- [x] In beiden Testregistrierungen wurde zuverlässig ein Profil erzeugt; ein erzwungener Trigger-Fehlschlag wurde nicht separat simuliert (invasiv, hohes Risiko für die Live-DB) — Empfehlung: bei Gelegenheit in einer Staging-Umgebung nachholen

#### EC-2: Standort mit Räumen/Kursen kann nicht gelöscht werden
- [x] `DELETE` auf `locations` mit zugeordnetem Raum → Fremdschlüssel-Fehler, Löschung verhindert

#### EC-3: Raum ohne Standort nicht erlaubt
- [x] `INSERT` auf `rooms` ohne `location_id` → NOT-NULL-Constraint greift

#### EC-4: Doppelte E-Mail-Registrierung
- [x] Zweite Registrierung mit bereits vergebener E-Mail erzeugt keinen zusätzlichen Nutzer (GoTrue gibt bewusst eine neutrale Antwort zurück, um E-Mail-Enumeration zu verhindern — kein Duplikat in der DB bestätigt)

#### EC-5: Lehrer ohne zugeordneten Kurs
- [x] Rolle „teacher" ohne `course_teachers`-Eintrag möglich, keine Fehler

### Security Audit Results
- [x] Authorization: Kunden können nicht auf fremde Profile/Buchungen zugreifen
- [x] Authorization: `customer_id`-Spoofing bei Buchungen wird von RLS verhindert
- [x] Rollen-Selbsterhöhung über die API technisch verhindert
- [x] Signup-E-Mail-Versand ist bereits nativ ratenlimitiert (Supabase-Default)
- [ ] BUG: Siehe BUG-1 — Rollenvergabe-Mechanismus hat keinen funktionierenden Bootstrap-Pfad
- [ ] BUG: Siehe BUG-2 — anonyme Zugriffe auf geschützte Tabellen liefern rohe SQL-Fehlermeldung statt sauberer Zugriffsverweigerung
- Input-Validierung (XSS)/Rate-Limiting auf Formularen: nicht anwendbar — PROJ-1 hat keine Formulare/UI

### Bugs Found

#### BUG-1: Kein funktionierender Weg, den ersten Admin oder überhaupt einen Lehrer anzulegen
- **Severity:** Critical
- **Steps to Reproduce:**
  1. Frisches Projekt, ein Kunde ist registriert (Rolle automatisch „customer")
  2. Versuche per SQL/Backend, die Rolle eines Nutzers auf „admin" oder „teacher" zu ändern (`UPDATE profiles SET role = 'admin' WHERE id = ...`)
  3. Erwartet: Rollenänderung gelingt, wenn sie von einer legitimen Admin-Quelle (z. B. initiales Setup-Skript) kommt
  4. Tatsächlich: Trigger `trg_prevent_role_self_escalation` blockiert JEDE Rollenänderung, sobald kein bereits eingeloggter Admin-Kontext (`auth.uid()`) vorhanden ist — auch bei direktem SQL-Zugriff, da `current_role()` dann `null` liefert und `null IS DISTINCT FROM 'admin'` wahr ist. Es gibt keinen dokumentierten oder technischen Bootstrap-Pfad für den allerersten Admin. Betrifft auch die Vergabe der Lehrer-Rolle.
- **Priority:** Fix before deployment (blockiert praktisch den gesamten Admin-/Lehrer-Betrieb — ohne Admin kann niemand Kurse/Standorte/Räume anlegen, siehe PROJ-3 ff.)

#### BUG-2: Anonyme Zugriffe auf geschützte Tabellen werfen rohen SQL-Fehler statt sauberer Zugriffsverweigerung
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Ohne Login (anon-Rolle) `GET /rest/v1/profiles` oder `/rest/v1/course_materials` aufrufen
  2. Erwartet: leeres Array `[]` (RLS filtert Zeilen sauber) oder ein klarer 401/403
  3. Tatsächlich: `{"code":"42501", "message":"permission denied for function current_role"}` — weil `EXECUTE` auf `current_role()` der `anon`-Rolle entzogen wurde, die Policies diese Funktion aber unabhängig von der Rolle aufrufen
  4. Keine Daten werden geleakt (kein Sicherheitsrisiko im engeren Sinn), aber das Verhalten weicht vom erwarteten sauberen RLS-Verhalten ab und könnte Frontend-Fehlerbehandlung verwirren
- **Priority:** Fix before deployment (einfacher Fix: `EXECUTE` auf `current_role()` auch an `anon` erteilen, da die Funktion ohnehin nur die eigene Rolle des Aufrufers zurückgibt)

### Automated Tests
- `npm test` — 1 neue Testdatei (`tests/proj-1-supabase-infrastructure-setup.test.ts`), 2/2 bestanden (öffentlicher Lesezugriff, kein Daten-Leak bei privaten Tabellen). Läuft direkt gegen die echte REST-API mit dem Anon-Key.
- Playwright/E2E: nicht anwendbar — PROJ-1 hat keine UI-Screens (kommen mit PROJ-2/PROJ-3)
- **Einschränkung:** Vollautomatisierte Regressionstests für Rollen-/Isolations-Szenarien (Testnutzer anlegen/löschen) benötigen einen `SUPABASE_SERVICE_ROLE_KEY`, der in diesem Projekt noch nicht konfiguriert ist. Heutige Tests dazu liefen manuell über direkte SQL-Inserts in `auth.users`. Empfehlung: Service-Role-Key als serverseitige (nicht `NEXT_PUBLIC_`) Env-Variable ergänzen, sobald automatisierte Auth-Tests gebraucht werden.

### Summary
- **Acceptance Criteria:** 6/6 passed
- **Bugs Found:** 2 total (1 Critical, 1 Medium)
- **Security:** Issues found (siehe BUG-1, BUG-2 — kein Daten-Leak, aber BUG-1 blockiert den Admin-Betrieb vollständig)
- **Production Ready:** NO
- **Recommendation:** BUG-1 und BUG-2 vor dem nächsten Feature (PROJ-2/PROJ-3) beheben — insbesondere BUG-1, da ohne funktionierenden Admin-Bootstrap keine der folgenden Admin-Features nutzbar wären

---

## QA Retest Results (nach Bugfixes)

**Tested:** 2026-08-12
**Environment:** Live Supabase-Projekt „Vienna Salsa Studio" (`kqdnaevyzgtrmaatinrx`), REST/Auth-API
**Tester:** QA Engineer (AI)

### Automated Tests
- `npm test` — 2/2 bestanden (vor und nach dem Retest erneut ausgeführt)

### Bug Retest
- **BUG-1 (Critical):** Admin-Bootstrap per direktem SQL funktioniert jetzt ohne Trigger-Workaround (`role='admin'`/`'teacher'` erfolgreich gesetzt). Regressionscheck bestanden: ein authentifizierter Nicht-Admin (Lehrer) kann sich weiterhin nicht selbst zum Admin machen (`Only admins can change a user role`). → **Verified Fixed**
- **BUG-2 (Medium):** Anonyme Zugriffe auf `profiles` und `course_materials` liefern jetzt sauber `[]` statt eines rohen `42501`-Fehlers. → **Verified Fixed**

### Acceptance Criteria Re-Check
- [x] AC-1: Neue Testnutzer → automatisches Kundenprofil
- [x] AC-2: Anonymes Lesen von `courses` funktioniert
- [x] AC-3: Anonymes Lesen von `profiles`/`course_materials` liefert leeres Array (kein Leak, kein Fehler mehr)
- [x] AC-4: Admin sieht alle Profile (Kunde + Lehrer)
- [x] AC-6: Nicht-Admin kann eigene Rolle nicht ändern (Retest mit Lehrer-Rolle)

### Edge Case Re-Check
- [x] EC-2: Standort mit Raum kann nicht gelöscht werden (Fremdschlüssel-Fehler)
- [x] EC-3: Raum ohne Standort abgelehnt (HTTP 400)

### Security Advisor
- Keine neuen Findings. Verbleibende Warnung („current_role() von anon/authenticated aufrufbar") ist weiterhin beabsichtigt (Funktion gibt nur die eigene Rolle des Aufrufers zurück, kein Datenleck) und notwendig für die BUG-2-Fix.

### Summary
- **Acceptance Criteria:** 6/6 passed
- **Bugs Found:** 0 (beide vorherigen Bugs verifiziert behoben)
- **Security:** Pass
- **Production Ready:** YES
- **Recommendation:** Deploy-bereit für den aktuellen Scope (reines Datenfundament, keine UI). Empfehlung aus dem vorigen Durchgang bleibt bestehen: `SUPABASE_SERVICE_ROLE_KEY` ergänzen, sobald automatisierte Auth-Tests mit echten Testnutzern gebraucht werden (aktuell manuell via SQL simuliert).

## Deployment

**Deployed:** 2026-08-12
**Production URL:** https://viennasalsastudio.vercel.app
**Git tag:** v1.0.0-PROJ-1
**Commit:** 11c825a

**Notes:**
- Erster Deploy des Projekts — Vercel-Projekt neu mit GitHub-Repo `BigSchmuu/viennasalsastudio` verbunden, Auto-Deploy auf `main` aktiv
- Env-Vars in Vercel gesetzt: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Produktions-URL antwortet mit HTTP 200; da PROJ-1 keine UI liefert, zeigt die Startseite noch das Next.js-Standard-Template — kein sichtbarer Unterschied erwartet, bis PROJ-2/PROJ-3 UI hinzufügen
- Middleware lief ohne Fehler (bestätigt korrekte Supabase-Env-Var-Konfiguration in Vercel)
- Datenbank-Migrationen liegen bereits live in Supabase (nicht Teil des Vercel-Deploys)

**Bekannte offene Punkte (kein Blocker für diesen Deploy):**
- `npm run lint` ist im Template aktuell kaputt (`next lint` wirft einen Verzeichnisfehler) — vorbestehend, nicht durch PROJ-1 verursacht
- Next.js 16 meldet `middleware`-Konvention als deprecated zugunsten von `proxy` — funktioniert noch, sollte aber bei Gelegenheit migriert werden
- `SUPABASE_SERVICE_ROLE_KEY` fehlt noch für automatisierte Auth-Tests (siehe QA-Notizen)
