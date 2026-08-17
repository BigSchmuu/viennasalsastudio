# PROJ-10: Rechnungsarchiv

## Status: In Progress
**Created:** 2026-08-17
**Last Updated:** 2026-08-17

## Dependencies
- Requires: PROJ-2 (Auth & Kundenprofil) — Kunde muss eingeloggt sein, um eigene Rechnungen zu sehen
- Requires: PROJ-7 (SEPA-Lastschriftmandate & Sammel-Einzug) — `sepa_collection_items` sind die Datenquelle für Rechnungen; die bestehende Rücklastschrift-Markierung steuert den Rechnungsstatus

## User Stories
- Als Kunde möchte ich meine vergangenen Zahlungen in meinem Profil einsehen können, damit ich nicht beim Studio nachfragen muss.
- Als Kunde möchte ich eine einzelne Rechnung als druckbares Dokument öffnen können, um sie bei Bedarf zu speichern oder auszudrucken.
- Als Studio-Betreiber möchte ich alle Rechnungen über alle Kunden hinweg durchsuchen und nach Zeitraum filtern können, um meine Buchhaltung vorzubereiten.
- Als Studio-Betreiber möchte ich ein Rechnungsjournal für einen bestimmten Zeitraum als CSV exportieren können, um es an meinen Steuerberater weiterzugeben.
- Als Studio-Betreiber möchte ich meine Rechnungs-Stammdaten (Firmenname, Adresse, UID-Nummer, USt-Satz) zentral pflegen können, ohne dass Code geändert werden muss.

## Out of Scope
- Rechnungen für Drop-in-/Probestunden-Zahlungen (bar/SumUp vor Ort) — es gibt dafür keinen persistierten Zahlungsdatensatz mit verlässlichem Betrag
- Rückwirkende Rechnungserstellung für die 7 bestehenden (größtenteils Test-)Lastschriftläufe — Nummerierung startet bei zukünftigen, neuen Läufen
- Kunden-Postadresse auf der Rechnung — Kleinbetragsrechnung unter 400€ (§ 11 Abs 6 UStG) benötigt rechtlich nur den Empfängernamen; keine Erweiterung von PROJ-2s Profilformular
- Echte PDF-Generierung / neues PDF-Paket — eine druckbare HTML-Detailseite (Browser-Druckfunktion) reicht für MVP
- Excel-Export (.xlsx) — CSV reicht für MVP, kein neues Fremdpaket nötig
- Admin-Löschschutz für Abos mit Rechnungshistorie (wie bei PROJ-23s Videosätzen) — stattdessen speichert die Rechnung einen eigenen Datenschnappschuss, das Abo bleibt frei löschbar
- Rückwirkende Änderung des USt-Satzes auf bereits erstellte Rechnungen — der Satz wird pro Rechnung eingefroren
- Automatischer E-Mail-Versand von Rechnungen an Kunden — reine Self-Service-Ansicht ohne E-Mail-Trigger (könnte später im Rahmen von PROJ-16 Benachrichtigungen aufgegriffen werden)

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Admin erstellt einen neuen Lastschriftlauf, wenn der Lauf gespeichert wird, dann bekommt jeder erzeugte `sepa_collection_items`-Eintrag eine eigene, fortlaufende Rechnungsnummer (Format JAHR-NNNN) und eine Rechnung mit zum Zeitpunkt gültigem, eingefrorenem USt-Satz
- [ ] Angenommen ein Kunde ist eingeloggt, wenn er seinen Profilbereich öffnet, dann sieht er eine Liste seiner eigenen Rechnungen mit Datum, Betrag und Status
- [ ] Angenommen ein Kunde hat noch keine Rechnung, wenn er seinen Rechnungsbereich öffnet, dann sieht er einen Leerzustand-Hinweis statt einer leeren Liste
- [ ] Angenommen ein Kunde klickt auf eine seiner Rechnungen, wenn die Detailseite lädt, dann sieht er eine druckbare Ansicht mit Rechnungsnummer, Datum, Studio-Stammdaten, Netto-, USt- und Bruttobetrag sowie Status
- [ ] Angenommen ein Kunde versucht, die Rechnungs-Detailseite eines anderen Kunden über die URL direkt aufzurufen, dann wird der Zugriff verweigert
- [ ] Angenommen eine Zahlung wird später als Rücklastschrift markiert (bestehende PROJ-7-Funktion), wenn Kunde oder Admin die zugehörige Rechnung ansehen, dann zeigt sie den Status „Rücklastschrift" statt „Bezahlt", die Rechnungsnummer bleibt unverändert bestehen
- [ ] Angenommen ein Admin öffnet `/admin/rechnungen`, wenn er nach Kundenname und/oder Zeitraum filtert, dann zeigt die Liste nur die passenden Rechnungen
- [ ] Angenommen ein Admin hat einen Filter (Zeitraum und/oder Kunde) gesetzt, wenn er auf „CSV exportieren" klickt, dann enthält die heruntergeladene Datei genau die gefilterten Rechnungen mit Rechnungsnummer, Datum, Kunde, Netto, USt-Satz, USt-Betrag, Brutto, Status
- [ ] Angenommen ein Admin öffnet die neuen Rechnungseinstellungen, wenn er Firmenname, Adresse, UID-Nummer und USt-Satz einträgt und speichert, dann werden diese Werte ab der nächsten neu erstellten Rechnung verwendet
- [ ] Angenommen der USt-Satz wird in den Einstellungen nachträglich geändert, wenn eine bereits existierende Rechnung erneut angesehen wird, dann zeigt sie weiterhin den zum Erstellungszeitpunkt gültigen (alten) Satz

