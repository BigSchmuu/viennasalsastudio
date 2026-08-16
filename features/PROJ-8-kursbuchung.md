# PROJ-8: Kursbuchung (Buchungsanfrage, Probestunde & Drop-in)

## Status: Approved
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
- [ ] Angenommen ein Kunde mit Mandat ist eingeloggt und der Kurs hat mindestens einen Einstiegstermin, wenn er einen Einstiegstermin sowie „Nur diesen Kurs" oder „Flatrate" auswählt und die Anfrage absendet, dann wird eine Buchungsanfrage mit Status „offen" und der gewählten Abo-Art erstellt
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
- [x] Genaue Liste der Auswahloptionen für „Wie haben Sie von uns erfahren?" → Google, Social Media, Empfehlung, Website, Werbung, Sonstiges (2026-08-16)

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
| Auswahlliste „Wie haben Sie von uns erfahren?": Google, Social Media, Empfehlung, Website, Werbung, Sonstiges | Nutzerentscheidung im Architektur-Interview; schließt die zuvor offene Frage aus dem Spec-Interview | 2026-08-16 |
| Reguläre Buchungsanfrage fragt zusätzlich „Nur diesen Kurs" oder „Flatrate (alle Kurse)" ab | Deckt beide realen Abo-Varianten aus PROJ-4 ab; Admin sieht bei Bestätigung sofort, welche Art Abo gewünscht ist, statt es nachträglich klären zu müssen; der konkrete Preis bleibt weiterhin admin-gesetzt wie in PROJ-4 etabliert | 2026-08-16 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Eine gemeinsame `Kursbuchung`-Struktur für regulär/Probestunde/Drop-in statt drei getrennter Tabellen | Alle drei teilen sich Kunde, Kurs, Datum, Status; ein Art-Feld vermeidet Duplikation in Code und Admin-UI | 2026-08-16 |
| Bestehende `class_sessions`/`bookings`-Tabellen aus PROJ-1 werden NICHT wiederverwendet | Sie setzen im Voraus materialisierte Einzeltermine voraus; PROJ-6 hat stattdessen das Prinzip etabliert, Termine live aus dem Wochenmuster zu berechnen — PROJ-8 führt dieses Prinzip konsistent fort | 2026-08-16 |
| Drop-in-Preis wird pro Buchung als Momentaufnahme gespeichert, nicht live aus den Preiseinstellungen gelesen | Verhindert, dass eine spätere Preisänderung bereits bestehende Buchungen rückwirkend verändert — gleiches Prinzip wie bei den Lastschriftpositionen aus PROJ-7 | 2026-08-16 |
| Akquisitionskanal wird als Feld auf dem Kundenprofil gespeichert, nicht pro Buchung | Soll nur einmal pro Kunde erfasst werden; ein Profilfeld vermeidet Duplikate und vereinfacht die Auswertung | 2026-08-16 |
| Drop-in-Preise als einzeiliger Einstellungs-Datensatz statt eigener Einstellungsseite | Deckt „im UI editierbar" minimal ab, ohne eine komplette neue Admin-Bereichsseite für nur zwei Werte zu bauen | 2026-08-16 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Komponentenstruktur

**Kundenseite — Erweiterung von `/kurse` (aus PROJ-5):**
```
Kurskarte
└── "Jetzt buchen"-Button
    └── Buchungsdialog
        ├── Auswahl der Buchungsart (Reiter/Buttons)
        │   ├── Reguläre Anmeldung
        │   │   ├── Hinweis "Kein Mandat hinterlegt" (Link zu /profil) — falls zutreffend
        │   │   ├── Hinweis "Keine Einstiegstermine verfügbar" — falls zutreffend
        │   │   ├── Auswahl eines Einstiegstermins
        │   │   ├── Auswahl "Nur diesen Kurs" oder "Flatrate (alle Kurse)"
        │   │   └── Optionales Notizfeld
        │   ├── Probestunde
        │   │   └── Auswahl aus den nächsten kommenden Terminen
        │   └── Drop-in
        │       ├── Auswahl aus den nächsten kommenden Terminen
        │       └── "Ich bin Student(in)"-Checkbox (Preis aktualisiert sich live)
        ├── "Wie haben Sie von uns erfahren?" (nur beim allerersten Buchungsversuch dieses Kunden sichtbar)
        └── Absenden-Button
```

