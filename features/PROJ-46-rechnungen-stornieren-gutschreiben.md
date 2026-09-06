# PROJ-46: Rechnungen stornieren und gutschreiben

## Status: Deployed
**Created:** 2026-09-06
**Last Updated:** 2026-09-06

## Dependencies
- Requires: PROJ-10 (Rechnungsarchiv) — Rechnungen, Nummernkreis, Kundenansicht
- Requires: PROJ-7 (SEPA-Mandate & Sammel-Einzug) — Rechnungen entstehen aus Lastschriftläufen
- Requires: PROJ-44 (Empfehlungsprogramm) — das Guthabenkonto, auf dem der Betrag landet
- Requires: PROJ-36 (Buchhaltungs-Export) — Storno und Gutschrift müssen dort erscheinen

## Problemstellung

Eine ausgestellte Rechnung lässt sich heute nicht mehr aufheben. Es gibt
weder Storno noch Gutschrift — im gesamten Code keinen Ansatz dafür.

Solange nur Testkunden existieren, ist das folgenlos. Mit echten Kunden nicht:
Eine fehlerhafte Rechnung darf in Österreich nicht gelöscht werden, sie muss
durch einen eigenen Beleg aufgehoben werden. Ohne dieses Werkzeug bleibt dem
Betreiber nur, die Zeile in der Datenbank zu ändern — genau das, was die
Buchhaltung nicht verträgt.

Die Fälle, die im Betrieb auftreten:

- **Falscher Kurs oder falscher Kunde.** Die Rechnung ist als Ganzes falsch.
- **Doppelte Abbuchung.** Ein Lauf wurde versehentlich zweimal erzeugt.
- **Nachträglicher Nachlass.** Ein Kunde war vier Wochen krank; der Betreiber
  erstattet einen Teil.
- **Anteilige Rückerstattung.** Ein Kurs fiel aus und wurde nicht nachgeholt.

## User Stories

- Als **Betreiber** möchte ich eine falsche Rechnung stornieren können, damit
  meine Buchhaltung stimmt, ohne dass ich Daten löschen muss.
- Als **Betreiber** möchte ich einem Kunden nachträglich einen Teilbetrag
  gutschreiben können, ohne die ganze Rechnung aufzuheben.
- Als **Betreiber** möchte ich, dass der gutgeschriebene Betrag automatisch
  mit der nächsten Abbuchung verrechnet wird, damit ich nichts überweisen und
  an nichts denken muss.
- Als **Betreiber** möchte ich beim Steuerberater jederzeit belegen können,
  warum eine Rechnung aufgehoben wurde.
- Als **Kunde** möchte ich den Storno oder die Gutschrift in meinem
  Rechnungsarchiv finden, damit ich weiß, dass die falsche Rechnung erledigt
  ist.

## Umfang

**Zwei getrennte Vorgänge, ein gemeinsamer Belegtyp.**

*Storno* hebt eine Rechnung vollständig auf. Der Betrag ergibt sich aus der
Rechnung, er ist nicht eingebbar — eine Teilaufhebung ist eine Gutschrift.

*Gutschrift* erstattet einen frei wählbaren Betrag bis zur Höhe der Rechnung.

Beide erzeugen einen eigenen Beleg mit **negativem Betrag**, der auf die
ursprüngliche Rechnung verweist. Die ursprüngliche Rechnung bleibt
unverändert bestehen — das ist der Kern der Sache.

