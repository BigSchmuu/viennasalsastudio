# PROJ-62: Kursbeschreibung und Verlinkung aus dem Stundenplan

## Status: Planned
**Created:** 2026-09-17
**Last Updated:** 2026-09-17

## Dependencies
- Requires: PROJ-3 (Kurse verwalten) — das Formular, in dem die Beschreibung entsteht
- Requires: PROJ-5 (Kurskatalog) — die Kursseite, auf der sie steht
- Requires: PROJ-6 (Stundenplan) — die Karten, die künftig verlinken

## Anlass
Die Website des Studios zeigt den Stundenplan und verlinkt zum Buchen bisher auf Nimbuscloud. Künftig
soll sie auf die Kursseiten der App zeigen. Damit wird die Kursseite zur Landeseite für Interessenten
— und dort steht heute nur, was in Feldern erfasst ist: Level, Tanzstil, Ort, Zeiten, Preis.

Was fehlt, sind die zwei, drei Sätze, die einen Kurs beschreiben: für wen er ist, was man lernt, was
man mitbringen sollte.

Und im Stundenplan der App führt heute kein Weg von einem Kurs zu seiner Seite — man sieht die
Karte, kann buchen, aber nicht nachlesen.

## User Stories
- Als Betreiber möchte ich zu jedem Kurs ein paar Sätze schreiben können, damit ein Interessent weiß, worauf er sich einlässt.
- Als Betreiber möchte ich das weglassen können, wo es nichts zu sagen gibt — nicht jeder Kurs braucht einen Text.
- Als Interessent möchte ich von einem Kurs im Stundenplan zu seiner Seite kommen, statt ihn im Katalog zu suchen.
- Als Besucher von der Website möchte ich auf der Kursseite alles finden, was ich zur Entscheidung brauche.

## Out of Scope
- **Sprechende Kursadressen** — bewusst zurückgestellt; die Kennung in der Adresse bleibt vorerst
- **Die Beschreibung im Katalog oder auf der Stundenplan-Karte** — sie gehört auf die Kursseite; in einer Liste macht sie die Übersicht kaputt
- **Formatierung, Bilder, Links in der Beschreibung** — schlichter Text mit Absätzen, wie bei den Events
- **Eine englische Fassung der Beschreibung** — sie wird einmal eingegeben und in beiden Sprachen so gezeigt, genau wie Kurs- und Eventnamen
- **Änderungen an der Website** — die liegt in einem anderen Projekt

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Die Beschreibung
- [ ] Angenommen ein Admin bearbeitet einen Kurs, wenn das Formular erscheint, dann gibt es ein Feld für eine Beschreibung, und es ist freiwillig
- [ ] Angenommen ein Admin trägt eine Beschreibung ein, wenn er speichert, dann steht sie auf der Kursseite
- [ ] Angenommen eine Beschreibung enthält Absätze, wenn sie angezeigt wird, dann bleiben sie erhalten
- [ ] Angenommen ein Kurs hat keine Beschreibung, wenn jemand die Kursseite öffnet, dann steht dort keine leere Überschrift und keine Lücke
- [ ] Angenommen eine Beschreibung ist eingetragen, wenn ein englischsprachiger Besucher die Seite öffnet, dann steht sie da, wie sie eingegeben wurde — wie der Kursname auch
- [ ] Angenommen jemand trägt ein Skript in die Beschreibung ein, wenn die Seite angezeigt wird, dann wird es nicht ausgeführt

### Der Weg vom Stundenplan
- [ ] Angenommen ein Besucher sieht den Stundenplan, wenn er auf den Namen eines Kurses tippt, dann landet er auf dessen Kursseite
- [ ] Angenommen eine Stundenplan-Karte hat einen Buchen-Knopf, wenn jemand darauf tippt, dann bucht er — der Verweis auf die Kursseite fängt den Klick nicht ab
- [ ] Angenommen ein Besucher ist nicht angemeldet, wenn er dem Verweis folgt, dann sieht er die Kursseite trotzdem

## Edge Cases
- **Sehr lange Beschreibung:** Begrenzt auf 2000 Zeichen, wie bei den Events. Längeres liest ohnehin niemand, und die Seite bliebe sonst nicht mehr überschaubar.
- **Nur Leerzeichen eingetragen:** Gilt als leer — sonst entstünde eine Überschrift über nichts.
- **Ein Kurs im Stundenplan, den es nicht mehr gibt:** Kommt nicht vor; der Stundenplan zeigt nur bestehende Kurse.
- **Die Stundenplan-Karte enthält bereits Knöpfe** (Buchen, Self-Check-in): Deshalb wird nur der Name verlinkt, nicht die ganze Karte.

## Technical Requirements
- Der Text wird beim Anzeigen maskiert — er kommt aus einem Eingabefeld
- Sprache: Das Feld liegt in der Verwaltung (deutsch); die Beschreibung selbst steht in beiden Sprachfassungen so, wie sie eingegeben wurde

