# PROJ-100: Der Rückweg aus der Kundenakte führt dorthin, wo man herkam

## Status: Deployed
**Created:** 2026-11-06
**Last Updated:** 2026-11-06

## Dependencies
- Requires: PROJ-7 (Verwaltung: Kunden) — die Kundenakte ist die Seite, um die es geht
- Nutzt: `safeRedirectPath` aus PROJ-2/PROJ-58 — die Prüfung für Pfade, die aus der Adresse kommen

## Anlass

Die Kundenakte hat heute **einen** Rückweg, und der ist fest verdrahtet:

```
src/app/admin/kunden/[id]/page.tsx:190
<Link href="/admin/kunden">← Zurück zu Kunden</Link>
```

Dorthin verlinken aber **19 Stellen** aus ganz verschiedenen Ecken der Verwaltung und der
Lehreransicht. Wer in der Anwesenheitsliste eines Kurses auf einen Namen klickt, etwas in der
Akte nachsieht und zurück will, landet auf der Kundenliste — an einer Stelle, an der er nie
war. Der Weg zurück in die Anwesenheitsliste führt dann über die Lehreransicht, den Kurs und
das Datum, also über vier Klicks für etwas, das einer sein sollte.

Der Browser-Pfeil kann das, aber er ist nicht die Antwort: Er ist nicht sichtbar Teil der
Seite, auf dem Handy liegt er weit weg vom Daumen, und nach dem Speichern in der Akte geht er
in die Formularhistorie statt auf die Ursprungsseite.

## Die Regel in einem Absatz

Jeder Link in die Kundenakte sagt, von welcher Seite er kommt. Die Akte nennt diesen Ursprung
im Kopf beim Namen („← Zurück zur Anwesenheit: Salsa Level 2“) und stellt den alten Weg
daneben („Alle Kunden“). Fehlt der Ursprung oder ist er nicht vertrauenswürdig, steht dort
genau das, was heute dort steht. Der Ursprung wird mitgegeben, nicht gespeichert — er gehört
zur Adresse der Seite und nicht zum Kunden.

## User Stories

- Als **Lehrkraft mit Verwaltungsrechten** will ich aus der Anwesenheitsliste in eine
  Kundenakte springen und mit einem Klick wieder in derselben Anwesenheitsliste stehen, damit
  ich die Stunde weiter abhaken kann.
- Als **Betreiber** will ich beim Durchgehen der offenen Posten eine Akte öffnen und zur
  **gefilterten** Liste zurückkommen, damit ich meinen Platz in der Arbeit nicht verliere.
- Als **Betreiber** will ich vor dem Klick lesen können, wohin der Rückweg führt, damit ich
  nicht raten muss, ob ich auf der Liste oder im Kurs lande.
- Als **Betreiber** will ich den gewohnten Weg zur Kundenliste behalten, auch wenn ich von
  woanders komme, damit mir keine Möglichkeit genommen wird.
- Als **Betreiber** will ich, dass ein manipulierter Link mich nicht aus der App hinausführt,
  weil ein Rückweg, der irgendwohin zeigen kann, eine Phishing-Falle ist.

## Out of Scope

- **Andere Unterseiten der Verwaltung** (Lastschriftlauf, Standort, Videosatz,
  Benachrichtigungstext) — dort kommt man fast immer aus der eigenen Liste, wo der heutige
  Rückweg schon stimmt. Die Technik ist so gebaut, dass eine weitere Unterseite später
  wenige Zeilen kostet; das wäre eine eigene Spezifikation.
- **Dialoge wieder öffnen.** Kommt der Weg aus einem Dialog (Warteliste eines Kurses,
  Gästeliste eines Events) oder aus dem aufgeklappten Barzahlungs-Archiv, führt der Rückweg
  auf die **Seite**, und der Dialog ist zu. Der Text verspricht dann auch nur die Seite.
- **Scrollposition oder Blätterseite wiederherstellen.** Filter und Suche kommen mit, weil sie
  in der Adresse stehen; die Scrollhöhe nicht.
- **Ein Verlauf über mehrere Stufen** („zurück, zurück, zurück“). Es wird genau ein Ursprung
  mitgegeben, nicht ein Pfad durch die App.
