# PROJ-17: Admin-Analytics-Dashboard

## Status: Architected
**Created:** 2026-08-18
**Last Updated:** 2026-08-18

## Dependencies
- Requires: PROJ-2 (Auth & Kundenprofil) — Admin muss eingeloggt sein
- Requires: PROJ-3 (Admin: Kurse, Levels, Locations & Tanzstile verwalten) — Kurse und maximale Teilnehmerzahl für die Auslastungs-Berechnung
- Requires: PROJ-8 (Kursbuchung) — Buchungsanfragen für die Auslastungs-Berechnung
- Requires: PROJ-9 (Abo-Verwaltung Self-Service) — Abos für Auslastung und Kündigungs-Kennzahl
- Requires: PROJ-10 (Rechnungsarchiv) — Rechnungen als Umsatz-Datenquelle

## User Stories
- Als Admin möchte ich beim Einloggen sofort einen Überblick über Umsatz, Auslastung und Kündigungen sehen, ohne extra navigieren zu müssen.
- Als Admin möchte ich den Umsatz für den laufenden Monat sehen und im Vergleich zu den letzten 12 Monaten einordnen können.
- Als Admin möchte ich sehen, welche Kurse gut ausgelastet sind und welche noch freie Plätze haben, um gezielt zu werben oder Kurse anzupassen.
- Als Admin möchte ich sehen, wie viele Kunden in einem Zeitraum endgültig gekündigt haben, um Trends frühzeitig zu erkennen.
- Als Admin möchte ich einen eigenen Zeitraum wählen können, um Kennzahlen für einen bestimmten Abschnitt zu prüfen (z.B. Monatsvergleich, Quartalsauswertung).

