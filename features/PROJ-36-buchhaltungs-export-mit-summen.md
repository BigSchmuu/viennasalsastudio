# PROJ-36: Buchhaltungs-Export mit Summen

## Status: Deployed
**Created:** 2026-08-22
**Last Updated:** 2026-08-22

## Dependencies
- Requires: PROJ-10 (Rechnungsarchiv) — liefert die Rechnungen, den bestehenden CSV-Export und den USt-Satz aus den Rechnungseinstellungen.

## User Stories
- Als Betreiber möchte ich im CSV-Export sofort die Gesamtsumme sehen, statt jede Kundenzeile selbst zusammenrechnen zu müssen.
- Als Betreiber möchte ich die Summen nach Steuersatz getrennt sehen, damit ich sie direkt für die Umsatzsteuer-Voranmeldung verwenden kann.
- Als Betreiber möchte ich einen abgeschlossenen Monat mit einem Klick exportieren, statt jedes Mal Von-/Bis-Datum von Hand zu setzen.
- Als Betreiber möchte ich, dass mein Steuerberater eine Datei bekommt, die ohne Rückfragen verständlich ist.

## Out of Scope
- **Bar- und Vor-Ort-Zahlungen.** Der Export enthält ausschließlich Rechnungen, und Rechnungen entstehen **nur** aus SEPA-Lastschriftläufen. Drop-in-Stunden und vor Ort bezahlte Event-Tickets tauchen deshalb **nicht** auf.
  **Das ist kein Mangel, sondern gewollt:** Vor-Ort-Rechnungen erstellt der Betreiber in einem anderen System (bestätigt am 2026-08-23). Der Export ist die SEPA-Seite der Buchhaltung, nicht die Gesamtsicht. Ein "Kassenbuch"-Feature ist damit gegenstandslos.
  **Folge für die Umsetzung:** Die Datei muss unübersehbar ausweisen, dass sie nur Lastschrift-Einnahmen enthält — sonst wirkt eine Jahressumme wie der Gesamtumsatz und wird beim Zusammenführen mit dem anderen System doppelt oder falsch verrechnet.
- **Monatssperre / Festschreibung.** Ein exportierter Monat wird nicht gegen spätere Änderungen gesperrt.
- **DATEV- oder sonstiges Steuerberater-Spezialformat.** Es bleibt bei CSV.
- **Automatischer Versand an den Steuerberater** (z.B. monatliche E-Mail) — Datei wird manuell heruntergeladen.
- **Einnahmen-Ausgaben-Rechnung / Ausgabenseite.** Nur Einnahmen aus Rechnungen.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Summen im CSV
- [ ] Angenommen der Admin exportiert Rechnungen als CSV, wenn er die Datei öffnet, dann steht unter den Einzelzeilen eine Zeile "GESAMT" mit der Summe von Netto, USt-Betrag und Brutto.
- [ ] Angenommen die exportierten Rechnungen haben unterschiedliche USt-Sätze, wenn der Admin die Datei öffnet, dann gibt es zusätzlich pro USt-Satz eine Zwischensummen-Zeile (z.B. "Zwischensumme 20%") mit Netto, USt-Betrag und Brutto.
- [ ] Angenommen alle Rechnungen haben denselben USt-Satz, wenn der Admin exportiert, dann erscheint trotzdem die Zwischensummen-Zeile für diesen Satz (einheitliches Format, keine Sonderfälle für den Steuerberater).
- [ ] Angenommen der Export enthält Rücklastschriften, wenn die Summen gebildet werden, dann werden diese **separat** ausgewiesen und nicht in die reguläre Gesamtsumme eingerechnet (siehe Edge Cases).
- [ ] Angenommen der Export enthält keine einzige Rechnung, wenn der Admin exportiert, dann enthält die Datei die Kopfzeile und eine GESAMT-Zeile mit 0,00 — keine leere Datei und kein Fehler.

