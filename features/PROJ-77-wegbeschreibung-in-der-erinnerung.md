# PROJ-77: Die Wegbeschreibung in der Kursstart-Erinnerung

## Status: Deployed
**Created:** 2026-10-07
**Last Updated:** 2026-10-07

## Dependencies
- Requires: PROJ-67 (Standort in der Erinnerung) — dieselbe Stelle, derselbe Baukasten
- Requires: PROJ-34 (Benachrichtigungs-Texte verwalten) — die Vorlage und ihre Vorschau
- Requires: PROJ-3 (Standortverwaltung) — das Feld „Beschreibung" am Standort

## Anlass

Wunsch des Betreibers: „Bei den Benachrichtigungen für die Kurserinnerung möchte ich gerne noch die
Beschreibung, die bei den Locations hinterlegt ist, mit aufnehmen. Da ist eine Beschreibung dabei, wie
die Kurslocation gefunden werden kann."

Seit PROJ-67 steht in der Erinnerung, **welcher** Standort gemeint ist. Wie man ihn findet, stand
weiterhin nur in der Standortverwaltung — im Feld „Beschreibung", das niemand außer der Verwaltung zu
sehen bekam. Für einen Hinterhof mit Klingelschild im zweiten Stock ist der Name allein wenig wert.

## User Stories

- Als Kunde möchte ich in der Erinnerung lesen, wie ich den Eingang finde.
- Als Betreiber möchte ich diese Beschreibung **einmal** am Standort pflegen, nicht in jedem
  Vorlagentext.
- Als Betreiber möchte ich, dass ein Standort ohne Beschreibung keine halben Sätze erzeugt.

## Out of Scope

- **Andere Benachrichtigungen.** Nur die Kursstart-Erinnerung. Für Buchungsbestätigung oder Event-Mails
  wäre es dieselbe Handvoll Zeilen, aber es war nicht gewünscht.
- **Die Push-Nachricht.** Eine Wegbeschreibung ist dort zu lang; am Handy steht weiterhin Kurs, Art
  und Standort.
- **Ein eigener Absatz** in der E-Mail. Der Text wird als ein Absatz gerendert (`<p>`); ein Umbruch
  wäre dort unsichtbar. Die Wegbeschreibung steht deshalb als Satz hinter dem Standort.
- **Ein eigenes Feld** für die Wegbeschreibung. Die vorhandene „Beschreibung" ist genau das, was der
  Betreiber meint — ein zweites Feld daneben wäre nur eine zweite Stelle zum Pflegen.

## Acceptance Criteria

- [ ] Angenommen am Standort ist eine Beschreibung hinterlegt, wenn die Erinnerung hinausgeht, dann
      steht sie als Satz in der E-Mail: „So findest du uns: …".
- [ ] Angenommen der Empfänger hat Englisch eingestellt, dann lautet die Einleitung „Here is how to
      find us: …".
- [ ] Angenommen am Standort ist **keine** Beschreibung hinterlegt, dann steht in der E-Mail kein
      Satzanfang ohne Fortsetzung — die Einleitung fehlt ganz, der Standort bleibt.
- [ ] Angenommen die Beschreibung enthält Zeilenumbrüche, dann stehen an ihrer Stelle einzelne
      Leerzeichen und keine Lücke mitten im Satz.
- [ ] Angenommen die Verwaltung öffnet die Vorlage, dann steht `{wegbeschreibung}` in der
      Platzhalterliste und die Vorschau zeigt dafür einen Beispielsatz.
- [ ] Angenommen die Push-Nachricht geht hinaus, dann enthält sie die Wegbeschreibung nicht.

## Edge Cases

- **Standort ohne Beschreibung**: Der Platzhalter bleibt leer; das Leerzeichen davor im Vorlagentext
  verschwindet in der E-Mail mit (HTML fasst Leerraum zusammen).
- **Kein Standort am Raum**: unverändert wie in PROJ-67 — der Raumname tritt an die Stelle des Ortes,
  eine Wegbeschreibung gibt es dann nicht.
- **Eigene Fassung des Textes**: Hat der Betreiber den Text der Erinnerung in der Verwaltung bereits
  geändert, liegt in der Datenbank eine eigene Fassung. Die Änderung am Standardtext wirkt dort
  **nicht** — der Platzhalter muss in der Verwaltung selbst eingefügt werden. Er steht dafür in der
  Liste bereit.
- **Sehr lange Beschreibung**: steht vollständig in der E-Mail. Gekürzt wäre sie oft genau um den
  Teil kürzer, der den Weg erklärt.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Der Satz entsteht im Code, nicht in der Vorlage | Stünde die Einleitung im Vorlagentext, bliebe sie bei einem Standort ohne Beschreibung als Satzanfang ohne Fortsetzung stehen. Dieselbe Entscheidung wie bei `{ort}` in PROJ-67. | 2026-10-07 |