## Out of Scope
- **CSV-Export der Kennzahlen** — der bestehende Rechnungsarchiv-Export (PROJ-10) deckt den Rohdaten-Bedarf bereits ab; dieses Dashboard dient dem schnellen visuellen Überblick.
- **Historisch exakte Auslastung für Kursbuchungen** — es gibt keinen Status-Verlauf für Buchungsanfragen, nur den aktuellen Stand (siehe Decision Log). Für vergangene Zeiträume ist der Buchungs-Anteil der Auslastung eine Näherung.
- **Churn als Prozentsatz/Rate** — nur die absolute Anzahl endgültiger Kündigungen wird gezeigt.
- **Pausierungen als Churn** — werden als eigene, getrennte Kennzahl ausgewiesen, zählen nicht zur Kündigungs-Zahl.
- **Kurse ohne maximale Teilnehmerzahl** in der Auslastungs-Berechnung — eine Prozentangabe wäre bei unbegrenzter Kapazität nicht aussagekräftig.
- **Admin-Benachrichtigungen bei Kennzahl-Schwellenwerten** (z.B. Alert bei Umsatzeinbruch) — kein Alerting-System in diesem Feature, nur die reine Anzeige.
- **Weitere Aufschlüsselungen** (Umsatz nach Tanzstil, nach Lehrer, nach Standort etc.) — nur die drei in der PRD genannten Kernkennzahlen (Umsatz, Auslastung, Churn).
- **Rücklastschriften als eigene Kennzahl** — fließen nur indirekt ein, indem sie vom Umsatz abgezogen werden (siehe Decision Log).

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Admin loggt sich ein, wenn der Login erfolgreich ist, dann landet er direkt auf dem Analytics-Dashboard (statt wie bisher auf „Standorte")
- [ ] Angenommen das Dashboard wird geöffnet, dann zeigt eine Kennzahl-Kachel den Umsatz des laufenden Monats (Summe der Rechnungen ohne zurückgebuchte)
- [ ] Angenommen das Dashboard wird geöffnet, dann zeigt ein Trend-Chart den Umsatz-Verlauf der letzten 12 Monate
- [ ] Angenommen das Dashboard wird geöffnet, dann zeigt eine Kennzahl-Kachel die Gesamt-Auslastung (belegte Plätze ÷ Gesamtkapazität) über alle Kurse mit gesetzter maximaler Teilnehmerzahl
- [ ] Angenommen das Dashboard wird geöffnet, dann zeigt eine Liste alle Kurse mit gesetzter maximaler Teilnehmerzahl, sortiert nach Auslastung absteigend
- [ ] Angenommen das Dashboard wird geöffnet, dann zeigt eine Kennzahl-Kachel die Anzahl endgültig gekündigter Abos im laufenden Monat, getrennt von einer Kennzahl für pausierte Abos
- [ ] Angenommen das Dashboard wird geöffnet, dann zeigt ein Trend-Chart die Anzahl der Kündigungen pro Monat der letzten 12 Monate
- [ ] Angenommen ein Admin wählt einen eigenen Zeitraum (Start- und Enddatum), wenn der Zeitraum bestätigt wird, dann aktualisieren sich sowohl die Kennzahl-Kacheln (Umsatz, Kündigungen) als auch beide Trend-Charts für diesen Zeitraum
- [ ] Angenommen ein Admin wählt ein Enddatum vor dem Startdatum, wenn er den Zeitraum bestätigt, dann erscheint eine Validierungsfehlermeldung und der vorherige Zeitraum bleibt aktiv
- [ ] Angenommen für den gewählten Zeitraum liegen keine Rechnungen oder Kündigungen vor, dann zeigen die Kennzahl-Kacheln „€0" bzw. „0" und die Trend-Charts einen Hinweistext statt einer leeren Grafik
- [ ] Angenommen ein Kunde ohne Admin-Rolle versucht, die Dashboard-Route direkt aufzurufen, dann wird der Zugriff verweigert (bestehendes `requireAdmin`-Muster)

## Edge Cases
- Neues Studio ganz ohne Daten (keine Rechnungen, keine Abos) → alle Kacheln zeigen 0/€0, Charts zeigen den Hinweistext „Noch keine Daten für diesen Zeitraum" statt eines Fehlers
- Eine Rechnung wird nach dem Laden des Dashboards nachträglich als „Rückgebucht" markiert → die Umsatz-Zahl aktualisiert sich erst beim nächsten Laden der Seite, kein Live-Update nötig
- Ein Kurs wird gelöscht, während er zuvor in der Auslastungs-Liste stand → beim nächsten Laden verschwindet er einfach aus der Liste, kein Fehlerzustand
- Ein Abo wird pausiert und im selben Zeitraum wieder reaktiviert → zählt zu keinem Zeitpunkt als Kündigung, nur tatsächliche „gekündigt"-Übergänge zählen als Churn
- Sehr langer eigener Zeitraum gewählt (z.B. mehrere Jahre) → Trend-Charts zeigen weiterhin nachvollziehbare Zeiteinheiten (genaue Granularität wird in `/architecture` festgelegt)
- Ein Kurs hat sowohl aktive Abos als auch offene reguläre Buchungsanfragen für denselben Zeitraum → beide zählen zur Auslastung, wie bereits bei der automatischen Wartelisten-Nachrückung (PROJ-12) gehandhabt

## Technical Requirements (optional)
- Security: Nur die Admin-Rolle hat Zugriff auf das Dashboard (bestehendes `requireAdmin`-Muster wie bei allen anderen `/admin`-Routen)
- Datenintegrität: Der Kursbuchungs-Anteil der historischen Auslastung ist eine Näherung (aktueller Status, keine Verlaufsdaten) und muss in der UI erkennbar als solche gekennzeichnet sein, um keine falsche Präzision zu suggerieren

## Open Questions
- [x] Zeiteinheiten-Granularität der Trend-Charts — gelöst in `/architecture`: Gruppierung nach Monat ab 2 Monaten Zeitraum, sonst nach Tag (siehe Technical Decisions)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Dashboard wird die neue Standard-Startseite für Admins (statt Weiterleitung zu „Standorte") | Admin soll sofortigen Geschäfts-Überblick beim Login bekommen, statt erst navigieren zu müssen | 2026-08-18 |
| Umsatz schließt zurückgebuchte Rechnungen (Rücklastschrift) aus | Zeigt den tatsächlichen Geldeingang statt nur den fakturierten Betrag | 2026-08-18 |
| Auslastung kombiniert eine genaue historische Rekonstruktion für Abos mit einer Näherung (aktueller Status) für Kursbuchungen | Für Abos sind Erstellungsdatum und geplantes Kündigungs-Wirksamkeitsdatum bereits gespeichert und erlauben eine genaue Rückrechnung; für Kursbuchungen gibt es keinen Status-Verlauf — neue Verlaufs-Infrastruktur nur dafür ist für den ersten Wurf nicht gerechtfertigt | 2026-08-18 |
| Kurse ohne gesetzte maximale Teilnehmerzahl werden aus der Auslastungs-Berechnung ausgeschlossen | Eine Prozentangabe wäre bei unbegrenzter Kapazität nicht aussagekräftig | 2026-08-18 |
| Churn = nur absolute Anzahl endgültiger Kündigungen; Pausierungen werden als eigene, getrennte Kennzahl ausgewiesen | Ein pausierter Kunde ist kein endgültiger Verlust und kann jederzeit zurückkehren — eine vermischte Kennzahl wäre irreführend | 2026-08-18 |
| Absolute Anzahl statt Kündigungsrate (%) für Churn | Explizite Nutzerentscheidung — einfacher zu verstehen als eine Rate | 2026-08-18 |
| 12-Monats-Trend-Charts für Umsatz UND Kündigungen, nicht nur Umsatz | Explizite Nutzerentscheidung — Kündigungs-Muster über Zeit (z.B. saisonale Häufungen) sind ebenfalls aussagekräftig | 2026-08-18 |
| Ein individuell gewählter Zeitraum beeinflusst sowohl die Kennzahl-Kacheln als auch beide Trend-Charts | Explizite Nutzerentscheidung für konsistentes Verhalten der gesamten Ansicht | 2026-08-18 |
| Kein CSV-Export in diesem Feature | Bestehender Rechnungsarchiv-Export (PROJ-10) deckt den Rohdaten-Bedarf bereits ab; Zweck dieses Dashboards ist der schnelle visuelle Überblick | 2026-08-18 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Kein neues Backend, keine neuen Datenbank-Funktionen oder -Tabellen | Der Admin hat über die bestehenden Berechtigungen (RLS-Regel „eigene Zeile ODER Admin") bereits vollen Lesezugriff auf Rechnungen, Abos, Kursbuchungen und Kurse — genau wie beim bestehenden Rechnungsarchiv. Summenbildung und Gruppierung nach Monat passieren direkt in der Seite, keine neue Infrastruktur nötig | 2026-08-18 |
| Aktuelle Auslastung nutzt die bestehende Funktion aus PROJ-12 (`get_course_occupancy`), die bereits „aktive Abos + offene Buchungen pro Kurs" liefert | Vermeidet doppelte Logik — dieselbe Berechnung, die schon für die öffentliche „Ausgebucht"-Anzeige verwendet wird | 2026-08-18 |
| Zeitraum wird über URL-Parameter gesteuert (z.B. `?von=...&bis=...`), Standard = laufender Monat | Macht die Ansicht direkt teil-/verlinkbar (z.B. „schau dir den Juli-Wert an") und folgt dem bestehenden Server-Component-Muster des Projekts statt komplexem Client-State | 2026-08-18 |
| Diagramm-Bibliothek: shadcn/ui-Charts (auf Basis von Recharts) | Fügt sich nahtlos in das bestehende shadcn/ui-Design-System ein, keine neue UI-Sprache oder komplett neue Bibliothek nötig | 2026-08-18 |
| Trend-Charts gruppieren nach Monat, sofern der gewählte Zeitraum mindestens 2 Monate umfasst; bei kürzeren, individuell gewählten Zeiträumen wird nach Tag gruppiert | Löst die offene Frage aus dem Spec-Interview: bei einem 2-Wochen-Zeitraum wäre eine Monats-Gruppierung sinnlos (nur 1 Datenpunkt), bei einem Mehrjahres-Zeitraum wäre eine Tages-Gruppierung unlesbar | 2026-08-18 |
| Kündigungs-Datum für die Churn-Zählung ist das geplante Wirksamkeitsdatum der Kündigung, nicht der Zeitpunkt, an dem der Status-Wechsel technisch gespeichert wurde | Der Status eines Abos wechselt laut PROJ-9 erst, wenn ein Admin die fällige Änderung aktiv „übernimmt" (Button „Jetzt übernehmen") — das kann zeitlich vom eigentlichen Kündigungsdatum abweichen. Das gespeicherte Wirksamkeitsdatum spiegelt den tatsächlichen Entscheidungszeitpunkt des Kunden wider und ist daher die aussagekräftigere Grundlage für die Kennzahl | 2026-08-18 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Component Structure (Visual Tree)

```
/admin (neue Standard-Startseite, ersetzt bisherigen Redirect zu „Standorte")
+-- Zeitraum-Filter (oben, quer über die volle Breite)
|   +-- Schnellauswahl "Laufender Monat" (aktiv als Standard)
|   +-- Eigener Zeitraum (Start-/Enddatum-Auswahl)
+-- Kennzahl-Kacheln (3 nebeneinander)
|   +-- Umsatz-Kachel — Betrag für den gewählten Zeitraum
|   +-- Auslastungs-Kachel — Gesamt-Prozentsatz über alle Kurse mit Teilnehmerlimit
|   +-- Kündigungs-Kachel — Anzahl endgültig gekündigt + separat Anzahl pausiert
+-- Umsatz-Trend-Chart (Balken/Linie, Zeitraum-abhängige Gruppierung)
+-- Kündigungs-Trend-Chart (Balken/Linie, Zeitraum-abhängige Gruppierung)
+-- Auslastungs-Liste
    +-- Tabelle: Kursname | belegte Plätze / Kapazität | Prozentsatz-Balken
    +-- Sortiert nach Auslastung absteigend
    +-- Hinweis „Geschätzt" beim Kursbuchungs-Anteil, sobald ein vergangener Zeitraum gewählt ist

Admin-Navigation
+-- NEU: Nav-Link "Dashboard" als erster Eintrag, führt zu /admin
```

### B) Data Model (plain language)

Keine neuen Tabellen. Das Dashboard liest ausschließlich aus bereits bestehenden Daten:
- **Rechnungen** (für Umsatz) — Betrag, Datum, Rücklastschrift-Status
- **Abos** (für Auslastung + Kündigung) — Erstelldatum, aktueller Status, geplanter Status-Wechsel mit Wirksamkeitsdatum
- **Kursbuchungen** (für Auslastung) — aktueller Status, Kurs-Zuordnung
- **Kurse** (für Auslastung) — maximale Teilnehmerzahl

Alles wird zur Anzeigezeit direkt aus der Datenbank gelesen und in der Seite selbst summiert/gruppiert — nichts wird zwischengespeichert oder vorab berechnet.

### C) Tech Decisions (justified for PM)

- **Kein neues Backend nötig**: Der Admin darf schon heute alle relevanten Daten lesen (wie im Rechnungsarchiv) — das Dashboard ist im Kern „bestehende Daten neu zusammenstellen und visualisieren", kein neuer Datenspeicher.
- **Bestehende Auslastungs-Berechnung wiederverwendet**: Für den aktuellen Stand nutzt das Dashboard dieselbe Logik, die schon die öffentliche Kursseite für „Ausgebucht" verwendet — konsistent und ohne doppelten Code.
- **Zeitraum in der URL**: Der gewählte Zeitraum steckt in der Web-Adresse, nicht nur im Browser-Speicher — ein Admin kann sich z.B. den Link für „Auswertung Juli" merken oder teilen.
- **shadcn/ui-Charts**: Passt sich automatisch an das bestehende Marken-Design (Salsa-Rot/Mango-Gold) an, statt eine visuell abweichende Diagramm-Bibliothek einzuführen.

### D) Dependencies (packages to install)
- `recharts` — Grundlage der shadcn/ui-Chart-Komponente, für die beiden Trend-Charts

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
