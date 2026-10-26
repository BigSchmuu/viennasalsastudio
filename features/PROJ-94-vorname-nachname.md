# PROJ-94: Vorname und Nachname getrennt, Pflicht bei der Registrierung

## Status: Deployed
**Created:** 2026-10-26
**Last Updated:** 2026-10-26

## Dependencies
- Berührt: PROJ-2 (Auth & Kundenprofil) — Registrierung und Profil
- Berührt: PROJ-4 (Kundenverwaltung), PROJ-22 (Lehrer-Rollen) — dort wird der Name gepflegt
- Berührt: PROJ-82/84 (Barzahler ohne Konto) — dort entsteht ein Profil aus einem Feld

## Anlass

Der Betreiber möchte Vor- und Nachname getrennt erfassen und bei der Registrierung
verlangen.

Heute gibt es beides nicht: Die Registrierung fragt **nur** E-Mail und Passwort, und der
Name ist danach im Profil ein einziges, **freiwilliges** Feld (`profiles.full_name`). Ein
Kunde kann also ein Konto haben, eine Buchung machen und auf einer Rechnung stehen, ohne
dass sein Name irgendwo steht — und wo er steht, lässt er sich nicht nach Nachnamen
sortieren.

## User Stories

- Als Betreiber möchte ich bei jedem neuen Konto Vor- und Nachnamen haben, ohne nachfragen
  zu müssen.
- Als Betreiber möchte ich Namen getrennt vorliegen haben, damit Listen und Rechnungen
  später nach Nachnamen geordnet werden können.
- Als Kunde möchte ich bei der Registrierung sehen, welche Angaben verlangt werden, und
  nicht erst beim Buchen daran erinnert werden.
- Als Kunde möchte ich meinen Namen im Profil weiter selbst ändern können.
- Als Lehrkraft möchte ich einen Gast an der Tür weiter mit **einem** Feld eintragen können.

## Out of Scope

- **Bestandskunden nachfordern.** Entscheidung des Betreibers: Neue Konten brauchen beides,
  alte werden nicht genötigt. Was die Teilung nicht richtig trifft, korrigiert er in der
  Kundenverwaltung.
- **Sortierung nach Nachnamen.** Die Trennung ist die Voraussetzung dafür, aber die Listen
  sortieren weiter wie heute. Eine neue Sortierung ist eine eigene Entscheidung (PROJ-33).
- **Anrede, Titel, zweiter Vorname.** Zwei Felder, nicht fünf.
- **`full_name` abschaffen.** Die Spalte bleibt — siehe Technical Decisions.
- **Namenspflicht für Konten, die der Betreiber anlegt.** Dort bleibt der Vorname Pflicht
  und der Nachname freiwillig: An der Tür kennt man manchmal nur einen Namen, und eine
  Sperre würde die Lehrkraft aufhalten, nicht die Daten verbessern.

## Acceptance Criteria

### Registrieren

- [ ] Angenommen ein Besucher öffnet die Registrierung, dann stehen dort Felder für Vorname
      und Nachname, beide als Pflichtfeld erkennbar.
- [ ] Angenommen er lässt einen der beiden leer, wenn er absendet, dann wird das Konto
      **nicht** angelegt und das betroffene Feld zeigt eine Meldung.
- [ ] Angenommen er füllt beide, wenn er absendet, dann stehen Vor- und Nachname am Profil
      des neuen Kontos — ohne dass er sie im Profil noch einmal eintragen muss.
- [ ] Angenommen die Seite ist auf Englisch, dann sind Beschriftungen und Meldungen
      englisch.

### Profil

- [ ] Angenommen ein Kunde öffnet sein Profil, dann stehen dort zwei Felder statt einem, mit
      seinem bisherigen Namen darin.
- [ ] Angenommen er leert eines der beiden, wenn er speichert, dann wird abgewiesen — die
      Pflicht bei der Registrierung wäre sonst eine Formalität, die man eine Minute später
      rückgängig macht.
- [ ] Angenommen er ändert seinen Namen, dann erscheint der neue Name überall, wo bisher der
      alte stand (Anwesenheitsliste, Rechnungen, Kundenverwaltung).

### Bestand und Verwaltung

- [ ] Angenommen ein Kunde hatte „Anna Müller", dann steht nach der Migration „Anna" als
      Vorname und „Müller" als Nachname.
- [ ] Angenommen ein Kunde hatte „Anna Maria Müller", dann wird am **letzten** Leerzeichen
      geteilt: „Anna Maria" und „Müller".
- [ ] Angenommen ein Kunde hatte nur „Lisa", dann steht sie als Vorname, der Nachname bleibt
      leer — und sie wird deswegen nicht gesperrt.
- [ ] Angenommen der Betreiber bearbeitet einen Kunden, dann pflegt er zwei Felder; der
      Vorname ist Pflicht, der Nachname nicht.
