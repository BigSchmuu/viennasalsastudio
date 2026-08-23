# PROJ-41: Preise bei der Kursbuchung

## Status: Planned
**Created:** 2026-08-23
**Last Updated:** 2026-08-23

## Dependencies
- Requires: PROJ-8 (Kursbuchung) — der Buchungsdialog, in dem die Preise erscheinen.
- Requires: PROJ-3 (Admin: Kurse verwalten) — dort steht der Preis je Kurs.
- Verwandt: PROJ-42 (Rechtssichere Buchungsbestätigung) — baut auf der hier eingeführten
  Preisanzeige auf; die Preisangabe vor Vertragsschluss ist Teil der Informationspflichten.

## User Stories
- Als Kunde möchte ich beim Buchen sehen, was mich das Abo kostet, statt es erst auf der ersten Rechnung zu erfahren.
- Als Kunde möchte ich Kursabo und Flatrate nebeneinander vergleichen können, um zu erkennen, ab wann sich die Flatrate lohnt.
- Als Studierende:r möchte ich meinen ermäßigten Preis sehen, bevor ich buche.
- Als Betreiber möchte ich Standardpreise an einer Stelle pflegen, statt sie bei jedem Kurs einzeln einzutragen.
- Als Betreiber möchte ich für einzelne Kurse vom Standardpreis abweichen können, ohne alle anderen zu berühren.

## Out of Scope
- **Bezahlung im Dialog.** Es bleibt beim bestehenden Ablauf: Anfrage stellen, Betreiber bestätigt, Einzug per SEPA.
- **Rabattcodes in der Preisanzeige.** Der Gutscheincode (PROJ-15) wird weiterhin separat eingegeben; die Kachel zeigt den Grundpreis, nicht den rabattierten.
- **Preisänderungen für bestehende Abos.** Ein laufendes Abo behält seinen Preis; eine Änderung der Standardpreise wirkt nur auf neue Buchungen.
- **Preishistorie.** Es wird nicht festgehalten, was ein Preis früher einmal war.
- **Nachweis des Studierendenstatus.** Wie beim Drop-in bleibt es bei der Selbstauskunft.
- **AGB-Zustimmung, Widerrufsbelehrung, Button-Beschriftung** — eigenes Thema, siehe PROJ-42.
- **Preise für Events.** Die haben ihre eigenen Felder (PROJ-14) und bleiben unberührt.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Preise pflegen
- [ ] Angenommen der Admin öffnet die Stelle, an der er heute die Drop-in-Preise pflegt, dann findet er dort zusätzlich vier Felder: Kursabo normal, Kursabo Studierende, Flatrate normal, Flatrate Studierende.
- [ ] Angenommen der Admin ändert einen dieser Preise und speichert, wenn ein Kunde anschließend den Buchungsdialog öffnet, dann sieht er den neuen Preis.
- [ ] Angenommen der Admin trägt einen negativen oder unrealistisch hohen Betrag ein, wenn er speichert, dann wird die Eingabe abgelehnt und der bisherige Wert bleibt erhalten.
- [ ] Angenommen der Admin ändert einen Standardpreis, wenn danach ein bestehendes Abo abgerechnet wird, dann bleibt dessen Preis unverändert.

### Kurs-Einzelpreis
- [ ] Angenommen ein Kurs hat keinen eigenen Preis, wenn ein Kunde ihn bucht, dann gilt der Standardpreis für Kursabos.
- [ ] Angenommen der Admin trägt bei einem Kurs einen eigenen Preis ein, wenn ein Kunde diesen Kurs bucht, dann gilt dieser Preis statt des Standards — bei allen anderen Kursen ändert sich nichts.
- [ ] Angenommen ein Kurs hat einen eigenen Preis, wenn der Admin ihn wieder leert, dann gilt für diesen Kurs wieder der Standardpreis.

