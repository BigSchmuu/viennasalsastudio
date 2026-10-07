# PROJ-75: Heutige Kurse im Admin-Dashboard

## Status: Deployed
**Created:** 2026-10-07
**Last Updated:** 2026-10-07

## Dependencies
- Requires: PROJ-13 (Anwesenheitsliste) — das Ziel jedes Eintrags
- Requires: PROJ-49 (Lehrer-Bereich) — die Terminberechnung `naechsteTermine` wird mitbenutzt
- Requires: PROJ-45 (Dashboard) — der Ort
- Berührt: PROJ-51 (Kurszeitraum und Ferien), PROJ-69 (ein Platz gilt ab seinem Beginn), PROJ-74
  (Einmal-Gäste in der Anwesenheitsliste)

## Anlass

Wunsch des Betreibers: „Ich würde gerne für die Admins im Dashboard einen weiteren Punkt mit den
aktuellen Kursen des selben Tages haben, damit die Admins dort auf den Kurs klicken können und
direkt zur Anwesenheitsliste kommen, um die Leute einzuchecken. Momentan können das nur die Lehrer
über ‚Meine Kurse', und ich muss umständlich über Kurse zur Anwesenheitsliste."

Der Weg dorthin existiert — er ist nur für Lehrkräfte gebaut. „Meine Kurse" (`/lehrer`) listet
ausschließlich Kurse, denen man als Lehrkraft **zugewiesen** ist; ein Admin ohne Zuweisung sieht dort
eine leere Liste. Die Anwesenheitsliste selbst darf er öffnen (`requireCourseAccess` lässt jeden
Admin durch) — er muss die Adresse nur finden, und das geht heute nur über die Kursverwaltung.

Am Kursabend ist das der falsche Weg: Der Admin steht im Studio, zwanzig Leute kommen herein, und er
klickt sich durch eine Verwaltungsliste.

## User Stories

- Als Admin möchte ich beim Öffnen des Dashboards sehen, welche Kurse heute stattfinden.
- Als Admin möchte ich von dort mit einem Klick in der Anwesenheitsliste landen.
- Als Admin möchte ich sehen, wo noch nichts erfasst ist, damit ich keinen Kurs öffne, der fertig ist.
- Als Admin möchte ich erkennen, welcher Kurs **gerade** läuft.
- Als Admin möchte ich an einem Tag ohne Kurs einen Satz lesen, nicht eine leere Fläche.

## Out of Scope

- **Andere Tage.** Der Abschnitt zeigt heute. Wer zurück- oder vorausschauen will, benutzt die
  Anwesenheitsliste selbst — die kann das seit PROJ-72.
- **Einchecken direkt aus dem Dashboard.** Ein Häkchen gehört dorthin, wo auch die Namen stehen; ein
  zweiter Ort zum Abhaken wäre ein zweiter Ort für Fehler.
- **Eigene Rechte für Lehrkräfte.** Der Abschnitt steht im Admin-Dashboard; Lehrkräfte haben ihre
  Übersicht in „Mein Bereich" (PROJ-49) und brauchen keine zweite.
- **Events.** Nur Kurse. Für Events gibt es den Einlass mit QR-Code (PROJ-14).
- **Räume ohne Wochentermin.** Ein Kurs ohne hinterlegten Termin findet an keinem Tag statt und steht
  nicht in der Liste.

## Acceptance Criteria

- [ ] Angenommen heute findet ein Kurs statt, wenn der Admin das Dashboard öffnet, dann steht der
      Kurs ganz oben mit Uhrzeit, Name und Ort.
- [ ] Angenommen der Admin klickt auf einen Eintrag, dann ist er in der Anwesenheitsliste genau
      dieses Kurses.
- [ ] Angenommen heute finden mehrere Kurse statt, dann stehen sie nach Uhrzeit sortiert, bei
      gleicher Uhrzeit nach Namen.
- [ ] Angenommen zu einem heutigen Kurs ist noch keine Anwesenheit erfasst, dann steht am Eintrag
      „noch nicht erfasst".
- [ ] Angenommen Anwesenheit ist erfasst, dann steht dort, wie viele der erwarteten Personen
      anwesend sind.
- [ ] Angenommen zu einem Kurs wird heute niemand erwartet, dann steht das als eigener Hinweis — und
      nicht „0 von 0".
- [ ] Angenommen ein Kurs läuft gerade (jetzt zwischen Beginn und Ende), dann ist er als laufend
      gekennzeichnet.
- [ ] Angenommen heute findet kein Kurs statt, dann steht dort ein Satz, der das sagt.
- [ ] Angenommen ein heutiger Termin fällt in eine Pause, in die Ferien oder außerhalb des
      Kurszeitraums, dann steht der Kurs nicht in der Liste.
- [ ] Angenommen der Stand des Eincheckens lässt sich nicht lesen, dann sagt der Eintrag das — und
      behauptet nicht „niemand anwesend".

