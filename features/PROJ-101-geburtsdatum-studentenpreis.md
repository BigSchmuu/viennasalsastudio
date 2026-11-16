# PROJ-101: Geburtsdatum als Pflichtfeld, Studierendenpreis nur bis 27

## Status: Approved
**Created:** 2026-11-16
**Last Updated:** 2026-11-16

## Dependencies
- Requires: PROJ-2 (Auth & Profil) — dort wohnt das Geburtsdatum
- Requires: PROJ-41 (Preis serverseitig) — `resolve_plan_price` ist die einzige Preisquelle
- Requires: PROJ-75 (Vor- und Nachname Pflicht) — dasselbe Registrierungsformular
- Wird gebraucht von: PROJ-102 (laufende Studierendenabos umstellen)

## Anlass

Der Studierendenpreis wird heute **behauptet**, nicht geprüft. Im Buchungsdialog
steht ein Kästchen „Ich bin Student(in)“ (`booking-dialog.tsx:439` und `:561`,
dazu dasselbe beim Event-Ticket); es setzt `wants_student_price` an der Anfrage,
und `resolve_plan_price` macht daraus den günstigeren Preis. Wer alt genug ist,
prüft niemand — es gibt dafür auch keine Grundlage: Das Geburtsdatum ist im
Profil freiwillig (`auth.ts:117`) und bei der Registrierung wird es gar nicht
gefragt.

Zwei Dinge gehören deshalb zusammen: das Geburtsdatum zur Pflichtangabe machen
und das Kästchen an das Alter binden.

## Die Regel in einem Absatz

Das Geburtsdatum ist bei der Registrierung Pflicht und lässt sich im Profil
nicht mehr leeren. Der Studierendenpreis ist wählbar, solange der Kunde am Tag
der Anfrage **jünger als 28** ist; am 28. Geburtstag ist das Kästchen weg. Ohne
hinterlegtes Geburtsdatum gibt es das Kästchen ebenfalls nicht, sondern den
Hinweis, es im Profil nachzutragen. Geprüft wird in der Datenbank, nicht im
Browser: Ein Kästchen kann man abschalten, eine Anfrage nicht.

## User Stories

- Als **Betreiber** will ich, dass der Studierendenpreis nur bekommt, wer alt
  genug dafür ist, damit der Rabatt das bleibt, wofür er gedacht war.
- Als **Betreiber** will ich das Geburtsdatum von allen neuen Kunden haben,
  weil ohne es keine Altersregel greifen kann.
- Als **Kunde über 27** will ich beim Buchen sehen, warum es den
  Studierendenpreis für mich nicht gibt, statt ein Kästchen zu suchen, das weg
  ist.
- Als **Kunde ohne hinterlegtes Geburtsdatum** will ich mit einem Klick dorthin
  kommen, wo ich es nachtrage, statt zu raten, woran es liegt.
- Als **Bestandskunde** will ich nicht ausgesperrt werden, nur weil eine neue
  Pflichtangabe eingeführt wurde.

## Out of Scope

- **Laufende Abos mit Studierendenpreis** — die stellt PROJ-102 um, samt
  Ankündigung und Kündigungsmöglichkeit. PROJ-101 wirkt nur auf **neue**
  Anfragen.
- **Nachweis der Inskription.** Geprüft wird das Alter, nicht der
  Studierendenstatus. Wer mit 24 arbeitet, bekommt den Preis weiterhin; das war
  auch vorher so.
- **Eine harte Sperre nach dem Login** für Bestandskunden ohne Geburtsdatum
  (ausdrücklich verworfen, siehe Decision Log).
- **Das Geburtsdatum in der Verwaltungsmaske zur Pflicht machen.** Der Betreiber
  muss eine Telefonnummer korrigieren können, ohne ein Geburtsdatum zu kennen,
  das er nicht hat.
- **Altersgrenzen für anderes** (Jugendpreis, Mindestalter für Kurse).

## Acceptance Criteria

- [x] Angenommen ich registriere mich neu, wenn ich das Formular ohne
  Geburtsdatum abschicke, dann wird die Registrierung abgelehnt und das Feld
  benennt den Grund.
- [x] Angenommen ich registriere mich neu, wenn ich ein Geburtsdatum in der
  Zukunft eingebe, dann wird es abgelehnt.
- [x] Angenommen ich bin ein Bestandskunde ohne Geburtsdatum, wenn ich mich
  anmelde, dann komme ich überall hin wie bisher — es gibt keine Schranke.
