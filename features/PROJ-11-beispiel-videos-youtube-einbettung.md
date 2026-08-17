# PROJ-11: Beispiel-Videos (YouTube-Einbettung)

## Status: Planned
**Created:** 2026-08-17
**Last Updated:** 2026-08-17

## Dependencies
- Requires: PROJ-2 (Auth & Kundenprofil) — Kunde muss eingeloggt sein
- Requires: PROJ-5 (Kurskatalog) — der Kurs-Katalog bekommt eine neue, klickbare Detailseite pro Kurs
- Requires: PROJ-8 (Kursbuchung) — „angemeldet" wird über bestehende Abo-Daten bestimmt
- Requires: PROJ-9 (Abo-Verwaltung) — `subscriptions.course_id`/`status` bestimmen, wer Zugriff hat; pausierte Abos zählen nicht
- Requires: PROJ-23 (Admin: Videosätze & Lektionen verwalten) — dieselben Lektionen (`video_set_lessons`) werden um ein Kunden-Video-Feld erweitert; klare Abgrenzung: PROJ-23 = internes Lehrmaterial für Admin/Lehrer, PROJ-11 = kundenseitiges, freigeschaltetes Beispielmaterial

## User Stories
- Als Kunde möchte ich mir zu einem Kurs, für den ich aktiv angemeldet bin, einfache Beispiel-Videos ansehen können, damit ich zuhause üben kann.
- Als Kunde möchte ich diese Videos direkt auf der Seite abspielen können, ohne zu YouTube wechseln zu müssen.
- Als Admin möchte ich zu jeder bestehenden Lektion (aus PROJ-23) zusätzlich ein einfaches Kunden-Video hinterlegen können, ohne eine komplett neue Struktur pflegen zu müssen.
- Als Besucher ohne Anmeldung zu einem Kurs möchte ich trotzdem die grundlegenden Kursinfos auf einer Detailseite sehen können, auch wenn mir die Videos nicht angezeigt werden.

## Out of Scope
- Eigene, von PROJ-23 unabhängige Lektionsstruktur für Kunden-Videos — dieselben Lektionen werden wiederverwendet und um ein Feld erweitert (siehe Decision Log)
- Zugriff für Probestunden-/Drop-in-Buchungen — nur aktive Kurs-Abos (inkl. Flatrate) geben Zugriff, einmalige Buchungen bewusst ausgeschlossen
- Zugriff während einer pausierten Abo-Phase (PROJ-9) — konsequent kein Zugriff während der Pause
- Mehrere Kunden-Videos pro Lektion — genau eines, im Gegensatz zu den mehrteiligen Lehrer-Videos aus PROJ-23
- Öffentliche Sichtbarkeit der Videos für nicht angemeldete Besucher — Kursdetailseite selbst ist öffentlich, der Video-Bereich ausschließlich für angemeldete Kunden
- Hinweistext/Teaser für nicht-berechtigte Besucher im Video-Bereich — der Abschnitt wird komplett weggelassen statt einen Hinweis zu zeigen
- Sonstige neue Inhalte auf der neuen Kursdetailseite über die bestehenden Katalog-Infos hinaus (z. B. Bewertungen, Kommentare) — reine Erweiterung um den Video-Bereich, keine sonstigen neuen Funktionen
- Video-Reihenfolge/-Struktur unabhängig von den Lektionen ändern — folgt exakt der bestehenden Lektions-Reihenfolge aus PROJ-23

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Kurs existiert, wenn ein Besucher im Katalog (`/kurse`) auf die Kurskarte klickt, dann gelangt er auf eine neue Kursdetailseite mit den Kursinfos (unabhängig vom Login-Status)
- [ ] Angenommen ein Kunde ist NICHT eingeloggt oder nicht bei diesem Kurs angemeldet, wenn er die Kursdetailseite ansieht, dann gibt es dort keinen „Videolektionen"-Abschnitt
- [ ] Angenommen ein Kunde hat ein aktives Abo mit Kurs-Bezug auf genau diesen Kurs, wenn er die Kursdetailseite ansieht, dann sieht er den „Videolektionen"-Abschnitt mit allen Lektionen, die ein Kunden-Video hinterlegt haben
- [ ] Angenommen ein Kunde hat ein aktives Flatrate-Abo (kein Kurs-Bezug), wenn er die Detailseite eines beliebigen Kurses ansieht, dann sieht er ebenfalls den „Videolektionen"-Abschnitt für diesen Kurs
- [ ] Angenommen das Abo eines Kunden für diesen Kurs ist pausiert, wenn er die Kursdetailseite ansieht, dann sieht er keinen „Videolektionen"-Abschnitt
- [ ] Angenommen ein Kunde sieht den „Videolektionen"-Abschnitt, wenn er ein Video anschauen möchte, dann wird das YouTube-Video direkt eingebettet auf der Seite abgespielt, ohne zu youtube.com wechseln zu müssen
- [ ] Angenommen ein Admin bearbeitet eine bestehende Lektion in der Videosatz-Verwaltung (PROJ-23), wenn er eine Kunden-Video-URL einträgt und speichert, dann ist dieses Video ab sofort für berechtigte Kunden auf der jeweiligen Kursdetailseite sichtbar
- [ ] Angenommen eine Lektion hat kein Kunden-Video hinterlegt, wenn ein berechtigter Kunde den Videolektionen-Abschnitt ansieht, dann erscheint diese Lektion dort nicht (nur Lektionen mit hinterlegtem Kunden-Video werden gelistet)
- [ ] Angenommen ein Kurs hat keinen Videosatz zugeordnet, wenn ein berechtigter Kunde die Kursdetailseite ansieht, dann gibt es keinen „Videolektionen"-Abschnitt

