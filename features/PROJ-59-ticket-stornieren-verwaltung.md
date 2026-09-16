# PROJ-59: Ticket stornieren durch die Verwaltung

## Status: Planned
**Created:** 2026-09-16
**Last Updated:** 2026-09-16

## Dependencies
- Requires: PROJ-14 (Events & Tickets) — Tickets, Gästeliste, Check-in
- Requires: PROJ-7 (SEPA-Lastschrift) — ob ein Ticket bereits eingezogen wurde
- Requires: PROJ-44 (Guthaben) — die Gutschrift, wenn schon eingezogen wurde
- Requires: PROJ-16 (Benachrichtigungen) — die Nachricht an den Kunden
  *Hinweis für /architecture: `notification_queue.event_type` hat eine CHECK-Liste. Eine neue
  Benachrichtigungsart ohne Migration wird lautlos verworfen.*

## Anlass
Aus dem Betrieb am 2026-09-16: Ruft ein Kunde an und sagt „ich kann doch nicht kommen", gibt es für
den Betreiber **keinen Weg**, das Ticket zu stornieren. Die Storno-Funktion der Datenbank prüft
ausdrücklich, ob das Ticket dem Aufrufer selbst gehört, und bricht sonst mit „not your ticket" ab —
eine bewusste Sicherheitsentscheidung aus PROJ-14, die aber auch die Verwaltung aussperrt.

Heute bleibt nur: Der Kunde macht es selbst im Profil (und nur innerhalb der Stornofrist), oder das
ganze Event wird abgesagt. Ist die Frist abgelaufen oder kommt der Kunde mit der App nicht zurecht,
gibt es gar nichts.

## User Stories
- Als Betreiber möchte ich ein einzelnes Ticket stornieren können, damit ich einem Kunden helfen kann, der anruft, statt ihn auf eine Frist zu verweisen, die schon abgelaufen ist.
- Als Betreiber möchte ich beim Stornieren sehen, ob der Betrag bereits abgebucht wurde, damit ich nicht aus Versehen Geld einbehalte, das ich zurückgeben wollte.
- Als Betreiber möchte ich den freigewordenen Platz sofort wieder vergeben können, ohne irgendwo nachzuhelfen.
- Als Kunde möchte ich erfahren, dass mein Ticket storniert wurde und was mit meinem Geld passiert, damit ich nicht am Eingang stehe oder vergeblich auf eine Rückzahlung warte.
- Als Betreiber möchte ich später nachvollziehen können, wer ein Ticket wann und warum storniert hat.

## Out of Scope
- **Stornieren durch Lehrkräfte** — sie sehen die Gästeliste am Einlass, sollen aber kein Geld bewegen
- **Rücklastschrift erzeugen** — es wird nichts zurücküberwiesen; Ausgleich läuft über Guthaben oder außerhalb der App
- **Eine Zeile aus einem bereits erzeugten Lastschriftlauf entfernen** — das kann PROJ-47 bereits
- **Stapelweises Stornieren mehrerer Tickets** — der Anlass ist der Einzelfall
- **Ein Ticket auf ein anderes Event umbuchen** — eigenes Thema, deutlich größer
- **Von Hand eingetragene Gäste** — die lassen sich bereits entfernen (PROJ-56)
- **Buchhaltungs-Export um Stornierungen erweitern** — siehe Open Questions
- **Stornieren durch den Kunden nach Fristablauf** — die Frist bleibt für Kunden unverändert

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Stornieren
- [ ] Angenommen ein Admin öffnet die Gästeliste eines Events, wenn ein Ticket nicht storniert ist, dann steht bei dieser Zeile „Stornieren" bereit
- [ ] Angenommen ein Admin wählt „Stornieren", wenn der Dialog erscheint, dann nennt er Name, Ticketart, Preis und Zahlungsart, damit klar ist, welches Ticket gemeint ist
- [ ] Angenommen ein Admin bestätigt, wenn die Stornierung durchläuft, dann steht das Ticket auf „storniert" und bleibt mit diesem Status in der Gästeliste sichtbar
- [ ] Angenommen ein Ticket wurde storniert, wenn jemand die Eventseite aufruft, dann ist der Platz wieder frei
- [ ] Angenommen ein Ticket ist bereits storniert, wenn ein Admin die Gästeliste ansieht, dann gibt es dort nichts mehr zu stornieren
- [ ] Angenommen ein Admin bricht den Dialog ab, wenn er ihn schließt, dann ist nichts geschehen

