# PROJ-12: Warteliste & automatische Nachrückung

## Status: In Progress
**Created:** 2026-08-17
**Last Updated:** 2026-08-17

## Dependencies
- Requires: PROJ-2 (Auth & Kundenprofil) — Kunde muss eingeloggt sein
- Requires: PROJ-3 (Admin: Kurse, Levels, Locations & Tanzstile verwalten) — wird um ein Kapazitäts- und ein Preisfeld pro Kurs erweitert
- Requires: PROJ-7 (SEPA-Lastschriftmandate) — Mandat ist Voraussetzung fürs Eintragen auf die Warteliste
- Requires: PROJ-8 (Kursbuchung) — Warteliste hängt direkt am regulären Anmelde-Flow; Nachrückung erzeugt eine offene Anfrage nach bestehendem Muster, Bestätigungsdialog wird um Preis-Vorbefüllung erweitert
- Requires: PROJ-9 (Abo-Verwaltung Self-Service) — eine wirksame Kündigung ist der häufigste Auslöser für eine Nachrückung

## User Stories
- Als Kunde möchte ich mich für einen vollen Kurs auf die Warteliste setzen lassen, damit ich automatisch nachrücke, sobald ein Platz frei wird.
- Als Kunde möchte ich meine Position auf der Warteliste einsehen und mich bei Bedarf selbst wieder austragen können.
- Als Admin möchte ich pro Kurs eine maximale Teilnehmerzahl und einen festen Preis festlegen können, damit die Warteliste automatisch greift und Anfragen schneller bestätigt werden können.
- Als Admin möchte ich sehen, wer auf der Warteliste eines Kurses steht, und bei Bedarf jemanden manuell entfernen können.
- Als Admin möchte ich, dass ein frei werdender Platz automatisch als neue Buchungsanfrage für den nächsten Wartelisten-Kunden erscheint, damit ich sie nur noch bestätigen muss.

## Out of Scope
- Warteliste für Probestunden/Drop-ins — nur reguläre Kursanmeldungen (siehe Decision Log)
- Vollautomatische Abo-Erstellung ohne Admin-Bestätigung — Admin bestätigt weiterhin jede nachgerückte Anfrage, nur mit vorausgefülltem Preis statt manueller Eingabe
- E-Mail-/Push-Benachrichtigung bei Nachrückung — im Projekt existiert aktuell kein Versand-Mechanismus für sowas, das ist PROJ-16 (Automatische E-Mail-/Push-Benachrichtigungen) vorbehalten; der Kunde sieht die neue offene Anfrage/Bestätigung nur beim nächsten Blick ins eigene Profil
- Manuelles Umsortieren der Wartelisten-Reihenfolge durch Admin — reine FIFO-Reihenfolge nach Eintragungszeitpunkt, keine Priorisierung einzelner Kunden
- Blockieren einer Kapazitätsverringerung unterhalb der aktuellen Belegung — wird erlaubt, nur mit Warnhinweis (siehe Decision Log)
- Warteliste ohne SEPA-Mandat — Mandat ist Voraussetzung fürs Eintragen (siehe Decision Log)
- Tiered/dynamische Preise (z. B. Frühbucherrabatt) — der neue Kurspreis ist ein einzelner fester Betrag pro Kurs

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Kurs hat eine maximale Teilnehmerzahl und die Summe aus aktiven Abos und offenen Anfragen hat dieses Maximum erreicht, wenn ein Kunde eine reguläre Anmeldung versucht, dann wird ihm stattdessen angeboten, sich auf die Warteliste einzutragen
- [ ] Angenommen ein Kunde hat noch kein SEPA-Mandat hinterlegt, wenn er versucht, sich auf die Warteliste einzutragen, dann wird er wie bei einer normalen Anmeldung aufgefordert, zuerst ein Mandat zu hinterlegen
- [ ] Angenommen ein Kunde ist auf der Warteliste eines Kurses eingetragen, wenn er seinen Profilbereich öffnet, dann sieht er den Kurs und seine genaue Position in der Warteliste
- [ ] Angenommen ein Kunde steht auf der Warteliste, wenn er sich selbst austrägt, dann verschwindet der Eintrag sofort und alle nachfolgenden Positionen rücken auf
- [ ] Angenommen ein aktives Abo für einen Kurs mit Warteliste wird wirksam gekündigt oder von Admin gelöscht, wenn dadurch ein Platz frei wird, dann wird automatisch aus dem ersten Wartelisten-Eintrag eine neue offene Buchungsanfrage erzeugt
- [ ] Angenommen Admin lehnt eine offene reguläre Anfrage für einen Kurs mit Warteliste ab, wenn dadurch ein Platz frei wird, dann rückt automatisch der nächste Wartelisten-Eintrag nach
- [ ] Angenommen ein Kurs hat einen festen Preis hinterlegt, wenn eine (auch nachgerückte) offene Anfrage bestätigt wird, dann ist das Preisfeld im Bestätigungsdialog bereits mit diesem Preis vorausgefüllt, bleibt aber änderbar
- [ ] Angenommen Admin öffnet die Wartelisten-Übersicht eines Kurses, dann sieht er alle wartenden Kunden mit Position und Eintragungsdatum und kann einzelne Einträge manuell entfernen
- [ ] Angenommen ein Kunde hat bereits ein aktives Abo oder eine offene Anfrage für einen Kurs, wenn er versucht, sich zusätzlich auf dessen Warteliste einzutragen, dann wird das mit einem entsprechenden Hinweis verhindert
- [ ] Angenommen Admin erhöht die maximale Teilnehmerzahl eines Kurses mit Warteliste, wenn dadurch neue Plätze frei werden, dann rücken automatisch entsprechend viele Wartelisten-Einträge nach

