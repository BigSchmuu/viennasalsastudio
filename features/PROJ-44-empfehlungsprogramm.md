# PROJ-44: Empfehlungsprogramm (Kunden werben Kunden)

## Status: Planned
**Created:** 2026-08-25
**Last Updated:** 2026-08-25

## Dependencies
- Requires: PROJ-15 (Gutscheine) — dieselbe Code-Eingabe im Buchungsdialog, dieselbe Prüfung „hatte schon ein Abo".
- Requires: PROJ-13 (SEPA-Sammeleinzug) — dort wird das Guthaben verrechnet.
- Requires: PROJ-41 (Preise) — die beiden Beträge werden dort gepflegt, wo auch die Drop-in-Preise stehen.
- Herausgelöst aus: PROJ-21 (Affiliate-System, Rollen & Dokumente/Verträge). Dort verbleiben granulare Rollen und Dokumente/Verträge — drei unabhängige Themen gehören nicht in ein Spec.

## Ausgangslage
Der Betreiber weiß heute **nicht**, ob Empfehlungen ein relevanter Kanal sind: Von 52 Kunden
haben 42 keine Herkunftsangabe, und die Antwortmöglichkeit „Empfehlung" hat noch nie jemand
gewählt. Gleichzeitig steht die komplette Gutschein-Maschinerie aus PROJ-15 ungenutzt da —
null angelegte Gutscheine.

Bei 41 aktiven Abos mit durchschnittlich 48,47 € sind das rund 2.000 € wiederkehrend im Monat.

Es gibt bisher **keinen Begriff von Guthaben oder Rabatt auf ein Abo**: Der SEPA-Lauf nimmt
`subscriptions.price` unverändert. Das muss neu entstehen.

## User Stories
- Als Kunde möchte ich einen persönlichen Code haben, den ich Freunden weitergeben kann.
- Als Kunde möchte ich sehen, wie viele meiner Empfehlungen gezählt haben und wie viel Guthaben ich habe.
- Als neuer Kunde möchte ich beim Buchen einen Code eingeben können, ohne wissen zu müssen, ob es ein Gutschein oder eine Empfehlung ist.
- Als Betreiber möchte ich nur für Kunden zahlen, die auch wirklich Geld bringen.
- Als Betreiber möchte ich die beiden Beträge ändern können, ohne den Code anzufassen.
- Als Betreiber möchte ich auf einer Rechnung sehen, warum weniger abgebucht wurde.

## Out of Scope
- **Auszahlung von Guthaben.** Es wird ausschließlich mit künftigen Abo-Beträgen verrechnet. Eine Barauszahlung an Privatpersonen brächte Melde- und Belegpflichten mit sich — ein Thema für den Steuerberater, nicht für dieses Feature.
- **Externe Partner** (andere Studios, Veranstalter, Influencer) mit eigenen Konten, Tracking-Links und Provisionsabrechnung. Das wäre ein eigenes Produkt; siehe PROJ-21.
- **Lehrer als Werbende** mit abweichender Belohnungsform.
- **Guthaben auf Drop-ins, Tickets oder Events.** Nur Abo-Beträge, weil nur dort automatisch abgerechnet wird.
- **Staffelungen** (mehr Guthaben ab der fünften Empfehlung o. ä.).
- **Rückwirkende Zuordnung** bestehender Kunden zu einem Werbenden.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Der Code
- [ ] Angenommen ein Kunde öffnet sein Profil, dann findet er seinen persönlichen Empfehlungscode und kann ihn kopieren.
- [ ] Angenommen zwei Kunden vergleichen ihre Codes, dann sind sie verschieden und nicht erratbar.
- [ ] Angenommen ein Kunde gibt beim Buchen **seinen eigenen** Code ein, dann wird er nicht anerkannt.
- [ ] Angenommen ein Kunde hatte schon einmal ein Abo, wenn er einen Empfehlungscode eingibt, dann wird er nicht anerkannt — das Programm gilt für neue Kunden.
- [ ] Angenommen ein Kunde gibt einen Code ein, dann muss er nicht wissen, ob es ein Gutschein oder eine Empfehlung ist; beides wird im selben Feld eingegeben.

### Die Belohnung
- [ ] Angenommen ein Geworbener bucht mit einem gültigen Code, wenn seine **erste Lastschrift erfolgreich** eingezogen wurde, dann erhalten beide Seiten je 15 € Guthaben.
- [ ] Angenommen die erste Lastschrift kommt zurück, dann entsteht **kein** Guthaben — für keine der beiden Seiten.
- [ ] Angenommen der Geworbene kündigt vor der ersten Abbuchung, dann entsteht kein Guthaben.
- [ ] Angenommen ein Kunde wirbt mehrere Personen, dann gibt es keine Obergrenze.

### Die Verrechnung
- [ ] Angenommen ein Kunde hat Guthaben, wenn der nächste SEPA-Lauf ihn erfasst, dann wird das Guthaben vom Abo-Betrag abgezogen.
- [ ] Angenommen das Guthaben ist größer als der Abo-Betrag, dann wird nur bis auf null verrechnet und der Rest bleibt für den nächsten Lauf stehen.
- [ ] Angenommen ein Betrag wurde durch Guthaben gemindert, wenn der Kunde seine Rechnung ansieht, dann ist erkennbar, dass und in welcher Höhe Guthaben verrechnet wurde.
- [ ] Angenommen ein Kunde hat Guthaben, aber kein aktives Abo, dann bleibt das Guthaben stehen und wird **nicht** ausgezahlt.

