# PROJ-23: Admin — Videosätze & Lektionen verwalten (internes Lehrmaterial)

## Status: In Progress
**Created:** 2026-08-13
**Last Updated:** 2026-08-13

## Dependencies
- Requires: PROJ-1 (Supabase Infrastructure Setup) — Admin-Rolle, RLS-Grundmuster
- Requires: PROJ-3 (Admin: Kurse, Levels, Locations & Tanzstile verwalten) — `courses`-Tabelle bekommt neue `video_set_id`-Referenz, ersetzt das bisherige `course_materials.content_video_url`-Feld

## User Stories
- Als Admin möchte ich Videosätze anlegen, bearbeiten und löschen können, damit ich wiederverwendbares Lehrmaterial unabhängig von einzelnen Kursen vorbereiten kann.
- Als Admin möchte ich innerhalb eines Videosatzes mehrere Lektionen mit je einem Titel anlegen, bearbeiten, umsortieren und löschen können, damit die Struktur eines mehrteiligen Kurses (z. B. 8 Einheiten) abgebildet ist.
- Als Admin möchte ich pro Lektion beliebig viele Video-Links hinzufügen und entfernen können, damit auch Lektionen mit mehreren Videos (z. B. Haupt- und Zusatzvideo) abgedeckt sind.
- Als Admin möchte ich einen Videosatz optional einem Level zuordnen können, damit ich beim Kurs-Erstellen schneller den passenden Videosatz finde.
- Als Admin möchte ich beim Anlegen oder Bearbeiten eines Kurses per Dropdown einen bestehenden Videosatz zuweisen können, damit ich nicht mehr manuell einzelne Video-Links pro Kurs pflegen muss.
- Als Lehrer möchte ich die Lektionen und Videos des Videosatzes meiner zugeordneten Kurse einsehen können, damit ich mich auf den Unterricht vorbereiten kann.

## Out of Scope
- Kundenseitige Anzeige dieser Videos — eigenständiges, unabhängiges Feature PROJ-11 (Beispiel-Videos, YouTube-Einbettung); auch wenn beide Features inhaltlich ähnlich klingen, ist PROJ-23 explizit internes Lehrmaterial für Admin/Lehrer, PROJ-11 ist kundenseitiges Marketing-Material
- Automatische Zuordnung eines Videosatzes basierend auf dem Kurs-Level — Auswahl bleibt manuell per Dropdown (auch wenn ein Level-Tag beim Filtern hilft)
- Drag-and-Drop-Umsortierung von Lektionen — einfache Auf/Ab-Reihenfolge reicht im MVP
- Video-Vorschau/Thumbnail-Einbettung im Admin-Bereich — nur Link-Verwaltung, keine Einbettung
- Bulk-Import von Videosätzen (z. B. CSV) — manuelle Pflege reicht bei erwarteter kleiner Anzahl an Videosätzen
- Versionierung/Historie von Videosatz-Änderungen — nicht erforderlich im MVP
- Migration bestehender `course_materials.content_video_url`-Werte in die neue Struktur — zum Zeitpunkt der Refinement-Entscheidung (2026-08-13) gibt es keine produktiven Daten in diesem Feld; falls doch, wird das in `/backend` geprüft

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen der Admin ist eingeloggt, wenn er einen neuen Videosatz mit Namen anlegt, dann erscheint dieser in der Videosatz-Liste
- [ ] Angenommen ein Videosatzname existiert bereits (unabhängig von Groß-/Kleinschreibung), wenn der Admin einen weiteren Videosatz mit demselben Namen anlegen will, dann wird das verhindert und eine verständliche Fehlermeldung angezeigt
- [ ] Angenommen der Admin bearbeitet einen Videosatz, wenn er ihm optional ein Level zuordnet, dann wird dieses Level in der Videosatz-Liste und bei der Auswahl im Kurs-Formular angezeigt
- [ ] Angenommen ein Videosatz ist geöffnet, wenn der Admin eine neue Lektion mit Titel hinzufügt, dann erscheint sie am Ende der Lektionsliste dieses Videosatzes
- [ ] Angenommen eine Lektion hat mehrere Video-Links, wenn der Admin einen weiteren gültigen Video-Link hinzufügt, dann wird dieser der Lektion zugeordnet und in der Liste angezeigt
- [ ] Angenommen ein eingegebener Video-Link ist keine gültige URL, wenn der Admin ihn speichern will, dann wird das verhindert und eine Validierungsfehlermeldung angezeigt
- [ ] Angenommen ein Videosatz hat mehrere Lektionen, wenn der Admin die Reihenfolge über Auf/Ab-Aktionen ändert, dann wird die neue Reihenfolge gespeichert und überall konsistent angezeigt
- [ ] Angenommen ein Videosatz wird noch von mindestens einem Kurs verwendet, wenn der Admin ihn löschen will, dann wird die Löschung verhindert und eine verständliche Fehlermeldung angezeigt
- [ ] Angenommen ein Videosatz wird von keinem Kurs verwendet, wenn der Admin ihn löscht, dann werden auch alle zugehörigen Lektionen und Video-Links entfernt
- [ ] Angenommen der Admin legt einen Kurs an oder bearbeitet ihn, wenn er im Dropdown einen bestehenden Videosatz auswählt, dann wird dieser dem Kurs zugeordnet und gespeichert
- [ ] Angenommen der Admin lässt die Videosatz-Auswahl beim Kurs-Formular leer, wenn er den Kurs speichert, dann wird er trotzdem erfolgreich angelegt (Feld ist optional)
- [ ] Angenommen ein Lehrer ist einem Kurs mit zugeordnetem Videosatz zugeordnet, wenn er die Kursdetails aufruft, dann sieht er alle Lektionen und Video-Links dieses Videosatzes
- [ ] Angenommen ein Lehrer ist einem Kurs NICHT zugeordnet, wenn er versucht, dessen Videosatz-Inhalte abzurufen, dann wird der Zugriff verweigert

