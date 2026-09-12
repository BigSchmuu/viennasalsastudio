# PROJ-52: Eine Probestunde je Kunde

## Status: Deployed
**Created:** 2026-09-12
**Last Updated:** 2026-09-12
**Priorität:** P0 (vor Start)

> Diese Spec entstand nicht aus einem vollen `/write-spec`-Interview, sondern
> aus einer konkreten Ansage des Betreibers und zwei entschiedenen
> Rückfragen. Sie hält fest, was gilt — nicht mehr.

## Dependencies
- Requires: PROJ-8 (Kursbuchung) — dort entsteht die Probestunde
- Berührt: PROJ-26 (Buchung vom Stundenplan), PROJ-29 (Probestunden-Follow-up),
  PROJ-39 (Missbrauchsbremse bei Selbstbuchungen)

## Problem

Eine Probestunde ist ein Geschenk des Studios, und sie war unbegrenzt: Ein
Kunde konnte in jedem Kurs eine buchen, und in jedem Kurs an jedem Termin.
Geprüft wurde nur, dass er nicht zweimal denselben Termin bucht, und dass
niemand mehr als zehn Selbstbuchungen in kurzer Zeit auslöst
(Missbrauchsbremse aus PROJ-39). Wer wollte, konnte also wochenlang gratis
tanzen.

## User Stories

- Als Betreiber will ich, dass jeder Kunde **genau eine** Probestunde bekommt,
  damit das Schnupperangebot kein Dauerabo wird.
- Als Kunde, der seine Probestunde schon hatte, will ich das klar gesagt
  bekommen, statt einen gesperrten Knopf zu sehen.
- Als Kunde mit einer noch bevorstehenden Probestunde will ich sie auf einen
  anderen Kurs oder einen anderen Termin verschieben können, ohne sie zu
  verlieren.

## Acceptance Criteria

- [ ] Angenommen ein Kunde hatte noch keine Probestunde, wenn er einen Kurs
      öffnet, dann kann er eine buchen wie bisher
- [ ] Angenommen die Probestunde eines Kunden liegt in der Vergangenheit, wenn
      er einen Kurs öffnet, dann steht dort, dass sie verbraucht ist — kein
      gesperrter Knopf
- [ ] Angenommen ein Kunde hat eine Probestunde, deren Termin noch aussteht,
      wenn er einen **anderen** Kurs öffnet, dann kann er sie auf diesen Kurs
      umbuchen
- [ ] Angenommen ein Kunde hat eine Probestunde, deren Termin noch aussteht,
      wenn er denselben Kurs öffnet, dann kann er den Termin ändern
- [ ] Angenommen ein Kunde bucht um, wenn dabei etwas schiefgeht, dann behält
      er seine alte Probestunde — nie beides und nie keines
- [ ] Angenommen ein Kunde hat seine Probestunde storniert, wenn er einen Kurs
      öffnet, dann darf er wieder eine buchen
- [ ] Angenommen der Aufruf kommt an der Oberfläche vorbei (alter Tab, direkter
      API-Aufruf), dann lehnt die Datenbank die zweite Probestunde ab
- [ ] Angenommen ein Kunde bucht auf einen Kurs mit Vorkenntnis-Hinweis um,
      dann muss er diesen Hinweis bestätigen

## Out of Scope

- **Probestunde vom Betreiber zurückgeben** — wenn ein Sonderfall es braucht,
  storniert er die Buchung; das gibt die Probestunde frei (siehe Decision Log).
- **Mehrere Probestunden als Kampagne** — kein Kontingent, keine Gutscheine.
  Eine Zahl, die man pflegen kann, wäre eine Zahl, die falsch stehen kann.
- **Drop-ins** bleiben unbegrenzt; sie sind bezahlt.

## Edge Cases

- **Probestunde gebucht, nicht erschienen** — gilt als verbraucht. Der Termin
  ist vorbei, und ob jemand da war, weiß die App nur, wenn der Lehrer die
  Anwesenheit erfasst hat.
- **Probestunde storniert** — gilt nicht als verbraucht.
- **Vom Betreiber abgelehnt** — gilt nicht als verbraucht.
- **Kurs läuft aus, während die Probestunde ansteht** — der Kunde kann auf
  einen laufenden Kurs umbuchen; das ist genau der Fall, für den das Umbuchen
  auf einen anderen Kurs da ist.
- **Umbuchen kurz vor dem Termin** — die bestehende Frist aus PROJ-8 gilt
  unverändert.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|---|---|---|
