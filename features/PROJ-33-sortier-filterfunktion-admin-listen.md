# PROJ-33: Sortier- und Filterfunktion für Admin-Listen

## Status: In Progress
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

**Fortschritt: 1/5 Listen umgesetzt (Kundenliste). Buchungsliste, Kursliste, Rechnungsliste-Sortierung und Lastschriftlauf-Liste stehen noch aus.**

Neuer gemeinsamer Baustein `src/components/admin/sortable-header.tsx` (`SortableHeader`): liest den aktuellen Sortier-Zustand selbst aus der URL (`useSearchParams`), kein Props-Threading durch die Seiten nötig. Wird als Ersatz für einzelne `<TableHead>`-Zellen sortierbarer Spalten eingesetzt.

**Kundenliste** (`src/components/admin/customers/customer-list.tsx`, `src/app/admin/kunden/page.tsx`): Suche von rein clientseitig auf das URL-Parameter-Muster der Rechnungsliste umgestellt (`q`, Button-Submit). Neuer Status-Filter (`status`-Param, sofort navigierend bei Auswahl) mit den Werten Aktiv/Pausiert/Gekündigt/Kein Abo. Neue Spalten „Status" (Badge, wiederverwendet `subscriptionStatusColor`) und „Erstellt am" (sortierbar, `profiles.created_at`). Name-Spalte jetzt ebenfalls sortierbar. Status-Ableitung bei mehreren Abos folgt der beschlossenen Priorität Aktiv > Pausiert > Gekündigt > Kein Abo. Filterung/Sortierung läuft serverseitig im Page-Loader (kein Client-seitiges Nachfiltern von bereits geladenen Daten mehr).

**Verifikation:** `npm run build`/`npm run lint` sauber. Live geprüft: Sortierung per Klick ändert URL (`sort=name&dir=asc` → `dir=desc` bei erneutem Klick) und tatsächliche Zeilenreihenfolge; Status-Filter „Aktiv" zeigt ausschließlich „Aktiv"-Badges und bleibt nach Reload über die URL erhalten; „Kein Abo"-Filter zeigt ausschließlich Kunden mit 0 Abos; leere Trefferliste zeigt „Keine Kunden gefunden." statt leerer Tabelle; 375px-Ansicht ohne horizontales Scrollen.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
