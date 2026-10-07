# PROJ-79: Überblick der Kündigungen

## Status: Deployed
**Created:** 2026-10-07
**Last Updated:** 2026-10-07

## Dependencies
- Requires: PROJ-9 (Abo-Verwaltung, Self-Service) — dort entsteht eine Kündigung
- Requires: PROJ-17 (Dashboard) — der Zeitraum-Filter wird mitbenutzt
- Berührt: PROJ-76 (Anmeldungen im Verlauf) — dieselben Daten, andere Frage
- Berührt: PROJ-4 (Kundenverwaltung) — das Ziel jedes Namens

## Anlass

Wunsch des Betreibers: „Ich würde gerne noch eine Möglichkeit für einen Überblick der Kündigungen
haben."

Eine Kündigung war an drei Stellen zu sehen — als Zahl auf dem Dashboard, als Balken im Verlauf, und
am einzelnen Kunden im Abo-Abschnitt. Wer wissen wollte, **wer** gekündigt hat, musste Kundenprofile
durchgehen. Und die angekündigten Kündigungen, bei denen noch eine Entscheidung möglich ist, waren
überhaupt nur zu finden, wenn man das betroffene Profil zufällig öffnete.

## User Stories

- Als Betreiber möchte ich sehen, wer gekündigt hat, ohne Profile durchzugehen.
- Als Betreiber möchte ich die **angekündigten** Kündigungen getrennt sehen — dort kann ich noch
  reagieren.
- Als Betreiber möchte ich wissen, wie lange jemand dabei war, bevor er geht.
- Als Betreiber möchte ich vom Namen aus direkt ins Kundenprofil.
- Als Betreiber möchte ich den Zeitraum einstellen können, wie auf dem Dashboard.

## Out of Scope

- **Der Kündigungsgrund.** Er wird nirgends erfasst; dafür bräuchte es ein Feld im Self-Service und
  eine Migration. Lohnt, sobald jemand die Antworten auch auswertet.
- **Rückgewinnung aus der Liste heraus** (Nachricht schreiben, Abo wiederbeleben). Der Weg führt ins
  Kundenprofil, dort steht das Abo mit allen Möglichkeiten.
- **Pausierungen.** Eine Pause ist keine Kündigung; sie steht als Zahl auf dem Dashboard.
- **Ein Verlauf oder eine Quote** auf dieser Seite. Beides steht auf dem Dashboard (PROJ-76).
- **Export.** Wenn die Liste exportiert werden soll, gehört das zum Buchhaltungs-Export (PROJ-36).

## Acceptance Criteria

- [ ] Angenommen der Admin öffnet die Verwaltung, dann gibt es einen Menüpunkt „Kündigungen" und er
      führt auf die Seite.
- [ ] Angenommen ein Abo ist gekündigt, aber noch nicht beendet, dann steht es unter „Angekündigt —
      läuft noch", mit dem Tag, an dem es endet.
- [ ] Angenommen ein Abo ist beendet und das Kündigungsdatum liegt im Zeitraum, dann steht es unter
      „Beendet".
- [ ] Angenommen eine Kündigung steht in der einen Liste, dann steht sie nicht auch in der anderen.
- [ ] Angenommen eine Zeile wird gezeigt, dann nennt sie Kunde, Abo, den wirksamen Tag und die
      Laufzeit des Abos.
- [ ] Angenommen der Admin stellt einen anderen Zeitraum ein, dann ändert sich die Liste der
      beendeten — die angekündigten bleiben unverändert stehen.
- [ ] Angenommen der Admin klickt auf einen Namen, dann ist er im Kundenprofil.
- [ ] Angenommen in einem Abschnitt steht nichts, dann sagt ein Satz, warum — keine leere Fläche.
- [ ] Angenommen die Kündigungen lassen sich nicht lesen, dann zeigt die Seite einen Fehler statt
      einer leeren Liste.

## Edge Cases

- **Gekündigt vor dem Beginn**: Die Laufzeit lautet „Noch nicht gestartet" — eine negative Zahl wäre
  kein Hinweis, sondern ein Rätsel.
- **Gekündigt am Starttag**: „Am Starttag".
- **Monatsgrenzen**: Ein Monat gilt erst ab dem Tag des Monats — vom 15.01. bis 14.02. sind es 30
  Tage, nicht ein Monat. Über Jahreswechsel und Februar geprüft.
- **Abo ohne Kursbindung** (Flatrate): In der Spalte „Abo" steht der Name des Abos, nicht ein leeres
  Feld.
- **Kunde ohne Namen**: „Unbenannter Kunde", wie in den anderen Listen der Verwaltung.
- **Angekündigt mit Stichtag in der Vergangenheit**: Sollte der Versandlauf ausgefallen sein, steht
  die Kündigung weiterhin unter „Angekündigt" — und zwar oben, weil aufsteigend sortiert wird. Genau
  dort gehört sie hin: Sie wartet auf ihren Vollzug.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Eigene Seite im Menü, nicht ein Block auf dem Dashboard | Eine Arbeitsliste mit Namen braucht Platz und einen Zeitraum-Filter; das Dashboard trägt schon fünf Blöcke. | 2026-10-07 |