## Edge Cases

- **Zwei Kurse zur gleichen Zeit** (zwei Räume): beide stehen da, nach Namen geordnet.
- **Kurs ohne Uhrzeit**: Er steht in der Liste, aber ohne „läuft jetzt" — ohne Zeiten ist die Frage
  nicht zu beantworten.
- **Mitternacht**: Der Tag ist der *Wiener* Kalendertag, nicht der des Servers (auf Vercel UTC).
  Dieselbe Falle wie in PROJ-45 und PROJ-13.
- **Ein Platz, der erst heute beginnt**, zählt zu den Erwarteten — die Anwesenheitsliste rechnet das
  seit PROJ-69 selbst, und der Stand kommt aus derselben Quelle.
- **Probestunden, Drop-Ins und Gäste** von heute zählen mit: Sie stehen in derselben Liste (PROJ-74)
  und sollen eingecheckt werden.
- **Ein ausgefallener Termin** (Pause) ist kein heutiger Kurs — der Admin soll nicht auf eine Stunde
  klicken, die nicht stattfindet.

## Technical Requirements

- Keine Migration: Alles liegt in `course_schedule`, `studio_holidays` und der bestehenden
  Anwesenheitsfunktion.
- Performance: eine Abfrage für die Kurse, danach je heutigem Kurs eine Standabfrage. Bei typisch
  zwei bis sechs Kursen pro Tag ist das vertretbar; sie laufen parallel.
- Sicherheit: unverändert. Das Dashboard ist Admin-Bereich mit zweiter Stufe, und die
  Anwesenheitsfunktion prüft selbst noch einmal.

## Open Questions
- Keine offen.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Ganz oben, über den Kennzahlen | Das ist die Arbeit des Tages; Umsatz und Trends schaut man seltener an. Dieselbe Überlegung wie bei der Menüreihenfolge am 2026-10-05. | 2026-10-07 |
| Mit Stand des Eincheckens | Sonst muss der Admin jeden Kurs öffnen, um zu sehen, ob noch etwas zu tun ist. Preis: eine Abfrage je heutigem Kurs. | 2026-10-07 |
| Auch Kurse, die heute schon vorbei sind | Eingecheckt wird oft erst nach der Stunde. Eine Liste, die den Kurs um 20:01 verschwinden lässt, nimmt genau dann den Weg weg, wenn er gebraucht wird. | 2026-10-07 |
| Kein Abhaken im Dashboard | Ein Häkchen gehört dorthin, wo die Namen stehen. Zwei Orte zum Abhaken sind zwei Orte für Fehler. | 2026-10-07 |
| „noch nicht erfasst" statt „0 anwesend" | Die beiden Zustände bedeuten Verschiedenes: nichts getan oder niemand da. | 2026-10-07 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| `naechsteTermine` aus PROJ-49 wird mitbenutzt, nicht nachgebaut | Pausen, Ferien und Kurszeitraum sind dort schon richtig behandelt und geprüft. Eine zweite Rechnung ergäbe früher oder später zwei verschiedene Tage. | 2026-10-07 |
| Der Stand kommt aus `get_course_attendance_roster` | Dieselbe Quelle wie die Liste selbst. Alles andere ließe Dashboard und Liste auseinanderlaufen — und genau das soll der Abschnitt verhindern. | 2026-10-07 |
| Lesefehler werden benannt, nicht geschluckt | Dieselbe Lehre wie bei „Nicht zugestellt" (PROJ-16) und der Lehrerseite: Eine leere Zahl nach einem Fehler sieht aus wie eine Aussage. | 2026-10-07 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

```
Admin-Dashboard
+-- NEU: „Heutige Kurse"            ← ganz oben
|   +-- je Kurs eine Zeile, nach Uhrzeit:
|   |   Uhrzeit · Name · Ort · Stand · [läuft jetzt]  → Anwesenheitsliste
|   +-- oder: „Heute findet kein Kurs statt."
+-- Kennzahlen (Umsatz, Kündigungen, Pausen, aktive Kunden)
+-- Trends
+-- Belegung
+-- Geburtstage
```

**Die Rechenarbeit** liegt in einem eigenen, prüfbaren Stück ohne Datenbankbezug: Aus den Kursen mit
Wochentermin werden die heutigen herausgesucht (über `naechsteTermine` aus PROJ-49, gefiltert auf
heute), nach Uhrzeit sortiert, und aus einer Anwesenheitsliste wird der Stand berechnet — erwartet,
anwesend, erfasst. Dazu die Frage „läuft dieser Kurs jetzt?", die die Wiener Wanduhr braucht und
deshalb ebenfalls dort steht, wo man sie mit erfundenen Zeiten prüfen kann.

