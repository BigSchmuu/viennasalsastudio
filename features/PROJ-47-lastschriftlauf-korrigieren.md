# PROJ-47: Lastschriftlauf vor dem Bankupload korrigieren

## Status: Planned

**Priorität:** P0 — bewegt echtes Geld, muss vor dem Start stehen
**Erstellt:** 2026-09-06

## Dependencies

- Setzt voraus: PROJ-7 (SEPA-Lastschrift und Mandate) — Läufe, Positionen, Bankdatei
- Setzt voraus: PROJ-44 (Guthaben) — die Verrechnung hängt an der Position
- Setzt voraus: PROJ-10 (Rechnungsarchiv) — Rechnungen entstehen aus dem Lauf
- Berührt: PROJ-46 (Storno) — was nach der Freigabe schiefgeht, wird storniert;
  was davor auffällt, wird hier korrigiert
- Berührt: PROJ-16 (Benachrichtigungen) — die Vorabankündigung wandert

## Problemstellung

Ein Lastschriftlauf ist heute in dem Moment fertig, in dem er entsteht. Beim
Anlegen passiert alles auf einmal: Positionen werden erzeugt, Empfehlungsprämien
vergeben, Guthaben verrechnet, **Rechnungen ausgestellt** und **die
Vorabankündigung an alle Kunden verschickt**. Der Download der Bankdatei ist
danach nur noch ein Ausdruck.

Der Betreiber sieht die Liste also erst, wenn sie bereits verbindlich ist. Steht
dort ein falscher Betrag — ein Abo-Preis, der nicht nachgeführt wurde, ein Kunde,
der gekündigt hat, ein Vertipper —, gibt es keinen Weg zurück außer: den Fehler
abbuchen lassen und hinterher stornieren. Das kostet Rücklastschriftgebühr,
Vertrauen und einen Beleg, der nie hätte entstehen dürfen.

Es fehlt der Zustand dazwischen: eine Liste, die man ansehen und korrigieren
kann, **bevor** irgendjemand etwas davon erfährt.

Erschwerend kommt hinzu, dass die Datenbank diesen Zustand gar nicht kennt.
`sepa_collection_runs` trägt nur Fälligkeitsdatum, Ersteller und Anlagezeitpunkt
— keine Angabe, ob die Bankdatei schon erzeugt wurde. Die Anwendung kann heute
nicht beantworten, ob ein Lauf noch änderbar ist.

## User Stories

- **Als Betreiber** möchte ich die Positionen eines Laufs prüfen, bevor
  Rechnungen entstehen und Kunden benachrichtigt werden, damit ein Fehler nichts
  kostet außer der Korrektur.
- **Als Betreiber** möchte ich den Betrag einer einzelnen Position ändern
  können, weil ein nicht nachgeführter Abo-Preis der wahrscheinlichste Fehler
  ist und die Ursache im Abo zu suchen mich den Lauf kostet.
- **Als Betreiber** möchte ich eine Position entfernen können, wenn ein Kunde
  gekündigt hat, bar zahlt oder pausiert — ohne den ganzen Lauf zu verwerfen.
- **Als Betreiber** möchte ich einen übersehenen Kunden nachtragen können, wenn
  sein Mandat erst nach dem Anlegen des Laufs eingegangen ist.
- **Als Betreiber** möchte ich einen Entwurf im Ganzen verwerfen können, wenn
  die Stammdaten grundsätzlich falsch waren.
- **Als Betreiber** möchte ich einen ausdrücklichen, benannten Moment, in dem
  der Lauf verbindlich wird, damit mir das nicht versehentlich mit einem Klick
  auf „Herunterladen" passiert.
- **Als Kunde** möchte ich genau eine Vorabankündigung bekommen, die den Betrag
  nennt, der auch abgebucht wird.

## Umfang

### Der Lauf bekommt zwei Zustände

**Entwurf** — beim Anlegen. Es entstehen Positionen und die Guthabenverrechnung,
sonst nichts. Keine Rechnungen, keine Nachricht an Kunden, keine Bankdatei.

**Freigegeben** — nach einem eigenen Schritt mit Bestätigung. In diesem Moment
entstehen die Rechnungen und gehen die Vorabankündigungen in die Warteschlange.
Danach ist der Lauf gesperrt: Positionen lassen sich nicht mehr ändern,
entfernen oder ergänzen. Die Bankdatei ist ab hier — und erst ab hier —
herunterladbar, beliebig oft.