## Edge Cases
- Kurs hat einen Videosatz, aber keine einzige Lektion hat ein Kunden-Video hinterlegt → Abschnitt wird komplett weggelassen (konsistent mit „kein Videosatz")
- Kunde hat sowohl ein aktives kursgebundenes Abo als auch ein Flatrate-Abo gleichzeitig → Zugriff besteht ohnehin, keine widersprüchliche Situation
- Admin trägt eine ungültige URL als Kunden-Video ein → serverseitige Validierung wie bei den bestehenden Lehrer-Video-URLs aus PROJ-23, Fehlermeldung „Bitte eine gültige URL eingeben"
- Kunde storniert/kündigt sein Abo für diesen Kurs (PROJ-9) → Zugriff verschwindet unmittelbar mit dem Statuswechsel, kein Nachlauf
- Admin entfernt ein Kunden-Video wieder (Feld leeren) → Lektion verschwindet sofort wieder aus dem Kunden-Abschnitt
- Videosatz wird von einem Kurs entfernt (PROJ-23, optionale Zuordnung) → Videolektionen-Abschnitt verschwindet von der Kursdetailseite dieses Kurses

## Technical Requirements (optional)
- Security: Zugriffsprüfung auf Server-Seite (nicht nur UI-seitig ausgeblendet) — ein nicht-berechtigter Kunde darf die Kunden-Video-URLs nicht einmal im Seiten-Quelltext/API-Response sehen können
- Einbettung: YouTube-Videos werden per iframe-Embed eingebunden (responsive, funktioniert auf Mobile/Tablet/Desktop)

## Open Questions
- [ ] Keine offenen Fragen

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Dieselben Lektionen aus PROJ-23 werden um ein Kunden-Video-Feld erweitert, statt eine eigene Struktur aufzubauen | Verhindert, dass Lehrer- und Kunden-Lektionslisten auseinanderlaufen (unterschiedliche Reihenfolge/Anzahl); Admin pflegt beides an einer Stelle | 2026-08-17 |
| Zugriff nur für aktive Abos (kursgebunden oder Flatrate), NICHT für Probestunden-/Drop-in-Buchungen | Videos sind ein Mehrwert für tatsächlich laufende Kursteilnahme, nicht für einmaliges Reinschnuppern; hält den Zugriffs-Check einfach (nur `subscriptions`, keine `course_bookings`-Abfrage nötig) | 2026-08-17 |
| Pausierte Abos verlieren den Zugriff während der Pause | Konsequent zur Bedeutung einer Pause (keine aktive Teilnahme); Zugriff kommt mit Reaktivierung automatisch zurück | 2026-08-17 |
| Genau ein Kunden-Video pro Lektion (statt mehrerer wie bei Lehrer-Videos) | Einfacher zu pflegen, passt zum simplen Charakter des Kunden-Materials (Counts + Musik statt mehrteiliger Erklärung) | 2026-08-17 |
| Neue öffentliche Kursdetailseite (`/kurse/[id]`) als Trägerseite für den Video-Bereich | Es gab bisher keine Detailseite, nur Katalogkarten mit direktem Buchungsdialog; der Video-Bereich braucht einen dauerhaften Ort auf einer eigenen Seite | 2026-08-17 |
| Kursdetailseite selbst bleibt öffentlich, nur der Videolektionen-Abschnitt ist zugriffsbeschränkt | Konsistent mit dem öffentlichen Kurskatalog (PROJ-5); nur die Videos selbst sind der eigentliche Mehrwert für zahlende Kunden | 2026-08-17 |
| Kein Hinweistext/Teaser für nicht-berechtigte Besucher — Abschnitt wird komplett weggelassen | Einfacher und vermeidet unnötige Werbe-Optik auf einer bereits informativen öffentlichen Seite | 2026-08-17 |
| Lektionen ohne Kunden-Video werden im Kunden-Abschnitt übersprungen, nicht als „kein Video" angezeigt | Vermeidet eine verwirrende, halb-leere Liste; Kunde sieht nur, was tatsächlich verfügbar ist | 2026-08-17 |

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
