# PROJ-104: Die Lastschriftdatei im Format ISO-2019 (pain.008.001.08)

## Status: Deployed
**Created:** 2026-11-17
**Last Updated:** 2026-11-17

## Dependencies
- Requires: PROJ-7 (SEPA-Lastschriftmandate und Sammel-Einzug) — der Erzeuger der Bankdatei
- Berührt: PROJ-61 (Datei vor der Bestätigung herunterladen), PROJ-47 (Lauf als Entwurf)

## Anlass

Aus dem Betrieb gemeldet am 2026-11-17, beim Hochladen der Datei in der Bank:

> **Warnung:** Wichtiger Hinweis: Die von Ihnen verwendete Datenformat-Version (ISO-2009)
> entspricht nicht den aktuellen Anforderungen an strukturierte Adressdaten im
> Zahlungsverkehr. Um Probleme bei der Verarbeitung Ihrer Zahlungsaufträge zu vermeiden,
> stellen Sie bitte so schnell wie möglich auf die aktuelle Formatversion (ISO-2019) mit
> strukturierten Adressangaben um.

Die Datei ist durchgegangen — es war eine Warnung, keine Ablehnung. Die Frist dahinter ist
aber bereits erreicht:

- Die **EPC-Richtlinie** (EPC130-08, SDD Core Customer-to-PSP IGs 2025 V1.0, Abschnitt 1.7
  „Change Over Date“) hält fest: „As of 22 November 2026, only the use of structured and
  hybrid addresses will be allowed (i.e. the provision of unstructured addresses is no longer
  allowed as from this date).“
- Eine **österreichische Bank** schreibt auf ihrer ISO-Migrationsseite: „Ab dem 16. November
  2026 dürfen Banken ausschließlich strukturierte Adressen verarbeiten“, unstrukturierte seien
  „nicht mehr akzeptiert und können zur Ablehnung von Zahlungsaufträgen führen“. Dieser Tag
  war gestern.

Wir erzeugen heute `pain.008.001.02` — das ist „ISO-2009“. Die EPC-Richtlinie für das
Nachfolgeformat sagt zur Nachrichtenversion: „Only pain.008.001.08 is allowed.“

## Was die Recherche entlastet

**Kundenadressen sind nicht nötig.** Das war die naheliegende Befürchtung hinter der Warnung,
und sie trifft nicht zu. Die EPC-Richtlinie führt die Adresse des Zahlungspflichtigen
(`Dbtr/PstlAdr`, Element 2.168) mit Multiplizität `0..1` und dem Rulebook-Vermerk AT-P005:

> „The Address of the Debtor (only mandatory when the Creditor PSP or the Debtor PSP is
> located in a non-EEA SEPA country or territory).“

Österreichische Konten auf beiden Seiten heißt: nicht verpflichtend. Es braucht also **keine
Adresserhebung bei den Kunden**, keine Migration, kein neues Pflichtfeld und keine
datenschutzrechtliche Abwägung.

Für die Adresse des Gläubigers (`Cdtr/PstlAdr`, Element 2.21, ebenfalls `0..1`) steht:

> „STRUCTURED ADDRESS: Usage is recommended. 'Town Name’ and ‘Country’ are mandatory.
> ‘Address Line’ is not allowed. It is recommended to provide as many structured elements as
> possible.“

Empfohlen, nicht Pflicht — aber da die Bank ausdrücklich nach strukturierten Adressdaten
fragt und es fünf Konfigurationswerte kostet, geht sie mit.

## Die Regel in einem Absatz