### Im Entwurf möglich

| Aktion | Was dabei mit dem Guthaben passiert |
|---|---|
| Betrag einer Position ändern | Verrechnetes Guthaben wird zurückgegeben und gegen den neuen Betrag neu verrechnet |
| Position entfernen | Verrechnetes Guthaben geht vollständig an den Kunden zurück |
| Position hinzufügen | Guthaben wird wie beim Anlegen verrechnet |
| Entwurf verwerfen | Alle Positionen entfernt, alles verrechnete Guthaben zurück |

### Position hinzufügen

Die Auswahl zeigt, was dieser Lauf übersehen hat: aktive Abos und
SEPA-Tickets mit gültigem Mandat, die in diesem Lauf noch keine Position haben.
Der Betrag ist mit dem Abo-Preis vorbelegt und überschreibbar. Der Bezug zum Abo
beziehungsweise Ticket bleibt erhalten — daran hängen der Rechnungstext, die
Guthabenverrechnung und der Schutz davor, ein Ticket zweimal einzuziehen.

Kunden ohne gültiges Mandat erscheinen nicht als wählbar. Das ist keine
Entwurfsentscheidung, sondern eine Folge des Schemas: `sepa_collection_items`
verlangt IBAN, Kontoinhaber und Mandatsreferenz.

## Out of Scope

- **Änderungen nach der Freigabe.** Dafür gibt es PROJ-46: stornieren und neu
  ausstellen. Dieses Feature endet an der Freigabe.
- **Freie Positionen ohne Abo- oder Ticketbezug** (Nachzahlungen, Sonderposten).
  Gehört zu den manuellen Belegen — eigenes Vorhaben.
- **Korrektur der Ursache.** Wer hier einen Betrag ändert, korrigiert diesen
  Lauf, nicht den Abo-Preis. Beides zu verbinden wäre bequem, würde aber eine
  einmalige Korrektur stillschweigend dauerhaft machen.
- **Mehrere Entwürfe zusammenführen.**
- **Teil-Freigabe** einzelner Positionen. Ein Lauf wird ganz freigegeben oder
  gar nicht.
- **Bestehende Läufe umziehen.** In der Produktion gibt es null Läufe; es ist
  nichts zu migrieren.

## Acceptance Criteria

### Entwurfszustand

- [ ] Angenommen der Betreiber legt einen Lauf an, wenn dieser erzeugt ist, dann ist er als Entwurf gekennzeichnet und es existieren weder Rechnungen noch verschickte Ankündigungen dazu
- [ ] Angenommen ein Lauf ist ein Entwurf, wenn der Betreiber ihn öffnet, dann sieht er die Positionen mit Kunde, Bezug, Betrag und die Aktionen zum Ändern, Entfernen und Hinzufügen
- [ ] Angenommen ein Lauf ist ein Entwurf, wenn der Betreiber ihn öffnet, dann wird keine Bankdatei zum Herunterladen angeboten
- [ ] Angenommen ein Lauf ist ein Entwurf, wenn der Betreiber ihn öffnet, dann wird die Rücklastschrift-Markierung nicht angeboten — es wurde noch nichts eingezogen

### Betrag ändern

- [ ] Angenommen der Betreiber ändert den Betrag einer Entwurfsposition, wenn er speichert, dann steht der neue Betrag in der Liste und in der Summe des Laufs
- [ ] Angenommen für eine Position wurde Guthaben verrechnet, wenn der Betreiber ihren Betrag ändert, dann wird das Guthaben zurückgegeben und gegen den neuen Betrag neu verrechnet
- [ ] Angenommen der Betreiber gibt einen Betrag von 0 oder weniger ein, wenn er speichert, dann wird die Eingabe abgewiesen
- [ ] Angenommen der Betreiber gibt einen unrealistisch hohen Betrag ein, wenn er speichert, dann wird er abgewiesen — ein Vertipper wie 4500 statt 45,00 darf keine Abbuchung werden
- [ ] Angenommen ein Lauf ist freigegeben, wenn der Betreiber einen Betrag ändern will, dann wird die Aktion nicht angeboten und ein direkter Aufruf abgewiesen

