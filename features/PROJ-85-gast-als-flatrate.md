# PROJ-85: Einen Gast ohne Konto auch als Flatrate anlegen

## Status: Deployed
**Created:** 2026-10-15
**Last Updated:** 2026-10-15

## Dependencies
- Erweitert: PROJ-82 (Barzahler von Hand anlegen) — dasselbe Formular, eine Auswahl mehr
- Requires: PROJ-50/69 (`course_memberships`, `course_members`) — eine Flatrate trägt ihre Kurse daneben
- Requires: PROJ-84 (Barzahler-Liste) — der Gast landet auf der Liste

## Anlass

„Gast anlegen" auf der Kursseite erzeugt immer ein **Kursabo**. Für jemanden, der bar zahlt, kein
Konto hat und eine **Flatrate** nimmt, führt das heute über drei Umwege: Gast anlegen, dann in der
Verwaltung das Kursabo löschen und ein Abo ohne Kurs anlegen, dann die Kurse nachtragen und den
Listeneintrag neu setzen.

Dabei lauert eine Falle: `cash_payments` hängt mit `on delete cascade` am Abo. Wer in Schritt eins
schon kassiert und in Schritt zwei das Kursabo löscht, verliert die Aufzeichnung der Zahlung.

Drei Schritte und eine Falle sind zu viel für einen Vorgang, der an der Tür passiert, während jemand
mit Geld in der Hand davorsteht.

## User Stories

- Als Lehrkraft möchte ich beim Eintragen eines Gastes sagen können, ob er nur diesen Kurs nimmt oder
  eine Flatrate.
- Als Lehrkraft möchte ich, dass der Gast danach ohne weitere Handgriffe in der Anwesenheitsliste und
  auf der Barzahler-Liste steht.
- Als Betreiber möchte ich weitere Kurse einer so angelegten Flatrate später in Ruhe nachtragen.

## Out of Scope

- **Mehrere Kurse gleich beim Anlegen.** Der Gast steht in *diesem* Kurs; weitere trägt die
  Verwaltung über den Flatrate-Block am Kunden nach. Eine Mehrfachauswahl an der Tür ist Arbeit zur
  falschen Zeit.
- **Die Tanzrolle.** Wird hier nicht erfragt — wie beim Kursabo in PROJ-82 auch nicht. Sie bleibt
  leer und lässt sich später setzen.
