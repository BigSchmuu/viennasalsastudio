# PROJ-47: Lastschriftlauf vor dem Bankupload korrigieren

## Status: Deployed

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

- [x] Soll die Übersicht der Läufe Entwürfe hervorheben? → Ja. Der bestehende
      Zustandsfilter bekommt „Entwurf" als dritten Wert, und das
      Zustandskennzeichen in der Liste zeigt ihn. Damit ist ein vergessener
      Entwurf mit einem Blick auffindbar, ohne dass es eine eigene Ansicht
      braucht. (2026-09-06, Architektur)
- [ ] Was passiert mit einem Entwurf, dessen Fälligkeitsdatum verstrichen ist?
      **Empfehlung:** warnen, nicht sperren. Ein verstrichenes Datum macht den
      Lauf nicht falsch — der Betreiber kann bewusst später einziehen. Sperren
      hieße, ihm die Arbeit wegzunehmen, die er gerade tut. Zu entscheiden vor
      `/frontend`.
- [ ] Braucht die Freigabe eine Vorschau der Bankdatei? **Empfehlung:** nein.
      Die Bestätigung nennt Anzahl und Summe, und die Positionsliste steht
      darüber — die Bankdatei enthält dieselben Zahlen in einer Form, die
      niemand liest. Eine herunterladbare Vorschau wäre außerdem genau die
      Datei, die versehentlich bei der Bank landen könnte, und damit gegen die
      Entscheidung „keine Bankdatei im Entwurf".

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

| Decision | Rationale | Date |
|----------|-----------|------|
| Der Zustand steht als Zeitpunkt am Lauf, nicht als Ableitung aus vorhandenen Rechnungen | Eine Ableitung waere eine zweite Wahrheit: schlaegt die Rechnungserstellung fehl, gaelte der Lauf wieder als Entwurf, obwohl die Kunden schon benachrichtigt sind. Ein eigener Zeitpunkt kann mit sich selbst nicht uneins werden. | 2026-09-06 |
| Die Sperre sitzt als Waechter in der Datenbank | Dieselbe Ueberlegung wie bei PROJ-46: fehlt nur der Knopf, ist nichts gesperrt. Der Waechter greift unabhaengig davon, welcher Weg die Aenderung ausloest. | 2026-09-06 |
| Freigabe als ein einziger Datenbankvorgang statt als Ablauf aus Schritten | Rechnungen, Ankuendigungen und Stempel gemeinsam oder gar nicht. Moeglich, weil die Benachrichtigungs-Warteschlange nur Empfaenger, Anlass und Bezug speichert -- der Text entsteht erst beim Versand. Verhindert zugleich, dass zwei gleichzeitige Freigaben zwei Rechnungssaetze erzeugen. | 2026-09-06 |
| Guthaben wird zurueckgegeben und neu verrechnet, nicht nachgerechnet | Die Differenz anzupassen geht bei kleinen Aenderungen gut und bei der einen, auf die es ankommt, schief: unter das bereits verrechnete Guthaben gesenkt, muesste die Position negativ werden. | 2026-09-06 |
| Die Auswahl beim Hinzufuegen folgt derselben Regel wie das Anlegen | Eine zweite, eigene Regel wuerde irgendwann von der ersten abweichen, und dann waere unklar, welche stimmt. | 2026-09-06 |
| Obergrenze fuer den Positionsbetrag, analog zur Ruecklastschriftgebuehr in PROJ-37 | Ein Vertipper ist bei einer Abbuchung teurer als bei einer Gebuehr, nicht billiger. | 2026-09-06 |
| Bestehende Laeufe gelten als freigegeben, ohne Umzug | In der Produktion gibt es null Laeufe. Aeltere Laeufe sind freigegeben -- das ist keine Annahme, sondern ihr Zustand. | 2026-09-06 |

## Tech Design (Solution Architect)

### Der tragende Gedanke

Der Lauf bekommt einen Zeitpunkt, an dem er verbindlich wird. Alles, was heute
beim Anlegen passiert und nicht rückgängig zu machen ist — Rechnungen und die
Nachricht an den Kunden — wandert an diesen Zeitpunkt. Davor ist der Lauf eine
Arbeitsliste, danach ein Dokument.

