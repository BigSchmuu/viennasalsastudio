# PROJ-67: Standort in der Kursstart-Erinnerung

## Status: In Review
**Created:** 2026-09-23
**Last Updated:** 2026-09-23

## Dependencies
- Requires: PROJ-34 (Vorlagen für Benachrichtigungen) — Platzhalter und die anpassbaren Texte
- Requires: PROJ-1 (Grunddaten) — Standorte, Räume, Kurse
- Berührt: PROJ-43 (Englische Sprachvariante) — die Vorgabetexte gibt es in beiden Sprachen

## Anlass

Das Studio hat zwei Standorte. In der Erinnerung am Vorabend stand bisher nur der Kursname — wer
beide Häuser kennt, musste raten, und ab und zu stand jemand am falschen. Die Angabe liegt längst in
der Datenbank: Jeder Kurs hängt an einem Raum, jeder Raum an einem Standort, und der Standort trägt
Namen und Anschrift.

## User Stories

- Als Kunde möchte ich in der Erinnerung lesen, wo der Kurs stattfindet, damit ich nicht am falschen
  Standort stehe.
- Als Kunde möchte ich die Anschrift direkt in der Mitteilung sehen, damit ich sie ins Navi übernehmen
  kann, ohne die App zu öffnen.
- Als Betreiber möchte ich selbst bestimmen, wo im Text die Ortsangabe steht — also einen Platzhalter,
  keine feste Zeile.
- Als Betreiber möchte ich sie auch in der englischen Fassung haben, ohne sie zweimal zu pflegen.

## Out of Scope

- **Andere Benachrichtigungen** — Buchungsbestätigung, Kursausfall und die Event-Nachrichten bleiben
  unverändert. Die Erinnerung ist die Nachricht, die kurz vor dem Hingehen gelesen wird; bei den
  übrigen wäre die Angabe Beiwerk. Nachrüstbar, sobald sich zeigt, dass sie dort fehlt.
- **Ein Kartenlink** (Google Maps, Apple Karten) — die Anschrift genügt fürs Navi, und ein Link auf
  einen fremden Dienst in jeder Erinnerung wäre eine datenschutzrechtliche Frage für sich.
- **Ortsangabe am Kurs selbst** statt am Raum — das Datenmodell führt über den Raum, und ein zweiter
  Weg zum selben Ort liefe früher oder später auseinander.

## Acceptance Criteria

- [ ] Angenommen ein Kunde hat morgen eine Probestunde oder einen Drop-in, wenn die Erinnerung
      verschickt wird, dann stehen Name und Anschrift des Standorts in der E-Mail.
- [ ] Angenommen dieselbe Erinnerung geht als Mitteilung aufs Handy, dann steht der Standort auch
      dort.
- [ ] Angenommen der Betreiber öffnet die Vorlage in der Verwaltung, dann stehen `{ort}` und
      `{adresse}` in der Liste der verfügbaren Platzhalter, samt Beispielwerten in der Vorschau.
- [ ] Angenommen der Standort hat keine Anschrift hinterlegt, wenn die Erinnerung entsteht, dann
      steht nur der Name dort — ohne Komma, hinter dem nichts mehr kommt.
- [ ] Angenommen ein Kurs hätte gar keinen Standort, wenn die Erinnerung entsteht, dann tritt der
      Raumname an seine Stelle, und die Erinnerung geht trotzdem raus.
- [ ] Angenommen der Empfänger hat Englisch gewählt, dann enthält auch die englische Vorgabe die
      Ortsangabe.
- [ ] Angenommen die Erinnerung enthält den Standort, dann nennt sie weiterhin Kurs, Datum und Art
      der Buchung.

## Edge Cases

- **Angepasster Text**: Wer die Vorlage in der Verwaltung schon einmal geändert hat, hat seine
  eigene Fassung — und die kennt den neuen Platzhalter nicht. Die Angabe erscheint dort erst, wenn
  der Betreiber `{ort}` selbst einfügt. Der Editor führt ihn jetzt in der Liste.
- **Standort ohne Anschrift**: nur der Name, sauber gesetzt.
- **Langer Name plus Anschrift auf dem Sperrbildschirm**: Die Mitteilung kürzt das System selbst ab;
  Kurs und Art stehen vorn, der Ort dahinter.