- **Ein Formular in der Verwaltung** („Barzahler ohne Konto"). Wäre die Alternative B zu dieser
  Lösung; verworfen, weil der Vorgang an der Tür passiert und nicht am Schreibtisch.
- **Eine E-Mail-Adresse nachtragen.** Unverändert aus PROJ-82: Die Platzhalter-Adresse
  (`…@viennasalsastudio.invalid`) bleibt, bis die Verwaltung eine echte einträgt.

## Acceptance Criteria

- [ ] Angenommen die Lehrkraft öffnet „Gast ohne Konto eintragen", dann kann sie zwischen „Nur dieser
      Kurs" und „Flatrate" wählen; vorbelegt ist „Nur dieser Kurs".
- [ ] Angenommen sie wählt „Flatrate" und trägt Name und Betrag ein, dann entsteht ein Abo **ohne**
      Kurs mit diesem Preis und daneben ein Kursplatz für diesen Kurs.
- [ ] Angenommen sie wählt „Nur dieser Kurs", dann entsteht wie bisher ein kursgebundenes Abo und
      **kein** Kursplatz daneben.
- [ ] Angenommen ein Gast wurde als Flatrate angelegt, wenn die Lehrkraft die Seite neu lädt, dann
      steht er in der Anwesenheitsliste und auf der Barzahler-Liste — dort mit dem Abzeichen
      „Flatrate".
- [ ] Angenommen ein Gast wurde als Flatrate angelegt, wenn der Betreiber den Kunden in der
      Verwaltung öffnet, dann erscheint dort der Flatrate-Block zum Nachtragen weiterer Kurse.
- [ ] Angenommen der Kurs ist voll, wenn ein Gast als Flatrate eingetragen wird, dann wird das mit
      Zahlen abgewiesen — ein Flatrate-Platz zählt gegen die Kursgrenze wie jeder andere.
- [ ] Angenommen ein Schritt nach dem Konto scheitert, dann wird das Konto wieder entfernt und es
      bleibt nichts Halbes zurück.

## Edge Cases

- **Kurs voll.** Dieselbe Prüfung wie bisher, über `course_members` gegen `max_participants`.
- **Zwei gleiche Namen.** Unverändert erlaubt: Namen sind kein Schlüssel. Die Verwaltung kann später
  zusammenführen.
- **Abbruch nach dem Kontoanlegen.** Jeder Fehlschlag danach löscht das Konto wieder — wie in
  PROJ-82, jetzt auch für den Kursplatz und den Listeneintrag.
- **Die Flatrate ohne weitere Kurse.** Völlig in Ordnung: eine Flatrate mit genau einem Kursplatz
  verhält sich wie ein Kursabo, nur dass weitere Kurse jederzeit dazukommen können.

## Decision Log

### Product Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Auswahl im bestehenden Formular statt einer zweiten Maske in der Verwaltung | Vom Betreiber gewählt (Variante A). Der Vorgang passiert an der Tür, während jemand mit Geld davorsteht — dort muss er auch zu erledigen sein. | 2026-10-15 |
| Vorbelegt ist „Nur dieser Kurs" | Der häufigere Fall, und die Wirkung ist kleiner: ein Kursabo betrifft einen Kurs, eine Flatrate alle. Wer sich verklickt, richtet so weniger an. | 2026-10-15 |
| Nur dieser eine Kurs beim Anlegen | Weitere Kurse sind Verwaltungsarbeit und können warten; eine Mehrfachauswahl an der Tür hält den Betrieb auf. | 2026-10-15 |

### Technical Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Ein Parameter an `legeBarzahlerAn`, keine zweite Aktion | Es sind dieselben fünf Schritte (Konto, Profil, Abo, Liste) mit einem Unterschied in einem davon. Zwei Aktionen würden das Aufräumen bei einem Fehlschlag zweimal enthalten. | 2026-10-15 |
| Der Kursplatz wird direkt eingefügt, nicht über `add_course_to_flatrate` | Jene Funktion gehört dem Kunden-Self-Service: Sie liest `auth.uid()` und verlangt eine Tanzrolle, wenn der Kurs danach fragt. Hier legt eine Lehrkraft für jemand anderen an, und nach der Rolle wird bewusst nicht gefragt. | 2026-10-15 |
| `started_on` ist der heutige Tag | PROJ-69: Ein Kursplatz gilt ab seinem Starttermin. Wer heute an der Tür steht, tanzt heute mit. | 2026-10-15 |

## Umsetzung und QA (2026-10-15)

**Keine Migration.** Es werden nur Zeilen in bestehende Tabellen geschrieben.

- `lib/actions/teacher/barzahler-anlegen.ts`: ein Parameter `art: GastArt` (`"kurs"` voreingestellt).
  Bei `"flatrate"` trägt das Abo `course_id: null` und heißt „Flatrate“; daneben entsteht eine Zeile
  in `course_memberships` mit `started_on` = heute. Jeder Fehlschlag danach räumt das Konto weg, wie
  in PROJ-82.
- `components/teacher/barzahler-liste.tsx`: eine Auswahl „Abo“ im Gast-Formular, dazu ein Hinweistext,
  der sich mit der Auswahl ändert.

| Prüfung | Umfang | Ergebnis |
|---|---|---|
| Unit — `barzahler-anlegen.test.ts` | 15 (3 neu) | grün |
| Voller Vitest-Lauf | 1229 | grün, 8 zeitabhängig übersprungen |
| Browser — `PROJ-82-barzahler-von-hand.spec.ts` | 3 (1 neu) | grün |
| Regression — PROJ-84, PROJ-50 | 36 | grün |

### Was belegt ist

- Bei „Flatrate“ trägt das Abo **keinen** Kurs, der Preis stimmt, und der Kursplatz steht daneben —
  mit `ended_on` leer und ab heute gültig.
- Bei „Nur dieser Kurs“ entsteht **kein** Kursplatz daneben; sonst stünde derselbe Mensch zweimal im
  Kurs (einmal über das Abo, einmal über den Platz).
- Der Gast steht danach in der Anwesenheitsmatrix **und** auf der Barzahler-Liste, dort mit dem
  Abzeichen „Flatrate“ und dem eingetragenen Betrag.
- Scheitert der Kursplatz, wird das Konto wieder entfernt — es bleibt nichts Halbes zurück.

### Produktionsreife

**JA** — keine kritischen oder hohen Fehler offen.

## Open Questions

- [ ] Soll die Tanzrolle doch erfragt werden, wenn der Kurs sie führt? Dagegen spricht die Situation
      an der Tür; dafür spricht, dass die Rollenbalance des Kurses sonst eine Person nicht kennt.

## Deployment

- **Ausgeliefert:** 2026-10-15
- **Produktion:** https://app.viennasalsastudio.at
- **Commit:** `21eaa5c`, Tag `v1.85.0-PROJ-85`
- **Migration:** keine — es werden nur Zeilen in bestehende Tabellen geschrieben.
- **Nachgesehen:** Vercel-Deployment `Ready`; Startseite 200, `/lehrer` und `/admin/barzahlungen`
  antworten mit 307 auf die Anmeldung.

### Für den Betrieb

- Die Auswahl steht im Gast-Formular auf der **Kursseite**, nicht in der Verwaltung — vorbelegt mit
  „Nur dieser Kurs“.
- Eine so angelegte Flatrate hat genau **einen** Kursplatz. Weitere Kurse trägst du unter
  `/admin/kunden/<id>` im Flatrate-Block nach.
- Die **Tanzrolle** bleibt leer. Der Kurs kennt diese Person in seiner Rollenbalance also nicht; wer
  das braucht, setzt sie in der Verwaltung.