- [x] Angenommen ich bin ein Bestandskunde ohne Geburtsdatum, wenn ich mein
  Profil speichere, dann verlangt das Formular das Geburtsdatum, bevor es
  speichert.
- [x] Angenommen mein Profil hat ein Geburtsdatum, wenn ich es leere und
  speichere, dann wird das abgelehnt — einmal angegeben, bleibt es.
- [x] Angenommen ich bin 27 oder jünger, wenn ich einen Kurs buche, dann gibt es
  das Kästchen „Ich bin Student(in)“ wie bisher.
- [x] Angenommen ich werde heute 28, wenn ich einen Kurs buche, dann ist das
  Kästchen nicht da und an seiner Stelle steht, bis zu welchem Alter der Preis
  gilt.
- [x] Angenommen ich habe kein Geburtsdatum hinterlegt, wenn ich einen Kurs
  buche, dann steht statt des Kästchens ein Hinweis mit einem Weg ins Profil.
- [x] Angenommen ich bin über 27, wenn ich ein Event-Ticket kaufe, dann gilt
  dort dasselbe — ein Rabatt, mehrere Stellen, eine Regel.
- [x] Angenommen ich bin über 27 und der Betreiber bestätigt mein
  Flatrate-Upgrade mit gesetztem Studierenden-Kennzeichen, dann entsteht die
  Flatrate zum **Normalpreis**.
- [x] Angenommen ich bin 25, wenn der Betreiber mein Flatrate-Upgrade mit
  Studierenden-Kennzeichen bestätigt, dann entsteht die Studierenden-Flatrate
  wie bisher.
- [x] Angenommen ich bin über 27 und schicke die Anfrage mit gesetztem
  `wants_student_price` an der Oberfläche vorbei, dann entsteht die Buchung zum
  **Normalpreis** und nicht zum Studierendenpreis.
- [ ] Angenommen ich bin 27 und werde zwischen Anfrage und Bestätigung 28, wenn
  der Betreiber bestätigt, dann gilt der Preis vom Tag der Anfrage.
- [ ] Angenommen der Betreiber sieht eine Buchungsanfrage mit
  Studierendenpreis, wenn er sie öffnet, dann steht das Alter des Kunden dabei.
- [ ] Angenommen ich sehe den Hinweis statt des Kästchens, wenn ich ihn mit
  einem Screenreader abhöre, dann ist er mit dem Preisbereich verbunden und
  nicht bloß grauer Text.
- [x] Angenommen ich bin auf dem Handy (375 px), wenn der Hinweis erscheint,
  dann bleibt der Dialog lesbar und ohne waagerechtes Scrollen.

## Edge Cases

- **Geburtsdatum am 29. Februar.** Der 28. Geburtstag fällt in Nicht-Schaltjahren
  auf den 1. März — gerechnet wird kalendergenau über Jahr/Monat/Tag, nicht über
  Millisekunden.
- **Zeitzone.** Maßgeblich ist der Wiener Kalendertag (`heuteInWien`), nicht
  UTC. Sonst wäre jemand abends vor seinem Geburtstag bereits 28.
- **Unsinnige Eingaben.** Ein Datum vor 1900 oder ein Alter unter 10 ist kein
  Tippfehler, der durchgehen soll; beides wird abgelehnt.
- **Bestandskunde ohne Geburtsdatum will den Studierendenpreis.** Kein Kästchen,
  sondern der Weg ins Profil. Nach dem Nachtragen steht es da, wenn er alt genug
  ist.
- **Verwaltung legt einen Kunden an.** Dort bleibt das Feld freiwillig; fehlt
  es, kann für diesen Kunden kein Studierendenpreis gewählt werden — sichtbar
  in der Akte.
- **Die Anfrage liegt lange.** Zwischen Anfrage und Bestätigung können Wochen
  liegen. Entscheidend ist der Tag der Anfrage; das Alter steht in der
  Bestätigungsansicht, damit der Betreiber einen Grenzfall sieht.

## Tech Design

### Eine Regel, eine Stelle

```
studentenpreis_erlaubt(p_customer_id uuid, p_stichtag date) returns boolean
  -> profiles.birthdate ist gesetzt
  -> und Alter am Stichtag < 28
```