- **Umbenannter Standort**: Die Erinnerung liest bei jedem Versand neu — ein umbenannter Standort
  steht sofort richtig drin.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Platzhalter statt fester Zeile | Der Betreiber hat darum gebeten und kann so selbst bestimmen, wo die Angabe steht. Der Preis dafür ist der Sonderfall „angepasster Text" — dort muss er den Platzhalter einmal selbst einsetzen. | 2026-09-23 |
| Zwei Platzhalter: `{ort}` und `{adresse}` | `{ort}` trägt den fertigen Satzteil „Name, Anschrift"; `{adresse}` gibt die Anschrift allein für alle, die ihren Satz selbst bauen. | 2026-09-23 |
| Nur die Kursstart-Erinnerung | Sie ist die Nachricht, die kurz vor dem Hingehen gelesen wird. | 2026-09-23 |

### Technical Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Zusammensetzen im Code, nicht in der Vorlage | „{ort}, {adresse}" hinterließe bei einem Standort ohne Anschrift ein Komma, hinter dem nichts kommt. Der fertige Wert entsteht deshalb in `ortMitAdresse()`. | 2026-09-23 |
| Rückfall auf den Raumnamen | Ein Satz, der mit einem Doppelpunkt ins Leere läuft, ist schlimmer als ein ungenauer Ort. | 2026-09-23 |
| `resolveContent` nach außen geöffnet | Ob aus einer Buchung wirklich Kurs, Termin **und** Standort werden, war sonst nur am verschickten Text zu sehen — und Tests verschicken nichts. | 2026-09-23 |

---

## QA Test Results (2026-09-23)

**Empfehlung: bereit für die Produktion.** Keine Migration, keine Datenbankänderung.

| | |
|---|---|
| Regeln (Unit) | 6 für die Ortsangabe, 2 für die Erinnerung |
| Datenbank | 4 |
| Produktfehler gefunden | 0 |

### Was geprüft ist

**Die Verknüpfung** gegen die echte Datenbank: Standort mit Anschrift anlegen, Raum darin, Kurs
darin, Buchung darauf — und dann prüfen, dass im erzeugten Text wirklich Standort und Anschrift
stehen, in E-Mail wie in der Mitteilung aufs Handy. Genau diese Kette (Buchung → Kurs → Raum →
Standort) kann man nicht im Trockenen prüfen.

**Die Sonderfälle**: Standort ohne Anschrift (nur der Name, kein loses Komma), fehlender Standort
(Raumname tritt ein), und dass Kurs, Datum und Buchungsart weiterhin drinstehen.

**Beide Sprachen**: Der bestehende Test über alle Vorlagen hält fest, dass die englische Fassung
dieselben Platzhalter trägt wie die deutsche — eine vergessene Ortsangabe in der englischen Vorgabe
fiele damit auf.

### Nicht geprüft

Ob eine bereits angepasste Vorlage in der Produktion den Platzhalter enthält — das sieht nur der
Betreiber in seiner Verwaltung.

## Deployment

**Produktion:** https://app.viennasalsastudio.at · **Ausgerollt:** 2026-09-23 · **Tag:** `v1.66.0-PROJ-67`

Keine Migration — reiner Code.

### Nachgeprüft

Von außen nur die Erreichbarkeit: Startseite, Kurse und FAQ liefern 200, `/admin/benachrichtigungen`
weist Nicht-Angemeldete ab. Die Wirkung selbst steht im Text einer Erinnerung und ist von außen nicht
sichtbar — der Betreiber sieht sie in der Vorlage (Platzhalter `{ort}` und `{adresse}` mit
Beispielwerten in der Vorschau) und am nächsten Abend an der echten Erinnerung.

**Offen für den Betreiber:** Falls die Vorlage in der Verwaltung schon einmal angepasst wurde, muss
`{ort}` dort von Hand ergänzt werden — eine eigene Fassung kennt den neuen Platzhalter nicht.

### Zurückrollen

Gefahrlos: Die vorige Fassung kennt die Platzhalter nicht und verschickt den alten Text. An den Daten
ändert sich nichts.