## Open Questions
- [ ] Soll die Beschreibung später auch auf der Website erscheinen (über eine Schnittstelle)? Vorschlag: vorerst nicht — die Website hat ihre eigenen Texte

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Nur der Kursname im Stundenplan wird verlinkt, nicht die ganze Karte | Die Karte trägt bereits Knöpfe zum Buchen und zum Self-Check-in. Eine klickbare Karte würde diese Klicks verschlucken oder den Besucher auf einer Seite absetzen, auf die er nicht wollte | 2026-09-17 |
| Die Beschreibung steht nur auf der Kursseite | In der Katalogliste und auf den Stundenplan-Karten würde sie die Übersicht zerstören — dort zählt, dass man zehn Kurse nebeneinander vergleichen kann | 2026-09-17 |
| Eine Beschreibung für beide Sprachen | Wie Kurs- und Eventnamen: einmal eingegeben, überall so gezeigt. Zwei Fassungen zu pflegen wäre Arbeit, die bei fünfzig Kunden niemand leistet — und eine veraltete englische Fassung wäre schlechter als gar keine | 2026-09-17 |
| Höchstens 2000 Zeichen | Dieselbe Grenze wie bei den Events, und aus demselben Grund | 2026-09-17 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Die Längengrenze steht auch in der Datenbank | Das Formular prüft sie ohnehin; die Bedingung in der Tabelle gilt zusätzlich für jeden Weg, der am Formular vorbeiführt | 2026-09-17 |
| Die Absätze bleiben über `whitespace-pre-line` erhalten | Der Text kommt aus einem Eingabefeld. Ihn als Markup zu behandeln hieße, ihn gefahrlos machen zu müssen; so bleibt er schlichter Text, den React maskiert | 2026-09-17 |
| Der sprachbewusste Link im Stundenplan | Ein englischsprachiger Besucher landet auf `/en/kurse/…`, nicht auf der deutschen Fassung | 2026-09-17 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

Eine freiwillige Spalte an `courses`, ein Feld im Kursformular, ein Absatz auf der Kursseite und ein
Verweis im Stundenplan. Keine neue Tabelle, keine neue Funktion, kein neues Paket.

Die Beschreibung steht auf der Kursseite **vor** dem Steckbrief: Sie beantwortet die Frage, die
zuerst kommt („ist das überhaupt mein Kurs?"), während der Steckbrief die Einzelheiten nachreicht.
Fehlt sie, erscheint der Block gar nicht — keine leere Überschrift, keine Lücke.

### Backend nötig?

Eine Migration für die Spalte, sonst nichts.

## QA Test Results (2026-09-17)

**Empfehlung: bereit für die Produktion.**

| | |
|---|---|
| E2E PROJ-62 | 6 grün |
| Regressionsprobe (Kurse, Stundenplan) | 16 grün |
| Unit- und Datenbanktests | 894 grün |
| Produktfehler gefunden | 1 (behoben) |

### Der gefundene Fehler

**Die Beschreibung wäre still verschwunden.** Die Server-Handlung baut ihre Eingabe Feld für Feld
aus dem Formular zusammen — und `description` fehlte in dieser Liste. Das Formular zeigte das Feld,
der Dialog schloss sich nach dem Speichern, und in der Datenbank stand weiterhin nichts. Keine
Fehlermeldung, nirgends.

Gefunden hat es die Prüfung, die das Formular wirklich ausfüllt und danach in der Datenbank
nachsieht. Eine Prüfung, die sich damit begnügt hätte, dass das Feld sichtbar ist, wäre grün
gewesen.

### Was geprüft ist

Ohne Beschreibung bleibt die Kursseite ohne Lücke. Mit Beschreibung erscheinen die Absätze. Nur
Leerzeichen gelten als leer. Ein Skript im Text wird nicht ausgeführt. Der Kursname im Stundenplan
führt auf die Kursseite. Und das Eintragen über das Verwaltungsformular landet wirklich in der
Datenbank.

## Deployment

## Deployment

**Produktion:** https://app.viennasalsastudio.at · **Ausgerollt:** 2026-09-17 · **Tag:** `v1.61.0-PROJ-62`

1. Migration `20260917090000_proj62_kursbeschreibung.sql`
2. Code ausgerollt (Vercel, 2 Minuten Build)

Die Migration musste zuerst laufen, und hier war es ernst: Die Kursseite fragt die neue Spalte mit
ab. Ohne sie hätte die Abfrage nicht funktioniert und **alle Kursseiten** wären ausgefallen — genau
die, auf die die Website künftig verlinken soll.

### Nachgeprüft

Drei Kursseiten liefern 200, und der Stundenplan trägt jetzt Verweise auf die Kursseiten.

### Wozu es dient

Die Website kann ihre Stundenplan-Einträge jetzt direkt auf
`app.viennasalsastudio.at/kurse/<kennung>` zeigen lassen, statt auf das Buchungsformular von
Nimbuscloud. Wer dort nicht angemeldet ist, wird zur Anmeldung geführt und kommt anschließend auf
dieselbe Kursseite zurück.