### Anzeige im Buchungsdialog
- [ ] Angenommen ein Kunde öffnet die Anmeldung zu einem Kurs, dann sieht er zwei Kacheln — „Nur diesen Kurs" und „Flatrate (alle Kurse)" — je mit Preis pro Monat und kurzer Erläuterung.
- [ ] Angenommen der Kunde wählt eine Kachel aus, dann ist erkennbar, welche gewählt ist, und die Auswahl wird beim Absenden übernommen.
- [ ] Angenommen der Kunde gibt an, Studierende:r zu sein, dann zeigen beide Kacheln den ermäßigten Preis.
- [ ] Angenommen der Kunde hat nichts ausgewählt, wenn er absenden will, dann ist das Absenden gesperrt — wie bisher.
- [ ] Angenommen ein Kurs hat einen abweichenden Einzelpreis, dann zeigt die Kachel „Nur diesen Kurs" diesen Preis und nicht den Standard.

### Verlässlichkeit der Anzeige
- [ ] Angenommen dem Kunden wird ein Preis angezeigt, wenn der Betreiber die Buchung anschließend bestätigt, dann ist der vorgeschlagene Abo-Preis derselbe, den der Kunde gesehen hat.
- [ ] Angenommen kein Standardpreis ist gepflegt, wenn ein Kunde den Dialog öffnet, dann erscheint statt einer Kachel mit „0,00 €" ein verständlicher Hinweis, und das Absenden bleibt möglich (der Betreiber setzt den Preis beim Bestätigen).

## Edge Cases
- Was passiert, wenn der Betreiber den Standardpreis ändert, während ein Kunde den Dialog offen hat? → Der Kunde sieht den alten Preis bis zum Neuladen. Beim Bestätigen gilt, was der Betreiber sieht — deshalb schlägt das Bestätigungsformular den Preis vor, statt ihn festzuschreiben.
- Was passiert mit den 12 Kursen, die heute keinen Preis haben? → Sie übernehmen automatisch den Standardpreis. Es ist keine Nachpflege nötig, nur für Kurse, die abweichen sollen.
- Was, wenn der Studierendenpreis höher ist als der Normalpreis? → Wird beim Speichern abgelehnt; das wäre offensichtlich ein Zahlendreher.
- Was sieht ein nicht eingeloggter Besucher? → Dieselben Preise. Sie sind keine persönliche Information, und wer sich anmelden will, soll vorher wissen, was es kostet.
- Was, wenn der Kunde zwischen Kursabo und Flatrate wechselt? → Die Auswahl ist umschaltbar bis zum Absenden.

## Technical Requirements (optional)
- Security: Die Preispflege ist ausschließlich für Admins.
- Der angezeigte Preis muss aus derselben Quelle stammen wie der beim Bestätigen vorgeschlagene — zwei Wege zum selben Preis würden irgendwann auseinanderlaufen.

## Open Questions
- [ ] Soll die Flatrate-Kachel erwähnen, ab wie vielen Kursen sie sich rechnet? → Naheliegend, aber erst nach dem ersten Praxiseindruck entscheiden.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Standardpreis 65 €, pro Kurs überschreibbar | Fast alle Kurse kosten gleich viel; sie einzeln zu pflegen wäre Fleißarbeit mit Fehlerpotenzial. Von deinen 14 Kursen hatten 12 gar keinen Preis hinterlegt | 2026-08-23 |
| Flatrate 145 €, Studierende 100 €; Kursabo Studierende 45 € | Vom Betreiber vorgegeben | 2026-08-23 |
| Alle vier Preise an derselben Stelle wie die Drop-in-Preise | Der Betreiber pflegt Preise dort bereits; ein zweiter Ort wäre eine zusätzliche Stelle zum Vergessen | 2026-08-23 |
| Studierendenpreis auch für Abos, nicht nur für Drop-ins | Vom Betreiber gewünscht; die Ermäßigung ist bei einem Monatsabo spürbarer als bei einer Einzelstunde | 2026-08-23 |
| Kacheln statt Auswahlknöpfen | Zwei Angebote nebeneinander laden zum Vergleich ein; eine Liste mit Radiobuttons stellt die Frage „welches?", ohne bei der Antwort zu helfen | 2026-08-23 |
| Preisänderungen wirken nicht auf laufende Abos | Ein Kunde hat zu einem bestimmten Preis abgeschlossen; ihn rückwirkend zu ändern wäre nicht vermittelbar | 2026-08-23 |
| Gutscheine bleiben aus der Kachel heraus | Die Kachel zeigt den Grundpreis. Einen rabattierten Preis anzuzeigen, bevor der Code geprüft ist, würde ein Versprechen machen, das die Gutscheinprüfung erst später einlösen kann | 2026-08-23 |

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