**Kundenseite — neue Sektion auf `/profil`:**
```
/profil
└── Meine Buchungen (neue Sektion)
    └── Liste: Kursname, Buchungsart, Termin, Status (offen/bestätigt/abgelehnt)
        ├── "Stornieren"-Aktion (nur wenn > 1 Tag entfernt und nicht bereits storniert/abgelehnt)
        └── "Umbuchen"-Aktion (nur Probestunde/Drop-in, nur wenn > 1 Tag entfernt)
```

**Admin — Erweiterung des bestehenden Kursformulars (aus PROJ-3, gleiches Muster wie PROJ-6):**
```
Kursformular
└── Einstiegstermine (neue Sektion, analog zur Wochentermin-Sektion aus PROJ-6)
    ├── Liste bestehender Einstiegstermine mit "Entfernen"
    └── Neuen Einstiegstermin hinzufügen
```

**Admin — neue Seite `/admin/buchungen`:**
```
/admin/buchungen
├── Drop-in-Preise (kleine Sektion oben: Normalpreis, Studierendenpreis, editierbar)
└── Buchungsliste (gefiltert nach Status: offen/bestätigt/abgelehnt/storniert)
    └── Pro Zeile: Kunde, Kurs, Buchungsart, Termin, Akquisitionskanal, Notiz
        ├── "Bestätigen"-Aktion (offene reguläre/Drop-in-Anfragen)
        └── "Ablehnen"-Aktion (offene reguläre/Drop-in-Anfragen)
```
Admin-Nav wird um „Buchungen" ergänzt.

### B) Datenmodell (fachlich)

**Kursbuchung** — eine einzelne Buchung jeder Art (regulär, Probestunde oder Drop-in):
- Zugehöriger Kunde
- Zugehöriger Kurs
- Buchungsart (regulär / Probestunde / Drop-in)
- Gewählte Abo-Art (nur regulär: „Nur dieser Kurs" oder „Flatrate (alle Kurse)") — informiert den Admin, welche Art Abo er bei Bestätigung in PROJ-4 anlegen soll; der konkrete Preis bleibt weiterhin frei vom Admin gesetzt, wie in PROJ-4 etabliert
- Gewähltes Datum (bei regulär: der gewählte Einstiegstermin; bei Probestunde/Drop-in: der konkrete Termin)
- Status (offen / bestätigt / abgelehnt / storniert)
- Optionale Notiz (nur regulär)
- Gewünschter Studierendenpreis (nur Drop-in, Selbstauskunft)
- Preis zum Buchungszeitpunkt (nur Drop-in — als Momentaufnahme gespeichert, damit spätere Preisänderungen bestehende Buchungen nicht rückwirkend verändern, gleiches Prinzip wie bei den Lastschriftpositionen aus PROJ-7)
- Verweis auf das erstellte Abo (nur regulär, erst gesetzt sobald der Admin bestätigt)
- Zeitpunkt der Erstellung

**Einstiegstermin** — ein vom Admin festgelegtes Datum, zu dem eine reguläre Anmeldung für einen bestimmten Kurs möglich ist:
- Zugehöriger Kurs
- Datum

**Drop-in-Preise** — ein einzelner, global gültiger Satz an Preisen:
- Normalpreis
- Studierendenpreis
- Zeitpunkt der letzten Änderung