Das ist die ganze Änderung. Die Positionen, die Guthabenverrechnung, die
Bankdatei und die Rücklastschriften bleiben, wie sie sind — sie wechseln nur
die Seite der Linie.

### A) Aufbau der Oberfläche

```
Lastschriftläufe (Übersicht)
├── Neuen Lauf anlegen
├── Filter „Zustand"                    ← bekommt „Entwurf" dazu
└── Liste der Läufe
    └── je Zeile: Datum · Anzahl · Summe · Zustand
                                         ↑ Entwurf | Eingezogen | Mit Rückbuchungen

Lauf-Detailseite
├── Kopf: Fälligkeitsdatum · Zustand · Gesamtsumme
│
├── WENN ENTWURF
│   ├── Positionsliste
│   │   └── je Zeile: Kunde · Bezug · Betrag
│   │       ├── Betrag ändern            (Feld an Ort und Stelle)
│   │       └── Position entfernen       (mit Rückfrage)
│   ├── Position hinzufügen              → Auswahl offener Abos und Tickets
│   ├── Entwurf verwerfen                (mit Rückfrage)
│   └── Lauf freigeben                   → Bestätigung mit Anzahl und Summe
│
└── WENN FREIGEGEBEN
    ├── Positionsliste (nur lesen)
    │   └── je Zeile: Rücklastschrift markieren
    ├── Bankdatei herunterladen          (beliebig oft)
    └── Vermerk: freigegeben am … von …
```

Zwei bestehende Bausteine ändern sich, keiner verschwindet: die Übersichtsliste
lernt einen dritten Zustand, die Detailseite bekommt zwei Gesichter statt einem.
Neu ist nur die Auswahl zum Hinzufügen.

### B) Welche Informationen dazukommen

**Am Lauf** zwei Angaben: *wann freigegeben* und *von wem*. Sind sie leer, ist
der Lauf ein Entwurf. Mehr braucht es nicht — der Zustand ergibt sich daraus,
er wird nicht getrennt gepflegt.

**An der Position** nichts. Sie trägt bereits alles Nötige.

**Beim Guthaben** fehlt bisher der Rückweg. Es gibt einen Vorgang, der Guthaben
gegen eine Position verrechnet, aber keinen, der das rückgängig macht. Den
braucht jede der vier Korrekturen.

### C) Technische Entscheidungen und warum

**Der Zustand steht am Lauf, nicht in einer Ableitung.**
Man könnte „freigegeben" auch daran erkennen, dass es Rechnungen zu diesem Lauf
gibt. Das wäre eine zweite Wahrheit: schlägt die Rechnungserstellung fehl, gilt
der Lauf plötzlich wieder als Entwurf, obwohl die Kunden schon benachrichtigt
sind. Ein eigener Zeitpunkt kann nicht mit sich selbst uneins werden.

**Die Sperre sitzt in der Datenbank, nicht in der Oberfläche.**
Dieselbe Überlegung wie bei PROJ-46: Wenn nur der Knopf fehlt, ist nichts
gesperrt. Ein Wächter auf den Positionen weist jede Änderung ab, sobald der
zugehörige Lauf freigegeben ist — unabhängig davon, welcher Weg sie auslöst.

**Die Freigabe ist ein einziger Vorgang, kein Ablauf aus Schritten.**
Rechnungen erzeugen, Ankündigungen einreihen und den Lauf stempeln passiert
gemeinsam oder gar nicht. Das geht, weil die Warteschlange für
Benachrichtigungen nur Empfänger, Anlass und Bezug speichert — der Text
entsteht erst beim Versand. Ein halb freigegebener Lauf, bei dem Rechnungen
existieren und Kunden nichts wissen, kann so nicht entstehen.

Derselbe Vorgang prüft zuerst, ob der Lauf noch ein Entwurf ist. Zwei Betreiber,
die gleichzeitig freigeben, erzeugen daher keine zwei Rechnungssätze.

