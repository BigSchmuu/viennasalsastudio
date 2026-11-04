# PROJ-95: Der Pass als Auswahl bei den Barzahlern

## Status: Deployed
**Created:** 2026-10-28
**Last Updated:** 2026-11-04

## Dependencies
- Requires: PROJ-93 (Ein Pass für eine Stilrichtung) — das Produkt selbst
- Requires: PROJ-82 (Kunden ohne Konto) — der Gast wird an der Tür angelegt
- Requires: PROJ-85 (Gast als Flatrate) — die Auswahl „Abo", in die der Pass kommt
- Requires: PROJ-84 (Barzahlungs-Einträge) — die Liste, auf der er landet
- Berührt: PROJ-81 (Barzahlungen in der Verwaltung), PROJ-50 (Flatrate für mehrere Kurse)

## Anlass

Seit PROJ-93 gibt es den Bachata-Pass. Buchen kann ihn aber nur, wer ein Konto hat und
über die Seite geht. An der Tür — wo die Lehrkraft jemanden ohne Konto einträgt und Geld
einsammelt — stehen weiterhin nur zwei Möglichkeiten zur Wahl: **„Nur dieser Kurs"** und
**„Flatrate"**.

Damit fehlt genau in der Mitte dasselbe, was vor PROJ-93 im Kundenbereich fehlte. Wer an
der Tür einen Bachata-Pass will, bekommt entweder zu wenig (ein Kursabo) oder zu viel (die
Flatrate) — und im zweiten Fall zahlt er für Salsa mit, oder der Betreiber verschenkt es.

### Befunde aus dem Code, die den Umfang bestimmen

Drei Dinge sind beim Nachsehen aufgefallen; sie sind der Grund, warum dieser Wunsch mehr
ist als ein dritter Eintrag in einer Auswahlliste.

1. **Die Auswahl kennt zwei Arten.** `GastArt = "kurs" | "flatrate"` in
   `src/lib/actions/teacher/barzahler-anlegen.ts`. Ein Pass ist eine dritte.
2. **„Flatrate" wird in der Datenbank als „Abo ohne Kurs" erkannt** —
   `s.course_id is null as ist_flatrate`, an drei Stellen (`get_course_cash_payers`,
   `get_course_cash_candidates`, und die Funktion aus PROJ-81). Auf einen Stil-Pass trifft
   das genauso zu. Ein Pass-Barzahler würde deshalb überall als **„Flatrate"** beschriftet,
   obwohl er nur eine Stilrichtung deckt.
3. **Kurslose Abos sind in jedem Kurs erreichbar.** `get_course_cash_payers` endet auf
   `where k.subscription_id is not null or s.course_id is null`. Ein Pass erschiene damit
   in der eingeklappten Gruppe **jedes** Kurses, auch bei Salsa — eine Lücke, die es
   streng genommen schon heute gibt, seit PROJ-93 kurslose Abos mit Stilgrenze zulässt.
   Sie fällt nur nicht auf, weil ein Pass-Kunde bisher kaum auf einer Barzahler-Liste
   landet.

Punkt 2 und 3 sind keine Zusatzwünsche, sondern die Bedingung dafür, dass der dritte
Eintrag überhaupt die Wahrheit sagt.

## User Stories

- Als Lehrkraft möchte ich jemanden an der Tür als **Pass-Gast** eintragen, damit er für
  alle Bachata-Kurse zahlt und nicht für das ganze Haus.
- Als Lehrkraft möchte ich in meiner Barzahler-Liste **sehen**, dass jemand einen Pass hat
  und nicht die Flatrate — sonst sammle ich den falschen Betrag ein.
- Als Lehrkraft eines anderen Bachata-Kurses möchte ich einen Pass-Gast, der heute bei mir
  steht, abhaken können, ohne die Verwaltung zu fragen.
- Als Lehrkraft eines Salsa-Kurses möchte ich Pass-Gäste **nicht** in meiner Liste haben —
  sie gehören nicht zu meinem Abend.
- Als Betreiber möchte ich, dass ein an der Tür angelegter Pass sich danach wie jeder
  andere Pass verhält: pausieren, kündigen, weitere Bachata-Kurse nachtragen.
- Als Betreiber möchte ich den Pass nur dort zur Wahl haben, wo es ihn gibt — bei einer
  Stilrichtung ohne Passpreis soll die Lehrkraft ihn nicht anbieten können.

## Out of Scope

- **Ein vorbelegter Betrag.** Entscheidung vom 2026-10-28: Das Feld bleibt leer, wie bei
  den beiden bestehenden Arten. Siehe Decision Log — es gibt zwei Passpreise, und eine
  Vorbelegung wäre für Studierende immer der falsche.