### Position entfernen

- [ ] Angenommen der Betreiber entfernt eine Entwurfsposition, wenn er bestätigt, dann verschwindet sie aus der Liste und aus der Summe
- [ ] Angenommen für die entfernte Position wurde Guthaben verrechnet, wenn sie entfernt ist, dann steht das Guthaben dem Kunden wieder vollständig zur Verfügung
- [ ] Angenommen der Betreiber entfernt die Ticketposition eines Kunden, wenn er anschließend eine Position hinzufügt, dann ist dieses Ticket wieder auswählbar
- [ ] Angenommen der Betreiber entfernt die letzte Position, wenn der Entwurf leer ist, dann lässt er sich nicht freigeben und die Seite sagt warum

### Position hinzufügen

- [ ] Angenommen der Betreiber öffnet die Auswahl, wenn sie erscheint, dann enthält sie nur aktive Abos und SEPA-Tickets mit gültigem Mandat, die in diesem Lauf noch keine Position haben
- [ ] Angenommen der Betreiber wählt ein Abo aus, wenn die Auswahl erscheint, dann ist der Betrag mit dem Abo-Preis vorbelegt und überschreibbar
- [ ] Angenommen ein Kunde hat kein gültiges Mandat, wenn der Betreiber die Auswahl öffnet, dann erscheint er nicht als wählbar
- [ ] Angenommen der Betreiber fügt eine Position hinzu, wenn sie angelegt ist, dann wird vorhandenes Guthaben des Kunden dagegen verrechnet

### Entwurf verwerfen

- [ ] Angenommen der Betreiber verwirft einen Entwurf, wenn er bestätigt, dann sind Lauf und Positionen entfernt und alles verrechnete Guthaben steht den Kunden wieder zur Verfügung
- [ ] Angenommen ein Lauf ist freigegeben, wenn der Betreiber ihn verwerfen will, dann wird die Aktion nicht angeboten und ein direkter Aufruf abgewiesen

### Freigabe

- [ ] Angenommen der Betreiber gibt einen Entwurf frei, wenn er den Knopf drückt, dann erscheint ein Bestätigungsdialog, der Anzahl der Positionen und Gesamtsumme nennt
- [ ] Angenommen der Betreiber bestätigt die Freigabe, wenn der Vorgang abgeschlossen ist, dann existieren die Rechnungen, die Ankündigungen stehen in der Warteschlange und der Lauf ist gesperrt
- [ ] Angenommen ein Lauf ist freigegeben, wenn der Betreiber ihn öffnet, dann kann er die Bankdatei herunterladen, und zwar beliebig oft
- [ ] Angenommen ein Lauf ist freigegeben, wenn der Betreiber ihn erneut freigeben will, dann wird die Aktion nicht angeboten und ein direkter Aufruf abgewiesen
- [ ] Angenommen die Vorabankündigung nennt einen Betrag, wenn der Kunde sie erhält, dann ist es der Betrag nach Guthabenverrechnung und nach allen Korrekturen

### Rechte

- [ ] Angenommen ein Kunde ruft eine der Korrekturfunktionen direkt über die Schnittstelle auf, wenn er kein Admin ist, dann wird der Aufruf abgewiesen
- [ ] Angenommen eine Lehrkraft ruft sie auf, wenn sie kein Admin ist, dann wird der Aufruf ebenfalls abgewiesen

## Edge Cases

- **Guthaben deckt den ganzen Beitrag.** Die Position bleibt über 0 € stehen.
  Sie gehört in die Rechnung — dort erklärt sie, warum nichts abgebucht wurde —
  aber nicht in die Bankdatei. Die Freigabe muss trotzdem möglich sein; nur der
  Download meldet, wenn nichts einzuziehen ist.
- **Betrag wird unter das bereits verrechnete Guthaben gesenkt.** Position 65 €
  mit 20 € Guthaben, korrigiert auf 15 €. Ohne Rückgabe und Neuverrechnung
  entstünde ein negativer Betrag. Deshalb wird immer erst zurückgegeben, dann
  neu verrechnet.
- **Zwei Entwürfe für dasselbe Fälligkeitsdatum.** Der heutige Hinweis auf
  einen bestehenden Lauf bleibt. Ein Entwurf darf neben einem freigegebenen
  Lauf desselben Datums stehen — das ist der Korrekturlauf.