| In den Standardtext der E-Mail, nicht in die Push-Nachricht | Am Handy ist der Platz knapp, und eine Wegbeschreibung liest dort niemand. | 2026-10-07 |
| Das bestehende Feld „Beschreibung" wird benutzt | Es enthält genau diese Auskunft. Ein zweites Feld wäre eine zweite Stelle, an der etwas fehlen kann. | 2026-10-07 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Das Leerzeichen steht **vor** dem Platzhalter im Text, nicht im Wert | Bleibt der Platzhalter leer, verschwindet das Leerzeichen in der E-Mail mit — HTML fasst Leerraum zusammen. Ein Leerzeichen im Wert wäre unsichtbar und beim Bearbeiten des Textes nicht nachvollziehbar. | 2026-10-07 |
| Zeilenumbrüche werden zu Leerzeichen | Das Feld ist ein mehrzeiliges Eingabefeld, der E-Mail-Text ein einzelner Absatz. Ein Umbruch wäre unsichtbar, zwei ergäben eine Lücke mitten im Satz. | 2026-10-07 |
| Die Einleitung gibt es zweisprachig im Code | Der Satz entsteht im Code; die Vorlage kann ihn nicht mehr übersetzen. | 2026-10-07 |
| Keine Migration | `locations.description` gibt es seit PROJ-3, samt Feld in der Standortverwaltung. | 2026-10-07 |

---

## Tech Design (Solution Architect)

```
Standortverwaltung: Feld „Beschreibung"   (unverändert)
        │
        ▼
Versand der Erinnerung
  liest Name, Anschrift und Beschreibung des Standorts
  baut daraus drei Bausteine:
     {ort}             „Studio Nord, Musterstraße 1"      (PROJ-67)
     {adresse}         „Musterstraße 1"                   (PROJ-67)
     {wegbeschreibung} „So findest du uns: …" oder nichts  (NEU)
        │
        ▼
Vorlage (Standardtext oder eigene Fassung)  →  E-Mail
Push-Nachricht: ohne Wegbeschreibung
```

Der Baustein entsteht in `lib/notifications/ort.ts`, neben den beiden aus PROJ-67 — dieselbe Datei,
dieselbe Begründung, dieselbe Art zu prüfen. Der Versand liest eine Spalte mehr und gibt die Sprache
des Empfängers mit.

## QA Test Results (2026-10-07)

**Empfehlung: bereit für die Produktion.** Keine Migration.

| | |
|---|---|
| Regeln (Unit) | 5 neu für den Baustein: deutsch, englisch, leer in fünf Varianten, mehrzeilig |
| Datenbank | 2 neu in der PROJ-67-Suite: Satz in der E-Mail und nicht am Handy; ohne Beschreibung keine Einleitung |
| Vorschau | Der Test aus PROJ-67 über alle Platzhalter aller Vorlagen schlug beim neuen sofort zu — Lücke geschlossen |
| Rückblick | PROJ-34 (Vorlagen und Vorschau): 13 Prüfungen grün |
| Gesamt | 1140 Unit- und Datenbankprüfungen grün |
| Produktfehler gefunden | 0 |

### Was geprüft ist

**Der leere Fall** in fünf Varianten: keine Beschreibung, `null`, nur Leerzeichen, kein Standort,
`undefined`. In allen entsteht nichts — und der DB-Test belegt, dass in der fertigen E-Mail dann auch
keine Einleitung steht, der Standort selbst aber schon.

**Die Sprache**: deutsche und englische Einleitung.

**Mehrzeilige Eingabe**: Umbrüche und Leerzeilen werden zu einzelnen Leerzeichen.

**Die Vorschau**: Der Test aus PROJ-67, der jeden angebotenen Platzhalter jeder Vorlage durchprobiert,
fiel beim neuen sofort — genau wofür er gebaut wurde. Die Vorschau zeigt jetzt denselben Satz, den der
Versand baut, nicht den rohen Feldinhalt.

## Deployment

**Produktion:** https://app.viennasalsastudio.at — ausgeliefert am 2026-10-07
**Tag:** `v1.77.0-PROJ-77` (Commit `1fea412`)
**Vercel:** `…lp45nxnl7`, Ready, als Produktion aliasiert. **Keine Migration.**

`/admin/benachrichtigungen` antwortet mit der Login-Umleitung; Vorlage und Vorschau liegen dahinter.
Belegt sind sie durch die Prüfungen gegen die echte Versandkette (`resolveContent`) und den
Vorschau-Test über alle Platzhalter aller Vorlagen.

### Für den Betrieb — zwei Punkte

1. **Eigene Fassung des Textes.** Ist der Text der Erinnerung in der Verwaltung schon einmal geändert
   worden, liegt dort eine eigene Fassung, und der geänderte Standardtext wirkt nicht. Dann gehört
   `{wegbeschreibung}` unter Verwaltung → Benachrichtigungen → Kursstart-Erinnerung an die
   gewünschte Stelle — mit einem Leerzeichen davor, nicht dahinter.
2. **Die Beschreibung am Standort** ist die Quelle. Steht dort nichts, fehlt der Satz vollständig —
   das ist gewollt und keine Störung. Zeilenumbrüche darin werden in der E-Mail zu Leerzeichen.
