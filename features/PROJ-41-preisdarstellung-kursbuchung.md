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
| Die vier Preise kommen in die bestehende Preisliste, nicht in eine neue Tabelle | Ein zweiter Ort für Preise wäre eine zusätzliche Stelle zum Vergessen; der interne Name „Drop-in-Preise" ist ein Überbleibsel und bleibt technisch bestehen | 2026-08-23 |
| Leerer Kurspreis bedeutet „Standard", nicht „kostenlos" | Zwölf von vierzehn Kursen haben keinen Preis. Sie leer zu lassen erspart das Nachziehen und lässt eine spätere Standardänderung überall wirken | 2026-08-23 |
| Preisermittlung an genau einer Stelle für Kachel und Bestätigungsformular | Zwei Rechenwege laufen auseinander — der Kunde sähe dann etwas anderes als der Betreiber beim Bestätigen | 2026-08-23 |
| Der Abo-Preis wird beim Abschluss ins Abo geschrieben und danach nicht mehr angefasst | Nur so bleibt ein laufender Vertrag von Preisänderungen unberührt | 2026-08-23 |
| Fehlender Standardpreis zeigt einen Hinweis statt „0,00 €" | Eine Null wäre eine Preisaussage, die niemand getroffen hat | 2026-08-23 |
| Obergrenze und Vorzeichenprüfung wie bei den bestehenden Preisfeldern | Ein Zahlendreher (650 statt 65) darf nicht stillschweigend zu einem Vertragsangebot werden | 2026-08-23 |
| Der gezeigte Preis wird auf der Anfrage eingefroren, nicht beim Bestätigen neu gerechnet | Schützt vor einem untergeschobenen Betrag und hält die Zusage stabil, wenn sich der Standardpreis dazwischen ändert | 2026-08-23 |
| Gutschein-Rabatt gilt jetzt auch für die Flatrate | Der Grund für die Einschränkung aus PROJ-15 (die Flatrate hatte keinen Preis) ist mit diesem Feature weggefallen — vom Betreiber entschieden | 2026-08-23 |
| Preis beim Nachrücken von der Warteliste, nicht beim Eintragen | Der Wartelisten-Eintrag hält keinen Studierendenwunsch fest, und zwischen Eintrag und Nachrücken können Monate liegen | 2026-08-23 |
| Alte RPC-Signatur per `drop function` entfernt statt nur ersetzt | `create or replace` mit zusätzlichem Parameter legt eine Überladung an — PostgREST wüsste dann nicht, welche gemeint ist (Lehre aus PROJ-15) | 2026-08-23 |

---

## Implementation Notes
_To be added by /frontend and /backend_

---

## Tech Design (Solution Architect)

### A) Component Structure (Visual Tree)

```
Verwaltung → Buchungen (bestehende Seite)
└── Preis-Formular (heute „Drop-in-Preise")
    ├── Drop-in normal / Studierende        (bestehend)
    ├── NEU: Kursabo normal / Studierende
    └── NEU: Flatrate normal / Studierende

Verwaltung → Kurse → Kurs bearbeiten (bestehend)
└── Feld „Preis pro Monat"
       NEU: leer lassen = Standardpreis gilt; ausgefüllt = dieser Kurs weicht ab
       Der Platzhalter zeigt den aktuellen Standard, damit sichtbar ist, wovon abgewichen wird

Buchungsdialog → Reiter „Anmeldung" (bestehend)
└── Abo-Art
       vorher: zwei Auswahlknöpfe ohne Preis
       NEU:    zwei Kacheln nebeneinander
       ┌──────────────────────┐ ┌──────────────────────┐
       │ Nur diesen Kurs      │ │ Flatrate             │
       │ 65,00 € / Monat      │ │ 145,00 € / Monat     │
       │ Dieser eine Kurs,    │ │ Alle Kurse, so oft   │
       │ wöchentlich          │ │ du willst            │
       └──────────────────────┘ └──────────────────────┘
       Bei „Ich bin Studierende:r" zeigen beide den ermäßigten Preis
```