## Edge Cases
- Noch keine Videosätze vorhanden → Leerer Zustand mit Hinweis, zuerst einen Videosatz anzulegen; Dropdown im Kurs-Formular zeigt entsprechenden Hinweis statt leerer Liste
- Videosatz ohne Lektionen → darf trotzdem gespeichert und einem Kurs zugewiesen werden (Lektionen können später ergänzt werden)
- Lektion ohne Video-Links → darf trotzdem gespeichert werden (Videos können später ergänzt werden)
- Videosatz wird gelöscht, während ein Admin ihn in einem anderen Tab gerade bearbeitet → kein spezielles Konflikthandling im MVP (Last-Write-Wins), analog zu PROJ-3
- Kurs, dessen zugewiesener Videosatz nachträglich gelöscht werden soll → durch Löschschutz strukturell ausgeschlossen (siehe AC oben)
- Sehr viele Lektionen/Videos in einem Videosatz → kein Pagination-/Performance-Ziel im MVP, bei erwarteter kleiner Datenmenge (einstellige bis niedrige zweistellige Anzahl) nicht relevant

## Technical Requirements (optional)
- Security: Schreibzugriff auf Videosätze/Lektionen/Videos nur für Rolle „admin"; Lesezugriff für Admin sowie für Lehrer, die dem jeweiligen Kurs zugeordnet sind (RLS-Muster wie bisheriges `course_materials`)
- Löschschutz für Videosätze, die noch einem Kurs zugeordnet sind (Fremdschlüssel-Constraint, analog zu Standorten/Räumen/Tanzstilen aus PROJ-3)