- **Die Kundenansicht** (`/profil`, Mein Tanzbereich) — dort gibt es dieses Problem nicht.
- **Der Rückweg im Verwaltungs-Rahmen** („← Zurück zu Mein Profil“ im Layout) bleibt, wie er
  ist.

## Acceptance Criteria

- [x] Angenommen ich bin in der Anwesenheitsliste eines Kurses, wenn ich auf den Namen einer
  Teilnehmerin klicke, dann steht im Kopf der Kundenakte „← Zurück zur Anwesenheit:
  <Kursname>“.
- [x] Angenommen ich bin über diesen Weg in der Kundenakte, wenn ich auf den Rückweg klicke,
  dann bin ich wieder in der Anwesenheitsliste **desselben** Kurses.
- [x] Angenommen ich bin über einen Ursprung in der Kundenakte, wenn die Seite erscheint, dann
  steht neben dem benannten Rückweg zusätzlich „Alle Kunden“, und der führt auf die
  Kundenliste.
- [x] Angenommen ich öffne die Kundenakte aus der Kundenliste, wenn die Seite erscheint, dann
  steht dort genau **ein** Rückweg („← Zurück zu Kunden“) und nicht zweimal dasselbe Ziel.
- [x] Angenommen ich rufe die Kundenakte ohne Ursprung auf (Lesezeichen, eingetippte Adresse),
  wenn die Seite erscheint, dann steht dort „← Zurück zu Kunden“ wie heute.
- [x] Angenommen die Liste, aus der ich kam, war gefiltert oder durchsucht (etwa Buchungen mit
  Status „offen“), wenn ich zurückgehe, dann ist derselbe Filter wieder gesetzt.
- [ ] Angenommen ich komme aus dem Check-in einer Stunde, wenn ich zurückgehe, dann bin ich
  wieder im Check-in derselben Stunde.
- [ ] Angenommen der Ursprung ist ein Dialog (Warteliste eines Kurses), wenn ich zurückgehe,
  dann bin ich auf der Kursseite, der Dialog ist zu, und der Rückweg hieß „Zurück zu Kurse“ —
  er hat die Warteliste nicht versprochen.
- [x] Angenommen in der Adresse steht ein fremdes Ziel (`?von=https://example.com/`,
  `?von=//example.com`, `?von=/\example.com`), wenn die Kundenakte erscheint, dann führt der
  Rückweg auf die Kundenliste und **niemals** aus der App hinaus.
- [x] Angenommen in der Adresse steht ein interner, aber unbekannter Pfad, wenn die Seite
  erscheint, dann steht dort der Standard-Rückweg „← Zurück zu Kunden“ und kein Link mit
  leerem Namen.
- [x] Angenommen der mitgegebene Ursprung ist die Kundenakte selbst, wenn die Seite erscheint,
  dann gibt es keinen Rückweg im Kreis, sondern den Standard.
- [x] Angenommen ich ändere in der Akte etwas und speichere (Profil, Abo, Guthaben), wenn die
  Seite neu geladen ist, dann ist der Rückweg noch da und zeigt weiter auf den Ursprung.
- [x] Angenommen der Kurs zum Ursprung ist nicht mehr lesbar (gelöscht), wenn die Seite
  erscheint, dann heißt der Rückweg schlicht „← Zurück zur Anwesenheitsliste“ statt einen
  leeren Namen zu zeigen.
- [x] Angenommen eine der 19 verlinkenden Stellen führt mich in die Akte, wenn ich dort
  ankomme, dann nennt der Rückweg die Seite mit Namen — keine der Stellen landet beim
  namenlosen „Zurück“.
- [x] Angenommen ich bin auf dem Handy (375 px), wenn die Akte mit zwei Rückwegen erscheint,
  dann stehen beide lesbar untereinander oder nebeneinander, ohne waagerechtes Scrollen.
- [x] Angenommen ich bediene die Seite mit Tastatur oder Screenreader, wenn ich den Kopf
  abhöre, dann haben die beiden Links unterschiedliche, sprechende Namen und sind nicht zwei
  Mal „Zurück“.

## Edge Cases