Es entsteht **keine neue Seite**. Ein bestehendes Formular bekommt vier Felder, ein bestehendes
Feld eine klarere Bedeutung, und zwei Auswahlknöpfe werden zu Kacheln.

### B) Data Model (plain language)

```
Die Preisliste des Studios (heute „Drop-in-Preise") führt künftig sechs Beträge:
- Drop-in       normal / Studierende      (bestehend)
- Kursabo       normal / Studierende      NEU
- Flatrate      normal / Studierende      NEU

Beim Kurs bleibt alles wie es ist — ein Preisfeld, das leer sein darf:
- leer      → der Standardpreis für Kursabos gilt
- ausgefüllt → dieser Betrag gilt für diesen Kurs
```

**Der Preis eines Kurses wird nicht gespeichert, sondern beantwortet:** „Hat dieser Kurs einen
eigenen Preis? Wenn nein, nimm den Standard." Dadurch wirkt eine Änderung des Standards sofort auf
alle Kurse, die keinen eigenen haben — ohne dass irgendwo 14 Zeilen nachgezogen werden müssen.

**Was ein Kunde bereits abgeschlossen hat, bleibt unberührt:** Der Preis eines laufenden Abos steht
im Abo selbst und wird von Änderungen an der Preisliste nicht angefasst.

### C) Tech Decisions (justified for PM)

- **Die Preisliste wächst, statt dass eine zweite entsteht.** Du pflegst Preise heute an einer
  Stelle; eine zweite wäre eine weitere Stelle zum Vergessen. Dass die Liste intern noch
  „Drop-in-Preise" heißt, ist ein Überbleibsel — nach außen heißt sie künftig schlicht „Preise".

- **Leer bedeutet Standard, nicht null.** Das ist die Entscheidung, die dir die meiste Arbeit
  spart: Zwölf deiner vierzehn Kurse haben heute keinen Preis. Statt zwölfmal 65 € einzutragen,
  bleiben sie leer und übernehmen den Standard — und wenn du den Standard später änderst, ändern
  sie sich alle mit. Nur echte Ausnahmen bekommen einen eigenen Betrag.

- **Ein Preis, eine Quelle.** Der Preis in der Kachel und der Preis, den dir das
  Bestätigungsformular vorschlägt, werden an derselben Stelle ermittelt. Zwei getrennte Rechenwege
  würden irgendwann auseinanderlaufen — und dann sähe der Kunde etwas anderes als du.

- **Der Studierendenpreis ist eine Selbstauskunft**, genau wie beim Drop-in heute. Ein Nachweis
  wäre ein eigenes Thema und würde die Buchung deutlich schwerfälliger machen.

- **Kacheln statt Auswahlknöpfen.** Zwei Angebote nebeneinander laden zum Vergleich ein. Eine Liste
  mit Radiobuttons stellt die Frage „welches?", ohne bei der Antwort zu helfen — mit Preis und
  einem Satz Erläuterung beantwortet die Kachel sie mit.

- **Ohne gepflegten Preis wird nichts behauptet.** Fehlt ein Standardpreis, zeigt die Kachel keinen
  Betrag „0,00 €", sondern einen Hinweis — und das Buchen bleibt möglich. Eine Null wäre eine
  Aussage, die niemand gemacht hat.

### D) Dependencies (packages to install)

Keine. Es kommen Felder in ein vorhandenes Formular, und eine vorhandene Auswahl bekommt eine
andere Darstellung.

### Umfang

Erweitert: die Preisliste um vier Beträge, das Preis-Formular in der Verwaltung, die
Preisermittlung an einer Stelle, die Abo-Auswahl im Buchungsdialog. Keine neue Seite, keine neue
Tabelle, keine neue Abhängigkeit.

---

## Implementation Notes (Backend)

**Stand:** Backend umgesetzt am 2026-08-23.

### Serverseitige Preisermittlung
`resolve_plan_price(course_id, desired_plan, wants_student_price)` spiegelt `planPrice()`
aus `src/lib/pricing.ts` in SQL. Die Kachel im Browser ist eine Behauptung des Clients;
in die Buchung gelangt nur, was der Server selbst ermittelt hat. Beide Definitionen
verweisen im Kommentar aufeinander, damit eine Änderung nicht einseitig bleibt.