## Open Questions
<!-- Unresolved questions from the spec interview. Close them in /refine when answered. -->
- [x] Ist ein Videosatz fest an genau ein Level gebunden? → Nein, mehrere Videosätze pro Level möglich, Level ist ein optionales Tag zur Filterung/Organisation (2026-08-13)
- [x] Ist die Lektionsanzahl pro Videosatz fix (z. B. immer 8)? → Nein, variabel je Videosatz (2026-08-13)
- [x] Feste 1-2-Video-Struktur pro Lektion oder flexible Liste? → Flexible, frei erweiterbare Liste ohne festes Limit (2026-08-13)
- [x] Ist die Videosatz-Auswahl beim Kurs-Erstellen Pflicht? → Nein, optional wie bisher das einzelne Video-Feld (2026-08-13)
- [x] Wer darf die Videosatz-Inhalte sehen? → Admin und die dem jeweiligen Kurs zugeordneten Lehrer (2026-08-13)
- [x] Soll das bisherige `content_video_url`-Feld ersetzt oder parallel behalten werden? → Ersetzt (2026-08-13)
- [x] Löschschutz für Videosätze, die noch einem Kurs zugewiesen sind? → Ja, wie bei Standorten/Räumen/Tanzstilen (2026-08-13)
- [x] Eigener Titel pro Lektion oder nur Nummerierung? → Eigener Titel pro Lektion (2026-08-13)

## Decision Log
<!-- Record of conscious decisions made and why. Added to by /write-spec and /architecture. -->

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Eigenständiges Feature statt PROJ-3-Erweiterung | Neue Datenstruktur (Videosätze → Lektionen → Video-Links) rechtfertigt eigene Spec; analog zur PROJ-22-Abspaltung | 2026-08-13 |
| Klare Abgrenzung zu PROJ-11 (Beispiel-Videos für Kunden) | PROJ-23 ist internes Lehrmaterial für Admin/Lehrer, keine kundenseitige Anzeige; Verwechslungsgefahr trotz ähnlichem Thema bewusst adressiert | 2026-08-13 |
| Videosätze frei benennbar, Level nur optionales Tag statt fixer 1:1-Bindung | Mehr Flexibilität für unterschiedliche Kursvarianten desselben Levels | 2026-08-13 |
| Videosatz-Zuordnung beim Kurs bleibt optional | Konsistent mit bisherigem Verhalten des `content_video_url`-Felds; nicht jeder Kurs hat von Anfang an vorbereitetes Material | 2026-08-13 |
| Videosatz-Name muss eindeutig sein (case-insensitiv) | Verhindert verwirrende Duplikate, analog zum Tanzstile-Fix aus PROJ-3 | 2026-08-13 |
| Lektionen und Video-Links innerhalb eines Videosatzes sind frei editierbar/löschbar, kein Löschschutz auf dieser Ebene | Kurse referenzieren nur den Videosatz als Ganzes, nicht einzelne Lektionen/Videos — Löschschutz nur auf Videosatz-Ebene sinnvoll | 2026-08-13 |
| Löschschutz für Videosätze, die noch von Kursen verwendet werden | Konsistentes Muster mit Standorten/Räumen/Tanzstilen aus PROJ-3 | 2026-08-13 |
| Einfache Auf/Ab-Reihenfolge statt Drag-and-Drop für Lektionen | Ausreichend für MVP, kein zusätzliches Paket/Komplexität nötig | 2026-08-13 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Drei verschachtelte Tabellen (Videosätze → Lektionen → Videos) statt Text-Array-Spalte | Erlaubt individuelle Validierung/Löschung jedes Video-Links, konsistent mit bestehendem Tabellen-Muster (Standorte → Räume) | 2026-08-13 |
| Reihenfolge der Lektionen über einfache Positions-Nummer statt Drag-and-Drop-Bibliothek | Deckt Auf/Ab-Anforderung ab ohne neue Abhängigkeit | 2026-08-13 |
| Fremdschlüssel-Schutz (RESTRICT) von `courses` auf Videosätze | Konsistentes, bewährtes Löschschutz-Muster aus PROJ-1/PROJ-3 | 2026-08-13 |
| Kaskadierendes Löschen von Lektionen/Videos beim Löschen eines (unbenutzten) Videosatzes | Vermeidet verwaiste Datensätze ohne zusätzlichen Aufräum-Code | 2026-08-13 |
| Case-insensitiver Unique-Index auf Videosatz-Namen | Gleiches Muster wie der Tanzstile-Fix aus PROJ-3, verhindert Duplikate | 2026-08-13 |
| RLS-Lesezugriff für Lehrer nur über Join auf `course_teachers` (kein direktes Rollenfeld auf Videosätzen) | Gleiches, bereits etabliertes Muster wie beim bisherigen `course_materials`-Zugriff aus PROJ-3 | 2026-08-13 |
| `course_materials`-Tabelle wird entfernt statt migriert | Keine produktiven Daten vorhanden (siehe Out of Scope); vermeidet zwei parallele Wege für Kurs-Videomaterial | 2026-08-13 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Component Structure
```
App
└── /admin (Admin-Bereich — geschützt: nur Rolle „admin")
    ├── AdminNav (Standorte | Tanzstile | Kurse | Videosätze)
    ├── /admin/videosaetze
    │   ├── Videosatz-Liste (Name, Level-Tag, Anzahl Lektionen, Aktionen)
    │   ├── Videosatz anlegen/bearbeiten (Formular: Name, optionales Level)
    │   └── /admin/videosaetze/[id] — Lektions-Verwaltung für diesen Videosatz
    │       ├── Lektions-Liste (Titel, Anzahl Videos, Auf/Ab-Reihenfolge, Aktionen)
    │       ├── Lektion anlegen/bearbeiten (Formular: Titel)
    │       └── Video-Link-Verwaltung je Lektion (Liste von URLs,
    │           hinzufügen/entfernen direkt im Lektions-Formular)
    └── /admin/kurse
        └── Kurs-Formular bekommt zusätzliches Feld:
            „Videosatz" (optionale Dropdown-Auswahl aus bestehenden Videosätzen,
            ersetzt das bisherige einzelne „Kursinhalt-Video-Link"-Feld aus PROJ-3)
```

