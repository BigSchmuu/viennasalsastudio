# PROJ-5: Kurskatalog (Browsing & Filter)

## Status: Planned
**Created:** 2026-08-13
**Last Updated:** 2026-08-13

## Dependencies
- Requires: PROJ-3 (Admin: Kurse, Levels, Locations & Tanzstile verwalten) — liefert die Datenbasis (Kurse, Tanzstile, Standorte, Level) sowie die bereits öffentlich lesbare RLS-Policy auf `courses`

## User Stories
- Als Website-Besucher (auch ohne Login) möchte ich alle angebotenen Kurse durchstöbern können, damit ich mir einen Überblick über das Angebot der Tanzschule verschaffen kann, bevor ich mich registriere.
- Als Kunde möchte ich Kurse nach Tanzstil filtern können, damit ich schnell die für mich interessanten Kurse finde.
- Als Kunde möchte ich Kurse nach Level filtern können, damit ich Kurse finde, die zu meinem Erfahrungsstand passen.
- Als Kunde möchte ich Kurse nach Standort filtern können, damit ich Kurse in meiner Nähe finde.
- Als Besucher möchte ich pro Kurs sehen, welcher Lehrer ihn unterrichtet, damit ich weiß, bei wem ich lerne.

## Out of Scope
- Konkrete Termine/Uhrzeiten pro Kurs (z. B. „Montags 19:00") — eigenes Feature PROJ-6 (Stundenplan & Kalender)
- Tatsächliche Kursbuchung — eigenes Feature PROJ-8 (Kursbuchung); der „Jetzt buchen"-Button ist im MVP nur ein Platzhalter mit Hinweis-Meldung
- Eigene Kurs-Detailseite — alle relevanten Infos werden direkt in der Kachel/Liste angezeigt
- Filter nach Lehrer oder Textsuche nach Kursname — bei erwartet überschaubarer Kursanzahl im MVP nicht nötig
- Anzeige von Lehrmaterial-/Beispiel-Videos im Katalog — separate Features (PROJ-11 Beispiel-Videos für Kunden, PROJ-23 internes Lehrmaterial für Lehrer)
- Paginierung — bei erwartet kleiner Kursanzahl im MVP nicht nötig

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Besucher ist nicht eingeloggt, wenn er den Kurskatalog aufruft, dann sieht er alle Kurse mit Name, Tanzstil, Level, Standort und zugeordneten Lehrern
- [ ] Angenommen ein Kunde ist eingeloggt, wenn er den Kurskatalog aufruft, dann sieht er dieselben Kurse wie ein nicht eingeloggter Besucher
- [ ] Angenommen mehrere Kurse mit unterschiedlichen Tanzstilen existieren, wenn der Nutzer einen Tanzstil-Filter auswählt, dann werden nur Kurse dieses Tanzstils angezeigt
- [ ] Angenommen mehrere Kurse mit unterschiedlichen Levels existieren, wenn der Nutzer einen Level-Filter auswählt, dann werden nur Kurse dieses Levels angezeigt
- [ ] Angenommen mehrere Kurse an unterschiedlichen Standorten existieren, wenn der Nutzer einen Standort-Filter auswählt, dann werden nur Kurse dieses Standorts angezeigt
- [ ] Angenommen mehrere Filter sind gleichzeitig aktiv, wenn die Kombination keine Treffer ergibt, dann wird ein verständlicher Hinweis statt einer leeren, unerklärten Liste angezeigt
- [ ] Angenommen ein Kurs hat keinen zugeordneten Lehrer, wenn er im Katalog angezeigt wird, dann wird das klar erkennbar dargestellt (z. B. „Lehrer wird noch bekanntgegeben") statt eines leeren Felds
- [ ] Angenommen ein Kurs hat kein Level hinterlegt, wenn er im Katalog angezeigt wird, dann wird das klar erkennbar dargestellt statt eines leeren Felds
- [ ] Angenommen ein Nutzer klickt auf „Jetzt buchen" bei einem Kurs, wenn die Buchungsfunktion (PROJ-8) noch nicht verfügbar ist, dann erscheint eine verständliche Hinweis-Meldung, dass die Buchung bald verfügbar ist

## Edge Cases
- Noch keine Kurse vorhanden → Leerer Zustand mit passendem Hinweistext statt leerer Seite
- Aktive Filter-Kombination ohne Treffer → Hinweis „Keine Kurse gefunden" mit Möglichkeit, Filter zurückzusetzen
- Tanzstil/Level/Standort ohne zugeordnete Kurse → erscheint trotzdem als Filteroption (falls administrativ angelegt), führt bei Auswahl zu „Keine Kurse gefunden"
- Kurs mit mehreren zugeordneten Lehrern → alle werden angezeigt (z. B. durch Komma getrennt)
- Sehr viele Kurse gleichzeitig → kein Performance-/Pagination-Ziel im MVP, bei erwarteter kleiner Datenmenge nicht relevant

## Technical Requirements (optional)
- Performance: Katalog muss auch für nicht eingeloggte Besucher performant laden (keine unnötigen Auth-Roundtrips)
- Security: Nur lesender, öffentlicher Zugriff — keine sensiblen Daten (z. B. `video_set_id`-Inhalte) werden im Katalog angezeigt

## Open Questions
<!-- Unresolved questions from the spec interview. Close them in /refine when answered. -->
- [x] Öffentlich oder nur für eingeloggte Kunden? → Öffentlich für alle (2026-08-13)
- [x] Mit oder ohne Zeitplan-Anzeige? → Ohne, das ist PROJ-6 (2026-08-13)
- [x] Welche Filter? → Tanzstil, Level, Standort (2026-08-13)
- [x] Eigene Detailseite? → Nein, alles in der Kachel/Liste (2026-08-13)
- [x] Buchungs-CTA? → Platzhalter-Button, zeigt beim Klick eine Hinweis-Meldung (2026-08-13)

## Decision Log
<!-- Record of conscious decisions made and why. Added to by /write-spec and /architecture. -->

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Kurskatalog öffentlich zugänglich, auch ohne Login | Typisch für Tanzschul-Websites (Marketing/Conversion); `courses` ist laut PROJ-1-RLS bereits öffentlich lesbar | 2026-08-13 |
| Keine Zeitplan-/Terminanzeige in PROJ-5 | Vermeidet doppelte Arbeit — konkrete Termine sind Aufgabe von PROJ-6, `class_sessions` hat noch keine eigene Verwaltung | 2026-08-13 |
| Filter auf Tanzstil, Level, Standort begrenzt | Deckt die naheliegendsten Suchdimensionen ab, ohne bei kleiner Kursanzahl überzudimensionieren | 2026-08-13 |
| Keine eigene Kurs-Detailseite | Alle relevanten Infos passen in die Kachel, spart eine zusätzliche Route/Seite im MVP | 2026-08-13 |
| „Jetzt buchen"-Button als klickbarer Platzhalter mit Hinweis-Meldung | Bereitet die UI auf PROJ-8 vor, ohne echte Buchungslogik vorzuziehen; klickbar mit Meldung statt stummer Deaktivierung, damit Nutzer sofort verstehen, dass die Funktion kommt | 2026-08-13 |

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
