# PROJ-42: Rechtssichere Buchungsbestätigung

## Status: Planned
**Created:** 2026-08-23
**Last Updated:** 2026-08-23

> **Hinweis:** Dieses Spec beschreibt, was die App leisten soll. Es ersetzt keine
> Rechtsberatung. Die konkreten Texte — AGB, Widerrufsbelehrung — und die Frage, ob damit
> alle Pflichten erfüllt sind, gehören vor der Umsetzung juristisch geprüft.

## Dependencies
- Requires: PROJ-8 (Kursbuchung) — der Buchungsvorgang, der abgesichert wird.
- Requires: PROJ-41 (Preise bei der Kursbuchung) — die Preisangabe vor Vertragsschluss ist Teil
  derselben Informationspflichten und sollte zuerst stehen.
- Requires: PROJ-14 (Events) — Ticketkauf ist ebenfalls ein zahlungspflichtiger Vorgang.

## Ausgangslage
Die App hat eine AGB-Seite und eine Datenschutzerklärung, beide im Fußbereich verlinkt. **An
keiner Stelle wird ihnen zugestimmt** — weder bei der Registrierung noch beim Buchen. Es gibt
keine Widerrufsbelehrung im Buchungsvorgang, und der Absende-Knopf heißt schlicht „Absenden".

## User Stories
- Als Betreiber möchte ich nachweisen können, dass ein Kunde den AGB zugestimmt hat, falls es zu einer Auseinandersetzung kommt.
- Als Betreiber möchte ich die gesetzlichen Informationspflichten erfüllen, ohne bei jeder Buchung selbst daran denken zu müssen.
- Als Kunde möchte ich vor dem Absenden wissen, worauf ich mich einlasse — Preis, Laufzeit, Kündigung, Widerruf.
- Als Kunde möchte ich erkennen, dass eine Buchung zahlungspflichtig ist, bevor ich klicke.
- Als Kunde möchte ich die AGB lesen können, ohne meine Eingaben zu verlieren.

## Out of Scope
- **Inhaltliche Überarbeitung der AGB und der Datenschutzerklärung.** Dieses Feature sorgt dafür, dass zugestimmt wird und die Zustimmung nachweisbar ist — was drinsteht, ist eine juristische Frage.
- **Doppelte Opt-in-Bestätigung per E-Mail** bei der Registrierung.
- **Cookie-Banner / Einwilligungsverwaltung.** Eigenes Thema.
- **Rückwirkende Zustimmung bestehender Kunden.** Wie mit Altbestand umgegangen wird, ist eine Entscheidung außerhalb der App (siehe Open Questions).
- **Automatisierte Widerrufsabwicklung.** Ein Widerruf wird wie heute persönlich abgewickelt.
- **Rechnungs- oder Vertragsdokument als PDF** zum Zeitpunkt der Buchung.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Zustimmung
- [ ] Angenommen ein Kunde füllt den Buchungsdialog aus, wenn er absenden will, dann muss er zuvor aktiv bestätigt haben, dass er AGB und Widerrufsbelehrung zur Kenntnis genommen hat.
- [ ] Angenommen der Kunde hat nicht bestätigt, wenn er auf den Absende-Knopf schaut, dann ist dieser gesperrt.
- [ ] Angenommen der Kunde klickt im Dialog auf „AGB", dann öffnen sie sich, ohne dass seine bisherigen Eingaben verloren gehen.
- [ ] Angenommen ein Häkchen ist bereits vorausgefüllt, dann ist das **nicht** zulässig — die Zustimmung muss vom Kunden selbst gesetzt werden.

### Nachweisbarkeit
- [ ] Angenommen ein Kunde hat zugestimmt, wenn die Buchung gespeichert wird, dann wird festgehalten, **wann** und **welcher Stand** der AGB galt.
- [ ] Angenommen der Betreiber sieht sich eine Buchung in der Verwaltung an, dann erkennt er, ob und wann zugestimmt wurde.
- [ ] Angenommen die AGB werden später geändert, wenn eine alte Buchung angesehen wird, dann bleibt erkennbar, welchem Stand der Kunde damals zugestimmt hat.

