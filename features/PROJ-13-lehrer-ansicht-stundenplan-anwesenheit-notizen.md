# PROJ-13: Lehrer-Ansicht (Stundenplan, Anwesenheit, Notizen)

## Status: Planned
**Created:** 2026-08-17
**Last Updated:** 2026-08-20

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
- Als Lehrer möchte ich die Anwesenheit aller Kursteilnehmer über mehrere Termine hinweg auf einen Blick sehen (statt mich durch jeden Termin einzeln klicken zu müssen), damit ich schnell erkenne, wer regelmäßig kommt und wo noch etwas fehlt.
- Als Lehrer möchte ich am Tag eines stattfindenden Termins die erwarteten Kursteilnehmer direkt einchecken können, ohne vorher navigieren zu müssen, damit das Erfassen während oder kurz nach dem Unterricht schnell geht.
- Als Lehrer möchte ich bei Bedarf manuell einen Kunden zur Anwesenheitsliste hinzufügen, damit auch Flatrate-Kunden oder spontane Teilnehmer erfasst werden, die nicht automatisch gelistet sind.
- Als Lehrer möchte ich pro Kurstermin eine Notiz hinterlegen, damit ich (und ggf. Co-Lehrer desselben Kurses) den Unterrichtsverlauf nachvollziehen können.
- Als Admin möchte ich Anwesenheit und Notizen aller Kurse einsehen und bei Bedarf korrigieren können, damit ich bei Rückfragen oder Lehrerausfall eingreifen kann.