| Verbraucht ist die Probestunde erst, wenn ihr Termin vorbei ist | Vom Betreiber entschieden. Eine Erkältung darf die Probestunde nicht kosten — sonst kommt genau die Nachfrage per Nachricht zurück, die die App abschaffen soll. Vor Missbrauch schützt weiterhin die Bremse aus PROJ-39, und mehr als eine Stunde bekommt niemand | 2026-09-12 |
| Die gesamte Historie zählt, nicht erst ab einem Stichtag | Vom Betreiber entschieden. Die Regel gilt der Person, nicht einem Datum | 2026-09-12 |
| Eine stornierte oder abgelehnte Probestunde zählt nicht | Folgt aus der ersten Entscheidung. Nebeneffekt, bewusst: Der Betreiber kann eine Probestunde freigeben, indem er die Buchung storniert — dafür braucht es keinen eigenen Knopf | 2026-09-12 |
| Statt eines gesperrten Knopfes ein Satz | Ein toter Knopf lässt den Kunden den Fehler bei sich suchen. Dieselbe Überlegung wie beim Buchungs-Hindernis aus PROJ-8 | 2026-09-12 |

### Technical Decisions

| Decision | Rationale | Date |
|---|---|---|
| Das Umbuchen wird zu **einem** Datenbankvorgang | Bisher legte es eine neue Buchung an und stornierte danach die alte — mit der neuen Regel hätte es sich selbst blockiert, weil die alte beim Einfügen noch aktiv ist. In einer SQL-Funktion ist beides eine Transaktion: Schlägt das Einfügen fehl, ist die Stornierung mit zurückgenommen. Nebenbei verschwindet ein bestehender Fehler — bisher konnte der Kunde bei einem Fehler zwischen Einfügen und Stornieren zwei Buchungen haben | 2026-09-12 |
| Die Regel steht in der Datenbank, nicht nur in der Oberfläche | Die Oberfläche erklärt, die Datenbank entscheidet. Genau dieser Weg war bei PROJ-39 der Missbrauchspfad: Der Aufruf kam an der Oberfläche vorbei | 2026-09-12 |
| Ein gemeinsamer Begriff „Probestunden-Stand" | Vier Stellen zeigen den Buchungsdialog (Katalog, Kursdetail, Stundenplan, Dashboard). Vier eigene Rechnungen dazu liefen auseinander — dieselbe Lehre wie bei `course_members` in PROJ-50 | 2026-09-12 |

---

## Implementation Notes

**Stand 2026-09-12 — gebaut und geprüft.**

| Teil | Wo |
|---|---|
| Die Regel selbst | `create_self_service_booking` (Migration `20260912100000`), zwei unterscheidbare Fehler: `trial already used` / `trial already booked` |
| Umbuchen als ein Vorgang | `rebook_self_service_booking` — Stornieren und Neubuchen in einer Transaktion |
| Der Stand für die Oberfläche | `src/lib/bookings/probestunde.ts` (rein, 10 Unit-Tests) + `probestunde-laden.ts` |
| Drei Zustände im Dialog | `src/components/booking/booking-dialog.tsx`, Reiter „Probestunde" |
| „Verbraucht" sperrt den Knopf mit Begründung | `src/lib/bookings/hindernis.ts` (`probestundeVerbraucht`) |
| Zielkurs beim Umbuchen | `rebookBooking` in `src/lib/actions/booking.ts` |

### Was über die Spec hinaus nötig war

- **Die Rollenwahl war eine Sackgasse.** Sie stand im Reiter „Anmeldung", in dem
  Zweig, der nur erscheint, wenn dort auch gebucht werden kann — der Knopf war
  aber auf allen Reitern gesperrt, solange keine Rolle gewählt war. Für einen
  Kunden **ohne SEPA-Mandat** zeigt jener Reiter nur den Mandatshinweis: In
  einem Kurs mit Rollenabfrage war die Probestunde für ihn gar nicht buchbar.
  Ausgerechnet für den Menschen, für den eine Probestunde gedacht ist. Die
  Wahl steht jetzt unter den Reitern, also bei jeder Buchungsart.
- **Die Tanzrolle wurde verlangt und weggeworfen** — gespeichert hat sie nur die
  reguläre Anmeldung. Jetzt auch bei Probestunde und Drop-in, und beim Umbuchen
  wandert sie mit. Der Lehrer liest sie in Anwesenheitsliste und Rollenbalance.