Die Datei trägt künftig die Nachrichtenversion `pain.008.001.08`. Die Adresse des Studios geht
**strukturiert** mit — Straße, Hausnummer, Nummer im Haus („Top"), PLZ, Ort, Land in eigenen
Feldern, niemals als `AdrLine`. Sie kommt aus der Konfiguration, wie die übrigen
Gläubigerdaten. Ist keiner der sechs Werte gesetzt, bleibt die Adresse weg; das ist erlaubt. Ist sie **halb** gesetzt — Ort
oder Land fehlt, oder das Länderkürzel ist keines —, dann bricht der Download mit einer
klaren Meldung ab, statt die Adresse stillschweigend fallen zu lassen. Kundenadressen werden
nicht erhoben.

## User Stories

- Als **Betreiber** will ich eine Datei hochladen können, die meine Bank ohne Warnung annimmt,
  damit der Einzug nicht an einer Formatfrist scheitert.
- Als **Betreiber** will ich die Adresse des Studios einmal eintragen und nie wieder, damit
  der monatliche Lauf keine Handarbeit braucht.
- Als **Betreiber** will ich erfahren, wenn ich die Adresse falsch oder unvollständig
  eingetragen habe, und zwar **bevor** die Datei bei der Bank liegt.
- Als **Betreiber** will ich meinen Kunden nicht ihre Wohnadresse abverlangen müssen, weil die
  Bank ein Datenformat ändert.
- Als **Kunde** will ich, dass sich an meinem Mandat nichts ändert — keine neue Zustimmung,
  keine neue Referenz.

## Out of Scope

- **Adressen der Kunden.** Innerhalb des EWR nicht verpflichtend (AT-P005, siehe oben). Würde
  eine Bank das später doch verlangen, wäre das eine eigene Spezifikation mit Formularfeld,
  Migration und Datenschutzabwägung.
- **Die hybride Adressform** (`AdrLine` zusätzlich zu Ort und Land). Erlaubt, aber sinnlos,
  wenn die strukturierte Form vollständig vorliegt.
- **Das alte Format als Rückfallebene.** Bewusst entschieden am 2026-11-17: ein Format, ein
  Knopf. Lehnt die Bank ab, kostet eine neue Auslieferung zwei Minuten.
- **Die österreichische Variante** (`pain.008.001.08.austrian.004` der PSA). Die Seiten der PSA
  waren nicht abrufbar (HTTP 404 über zwei Adressen). Die ISO-Migrationsseiten
  österreichischer Banken nennen schlicht „pain.008.001.08“, und unsere heutige Datei
  benutzt den ISO-Namensraum und wurde angenommen. Offene Frage unten.
- **`pain.001` (Überweisungen).** Erzeugt die Anwendung nicht.
- **Die Vorabankündigung, Rechnungen, Mandatstexte.** Unberührt.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Die Formatversion

- [ ] Angenommen ein Lauf hat Positionen, wenn ich die SEPA-XML herunterlade, dann trägt das
      Wurzelelement den Namensraum `urn:iso:std:iso:20022:tech:xsd:pain.008.001.08`.
- [ ] Angenommen die Datei ist erzeugt, wenn ich sie durchsehe, dann steht nirgends mehr
      `pain.008.001.02`.
- [ ] Angenommen keine BIC ist konfiguriert, wenn die Datei entsteht, dann steht bei beiden
      Instituten `<Othr><Id>NOTPROVIDED</Id></Othr>` — die Richtlinie erlaubt dort nur diesen
      Wert.
- [ ] Angenommen eine BIC ist konfiguriert, wenn die Datei entsteht, dann steht sie als
      `<BICFI>` im `CdtrAgt` — in der alten Version hieß dieses Feld `<BIC>`, die Datei war
      damit schemawidrig.
- [ ] Angenommen die Datei enthält FRST- und RCUR-Positionen, wenn sie entsteht, dann bleibt
      die Aufteilung in zwei `PmtInf`-Blöcke wie bisher.

### Die Gläubigeradresse

- [ ] Angenommen Straße, Hausnummer, Top, PLZ, Ort und Land sind konfiguriert, wenn die Datei
      entsteht, dann steht im `Cdtr` ein `PstlAdr` mit `StrtNm`, `BldgNb`, `Room`, `PstCd`,
      `TwnNm` und `Ctry` — in dieser Reihenfolge, wie das Schema sie vorgibt.
- [ ] Angenommen die Adresse hat eine Nummer im Haus („Top 6"), wenn die Datei entsteht, dann
      steht sie als `Room` darin und **nicht** in der Hausnummer — die bezeichnet das Haus an
      der Straße.
- [ ] Angenommen eine Adresse geht mit, wenn ich die Datei durchsehe, dann steht darin kein
      `AdrLine` — die Richtlinie verbietet es in der strukturierten Form.
- [ ] Angenommen nur Ort und Land sind konfiguriert, wenn die Datei entsteht, dann enthält sie
      genau diese beiden Felder und ist gültig.
- [ ] Angenommen keiner der fünf Werte ist gesetzt, wenn die Datei entsteht, dann enthält sie
      kein `PstlAdr` und bleibt gültig.
- [ ] Angenommen eine Adresse ist gesetzt, aber der Ort fehlt, wenn ich die Datei
      herunterladen will, dann bricht der Download mit einer Meldung ab, die den fehlenden
      Konfigurationswert benennt.
- [ ] Angenommen das Länderkürzel ist kein zweibuchstabiger Großbuchstabencode, wenn ich die
      Datei herunterladen will, dann bricht der Download mit einer Meldung ab, die das sagt.
- [ ] Angenommen ein Adressfeld ist länger als das Schema erlaubt (Straße 70, Hausnummer 16,
      Top 70, PLZ 16, Ort 35), wenn ich die Datei herunterladen will, dann bricht der Download
      ab und nennt Feld und Grenze.

### Längen, die die Bank sonst zurückweist

- [ ] Angenommen ein Kontoinhaber heißt länger als 70 Zeichen, wenn die Datei entsteht, dann
      steht sein Name auf 70 Zeichen gekürzt darin — die Richtlinie begrenzt `Nm` auf 70, und
      ein einziger langer Name darf nicht den ganzen Lauf verhindern.
- [ ] Angenommen ein Verwendungszweck wäre länger als 140 Zeichen, wenn die Datei entsteht,
      dann steht er auf 140 Zeichen gekürzt darin.
- [ ] Angenommen ein Name enthält Umlaute, wenn die Datei entsteht, dann bleiben sie erhalten
      — die Richtlinie erlaubt den national gebräuchlichen Zeichensatz; nur Kennungen sind auf
      den lateinischen Grundzeichensatz beschränkt, und das war schon so.

### Was sich nicht ändert

- [ ] Angenommen ein Kunde hat ein Mandat, wenn die Umstellung ausgeliefert ist, dann gilt es
      weiter — gleiche Referenz, gleiches Unterschriftsdatum, keine neue Zustimmung.
- [ ] Angenommen ich lade einen bereits bestätigten Lauf herunter, wenn ich das tue, dann
      bekomme ich ihn im neuen Format — die Datei wird bei jedem Abruf neu erzeugt.

## Edge Cases

- **Halb gesetzte Adresse.** Der gefährlichste Fall: Der Betreiber trägt vier von fünf Werten
  ein und die Anwendung lässt die Adresse stillschweigend weg. Deshalb ein Abbruch mit Meldung
  statt eines stillen Verzichts.
- **Keine Adresse.** Ausdrücklich erlaubt und gültig. Der Unterschied zum Fall darüber: Hier
  war nichts gesetzt, dort war etwas gemeint.
- **Länderkürzel kleingeschrieben** („at“). Das Schema schreibt `[A-Z]{2,2}` vor. Ein Kürzel
  in Kleinbuchstaben ist eine Eingabe, die offensichtlich gemeint war — sie wird in
  Großbuchstaben gewandelt, nicht abgewiesen.
- **Leerzeichen in der Konfiguration.** Werden abgeschnitten; ein Wert, der nur aus
  Leerzeichen besteht, gilt als nicht gesetzt.
- **Ein 71 Zeichen langer Kontoinhaber.** Kürzen, nicht abbrechen: Der Betreiber kann einen
  fremden Kontoinhabernamen nicht ändern, und die Lastschrift ist über IBAN und Mandat
  identifiziert.
- **Eine bereits erzeugte, hochgeladene Datei.** Wird nicht gespeichert; ein erneuter Download
  liefert das neue Format. Für die Bank ist das kein Unterschied, sie hat die alte Datei.

## Open Questions

- [ ] Verlangt die Bank des Betreibers die österreichische Variante
      `pain.008.001.08.austrian.004` statt der EPC-Fassung? Die PSA-Seiten waren nicht
      abrufbar. Zu klären beim nächsten Upload — nimmt die Bank die Datei ohne Warnung, ist
      die Frage beantwortet.
- [ ] Soll die Gläubigeradresse später in die Firmendaten der Verwaltung wandern, wo schon
      eine Adresse als Freitext für die Rechnungen steht? Heute bewusst Konfiguration, weil
      die übrigen Gläubigerdaten dort stehen.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Keine Kundenadressen erheben | Innerhalb des EWR nicht verpflichtend (EPC, AT-P005). Erhebung wäre ein Eingriff ohne Anlass | 2026-11-17 |
| Gläubigeradresse geht mit | Von der Richtlinie empfohlen, kostet fünf Konfigurationswerte, und die Bank fragt ausdrücklich danach | 2026-11-17 |
| Adresse aus der Konfiguration, nicht aus der Verwaltung | Die übrigen Gläubigerdaten (Name, IBAN, Gläubiger-ID) stehen dort; keine Migration | 2026-11-17 |
| Kein Rückfall auf das alte Format | Ein Format, ein Knopf, keine Verwechslung am Monatsende | 2026-11-17 |
| Halbe Adresse bricht ab, fehlende Adresse nicht | „Nichts gesetzt" ist eine Entscheidung, „Ort fehlt" ein Versehen — und ein stiller Verzicht wäre genau der Fehler, den niemand merkt | 2026-11-17 |
| „Top 6" kommt ins Schemafeld `Room`, nicht in die Hausnummer | ISO-Definition „Building room number"; die Hausnummer bezeichnet das Haus an der Straße. Die Richtlinie empfiehlt „as many structured elements as possible" | 2026-11-17 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Namensraum `urn:iso:std:iso:20022:tech:xsd:pain.008.001.08` | Die Richtlinie benennt die Nachricht („Only pain.008.001.08 is allowed"); der Namensraum folgt der ISO-Konvention, die unsere heutige Datei für `.02` schon benutzt und die die Bank annimmt | 2026-11-17 |
| Adressprüfung als reine Funktion | Konfigurationsfehler sollen im Einheitentest festgehalten werden, ohne Umgebungsvariablen zu stellen | 2026-11-17 |
| Namen kürzen, Konfiguration abweisen | Ein fremder Kontoinhabername ist nicht änderbar (kürzen); die eigene Adresse ist es (abweisen) | 2026-11-17 |

---
<!-- Sections below are added by subsequent skills -->

## Umsetzung (2026-11-17)

### Was es jetzt gibt

- **Die Nachrichtenversion ist `pain.008.001.08`.** Ein Wort im Namensraum, und die Warnung der
  Bank hat ihren Anlass verloren.
- **`src/lib/sepa/glaeubiger-adresse.ts`** (neu) — eine reine Funktion, die aus sechs
  Konfigurationswerten entweder eine brauchbare Adresse, ein bewusstes „keine" oder einen
  Fehler mit Namen des Werts macht. Die Unterscheidung zwischen „nichts gesetzt" und „halb
  gesetzt" ist der Kern: Das erste ist erlaubt, das zweite bricht ab.
- **Die Adresse steht im Takt des Schemas** — `StrtNm`, `BldgNb`, `Room`, `PstCd`, `TwnNm`,
  `Ctry`, in dieser Reihenfolge, und niemals ein `AdrLine`. Die Nummer im Haus steht damit
  **vor** der Postleitzahl; das Schema lässt da keine Wahl.
- **Längengrenzen der Richtlinie**: `Nm` auf 70 Zeichen gekürzt, `Ustrd` auf 140. Gekürzt und
  nicht abgewiesen, weil ein fremder Kontoinhabername nicht änderbar ist und ein einziger
  langer Name nicht den ganzen Lauf verhindern darf. Die eigene Adresse wird umgekehrt
  abgewiesen statt gekürzt — die kann der Betreiber kürzer schreiben.
- **Sechs neue Konfigurationswerte**, dokumentiert in `.env.local.example`, mit Vorgabewerten
  in der Playwright-Konfiguration, damit die Prüfung auf jedem Rechner dieselbe Datei bekommt.

### Was dabei nebenbei richtig geworden ist

Die Datei schrieb schon vorher `<BICFI>`. So heißt das Feld aber erst in dieser Version — in
`pain.008.001.02` hieß es `<BIC>`. Gezündet hat der Fehler nie, weil ohne konfigurierte BIC
`NOTPROVIDED` geschrieben wird und `SEPA_CREDITOR_BIC` nicht gesetzt ist. Hätte der Betreiber
je eine BIC eingetragen, wäre die Datei schemawidrig gewesen. Mit der Umstellung stimmt die
Schreibweise.

### Abweichungen von der Spezifikation

- **Keine.**

### Was die Richtlinie sonst noch klarstellt

- **Umlaute dürfen bleiben.** Abschnitt 1.4 verlangt, dass „PSPs and their customers must be
  allowed to use the character set currently in use at national level". Nur Kennungen sind
  eng: „References, identifications and identifiers … Content is restricted to the Latin
  character set". Das war schon vor PROJ-104 so umgesetzt (`kennungen.ts`, nach einer
  Ablehnung der Bank am 2026-09-16).
