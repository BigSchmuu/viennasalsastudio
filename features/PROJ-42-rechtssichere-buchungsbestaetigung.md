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
- [ ] Angenommen der Kunde bucht ein Abo, dann wird er über sein Rücktrittsrecht **so informiert, wie es die AGB festlegen** — derzeit § 4: bei Kursen mit festem Wochentermin besteht kein 14-tägiges Rücktrittsrecht (§ 18 Abs. 1 Z 10 FAGG), das Abo ist aber jederzeit pausier- und kündbar.

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
- [ ] Reichen die vorgesehenen Maßnahmen juristisch aus? → **Weiterhin offen.** Der Betreiber hat entschieden, zunächst nur das Verfahren zu bauen (Häkchen, Zeitstempel, AGB-Stand, Beschriftung) und die Texte unverändert aus den bestehenden AGB zu übernehmen. Eine juristische Prüfung steht aus; sie wäre danach reine Textarbeit (2026-08-24)
- [ ] Wie wird mit Bestandskunden umgegangen, die nie zugestimmt haben? → Offen; hängt von der juristischen Einschätzung ab.
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
| Inhalt der AGB bleibt außen vor | Die App kann dafür sorgen, dass zugestimmt wird — was zugestimmt wird, muss ein Jurist verantworten | 2026-08-23 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| AGB-Stand als gepflegte Angabe, nicht als Prüfsumme über den Text | Eine Prüfsumme änderte sich schon bei einem korrigierten Komma und täuschte damit einen Rechtsstand vor, der sich nie geändert hat | 2026-08-24 |
| Angezeigter und gespeicherter Stand kommen aus derselben Quelle | Sonst könnten AGB-Seite und Nachweis auseinanderlaufen — der Nachweis wäre dann wertlos | 2026-08-24 |
| Zustimmung wird serverseitig erzwungen | Ein Häkchen im Browser ist eine Behauptung des Browsers, wie der Preis in PROJ-41 | 2026-08-24 |
| Zwei Felder auf Buchung, Ticket und Wartelisten-Eintrag statt einer eigenen Tabelle | Die Zustimmung gehört zum Vorgang und wird immer mit ihm gelesen; eine Nebentabelle wäre ein Join ohne Nutzen | 2026-08-24 |
| Altbestand bleibt leer und wird als „—" angezeigt | Ein erfundener Zeitpunkt wäre ein falscher Nachweis — schlechter als gar keiner | 2026-08-24 |
| Rücktritts-Hinweis gibt § 4 der AGB wieder | Ein Hinweis, der großzügiger klingt als die AGB, wirkt im Streitfall gegen den Betreiber. Vom Betreiber entschieden | 2026-08-24 |
| Keine Zustimmung bei der Registrierung | Dort entsteht keine Zahlungspflicht; die Zustimmung sitzt, wo eine Verpflichtung entsteht | 2026-08-24 |

---

## Tech Design (Solution Architect)

> Entworfen wird das **Verfahren**, nicht der Rechtstext. Alle Texte stammen unverändert aus
> den bestehenden AGB. Eine juristische Prüfung steht aus; sie wäre danach reine Textarbeit,
> weil kein Rechtsinhalt in der Mechanik steckt.

### A) Component Structure (Visual Tree)

```
Buchungsdialog (bestehend)
└── unterhalb des Formulars, direkt über dem Knopf: NEU „Bevor du buchst"
    ├── Was es kostet        65,00 € pro Monat
    ├── Wie abgerechnet wird alle 4 Wochen per SEPA-Lastschrift
    ├── Wie du rauskommst    jederzeit im Profil kündbar, wirksam zum Zyklusende
    ├── Rücktritt            bei festem Wochentermin kein 14-Tage-Rücktritt (§ 4 AGB)
    └── ☐ Ich habe die AGB gelesen und stimme ihnen zu.   [AGB öffnen]
            └── nicht vorausgewählt · Link öffnet in neuem Tab

    Knopf darunter — Beschriftung richtet sich nach der Zahlungspflicht:
      Abo / Drop-in / Ticket mit Preis  →  „Zahlungspflichtig buchen"
      Probestunde, kostenloses Event    →  „Probestunde buchen" (neutral)
      Warteliste                        →  „Auf Warteliste eintragen" (neutral)

Ticketkauf-Dialog (bestehend)
└── dieselbe Zustimmung, derselbe Knopf-Regelsatz

Verwaltung → Buchungen (bestehend)
└── pro Zeile NEU: „AGB zugestimmt am 24.08.2026 (Stand 2026-08)"
       fehlt die Zustimmung (Buchung von vor der Einführung): „—"
```

