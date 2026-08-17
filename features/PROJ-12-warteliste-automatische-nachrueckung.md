# PROJ-12: Warteliste & automatische Nachrückung

## Status: Planned
**Created:** 2026-08-17
**Last Updated:** 2026-08-17

## Dependencies
- Requires: PROJ-2 (Auth & Kundenprofil) — Kunde muss eingeloggt sein
- Requires: PROJ-3 (Admin: Kurse, Levels, Locations & Tanzstile verwalten) — wird um ein Kapazitäts- und ein Preisfeld pro Kurs erweitert
- Requires: PROJ-7 (SEPA-Lastschriftmandate) — Mandat ist Voraussetzung fürs Eintragen auf die Warteliste
- Requires: PROJ-8 (Kursbuchung) — Warteliste hängt direkt am regulären Anmelde-Flow; Nachrückung erzeugt eine offene Anfrage nach bestehendem Muster, Bestätigungsdialog wird um Preis-Vorbefüllung erweitert
- Requires: PROJ-9 (Abo-Verwaltung Self-Service) — eine wirksame Kündigung ist der häufigste Auslöser für eine Nachrückung

## User Stories
- Als Kunde möchte ich mich für einen vollen Kurs auf die Warteliste setzen lassen, damit ich automatisch nachrücke, sobald ein Platz frei wird.
- Als Kunde möchte ich meine Position auf der Warteliste einsehen und mich bei Bedarf selbst wieder austragen können.
- Als Admin möchte ich pro Kurs eine maximale Teilnehmerzahl und einen festen Preis festlegen können, damit die Warteliste automatisch greift und Anfragen schneller bestätigt werden können.
- Als Admin möchte ich sehen, wer auf der Warteliste eines Kurses steht, und bei Bedarf jemanden manuell entfernen können.
- Als Admin möchte ich, dass ein frei werdender Platz automatisch als neue Buchungsanfrage für den nächsten Wartelisten-Kunden erscheint, damit ich sie nur noch bestätigen muss.

## Out of Scope
- Warteliste für Probestunden/Drop-ins — nur reguläre Kursanmeldungen (siehe Decision Log)
- Vollautomatische Abo-Erstellung ohne Admin-Bestätigung — Admin bestätigt weiterhin jede nachgerückte Anfrage, nur mit vorausgefülltem Preis statt manueller Eingabe
- E-Mail-/Push-Benachrichtigung bei Nachrückung — im Projekt existiert aktuell kein Versand-Mechanismus für sowas, das ist PROJ-16 (Automatische E-Mail-/Push-Benachrichtigungen) vorbehalten; der Kunde sieht die neue offene Anfrage/Bestätigung nur beim nächsten Blick ins eigene Profil
- Manuelles Umsortieren der Wartelisten-Reihenfolge durch Admin — reine FIFO-Reihenfolge nach Eintragungszeitpunkt, keine Priorisierung einzelner Kunden
- Blockieren einer Kapazitätsverringerung unterhalb der aktuellen Belegung — wird erlaubt, nur mit Warnhinweis (siehe Decision Log)
- Warteliste ohne SEPA-Mandat — Mandat ist Voraussetzung fürs Eintragen (siehe Decision Log)
- Tiered/dynamische Preise (z. B. Frühbucherrabatt) — der neue Kurspreis ist ein einzelner fester Betrag pro Kurs

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Kurs hat eine maximale Teilnehmerzahl und die Summe aus aktiven Abos und offenen Anfragen hat dieses Maximum erreicht, wenn ein Kunde eine reguläre Anmeldung versucht, dann wird ihm stattdessen angeboten, sich auf die Warteliste einzutragen
- [ ] Angenommen ein Kunde hat noch kein SEPA-Mandat hinterlegt, wenn er versucht, sich auf die Warteliste einzutragen, dann wird er wie bei einer normalen Anmeldung aufgefordert, zuerst ein Mandat zu hinterlegen
- [ ] Angenommen ein Kunde ist auf der Warteliste eines Kurses eingetragen, wenn er seinen Profilbereich öffnet, dann sieht er den Kurs und seine genaue Position in der Warteliste
- [ ] Angenommen ein Kunde steht auf der Warteliste, wenn er sich selbst austrägt, dann verschwindet der Eintrag sofort und alle nachfolgenden Positionen rücken auf
- [ ] Angenommen ein aktives Abo für einen Kurs mit Warteliste wird wirksam gekündigt oder von Admin gelöscht, wenn dadurch ein Platz frei wird, dann wird automatisch aus dem ersten Wartelisten-Eintrag eine neue offene Buchungsanfrage erzeugt
- [ ] Angenommen Admin lehnt eine offene reguläre Anfrage für einen Kurs mit Warteliste ab, wenn dadurch ein Platz frei wird, dann rückt automatisch der nächste Wartelisten-Eintrag nach
- [ ] Angenommen ein Kurs hat einen festen Preis hinterlegt, wenn eine (auch nachgerückte) offene Anfrage bestätigt wird, dann ist das Preisfeld im Bestätigungsdialog bereits mit diesem Preis vorausgefüllt, bleibt aber änderbar
- [ ] Angenommen Admin öffnet die Wartelisten-Übersicht eines Kurses, dann sieht er alle wartenden Kunden mit Position und Eintragungsdatum und kann einzelne Einträge manuell entfernen
- [ ] Angenommen ein Kunde hat bereits ein aktives Abo oder eine offene Anfrage für einen Kurs, wenn er versucht, sich zusätzlich auf dessen Warteliste einzutragen, dann wird das mit einem entsprechenden Hinweis verhindert
- [ ] Angenommen Admin erhöht die maximale Teilnehmerzahl eines Kurses mit Warteliste, wenn dadurch neue Plätze frei werden, dann rücken automatisch entsprechend viele Wartelisten-Einträge nach