## Edge Cases
- Zwei Kunden versuchen gleichzeitig, sich auf den letzten freien Platz anzumelden → nur einer bekommt den Platz, die Kapazitätsprüfung erfolgt serverseitig und race-condition-sicher zum Zeitpunkt der Anfrage, der andere sieht beim erneuten Versuch die Warteliste-Option
- Admin verringert die maximale Teilnehmerzahl unter die aktuelle Belegung → wird erlaubt, der Kurs zeigt einen „überbelegt"-Hinweis, keine bestehenden Abos werden angetastet
- Derselbe Kunde steht bereits auf der Warteliste für denselben Kurs → doppeltes Eintragen wird verhindert
- Ein nachgerückter Wartelisten-Eintrag wird von Admin abgelehnt → Kunde erhält denselben Status wie bei jeder anderen abgelehnten Anfrage; gleichzeitig prüft das System erneut, ob der nächste Wartelisten-Eintrag nachrücken kann
- Kurs hat kein Kapazitäts-Limit gesetzt (Feld leer) → Warteliste greift nie, Verhalten bleibt exakt wie heute (PROJ-8 unverändert)
- Kunde storniert sein SEPA-Mandat, nachdem er auf der Warteliste steht, aber bevor er nachrückt → Eintrag/nachgerückte Anfrage bleibt bestehen (gleiches Verhalten wie bei jeder offenen regulären Anfrage, PROJ-8 prüft das Mandat auch sonst nicht bei der Bestätigung erneut)

## Technical Requirements (optional)
- Security: Kunde darf ausschließlich eigene Wartelisten-Einträge sehen und verwalten; Admin-Ansicht sowie Kapazitäts-/Preis-Verwaltung nur für Admin zugänglich
- Datenintegrität: Kapazitätsprüfung und Nachrück-Logik müssen race-condition-sicher sein (kein doppeltes Vergeben des letzten Platzes bei gleichzeitigen Anfragen)