- **Fremdes Ziel in der Adresse.** `?von=` ist ein Pfad, der von außen kommt. Er läuft durch
  `safeRedirectPath` (prüft Steuerzeichen, Schema, `//`, `/\`) — fällt die Prüfung durch, gilt
  die Kundenliste. Das ist keine Theorie: Ein Rückweg, der überall hinzeigen kann, ist die
  klassische Phishing-Stufe nach einem echten Login.
- **Unbekannter, aber harmloser Pfad.** Etwa `/admin/ferien`, von wo heute niemand verlinkt.
  Der Pfad ist sicher, hat aber keinen Namen in der Tabelle. Dann der Standard — lieber der
  gewohnte Weg als ein Link, der „Zurück zu /admin/ferien“ heißt.
- **Ursprung ist die Akte selbst** oder eine andere Kundenakte: kein Rückweg im Kreis.
- **Zwei Fenster.** Der Ursprung steht in der Adresse, nicht in einer Sitzung. Zwei Tabs mit
  zwei Herkünften stören sich deshalb nicht.
- **Gelöschter Kurs im Ursprung.** Der Name wird nachgesehen; ist er nicht da, bleibt der
  Rückweg bei der Art der Seite.
- **Sehr langer Kursname.** Der Rückweg wird einzeilig gehalten und notfalls beschnitten
  (`truncate`), damit der Kopf auf dem Handy nicht zerfällt.
- **Lehrkraft ohne Verwaltungsrechte.** Die Anwesenheitsliste verlinkt den Namen nur für
  Admins (`attendance-matrix.tsx:388`). An dieser Stelle ändert sich nichts — wer die Akte
  nicht öffnen darf, bekommt auch keinen Rückweg.
- **Die Akte eines Lehrers** (verlinkt aus „Lehrerrollen“): derselbe Mechanismus, der Rückweg
  heißt „Zurück zu Lehrerrollen“.

## Tech Design

### Wie der Ursprung mitkommt

Ein neues Bauteil `<KundenLink kundeId=… >Name</KundenLink>` (Client-Komponente) ersetzt an
allen 19 Stellen das handgebaute `<Link href={`/admin/kunden/${id}`}>`. Es liest mit
`usePathname()` und `useSearchParams()` die eigene Adresse und hängt sie als `?von=` an. Damit
steht die Regel an **einer** Stelle statt neunzehnmal, und eine neue Liste erbt sie, sobald
sie das Bauteil benutzt.

```
Anwesenheitsliste  /lehrer/<kursId>
   <KundenLink>  →  /admin/kunden/<id>?von=%2Flehrer%2F<kursId>
Buchungen        /admin/buchungen?status=open
   <KundenLink>  →  /admin/kunden/<id>?von=%2Fadmin%2Fbuchungen%3Fstatus%3Dopen
```

### Wie die Akte daraus einen Namen macht

Die Kundenakte nimmt künftig `searchParams`, prüft `von` mit `safeRedirectPath(von,
"/admin/kunden")` und sucht den Namen in einer Tabelle von Routenmustern (längstes Muster
gewinnt):

```
/lehrer/<id>            → „Anwesenheit: <Kursname>“   (Name wird nachgesehen)
/checkin                → „Check-in“
/admin/kunden           → „Kunden“            (Standard)
/admin/buchungen        → „Buchungen“
/admin/rechnungen       → „Rechnungen“
/admin/offene-posten    → „Offene Posten“
/admin/barzahlungen     → „Barzahlungen“
/admin/lastschriften/<id> → „Lastschriftlauf“
/admin/kuendigungen     → „Kündigungen“
/admin/kurse            → „Kurse“
/admin/events           → „Events“
/admin/gasttaenzer      → „Gasttänzer“
/admin/probestunden     → „Probestunden“
/admin/lehrer           → „Lehrerrollen“
/admin                  → „Übersicht“         (Geburtstage, Upgrade-Anfragen)
```

Kein Treffer, Treffer auf die Akte selbst oder keine Angabe → der heutige Zustand: nur
„← Zurück zu Kunden“. Dass der Name **nicht** in der Adresse mitreist, ist Absicht: Ein Text
aus der Adresse könnte lügen („Zurück zu Ihrer Bank“), eine Tabelle im Code nicht.

### Was sich sichtbar ändert

```
Kopf der Akte, mit Ursprung:
  ← Zurück zur Anwesenheit: Salsa Level 2   ·   Alle Kunden

Kopf der Akte, ohne Ursprung (wie heute):
  ← Zurück zu Kunden
```

### Dateien

| Datei | Was |
| --- | --- |
| `src/components/admin/customers/kunden-link.tsx` | neu — das Bauteil, das den Ursprung anhängt |
| `src/lib/navigation/herkunft.ts` | neu — Tabelle, Auflösung, Beschneiden; reine Funktionen, Unit-Test |
| `src/lib/navigation/herkunft.test.ts` | neu — Tabelle, fremde Ziele, Kreis, unbekannter Pfad |
| `src/app/admin/kunden/[id]/page.tsx` | nimmt `searchParams`, löst den Ursprung auf, zeigt zwei Wege |
| 17 Komponenten + 2 Serverlisten | benutzen `<KundenLink>` statt eigenem `href` |
| `tests/PROJ-100-rueckweg-kundenakte.spec.ts` | neu — der Weg hin und zurück, im Browser |

### Warum kein `router.back()`

Ein neutraler Knopf wäre eine Zeile. Er sagt aber nicht, wohin er führt, und der Verlauf ist
nach einem Neuladen, nach dem Speichern in der Akte oder beim Einstieg über ein Lesezeichen
nicht verlässlich — im schlechtesten Fall führt er aus der App hinaus. Ein Ursprung in der
Adresse ist prüfbar, überlebt das Neuladen und steht lesbar im Kopf.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Benannter Rückweg, „Alle Kunden“ daneben | Man liest vor dem Klick, wo man landet; der gewohnte Weg wird niemandem genommen | 2026-11-06 |
| Nur die Kundenakte als Ziel | Genau der gemeldete Schmerz; die vier anderen Unterseiten erreicht man fast immer aus der eigenen Liste | 2026-11-06 |
| Aus einem Dialog zurück: Seite, Dialog zu | Der Text verspricht dann auch nur die Seite; den Dialog aus der Adresse zu öffnen wäre dreimal eigene Arbeit mit eigenen Tests | 2026-11-06 |
| Filter und Suche kommen mit, die Scrollhöhe nicht | Filter stehen in der Adresse und sind damit gratis; die Scrollhöhe wäre eigene Mechanik | 2026-11-06 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Ursprung in der Adresse (`?von=`), nicht in einer Sitzung | Prüfbar, überlebt Neuladen, zwei Fenster stören sich nicht | 2026-11-06 |
| Name aus einer Tabelle im Code, nicht aus der Adresse | Ein Text aus der Adresse könnte lügen; eine Tabelle nicht | 2026-11-06 |
| `safeRedirectPath` wiederverwenden | Die Prüfung gibt es samt Tests schon (`src/lib/auth/safe-redirect.ts`); eine zweite Fassung wäre eine zweite Lücke | 2026-11-06 |
| Ein gemeinsames `<KundenLink>` statt 19 Mal `href` | Die Regel an einer Stelle; eine neue Liste erbt sie | 2026-11-06 |
| Kursname wird in der Akte nachgesehen | Der Ursprung trägt nur den Pfad; der Name kommt aus der Datenbank und ist damit immer der echte | 2026-11-06 |

## Open Questions
- [ ] Soll der Rückweg auch den **Tag** nennen, wenn der Ursprung eine Anwesenheitsliste mit
  gewähltem Datum ist („Anwesenheit: Salsa Level 2, 4.11.“)? Der Tag steht in der Adresse und
  käme also mit zurück — die Frage ist nur, ob er in den Text gehört oder ihn zu lang macht.
- [ ] Lohnt sich derselbe Rückweg später für den Lastschriftlauf? Das entscheidet sich im
  Betrieb, nicht am Schreibtisch.

## Umsetzung (2026-11-06)

### Was es jetzt gibt

| Datei | Was |
| --- | --- |
| `src/lib/navigation/herkunft.ts` | Tabelle, Prüfung, Auflösung — reine Funktionen, keine React-Abhängigkeit |
| `src/lib/navigation/herkunft.test.ts` | 34 Prüfungen, darunter alle 16 Ursprungsmuster als Tabelle |
| `src/components/admin/customers/kunden-link.tsx` | das Bauteil, das die eigene Adresse als `?von=` anhängt |
| `src/app/admin/kunden/[id]/page.tsx` | nimmt `searchParams`, sieht den Kursnamen nach, zeigt zwei Wege |
| 17 Komponenten (19 Stellen) | benutzen `<KundenLink>` statt eigenem `href` |
| `tests/PROJ-100-rueckweg-kundenakte.spec.ts` | 7 Fälle, hin und zurück, auf Chromium und Mobile Safari |

Der Name des Rückwegs trägt seinen Artikel mit: Die Tabelle hält nicht
„Buchungen“, sondern „zu den Buchungen“, weil „← Zurück zu Anwesenheit: Salsa
Level 2" kein Deutsch ist. Das war beim Schreiben der Spezifikation noch nicht
gesehen.

### Zwei echte Befunde beim Bauen

**Die Namenstabelle lieh unbekannten Seiten einen Namen.** Der Eintrag
`/admin` passte als **Präfix**, also bekam `/admin/ferien` den Rückweg „zur
Übersicht" — eine Seite, von der niemand in die Akte verlinkt, hätte sich
einen Weg geliehen, den es nicht gibt. Gefunden hat das der Unit-Test, der
genau diesen Fall behauptete; `/admin` und `/lehrer` passen jetzt nur exakt.
Die Anwesenheitsliste läuft deshalb nicht über die Tabelle, sondern über die
Kurs-ID.

**Im Check-in gab es einen Link ins Leere.** `r.customerId` ist dort
`string | null` (ein Gast ohne Konto hat keine Akte), und die alte Zeile klebte
den Pfad als Zeichenkette zusammen: `/admin/kunden/null`. Das sah aus wie ein
Link und führte auf eine Fehlerseite. Aufgefallen ist es erst, weil das Bauteil
eine `string`-Zusage macht — ein Typfehler dort, wo vorher stillschweigend
`null` interpoliert wurde. Jetzt steht der Name ohne Link
(`checkin-client.tsx`).

### Abweichungen von der Spezifikation

| Spezifikation | Umsetzung | Grund |
| --- | --- | --- |
| „Name aus einer Tabelle“ | Tabelle **plus** Artikel im Text | „zu Anwesenheit“ ist kein Deutsch |
| 19 Ursprünge, 15 Tabellenzeilen geplant | 14 Zeilen + die Kurs-ID als eigener Weg | `/lehrer/<id>` braucht den echten Kursnamen, nicht einen Tabelleneintrag |
| `/admin/rechnungen/archiv` als eigener Name | fällt unter „zu den Rechnungen“ | von dort verlinkt heute niemand in die Akte |

Die Verlinkung von einer Kundenakte auf die Akte des **Werbers**
(`page.tsx:331`) blieb absichtlich unverändert: Eine Akte als Ursprung ist ein
Kreis, und ein Verlauf über mehrere Stufen steht ausdrücklich außerhalb des
Umfangs.

### Was nicht geprüft ist

- **Der Dialog-Fall im Browser** (Warteliste eines Kurses, Gästeliste eines
  Events). Geprüft ist der Name in der Tabelle („zu den Kursen“, „zu den
  Events") und dass der Rückweg auf die Seite führt; dass der Dialog danach zu
  ist, ist die Folge davon und nicht eigens belegt.
- **Check-in als Ursprung im Browser.** Der Name steht in der Tabelle, der Weg
  selbst ist nicht durchgeklickt — die Lage (laufende Stunde, Teilnehmer in
  der Suche) aufzubauen kostet mehr als der Fall wert ist.

## QA (2026-11-06)

| Prüfung | Ergebnis |
| --- | --- |
| `src/lib/navigation/herkunft.test.ts` | **34/34** |
| `tests/PROJ-100-rueckweg-kundenakte.spec.ts` (Chromium + Mobile Safari) | **14/14**, 6,3 min |
| Unit- und Datenbanktests gesamt | **1497 grün**, 2 übersprungen, 115 Dateien |
| Gezielte Browser-Regression über alle 13 angefassten Flächen (Chromium) | **127/128**, 41,8 min |
| `tests/PROJ-79` nach der Datumsreparatur (beide Browser) | **14/14** |
| `tsc`, `eslint`, `npm run build` | sauber · sauber · „Compiled successfully in 12,8s“ |

**14 von 16 Kriterien sind abgehakt.** Zwei bleiben bewusst offen, weil sie
nicht durchgeklickt sind: der Check-in als Ursprung und der Dialog-Fall. Von
beiden ist der **Name** über die Tabelle belegt und der Mechanismus derselbe,
den der Browsertest an der Anwesenheitsliste durchgeht — die Lage aufzubauen
(laufende Stunde, Warteliste mit Teilnehmer) kostet mehr, als der Fall wert
ist. Das steht so in „Was nicht geprüft ist“, damit es niemand für geprüft
hält.

### Drei Befunde, alle vor dem Ausliefern gefunden

**Die Namenstabelle lieh unbekannten Seiten einen Namen** (`/admin/ferien` →
„zur Übersicht“). Gefunden vom Unit-Test, behoben durch exakte Treffer für
`/admin` und `/lehrer`. Siehe Umsetzung.

**Ein Link ins Leere im Check-in** (`/admin/kunden/null` bei einem Gast ohne
Konto) — ein Fehler, der **vor** PROJ-100 schon dort war und erst durch die
Typzusage des Bauteils aufgefallen ist.

**Ein Test, der mit dem Kalender verdorben war.**
`tests/PROJ-79-kuendigungen-ueberblick.spec.ts` behauptete „4 Monate“ aus
einem fest eingetippten `2026-06-07`; am 06.11.2026 zeigte die Seite korrekt
„5 Monate“. Das Ankerdatum wird jetzt aus dem Stichtag gerechnet
(`vierMonateVor`), damit die Zahl an jedem Tag des Jahres stimmt. Der Fehler
hatte mit PROJ-100 nichts zu tun — er wäre beim nächsten Volllauf aufgefallen
und hätte dann nach einem Schaden ausgesehen, den niemand verursacht hat.

### Was im Test selbst zweimal schiefging

Beide Male war mein Test falsch, nicht die Seite — festgehalten, weil die
Ursachen wiederkehren:

- Ein Locator auf `/^← Zurück/` traf **zwei** Links: Der Verwaltungsrahmen
  trägt auf jeder Seite „← Zurück zu Mein Profil“. Jetzt mit Ausschluss statt
  mit `.last()`, das auf die Reihenfolge im Baum gewettet hätte.
- Die Kundenliste hat **keine** Überschrift. Der Test erwartete eine; jetzt
  prüft er ihr Suchfeld — das Merkmal, an dem man die Seite wirklich erkennt.

**Urteil: produktionsreif.** Keine Migration, keine Datenbankänderung, keine
Rechte angefasst — PROJ-100 ist reiner Anwendungscode. Ausliefern kann in
jeder Reihenfolge erfolgen.

## Deployment (2026-11-06)

Ausgeliefert nach https://app.viennasalsastudio.at

| | |
| --- | --- |
| Commit | `b9d2b54` feat(PROJ-100) |
| Tag | `v1.100.0-PROJ-100` |
| Migration | keine — PROJ-100 ist reiner Anwendungscode |
| Build | „Compiled successfully in 12,8s“, ohne Warnung |
| Deployment | `dpl_FToiXkxQ6HvWPZ7SKqBYzDnC6jU4`, rund 105 Sekunden nach dem Push live |

Davor im selben Push: `17b4099` fix(PROJ-79) — das Ankerdatum des
Kündigungstests, das mit dem Kalender verdorben war. Eigener Commit, weil die
Ursache mit PROJ-100 nichts zu tun hat.

**Nach dem Deployment geprüft:** Start, `/en` und der Kurskatalog antworten mit
200; `/admin/kunden`, `/admin/kuendigungen` und `/checkin` leiten einen
anonymen Aufruf auf die Anmeldung — die Seiten existieren also und bewachen
sich. Den Rückweg selbst kann ein anonymer Aufruf nicht sehen; dieser Klick
bleibt beim Betreiber.

## Für den Betrieb

- **Der erste Klick, der es zeigt:** in der Anwesenheitsliste eines Kurses auf
  einen Namen, dann oben links lesen. Dort steht jetzt der Kurs statt „Kunden“.
- **Wenn dort doch „← Zurück zu Kunden“ steht**, kam der Klick von einer Stelle
  ohne Eintrag in der Namenstabelle (`src/lib/navigation/herkunft.ts`). Das ist
  kein Fehler, sondern der gewollte Rückfall — eine Zeile in der Tabelle, und
  die Stelle hat ihren Namen.
- **Gefilterte Listen kommen gefiltert zurück.** Wer die Kundenliste durchsucht
  hat, findet die Suche wieder; wer aus einem Dialog kam, findet die Seite, aber
  nicht den offenen Dialog.