### B) Data Model (plain language)
```
Neue Tabelle: Videosätze
├── Name (eindeutig, unabhängig von Groß-/Kleinschreibung)
├── Level (optional, dieselben 5 festen Werte wie bei Kursen)
└── vom Admin über die neue Verwaltungsseite gepflegt

Neue Tabelle: Lektionen
├── Gehört zu genau einem Videosatz
├── Titel
└── Reihenfolge-Nummer (für Auf/Ab-Sortierung)

Neue Tabelle: Videos (pro Lektion)
├── Gehört zu genau einer Lektion
└── Video-Link (URL)

Bestehende Tabelle „courses" (aus PROJ-1/PROJ-3) wird angepasst:
└── Neues Feld „Videosatz": optionaler Verweis auf die neue Videosätze-Tabelle

Entfernt: die bisherige Tabelle „course_materials" (enthielt nur das
einzelne Kursinhalt-Video-Link-Feld aus PROJ-3) — wird durch die neue,
strukturierte Videosatz-Zuordnung ersetzt. Keine produktiven Daten
vorhanden, daher keine Migration nötig.
```

**Löschregel für Videosätze:** Ein Videosatz, der noch bei einem Kurs zugeordnet ist, kann nicht gelöscht werden (gleiches Muster wie Standorte/Räume/Tanzstile aus PROJ-3). Wird ein Videosatz gelöscht, der von keinem Kurs mehr verwendet wird, werden seine Lektionen und Video-Links automatisch mitgelöscht (sie ergeben ohne den Videosatz keinen Sinn mehr).

**Zugriffsregel:** Nur Admins dürfen Videosätze/Lektionen/Videos anlegen, bearbeiten oder löschen. Lesen dürfen Admins uneingeschränkt sowie Lehrer, aber nur für Videosätze, die einem ihrer eigenen zugeordneten Kurse zugewiesen sind — gleiches Prinzip wie beim bisherigen `course_materials`-Zugriff aus PROJ-3.

