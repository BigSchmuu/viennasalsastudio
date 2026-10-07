# PROJ-76: Anmeldungen im Verlaufsgraphen

## Status: Deployed
**Created:** 2026-10-07
**Last Updated:** 2026-10-07

## Dependencies
- Requires: PROJ-17 (Admin-Analytics-Dashboard) — der Graph, der erweitert wird
- Berührt: PROJ-9 (Abo-Verwaltung) — `subscriptions.created_at` ist die Quelle der Anmeldungen

## Anlass

Wunsch des Betreibers: „Ich würde gerne in den gleichen Graphen wie den Kündigungsverlauf auch einen
Anmeldungsverlauf haben."

Der Kündigungsverlauf stand für sich und sagte damit nur die halbe Wahrheit: Vier Kündigungen im
Monat sind etwas anderes, wenn zwölf Anmeldungen daneben stehen, als wenn es zwei sind. Beide Zahlen
betreffen dieselbe Sache — ein Abo —, einmal hin und einmal weg.

## User Stories

- Als Betreiber möchte ich Zugang und Abgang in einem Bild sehen, statt zwei Graphen zu vergleichen.
- Als Betreiber möchte ich erkennen können, welcher Balken welcher ist, auch wenn ich Farben schlecht
  unterscheide.

## Out of Scope

- **Neue Kundenkonten** als dritte Reihe. Sie lassen sich nicht gegen Kündigungen aufrechnen, und ein
  kleiner Dashboard-Graph mit drei Reihen wird unübersichtlich (Entscheidung des Betreibers).
- **Der Saldo** als eigene Zahl oder Kachel.
- **Kündigungen unter der Nulllinie.** Nebeneinander verlangt kein Umdenken (Entscheidung des
  Betreibers).
- **Der Umsatz-Verlauf** bleibt ein eigener Graph — zwei Maßeinheiten in einem Bild bräuchten zwei
  Achsen, und das ist nie richtig.

## Acceptance Criteria

- [ ] Angenommen im Zeitraum gibt es Anmeldungen und Kündigungen, wenn der Admin das Dashboard
      öffnet, dann stehen beide Reihen im selben Graphen, je Zeitraum nebeneinander.
- [ ] Angenommen der Graph zeigt zwei Reihen, dann nennt eine Legende, welche Farbe welche Reihe ist.
- [ ] Angenommen im Zeitraum gibt es weder Anmeldungen noch Kündigungen, dann steht dort „Noch keine
      Daten für diesen Zeitraum".
- [ ] Angenommen ein Abo wurde am Monatsletzten um 23:30 Wiener Zeit abgeschlossen, dann zählt es zu
      diesem Monat — nicht zum nächsten und nicht zum vorigen.
- [ ] Angenommen ein Abo hat kein Kündigungsdatum, dann zählt es in keiner Kündigungsreihe.
- [ ] Angenommen der Umsatz-Verlauf steht daneben, dann bleibt er unverändert einreihig und ohne
      Legende.

## Edge Cases

- **Zeitstempel gegen Datum**: `created_at` ist ein Zeitstempel, `cancelled_at` eine Datumsspalte.
  Die ersten zehn Zeichen eines Zeitstempels ergeben den **UTC**-Tag; an einer Monatsgrenze landet
  der Eintrag damit im falschen Balken. Beide laufen deshalb über dieselbe Zählung, die auf den
  Wiener Kalendertag umrechnet.
- **Ein Monat ohne Anmeldungen, aber mit Kündigungen**: Der Graph zeigt Daten, sobald *eine* der
  beiden Reihen etwas hat.
- **Farbfehlsichtigkeit**: Teal und Mango sind geprüft (ΔE 13 bei Protanopie, 24 bei Tritanopie);
  zusätzlich trägt die Legende Text, Identität hängt also nicht an der Farbe allein.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Anmeldung = neu abgeschlossenes Abo | Der direkte Gegenspieler zur Kündigung; beide zählen dasselbe Ding. Neue Konten sagen etwas anderes und gehören nicht in dieselbe Achse. | 2026-10-07 |
