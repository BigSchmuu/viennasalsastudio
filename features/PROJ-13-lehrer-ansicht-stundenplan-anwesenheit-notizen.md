# PROJ-13: Lehrer-Ansicht (Stundenplan, Anwesenheit, Notizen)

## Status: In Progress
**Created:** 2026-08-17
**Last Updated:** 2026-08-17

## Dependencies
- Requires: PROJ-2 (Auth & Kundenprofil) — Lehrer muss eingeloggt sein
- Requires: PROJ-3 (Admin: Kurse, Levels, Locations & Tanzstile verwalten) — Kurs-/Termin-Datenmodell (`course_schedule`, `course_entry_dates`)
- Requires: PROJ-8 (Kursbuchung) — kursgebundene Abos sowie bestätigte Probestunden-/Drop-in-Buchungen füllen die Anwesenheitsliste automatisch vor
- Requires: PROJ-22 (Admin: Lehrer-Rollen verwalten) — Lehrer-Rolle und Kurs-Zuweisung (`course_teachers`) existieren bereits
- Requires: PROJ-24 (Globale Navigation & Login-Status) — neuer rollenspezifischer Nav-Link folgt demselben Muster wie der bestehende Admin-Link
- Ergänzt (nicht ersetzt): PROJ-6 (Stundenplan & Kalender) — die bestehende öffentliche Stundenplan-Seite deckt die Gesamtübersicht aller Kurse bereits ab; PROJ-13 fokussiert auf den Lehrer-spezifischen Mehrwert (eigene Kurse + Anwesenheit + Notizen)

## User Stories
- Als Lehrer möchte ich meine zugewiesenen Kurse mit ihren Terminen sehen, damit ich weiß, wann ich unterrichte.
- Als Lehrer möchte ich pro Kurstermin die erwarteten Teilnehmer sehen und deren Anwesenheit markieren, damit ich einen Überblick habe, wer da war.
- Als Lehrer möchte ich bei Bedarf manuell einen Kunden zur Anwesenheitsliste hinzufügen, damit auch Flatrate-Kunden oder spontane Teilnehmer erfasst werden, die nicht automatisch gelistet sind.
- Als Lehrer möchte ich pro Kurstermin eine Notiz hinterlegen, damit ich (und ggf. Co-Lehrer desselben Kurses) den Unterrichtsverlauf nachvollziehen können.
- Als Admin möchte ich Anwesenheit und Notizen aller Kurse einsehen und bei Bedarf korrigieren können, damit ich bei Rückfragen oder Lehrerausfall eingreifen kann.

