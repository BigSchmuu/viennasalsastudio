# PROJ-4: Admin — Kunden-/Mitgliederverwaltung

## Status: Planned
**Created:** 2026-08-13
**Last Updated:** 2026-08-13

## Dependencies
- Requires: PROJ-1 (Supabase Infrastructure Setup) — `profiles`- und `subscriptions`-Tabellen, RLS, Admin-Rolle
- Requires: PROJ-2 (Auth & Kundenprofil) — Kunden registrieren und pflegen ihre Basisdaten selbst; PROJ-4 baut auf denselben `profiles`-Feldern auf

## User Stories
- Als Admin möchte ich eine Liste aller Kunden mit Suche nach Name/E-Mail sehen, damit ich schnell den richtigen Kunden finde.
- Als Admin möchte ich die Profildetails eines Kunden einsehen und bei Bedarf korrigieren können, damit ich z. B. eine am Telefon durchgegebene neue Telefonnummer eintragen kann.
- Als Admin möchte ich einem Kunden ein oder mehrere Abos mit Name, Preis und Status (aktiv/pausiert/gekündigt) manuell zuordnen können, damit ich den aktuellen Nimbuscloud-Workaround (Abo-Änderungen händisch nachpflegen) direkt in der App abbilden kann, bis PROJ-7 (Stripe) und PROJ-9 (Self-Service) verfügbar sind.
- Als Admin möchte ich den Status eines bestehenden Abos ändern (z. B. auf „pausiert" oder „gekündigt" setzen), damit ich Kundenwünsche zeitnah nachpflegen kann.
- Als Admin möchte ich pro Kunde mehrere unabhängige Abos verwalten können (z. B. zwei Einzelkurse statt einer Flatrate), damit reale Tarifkombinationen abgebildet werden können.

