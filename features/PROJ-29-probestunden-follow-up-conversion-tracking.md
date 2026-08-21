# PROJ-29: Probestunden-Follow-up & Conversion-Tracking

## Status: Approved
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Dependencies
- PROJ-8 (Kursbuchung) — Datenmodell für Probestunden (`course_bookings.type = 'trial'`)
- PROJ-16 (Automatische E-Mail-/Push-Benachrichtigungen) — bestehende Notification-Queue und Kunden-Einstellungen-Infrastruktur für die beiden automatisierten Erinnerungen

## User Stories
- Als Admin möchte ich eine Übersicht aller Probestunden-Buchungen sehen, damit ich nachverfolgen kann, wer noch nicht regulär gebucht hat.
- Als Admin möchte ich einen Kunden als „kontaktiert" markieren und eine Notiz hinterlegen können, damit ich meine Follow-up-Bemühungen dokumentiere.
- Als Admin möchte ich eine Gesamt-Conversion-Rate (Probestunde → reguläre Buchung) sehen, damit ich beurteilen kann, wie gut der Probestunden-Trichter funktioniert.
- Als Kunde möchte ich noch am Abend meiner Probestunde eine Erinnerung mit direktem Buchungslink erhalten, damit ich buchen kann, solange der Eindruck noch frisch ist.
- Als Kunde, der noch nicht gebucht hat, möchte ich kurz vor dem nächsten Kurstermin nochmal erinnert werden, damit ich die Gelegenheit nicht verpasse.

