# PROJ-52: Eine Probestunde je Kunde

## Status: In Progress
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