**Guthaben wird immer zurückgegeben und neu verrechnet, nie nachgerechnet.**
Die naheliegende Abkürzung wäre, bei einer Betragsänderung nur die Differenz
anzupassen. Das geht bei kleinen Änderungen gut und bei der einen, auf die es
ankommt, schief: Wird ein Betrag unter das bereits verrechnete Guthaben
gesenkt, müsste die Position negativ werden. Zurückgeben und neu verrechnen
kennt diesen Fall nicht.

**Die Auswahl beim Hinzufügen folgt derselben Regel wie das Anlegen.**
Wer beim Anlegen erfasst wird — aktives Abo oder SEPA-Ticket, gültiges Mandat,
nicht schon eingezogen —, ist genau der Kreis, aus dem nachgetragen wird,
abzüglich derer, die im Lauf schon stehen. Eine zweite, eigene Regel würde
irgendwann von der ersten abweichen, und dann wäre unklar, welche stimmt.

**Der Betrag bekommt eine Obergrenze.**
Wie die Rücklastschriftgebühr in PROJ-37. Ein Vertipper ist bei einer
Abbuchung teurer als bei einer Gebühr, nicht billiger.

**Bestehende Läufe brauchen keine Behandlung.**
In der Produktion gibt es null Läufe. Ältere Läufe gelten schlicht als
freigegeben — was sie sind.

### D) Neue Pakete

Keine. Nummernvergabe, Rechnungserstellung, Guthabenkonto, Benachrichtigungen,
Bankdatei und Rechteprüfung sind vorhanden. Das Bestätigungsfenster gibt es als
Baustein bereits (es warnt heute vor doppelten Läufen).

### E) Aufwandseinschätzung

| Teil | Größe |
|---|---|
| Zustand am Lauf, Wächter auf den Positionen | klein |
| Guthaben-Rückgabe | klein |
| Freigabe als ein Vorgang (Umzug von Rechnungen und Ankündigungen) | mittel |
| Detailseite mit zwei Gesichtern | mittel |
| Betrag ändern, Position entfernen, Entwurf verwerfen | mittel |
| Position hinzufügen samt Auswahl | mittel |
| Übersicht: dritter Zustand | klein |

Der größte Einzelposten ist nicht das Bauen, sondern das Verschieben: die
Rechnungserstellung und die Ankündigung sitzen mitten in einem gewachsenen
Ablauf, der auch Empfehlungsprämien und Guthabenverrechnung erledigt. Diesen
Ablauf sauber in zwei Hälften zu teilen, ohne die Reihenfolge zu verletzen, ist
die eigentliche Arbeit.

## Implementierungsnotizen (Frontend + Backend)

### Zur Reihenfolge: die Trennung hat hier nicht getragen

Der Frontend-Schritt endete nach der prüfbaren Logik und den Dialogen an einer
Wand: Jede einzelne Bedienung dieses Bildschirms ist ein Datenbankvorgang. Ich
habe zuerst das Schema vorgezogen, damit die Detailseite überhaupt eine
Grundlage für ihre zwei Gesichter hat — und bin dann beim Schreiben der
Korrekturvorgänge gemerkt, dass ich Backend-Arbeit als Frontend ausgebe. Der
Betreiber hat entschieden, durchzuziehen statt einen unerreichbaren Bildschirm
abzuliefern.

Dasselbe war schon bei PROJ-46 aufgefallen und dort notiert worden. Bei
Vorhaben, deren Oberfläche nur eine Hülle um Datenbankvorgänge ist, sollten
`/frontend` und `/backend` von vornherein zusammen laufen.

### Migrationen

Fünf, alle auf Test- und Produktionsdatenbank angewendet und byte-genau gegen
die ausgeführten Anweisungen geprüft. Die drei Funktionen haben in beiden
Datenbanken denselben normalisierten MD5.

| Version | Name |
|---|---|
| 20260906154446 | proj47_lauf_freigabe_zustand |
| 20260906154814 | proj47_guthaben_rueckgabe |
| 20260906155952 | proj47_freigabe_und_sperre |
| 20260906160305 | proj47_position_darf_null_sein |

### Was verschoben wurde

