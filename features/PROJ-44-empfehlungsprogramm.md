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
- **Gutschriften von Hand in großer Zahl** (Sammelaktion für alle Teilnehmer eines ausgefallenen Kurses). Von Hand heißt: ein Kunde nach dem anderen.
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

### Benachrichtigung
- [ ] Angenommen eine Empfehlung eines Kunden hat gezählt, dann wird er darüber benachrichtigt und erfährt, wie viel Guthaben er nun hat.
- [ ] Angenommen der Kunde hat diese Benachrichtigungsart abgeschaltet, dann bekommt er sie nicht — das Guthaben entsteht trotzdem.
- [ ] Angenommen ein Kunde nutzt die englische Fassung, dann kommt auch diese Benachrichtigung auf Englisch.

### Die Verrechnung
- [ ] Angenommen ein Kunde hat Guthaben, wenn der nächste SEPA-Lauf ihn erfasst, dann wird das Guthaben vom Abo-Betrag abgezogen.
- [ ] Angenommen das Guthaben ist größer als der Abo-Betrag, dann wird nur bis auf null verrechnet und der Rest bleibt für den nächsten Lauf stehen.
- [ ] Angenommen ein Betrag wurde durch Guthaben gemindert, wenn der Kunde seine Rechnung ansieht, dann ist erkennbar, dass und in welcher Höhe Guthaben verrechnet wurde.
- [ ] Angenommen ein Kunde hat Guthaben, aber kein aktives Abo, dann bleibt das Guthaben stehen und wird **nicht** ausgezahlt.

### Pflege durch den Betreiber
- [ ] Angenommen der Betreiber öffnet die Stelle, an der er die Preise pflegt, dann findet er dort die beiden Beträge (Werbender / Geworbener) und kann sie ändern.
- [ ] Angenommen der Betreiber ändert einen Betrag, dann gilt der neue Wert für künftige Empfehlungen; bereits gutgeschriebenes Guthaben bleibt unverändert.
- [ ] Angenommen der Betreiber sieht sich einen Kunden an, dann erkennt er dessen Guthaben und wer ihn geworben hat.
- [ ] Angenommen der Betreiber will einem Kunden Guthaben gutschreiben, dann kann er das von Hand tun und muss dabei einen Grund angeben.
- [ ] Angenommen der Betreiber vergibt Guthaben von Hand, dann entscheidet er dabei, ob der Kunde benachrichtigt wird; die Nachricht ist standardmäßig **aus**.
- [ ] Angenommen der Betreiber wählt die Benachrichtigung an, dann sieht der Kunde den von ihm angegebenen Grund — nicht nur den Betrag.
- [ ] Angenommen der Betreiber zieht Guthaben ab, dann wird der Kunde **nicht** benachrichtigt.
- [ ] Angenommen der Betreiber sieht sich das Guthaben eines Kunden an, dann erkennt er zu jeder Gutschrift, **woher** sie stammt — aus einer Empfehlung oder von Hand vergeben, mit dem angegebenen Grund.
- [ ] Angenommen der Betreiber vergibt versehentlich zu viel, dann kann er eine Gutschrift auch wieder abziehen — ebenfalls mit Grund.

## Edge Cases
- Was, wenn der Werbende sein Abo kündigt, bevor das Guthaben aufgebraucht ist? → Es bleibt stehen. Kommt er zurück, wird es weiter verrechnet; ausgezahlt wird es nie.
- Was, wenn der Geworbene erst Monate später bucht? → Der Code ist nicht befristet. Eine Frist wäre eine zusätzliche Regel ohne erkennbaren Nutzen.
- Was, wenn jemand seinen Code öffentlich streut? → Kein Problem: Das Guthaben entsteht erst nach einer erfolgreichen Abbuchung und ist nur gegen eigene Abo-Beträge einlösbar. Es lässt sich nicht zu Geld machen.
- Was, wenn ein Geworbener einen Gutschein **und** einen Empfehlungscode nutzen will? → Nur eines von beidem; es gibt ein Code-Feld, und der zuletzt eingegebene Code gilt.
- Was, wenn die Beträge auf 0 gesetzt werden? → Das Programm ist damit faktisch aus. Kein Sonderfall nötig; es ist ein Weg, es abzuschalten.
- Was, wenn ein Kunde gelöscht wird, der geworben hat? → Das Guthaben des Geworbenen bleibt; die Zuordnung wird leer.
- Was, wenn der Betreiber einem Kunden mehr Guthaben abzieht, als er hat? → Wird abgelehnt. Ein negatives Guthaben wäre eine Forderung, und dafür gibt es die Rechnung.
- Was, wenn die Benachrichtigung nicht zugestellt werden kann? → Das Guthaben entsteht trotzdem. Es hängt an der Abbuchung, nicht am Versand.