### Monats-Export
- [ ] Angenommen der Admin ist im Rechnungsarchiv, wenn er einen Monat aus einer Auswahl wählt (z.B. "August 2026"), dann werden Von-/Bis-Datum automatisch auf den ersten und letzten Tag dieses Monats gesetzt.
- [ ] Angenommen ein Monat ist gewählt, wenn der Admin exportiert, dann heißt die Datei erkennbar nach diesem Monat (z.B. `rechnungsjournal-2026-08.csv`) statt immer gleich.
- [ ] Angenommen der Admin nutzt weiterhin freie Von-/Bis-Datumsfelder, wenn er exportiert, dann funktioniert das unverändert wie bisher.

### Verständlichkeit für den Steuerberater
- [ ] Angenommen der Steuerberater öffnet die Datei, wenn er sie in Excel/LibreOffice lädt, dann sind Zahlen als Zahlen erkennbar (Dezimaltrennung passend zu de-AT) und Umlaute korrekt dargestellt.
- [ ] Angenommen der Export enthält Summen, wenn der Steuerberater die Datei sortiert oder filtert, dann sind die Summenzeilen klar als solche erkennbar (eigene Beschriftung in der Kundenspalte, keine Rechnungsnummer).

## Edge Cases
- Was passiert mit Rücklastschriften in den Summen? → Sie sind **kein** vereinnahmtes Geld. Sie werden in einer eigenen Zeile ("davon Rücklastschriften") ausgewiesen und **nicht** in die GESAMT-Summe eingerechnet, damit die Zahl den tatsächlichen Zahlungseingang widerspiegelt.
- Was passiert, wenn der USt-Satz zwischenzeitlich geändert wurde und alte Rechnungen einen anderen Satz haben? → Die Zwischensummen gruppieren nach dem **auf der Rechnung gespeicherten** Satz, nicht nach dem aktuell eingestellten.
- Was passiert bei Rundungsdifferenzen (Summe der gerundeten Einzelbeträge ≠ gerundete Gesamtsumme)? → Es wird die Summe der bereits gerundeten Einzelwerte gebildet, damit die Spalte von Hand nachrechenbar ist.
- Was passiert, wenn der Kundenname ein Semikolon oder Anführungszeichen enthält? → Wird wie bisher korrekt CSV-escaped (bestehende `toCsvRow`-Logik).
- Was passiert bei einem Monat ohne Rechnungen (z.B. Sommerpause)? → Datei mit Kopfzeile und Nullsummen, kein Fehler.

## Technical Requirements (optional)
- Security: Export bleibt Admin-only (`requireAdmin`, wie bisher).
- Die Summen müssen serverseitig aus denselben Daten berechnet werden wie die Einzelzeilen — keine getrennte zweite Abfrage, die abweichen könnte.