- **`CdtrAgt` und `DbtrAgt` bleiben Pflicht** (`1..1`), und dort ist ohne BIC weiterhin nur
  `NOTPROVIDED` erlaubt — die Richtlinie sagt wörtlich „Only ‚NOTPROVIDED' is allowed."
- **`ChrgBr`** ist `0..1`, und nur `SLEV` ist erlaubt. Bleibt wie es war.

## QA (2026-11-17)

### Stand der Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| `src/lib/sepa/glaeubiger-adresse.test.ts` (neu) | 12/12 — nichts gesetzt, halb gesetzt, Länderkürzel, Grenzen, „Top" allein |
| `src/lib/sepa/xml.test.ts` (erweitert) | 19/19 — darin 10 neue für PROJ-104 |
| Gesamte Einheiten- und Datenbanksuite | 1618 bestanden, 121 Dateien |
| `tests/PROJ-104-sepa-iso-2019.spec.ts` (neu) | 1/1 — die **heruntergeladene** Datei im Browser |
| Regression PROJ-7, PROJ-47, PROJ-10 (Browser) | 40/40 |
| `tsc --noEmit`, `eslint .`, `next build` | ohne Beanstandung |

### Wie geprüft wurde

**Am geparsten Dokument, nicht an Textstellen.** Bei einer Datei, die eine Bank gegen ein
Schema hält, zählt die Reihenfolge der Elemente — und ein `toContain` sieht sie nicht. Die
Prüfungen lesen das Dokument mit einem XML-Parser und vergleichen die Namen der Kindelemente
in Dokumentreihenfolge: `Cdtr` → `[Nm, PstlAdr]`, `PstlAdr` → `[StrtNm, BldgNb, PstCd, TwnNm,
Ctry]`, dazu die vollständige Reihenfolge in `PmtInf` und `DrctDbtTxInf`, einmal mit und einmal
ohne Adresse.