## Open Questions
- [ ] Keine offenen Fragen

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Neues Kapazitäts-Feld pro Kurs statt manueller Admin-Markierung „voll" | Ermöglicht automatische, zuverlässige Erkennung von „voll", ohne dass Admin selbst den Überblick behalten muss | 2026-08-17 |
| Aktive Abos + offene Anfragen zählen zusammen zur belegten Kapazität | Verhindert Überbuchung durch mehrere gleichzeitig offene, noch unbestätigte Anfragen | 2026-08-17 |
| Warteliste gilt nur für reguläre Anmeldungen, nicht für Probestunden/Drop-ins | Passt zum Sinn von „Nachrücken" (ein dauerhafter Abo-Platz wird frei); Probestunden/Drop-ins bleiben niedrigschwellig und ohne Kapazitätsprüfung | 2026-08-17 |
| SEPA-Mandat ist bereits beim Eintragen auf die Warteliste nötig | Ermöglicht echte automatische Nachrückung, ohne dass das System auf den Kunden warten muss | 2026-08-17 |
| Nachrückung erzeugt eine offene Anfrage, Admin bestätigt weiterhin (mit vorausgefülltem Preis) | Nutzt den bestehenden, bereits getesteten PROJ-8-Bestätigungsablauf 1:1 weiter; Admin behält die letzte Kontrolle (z. B. für einen Rabatt) | 2026-08-17 |
| Feste Kurspreise werden im Rahmen von PROJ-12 eingeführt (Erweiterung von PROJ-3/PROJ-8) statt als eigenes Feature | Direkt nötig, damit die automatische Nachrückung ohne manuelle Preiseingabe funktioniert; kleiner, eng an dieses Feature gekoppelter Zusatz statt eigenem Spec-Zyklus | 2026-08-17 |
| Kunde sieht seine Warteliste inkl. genauer Position im Profil und kann sich selbst austragen | Konsistent mit dem bestehenden Self-Service-Ansatz aus PROJ-9 | 2026-08-17 |
| Admin bekommt eine Wartelisten-Übersicht pro Kurs mit manueller Entfernen-Möglichkeit | Studio-Betreiber braucht einen Überblick, z. B. bei telefonischen Anfragen zum Austragen | 2026-08-17 |
| Kapazitätsverringerung unter die aktuelle Belegung wird erlaubt, nur mit Warnhinweis | Vermeidet, dass Admin bestehende Kunden zwangsweise entfernen müsste | 2026-08-17 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Kapazitätsprüfung und Nachrück-Logik laufen als eine einzige, geschützte serverseitige Funktion statt mehrerer Einzelschritte | Verhindert Race Conditions bei gleichzeitigen Anfragen (zwei Kunden auf den letzten Platz, doppeltes Nachrücken); gleiches, bereits bewährtes Muster wie die Rechnungsnummern-Vergabe aus PROJ-10 | 2026-08-17 |
| Nachrückung erzeugt eine ganz normale offene Buchungsanfrage statt einer eigenen Bestätigungs-Logik | Nutzt den bestehenden, bereits getesteten PROJ-8-Bestätigungsablauf unverändert weiter — kein zweiter Code-Pfad zum Anlegen von Abos | 2026-08-17 |
| Wartelisten-Position wird bei jeder Anzeige live berechnet, nicht gespeichert | Bleibt automatisch korrekt bei Austragungen/Nachrückungen, ohne dass mehrere gespeicherte Zahlen synchron gehalten werden müssten | 2026-08-17 |
| Kapazität und Preis sind rein optionale, neue Felder auf der bestehenden Kurstabelle | Keine Migration bestehender Kurse nötig; Verhalten bleibt exakt wie bisher, bis Admin die Felder aktiv setzt | 2026-08-17 |
| Wartelisten-Übersicht als Dialog auf der bestehenden /admin/kurse-Seite statt einer neuen Kurs-Detailseite | Kurse werden aktuell ausschließlich über Dialoge verwaltet (kein Kurs-Detailseiten-Muster vorhanden, anders als z. B. bei Videosätzen); konsistent mit dem Rest der Seite | 2026-08-17 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Komponentenstruktur