## Edge Cases
- Ein Kunde hat zwei aktive Abos, die im selben Lastschriftlauf abgerechnet werden → zwei getrennte Rechnungen mit zwei unterschiedlichen Rechnungsnummern, nicht zusammengefasst
- Ein Abo wird nach Rechnungserstellung gelöscht → Rechnung bleibt vollständig lesbar (gespeicherter Datenschnappschuss von Name/Betrag), unabhängig vom Fortbestehen des Abos
- Rechnungseinstellungen (USt-Satz/Stammdaten) wurden noch nie gepflegt, wenn der erste Lastschriftlauf nach Deployment erstellt wird → sinnvolle Defaults greifen, Admin wird deutlich zur Pflege der Einstellungen aufgefordert
- Jahreswechsel während laufendem Betrieb → Rechnungsnummer beginnt am 1. Jänner wieder bei 0001 für das neue Jahr
- CSV-Export ohne Treffer im gewählten Zeitraum → Export liefert eine Datei nur mit Kopfzeile statt eines Fehlers
- Zwei Admin-Sessions erstellen gleichzeitig einen Lastschriftlauf → Rechnungsnummern-Vergabe muss race-condition-sicher sein, keine doppelt vergebenen Nummern

## Technical Requirements (optional)
- Security: RLS stellt sicher, dass ein Kunde ausschließlich eigene Rechnungen lesen kann; Rechnungseinstellungen und admin-weite Rechnungsliste sind ausschließlich für Admin zugänglich
- Datenintegrität: Rechnungsnummern müssen lückenlos und race-condition-sicher pro Jahr vergeben werden (datenbankseitig, nicht rein clientseitig gezählt)

