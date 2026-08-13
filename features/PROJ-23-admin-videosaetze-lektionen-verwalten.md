# PROJ-23: Admin — Videosätze & Lektionen verwalten (internes Lehrmaterial)

## Status: Planned
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

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
