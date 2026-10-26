# PROJ-93: Ein Pass für eine Stilrichtung (Bachata-Pass)

## Status: Deployed
**Created:** 2026-10-26
**Last Updated:** 2026-10-26

## Dependencies
- Requires: PROJ-50 (Flatrate für mehrere Kurse) — der Pass ist eine Flatrate mit Grenze
- Requires: PROJ-3 (Tanzstile verwalten) — die Grenze selbst
- Requires: PROJ-41 (Preise bei der Kursbuchung) — die Kacheln und `plan_price`
- Berührt: PROJ-8 (Kursbuchung), PROJ-87/88 (Upgrade), PROJ-25 (Self-Check-In)

## Anlass

Der Betreiber möchte einen **Bachata-Pass**: ein Monatsbeitrag, der für alle Bachata-Kurse
gilt — und der auch nur dort als Buchungsoption erscheint, nicht bei Salsa.

Heute gibt es zwei Angebote: ein Abo für **einen** Kurs und die Flatrate für **alle**.
Dazwischen fehlt das Mittlere, und genau dort liegt das Interesse der Kunden, die nur eine
Stilrichtung tanzen.

Technisch ist die Flatrate heute „ein Abo ohne Kurs" (`subscriptions.course_id is null`).
Der Pass ist dasselbe mit einer Stilgrenze. Daraus folgt der ganze Rest: Lastschriftzyklus,
Kursplätze, Pausieren, Kündigen, Self-Check-In und Anwesenheitsliste hängen am **Abo** und
am **Kursplatz**, nicht an der Frage „alle Kurse oder einer". Sie funktionieren damit
unverändert.

Was nicht unverändert bleibt, ist eine Annahme, die quer durch die Anwendung läuft:
**„Wer eine Flatrate hat, hat alles."** Sie steckt in der Buchungssperre („Deine Flatrate
deckt diesen Kurs bereits ab"), im Hinzufügen weiterer Kurse und in der Upgrade-Prüfung.
Diese Annahme muss zur Frage werden: **deckt das Abo *diesen* Kurs?**

## User Stories

- Als Schüler, der nur Bachata tanzt, möchte ich einen Pass buchen, der alle Bachata-Kurse
  umfasst, ohne für die Salsa-Kurse mitzuzahlen.
- Als Schüler mit Bachata-Pass möchte ich weitere Bachata-Kurse ohne neue Bezahlung
  dazunehmen — so wie ein Flatrate-Kunde es kann.
- Als Schüler mit Bachata-Pass möchte ich trotzdem einen einzelnen Salsa-Kurs buchen
  können.
- Als Schüler möchte ich den Pass selbst pausieren und kündigen, wie jedes andere Abo.
- Als Betreiber möchte ich einen Pass dadurch anbieten, dass ich bei einer Stilrichtung
  einen Preis eintrage — und ihn durch Entfernen des Preises wieder einstellen.
- Als Lehrkraft möchte ich Pass-Kunden in meiner Anwesenheitsliste sehen wie alle anderen.

## Out of Scope

- **Upgrade in Selbstbedienung** (Pass → Flatrate, Kursabo → Pass). Entscheidung des
  Betreibers: Wer wechseln will, meldet sich, und die Verwaltung stellt es um. Die
  Differenzrechnung aus PROJ-87/88 bleibt damit bei zwei Produkten — dort steckte am
  2026-10-19 der 290-€-Fehler, und ein drittes Produkt gehört nicht in dieselbe Woche.
  Nachbauen lässt sich das jederzeit (PROJ-87/88 als Vorbild).