| Nebeneinander, nicht gestapelt und nicht nach unten | Gestapelt wäre die Summe ablesbar und die Einzelzahl nicht. Nach unten wäre der Saldo ablesbar, verlangt aber Umdenken. Der Betreiber wollte vergleichen. | 2026-10-07 |
| Titel „Anmeldungen & Kündigungen" | Ein Graph mit zwei Reihen, der „Kündigungs-Verlauf" heißt, verschweigt die Hälfte. | 2026-10-07 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Die Farben sind geprüft, nicht gewählt | Der Validator der Visualisierungs-Richtlinie prüft Helligkeitsband, Sättigung, Unterscheidbarkeit bei Farbfehlsichtigkeit und Kontrast zur Fläche. Das bisherige `#ffb000` fiel durch (Kontrast 1,78:1, zu helles Band) — ein Balken, den man kaum sieht. Jetzt Teal `#2a9d8f` (die Kursstufen-Farbe des Projekts) und ein dunkleres Mango `#c47f00`; beide bestehen alle sechs Prüfungen. | 2026-10-07 |
| Eine gemeinsame Zählung für beide Reihen | Zwei Filterzeilen über eine Monatsgrenze ergeben früher oder später zwei Wahrheiten. Die Zählung rechnet zudem auf den Wiener Tag um, was die alte Zeile nicht tat. | 2026-10-07 |
| Der Graph ist ein benannter Bereich | Auf dem Dashboard stehen mehrere Karten; ein Screenreader fand bisher namenlose Flächen. Nebeneffekt: Die Karte ist für Tests ansprechbar, ohne über `div`-Filter zu raten. | 2026-10-07 |
| Kein Dark Mode nötig | Die App setzt die `dark`-Klasse nirgends; geprüft wurde gegen die helle Kartenfläche. Kommt ein Dark Mode, müssen beide Farben erneut dagegen geprüft werden. | 2026-10-07 |

---

## Tech Design (Solution Architect)

```
Dashboard
+-- Heute (PROJ-75)
+-- Kennzahlen
+-- Umsatz-Verlauf            (unverändert, eine Reihe, keine Legende)
+-- Anmeldungen & Kündigungen (NEU: zwei Reihen nebeneinander + Legende)
+-- Belegung
+-- Geburtstage
```

Der Verlaufsgraph nimmt jetzt eine **optionale zweite Reihe**. Ist sie gesetzt, zeichnet er zwei
Balken je Zeitraum mit zwei Pixeln Abstand und zeigt eine Legende; ohne sie bleibt alles, wie es war —
der Umsatz-Verlauf ist unberührt.

Die Zählung je Zeitraum liegt in einem eigenen, geprüften Stück (`lib/analytics/verlauf.ts`). Sie
rechnet jeden Zeitpunkt zuerst auf den Wiener Kalendertag um und zählt dann; damit behandelt sie die
Datumsspalte der Kündigungen und den Zeitstempel der Abschlüsse gleich.

### Abhängigkeiten

Keine neuen Pakete, keine Migration.

## QA Test Results (2026-10-07)

**Empfehlung: bereit für die Produktion.** Keine Migration.

| | |
|---|---|
| Regeln (Unit) | 8 für die Zählung, darunter die Monatsgrenze um Mitternacht |
| Farbprüfung | Validator der Visualisierungs-Richtlinie: alle sechs Prüfungen bestanden |
| Browser (E2E) | PROJ-17 angepasst und erweitert — Titel und **beide** Legendeneinträge |
| Rückblick | PROJ-17, PROJ-45, PROJ-75: 19 Prüfungen in Mobile Safari, 8 in Chromium, alle grün |
| Gesamt | 1133 Unit- und Datenbankprüfungen grün |
| Produktfehler gefunden | 1 vorbestehender (die blasse Kündigungsfarbe), behoben |

### Was geprüft ist

**Die Zählung** an ihren Rändern: erster und letzter Tag eines Zeitraums zählen mit, alles außerhalb
nicht, leere Werte werden übersprungen — und ausdrücklich der Fall, der die alte Zeile falsch
einsortiert hätte: ein Zeitstempel am Monatsletzten um 23:30 Wiener Zeit.

**Die Legende** im Browser: Sie erscheint nur, wenn die zweite Reihe wirklich angelegt ist. Ohne sie
wäre nicht unterscheidbar, welcher Balken welcher ist — deshalb ist sie der Beleg dafür, dass die
Reihe wirklich da ist, und nicht nur der Titel.

### Ein vorbestehender Fund

Das Mango `#ffb000` der Kündigungen fiel durch die Farbprüfung: Kontrast 1,78:1 zur weißen
Kartenfläche, Helligkeit außerhalb des Bandes. Ein Balken in dieser Farbe ist auf einem Bildschirm im
Studio bei Tageslicht kaum zu erkennen. Er ist jetzt dunkler (`#c47f00`, 3,0:1) — dieselbe Familie,
nur sichtbar.

## Deployment

**Produktion:** https://app.viennasalsastudio.at — ausgeliefert am 2026-10-07
**Tag:** `v1.76.0-PROJ-76` (Commit `2a2be40`)
**Vercel:** `…gchk6t5h1`, Ready, als Produktion aliasiert. **Keine Migration.**

`/admin` antwortet mit der Login-Umleitung; der Graph liegt dahinter. Belegt ist er durch den
erweiterten PROJ-17-Test, der Titel **und** beide Legendeneinträge prüft — die Legende erscheint nur,
wenn die zweite Reihe wirklich angelegt ist.

### Für den Betrieb

Der Graph zeigt ohne eigenen Zeitraum die letzten zwölf Monate. Ein Monat ohne Balken heißt: in
diesem Monat wurde kein Abo abgeschlossen **und** keines gekündigt — nicht, dass die Zahlen fehlen.