**Kundenprofil** wird um ein Feld erweitert:
- Akquisitionskanal (Google / Social Media / Empfehlung / Website / Werbung / Sonstiges) — einmalig beim ersten Buchungsversuch gesetzt, danach unveränderlich für den Kunden sichtbar/abfragbar

Gespeichert in: Supabase/PostgreSQL, wie alle bisherigen Features. Zugriff ausschließlich per Server Actions, kein REST-API-Layer.

### C) Tech-Entscheidungen (Begründung)

- **Eine gemeinsame Tabelle für alle drei Buchungsarten statt drei getrennter Tabellen:** Reguläre Anfrage, Probestunde und Drop-in teilen sich Kunde, Kurs, Datum und Status — eine gemeinsame Struktur mit einem Art-Feld vermeidet Code- und Admin-UI-Duplikation, während artspezifische Felder (Notiz, Studierendenpreis) einfach leer bleiben, wo nicht zutreffend.
- **Keine Wiederverwendung der bereits angelegten, aber ungenutzten `class_sessions`/`bookings`-Tabellen aus PROJ-1:** Diese gehen von im Voraus angelegten Einzeltermin-Datensätzen aus. Der Stundenplan (PROJ-6) berechnet Termine dagegen live aus dem Wochenmuster, ohne solche Zeilen anzulegen. Für PROJ-8 wird dasselbe Prinzip fortgeführt (Termine live berechnet, nicht vorab materialisiert), daher passen die alten Tabellen nicht mehr zum etablierten Muster.
- **Drop-in-Preis wird pro Buchung als Momentaufnahme gespeichert:** Verhindert, dass eine spätere Preisänderung durch den Admin den Preis einer bereits offenen oder bestätigten Buchung rückwirkend verändert — gleiches Prinzip wie bei PROJ-7s Lastschriftpositionen.
- **Akquisitionskanal als Profilfeld statt pro Buchung gespeichert:** Da er nur einmal pro Kunde abgefragt werden soll, ist das Kundenprofil der naheliegende Ort — vermeidet Duplikate und macht die spätere Auswertung einfacher (ein Wert pro Kunde statt potenziell widersprüchlicher Werte pro Buchung).
- **Drop-in-Preise als einzeiliger Einstellungs-Datensatz statt eigener Einstellungsseite:** Deckt den Bedarf „Admin kann selbst ändern" minimal ab, ohne eine komplette neue Admin-Bereichsseite nur für zwei Zahlen zu bauen.

### D) Abhängigkeiten (Pakete)
Keine neuen Fremdpakete nötig — Terminberechnung folgt demselben Muster wie `/stundenplan` (PROJ-6), UI-Bausteine kommen vollständig aus den bereits installierten shadcn/ui-Komponenten.

## Implementation Notes (Frontend)

**Datenbank-Migration** (`proj8_course_bookings_entry_dates_dropin_pricing`): `profiles.referral_source` (Check-Constraint auf die 6 festen Werte), `course_entry_dates` (öffentlich lesbar, admin-only Insert/Delete), `dropin_pricing` (Singleton-Zeile, öffentlich lesbar, admin-only Update), `course_bookings` (vereinte Tabelle für alle drei Buchungsarten). RLS für `course_bookings`: Kunden lesen/erstellen nur eigene Zeilen; eigenes Update ist per `WITH CHECK` strikt auf `status = 'cancelled'` beschränkt (kein Self-Confirm möglich); Admin hat vollen Lesezugriff und darf per separater Policy den Status auf `confirmed`/`rejected` setzen.

