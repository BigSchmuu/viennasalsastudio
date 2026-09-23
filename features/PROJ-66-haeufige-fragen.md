# PROJ-66: Seite mit häufigen Fragen

## Status: In Review
**Created:** 2026-09-23
**Last Updated:** 2026-09-23

## Dependencies
- Requires: PROJ-43 (Englische Sprachvariante) — die Seite gehört in beide Sprachfassungen
- Berührt: PROJ-8 (Kursbuchung), PROJ-9 (Abo-Verwaltung), PROJ-25 (Self-Check-In), PROJ-44
  (Empfehlungsprogramm) — die Antworten beschreiben deren Regeln

## Anlass

Dieselben Fragen kommen immer wieder: Kann ich vorher schnuppern? Was kostet ein Drop-in? Wie
kündige ich? Muss ich mich anmelden, wenn ich komme? Alles davon kann die App längst — es steht nur
nirgends zusammen. Jede dieser Fragen kostet heute eine Nachricht und eine Antwort von Hand.

## User Stories

- Als Interessentin möchte ich vor dem ersten Klick wissen, wie Probestunde, Drop-in und Anmeldung
  zusammenhängen, damit ich nicht schreiben muss, um buchen zu können.
- Als Kunde möchte ich nachlesen können, wie ich pausiere oder kündige, ohne im Profil herumzusuchen.
- Als englischsprachiger Gast möchte ich dieselben Antworten auf Englisch.
- Als Betreiber möchte ich, dass Google diese Fragen findet und direkt im Suchergebnis zeigt.
- Als Betreiber möchte ich Fragen ergänzen können, ohne dass daraus ein Projekt wird.

## Out of Scope

- **Pflege über die Verwaltung** — die Inhalte stehen im Code wie AGB und Datenschutz. Eine eigene
  Tabelle samt Oberfläche wäre mehr Pflege, als sie erspart; eine Änderung ist ein Einzeiler plus
  Deploy. Zeigt sich, dass oft geändert wird, ist das ein eigenes Projekt.
- **Suchfeld innerhalb der Seite** — bei rund fünfzehn Fragen genügt die Suche des Browsers, und
  die findet auch zugeklappte Antworten, weil sie im Quelltext stehen.
- **Eintrag in der Hauptnavigation** — bewusst nicht: Fußzeile, Kursseite und Startseite decken die
  Wege ab, ohne die Navigation voller zu machen.
- **Preise und Kurszeiten** — die stehen am Kurs und würden hier zwangsläufig veralten.

## Acceptance Criteria

- [ ] Angenommen jemand ist irgendwo auf der Seite, wenn er in die Fußzeile schaut, dann findet er
      einen Verweis auf die häufigen Fragen.
- [ ] Angenommen jemand steht auf einer Kursseite unter dem Buchungsbereich, wenn er weiterliest,
      dann findet er denselben Verweis — dort entstehen die Fragen.
- [ ] Angenommen jemand ist auf der Startseite, wenn er zum Abschnitt über das eigene Konto kommt,
      dann findet er ihn ebenfalls.
- [ ] Angenommen die Seite ist geladen, wenn eine Frage zugeklappt ist, dann steht ihre Antwort
      trotzdem im Quelltext — Suchmaschinen und die Suche im Browser finden sie.
- [ ] Angenommen jemand klickt eine Frage an, dann klappt die Antwort auf.
- [ ] Angenommen eine Suchmaschine liest die Seite, dann findet sie dieselben Fragen und Antworten
      als strukturierte Daten (schema.org FAQPage).
- [ ] Angenommen die Seite wird auf Englisch aufgerufen, dann sind Fragen, Antworten und die
      strukturierten Daten englisch, und kein deutscher Satz schlägt durch.
- [ ] Angenommen jemand liest die englische Fassung, wenn er den Verweis anklickt, dann bleibt er in
      der englischen Sprachebene.
- [ ] Angenommen eine Frage wird ergänzt, wenn eine Sprachfassung fehlt, dann schlägt der Test fehl,
      bevor es jemand ausliefert.

## Edge Cases