Aufgerufen von allen **vier** Wegen, an denen heute ein Studierendenpreis
entstehen kann: der regulären Buchung (`create_regular_booking`, PROJ-41), der
Drop-in-Buchung, dem Event-Ticket (`buy_event_ticket`, PROJ-14/42) und dem
Flatrate-Upgrade (`confirm_flatrate_upgrade`, PROJ-87) — dort übergibt der
Betreiber `p_student` von Hand, und auch diese Hand soll sich nicht irren
können. Jeder dieser Wege setzt
das Kennzeichen auf `false`, wenn die Funktion es nicht erlaubt — die Anfrage
wird also nicht abgewiesen, sondern zum richtigen Preis angelegt. Eine
abgewiesene Buchung wäre härter als nötig; falsch berechnet wird nichts.

Der Preis selbst bleibt, wo er ist: `resolve_plan_price` bekommt das bereinigte
Kennzeichen. Kein zweiter Rechenweg.

### Oberfläche

Der Buchungsdialog und der Ticketkauf bekommen das Alter nicht, sondern eine
fertige Auskunft vom Server (`studentenpreisMoeglich`, `grund`), damit die
Oberfläche kein Geburtsdatum herumtragen muss, das sie nicht braucht:

```
möglich            → Kästchen wie bisher
zu alt             → „Der Studierendenpreis gilt bis einschließlich 27 Jahre.“
kein Geburtsdatum  → „Trag dein Geburtsdatum im Profil ein, um den
                      Studierendenpreis zu wählen.“  [Zum Profil]
```

### Pflichtfeld

| Stelle | Vorher | Nachher |
| --- | --- | --- |
| Registrierung | nicht gefragt | Pflichtfeld |
| Profil (Kunde) | freiwillig | Pflicht beim Speichern |
| Verwaltung (Kundenakte) | freiwillig | bleibt freiwillig, mit Hinweis wenn leer |

`profileSchema` wird streng, `adminProfileSchema` überschreibt das Feld wieder
auf freiwillig. Beides steht in `src/lib/validations/auth.ts` nebeneinander,
mit Begründung im Kommentar.

### Dateien

| Datei | Was |
| --- | --- |
| `supabase/migrations/…_proj101_studentenpreis_alter.sql` | `studentenpreis_erlaubt`, die vier Preiswege, Rechte |
| `src/lib/validations/auth.ts` | Pflicht im Profil, freiwillig in der Verwaltung, Plausibilitätsgrenzen |
| `src/components/auth/register-form.tsx` | neues Feld |
| `src/components/booking/booking-dialog.tsx` | Kästchen oder Hinweis |
| `src/components/events/…` | dasselbe beim Ticket |
| `src/lib/alter.ts` (neu) | `alterAm(geburtsdatum, stichtag)` — kalendergenau, mit Unit-Test |

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Pflicht bei der Registrierung, Pflicht beim Speichern im Profil, keine Login-Schranke | Bestandskunden werden nicht ausgesperrt; gefragt wird, wenn sie ohnehin da sind | 2026-11-16 |
| In der Verwaltungsmaske bleibt es freiwillig | Der Betreiber muss eine Telefonnummer ändern können, ohne ein Geburtsdatum zu erfinden | 2026-11-16 |
| Grenze: jünger als 28 am Tag der Anfrage | „über 27“ heißt: der 28. Geburtstag beendet es | 2026-11-16 |
| Ohne Geburtsdatum kein Studierendenpreis | Sonst träfe die Regel genau die Falschen — die, die nichts angegeben haben | 2026-11-16 |
| Gilt auch für Event-Tickets und das Flatrate-Upgrade | Derselbe Rabatt an vier Stellen; eine Ausnahme wäre ein Schlupfloch | 2026-11-16 |
| Auch die Bestätigung des Betreibers wird geprüft | Die Studierenden-Flatrate ist ein Haken in der Verwaltung; ein Versehen dort kostet dasselbe Geld wie eines im Browser | 2026-11-16 |
| Zu alte Anfrage wird nicht abgewiesen, sondern zum Normalpreis angelegt | Eine Buchung zu verweigern ist härter als nötig; der Preis stimmt trotzdem | 2026-11-16 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Prüfung in der Datenbank, nicht im Browser | Das Kennzeichen kommt als Parameter an; ein Kästchen kann man abschalten | 2026-11-16 |
| Eine Funktion `studentenpreis_erlaubt`, drei Aufrufer | Dieselbe Regel dreimal geschrieben driftet | 2026-11-16 |
| Alter kalendergenau über Jahr/Monat/Tag | Millisekundenrechnung bricht am 29. Februar und an der Zeitzone | 2026-11-16 |