```
/admin/kurse (bestehend, PROJ-3)
└── Kurstabelle
    ├── Anlegen-/Bearbeiten-Dialog bekommt zwei neue, optionale Felder:
    │   „Max. Teilnehmer" und „Preis"
    └── Neue Spalte „Warteliste" pro Kurs (z. B. „Warteliste (3)")
        └── Klick öffnet einen neuen Dialog: wartende Kunden mit
            Position, Name, Eintragungsdatum, „Entfernen"-Button je Zeile

/admin/buchungen (bestehend, PROJ-8)
└── Bestätigungsdialog für offene reguläre Anfragen
    └── Preisfeld ist vorausgefüllt, wenn der Kurs einen festen Preis
        hat — bleibt weiterhin frei änderbar; gilt für alle offenen
        Anfragen, nicht nur für nachgerückte

Buchungsdialog auf /kurse und /kurse/[id] (bestehend, PROJ-5/8/11)
└── Tab „Anmeldung"
    ├── Kurs ist voll → statt Formular: Hinweis „Kurs ist aktuell
    │   voll" + Button „Auf Warteliste eintragen"
    └── Kein Mandat hinterlegt → bestehender Hinweis „Mandat zuerst
        hinterlegen" (gilt jetzt auch fürs Eintragen auf die Warteliste)

/profil (bestehend, PROJ-2/9/10/11)
└── Neuer Abschnitt „Meine Warteliste"
    ├── Kurs + genaue Position pro Eintrag
    └── „Austragen"-Button je Eintrag
```

### B) Datenmodell (fachlich)

**Kurs** (bestehend) bekommt zwei neue, optionale Informationen:
- Maximale Teilnehmerzahl — eine Zahl, leer lassbar (kein Limit → Warteliste greift nie)
- Fester Preis — ein Betrag, leer lassbar (dient nur der Vorbefüllung im Bestätigungsdialog, ändert nichts an der weiterhin möglichen manuellen Preiseingabe)

**Wartelisten-Eintrag** (neu): Verweis auf den Kunden, Verweis auf den Kurs, gewünschte Abo-Art (Einzelkurs/Flatrate — dieselbe Auswahl wie bei einer normalen Anmeldung), Eintragungszeitpunkt (bestimmt die Position: je früher, desto weiter vorne). Kein eigenes Status-Feld nötig — ein Eintrag existiert, solange der Kunde wartet, und wird beim Nachrücken direkt in eine normale offene Buchungsanfrage umgewandelt, wodurch er aus der Warteliste verschwindet.

Die „belegte Kapazität" eines Kurses wird nicht gespeichert, sondern bei jeder Prüfung frisch berechnet: Anzahl aktiver Abos + Anzahl offener regulärer Anfragen für diesen Kurs.

### C) Tech-Entscheidungen (Begründung)

- **Serverseitige, geschützte Kapazitätsprüfung + Nachrück-Logik:** Verhindert, dass zwei gleichzeitige Anfragen sich denselben letzten Platz streitig machen, oder dass ein Wartelisten-Eintrag doppelt nachrückt.
- **Nachrückung = normale offene Buchungsanfrage:** Kein zweiter Bestätigungs-Mechanismus, Admin sieht und bearbeitet nachgerückte Anfragen genau wie jede andere.
- **Live berechnete Position statt gespeicherter Zahl:** Immer korrekt, ohne Synchronisationsaufwand.
- **Kapazität/Preis als optionale Felder:** Bestehende Kurse und der bestehende Buchungsablauf bleiben unverändert, bis Admin aktiv einen Wert einträgt.

### D) Abhängigkeiten (Pakete)

Keine neuen Fremdpakete nötig.

## Implementation Notes