**Und an der echten Datei.** Der Browsertest legt einen Lauf über die Oberfläche an, drückt
„1. SEPA-XML herunterladen", liest die gespeicherte Datei und prüft darin den Namensraum, die
strukturierte Adresse aus der Konfiguration, das Fehlen von `AdrLine` und einen Namen mit
Umlauten. Das ist der Weg, auf dem die Serveraktion die Konfiguration liest — der Schritt, den
keine reine Funktion abdeckt.

### Erfüllte Kriterien: 15 von 18 durch einen Test belegt

Nicht neu geprüft:

- **Der Abbruch bei halber Adresse auf dem Weg durch die Serveraktion.** Die Regel selbst ist
  im Einheitentest in allen Varianten festgehalten (fehlender Ort, fehlendes Land, falsches
  Kürzel, zu lange Werte), und der Weg durch die Aktion ist für den guten Fall durch den
  Browsertest belegt. Für den Fehlerfall wären Umgebungsvariablen zur Laufzeit zu stellen; das
  kostet mehr Gerüst als es belegt.
- **Der erneute Download eines bestätigten Laufs.** Die Datei wird bei jedem Abruf neu erzeugt,
  derselbe Codeweg; PROJ-47 prüft den Download am bestätigten Lauf.
- **Dass Mandate weitergelten.** Es gibt keinen Codeweg, der sie anfassen könnte — die
  Umstellung betrifft nur die Erzeugung der Datei. Belegt ist das Gegenstück: Die Datei trägt
  unveränderte Mandatsreferenz und unverändertes Unterschriftsdatum.