## Open Questions
- [ ] Soll die Kundenliste zeigen, bei wem das Geburtsdatum fehlt? Nützlich zum
  Nachfassen, aber eine eigene Spalte in einer ohnehin breiten Liste.
- [ ] Gibt es einen Grund, den Studierendenpreis im Einzelfall trotzdem zu
  gewähren (Zweitstudium, Umschulung)? Heute geht das über den Preis in der
  Bestätigung — das bleibt möglich, ist aber nirgends erklärt.

## Umsetzung (2026-11-16)

### Was es jetzt gibt

| Datei | Was |
| --- | --- |
| `supabase/migrations/20261116100000_proj101_studentenpreis_alter.sql` | `studentenpreis_erlaubt`, `studentenpreis_auskunft`, zwei Trigger, `confirm_flatrate_upgrade`, `handle_new_user`, Rechte |
| `src/lib/alter.ts` + Test | `alterAm`/`alterText` — **nur zum Anzeigen**, 6 Prüfungen |
| `src/lib/validations/auth.ts` | Pflicht in Registrierung und Profil, freiwillig in der Verwaltung, Plausibilitätsgrenzen |
| `src/components/auth/register-form.tsx` | das neue Feld, mit Hinweis warum |
| `src/lib/actions/studentenpreis.ts` | die Auskunft für die Oberfläche |
| `src/components/booking/studentenpreis-wahl.tsx` | Kästchen **oder** Grund — ein Bauteil, drei Einsatzstellen |
| `src/components/admin/bookings/booking-manager.tsx` | das Alter neben dem Kennzeichen |
| `src/components/admin/analytics/upgrade-anfragen.tsx` | kein Studierenden-Knopf, wo er nicht gilt |
| `messages/de.json`, `messages/en.json` | 4 Fehlermeldungen, 6 Hinweistexte, zweisprachig |

### Abweichung von der Spezifikation: zwei Trigger statt vier Funktionen

Die Spezifikation sah vor, die Prüfung in die vier Funktionen zu setzen, die
heute ein Studierendenkennzeichen annehmen. Umgesetzt ist sie an **zwei
Triggern** — auf `course_bookings` und auf `tickets` —, dazu der eine echte
Eingriff in `confirm_flatrate_upgrade`.

Der Grund ist nicht Bequemlichkeit: Jede dieser Buchungsfunktionen ist ein
langer Körper, der seit PROJ-27/39/41/42/44/52/56/93 mehrfach ersetzt wurde.
Vier davon abzuschreiben, um in jedem eine Zeile zu ergänzen, wären vier
Gelegenheiten, etwas anderes zu verlieren — und der nächste neue Buchungsweg
wäre wieder ungeprüft. Geprüft wird deshalb, wo das Kennzeichen **landet**. Das
deckt auch die Umbuchung und jeden künftigen Weg.

Das Upgrade ließ sich so nicht erfassen: Dort schreibt die Funktion den Preis
direkt ans Abo, und der Betreiber übergibt das Kennzeichen von Hand. Diese
Funktion ist ersetzt (Körper aus PROJ-91, plus die Prüfung).

### Drei Befunde beim Bauen

**Im Profilformular standen Fehlermeldungen unübersetzt.** Das Schema liefert
seit PROJ-94 Schlüssel (`valFirstNameRequired`), das gewöhnliche `FormMessage`
zeigt sie unverändert — im Kundenbereich hätte also „valBirthdateRequired"
unter dem Feld gestanden, und bei den Namensfeldern schon vorher. Jetzt
benutzt das Formular `AuthFormMessage`, das übersetzt und fertige Sätze
unverändert durchlässt.