## Open Questions
- [x] Erwartet der Steuerberater ein bestimmtes Trennzeichen oder eine bestimmte Zeichenkodierung? → Nicht abgewartet: Die Datei wird auf das österreichische Standardformat umgestellt (Semikolon, Komma-Dezimalzeichen, Kodierungs-Kennung), weil sie sonst in Excel als eine einzige Textspalte landet und ihren Zweck verfehlt. Falls der Steuerberater etwas anderes verlangt, ist es eine Einstellung an einer Stelle (2026-08-23)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Summenzeile **plus** Aufschlüsselung nach USt-Satz | Der Steuerberater braucht die Trennung nach Steuersatz für die Umsatzsteuer-Voranmeldung; eine reine Gesamtsumme müsste er wieder selbst aufteilen | 2026-08-22 |
| Rücklastschriften separat ausweisen, nicht in GESAMT einrechnen | Zurückgebuchtes Geld ist nicht eingegangen — sonst wäre die Gesamtsumme schlicht falsch | 2026-08-22 |
| Keine Monatssperre/Festschreibung | Deutlich einfacher, und da Rechnungen ausschließlich automatisch aus SEPA-Läufen entstehen, verändern sich abgeschlossene Monate praktisch nicht nachträglich | 2026-08-22 |
| Kein DATEV-Format, weiterhin CSV | Kein bekannter Bedarf; CSV ist von jedem Steuerberater verarbeitbar. Kann nachgezogen werden, falls der Steuerberater es verlangt | 2026-08-22 |
| Bar-/Vor-Ort-Zahlungen bleiben außen vor | Sie werden im System nirgends erfasst — das zu ändern wäre ein eigenes Feature | 2026-08-22 |
| Kein "Kassenbuch"-Nachzug nötig; der Export bleibt dauerhaft SEPA-only | Vor-Ort-Rechnungen laufen über ein separates System des Betreibers. Die Lücke ist damit keine Lücke, sondern eine Zuständigkeitsgrenze — die offene Frage von 2026-08-22 ist beantwortet | 2026-08-23 |
| Die Datei muss ihre eigene Reichweite ausweisen | Zwei Systeme führen zusammen die Buchhaltung. Eine Summe ohne Kennzeichnung liest sich wie der Gesamtumsatz und wird beim Zusammenführen doppelt oder falsch verrechnet — der teuerste denkbare Fehler in einem Buchhaltungs-Export | 2026-08-23 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Summen werden beim Export berechnet, nicht gespeichert | Ein gespeicherter Wert wäre ein zweiter Stand, der von den Rechnungen abweichen kann. So liefert derselbe Zeitraum immer dasselbe Ergebnis | 2026-08-23 |
| Gruppierung nach dem auf der Rechnung gespeicherten USt-Satz | Ändert sich der Satz später, bleiben alte Exporte korrekt — sonst würde eine Änderung rückwirkend die Vergangenheit verfälschen | 2026-08-23 |
| Umstellung auf Semikolon-Trennung und Komma-Dezimalzeichen, plus Kodierungs-Kennung | Österreichisches Excel liest die bisherige Datei sonst als eine einzige Textspalte; Umlaute zerfallen ohne die Kennung. Format-Änderung gegenüber bisherigen Dateien ist bewusst in Kauf genommen (entschieden 2026-08-23) | 2026-08-23 |
| Reichweiten-Hinweis in der Datei statt in einer Begleitmail | Die Datei wird weitergereicht, die Mail nicht. Ohne Kennzeichnung liest sich die Summe wie der Gesamtumsatz, obwohl Vor-Ort-Rechnungen aus einem anderen System stammen | 2026-08-23 |
| Summe der bereits gerundeten Einzelbeträge statt exakter Gesamtsumme | Der Steuerberater muss die Spalte von Hand nachrechnen können; eine rechnerisch exaktere Summe würde dabei um Cent abweichen und Rückfragen auslösen | 2026-08-23 |
| Keine Summenanzeige in der Weboberfläche | Zweite Stelle mit derselben Aussage, die irgendwann abweicht. Die Zahlen entstehen dort, wo sie gebraucht werden — in der Datei | 2026-08-23 |
| Monatsauswahl ergänzt die freien Datumsfelder, ersetzt sie nicht | Der häufige Fall wird ein Klick, ungewöhnliche Zeiträume bleiben möglich — kein Funktionsverlust | 2026-08-23 |

---

## Tech Design (Solution Architect)

### A) Component Structure (Visual Tree)

```
Verwaltung → Rechnungen  (bestehende Seite)
└── Filterleiste (bestehend: Kundenname, Von-Datum, Bis-Datum)
    ├── NEU: Monatsauswahl ("August 2026", "Juli 2026", …)
    │        setzt Von/Bis automatisch — die freien Datumsfelder bleiben nutzbar
    └── Knopf "CSV exportieren" (bestehend)
             └── Dateiname trägt jetzt den Zeitraum

Die erzeugte Datei (bisher nur Einzelzeilen):
┌────────────────────────────────────────────┐
│ Kopfzeile                                  │
│ Rechnung … Rechnung … Rechnung …           │  ← unverändert
│                                            │
│ NEU:  Zwischensumme 20 %                   │
│ NEU:  Zwischensumme 10 %   (je Steuersatz) │
│ NEU:  GESAMT                               │
│ NEU:  davon Rücklastschriften              │
│ NEU:  Hinweiszeile zur Reichweite          │
└────────────────────────────────────────────┘
```

