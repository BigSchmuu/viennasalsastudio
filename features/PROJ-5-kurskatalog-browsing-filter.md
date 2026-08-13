# PROJ-5: Kurskatalog (Browsing & Filter)

## Status: In Progress
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
| Neue RLS-Policy: Lehrer-Profile (Name) öffentlich lesbar, Kunden-Profile bleiben privat | PROJ-5 braucht Lehrer-Namen ohne Login; bestehende `profiles`-Policy erlaubt aktuell nur eigene/Admin-Zugriffe | 2026-08-13 |
| Serverseitiger Einmal-Abruf, clientseitige Filterung (kein erneuter Server-Roundtrip pro Filteränderung) | Ausreichend bei erwartet kleiner Kursanzahl, konsistent mit PROJ-4s Kundensuche | 2026-08-13 |
| Sonner-Toast (`src/components/ui/sonner.tsx`) erstmals in den Root-Layout eingebunden | Bereits im Projekt vorhanden, aber ungenutzt; wird für die „Jetzt buchen"-Hinweismeldung gebraucht | 2026-08-13 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Component Structure
```
App
└── /kurse (öffentliche Route, kein Login nötig)
    ├── Filterleiste (Tanzstil-Dropdown, Level-Dropdown, Standort-Dropdown,
    │   „Filter zurücksetzen"-Button)
    ├── Kurs-Kachel-Grid
    │   └── Kurs-Kachel (Name, Tanzstil-Badge, Level-Badge, Standort,
    │       Lehrer-Namen, „Jetzt buchen"-Button)
    └── Leerer Zustand („Keine Kurse gefunden" bei aktiven Filtern ohne
        Treffer, „Noch keine Kurse vorhanden" wenn der Katalog ganz leer ist)
```

### B) Data Model (plain language)
```
Keine neue Tabelle nötig — der Katalog liest ausschließlich aus bereits
bestehenden Tabellen aus PROJ-1/PROJ-3: Kurse, Tanzstile, Standorte/Räume,
Lehrer-Zuordnungen.

Wichtiger Fund: Lehrer-Namen sind aktuell NICHT öffentlich lesbar. Die
„profiles"-Tabelle (enthält u. a. die Namen) ist bisher nur für den
jeweiligen Nutzer selbst oder für Admins einsehbar — das reicht für PROJ-5
nicht aus, da auch nicht eingeloggte Besucher Lehrer-Namen sehen sollen
sollen.
```

**Neue, gezielte Zugriffsregel nötig:** Lehrer-Profile (Name) werden öffentlich lesbar gemacht — aber ausdrücklich nur für Profile mit der Rolle „Lehrer", nicht für Kunden-Profile. Das ist bewusst anders als der eng begrenzte E-Mail-Lookup aus PROJ-4 (dort ging es um private Kundendaten) — Lehrer-Namen sind für eine Tanzschul-Website typischerweise ohnehin öffentliche Marketing-Information.

### C) Tech Decisions (justified for PM)
- **Serverseitig einmal laden, dann clientseitig filtern** — bei der erwarteten kleinen Kursanzahl (siehe Spec, keine Pagination) reicht ein einmaliger Datenabruf beim Seitenaufruf; die Filter wirken danach sofort ohne weitere Serveranfragen, genau wie bei der Kundensuche aus PROJ-4.
- **Neue, öffentliche Lese-Regel nur für Lehrer-Profile** (Name), nicht für Kunden-Profile — ermöglicht die Lehrer-Anzeige im Katalog, ohne die bestehende Kundendaten-Absicherung aus PROJ-1/PROJ-2 aufzuweichen.
- **Toast-Hinweismeldung für den „Jetzt buchen"-Platzhalter** — die dafür vorgesehene shadcn-Komponente (Sonner) ist im Projekt bereits vorhanden, aber noch nirgends eingebunden; wird für PROJ-5 erstmals in der App aktiviert.
- **Keine neuen Server Actions nötig** — der Katalog ist rein lesend, keine Formulare oder Mutationen.

### D) Dependencies
- Keine neuen npm-Pakete — nutzt ausschließlich bereits vorhandene shadcn/ui-Bausteine (Card, Badge, Select, Button, Sonner-Toast).

## Implementation Notes
_Added by /frontend, 2026-08-14_

**Datenbank-Migration** (`proj5_public_teacher_directory`): neuer View `teacher_directory` (nur `id`+`full_name`, gefiltert auf `role = 'teacher'`), öffentlich lesbar für `anon`/`authenticated`. Bewusst als View statt als RLS-Policy-Änderung auf `profiles` umgesetzt — eine direkte Policy auf Zeilenebene hätte die komplette Zeile (inkl. Telefonnummer, Geburtsdatum) für alle Lehrer-Profile offengelegt, da Postgres-RLS spaltenweise keine Einschränkung erlaubt. Die bestehende `profiles`-RLS bleibt unverändert; der View läuft mit den Rechten seines Eigentümers und umgeht damit gezielt nur für diese zwei Spalten die sonst geltende Sperre.

**Seite:** `/kurse` (öffentlich, kein Login nötig, kein `requireAdmin()`-Check). Lädt Kurse einmal serverseitig (inkl. Tanzstil/Standort/Lehrer-Auflösung über `teacher_directory`), Filterung läuft danach rein clientseitig ohne weitere Serveranfragen.

**Komponente** (`src/components/catalog/course-catalog.tsx`): Filterleiste (3 Selects: Tanzstil/Level/Standort, AND-verknüpft) + Kachel-Grid mit Card-Komponenten. „Jetzt buchen" löst einen Sonner-Toast aus („Buchung ... ist bald verfügbar").

**Sonner-Toaster erstmals aktiviert:** `<Toaster />` in `src/app/layout.tsx` ergänzt — die Komponente existierte im Projekt bereits (`src/components/ui/sonner.tsx`), wurde aber bisher nirgends gemountet.

**Live-Sicherheitstest:** Temporären Lehrer-Testaccount angelegt, einem Kurs zugeordnet, live gegen `anon`-Rolle per SQL geprüft — `teacher_directory` liefert korrekt nur `id`+`full_name`, keine anderen Spalten; direkter Zugriff auf `profiles` bleibt für `anon` weiterhin bei 0 Zeilen (Regressionscheck der bestehenden PROJ-1/2-Absicherung).

**Live end-to-end getestet** (Playwright, echte Supabase-Instanz, echte Produktionsdaten des Nutzers): Katalogseite lädt mit echtem Kurs, Tanzstil-Filter funktioniert, Filter-ohne-Treffer zeigt Leerzustand korrekt, „Jetzt buchen"-Toast erscheint, Lehrer-Name erscheint korrekt nach Zuordnung (vorher „Lehrer wird noch bekanntgegeben").

**Regressionsprüfung:** `npm test` 15/15 grün, `npm run build` fehlerfrei, `/kurse`-Route korrekt in der Routenliste.

**Noch nicht umgesetzt:** Eigene E2E-Testdatei für PROJ-5 (folgt in `/qa`).

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
