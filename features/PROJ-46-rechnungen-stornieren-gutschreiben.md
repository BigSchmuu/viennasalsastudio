# PROJ-46: Rechnungen stornieren und gutschreiben

## Status: Planned
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
- [ ] Braucht der Beleg einen eigenen Ausdruck, oder reicht die vorhandene
      Rechnungsdetailseite mit anderer Überschrift?
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
_To be added by /architecture_

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