| Zwei getrennte Listen | Für die angekündigten kann der Betreiber noch etwas tun, für die beendeten nicht. Untereinander in einer Liste verschwindet genau dieser Unterschied. | 2026-10-07 |
| Mit Laufzeit | Sie beantwortet, ob jemand nach zwei Monaten geht oder nach zwei Jahren — die Zahl, an der man ein Muster erkennt. | 2026-10-07 |
| Der Menüpunkt steht bei „Personen" | Es geht um Kundenbeziehungen, und der Weg führt von hier ins Kundenprofil. | 2026-10-07 |
| Der Zeitraum wirkt nur auf die beendeten | Eine Kündigung, die in drei Monaten wirkt, gehört in die Liste, egal welcher Zeitraum eingestellt ist. Der Hinweis an der Liste sagt das, damit niemand sie für gefiltert hält. | 2026-10-07 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| „Angekündigt" = `pending_status = 'cancelled'`, „Beendet" = `status = 'cancelled'` mit `cancelled_at` | Dieselben Felder, die der Versandlauf vollzieht (`lib/subscriptions/faellige-aenderungen.ts`). Jede eigene Auslegung ließe Liste und Vollzug auseinanderlaufen. | 2026-10-07 |
| Laufzeit und Sortierung als eigenes, geprüftes Stück | Datumsrechnung gehört nicht in eine Komponente. Prompt belohnt: Der erste Entwurf rechnete falsch (siehe QA). | 2026-10-07 |
| Beide Abschnitte sind benannte Bereiche | Wie bei PROJ-75/76: Ein Screenreader kann die Karten sonst nicht auseinanderhalten, und Tests müssen nicht über `div`-Filter raten. | 2026-10-07 |
| Ein Lesefehler wirft, statt leer zu zeigen | Eine leere Liste nach einem Fehler sieht aus wie „keine Kündigungen" — dieselbe Lehre wie bei PROJ-16 und PROJ-50. | 2026-10-07 |

---

## Tech Design (Solution Architect)

```
Verwaltung → Personen → Kündigungen
+-- Zeitraum-Filter (wirkt auf „Beendet")
+-- Angekündigt — läuft noch     [Anzahl]
|   Kunde · Abo · Endet am · Laufzeit      → Kundenprofil
+-- Beendet                      [Anzahl]
    Kunde · Abo · Beendet am · Laufzeit    → Kundenprofil
```

Zwei Abfragen, eine je Liste. Die Rechenarbeit — Laufzeit, Trennung, Reihenfolge — liegt in
`lib/admin/kuendigungen.ts` und ist ohne Datenbank prüfbar.

Keine Migration: `pending_status`, `pending_effective_date`, `cancelled_at` und `cycle_anchor_date`
gibt es seit PROJ-9 und PROJ-17.

## QA Test Results (2026-10-07)

**Empfehlung: bereit für die Produktion.** Keine Migration.

| | |
|---|---|
| Regeln (Unit) | 13: Laufzeit in Tagen, Monaten und Jahren, Monatsgrenzen, Februar, Jahreswechsel, vor dem Beginn, am Starttag, fehlende Daten; Trennung und Sortierung beider Listen |
| Browser (E2E) | 5 neu, in Chromium und Mobile Safari grün (10 Läufe) |
| Rückblick | PROJ-17 und PROJ-4: 14 Prüfungen grün; die Menü-Prüfung aus PROJ-39: 8 grün |
| Gesamt | 1158 Unit- und Datenbankprüfungen grün |
| Produktfehler gefunden | 1 in der eigenen Datumsrechnung, vor der Auslieferung behoben |

### Was geprüft ist

**Die Laufzeit** an jeder Grenze: ein Tag, 18 Tage, der volle Monat erst ab dem Tag des Monats
(15.01.→14.02. sind 30 Tage, 15.01.→15.02. ist ein Monat), Monate bis zum Jahr, Jahre mit und ohne
Restmonate, über den Jahreswechsel und über den 29. Februar. Dazu die beiden Fälle, die kein Mensch
lesen will: Kündigung vor dem Beginn und Kündigung am Starttag.

**Die Trennung**: Wer angekündigt ist, steht nicht bei den Beendeten und umgekehrt — im Browser für
beide Richtungen geprüft, nicht nur in der Regel.

**Der Zeitraum**: Eine Kündigung von 2023 fehlt im Standardzeitraum und erscheint, sobald der Zeitraum
passt — und die angekündigte bleibt dabei stehen. Das ist die Zusicherung, die am leichtesten
unbemerkt kaputtgeht.

**Der Weg**: über den Menüpunkt, nicht über die Adresse. Und vom Namen ins Kundenprofil.

### Der Fehler in der ersten Fassung

Die Tagesrechnung übergab den Monat aus der Zeichenkette (1 = Januar) direkt an `Date.UTC`, das Monate
ab null zählt. Mein Kommentar behauptete, der Versatz hebe sich auf beiden Seiten auf — das tut er
**nicht**, weil Monate verschieden lang sind: Aus „15.01. bis 14.02." (30 Tage) wurde „15.02. bis
14.03." (27 Tage). Der Test, der die 30 erwartete, hat es sofort gemeldet.

## Deployment

**Produktion:** https://app.viennasalsastudio.at/admin/kuendigungen — ausgeliefert am 2026-10-07
**Tag:** `v1.79.0-PROJ-79` (Commit `de1e3de`)
**Vercel:** `…o4t8siga8`, Ready, als Produktion aliasiert. **Keine Migration.**

`/admin/kuendigungen` antwortet mit der Login-Umleitung (307) — die Seite liegt hinter der Anmeldung
samt zweiter Stufe. Belegt ist sie durch die fünf E2E-Tests in beiden Browsern, die über den
Menüpunkt gehen und vom Namen ins Kundenprofil.

### Für den Betrieb

Die Liste „Angekündigt" ist die wichtigere: Dort stehen Abos, die noch laufen. Sie leert sich von
selbst, sobald der Versandlauf den Stichtag vollzieht. Steht dort etwas mit einem Stichtag in der
**Vergangenheit**, ist der Vollzug liegengeblieben — dann lohnt ein Blick in die Benachrichtigungen,
ob der Lauf durchgeht.