### Eindeutige Beschriftung
- [ ] Angenommen eine Buchung ist zahlungspflichtig, wenn der Kunde den Absende-Knopf sieht, dann trägt dieser eine eindeutige Beschriftung im Sinne von „zahlungspflichtig buchen" statt „Absenden".
- [ ] Angenommen eine Buchung ist kostenlos (Probestunde), dann bleibt die Beschriftung neutral — eine Zahlungspflicht darf nicht behauptet werden, wo keine besteht.
- [ ] Angenommen ein Kunde kauft ein Event-Ticket, dann gilt dieselbe Regel.

### Information vor dem Abschluss
- [ ] Angenommen der Kunde steht kurz vor dem Absenden, dann sieht er in unmittelbarer Nähe des Knopfes: Preis, Abrechnungsrhythmus und wie gekündigt werden kann.
- [ ] Angenommen der Kunde bucht ein Abo, dann wird auf das 14-tägige Rücktrittsrecht und dessen Bedingungen hingewiesen.

## Edge Cases
- Was passiert mit Kunden, die vor der Einführung gebucht haben? → Für sie existiert keine Zustimmung. Ob und wie sie nachgeholt wird, ist eine Entscheidung außerhalb der App (siehe Open Questions).
- Was, wenn ein Kunde zustimmt, die Buchung aber fehlschlägt? → Es wird nichts festgehalten; die Zustimmung gehört zur Buchung, nicht zum Klick.
- Was, wenn die AGB geändert werden, während ein Kunde den Dialog offen hat? → Festgehalten wird der Stand, der beim Speichern gilt. Eine Abweichung von Sekunden ist praktisch bedeutungslos, ein falscher Nachweis wäre schlimmer als keiner.
- Was, wenn ein Kunde mehrfach bucht? → Jede Buchung trägt ihre eigene Zustimmung; eine einmalige Zustimmung „für immer" wäre schwächer nachweisbar.
- Gilt das auch für Probestunde und Drop-in? → Die Zustimmung ja, die Zahlungspflicht-Beschriftung nur, wo tatsächlich gezahlt wird.

## Technical Requirements (optional)
- Security: Die Zustimmung muss serverseitig geprüft werden — ein manipulierter Browser darf sie nicht umgehen können.
- Der festgehaltene AGB-Stand muss auch dann noch nachvollziehbar sein, wenn die AGB inzwischen geändert wurden.

## Open Questions
- [ ] Reichen die vorgesehenen Maßnahmen juristisch aus? → **Vor der Umsetzung mit einem Juristen klären.** Dieses Spec beschreibt den technischen Rahmen, nicht dessen rechtliche Beurteilung.
- [ ] Wie wird mit Bestandskunden umgegangen, die nie zugestimmt haben? → Offen; hängt von der juristischen Einschätzung ab.
- [ ] Braucht es eine versionierte AGB (z.B. „Stand 08/2026"), oder genügt ein Zeitstempel? → In `/architecture` entscheiden, sobald die juristische Rückmeldung vorliegt.
- [ ] Gilt das Widerrufsrecht auch, wenn der Kurs innerhalb der 14 Tage beginnt? → Juristische Frage mit Folgen für den Text.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Getrennt von PROJ-41 | Die Preisanzeige kann sofort live gehen; das Rechtliche wartet auf eine juristische Rückmeldung. In einem Spec würde eines das andere blockieren | 2026-08-23 |
| Zustimmung pro Buchung, nicht einmalig beim Konto | Eine einmalige Zustimmung „für immer" wäre bei geänderten AGB schwer nachweisbar; pro Buchung ist eindeutig, was galt | 2026-08-23 |
| Häkchen nicht vorausgefüllt | Eine vorausgewählte Zustimmung ist keine; das ist einer der häufigsten Fehler bei Online-Bestellungen | 2026-08-23 |
| Zahlungspflicht-Beschriftung nur, wo bezahlt wird | Bei einer kostenlosen Probestunde eine Zahlungspflicht zu behaupten, wäre falsch und würde Kunden abschrecken | 2026-08-23 |
| Inhalt der AGB bleibt außen vor | Die App kann dafür sorgen, dass zugestimmt wird — was zugestimmt wird, muss ein Jurist verantworten | 2026-08-23 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|

---

## Tech Design (Solution Architect)
_To be added by /architecture_

---

## Implementation Notes
_To be added by /frontend and /backend_

---

## QA Test Results
_To be added by /qa_

---

## Deployment
_To be added by /deploy_
