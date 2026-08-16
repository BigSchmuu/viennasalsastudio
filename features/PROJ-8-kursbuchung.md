# PROJ-8: Kursbuchung (Buchungsanfrage, Probestunde & Drop-in)

## Status: Planned
**Created:** 2026-08-16
**Last Updated:** 2026-08-16

## Dependencies
- Requires: PROJ-2 (Auth & Kundenprofil) — Kunde muss eingeloggt sein, um zu buchen
- Requires: PROJ-4 (Admin: Kunden-/Mitgliederverwaltung) — bestätigte reguläre Buchungsanfragen werden als Abo in der bestehenden `subscriptions`-Tabelle angelegt
- Requires: PROJ-5 (Kurskatalog) — „Jetzt buchen"-Button auf `/kurse` wird durch echte Buchungslogik ersetzt (bisher Platzhalter-Toast)
- Requires: PROJ-6 (Stundenplan & Kalender) — konkrete Termine für Probestunde/Drop-in werden aus `course_schedule` + `course_schedule_pauses` berechnet, analog zu `/stundenplan`
- Requires: PROJ-7 (SEPA-Lastschriftmandate) — reguläre Buchungsanfrage setzt ein hinterlegtes Mandat voraus

## User Stories
- Als Kunde möchte ich für einen laufenden Kurs eine Buchungsanfrage stellen können, damit ich mich für ein Abo anmelden kann, ohne anzurufen.
- Als Kunde möchte ich eine kostenlose Probestunde für einen konkreten kommenden Termin buchen können, damit ich einen Kurs unverbindlich ausprobieren kann.
- Als Kunde möchte ich einen einzelnen Drop-in-Termin buchen können, damit ich auch ohne laufendes Abo an einer einzelnen Stunde teilnehmen kann.
- Als Kunde möchte ich eine Probestunde, einen Drop-in oder eine noch offene Buchungsanfrage bis einen Tag vorher stornieren oder auf einen anderen Termin umbuchen können, damit ich flexibel bleibe, wenn sich meine Pläne ändern.
- Als Admin möchte ich reguläre Buchungsanfragen und Drop-in-Anfragen manuell bestätigen oder ablehnen können, damit ich die Kontrolle über neue Anmeldungen behalte.
- Als Admin möchte ich pro Kurs feste Einstiegstermine hinterlegen können, damit neue Abo-Anmeldungen nur zu sinnvollen Zeitpunkten (z. B. Saisonbeginn) starten.
- Als Admin möchte ich den Drop-in-Normalpreis und -Studierendenpreis selbst im UI pflegen können, ohne Code-Änderungen zu benötigen.