- **Der Zielkurs kann Vorkenntnisse verlangen.** Beim Wechsel in einen anderen
  Kurs gilt die Bestätigung des alten nicht — dieselbe Klasse von Lücke wie die
  `p_carry_terms_from`-Hintertür aus PROJ-42.

### Tests

| Lauf | Ergebnis |
|---|---|
| PROJ-52 (eigene Suite) | 9/9 grün |
| `npm test` | 526 bestanden |
| Voller E2E-Lauf | 1112 bestanden, 6 übersprungen, 2 gefallen von 1120 (2,1 h) |

Die zwei Fehlschläge liegen in PROJ-41 (Admin-Bestätigung) und PROJ-49
(Lehrer-Link), **beide nur unter Mobile Safari**, beide in Bereichen, die dieses
Feature nicht berührt, und beide isoliert auf demselben Browser grün (32
bestanden). Signatur in beiden Fällen „das Erwartete war noch nicht da" — also
Zeitverhalten am Ende eines langen Laufs, nicht dieses Feature.

### Fixtures, die mitziehen mussten

- **PROJ-8** löschte Buchungen nur für ihren eigenen Kurs; eine Probestunde in
  einem beliebigen anderen blockiert jetzt ihre Geschichte.
- **Zwölf Testdateien** griffen den Buchungsknopf über seine Beschriftung, um
  den Dialog zu öffnen. Sie tun das jetzt über einen Lokator, der alle
  Beschriftungen kennt.

---

## QA Test Results

**Getestet:** 2026-09-12
**Umgebung:** lokal gegen die Testdatenbank (Migration `20260912100000` eingespielt)
**Prüfer:** QA Engineer (AI)

### Akzeptanzkriterien — 8 von 8

- [x] Wer noch keine hatte, bucht eine wie bisher
- [x] Vergangene Probestunde → „verbraucht" als Satz, kein toter Knopf, keine Terminauswahl
- [x] Anstehende Probestunde, **anderer** Kurs → umbuchbar; alte Buchung storniert, genau eine aktive bleibt
- [x] Anstehende Probestunde, **selber** Kurs → Termin änderbar (Hinweis *und* vollzogene Änderung geprüft)
- [x] Beim Umbuchen nie beides und nie keines — ein Fehler mitten im Vorgang nimmt die Stornierung zurück
- [x] Stornierte Probestunde gibt sie wieder frei
- [x] Am Dialog vorbei lehnt die Datenbank die zweite ab (`trial already used`)
- [x] Zielkurs mit Vorkenntnis-Hinweis verlangt die Bestätigung — auch beim direkten Aufruf

### Sicherheitsprüfung (Red Team)

Direkt gegen die Funktionen, als angemeldeter Kunde und anonym:

| Versuch | Ergebnis |
|---|---|
| Fremde Buchung umbuchen | abgewehrt — `booking not found` (`customer_id` im SELECT) |
| Reguläre Anfrage über die Umbuchungs-Funktion verschieben | abgewehrt — `not rebookable` |
| Ohne Anmeldung umbuchen | abgewehrt — `permission denied for function` (nur `authenticated`) |
| Zweite Probestunde am Dialog vorbei | abgewehrt — `trial already used` |
| Vorkenntnis-Bestätigung überspringen | abgewehrt — `prerequisite not confirmed`, alte Buchung blieb intakt |
| **Probestunde auf einen beliebigen Termin legen** | **offen — siehe BUG-1** |

### Automatisierte Tests

| Lauf | Ergebnis |
|---|---|
| PROJ-52 (eigene Suite) | 9/9 grün |
| `npm test` | 526 bestanden |
| Voller E2E-Lauf (Chromium + Mobile Safari) | 1112 bestanden, 6 übersprungen, 2 gefallen von 1120 |

Die zwei Fehlschläge (PROJ-41 Admin-Bestätigung, PROJ-49 Lehrer-Link) treten nur
unter Mobile Safari auf, liegen außerhalb dieses Features und laufen isoliert auf
demselben Browser grün (32 bestanden). Signatur „das Erwartete war noch nicht
da" — Zeitverhalten am Ende eines langen Laufs.

### Gefundene Fehler

#### BUG-1: Eine Selbstbuchung lässt sich auf einen beliebigen Termin legen
- **Schwere:** Mittel
- **Nicht von diesem Feature verursacht** — die Lücke bestand schon vorher; die
  neue Umbuchungs-Funktion erbt sie.