### Geld
- [ ] Angenommen ein Ticket mit Lastschrift wurde noch nicht eingezogen, wenn der Dialog erscheint, dann steht dort, dass nichts abgebucht wurde und nichts zurückzugeben ist
- [ ] Angenommen ein Ticket mit Lastschrift wurde bereits eingezogen, wenn der Dialog erscheint, dann steht das dort, und „Betrag als Guthaben gutschreiben" ist vorausgewählt
- [ ] Angenommen „Guthaben gutschreiben" ist angehakt, wenn die Stornierung durchläuft, dann erscheint der Betrag im Guthaben des Kunden mit nachvollziehbarem Grund
- [ ] Angenommen ein Admin nimmt das Häkchen heraus, wenn er bestätigt, dann wird kein Guthaben erzeugt
- [ ] Angenommen ein Ticket wird vor Ort bezahlt, wenn der Dialog erscheint, dann ist von Guthaben keine Rede — es floss nie Geld durch die App
- [ ] Angenommen ein Ticket wurde storniert, wenn der nächste Lastschriftlauf erzeugt wird, dann taucht es dort nicht auf

### Warnungen
- [ ] Angenommen die Person wurde bereits eingecheckt, wenn der Dialog erscheint, dann weist er deutlich darauf hin, verhindert die Stornierung aber nicht
- [ ] Angenommen das Event ist vorbei, wenn der Dialog erscheint, dann weist er deutlich darauf hin, verhindert die Stornierung aber nicht

### Der Kunde erfährt es
- [ ] Angenommen ein Ticket wird storniert, wenn der Vorgang abgeschlossen ist, dann bekommt der Kunde eine Nachricht mit Eventname und Termin
- [ ] Angenommen ein Grund wurde eingetragen, wenn die Nachricht ankommt, dann steht er darin
- [ ] Angenommen kein Grund wurde eingetragen, wenn die Nachricht ankommt, dann steht dort ein neutraler Satz statt einer Lücke
- [ ] Angenommen ein Guthaben wurde gutgeschrieben, wenn die Nachricht ankommt, dann nennt sie den Betrag

### Rechte
- [ ] Angenommen eine Lehrkraft öffnet den Einlass, wenn sie die Gästeliste sieht, dann kann sie nichts stornieren
- [ ] Angenommen jemand ohne Verwaltungsrechte ruft die Stornierung unter Umgehung der Oberfläche auf, dann weist die Datenbank ihn ab

### Nachvollziehbarkeit
- [ ] Angenommen ein Ticket wurde storniert, wenn ein Admin es später ansieht, dann steht dort, wann, durch wen und mit welchem Grund

## Edge Cases
- **Der Kunde storniert im selben Moment selbst:** Das Ticket ist dann schon storniert. Der zweite Versuch darf nicht scheitern, sondern soll sagen, dass nichts mehr zu tun ist.
- **Zwei Admins stornieren gleichzeitig:** Genau ein Guthaben, nicht zwei. Die Stornierung muss unteilbar sein.
- **Das Ticket steht in einem Lastschriftlauf, der noch nicht bei der Bank war:** Dann ist das Geld noch nicht weg. Der Dialog darf nicht behaupten, es sei eingezogen — und PROJ-47 kann die Zeile aus dem Lauf nehmen.
- **Der Kunde hat kein gültiges Mandat mehr:** Das Guthaben lässt sich trotzdem gutschreiben; es wird bei der nächsten Buchung verrechnet.
- **Ein Event mit mehreren Einheiten (Pass):** Storniert wird das ganze Ticket, nicht einzelne Einheiten. Alle belegten Plätze werden frei.
- **Preis 0 (Freikarte):** Kein Guthaben, keine Geldfrage — der Dialog schweigt dazu.
- **Das Event wurde bereits abgesagt:** Stornieren bleibt möglich, etwa um sauber abzurechnen.

## Technical Requirements
- Sicherheit: Die Stornierung muss auch in der Datenbank auf Verwaltungskonten beschränkt sein, nicht nur in der Oberfläche
- Sicherheit: Stornierung und Gutschrift gehören zusammen — keine Stornierung ohne Gutschrift, wenn sie angehakt war
- Sprache: Deutsch (Verwaltung), die Nachricht an den Kunden in seiner Sprache
- Die Gästeliste soll auch bei einem gut besuchten Event flüssig bleiben

