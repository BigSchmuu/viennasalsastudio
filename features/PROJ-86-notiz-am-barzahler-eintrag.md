# PROJ-86: Notiz am Barzahler-Eintrag

## Status: Approved
**Created:** 2026-10-15
**Last Updated:** 2026-10-15

## Dependencies
- Erweitert: PROJ-84 (Barzahlungen — Einträge von Hand)

## Anlass

Seit PROJ-84 setzt der Betreiber den Betrag selbst. Damit ist der **Grund** für diesen Betrag
nirgends mehr ablesbar: Warum stehen bei Maria 138 € und nicht 89 €? War das ein Rest aus September,
eine Vereinbarung, ein Nachlass? Vorher ließ sich das aus Zyklus und Preis herleiten — jetzt weiß es
nur die Person, die eingetragen hat.

Dazu der Fall am Kursabend: „zahlt den Rest am Freitag" ist eine Information, die bis dahin irgendwo
stehen muss, und heute landet sie wieder auf einem Zettel.

## User Stories

- Als Betreiber möchte ich beim Eintragen festhalten können, woraus der Betrag besteht.
- Als Lehrkraft möchte ich an einer Zeile notieren können, was verabredet ist.
- Als Lehrkraft und Betreiber möchte ich die Notiz sehen, ohne sie suchen zu müssen.
- Als Betreiber möchte ich eine Notiz ändern und löschen können.

## Out of Scope

- **Eine Notiz je Zahlung.** Die Notiz gehört zum Eintrag — zur Absicht, nicht zur einzelnen
  Geldbewegung.
- **Verlauf der Notizen.** Wer wann was geschrieben hat, wird nicht mitgeführt. Für „Rest kommt
  Freitag" wäre das Apparat ohne Nutzen.
- **Notiz als Pflichtfeld.** Der häufige Fall braucht keine.
- **Sichtbarkeit für den Kunden.** Die Notiz ist eine interne Randbemerkung. Der Kunde sieht seinen
  Eintrag (eigene Zeile lesen), und deshalb steht in der Notiz nichts, was er nicht lesen dürfte —
  aber angezeigt wird sie ihm nirgends.

## Acceptance Criteria

- [ ] Angenommen ein Eintrag steht auf der Liste, wenn jemand auf die Notizspalte klickt, dann
      erscheint ein Eingabefeld, und das Eingetragene steht nach dem Speichern in der Zeile.
- [ ] Angenommen ein Eintrag hat eine Notiz, wenn die Lehrkraft die Kursseite öffnet, dann steht sie
      in der Zeile — ohne Klick.
- [ ] Angenommen eine Notiz existiert, wenn das Feld geleert und gespeichert wird, dann ist die Notiz
      weg.
- [ ] Angenommen der Betreiber trägt einen Barzahler ein, dann kann er die Notiz **gleich dabei**
      angeben — mit demselben Vorgang, nicht in einem zweiten Schritt.
- [ ] Angenommen eine Notiz ist länger als 300 Zeichen, wenn sie gespeichert wird, dann wird sie
      abgewiesen — in der Oberfläche **und** in der Datenbank.
- [ ] Angenommen eine Lehrkraft darf an diesem Abo nichts tun, dann kann sie auch die Notiz nicht
      setzen.
- [ ] Angenommen ein Eintrag wird entfernt, dann verschwindet die Notiz mit ihm — sie gehört zum
      Eintrag.

## Edge Cases

- **Leerzeichen als Notiz.** Wird wie „leer" behandelt: Die Notiz wird auf `null` gesetzt, nicht auf
  ein unsichtbares Zeichen.
- **Zeilenumbrüche.** Erlaubt, werden aber in der Tabelle einzeilig angezeigt — eine Zelle, die
  wächst, verschiebt die ganze Liste.
- **Flatrater aus einem anderen Kurs.** Die Notiz steht auch im eingeklappten Abschnitt; wer dort
  kassieren darf, darf dort auch notieren.

## Decision Log

