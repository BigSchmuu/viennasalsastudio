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
_To be added by /architecture_

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