Es entsteht **keine neue Seite und kein neuer Bildschirm**. Ergänzt werden eine Monatsauswahl in
der bestehenden Filterleiste und zusätzliche Zeilen am Ende der bereits existierenden Datei.

### B) Data Model (plain language)

**Es wird nichts Neues gespeichert.** Keine Tabelle, keine Spalte, keine Einstellung.

```
Die Summen sind kein gespeicherter Wert, sondern eine Rechnung im Moment des Exports:
"Nimm die Rechnungen des gewählten Zeitraums und addiere sie."

Gruppiert wird nach dem Steuersatz, der AUF DER RECHNUNG steht — nicht nach dem
heute eingestellten. Ändert sich der Satz später, bleiben alte Exporte richtig.

Rücklastschriften werden getrennt gezählt und NICHT in GESAMT eingerechnet:
zurückgebuchtes Geld ist nicht eingegangen.
```

Folge: Ein Export von heute und einer in einem Jahr über denselben Monat liefern dieselben Zahlen,
solange die Rechnungen unverändert sind. Es gibt keinen zweiten Stand, der veralten könnte.

### C) Tech Decisions (justified for PM)

- **Die Datei sagt selbst, was sie enthält.** Deine Buchhaltung läuft über zwei Systeme: Vor-Ort-
  Rechnungen erstellst du woanders, hier landen nur die Lastschrift-Einnahmen. Eine Zeile
  „GESAMT 12.480,00" ohne Kontext liest sich wie der Jahresumsatz. Beim Zusammenführen wäre das
  der teuerste denkbare Fehler — deshalb bekommt die Datei eine ausdrückliche Kennzeichnung ihrer
  Reichweite. Das ist die einzige Stelle, an der wir dem Steuerberater etwas erklären müssen, und
  sie steht in der Datei selbst, nicht in einer Begleitmail, die verloren geht.

- **Österreichisches Zahlenformat.** Bisher trennt die Datei Spalten mit Komma und schreibt
  Beträge als `45.00`. Österreichisches Excel erwartet Semikolon und `45,00` — sonst landet alles
  als Text in einer Spalte und der Steuerberater kann nicht rechnen. Wir stellen um. Dazu kommt
  eine unsichtbare Kennung am Dateianfang, damit Umlaute in Excel nicht zerfallen (das häufigste
  Ärgernis bei CSV aus Web-Anwendungen). **Das ändert das Format gegenüber bisherigen Dateien** —
  bewusst, weil die Datei sonst ihren Zweck verfehlt.

- **Summen im Export, nicht auf dem Bildschirm.** Die Zahlen entstehen dort, wo sie gebraucht
  werden. Eine zusätzliche Summenanzeige in der Weboberfläche wäre eine zweite Stelle, die dasselbe
  behauptet — und die irgendwann abweicht.

