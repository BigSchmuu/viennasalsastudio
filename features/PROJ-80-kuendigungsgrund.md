# PROJ-80: Der Kündigungsgrund

## Status: Deployed
**Created:** 2026-10-07
**Last Updated:** 2026-10-07

## Dependencies
- Requires: PROJ-9 (Abo-Verwaltung, Self-Service) — dort entsteht die Kündigung
- Requires: PROJ-79 (Überblick der Kündigungen) — dort wird der Grund gelesen und gezählt
- Berührt: PROJ-4 (Kundenverwaltung) — das Abo-Formular nimmt den Grund nachträglich auf
- Berührt: PROJ-43 (Sprachvariante) — die Gründe stehen auf Deutsch und Englisch

## Anlass

Wunsch des Betreibers, direkt nach PROJ-79: „Kündigungsgrund wäre super."

Die Übersicht zeigte, **wer** geht und **wie lange** er dabei war. Die Frage danach — warum —
beantwortete sie nicht, und die Daten dafür gab es nirgends.

## User Stories

- Als Betreiber möchte ich sehen, aus welchen Gründen gekündigt wird, und zwar gezählt.
- Als Betreiber möchte ich einen Grund auch nachtragen können, wenn jemand anruft oder schreibt.
- Als Kunde möchte ich kündigen können, **ohne** einen Grund zu nennen.
- Als Kunde möchte ich etwas dazu sagen können, was in keine Liste passt.

## Out of Scope