- [ ] Angenommen die Lehrkraft trägt einen Gast ohne Konto ein, dann gibt sie weiter **einen**
      Namen ein, und die Anwendung teilt ihn selbst.

## Edge Cases

- **Namen mit Präfix** („van der Berg", „de Luca"): Die Teilung am letzten Leerzeichen trifft
  es nicht immer. Bewusst in Kauf genommen und vom Betreiber entschieden — er korrigiert die
  Ausnahmen. Besser als Raten mit einer Namensliste, die wieder falsch rät.
- **Doppelte Leerzeichen und Leerzeichen am Rand** werden beim Teilen entfernt.
- **Leerer Name im Bestand**: bleibt leer, beide Felder null. Kein Zwang, nichts gesperrt.
- **Ein Konto, das der Betreiber anlegt**, hat womöglich nur einen Vornamen. Zulässig.
- **Ein Kunde ändert nur den Vornamen**: Der zusammengesetzte Name muss sofort überall
  nachziehen, auch in laufenden Listen.

## Decision Log

### Product Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Bestandsnamen werden am letzten Leerzeichen geteilt | Entscheidung des Betreibers. Bei rund 50 Kunden ist das ein überschaubarer Durchgang zum Korrigieren, und Listen sehen sofort richtig aus. | 2026-10-26 |
| Pflicht nur für neue Konten | Entscheidung des Betreibers. Bestandskunden werden nicht genötigt; ein Kunde, der nur seinen Kurstermin nachsehen will, soll nicht vor einer Schranke stehen. | 2026-10-26 |
| Im Profil lässt sich der Name nicht leeren | Sonst wäre die Pflicht bei der Registrierung eine Formalität, die man eine Minute später rückgängig macht. Wer schon ohne Namen im Bestand ist, wird davon nicht betroffen — er muss sein Profil nicht öffnen. | 2026-10-26 |
| Der Betreiber darf einen Kunden mit nur einem Namen anlegen | An der Tür kennt man manchmal nur einen Namen. Eine Sperre würde die Lehrkraft aufhalten, nicht die Daten verbessern. | 2026-10-26 |
| Die Lehrkraft behält **ein** Feld für Gäste | Zwei Felder an der Tür kosten Zeit in genau dem Augenblick, in dem keine ist. Die Anwendung teilt selbst. | 2026-10-26 |

### Technical Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| `full_name` bleibt und wird von einem Trigger gepflegt — **keine** abgeleitete Spalte | Eine `generated`-Spalte wäre die schönere Invariante, aber sie ist nicht beschreibbar: 42 Dateien lesen `full_name`, 19 Datenbankfunktionen sortieren danach, und **34 Schreibzugriffe in 47 Testdateien** würden auf einen Schlag brechen. Der Trigger hält dieselbe Wahrheit (sind Teile vorhanden, gewinnen sie) und lässt alles Bestehende unberührt. | 2026-10-26 |
| Der Name kommt über `options.data` in die Registrierung | `handle_new_user` legt das Profil an, bevor die Anwendung es sehen kann. Supabase legt die Metadaten der Anmeldung in `auth.users.raw_user_meta_data`; der Trigger liest sie. Ein nachträgliches `update` wäre ein zweiter Schritt, der scheitern kann — und dann hätte man ein Konto ohne Namen, obwohl er Pflicht ist. | 2026-10-26 |
| Geprüft wird serverseitig in der Server-Action | Die Metadaten der Anmeldung kommen vom Client. Die Zod-Prüfung in `signUp` ist die Stelle, die entscheidet — nicht das Formular. | 2026-10-26 |
| Das Teilen ist eine reine Funktion in `lib/namen.ts` | Sie wird an drei Stellen gebraucht (Migration, Gast an der Tür, Anzeige) und ist der Teil, der falsch sein kann. Also prüfbar und an einer Stelle. | 2026-10-26 |

## Open Questions

- [ ] Sollen die Admin-Listen künftig nach Nachnamen sortieren? Die Trennung macht es möglich;
      ob es gewünscht ist, entscheidet der Betreiber (passt zu PROJ-33).
- [ ] Soll die Rechnung „Müller, Anna" statt „Anna Müller" schreiben? Heute steht der
      zusammengesetzte Name; beides ist jetzt möglich.

## Umsetzung (2026-10-26)