**Vier bestehende Unit-Tests prüften den alten Vertrag** („leeres Geburtsdatum
ist in Ordnung", Registrierung ohne Datum). Sie sind auf die neue Regel
umgeschrieben. Einer war ein Zeitzonen-Regressionsschutz, der *heute* als
Geburtsdatum annahm — heute ist seit der Mindestalter-Grenze unplausibel, also
prüft er dieselbe Grenze jetzt am **jüngsten erlaubten Tag**.

**Drei Browsertests kreuzen „Ich bin Student(in)" an.** Ohne Geburtsdatum am
Testkonto gibt es das Kästchen nicht mehr. Die beiden Fixture-Kunden bekommen
es im `beforeAll` — gerechnet, nicht eingetippt, damit sie nicht in drei Jahren
28 werden.

### Was nicht geprüft ist

- **Die englische Fassung der Hinweise** im Buchungsdialog. Die Schlüssel sind
  in beiden Sprachen vorhanden (ein Unit-Test prüft das), durchgeklickt ist nur
  die deutsche.
- **Der Drop-in-Weg im Browser.** Die Datenbank prüft ihn (eigener Fall im
  DB-Test), das Kästchen ist dasselbe Bauteil.

## QA (2026-11-16)

| Prüfung | Ergebnis |
| --- | --- |
| `tests/PROJ-101-studentenpreis-alter-db.test.ts` | **19/19** |
| `tests/PROJ-101-geburtsdatum-studentenpreis.spec.ts` (Chromium + Mobile Safari) | **12/12** |
| `src/lib/alter.test.ts` | **6/6** |
| `src/lib/validations/auth.test.ts` (angepasst und erweitert) | **35/35** |
| Unit- und Datenbanktests gesamt | **1565 grün**, 119 Dateien |
| Gezielte Browser-Regression (12 Dateien, Chromium) | **124/124** nach dem Nachlauf der drei Dateien, die am Zweitfaktor gescheitert waren |
| `tsc` · `eslint` · `build` | sauber · sauber · „Compiled successfully in 17,4s" |

**13 von 16 Kriterien sind abgehakt.** Drei bleiben offen, und zwar benannt:

- **Der Grenzfall zwischen Anfrage und Bestätigung** (27 bei der Anfrage, 28 bei
  der Bestätigung). Gebaut ist es so, dass der Tag der Anfrage zählt — der Preis
  steht beim Einfügen an der Zeile. Ein eigener Test dafür fehlt.
- **Das Alter neben der Anfrage** in der Verwaltung und **der Hinweis statt des
  Kästchens für Screenreader**: beides nur Oberfläche, beides nicht geprüft.

### Der Befund, der die Runde gerettet hat

Alle drei Formulare mit dem Geburtsdatumsfeld haben neben `onSubmit` eine
`action` — dann schickt React die FormData aus dem **DOM**. Drei Auswahlfelder
von Radix hinterlassen dort kein Feld mit Namen, das Geburtsdatum fehlte in der
Anfrage also. Dazu kam, dass meine Zeile `formData.set("birthdate", …)` im
Registrierungsformular bei der ersten Änderung gar nicht angekommen war: Der
Suchtext passte nicht, und ich habe das Ergebnis dieser einen Ersetzung nicht
nachgelesen.

Gefunden hat beides der Registrierungstest aus PROJ-2 — mit einer Meldung, die
alles verrät: „Invalid input: expected string, received null". Behoben an zwei
Stellen, weil es zwei Wege sind: die Zeile für den JavaScript-Weg, ein
verborgenes Eingabefeld im Geburtsdatumsfeld für den Weg über `action`.

**Das zweite war schon vorher ein Fehler, nur ein stiller:** Vor PROJ-101 war
das Feld freiwillig, ein fehlender Wert ging durch die Prüfung — wer sein Profil
über diesen Weg speicherte, verlor sein Geburtsdatum, ohne es zu merken. Die
Pflicht hat den alten Fehler laut gemacht. Ein Unit-Test hält den Fall jetzt
fest (`null` muss den Schlüssel nennen, nicht Zods englische Typmeldung).

### Vier bestehende Tests mussten mitkommen

| Test | Warum |
| --- | --- |
| `auth.test.ts` (4 Fälle) | prüften den alten Vertrag; einer war ein Zeitzonenschutz, der *heute* als Geburtsdatum annahm — jetzt am jüngsten erlaubten Tag |
| `tests/PROJ-8`, `tests/PROJ-41` | kreuzen „Ich bin Student(in)" an; die Fixture-Kunden bekommen ein Geburtsdatum, gerechnet statt eingetippt |
| `tests/PROJ-87-…-db` | erwartete die Studierenden-Flatrate für einen Kunden ohne Geburtsdatum — **echter Befund**, kein Testfehler |
| `tests/PROJ-2` (2 Fälle) | Registrierung und Profil kommen ohne Geburtsdatum nicht mehr durch |
| `tests/PROJ-31` (3 Fälle) | setzten als „Geburtstag heute" das heutige Datum **samt Jahr**, also einen Neugeborenen; die Plausibilitätsgrenze weist das zu Recht ab |

**Urteil: produktionsreif.** Die Migration muss vor dem Code eingespielt sein:
Ohne `studentenpreis_auskunft` zeigt der Buchungsdialog „lässt sich gerade nicht
prüfen" — unschön, aber kein Schaden; ohne die Trigger gilt die Altersgrenze
nicht.