- **Ein Pass als Bündel Einheiten** („10 Besuche"). Verworfen; der Pass ist ein
  Monatsbeitrag. Für Events gibt es Einheiten weiterhin (PROJ-56).
- **Zwei Pässe gleichzeitig.** Ein Kunde hat höchstens **ein** kursloses Abo: entweder
  einen Pass oder die Flatrate. Zwei Pässe wären ohnehin teurer als die Flatrate, und die
  Frage „welches Abo deckt diesen Kurs" bliebe eindeutig.
- **Werbung für den Pass im Katalog und im Stundenplan.** Dort steht weiterhin der
  Kurspreis; der Pass erscheint im Buchungsdialog. Eine Preiswerbung auf der Kurskarte ist
  eine eigene Entscheidung.
- **Ein Pass über mehrere Stilrichtungen** („Bachata + Kizomba"). Erst wenn danach gefragt
  wird; das Modell (eine Stilrichtung am Abo) ließe sich dann zu einer Liste erweitern.

## Acceptance Criteria

### Anbieten und Preise

- [ ] Angenommen bei einer Stilrichtung ist ein Passpreis eingetragen, wenn ein Kunde einen
      Kurs dieser Stilrichtung im Buchungsdialog öffnet, dann steht dort eine dritte Kachel
      mit dem Namen der Stilrichtung und dem Preis.
- [ ] Angenommen bei einer Stilrichtung ist **kein** Passpreis eingetragen, dann erscheint
      bei ihren Kursen **keine** Pass-Kachel.
- [ ] Angenommen der Kurs hat gar keine Stilrichtung, dann erscheint keine Pass-Kachel.
- [ ] Angenommen der Kunde wählt den Studierendentarif und die Stilrichtung hat einen
      ermäßigten Passpreis, dann steht dieser auf der Kachel; fehlt er, gilt der normale.
- [ ] Angenommen der Betreiber pflegt die Stilrichtungen, dann kann er je Stilrichtung
      einen Passpreis und einen ermäßigten Passpreis setzen und wieder leeren.

### Buchen

- [ ] Angenommen ein Kunde bucht einen Bachata-Kurs mit der Pass-Kachel, wenn der Betreiber
      bestätigt, dann entsteht ein Abo **ohne Kurs** mit der Stilrichtung Bachata und dem
      Passpreis.
- [ ] Angenommen derselbe Fall, wenn der Kunde danach sein Profil öffnet, dann kann er den
      gebuchten Kurs dort eintragen — genau wie ein Flatrate-Kunde. (Ursprünglich stand hier,
      der Kursplatz entstehe automatisch. Das stimmt für die Flatrate nicht und würde die
      beiden Wege auseinanderlaufen lassen; siehe Decision Log.)
- [ ] Angenommen ein Kunde hat einen Bachata-Pass, wenn er einen weiteren Bachata-Kurs
      öffnet, dann kann er sich dort ohne neue Bezahlung eintragen (wie bei der Flatrate).
- [ ] Angenommen ein Kunde hat einen Bachata-Pass, wenn er einen **Salsa**-Kurs öffnet,
      dann fehlt die Pass-Kachel, und „Nur diesen Kurs" ist buchbar.
- [ ] Angenommen derselbe Fall, dann lässt sich der Salsa-Kurs **nicht** über den Pass
      eintragen — und die Begründung sagt, dass der Pass nur für Bachata gilt.
- [ ] Angenommen ein Kunde hat die volle Flatrate, dann ist alles wie bisher: alle Kurse
      gedeckt, keine Pass-Kachel nötig.
- [ ] Angenommen ein Kunde hat schon ein kursloses Abo, wenn er einen Pass buchen will,
      dann wird das abgewiesen — höchstens ein kursloses Abo je Kunde.

### Im Betrieb

- [ ] Angenommen ein Pass läuft, wenn der nächste Lastschriftlauf entsteht, dann steht dort
      der Passpreis — derselbe Zyklus wie bei jedem Abo.
- [ ] Angenommen ein Pass-Kunde checkt sich in einem Bachata-Kurs selbst ein, dann gilt
      dasselbe Fenster wie für alle (PROJ-25/90).
- [ ] Angenommen ein Pass-Kunde steht in einem Kurs, dann erscheint er in der
      Anwesenheitsliste der Lehrkraft wie ein Flatrate-Kunde.
- [ ] Angenommen ein Kunde pausiert oder kündigt seinen Pass, dann verhält sich das wie bei
      jedem Abo (PROJ-9), und seine Kursplätze enden mit dem Abo.
- [ ] Angenommen die Verwaltung sieht einen Kunden an, dann steht dort, dass er einen
      Bachata-Pass hat — nicht nur „Flatrate".

## Edge Cases

- **Ein Kurs wechselt die Stilrichtung.** Bestehende Kursplätze bleiben: Der Platz ist
  bestätigt, und niemand soll durch eine Verwaltungsänderung mitten im Monat aus einem Kurs
  fallen. Für **neue** Eintragungen gilt die aktuelle Stilrichtung.
- **Der Passpreis wird entfernt, während Pässe laufen.** Die laufenden Pässe laufen weiter
  — ihr Preis steht im Abo, nicht in der Preisliste. Neu buchbar ist der Pass dann nicht
  mehr. (Dieselbe Linie wie beim Flatrate-Preis.)
- **Kurs ohne Stilrichtung.** Nie durch einen Pass gedeckt, auch nicht versehentlich.
- **Der Kunde hat einen Pass und ein Kursabo für einen anderen Stil.** Erlaubt und
  beabsichtigt — zwei Positionen im Lastschriftlauf, zwei kündbare Abos.
- **Upgrade-Anfrage mit laufendem Pass.** Ein Pass zählt als kursloses Abo, also gilt die
  bestehende Sperre aus PROJ-87: keine Upgrade-Anfrage, solange ein kursloses Abo läuft.
  Passend zur Entscheidung „Wechsel ist Handarbeit".
- **Warteliste.** Ein Pass-Wunsch auf der Warteliste verhält sich wie der Flatrate-Wunsch
  (PROJ-12): Der gewünschte Tarif steht am Eintrag und gilt beim Nachrücken.

## Decision Log

### Product Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Der Pass ist ein Monatsbeitrag, kein Bündel Einheiten | Entscheidung des Betreibers. Er nutzt damit die ganze bestehende Mechanik — Zyklus, Kündigung, Pause, Check-in, Anwesenheit —, statt eine zweite Welt mit Zählung und Ablauf aufzubauen. | 2026-10-26 |
| Der Preis an der Stilrichtung entscheidet, ob es den Pass gibt | Entscheidung des Betreibers. Ein Preis bei Bachata = Bachata-Pass. Später ein Preis bei Salsa = Salsa-Pass, ohne neue Entwicklung. Kein Preis = kein Pass. | 2026-10-26 |
| Kein Upgrade in Selbstbedienung | Entscheidung des Betreibers. Hält PROJ-93 klein und die Differenzrechnung aus PROJ-87/88 bei zwei Produkten. | 2026-10-26 |
| Höchstens ein kursloses Abo je Kunde | Zwei Pässe wären teurer als die Flatrate, also will das niemand — und die Frage „welches Abo deckt diesen Kurs" bleibt eindeutig beantwortbar. | 2026-10-26 |
| Ein Pass-Kunde darf daneben Kursabos haben | Sonst sperrte der Bachata-Pass den Kunden aus allen Salsa-Kursen aus. Das wäre kein Pass, sondern eine Einschränkung. | 2026-10-26 |
| Bestehende Kursplätze überleben einen Stilwechsel des Kurses | Der Platz ist bestätigt. Mitten im Monat aus einem Kurs zu fallen, weil die Verwaltung eine Zuordnung ändert, wäre für den Kunden unerklärlich. | 2026-10-26 |
| Kein automatischer Kursplatz bei der Bestätigung | Beim Buchen der **Flatrate** entsteht heute auch keiner — der Kunde trägt seine Kurse im Profil ein. Beim Pass automatisch einen anzulegen hieße: zwei Produkte, zwei Verhaltensweisen, und der Betreiber müsste sich merken, welches welche hat. Der Wunsch, das für **beide** zu ändern, ist nachvollziehbar und wäre eine eigene Aufgabe. | 2026-10-26 |
| Ein Pass öffnet die Videos nicht | Die volle Flatrate gibt Zugriff auf alle Kursvideos. Ein Pass gibt die Videos der Kurse, in denen der Kunde sitzt — wie ein Kursabo. Die zurückhaltende Lesart nimmt niemandem etwas, was er heute hat, und lässt sich erweitern, sobald es gewünscht ist. | 2026-10-26 |

### Technical Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| `subscriptions.dance_style_id` (nullable) statt neuer Tabelle | Ein kursloses Abo **mit** Stil ist ein Pass, **ohne** Stil die volle Flatrate. Damit bleibt es ein Produktweg durch die Anwendung: Zyklus, Einzug, Kündigung, Kursplätze und Anwesenheit kennen weiterhin nur „Abo". Eine eigene Tabelle hieße, jede dieser Strecken zweimal zu pflegen. | 2026-10-26 |
| `dance_styles.pass_price` / `pass_student_price` | Dort steht schon, was eine Stilrichtung ist. Der Preis am Stil macht die Produktentscheidung zu einer Eingabe statt zu einer Programmänderung. | 2026-10-26 |
| Aus `aktive_flatrate(kunde)` wird zusätzlich `deckt_abo_kurs(kunde, kurs)` | Die alte Funktion beantwortet „hat überhaupt ein kursloses Abo" und bleibt, wo genau das gemeint ist (Upgrade-Sperre, Preisliste). Die neue beantwortet „deckt es *diesen* Kurs" — die Frage, die die Buchungssperre und das Hinzufügen wirklich stellen. Beide Fragen in eine Funktion zu pressen hätte eine von beiden verdorben. | 2026-10-26 |
| `course_members` bleibt unverändert | Die Sicht liest **bestehende Kursplätze**. Der Pass beschränkt, welche Plätze *entstehen* dürfen — nicht, wie sie gelesen werden. Deshalb bleiben Check-in, Anwesenheitsliste, Kursbelegung und Rollenbalance unberührt. | 2026-10-26 |
| `desired_plan` bekommt den Wert `style_pass` | Die Spalte hat eine CHECK-Liste (`in ('single_course','flatrate')`) — ein neuer Wert braucht eine Migration, sonst scheitert das Einfügen. Dieselbe Falle wie bei `notification_queue.event_type` (PROJ-14/87). | 2026-10-26 |
| Die Stilrichtung wird bei der **Bestätigung** ans Abo geschrieben | `actions/admin/bookings.ts` setzt heute `course_id: plan === "single_course" ? course_id : null` — an zwei Stellen (einzeln und im Stapel, PROJ-48). Dort kommt die Stilrichtung des gebuchten Kurses dazu. | 2026-10-26 |
| Der Preis kommt weiter aus `plan_price()` serverseitig | PROJ-41: Der Browser schickt den Wunsch, nicht den Betrag. Die Funktion bekommt den Pass-Fall und liest den Preis an der Stilrichtung des Kurses. | 2026-10-26 |

## Umfang (geschätzt)

Dreißig Dateien erwähnen heute „flatrate" oder `course_id is null`. Der größte Teil davon
liest nur Kursplätze und bleibt unberührt — die eigentliche Arbeit sitzt an fünf Stellen:
der Buchungsdialog samt Kacheln, die Buchungsfunktion mit ihrer Sperre, das Hinzufügen
weiterer Kurse, die Bestätigung in der Verwaltung und die Preispflege an den Stilrichtungen.

## Umsetzung (2026-10-26)

**Datenbank** — [20261026100000_proj93_stil_pass.sql](../supabase/migrations/20261026100000_proj93_stil_pass.sql):
`dance_styles.pass_price` / `pass_student_price`, `subscriptions.dance_style_id`, die
erweiterte CHECK-Liste für `course_bookings.desired_plan` und vier Funktionen —
`deckt_abo_kurs()` neu, `create_regular_course_booking()`, `add_course_to_flatrate()` und
`resolve_plan_price()` angepasst. `course_members` bleibt unberührt, wie geplant: Damit
bleiben Check-in, Anwesenheitsliste, Kursbelegung und Rollenbalance unangetastet.

**Dieselbe Regel an zwei Orten, mit Absicht:** `deckt_abo_kurs()` in der Datenbank
entscheidet, ob der Eintrag entsteht; `decktKurs()` in
[kurszugehoerigkeit.ts](../src/lib/flatrate/kurszugehoerigkeit.ts) entscheidet, ob der Knopf
dazu erscheint. Beide Dateien zeigen aufeinander. Läuft eine weg, bietet die Oberfläche
etwas an, das die Datenbank ablehnt — deshalb hat die zweite eine Prüfung.

**Preisrechnung:** `planPrice()` bekommt die Passpreise des Kurses mitgegeben, statt sie in
`StudioPricing` zu legen — sie gehören zur Stilrichtung, nicht zur Preisliste des Studios.
Die SQL-Zwillingsfunktion `resolve_plan_price()` liest dieselben Felder.

**Oberfläche:** die dritte Kachel in
[plan-price-tiles.tsx](../src/components/booking/plan-price-tiles.tsx) — sichtbar nur mit
Stilrichtung **und** Preis, das Gitter wechselt dann auf drei Spalten. Die Felder dafür sind
am `BookingDialogCourse` **Pflicht**, nicht optional: Der Compiler hat damit alle vier
Aufrufer genannt (Katalog, Kursseite, Stundenplan, „Mein Bereich"), statt den Pass dort still
fehlen zu lassen.

**Hinzufügen statt buchen** entscheidet sich jetzt je Kurs: `hasFlatrate` wird mit
`decktKurs(...)` gefüllt. Damit sind Katalog, Kursseite und Stundenplan in einem Zug richtig
— ein Bachata-Pass-Kunde sieht bei Salsa „Jetzt buchen", bei Bachata „hinzufügen". Der Name
`hasFlatrate` bleibt (er steckt in fünf Typen), aber jede Deklaration sagt jetzt, dass er
„deckt diesen Kurs" bedeutet.

**Verwaltung:** Die Tanzstil-Verwaltung bekommt die zwei Preisfelder und eine Spalte „Pass"
in der Tabelle („kein Pass", wenn leer). Darunter ein Satz, der sagt, was der Preis
bewirkt — er ist nicht nur ein Betrag, sondern der Schalter für das Angebot.

**Meldungen:** „Dein Pass gilt nur für Kurse seiner Stilrichtung — diesen Kurs kannst du
einzeln buchen", dazu zwei Abweisungen für Aufrufe, die die Oberfläche nicht anbietet
(kein Pass für diesen Stil, schon ein kursloses Abo vorhanden). Im Profil nennt die
Upgrade-Sperre jetzt den Pass statt „du hast bereits eine Flatrate — damit stehen dir alle
Kurse offen", was bei einem Pass falsch war.

**Geprüft:** 1092 Unit-Tests grün, darunter 6 neue für den Passpreis und 6 für
`decktKurs`/`darfVideosSehen`. Lint und Build sauber.

Dazu 18 Datenbankprüfungen in
[PROJ-93-stil-pass-db.test.ts](../tests/PROJ-93-stil-pass-db.test.ts): die Deckung von
beiden Seiten (Flatrate deckt alles, Pass nur seinen Stil, kein Pass deckt einen Kurs ohne
Stilrichtung), der Preis am Stil samt Ermäßigung, die drei Abweisungen beim Buchen und die
zwei beim Hinzufügen. Die wichtigste darunter ist nicht, dass der Pass Bachata deckt,
sondern dass er den Kunden **nicht** aus Salsa aussperrt — genau das hätte die alte Annahme
getan.

Und drei Browserprüfungen in
[PROJ-93-stil-pass.spec.ts](../tests/PROJ-93-stil-pass.spec.ts): Kachel mit Preis bei einem
Kurs mit Pass, **keine** Kachel bei einem Kurs ohne, und der ganze Weg bis zur Anfrage in
der Datenbank (`desired_plan = 'style_pass'`, Preis der Stilrichtung).

**Ein Test von mir war falsch gedacht**, nicht der Code: „zweites kursloses Abo abweisen"
hatte ich mit einer laufenden Flatrate geprüft — dort greift aber zuerst die frühere und
bessere Meldung „dieser Kurs ist schon gedeckt". Der Fall braucht einen **zweiten**
Pass-Stil, und so steht er jetzt da.

## Open Questions

- [ ] Wie heißt der Pass in der Oberfläche? → Entschieden beim Bauen: aus dem Stilnamen
      gebildet („Bachata-Pass" / „Bachata pass"), damit ein Salsa-Pass keinen neuen Text
      braucht.
- [ ] Soll die Kurskarte im Katalog den Passpreis nennen („ab 85 € im Bachata-Pass")?
      Vorerst nein, siehe Out of Scope.
- [ ] Soll der Abo-Name beim Bestätigen „Bachata-Pass" vorschlagen? Heute schlägt die
      Verwaltung den **Kursnamen** vor — auch bei der Flatrate. Kleine Verbesserung, eigener
      Schritt.
- [ ] Soll beim Bestätigen eines Pass- oder Flatrate-Abos der gebuchte Kurs automatisch als
      Kursplatz entstehen? Heute muss der Kunde ihn im Profil eintragen. Betrifft beide
      Produkte gleich.

## Deployment

- **Ausgeliefert:** 2026-10-26
- **Produktion:** https://app.viennasalsastudio.at
- **Commits:** `b52816f` (Funktion), `f97bb58` (Prüfungen), Tag `v1.93.0-PROJ-93`
- **Migration:** `20261026100000_proj93_stil_pass.sql` — **vor** dem Deploy in Test und
  Produktion eingespielt. In dieser Reihenfolge zwingend: Katalog, Stundenplan und Profil
  lesen die neuen Spalten, und ohne sie antwortet die Seite mit einem Fehler.
- **Regression geprüft:** Kursbuchung (PROJ-8), Flatrate (PROJ-50) und Preiskacheln
  (PROJ-41) — 59 Browserprüfungen grün.
- **Nachgesehen:** Vercel-Deployment `Ready` (1 min); Startseite, `/kurse` und
  `/stundenplan` 200 — damit ist belegt, dass die Migration in Produktion steht, denn genau
  diese Seiten lesen die neuen Spalten. `/admin/tanzstile` und `/profil` 307 auf die
  Anmeldung.

### Für den Betrieb

- **So entsteht der Pass:** Verwaltung → Tanzstile → Stilrichtung bearbeiten → „Pass je
  Monat" eintragen. Ab dem Speichern sehen Kunden bei allen Kursen dieser Stilrichtung die
  dritte Kachel. Feld leeren = es gibt ihn nicht mehr; **laufende Pässe bleiben davon
  unberührt**, ihr Preis steht im Abo.
- Bleibt der Studierendenpreis leer, gilt für Studierende der normale Passpreis.
- Ein Pass-Kunde kann Kurse anderer Stilrichtungen **einzeln** buchen — das ist gewollt und
  geprüft. Er sieht dort „Jetzt buchen" statt „hinzufügen".
- **Der Wechsel auf die volle Flatrate ist Handarbeit.** Im Profil steht dem Kunden das
  jetzt so da; er schreibt dir, du stellst das Abo um (Kurs-Feld leer, Stilrichtung
  entfernen, Preis setzen).
- Ein Kunde hat höchstens **ein** kursloses Abo: Pass oder Flatrate. Ein zweites weist die
  Datenbank ab.
- **Nicht automatisch:** Der gebuchte Kurs wird mit der Bestätigung **kein** Kursplatz — der
  Kunde trägt ihn im Profil ein, genau wie bei der Flatrate. Siehe offene Fragen.
- Lehrkraft und Anwesenheitsliste merken vom Pass nichts: Dort zählt der Kursplatz, und der
  sieht aus wie jeder andere.