## Open Questions
- [ ] Soll eine Gutschrift im Buchhaltungs-Export (PROJ-36) auftauchen? Vorschlag: vorerst nicht, das ist ein eigener Schnitt
- [ ] Soll es eine Übersicht aller Stornierungen geben, oder genügt der Vermerk am Ticket? Vorschlag: genügt

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Hinweis plus vorausgewähltes Häkchen statt automatischer Gutschrift | Eine vergessene Rückerstattung ist der teurere Fehler als eine Gutschrift zu viel — aber Geld soll sich nicht ohne sichtbare Entscheidung bewegen | 2026-09-16 |
| Ausgleich über Guthaben statt Rücküberweisung | Das Guthaben gibt es bereits und wird bei der nächsten Buchung verrechnet. Eine Rücklastschrift wäre ein eigener Zahlungsweg mit eigener Fehlerquelle | 2026-09-16 |
| Immer benachrichtigen, Grund optional | Niemand soll von einer Stornierung überrascht werden. Ein Pflichtfeld wäre lästig, wenn man eben telefoniert hat oder eine Probebuchung aufräumt | 2026-09-16 |
| Auch eingecheckte Tickets und vergangene Events stornierbar, mit Warnung | Kulanz nach dem Event ist ein echter Fall, und am Einlass vertippt sich jemand. Eine Sperre schüfe genau die Sackgasse, die dieses Projekt beseitigen soll | 2026-09-16 |
| Nur Admins, keine Lehrkräfte | Lehrkräfte sehen die Gästeliste am Einlass, sollen aber kein Geld bewegen | 2026-09-16 |
| Stornierte Tickets bleiben in der Gästeliste sichtbar | Sie verschwinden zu lassen sähe aus, als hätte es sie nie gegeben — und beim Nachrechnen fehlte die Spur | 2026-09-16 |
| Wann, durch wen und warum wird am Ticket festgehalten | Ohne das ließe sich später nicht klären, warum ein Platz frei wurde. Wird außerdem für die Nachricht an den Kunden gebraucht | 2026-09-16 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| „Bereits abgebucht" heißt: in einem **freigegebenen** Lastschriftlauf | PROJ-47 hat den Zustand „freigegeben" eingeführt — erst dann ist die Datei bei der Bank. Nur auf „steht in einem Lauf" zu schauen, würde Geld als weg melden, das noch im Haus ist, und dem Betreiber eine Gutschrift aufdrängen, die er gar nicht braucht | 2026-09-16 |
| Guthaben über die bestehende Herkunft „Storno" | Die gibt es seit PROJ-46 samt der Regel, dass ein Grund dabeistehen muss. Keine neue Tabelle, kein neuer Wert, keine Migration — und Stornogutschriften stehen an einer Stelle beisammen, gleich ob sie von einer Rechnung oder einem Ticket kommen | 2026-09-16 |
| Eigene Datenbankfunktion statt Erweiterung der Kunden-Stornierung | Die Regeln sind verschieden: Der Kunde darf nur sein eigenes Ticket und nur innerhalb der Frist, die Verwaltung jedes Ticket ohne Frist. Beides in eine Funktion zu pressen hieße, den empfindlichsten Weg der App mit Verzweigungen zu versehen | 2026-09-16 |
| Stornierung und Gutschrift in **einem** Schritt der Datenbank | Sonst könnte ein abgebrochener Vorgang ein storniertes Ticket ohne Gutschrift hinterlassen — der Kunde hätte weder Platz noch Geld | 2026-09-16 |
| Die Rechteprüfung steht in der Datenbank, nicht nur in der Oberfläche | Sie erbt damit automatisch die Zwei-Faktor-Pflicht aus PROJ-58: Ohne bestätigten Code gilt niemand als Admin, auch nicht an der Oberfläche vorbei | 2026-09-16 |
| Keine neuen Pakete | Alles Nötige ist vorhanden | 2026-09-16 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Die Grundidee

Der Weg besteht schon fast vollständig. Die Gästeliste zeigt bereits jedes Ticket mit Status, Preis
und Zahlungsart. Das Guthaben kennt seit PROJ-46 die Herkunft „Storno". Was fehlt, ist ein Knopf,
ein Dialog und **eine** Handlung in der Datenbank, die beides zusammen erledigt.

### Die heikelste Frage: Ist das Geld schon weg?