### C) Tech Decisions (justified for PM)
- **Drei neue, verschachtelte Tabellen (Videosätze → Lektionen → Videos)** statt einer einzelnen Tabelle mit Textliste — erlaubt saubere Validierung jedes einzelnen Video-Links und einfaches gezieltes Löschen/Bearbeiten einzelner Einträge, konsistent mit dem bestehenden Tabellen-Muster der App (z. B. Standorte → Räume aus PROJ-3).
- **Next.js Server Actions** (wie bei PROJ-2/PROJ-3) statt eigener API-Routen — konsistent mit dem Rest der App.
- **Auf/Ab-Reihenfolge über eine einfache Positions-Nummer** statt Drag-and-Drop-Bibliothek — deckt die Anforderung ab, ohne neue Abhängigkeit einzuführen.
- **Datenbank verhindert unerlaubtes Löschen** von Videosätzen, die noch verwendet werden (Fremdschlüssel-Schutz wie in PROJ-1/PROJ-3) statt eigener Prüf-Logik im Code.
- **Automatisches Mitlöschen von Lektionen/Videos** beim Löschen eines (nicht mehr verwendeten) Videosatzes — vermeidet verwaiste Datensätze ohne zusätzlichen Aufräum-Code.
- **Alte `course_materials`-Tabelle wird entfernt statt parallel weitergeführt** — vermeidet zwei parallele, verwirrende Wege, Kurs-Videomaterial zu pflegen.

### D) Dependencies
- Keine neuen npm-Pakete — nutzt ausschließlich bereits vorhandene shadcn/ui-Bausteine (Table, Dialog, AlertDialog, Select, Input, Button), gleiches Muster wie PROJ-3.

## Implementation Notes
_Added by /frontend, 2026-08-13_

**Datenbank-Migration** (`proj23_video_sets_lessons_videos`): drei neue Tabellen `video_sets`, `video_set_lessons`, `video_set_lesson_videos` mit RLS (Schreiben nur Admin; Lesen Admin oder über `course_teachers` zugeordneter Lehrer, per Join von Lektion/Video zurück auf Videosatz → Kurs → Lehrer-Zuordnung). `courses.video_set_id` neu (nullable, `ON DELETE RESTRICT`). Case-insensitiver Unique-Index auf `video_sets.name` direkt von Anfang an korrekt gesetzt (Lehre aus dem Tanzstile-Bug in PROJ-3). Alte Tabelle `course_materials` entfernt.

**Seiten:** `/admin/videosaetze` (Liste), `/admin/videosaetze/[id]` (Lektionsverwaltung) — beide über den bestehenden `requireAdmin()`-Layout-Check geschützt. Admin-Nav um „Videosätze" ergänzt.

**Server Actions** (`src/lib/actions/admin/{video-sets,lessons}.ts`): CRUD für Videosätze und Lektionen inkl. Video-Link-Synchronisierung (Lösch-und-Neuanlage-Muster wie `syncTeachers` aus PROJ-3) und Auf/Ab-Sortierung per Positions-Swap. `courses.ts` angepasst: `content_video_url`-Logik entfernt, `video_set_id` ergänzt.

**Komponenten:** `VideoSetManager`, `LessonManager` (`src/components/admin/video-sets/`) nach etabliertem Tabelle+Dialog-Formular+Lösch-Bestätigung-Muster. `CourseManager` um „Videosatz"-Dropdown erweitert (ersetzt das alte Video-Link-Feld).

### Bugs gefunden und behoben (eigene Tests vor QA-Übergabe)
- **Bug: `useFormField should be used within <FormField>`-Crash beim Öffnen des Lektions-Formulars.** Die „Video-Links"-Sektionsüberschrift nutzte `FormLabel` außerhalb eines `FormField`-Kontexts (identisches Muster wie der bekannte PROJ-3-Bug). Behoben durch einfaches `Label` statt `FormLabel`.
- **Bug: Neue Lektion übernahm fälschlich Video-Links der zuvor bearbeiteten Lektion.** `LessonFormDialog` war (anders als `CourseFormDialog` in PROJ-3) nicht bedingt gerendert, wodurch `useFieldArray` beim Öffnen für eine neue/andere Lektion nicht zuverlässig zurückgesetzt wurde. Behoben durch bedingtes Rendern (`{editing !== null && <LessonFormDialog .../>}`), erzwingt einen sauberen Remount pro Dialog-Öffnung. Live verifiziert: zwei nacheinander angelegte Lektionen mit unterschiedlichen Video-Zahlen zeigen jetzt korrekt getrennte Video-Listen.