## Edge Cases
- Zwei Kunden versuchen gleichzeitig, sich auf den letzten freien Platz anzumelden → nur einer bekommt den Platz, die Kapazitätsprüfung erfolgt serverseitig und race-condition-sicher zum Zeitpunkt der Anfrage, der andere sieht beim erneuten Versuch die Warteliste-Option
- Admin verringert die maximale Teilnehmerzahl unter die aktuelle Belegung → wird erlaubt, der Kurs zeigt einen „überbelegt"-Hinweis, keine bestehenden Abos werden angetastet
- Derselbe Kunde steht bereits auf der Warteliste für denselben Kurs → doppeltes Eintragen wird verhindert
- Ein nachgerückter Wartelisten-Eintrag wird von Admin abgelehnt → Kunde erhält denselben Status wie bei jeder anderen abgelehnten Anfrage; gleichzeitig prüft das System erneut, ob der nächste Wartelisten-Eintrag nachrücken kann
- Kurs hat kein Kapazitäts-Limit gesetzt (Feld leer) → Warteliste greift nie, Verhalten bleibt exakt wie heute (PROJ-8 unverändert)
- Kunde storniert sein SEPA-Mandat, nachdem er auf der Warteliste steht, aber bevor er nachrückt → Eintrag/nachgerückte Anfrage bleibt bestehen (gleiches Verhalten wie bei jeder offenen regulären Anfrage, PROJ-8 prüft das Mandat auch sonst nicht bei der Bestätigung erneut)

## Technical Requirements (optional)
- Security: Kunde darf ausschließlich eigene Wartelisten-Einträge sehen und verwalten; Admin-Ansicht sowie Kapazitäts-/Preis-Verwaltung nur für Admin zugänglich
- Datenintegrität: Kapazitätsprüfung und Nachrück-Logik müssen race-condition-sicher sein (kein doppeltes Vergeben des letzten Platzes bei gleichzeitigen Anfragen)

## Open Questions
- [ ] Keine offenen Fragen

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Neues Kapazitäts-Feld pro Kurs statt manueller Admin-Markierung „voll" | Ermöglicht automatische, zuverlässige Erkennung von „voll", ohne dass Admin selbst den Überblick behalten muss | 2026-08-17 |
| Aktive Abos + offene Anfragen zählen zusammen zur belegten Kapazität | Verhindert Überbuchung durch mehrere gleichzeitig offene, noch unbestätigte Anfragen | 2026-08-17 |
| Warteliste gilt nur für reguläre Anmeldungen, nicht für Probestunden/Drop-ins | Passt zum Sinn von „Nachrücken" (ein dauerhafter Abo-Platz wird frei); Probestunden/Drop-ins bleiben niedrigschwellig und ohne Kapazitätsprüfung | 2026-08-17 |
| SEPA-Mandat ist bereits beim Eintragen auf die Warteliste nötig | Ermöglicht echte automatische Nachrückung, ohne dass das System auf den Kunden warten muss | 2026-08-17 |
| Nachrückung erzeugt eine offene Anfrage, Admin bestätigt weiterhin (mit vorausgefülltem Preis) | Nutzt den bestehenden, bereits getesteten PROJ-8-Bestätigungsablauf 1:1 weiter; Admin behält die letzte Kontrolle (z. B. für einen Rabatt) | 2026-08-17 |
| Feste Kurspreise werden im Rahmen von PROJ-12 eingeführt (Erweiterung von PROJ-3/PROJ-8) statt als eigenes Feature | Direkt nötig, damit die automatische Nachrückung ohne manuelle Preiseingabe funktioniert; kleiner, eng an dieses Feature gekoppelter Zusatz statt eigenem Spec-Zyklus | 2026-08-17 |
| Kunde sieht seine Warteliste inkl. genauer Position im Profil und kann sich selbst austragen | Konsistent mit dem bestehenden Self-Service-Ansatz aus PROJ-9 | 2026-08-17 |
| Admin bekommt eine Wartelisten-Übersicht pro Kurs mit manueller Entfernen-Möglichkeit | Studio-Betreiber braucht einen Überblick, z. B. bei telefonischen Anfragen zum Austragen | 2026-08-17 |
| Kapazitätsverringerung unter die aktuelle Belegung wird erlaubt, nur mit Warnhinweis | Vermeidet, dass Admin bestehende Kunden zwangsweise entfernen müsste | 2026-08-17 |

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