- **Halbe Übersetzung**: Ein neuer Eintrag ohne englische Fassung fiele im Betrieb erst auf, wenn
  ein Gast vor dem deutschen Satz steht — deshalb prüft ein Test beide Sprachen auf Vorhandensein
  **und** darauf, dass der englische Satz nicht bloß der kopierte deutsche ist.
- **Ohne JavaScript**: Die Seite benutzt `<details>`, kein Bedienelement mit Skript. Auf- und
  Zuklappen funktioniert auch dann.
- **Antworten veralten**: Die Antworten beschreiben Regeln, die anderswo im Code stehen (Fristen,
  Guthabenhöhe). Wer eine Regel ändert, muss hier nachziehen — die Datei sagt das oben ausdrücklich.
- **Kontaktweg**: Die letzte Frage nennt E-Mail und Telefon; ein Test hält fest, dass sie in beiden
  Sprachen dort stehen. Wer hier nichts findet, muss jemanden erreichen können.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Inhalte im Code statt in der Datenbank | Sie ändern sich selten. Eine Verwaltungsoberfläche dafür wäre dauerhafte Pflege für einen Vorgang, der ein paarmal im Jahr vorkommt — und wir arbeiten ohnehin fast täglich zusammen. | 2026-09-23 |
| Fußzeile, Kursseite, Startseite — nicht die Hauptnavigation | Die drei Wege decken ab, wo Fragen entstehen, ohne die Navigation zu verlängern. | 2026-09-23 |
| `<details>` statt eines Bedienelements mit Skript | Die Antworten stehen im ausgelieferten Quelltext: Suchmaschinen lesen sie, Strg+F findet sie, und ohne JavaScript funktioniert die Seite trotzdem. | 2026-09-23 |
| Strukturierte Daten nach schema.org | Google kann Fragen und Antworten direkt im Suchergebnis zeigen. Sie enthalten genau dieselben Sätze wie die Seite — eine Angabe nur für Maschinen wäre eine andere Aussage als die für Menschen. | 2026-09-23 |
| Keine Preise in den Antworten | Preise stehen am Kurs. Hier wiederholt wären sie eine zweite Wahrheit, die irgendwann veraltet. | 2026-09-23 |

### Technical Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Eine Datei, beide Sprachen nebeneinander | Frage und Antwort stehen je Eintrag direkt untereinander in Deutsch und Englisch. Getrennte Dateien je Sprache laufen auseinander; so sieht man beim Schreiben, was fehlt. | 2026-09-23 |
| Nur Text, kein Markup in den Antworten | Dieselben Sätze gehen an Suchmaschinen. Links und Fettungen hätten dort nichts verloren. | 2026-09-23 |
| Sprachbewusster Verweis (`@/i18n/navigation`) | Ein gewöhnliches `next/link` hätte englische Gäste beim Klick zurück ins Deutsche geworfen — derselbe Fehler, den PROJ-43 schon einmal behoben hat. | 2026-09-23 |

---

## QA Test Results (2026-09-23)

**Empfehlung: bereit für die Produktion.** Keine Migration, keine Datenbankänderung.

| | |
|---|---|
| Regeln (Unit) | 5 |
| Browser (E2E) | 7 |
| Produktfehler gefunden | 0 |

### Was geprüft ist

**Die Wege**: Fußzeile, Startseite und Kursseite führen wirklich hin — angeklickt, nicht nur
angesehen. Auf der englischen Fassung bleibt der Klick in der englischen Sprachebene.

**Der Inhalt**: Alle Gruppen erscheinen als Überschriften, die Zahl der Einträge stimmt, eine
zugeklappte Antwort steht im Quelltext (vorhanden, aber unsichtbar) und wird durch einen Klick
sichtbar.

**Die strukturierten Daten** enthalten dieselbe Anzahl Fragen und dieselben Sätze wie die Seite — in
beiden Sprachen.

**Die Vollständigkeit der Übersetzung** prüft eine eigene Testebene: leere Felder fallen auf, und
ein englisches Feld, das den deutschen Satz wiederholt, ebenfalls.

### Nicht geprüft

Ob die Antworten inhaltlich das sagen, was das Studio sagen will — das entscheidet der Betreiber.
Geprüft ist, dass sie vollständig, zweisprachig und auffindbar sind.
