# PROJ-33: Sortier- und Filterfunktion für Admin-Listen

## Status: In Review
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Dependencies
- PROJ-4 (Admin: Kunden-/Mitgliederverwaltung) — Kundenliste
- PROJ-10 (Rechnungsarchiv) — Rechnungsliste
- PROJ-8 (Kursbuchung) — Buchungsliste
- PROJ-3 (Admin: Kurse, Levels, Locations & Tanzstile verwalten) — Kursliste
- PROJ-7 (SEPA-Lastschriftmandate & Sammel-Einzug) — Lastschriftlauf-Liste

## User Stories
- Als Admin möchte ich in einer Admin-Liste (Kunden, Rechnungen, Buchungen, Kurse, Lastschriftläufe) auf eine Spaltenüberschrift klicken, um danach zu sortieren, damit ich schneller finde, was ich suche.
- Als Admin möchte ich die Kundenliste nach Abo-Status filtern (u.a. „Nur aktive Kunden"), damit ich schnell sehe, wer aktuell aktiv ist.
- Als Admin möchte ich weitere sinnvolle Filter auf den übrigen Listen (Buchungstyp, Kurslevel/-tanzstil, Lastschriftlauf-Status) haben, damit ich nicht durch lange Listen scrollen muss.

## Out of Scope
- Gespeicherte/benutzerdefinierte Filteransichten („Views") — nur Ad-hoc-Filter fürs MVP
- Mehrspaltiges Sortieren — Sortierung erfolgt immer nach genau einer Spalte
- Export gefilterter/sortierter Daten — der bestehende Rechnungsexport (PROJ-10) bleibt unverändert und ist nicht Teil dieser Spec

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen der Admin ist in der Kundenliste, wenn er auf eine Spaltenüberschrift (Name, Erstellt am) klickt, dann wird die Liste danach sortiert; ein erneuter Klick kehrt die Reihenfolge um
- [ ] Angenommen der Admin ist in der Kundenliste, wenn er den Filter „Nur aktive Kunden" aktiviert, dann werden nur Kunden mit mindestens einem Abo im Status „aktiv" angezeigt
- [ ] Angenommen der Admin ist in der Kundenliste, wenn er nach Status filtert (Aktiv/Pausiert/Gekündigt/Kein Abo), dann werden nur passende Kunden angezeigt
- [ ] Angenommen der Admin ist in der Rechnungsliste, wenn er auf eine Spaltenüberschrift (Datum, Betrag, Kunde) klickt, dann wird die Liste entsprechend sortiert
- [ ] Angenommen der Admin ist in der Buchungsliste, wenn er nach Buchungstyp (Regulär/Probestunde/Drop-in) filtert oder eine Spalte anklickt, dann wird gefiltert bzw. sortiert
- [ ] Angenommen der Admin ist in der Kursliste, wenn er nach Level oder Tanzstil filtert oder eine Spalte anklickt, dann wird gefiltert bzw. sortiert
- [ ] Angenommen der Admin ist in der Lastschriftlauf-Liste, wenn er nach Status filtert oder eine Spalte anklickt, dann wird gefiltert bzw. sortiert
- [ ] Angenommen ein Filter ergibt 0 Treffer, wenn die Liste angezeigt wird, dann erscheint ein Leerzustand mit Hinweis statt einer leeren Tabelle
- [ ] Angenommen der Admin hat einen Filter aktiv, wenn er die Seite neu lädt, dann bleibt der Filter erhalten (z.B. über URL-Parameter)

## Edge Cases
- Sehr lange Listen (z.B. > 500 Kunden): Sortierung/Filterung muss serverseitig erfolgen und darf nicht auf bereits im Client geladene Daten beschränkt sein, um die Performance zu sichern — analog zum bestehenden Muster der Rechnungsliste.
- Mehrere Filter gleichzeitig aktiv (z.B. Status + Suche) müssen kombiniert (UND-Verknüpfung) wirken, nicht sich gegenseitig überschreiben.

## Technical Requirements (optional)
- Filter-/Sortier-Zustand wird über URL-Parameter gehalten (Server-Roundtrip), analog zum bestehenden Muster der Rechnungsliste.

## Open Questions
- Keine offenen Fragen zum Zeitpunkt der Spec-Erstellung. Reihenfolge der Umsetzung (welche Liste zuerst) kann bei `/architecture` priorisiert werden.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Eine gemeinsame Spec für alle 5 Admin-Listen, inkrementelle Umsetzung möglich | User-Entscheidung: konsistentes Sortier-/Filter-Muster ist wichtiger als isolierte Einzel-Features | 2026-08-21 |
| Filter-Zustand über URL-Parameter statt nur Client-State | Folgt dem bereits etablierten Muster der Rechnungsliste (PROJ-10); bleibt bei Reload erhalten und ist teilbar | 2026-08-21 |
| Kein Views-/Speicher-Feature fürs MVP | Reduziert Scope, kann bei Bedarf später ergänzt werden | 2026-08-21 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Neuer gemeinsamer Baustein für sortierbare Spaltenüberschriften und ein generalisiertes URL-Parameter-Filtermuster, statt 5 separater Insellösungen | Repo-weite Suche bestätigt: aktuell existiert nirgends eine sortierbare Spalte, nicht mal in der Rechnungsliste; die Rechnungsliste hat zwar schon ein URL-Parameter-Filtermuster, aber keine Sortierung — beides wird als gemeinsamer, wiederverwendbarer Baustein neu gebaut, um Konsistenz über alle 5 Listen zu sichern (User-Entscheidung aus der Spec) | 2026-08-21 |
| Dropdown-Filter wenden sich sofort an (bei Auswahl → URL-Navigation), Freitextsuche behält das bestehende „erst bei Klick auf Filtern"-Verhalten der Rechnungsliste | Bei einer diskreten Auswahl (Dropdown) gibt es keinen Tastendruck-pro-Zeichen-Effekt, der eine Navigation bei jeder Eingabe rechtfertigen würde nachzudenken; bei Freitext würde sofortiges Navigieren bei jedem Buchstaben stören — das bestehende Verhalten der Rechnungsliste bleibt für Text bewusst erhalten | 2026-08-21 |
| Kundenliste: Status-Priorität bei mehreren Abos ist Aktiv > Pausiert > Gekündigt > Kein Abo | User-bestätigt, konsistent mit der bereits etablierten PROJ-32-Definition von „aktiver Kunde" | 2026-08-21 |
| Kundenliste: bestehende clientseitige Sofortsuche wird auf das URL-Parameter-Muster umgestellt | User-Entscheidung: Konsistenz mit dem neuen Status-Filter (beide bleiben bei Reload erhalten) und mit dem Performance-Grundsatz der Spec (serverseitig bei langen Listen) | 2026-08-21 |
| Lastschriftlauf-Status wird neu abgeleitet („Vollständig eingezogen" / „Mit Rückbuchungen"), nicht gespeichert | Es existiert heute kein Status-Feld auf einem Lastschriftlauf; der Status wird aus den zugehörigen Positionen berechnet (mindestens eine Position mit gesetztem `bounced_at` → „Mit Rückbuchungen") — kein neues Datenbankfeld nötig | 2026-08-21 |
| Kursliste: Level-Filter nutzt die bereits bestehende `levelOptions`-Liste, Tanzstil-Filter liest die vorhandenen `dance_styles`-Einträge | Beide Wertelisten existieren bereits im Projekt (Level als festes Enum, Tanzstil als eigene Tabelle) — keine neue Datenquelle nötig | 2026-08-21 |
| Vorgeschlagene Umsetzungsreihenfolge fürs `/frontend`: Kundenliste zuerst, danach Rechnungsliste (nur Sortierung ergänzen), dann Buchungsliste, Kursliste, Lastschriftlauf-Liste | Kundenliste enthält die im Spec-Interview explizit geforderte „Nur aktive Kunden"-Filterung (höchster Business-Wert); Rechnungsliste hat bereits die meiste Filter-Infrastruktur und braucht nur Sortierung; die Spec erlaubt ausdrücklich inkrementelle Umsetzung | 2026-08-21 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Component Structure (Visual Tree)

```
Neue gemeinsame Bausteine (werden in allen 5 Listen verwendet)
├── Sortierbare Spaltenüberschrift
│   — klickbarer Spaltentitel mit Pfeil-Icon für die aktuelle Richtung
│   — ein erneuter Klick auf dieselbe Spalte kehrt die Richtung um
└── Filter-Leiste
    — Dropdown-Filter wenden sich sofort an (bei Auswahl)
    — Freitextsuche behält das „erst bei Klick auf Filtern"-Verhalten der Rechnungsliste
    — „Filter zurücksetzen" räumt alle aktiven Filter auf einen Blick weg

Kundenliste (/admin/kunden)
├── Neuer Status-Filter: Alle / Aktiv / Pausiert / Gekündigt / Kein Abo
├── Bestehende Namenssuche, jetzt über die Filter-Leiste (URL-basiert statt clientseitig)
└── Sortierbare Spalten: Name, Erstellt am

Rechnungsliste (/admin/rechnungen)
├── Bestehende Datum-/Namenssuche bleibt unverändert
└── NEU: sortierbare Spalten Datum, Betrag, Kunde

Buchungsliste (/admin/buchungen)
├── Neuer Filter: Buchungstyp (Regulär / Probestunde / Drop-in)
└── Sortierbare Spalten: Kunde, Kurs, Termin

Kursliste (/admin/kurse)
├── Neue Filter: Level, Tanzstil
└── Sortierbare Spalten: Name, Level

Lastschriftlauf-Liste (/admin/lastschriften)
├── Neuer Status-Filter: Alle / Vollständig eingezogen / Mit Rückbuchungen
└── Sortierbare Spalten: Fälligkeitsdatum, Gesamtbetrag, Erstellt am

Jede Liste zeigt bei 0 Treffern einen Leerzustand-Hinweis statt einer leeren Tabelle.
```

### B) Data Model (plain language)

```
Keine neuen Tabellen. Zwei bestehende Abfragen müssen erweitert werden,
alle anderen Listen brauchen nur eine andere Sortierung/Filterung der
bereits geladenen Felder:

Kundenliste:
- Die Abo-Abfrage lädt zusätzlich den Status jedes Abos (nicht nur die Anzahl)
- Daraus wird pro Kunde ein einziger „Status" abgeleitet:
  Aktiv (mind. ein aktives Abo) > Pausiert > Gekündigt > Kein Abo

Lastschriftlauf-Liste:
- Für jeden Lauf wird zusätzlich geprüft, ob mindestens eine seiner
  Positionen zurückgebucht wurde (bestehendes Feld, bisher nur auf
  Positionsebene sichtbar)
- Daraus wird ein Lauf-Status abgeleitet: „Vollständig eingezogen"
  oder „Mit Rückbuchungen" — kein neues Datenbankfeld, reine Berechnung

Sortierung und Filterung laufen bei allen 5 Listen serverseitig (nicht
im Browser auf bereits geladenen Daten), damit auch sehr lange Listen
performant bleiben.

Gespeichert in: bestehende Tabellen unverändert. Der aktuelle Filter-/
Sortier-Zustand jeder Liste steht in der URL (z.B. ?status=aktiv&sort=name&dir=asc),
nicht in einer neuen Datenbank-Tabelle.
```

### C) Tech Decisions (justified for PM)

- **Ein gemeinsamer Baustein statt fünf Einzellösungen:** Die Rechnungsliste hat bereits ein URL-Parameter-Filtermuster, aber keine der 5 Listen hat eine sortierbare Spalte. Ein einziger, wiederverwendbarer „Sortierbare Spalte"-Baustein plus ein generalisiertes Filter-URL-Muster stellt sicher, dass sich alle 5 Listen gleich anfühlen und künftige Listen dasselbe Muster einfach übernehmen können.
- **URL-Parameter statt reinem Bildschirm-Zustand:** Ein Filter bleibt beim Neuladen der Seite erhalten und ist per Link teilbar (z.B. „schau dir mal alle pausierten Kunden an" als Link verschickbar) — das war bereits in der ursprünglichen Spec so festgelegt und wird jetzt auf Sortierung erweitert.
- **Dropdowns navigieren sofort, Freitext erst auf Klick:** Vermeidet, dass bei jedem eingegebenen Buchstaben eine neue Serveranfrage losgeht, behält aber die sofortige Rückmeldung bei einer einfachen Auswahl.
- **Zwei abgeleitete Status-Werte statt neuer Datenbankfelder:** Sowohl der Kunden-Status als auch der Lastschriftlauf-Status lassen sich vollständig aus bereits vorhandenen Daten berechnen (Abo-Status je Kunde, Rückbuchungs-Flag je Position) — das vermeidet Datenbank-Änderungen und stellt sicher, dass der Status nie „veraltet", weil er nie gespeichert, sondern immer live berechnet wird.
- **Inkrementelle Umsetzung, Kundenliste zuerst:** Die Spec erlaubt ausdrücklich, die 5 Listen nacheinander umzusetzen. Die Kundenliste deckt den im Interview am stärksten gewünschten Anwendungsfall ab („Nur aktive Kunden") und wird deshalb zuerst gebaut.

### D) Dependencies (packages to install)

- Keine neuen Pakete nötig — nutzt ausschließlich bereits vorhandene shadcn/ui-Komponenten (Select, Input, Button, Table) und die in Next.js eingebaute `searchParams`-Mechanik, die die Rechnungsliste bereits verwendet.

## Implementation Notes (Frontend)

**Fortschritt: 5/5 Listen umgesetzt (Kundenliste, Rechnungsliste-Sortierung, Buchungsliste, Kursliste, Lastschriftlauf-Liste). Frontend-Implementierung vollständig.**

Neuer gemeinsamer Baustein `src/components/admin/sortable-header.tsx` (`SortableHeader`): liest den aktuellen Sortier-Zustand selbst aus der URL (`useSearchParams`), kein Props-Threading durch die Seiten nötig. Wird als Ersatz für einzelne `<TableHead>`-Zellen sortierbarer Spalten eingesetzt.

**Kundenliste** (`src/components/admin/customers/customer-list.tsx`, `src/app/admin/kunden/page.tsx`): Suche von rein clientseitig auf das URL-Parameter-Muster der Rechnungsliste umgestellt (`q`, Button-Submit). Neuer Status-Filter (`status`-Param, sofort navigierend bei Auswahl) mit den Werten Aktiv/Pausiert/Gekündigt/Kein Abo. Neue Spalten „Status" (Badge, wiederverwendet `subscriptionStatusColor`) und „Erstellt am" (sortierbar, `profiles.created_at`). Name-Spalte jetzt ebenfalls sortierbar. Status-Ableitung bei mehreren Abos folgt der beschlossenen Priorität Aktiv > Pausiert > Gekündigt > Kein Abo. Filterung/Sortierung läuft serverseitig im Page-Loader (kein Client-seitiges Nachfiltern von bereits geladenen Daten mehr).

**Verifikation:** `npm run build`/`npm run lint` sauber. Live geprüft: Sortierung per Klick ändert URL (`sort=name&dir=asc` → `dir=desc` bei erneutem Klick) und tatsächliche Zeilenreihenfolge; Status-Filter „Aktiv" zeigt ausschließlich „Aktiv"-Badges und bleibt nach Reload über die URL erhalten; „Kein Abo"-Filter zeigt ausschließlich Kunden mit 0 Abos; leere Trefferliste zeigt „Keine Kunden gefunden." statt leerer Tabelle; 375px-Ansicht ohne horizontales Scrollen.

**Rechnungsliste** (`src/components/admin/invoices/invoice-list.tsx`, `src/app/admin/rechnungen/page.tsx`): Bestehende Datum-/Namenssuche-Filter unverändert. Neu sortierbare Spalten Datum, Kunde, Betrag — Sortierung läuft serverseitig via Supabase `.order()` (Kunde sortiert über die verknüpfte `profiles`-Tabelle mittels `foreignTable`-Option). Filtern-Button und Sortier-Klick bewahren jeweils den Zustand des anderen (Sortierung übersteht einen Filter-Submit und umgekehrt), „Filter zurücksetzen" erscheint jetzt auch, wenn nur eine Sortierung (aber kein Text-/Datumsfilter) aktiv ist, und setzt auch diese zurück.

**Verifikation Rechnungsliste:** `npm run build`/`npm run lint` sauber. Live geprüft: Betrag-Sortierung liefert aufsteigende Beträge; Kunde-Sortierung funktioniert (Standard-DB-Zeichenkettensortierung, keine „natürliche" Zahlensortierung — für die Spec ausreichend); ein bereits gesetzter Datumsfilter bleibt nach einem Sortier-Klick in der URL erhalten und umgekehrt.

**Buchungsliste** (`src/components/admin/bookings/booking-manager.tsx`, `src/app/admin/buchungen/page.tsx`): Neuer Buchungstyp-Filter (Regulär/Probestunde/Drop-in, sofort navigierend), neue sortierbare Spalten Kunde, Kurs, Termin (Kunde/Kurs sortiert über die jeweils verknüpfte Tabelle via `foreignTable`). Unterschiedliche Leerzustands-Texte für „noch keine Buchungen überhaupt" vs. „nichts zu diesem Filter gefunden".

**Bug gefunden und behoben:** Der Typ-Filter änderte zwar korrekt die URL und der Server lieferte auch korrekt gefilterte Daten (bestätigt per direkter Seitennavigation), aber die sichtbare Tabelle blieb nach einem Klick im Dropdown unverändert. Ursache: `BookingManager` hält seine Zeilen in `useState(initialBookings)` für die optimistischen Updates nach Bestätigen/Ablehnen — `useState`-Startwerte werden bei neuen Props aber nicht automatisch aktualisiert, da die Komponente bei einer reinen URL-Änderung eingehängt bleibt (dasselbe Muster wie die bereits dokumentierte „Client state / prop sync"-Falle). Behoben mit einem `useEffect`, der den lokalen Zustand bei jeder Änderung von `initialBookings` neu synchronisiert — die optimistischen Updates bleiben dabei unangetastet funktionsfähig.

**Verifikation Buchungsliste:** `npm run build`/`npm run lint` sauber. Live geprüft (inkl. Bug-Reproduktion und Nachweis der Korrektur): Filter „Probestunde" zeigt ausschließlich Probestunden-Zeilen, bleibt nach Reload erhalten; Sortierung nach Termin bewahrt einen aktiven Typ-Filter in der URL.

**Kursliste** (`src/components/admin/courses/course-manager.tsx`, `src/app/admin/kurse/page.tsx`): Neuer Level-Filter (`level`-Param, wiederverwendet die bestehenden `levelOptions`) und Tanzstil-Filter (`dance_style`-Param), beide sofort navigierend bei Auswahl, plus „Filter zurücksetzen"-Button. Neue sortierbare Spalten Name und Level. Level-Sortierung nutzt bewusst nicht die alphabetische Reihenfolge, sondern `levelValues.indexOf()` für die pädagogische Progression (Beginner → Improver → Intermediate → Advanced → Open Level), da eine alphabetische Sortierung der rohen Enum-Strings eine sinnlose Reihenfolge ergäbe. Unterschiedliche Leerzustands-Texte für „noch keine Kurse überhaupt" vs. „nichts zu diesem Filter gefunden". `CourseManager` hält keinen `useState(initialCourses)` für die Kursliste selbst (nur für andere, unabhängige UI-Zustände wie offene Dialoge) — daher war die aus der Buchungsliste bekannte Prop-Sync-Falle hier proaktiv geprüft und ausgeschlossen, kein erneuter Fix nötig.

**Verifikation Kursliste:** `npm run build`/`npm run lint` sauber. Live geprüft: Level-Filter „Beginner" filtert die Tabelle korrekt und bleibt nach Reload über die URL erhalten; Tanzstil-Filter setzt `dance_style`-Param korrekt; „Filter zurücksetzen" entfernt beide Params; Name-Sortierung togglet `dir=asc`/`dir=desc` per Klick; Level-Sortierung liefert nachweislich die pädagogische Reihenfolge und keine alphabetische; gefilterte Leerliste zeigt „Keine Kurse gefunden." (getestet auf Chromium — Mobile-Safari-Browser-Binary lokal nicht installiert, daher nur auf Chromium verifiziert, konsistent mit Umgebungslimitierung).

**Lastschriftlauf-Liste** (`src/components/admin/sepa/collection-run-list.tsx`, `src/app/admin/lastschriften/page.tsx`): Neuer Status-Filter (`status`-Param: Alle/Vollständig eingezogen/Mit Rückbuchungen), sofort navigierend. Der Lauf-Status wird rein aus den geladenen `sepa_collection_items.bounced_at`-Werten abgeleitet (mindestens eine Position mit gesetztem `bounced_at` → „Mit Rückbuchungen"), kein neues Datenbankfeld. Neue sortierbare Spalten Fälligkeitsdatum, Gesamtbetrag, Erstellt am — da Status und Gesamtbetrag abgeleitete/aggregierte Werte sind (nicht direkt per Supabase `.order()` sortierbar), laufen Filterung und Sortierung serverseitig in JS im Page-Loader, analog zur Kundenliste. `CollectionRunList` hielt bereits keinen `useState(initialRuns)` für die Laufliste selbst (nur lokalen Formular-Zustand für „neuer Lauf"), daher keine Prop-Sync-Falle zu beheben. Differenzierter Leerzustand „Keine Lastschriftläufe gefunden." bei aktivem Filter.

**Verifikation Lastschriftlauf-Liste:** `npm run build`/`npm run lint` sauber. Live geprüft: Status-Filter „Vollständig eingezogen" setzt und persistiert den URL-Param nach Reload; „Filter zurücksetzen" entfernt ihn wieder; Gesamtbetrag-Sortierung togglet `dir=asc`/`dir=desc` per Klick; Fälligkeitsdatum-Sortierung liefert eine nachweislich chronologisch korrekte Reihenfolge; gezielter End-to-End-Nachweis der Status-Ableitung — eine Position wurde live über „Als rückgebucht markieren" markiert, der Lauf wechselte daraufhin in der Liste sichtbar auf „Mit Rückbuchungen", danach zurückgesetzt, um die Fixture-Daten unverändert zu lassen (getestet auf Chromium, gleiche Umgebungslimitierung wie Kursliste).

**Damit ist die Frontend-Implementierung für alle 5 Listen abgeschlossen.**

**Bugfixes nach QA (2026-08-21):**
- **BUG-1** (Level/Tanzstil-Label-Kollision): Filter-Labels in `course-manager.tsx` von „Level"/„Tanzstil" auf „Level filtern"/„Tanzstil filtern" umbenannt, damit sie sich vom gleichnamigen Feld im „Neuer Kurs"-Dialog unterscheiden. Zusätzlich die zwei betroffenen PROJ-3-Regressionstests auf `{ exact: true }` umgestellt, da Playwright's `getByLabel()` standardmäßig Teilstring-Matching betreibt und „Level filtern"/„Tanzstil filtern" sonst weiterhin als Treffer für eine Suche nach „Level"/„Tanzstil" zählen würden.
- **BUG-2** (unvalidierter `dance_style`-Parameter): `src/app/admin/kurse/page.tsx` umstrukturiert — die Tanzstil-Liste wird jetzt vor der Kurs-Abfrage geladen, `dance_style` wird gegen diese geladene Liste validiert (analog zu `level` gegen `levelValues`) und nur bei einem echten Treffer als Filter angewendet; ein ungültiger Wert wird jetzt still ignoriert statt einen Datenbankfehler zu verursachen.
- **BUG-3** (Placeholder-Text): Suchfeld-Placeholder in `customer-list.tsx` zurück auf „Suche nach Name oder E-Mail…" geändert. Zusätzlich beim erneuten Testen festgestellt, dass der zugehörige PROJ-4-Regressionstest noch von der alten *live* (tastendruck-basierten) Suche ausging — dies war durch PROJ-33s bewusste, architektur-genehmigte Umstellung der Kundenliste auf Submit-basierte Suche (Klick auf „Filtern") ohnehin überholt, unabhängig vom Placeholder-Text. Test entsprechend um den `Filtern`-Klick ergänzt.
- Alle drei Fixes live verifiziert (inkl. eines gezielten Tests, dass ein weiterhin gültiger `dance_style`-Wert korrekt filtert) sowie durch erneuten Lauf der betroffenen PROJ-3-, PROJ-4- und PROJ-33-Suiten bestätigt (`npm run build`/`npm run lint` sauber).
- Bei der Verifikation zusätzlich zwei **vorbestehende, PROJ-33-unabhängige** Fixture-Pollution-Fälle beobachtet (nicht behoben, da außerhalb des Scopes dieser drei Bugs): der PROJ-3-Test „Kurs anlegen mit Lehrer" erzeugt bei wiederholten Läufen eine doppelte „E2E Salsa Kurs (erneut bearbeitet)"-Zeile (Test hat keine Selbstbereinigung), und der PROJ-4-Test „Kein Abo vorhanden" setzt voraus, dass „E2E4 Test Kunde" 0 Abos hat, was nach einem vorherigen erfolgreichen Lauf nicht mehr zutrifft (Test legt ein Abo an, löscht es aber nie wieder). Beide sind durch die wiederholten QA-Testläufe in dieser Session sichtbar geworden, nicht durch PROJ-33-Code verursacht.

## QA Test Results

**Tested:** 2026-08-21
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: Kundenliste — Sortierung (Name, Erstellt am) mit Richtungsumkehr
- [x] Klick auf Name/Erstellt-am-Spaltenüberschrift sortiert die Liste; erneuter Klick kehrt die Richtung um (verifiziert per URL `dir=asc`→`dir=desc` und tatsächlicher Zeilenreihenfolge)

#### AC-2: Kundenliste — Filter "Nur aktive Kunden"
- [x] Status-Filter „Aktiv" zeigt ausschließlich Kunden mit mindestens einem aktiven Abo

#### AC-3: Kundenliste — Status-Filter (Aktiv/Pausiert/Gekündigt/Kein Abo)
- [x] Alle vier Status-Werte filtern korrekt (Aktiv und „Kein Abo" stichprobenartig per E2E geprüft, Pausiert/Gekündigt per Code-Review der `deriveStatus`-Priorität Aktiv > Pausiert > Gekündigt > Kein Abo bestätigt)

#### AC-4: Rechnungsliste — Sortierung (Datum, Betrag, Kunde)
- [x] Betrag-Sortierung liefert nachweislich aufsteigende Werte; Datum/Kunde-Sortierung nutzt validiertes `SORTABLE_COLUMNS`-Allowlist-Pattern

#### AC-5: Buchungsliste — Buchungstyp-Filter und Sortierung
- [x] Typ-Filter „Probestunde" zeigt ausschließlich passende Zeilen; Sortier-Klick bewahrt einen aktiven Typ-Filter in der URL

#### AC-6: Kursliste — Level-/Tanzstil-Filter und Sortierung
- [x] Level-Filter „Beginner" filtert korrekt; Sortier-Klick bewahrt den aktiven Filter in der URL
- [ ] BUG-1: Level- und Tanzstil-Filter-Labels kollidieren mit gleichnamigen Feldern im „Neuer Kurs"/„Kurs bearbeiten"-Dialog (siehe Bugs Found)
- [ ] BUG-2: Ungültiger `dance_style`-Parameter erzeugt einen stillen Datenbankfehler statt ignoriert zu werden (siehe Bugs Found)

#### AC-7: Lastschriftlauf-Liste — Status-Filter und Sortierung
- [x] Status-Filter „Vollständig eingezogen" filtert korrekt; Gesamtbetrag-Sortierung togglet Richtung; End-to-End-Nachweis der Status-Ableitung (Rückbuchung markieren → Status wechselt live auf „Mit Rückbuchungen")

#### AC-8: Leerzustand bei 0 Treffern
- [x] Alle 5 Listen zeigen einen Text-Hinweis statt einer leeren Tabelle bei 0 Treffern (explizit per E2E für Kundenliste geprüft, für die übrigen 4 Listen per Code-Review der identischen `length === 0`-Ternary-Struktur bestätigt)

#### AC-9: Filter bleibt nach Reload erhalten (URL-Parameter)
- [x] Status- und Sortier-Parameter bleiben nach `page.reload()` erhalten (Kundenliste E2E-geprüft; Muster ist identisch über alle 5 Listen, da derselbe `SortableHeader`-Baustein und dieselbe `useSearchParams`-basierte Filter-Logik verwendet wird)

### Edge Cases Status

#### EC-1: Sehr lange Listen — serverseitige Sortierung/Filterung
- [x] Alle 5 Listen filtern/sortieren im Page-Loader (Server Component), nicht im bereits geladenen Client-State — per Code-Review aller 5 `page.tsx`-Dateien bestätigt

#### EC-2: Mehrere Filter gleichzeitig (UND-Verknüpfung)
- [x] Status-Filter + Suche auf der Kundenliste wirken kombiniert, nicht gegenseitig überschreibend (E2E geprüft)

### Security Audit Results
- [x] Authentication: `/admin/*` ohne Login → Redirect zu `/login` (durch `requireAdmin()` im Layout, unverändert durch PROJ-33)
- [x] Authorization: Keine rollenspezifische Umgehung über URL-Parameter gefunden — Filter-/Sortier-Params beeinflussen nur WHERE/ORDER-Klauseln auf bereits rollengeprüften Abfragen
- [x] Input validation (Injection): Alle Such-/Filter-Params werden entweder gegen eine feste Allowlist geprüft (`SORTABLE_COLUMNS`, `isValidType`, `isValidLevel`, `isValidStatus`) oder laufen als reine In-Memory-JS-Vergleiche (kein Roh-SQL-String-Aufbau irgendwo) — kein SQL-Injection-Vektor gefunden
- [x] XSS: Alle Filter-/Suchwerte werden ausschließlich über kontrollierte React-Inputs und `.toLocaleString()`/Text-Interpolation gerendert, keine `dangerouslySetInnerHTML`-Verwendung in den geänderten Dateien
- [ ] BUG-2 (Robustheit, kein Injection-Risiko): `dance_style`-Parameter wird vor der Verwendung in `.eq()` nicht validiert (im Unterschied zu `level`, `type`, `sort`, `status`) — siehe Bugs Found

### Regression Testing
- `npm test` (Vitest): 175/175 bestanden
- Volle E2E-Regressionssuite für alle 5 betroffenen Feature-Bereiche (PROJ-3, PROJ-4, PROJ-7, PROJ-8, PROJ-10) erneut ausgeführt. 16 Fehlschläge traten auf; nach Einzelanalyse jedes Fehlschlags:
  - **2 echte, durch PROJ-33 verursachte Regressionen** (BUG-1, unten) — beide auf der Kursliste, beide durch die neuen Filter-Labels „Level"/„Tanzstil"
  - **1 durch PROJ-33 verursachte Test-Breakage ohne Nutzer-Auswirkung** (BUG-3, unten) — geänderter Placeholder-Text auf der Kundenliste
  - **13 vorbestehende, nicht mit PROJ-33 zusammenhängende Fehlschläge** — durchgehend zurückgeführt auf Fixture-Datenakkumulation aus wiederholten Testläufen gegen die Live-Datenbank ohne Staging-Umgebung (z.B. doppelte Rechnungen/Kunden-Links aus einer bereits vor PROJ-33 gemergten Funktion „Kundennamen verlinken", eine „Kein Abo"-Fixture, die zwischenzeitlich ein Abo erhalten hat, ein Lastschriftlauf-Testszenario, dessen „keine passenden Kunden"-Vorbedingung durch akkumulierte Fixture-Kunden nicht mehr zutrifft) — dies ist ein bereits bekanntes, dokumentiertes Projektmuster (kein Staging, siehe Projekt-Memory) und liegt außerhalb des Scopes dieser Feature-QA
- Neue permanente E2E-Suite `tests/PROJ-33-sortier-filterfunktion-admin-listen.spec.ts` (10 Tests, alle 9 ACs + 1 Edge Case): 10/10 bestanden
- Responsive-Check bei 375px auf allen 5 Listen: kein horizontales Scrollen (`scrollWidth === clientWidth` auf jeder Seite)

### Bugs Found

#### BUG-1: Level- und Tanzstil-Filter kollidieren im Accessible-Name mit dem Kurs-Formular
- **Severity:** High
- **Steps to Reproduce:**
  1. Als Admin zu `/admin/kurse` navigieren
  2. Per Screenreader/Tastatur oder einem auf Accessible-Name basierenden Tool (z.B. `getByLabel("Level")`) das Feld „Level" ansteuern → zwei Treffer (Level-Filter der Filter-Leiste UND das Level-Feld im „Neuer Kurs"-Formular, sobald geöffnet)
  3. Gleiches gilt für „Tanzstil"
  4. Erwartet: Jedes Formularfeld auf der Seite hat einen eindeutigen Accessible Name
  5. Tatsächlich: Zwei unabhängige Formularelemente („Level"-Filter-Select und „Level"-Feld im Kurs-Dialog; „Tanzstil"-Filter-Select und „Tanzstil"-Feld im Kurs-Dialog) tragen exakt denselben Namen — bricht `getByLabel()`-basierte Interaktion zuverlässig (reproduzierbar in den bestehenden PROJ-3-Regressionstests „Tanzstil anlegen und sofort im Kurs-Formular verfügbar" und „Kurs anlegen mit Lehrer") und verletzt das Eindeutigkeits-Prinzip für Accessible Names (WCAG 4.1.2 / Screenreader-Nutzbarkeit)
- **Root Cause:** `src/components/admin/courses/course-manager.tsx` — neue Filter-Leiste nutzt `<Label>Level</Label>` (Zeile ~170) und `<Label>Tanzstil</Label>` (Zeile ~189), identisch zu den bereits bestehenden `<FormLabel>Level</FormLabel>` (Zeile ~482) und `<FormLabel>Tanzstil</FormLabel>` (Zeile ~457) im Kurs-Anlegen/Bearbeiten-Dialog auf derselben Seite
- **Priority:** Fix before deployment

#### BUG-2: Ungültiger `dance_style`-URL-Parameter erzeugt stillen Datenbankfehler statt ignoriert zu werden
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Als Admin zu `/admin/kurse?dance_style=not-a-valid-uuid` navigieren (z.B. über einen manuell bearbeiteten/kaputten Link)
  2. Erwartet: Ungültiger Filterwert wird ignoriert (analog zum bereits validierten `level`-Parameter, der über `isValidLevel` geprüft wird) und die volle Kursliste erscheint
  3. Tatsächlich: Die Liste zeigt 0 Kurse mit dem Hinweis „Keine Kurse gefunden." — der zugrundeliegende Supabase/PostgREST-Query-Fehler (ungültiges UUID-Format) wird verschluckt (`coursesRes.data ?? []`), sodass ein Datenbankfehler fälschlich wie ein legitimes leeres Filterergebnis aussieht
- **Root Cause:** `src/app/admin/kurse/page.tsx` Zeile 29: `if (params.dance_style) coursesQuery = coursesQuery.eq("dance_style_id", params.dance_style);` — im Unterschied zu `level` (validiert gegen `levelValues`) wird `dance_style` ungeprüft übernommen. Kein Sicherheitsrisiko (Supabase parametrisiert den Wert, keine SQL-Injection möglich), aber irreführendes UX-Verhalten bei einem kaputten/manipulierten Link
- **Priority:** Fix before deployment

#### BUG-3: Placeholder-Text der Kundenliste-Suche geändert, bricht bestehenden PROJ-4-Regressionstest
- **Severity:** Low
- **Steps to Reproduce:**
  1. PROJ-4-Regressionstest „Kundenliste zeigt Name und E-Mail; Suche filtert korrekt" ausführen
  2. Erwartet: Test findet das Suchfeld über `getByPlaceholder(/Suche/)`
  3. Tatsächlich: Timeout — der Placeholder wurde im Rahmen von PROJ-33 von einem „Suche"-haltigen Text auf „Name oder E-Mail…" geändert; das zugehörige `<Label>Suche</Label>` existiert weiterhin und die Funktion selbst ist für echte Nutzer unverändert nutzbar
- **Root Cause:** `src/components/admin/customers/customer-list.tsx` — Such-Input-Placeholder wurde bei der URL-Parameter-Umstellung umformuliert, ohne den bestehenden PROJ-4-Test entsprechend anzupassen
- **Priority:** Fix in next sprint (kein Nutzer-Impact, nur Testschulden — entweder Placeholder zurückändern oder den PROJ-4-Test auf `getByLabel("Suche")` umstellen)

### Summary
- **Acceptance Criteria:** 9/9 funktional erfüllt (AC-6 mit 2 begleitenden Bugs, siehe oben)
- **Bugs Found:** 3 total (0 critical, 1 high, 1 medium, 1 low)
- **Security:** Pass — keine Injection-/Auth-Bypass-Risiken; BUG-2 ist ein Robustheits-, kein Sicherheitsproblem
- **Production Ready:** NO
- **Recommendation:** BUG-1 (High) und BUG-2 (Medium) vor dem Deployment beheben — beide sind lokal auf die Kursliste begrenzt und sollten mit `/frontend` schnell behebbar sein (BUG-1: Filter-Labels umbenennen, z.B. „Level filtern"/„Tanzstil filtern", oder `sr-only`-Label + sichtbarer Text-Unterschied; BUG-2: `dance_style` analog zu `level` gegen die geladene `danceStyles`-Liste validieren). BUG-3 kann parallel oder danach erledigt werden. Die 13 vorbestehenden, unabhängigen Fixture-Drift-Fehlschläge blockieren dieses Feature nicht, sollten aber separat vom Projektinhaber zur Kenntnis genommen werden (wiederkehrendes Muster, siehe Projekt-Memory zu fehlender Staging-Umgebung).

## Deployment
_To be added by /deploy_
