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
- **Hinweisblock über dem Absende-Knopf** (Preis, Abrechnungsrhythmus, Kündigung). Zurückgestellt am 2026-08-24 auf Wunsch des Betreibers: Der Preis steht seit PROJ-41 ohnehin in der Kachel, die übrigen Angaben stehen in den AGB, die per Häkchen bestätigt werden.
- **Rücktrittsbelehrung im Buchungsvorgang.** Zurückgestellt am 2026-08-24. Es wird kein Rücktrittsrecht eingeräumt; was gilt, steht in § 4 der AGB.
- **Die Formulierung „zahlungspflichtig buchen"** und die Unterscheidung nach tatsächlicher Zahlungspflicht (neutrale Beschriftung bei kostenloser Probestunde). Der Knopf heißt seit 2026-08-24 einheitlich „Rechtlich verbindlich buchen" — vom Betreiber so gewählt.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

> **Umfang auf Wunsch des Betreibers reduziert (2026-08-24):** Es geht ausschließlich um die
> Zustimmung zu den AGB und die Beschriftung des Absende-Knopfes. Hinweisblock über dem Knopf
> und Rücktrittsbelehrung sind zurückgestellt — siehe Out of Scope.

### Beschriftung
- [ ] Angenommen ein Kunde steht vor dem Absenden einer Buchung, dann heißt der Knopf „Rechtlich verbindlich buchen" statt „Absenden".
- [ ] Angenommen ein Kunde trägt sich auf die Warteliste ein, dann bleibt die Beschriftung „Auf Warteliste eintragen" — ein Wartelisten-Eintrag verpflichtet zu nichts.

### Zustimmung
- [ ] Angenommen ein Kunde füllt den Buchungsdialog aus, wenn er absenden will, dann muss er zuvor bestätigt haben, dass er die AGB gelesen und akzeptiert hat.
- [ ] Angenommen der Kunde hat nicht bestätigt, wenn er auf den Absende-Knopf schaut, dann ist dieser gesperrt.
- [ ] Angenommen der Kunde öffnet die AGB aus dem Dialog heraus, dann gehen seine bisherigen Eingaben nicht verloren.
- [ ] Angenommen der Dialog wird geöffnet, dann ist das Häkchen **nicht** vorausgefüllt.
- [ ] Angenommen ein Kunde kauft ein Event-Ticket, dann gilt dieselbe Zustimmung.
- [ ] Angenommen ein manipulierter Browser schickt eine Buchung ohne Zustimmung, dann lehnt der Server sie ab.

### Nachweisbarkeit
- [ ] Angenommen ein Kunde hat zugestimmt, wenn die Buchung gespeichert wird, dann wird festgehalten, **wann** und **welcher Stand** der AGB galt.
- [ ] Angenommen der Betreiber sieht sich eine Buchung in der Verwaltung an, dann erkennt er, ob und wann zugestimmt wurde.
- [ ] Angenommen die AGB werden später geändert, wenn eine alte Buchung angesehen wird, dann bleibt erkennbar, welchem Stand der Kunde damals zugestimmt hat.
- [ ] Angenommen eine Buchung stammt von vor der Einführung, dann steht dort „—" statt eines erfundenen Zeitpunkts.

## Edge Cases
- Was passiert mit Kunden, die vor der Einführung gebucht haben? → Für sie existiert keine Zustimmung. Ob und wie sie nachgeholt wird, ist eine Entscheidung außerhalb der App (siehe Open Questions).
- Was, wenn ein Kunde zustimmt, die Buchung aber fehlschlägt? → Es wird nichts festgehalten; die Zustimmung gehört zur Buchung, nicht zum Klick.
- Was, wenn die AGB geändert werden, während ein Kunde den Dialog offen hat? → Festgehalten wird der Stand, der beim Speichern gilt. Eine Abweichung von Sekunden ist praktisch bedeutungslos, ein falscher Nachweis wäre schlimmer als keiner.
- Was, wenn ein Kunde mehrfach bucht? → Jede Buchung trägt ihre eigene Zustimmung; eine einmalige Zustimmung „für immer" wäre schwächer nachweisbar.
- Gilt das auch für Probestunde und Drop-in? → Ja, dieselbe Zustimmung. Der Vorgang ist derselbe, unabhängig davon, ob gezahlt wird.