## Out of Scope
- Admin legt manuell neue Kundenkonten an — PROJ-4 verwaltet ausschließlich Kunden, die sich selbst über PROJ-2 registriert haben
- Admin-verwalteter Tarif-Katalog (wiederverwendbare Preise/Pläne) — Abo-Name und -Preis werden pro Kunden-Abo frei eingetippt; ein echter Tarif-Katalog ergibt erst mit PROJ-7 (Stripe-Produkte) Sinn und würde sonst doppelte Arbeit bedeuten
- Drop-Ins/Einzelstunden — kein Abo-Status-Konzept, gehören zu PROJ-8 (Kursbuchung)
- Echte Zahlungsabwicklung, SEPA-Mandate, Rechnungsstellung — PROJ-7 (Stripe-Zahlungsinfrastruktur)
- Kundenseitiges Self-Service-Pausieren/Kündigen — PROJ-9 (Abo-Verwaltung)
- Konto-Löschung oder -Deaktivierung (Login sperren) — bewusst nicht im MVP, datenschutz-/rechnungsrelevant, wird später gezielt behandelt
- Buchungshistorie/Kursteilnahme-Übersicht pro Kunde — eigener Umfang, ggf. Teil von PROJ-8 oder PROJ-17 (Analytics)
- Bulk-Aktionen (z. B. mehrere Kunden gleichzeitig auf „pausiert" setzen) — bei erwarteter kleiner Kundenzahl im MVP nicht nötig

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen der Admin ist eingeloggt, wenn er die Kundenliste öffnet, dann sieht er alle Kunden (Rolle „customer") mit Name und E-Mail
- [ ] Angenommen der Admin gibt einen Such-Text ein, wenn dieser zu Name oder E-Mail eines Kunden passt, dann wird die Liste entsprechend gefiltert
- [ ] Angenommen der Admin öffnet die Detailseite eines Kunden, wenn die Seite lädt, dann sieht er alle Profildaten (Name, Telefon, Geburtsdatum, Geschlecht) sowie alle Abos dieses Kunden
- [ ] Angenommen der Admin bearbeitet die Profildaten eines Kunden, wenn er speichert, dann werden die Änderungen übernommen und sind sofort sichtbar
- [ ] Angenommen der Admin ist auf der Detailseite eines Kunden, wenn er ein neues Abo mit Name, Preis und Status anlegt, dann erscheint es in der Abo-Liste dieses Kunden
- [ ] Angenommen ein Kunde hat bereits ein Abo, wenn der Admin ein weiteres Abo für denselben Kunden anlegt, dann bestehen beide Abos unabhängig nebeneinander
- [ ] Angenommen ein Abo existiert, wenn der Admin dessen Status ändert (aktiv/pausiert/gekündigt), dann wird der neue Status sofort gespeichert und angezeigt
- [ ] Angenommen ein Abo existiert, wenn der Admin es löscht, dann verschwindet es aus der Abo-Liste des Kunden
- [ ] Angenommen ein Pflichtfeld beim Abo-Anlegen (Name, Preis) fehlt, wenn der Admin speichern will, dann erscheint eine Validierungsfehlermeldung und das Abo wird nicht gespeichert

## Edge Cases
- Kunde ohne Abo → Abo-Liste zeigt „Noch keine Abos vorhanden" statt leerer Tabelle
- Noch keine Kunden registriert → Kundenliste zeigt entsprechenden Leer-Zustand statt leerer Tabelle
- Suchbegriff ohne Treffer → verständlicher Hinweis statt leerer, unerklärter Liste
- Negativer oder nicht-numerischer Preis → Validierungsfehler, Speichern wird verhindert
- Zwei Admin-Sitzungen bearbeiten gleichzeitig denselben Kunden → kein spezielles Konflikthandling im MVP (Last-Write-Wins), analog zu PROJ-3
- Kunde meldet sich zwischen Laden der Liste und Bearbeitung ab (Account-Änderung) → nicht speziell behandelt, sehr unwahrscheinlich im Admin-Kontext

## Technical Requirements (optional)
- Security: Alle Lese-/Schreibzugriffe auf Kundenprofile und Abos nur für Rolle „admin" (RLS-Muster aus PROJ-1); Kunden selbst behalten ihren bestehenden Zugriff auf die eigenen Daten aus PROJ-2 unverändert
- `subscriptions`-Tabelle aus PROJ-1 bekommt neue Felder für Name und Preis (Details in `/architecture`)

## Open Questions
<!-- Unresolved questions from the spec interview. Close them in /refine when answered. -->
- [x] Reicht ein Abo-Status pro Kunde oder mehrere Abos gleichzeitig? → Mehrere Abos pro Kunde möglich (2026-08-13)
- [x] Tarif-Katalog oder Freitext pro Abo? → Freitext (Name + Preis direkt am Abo), da PROJ-7/Stripe das ohnehin später ersetzt (2026-08-13)
- [x] Gehören Drop-Ins zu PROJ-4? → Nein, PROJ-8 (2026-08-13)
- [x] Darf Admin Kundenprofile bearbeiten? → Ja (2026-08-13)
- [x] Suche in der Kundenliste? → Ja, nach Name/E-Mail (2026-08-13)
- [x] Konto löschen/deaktivieren? → Nicht im MVP (2026-08-13)
- [ ] Genaue Preis-Formatierung (Cent-genau, Rundung, Währungssymbol-Anzeige) — wird in `/architecture` festgelegt

## Decision Log
<!-- Record of conscious decisions made and why. Added to by /write-spec and /architecture. -->

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| PROJ-4 verwaltet nur bestehende, selbst registrierte Kunden | Konsistent mit dem App-Ziel „Nimbuscloud durch Self-Service ersetzen"; vermeidet Karteileichen ohne Login | 2026-08-13 |
| Kein Tarif-Katalog, Abo-Name/-Preis frei eingetippt | Übergangslösung bis PROJ-7 (Stripe-Produkte); ein Katalog jetzt würde bei Stripe-Einführung wahrscheinlich verworfen | 2026-08-13 |
| Mehrere unabhängige Abos pro Kunde möglich | Bildet reale Tarifkombinationen ab (z. B. zwei Einzelkurse statt Flatrate), reflektiert das tatsächliche Preismodell des Studios | 2026-08-13 |
| Drop-Ins explizit ausgeschlossen, gehören zu PROJ-8 | Kein Membership-Status nötig, sondern Einzelbuchung — anderes Datenmodell | 2026-08-13 |
| Admin darf Kundenprofile bearbeiten | Praktisch für Korrekturen (z. B. Telefonnummer am Telefon durchgegeben) | 2026-08-13 |
| Keine Konto-Löschung/-Deaktivierung im MVP | Datenschutz-/Rechnungshistorie-relevant, verdient eigene, spätere Betrachtung statt Nebenbei-Entscheidung | 2026-08-13 |
| Einfache Suche nach Name/E-Mail, keine Bulk-Aktionen | Ausreichend bei erwarteter kleiner Kundenzahl im MVP | 2026-08-13 |

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