## Technical Requirements (optional)
- Der Code muss nicht erratbar sein — sonst könnte jemand fremde Codes durchprobieren, um sich selbst Guthaben zu verschaffen.
- Die Gutschrift muss **genau einmal** entstehen, auch wenn ein SEPA-Lauf wiederholt wird.
- Guthaben darf nie zu einem negativen Abbuchungsbetrag führen.

## Open Questions
- [ ] Wie erfährt der Geworbene, dass sein Rabatt kommt? Auch er wartet bis zum ersten Einzug — sieht beim Buchen aber schon, dass der Code erkannt wurde. Ob das reicht, zeigt die Praxis. (Architektur 2026-08-25)
- [x] Soll der Kunde eine Benachrichtigung bekommen, wenn eine Empfehlung gezählt hat? → Ja (2026-08-25)
- [x] Soll der Betreiber Guthaben von Hand vergeben können? → Ja (2026-08-25)
- [x] Soll eine Gutschrift von Hand eine Benachrichtigung auslösen? → Der Betreiber entscheidet es je Gutschrift; die Nachricht ist standardmäßig **aus** (2026-08-25)

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
| Der Werbende wird benachrichtigt, wenn eine Empfehlung zählt | Vom Betreiber gewünscht. Ohne Nachricht erfährt er es erst auf der nächsten Rechnung — und weiß dann nicht, wofür | 2026-08-25 |
| Die Benachrichtigung bekommt eine eigene Art, die der Kunde abschalten kann | Wie alle anderen auch (PROJ-34). Wer sie nicht will, bekommt sie nicht; das Guthaben entsteht davon unabhängig | 2026-08-25 |
| Bei einer Gutschrift von Hand entscheidet der Betreiber je Fall über die Benachrichtigung, Standard aus | Vom Betreiber gewünscht. Eine Entschuldigung für einen ausgefallenen Kurs will man ankündigen, die stille Korrektur eines eigenen Vertippers nicht. Standard aus, weil die unauffällige Korrektur der häufigere Fall sein dürfte — und eine ungewollt verschickte Nachricht lässt sich nicht zurückholen | 2026-08-25 |
| Der angegebene Grund steht in der Nachricht | Eine Gutschrift ohne Anlass wirft mehr Fragen auf, als sie beantwortet | 2026-08-25 |
| Ein Abzug löst nie eine Benachrichtigung aus | Er korrigiert einen Fehler des Betreibers. Den Kunden darüber zu informieren, dass ihm etwas weggenommen wurde, das er nie hätte haben sollen, schafft nur Verwirrung | 2026-08-25 |
| Der Betreiber kann Guthaben auch von Hand vergeben **und abziehen** | Vom Betreiber gewünscht. Das Abziehen gehört dazu: Wer vergeben kann, vertippt sich irgendwann, und ohne Gegenstück bliebe der Fehler stehen | 2026-08-25 |
| Jede Gutschrift trägt eine Herkunft und einen Grund | Sobald Guthaben aus zwei Quellen stammen kann, ist ein bloßer Kontostand nicht mehr erklärbar. Der Betreiber muss Monate später nachvollziehen können, warum jemand 45 € hat | 2026-08-25 |
| Ein negatives Guthaben ist ausgeschlossen | Es wäre eine Forderung an den Kunden, und dafür gibt es die Rechnung — nicht das Guthabenkonto | 2026-08-25 |
| Kein Ablaufdatum für Codes | Eine Frist wäre eine zusätzliche Regel ohne erkennbaren Nutzen — eine Empfehlung wird nicht schlechter, weil sie später eingelöst wird | 2026-08-25 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Die Belohnung wird beim **nächsten** SEPA-Lauf geprüft, nicht am Tag der Abbuchung | Ob eine Lastschrift durchgeht, weiß niemand am Einzugstag — eine Rücklastschrift meldet die Bank Tage später. Der Werbende wartet dadurch rund vier Wochen; die Alternative wäre, für Kunden zu zahlen, deren Geld nie ankam | 2026-08-25 |
| Guthaben ist ein Verlauf, keine gespeicherte Zahl | Ein Kontostand beantwortet nicht, warum. Eine zusätzlich gepflegte Zahl könnte vom Verlauf abweichen, und dann wüsste niemand, welche stimmt | 2026-08-25 |
| Das Guthaben mindert den Abbuchungsbetrag, statt eine zweite Buchung zu erzeugen | Eine negative Lastschrift gibt es nicht | 2026-08-25 |
| Die Verrechnung wird im Verlauf festgehalten, mit Bezug auf die Abbuchung | Nur so kann ein wiederholter Lauf dasselbe Guthaben nicht zweimal verbrauchen | 2026-08-25 |
| Der Code lebt am Kunden, nicht in der Gutschein-Tabelle — die Eingabe teilen sie sich | Ein Gutschein hat Auflage und Ablauf, ein Empfehlungscode gehört einer Person und gilt unbefristet. In einer Tabelle müsste man beide Begriffe verbiegen. Der Kunde tippt trotzdem in ein Feld | 2026-08-25 |
| Der Code wird zufällig erzeugt, nicht aus dem Namen gebildet | Ein Code wie ANNA-M wäre erratbar, und wer fremde Codes durchprobiert, könnte sich Guthaben verschaffen | 2026-08-25 |
| Die beiden Beträge stehen bei den Preisen; 0 schaltet das Programm ab | Ein zweiter Ort für Beträge wäre eine weitere Stelle zum Vergessen, und ein eigener Schalter wäre überflüssig | 2026-08-25 |