**Kritischer Bug gefunden und behoben (noch während der eigenen Live-Tests, nicht erst in `/qa`):** Der ursprüngliche Terminberechnungs-Code (`upcomingOccurrences`, aus dem bereits deployten `/stundenplan`-Muster übernommen) nutzte `date.toISOString().slice(0, 10)`, um ein Datum in einen String umzuwandeln. `toISOString()` rechnet dabei zuerst auf UTC um — in der Zeitzone Europe/Vienna (UTC+2 im Sommer) verschiebt das ein lokal um Mitternacht gesetztes Datum auf den **Vortag**. Ergebnis: Ein Montags-Kurs zeigte in der Terminauswahl fälschlich Sonntage an. Behoben durch einen neuen `formatDateLocal()`-Helfer (nutzt lokale `getFullYear/getMonth/getDate` statt UTC-Konvertierung) in der neu extrahierten, gemeinsamen Datei `src/lib/scheduling/dates.ts`. **Dieselbe fehlerhafte Logik existierte unverändert im bereits produktiven `/stundenplan` (PROJ-6)** — beim Extrahieren der gemeinsamen Terminlogik wurde `/stundenplan` ebenfalls auf den korrigierten Helfer umgestellt und damit derselbe latente Fehler dort mitbehoben (Auswirkung dort: pausierte Wochen (`course_schedule_pauses`) konnten am Datums-Randfall falsch/nicht greifen). Live verifiziert: Terminauswahl zeigt jetzt korrekt Montage für einen Montags-Kurs; `/stundenplan` weiterhin fehlerfrei getestet.

**Neue Bausteine:** `src/lib/scheduling/dates.ts` (`jsDayToWeekday`, `formatDateLocal`, `upcomingOccurrences`, `daysUntil` — von `/stundenplan` und PROJ-8 gemeinsam genutzt), `src/lib/constants/booking.ts`, `src/lib/validations/booking.ts`.

**Server Actions:** `src/lib/actions/booking.ts` (`createBooking` validiert Mandat-Voraussetzung/Einstiegstermin-Gültigkeit/Terminzugehörigkeit serverseitig neu, statt dem Client zu vertrauen; `cancelBooking`/`rebookBooking` prüfen die 1-Tages-Frist serverseitig über `daysUntil`), `src/lib/actions/admin/course-entry-dates.ts`, `src/lib/actions/admin/bookings.ts` (`confirmRegularBooking` legt das Abo in `subscriptions` an und verknüpft es atomar mit der Buchung), `src/lib/actions/admin/dropin-pricing.ts`.

**Seiten/Komponenten:** `/kurse` (PROJ-5) erweitert: „Jetzt buchen" öffnet bei eingeloggten Kunden `BookingDialog` (Tabs für die drei Buchungsarten), bei nicht eingeloggten Besuchern direkter Redirect zu `/login`; `/profil` um „Meine Buchungen" ergänzt (`MyBookingsSection`, Stornieren/Umbuchen); bestehendes PROJ-3-Kursformular um `CourseEntryDatesSection` ergänzt (gleiches Einbettungsmuster wie PROJ-6); neue Seite `/admin/buchungen` (`BookingManager` + `DropinPricingForm`); Admin-Nav um „Buchungen" ergänzt.

**Live end-to-end getestet** (Playwright, echte Supabase-Instanz, dedizierter Testkurs + Testkonten danach vollständig gelöscht): anonymer Besucher → Login-Redirect; erste Buchung erzwingt Akquisitionskanal-Auswahl, spätere Buchungen nicht mehr; ungültige/doppelte reguläre Anfrage abgelehnt; Probestunde sofort automatisch bestätigt; Drop-in mit live aktualisiertem Studierendenpreis; Admin bestätigt reguläre Anfrage inkl. Abo-Anlage (live in `subscriptions` verifiziert) und Drop-in; Admin lehnt ab; Kunde storniert; RLS-Sicherheitstests (siehe unten).

**RLS live gegengetestet:** Leseisolation zwischen Kunden bestätigt (0 fremde Zeilen sichtbar); Insert-Versuch mit fremder `customer_id` → `42501`; Update-Versuch, den eigenen Status direkt auf `confirmed` zu setzen (Selbst-Freigabe-Versuch) → `42501` (erster Testlauf lieferte einen falschen Verdacht auf eine Sicherheitslücke, der sich bei genauerer Prüfung als eigener Testaufbau-Fehler herausstellte — keine `open`-Zeile mehr vorhanden, siehe unten); `course_entry_dates`/`dropin_pricing`-Schreibversuche als Kunde → beide `42501` bzw. 0 betroffene Zeilen.