## Open Questions
- [ ] Exakter Wortlaut des Kleinbetragsrechnungs-Hinweistexts (z. B. bei USt-Befreiung) sollte im Zweifel vom Steuerberater des Studios final geprüft werden

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Rechnungen basieren 1:1 auf `sepa_collection_items` (nur SEPA-Abo-Zahlungen) | Einzige Datenquelle mit verlässlichen Betrag- und Datumsdaten; Drop-in-/Bar-Zahlungen haben keinen persistierten Zahlungsdatensatz | 2026-08-17 |
| USt-Satz ist konfigurierbar statt fest codiert | App soll auch von anderen Studios mit anderer Steuersituation nutzbar sein | 2026-08-17 |
| USt-Satz wird pro Rechnung eingefroren | Verhindert rückwirkende Änderung bereits ausgestellter Rechnungen bei späterer Satzänderung — Buchhaltungs-Korrektheit | 2026-08-17 |
| Fortlaufende Rechnungsnummer pro Kalenderjahr (Format JAHR-NNNN) | Erfüllt § 11 UStG Formvorschrift bei USt-Pflicht, eindeutig zuordenbar für den Steuerberater | 2026-08-17 |
| Rechnung entsteht sofort bei Lastschriftlauf-Erstellung, nicht erst bei Zahlungsbestätigung | Rechnung bildet die Zahlungsanforderung ab; eine spätere Rücklastschrift ändert nur den Status, nie Existenz oder Nummer | 2026-08-17 |
| Keine Kunden-Postadresse nötig | Kleinbetragsrechnung (§ 11 Abs 6 UStG) unter 400 € benötigt rechtlich nur den Empfängernamen | 2026-08-17 |
| Studio-Stammdaten (Name/Adresse/UID/USt-Satz) in neuer DB-Einstellungsseite statt Umgebungsvariablen | Vom Betreiber selbst pflegbar ohne Redeploy; wichtig für Wiederverwendbarkeit durch andere Studios | 2026-08-17 |
| Druckbare HTML-Detailseite statt echter PDF-Generierung | Kein neues Fremdpaket nötig, Browser-Druckfunktion reicht für Kleinbetragsrechnungen | 2026-08-17 |
| CSV statt Excel für den Journal-Export | Universell importierbar, kein neues Fremdpaket nötig | 2026-08-17 |
| Rechnung speichert eigenen Datenschnappschuss (Abo-Name/Betrag) statt Löschschutz für Abos | Abo bleibt frei löschbar, Rechnung bleibt trotzdem vollständig und unveränderlich | 2026-08-17 |
| Keine rückwirkenden Rechnungen für die 7 bestehenden (Test-)Lastschriftläufe | Größtenteils Entwicklungs-Testdaten, noch kein echter Produktionsbetrieb; sauberer, nachvollziehbarer Start der Nummerierung | 2026-08-17 |
| Admin bekommt zusätzlich zur Kundenansicht eine kundenübergreifende, filterbare Rechnungsliste mit CSV-Export | Hauptmotivation des Betreibers ist die eigene Buchhaltung, nicht nur Kunden-Self-Service | 2026-08-17 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Rechnungen entstehen serverseitig im selben Vorgang wie das bestehende Lastschriftlauf-Erstellen | Kein separater manueller Schritt für den Admin; es kann nie einen Lastschriftlauf ohne zugehörige Rechnungen geben | 2026-08-17 |
| Rechnungsnummern-Vergabe über eine geschützte Datenbankfunktion mit Zeilen-Sperre (pro Jahr) | Verhindert, dass zwei gleichzeitige Lastschriftlauf-Erstellungen dieselbe Nummer vergeben; folgt demselben bewährten Muster wie die bestehenden PROJ-9-Selbstbedienungsfunktionen | 2026-08-17 |
| Rechnung speichert einen eigenen Datenschnappschuss (Bezeichnung, Bruttobetrag) statt sich dauerhaft auf das lebende Abo zu verlassen | Bleibt vollständig und korrekt lesbar, auch wenn das zugrunde liegende Abo später gelöscht wird | 2026-08-17 |
| Neue, eigene Rechnungseinstellungen-Tabelle (ein Datensatz, analog zu den bestehenden Drop-in-Preisen) statt Umgebungsvariablen | Vom Betreiber selbst pflegbar ohne Redeploy; Muster bereits im Projekt etabliert (`dropin_pricing`) | 2026-08-17 |
| CSV-Export über einen eigenen Download-Endpunkt statt über eine normale Server-Aktion | Ermöglicht einen echten Dateidownload mit korrektem Dateinamen im Browser; erster Download-Endpunkt im Projekt (bisher ausschließlich Server-Aktionen ohne Dateidownload-Bedarf) | 2026-08-17 |
| Eine gemeinsame, druckbare Detailseite für Kunde und Admin statt zweier getrennter Ansichten | Dieselbe Rechnung sieht für Kunde (eigene) und Admin (beliebige, z. B. aus der Journal-Liste) gleich aus; nur die Zugriffsprüfung unterscheidet, wer sie öffnen darf | 2026-08-17 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Komponentenstruktur

```
/admin/rechnungen (NEU)
├── Filterleiste (Kunden-Suche, Zeitraum von/bis)
├── Rechnungstabelle (Nummer, Datum, Kunde, Betrag, Status)
├── Klick auf eine Zeile → druckbare Detailseite
└── „CSV exportieren"-Button (nutzt genau den aktuell gesetzten Filter)

/admin/rechnungen/einstellungen (NEU)
└── Formular: Firmenname, Adresse, UID-Nummer, Standard-USt-Satz

/admin/lastschriften (bestehend, PROJ-7)
└── unverändert in der Bedienung — Rechnungserstellung passiert automatisch
    im Hintergrund beim Erstellen eines Laufs, kein zusätzlicher Klick nötig

/profil (bestehend, PROJ-2/PROJ-9)
└── Neuer Abschnitt „Meine Rechnungen"
    ├── Liste der eigenen Rechnungen (Datum, Betrag, Status) — analog zu „Meine Abos"
    ├── Klick auf eine Rechnung → druckbare Detailseite
    └── Leerzustand-Hinweis, falls noch keine Rechnung vorhanden

/rechnungen/[id] (NEU — gemeinsame druckbare Detailseite für Kunde & Admin)
├── Studio-Stammdaten im Kopf (aus den Rechnungseinstellungen)
├── Rechnungsnummer, Rechnungsdatum, Kundenname
├── Positionszeile: Bezeichnung, Netto, USt-Satz, USt-Betrag, Brutto
├── Status-Hinweis: „Bezahlt" oder „Rücklastschrift"
└── „Drucken"-Button (nutzt die Browser-Druckfunktion, kein PDF-Paket)
```