**Die Regel** steht als reine Funktion in [namen.ts](../src/lib/namen.ts): `teileName()`
teilt am letzten Leerzeichen, `zusammengesetzterName()` ist das Gegenstück. Beides wird an
drei Stellen gebraucht — beim Umzug des Bestands, beim Gast an der Tür und beim Einladen
einer Lehrkraft — und ist der Teil, der falsch sein kann. Die bekannte Grenze („van der
Berg") steht als Test da, nicht als Fußnote.

**Datenbank** — [20261026160000_proj94_vorname_nachname.sql](../supabase/migrations/20261026160000_proj94_vorname_nachname.sql):
zwei Spalten, ein Trigger, der Umzug und `handle_new_user`. Der Umzug läuft nur, wo noch
nichts steht, damit ein zweiter Lauf keine von Hand korrigierte Teilung überschreibt.

**Oberfläche:** Registrierung und Profil haben zwei Pflichtfelder, die Kundenverwaltung zwei
Felder mit freiwilligem Nachnamen, und Lehrer-Einladung wie Gast-Eintragung behalten ein
Feld, das die Anwendung teilt.

**Der Name geht als Metadatum der Anmeldung mit.** Das war die entscheidende technische
Frage: Das Profil entsteht im Trigger, bevor die Anwendung es sehen kann.

**Geprüft:** 1107 Unit-Tests grün — 10 neue für `teileName`/`zusammengesetzterName`, dazu
eigene Fälle dafür, dass die Pflicht wirklich greift (ohne Namen wird abgewiesen, **bevor**
Supabase gefragt wird) und dass der Name als Metadatum mitgeht. 9 Datenbankprüfungen in
[PROJ-94-vorname-nachname-db.test.ts](../tests/PROJ-94-vorname-nachname-db.test.ts) und 2
Browserprüfungen in
[PROJ-94-vorname-nachname.spec.ts](../tests/PROJ-94-vorname-nachname.spec.ts).

**Acht bestehende Unit-Tests und zwei Browsertests** bauten Registrierung oder Profil noch
ohne Namen auf. Nachgezogen — das ist die Folge der Pflicht, kein Fehler.

### Was nicht geprüft werden kann, und warum

Eine **echte** Registrierung über das Formular steht bewusst nicht im Browsertest. Sie hängt
an Supabases Mailversand, und der ist in der Testdatenbank gedrosselt: Nach wenigen
Versuchen kommt `over_email_send_rate_limit`, und eine `.test`-Adresse hat er zusätzlich als
`email_address_invalid` abgewiesen. Ein Nachweis, der an einer Mailquote hängt, ist keiner —
er ist mal grün und mal rot, und niemand weiß, warum.

Stattdessen steht der Weg an zwei deterministischen Stellen: Die Server-Action gibt den Namen
als Metadatum mit (Unit-Test mit nachgebildetem Supabase), und der Trigger übernimmt ihn
daraus ins Profil und bildet `full_name` (Datenbankprüfung). Zusammen decken die beiden
dieselbe Kette ab, ohne eine Mail zu verschicken.

## Deployment

- **Ausgeliefert:** 2026-10-26
- **Produktion:** https://app.viennasalsastudio.at
- **Commits:** `27324c8` (Funktion), `14d31ca` (Prüfungen), Tag `v1.94.0-PROJ-94`
- **Migration:** `20261026160000_proj94_vorname_nachname.sql` — **vor** dem Deploy in Test
  und Produktion eingespielt. Zwingend in dieser Reihenfolge: `handle_new_user` schreibt die
  neuen Spalten, und ohne sie schlägt **jede** Registrierung fehl.
- **Nachgesehen:** Vercel-Deployment `Ready` (1 min); `/registrieren` und `/en/registrieren`
  200, und die Seite liefert tatsächlich die Felder „Vorname" und „Nachname" aus —
  nachgesehen im HTML, nicht nur am Statuscode. `/profil` und `/admin/kunden` 307 auf die
  Anmeldung.

### Für den Betrieb

- **Sieh die Teilung durch.** Verwaltung → Kunden: Bei rund 50 Kunden ist das ein Durchgang.
  Auffallen werden Namen mit Präfix („van der Berg" → Vorname „van der"), das ist die
  bekannte Grenze der Regel.
- **Bestandskunden werden nicht genötigt** — kein Hinweis, nichts gesperrt. Öffnet ein
  Bestandskunde ohne Namen sein Profil, verlangt das Formular dort allerdings beides, bevor
  er speichern kann.
- Beim Anlegen eines Kunden in der Verwaltung ist der **Nachname freiwillig**; an der Tür
  trägt die Lehrkraft weiter **einen** Namen ein, den die Anwendung teilt.
- `full_name` existiert weiter und wird automatisch gepflegt. Überall, wo der Name heute
  erscheint — Anwesenheitsliste, Rechnungen, Belege, Barzahler-Liste —, ändert sich nichts.
- **Für künftige Tests:** Die Testdatenbank lässt keine echte Registrierung über das
  Formular mehr zu (`email_address_invalid` für `.test`-Adressen, danach
  `over_email_send_rate_limit`). Der Weg wird deshalb ohne Mailversand geprüft; siehe oben.