### Pflege durch den Betreiber
- [ ] Angenommen der Betreiber öffnet die Stelle, an der er die Preise pflegt, dann findet er dort die beiden Beträge (Werbender / Geworbener) und kann sie ändern.
- [ ] Angenommen der Betreiber ändert einen Betrag, dann gilt der neue Wert für künftige Empfehlungen; bereits gutgeschriebenes Guthaben bleibt unverändert.
- [ ] Angenommen der Betreiber sieht sich einen Kunden an, dann erkennt er dessen Guthaben und wer ihn geworben hat.

## Edge Cases
- Was, wenn der Werbende sein Abo kündigt, bevor das Guthaben aufgebraucht ist? → Es bleibt stehen. Kommt er zurück, wird es weiter verrechnet; ausgezahlt wird es nie.
- Was, wenn der Geworbene erst Monate später bucht? → Der Code ist nicht befristet. Eine Frist wäre eine zusätzliche Regel ohne erkennbaren Nutzen.
- Was, wenn jemand seinen Code öffentlich streut? → Kein Problem: Das Guthaben entsteht erst nach einer erfolgreichen Abbuchung und ist nur gegen eigene Abo-Beträge einlösbar. Es lässt sich nicht zu Geld machen.
- Was, wenn ein Geworbener einen Gutschein **und** einen Empfehlungscode nutzen will? → Nur eines von beidem; es gibt ein Code-Feld, und der zuletzt eingegebene Code gilt.
- Was, wenn die Beträge auf 0 gesetzt werden? → Das Programm ist damit faktisch aus. Kein Sonderfall nötig; es ist ein Weg, es abzuschalten.
- Was, wenn ein Kunde gelöscht wird, der geworben hat? → Das Guthaben des Geworbenen bleibt; die Zuordnung wird leer.

## Technical Requirements (optional)
- Der Code muss nicht erratbar sein — sonst könnte jemand fremde Codes durchprobieren, um sich selbst Guthaben zu verschaffen.
- Die Gutschrift muss **genau einmal** entstehen, auch wenn ein SEPA-Lauf wiederholt wird.
- Guthaben darf nie zu einem negativen Abbuchungsbetrag führen.

## Open Questions
- [ ] Soll der Kunde eine Benachrichtigung bekommen, wenn eine Empfehlung gezählt hat? Naheliegend, aber erst nach dem ersten Praxiseindruck entscheiden.
- [ ] Soll der Betreiber Guthaben von Hand vergeben können (etwa als Entschuldigung für einen ausgefallenen Kurs)? Wäre derselbe Mechanismus, aber ein eigener Anwendungsfall.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Nur Kunden werben Kunden; keine externen Partner | Vom Betreiber gewählt. Ein Partnerprogramm mit Konten, Tracking-Links und Auszahlungen wäre ein eigenes Produkt und lohnt bei 52 Kunden nicht | 2026-08-25 |
| Belohnung erst nach der ersten **erfolgreichen** Abbuchung | Schützt davor, dass jemand Bekannte anmeldet, die sofort kündigen oder deren Lastschrift zurückkommt. Der Betreiber zahlt nur für Kunden, die auch Geld bringen | 2026-08-25 |
| Guthabenkonto statt Freimonat oder Preisänderung von Hand | Ein Freimonat wäre bei 65 € gegen 145 € sehr ungleich. Ein von Hand gesenkter Preis müsste danach wieder hochgesetzt werden — wird das vergessen, zahlt der Kunde dauerhaft weniger | 2026-08-25 |
| Je 15 € für beide Seiten | Vom Betreiber festgelegt. Gleiche Beträge sind am leichtesten zu erklären; 30 € pro Empfehlung sind bei Ø 48,47 € Monatsbeitrag nach dem ersten Monat eingespielt | 2026-08-25 |
| Keine Obergrenze für Empfehlungen | Wer viele Leute bringt, ist genau der Kunde, den man nicht ausbremsen will | 2026-08-25 |
| Guthaben wird nie ausgezahlt, nur gegen Abo-Beträge verrechnet | Hält das Geld im Studio und vermeidet Melde- und Belegpflichten, die eine Barauszahlung an Privatpersonen mit sich brächte | 2026-08-25 |
| Ein Code-Feld für Gutschein **und** Empfehlung | Der Kunde soll den Unterschied nicht kennen müssen. Zwei Felder wären eine Frage, die niemand stellt | 2026-08-25 |
| Der eigene Code wird nicht anerkannt, ebenso wenig bei Bestandskunden | Sonst wäre das Programm ein Selbstbedienungsladen. Die Bestandskunden-Prüfung existiert bereits für Gutscheine (PROJ-15) | 2026-08-25 |
| Kein Ablaufdatum für Codes | Eine Frist wäre eine zusätzliche Regel ohne erkennbaren Nutzen — eine Empfehlung wird nicht schlechter, weil sie später eingelöst wird | 2026-08-25 |

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
