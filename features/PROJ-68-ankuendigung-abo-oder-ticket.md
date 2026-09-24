# PROJ-68: Vorabankündigung sagt, wofür abgebucht wird

## Status: In Review
**Created:** 2026-09-24
**Last Updated:** 2026-09-24

## Dependencies
- Requires: PROJ-7 (SEPA-Mandate & Sammel-Einzug) — die Vorabankündigung
- Requires: PROJ-14 (Event-Tickets per Lastschrift) — seither ist eine Position Abo **oder** Ticket
- Requires: PROJ-34 (Vorlagen für Benachrichtigungen) — die anpassbaren Texte
- Berührt: PROJ-47 (Freigabe des Laufs) — dort entsteht die Ankündigung

## Anlass

Der Betreiber fragte, ob er Kunden monatlich daran erinnern muss, dass ihr Abo weiterläuft. Eine
rechtliche Antwort kann die App nicht geben — aber die monatliche Vorabankündigung vor dem Einzug
geht ohnehin an jeden Abo-Kunden, und ein zusätzlicher Satz dort kostet nichts.

Beim Einbauen fiel auf: Dieselbe Ankündigung geht auch an Kunden, deren **Event-Ticket** per
Lastschrift eingezogen wird. „Dein Abo läuft weiter" hätte dort gestanden, wo es nichts gibt, das
weiterläuft. Die Nachricht wusste bis jetzt nicht, wofür sie ankündigt: In der Warteschlange standen
nur Betrag und Datum.

## User Stories

- Als Abo-Kunde möchte ich in der Ankündigung lesen, dass mein Abo weiterläuft und wie ich es
  beende, damit ich nicht erst suchen muss.
- Als Ticketkäufer möchte ich lesen, dass es eine einmalige Abbuchung ist, damit ich nicht glaube,
  etwas abonniert zu haben.
- Als Betreiber möchte ich beide Texte selbst formulieren können.

## Out of Scope

- **Rechtliche Bewertung**, ob eine monatliche Erinnerung Pflicht ist — das beantwortet die WKO oder
  eine Anwältin, nicht diese Spec. Der Satz ist gute Praxis, keine Rechtsauskunft.
- **Eine eigene Benachrichtigung** zusätzlich zur Ankündigung — der Hinweis gehört dorthin, wo der
  Kunde ohnehin hinschaut, nicht in eine zweite Mail.
- **Kündigungsknopf in der Mail** — die Selbstbedienung im Profil gibt es seit PROJ-9; ein Link aus
  der Mail wäre ein eigenes Projekt.

## Acceptance Criteria

- [ ] Angenommen ein Lauf enthält eine Abo-Position, wenn der Betreiber ihn freigibt, dann trägt die
      Ankündigung dieses Kunden die Art „abo".
- [ ] Angenommen ein Lauf enthält ein Event-Ticket, dann trägt dessen Ankündigung die Art „ticket".
- [ ] Angenommen die Ankündigung gilt einem Abo, wenn sie verschickt wird, dann steht darin, dass das
      Abo weiterläuft und wo es sich pausieren oder kündigen lässt.
- [ ] Angenommen die Ankündigung gilt einem Ticket, dann steht darin, dass es eine einmalige
      Abbuchung ist — und nichts von einem Abo.
- [ ] Angenommen eine Ankündigung war schon vor dieser Änderung in der Warteschlange, wenn sie
      verschickt wird, dann gilt die Abo-Fassung, und sie geht raus.
- [ ] Angenommen der Betreiber öffnet die Vorlagen, dann findet er beide Fassungen einzeln und kann
      sie getrennt anpassen.
- [ ] Angenommen er hatte die alte Ankündigung angepasst, wenn die Migration läuft, dann steht sein
      Text in beiden neuen Fassungen — nichts geht verloren.

## Edge Cases

- **Alte Zeilen in der Warteschlange**: tragen die Art nicht. Sie gelten als Abo — der Fall, der
  praktisch immer zutrifft — statt ohne Text dazustehen.
- **Angepasste Vorlage**: wird von der Migration auf beide neuen Schlüssel übernommen. Ohne diesen
  Schritt wäre sie stillschweigend wirkungslos geworden, und der Betreiber hätte plötzlich wieder
  den Vorgabetext gesehen, ohne zu wissen, warum.
- **Korrekturlauf zum selben Fälligkeitsdatum**: bekommt eigene Ankündigungen, wie bisher — der
  Schlüssel gegen Doppelversand enthält die Lauf-Kennung.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Zwei Vorlagen statt eines gemeinsamen Textes | Entscheidung des Betreibers: Beide Fälle lassen sich so getrennt formulieren, und in keinem steht je ein Satz, der nicht zutrifft. | 2026-09-24 |
| Der Hinweis steht in der Ankündigung, nicht in einer eigenen Mail | Sie geht ohnehin monatlich raus und wird gelesen, weil es um Geld geht. | 2026-09-24 |

### Technical Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Die Art wandert in die Nutzlast der Warteschlange | Entschieden wird sie beim Freigeben, wo die Position noch vorliegt; beim Versand ist nur die Warteschlangenzeile da. | 2026-09-24 |
| Fehlende Art gilt als „abo" | Zeilen aus der Zeit davor dürfen nicht ohne Text dastehen, und ein Abo ist der praktisch immer zutreffende Fall. | 2026-09-24 |
| Die Migration übernimmt eine angepasste Fassung auf beide Schlüssel | Sonst verschwände die Anpassung lautlos — genau die Sorte Fehler, die niemand bemerkt, bis ein Kunde den falschen Text bekommt. | 2026-09-24 |

---

## QA Test Results (2026-09-24)

**Empfehlung: bereit für die Produktion**, sobald die Migration eingespielt ist.

| | |
|---|---|
| Regeln (Unit) | 3 neu, 124 im Benachrichtigungsbereich insgesamt grün |
| Datenbank | 2 (brauchen die Migration) |
| Produktfehler gefunden | 0 |

### Was geprüft ist

**Die beiden Fassungen**: Beim Abo steht der Hinweis aufs Weiterlaufen und aufs Kündigen, beim
Ticket steht ausdrücklich, dass nichts weiterläuft — und der Abo-Satz steht dort gerade nicht.
Fehlt die Art ganz, gilt die Abo-Fassung.

**Die Vollständigkeit der Vorschau** deckt der Test aus PROJ-67 mit ab: Beide neuen Vorlagen wurden
automatisch mitgeprüft, jeder Platzhalter bekommt einen Wert.

**Die Datenbank**: Ein Lauf mit einer Abo-Position und einem Ticket wird freigegeben, und beide
Ankündigungen müssen die passende Art tragen. Der Test wurde vor dem Einspielen der Migration
absichtlich rot laufen gelassen — er meldete „Unbekannte Art: undefined", also genau die Lücke, die
die Migration schließt.

### Nicht geprüft

Ob eine angepasste Fassung in der Produktion existiert und korrekt übernommen wird — das zeigt sich
erst beim Einspielen. Der Betreiber sieht danach in den Vorlagen zwei Einträge statt einem.