**Datenbank (Migrationen):**
- `courses.max_participants` (nullable int), `courses.price` (nullable numeric) — optionale Felder, kein Migrations-Aufwand für bestehende Kurse.
- Neue Tabelle `waitlist_entries` (id, course_id, customer_id, desired_plan, chosen_date, created_at) mit RLS: Kunde sieht/löscht nur eigene Einträge, Admin sieht/löscht alle; keine INSERT-Policy (Einträge entstehen ausschließlich über die `join_waitlist`-Funktion).
- Vier neue `SECURITY DEFINER`-Funktionen (alle mit `anon` explizit per `revoke` gesperrt, nur `authenticated` darf ausführen):
  - `create_regular_course_booking(...)` — sperrt die Kurszeile (`SELECT ... FOR UPDATE`), prüft Kapazität und Duplikat-Anfrage, legt die offene Buchung an. Dieser Row-Lock ist der Kern der Race-Condition-Sicherheit aus den Akzeptanzkriterien: zwei gleichzeitige Anfragen für den letzten Platz werden durch Postgres serialisiert, nicht nur durch einen Lese-dann-Schreibe-Check auf Anwendungsebene.
  - `join_waitlist(...)` — validiert erneut, dass der Kurs wirklich voll ist, und verhindert Mehrfacheinträge (aktives Abo/offene Anfrage/bereits auf Warteliste).
  - `promote_waitlist_for_course(p_course_id)` — rückt in einer Schleife so viele Wartelisten-Einträge nach, wie Kapazität frei ist; erzeugt dabei ganz normale offene `course_bookings`-Zeilen (kein separater Bestätigungspfad).
  - `list_my_waitlist()` — da RLS Kunden nur die eigenen Wartelisten-Zeilen zeigt, berechnet diese Funktion serverseitig (unter Umgehung von RLS, aber gefiltert auf `auth.uid()`) die exakte Position pro Eintrag, ohne andere Kunden preiszugeben.
- `promote_waitlist_for_course` wird nach jedem der drei im Spec genannten Auslöser aufgerufen: Abo wird wirksam storniert/gelöscht (`applyPendingChange`, `deleteSubscription`, `updateSubscription`), offene Anfrage abgelehnt (`rejectBooking`), Kapazität erhöht (`updateCourse`).

**Frontend/Server Actions:**
- `src/lib/actions/waitlist.ts` (Kunde: `joinWaitlist`, `leaveWaitlist`), `src/lib/actions/admin/waitlist.ts` (Admin: `removeWaitlistEntry`).
- `BookingDialog` erkennt `isFull`/`isOnWaitlist` und zeigt statt des Anmeldeformulars einen Hinweis + „Auf Warteliste eintragen"-Button (weiterhin hinter dem SEPA-Mandat-Gate, wie im Spec gefordert).
- Kurskatalog, Kursdetailseite: „Ausgebucht"-Badge, wenn Kapazität erreicht.
- `/admin/kurse`: neue Formularfelder „Max. Teilnehmer"/„Preis", neue Spalte „Kapazität" (belegt/max) und „Warteliste" mit Dialog (Position, Kunde, Abo-Art, Termin, Entfernen-Button).
- `/admin/buchungen`: Preisfeld im Bestätigungsdialog wird mit dem festen Kurspreis vorausgefüllt, wenn vorhanden.
- `/profil`: neuer Abschnitt „Meine Warteliste" mit exakter Position und Selbst-Austragen-Button.

**Abweichung von der ursprünglichen Architektur-Planung:** Die Tech-Design-Phase hatte für die reguläre Kursanmeldung ursprünglich einen einfachen sequenziellen Vorab-Check vorgesehen (wie die übrigen Checks in `booking.ts`). Beim Umsetzen wurde das gegen den expliziten Akzeptanzkriterium/Edge-Case „race-condition-sicher zum Zeitpunkt der Anfrage" geprüft und durch die atomare, zeilengesperrte Funktion `create_regular_course_booking` ersetzt — sonst hätten zwei gleichzeitige Anfragen für den letzten Platz beide durchkommen können.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