- **Ein Schalter „Studierende".** Folgt aus derselben Entscheidung. Die Lehrkraft tippt
  den Betrag, den sie einsammelt.
- **Einen bestehenden Barzahler nachträglich auf den Pass umstellen.** Das ist ein
  Wechsel zwischen Produkten und gehört in die Verwaltung, nicht an die Tür. PROJ-93 hat
  den Wechsel in Selbstbedienung bewusst ausgeschlossen; hier gilt dasselbe.
- **Upgrade-Differenz Pass → Flatrate.** Bleibt wie in PROJ-93 außen vor.
- **Werbung für den Passpreis auf der Kurskachel.** Eigene Entscheidung, unverändert offen.
- **Zwei kurslose Abos für einen Kunden.** An der Tür entsteht immer ein **neues** Konto,
  also kann der Fall dort nicht auftreten. Die Regel aus PROJ-93 („höchstens ein kursloses
  Abo") bleibt davon unberührt.

## Acceptance Criteria

- [ ] Angenommen ein Kurs gehört zu einer Stilrichtung mit hinterlegtem Passpreis, wenn die
      Lehrkraft „Gast ohne Konto eintragen" öffnet, dann steht in der Auswahl „Abo" neben
      „Nur dieser Kurs" und „Flatrate" auch der Pass dieser Stilrichtung, benannt nach ihr
      (zum Beispiel „Bachata Pass").
- [ ] Angenommen die Stilrichtung des Kurses hat keinen Passpreis, wenn die Lehrkraft die
      Auswahl öffnet, dann fehlt der Pass-Eintrag ganz — nicht ausgegraut, sondern gar nicht
      vorhanden.
- [ ] Angenommen der Kurs hat überhaupt keine Stilrichtung, wenn die Lehrkraft die Auswahl
      öffnet, dann fehlt der Pass-Eintrag ebenfalls ganz.
- [ ] Angenommen die Lehrkraft hat den Pass gewählt sowie Name und Betrag eingetragen, wenn
      sie „Gast anlegen" drückt, dann entsteht ein Kunde mit einem Pass-Abo für diese
      Stilrichtung, einem Kursplatz in diesem Kurs und einem Barzahler-Eintrag über den
      eingetragenen Betrag.
- [ ] Angenommen ein Pass-Gast ist angelegt, wenn die Lehrkraft die Barzahler-Liste dieses
      Kurses ansieht, dann steht bei ihm der Name des Passes und nicht „Flatrate".
- [ ] Angenommen ein Pass-Gast für Bachata hat seinen Kursplatz in Bachata-Kurs A, wenn die
      Lehrkraft Bachata-Kurs B öffnet, dann ist er dort in der eingeklappten Gruppe
      erreichbar und lässt sich abhaken.
- [ ] Angenommen derselbe Pass-Gast, wenn die Lehrkraft einen Salsa-Kurs öffnet, dann
      erscheint er dort nicht — weder in der Liste noch in der eingeklappten Gruppe.
- [ ] Angenommen ein Kunde hat die volle Flatrate, wenn eine Lehrkraft irgendeinen Kurs
      öffnet, dann ist er dort unverändert erreichbar — die Stilgrenze gilt nur für Pässe.
- [ ] Angenommen der Kurs ist voll, wenn die Lehrkraft einen Pass-Gast anlegen will, dann
      wird es mit derselben Meldung abgelehnt wie bei den anderen beiden Arten.
- [ ] Angenommen die Lehrkraft wählt den Pass, wenn das Formular erscheint, dann ist das
      Betragsfeld leer und zeigt nur seinen Platzhalter.
- [ ] Angenommen ein Pass-Gast ist an der Tür entstanden, wenn die Verwaltung den Kunden
      öffnet, dann steht dort ein Abo mit Stilrichtung, das sich pausieren, kündigen und um
      weitere Kurse derselben Stilrichtung ergänzen lässt.
- [ ] Angenommen eine Lehrkraft öffnet einen Kurs, den sie nicht unterrichtet, wenn sie
      einen Pass-Gast anzulegen versucht, dann wird es abgewiesen — die Rechteprüfung aus
      PROJ-82 gilt unverändert für alle drei Arten.

## Edge Cases

- **Die Stilrichtung verliert ihren Passpreis**, nachdem ein Pass-Gast angelegt wurde. Das
  bestehende Abo bleibt und läuft weiter; nur die Auswahl verschwindet. So hält es PROJ-93
  auch im Kundenbereich — ein entfernter Preis stellt das Angebot ein, er kündigt nicht.
- **Mehrere Stilrichtungen mit Pass.** Die Auswahl nennt immer nur die des geöffneten
  Kurses, nie eine andere. Es gibt an der Tür keine Entscheidung „welcher Pass".
- **Der Pass-Gast steht in zwei Bachata-Kursen am selben Abend** (Kursplatz in A, zu Gast
  in B). Es darf **kein zweiter** Barzahler-Eintrag entstehen; abgehakt wird derselbe
  Eintrag, egal in welchem Kurs er geöffnet wird. Das ist das Verhalten, das PROJ-84 für
  Flatrater schon hat.
- **Ein Kurs ohne Stilrichtung** darf nicht dazu führen, dass die Auswahl kaputt ist oder
  ein Abo ohne Stilgrenze entsteht, das wie eine Flatrate wirkt. Lieber kein Eintrag.
- **Der Name des Passes ist lang** („Bachata Sensual"). Die Auswahl und die Liste müssen das
  tragen, auch auf dem Telefon — die Lehrkraft steht mit dem Handy an der Tür.
- **Zwei Lehrkräfte legen gleichzeitig den letzten Platz an.** Unverändert die Regel aus
  PROJ-82: Wer zuerst kommt, bekommt den Platz; die zweite sieht „Der Kurs ist voll".

## Decision Log

### Produkt

| Entscheidung | Begründung | Datum |
| --- | --- | --- |
| Das Betragsfeld bleibt **leer**, kein vorbelegter Passpreis | Es gibt zwei Passpreise (normal und Studierende). Eine Vorbelegung wäre für die eine Hälfte der Gäste immer falsch, und ein vorbelegtes Feld ist ein Rat, der stimmen muss. Die Person an der Tür weiß, was sie einsammelt. | 2026-10-28 |
| Kein Schalter „Studierende" | Folgt aus der Entscheidung oben. Das Formular an der Tür ist bewusst knapp; ein Bedienelement, das nur einen Betrag umstellt, den man ohnehin tippen kann, kostet mehr Zeit als es spart. | 2026-10-28 |
| Ein Pass-Gast ist in **allen** Kursen seiner Stilrichtung erreichbar, in keinem anderen | Das ist das Versprechen des Passes. Flatrater sind heute in jedem Kurs eingeklappt erreichbar, damit die Lehrkraft Geld einsammeln kann, wenn jemand vorbeikommt; für den Pass gilt dasselbe, nur auf seine Stilrichtung begrenzt. | 2026-10-28 |
| Die Auswahl erscheint nur bei Stilrichtungen **mit** Passpreis | Spiegelt PROJ-93 genau: Dort entsteht das Angebot durch einen eingetragenen Preis und verschwindet, wenn er entfernt wird. Ein „Bachata Pass" bei einem Salsa-Kurs wäre ein Angebot, das es nicht gibt. | 2026-10-28 |
| Der Eintrag heißt nach der Stilrichtung, nicht einfach „Pass" | Die Lehrkraft sammelt Geld ein und muss am Eintrag erkennen, wofür. „Pass" allein beantwortet die Frage nicht, sobald es zwei Stilrichtungen mit Pass gibt. | 2026-10-28 |

### Technisch

| Entscheidung | Begründung | Datum |
| --- | --- | --- |
| Eine neue Spalte `pass_stil` in beiden Datenbankfunktionen statt einer dritten Wahrheit im Code | Die Anzeige braucht die Stilrichtung, und `ist_flatrate` kann sie nicht liefern — ein Pass ist kurslos wie eine Flatrate. Die Alternative wäre gewesen, in jeder anzeigenden Stelle selbst zu joinen; das sind vier Stellen, und drei davon hätten es vergessen. | 2026-10-28 |
| Die Deckungsregel wird als `where`-Bedingung wiederholt, nicht `deckt_abo_kurs` aufgerufen | Jene Funktion antwortet pro Kunde und Kurs mit einem einzelnen Abo; hier wird eine ganze Liste gefiltert, und ein Aufruf pro Zeile wäre eine Abfrage pro Zeile. Dafür zeigen beide Stellen im Kommentar aufeinander, und `comment on function` trägt den Hinweis in die Datenbank selbst. | 2026-10-28 |
| Eine Art mehr in `GastArt`, keine zweite Aktion | Flatrate und Pass unterscheiden sich in zwei Zeilen (Stilgrenze am Abo, Name). Eine zweite Aktion hätte das Aufräumen nach einem Fehlschlag — vier Rückwege — ein drittes Mal enthalten. | 2026-10-28 |
| Der Name des Abos wird beim Anlegen gesetzt (`„<Stil> Pass"`), nicht bei der Anzeige errechnet | Er steht später an jedem Barzahler-Eintrag, in der Verwaltung und auf Belegen. Ein Name, der an einer Stelle errechnet wird, fehlt an den anderen. | 2026-10-28 |
| Die Prüfung „gibt es diesen Pass?" steht **auch** in der Serveraktion | Die Auswahl zeigt ihn nur dort, wo es ihn gibt — das ist eine Bitte an die Oberfläche. Ohne Prüfung im Server wäre ein verändertes Formular ein Weg zu einem Produkt, das der Betreiber nicht anbietet, und ein Pass ohne Stilgrenze wäre stillschweigend eine Flatrate zum Passpreis. | 2026-10-28 |

## Open Questions

- [x] Eigene Überschrift für Pass-Gäste in der eingeklappten Gruppe? → **Nein, eine
      gemeinsame.** Die Überschrift heißt jetzt „Flatrate und Pässe anzeigen (n)", und das
      Abzeichen in der Zeile nennt das Produkt. Zwei Gruppen hätten dieselbe Frage zweimal
      gestellt („wer ist hier, der nicht angemeldet ist?"), und bei nur einer Sorte stünde
      eine leere Überschrift da. Nebenbei ist dabei eine alte Unschärfe weggefallen: Der
      Spaltenkopf hieß „Flatrater", obwohl in dieser Gruppe nach PROJ-95 auch Pass-Kunden
      stehen — jetzt „Name". (2026-10-28)
- [ ] Die Lücke aus Befund 3 betrifft auch Pass-Kunden **mit** Konto, die auf einer
      Barzahler-Liste landen. Die Korrektur deckt sie mit ab — aber ist das heute schon
      irgendwo passiert? Nachsehen lohnt erst nach dem Umbau, weil die Antwort nichts am
      Vorgehen ändert.

## Umsetzung (2026-11-04)

### Was gebaut wurde

| Stelle | Änderung |
| --- | --- |
| `20261028100000_proj95_pass_bei_barzahlern.sql` | Beide Datenbankfunktionen neu: Spalte `pass_stil`, und kurslose Abos aus anderen Kursen nur noch, soweit ihre Stilrichtung den Kurs deckt |
| `20261104100000_proj95_fehlende_spalte_in_der_liste.sql` | Korrektur zu BUG-1 (siehe unten) |
| `src/lib/actions/teacher/barzahler-anlegen.ts` | `GastArt` kennt `"pass"`; Abo wird mit `dance_style_id` und Namen „<Stil> Pass" angelegt; ohne Passpreis wird die Art abgewiesen |
| `src/lib/barzahlungen/offen.ts` | `produktText()` als einzige Stelle, die „Flatrate" von „<Stil> Pass" unterscheidet |
| `src/components/teacher/barzahler-liste.tsx` | Auswahl, Hinweistext, Abzeichen, Spaltenkopf „Name", Gruppe „Flatrate und Pässe anzeigen (n)" |
| `src/app/admin/barzahlungen/*`, `barzahlungs-uebersicht.tsx` | Dasselbe Abzeichen in der Verwaltung |

### Prüfungen

| Prüfung | Umfang | Ergebnis |
| --- | --- | --- |
| `tests/PROJ-95-pass-bei-barzahlern-db.test.ts` | 12 Fälle, angemeldet als Lehrkraft (anon-Schlüssel) | grün |
| `tests/PROJ-95-pass-bei-barzahlern.spec.ts` | 3 Fälle × 2 Browser | grün |
| `src/lib/actions/teacher/barzahler-anlegen.test.ts` | 22 Fälle | grün |
| `src/lib/barzahlungen/offen.test.ts` | inkl. 4 Fälle zu `produktText` | grün |
| `tests/PROJ-84-barzahlungs-eintraege-db.test.ts` | 28 Fälle, Regression auf dieselben Funktionen | grün |
| `tests/PROJ-82-barzahler-von-hand.spec.ts`, `tests/PROJ-84-…spec.ts` | Regression, beide Browser | grün |
| `tsc --noEmit`, `eslint` | — | sauber |

Die Datenbankprüfungen melden sich **angemeldet** an (Rolle `authenticated`), nicht mit dem
Dienstschlüssel — sonst wären Rechtefehler unsichtbar. Das ist die Lehre aus PROJ-94.

## Deployment

- **Ausgeliefert:** 2026-11-04
- **Produktion:** https://app.viennasalsastudio.at
- **Commits:** `e752e5b` (Funktion), `3e58d54` (Korrektur zu BUG-1), Tag `v1.95.0-PROJ-95`
- **Migrationen:** `20261028100000_proj95_pass_bei_barzahlern.sql` und
  `20261104100000_proj95_fehlende_spalte_in_der_liste.sql` — beide **vor** dem Deploy in Test
  und Produktion eingespielt. Reihenfolge zwingend: Der Code liest die neue Spalte
  `pass_stil`; läge die Migration nicht vor, fiele die Anzeige stillschweigend auf
  „Flatrate" zurück.
- **Nachgesehen (vom Betreiber in der Produktion):** In einem Bachata-Kurs stehen unter
  „Gast ohne Konto eintragen" drei Einträge zur Wahl — „Nur dieser Kurs", „Bachata Pass",
  „Flatrate". In einem Salsa-Kurs fehlt der Pass. Damit ist beide Hälften der Regel geprüft:
  dass er erscheint, wo es ihn gibt, **und** dass er fehlt, wo nicht.

### Für den Betrieb

- Ein Pass entsteht nur, wenn die Stilrichtung des Kurses einen **Passpreis** hat. Fehlt er,
  fehlt der Eintrag in der Auswahl — das ist kein Fehler, sondern die Antwort darauf, dass es
  dieses Produkt nicht gibt. Der Preis wird in der Verwaltung an der Stilrichtung gepflegt
  (PROJ-93).
- Der **Betrag** bleibt leer und ist eine Entscheidung der Lehrkraft. Die App schlägt den
  Passpreis bewusst nicht vor; bei Geld entscheidet der Betreiber.
- Ein Pass-Gast ist in **allen** Kursen seiner Stilrichtung erreichbar — in dem Kurs, in dem
  er angelegt wurde, direkt in der Liste; in den übrigen eingeklappt hinter „Flatrate und
  Pässe anzeigen (n)". In Kursen anderer Stilrichtungen erscheint er nicht.
- Umbenannt, weil dort jetzt beide Sorten stehen: der Spaltenkopf der Liste heißt „Name"
  statt „Flatrater", die eingeklappte Gruppe „Flatrate und Pässe anzeigen (n)".

## Nachtrag: BUG-1 — eine verlorene Spalte machte die Liste unbenutzbar (2026-11-04)

**Schwere: Hoch.** Beim Einbauen von `pass_stil` in `get_course_cash_payers` fiel
`e.subscription_id` aus der Auswahlliste: 13 deklarierte Spalten, 12 ausgewählte.

**Warum es trotzdem durchging:** `returns table` ordnet nach **Position**, nicht nach Namen,
und PL/pgSQL prüft die Struktur erst beim **Aufruf**. `create function` lief also fehlerfrei
durch, und jeder Aufruf scheiterte mit `structure of query does not match function result
type`. Für die Lehrkraft: keine Barzahler-Liste, sondern „Die Barzahler konnten nicht geladen
werden" — überall dort, wo die Migration lag.

**Gefunden** von `tests/PROJ-95-pass-bei-barzahlern-db.test.ts` beim ersten Lauf nach dem
Einspielen (9 von 12 rot). Vor dem Einspielen konnten diese Prüfungen den Fehler nicht sehen,
weil die neue Funktion noch nicht existierte.

**Behoben** durch `20261104100000_proj95_fehlende_spalte_in_der_liste.sql` — Rückgabetyp
unverändert, also `create or replace`. Danach 12/12 grün.

**Lehre, festgehalten in `.claude/rules/backend.md`:** Jede Zeile der Auswahlliste trägt als
Kommentar den Namen der Spalte, die sie bedient; die Spalten werden vor dem Weitergeben
gezählt — Anzahl **und** Reihenfolge; und zu jeder neuen oder geänderten Funktion gehört eine
Prüfung, die sie wirklich **aufruft**.

## Nachtrag: Ein PROJ-84-Test prüfte noch die alte Überschrift (2026-11-04)

Die eingeklappte Gruppe heißt jetzt „Flatrate und Pässe anzeigen (n)" statt „Flatrater
anzeigen (n)" — eine bewusste Entscheidung dieser Spezifikation, weil dort auch Pass-Gäste
stehen. `tests/PROJ-84-barzahlungs-eintraege.spec.ts` suchte den alten Text und lief in beiden
Browsern in den Zeitablauf. Die App war in Ordnung, der Test veraltet; drei Zeilen angepasst,
danach grün.