**Der Betrag landet als Guthaben beim Kunden** und wird mit der nächsten
Abbuchung verrechnet. Das ist genau das, was die AGB über Guthaben sagen
(„wird nicht ausgezahlt, sondern mit der folgenden Kursgebühr verrechnet"),
und es nutzt das Konto aus PROJ-44 statt eines zweiten Wegs.

**Nummernkreis:** derselbe wie für Rechnungen. Ein Storno bekommt die nächste
laufende Nummer. Eine Zählung, keine Lücken; der Belegtyp steht in der Zeile,
nicht in der Nummer.

## Out of Scope

- **Rückzahlung per Überweisung.** Der Betrag wird verrechnet, nicht
  ausgezahlt. Will der Betreiber ausnahmsweise überweisen, tut er das im
  Online-Banking; die App weiß davon nichts. Eine SEPA-Überweisung zu
  erzeugen wäre ein eigenes Feature.
- **Storno eines Storno.** Ein Beleg, der einen Beleg aufhebt, der einen Beleg
  aufhebt — dafür gibt es keinen betrieblichen Anlass, und es öffnet eine
  Kette, die niemand mehr überblickt.
- **Manuelle Rechnungen** (Barzahlung an der Tür, Privatstunde). Eigenes
  Thema, eigene Spezifikation.
- **Korrektur eines laufenden Lastschriftlaufs**, bevor die Bankdatei entsteht
  — der verwandte, aber andere Fall. Eigene Spezifikation.
- **Automatischer Storno**, etwa bei einer Kursabsage. Der Betreiber entscheidet.

## Acceptance Criteria

### Storno

- [ ] Angenommen der Betreiber sieht eine Rechnung, wenn er sie öffnet, dann findet er eine Aktion „Stornieren"
- [ ] Angenommen der Betreiber storniert eine Rechnung, wenn er den Vorgang bestätigt, dann entsteht ein neuer Beleg mit der nächsten laufenden Nummer, negativem Betrag in voller Höhe und einem Verweis auf die ursprüngliche Rechnung
- [ ] Angenommen eine Rechnung wurde storniert, wenn der Betreiber sie ansieht, dann ist sie als storniert gekennzeichnet und ihr Betrag unverändert
- [ ] Angenommen eine Rechnung wurde storniert, wenn der Betreiber sie erneut stornieren will, dann wird die Aktion nicht angeboten
- [ ] Angenommen der Betreiber storniert, wenn er den Vorgang auslöst, dann muss er einen Grund angeben, und dieser steht auf dem Beleg
- [ ] Angenommen ein Storno wurde erstellt, wenn der Betreiber ihn ansieht, dann lässt er sich nicht mehr ändern oder löschen

### Gutschrift

- [ ] Angenommen der Betreiber sieht eine Rechnung, wenn er sie öffnet, dann findet er eine Aktion „Gutschrift erstellen"
- [ ] Angenommen der Betreiber erstellt eine Gutschrift, wenn er einen Betrag eingibt, dann wird ein Betrag über der Rechnungssumme abgelehnt
- [ ] Angenommen der Betreiber erstellt eine Gutschrift, wenn er einen Betrag von 0 oder weniger eingibt, dann wird er abgelehnt
- [ ] Angenommen es gibt bereits eine Gutschrift zu einer Rechnung, wenn der Betreiber eine weitere erstellt, dann darf die Summe aller Gutschriften die Rechnungssumme nicht übersteigen
- [ ] Angenommen der Betreiber erstellt eine Gutschrift, wenn er den Vorgang auslöst, dann muss er einen Grund angeben

### Guthaben und Verrechnung

- [ ] Angenommen ein Storno oder eine Gutschrift wurde erstellt, wenn der Vorgang abgeschlossen ist, dann ist der Betrag dem Guthabenkonto des Kunden gutgeschrieben
- [ ] Angenommen ein Kunde hat Guthaben aus einem Storno, wenn er sein Dashboard oder Profil öffnet, dann sieht er den Betrag mit einer nachvollziehbaren Herkunft
- [ ] Angenommen ein Kunde hat Guthaben, wenn der nächste Lastschriftlauf erzeugt wird, dann wird es wie jedes andere Guthaben verrechnet — Storno-Guthaben ist kein Sonderfall

### Kundensicht

- [ ] Angenommen zu einer Rechnung des Kunden gibt es einen Storno, wenn er sein Rechnungsarchiv öffnet, dann sieht er beide Belege
- [ ] Angenommen der Kunde sieht eine stornierte Rechnung, wenn er sie betrachtet, dann ist erkennbar, dass sie aufgehoben wurde
- [ ] Angenommen der Kunde öffnet einen Storno- oder Gutschriftsbeleg, wenn er ihn druckt, dann enthält er dieselben Studio-Stammdaten wie eine Rechnung, den Verweis auf die ursprüngliche Rechnung und den Grund

### Buchhaltung

- [ ] Angenommen im Zeitraum gibt es Stornos, wenn der Betreiber den Buchhaltungs-Export erzeugt, dann erscheinen sie als eigene Zeilen mit negativen Beträgen
- [ ] Angenommen der Export enthält Stornos, wenn die GESAMT-Zeile gebildet wird, dann sind sie darin verrechnet
- [ ] Angenommen ein Storno hat denselben USt-Satz wie die Rechnung, wenn die Zwischensummen je Satz gebildet werden, dann steht er in derselben Gruppe

### Rechte

- [ ] Angenommen ein Kunde ruft die Storno-Funktion direkt über die Schnittstelle auf, wenn er kein Admin ist, dann wird der Aufruf abgewiesen
- [ ] Angenommen eine Lehrkraft ruft sie auf, wenn sie kein Admin ist, dann wird der Aufruf ebenfalls abgewiesen

## Edge Cases

- **Rechnung ist bereits als bezahlt markiert.** Storno bleibt möglich — ob
  das Geld schon geflossen ist, ändert nichts daran, dass der Beleg falsch war.
  Der Betrag geht ins Guthaben.
- **Rechnung wurde zurückgebucht** (`bounced_at` gesetzt) und ist offen. Ein
  Storno hebt die Forderung auf. Der offene Posten muss danach verschwinden,
  sonst mahnt das System eine Forderung an, die es nicht mehr gibt.
- **Rücklastschriftgebühr** (`bounce_fee`) ist gesetzt. Beim Vollstorno wird
  sie mit aufgehoben; bei einer Teilgutschrift bleibt sie bestehen.
- **Kunde wurde inzwischen gelöscht.** Rechnungen verweisen auf `profiles`;
  ohne Kunde gibt es kein Guthabenkonto. Der Beleg muss trotzdem entstehen
  können — die Buchhaltung braucht ihn, unabhängig davon, ob der Kunde noch da ist.
- **Jahreswechsel.** Eine Rechnung aus 2026 wird im Januar 2027 storniert. Der
  Beleg bekommt eine Nummer aus dem Kreis **2027**, mit Datum 2027 — nicht
  rückdatiert.
- **Zwei Betreiber stornieren gleichzeitig.** Die Nummernvergabe muss das
  aushalten, ohne zweimal dieselbe Nummer zu vergeben.
- **Summe mehrerer Gutschriften erreicht genau die Rechnungssumme.** Erlaubt.
  Erst darüber hinaus wird abgelehnt.

## Technical Requirements

- Nur für Admins, serverseitig geprüft — nicht nur in der Oberfläche.
- Belege sind unveränderlich: einmal erstellt, weder änder- noch löschbar.
- Die Nummernvergabe muss gegen gleichzeitige Aufrufe abgesichert sein
  (der bestehende `invoice_number_counters`-Mechanismus tut das bereits).
- Alle Datumsangaben in `Europe/Vienna` — siehe [docs/zeitzone.md](../docs/zeitzone.md).
- Zweisprachig, soweit der Kunde die Belege sieht (PROJ-43).

## Open Questions

- [ ] Soll der Kunde bei einem Storno benachrichtigt werden (E-Mail), oder
      genügt der Beleg im Archiv? Betrifft PROJ-16.
- [x] Braucht der Beleg einen eigenen Ausdruck, oder reicht die vorhandene
      Rechnungsdetailseite mit anderer Überschrift? → Dieselbe Seite. Sie trägt
      jetzt die Belegart als Überschrift, „Belegnummer"/„Belegdatum" statt
      „Rechnungs-", den Verweis auf die aufgehobene Rechnung mit Datum und den
      Grund. Ein zweites Layout hätte dieselben Stammdaten ein zweites Mal
      pflegen müssen. (2026-09-06)
- [x] Soll die Rechnungsliste in der Verwaltung Stornos standardmäßig zeigen
      oder ausblenden? → Zeigen. Eine Spalte „Art" und der Bezug darunter
      machen sie unterscheidbar; ausgeblendet würden die Summen der Liste nicht
      mehr zu denen des Exports passen. (2026-09-06)
- [ ] Der Zähler steht bei 875 für 2026, obwohl **null** echte Rechnungen
      existieren (Rückstand aus Testläufen, deren Rechnungen gelöscht wurden).
      Die erste echte Rechnung hieße `2026-0876`. Vor dem Start
      zurücksetzen? Betrifft nicht dieses Feature, wurde aber hier gefunden.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Storno und Gutschrift als getrennte Vorgänge | Ein Vollstorno mit eingebbarem Betrag lädt zu Tippfehlern ein; eine Gutschrift ohne Betrag ergibt keinen Sinn. Getrennte Knöpfe machen die Absicht eindeutig — und der Beleg heißt, was er ist. | 2026-09-06 |
| Der Betrag landet als Guthaben, nicht als Rückzahlung | Das Guthabenkonto aus PROJ-44 existiert, die Verrechnung mit der nächsten Abbuchung läuft bereits, und die AGB sagen genau das zu. Eine Rückzahlung wäre ein zweiter Weg, der von Hand ausgelöst und von Hand nachgehalten werden müsste. | 2026-09-06 |
| Derselbe Nummernkreis wie Rechnungen | Eine fortlaufende Zählung ist leichter zu verantworten als zwei. Der Belegtyp steht in der Zeile; die Nummer muss ihn nicht tragen. | 2026-09-06 |
| Die ursprüngliche Rechnung bleibt unverändert | Der Kern eines Stornos: nicht ändern, sondern durch einen zweiten Beleg aufheben. Alles andere wäre das Löschen, das wir vermeiden wollen. | 2026-09-06 |
| Ein Grund ist Pflicht | Ein halbes Jahr später weiß niemand mehr, warum. Der Steuerberater fragt genau danach. | 2026-09-06 |
| Kein Storno eines Stornos | Kein betrieblicher Anlass, und es öffnet eine Kette, die niemand mehr überblickt. | 2026-09-06 |

### Technical Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Storno und Gutschrift sind Belege in derselben Liste wie Rechnungen, mit negativem Betrag | Kundenarchiv, Buchhaltungs-Export und Nummernvergabe funktionieren dadurch unveraendert. Eine eigene Tabelle haette alle drei Stellen betroffen und die Summenbildung an zwei Orten richtig zu halten verlangt. | 2026-09-06 |
| Die urspruengliche Rechnung wird nicht veraendert | Ob sie aufgehoben ist, ergibt sich aus dem Verweis des Stornos. Ein zusaetzliches Feld an der Rechnung waere eine zweite Wahrheit, die auseinanderlaufen kann. | 2026-09-06 |
| Eigener Herkunftswert im Guthabenkonto statt „manuell" | Sonst sieht weder Kunde noch Betreiber spaeter, woher das Guthaben stammt. | 2026-09-06 |
| Beleg und Guthaben entstehen gemeinsam oder gar nicht | Ein Beleg ohne Gutschrift waere eine Forderung, die der Kunde nie zurueckbekommt; eine Gutschrift ohne Beleg waere Geld ohne Grund. | 2026-09-06 |
| Unveraenderlichkeit in der Datenbank, nicht in der Oberflaeche | Eine Buchhaltung, die sich auf eine ausgeblendete Schaltflaeche verlaesst, ist keine. | 2026-09-06 |
| Offene Posten schliessen sich beim Storno selbst | Sonst mahnt das System eine Forderung an, die aufgehoben ist. | 2026-09-06 |
| Korrektur zum Entwurf: die offenen Posten sind **nicht** die einzige betroffene Auswertung | Im Backend-Schritt zeigte sich, dass ein negativer Beleg auch Buchhaltungs-Export, Umsatzkennzahl, Zahlungserinnerung und Guthaben-Verlauf beruehrt. Der Entwurf hatte das zu eng gefasst. | 2026-09-06 |
| Ein Storno folgt dem Schicksal der Rechnung, die es aufhebt | Wird eine zurueckgebuchte Rechnung storniert, gehoert der Beleg in den Ruecklastschrift-Block, nicht in die eingegangenen Einnahmen: dieses Geld war nie da, und der Beleg wuerde die Summe sonst ein zweites Mal senken. | 2026-09-06 |
| Neue Export-Spalten hinten angehaengt statt vorne eingeschoben | Wer die Datei in eine Vorlage einliest, bekommt so zusaetzliche Spalten und keine verschobenen. | 2026-09-06 |
| Keine neuen Pakete | Nummernvergabe, Belegdruck, Guthabenkonto, Export und Rechtepruefung sind vorhanden. | 2026-09-06 |

---

## Tech Design (Solution Architect)

### Der tragende Gedanke

**Ein Storno ist selbst eine Rechnung — mit negativem Betrag.**

Das klingt nach einem Detail, entscheidet aber über den halben Aufwand. Drei
Dinge lesen heute die Rechnungsliste: das Kundenarchiv, der
Buchhaltungs-Export und die offenen Posten. Steht der Storno als Zeile in
derselben Liste, funktionieren alle drei **ohne Änderung**:

- Der Export summiert Netto, USt und Brutto über alle Zeilen. Eine Zeile mit
  −65 € verrechnet sich von selbst, auch in der GESAMT-Zeile und in der
  Zwischensumme des passenden USt-Satzes.
- Das Kundenarchiv zeigt alle Belege des Kunden. Der Storno erscheint dort
  ohne Zutun.
- Die Nummernvergabe läuft weiter wie bisher, inklusive ihrer Absicherung
  gegen gleichzeitige Zugriffe.

Die Alternative — eine eigene Tabelle für Storno-Belege — hieße, alle drei
Stellen anzufassen und die Summenbildung an zwei Orten richtig zu halten.

### A) Aufbau

```
Verwaltung → Rechnungen
|
+-- Rechnungsliste                        [bestehend]
|   +-- Zeile je Beleg
|       +-- Art: Rechnung / Storno / Gutschrift      NEU
|       +-- bei Rechnungen: [Stornieren] [Gutschrift]  NEU
|
+-- Dialog "Stornieren"                                NEU
|   +-- zeigt Rechnung und vollen Betrag (nicht änderbar)
|   +-- Grund (Pflichtfeld)
|   +-- Hinweis: Betrag geht als Guthaben an den Kunden
|
+-- Dialog "Gutschrift"                                NEU
|   +-- Betrag (höchstens die Restsumme der Rechnung)
|   +-- Grund (Pflichtfeld)
|
+-- Belegdetailseite                       [bestehend, erweitert]
    +-- bei Storno/Gutschrift: Verweis auf die ursprüngliche Rechnung
    +-- bei stornierter Rechnung: Verweis auf den aufhebenden Beleg

Kundenbereich → Profil → Meine Rechnungen  [bestehend]
    +-- Storno und Gutschrift erscheinen als eigene Zeilen
    +-- stornierte Rechnung ist als aufgehoben gekennzeichnet
```

### B) Welche Informationen dazukommen

An einem Beleg fehlen heute drei Angaben:

| Was | Wofür |
|---|---|
| **Art des Belegs** | Rechnung, Storno oder Gutschrift — heute ist jede Zeile eine Rechnung |
| **Bezug** | auf welche Rechnung sich ein Storno bezieht |
| **Grund** | warum aufgehoben wurde; steht auf dem Beleg und ist Pflicht |

Alles Übrige ist vorhanden: Nummer, Datum, Kunde, Betrag, USt-Satz,
Beschreibung.

**Beim Guthaben** kommt ein neuer Herkunftswert dazu. Heute kennt das Konto
„Empfehlung", „manuell" und „verrechnet". Ein Storno-Guthaben unter
„manuell" zu führen wäre bequem, aber der Kunde sähe dann nicht, woher es
kommt — und der Betreiber später auch nicht.

### C) Technische Entscheidungen und warum

**Der Storno steht in derselben Liste wie die Rechnungen.**
Begründung oben. Der Preis dafür: Jede Auswertung, die „alle Rechnungen"
meint, muss künftig sagen, ob sie Stornos einschließt. Das betrifft heute
genau eine Stelle — die offenen Posten.

**Die ursprüngliche Rechnung wird nicht angefasst.**
Sie behält Betrag, Nummer und Datum. Ob sie aufgehoben ist, ergibt sich
daraus, dass ein Storno auf sie verweist. Ein Feld „storniert: ja" an der
Rechnung wäre eine zweite Wahrheit, die mit der ersten auseinanderlaufen kann.

**Offene Posten schließen sich selbst.**
Die Mahnliste zeigt zurückgebuchte, unbeglichene Rechnungen. Wird eine davon
storniert, gibt es die Forderung nicht mehr — sie muss verschwinden, sonst
mahnt das System etwas an, das aufgehoben ist. Das ist die eine Stelle, die
der neue Belegtyp zwingend ändert.

**Belege sind unveränderlich, und zwar in der Datenbank.**
Nicht nur der Knopf fehlt, sondern das Recht. Eine Buchhaltung, die sich auf
eine ausgeblendete Schaltfläche verlässt, ist keine.

**Nur Admins, serverseitig geprüft.**
Wie bei jedem anderen Verwaltungsvorgang: Die Prüfung sitzt dort, wo der
Vorgang ausgeführt wird, nicht in der Oberfläche.

**Storno und Guthaben entstehen gemeinsam oder gar nicht.**
Ein Beleg ohne Gutschrift wäre eine Forderung, die der Kunde nie
zurückbekommt; eine Gutschrift ohne Beleg wäre Geld ohne Grund. Beides
zusammen oder nichts.

### D) Neue Pakete

**Keine.** Nummernvergabe, Belegdruck, Guthabenkonto, Export und
Rechteprüfung sind alle vorhanden. Es kommen Angaben an einem bestehenden
Beleg dazu und zwei Dialoge in der Verwaltung.

### E) Aufwandseinschätzung

| Teil | Aufwand | Begründung |
|---|---|---|
| Belegart, Bezug und Grund | klein | drei Angaben an einer bestehenden Tabelle |
| Storno erzeugen (Beleg + Guthaben gemeinsam) | mittel | muss geschlossen ablaufen, sonst entsteht Geld ohne Beleg |
| Gutschrift mit Betragsprüfung | mittel | Summe aller Gutschriften darf die Rechnung nicht übersteigen |
| Zwei Dialoge in der Verwaltung | klein | vorhandene Bausteine |
| Offene Posten anpassen | klein | eine Abfrage |
| Kundenansicht und Belegdruck | klein | zwei Zeilen mehr Information |
| Buchhaltungs-Export | **keiner** | funktioniert durch die negative Zeile von selbst |


## Implementierungsnotizen (Frontend)

**Was steht:** die beiden Dialoge (`beleg-dialoge.tsx`), die Prüfregeln als
eigene Funktion in `src/lib/invoices.ts` mit neun Unit-Tests, die Belegart in
der Rechnungsliste der Verwaltung und im Kundenarchiv.

**Was fehlt und im Backend-Schritt dazukommt:** Die drei Angaben — Belegart,
Bezug, bereits gutgeschriebener Betrag — haben noch keine Datengrundlage. In
`src/app/admin/rechnungen/page.tsx` und der Profilseite stehen sie als
benannte Platzhalter mit Kommentar, nicht als stille Standardwerte. Heute ist
jeder Beleg eine Rechnung ohne Bezug, was dem tatsächlichen Stand entspricht
— es gibt noch keine Stornos.

**Anmerkung zur Reihenfolge:** Bei diesem Feature trägt die Trennung
Frontend/Backend weniger gut als sonst. Die beiden Dialoge sind im Kern
Datenbankvorgänge; ohne Spalten und Aktionen lassen sie sich anzeigen, aber
nicht auslösen. Die Prüfregeln der Gutschrift sind der Teil, der eigenständig
prüfbar ist — deshalb liegen sie als eigene Funktion vor und nicht im Dialog
eingebettet.

## Implementierungsnotizen (Backend)

### Migrationen

Zwei Dateien, beide auf Test- und Produktionsdatenbank angewendet und
byte-genau gegen die tatsächlich ausgeführten Anweisungen geprüft (MD5 und
Länge stimmen überein):

- `20260906093831_proj46_storno_und_gutschrift.sql` — drei Spalten auf
  `invoices` (`document_type`, `cancels_invoice_id`, `reason`), zwei
  CHECK-Regeln (Form und Vorzeichen), Teilindex, der Trigger
  `invoices_unveraenderlich`, sowie `customer_credits.origin` um `'storno'`
  erweitert mit Begründungspflicht.
- `20260906093853_proj46_storno_funktionen.sql` — `create_invoice_document`.

Die Funktionskörper in beiden Datenbanken sind identisch (gleicher
normalisierter MD5, genau eine Überladung).

### Wo die Regeln sitzen

In der Datenbank, nicht in der Oberfläche:

- **Restbetrag und Sperre.** `create_invoice_document` sperrt die Rechnung
  (`for update`), bevor es den bereits gutgeschriebenen Betrag summiert. Zwei
  gleichzeitige Gutschriften können die Rechnungssumme dadurch nicht
  gemeinsam übersteigen.
- **Betrag beim Vollstorno.** Nicht wählbar — die Funktion setzt ihn auf den
  Restbetrag. Deshalb hat `storniereRechnung` keinen Betragsparameter und der
  Storno-Dialog kein Eingabefeld.
- **Unveränderlichkeit.** Ein Trigger, keine ausgeblendete Schaltfläche.
  Belege lassen sich weder ändern noch löschen; an einer Rechnung sind Nummer,
  Datum, Kunde, Betrag, Steuersatz und Belegart eingefroren. Änderbar bleibt
  nur, was den Zahlungsstand betrifft (`settled_at`, `reminded_at`,
  `bounce_fee`, `bounced_at`) — sonst hätten die offenen Posten aufgehört zu
  funktionieren.
- **Beleg und Guthaben entstehen gemeinsam.** Ein Aufruf, eine Transaktion.

### Was ausserhalb der Storno-Funktion angepasst werden musste

Die Änderung endet nicht bei der Rechnungsliste. Ein negativer Beleg in
derselben Tabelle wirkt überall dorthin, wo bisher jede Zeile eine Rechnung
war:

- **Buchhaltungs-Export** — neue Spalten `Art` und `Bezug`, hinten angehängt
  statt vorne eingeschoben, damit bestehende Spaltenpositionen bleiben. Ein
  Storno einer *zurückgebuchten* Rechnung zählt in den
  Rücklastschrift-Block, nicht in die eingegangenen Einnahmen: dieses Geld war
  nie da, und der Beleg dürfte die Summe nicht ein zweites Mal senken.
- **Umsatzkennzahl im Admin-Dashboard** — dieselbe Regel.
- **Offene Posten** — nur noch echte Rechnungen; eine teilweise gutgeschriebene
  Forderung erscheint mit dem tatsächlich offenen Betrag und dem Hinweis, wie
  viel davon gutgeschrieben ist.
- **Zahlungserinnerung** — nennt den offenen Betrag abzüglich Gutschriften. Eine
  Mahnung über Geld, das der Kunde zurückbekommen hat, wäre eine falsche
  Forderung.
- **Guthaben-Verlauf** — Herkunft `storno` in Kunden- und Verwaltungsansicht;
  der Kunde sieht Belegnummer und Grund.
- **Belegansicht/Druck** — Belegart in der Überschrift, Verweis auf die
  aufgehobene Rechnung mit Datum, der Grund, und auf der Rechnung selbst der
  Hinweis, wodurch sie aufgehoben wurde. Der Vermerk zur
  Kleinbetragsrechnung erscheint nur noch auf Rechnungen.

### Geteilte Logik statt vierfacher Handarbeit

Die Umkehrung des Vorzeichens (Belege stehen negativ, gefragt ist der Betrag)
kam an vier Stellen vor. Sie liegt jetzt einmal in `src/lib/invoices.ts` als
`summiereAufhebungen`, zusammen mit `istVollstaendigAufgehoben` und
`belegFehlertext`. Zwölf zusätzliche Unit-Tests, insgesamt 370.

`istVollstaendigAufgehoben` behandelt einen Fall, den die naive Prüfung
`aufgehoben >= betrag` falsch beantwortet: eine Rechnung über 0,00 € gälte
sonst immer als storniert.

### Aufgelöste Randfälle

- **Kunde inzwischen gelöscht.** Kann nicht eintreten: `invoices.customer_id`
  verweist ohne `ON DELETE` auf `profiles`, ein Kunde mit Rechnungen lässt
  sich also gar nicht löschen. Die Verwaltung meldet das bereits über
  `isForeignKeyRestrictError`.
- **Zurückgebuchte Rechnung storniert.** Die Funktion setzt `settled_at` und
  nimmt die Rücklastschriftgebühr zurück; der offene Posten verschwindet.
  Bei einer Teilgutschrift bleibt die Gebühr stehen.

### Gegen die Testdatenbank geprüft

Neun Prüfungen mit Probedaten (danach restlos entfernt, verifiziert):
Auswahl der neuen Spalten, `eq("cancels_invoice_id", …)`, `not(… is null)`
und `in("id", …)` liefern das Erwartete; ein positiver Gutschriftsbetrag und
eine Gutschrift ohne Grund werden abgewiesen; ein Beleg lässt sich nicht
ändern; der Zahlungsstand einer Rechnung bleibt änderbar.

Die Funktion selbst war zuvor am echten Datenbestand geprüft: Teilgutschrift
über 15 €, danach Vollstorno über den **Restbetrag** von 50 € statt der vollen
65 €, Summe aus Rechnung und Belegen exakt 0,00 €, zwei Guthabenzeilen mit
Herkunft `storno`, und drei unzulässige Versuche ohne jede Zeile als Folge.

## QA Test Results

**Geprüft:** 2026-09-06
**Umgebung:** localhost:3100 gegen die Testdatenbank
**Browser:** Chromium und Mobile Safari (iPhone 13)

### Akzeptanzkriterien

Zwölf E2E-Prüfungen in `tests/PROJ-46-rechnungen-stornieren-gutschreiben.spec.ts`,
alle grün — Chromium 12/12, Mobile Safari 11/12 (der CSV-Export ist dort
übersprungen, iOS kennt keinen Datei-Download im Sinne von Playwright).

| Bereich | Abgedeckt |
|---|---|
| Storno | Aktion sichtbar, Grund ist Pflicht (Knopf gesperrt), Beleg mit nächster Nummer, negativem Betrag, Verweis und Grund; Rechnung bleibt unverändert |
| Storno | Aufgehobene Rechnung ist gekennzeichnet, beide Aktionen verschwinden |
| Gutschrift | Betrag über der Rechnungssumme und Betrag 0 werden abgewiesen, ohne Grund kein Absenden, keine Zeile bleibt zurück |
| Gutschrift | Serverseitig: 50 + 20 auf eine Rechnung über 65 scheitert, genau der Rest (15) ist erlaubt, danach ist nichts mehr offen |
| Guthaben | Betrag steht dem Kunden mit Belegnummer und Grund im Profil |
| Kundensicht | Beide Belege im Archiv, „Aufgehoben"-Kennzeichnung, Belegausdruck mit Belegart, Bezug und Grund; auf der Rechnung steht, wodurch sie aufgehoben wurde |
| Buchhaltung | Storno als eigene Zeile mit negativem Betrag, Spalten „Art" und „Bezug", GESAMT verrechnet ihn |
| Rechte | Kunde und Lehrkraft werden am RPC abgewiesen (`not authorized`), keine Zeile entsteht |
| Unveränderlichkeit | Der Admin — die einzige Rolle mit UPDATE-Recht — kann Beleg und Rechnungsbetrag nicht ändern; der Zahlungsstand bleibt änderbar |

### Randfälle

- **Vollstorno nach Teilgutschrift** hebt nur den Restbetrag auf: 15 + 50 = 65,
  Rechnung und Belege verrechnen sich exakt auf null. ✔
- **Storno einer zurückgebuchten Rechnung** schließt den offenen Posten und
  setzt die Rücklastschriftgebühr auf 0. ✔
- **Summe mehrerer Gutschriften trifft genau die Rechnungssumme** — erlaubt,
  erst darüber hinaus abgewiesen. ✔
- **Rechnung über 0,00 €** gilt nicht als aufgehoben (Unit-Test). ✔

### Sicherheitsprüfung

- Kunde und Lehrkraft am RPC: abgewiesen, keine Nebenwirkung.
- Der Kunde hat auf `invoices` gar keine UPDATE-Regel — RLS greift noch vor dem
  Trigger. Die Prüfung wurde deshalb auf den Admin-Weg umgestellt: dort greift
  der Trigger, und das ist der Weg, auf dem ein Versehen tatsächlich passieren
  würde.
- Keine DELETE-Regel auf `invoices` für irgendeine Anwendungsrolle.
- `reason` wird überall als Text gerendert (React escaped) — kein XSS-Weg.
- `/admin/rechnungen` hängt am Admin-Layout mit `requireAdmin()`.

### Gefundene Fehler

#### BUG-1: Der Trigger sperrte das Zurücksetzen der Testdatenbank

- **Schwere:** High
- **Gefunden bei:** Vorbereitung der E2E-Prüfungen
- **Beschreibung:** `scripts/seed-testdb.mjs` leert `invoices` über den
  Dienstschlüssel. Der Unveränderlichkeits-Trigger wies das ab, sobald ein
  einziger Storno existierte — die Testdatenbank hätte sich nie wieder
  aufbauen lassen.
- **Behoben:** Migration `20260906120000_proj46_belege_loeschen_fuer_dienstschluessel`.
  Löschen ist für `service_role`/`postgres` erlaubt, für `authenticated` und
  `anon` weiterhin gesperrt. Ändern bleibt für **alle** Rollen gesperrt.
  Die Ausnahme kostet keinen echten Schutz — wer den Dienstschlüssel hat,
  umgeht ohnehin jede RLS-Regel —, und sie schützt weiterhin genau den Weg,
  auf dem Fehler passieren.
- **Nachgewiesen:** Beleg über den Dienstschlüssel löschbar, über den
  Admin-Weg weiterhin nicht; auf beiden Datenbanken angewendet, gleicher
  normalisierter MD5, genau eine Überladung.

Keine weiteren Fehler. Zwei Fehlschläge im ersten Lauf waren Fehler in den
Prüfungen selbst, nicht im Produkt: mehrdeutige Textsuchen und ein geschütztes
Leerzeichen zwischen `€` und Betrag. Ein dritter — die GESAMT-Zeile mit einer
festen Zahl zu vergleichen — war eine Behauptung über den gesamten
Datenbestand und wird jetzt aus der Datenbank abgeleitet.

### Regressionsprüfung

61 E2E-Prüfungen über alle Bereiche, die dieses Feature berührt — alle grün.

| Suite | Ergebnis | Warum betroffen |
|---|---|---|
| PROJ-46 Storno und Gutschrift | 12/12 | neu |
| PROJ-10 Rechnungsarchiv | 12/12 | Belegart in Liste und Ausdruck |
| PROJ-36 Buchhaltungs-Export | 14/14 | zwei neue Spalten, Summenbildung |
| PROJ-37 Offene Posten | 9/9 | Filter auf echte Rechnungen, Restbetrag |
| PROJ-44 Guthaben | 3/3 | neue Herkunft `storno` |
| PROJ-17 Admin-Dashboard | 8/8 | Umsatzkennzahl |
| PROJ-16 Benachrichtigungen | 3/3 | Zahlungserinnerung nennt den offenen Betrag |
| Unit-Tests (Vitest) | 370/370 | |

Die drei Vorgaberechnungen aus dem Seed liegen in 2028 und tragen die Summen,
auf die PROJ-36 prüft. Diese Datei legt deshalb eigene Rechnungen an und räumt
sie hinterher restlos weg — nachgewiesen: nach dem Lauf stehen wieder genau die
drei Vorgabezeilen, null Belege, null Storno-Guthaben.

### Ergebnis

- **Akzeptanzkriterien:** alle abgedeckt und grün
- **Fehler:** 1 (High) — gefunden und behoben
- **Sicherheit:** bestanden
- **Produktionsreif:** ja

## Deployment

**Ausgeliefert:** 2026-09-06
**Produktion:** https://viennasalsastudio.vercel.app
**Stand:** `ebcd102`
**Tag:** `v1.46.0-PROJ-46`

### Vorabprüfungen

`npm run lint` sauber, `npm run build` erfolgreich, 370 Unit-Tests und 61
E2E-Prüfungen grün, keine `.env`-Datei im Commit, QA freigegeben ohne offene
Fehler.

### Migrationen

Alle drei auf Produktion und Testdatenbank angewendet, genau eine Überladung
von `create_invoice_document`, Trigger aktiv:

| Version | Name |
|---|---|
| 20260906093831 | proj46_storno_und_gutschrift |
| 20260906093853 | proj46_storno_funktionen |
| 20260906100411 | proj46_belege_loeschen_fuer_dienstschluessel |

Beim Ausliefern fiel auf, dass die dritte Datei unter einer erfundenen Version
(`20260906120000`) im Repo lag, während sie als `20260906100411` angewendet
worden war. Datei umbenannt; der MD5 stimmt weiterhin byte-genau mit den
ausgeführten Anweisungen überein.

### Nachprüfung in Produktion

- `/`, `/kurse`, `/login`, `/en` laden mit 200.
- `/admin/rechnungen` und `/profil` leiten unangemeldet korrekt zur Anmeldung.
- Ausführungsrechte auf `create_invoice_document`: `authenticated`, `postgres`,
  `service_role` — `anon` und `PUBLIC` sind nicht dabei.
- Die Auslieferung hat keine Daten erzeugt: 0 Belege, 0 Storno-Guthaben.

**Einschränkung:** In der Produktion stehen **null Rechnungen**. Die Funktion
ist dort strukturell nachgewiesen — Schema, Rechte, Trigger, ausgelieferter
Stand —, aber noch nicht an echten Daten benutzt worden. Das geht erst, wenn
der erste Lastschriftlauf Rechnungen erzeugt hat.