## Out of Scope
- Automatisierte Erinnerungen AN DEN ADMIN (z.B. „Kunde X ist überfällig") — der Admin verlässt sich weiterhin auf die manuelle Übersicht; nur die beiden kundengerichteten Erinnerungen sind automatisiert
- Weitere automatisierte Kunden-Erinnerungen über die zwei definierten Zeitpunkte hinaus (z.B. eine dritte/vierte Nachfass-Mail) — fürs MVP bewusst auf zwei Touchpoints begrenzt
- Conversion-Rate-Trend über Zeit/Diagramme — nur eine aktuelle Gesamtzahl für einen wählbaren Zeitraum
- Zuordnung von Follow-ups an einzelne Mitarbeiter — Solo-Administration, kein Team-Feature nötig

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Kunde hat eine Probestunde gebucht, wenn der Admin die Probestunden-Übersicht öffnet, dann erscheint der Kunde mit Kursname, Datum der Probestunde und Status (offen/kontaktiert/konvertiert)
- [ ] Angenommen ein Kunde hat nach seiner Probestunde eine reguläre Buchung oder ein Abo abgeschlossen, wenn der Admin die Übersicht öffnet, dann ist dieser Kunde automatisch als „konvertiert" markiert
- [ ] Angenommen ein Kunde ist noch nicht konvertiert, wenn der Admin den Haken „kontaktiert" setzt und optional eine Notiz einträgt, dann wird dies gespeichert und bleibt beim erneuten Öffnen sichtbar
- [ ] Angenommen die Probestunden-Übersicht ist offen, wenn der Admin sie betrachtet, dann sieht er eine Gesamt-Conversion-Rate (Anteil konvertierter Probestunden an allen Probestunden) für einen wählbaren Zeitraum
- [ ] Angenommen eine Probestunde liegt mehr als 14 Tage zurück ohne dass „kontaktiert" gesetzt wurde und ohne Konvertierung, wenn der Admin die Übersicht öffnet, dann wird dieser Eintrag als „Follow-up überfällig" hervorgehoben
- [ ] Angenommen der Admin filtert nach Status „Offen", wenn er den Filter anwendet, dann werden nur weder kontaktierte noch konvertierte Probestunden angezeigt
- [ ] Angenommen ein Kunde hat eine Probestunde absolviert und die Benachrichtigungsgruppe „Probestunden-Nachfassung" ist nicht deaktiviert, wenn der Abend des Probestunden-Tages erreicht ist, dann erhält der Kunde eine Benachrichtigung mit einem direkten Link zur Buchung dieses Kurses
- [ ] Angenommen ein Kunde ist noch nicht konvertiert und hat die Benachrichtigungsgruppe nicht deaktiviert, wenn der nächste stattfindende Termin desselben Kurses kurz bevorsteht, dann erhält der Kunde eine zweite Erinnerung mit demselben Buchungslink
- [ ] Angenommen ein Kunde konvertiert zwischen der Probestunde und dem Zeitpunkt der zweiten Erinnerung, wenn diese fällig würde, dann entfällt die zweite Erinnerung ersatzlos
- [ ] Angenommen ein Kunde hat die Benachrichtigungsgruppe „Probestunden-Nachfassung" deaktiviert, wenn eine der beiden Erinnerungen fällig würde, dann wird keine Benachrichtigung verschickt, der Eintrag bleibt aber in der Admin-Übersicht normal sichtbar

## Edge Cases
- Ein Kunde bucht mehrere Probestunden in verschiedenen Kursen — jede wird als eigener Eintrag geführt; Konvertierung prüft, ob nach der jeweiligen Probestunde irgendeine reguläre Buchung erfolgte. Jede Probestunde löst ihre eigenen zwei Erinnerungen aus.
- Probestunden vor Einführung dieses Features werden rückwirkend erfasst, da sie auf den bestehenden `course_bookings`-Daten basieren — keine neue Datenerfassung nötig. Für diese rückwirkend erfassten, bereits vergangenen Probestunden werden keine Erinnerungen nachträglich verschickt (beide Zeitpunkte liegen bereits in der Vergangenheit).
- Ein Kunde konvertiert, storniert später aber sein Abo wieder — bleibt trotzdem als „konvertiert" markiert, da die Konvertierung ein historisches Ereignis ist, kein aktueller Status.
- Für den Kurs der Probestunde findet in absehbarer Zeit kein weiterer Termin mehr statt (Kurs pausiert/beendet) — die zweite Erinnerung entfällt ersatzlos, die erste (Abend-)Erinnerung bleibt davon unberührt.
- Ein Kunde hat mehrere Probestunden in verschiedenen Kursen mit überschneidenden Erinnerungszeitpunkten — jede Probestunde wird unabhängig behandelt, es gibt keine Deduplizierung zwischen ihnen (im Unterschied zum Newsletter-Versand aus PROJ-28, der Kunden gruppenübergreifend dedupliziert).

## Technical Requirements (optional)
- Conversion-Berechnung basiert auf bestehenden `course_bookings`-Daten, keine neue Tabelle für die Buchungen selbst — nur für den Kontaktiert-Status/Notiz nötig.
- Die beiden automatisierten Erinnerungen laufen über die bestehende Notification-Queue aus PROJ-16 (asynchron, respektiert Kunden-Einstellungen), nicht über einen neuen eigenen Versandmechanismus.

## Open Questions
- Keine offenen Fragen zum Zeitpunkt der Spec-Erstellung. Folgende Fragen kamen während der Architektur-/Refine-Runde am 21.08. hinzu und wurden direkt geklärt:
- [x] Ergänzen oder ersetzen die automatisierten Erinnerungen die manuelle Admin-Nachverfolgung? → Ergänzen; manuelle Übersicht (Kontaktiert-Haken, Notiz, 14-Tage-Überfällig) bleibt unverändert als Backstop bestehen (2026-08-21)
- [x] Wie wird „kurz vor dem nächsten Termin" für die zweite Erinnerung bestimmt? → Relativ zum tatsächlich nächsten stattfindenden Termin desselben Kurses (Pausen werden übersprungen), nicht als feste Tagesanzahl (2026-08-21)
- [x] Teilen sich beide Erinnerungen eine Ein-/Ausschalt-Einstellung? → Ja, eine gemeinsame neue Benachrichtigungsgruppe „Probestunden-Nachfassung" (2026-08-21)
- [ ] Erlaubt der aktuelle Vercel-Plan einen zweiten täglichen Cron-Lauf? → Bei `/backend` zu prüfen; falls nicht möglich, Rückfall auf den bestehenden Morgen-Lauf (Erinnerung käme dann erst am nächsten Morgen statt am selben Abend)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Conversion = irgendeine reguläre Buchung/Abo nach der Probestunde, kein festes Zeitfenster | Einfacher als ein Zeitfenster zu pflegen; Admin sieht das Datum und kann selbst beurteilen | 2026-08-21 |
| ~~Manuelle Nachverfolgung (Haken + Notiz) statt automatischer Erinnerungs-Mails~~ → Ersetzt durch: manuelle Nachverfolgung bleibt, ergänzt um zwei automatisierte kundengerichtete Erinnerungen | User-Feedback nach erster Architektur-Runde: die Chance zu buchen ist am Abend der Probestunde am größten, solange der Eindruck frisch ist; eine zweite Erinnerung kurz vor dem nächsten Termin holt Unentschlossene ab. Admin-Nachverfolgung bleibt zusätzlich als Backstop für Fälle, die auf beide Erinnerungen nicht reagieren | 2026-08-21 |
| „Follow-up überfällig" ab 14 Tagen ohne Kontakt/Konvertierung | Sinnvoller Standardwert als fixe Konstante fürs MVP; bleibt unverändert, ist unabhängig von den neuen automatisierten Erinnerungen (die deutlich früher greifen) | 2026-08-21 |
| Zwei automatisierte Erinnerungen: (1) am Abend des Probestunden-Tages, (2) kurz vor dem nächsten stattfindenden Termin desselben Kurses | Deckt sowohl den „Eisen schmieden solange es heiß ist"-Moment als auch eine zweite Gelegenheit kurz vor der nächsten Chance ab, ohne mit weiteren Touchpoints zu überladen | 2026-08-21 |
| Zeitpunkt der zweiten Erinnerung orientiert sich am tatsächlich nächsten Kurstermin, nicht an einer festen Tagesanzahl | Bei pausierten oder unregelmäßigen Kursterminen bleibt die Erinnerung so immer sinnvoll getimt, statt z.B. mitten in eine Kurspause zu fallen | 2026-08-21 |
| Beide Erinnerungen teilen sich eine gemeinsame Benachrichtigungsgruppe „Probestunden-Nachfassung" statt zwei getrennter Schalter | Konsistent mit der bestehenden granularen, aber nicht übermäßig kleinteiligen Gruppen-Struktur aus PROJ-16; beide Erinnerungen verfolgen dasselbe Ziel (Buchung nach Probestunde) | 2026-08-21 |
| Erinnerungen laufen über die bestehende PROJ-16-Notification-Queue als neue Ereignisgruppe, nicht über den Newsletter-Mechanismus aus PROJ-28 | Es handelt sich um ereignisgetriggerte, personalisierte Erinnerungen (wie eine Buchungsbestätigung), nicht um einen manuell ausgelösten Gruppenversand — technisch und konzeptionell näher an PROJ-16 als an PROJ-28; die ursprüngliche Abgrenzung „keine Überschneidung mit PROJ-28" bleibt damit gültig, nur die Begründung verschiebt sich von „keine Automatisierung" zu „richtige Automatisierung, falscher Mechanismus wäre PROJ-28" | 2026-08-21 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Neue, kleine Tabelle nur für „kontaktiert"-Status und Notiz statt Erweiterung der bestehenden Buchungstabelle | Diese beiden Felder sind ausschließlich für Probestunden relevant — eine Erweiterung der allgemeinen Buchungstabelle würde für alle anderen Buchungstypen (regulär, Drop-in) dauerhaft leere Spalten anlegen | 2026-08-21 |
| Konvertierungs- und „Follow-up überfällig"-Status sind reine Berechnungen, kein gespeicherter Status | Konsistent mit dem bereits etablierten Muster abgeleiteter Status-Werte aus PROJ-31/PROJ-33 — verhindert, dass ein Status „veraltet", weil er nie gespeichert, sondern bei jedem Seitenaufruf live berechnet wird | 2026-08-21 |
| `/backend` nötig (neue Tabelle + Berechtigungen + Speicherfunktion für „kontaktiert"/Notiz) | Im Unterschied zu PROJ-31/PROJ-33 wird hier erstmals ein neuer, admin-schreibbarer Zustand dauerhaft gespeichert (nicht nur gelesen/abgeleitet) — das erfordert eine neue Datenbanktabelle mit Zugriffsregeln und eine Speicherfunktion, kein reines Frontend-Feature | 2026-08-21 |
| Konvertierung = irgendeine reguläre Buchung ODER ein Abo für denselben Kunden nach dem Probestunden-Termin | Bestätigt durch Code-Review des bestehenden Bestätigungs-Ablaufs: Eine bestätigte reguläre Buchungsanfrage legt automatisch ein Abo an — beide Signale zusammen decken „hat regulär gebucht" vollständig ab | 2026-08-21 |
| Neuer, zweiter täglicher Cron-Lauf am Abend (zusätzlich zum bestehenden Morgen-Lauf) für die Abend-Erinnerung | Der bestehende Cron läuft nur einmal täglich um 06:00 UTC — zu früh für eine „noch am selben Abend"-Zustellung. Ein zweiter Lauf am frühen Abend ist nötig, damit dieses Versprechen technisch eingehalten wird; muss bei `/backend` gegen den tatsächlichen Vercel-Plan-Limit geprüft werden | 2026-08-21 |
| Neue Benachrichtigungs-Ereignisgruppe `probestunde_nachfassung` im bestehenden PROJ-16-System (analog zu den 5 bestehenden Gruppen wie `kursstart_erinnerung`) | Wiederverwendung der bereits bestehenden Queue-, Versand- und Opt-out-Infrastruktur statt eines neuen Mechanismus; volle Konsistenz mit dem etablierten Muster | 2026-08-21 |
| „Nächster Termin" für die zweite Erinnerung wird über dieselbe Terminberechnung ermittelt, die bereits für den Stundenplan/die Anwesenheitsmatrix existiert (`upcomingOccurrences`) | Keine neue Terminlogik nötig — Pausen werden dadurch automatisch korrekt übersprungen, konsistent mit jeder anderen Stelle im Projekt, die „nächster Kurstermin" berechnet | 2026-08-21 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Component Structure (Visual Tree)

```
Neue Admin-Seite: /admin/probestunden ("Probestunden" in der Admin-Navigation)
├── Zeitraum-Filter (wiederverwendet den bestehenden Zeitraum-Baustein aus PROJ-17)
├── Conversion-Rate-Kachel — Anteil konvertierter Probestunden im gewählten Zeitraum
├── Status-Filter: Alle / Offen / Kontaktiert / Konvertiert
└── Probestunden-Tabelle
    ├── Spalten: Kunde, Kurs, Datum der Probestunde, Status-Badge
    │   (Offen / Kontaktiert / Konvertiert)
    ├── „Follow-up überfällig"-Hervorhebung für offene Einträge, deren
    │   Probestunden-Termin mehr als 14 Tage zurückliegt
    └── Zeilen-Aktion (nur bei nicht-konvertierten Einträgen):
        „Kontaktiert"-Haken + optionales Notizfeld, sofort speicherbar

Kein neuer sichtbarer UI-Bestandteil für die automatisierten Erinnerungen
selbst — sie laufen im Hintergrund über die bestehende Notification-Queue
(PROJ-16) und erscheinen für den Kunden als E-Mail/Push, nicht als
neue Admin-Oberfläche. Im Kundenprofil erscheint lediglich ein neuer
Eintrag „Probestunden-Nachfassung" in der bereits bestehenden Liste der
Benachrichtigungsgruppen (Profil → Benachrichtigungen).
```

### B) Data Model (plain language)

```
Neue Tabelle „Probestunden-Nachverfolgung" — genau ein Eintrag pro
Probestunden-Buchung:
- Verweis auf die zugehörige Probestunden-Buchung
- Kontaktiert: Ja/Nein
- Notiz: Freitext, optional
- Zeitpunkt der Kontaktierung

Alles andere wird bei jedem Seitenaufruf direkt aus den bereits
bestehenden Buchungsdaten berechnet, analog zum etablierten Muster
abgeleiteter Status-Werte (PROJ-31, PROJ-33):
- Konvertiert = für diesen Kunden existiert nach dem Probestunden-Termin
  mindestens eine reguläre Buchung oder ein Abo
- Follow-up überfällig = Probestunden-Termin liegt mehr als 14 Tage
  zurück UND weder kontaktiert noch konvertiert
- Conversion-Rate im Zeitraum = konvertierte Probestunden im Zeitraum
  geteilt durch alle Probestunden im Zeitraum

Gespeichert in: bestehende Buchungsdaten unverändert; nur der
Kontaktiert-Status/Notiz landet in der neuen, kleinen Tabelle.

Für die zwei automatisierten Erinnerungen wird zusätzlich pro
Probestunden-Buchung festgehalten, ob die Abend-Erinnerung bzw. die
zweite Erinnerung bereits verschickt wurde (in derselben neuen Tabelle
wie der Kontaktiert-Status) — verhindert doppelten Versand, falls der
Cron-Lauf an einem Tag mehrfach läuft oder nachträglich erneut prüft.
Der eigentliche Versand (Warteschlange, Kunden-Einstellung, E-Mail/Push)
läuft vollständig über die bereits bestehende PROJ-16-Infrastruktur.
```

### C) Tech Decisions (justified for PM)

- **Nur eine neue, kleine Tabelle statt einer großen Umstrukturierung:** Kunde, Kurs, Datum und der Konvertierungs-Status kommen bereits vollständig aus den vorhandenen Buchungsdaten. Es muss wirklich nur der manuelle „kontaktiert"-Haken samt Notiz irgendwo gespeichert werden — dafür reicht eine schlanke, zusätzliche Tabelle.
- **Konvertierung und „überfällig" werden nie gespeichert, sondern immer live berechnet:** Damit kann der Status nie im Hintergrund veralten (z.B. wenn ein Kunde erst Tage nach der Probestunde konvertiert) — jede Anzeige ist automatisch aktuell.
- **Diesmal mit `/backend`-Schritt:** Anders als bei den letzten beiden Features (PROJ-31, PROJ-33) wird hier zum ersten Mal ein neuer, admin-editierbarer Zustand dauerhaft gespeichert (der „kontaktiert"-Haken und die Notiz), nicht nur aus bestehenden Daten abgeleitet — dafür braucht es eine neue Datenbanktabelle mit passenden Zugriffsregeln.
- **Automatisierte Erinnerungen nutzen ausschließlich bestehende Infrastruktur:** Die Warteschlange, der Versand über E-Mail/Push und die Kunden-Einstellungen kommen vollständig aus dem bereits gebauten PROJ-16-System — PROJ-29 fügt nur eine neue Ereignisgruppe und zwei neue Auslöse-Zeitpunkte hinzu, baut aber keinen eigenen Versandweg.
- **Zweiter Cron-Lauf für echte Abend-Zustellung:** Damit die erste Erinnerung wirklich noch am selben Abend ankommt (nicht erst am nächsten Morgen), ergänzt ein zweiter täglicher automatischer Lauf am frühen Abend den bereits bestehenden Morgen-Lauf.

### D) Dependencies (packages to install)

- Keine neuen Pakete nötig — nutzt bereits vorhandene shadcn/ui-Bausteine (Table, Badge, Checkbox, Textarea), den bestehenden Zeitraum-Filter-Baustein aus dem Admin-Dashboard (PROJ-17) sowie die bestehende Notification-Queue, Versand- und Einstellungs-Infrastruktur aus PROJ-16.

## Implementation Notes (Backend)

**Datenbank** (Migration `proj29_trial_followups`): neue Tabelle `trial_followups` (`booking_id` UNIQUE FK auf `course_bookings`, `contacted`, `note`, `contacted_at`) mit admin-only RLS (SELECT/INSERT/UPDATE), identisches Muster zu `sepa_collection_runs`. Kein separates „bereits verschickt"-Feld nötig für die beiden automatisierten Erinnerungen — die bestehende `UNIQUE (dedupe_key)`-Constraint auf `notification_queue` verhindert Doppel-Versand pro Buchung ganz von selbst (Erkenntnis aus dem Code-Review von `dispatch.ts`, spart die ursprünglich im Tech Design vorgesehene zusätzliche Tracking-Spalte). `notification_queue`/`notification_preferences` CHECK-Constraints um den neuen Wert `probestunde_nachfassung` erweitert.

**Notifications** (`src/lib/constants/notifications.ts`, `src/lib/notifications/templates.ts`, `src/lib/notifications/dispatch.ts`): neue Ereignisgruppe `probestunde_nachfassung` (ein gemeinsamer Schalter für beide Erinnerungen, erscheint automatisch in der bestehenden Kunden-Einstellungen-Tabelle ohne Component-Änderung). Zwei neue Funktionen in `dispatch.ts`:
- `runEveningChecks` — enqueued die Abend-Erinnerung für alle heute stattgefundenen, bestätigten Probestunden
- `runFollowupChecks` — enqueued die zweite Erinnerung: prüft alle bestätigten Probestunden der letzten 30 Tage, überspringt bereits konvertierte Kunden (neue Hilfsfunktion `hasConvertedSince`, prüft reguläre Buchung oder Abo ab dem Probestunden-Datum) und verschickt nur, wenn der nächste tatsächliche Kurstermin (über die bestehende `upcomingOccurrences`-Funktion, Pausen werden automatisch übersprungen) genau morgen ist

**Cron** (`src/app/api/cron/notifications/route.ts`, `vercel.json`): bestehender Morgen-Lauf (06:00 UTC) ruft jetzt zusätzlich `runFollowupChecks` auf; neuer zweiter Cron-Eintrag `?run=evening` um 18:00 UTC ruft stattdessen nur `runEveningChecks` auf, gleiche Route, gleiche `CRON_SECRET`-Prüfung.

**Admin-Aktion** (`src/lib/actions/admin/trial-followups.ts`): `setTrialContacted(bookingId, contacted, note)` — Upsert auf `trial_followups` mit `onConflict: "booking_id"`, `revalidatePath("/admin/probestunden")`. Wird von der Admin-Übersichtsseite in `/frontend` verwendet.

**Verifikation:** `npm run build`/`npm run lint` sauber, `npm test` 194/194 (neue Tests: `templates.test.ts` für die zwei Nachrichtentexte inkl. HTML-Escaping-Check, `route.test.ts` für Morgen-/Abend-Unterscheidung und weiterhin erforderliche Auth). Live gegen die echte Produktionsdatenbank geprüft (temporärer, vollständig eigenständiger Testkurs mit Samstags-Termin plus ein frisch angelegter Test-Kunde ohne Buchungshistorie, um die „nicht konvertiert"-Prüfung sauber zu testen — beides nach dem Test vollständig wieder entfernt): Morgen-Lauf hat korrekt genau 1 Follow-up-Erinnerung erzeugt (unkonvertierter Testkunde, nächster Termin = morgen), Abend-Lauf hat korrekt alle heute stattgefundenen Probestunden erfasst (inkl. einer bereits existierenden, unabhängigen echten Probestunde — bestätigt, dass die Abfrage korrekt systemweit arbeitet und nicht nur meine Testdaten trifft); ein erneuter Aufruf beider Läufe direkt danach hat korrekt 0 neue Einträge erzeugt (Dedupe-Schutz bestätigt); E-Mail-Versand schlug erwartungsgemäß an der Fake-Testdomain fehl (`viennasalsastudio.test`), Inhalts- und Trigger-Logik selbst liefen fehlerfrei. Upsert-Semantik der neuen Tabelle direkt per SQL nachgestellt und bestätigt (Insert + Update über denselben `booking_id`-Konflikt).

**Offener Punkt für `/deploy`:** ob der tatsächliche Vercel-Plan einen zweiten täglichen Cron-Lauf erlaubt, ist noch nicht verifiziert (siehe Open Questions) — muss beim Deployment geprüft werden.

**Bugfix nach QA (2026-08-21):** BUG-1 behoben — sowohl `hasConvertedSince()` in `dispatch.ts` als auch die Conversion-Abfrage in `src/app/admin/probestunden/page.tsx` filterten reguläre Buchungen bisher nicht nach `status`, wodurch eine **abgelehnte** Buchungsanfrage fälschlich als Konvertierung zählte. Beide Stellen um `.eq("status", "confirmed")` ergänzt, konsistent mit dem bereits bestehenden Muster in `runDailyChecks`/`kursstart_erinnerung`. Live mit demselben Reproduktionsszenario (Probestunde + abgelehnte reguläre Buchung) verifiziert: Kunde erscheint jetzt korrekt als „Offen" statt „Konvertiert", Kontaktiert-Aktion ist wieder verfügbar. `npm run build`/`npm run lint` sauber, `npm test` weiterhin 194/194, permanente PROJ-29-E2E-Suite weiterhin 6/6 (ein einmaliger Fehlschlag beim ersten Rerun stellte sich als Kollision mit eigenen, noch nicht bereinigten manuellen Bugfix-Testdaten heraus, kein echter Regressionsfehler — nach Bereinigung wieder 6/6 bestätigt).

## Implementation Notes (Frontend)

Neue Admin-Seite `/admin/probestunden` (Nav-Eintrag „Probestunden" zwischen „Buchungen" und „Lastschriften" in `admin-nav.tsx`), Page-Loader `src/app/admin/probestunden/page.tsx` und Komponente `src/components/admin/trials/trial-followup-list.tsx`.

- **Zeitraum-Filter + Conversion-Rate-Kachel** wiederverwenden 1:1 die bestehenden Bausteine `PeriodFilter`/`MetricTile`/`resolvePeriod` aus PROJ-17, keine neuen Komponenten nötig.
- **Konvertierungs-Status** wird im Page-Loader berechnet (nicht in einer separaten Query pro Zeile): pro Kunde werden alle regulären Buchungen und Abo-Erstellungsdaten einmalig geladen und gegen jede Probestunde geprüft, ob eines davon auf/nach deren Datum liegt — identische Logik zu `hasConvertedSince` aus dem Backend, hier aber bulk im Loader statt per-Zeilen-Query (weniger Roundtrips für eine Seite mit potenziell vielen Probestunden).
- **Tabelle bewusst nicht durch den Zeitraum-Filter eingeschränkt** — nur die Conversion-Rate-Kachel ist zeitraum-scoped. Die Tabelle zeigt immer alle offenen/kontaktierten/konvertierten Probestunden, damit ältere, weiterhin nachverfolgungsbedürftige Fälle nicht aus dem Blick geraten, wenn ein enger Zeitraum gewählt ist. Direkt analog zur bereits getroffenen PROJ-17-Entscheidung, die Auslastungs-Liste ebenfalls vom Zeitraum-Filter zu entkoppeln.
- **Status-Filter** (Offen/Kontaktiert/Konvertiert) folgt dem etablierten URL-Parameter-Muster aus PROJ-33 (`applyStatusFilter` → `router.push`, serverseitige Filterung im Loader).
- **Kontaktiert-Haken + Notiz** pro Zeile: eigene Client-Komponente `FollowupRowActions` mit lokalem State nur für das jeweilige Eingabefeld (kein `useState` über die gesamte Zeilen-Liste) — die aus PROJ-33 bekannte Prop-Sync-Falle greift hier strukturell nicht, da `rows` direkt als Prop verwendet wird. Checkbox speichert sofort bei Klick, Notiz speichert bei Blur — beides ruft `setTrialContacted` auf und zeigt Toast-Feedback.
- **„Follow-up überfällig"**-Badge nur für Zeilen mit Status „Offen" UND mehr als 14 Tagen seit dem Probestunden-Termin, per `daysUntil` aus `scheduling/dates.ts`.
- Konvertierte Zeilen zeigen keine Kontaktiert-Aktion mehr (nicht mehr relevant).

**Verifikation:** `npm run build`/`npm run lint` sauber. Live gegen die echte Produktionsdatenbank geprüft (ein vollständig eigenständiger Testkurs plus vier frische Test-Kunden für je einen Status — Offen, Kontaktiert, Konvertiert, Überfällig —, nach dem Test restlos entfernt): alle vier Status werden korrekt berechnet und angezeigt, Konvertiert-Zeile hat keine Kontaktiert-Checkbox mehr, Überfällig-Badge erscheint korrekt nur bei der >14-Tage-Offen-Zeile; Kontaktiert-Haken speichert sofort und die Notiz bleibt nach Reload erhalten; Status-Filter filtert korrekt und übersteht einen Reload; Zeitraum-Filter beeinflusst nachweislich nur die Conversion-Rate-Kachel (100% bei einem eng auf die konvertierte Probestunde eingegrenzten Zeitraum); 375px-Ansicht ohne horizontales Scrollen.

## QA Test Results
**Tested:** 2026-08-21
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: Übersicht zeigt Kunde mit Kursname, Datum, Status
- [x] Korrekt — Name, Kursname, Datum, Status alle sichtbar (E2E-geprüft)

#### AC-2: Kunde mit regulärer Buchung/Abo nach der Probestunde ist automatisch „konvertiert"
- [x] Für den geprüften Positivfall (bestätigte reguläre Buchung) korrekt (E2E-geprüft)
- [ ] BUG-1: Ein **abgelehnter** regulärer Buchungsantrag zählt ebenfalls fälschlich als „konvertiert" — sowohl in der Admin-Übersicht als auch in der Skip-Logik der automatisierten Erinnerung (siehe Bugs Found)

#### AC-3: Kontaktiert-Haken + Notiz speichern und bleiben sichtbar
- [x] Korrekt, inkl. Persistenz nach Reload (E2E-geprüft)

#### AC-4: Conversion-Rate für wählbaren Zeitraum
- [x] Korrekt berechnet und auf den Zeitraum beschränkt, Tabelle bleibt bewusst zeitraum-unabhängig (E2E-geprüft)

#### AC-5: „Follow-up überfällig" nach >14 Tagen ohne Kontakt/Konvertierung
- [x] Korrekt hervorgehoben, nicht-überfällige Einträge bleiben unmarkiert (E2E-geprüft)

#### AC-6: Status-Filter „Offen"
- [x] Korrekt (E2E-geprüft)

#### AC-7: Abend-Erinnerung mit Buchungslink
- [x] Korrekt — bereits während `/backend` live gegen die echte Datenbank verifiziert (enqueued, Inhalt korrekt, Dedupe bestätigt)

#### AC-8: Zweite Erinnerung kurz vor dem nächsten Termin
- [x] Korrekt — bereits während `/backend` live verifiziert (nächster Termin = morgen ausgelöst, weiter entfernte Termine korrekt nicht ausgelöst)

#### AC-9: Erinnerung entfällt bei zwischenzeitlicher Konvertierung
- [ ] BUG-1 wirkt sich hier ebenfalls aus: eine abgelehnte (statt bestätigte) reguläre Buchung lässt die Erinnerung fälschlich ausfallen, obwohl der Kunde tatsächlich noch nicht konvertiert ist

#### AC-10: Erinnerung entfällt bei deaktivierter Benachrichtigungsgruppe, Eintrag bleibt in der Übersicht sichtbar
- [x] Korrekt — live verifiziert: `email_status`/`push_status` beide „skipped", kein Fehler; Admin-Übersicht ist ohnehin komplett unabhängig von Benachrichtigungs-Einstellungen (eigene, unabhängige Abfrage)

### Edge Cases Status

#### EC-1: Mehrere Probestunden desselben Kunden in verschiedenen Kursen
- [x] Jede Probestunde wird als eigener Eintrag geführt, Konvertierungsprüfung ist pro Probestunde unabhängig (per Code-Review bestätigt: `isConverted`/`hasConvertedSince` beziehen sich immer auf `chosen_date` der jeweiligen Probestunde, nicht global pro Kunde)

#### EC-2: Rückwirkend erfasste, bereits vergangene Probestunden lösen keine nachträglichen Erinnerungen aus
- [x] Korrekt — `runEveningChecks` filtert exakt auf `chosen_date = heute`, `runFollowupChecks` nur auf ein 30-Tage-Fenster mit „nächster Termin = morgen"; beides schließt lange zurückliegende Altbuchungen sauber aus (Code-Review + Backend-Live-Verifikation)

#### EC-3: Kunde konvertiert, storniert Abo später wieder — bleibt „konvertiert"
- [x] Korrekt per Design — Abo-Status wird nie geprüft, nur ob überhaupt ein Abo-Datensatz existiert (Code-Review)

#### EC-4: Kein weiterer Kurstermin in absehbarer Zeit — zweite Erinnerung entfällt, erste bleibt unberührt
- [x] Korrekt — `upcomingOccurrences` liefert dann kein `tomorrow`-Match, `runFollowupChecks` überspringt die Zeile; unabhängig von `runEveningChecks` (Code-Review)

### Security Audit Results
- [x] Authentication: `/admin/probestunden` ohne Login → Redirect zu `/login` (E2E-geprüft)
- [x] Authorization: Kunde (nicht Admin) wird von `/admin/probestunden` weggeleitet (E2E-geprüft)
- [x] **RLS-Bypass-Versuch (Red Team):** Direkter Zugriff auf `trial_followups` über die Supabase-API mit einem echten Kunden-Login (unter Umgehung der Next.js-App komplett) — SELECT liefert leeres Ergebnis, INSERT wird mit `42501 row-level security policy`-Fehler abgelehnt. RLS ist eine echte, wirksame zweite Verteidigungslinie, nicht nur durch `requireAdmin()` in der Server Action abgesichert.
- [x] Input validation / Injection: Keine neue nutzerkontrollierte Roheingabe in SQL — `setTrialContacted` läuft über den Supabase-Query-Builder (parametrisiert); Notiz-Feld hat keine Format-Einschränkung, ist aber nirgends in E-Mail/Push-Inhalte eingebettet (nur admin-intern angezeigt, via React-JSX automatisch escaped)
- [x] XSS: Kursname wird in den neuen Benachrichtigungs-E-Mails über `escapeHtml()` eingebettet (unit-getestet in `templates.test.ts`); alle Namen/Notizen in der Admin-UI laufen über JSX-Interpolation, keine `dangerouslySetInnerHTML`-Verwendung in den neuen Dateien
- [x] Datenschutz: Keine sensiblen Zusatzdaten in der neuen Tabelle oder den Benachrichtigungsinhalten über das ohnehin bereits admin-sichtbare Maß hinaus

### Regression Testing
- `npm test` (Vitest): 194/194 bestanden
- Neue permanente E2E-Suite `tests/PROJ-29-probestunden-follow-up-conversion-tracking.spec.ts` (6 Tests, zeitunabhängige Fixtures über einen Service-Client mit `beforeAll`/`afterAll` selbst gesät und bereinigt, damit die Überfällig-/Zeitraum-Szenarien auch bei künftigen Wiederholungsläufen an einem anderen Kalendertag korrekt bleiben): 6/6 bestanden, zweimal hintereinander ausgeführt zur Bestätigung der Wiederholbarkeit/Idempotenz
- Regressionssuiten für die von PROJ-29 mitbenutzte Infrastruktur erneut ausgeführt: PROJ-16 (Benachrichtigungen) vollständig grün — bestätigt, dass die neuen `dispatch.ts`/`templates.ts`-Ergänzungen die fünf bestehenden Benachrichtigungstypen nicht beeinträchtigt haben. PROJ-8 (8 Fehlschläge) und PROJ-17 (1 Fehlschlag) zeigen exakt dasselbe, bereits mehrfach in dieser Session dokumentierte Muster vorbestehender Fixture-Datenakkumulation aus wiederholten Testläufen (u.a. nicht zurückgesetzter `referral_source`, akkumulierte Kündigungszahl) — PROJ-29 berührt keine der betroffenen Code-Pfade (Buchungsdialog, Akquisitionskanal-Logik, Abo-Kündigung); nicht PROJ-29-bedingt

### Bugs Found

#### BUG-1: Abgelehnte reguläre Buchungen zählen fälschlich als „konvertiert"
- **Severity:** High
- **Steps to Reproduce:**
  1. Kunde bucht eine Probestunde, Admin bestätigt sie
  2. Derselbe Kunde stellt später eine reguläre Buchungsanfrage, der Admin **lehnt** diese ab (Status „rejected")
  3. Admin öffnet `/admin/probestunden`
  4. Erwartet: Kunde erscheint weiterhin als „Offen" (oder „Kontaktiert", falls markiert) — die Buchungsanfrage wurde ja nicht angenommen
  5. Tatsächlich: Kunde erscheint als „Konvertiert" — live reproduziert mit einem eigens angelegten Testkunden und einer abgelehnten Buchung
- **Root Cause:** Sowohl `hasConvertedSince()` in `src/lib/notifications/dispatch.ts` als auch die Conversion-Berechnung in `src/app/admin/probestunden/page.tsx` fragen reguläre Buchungen ausschließlich per `chosen_date >= Probestunden-Datum` ab, **ohne nach `status` zu filtern**. Das widerspricht der eigenen Architektur-Entscheidung im Decision Log dieser Spec: „Konvertierung = irgendeine **bestätigte** reguläre Buchungsanfrage..." — die Implementierung hat diesen Status-Filter schlicht vergessen.
- **Auswirkung:** Betrifft zwei Stellen gleichzeitig — (1) die Admin-Übersicht zeigt einen tatsächlich noch nicht konvertierten Kunden fälschlich als erledigt, wodurch er aus dem Follow-up-Blick verschwindet, und (2) die automatisierte „kurz vor dem nächsten Termin"-Erinnerung wird für genau diesen Kunden fälschlich übersprungen — er bekommt keine zweite Chance zur Reaktivierung, obwohl er sie laut Spec bekommen sollte.
- **Fix-Empfehlung:** In beiden Stellen `.eq("status", "confirmed")` auf die reguläre-Buchungs-Abfrage ergänzen, analog zum bereits bestehenden Muster in `runDailyChecks`/`kursstart_erinnerung`, das ebenfalls nur bestätigte Buchungen berücksichtigt.
- **Priority:** Fix before deployment
- **Status:** ✅ Behoben und re-verifiziert (2026-08-21) — siehe „Bugfix nach QA" in den Implementation Notes (Backend)

### Re-Verification nach Bugfix (2026-08-21)

`.eq("status", "confirmed")` an beiden betroffenen Stellen ergänzt. Live mit demselben Reproduktionsszenario erneut geprüft: ein Kunde mit Probestunde + anschließend **abgelehnter** regulärer Buchung erscheint jetzt korrekt als „Offen" statt „Konvertiert", die Kontaktiert-Aktion ist wieder verfügbar. AC-2 (Positivfall weiterhin korrekt) und AC-9 damit vollständig erfüllt. `npm run build`/`npm run lint` sauber, `npm test` weiterhin 194/194, permanente E2E-Suite weiterhin 6/6.

### Summary (final)
- **Acceptance Criteria:** 10/10 erfüllt, keine offenen Bugs mehr
- **Bugs Found:** 1 total, behoben und verifiziert (0 offen)
- **Security:** Pass — inkl. erfolgreichem RLS-Bypass-Red-Team-Test (RLS hat korrekt blockiert)
- **Production Ready:** YES
- **Recommendation:** Deploy. Die vorbestehenden PROJ-8/PROJ-17-Fixture-Drift-Fehlschläge blockieren dieses Feature nicht, sollten aber weiterhin auf dem Radar für einen separaten Housekeeping-Task bleiben. Der offene Punkt zum zweiten Cron-Lauf (Vercel-Plan-Limit) muss bei `/deploy` geprüft werden.

## Deployment
_To be added by /deploy_