Nachgerechnet: Server und Browser liefern für dieselben Eingaben dieselben Beträge
(65/45/145/100 beim Standard, 60 bei „Salsa Beginner 1" mit eigenem Preis).

### Der gezeigte Preis wird festgehalten
`create_regular_course_booking` speichert jetzt `price` und `wants_student_price` auf der
Anfrage. Zwei Gründe, ihn bei der Anfrage einzufrieren statt beim Bestätigen neu zu
rechnen: der Client könnte einen anderen Betrag unterschieben, und ändert der Betreiber
den Standardpreis zwischen Anfrage und Bestätigung, soll trotzdem der Betrag
vorgeschlagen werden, den der Kunde gesehen hat.

**Nachgewiesen:** Standardpreis von 45 auf 55 geändert — die offene Anfrage behielt 45,
`resolve_plan_price` lieferte 55. Danach zurückgesetzt.

Die Signatur wuchs um einen Parameter, daher wurde die alte ausdrücklich per
`drop function` entfernt: `create or replace` hätte eine Überladung angelegt statt zu
ersetzen (Lehre aus PROJ-15). Verifiziert: `count(*) from pg_proc` = 1.

### Wartelisten-Nachrückung
`promote_waitlist_for_course` stempelt den Preis beim Nachrücken. Sonst stünde der
Betreiber vor einem leeren Preisfeld, nur weil der Kunde über die Warteliste kam. Der
Preis entsteht beim Nachrücken, nicht beim Eintragen — der Wartelisten-Eintrag hält
keinen Studierendenwunsch fest, und dazwischen können Monate liegen.

### Bestätigungsdialog
Der Vorschlag kommt jetzt aus `booking.price` (dem gezeigten Preis) statt aus
`courses.price`. `coursePrice` bleibt Rückfall für Anfragen von vor dieser Änderung.
Der Betreiber sieht in der Liste zusätzlich „(Studierendenpreis)", damit nachvollziehbar
ist, warum 45 statt 65 steht.

**Nachgewiesen:** Kunde bucht mit Studierendenwunsch, sieht „€ 45,00" → Datenbank
speichert 45 → Bestätigungsdialog schlägt 45 vor.

### Gutschein auch bei der Flatrate
Bis PROJ-41 konnte ein Rabatt nur bei „Nur diesen Kurs" vorgeschlagen werden — die
Flatrate hatte keinen Preis, von dem sich rabattieren ließe (PROJ-15 Tech Design). Jetzt
hat sie einen, also gilt ein Gutschein für beide Abo-Arten. Vom Betreiber entschieden.

### Obergrenze beim Bestätigen
`confirmRegularBooking` prüft jetzt ebenfalls gegen `MAX_PRICE` — es ist die zweite
Stelle, an der ein Preis von Hand entsteht, und ein Zahlendreher darf auch dort nicht zu
einem monatlichen Einzug in dieser Höhe führen.

### Laufende Abos
Bestätigt: `confirmRegularBooking` schreibt den Betrag in `subscriptions.price`. Ein Abo
trägt seinen Preis damit selbst — spätere Änderungen an der Preisliste fassen ihn nicht an.

### Migrationen
| Datei | Inhalt |
|---|---|
| `20260823195748_proj41_subscription_and_flatrate_prices.sql` | vier Spalten + Startwerte |
| `20260823200841_proj41_server_side_plan_price.sql` | `resolve_plan_price` |
| `20260823200911_proj41_store_price_on_regular_booking.sql` | Preis auf der Anfrage |
| `20260823200932_proj41_price_on_waitlist_promotion.sql` | Preis beim Nachrücken |

Alle angewendet und exportiert. Die Funktionskörper der Exportdateien wurden per
MD5-Vergleich gegen `pg_proc.prosrc` geprüft — sie stimmen bit-genau mit der Datenbank
überein.

---

## QA Test Results
_To be added by /qa_

---

## Deployment
_To be added by /deploy_