- **Ein Pflichtfeld.** Siehe Decision Log — rechtlich heikel und menschlich falsch.
- **Rückfragen oder ein Angebot** nach der Kündigung („bleib mit 20 % Rabatt"). Eigene Sache, eigene
  Entscheidung.
- **Auswertung über Zeit** (Gründe im Verlauf, Vergleich von Monaten). Die Zählung gilt dem
  eingestellten Zeitraum; alles Weitere, sobald genug Daten da sind, um ein Muster zu sehen.
- **Der Grund in einer Benachrichtigung** an die Verwaltung. Die Übersicht ist der Ort.
- **Pausierungen.** Eine Pause braucht keinen Grund; sie ist kein Abschied.

## Acceptance Criteria

- [ ] Angenommen ein Kunde kündigt im Profil, dann fragt der Dialog nach dem Grund — ausdrücklich als
      freiwillig gekennzeichnet — mit sechs Auswahlmöglichkeiten und einem Textfeld.
- [ ] Angenommen der Kunde wählt nichts aus, dann wird die Kündigung trotzdem gespeichert.
- [ ] Angenommen der Kunde wählt einen Grund und schreibt einen Satz, dann stehen beide am Abo.
- [ ] Angenommen der Kunde nimmt die Kündigung zurück, dann sind Grund und Notiz wieder leer.
- [ ] Angenommen der Kunde pausiert, nachdem er gekündigt hatte, dann bleibt kein Grund stehen.
- [ ] Angenommen die Verwaltung setzt ein Abo auf „Gekündigt", dann kann sie Grund und Notiz angeben.
- [ ] Angenommen das Abo ist nicht gekündigt, dann erscheinen die beiden Felder im Formular nicht.
- [ ] Angenommen die Verwaltung setzt ein gekündigtes Abo wieder auf aktiv, dann sind Grund, Notiz
      **und Kündigungsdatum** wieder leer.
- [ ] Angenommen die Verwaltung kündigt über das Formular, dann erscheint die Kündigung in der
      Übersicht und in der Kennzahl — vorher fehlte sie dort.
- [ ] Angenommen eine Kündigung nennt keinen Grund, dann steht in der Übersicht „Keine Angabe".
- [ ] Angenommen im Zeitraum gibt es Kündigungen, dann zählt eine Zeile die Gründe — und nennt, wie
      viele überhaupt einen genannt haben.
- [ ] Angenommen ein Grund wird von außen erfunden, dann weist die Datenbank ihn ab.
- [ ] Angenommen jemand ruft die Kündigungsfunktion ohne Anmeldung auf, dann wird er abgewiesen.

## Edge Cases

- **Nur Leerzeichen** in Grund oder Notiz: gilt als keine Angabe, in der Datenbank selbst behandelt.
- **Ein Grund aus einer späteren Migration**, den die Oberfläche noch nicht kennt: Er wird unverändert
  angezeigt, statt als „—" zu verschwinden — ein roher Wert ist ein Fehler, den man sieht.
- **Gleich häufige Gründe** in der Zählung: Reihenfolge der Liste, nicht Zufall. Sonst springen sie
  bei jedem Laden.
- **Mehrfaches Speichern** eines gekündigten Abos in der Verwaltung: Das Kündigungsdatum bleibt
  stehen, statt in den aktuellen Monat zu wandern.
- **Eine Notiz von 5000 Zeichen**: wird auf 1000 gekürzt, nicht abgewiesen. Eine Kündigung scheitert
  nicht an einem zu langen Text.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Freiwillig, nie Pflicht | Ein Pflichtfeld macht das Kündigen schwerer als das Abschließen. Bei Online-Verträgen ist das rechtlich heikles Terrain (in Deutschland ausdrücklich geregelt), und es ist auch menschlich die falsche Geste. Freiwillig umgeht die Frage ganz. | 2026-10-07 |
| Auswahl **und** Freitext | Nur Freitext ließe sich nicht zählen, nur Auswahl verlöre das Besondere. | 2026-10-07 |
| Kunde und Verwaltung | Kündigt jemand telefonisch, fehlte sonst genau bei diesen Fällen der Grund — und die Auswertung hätte ein Loch, das man ihr nicht ansieht. | 2026-10-07 |
| Die Zählung nennt auch „ohne Angabe" | Sie ist kein Grund, sondern die Antwort auf „wie belastbar ist das hier?". Vier von vierzehn ist etwas anderes als vier von fünf. | 2026-10-07 |
| Die Felder nur bei Status „Gekündigt" | Bei einem laufenden Abo wäre ein Kündigungsgrund eine Frage ohne Anlass. | 2026-10-07 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Zwei Spalten, Grund mit CHECK-Liste | Der Grund muss zählbar bleiben; ein Schreibzugriff von irgendwo sonst soll keinen erfinden können, den die Auswertung nicht kennt. Preis: Ein neuer Grund braucht eine Migration — dieselbe Falle wie bei `notification_queue.event_type`. | 2026-10-07 |
| `drop` + `create` statt `create or replace` für die Kündigungsfunktion | Zusätzliche Parameter ergeben in Postgres eine **zweite** Funktion. Mit Standardwerten wäre ein Aufruf mit zwei Argumenten danach mehrdeutig („function is not unique") — und das erst zur Laufzeit beim Kunden. Rechte danach neu vergeben, mit Test darauf. | 2026-10-07 |
| Grund und Notiz werden in der Datenbank geleert, nicht in der Anwendung | Pause und Zurücknehmen laufen beide über eine Funktion; dort gehört die Regel hin. In der Anwendung wäre sie an zwei Stellen zu wiederholen. | 2026-10-07 |
| Ein unbekannter Grund wird zu „keine Angabe", nicht zu einem Fehler | Die Kündigung darf an der Auswertung nicht hängen. Sonst stünde der Kunde vor einem Formular, das seine Kündigung nicht annimmt. | 2026-10-07 |

---

## Tech Design (Solution Architect)

```
Kunde: Profil → Abo → Kündigen
  Dialog: „Warum kündigst du? (freiwillig)"
          sechs Gründe + Textfeld  →  Datenbankfunktion speichert beides
          Zurücknehmen             →  beides wieder leer

Verwaltung: Kunde → Abo bearbeiten
  Status „Gekündigt"  →  Grund (Auswahl) + Notiz
                      →  setzt zugleich das Kündigungsdatum (neu!)

Verwaltung → Kündigungen
  Spalte „Grund" je Zeile, Notiz darunter
  darüber: „Gründe im Zeitraum (14 Kündigungen, 9 mit Grund): …"
```

Die Liste der Gründe steht an **einer** Stelle im Code (`lib/subscriptions/kuendigungsgrund.ts`),
zweisprachig, samt Zählung — und als CHECK in der Datenbank. Wer einen Grund ergänzt, braucht beides.

### Migration

`20261007170000_proj80_kuendigungsgrund.sql` — zwei Spalten, eine CHECK-Liste, Austausch der
Selbstkündigungsfunktion samt Rechten. **Muss vor der Auslieferung eingespielt werden:** Die
Anwendung ruft die Funktion mit den neuen Parametern auf; ohne Migration könnte niemand kündigen.

## QA Test Results (2026-10-07)

**Empfehlung: bereit für die Produktion.** Migration vom Betreiber in Test und Produktion eingespielt.

| | |
|---|---|
| Regeln (Unit) | 11 für Liste, Beschriftungen und Zählung |
| Datenbank | 7 neu: Grund mitnehmen, ohne Angabe kündigen, Leerzeichen, Pause leert, Zurücknehmen leert, erfundener Grund abgewiesen, ohne Anmeldung verschlossen |
| Browser (E2E) | PROJ-9 erweitert (Dialog samt Gegenprobe in der Datenbank), PROJ-79 um zwei Fälle erweitert (Grund in der Zeile, Zählung, „Keine Angabe") |
| Rückblick | PROJ-9, PROJ-79, PROJ-4: 25 Prüfungen in Chromium, 19 in Mobile Safari — alle grün |
| Gesamt | 1175 Unit- und Datenbankprüfungen grün (1 übersprungen: ein Zeitwächter aus PROJ-25) |
| Produktfehler gefunden | 1 vorbestehender (fehlendes Kündigungsdatum bei Kündigung durch die Verwaltung), behoben |

### Was geprüft ist

**Die Datenbankfunktion** an allen Abzweigungen, und zwar als angemeldeter Kunde: Grund und Notiz
werden mitgenommen, eine Kündigung ohne Angaben geht durch, Leerzeichen gelten als keine Angabe, eine
Pause leert beides, das Zurücknehmen auch. Dazu zwei Gegenproben: Ein erfundener Grund wird abgewiesen
(CHECK), und die Funktion ist ohne Anmeldung verschlossen — der häufigste Fehler nach `drop`/`create`.

**Der Dialog** im Browser: Die Frage steht da, ein Grund wird gewählt, ein Satz geschrieben — und
anschließend wird in der Datenbank nachgesehen, ob beides angekommen ist. Die Oberfläche allein belegt
das nicht.

**Die Übersicht**: Grund und Notiz in der Zeile, die Zählung darüber mit beiden Zahlen, und „Keine
Angabe" bei der Kündigung ohne Grund.

### Der vorbestehende Fund

Kündigte die Verwaltung über das Abo-Formular, wurde `status` gesetzt, `cancelled_at` aber nicht.
Solche Kündigungen fehlten in **jeder** Auswertung: in der Kachel auf dem Dashboard, im Verlaufsgraphen
(PROJ-76) und in der Übersicht (PROJ-79). Dieselbe stille Untererfassung, die PROJ-9 für den
automatischen Vollzug längst behoben hatte — nur an der anderen Stelle. Jetzt wird das Datum gesetzt;
ein bereits gesetztes bleibt stehen, damit eine Kündigung nicht bei jedem Speichern in den aktuellen
Monat wandert. Und wird ein Abo wieder aktiv gesetzt, fällt es mitsamt Grund und Notiz weg.

### Was offen bleibt

- **Auswertung über Zeit** (Gründe im Verlauf) — erst sinnvoll, wenn genug Angaben zusammenkommen.
- Ein neuer Grund in der Liste braucht **beides**: Eintrag im Code und Migration für den CHECK.

## Deployment

**Produktion:** https://app.viennasalsastudio.at — ausgeliefert am 2026-10-08, 00:14
**Tag:** `v1.80.0-PROJ-80` (Commit `2949a4b`)
**Vercel:** `…o17mt5dv9`, Ready, als Produktion aliasiert

**Migration:** `20261007170000_proj80_kuendigungsgrund.sql` — vom Betreiber in Test *und* Produktion
eingespielt, **vor** der Auslieferung. Diese Reihenfolge war nötig: Die Anwendung ruft die
Kündigungsfunktion mit den neuen Parametern auf.

`/admin/kuendigungen` und `/profil` antworten mit der Login-Umleitung; beide Oberflächen liegen
dahinter und sind durch die E2E-Tests belegt — der Dialog samt Gegenprobe in der Datenbank.

### Für den Betrieb

Der erste Grund kommt erst mit der nächsten Kündigung — bestehende Kündigungen haben keinen, und die
Zählung weist sie als „ohne Angabe" aus. Das ist richtig so: Nachträglich einen Grund zu erfinden wäre
schlechter als die Lücke.

Ein **neuer** Grund in der Liste braucht künftig zwei Dinge: den Eintrag in
`lib/subscriptions/kuendigungsgrund.ts` **und** eine Migration für die CHECK-Liste. Ohne die Migration
scheitert das Speichern — und zwar erst beim Kunden im Formular.