Aus `createCollectionRun` sind die Rechnungserstellung und die
Vorabankündigung herausgenommen; beides sitzt jetzt in
`release_collection_run`. **Geblieben** sind die Empfehlungsprämien und die
Guthabenverrechnung — die Prämie gehört zu einer früheren Lastschrift, nicht zu
diesem Lauf, und ihr Guthaben muss diesen Entwurf noch mindern. Die
Benachrichtigung über eine Prämie bleibt aus demselben Grund beim Anlegen: Ob
dieser Entwurf freigegeben oder verworfen wird, ändert an der Prämie nichts.

Die Freigabe ist ein einziger Datenbankvorgang. Möglich, weil die
Benachrichtigungs-Warteschlange nur Empfänger, Anlass und Bezug speichert — der
Text entsteht erst beim Versand.

### Zwei Fehler, beide älter als dieses Vorhaben

**Der stille Guthaben-Verlust.** Deckt das Guthaben den Beitrag vollständig,
senkt die Verrechnung den Positionsbetrag auf 0. Die Bedingung `amount > 0`
wies das ab — und die Anwendung prüfte den Fehler nicht. Die Guthabenzeile war
geschrieben, der Betrag blieb voll stehen: Der Kunde verlor sein Guthaben und
wurde trotzdem voll abgebucht.