## Out of Scope
- **Vertretungsanfragen/-verwaltung** — eigenständiger Anfrage-/Zusage-Workflow mit Benachrichtigungen, sprengt den Rahmen von PROJ-13. Ein zukünftiges Feature könnte darauf aufbauen (z.B. „Vertretung anfragen"-Button in dieser Lehrer-Ansicht), wird hier aber nicht vorgezogen.
- **Gesamtübersicht aller Kurse** (nicht nur eigene) — bereits durch den bestehenden öffentlichen Stundenplan (PROJ-6) abgedeckt, den auch Lehrer besuchen können; kein neuer Code nötig.
- **Kursübergreifende Anwesenheits-Matrix** (alle eigenen Kurse gleichzeitig auf einer Seite) — bewusst pro Kurs belassen; der Kurs-Auswahlschritt bleibt bestehen, siehe Decision Log (2026-08-20).
- **Zukünftige Termine als gesperrte Vorschau-Spalten in der Matrix** — kein Mehrwert, da für zukünftige Termine ohnehin nichts markierbar ist; die Matrix zeigt nur den heutigen (falls vorhanden) sowie die letzten 8 vergangenen Termine.
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
- [ ] Angenommen ein Lehrer ist einem oder mehreren Kursen zugewiesen, wenn er „Meine Kurse" öffnet, dann sieht er seine Kurse zur Auswahl
- [ ] Angenommen ein Lehrer öffnet einen Kurs mit mindestens einem stattgefundenen Termin, wenn die Anwesenheitsmatrix lädt, dann zeigt sie je Zeile einen erwarteten oder manuell hinzugefügten Kursteilnehmer und je Spalte den heutigen Termin (falls einer stattfindet) sowie die letzten 8 vergangenen Termine dieses Kurses
- [ ] Angenommen ein Kursteilnehmer hat ein aktives kursgebundenes Abo oder eine für ein bestimmtes Datum bestätigte Probestunden-/Drop-in-Buchung, wenn die Matrix lädt, dann ist die entsprechende Zelle in der jeweiligen Termin-Spalte automatisch als „erwartet" vorbefüllt
- [ ] Angenommen ein Lehrer tippt in der Matrix die Zelle eines Kursteilnehmers für den heutigen oder einen vergangenen Termin an, wenn er anwesend oder abwesend markiert, dann wird der Status sofort übernommen und bleibt bei erneutem Aufruf der Seite sichtbar
- [ ] Angenommen ein Kurstermin liegt in der Zukunft, dann erscheint für ihn keine Spalte in der Matrix, da Anwesenheit erst nach dem Termin erfasst werden darf
- [ ] Angenommen ein Lehrer möchte einen Kunden erfassen, der nicht automatisch in der Matrix erscheint (z.B. Flatrate-Kunde), wenn er „Kunde hinzufügen" nutzt und aus allen Kunden mit aktivem Abo oder aktiver Buchung auswählt, dann erscheint eine neue Zeile für diesen Kunden, die der Lehrer in der passenden Termin-Spalte als anwesend markieren kann
- [ ] Angenommen ein Lehrer öffnet über das Notiz-Icon im Spaltenkopf eines Termins den Notiz-Dialog, wenn er eine Notiz einträgt und speichert, dann ist die Notiz für alle diesem Kurs zugewiesenen Lehrer sowie für den Admin sichtbar und bearbeitbar
- [ ] Angenommen ein Lehrer versucht, über eine direkte URL auf einen Kurs zuzugreifen, dem er nicht zugewiesen ist, dann wird der Zugriff verweigert
- [ ] Angenommen ein Admin öffnet die Anwesenheitsmatrix eines beliebigen Kurses, dann kann er dieselben Inhalte wie ein zugewiesener Lehrer einsehen und bearbeiten

## Edge Cases
- Kurs hat noch keinen Wochentermin oder keine Einstiegstermine hinterlegt (wie bei PROJ-8 möglich) → keine Termine zum Markieren vorhanden, Hinweistext statt leerer Matrix
- Kunde storniert seine Probestunde/Drop-in-Buchung, nachdem für diesen Termin bereits Anwesenheit erfasst wurde → die erfasste Zelle bleibt als historischer Eintrag bestehen
- Kunde bucht seine Probestunde auf ein neues Datum um (Umbuchen, PROJ-8) → Anwesenheit bleibt in der Spalte des ursprünglichen Termins bestehen; in der Spalte des neuen Termins erscheint der Kunde erneut automatisch als „erwartet" vorbefüllt — sofern das neue Datum innerhalb der sichtbaren 9 Spalten (heute + letzte 8) liegt; liegt es außerhalb, erscheint die Zelle erst, sobald der Termin in dieses Fenster rückt
- Lehrer wird nachträglich von einem Kurs abgezogen (Admin ändert Kurs-Zuweisung) → verliert sofort den Zugriff auf die gesamte Matrix dieses Kurses; bereits erfasste Daten bleiben für Admin und verbleibende Lehrer erhalten
- Zwei Lehrer bearbeiten gleichzeitig dieselbe Termin-Notiz → letzter Speicherstand gewinnt, kein Konflikt-Handling für MVP
- Kunde hat sowohl ein kursgebundenes Abo als auch eine bestätigte Drop-in-Buchung für denselben Termin → erscheint als eine Zeile mit einer Zelle je Spalte, nicht doppelt
- Kurs mit vielen Kursteilnehmern oder Terminen → Matrix scrollt horizontal bei Bedarf, die Kundennamen-Spalte bleibt beim Scrollen sichtbar (sticky)

## Technical Requirements (optional)
- Security: Zugriff auf Anwesenheit/Notizen eines Kurses ausschließlich für die diesem Kurs zugewiesenen Lehrer (`course_teachers`) und für Admin; serverseitig durchgesetzt, nicht nur UI-seitig verborgen
- Datenintegrität: Anwesenheitsstatus ist pro Kurs, Termin-Datum und Kunde eindeutig (kein Duplikat bei mehrfachem Speichern)
- Mobile/Responsive: Matrix scrollt horizontal bei vielen Terminen; die Kundennamen-Spalte bleibt beim Scrollen sichtbar (sticky)

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
| Anwesenheits-Matrix (Kunden als Zeilen, Termine als Spalten) ersetzt die bisherige Terminliste + separate Termin-Detailseite | Löst die im echten Betrieb aufgetretene Klicktiefe direkt: heutige Spalte dient als Check-in, letzte vergangene Spalte als „letzte Lektion"-Übersicht — beides ohne separaten, redundanten Bereich | 2026-08-20 |
| Scope bleibt pro Kurs, keine kursübergreifende Gesamtmatrix aller eigenen Kurse | Nutzer bevorzugt den bestehenden Kurs-Auswahlschritt beizubehalten statt eine neue kursübergreifende Dashboard-Ebene einzuführen | 2026-08-20 |
| Matrix zeigt nur den heutigen (falls vorhanden) sowie die letzten 8 vergangenen Termine als Spalten, keine zukünftigen Termine als gesperrte Vorschau | Zukünftige Termine bringen keinen Mehrwert, da ohnehin nichts markierbar ist; konsistent mit der bestehenden Regel „Anwesenheit nur für heutige und vergangene Termine" | 2026-08-20 |
| Zellen sind direkt in der Matrix editierbar, kein separater Read-only-Übersichtsmodus | Vermeidet einen zweiten Weg für denselben Zweck; Korrekturen (z.B. Vertipper) sollen ohne Seitenwechsel möglich sein | 2026-08-20 |
| „Kunde hinzufügen" fügt eine kursweite Zeile hinzu statt Kunde + Termin gemeinsam in einem Dialog auszuwählen | Ein Schritt weniger; der Kunde kann danach in jeder passenden Spalte markiert werden, auch bei mehrfacher Anwesenheit über mehrere sichtbare Termine hinweg | 2026-08-20 |
| Termin-Notiz über ein Icon im Spaltenkopf statt einer eigenen Seite/eines eigenen Bereichs | Notizen bleiben termin-gebunden wie bisher, aber ohne Navigationsschritt weg von der Matrix | 2026-08-20 |

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
| Dedizierte Route `/lehrer/[courseId]/[date]` entfällt zugunsten einer einzigen Matrix-Ansicht auf `/lehrer/[courseId]` | Bestehende Roster-/Notiz-Logik (RPCs) bleibt unverändert nutzbar, nur die UI-Struktur ändert sich von „eine Seite pro Termin" zu „eine Matrix über alle sichtbaren Termine" | 2026-08-20 |
| Matrix ruft `get_course_attendance_roster` je sichtbarer Spalte (heute + letzte 8) auf und kombiniert die Ergebnisse clientseitig zu einer Kunden-Zeilen-Struktur | Bestehende RPC-Signatur (`p_course_id, p_occurrence_date`) bleibt unverändert; keine Backend-Änderung nötig, nur zusätzliche parallele Aufrufe statt eines einzelnen | 2026-08-20 |

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

**Tested:** 2026-08-17
**App URL:** http://localhost:3000 (+ direct SQL/RPC verification against the production Supabase project, no staging environment exists)
**Tester:** QA Engineer (AI)

### Method
- Automated: `npm test` (Vitest, incl. 4 new tests for the new `pastOccurrences()` date utility), `npm run test:e2e` (full existing Playwright suite as a regression baseline, plus a new `tests/PROJ-13-lehrer-ansicht-stundenplan-anwesenheit-notizen.spec.ts`).
- Dedicated fixtures created for this feature: course "E2E13 Kurs" (Monday weekly schedule) with two assigned teachers (`e2e13-lehrer-a/b`) and one deliberately unassigned teacher (`e2e13-lehrer-c`, doubles as the "zero courses" empty-state fixture), plus customers covering every roster-source case: active course-bound abo, active flatrate abo (course-independent), confirmed trial booking, confirmed dropin booking, and one customer with **both** an active abo and a confirmed dropin on the same date (for the documented no-duplicates edge case).
- Direct DB/RPC verification via SQL-JWT impersonation (`set local request.jwt.claims`) — chosen specifically because most of this feature's real logic lives in the six new `SECURITY DEFINER` functions, and this technique can exercise authorization boundaries and edge cases deterministically.

### Acceptance Criteria Status
All 10 verified via both direct RPC calls and a real browser session (Playwright).

- [x] **AC1** (Nav-Link „Meine Kurse" für Lehrer): PASS.
- [x] **AC2** (Leerzustand ohne Kurse): PASS.
- [x] **AC3** (Terminliste: anstehend + letzte 8 vergangene): PASS — verified exactly 8 items under "Vergangene Termine".
- [x] **AC4** (Automatische Vorbefüllung): PASS for the course-bound-abo and confirmed-booking sources individually.
- [x] **AC5** (Markieren + Persistenz nach Reload): PASS.
- [x] **AC6** (Zukunfts-Sperre): PASS — verified both the warning text **and** that the Anwesend/Abwesend/„Kunde hinzufügen" buttons are actually `disabled`, not just visually similar. Also verified server-side: `mark_attendance` rejects a future date directly at the RPC level (defense in depth, not just a UI-level lock).
- [x] **AC7** („Kunde hinzufügen" nur aktive Abos/Buchungen): PASS — flatrate customer correctly appears; verified the dialog list excludes customers already on the roster.
- [x] **AC8** (Notiz sichtbar/bearbeitbar für alle zugewiesenen Lehrer): PASS — Lehrer A writes a note, Lehrer B (separate login) sees and successfully overwrites it; `updated_by` correctly tracks the last editor.
- [x] **AC9** (Zugriff auf fremden Kurs verweigert): PASS — verified both at the page level (redirect away from the course) and directly at the RPC level (`not authorized` exception for a teacher not in `course_teachers`).
- [x] **AC10** (Admin sieht/bearbeitet identisch): PASS — verified via the actual `/admin/kurse` → „Anwesenheit" entry point, landing on the exact same route a teacher would use.

### Edge Cases Status
- [x] Kurs ohne Wochentermin → Hinweistext (verified via code path; the empty-state branch is unconditional on `schedule` being null, same code already exercised by AC2's course-list empty state pattern).
- [ ] **Kunde mit Abo UND bestätigter Buchung am selben Termin → BUG-1 (High).** Appears **twice**, not once — see below.
- [x] Buchung storniert nach bereits erfasster Anwesenheit → der Datensatz bleibt bestehen und weiterhin sichtbar (Quelle wechselt korrekt auf „Manuell", da die Person nicht mehr automatisch im aktiven Abo-/Buchungs-Set ist). Verified directly via RPC: cancelled a dropin booking after marking attendance, re-queried the roster, entry persisted with `status: present`, `source: manuell`.
- [x] Probestunde auf neues Datum umgebucht → altes Datum behält die ursprünglich erfasste Anwesenheit (mit `source: manuell`), neues Datum zeigt die Person frisch, unmarkiert. Verified directly via RPC on both dates.
- [x] Lehrer von Kurs entfernt → verliert sofort den Zugriff (RPC lehnt mit `not authorized` ab), Notiz-/Anwesenheitsdaten bleiben für Admin und verbleibende Lehrer unverändert erhalten. Verified directly via RPC.
- [ ] Gleichzeitige Bearbeitung derselben Notiz durch zwei Lehrer — not independently tested (would require two genuinely concurrent requests); the `upsert`-based write (last write wins) matches the documented "no conflict handling" decision by construction, so this is a design guarantee rather than something to empirically race.

### Security Audit Results
- [x] **Authorization is enforced inside the database functions, not just server-side app code or UI.** Confirmed a teacher not assigned to a course gets `not authorized` when calling `get_course_attendance_roster`/`mark_attendance` etc. directly via RPC (bypassing the Next.js app entirely), and that `course_attendance`/`course_session_notes` return **zero rows** on a raw `SELECT` even for the legitimately assigned teacher — RLS has no policies at all, so there is no direct-table-access path around the functions, only the vetted RPCs.
- [x] `list_attendance_eligible_customers()` (the one function in this project granted to a non-admin role for cross-customer data) correctly rejects a plain `customer` role caller.
- [x] **XSS:** stored an `<img src=x onerror="window.__xss=true">` payload as a session note, reloaded the page — payload rendered as inert plain text inside the `<textarea>`, `window.__xss` never set, no JS dialog fired. No `dangerouslySetInnerHTML` anywhere in the new components.
- [x] SQL injection: not applicable — all six new functions take typed parameters via PostgREST RPC calls (no dynamic/string-concatenated SQL anywhere in the new functions).
- [ ] **Low, informational:** `upsert_session_note`'s `note` column has no length limit at the database layer — the 2000-character cap only exists in the Next.js action's Zod validation, so a teacher/admin calling the RPC directly could store an arbitrarily large note. Not exploitable by an unauthenticated or non-privileged party, and not a realistic DoS vector for a single row — noting for completeness rather than filing as a blocking bug.
- [x] `get_advisors(security)` clean — all six new functions appear only under the expected, already-accepted `authenticated_security_definer_function_executable` WARN category.
- [x] `get_advisors(performance)` — only the same class of pre-existing INFO-level "unindexed FK" notices already present throughout this schema (e.g. `course_bookings`, `invoices`); nothing new or elevated.

### Regression Testing
Ran the full existing Playwright suite as a baseline. **Zero `chromium` failures** — all failures were the same pre-existing, environment-only missing-WebKit-binary issue already documented during PROJ-12's QA (`Mobile Safari` project can't run without `npx playwright install webkit`), unrelated to any code in this repo. `npm test`: 120/120 pass (116 existing + 4 new). Spot-checked the components this feature directly touches:
- `site-header.tsx` / `(site)/layout.tsx` (added the teacher nav link): existing nav-related tests (PROJ-24) passed in the full run.
- `course-manager.tsx` (added the "Anwesenheit" action): existing PROJ-3 course-management tests passed in the full run.
- `dates.ts` (added `pastOccurrences`, did not modify `upcomingOccurrences`): existing `upcomingOccurrences` tests unaffected, confirmed via the full Vitest run.

**Conclusion: no regressions caused by PROJ-13.**

### Bugs Found — fixed (2026-08-17)

#### BUG-1: Customer with both an active subscription and a confirmed booking for the same date appears twice on the attendance roster — FIXED
- **Severity:** High
- **Steps to Reproduce:**
  1. As admin, give a customer both an active course-bound subscription for a course AND a confirmed trial/dropin booking for the exact same upcoming/past date of that course (documented as a real, if narrow, scenario in the spec's own edge cases).
  2. As the assigned teacher, open that course's termin view for that date.
  3. Expected (per the spec's explicit edge case): the customer appears once.
  4. Actual: the customer appears **twice** — once with the "Abo" badge, once with the "Buchung" badge — each with its own independent Anwesend/Abwesend button pair.
- **Root cause:** `get_course_attendance_roster`'s `expected` CTE combines the abo-sourced and booking-sourced customer lists with a plain SQL `UNION`, which only de-duplicates identical `(customer_id, source)` pairs. Since the two branches deliberately produce *different* `source` values for the same `customer_id`, the union doesn't collapse them into one row.
- **Impact:** confusing/broken UI (the same person shown as two separate roster entries), not a data-integrity issue — both entries write to the exact same `course_attendance` primary key (`course_id, customer_id, occurrence_date`), so marking one doesn't create a duplicate database row; a teacher clicking both independently would just have the second click overwrite the first.
- **Fix applied:** `get_course_attendance_roster` now ranks the three sources by priority (`abo` > `buchung` > `manuell`) in a `UNION ALL`, then picks exactly one row per `customer_id` via `DISTINCT ON (customer_id) ... ORDER BY customer_id, priority`, instead of relying on a plain `UNION` across differently-shaped rows. Re-verified: the same fixture customer (active abo + confirmed dropin, same date) now appears exactly once (with the `abo` source, correctly prioritized). Full `tests/PROJ-13-...spec.ts` suite re-run: 11/11 pass, including the previously-failing edge-case test. `get_advisors(security)` re-checked clean; `npm run build`/`lint`/`test` all green.
- **Priority:** Fix before deployment — directly contradicts a named, spec'd edge case with clear reproduction steps.

### Summary (post-fix)
- **Acceptance Criteria:** 10/10 pass.
- **Bugs Found:** 1 (High) — **fixed and re-verified**. 1 Low-severity informational security note remains (note field has no DB-level length cap; not blocking).
- **Security:** authorization boundaries (RLS-zero-policy + in-function checks) hold up under direct RPC bypass attempts; XSS on the free-text note field confirmed safe; no SQL injection surface.
- **Regressions:** none — full existing suite green on `chromium` (Mobile Safari gap is a pre-existing, unrelated environment issue).
- **Production Ready:** **YES.**
- **Recommendation:** Ready for `/deploy`.

## Deployment

**Production URL:** https://viennasalsastudio.vercel.app
**Deployed:** 2026-08-17
**Commits:** `d32ee82` (frontend) → `73de756` (QA) → `98263ad` (BUG-1 fix, this deploy)

### Pre-Deployment Checks
- `npm run build`, `npm run lint`, `npm test` (120/120): all clean.
- QA: Approved, 0 Critical/High bugs remaining (BUG-1 fixed and re-verified — see QA Test Results above).
- No new environment variables needed for this feature.
- No secrets committed.
- DB migrations: both applied directly to the production Supabase project during `/frontend`/`/qa` (`proj13_attendance_and_session_notes`, `proj13_fix_roster_duplicate_bug`) — no separate migration step needed at deploy time.
- All code committed and pushed to `main`.

### Deploy
- Pushed to `main` → Vercel auto-deploy fired correctly and completed successfully (confirmed via the GitHub commit status API going `pending` → `success`).

### Post-Deployment Verification
- Production loads: `/`, `/kurse` return 200; `/lehrer`, `/admin/kurse` correctly redirect (307) when logged out.
- **Verified live in production, authenticated as a real teacher fixture:** logged in as `e2e13-lehrer-a`, confirmed the "Meine Kurse" nav link, navigated to the course's termin view, and confirmed the full roster renders correctly — critically, **"E2E13 Kombi Kunde" (the BUG-1 repro case) now appears exactly once** with the correctly-prioritized "Abo" source, matching the fix.
- No new environment variables, no auth/DB connection changes — no new failure surface introduced there.

### Production-Ready Essentials
Already covered by earlier deployments in this project (error tracking, security headers, etc.); nothing new required for this feature.