### Product Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Notiz am Eintrag, nicht an der Zahlung | Der Eintrag ist die Absicht („soll 138 € zahlen, Rest aus September"), die Zahlung die Tatsache. Der Grund gehört zur Absicht. | 2026-10-15 |
| 300 Zeichen, erzwungen auch in der Datenbank | Lang genug für jede Randbemerkung, kurz genug, dass die Zelle die Liste nicht sprengt. Die Grenze steht in der Datenbank, weil eine Grenze nur in der Oberfläche keine Grenze ist (siehe PROJ-13, wo genau das als offener Punkt stehen blieb). | 2026-10-15 |
| Auch beim Eintragen eingebbar | Der Anlass („Rest aus September") entsteht genau in dem Moment, in dem der Betrag gesetzt wird. In einem zweiten Schritt würde es vergessen. | 2026-10-15 |
| Eine eigene Spalte, kein Knopf in der Aktionsgruppe | Die Gruppe trägt schon drei Bedienelemente; ein viertes bricht auf dem Handy um. Die Spalte verhält sich wie die Betragsspalte: anklicken, ändern, fertig. | 2026-10-15 |

### Technical Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| `add_cash_entry` wird gelöscht und neu angelegt | Ein dritter Parameter mit Standardwert macht den zweistelligen Aufruf zweideutig („function is not unique"). Dieselbe Lehre wie bei `record_cash_payment` in PROJ-83. | 2026-10-15 |
| Eigene Funktion `set_cash_entry_note` statt eines Parameters an `update_cash_entry` | Betrag und Notiz werden getrennt geändert — an verschiedenen Stellen der Zeile. Eine gemeinsame Funktion müsste „Betrag unverändert" ausdrücken können, und das ist mehr Logik als zwei Funktionen. | 2026-10-15 |
| Leerer Text wird zu `null` | Sonst gäbe es zwei Arten von „keine Notiz", und jede Anzeige müsste beide kennen. | 2026-10-15 |

## Umsetzung und QA (2026-10-15)

### Datenbank — `20261015120000_proj86_notiz_am_eintrag.sql`

- `cash_entries.note` mit Prüfregel `<= 300` Zeichen — **in der Datenbank**, nicht nur im Formular.
- `gesaeuberte_notiz(text)`: leerer oder nur aus Leerzeichen bestehender Text wird `null`.
- `add_cash_entry(uuid, numeric, text)` gelöscht und neu angelegt (ein dritter Parameter mit
  Standardwert hätte den zweistelligen Aufruf zweideutig gemacht).
- `set_cash_entry_note(uuid, text)` neu, mit demselben Wächter `darf_barzahlung_fuehren`.
- `get_course_cash_payers` gibt `note` mit heraus.

### Anwendung

- Spalte **Notiz** in beiden Listen: anklicken, tippen, OK — dasselbe Muster wie die Betragsspalte.
  Einzeilig abgeschnitten (`truncate`), damit eine lange Notiz die Liste nicht auseinanderschiebt.
- Feld **Notiz (optional)** in beiden Eintragsformularen.

| Prüfung | Umfang | Ergebnis |
|---|---|---|
| Unit — `offen.test.ts`, `barzahler-anlegen.test.ts` | 29 | grün |
| Datenbank — `PROJ-84-barzahlungs-eintraege-db.test.ts` | 28 (6 neu) | grün |
| Browser — PROJ-84/86 und PROJ-82/85 | 15 (2 neu) | grün |

### Was belegt ist

- Die Notiz lässt sich beim Eintragen mitgeben **und** nachträglich setzen.
- Leerer Text löscht sie — und zwar zu `null`, nicht zu `""`.
- 301 Zeichen werden **von der Datenbank** abgewiesen, nicht erst vom Formular.
- Die Notiz steht ohne Klick in der Zeile und kommt über die Kursfunktion mit heraus.
- Eine fremde Lehrkraft kann sie nicht setzen; mit dem Eintrag verschwindet sie.

### Produktionsreife

**JA** — keine kritischen oder hohen Fehler offen.

## Open Questions

- [ ] Soll die Notiz beim „Zyklus abschließen" irgendwo erhalten bleiben — etwa in der Zahlung, die
      stehen bleibt? Vorerst nein: Die Notiz gehört zur Absicht, und die endet mit dem Zyklus.