Davon hängt ab, ob dem Betreiber eine Gutschrift vorgeschlagen wird — und eine falsche Antwort
kostet bares Geld. Ein Ticket gilt als abgebucht, wenn es in einem Lastschriftlauf steht, **der
freigegeben wurde**. Den Zustand „freigegeben" hat PROJ-47 eingeführt; erst dann ist die Datei bei
der Bank.

Daraus ergeben sich drei Lagen, und der Dialog sagt jede ausdrücklich:

| Lage | Was der Dialog sagt |
|---|---|
| Vor Ort zu zahlen | Es floss nie Geld durch die App — von Guthaben ist keine Rede |
| Lastschrift, noch in keinem freigegebenen Lauf | Es wurde nichts abgebucht. Das Ticket fällt aus künftigen Läufen heraus |
| Lastschrift, in einem freigegebenen Lauf | Abgebucht am … — „als Guthaben gutschreiben" ist vorausgewählt |

Der mittlere Fall umfasst auch ein Ticket, das in einem **erzeugten, aber nicht freigegebenen** Lauf
steht. Dort ist das Geld noch im Haus, und die Zeile lässt sich über PROJ-47 aus dem Lauf nehmen.
Hier „bereits abgebucht" zu melden wäre der teuerste Denkfehler des ganzen Projekts.

### Was gebaut wird

```
Verwaltung → Events → „Gästeliste" (bestehend, wird erweitert)
+-- je Ticketzeile ein „Stornieren" — nur für Admins, nur solange nicht storniert
+-- Stornierte Zeilen bleiben stehen, mit Status und dem Vermerk wer/wann/warum
+-- Storno-Dialog (neu)
    +-- Um welches Ticket geht es: Name, Ticketart, Einheit, Preis, Zahlungsart
    +-- Die Geldlage in einem Satz (siehe Tabelle oben)
    |   +-- Häkchen „Betrag als Guthaben gutschreiben" — nur im dritten Fall, vorausgewählt
    +-- Warnung, falls die Person eingecheckt war
    +-- Warnung, falls das Event vorbei ist
    +-- Feld „Grund (optional)" — geht an den Kunden
    +-- Abbrechen · Stornieren

Benachrichtigungen (Erweiterung)
+-- neue Art „Ticket storniert" mit Eventname, Termin, Grund und ggf. Guthabenbetrag
```

### Was gespeichert wird

**Am Ticket** kommen drei Angaben dazu: wann storniert, durch wen, mit welchem Grund. Ohne die ließe
sich später nicht klären, warum ein Platz frei wurde — und die Nachricht an den Kunden braucht den
Grund ohnehin.

**Im Guthaben** entsteht bei Bedarf eine Zeile mit der bestehenden Herkunft „Storno". Neue Tabelle
oder neuer Wert sind dafür nicht nötig.

**In der Liste der Benachrichtigungsarten** kommt ein Eintrag dazu. Diese Liste ist in der Datenbank
festgeschrieben; fehlt der Eintrag, verschwindet die Nachricht lautlos, ohne Fehlermeldung. Das ist
in diesem Projekt schon zweimal passiert.

**Der frei gewordene Platz** braucht nichts: Die Belegung zählt Tickets, die nicht storniert sind.

### Warum eine eigene Datenbankfunktion

Die bestehende Stornierung ist für Kunden gebaut und prüft zwei Dinge, die hier gerade nicht gelten
sollen: dass das Ticket dem Aufrufer gehört, und dass die Frist noch läuft. Beides in eine Funktion
zu pressen hieße, den empfindlichsten Weg der App mit Verzweigungen zu versehen — also lieber eine
zweite, die ihre eigenen Regeln hat: nur Verwaltungskonten, keine Frist, Gutschrift inbegriffen.

Stornierung und Gutschrift laufen darin als **ein** Schritt. Sonst könnte ein abgebrochener Vorgang
ein storniertes Ticket ohne Gutschrift hinterlassen — der Kunde hätte weder Platz noch Geld.

Die Rechteprüfung steht in dieser Funktion und nicht nur in der Oberfläche. Damit erbt sie
automatisch die Zwei-Faktor-Pflicht aus PROJ-58: Wer den Code nicht bestätigt hat, gilt für die
Datenbank nicht als Admin — auch nicht an den Seiten vorbei.

### Backend nötig?

Ja: eine Migration für die drei Angaben am Ticket und die Benachrichtigungsart, die neue
Datenbankfunktion, die Server-Handlung dahinter und die Nachricht an den Kunden.

### Zusätzliche Pakete

Keine.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