**Live end-to-end getestet** (Playwright, echte Supabase-Instanz): Videosatz anlegen inkl. Duplikat-Namens-Ablehnung, Lektionen mit mehreren Video-Links anlegen/bearbeiten, Auf/Ab-Sortierung, Kurs-Zuweisung eines Videosatzes, Löschschutz für zugewiesene Videosätze, RLS-Zugriffsprüfung direkt per SQL (zugeordneter Lehrer sieht Lektionen, nicht zugeordneter Lehrer sieht keine).

**Regressionsprüfung:** `npm test` 13/13 grün, `npm run build` fehlerfrei, PROJ-3-E2E-Suite 6/7 grün (siehe Nachtrag in PROJ-3-Spec zur notwendigen Testanpassung wegen des entfernten Video-Link-Felds; die 7. bekannte Einschränkung ist vorbestehend und unabhängig von PROJ-23).

**Noch nicht umgesetzt:** Eigene E2E-Testdatei für PROJ-23 (folgt in `/qa`), Cross-Browser/Responsive-Tests (folgt in `/qa`).

## Backend Review (2026-08-13)
_Added by /backend_

Fokus: Da Datenbank-Schema, RLS und Server Actions bereits im `/frontend`-Durchgang mechanisch nach dem in `/architecture` abgenommenen Muster umgesetzt wurden (analog zu PROJ-3), bestand dieser Durchgang aus einer gezielten Sicherheits- und Datenintegritäts-Review statt Neuimplementierung.

- **RLS-Policies aller drei neuen Tabellen live geprüft** (`pg_policies`-Abfrage): Schreiben (INSERT/UPDATE/DELETE) ausnahmslos auf `current_role() = 'admin'` beschränkt; Lesen für Admin oder für Lehrer mit passendem `course_teachers`-Eintrag über den jeweiligen Join-Pfad (Video → Lektion → Videosatz → Kurs → Lehrer-Zuordnung) — Policy-Definitionen stimmen exakt mit der Migration überein.
- **Live-Sicherheitstest (nicht nur Code-Review):** Ein temporärer Videosatz mit Lektion und Video wurde angelegt und geprüft, dass sowohl anonyme (`anon`-Rolle) als auch authentifizierte Kunden-Accounts (`role = 'customer'`) **0 Zeilen** sehen — die interne Natur des Lehrmaterials ist RLS-seitig durchgesetzt, nicht nur durch fehlende UI. Ein direkter INSERT-Versuch als Kunden-Account wurde von Postgres mit `42501 row-level security policy violation` korrekt abgelehnt.
- **Server-Actions-Review:** Alle Mutationen (`video-sets.ts`, `lessons.ts`, angepasste `courses.ts`) rufen `requireAdmin()` als erste Zeile auf — Verteidigung in der Anwendungsschicht zusätzlich zur RLS, konsistent mit PROJ-3.
- **`video_set_id` bei Kursen benötigt keine zusätzliche Existenz-Validierung** (anders als `teacher_ids` in PROJ-3): Der Fremdschlüssel-Constraint auf `video_sets(id)` reicht aus, da es — anders bei Lehrern — keine Rollen-Einschränkung gibt, die die Datenbank nicht bereits über den Constraint selbst abdeckt.
- **`moveLessonUp`/`moveLessonDown` geprüft:** Eine nicht zum übergebenen Videosatz gehörende Lektions-ID führt zu einem sicheren No-op (`findIndex` liefert `-1`), keine fehlerhafte Positions-Vertauschung möglich.
- **Security-Advisor erneut geprüft:** Keine neuen Findings durch die PROJ-23-Schema-Änderungen. Verbleibende Hinweise sind weiterhin die bekannten, bewusst akzeptierten aus PROJ-1/PROJ-2.
- `npx tsc --noEmit`, `npm test` (13/13) und `npm run build` laufen fehlerfrei.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