---

## Tech Design (Solution Architect)

### A) Component Structure (Visual Tree)

```
Profil (bestehend)
└── NEU: Abschnitt „Empfehlen und Guthaben"
    ├── Dein Code:  VSS-K7M2Q          [kopieren]
    ├── Guthaben:   30,00 €
    └── Verlauf     2 Empfehlungen gezählt · 1× von Vienna Salsa Studio

Buchungsdialog (bestehend)
└── Feld „Gutscheincode" — nimmt jetzt auch Empfehlungscodes
       Der Kunde muss den Unterschied nicht kennen.

Verwaltung → Buchungen (bestehend)
└── Preis-Formular: NEU zwei Beträge
       Empfehlung: für den Werbenden / für den Geworbenen

Verwaltung → Kunde (bestehend)
├── NEU: Guthaben 30,00 €  ·  geworben von: Anna M.
└── NEU: Verlauf jeder Gutschrift — woher, wie viel, warum, wann
       + Guthaben gutschreiben   (Grund nötig, Benachrichtigung wählbar)
       + Guthaben abziehen       (Grund nötig, benachrichtigt nie)

Rechnung (bestehend)
└── NEU: Zeile „Empfehlungsguthaben verrechnet: −15,00 €"
```

### B) Data Model (plain language)

```
Am Kundenkonto kommt hinzu:
- Empfehlungscode   eindeutig, nicht erratbar
- Geworben von      wer diesen Kunden gebracht hat (leer bei den meisten)

Neu: ein Guthaben-Verlauf. Jede Zeile hält fest:
- Wer            der Kunde
- Wie viel       positiv = Gutschrift, negativ = verrechnet oder abgezogen
- Woher          Empfehlung / von Hand / mit einer Abbuchung verrechnet
- Warum          der Grund, bei Gutschriften von Hand verpflichtend
- Wann

Das Guthaben ist keine gespeicherte Zahl, sondern die Summe dieses Verlaufs.
```