**Die Seite** holt die Kurse in einer Abfrage und die Stände parallel, einen je heutigem Kurs.
Scheitert ein Stand, trägt die Zeile „Stand unbekannt" statt einer Null.

### Abhängigkeiten

Keine neuen Pakete, keine Migration.

## QA Test Results (2026-10-07)

**Empfehlung: bereit für die Produktion.** Keine Migration.

| | |
|---|---|
| Regeln (Unit) | 20 für die Auswahl des Tages, den Stand und die Wiener Uhrzeit |
| Komponente (Unit) | 8 für Zeile, Kennzeichen, Leerzustand und Linkziel |
| Browser (E2E) | 5 neu, in Chromium und Mobile Safari grün (10 Läufe) |
| Rückblick | PROJ-45 und PROJ-17 (Dashboards): 14 Prüfungen grün |
| Gesamt | 1125 Unit- und Datenbankprüfungen grün |
| Produktfehler gefunden | 0 |

### Was geprüft ist

**Die Auswahl des Tages** an allen Rändern: anderer Wochentag, kein Wochentermin, ausgefallener
Termin, Ferien, Kurs beginnt erst später, Kurs ist ausgelaufen, zwei Kurse zur gleichen Zeit
(Sortierung nach Namen) — und ausdrücklich: ein Kurs, der heute **schon vorbei** ist, bleibt in der
Liste. Eingecheckt wird oft erst nach der Stunde.

**Der Stand**: erwartet, anwesend und erfasst getrennt gezählt; „Noch nicht erfasst" gegen „Niemand
erwartet" gegen „3 von 12 anwesend" gegen „Stand unbekannt" nach einem Lesefehler.

**Die Wiener Uhrzeit** mit der Mitternachtsfalle: `hour12: false` liefert je nach ICU-Fassung
„24:00:00", und ein Zeichenkettenvergleich hielte jeden Kurs dann für vorbei. Geprüft ist, dass
Mitternacht „00:00:00" heißt und 8 Uhr zweistellig kommt.

**Im Browser**, über den Weg des Betreibers: Der Abschnitt zeigt den heutigen Kurs mit Uhrzeit, Ort
und „Noch nicht erfasst"; ein Klick landet in der Anwesenheitsliste **und dort steht der erwartete
Teilnehmer**; der laufende Kurs trägt „läuft jetzt" und der um 08:00 nicht; ein Kurs ohne erwartete
Teilnehmer sagt das; Kurse anderer Tage und ausgefallene Termine stehen nicht da.

### Drei Mängel an meiner eigenen Arbeit, die dabei auffielen

**Der Test-Helfer verschluckte `null`.** `felder.weekday ?? DI` macht aus einem ausdrücklichen `null`
wieder Dienstag — der Fall „Kurs ohne Wochentermin" prüfte stillschweigend einen Dienstagskurs. Jetzt
werden die Vorgaben überschrieben statt ergänzt.

**Der Lokator traf den Kartenkopf.** `div`-Filter plus `.last()` fand die Überschrift, aber nicht die
Liste darunter. Die Karte ist jetzt ein benannter Bereich (`role="region"`, beschriftet durch ihren
Titel) — ansprechbar für Tests und unterscheidbar für Screenreader, die auf dem Dashboard sonst vier
namenlose Karten vorfinden.

**Ein ganzer Dateilauf fiel durch**, weil der Entwicklungsserver beim ersten Aufruf nach der Änderung
noch kompilierte und fünf Sekunden nicht reichten. Die Anmeldung wartet jetzt auf den Abschnitt statt
auf eine Frist.

### Was offen bleibt

- Der Abschnitt zeigt **heute**. Andere Tage bleiben der Anwesenheitsliste selbst (Out of Scope).


## Deployment

**Produktion:** https://app.viennasalsastudio.at — ausgeliefert am 2026-10-07
**Tag:** `v1.75.0-PROJ-75` (Commit `30112aa`)
**Vercel:** `…pkznaij85`, Ready, als Produktion aliasiert. **Keine Migration.**

### Nachprüfung von außen

`/admin` und `/lehrer` antworten mit der Login-Umleitung (307) — beides liegt hinter der Anmeldung
samt zweiter Stufe. Der Abschnitt selbst ist von außen nicht prüfbar; belegt ist er durch die fünf
E2E-Tests in beiden Browsern, die den Weg des Betreibers gehen: Dashboard öffnen, Zeile anklicken,
Anwesenheitsliste mit dem erwarteten Teilnehmer vorfinden.

### Für den Betrieb

Der Abschnitt steht und fällt mit dem **Wochentermin** am Kurs: Ein Kurs ohne hinterlegten
`course_schedule`-Eintrag findet an keinem Tag statt und erscheint nie. Fehlt ein Kurs dort, lohnt der
Blick auf seinen Wochentag, seine Pausen und — seit PROJ-51 — auf „Läuft von / Läuft bis".