## Out of Scope
- **Vertretungsanfragen/-verwaltung** — eigenständiger Anfrage-/Zusage-Workflow mit Benachrichtigungen, sprengt den Rahmen von PROJ-13. Ein zukünftiges Feature könnte darauf aufbauen (z.B. „Vertretung anfragen"-Button in dieser Lehrer-Ansicht), wird hier aber nicht vorgezogen.
- **Gesamtübersicht aller Kurse** (nicht nur eigene) — bereits durch den bestehenden öffentlichen Stundenplan (PROJ-6) abgedeckt, den auch Lehrer besuchen können; kein neuer Code nötig.
- **Kunden-Sicht auf eigene Anwesenheit** — Kunden sehen ihre Anwesenheitshistorie in dieser Version nicht, nur Lehrer und Admin.
- **Statistiken/Auswertungen über Anwesenheit** (z.B. Anwesenheitsquote pro Kunde/Kurs) — gehört perspektivisch zu PROJ-17 (Admin-Analytics-Dashboard).
- **Dritter Anwesenheits-Status „Entschuldigt"** — für MVP nur Anwesend/Abwesend.
- **Freie Kundenauswahl beim manuellen Hinzufügen** — nur Kunden mit aktivem Abo oder aktiver Buchung wählbar, keine beliebigen/inaktiven Konten.
- **Kunden-individuelle Notizen** (unabhängig vom Termin) — Notizen sind an einen Kurstermin gebunden, nicht an einen einzelnen Kunden.
- Nicht zu verwechseln mit den bestehenden Video-Lektionen aus PROJ-23 (internes Lehrmaterial) — das sind separate, bereits existierende Daten.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Nutzer mit der Rolle Lehrer ist eingeloggt, wenn er eine beliebige Seite der App aufruft, dann sieht er in der globalen Navigation einen zusätzlichen Link „Meine Kurse"
- [ ] Angenommen ein Lehrer ist aktuell keinem Kurs zugewiesen, wenn er „Meine Kurse" öffnet, dann sieht er einen Hinweistext statt einer leeren Liste
- [ ] Angenommen ein Lehrer ist einem oder mehreren Kursen zugewiesen, wenn er „Meine Kurse" öffnet, dann sieht er seine Kurse mit den anstehenden sowie den letzten 8 vergangenen Terminen je Kurs
- [ ] Angenommen ein Lehrer öffnet einen heutigen oder vergangenen Kurstermin, wenn die Anwesenheitsliste lädt, dann sind alle Kunden mit aktivem kursgebundenem Abo sowie alle für genau dieses Datum bestätigten Probestunden-/Drop-in-Buchungen automatisch vorbefüllt
- [ ] Angenommen ein Lehrer markiert einen Kunden auf der Anwesenheitsliste als anwesend oder abwesend, wenn er speichert, dann wird der Status sofort übernommen und bleibt bei erneutem Aufruf der Seite sichtbar
- [ ] Angenommen ein Lehrer öffnet einen zukünftigen Kurstermin, dann ist das Markieren von Anwesenheit gesperrt, da der Termin noch nicht stattgefunden hat
- [ ] Angenommen ein Lehrer möchte einen Kunden erfassen, der nicht automatisch gelistet ist (z.B. Flatrate-Kunde), wenn er „Kunde hinzufügen" nutzt, dann kann er aus allen Kunden mit einem aktiven Abo oder einer aktiven Buchung auswählen
- [ ] Angenommen ein Lehrer trägt eine Notiz zu einem Kurstermin ein, wenn er speichert, dann ist die Notiz für alle diesem Kurs zugewiesenen Lehrer sowie für den Admin sichtbar und bearbeitbar
- [ ] Angenommen ein Lehrer versucht, über eine direkte URL auf einen Kurs zuzugreifen, dem er nicht zugewiesen ist, dann wird der Zugriff verweigert
- [ ] Angenommen ein Admin öffnet die Anwesenheits-/Notizansicht eines beliebigen Kurses, dann kann er dieselben Inhalte wie ein zugewiesener Lehrer einsehen und bearbeiten

## Edge Cases
- Kurs hat noch keinen Wochentermin oder keine Einstiegstermine hinterlegt (wie bei PROJ-8 möglich) → keine Termine zum Markieren vorhanden, Hinweistext statt leerer Liste
- Kunde storniert seine Probestunde/Drop-in-Buchung, nachdem für diesen Termin bereits Anwesenheit erfasst wurde → der erfasste Datensatz bleibt als historischer Eintrag bestehen
- Kunde bucht seine Probestunde auf ein neues Datum um (Umbuchen, PROJ-8) → Anwesenheit bleibt am ursprünglichen Termin, am neuen Termin erscheint der Kunde erneut automatisch vorbefüllt
- Lehrer wird nachträglich von einem Kurs abgezogen (Admin ändert Kurs-Zuweisung) → verliert sofort den Zugriff auf Anwesenheit/Notizen dieses Kurses; bereits erfasste Daten bleiben für Admin und verbleibende Lehrer erhalten
- Zwei Lehrer bearbeiten gleichzeitig dieselbe Termin-Notiz → letzter Speicherstand gewinnt, kein Konflikt-Handling für MVP
- Kunde hat sowohl ein kursgebundenes Abo als auch eine bestätigte Drop-in-Buchung für denselben Termin → erscheint nur einmal auf der Liste, nicht doppelt

## Technical Requirements (optional)
- Security: Zugriff auf Anwesenheit/Notizen eines Kurses ausschließlich für die diesem Kurs zugewiesenen Lehrer (`course_teachers`) und für Admin; serverseitig durchgesetzt, nicht nur UI-seitig verborgen
- Datenintegrität: Anwesenheitsstatus ist pro Kurs, Termin-Datum und Kunde eindeutig (kein Duplikat bei mehrfachem Speichern)

## Open Questions
- [ ] Keine offenen Fragen

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Fokus auf „Meine Kurse" statt einer neuen Gesamtübersicht | Die Gesamtübersicht aller Kurse existiert bereits über den öffentlichen Stundenplan (PROJ-6); der Lehrer-Mehrwert liegt in Anwesenheit/Notizen für die eigenen Kurse | 2026-08-17 |
| Vertretungsanfragen als eigenständiges, zukünftiges Feature vermerkt statt jetzt mitgebaut | Eigener Anfrage-/Zusage-Workflow mit Benachrichtigungen sprengt den Rahmen von PROJ-13; die „Meine Kurse"-Basis blockiert eine spätere Erweiterung nicht | 2026-08-17 |
| Anwesenheitsliste automatisch vorbefüllt: kursgebundene Abos + für den Termin bestätigte Probe-/Drop-in-Buchungen | Deckt den Großteil der Fälle automatisch ab, ohne Flatrate-Kunden fälschlich auf jedem Kurs zu listen | 2026-08-17 |
| Flatrate-Kunden nicht automatisch gelistet, aber manuell hinzufügbar | Nicht vorhersehbar, welchen Kurs ein Flatrate-Kunde an einem bestimmten Tag besucht; manuelles Hinzufügen deckt den Bedarf ab | 2026-08-17 |
| Nur Anwesend/Abwesend als Status (kein „Entschuldigt") | Einfachste Lösung für den Kernbedarf; ein dritter Status kann bei Bedarf später ergänzt werden | 2026-08-17 |
| Anwesenheit nur für heutige und vergangene Termine erfassbar, nicht für zukünftige | Anwesenheit kann erst sinnvoll erfasst werden, nachdem der Termin stattgefunden hat | 2026-08-17 |
| Nachtragbar für die letzten 8 Termine pro Kurs | Konsistent mit dem bestehenden Termin-Fenster-Muster in der App (z.B. im Buchungsformular); verhindert unbegrenzt wachsende Terminlisten bei langlaufenden Kursen | 2026-08-17 |
| Notizen sind pro Kurstermin gebunden, nicht pro Kunde | Deckt den geäußerten Kernbedarf (Unterrichtsplanung/-verlauf über die Zeit) ab; kundenindividuelle Notizen wären ein möglicher späterer Ausbau | 2026-08-17 |
| Notizen sichtbar und bearbeitbar für alle dem Kurs zugewiesenen Lehrer sowie Admin | Unterstützt Ko-Teaching (Absprache zwischen Lehrern) und gibt dem Admin Überblick, ohne dass Kundendaten involviert sind | 2026-08-17 |
| Admin darf Anwesenheit/Notizen auch bearbeiten, nicht nur einsehen | Konsistent mit dem bestehenden Vollzugriffs-Muster für Admin in der gesamten App (z.B. bei Abos, Buchungen) | 2026-08-17 |
| Neuer Nav-Link „Meine Kurse" für die Lehrer-Rolle | Konsistent mit PROJ-24s bestehendem Muster für rollenspezifische Nav-Links (analog zum Admin-Link) | 2026-08-17 |
| Manuelles Hinzufügen zur Anwesenheitsliste nur unter Kunden mit aktivem Abo oder aktiver Buchung | Verhindert versehentliches Hinzufügen falscher oder inaktiver Kunden | 2026-08-17 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Neue eigenständige Route `/lehrer` statt Erweiterung von `/profil` | Eigener Bereich mit mehreren Unterseiten (Kursliste, Terminliste, Termin-Detail) passt strukturell nicht als Abschnitt einer Profilseite; spiegelt die bestehende `/admin`-Konvention | 2026-08-17 |
| Anwesenheit und Notiz werden direkt über Kurs + Kalenderdatum verknüpft, kein neuer „Termin"-Datensatz | Kurstermine existieren in der App nicht als eigene gespeicherte Zeilen — sie ergeben sich rechnerisch aus Wochentag, Pausen und Einstiegsterminen des Kurses (bestehendes Muster aus PROJ-6/PROJ-8). Ein zusätzlicher Termin-Datensatz wäre redundant und müsste ständig synchron gehalten werden | 2026-08-17 |
| Anwesenheitsliste wird bei jedem Aufruf frisch aus den aktuellen Abo-/Buchungsdaten berechnet, nicht einmalig eingefroren | Bleibt automatisch korrekt, auch wenn sich z.B. eine Drop-in-Buchung erst nach dem ersten Öffnen der Liste ändert; nur die tatsächlich gesetzten Anwesend/Abwesend-Markierungen werden dauerhaft gespeichert | 2026-08-17 |
| Serverseitige Zugriffsprüfung „zugewiesener Lehrer ODER Admin" pro Kurs, nicht nur UI-seitig verborgen | Erfüllt die explizite Sicherheitsanforderung aus dem Spec; verhindert Zugriff über direkt aufgerufene URLs (entspricht dem in dieser App durchgängig verwendeten RLS-Muster) | 2026-08-17 |
| Admin nutzt dieselbe Lehrer-Ansicht statt einer separaten Admin-Oberfläche, erreichbar über einen neuen Einstiegspunkt in der bestehenden Kursverwaltung (`/admin/kurse`) | Vermeidet doppelt gebaute/gepflegte Oberflächen; stellt sicher, dass Admin exakt das sieht und bearbeitet, was der Lehrer sieht | 2026-08-17 |
| „Kunde hinzufügen" nutzt eine Kundensuche nach demselben Muster wie die bestehende Kundensuche bei der Lehrer-Beförderung (PROJ-22) | Bewährtes, bereits vorhandenes UI-Muster für „aus einer eingeschränkten Kundenmenge auswählen" wiederverwenden statt neu zu erfinden | 2026-08-17 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Komponentenstruktur

```
Globale Navigation (bestehend, PROJ-24)
└── Neuer Link „Meine Kurse" — nur sichtbar für eingeloggte Nutzer mit Rolle Lehrer

/lehrer (neu)
├── Kursliste „Meine Kurse"
│   ├── Pro Kurs: Name, Level, Tanzstil, Standort/Raum
│   └── Leerzustand „Dir sind noch keine Kurse zugewiesen", falls keine Zuweisung existiert
│
└── Kurs-Detailansicht (Klick auf einen Kurs in der Liste)
    ├── Terminliste: anstehende Termine + letzte 8 vergangene Termine dieses Kurses
    │   └── Klick auf einen Termin öffnet die Termin-Ansicht
    │
    └── Termin-Ansicht (pro Kurs + Datum)
        ├── Anwesenheitsliste
        │   ├── Automatisch vorbefüllt: aktive kursgebundene Abonnenten
        │   │   + für dieses Datum bestätigte Probestunden-/Drop-in-Buchungen
        │   ├── Anwesend/Abwesend-Umschalter pro Kunde
        │   │   (gesperrt, solange der Termin in der Zukunft liegt)
        │   └── „Kunde hinzufügen" — Suche unter Kunden mit aktivem Abo/Buchung,
        │       für Fälle, die nicht automatisch erscheinen (z.B. Flatrate-Kunden)
        └── Notizfeld — ein gemeinsamer Freitext für diesen Termin,
            sichtbar & bearbeitbar für alle dem Kurs zugewiesenen Lehrer + Admin

/admin/kurse (bestehend, PROJ-3)
└── Neue Aktion „Anwesenheit" pro Kurszeile
    └── Führt zur selben Kurs-Detail-/Termin-Ansicht wie oben,
        nur ohne die Einschränkung „nur eigene Kurse" (Admin sieht jeden Kurs)
```

### B) Datenmodell (fachlich)

**Anwesenheit** (neu): Für jede Kombination aus Kurs, Kalenderdatum und Kunde genau ein Eintrag mit dem Status „Anwesend" oder „Abwesend", inklusive Info, wer die letzte Änderung vorgenommen hat. Ein Kunde kann pro Kurs und Termin nur einen Anwesenheitsstatus haben.

**Termin-Notiz** (neu): Für jede Kombination aus Kurs und Kalenderdatum ein Freitext-Feld, gemeinsam gepflegt von allen diesem Kurs zugewiesenen Lehrern und vom Admin.

Da Kurstermine in der App bereits heute nicht als eigene Datensätze existieren — sie werden aus dem hinterlegten Wochentag, den Einstiegsterminen und eventuellen Pausen des Kurses berechnet (siehe Stundenplan/Buchung) — werden Anwesenheit und Notiz direkt über „Kurs + Datum" identifiziert, ohne einen zusätzlichen „Termin"-Datensatz einzuführen.

Die Anwesenheitsliste selbst (wer angezeigt wird) ist **kein gespeicherter Datensatz**, sondern wird bei jedem Aufruf live aus den aktuellen aktiven Abos und bestätigten Buchungen zusammengestellt — nur die tatsächlich vom Lehrer gesetzten Anwesend/Abwesend-Markierungen werden dauerhaft gespeichert.

### C) Tech-Entscheidungen (Begründung)

- **Kurs+Datum statt eigenem Termin-Datensatz:** Vermeidet eine zweite, parallele Terminverwaltung, die mit dem bestehenden Wochentag/Einstiegstermin-Modell synchron gehalten werden müsste.
- **Live berechnete Anwesenheitsliste:** Bleibt automatisch korrekt bei Änderungen an Buchungen, ohne dass der Lehrer die Liste manuell aktualisieren muss.
- **Serverseitige Zugriffsprüfung „zugewiesener Lehrer oder Admin":** Erfüllt die explizite Sicherheitsanforderung aus dem Spec und folgt demselben Absicherungsmuster, das in der gesamten App bereits verwendet wird.
- **Gemeinsame Oberfläche für Lehrer und Admin:** Ein Einstiegspunkt weniger zu pflegen, und Admin sieht garantiert dasselbe wie der Lehrer.

### D) Abhängigkeiten (Pakete)

Keine neuen Fremdpakete nötig.

## Implementation Notes

**Datenbank (Migration `proj13_attendance_and_session_notes`):**
- Neue Tabellen `course_attendance` (composite PK `course_id, customer_id, occurrence_date`) und `course_session_notes` (composite PK `course_id, occurrence_date`) — folgt derselben Konvention wie das bestehende `course_teachers` (reine Zuordnungstabellen ohne eigene surrogate ID).
- **Wichtige, im Architektur-Entwurf noch nicht sichtbare Erkenntnis:** `subscriptions`, `course_bookings` und `profiles` sind RLS-seitig strikt auf „eigene Zeile oder Admin" beschränkt — ein Lehrer kann darüber grundsätzlich **keine** Daten anderer Kunden lesen, auch nicht für die eigenen Kurse. Das betrifft praktisch den gesamten Datenzugriff dieses Features. Beide neuen Tabellen haben deshalb RLS aktiviert, aber **bewusst keine einzige Policy** — jeder Zugriff (lesend wie schreibend) läuft ausschließlich über sechs neue `SECURITY DEFINER`-Funktionen, die jeweils selbst prüfen, ob der Aufrufer für den betroffenen Kurs zugewiesener Lehrer oder Admin ist:
  - `is_course_teacher(p_course_id)` — Hilfsfunktion für die Zuweisungsprüfung, analog zum bestehenden `current_role()`-Muster.
  - `get_course_attendance_roster(p_course_id, p_occurrence_date)` — liefert die live zusammengestellte Anwesenheitsliste (aktive kursgebundene Abos + für das Datum bestätigte Probe-/Drop-in-Buchungen + manuell hinzugefügte Kunden), inklusive Namen — umgeht RLS gezielt, aber nur nach bestandener Zugriffsprüfung.
  - `mark_attendance(...)` — setzt/ändert eine Markierung; lehnt zukünftige Datumswerte serverseitig ab (nicht nur clientseitig gesperrt).
  - `get_course_session_note(...)` / `upsert_session_note(...)` — lesen/schreiben die gemeinsame Termin-Notiz.
  - `list_attendance_eligible_customers()` — für „Kunde hinzufügen"; einzige Funktion in diesem Projekt, die einer **nicht-Admin-Rolle** eine kundenübergreifende Liste (Name, keine E-Mail/Zahlungsdaten) zurückgibt, deshalb mit eigener Rollenprüfung (`teacher` oder `admin`) statt sich auf eine aufrufende Admin-Aktion zu verlassen.
- Alle sechs Funktionen: `anon` explizit gesperrt, nur `authenticated` darf ausführen (Rollenprüfung passiert innerhalb der Funktion) — verifiziert über `get_advisors(security)`, keine unerwarteten Befunde.
- `src/lib/scheduling/dates.ts` um `pastOccurrences()` ergänzt (Gegenstück zum bestehenden `upcomingOccurrences()`) für die „letzte 8 Termine"-Berechnung.

**Server Actions:** `src/lib/actions/teacher/attendance.ts` (`markAttendance`), `src/lib/actions/teacher/notes.ts` (`saveSessionNote`) — beide dünne Wrapper um die jeweilige RPC mit freundlicher Fehlermeldung für den Zukunfts-Fall.

**Zugriffskontrolle:** `src/lib/auth/require-teacher.ts` — `requireTeacher()` (nur Rolle `teacher`, für `/lehrer`) und `requireCourseAccess(courseId)` (zugewiesener Lehrer ODER Admin, für `/lehrer/[courseId]` und `/lehrer/[courseId]/[date]`), analog zum bestehenden `requireAdmin()`.

**Seiten & Komponenten:**
- `/lehrer` (neu) — „Meine Kurse"-Liste, wiederverwendet das Karten-Design aus dem Kurskatalog.
- `/lehrer/[courseId]` (neu) — Terminliste (anstehend + letzte 8 vergangene), leerer Zustand bei fehlendem Wochentermin.
- `/lehrer/[courseId]/[date]` (neu) — Anwesenheitsliste (`AttendanceRoster`) inkl. „Kunde hinzufügen"-Dialog (wiederverwendet das Such-Pattern aus PROJ-22s Kundensuche) + Termin-Notiz (`SessionNoteEditor`). Notizen sind bewusst **nicht** auf vergangene/heutige Termine beschränkt (anders als Anwesenheit) — das erlaubt Unterrichtsplanung im Voraus, ohne dem Spec zu widersprechen (nur Anwesenheit hatte diese explizite Einschränkung).
- Globale Navigation (`site-header.tsx`, `(site)/layout.tsx`): neuer Link „Meine Kurse" für Rolle `teacher`, analog zum bestehenden Admin-Link.
- `/admin/kurse` (`course-manager.tsx`): neuer „Anwesenheit"-Button pro Kurszeile, verlinkt auf dieselbe `/lehrer/[courseId]`-Route — kein separates Admin-UI.

**Live-Verifikation (vor Abschluss von `/frontend`):**
- Direkt per SQL/JWT-Impersonation: Rollenprüfung aller sechs Funktionen (nicht-zugewiesener Lehrer/Kunde abgelehnt, zugewiesener Lehrer und Admin durchgelassen), Zukunfts-Datum-Sperre serverseitig bestätigt.
- Per Browser (temporäre, danach wieder entfernte Testzuweisung auf einen bestehenden Kurs mit Termin+Abo): kompletter Fluss Login → „Meine Kurse" → Kurs → Termin → Anwesenheit markieren → Reload (Persistenz bestätigt) → Notiz speichern (per direkter DB-Abfrage bestätigt) → „Kunde hinzufügen" (Liste korrekt ohne bereits gelistete Kunden). Sicherheitsgrenze doppelt bestätigt: nicht-zugewiesener Kunde per Direkt-URL abgewiesen (Redirect zu `/`), Admin per derselben URL durchgelassen mit identischer Ansicht. Admin-Einstiegspunkt in `/admin/kurse` bestätigt (Anwesenheit-Link pro Zeile vorhanden). Zukunfts-Termin zeigt Sperrhinweis und deaktivierte Buttons.
- `npm run build`, `npm run lint`, `npm test` (116/116) alle grün.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