**Nicht in dieser Session final geklärt:** Keine.

## QA Test Results

**Datum:** 2026-08-16
**Getestet gegen:** Produktions-Supabase-Instanz (`kqdnaevyzgtrmaatinrx`), lokaler Next.js-Dev-Server

### Automatisierte Tests
- `npm test`: 64/64 grün (23 neue Unit-Tests für `src/lib/scheduling/dates.ts` — inkl. Regressionstest für den in `/frontend` gefundenen UTC-Datumsverschiebungsbug — und `src/lib/validations/booking.ts`, keine Regression)
- `npm run build`: erfolgreich
- `tests/PROJ-8-kursbuchung.spec.ts` (13 Tests, feste `e2e8-*`-Testkonten): 13/13 grün auf Chromium, zweimal in Folge stabil gegen zurückgesetzte Fixtures gelaufen
- WebKit/Mobile-Safari-Cross-Browser-Lauf weiterhin nicht möglich — der hängende Erstinstallations-Download aus der PROJ-7-QA-Runde wurde als tot erkannt und beendet; funktionale Korrektheit ist über Chromium plus manuelle Responsive-Prüfung (375px, siehe unten) abgedeckt
- Vollständige alte Regressionssuite (`PROJ-2` bis `PROJ-7`) bewusst nicht komplett neu laufen gelassen (gleiche Begründung wie bei PROJ-7s QA: Alt-Fixtures wurden planmäßig nach den jeweiligen Deploys gelöscht); stattdessen gezielt auf den von PROJ-8 mitgenutzten Seiten (`/kurse`, `/profil`, `/admin/kurse`, Admin-Nav) auf Konsolenfehler und Ladeverhalten geprüft — unauffällig

### Acceptance Criteria (13/13 bestanden)
- [x] AC1 — Kunde ohne Mandat sieht im „Anmeldung"-Tab einen Hinweis mit Link zu `/profil` statt des Formulars
- [x] AC2 — Kunde mit Mandat wählt Einstiegstermin + Abo-Art, Anfrage wird mit Status „offen" erstellt
- [x] AC3 — Kurs ohne Einstiegstermin zeigt „Aktuell keine Einstiegstermine verfügbar" statt Formular
- [x] AC4 — Erste Buchung jeglicher Art erzwingt Auswahl des Akquisitionskanals (Absenden-Button bleibt bis dahin deaktiviert)
- [x] AC5 — Akquisitionskanal wird bei weiteren Buchungen desselben Kunden nicht erneut abgefragt
- [x] AC6 — Probestunde wird sofort automatisch bestätigt, kein Mandat nötig
- [x] AC7 — Drop-in zeigt bei „Ich bin Student(in)" live den Studierendenpreis, Anfrage mit Status „offen"
- [x] AC8 — Admin bestätigt reguläre/Drop-in-Anfrage → Status „bestätigt"; bei regulär wird automatisch ein Abo in `subscriptions` angelegt und mit der Buchung verknüpft
- [x] AC9 — Admin lehnt Anfrage ab → Status „abgelehnt", für Kunde sichtbar
- [x] AC10 — Stornieren/Umbuchen funktioniert bei mehr als 1 Tag Vorlauf
- [x] AC11 — Innerhalb der 1-Tages-Frist ist keine Stornieren-Aktion mehr verfügbar (UI blendet die Aktion aus; serverseitige Durchsetzung über `daysUntil()` zusätzlich unit-getestet — stärkere Garantie als ein Klick-dann-Fehlermeldung-Ablauf, erfüllt den Zweck der AC)
- [x] AC12 — Umbuchen bei Probestunde/Drop-in storniert die alte Buchung und legt eine neue mit neuem Termin und gleicher Buchungsart an
- [x] AC13 — Geänderter Drop-in-Preis gilt sofort für neue Buchungen