- **Monatsauswahl ergänzt die Datumsfelder, ersetzt sie nicht.** Der häufige Fall („voriger Monat")
  geht mit einem Klick; ungewöhnliche Zeiträume bleiben genauso möglich wie bisher.

- **Summenzeilen sind als solche erkennbar.** Sie tragen ihre Beschriftung dort, wo sonst der
  Kundenname steht, und haben keine Rechnungsnummer. Wer die Tabelle sortiert, erkennt sie
  weiterhin — und verwechselt sie nicht mit einer echten Rechnung.

- **Rundung wird sichtbar nachvollziehbar gehalten.** Summiert werden die bereits gerundeten
  Einzelbeträge. Der Steuerberater kann die Spalte von Hand nachrechnen und kommt auf dasselbe
  Ergebnis — auch wenn das rechnerisch minimal von der „exakten" Summe abweichen kann.

### D) Dependencies (packages to install)

Keine. Das Feature erweitert den vorhandenen Export (`/api/admin/rechnungen/export`) und die
bestehende Filterleiste im Rechnungsarchiv.

### Umfang

Betroffen sind drei bestehende Stellen: die Export-Route, die CSV-Hilfsfunktionen und die
Filterleiste. Kein neuer Bildschirm, keine Datenbankänderung, keine neue Abhängigkeit.

---

## Implementation Notes (Frontend)

**Umgesetzt am 2026-08-23.** Nur die Monatsauswahl — die Summen im CSV folgen im Backend-Schritt.

### Geänderte/neue Dateien
| Datei | Zweck |
|-------|-------|
| `src/lib/invoices.ts` | Neue reine Hilfsfunktionen: `monthRange`, `monthFromRange`, `monthLabel`, `recentMonths` |
| `src/lib/invoices.test.ts` | 7 neue Tests für diese Logik |
| `src/components/admin/invoices/invoice-list.tsx` | Monatsauswahl in der bestehenden Filterleiste |

### Entscheidungen bei der Umsetzung
- **Die gewählte Monatsangabe wird nicht gespeichert, sondern aus Von/Bis abgeleitet.** Ändert der
  Admin ein Datum von Hand, springt die Auswahl sofort auf „Eigener Zeitraum". Ein eigener Zustand
  hätte hier zwei Wahrheiten erzeugt, die auseinanderlaufen — genau die Falle, die in diesem Projekt
  schon zweimal zugeschlagen hat (Geburtsdatumsfeld, Benachrichtigungs-Editor).
- **Die Monatsliste wird einmal beim Öffnen der Seite berechnet**, nicht bei jedem Tastendruck. Sonst
  könnte sie sich unter dem Nutzer verschieben, während das Auswahlfeld offen ist.
- **24 Monate** — deckt „Zahlen vom Vorjahr" ab, ohne die Liste zur Scroll-Strecke zu machen.
- **Keine neue Abhängigkeit**, kein neues Bedienelement: Es ist das bereits vorhandene
  shadcn-Auswahlfeld, wie überall sonst in der Verwaltung.
- **Datumsangaben werden aus lokalen Kalenderteilen gebaut**, nie über `toISOString()` — das rechnet
  in UTC um und verschiebt östlich von Greenwich den Tag, was hier die Monatsgrenze verfehlen würde.

### Verifiziert
- Auswahl „Juli 2026" setzt Von auf `2026-07-01` und Bis auf `2026-07-31`
- Ein von Hand geändertes Bis-Datum lässt die Auswahl korrekt auf „Eigener Zeitraum" zurückfallen
- Die freien Datumsfelder funktionieren unverändert
- Schaltjahr und Jahreswechsel per Unit-Test abgedeckt (Februar 2028 → 29 Tage; Januar 2026 → zurück nach Dezember 2025)

### Noch offen (Backend-Schritt)
Summenzeilen, getrennte Rücklastschriften, Reichweiten-Hinweis, österreichisches Zahlenformat und
der Dateiname nach Zeitraum.

---

## Implementation Notes (Backend)

**Umgesetzt am 2026-08-23.** Keine Datenbankänderung, keine neue Abhängigkeit, keine neue Route —
der vorhandene Export wurde erweitert.

### Geänderte Dateien
| Datei | Zweck |
|-------|-------|
| `src/lib/invoices.ts` | `summarizeInvoices`, `exportFileName`, `formatAmountDe`, `CSV_SEPARATOR`, `CSV_BOM`; `toCsvField`/`toCsvRow` nehmen jetzt ein Trennzeichen |
| `src/app/api/admin/rechnungen/export/route.ts` | Summenzeilen, Reichweiten-Hinweis, Dateiname nach Zeitraum |
| `src/lib/invoices.test.ts` | 21 neue Tests; 3 bestehende an das neue Format angepasst |

### Abweichung vom Spec — bewusst
Das Spec nennt die Zeile für Rücklastschriften **„davon Rücklastschriften"**, legt aber zugleich
fest, dass sie **nicht** in GESAMT enthalten ist. „Davon" behauptet für einen Buchhalter das
Gegenteil — nämlich Enthaltensein. Umgesetzt ist deshalb:

- `GESAMT (eingegangen)` — nur tatsächlich vereinnahmtes Geld
- `Nicht eingegangen (Rücklastschriften)` — getrennt, unmissverständlich

Die Zahlen entsprechen exakt dem Spec; nur die Beschriftung wurde eindeutig gemacht.

### Weitere Entscheidungen
- **Trennzeichen jetzt Semikolon, Beträge mit Komma** (`33,33`). Mit Komma-Trennung hätte jeder
  Betrag in Anführungszeichen gestanden, und eine falsch erkannte Datei fällt in Excel zu einer
  einzigen Textspalte zusammen — genau das macht einen Export für den Steuerberater wertlos.
- **BOM am Dateianfang.** Ohne ihn liest Excel unter Windows Latin-1 und macht aus „Müller" ein
  „MÃ¼ller". Verifiziert: erstes Zeichen ist Codepoint 65279.
- **Der Formelschutz bleibt bestehen** und wurde auf das neue Trennzeichen erweitert: Ein Kundenname
  mit Semikolon wird korrekt eingefasst, ein Name wie `=SUM(A1)` weiterhin entschärft.
- **Zwischensumme erscheint auch bei nur einem Steuersatz** — die Datei sieht dadurch immer gleich
  aus, was Rückfragen erspart.
- **Leerer Zeitraum** liefert Kopfzeile plus Nullsummen, keine leere Datei und keinen Fehler.

### Verifiziert an der echten Datei
Export für Januar 2028 (3 Rechnungen, davon 2 zurückgebucht):

```
Rechnungsnummer;Datum;Kunde;Netto;USt-Satz;USt-Betrag;Brutto;Status
2028-0003;2028-01-15;E2E8 Kunde;33,33;20%;6,67;40,00;Rücklastschrift
2028-0002;2028-01-15;E2E7 Multi Kunde;25,00;20%;5,00;30,00;Bezahlt
2028-0001;2028-01-15;E2E7 Multi Kunde;25,00;20%;5,00;30,00;Rücklastschrift
;;Zwischensumme 20%;25,00;20%;5,00;30,00;
;;GESAMT (eingegangen);25,00;;5,00;30,00;
;;Nicht eingegangen (Rücklastschriften);58,33;;11,67;70,00;
;;Hinweis: Diese Datei enthält ausschließlich Einnahmen aus SEPA-Lastschriften. …
```

Dateiname: `rechnungsjournal-2028-01.csv`. GESAMT enthält korrekt nur die eine bezahlte Rechnung;
die beiden zurückgebuchten (40,00 + 30,00 = 70,00) stehen getrennt darunter.

## QA Test Results

**Getestet:** 2026-08-23
**Umgebung:** http://localhost:3000 gegen die Produktiv-Datenbank (es gibt keine Staging-DB)
**Tester:** QA Engineer (AI)

### Akzeptanzkriterien

#### Summen im CSV — 5/5 bestanden
- [x] GESAMT-Zeile mit Netto, USt-Betrag und Brutto unter den Einzelzeilen
- [x] Zwischensumme je USt-Satz
- [x] Zwischensumme erscheint auch bei einheitlichem Satz (einheitliches Format)
- [x] Rücklastschriften getrennt ausgewiesen und **nicht** in GESAMT eingerechnet
- [x] Leerer Zeitraum → Kopfzeile und Nullsummen, HTTP 200, kein Fehler

#### Monats-Export — 3/3 bestanden
- [x] Monatsauswahl setzt Von/Bis auf Monatsanfang und -ende
- [x] Dateiname nennt den Zeitraum (`rechnungsjournal-2028-01.csv`)
- [x] Freie Datumsfelder filtern unverändert

#### Verständlichkeit für den Steuerberater — 2/2 bestanden
- [x] Beträge im österreichischen Format (`25,00`, nirgends `25.00`), Umlaute intakt, BOM vorhanden (Codepoint 65279)
- [x] Summenzeilen tragen keine Rechnungsnummer und sind an ihrer Beschriftung erkennbar

### Edge Cases
- [x] Rücklastschriften zählen weder in GESAMT noch in die Zwischensummen
- [x] Gruppierung nach dem auf der Rechnung gespeicherten USt-Satz (Unit-Test)
- [x] Summe der bereits gerundeten Einzelbeträge — die Spalte ist von Hand nachrechenbar (Unit-Test)
- [x] Kundenname mit Sonderzeichen bricht die Datei nicht (siehe Sicherheitsprüfung)
- [x] Monat ohne Rechnungen → Nullsummen
- [x] Schaltjahr (Februar 2028 → 29 Tage) und Jahreswechsel (Januar 2026 → Dezember 2025)

### Sicherheitsprüfung (Red Team)
- [x] **Unangemeldeter Zugriff:** liefert die Login-Seite als HTML, keine CSV-Kopfzeile, keine Rechnungsnummer
- [x] **Kunde:** kein Zugriff auf fremde Buchhaltungsdaten
- [x] **Lehrer:** ebenfalls kein Zugriff
- [x] **CSV-Formel-Einschleusung über den Kundennamen — real durchgespielt:** Ein Kunde wurde
      testweise auf `=HYPERLINK("http://boese.example","Klick");Spalte;Verschoben` umbenannt.
      Ergebnis in der Datei:
      `"'=HYPERLINK(""http://boese.example"",""Klick"");Spalte;Verschoben"` — die Formel ist mit
      einem Apostroph entschärft (Excel liest sie als Text) und das eingefasste Feld verhindert,
      dass die eingebauten Semikolons die Spalten verschieben. **Beide Angriffe abgewehrt.**
      Der Fixture-Name wurde anschließend wiederhergestellt.

### Gefundene Fehler

#### BUG-1: Monatsauswahl bleibt leer bei Monaten außerhalb der angebotenen Liste
- **Schweregrad:** Low
- **Reproduktion:**
  1. `/admin/rechnungen?from=2020-03-01&to=2020-03-31` aufrufen (oder die Datumsfelder von Hand setzen)
  2. Erwartet: Die Auswahl zeigt „März 2020" oder „Eigener Zeitraum"
  3. Tatsächlich: Die Auswahl ist **leer**
- **Nachgewiesen:**

  | Eingegebener Zeitraum | Auswahl zeigt |
  |---|---|
  | Juli 2026 (in der Liste) | „Juli 2026" ✓ |
  | Januar 2028 (Zukunft) | leer |
  | März 2020 (älter als 24 Monate) | leer |

- **Ursache:** Die Liste bietet 24 Monate rückwärts. Ein erkannter Monat außerhalb davon hat keinen
  passenden Eintrag, und das Auswahlfeld stellt dann nichts dar.
- **Auswirkung:** Rein optisch. Filter, Summen und Export arbeiten korrekt, die Daten stehen sichtbar
  in den Von-/Bis-Feldern. Realistischer Auslöser: ein Monat, der länger als zwei Jahre zurückliegt —
  etwa bei einer Betriebsprüfung.
- **Priorität:** Nice to have. Blockiert nichts.

### Automatisierte Tests
- **Unit:** 21 neue Tests in `src/lib/invoices.test.ts`, 3 bestehende an das neue Format angepasst —
  Gesamtsuite **265/265 grün**. Abgedeckt: Summenbildung, Ausschluss der Rücklastschriften,
  Gruppierung nach Steuersatz, Rundung, Dateinamen, österreichisches Zahlenformat, Formelschutz.
- **E2E:** 11 neue Tests in `tests/PROJ-36-buchhaltungs-export-mit-summen.spec.ts` —
  **11/11 grün auf Chromium und auf Mobile Safari.**
- **Methodik:** Die Zusicherungen prüfen den Zeitraum Januar 2028, den ausschließlich die
  PROJ-10-Fixtures belegen. Ein von anderen Suiten berührter Zeitraum hätte die Zahlen von der
  Laufreihenfolge abhängig gemacht.

### Regression
- PROJ-10 (Rechnungsarchiv): **12/12 grün.** Eine Zusicherung dort prüfte die alte Kopfzeile mit
  Kommas und wurde an das freigegebene neue Format angepasst — keine Fehlfunktion, sondern eine
  veraltete Erwartung.
- PROJ-33 (Sortieren/Filtern in Admin-Listen): **9/9 grün**, die erweiterte Filterleiste stört nicht.

### Nicht abgedeckt
- **Öffnen der Datei in echtem Excel.** Format, Trennzeichen und BOM sind maschinell geprüft; wie
  Excel auf dem Rechner des Steuerberaters die Datei tatsächlich darstellt, lässt sich hier nicht
  nachstellen. Ein Probe-Download durch den Betreiber ist der letzte sinnvolle Schritt.

### Zusammenfassung
- **Akzeptanzkriterien:** 10/10 bestanden
- **Fehler:** 1 (0 kritisch, 0 hoch, 0 mittel, **1 niedrig**)
- **Sicherheit:** Bestanden. Der ernsteste denkbare Angriff — eine Tabellenformel über den
  Kundennamen — ist real durchgespielt und abgewehrt
- **Produktionsreif:** **JA**
- **Empfehlung:** Deployment möglich. BUG-1 ist kosmetisch und kann jederzeit nachgezogen werden


## Deployment

**Live seit:** 2026-08-23
**Produktions-URL:** https://viennasalsastudio.vercel.app
**Git-Tag:** `v1.0.0-PROJ-36`

### Vorab-Prüfungen
- [x] `npm run build` erfolgreich, `npm run lint` sauber
- [x] 265 Unit-Tests grün, 11 E2E-Tests grün auf Chromium und Mobile Safari
- [x] QA abgeschlossen, kein kritischer oder hoher Fehler
- [x] Keine `.env`-Datei versioniert
- [x] **Keine Datenbankänderung nötig** — das Feature rechnet nur, es speichert nichts

### Verifikation in der Produktion
Export für Januar 2028 über die Live-Seite heruntergeladen:

```
Rechnungsnummer;Datum;Kunde;Netto;USt-Satz;USt-Betrag;Brutto;Status
2028-0003;2028-01-15;E2E8 Kunde;33,33;20%;6,67;40,00;Rücklastschrift
2028-0002;2028-01-15;E2E7 Multi Kunde;25,00;20%;5,00;30,00;Bezahlt
2028-0001;2028-01-15;E2E7 Multi Kunde;25,00;20%;5,00;30,00;Rücklastschrift
;;Zwischensumme 20%;25,00;20%;5,00;30,00;
;;GESAMT (eingegangen);25,00;;5,00;30,00;
;;Nicht eingegangen (Rücklastschriften);58,33;;11,67;70,00;
;;Hinweis: Diese Datei enthält ausschließlich Einnahmen aus SEPA-Lastschriften. …
```

- [x] Dateiname `rechnungsjournal-2028-01.csv`
- [x] BOM vorhanden (Codepoint 65279), Umlaute intakt, Beträge mit Komma
- [x] GESAMT enthält **nur** die bezahlte Rechnung; die beiden zurückgebuchten (70,00) stehen getrennt
- [x] Monatsauswahl in der Produktion: „Juli 2026" setzt Von `2026-07-01`, Bis `2026-07-31`

### Offen
- **BUG-1 (Low)** aus der QA bleibt bestehen: Die Monatsauswahl zeigt nichts an, wenn der
  eingegebene Zeitraum ein Monat außerhalb der angebotenen 24 ist. Rein optisch.
- **Ein Probe-Download durch den Betreiber in echtem Excel** steht noch aus — das ist der einzige
  Test, den diese Umgebung nicht leisten kann.