### Produktionsreif: ja

Keine Migration, keine Datenbankänderung, keine Änderung an Zugriffsregeln, keine neue
Abhängigkeit. Sechs neue Konfigurationswerte, alle optional — bleiben sie leer, entsteht eine
gültige Datei ohne Adresse.

## Deployment (2026-11-17)

| | |
| --- | --- |
| Produktion | https://app.viennasalsastudio.at |
| Commits | `feat(PROJ-104)`, `deploy(PROJ-104)` |
| Tag | `v1.104.0-PROJ-104` |
| Migration | **keine** |
| Konfiguration | sechs neue Werte, vor dem Ausliefern in Vercel gesetzt (Production und Preview, Typ Config) |
| Nachtrag | `SEPA_CREDITOR_STREET` auf „Grosse Schiffgasse" geändert (ohne „ß", auf Wunsch des Betreibers) und erneut ausgeliefert |

### Vor dem Ausliefern

- `npm run build`, `eslint .`, `tsc --noEmit` ohne Beanstandung
- Einheiten- und Datenbanksuite: 1619 bestanden, 121 Dateien
- PROJ-104 im Browser: 1/1 an der heruntergeladenen Datei
- Regression PROJ-7, PROJ-47, PROJ-10: 40/40
- Die Konfigurationswerte **zuerst**: Umgebungsvariablen greifen erst mit der nächsten
  Auslieferung („Changes to environment variables are not applied to previous deployments"),
  also gesetzt und dann ausgeliefert — eine Runde statt zwei.

## Für den Betrieb

**Der nächste Upload ist die Probe.** Bleibt die Warnung aus, war die Umstellung richtig.
Kommt eine Ablehnung, ist der Rückweg ein Klick in Vercel auf die vorige Auslieferung — die
alte Datei bleibt bis dahin erzeugbar, weil sie bei jedem Abruf neu entsteht.

**An den Mandaten ändert sich nichts.** Gleiche Referenz, gleiches Unterschriftsdatum, keine
neue Zustimmung. Die Umstellung betrifft nur, wie die Datei für die Bank aussieht.

**Die Straße steht ohne „ß" in der Datei.** Der Betreiber hat sich am 2026-11-17 für
„Grosse Schiffgasse" entschieden, noch bevor eine Bank daran Anstoß nehmen konnte. Erlaubt
wäre beides: Die Richtlinie deckt den national gebräuchlichen Zeichensatz ab (Abschnitt 1.4),
aber die Schreibweise ohne Sonderzeichen kommt durch jede Prüfung. Der Wert steht in
`SEPA_CREDITOR_STREET`.

**Was noch auffallen könnte:**

| Fall | Was zu tun ist |
| --- | --- |
| Die Bank verlangt die österreichische Variante | Offene Frage, siehe oben; die PSA-Seiten waren nicht erreichbar |
| Die Adresse soll sich ändern | Wert in Vercel ändern **und** neu ausliefern — eine Variable allein wirkt nicht auf bestehende Auslieferungen |

**Wenn die Adresse einmal falsch dasteht:** Sie kommt aus der Konfiguration, nicht aus der
Datenbank. Ändern heißt: Wert in Vercel ändern und neu ausliefern. Leeren heißt: alle sechs
Werte leeren — vier von sechs lässt der Download mit einer Meldung abbrechen.