Es entsteht **keine neue Seite**. Zwei bestehende Dialoge bekommen einen Abschnitt, ein
bestehender Knopf eine genauere Beschriftung, eine bestehende Liste eine Spalte.

### B) Data Model (plain language)

```
Jede Buchung und jedes Ticket hält künftig zusätzlich fest:
- Wann zugestimmt wurde        (Zeitpunkt)
- Welchem Stand zugestimmt wurde ("2026-08")

Beides darf leer sein: Buchungen von vor der Einführung haben keine Zustimmung,
und das soll auch so aussehen — eine nachträglich erfundene wäre wertlos.

Der Wartelisten-Eintrag hält dasselbe fest und gibt es beim Nachrücken an die
entstehende Anfrage weiter.
```

**Der AGB-Stand steht an genau einer Stelle im Code** und wird von dort aus zweifach benutzt:
für die Überschrift „Stand: …" auf der AGB-Seite und für das, was bei der Zustimmung
gespeichert wird. So kann die angezeigte Fassung nicht von der gespeicherten abweichen.

### C) Tech Decisions (justified for PM)

- **Zustimmung gehört zur Buchung, nicht zum Konto.** Ein Kunde, der vor einem Jahr einmal
  zugestimmt hat, hat einem anderen Text zugestimmt. Pro Buchung ist eindeutig, was galt.

- **Ein gepflegter Stand statt einer automatischen Prüfsumme.** Eine Prüfsumme über den
  Text wäre bequem, würde sich aber schon bei einem korrigierten Komma ändern und dann
  einen Rechtsstand vortäuschen, der sich nie geändert hat. Der Stand wird bewusst gesetzt,
  wenn sich inhaltlich etwas ändert — so bedeutet er auch etwas.

- **Der Server lässt eine Buchung ohne Zustimmung nicht durch.** Ein Häkchen im Browser ist
  eine Behauptung des Browsers. Genau wie beim Preis in PROJ-41 entscheidet die Datenbank.

- **Die Beschriftung folgt der tatsächlichen Zahlungspflicht.** „Zahlungspflichtig buchen"
  bei einer kostenlosen Probestunde wäre schlicht falsch — und würde Interessenten
  abschrecken, die genau über diese Probestunde kommen sollen.

- **Der Rücktritts-Hinweis gibt die AGB wieder, statt ein Recht zu behaupten.** § 4 der AGB
  schließt das 14-Tage-Recht für Kurse mit festem Wochentermin aus. Ein Hinweis, der
  großzügiger klingt als die AGB, wäre ein Versprechen, das im Streitfall gegen den
  Betreiber wirkt.

- **Der AGB-Link öffnet einen neuen Tab.** Eine Zustimmung ist nur dann eine, wenn man den
  Text lesen konnte, ohne dafür sein halb ausgefülltes Formular zu verlieren.

- **Altbestand bleibt sichtbar leer.** Buchungen von vor der Einführung zeigen „—" statt
  eines erfundenen Zeitpunkts. Ein falscher Nachweis ist schlechter als gar keiner.

### D) Dependencies (packages to install)

Keine.

### Umfang

Erweitert: Buchungs-, Ticket- und Wartelisten-Datensätze um zwei Felder; zwei Dialoge um
einen Hinweisabschnitt mit Häkchen; die Knopfbeschriftungen; die Verwaltungsansicht um die
Nachweis-Anzeige; die serverseitige Prüfung. Keine neue Seite, keine neue Tabelle, keine
neue Abhängigkeit.

### Ausdrücklich nicht Teil dieses Entwurfs

Der Wortlaut von AGB, Datenschutzerklärung und Rücktrittsbelehrung. Die Registrierung
bekommt **keine** Zustimmung — sie schließt keinen entgeltlichen Vertrag; die Zustimmung
sitzt dort, wo eine Verpflichtung entsteht.


---

## Implementation Notes
_To be added by /frontend and /backend_

---

## QA Test Results
_To be added by /qa_

---

## Deployment
_To be added by /deploy_