**Warum ein Verlauf und keine Zahl:** Ein Kontostand von 45 € beantwortet nicht, warum. Ein
Verlauf beantwortet es von selbst — und genau das verlangt das Spec, seit Guthaben aus zwei
Quellen stammen kann. Eine gespeicherte Zahl müsste zusätzlich gepflegt werden und könnte
vom Verlauf abweichen; dann wüsste niemand, welche der beiden stimmt.

### C) Tech Decisions (justified for PM)

- **Die Belohnung wird beim SEPA-Lauf geprüft, nicht bei der Abbuchung selbst.** Das ist die
  wichtigste Festlegung — und sie verschiebt den Zeitpunkt. Ob eine Lastschrift wirklich
  durchgeht, weiß niemand am Tag des Einzugs: Eine Rücklastschrift meldet die Bank Tage
  später, und der Betreiber trägt sie dann ein. Die Belohnung entsteht deshalb beim
  **nächsten** Lauf, wenn feststeht, dass die erste Abbuchung nicht zurückkam.

  Praktisch heißt das: Der Werbende bekommt sein Guthaben rund vier Wochen nach der Buchung
  des Geworbenen. Das ist langsamer, als es klingen mag — aber die Alternative wäre, für
  Kunden zu zahlen, deren Geld nie ankam.

- **Das Guthaben mindert den Abbuchungsbetrag, es entsteht keine zweite Buchung.** Eine
  negative Lastschrift gibt es nicht; man kann sich kein Geld vom Kunden zurückholen lassen.
  Der Betrag wird also vor dem Einzug gesenkt, und die Rechnung erklärt, warum.

- **Die Verrechnung wird im Verlauf festgehalten, nicht nur im Betrag.** Nur so kann ein
  wiederholter Lauf dasselbe Guthaben nicht zweimal verbrauchen — die Zeile sagt, mit welcher
  Abbuchung es verrechnet wurde.

- **Der Code lebt am Kunden, nicht in der Gutschein-Tabelle.** Ein Gutschein hat eine
  Auflage und ein Ablaufdatum; ein Empfehlungscode gehört einer Person und gilt unbefristet.
  In dieselbe Tabelle gepresst müsste man beide Begriffe verbiegen. **Die Eingabe teilen sie
  sich trotzdem** — der Kunde tippt in ein Feld, und die Prüfung schaut erst bei den
  Gutscheinen nach und dann bei den Codes.

- **Der Code wird zufällig erzeugt, nicht aus dem Namen gebildet.** Ein Code wie `ANNA-M`
  wäre erratbar, und wer fremde Codes durchprobiert, könnte sich Guthaben verschaffen.

- **Die beiden Beträge stehen bei den Preisen.** Der Betreiber pflegt Beträge dort bereits;
  ein zweiter Ort wäre eine weitere Stelle zum Vergessen. Auf 0 gesetzt ist das Programm aus
  — dafür braucht es keinen Schalter.

- **Die Benachrichtigung ist eine eigene Art.** Wie alle anderen abschaltbar, in beiden
  Sprachen, über dieselbe Vorlagenverwaltung pflegbar.

### D) Dependencies (packages to install)

Keine.

### Umfang

Neu: zwei Felder am Kundenkonto, eine Verlaufstabelle, ein Abschnitt im Profil, zwei Felder
im Preis-Formular, zwei Bedienelemente in der Kundenansicht, eine Benachrichtigungsvorlage
in zwei Sprachen.

Angefasst: die Code-Prüfung im Buchungsdialog, der SEPA-Lauf, die Rechnungserzeugung.

**Die drei angefassten Stellen bewegen Geld.** Dort ist Sorgfalt wichtiger als Tempo: Ein
Fehler in der Preisanzeige ist ärgerlich, ein Fehler beim Einzug ist ein Fall für die Bank.

### Was dieser Entwurf bewusst nicht kann

Guthaben auf Drop-ins, Tickets oder Events. Diese werden nicht regelmäßig eingezogen; die
Verrechnung hätte dort keinen natürlichen Zeitpunkt.


---

## Implementation Notes
_To be added by /frontend and /backend_

---

## QA Test Results
_To be added by /qa_

---

## Deployment
_To be added by /deploy_