- **Freigabe scheitert mitten im Vorgang** (Rechnungen erzeugt,
  Ankündigungen nicht). Der Lauf darf dann nicht halb freigegeben zurückbleiben:
  entweder ist er freigegeben oder er ist es nicht.
- **Zwei Betreiber geben denselben Entwurf gleichzeitig frei.** Es dürfen nicht
  zwei Rechnungssätze entstehen.
- **Kunde widerruft sein Mandat, während der Entwurf steht.** Beim Freigeben
  muss auffallen, dass für eine Position kein gültiges Mandat mehr existiert.
- **Abo wird gekündigt, während der Entwurf steht.** Der Betreiber entfernt die
  Position von Hand — automatisch nachzuführen wäre eine stille Änderung an
  einer Liste, die er gerade prüft.

## Technical Requirements

- Der Zustand gehört an den Lauf, nicht an eine abgeleitete Bedingung: eine
  Angabe, wann freigegeben wurde und von wem.
- Die Sperre muss in der Datenbank sitzen, nicht nur in der Oberfläche — wie bei
  PROJ-46. Eine ausgeblendete Schaltfläche ist keine Sperre.
- Freigabe als ein Vorgang: Rechnungen, Ankündigungen und Sperre gemeinsam oder
  gar nicht.
- Die Rückgabe von verrechnetem Guthaben braucht einen eigenen, benannten Weg —
  heute gibt es nur `redeem_customer_credit` in eine Richtung.
- Obergrenze für den Betrag einer Position, analog zur Rücklastschriftgebühr
  in PROJ-37 (dort 1000 €).

## Open Questions

- [ ] Soll die Übersicht der Läufe Entwürfe hervorheben, damit ein vergessener
      Entwurf auffällt? Ein Lauf, der nie freigegeben wird, bucht nichts ab —
      und niemand merkt es.
- [ ] Was passiert mit einem Entwurf, dessen Fälligkeitsdatum verstrichen ist?
      Warnen, sperren, oder ignorieren?
- [ ] Braucht die Freigabe eine Trockenübung — eine Vorschau der Bankdatei,
      bevor sie verbindlich wird?

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Rechnungen und Ankündigungen wandern vom Anlegen zur Freigabe | Nur so entsteht ein Fenster, in dem eine Korrektur folgenlos ist. Bliebe es beim heutigen Ablauf, hieße „korrigieren" immer: stornieren und neu ausstellen — der Kunde sähe für einen Tippfehler drei Belege und zwei Mails. | 2026-09-06 |
| Eigener Freigabe-Schritt statt Freigabe durch den Download | Der unumkehrbare Moment bekommt einen eigenen Namen und passiert genau einmal. Der Download bleibt harmlos wiederholbar — die Datei kann verlorengehen, der Vorgang darf sich davon nicht ändern. | 2026-09-06 |
| Keine Bankdatei im Entwurf | Eine herunterladbare Datei, die noch nicht verbindlich ist, könnte bei der Bank landen, während die Anwendung den Lauf für einen Entwurf hält. Dann wäre Geld bewegt und der Lauf gälte als änderbar. | 2026-09-06 |
| Hinzufügen nur aus offenen Abos und Tickets, nicht frei | Der Bezug trägt Rechnungstext, Guthabenverrechnung und den Schutz vor doppeltem Ticketeinzug. Ein freier Betrag verlöre alle drei. Freie Positionen gehören zu den manuellen Belegen. | 2026-09-06 |
| Betrag ist überschreibbar, auch bei Auswahl aus der Liste | Genau der Fall, der dieses Feature auslöst: der Abo-Preis stimmt nicht. Ein fest übernommener Preis würde den Fehler wiederholen. | 2026-09-06 |
| Eine Korrektur ändert den Lauf, nicht das Abo | Beides zu verbinden wäre bequem, würde aber eine einmalige Korrektur stillschweigend dauerhaft machen. | 2026-09-06 |
| Kein Ändern nach der Freigabe | Dafür gibt es PROJ-46. Zwei Wege zum selben Ziel wären zwei Wege, die auseinanderlaufen. | 2026-09-06 |

### Technical Decisions

_Wird von `/architecture` ergänzt._

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
