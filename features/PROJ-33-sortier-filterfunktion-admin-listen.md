# PROJ-33: Sortier- und Filterfunktion für Admin-Listen

## Status: Planned
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

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