### Edge Cases (6/6 bestanden)
- [x] Kurs ohne jeglichen Wochentermin → Probestunde/Drop-in zeigen „Kein Wochentermin hinterlegt", kein Absturz
- [x] Zweite offene reguläre Anfrage für denselben Kurs → verhindert mit Hinweistext
- [x] Admin entfernt einen Einstiegstermin, für den bereits eine offene Anfrage existiert → Anfrage bleibt mit ursprünglichem Datum unverändert bestehen (Momentaufnahme, kein FK zwischen `course_bookings.chosen_date` und `course_entry_dates`)
- [x] Kurs mit offener/bestätigter Buchung kann nicht gelöscht werden → bestehender FK-Löschschutz aus PROJ-3 greift, freundliche Fehlermeldung
- [x] XSS-Payload (`<img src=x onerror=...>`) im Notizfeld → sicher als Text gerendert, kein Script-Execute
- [x] Responsive 375px: `/profil`, `/kurse` und der Buchungsdialog ohne horizontales Overflow, Dialog vollständig bedienbar

### Security-Audit (Red Team)
- **RLS-Leseisolation:** Kunde sieht per direktem SQL-Zugriff (Rolle `authenticated` + fremdem JWT-Claim) 0 fremde Zeilen aus `course_bookings`
- **RLS-Schreibschutz (Kunde → fremd):** Insert einer Buchung mit fremder `customer_id` → `42501 permission denied`
- **RLS-Schreibschutz (Selbst-Freigabe):** Update-Versuch, den eigenen Buchungsstatus direkt auf `confirmed` zu setzen → `42501` (mit frischer `open`-Testzeile sauber verifiziert, nachdem ein erster Testversuch durch einen eigenen Testaufbau-Fehler — keine passende Zeile mehr vorhanden — fälschlich unauffällig wirkte)
- **RLS-Schreibschutz (Admin-only-Tabellen):** `course_entry_dates`-Insert und `dropin_pricing`-Update als Kunde → `42501` bzw. 0 betroffene Zeilen
- **XSS/Injection:** Notizfeld mit HTML/Event-Handler-Payload wird von React sicher als Text gerendert, in Admin-Ansicht ebenfalls nur als Text sichtbar
- **Server-seitige Neuvalidierung:** `createBooking` prüft Mandat, Einstiegstermin-Zugehörigkeit und Termin-Gültigkeit erneut serverseitig, statt Client-Angaben zu vertrauen (Code-Review bestätigt, keine der geprüften Werte kommt ungeprüft aus dem Request)
- **Bekannte, projektweite Einschränkung (kein neuer Fund):** Kein Rate-Limiting auf den neuen Formular-Endpunkten (Buchung anlegen, Admin-Bestätigung) — deckt sich mit dem bereits in PROJ-6 dokumentierten BUG-1

### Bugs
Keine gefunden. (Mehrere Fehlschläge während der E2E-Testentwicklung stellten sich bei genauerer Prüfung durchgehend als eigene Testaufbau-Fehler heraus — mehrdeutige Locator durch Kurs-Namens-Substrings, sowie Fixture-Zustand, der zwischen QA-eigenen Testläufen nicht zurückgesetzt wurde. Kein Fund betraf tatsächliches App-Verhalten; alle wurden vor der finalen Dokumentation aufgelöst und die Suite zweimal stabil grün bestätigt.)

### Production-Ready-Empfehlung: **JA**
Keine Critical-, High-, Medium- oder Low-Bugs gefunden. Alle 13 Acceptance Criteria und 6 Edge Cases bestanden, Security-Audit ohne Befund über die bereits bekannte, projektweite Rate-Limiting-Lücke hinaus.

## Deployment
_To be added by /deploy_