### B) Datenmodell (fachlich)

**Rechnung** (neu):
- Fortlaufende Rechnungsnummer (z. B. „2026-0001", eindeutig, pro Kalenderjahr neu beginnend)
- Rechnungsdatum (= Datum des zugehörigen Lastschriftlaufs)
- Verweis auf den Kunden
- Verweis auf die ursprüngliche Lastschrift-Position (informativ; darf leer werden, falls diese je entfernt wird)
- Eigener Datenschnappschuss: Bezeichnung der Leistung (Abo-Name) und Bruttobetrag zum Zeitpunkt der Erstellung
- USt-Satz zum Zeitpunkt der Erstellung (fest eingefroren, ändert sich nie mehr rückwirkend)
- Status: Bezahlt / Rücklastschrift — folgt automatisch der bestehenden Rücklastschrift-Markierung aus PROJ-7

**Rechnungseinstellungen** (neu, ein einziger Datensatz):
- Firmenname, Adresse, UID-Nummer
- Standard-USt-Satz (wird bei jeder neu erstellten Rechnung übernommen und dort eingefroren)

**Rechnungsnummern-Zähler** (neu, rein intern, pro Kalenderjahr):
- Jahr, zuletzt vergebene Nummer — wird ausschließlich von der Datenbank selbst verwaltet, damit zwei gleichzeitige Lastschriftläufe niemals dieselbe Nummer erhalten können

Gespeichert in: Supabase-Datenbank (wie alle anderen Features des Projekts).

### C) Tech-Entscheidungen (Begründung)

- **Automatische Rechnungserstellung beim Lastschriftlauf:** Kein zusätzlicher manueller Schritt, keine Möglichkeit für „vergessene" Rechnungen.
- **Geschützte Datenbankfunktion für die Nummernvergabe:** Verhindert Race Conditions bei gleichzeitigen Lastschriftlauf-Erstellungen — dasselbe bewährte Muster wie die bestehenden PROJ-9-Selbstbedienungsfunktionen.
- **Datenschnappschuss statt Löschschutz:** Die Rechnung bleibt unabhängig vom Fortbestehen des zugrunde liegenden Abos vollständig lesbar und rechtssicher.
- **Eigener Download-Endpunkt für den CSV-Export:** Ermöglicht einen echten, korrekt benannten Dateidownload — technisch nicht über eine normale Server-Aktion möglich.
- **Gemeinsame Detailseite für Kunde und Admin:** Weniger Code, garantiert identische Darstellung; nur die Zugriffsprüfung unterscheidet nach Rolle.

### D) Abhängigkeiten (Pakete)

Keine neuen Fremdpakete nötig — der CSV-Export ist reiner Text (kommagetrennte Zeilen), die druckbare Rechnung nutzt bestehende UI-Bausteine und die Browser-Druckfunktion.

## Implementation Notes (Frontend)

**Datenbank (Migrationen `proj10_invoice_archive_schema`, `proj10_revoke_anon_execute_on_invoice_function`):**
- `invoice_settings` (Singleton, analog `dropin_pricing`): Firmenname, Adresse, UID-Nummer, USt-Satz. Öffentlich lesbar, nur Admin darf ändern.
- `invoice_number_counters` (intern, pro Jahr): RLS aktiv, aber bewusst ohne Policies — nur die SECURITY-DEFINER-Funktion darf darauf zugreifen.
- `invoices`: Rechnungsnummer, Rechnungsdatum, Kunde, Verweis auf `sepa_collection_items` (`on delete set null`), eigener Datenschnappschuss (Bezeichnung, Bruttobetrag), eingefrorener USt-Satz, `bounced_at` (eigenes Feld, synchron zu `sepa_collection_items.bounced_at` gehalten statt live gejoint — konsistent mit dem „Datenschnappschuss"-Prinzip). RLS: Kunde sieht nur eigene Rechnungen, Admin sieht alle.
- Neue SECURITY-DEFINER-Funktion `create_invoices_for_collection_run(p_run_id)`: admin-only (Rollenprüfung + `anon`-Execute explizit entzogen, gleiches Muster wie PROJ-9), atomare Nummernvergabe pro Jahr über `INSERT … ON CONFLICT DO UPDATE … RETURNING`, idempotent (überspringt Positionen, die schon eine Rechnung haben).
- `get_advisors(security)`: keine neuen Findings über das erwartete Muster hinaus (identisch zu den bereits akzeptierten PROJ-9-Funktionen).

**Anbindung an bestehenden SEPA-Code:**
- `src/lib/actions/admin/sepa-collections.ts` — `createCollectionRun` ruft nach dem Anlegen der Lastschriftpositionen zusätzlich `create_invoices_for_collection_run` per RPC auf (Fehler wird geloggt, blockiert aber nicht den bereits erfolgreichen Lauf). `markItemBounced` schreibt `bounced_at` jetzt zusätzlich auf die verknüpfte Rechnung.

**Neue Seiten/Komponenten:**
- `src/lib/invoices.ts` — `computeInvoiceAmounts` (Netto/USt-Aufteilung aus eingefrorenem Satz), `toCsvField`/`toCsvRow` (RFC-4180-Escaping).
- `/admin/rechnungen` + `InvoiceList` — filterbare Liste (Kunde per In-Memory-Suche, Zeitraum per DB-Filter), Link zur Detailseite, CSV-Export-Button.
- `/admin/rechnungen/einstellungen` + `InvoiceSettingsForm` — Firmenname/Adresse/UID/USt-Satz pflegen.
- `/api/admin/rechnungen/export` (erster Route Handler im Projekt) — liefert das gefilterte Rechnungsjournal als CSV-Download.
- `/rechnungen/[id]` — gemeinsame druckbare Detailseite für Kunde (eigene Rechnung) und Admin (beliebige Rechnung); Autorisierung ausschließlich über RLS (kein Zugriff → `notFound()`), kein separater Rollen-Check im Code nötig.
- `/profil` — neuer Abschnitt „Meine Rechnungen" (`MyInvoicesSection`), analog zu „Meine Abos".
- `admin-nav.tsx` — neuer Menüpunkt „Rechnungen".

**Live-Tests durchgeführt (gegen echte Produktions-DB, über die reale Admin-UI, nicht nur SQL):**
- Rechnungseinstellungen speichern. ✅
- Echten Lastschriftlauf über `/admin/lastschriften` erstellt → 3 Rechnungen automatisch angelegt, korrekt sequenziell nummeriert (`2027-0001` bis `-0003`), Jahr korrekt aus dem Fälligkeitsdatum abgeleitet. ✅
- Kunde mit zwei gleichzeitig abgerechneten Abos bekommt zwei getrennte Rechnungen (nicht zusammengefasst). ✅
- Admin-Liste: Filter nach Kundenname und nach Zeitraum (inkl. „keine Treffer"-Leerzustand). ✅
- Detailseite: Firmendaten, Kundenname, Netto/USt/Brutto, Kleinbetragsrechnungs-Hinweis korrekt gerendert. ✅
- Kunde sieht im Profil nur eigene Rechnungen, nicht die anderer Kunden. ✅
- Direkter URL-Zugriff auf eine fremde Rechnung → 404 (RLS greift), zusätzlich per SQL-JWT-Impersonation auf DB-Ebene bestätigt (0 sichtbare Zeilen). ✅
- CSV-Export: korrekte Kopfzeile, korrekte Werte, respektiert aktiven Filter. ✅
- Rücklastschrift-Markierung in `/admin/lastschriften` spiegelt sich sofort im Rechnungsstatus, sowohl in der Admin-Liste als auch beim Kunden. ✅
- **USt-Einfrierung verifiziert:** USt-Satz in den Einstellungen von 20 % auf 10 % geändert → bereits bestehende Rechnung zeigt weiterhin 20 %, ein danach neu erstellter Lauf verwendet korrekt 10 %. ✅
- Responsive: iframe-freie Tabelle, auf Mobile/Tablet vorhandenes horizontales Overflow ist **vorbestehend und seitenweit** (identisch auf `/admin/lastschriften`, `/admin/kunden`), keine PROJ-10-Regression.
- `npm run build` und `npm test` (97 Tests, inkl. 7 neuer Tests für `invoices.ts`) erfolgreich.

**Regressionscheck PROJ-7 (da `sepa-collections.ts` verändert wurde):** 3 Testfehlschläge gefunden, alle root-caused auf dieselbe bereits dokumentierte Testdaten-Drift (kein Staging) — der Fixture-Kunde `e2e7-customer-multi` hat aus früheren Läufen bereits ein aktives SEPA-Mandat, wodurch die „noch kein Mandat"-Testannahme nicht mehr zutrifft; ein Folgetest kaskadiert daraus. Der eigentliche Lauf-Erstellen-Vorgang wurde in den eigenen Live-Tests oben bereits erfolgreich über dieselbe Code-Stelle verifiziert.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
