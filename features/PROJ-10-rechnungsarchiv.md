# PROJ-10: Rechnungsarchiv

## Status: Planned
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

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
