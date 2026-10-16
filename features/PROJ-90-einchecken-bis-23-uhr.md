# PROJ-90: Einchecken noch nachträglich bis 23 Uhr

## Status: In Progress
**Created:** 2026-10-16
**Last Updated:** 2026-10-16

## Dependencies
- Requires: PROJ-25 (Self-Check-In) — die Frist, die hier eine Obergrenze bekommt
- Requires: PROJ-45 (Kunden-Dashboard) — der Ort, an dem die Karte verschwand

## Anlass

Wer sich nach dem Kurs einchecken will, kann das nicht — und zwar aus einem Grund, den man der
Oberfläche nicht ansieht: Die Datenbank erlaubt den Self-Check-In **den ganzen Kurstag** (begrenzt
ist nur das *Zurücknehmen* nach Kursende). Verschwunden ist der Knopf, weil das Dashboard den Termin
aussortiert, sobald seine Endzeit vorbei ist:

```
const laufendOderKuenftig = termine.filter((t) => t.ende.getTime() > jetzt.getTime());
```

Die Karte fällt also in der Sekunde des Kursendes weg, und mit ihr der Knopf. Wer um 21:30 merkt,
dass er vergessen hat zu drücken, hat keine Stelle mehr dafür.

Für die **Lehrkraft** gilt diese Grenze nie: `mark_attendance` weist nur Termine in der *Zukunft*
ab. Sie kann abends und auch Tage später nachtragen. Es geht hier allein um den Kunden.

## User Stories

- Als Schüler möchte ich mich nach dem Kurs noch einchecken können, wenn ich es vorher vergessen
  habe.
- Als Schüler möchte ich erkennen, dass der Kurs vorbei ist und ich nur noch nachtrage.
- Als Betreiber möchte ich, dass daraus kein Einchecken für gestern wird.

## Out of Scope

- **Einchecken für einen früheren Tag.** Der Self-Check-In gilt dem heutigen Kurstag; was länger
  zurückliegt, trägt die Lehrkraft nach. Daran ändert sich nichts.
- **Zurücknehmen nach Kursende.** Bleibt gesperrt (PROJ-25): Ein Check-In, den die Lehrkraft gesehen
  hat, soll nicht nachträglich verschwinden.
- **Eine Frist für die Lehrkraft.** Sie hat keine und braucht keine.
- **Mitternacht statt 23 Uhr.** Vom Betreiber auf 23 Uhr gesetzt; die letzte Stunde des Tages bleibt
  frei, damit „heute" und „gestern" sich nicht an der Tagesgrenze berühren.

## Acceptance Criteria

- [ ] Angenommen ein Kurs endete um 20:00, wenn der Schüler um 21:30 sein Dashboard öffnet, dann
      steht der Termin des Tages noch da und der Knopf „Ich bin da" ist bedienbar.
- [ ] Angenommen er drückt um 21:30, dann ist er für **diesen** Kurstag als anwesend erfasst.
- [ ] Angenommen es ist 23:30, dann ist der Termin weg und der Knopf nicht mehr da.
- [ ] Angenommen jemand ruft die Funktion um 23:30 trotzdem auf, dann weist die **Datenbank** ab —
      die Frist steht nicht nur in der Oberfläche.
- [ ] Angenommen der Kurs läuft noch, dann verhält sich alles wie bisher.
- [ ] Angenommen der Kurs ist vorbei und er ist eingecheckt, dann kann er es **nicht** zurücknehmen
      — unverändert.
- [ ] Angenommen es ist der nächste Tag, dann ist der Kurs von gestern nicht mehr eincheckbar.

## Edge Cases

- **Ein Kurs, der nach 23 Uhr endet.** Dann endet die Nachtragsfrist mit dem Kursende, nicht davor —
  die Grenze darf nie *vor* dem regulären Fenster liegen.
- **Zwei Kurse am selben Tag**, einer vorbei, einer später: Beide stehen da, jeder mit seinem
  eigenen Zustand.
- **Mitternacht.** Um 23:00 fällt die Karte weg; der Tageswechsel ändert daran nichts mehr.
- **Ein Kurs, der heute pausiert** (Ferien, Ausfall): unverändert kein Check-In.

## Decision Log

