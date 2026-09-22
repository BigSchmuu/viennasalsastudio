# PROJ-64: Belegarchiv zum Aufbewahren

## Status: Architected
**Created:** 2026-09-23
**Last Updated:** 2026-09-23

## Dependencies
- Requires: PROJ-10 (Rechnungsarchiv) — Belegseite, Studio-Stammdaten, Nummernkreis
- Requires: PROJ-36 (Monatsauswahl für den Rechnungs-Export) — Zeitraumwahl
- Berührt: PROJ-46 (Stornos und Gutschriften) — sie gehören mit ins Archiv

## Anlass

Belege müssen sieben Jahre aufbewahrt werden (§ 132 BAO). Erfüllt ist das heute nur halb:

- Der **Zahlen-Export** (PROJ-36/46) liefert dem Steuerberater eine CSV mit Netto, USt-Zwischensummen
  und Status. Das sind die Zahlen — nicht die Belege.
- Die **Belege selbst** gibt es nur als einzelne Seite in der App, eine nach der anderen.
- Die täglichen Sicherungen von Supabase decken den Unfall ab („gestern etwas kaputtgemacht"), nicht
  die Aufbewahrung. Sie halten sieben Tage, nicht sieben Jahre, und sie sind ein Datenbankabzug —
  niemand liest daraus in fünf Jahren eine Rechnung vor.

Was fehlt, ist ein Weg, die Belege eines Zeitraums **in einem Zug** aus der App herauszubekommen, in
einer Form, die auch dann noch lesbar ist, wenn es diese App nicht mehr gibt.

## User Stories

- Als Betreiber möchte ich alle Belege eines Zeitraums auf einmal als PDF sichern, damit die
  Aufbewahrungspflicht unabhängig von der App erfüllt ist.
- Als Betreiber möchte ich dabei genau das Layout bekommen, das auch der Kunde sieht — sonst habe
  ich zwei verschiedene Fassungen desselben Belegs im Umlauf.
- Als Betreiber möchte ich vor dem Sichern sehen, wie viele Belege der Zeitraum enthält und was sie
  in Summe ausmachen, damit mir ein falsch gewählter Zeitraum auffällt.
- Als Betreiber möchte ich den Zeitraum genauso wählen wie beim Zahlen-Export, damit beide Ausgaben
  denselben Monat meinen.
- Als Betreiber möchte ich Stornos und Gutschriften mit im Archiv haben, weil ein Jahrgang ohne sie
  nicht stimmt.

## Out of Scope

- **ZIP mit einzelnen PDF-Dateien** — als eigenes Projekt vorgemerkt (PROJ-65), falls sich die
  Druckansicht im Alltag als zu umständlich erweist. Es bräuchte eine PDF-Bibliothek und ein zweites,
  eigenes BelegLayout; genau das soll dieses Projekt vermeiden.
- **Automatisches Sichern** (monatlicher Versand, Ablage in einer Cloud) — das Archivieren soll ein
  bewusster Handgriff bleiben, und eine automatische Ablage wäre ein neuer Ort mit
  personenbezogenen Daten.
- **Kundensicht** — reine Verwaltungsfunktion. Kunden sehen ihre eigenen Belege wie bisher einzeln.
- **Vor-Ort- und Barzahlungen** — die laufen über ein anderes System, wie beim Zahlen-Export
  vermerkt.
- **Unveränderbarkeit im technischen Sinn** (Signatur, WORM-Speicher) — dafür ist der Ablageort
  zuständig, nicht die App.

## Acceptance Criteria

- [ ] Angenommen im gewählten Zeitraum liegen Belege, wenn der Betreiber das Belegarchiv öffnet,
      dann steht dort jeder Beleg vollständig untereinander — im selben Layout wie die Einzelseite.
- [ ] Angenommen das Archiv ist geöffnet, wenn der Betreiber druckt, dann beginnt jeder Beleg auf
      einer neuen Seite und die Bedienelemente werden nicht mitgedruckt.
- [ ] Angenommen der Betreiber hat einen Zeitraum gewählt, wenn die Seite lädt, dann stehen oben
      Zeitraum, Anzahl der Belege und die Summe.
- [ ] Angenommen im Zeitraum liegt kein Beleg, wenn die Seite lädt, dann steht dort ein Hinweis
      statt einer leeren Seite.
- [ ] Angenommen der Zeitraum enthält ein Storno oder eine Gutschrift, wenn der Betreiber das Archiv
      öffnet, dann steht der Beleg mit der Rechnung darin, die er aufhebt.
- [ ] Angenommen eine Rechnung im Zeitraum wurde storniert, wenn sie im Archiv erscheint, dann ist
      auf ihr vermerkt, wodurch sie aufgehoben wurde — wie auf der Einzelseite.
- [ ] Angenommen der Betreiber steht auf der Rechnungsliste, wenn er das Archiv sucht, dann findet
      er es dort, ohne die Adresse zu kennen.
- [ ] Angenommen jemand ohne Verwaltungsrechte ruft die Adresse auf, wenn er sie kennt, dann kommt
      er nicht hinein.
- [ ] Angenommen der Zeitraum ist derselbe, wenn der Betreiber Zahlen-Export und Belegarchiv
      vergleicht, dann enthalten beide dieselben Belege.

## Edge Cases

- **Ein ganzes Jahr auf einmal**: Die Seite wird lang. Kein hartes Limit — ein Jahrgang ist genau
  das, was man aufbewahrt —, aber die Kopfzeile nennt die Anzahl, damit niemand blind auf Drucken
  geht.
- **Beleg ohne Kundennamen** (gelöschtes Profil): steht wie auf der Einzelseite mit „—" da. Ein
  Beleg verschwindet nicht, nur weil ein Konto gelöscht wurde.
- **Zeitraum über die Jahresgrenze**: erlaubt. Die Reihenfolge bleibt chronologisch.
- **Storno außerhalb des Zeitraums**: Die aufgehobene Rechnung kann aus einem früheren Monat
  stammen. Ihre Nummer steht trotzdem auf dem Storno — wie im Zahlen-Export.
- **Zwei Belege mit derselben Nummer**: kann es nicht geben, der Nummernkreis ist fortlaufend
  (PROJ-10).

## Technical Requirements

- Kein neues Fremdpaket. Das PDF entsteht im Browser über „Drucken → Als PDF sichern".
- Die Seite ist eine reine Verwaltungsseite; die Zugangsprüfung gehört auf den Server, nicht ins
  Menü.
- Der Beleg im Archiv und der Beleg auf der Einzelseite kommen aus **einem** Bauteil. Zwei Kopien
  desselben Layouts würden auseinanderlaufen, und ausgerechnet beim Beleg fiele das niemandem auf.

## Open Questions

- [ ] Reicht die Druckansicht im Alltag, oder wird doch ein ZIP mit Einzeldateien gebraucht
      (PROJ-65)? Entscheidet sich nach dem ersten Jahresabschluss.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Druckansicht statt erzeugter PDF-Dateien | Der archivierte Beleg sieht genau so aus wie der, den der Kunde bekommt. Eine PDF-Bibliothek bräuchte ein zweites Layout — zwei Fassungen desselben Belegs sind bei einem Buchhaltungsbeleg das größere Übel als ein Handgriff mehr. | 2026-09-23 |
| Alle Belegarten ins Archiv | Ein Jahrgang ohne Stornos und Gutschriften stimmt nicht. | 2026-09-23 |
| Zeitraumwahl wie beim Zahlen-Export | Beide Ausgaben sollen denselben Monat meinen; zwei verschiedene Bedienungen für dieselbe Frage wären eine Fehlerquelle. | 2026-09-23 |
| Kein automatischer Versand | Archivieren soll ein bewusster Handgriff bleiben, und eine automatische Ablage wäre ein weiterer Ort mit personenbezogenen Daten. | 2026-09-23 |
| Chronologisch aufsteigend | Ein Archiv liest sich wie ein Journal — vom ersten zum letzten Beleg. Die Liste in der Verwaltung sortiert bewusst andersherum (das Neueste zuerst). | 2026-09-23 |

### Technical Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Ein Bauteil für beide Auftritte | Einzelseite und Archiv zeigen denselben Beleg. Aus einer Quelle kann keine der beiden Fassungen unbemerkt abweichen — dieselbe Überlegung wie bei der Kartenvorschau in PROJ-63. | 2026-09-23 |
| Serverseitig gerendert, ein Abruf | Die Daten aller Belege eines Zeitraums werden in wenigen Abfragen geholt, nicht je Beleg eine. Bei einem Jahrgang wären das sonst Hunderte. | 2026-09-23 |
| Seitenumbruch über CSS | `break-before` je Beleg; keine Bibliothek, funktioniert in jedem Browser-Druckdialog. | 2026-09-23 |

---

## Tech Design (Solution Architect)

### Was gebaut wird

```
Verwaltung → Rechnungen
├── Liste (unverändert)
├── Zeitraum + Suche (unverändert)
├── Knopf „Zahlen als CSV"        — unverändert
└── Knopf „Belege zum Aufbewahren" ← neu, öffnet das Archiv im selben Zeitraum

Verwaltung → Rechnungen → Belegarchiv   ← neue Seite
├── Kopf: Zeitraum, Anzahl, Summe, Knopf „Drucken"   (wird nicht mitgedruckt)
└── je Beleg: das Belegbauteil, mit Seitenumbruch davor
```

Die Belegseite, die es heute schon gibt, gibt ihren Inhalt an ein eigenes Bauteil ab. Danach nutzen
beide dasselbe: die Einzelseite für einen Beleg, das Archiv für viele.

### Woher die Daten kommen

Alles steht bereits in der Datenbank — es kommt **keine** neue Spalte und **keine** neue Tabelle
dazu. Gelesen werden je Zeitraum:

```
Belege des Zeitraums          (Nummer, Datum, Beschreibung, Betrag, USt, Art, Status, Kunde)
+ die Studio-Stammdaten       (einmal, nicht je Beleg)
+ die aufgehobenen Rechnungen (für den Bezug auf Stornos und Gutschriften)
+ die Aufhebungen             (für den Vermerk auf einer stornierten Rechnung)
```

Das sind vier Abfragen für den ganzen Zeitraum, nicht vier je Beleg.

### Warum keine PDF-Erzeugung

Ein PDF direkt aus der App zu erzeugen hieße: eine Bibliothek dazu, und in ihr das Belegformular ein
zweites Mal nachbauen. Der Beleg im Archiv sähe dann anders aus als der, den der Kunde in der App
sieht — bei einem Buchhaltungsbeleg die schlechtere Variante. Der Browser kann „Als PDF sichern",
und das Ergebnis ist eine ganz normale PDF-Datei.

### Reihenfolge beim Ausrollen

Nur Code, keine Migration. Vorher/nachher gibt es nichts zu beachten; zurückrollen heißt, dass die
Seite wieder fehlt.

## QA Test Results (2026-09-23)

**Empfehlung: bereit für die Produktion.** Keine Migration nötig, alle Prüfebenen grün.

| | |
|---|---|
| Regeln (Unit) | 5 neu, 64 bestehende rund um Rechnungen unverändert grün |
| Browser (E2E) | 6, in beiden Browsern |
| Produktfehler gefunden | 0 |

### Was geprüft ist

**Der Weg** geht über die Rechnungsliste: Zeitraum wählen, auf „Belege zum Aufbewahren" klicken,
im Archiv landen — mit demselben Zeitraum. Kein Test springt direkt auf die Adresse.

**Der Inhalt**: dass ein Beleg vollständig dasteht (Empfänger, Bezeichnung, Netto, USt, Brutto),
dass ein Storno seine Rechnung benennt und die Rechnung ihr Storno, und dass der Kopf Zeitraum,
Anzahl und Summe nennt.

**Der Druck** wird wirklich im Druckmodus angesehen (`emulateMedia`), nicht nur im Quelltext
vermutet: Druckknopf, „Zurück zur Liste" und die Verwaltungsnavigation sind dann unsichtbar, der
Beleg sichtbar. Zur Gegenprobe wurden die Druckregeln einmal entfernt — der Test ist prompt
gefallen und mit ihnen wieder gestiegen.

**Die Grenzen**: leerer Zeitraum (Hinweis statt leerer Seite, kein Druckknopf) und der Versuch eines
Kundenkontos, die Adresse direkt aufzurufen.

**Die Einzelseite** wurde auf dasselbe Bauteil umgestellt; PROJ-10 und PROJ-46 laufen unverändert
durch (28 bestanden, 2 übersprungen — Datei-Downloads gibt es auf mobilem Safari nicht, ein
dokumentierter Altbestand).

### Nicht geprüft

Wie das Ergebnis im PDF-Dialog eines bestimmten Browsers aussieht — Seitenränder und Skalierung
entscheidet der Druckdialog, nicht die App. Ein Jahrgang mit mehreren hundert Belegen wurde nicht
erzeugt; geprüft ist die Zahl der Abfragen, nicht die Ladezeit bei 500 Belegen.

## Deployment

**Produktion:** https://app.viennasalsastudio.at · **Ausgerollt:** 2026-09-23 · **Tag:** `v1.63.0-PROJ-64`

Keine Migration — reiner Code. Nachgeprüft von außen: `/admin/rechnungen/archiv` weist
Nicht-Angemeldete zur Anmeldung (307), während eine erfundene Adresse darunter weiterhin 404
liefert. Damit ist belegt, dass die Seite wirklich existiert und nicht bloß der Server antwortet.

### Zurückrollen

Gefahrlos: Die vorige Fassung kennt die Seite nicht, der Knopf in der Liste verschwindet mit ihr.
An den Daten ändert sich nichts.