## Out of Scope
- Kündigung oder Umbuchung eines bereits laufenden Abos auf einen anderen Kurs — gehört zu PROJ-9 (Abo-Verwaltung); PROJ-8 endet dort, wo eine Buchungsanfrage vom Admin bestätigt und zu einem laufenden Abo wird
- Kapazitätsgrenzen pro Kurs/Raum (maximale Teilnehmerzahl, automatische Ablehnung bei Vollbelegung) — hängt mit der geplanten Warteliste zusammen, gehört zu PROJ-12
- Bezahlung des Drop-in-Preises in der App (Stripe/Kreditkarte etc.) — läuft weiterhin bar/SumUp vor Ort, wie in PROJ-7 entschieden; die App zeigt den Preis nur informativ an
- Ein/Aus-Schalter pro Kurs für Probestunde/Drop-in — im MVP für alle Kurse gleichermaßen verfügbar
- Dauerhaftes Studierendenstatus-Feld im Kundenprofil — Selbstauskunft nur einmalig pro Drop-in-Buchung
- SEPA-Einzug für Einzelzahlungen (Drop-in) — PROJ-7s Sammellastschrift ist nur für wiederkehrende Abos gebaut

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Kunde ohne SEPA-Mandat ist eingeloggt, wenn er bei einem Kurs auf „Jetzt buchen" (reguläre Buchung) klickt, dann wird er zu `/profil` geleitet, um zuerst ein Mandat anzulegen
- [ ] Angenommen ein Kunde mit Mandat ist eingeloggt und der Kurs hat mindestens einen Einstiegstermin, wenn er einen Einstiegstermin auswählt und die Anfrage absendet, dann wird eine Buchungsanfrage mit Status „offen" erstellt
- [ ] Angenommen ein Kurs hat keinen Einstiegstermin hinterlegt, wenn der Kunde die Kursseite ansieht, dann ist die reguläre Buchungsoption nicht verfügbar und ein Hinweis „Aktuell keine Einstiegstermine verfügbar" wird angezeigt
- [ ] Angenommen der Kunde bucht zum ersten Mal überhaupt (egal welche Buchungsart), wenn er die Buchung absendet, dann muss er zuerst „Wie haben Sie von uns erfahren?" auswählen, bevor die Buchung abgeschickt werden kann
- [ ] Angenommen der Kunde hat bereits einmal eine Buchung mit ausgefülltem Akquisitionskanal abgeschickt, wenn er eine weitere Buchung vornimmt, dann wird das Feld nicht erneut abgefragt
- [ ] Angenommen ein Kunde ist eingeloggt, wenn er eine Probestunde für einen der nächsten angezeigten Termine eines Kurses bucht, dann wird die Buchung sofort automatisch bestätigt, ohne dass ein Mandat nötig ist
- [ ] Angenommen ein Kunde ist eingeloggt, wenn er einen Drop-in-Termin bucht und optional „Ich bin Student(in)" ankreuzt, dann wird der passende Preis (Normal/Studierend) angezeigt und eine Drop-in-Anfrage mit Status „offen" erstellt
- [ ] Angenommen eine Drop-in- oder reguläre Buchungsanfrage ist offen, wenn der Admin sie bestätigt, dann ändert sich der Status auf „bestätigt" und der Kunde sieht die Bestätigung; bei einer regulären Anfrage wird zusätzlich automatisch ein aktives Abo in `subscriptions` angelegt
- [ ] Angenommen eine Anfrage ist offen, wenn der Admin sie ablehnt, dann ändert sich der Status auf „abgelehnt" und der Kunde sieht das
- [ ] Angenommen eine Probestunde, ein Drop-in oder eine offene reguläre Anfrage liegt mehr als einen Tag in der Zukunft, wenn der Kunde sie storniert, dann wird sie storniert und verschwindet aus seiner aktiven Übersicht
- [ ] Angenommen eine Probestunde/ein Drop-in/eine offene Anfrage liegt weniger als einen Tag in der Zukunft, wenn der Kunde versucht zu stornieren, dann wird das abgelehnt mit dem Hinweis, dass die Frist abgelaufen ist
- [ ] Angenommen eine Probestunde oder ein Drop-in ist noch stornierbar (mehr als 1 Tag entfernt), wenn der Kunde „Umbuchen" wählt, dann kann er einen anderen verfügbaren Termin desselben Kurses wählen; die alte Buchung wird storniert und eine neue mit dem neuen Termin und ursprünglichem Status-Typ erstellt
- [ ] Angenommen der Admin ändert den Drop-in-Preis (Normal/Studierend) im Admin-UI, wenn er speichert, dann gilt der neue Preis sofort für neue Buchungen

## Edge Cases
- Kunde hat bereits eine offene reguläre Buchungsanfrage für denselben Kurs → zweite Anfrage für denselben Kurs wird verhindert, Hinweis „Du hast bereits eine offene Anfrage für diesen Kurs"
- Admin lehnt eine reguläre Buchungsanfrage ab, nachdem der Kunde inzwischen sein Mandat entfernt hat → unabhängig, keine Wechselwirkung; Ablehnung funktioniert trotzdem
- Zwei Kunden buchen praktisch gleichzeitig eine Probestunde für denselben Termin → beide werden angenommen, da keine Kapazitätsgrenze existiert (siehe Out of Scope)
- Kunde storniert eine Probestunde/einen Drop-in genau an der 1-Tages-Grenze → serverseitige Prüfung anhand des tatsächlichen Zeitpunkts entscheidet, nicht nur das Datum (siehe Tech Design)
- Admin entfernt einen Einstiegstermin, für den bereits offene Anfragen existieren → bestehende Anfragen bleiben unverändert bestehen (Momentaufnahme des gewählten Termins), nur zukünftige Buchungen können den entfernten Termin nicht mehr wählen
- Kurs wird komplett gelöscht, während offene Buchungsanfragen dafür existieren → verhindert durch bestehenden Löschschutz-Mechanismus aus PROJ-3 (Fremdschlüssel-Constraint)