### Product Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Nachtragen bis 23 Uhr | Vom Betreiber vorgegeben. Deckt den Abend ab, ohne bis an die Tagesgrenze zu gehen. | 2026-10-16 |
| Nur für den Kunden | Die Lehrkraft hat ohnehin keine Frist; eine einzuführen wäre eine Verschlechterung. | 2026-10-16 |
| Zurücknehmen bleibt bei Kursende gesperrt | Unverändert aus PROJ-25: Ein gesehener Check-In soll nicht verschwinden. Nachtragen ist etwas anderes als Widerrufen. | 2026-10-16 |

### Technical Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Die Frist steht in der Datenbank **und** in `constants/checkin.ts` | Dieselbe Bauweise wie die 6-Stunden-Frist: Die Oberfläche entscheidet, ob der Knopf erscheint, die Datenbank entscheidet wirklich. Der Kommentar dort zeigt auf diese Doppelung. | 2026-10-16 |
| Der Filter im Dashboard wird erweitert, nicht entfernt | Künftige Termine sollen weiter künftig heißen. Ergänzt wird nur: „oder heute und noch vor 23 Uhr". | 2026-10-16 |
| Die Grenze gilt nie vor dem Kursende | Ein Kurs, der bis 23:30 läuft, wäre sonst schon während des Unterrichts nicht mehr eincheckbar. | 2026-10-16 |

## Open Questions

- [x] Soll die Karte nach Kursende sagen „Kurs vorbei — du kannst noch nachtragen"? → Ja, als
      **Zeile am Knopf**, nicht als eigener Tageszustand: Über dem Knopf steht „Kurs vorbei —
      Einchecken noch bis 23:00 möglich.", die Beschriftung des Tages bleibt „Heute". Ohne das
      stünde an einer Karte „HEUTE" ein Knopf „Ich bin da" für eine Stunde, die schon war
      (2026-10-16).

## Umsetzung (2026-10-16)

**Die Zahl:** `SELF_CHECKIN_NACHTRAG_BIS_STUNDE = 23` in
[checkin.ts](../src/lib/constants/checkin.ts), neben der 6-Stunden-Frist und mit
demselben Hinweis: Hier entscheidet sie, ob die Karte stehen bleibt, in der
Datenbank entscheidet sie wirklich.

**Die Karte:** der Filter in
[naechster-termin.ts](../src/lib/dashboard/naechster-termin.ts) hält einen
heutigen Abo-Termin bis zur Grenze fest. Die Bedingung ist eine **Ergänzung** —
was noch läuft, war schon vorher drin, weshalb die Grenze nie vor dem Kursende
greifen kann. Buchungen bleiben draußen: An einer Probestunde ist nichts
nachzutragen, und eine Karte ohne Knopf erklärte sich nicht.

**Der Hinweis:** `nachtrag` an
[mein-bereich/page.tsx](../src/app/[locale]/(site)/mein-bereich/page.tsx)
gesetzt, in
[next-course-section.tsx](../src/components/dashboard/next-course-section.tsx)
als Zeile über dem Knopf gezeigt, Text als `nextCourse.checkinLate` auf Deutsch
und Englisch. Die Uhrzeit darin kommt aus derselben Konstante.

**Die Grenze selbst:** Migration
[20261016140000_proj90_nachtragen_bis_23_uhr.sql](../supabase/migrations/20261016140000_proj90_nachtragen_bis_23_uhr.sql)
— `self_toggle_attendance` kennt jetzt `v_nachtrag_bis` und weist mit `too late`
ab. `greatest(…, v_class_ends)` hält die Grenze hinter dem Kursende, damit ein
Kurs bis 23:30 nicht mitten im Unterricht zufällt. Die Meldung dazu in
[self-checkin.ts](../src/lib/actions/self-checkin.ts).

**Geprüft:** fünf neue Vitest-Fälle in
[naechster-termin.test.ts](../src/lib/dashboard/naechster-termin.test.ts) (nach
Kursende bleibt der Abend, nach 23 Uhr nicht; ein Kurs bis 23:30 bleibt während
des Unterrichts; gestern bleibt zu; eine Buchung bleibt nicht stehen) — der alte
Fall „springt nach Kursende auf die Folgewoche" ist genau die Regel, die diese
Änderung aufhebt, und wurde ersetzt. Dazu zwei Datenbankprüfungen in
[PROJ-25-checkin-fenster-db.test.ts](../tests/PROJ-25-checkin-fenster-db.test.ts):
eine, die ihre Erwartung wie ihre Nachbarn aus der Uhrzeit ableitet und deshalb
zu jeder Tageszeit die Regel misst, und eine, die belegt, dass das
Zurücknehmen nach Kursende weiterhin gesperrt ist.