## Technical Requirements (optional)
- Security: Die Zustimmung muss serverseitig geprüft werden — ein manipulierter Browser darf sie nicht umgehen können.
- Der festgehaltene AGB-Stand muss auch dann noch nachvollziehbar sein, wenn die AGB inzwischen geändert wurden.

## Open Questions
- [ ] Reichen die vorgesehenen Maßnahmen juristisch aus? → **Weiterhin offen.** Der Betreiber hat entschieden, zunächst nur das Verfahren zu bauen (Häkchen, Zeitstempel, AGB-Stand, Beschriftung) und die Texte unverändert aus den bestehenden AGB zu übernehmen. Eine juristische Prüfung steht aus; sie wäre danach reine Textarbeit (2026-08-24)
- [ ] Wie wird mit Bestandskunden umgegangen, die nie zugestimmt haben? → Offen; hängt von der juristischen Einschätzung ab.
- [ ] Greift die FAGG-Ausnahme auch für die Flatrate? Sie ist an keinen bestimmten Termin gebunden, worauf sich § 4 der AGB aber stützt. (Architektur 2026-08-24)
- [ ] Braucht es eine versionierte AGB (z.B. „Stand 08/2026"), oder genügt ein Zeitstempel? → In `/architecture` entscheiden, sobald die juristische Rückmeldung vorliegt.
- [x] Gilt das Widerrufsrecht auch, wenn der Kurs innerhalb der 14 Tage beginnt? → Die bestehenden AGB (§ 4) verneinen es für Kurse mit festem Wochentermin und berufen sich auf § 18 Abs. 1 Z 10 FAGG. Der Hinweis im Buchungsvorgang gibt diese Position wieder; die App behauptet nichts, was die AGB nicht hergeben (2026-08-24)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Getrennt von PROJ-41 | Die Preisanzeige kann sofort live gehen; das Rechtliche wartet auf eine juristische Rückmeldung. In einem Spec würde eines das andere blockieren | 2026-08-23 |
| Zustimmung pro Buchung, nicht einmalig beim Konto | Eine einmalige Zustimmung „für immer" wäre bei geänderten AGB schwer nachweisbar; pro Buchung ist eindeutig, was galt | 2026-08-23 |
| Häkchen nicht vorausgefüllt | Eine vorausgewählte Zustimmung ist keine; das ist einer der häufigsten Fehler bei Online-Bestellungen | 2026-08-23 |
| Zahlungspflicht-Beschriftung nur, wo bezahlt wird | Bei einer kostenlosen Probestunde eine Zahlungspflicht zu behaupten, wäre falsch und würde Kunden abschrecken | 2026-08-23 |
| Knopf heißt „Rechtlich verbindlich buchen", einheitlich für Abo, Probestunde und Drop-in | Vom Betreiber gewählt (2026-08-24), nachdem die Umbenennung zunächst zurückgestellt war. Hinweis des Entwicklers: Bei der regulären Anmeldung ist die Absendung ein bindender Antrag, den der Betreiber erst bestätigt — die Erfolgsmeldung sagt daher weiterhin „Anfrage gesendet" | 2026-08-24 |
| Kundenseitige Texte sprechen von einer „Buchung", nicht von einer „Anfrage" | Nach „rechtlich verbindlich buchen" liest sich „Anfrage gesendet", als hätte der Klick nichts bewirkt. Aus Sicht des Betreibers bleibt es eine Anfrage — dort ändert sich die Wortwahl nicht | 2026-08-24 |
| Der AGB-Stand kommt aus der Server Action, nicht aus dem Browser | Der Client kennt nur seine eigene Handlung. Käme der Stand von ihm, wäre der Nachweis fälschbar | 2026-08-24 |
| Umbuchen verlangt eine eigene Zustimmung, statt die der Ursprungsbuchung zu übernehmen | Der Übernahme-Parameter war eine Hintertür: mit einer beliebigen Kennung entstand eine Buchung ganz ohne Zustimmung. Die Ausnahme ersatzlos zu streichen ist sicherer als sie zu flicken | 2026-08-24 |
| Entweder Zeitpunkt und Fassung oder keins von beiden (CHECK) | Ein halber Nachweis beantwortet keine der beiden Fragen, die er beantworten soll | 2026-08-24 |
| Wartelisten-Knopf bleibt neutral | Ein Wartelisten-Eintrag begründet keine Verpflichtung; „verbindlich buchen" wäre dort schlicht falsch | 2026-08-24 |
| Kein Rücktrittsrecht einräumen; keine Rücktrittsbelehrung im Buchungsvorgang | Vom Betreiber entschieden. Hinweis des Architekten: Ob ein Rücktrittsrecht besteht, folgt aus § 18 Abs. 1 Z 10 FAGG und nicht aus einer Entscheidung des Anbieters — bei der Flatrate, die an keinen bestimmten Termin gebunden ist, ist die Ausnahme weniger eindeutig als bei einem Kurs mit festem Wochentermin. Ungeprüft | 2026-08-24 |
| Inhalt der AGB bleibt außen vor | Die App kann dafür sorgen, dass zugestimmt wird — was zugestimmt wird, muss ein Jurist verantworten | 2026-08-23 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| AGB-Stand als gepflegte Angabe, nicht als Prüfsumme über den Text | Eine Prüfsumme änderte sich schon bei einem korrigierten Komma und täuschte damit einen Rechtsstand vor, der sich nie geändert hat | 2026-08-24 |
| Angezeigter und gespeicherter Stand kommen aus derselben Quelle | Sonst könnten AGB-Seite und Nachweis auseinanderlaufen — der Nachweis wäre dann wertlos | 2026-08-24 |
| Zustimmung wird serverseitig erzwungen | Ein Häkchen im Browser ist eine Behauptung des Browsers, wie der Preis in PROJ-41 | 2026-08-24 |
| Zwei Felder auf Buchung, Ticket und Wartelisten-Eintrag statt einer eigenen Tabelle | Die Zustimmung gehört zum Vorgang und wird immer mit ihm gelesen; eine Nebentabelle wäre ein Join ohne Nutzen | 2026-08-24 |
| Altbestand bleibt leer und wird als „—" angezeigt | Ein erfundener Zeitpunkt wäre ein falscher Nachweis — schlechter als gar keiner | 2026-08-24 |
| Umfang auf die AGB-Zustimmung reduziert; Hinweisblock und Rücktrittsbelehrung zurückgestellt | Vom Betreiber entschieden. In Out of Scope festgehalten, damit später erkennbar bleibt, dass sie bewusst fehlen und nicht vergessen wurden | 2026-08-24 |
| Zeitpunkt und AGB-Stand werden trotz „nur eine Checkbox" gespeichert | Ein Häkchen, das nirgends ankommt, ist Dekoration — für den Kunden unsichtbar und ohne zusätzliche Bedienung | 2026-08-24 |
| Keine Zustimmung bei der Registrierung | Dort entsteht keine Zahlungspflicht; die Zustimmung sitzt, wo eine Verpflichtung entsteht | 2026-08-24 |

---

## Tech Design (Solution Architect)

> Entworfen wird das **Verfahren**, nicht der Rechtstext. Umfang am 2026-08-24 auf Wunsch des
> Betreibers auf die AGB-Zustimmung reduziert. Eine juristische Prüfung steht aus.

### A) Component Structure (Visual Tree)

```
Buchungsdialog (bestehend)
└── direkt über dem Absende-Knopf: NEU
    ☐ Ich habe die AGB gelesen und akzeptiere sie.        [AGB]
        └── nicht vorausgewählt · Link öffnet einen neuen Tab
    Absende-Knopf bleibt gesperrt, solange das Häkchen fehlt

Ticketkauf-Dialog (bestehend)
└── dasselbe Häkchen, dieselbe Sperre

Verwaltung → Buchungen (bestehend)
└── pro Zeile NEU: „AGB 24.08.2026 (Stand 2026-08)"   ·   ohne Zustimmung: „—"
```

Keine neue Seite. Zwei bestehende Dialoge bekommen eine Zeile, eine bestehende Liste
eine Angabe.

### B) Data Model (plain language)

```
Jede Buchung und jedes Ticket hält künftig zusätzlich fest:
- Wann zugestimmt wurde           (Zeitpunkt)
- Welchem Stand zugestimmt wurde  ("2026-08")

Beides darf leer sein: Vorgänge von vor der Einführung haben keine Zustimmung,
und das soll auch so aussehen.
```

**Der AGB-Stand steht an genau einer Stelle im Code** und wird von dort zweifach benutzt:
für die Überschrift „Stand: …" auf der AGB-Seite und für das, was bei der Zustimmung
gespeichert wird. So können angezeigte und gespeicherte Fassung nicht auseinanderlaufen.

### C) Tech Decisions (justified for PM)

- **Zeitpunkt und Stand werden mitgespeichert, obwohl der Betreiber „nur eine Checkbox"
  wollte.** Das ist kein zusätzliches Feature, sondern das, was die Checkbox überhaupt
  wertvoll macht: Ein Häkchen, das nirgends ankommt, ist Dekoration. Beides ist für den
  Kunden unsichtbar und kostet keine zusätzliche Bedienung.

- **Zustimmung gehört zur Buchung, nicht zum Konto.** Wer vor einem Jahr einmal zugestimmt
  hat, hat einem anderen Text zugestimmt. Pro Vorgang ist eindeutig, was galt.

- **Ein gepflegter Stand statt einer automatischen Prüfsumme über den Text.** Eine Prüfsumme
  änderte sich schon bei einem korrigierten Komma und täuschte damit eine Änderung des
  Rechtsstands vor, die nie stattgefunden hat.

- **Der Server lässt eine Buchung ohne Zustimmung nicht durch.** Ein Häkchen im Browser ist
  eine Behauptung des Browsers — wie der Preis in PROJ-41 entscheidet die Datenbank.

- **Der AGB-Link öffnet einen neuen Tab.** Eine Zustimmung ist nur dann eine, wenn man den
  Text lesen konnte, ohne sein halb ausgefülltes Formular zu verlieren.

- **Altbestand bleibt sichtbar leer.** „—" statt eines erfundenen Zeitpunkts: ein falscher
  Nachweis ist schlechter als gar keiner.

- **Keine Zustimmung bei der Registrierung.** Dort entsteht keine Verpflichtung; die
  Zustimmung sitzt, wo eine entsteht.

### D) Dependencies (packages to install)

Keine.

### Umfang

Erweitert: Buchungs-, Wartelisten- und Ticket-Datensätze um zwei Felder; zwei Dialoge um
eine Zeile; die serverseitige Prüfung; die Verwaltungsansicht um die Nachweis-Anzeige.

### Ausdrücklich nicht Teil dieses Entwurfs

Der Wortlaut der AGB. Der Hinweisblock über dem Knopf, die Rücktrittsbelehrung und die
Formulierung „zahlungspflichtig buchen" — am 2026-08-24 zurückgestellt und in
Out of Scope festgehalten, damit später nachvollziehbar bleibt, dass sie bewusst fehlen.

## Implementation Notes (Frontend)

**Stand:** Frontend umgesetzt am 2026-08-24.

### Was gebaut wurde
- `src/lib/legal.ts` — `AGB_VERSION = "2026-08"` und `formatAgbVersion()`. Die **eine**
  Stelle, aus der sowohl die Überschrift „Stand: August 2026" auf der AGB-Seite als auch
  der später gespeicherte Nachweis stammen. Bei einer inhaltlichen AGB-Änderung ist hier
  hochzuzählen; der Kommentar sagt das ausdrücklich.
- `src/components/booking/terms-consent.tsx` — das Häkchen mit AGB-Link. Nie vorausgewählt,
  Link mit `target="_blank"`, `stopPropagation` auf dem Link, weil er im Label sitzt und
  sonst beim Nachlesen das Häkchen umschalten würde.
- Buchungsdialog: Häkchen über dem Knopf, `canSubmit` beginnt jetzt mit `!termsAccepted`.
- Ticketkauf-Dialog: dasselbe Häkchen, Knopf gesperrt bis gesetzt.
- AGB-Seite bezieht ihren Stand aus der Konstante statt aus fest getipptem Text.

### Ein Fehler, der beim Bauen auffiel
Der Ticketkauf-Dialog bleibt **gemountet**, wenn er geschlossen wird — anders als der
Buchungsdialog, der in allen drei Aufrufern bedingt gemountet ist. Ohne Gegenmaßnahme wäre
das Häkchen beim zweiten Ticketkauf noch gesetzt gewesen, und eine vorausgehakte Zustimmung
ist keine. Ein `useEffect` setzt es beim Öffnen zurück. Im Browser beide Richtungen geprüft.

### Geprüft
- `npm test` 303 grün (4 neue für `formatAgbVersion`), `npm run lint` und `npm run build` sauber.
- Im Browser: Häkchen unvorausgewählt, „Absenden" gesperrt ohne / frei mit Häkchen,
  AGB-Link zeigt auf `/agb` mit `target="_blank"`, Ticket-Häkchen beim zweiten Öffnen
  wieder leer, AGB-Seite zeigt „Stand: August 2026".

### Knopfbeschriftung (nachgereicht am 2026-08-24)
„Absenden" heißt jetzt **„Rechtlich verbindlich buchen"**. Der Wartelisten-Zweig behält
„Auf Warteliste eintragen": ein Eintrag dort begründet keine Verpflichtung.

Die Umbenennung brach die Selektoren in **sieben** bestehenden Suiten, dazu kam die neue
Zustimmungs-Sperre. Beides in einem Zug nachgezogen: 24 Stellen setzen jetzt vor dem
Absenden ein `check()` auf das Häkchen — `check()` und nicht `click()`, weil ein zweiter
Klick die Zustimmung wieder abwählen würde. Wo ein Test die Sperre selbst prüft (fehlende
Angabe zur Herkunft, fehlende Vorkenntnis-Bestätigung, fehlende Abo-Art), wird die
Zustimmung **vor** der Prüfung gesetzt, damit die Behauptung des Tests weiterhin die
Ursache trifft, die sie benennt.

Ergebnis: PROJ-8, PROJ-12, PROJ-26, PROJ-27, PROJ-30 zusammen **45 grün**; PROJ-41
**17 grün**; PROJ-15 11 von 12 — der eine Fehlschlag ist der in PROJ-41 bereits
nachgewiesene, von der Doppelanmeldungs-Sperre aus PROJ-8 verursachte.

### Offen für /backend
- Spalten für Zeitpunkt und AGB-Stand auf `course_bookings`, `waitlist_entries`, `tickets`.
- **Serverseitige Ablehnung** einer Buchung ohne Zustimmung — heute sperrt nur die
  Oberfläche, und die ist eine Behauptung des Browsers.
- Der Buchungsdialog schickt `terms_accepted` und `terms_version` bereits mit; sie werden
  noch nirgends gelesen. Der Ticketkauf übergibt noch nichts, weil `purchaseTicket`
  Positionsargumente nimmt — der Parameter gehört zur Server-Seite.
- Nachweis-Anzeige in der Verwaltung, mit „—" für Vorgänge von vor der Einführung.
- [erledigt 2026-08-24] Der Knopf sagte „Rechtlich verbindlich buchen", die Erfolgsmeldung danach
  „Anfrage gesendet" — beides für sich richtig, zusammen widersprüchlich. Die kundenseitigen
  Texte sprechen jetzt einheitlich von einer Buchung; die Verwaltung und die Benachrichtigung
  an den Betreiber sagen weiterhin „Buchungsanfrage", weil es aus seiner Sicht genau das ist.

---


---

## Implementation Notes (Backend)

**Stand:** Backend umgesetzt am 2026-08-24.

### Serverseitige Durchsetzung
Vier Funktionen lehnen jetzt ab, was ohne Zustimmung hereinkommt:
`create_regular_course_booking`, `create_self_service_booking`, `join_waitlist`,
`purchase_event_ticket`. Die Prüfung steht **vor** allen anderen — ohne Zustimmung ist die
Frage nach Kapazität oder Rollenverhältnis gegenstandslos.

**Der AGB-Stand kommt nicht vom Browser.** Der Client schickt nur, *ob* zugestimmt wurde —
das ist seine Handlung. *Welcher Stand* galt, setzt die Server Action aus `AGB_VERSION`
(`src/lib/legal.ts`) ein. Käme er aus dem Browser, wäre der Nachweis fälschbar; läge er in
einer eigenen Tabelle, gäbe es zwei Orte, die auseinanderlaufen können.

### Sicherheitsbefund während der Umsetzung
Die erste Fassung hatte einen Parameter `p_carry_terms_from` für das Umbuchen: dort
entsteht keine neue Verpflichtung, also sollte die Zustimmung der Ursprungsbuchung
mitwandern. Der Angriffstest zeigte, dass er eine **Hintertür** war: zeigte er auf eine
fremde oder erfundene Buchung, lieferte das SELECT keine Zeile, die Variablen blieben
leer — und die Buchung entstand ganz ohne Zustimmung. Der Aufruf stand jedem eingeloggten
Kunden offen.

Die fremde Kennung allein zu prüfen hätte nicht gereicht: Wer eine eigene Buchung von vor
der Einführung besitzt, hätte damit beliebig viele weitere ohne Zustimmung erzeugen können.
In einem Feature, dessen einziger Zweck die Nachweisbarkeit ist, ist eine schmale Lücke
immer noch eine Lücke. Der Sonderweg wurde deshalb **ganz entfernt**: Auch beim Umbuchen
wird zugestimmt. Das kostet ein Häkchen in einem selten benutzten Dialog und macht die
Regel ausnahmslos.

### Wartelisten-Nachrückung
Die Zustimmung wandert vom Wartelisten-Eintrag auf die entstehende Anfrage. Sie dort neu zu
stempeln wäre falsch: zugestimmt hat der Kunde beim Eintragen, und „jetzt" wäre der
Zeitpunkt, zu dem der Betreiber geklickt hat.

### Datenmodell
Zwei Spalten auf `course_bookings`, `waitlist_entries` und `tickets`, dazu je eine
Bedingung: **entweder beides oder nichts**. Ein Zeitpunkt ohne Fassung sagt nicht, wozu
zugestimmt wurde; eine Fassung ohne Zeitpunkt nicht, ob überhaupt.

### Verwaltung
Neue Spalte „AGB" in der Buchungsliste: „24.8.2026 (Stand 2026-08)", bei Vorgängen von vor
der Einführung „—".

### Migrationen
| Datei | Inhalt |
|---|---|
| `20260824015757_proj42_terms_consent_columns.sql` | Spalten + Bedingungen |
| `20260824015822_proj42_enforce_terms_on_self_service_booking.sql` | Probestunde/Drop-in (erste Fassung) |
| `20260824015847_proj42_enforce_terms_on_regular_booking.sql` | reguläre Anmeldung |
| `20260824015915_proj42_enforce_terms_on_waitlist_and_tickets.sql` | Warteliste + Ticketkauf |
| `20260824015933_proj42_carry_terms_on_waitlist_promotion.sql` | Zustimmung beim Nachrücken |
| `20260824020414_proj42_close_carry_terms_bypass.sql` | **Sicherheitsfix**: Sonderweg entfernt |

Alle angewendet und exportiert. Jede Funktion wurde per MD5-Vergleich gegen
`pg_proc.prosrc` geprüft — die Exportdateien stimmen bit-genau mit der Datenbank überein.
Jede Funktion hat genau eine Signatur; die alten wurden per `drop function` entfernt.

### Geprüft
- Angriffstest: ohne Zustimmung, mit `false`, mit leerem Stand, per direktem Insert an der
  Funktion vorbei, über die Umbuch-Hintertür — **alle abgewiesen**. Gegenprobe mit
  Zustimmung legt an und trägt Zeitpunkt und Stand.
- Durchgehender Weg im Browser: buchen mit Häkchen → Datenbank hält Zeitpunkt und
  „2026-08" → Verwaltung zeigt „24.8.2026 (Stand 2026-08)".
- `npm test` 303 grün, `npm run lint` und `npm run build` sauber.
- PROJ-39s Vitest-Tests rufen die Funktion direkt auf und mussten die Zustimmung
  mitschicken — dort wird der Missbrauchsschutz geprüft, nicht die Zustimmung.

---

## QA Test Results
_To be added by /qa_

---

## Deployment
_To be added by /deploy_