## Technical Requirements (optional)
- Security: Buchungsanfragen nur für eingeloggte Kunden; ein Kunde sieht/verwaltet ausschließlich eigene Buchungen (RLS-Muster aus PROJ-1)
- Alle Terminberechnungen (nächste verfügbare Probestunde-/Drop-in-Termine) berücksichtigen `course_schedule_pauses` aus PROJ-6, damit keine pausierte Woche buchbar ist

## Open Questions
- [ ] Genaue Liste der Auswahloptionen für „Wie haben Sie von uns erfahren?" (z. B. Google, Instagram, Empfehlung, Website, Sonstiges) — wird in `/architecture` oder vor Launch final festgelegt

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Reguläre Buchung = Anfrage mit Admin-Bestätigung, kein Sofort-Self-Service | Passt zum aktuellen Modell, in dem Abos weiterhin admin-gepflegt sind (PROJ-4); Self-Service-Verwaltung eines laufenden Abos kommt erst mit PROJ-9 | 2026-08-16 |
| SEPA-Mandat ist Voraussetzung für eine reguläre Buchungsanfrage | Verhindert, dass der Admin Anmeldungen bestätigt, die er später nicht abrechnen kann | 2026-08-16 |
| Probestunde: kostenlos, kein Mandat, sofort automatisch bestätigt | Niedrigste Eintrittshürde für Interessenten, kein Zahlungsrisiko rechtfertigt keine manuelle Freigabe | 2026-08-16 |
| Drop-in: kostenpflichtig, vor Ort bar/SumUp bezahlt, Admin muss manuell bestätigen | Konsistent mit der PROJ-7-Entscheidung, dass Vor-Ort-Zahlungen außerhalb der App laufen; da Geld involviert ist, möchte der Admin trotzdem jeden Termin einzeln sehen | 2026-08-16 |
| Kündigung/Umbuchung eines laufenden Abos auf einen anderen Kurs gehört zu PROJ-9, nicht PROJ-8 | Vermeidet Scope-Überlappung zwischen den beiden Features; PROJ-8 endet, sobald eine Anfrage zu einem laufenden Abo wird | 2026-08-16 |
| Keine Kapazitätsgrenze pro Kurs im MVP | Kein Kapazitätsfeld existiert aktuell; hängt inhaltlich mit der geplanten Warteliste (PROJ-12) zusammen | 2026-08-16 |
| Buchungsanfrage: ein Klick + optionales Notizfeld, kein starres Formular | Rückfragen laufen bei Bedarf direkt zwischen Admin und Kunde bei der Bestätigung | 2026-08-16 |
| „Wie haben Sie von uns erfahren?" als Pflichtfeld, einmal pro Kunde bei der ersten Buchung jeglicher Art, danach nicht erneut | Deckt alle Einstiegswege (Anfrage/Probestunde/Drop-in) ab, ohne Bestandskunden wiederholt zu fragen; feste Auswahloptionen statt Freitext für auswertbare Marketing-Daten | 2026-08-16 |
| Terminauswahl für Probestunde/Drop-in aus den nächsten kommenden Terminen; reguläre Buchung nur zu admin-definierten Einstiegsterminen | Bildet die reale Anforderung ab, dass neue Abo-Anmeldungen meist nur zu Saison-/Blockbeginn sinnvoll sind, während Probestunde/Drop-in flexibel bleiben | 2026-08-16 |
| Einstiegstermine-Verwaltung wird direkt im bestehenden PROJ-3-Kursformular ergänzt, aber als PROJ-8-Arbeit gespect/getrackt (kein separates /refine PROJ-3) | Gleiches Muster wie PROJ-6, das den Wochentermin ebenfalls im bestehenden Kursformular ergänzt hat, ohne PROJ-3 offiziell zu ändern | 2026-08-16 |
| Kein Ein-/Ausschalter pro Kurs für Probestunde/Drop-in im MVP | Für alle Kurse einheitlich verfügbar; Admin kann ungeeignete Anfragen bei Bedarf manuell ablehnen | 2026-08-16 |
| Studierendenstatus für Drop-in per Selbstauskunft-Checkbox im Buchungsformular, nicht dauerhaft im Profil | Hält den Scope auf PROJ-8 begrenzt, statt die bereits deployte PROJ-2-Profilspec zu erweitern | 2026-08-16 |
| Drop-in-Preis (Normal/Studierend) einheitlich für alle Kurse, aber im Admin-UI editierbar | Kein Code-Zugriff nötig für künftige Preisänderungen, ohne eine komplette neue Einstellungsseite für nur zwei Werte zu bauen | 2026-08-16 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