- **Schritte:**
  1. Als Kunde anmelden, `create_self_service_booking` direkt aufrufen
  2. `p_chosen_date` auf einen Tag setzen, an dem der Kurs nicht stattfindet
     (anderer Wochentag, Jahre in der Zukunft)
  3. Erwartet: Ablehnung
  4. Tatsächlich: Buchung entsteht mit Status `confirmed`. Nachgestellt mit
     einem Samstagskurs und dem 01.01.2031, einem Mittwoch
- **Warum das zählt:** Die Terminprüfung steht nur in der Server-Aktion
  (`getValidOccurrenceDates`). Genau dieser Unterschied war bei PROJ-39 der
  Befund: „the abuse path bypasses this action entirely". Die anderen Prüfungen
  wanderten damals in die Funktion, die Terminprüfung blieb zurück.
- **Folgen:** Ein Kunde kann seine eine Probestunde auf einen Fantasietermin
  legen und sie damit dauerhaft „offen" halten; im Dashboard erscheint der
  Termin als nächster Kurs, und der Betreiber sieht eine Buchung für einen Tag,
  an dem nichts stattfindet.
- **Vorschlag, bewusst knapp gehalten:** Wochentag gegen `course_schedule` und
  Datum gegen `courses.runs_from/runs_until` prüfen — sechs Zeilen SQL. Die
  volle Terminrechnung (Ausfalltage, Ferien) gehört laut Entscheidung vom
  2026-09-11 **nicht** in die Datenbank; eine Buchung auf einen ausgefallenen
  Termin ist das kleinere Übel als eine fünf Jahre entfernte.
- **Priorität:** Nächste Runde, eigenes Ticket — gehört zu PROJ-8/PROJ-39, nicht
  zu PROJ-52

### Zusammenfassung

- **Akzeptanzkriterien:** 8/8 bestanden
- **Fehler:** 1 (0 kritisch, 0 hoch, 1 mittel, 0 niedrig) — und dieser bestand
  schon vor diesem Feature
- **Sicherheit:** fünf von sechs Angriffen abgewehrt; der sechste ist BUG-1
- **Produktionsreif:** **JA** — kein kritischer oder hoher Fehler
- **Empfehlung:** Deployen. BUG-1 als eigenes Ticket nachziehen; er verschlechtert
  den Stand nicht, er stand vorher genauso offen

---

## Deployment

**Deployed:** 2026-09-12, 20:56 Uhr
**Produktions-URL:** https://app.viennasalsastudio.at
**Commit:** `c00c127`
**Tag:** `v1.54.0-PROJ-52`

### Reihenfolge — hier ausnahmsweise Code vor Migration

Die Migration `20260912100000` ist **nicht** rückwärtskompatibel: Sie löscht die
alte Signatur von `create_self_service_booking` und legt eine mit
`p_dance_role` an. Der alte Code hätte die neue nicht gefunden, der neue findet
die alte nicht. Deshalb: erst deployen, dann sofort das SQL.

Zwischen 20:56 und dem Einspielen scheiterten Probestunden- und
Drop-in-Buchungen mit einer Fehlermeldung. Reguläre Anmeldungen, Warteliste,
Abo-Verwaltung, Lastschriften und der Lehrerbereich waren nicht betroffen —
die laufen über andere Funktionen. Kein Datenschaden, kein stiller Fehler.

### Prüfung nach dem Deploy

- [x] Öffentliche Seiten antworten mit 200, Stundenplan und Katalog rendern
- [x] Beide neuen Datenschutz-Absätze ausgeliefert
- [x] **Probestunde in Produktion gebucht — geht durch** (vom Betreiber geprüft)
- [ ] Vercel-Funktionslogs: nicht geprüft, kein CLI-Zugang in dieser Sitzung

Die Datenbankseite ließ sich von hier nicht prüfen: Der Zugang ist auf das
Testprojekt begrenzt, und das gilt auch für Umwege über den öffentlichen
Schlüssel. Die eine Prüfung, die zählte — eine echte Probestundenbuchung —
hat der Betreiber übernommen.

### Offen

**BUG-1 aus dem QA-Durchgang** (Mittel, geerbt): Die Terminprüfung steht nur in
der Server-Aktion. Direkt aufgerufen entsteht eine bestätigte Selbstbuchung auf
einem beliebigen Tag. Eigenes Ticket, gehört zu PROJ-8/PROJ-39.