Dass 0-€-Positionen vorgesehen waren, steht im Code selbst: `generateRunXml`
filtert sie aus der Bankdatei heraus („eine Lastschrift über 0 € weist die Bank
ab") und lässt sie in der Rechnung stehen, wo sie erklären, warum nichts
abgebucht wurde. Dieser Filter konnte nie etwas tun. **PROJ-46 macht den Fall
häufig:** ein Storno über 65 € erzeugt genau das Guthaben, das die nächste
65-€-Position auf null bringt. Bedingung auf `>= 0` gelockert, Fehlerprüfung an
beiden Stellen ergänzt — schlägt die Senkung doch fehl, wird das Guthaben
zurückgegeben statt es verfallen zu lassen.

**Funktionen an eine Client-Komponente gereicht.** Die fünf Vorgänge liefen
zuerst über ein Objekt, das die Seite hereinreichte. Inline erzeugte
Pfeilfunktionen sind aber keine Server Actions; Next.js weist das zur Laufzeit
ab. Typecheck und Build waren grün — erst der E2E-Lauf hat es gezeigt. Die
Umleitung ist entfernt, der Baustein importiert die Vorgänge selbst.

### Nebenbei behoben

Die Detailseite las nur den Abo-Namen. Eine Ticketposition zeigte deshalb einen
Strich, obwohl sie einen Bezug hat.

### Geprüft

21 Prüfungen gegen die Testdatenbank, alle bestanden, Probedaten restlos
entfernt: Freigabe erzeugt genau eine Rechnung, die Ankündigung nennt den
korrigierten Betrag (45 statt 65), Betrag nach Freigabe gesperrt,
Rücklastschrift weiterhin markierbar, zweite Freigabe und leerer Lauf
abgewiesen, Kunde weder freigabe- noch rückgabeberechtigt, Betrag darf auf 0
sinken, negativ bleibt ausgeschlossen.

Dazu 18 neue Unit-Tests (388 insgesamt) und 53 E2E-Prüfungen der berührten
Suiten. PROJ-10 musste nachziehen: Der Fixture-Lauf wird jetzt freigegeben,
sonst gäbe es keine Rechnungen.

## QA Test Results

**Geprüft:** 2026-09-06
**Umgebung:** localhost:3100 gegen die Testdatenbank
**Browser:** Chromium und Mobile Safari (iPhone 13)

### Ergebnis

Zehn E2E-Prüfungen in `tests/PROJ-47-lastschriftlauf-korrigieren.spec.ts` —
**Chromium 10/10, Mobile Safari 10/10**. Dazu 62 Prüfungen der berührten
Suiten und 388 Unit-Tests.

| Bereich | Abgedeckt |
|---|---|
| Entwurf | Neuer Lauf ist Entwurf; keine Rechnung, keine Nachricht, keine Bankdatei, keine Rücklastschrift-Markierung; die drei Korrekturaktionen sind da |
| Betrag ändern | Neuer Wert steht in Liste und Datenbank; 0 und der Vertipper 4500 statt 45,00 sind nicht abschickbar |
| Position entfernen | Verschwindet aus Liste und Zählung |
| Position hinzufügen | Auswahl zeigt genau das zuvor Entfernte; Betrag vorbelegt und überschreibbar; Bezug bleibt erhalten |
| Entwurf verwerfen | Lauf und Positionen sind weg |
| Freigabe | Bestätigung nennt Anzahl und Summe; danach genau eine Rechnung je Position, ebenso viele Ankündigungen, Freigeber vermerkt, Bankdatei da, alle Korrekturen fort |
| Sperre | Betrag über die Schnittstelle nicht mehr änderbar, zweite Freigabe abgewiesen, Rücklastschrift weiterhin markierbar |
| Guthaben | Deckt es den Beitrag, sinkt der Betrag auf 0; beim Entfernen kommt es vollständig zurück |
| Rechte | Kunde und Lehrkraft werden bei Freigabe und Guthaben-Rückgabe abgewiesen, der Lauf bleibt unberührt |
| Übersicht | Entwürfe sind gekennzeichnet und filterbar; freigegebene Läufe erscheinen im Entwurfsfilter nicht |

### Gefundene Fehler

#### BUG-1: Löschen meldete Erfolg und tat nichts

- **Schwere:** Critical
- **Wo:** `entferneLaufPosition` und `verwirfLaufEntwurf`
- **Beschreibung:** Auf `sepa_collection_runs` und `sepa_collection_items` gab
  es **keine DELETE-Regel**. Beide Aktionen löschten über den RLS-gebundenen
  Client und trafen damit null Zeilen — PostgREST meldet einen Löschvorgang
  ohne Treffer nicht als Fehler. Der Betreiber sah die Bestätigung, die
  Ansicht wurde neu geladen, und die Position stand weiter da. Wer sich darauf
  verlässt, gibt den Lauf frei und bucht bei jemandem ab, den er ausschließen
  wollte.
- **Warum es durchrutschte:** Typecheck, Lint und Build waren grün. Erst der
  E2E-Lauf hat es gezeigt — fünf von zehn Prüfungen scheiterten, und alle fünf
  gingen durch eine Löschung.
- **Behoben, zweifach:**
  1. Migration `20260906171739_proj47_entwuerfe_loeschbar` — DELETE-Regeln
     ausdrücklich nur für Entwürfe. Damit gilt die Grenze zweimal: in der
     Regel und im Wächter.
  2. Beide Aktionen prüfen über `.select()`, ob wirklich Zeilen verschwunden
     sind, und melden sonst einen Fehler statt Erfolg. Das ist der wichtigere
     Teil — die Regel behebt diesen Fall, die Prüfung fängt den nächsten.
- **Nachgewiesen:** Die drei zuvor roten Löschprüfungen sind grün.

**Weitere Suche:** 15 andere Stellen im Projekt löschen ebenso über den
RLS-Client. Alle 15 Tabellen haben ihre DELETE-Regel — die Lücke bestand nur
bei den beiden SEPA-Tabellen, weil vor PROJ-47 nie etwas daraus gelöscht
wurde. Kein weiterer Fund.

### Zwei Fehler in den Prüfungen selbst

Beide wären als Produktfehler durchgegangen, wenn ich sie nicht nachgelesen
hätte:

- Die Gesamtsumme steht zweimal auf der Seite (Kopf und Bestätigungsdialog) —
  mehrdeutige Textsuche.
- **`hasText: "0,00"` trifft als Teilzeichenkette auch „€ 30,00".** Der Test
  entfernte dadurch die Position eines fremden Kunden und meldete zu Recht,
  dass kein Guthaben zurückkam. Der Fehlerbericht der Testausgabe nannte die
  tatsächlich gewählte Zeile. Die Auswahl läuft jetzt über den Kundennamen.

### Sicherheitsprüfung

- Kunde und Lehrkraft am RPC `release_collection_run` und
  `return_collection_item_credit`: abgewiesen, keine Nebenwirkung, der Lauf
  bleibt Entwurf.
- Ausführungsrechte auf beiden Funktionen: `authenticated`, `postgres`,
  `service_role` — `anon` und `PUBLIC` nicht.
- Nach der Freigabe greift der Wächter auch beim Admin, der einzigen Rolle mit
  Schreibrecht auf die Positionen.
- Die neuen DELETE-Regeln gelten ausdrücklich nur für Entwürfe.
- `/admin/lastschriften` hängt am Admin-Layout mit `requireAdmin()`.

### Regressionsprüfung

| Suite | Ergebnis |
|---|---|
| PROJ-47 | 10/10 Chromium, 10/10 Mobile Safari |
| PROJ-10 Rechnungsarchiv | 12/12 |
| PROJ-36 Buchhaltungs-Export | 14/14 |
| PROJ-37 Offene Posten | 9/9 |
| PROJ-46 Storno und Gutschrift | 12/12 |
| PROJ-44 Guthaben | 3/3 |
| PROJ-14 Events und Tickets | 12/12 |
| Unit-Tests (Vitest) | 388/388 |

PROJ-10 musste angepasst werden: Der Fixture-Lauf wird jetzt freigegeben,
sonst entstünden keine Rechnungen.

Die Testdatenbank steht danach wieder auf dem Ausgangsstand: ein Lauf, drei
Rechnungen, keine Guthabenzeilen, kein Entwurf.

### Ergebnis

- **Akzeptanzkriterien:** alle abgedeckt und grün
- **Fehler:** 1 (Critical) — gefunden und behoben
- **Sicherheit:** bestanden
- **Produktionsreif:** ja


## Deployment

**Ausgeliefert:** 2026-09-06
**Produktion:** https://viennasalsastudio.vercel.app
**Stand:** `4bfe583`
**Tag:** `v1.47.0-PROJ-47`

### Vorabprüfungen

`npm run lint` sauber, `npm run build` erfolgreich, 388 Unit-Tests und 72
E2E-Prüfungen grün, Arbeitsbaum sauber, keine `.env` in den Commits, QA
freigegeben ohne offene Fehler.

### Migrationen

Fünf, alle auf Produktion und Testdatenbank, alle byte-genau gegen die
ausgeführten Anweisungen geprüft:

| Version | Name |
|---|---|
| 20260906154446 | proj47_lauf_freigabe_zustand |
| 20260906154814 | proj47_guthaben_rueckgabe |
| 20260906155952 | proj47_freigabe_und_sperre |
| 20260906160305 | proj47_position_darf_null_sein |
| 20260906171739 | proj47_entwuerfe_loeschbar |

### Nachprüfung in Produktion

- `/`, `/kurse`, `/login`, `/en` laden mit 200; `/admin/lastschriften` und
  `/admin/rechnungen` leiten unangemeldet korrekt zur Anmeldung.
- Spalten `released_at` und `released_by` vorhanden, Wächter auf den
  Positionen aktiv, beide DELETE-Regeln gesetzt, Betragsregel steht auf
  `>= 0`.
- Ausführungsrechte auf `release_collection_run`: `authenticated`, `postgres`,
  `service_role` — `anon` und `PUBLIC` nicht.
- Null Läufe, null Entwürfe: die Auslieferung hat nichts erzeugt.

### Was sich im Betrieb ändert

**Ein Lastschriftlauf ist nach dem Anlegen nicht mehr fertig.** Bisher
entstanden Rechnungen und Vorabankündigungen sofort; der XML-Download war nur
ein Ausdruck. Ab jetzt gilt:

1. **Lauf anlegen** → Entwurf. Positionen prüfen, Beträge korrigieren,
   Positionen entfernen oder ergänzen — folgenlos, niemand erfährt davon.
2. **Lauf freigeben** → erst hier entstehen Rechnungen und gehen die
   Ankündigungen raus, und erst hier gibt es die Bankdatei.

Wer nach Schritt 1 aufhört, hat nichts abgebucht — und niemand merkt es. Der
Zustandsfilter „Entwurf" in der Übersicht ist genau dafür da.

**Noch nicht am echten Betrieb erprobt:** In der Produktion gibt es null
Läufe. Der vollständige Durchlauf lief gegen die Testdatenbank. Der erste
echte Lauf ist damit zugleich die erste Anwendung dieses Ablaufs.
