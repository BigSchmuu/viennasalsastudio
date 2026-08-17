# PROJ-9: Abo-Verwaltung (Self-Service Pause/Kündigung)

## Status: Approved
**Created:** 2026-08-17
**Last Updated:** 2026-08-17

## Dependencies
- Requires: PROJ-2 (Auth & Kundenprofil) — Kunde muss eingeloggt sein
- Requires: PROJ-4 (Admin: Kunden-/Mitgliederverwaltung) — verwaltet dieselbe `subscriptions`-Tabelle
- Requires: PROJ-5 (Kurskatalog) — Kursauswahl beim Umbuchen
- Requires: PROJ-7 (SEPA-Lastschriftmandate) — der Sammel-Lastschriftlauf muss geplante Pausierungen/Kündigungen berücksichtigen, damit niemand nach der Kündigung noch eingezogen wird
- Requires: PROJ-8 (Kursbuchung) — reguläre Buchungsanfragen werden bei Bestätigung zu Abos; diese bekommen ab jetzt zusätzlich einen echten Kurs-Bezug (siehe Decision Log)

## User Stories
- Als Kunde möchte ich mein Abo selbst pausieren können, ohne den Betreiber anzurufen, damit ich z. B. bei Urlaub oder Verletzung flexibel bin.
- Als Kunde möchte ich mein Abo selbst kündigen können, damit ich die Kontrolle über meine laufenden Zahlungen habe.
- Als Kunde möchte ich eine geplante Pause/Kündigung vor dem Wirksamkeitsdatum wieder zurücknehmen können, falls ich es mir anders überlege.
- Als Kunde möchte ich ein pausiertes Abo selbst wieder aktivieren können, ohne auf den Admin zu warten.
- Als Kunde möchte ich mein Abo auf einen anderen Kurs umbuchen können, wenn ich z. B. den Wochentag wechseln möchte.
- Als Admin möchte ich sehen, welche Abos eine geplante Änderung haben und wann sie wirksam wird, damit ich den Überblick behalte.
- Als Admin möchte ich eine fällige geplante Änderung mit einem Klick übernehmen können, damit die Kundenliste aktuell bleibt.

## Out of Scope
- Automatische, zeitgesteuerte Umsetzung von geplanten Änderungen (z. B. per Cron) — es gibt noch keine Scheduling-Infrastruktur in der App; der Admin übernimmt fällige Änderungen manuell per Klick
- Rückerstattungen bereits eingezogener Beträge bei Kündigung — reine Statusverwaltung, keine Finanztransaktionen
- Umbuchen für Flatrate-Abos — ergibt keinen Sinn, da Flatrate bereits Zugang zu allen Kursen bietet; Umbuchen ist nur für Abos mit Kurs-Bezug verfügbar
- Reaktivierung eines gekündigten Abos — Kündigung ist endgültig; eine Rückkehr läuft über eine neue Buchungsanfrage (PROJ-8)
- Wartelisten-Logik beim Umbuchen (z. B. falls der Zielkurs "voll" wäre) — es gibt aktuell keine Kapazitätsgrenzen (siehe PROJ-8 Out of Scope), gilt auch hier
- Admin-seitige Massenbearbeitung mehrerer Abos gleichzeitig — bei erwarteter kleiner Kundenzahl im MVP nicht nötig (gleiche Begründung wie in PROJ-4)

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Kunde hat ein aktives Abo, wenn er „Pausieren" wählt, dann wird eine geplante Pausierung zum nächsten Zyklusende gespeichert; das Abo zeigt weiterhin „Aktiv" mit zusätzlichem Hinweis „Wird pausiert ab [Datum]"
- [ ] Angenommen ein Kunde hat ein aktives Abo, wenn er „Kündigen" wählt, dann wird eine geplante Kündigung zum nächsten Zyklusende gespeichert; das Abo zeigt weiterhin „Aktiv" mit zusätzlichem Hinweis „Wird gekündigt ab [Datum]"
- [ ] Angenommen ein Abo hat eine geplante Pausierung oder Kündigung, wenn der Kunde vor dem Wirksamkeitsdatum „Rückgängig machen" wählt, dann wird die geplante Änderung entfernt und das Abo zeigt wieder nur „Aktiv"
- [ ] Angenommen ein Abo ist pausiert, wenn der Kunde „Reaktivieren" wählt, dann wird der Status sofort auf „Aktiv" gesetzt, ohne Wartezeit
- [ ] Angenommen ein Abo ist gekündigt, wenn der Kunde sein Abo ansieht, dann gibt es keine Reaktivieren-Option
- [ ] Angenommen ein Kunde hat ein Abo mit Kurs-Bezug (nicht Flatrate), wenn er „Umbuchen" wählt und einen anderen Kurs auswählt, dann wird der Kurs-Bezug sofort geändert, der Preis bleibt unverändert
- [ ] Angenommen ein Kunde hat ein Flatrate-Abo, wenn er sein Abo ansieht, dann wird keine Umbuchen-Option angezeigt
- [ ] Angenommen der Admin erzeugt einen SEPA-Lastschriftlauf (PROJ-7) für ein Fälligkeitsdatum, wenn ein Abo eine geplante Pausierung/Kündigung mit Wirksamkeitsdatum am oder vor diesem Fälligkeitsdatum hat, dann wird dieses Abo nicht in den Lauf aufgenommen
- [ ] Angenommen ein Abo hat eine geplante Änderung, deren Wirksamkeitsdatum erreicht oder überschritten ist, wenn der Admin die Kundendetailseite öffnet, dann sieht er einen „Jetzt übernehmen"-Button; nach Klick wird der tatsächliche Status gesetzt und die geplante Änderung entfernt

## Edge Cases
- Kunde hat mehrere aktive Abos → jedes Abo wird einzeln mit eigenen Aktionen (Pausieren/Kündigen/Umbuchen/Reaktivieren) angezeigt
- Kunde hat noch kein Abo → „Mein Abo"-Bereich zeigt einen Leerzustand statt einer leeren Liste
- Admin legt für ein bestehendes Abo (aus PROJ-4, ohne Zyklus-Ankerdatum) noch kein Ankerdatum fest → Kunde kann trotzdem pausieren/kündigen; das System nutzt in diesem Fall ersatzweise das Erstellungsdatum des Abos als Ankerpunkt, bis der Admin ein echtes Ankerdatum einträgt
- Kunde versucht, dasselbe Abo gleichzeitig zu pausieren UND zu kündigen → nur eine geplante Änderung gleichzeitig möglich; eine neue Aktion (z. B. „Kündigen" nach bereits geplanter Pausierung) ersetzt die vorherige geplante Änderung
- Admin ändert den Preis eines Abos, während der Kunde eine Umbuchung durchführt → unabhängige Aktionen auf unterschiedlichen Feldern, keine Konflikte
- Zyklus-Ankerdatum liegt weit in der Vergangenheit (z. B. Abo läuft schon seit Monaten) → nächstes Zyklusende wird korrekt in die Zukunft projiziert (in 4-Wochen-Schritten vom Ankerdatum aus), nicht einfach Ankerdatum + 4 Wochen

## Technical Requirements (optional)
- Security: Ein Kunde darf ausschließlich eigene Abos einsehen/ändern (RLS-Muster aus PROJ-1); Kurs-Umbuchung ist auf tatsächlich existierende Kurse beschränkt (serverseitige Validierung, nicht nur Client-seitig)
- Konsistenz: Die Logik zur Berechnung des nächsten Zyklusendes muss exakt dieselbe sein, die auch beim Erzeugen eines SEPA-Laufs (PROJ-7) zur Ausschluss-Prüfung verwendet wird

## Open Questions
- [ ] Keine offenen Fragen

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Pausieren/Kündigen ist sofortiges Self-Service (kein Admin-Eingriff nötig), aber erst zum nächsten 4-Wochen-Zyklusende wirksam | Kern des Feature-Namens „Self-Service"; adressiert direkt den im PRD genannten Hauptschmerzpunkt. Der laufende Zyklus ist bereits eingeplant (Raum, Lehrer, ggf. SEPA-Lauf), ein sofortiger Wechsel mitten im Zyklus würde das durcheinanderbringen | 2026-08-17 |
| Kurse laufen in festen 4-Wochen-Zyklen, kein monatliches Modell | Reale Geschäftslogik des Studios | 2026-08-17 |
| Neues „Zyklus-Ankerdatum" pro Abo, vom Admin gepflegt, statt Erstellungsdatum des Abo-Datensatzes zu verwenden | Das Erstellungsdatum eines Abos im System entspricht nicht zuverlässig dem tatsächlichen Kursstart-Datum (Dateneingabe kann verzögert erfolgen) | 2026-08-17 |
| Geplante Änderung wird als Zusatz-Hinweis auf dem weiterhin „aktiven" Abo angezeigt, keine automatische zeitgesteuerte Umsetzung | Es gibt noch keine Scheduling-Infrastruktur in der App; ein manueller Admin-Klick nach Erreichen des Datums ist der pragmatische MVP-Ansatz statt neuer Infrastruktur | 2026-08-17 |
| Admin bekommt einen „Jetzt übernehmen"-Button für fällige geplante Änderungen | Hält die Kundenliste langfristig sauber, statt veraltete „Aktiv"-Status unbegrenzt stehen zu lassen | 2026-08-17 |
| SEPA-Lauf-Erzeugung (PROJ-7) schließt Abos mit fälliger geplanter Pausierung/Kündigung automatisch aus, auch wenn der Status noch „aktiv" ist | Verhindert, dass ein Kunde nach angekündigter Kündigung/Pause trotzdem eingezogen wird, ohne dass der Admin die geplante Änderung manuell vorher übernehmen muss | 2026-08-17 |
| Geplante Pausierung/Kündigung ist vor dem Wirksamkeitsdatum jederzeit selbst zurücknehmbar | Wichtig für Kunden, die es sich anders überlegen, ohne den Admin kontaktieren zu müssen | 2026-08-17 |
| Pausiertes Abo ist jederzeit sofort selbst reaktivierbar (keine feste Pause-Dauer) | Es gibt kein Rückkehrdatum bei einer Pause; ohne Self-Service-Reaktivierung bliebe das Abo sonst unbegrenzt pausiert | 2026-08-17 |
| Gekündigtes Abo ist NICHT reaktivierbar — Kündigung ist endgültig | Reale Bedeutung einer Kündigung; Rückkehr läuft bewusst über eine neue Buchungsanfrage (PROJ-8) mit erneuter Admin-Bestätigung | 2026-08-17 |
| Umbuchen auf einen anderen Kurs ist sofortige Selbstbedienung, unabhängig vom Zyklusende, Preis bleibt automatisch unverändert | Kurswechsel betrifft nicht die Abrechnung/Zyklus-Logik wie Pause/Kündigung; keine Notwendigkeit für eine Wartezeit | 2026-08-17 |
| `subscriptions` bekommt einen optionalen Kurs-Bezug (leer bei Flatrate-Abos) | Voraussetzung für echtes Umbuchen über eine Kursauswahl statt Freitext; bestehende Abos ohne Kurs-Bezug funktionieren weiter, zeigen aber kein Umbuchen an, bis der Admin optional einen Kurs zuordnet | 2026-08-17 |
| Neuer Bereich „Mein Abo" auf `/profil` | Es gab bisher keine Kunden-Ansicht der eigenen Abos überhaupt — Voraussetzung dafür, dass der Kunde sein Abo selbst verwalten kann | 2026-08-17 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Geplante Änderung wird direkt auf dem bestehenden Abo-Datensatz gespeichert (zwei zusätzliche Felder), keine eigene Tabelle | Es gibt laut Spec immer nur eine geplante Änderung gleichzeitig pro Abo — eine 1-zu-höchstens-1-Beziehung braucht keine eigene Tabelle | 2026-08-17 |
| Eine einzige, gemeinsam genutzte Zyklusende-Berechnung für Kundenanzeige UND SEPA-Lauf-Ausschluss-Prüfung | Verhindert Auseinanderdriften zwischen dem, was der Kunde als Wirksamkeitsdatum sieht, und dem, was der Lastschriftlauf tatsächlich berücksichtigt | 2026-08-17 |
| Umbuchen greift auf den bestehenden Kurskatalog zurück, keine separate Kursliste für Abo-Zwecke | Vermeidet Datenduplikation; Kunde sieht dieselben Kurse wie im Katalog | 2026-08-17 |
| PROJ-7s Lauf-Erzeugung wird direkt erweitert (zusätzlicher Ausschluss-Check), statt eine parallele Prüfung zu bauen | Eine einzige Stelle, die entscheidet, wer in einen Lauf kommt, ist weniger fehleranfällig als zwei getrennte Prüfungen | 2026-08-17 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Komponentenstruktur

**Kundenseite — neue Sektion auf `/profil`:**
```
/profil
└── Mein Abo (neue Sektion)
    ├── Leerzustand „Kein aktives Abo" (falls keins vorhanden)
    └── Pro Abo eine Karte: Name, Kurs (falls vorhanden), Preis, Status-Badge
        ├── Hinweis „Wird pausiert/gekündigt ab [Datum]" — nur bei geplanter Änderung
        └── Aktionen, je nach Zustand:
            ├── „Pausieren" / „Kündigen" — nur wenn aktiv und keine geplante Änderung
            ├── „Rückgängig machen" — nur wenn eine geplante Änderung existiert
            ├── „Reaktivieren" — nur wenn pausiert
            └── „Umbuchen" (öffnet Kursauswahl) — nur wenn ein Kurs-Bezug existiert (kein Flatrate)
```

**Admin — Erweiterung der bestehenden Abo-Verwaltung auf der Kundendetailseite (PROJ-4):**
```
Abo-Tabelle (bestehend)
└── Zusätzliche Anzeige pro Abo mit geplanter Änderung:
    ├── „Geplante Änderung: Pausierung/Kündigung ab [Datum]"
    └── „Jetzt übernehmen"-Button (nur sichtbar, wenn das Datum bereits erreicht ist)
```

### B) Datenmodell (fachlich)

**Abo** (bestehende Tabelle aus PROJ-4) wird um folgende Informationen erweitert:
- Zugehöriger Kurs (optional — leer bei Flatrate-Abos oder alten, noch nicht zugeordneten Abos)
- Zyklus-Ankerdatum — der Tag, an dem der aktuelle 4-Wochen-Abrechnungszyklus begonnen hat; vom Admin gepflegt
- Geplante Änderung (optional): „Pausierung" oder „Kündigung"
- Wirksamkeitsdatum der geplanten Änderung (das errechnete nächste Zyklusende zum Zeitpunkt der Anfrage)

Gespeichert in: derselben `subscriptions`-Tabelle aus PROJ-4 — keine neue Tabelle nötig, da es sich um zusätzliche Eigenschaften desselben Abo-Datensatzes handelt.

### C) Tech-Entscheidungen (Begründung)

- **Die Berechnung „nächstes Zyklusende" ist eine einzige, gemeinsam genutzte Logik:** Sowohl die Anzeige für den Kunden (wann wird meine Pause/Kündigung wirksam) als auch die Ausschluss-Prüfung beim Erzeugen eines SEPA-Laufs (PROJ-7) müssen exakt dasselbe Ergebnis liefern — sonst könnte ein Kunde z. B. eine Kündigung sehen, die der Lastschriftlauf trotzdem nicht berücksichtigt. Eine gemeinsame Logik verhindert dieses Auseinanderdriften.
- **Keine neue Tabelle für „geplante Änderungen":** Da es laut Spec immer nur eine geplante Änderung gleichzeitig pro Abo geben kann (eine neue Aktion ersetzt die vorherige), reichen zwei zusätzliche Felder auf dem bestehenden Abo-Datensatz — eine eigene Tabelle wäre unnötige Komplexität für eine 1-zu-höchstens-1-Beziehung.
- **Umbuchen nutzt den bestehenden Kurskatalog (PROJ-3/PROJ-5), keine neue Kursliste:** Der Kunde wählt aus denselben Kursen, die auch im Katalog sichtbar sind.
- **PROJ-7s Lauf-Erzeugung wird um einen zusätzlichen Ausschluss-Check erweitert, statt eine parallele, neue Prüfung aufzubauen:** Vermeidet doppelte, potenziell widersprüchliche Logik an zwei Stellen.
- **„Jetzt übernehmen" ist eine einfache, vom Admin ausgelöste Aktion, keine Hintergrundautomatik:** Passt zur bewussten Entscheidung, vorerst keine neue Scheduling-Infrastruktur einzuführen (siehe Decision Log der Spec).

### D) Abhängigkeiten (Pakete)
Keine neuen Fremdpakete nötig — alle UI-Bausteine sind mit den bereits installierten shadcn/ui-Komponenten umsetzbar, die Zyklus-Berechnung ist einfache Datumsarithmetik nach demselben Muster wie die Terminberechnung aus PROJ-8.

## Implementation Notes (Frontend/Backend)

### Datenbank & Sicherheit
- Migration `proj9_subscription_self_service`: `subscriptions` erweitert um `course_id` (FK auf `courses`, `on delete restrict`), `cycle_anchor_date` (backfilled aus `created_at` für Bestandsdaten), `pending_status` (check: `paused`/`cancelled`/`null`), `pending_effective_date`.
- Neue SQL-Funktion `next_cycle_end(p_anchor date)` — projiziert das nächste Zyklusende in 4-Wochen-Schritten ab dem Ankerdatum, korrekt auch bei weit in der Vergangenheit liegenden Ankerdaten.
- Vier `SECURITY DEFINER`-RPC-Funktionen für den Kunden-Schreibpfad (`self_schedule_subscription_change`, `self_undo_pending_change`, `self_reactivate_subscription`, `self_switch_subscription_course`) — jede erzwingt intern `customer_id = auth.uid()` plus Statusvorbedingungen. Ein direkter Spalten-`GRANT`-Ansatz wurde vor der Umsetzung verworfen, da Supabase Admin und Kunde dieselbe Postgres-Rolle (`authenticated`) zuweist und ein Spalten-Grant daher keine echte Einschränkung bewirkt hätte.
- Security-Advisor-Fund behoben: alle vier RPCs waren zusätzlich für `anon` ausführbar (Supabase vergibt `EXECUTE` beim Anlegen standardmäßig explizit an `anon`/`authenticated`/`service_role`, nicht über die generische `PUBLIC`-Rolle) — per gezieltem `REVOKE EXECUTE ... FROM anon` behoben und über `information_schema.routine_privileges` verifiziert.
- **Beim Live-Test gefundener und behobener Bug:** `self_switch_subscription_course` überschrieb bei jedem Kurswechsel zusätzlich den Namen des Abos mit dem Kursnamen (`name = v_course_name`), obwohl das laut Spec nicht vorgesehen war — ein vom Admin vergebener individueller Abo-Name wäre bei jedem Umbuchen stillschweigend verloren gegangen. Migration `proj9_fix_switch_course_preserves_name` entfernt das Überschreiben; die Funktion ändert jetzt ausschließlich `course_id`.

### Backend-Integration bestehender Features
- PROJ-7 (`createCollectionRun`): Query um `pending_effective_date` erweitert, zusätzlicher Ausschluss-Filter `!pending_effective_date || pending_effective_date > dueDate` — Abos mit einer bereits fälligen geplanten Änderung werden nicht in den SEPA-Lauf aufgenommen. Verhalten per SQL-Simulation gegen echte Produktionsdaten verifiziert (ohne einen echten Lauf anzulegen, um bestehende Fixtures nicht zu verändern).
- PROJ-8 (`confirmRegularBooking`): setzt bei Bestätigung einer regulären Buchung jetzt zusätzlich `course_id` (nur bei „Nur diesen Kurs", nicht bei Flatrate) und `cycle_anchor_date` (= gewähltes Einstiegsdatum der Buchung) auf dem neu angelegten Abo.

### Frontend
- Neue Kundensektion „Mein Abo" auf `/profil` (`src/components/subscription/my-subscriptions-section.tsx`): Leerzustand, Karte pro Abo mit Status-Badge, Hinweistext bei geplanter Änderung, kontextabhängige Aktionen (Pausieren/Kündigen/Rückgängig machen/Reaktivieren/Umbuchen) exakt nach den in der Spec definierten Sichtbarkeitsregeln.
- Neue Server Actions `src/lib/actions/subscription.ts` — dünne Wrapper um die vier RPCs; `pauseSubscription`/`cancelSubscription` geben das tatsächliche `pending_effective_date` aus der RPC-Antwort zurück, damit der angezeigte Hinweistext exakt dem serverseitig berechneten Zyklusende entspricht (keine separate Clientberechnung).
- Admin-Erweiterung `src/components/admin/customers/subscription-manager.tsx`: zusätzliche Anzeige „Geplante Änderung: … ab [Datum]" pro Abo, „Jetzt übernehmen"-Button (nur sichtbar, wenn `pending_effective_date` erreicht ist), neue Formularfelder Kurs-Auswahl (optional, Sentinel-Pattern wie bei `video_set_id`) und Zyklus-Ankerdatum.
- Neue Admin-Action `applyPendingChange` (`src/lib/actions/admin/subscriptions.ts`) — einfaches, admin-privilegiertes Direkt-Update (kein RPC nötig, da Admin ohnehin volle RLS-Rechte hat); nutzt `formatDateLocal` statt `toISOString()` für den Datumsvergleich (bekannte Zeitzonen-Falle aus PROJ-8, siehe dortige Implementation Notes).

### Live-Test (Playwright, ad-hoc gegen Produktionsdaten, throwaway-Fixtures)
Getestet und bestanden: aktives Abo zeigt korrekte Aktionen → Pausieren zeigt Hinweis mit Datum → Rückgängig machen entfernt Hinweis → Umbuchen wechselt Kurs sofort bei unverändertem Preis (inkl. Namens-Bugfix oben) → Kündigen zeigt Hinweis, Admin sieht „Geplante Änderung", noch kein „Jetzt übernehmen" vor Fälligkeit → nach simuliertem Erreichen des Datums erscheint „Jetzt übernehmen", Klick setzt echten Status, Kunde sieht „Gekündigt" ohne Reaktivieren-Option → derselbe Ablauf für Pausierung, Kunde sieht „Pausiert" mit Reaktivieren, Klick setzt sofort „Aktiv". SEPA-Ausschlusslogik gegen reale Abo-/Mandatsdaten simuliert verifiziert. Volle Sicherheits-Red-Team-Prüfung (RLS/RPC-Umgehungsversuche) folgt im `/qa`-Schritt.

## QA Test Results

**Tested:** 2026-08-17
**App URL:** http://localhost:3000 (against production Supabase project `kqdnaevyzgtrmaatinrx`)
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: Pausieren speichert geplante Pausierung zum nächsten Zyklusende, Abo bleibt „Aktiv" mit Hinweis
- [x] Passed — Hinweis „Wird pausiert ab [Datum]" erscheint, Status bleibt „Aktiv"

#### AC-2: Kündigen speichert geplante Kündigung zum nächsten Zyklusende, Abo bleibt „Aktiv" mit Hinweis
- [x] Passed — Hinweis „Wird gekündigt ab [Datum]" erscheint, Status bleibt „Aktiv"

#### AC-3: Rückgängig machen entfernt die geplante Änderung vor dem Wirksamkeitsdatum
- [x] Passed — Hinweis verschwindet, Aktionen kehren zu Pausieren/Kündigen zurück

#### AC-4: Reaktivieren setzt ein pausiertes Abo sofort auf „Aktiv"
- [x] Passed — kein Wartezeit-Mechanismus, sofortige Statusänderung

#### AC-5: Gekündigtes Abo zeigt keine Reaktivieren-Option
- [x] Passed — nach Statusübernahme durch Admin sieht Kunde „Gekündigt" ohne jede Aktion außer den nicht zutreffenden

#### AC-6: Umbuchen ändert den Kurs-Bezug sofort, Preis bleibt unverändert
- [x] Passed — inkl. Regressionscheck: Umbuchen funktioniert auch bei gleichzeitig laufender geplanter Kündigung und löscht diese nicht versehentlich

#### AC-7: Flatrate-Abo (kein Kurs-Bezug) zeigt keine Umbuchen-Option
- [x] Passed

#### AC-8: SEPA-Lauf schließt Abo mit fälliger geplanter Änderung automatisch aus
- [x] Passed — Lauf für 2026-12-24 enthält exakt die 3 erwarteten aktiven Abos mit Mandat; das Abo mit bereits fälliger geplanter Kündigung wurde korrekt ausgeschlossen (verifiziert per DB-Abfrage nach Lauf-Erstellung)

#### AC-9: Admin „Jetzt übernehmen" setzt den tatsächlichen Status bei fälliger geplanter Änderung
- [x] Passed — Button erscheint erst ab Fälligkeitsdatum, Klick setzt Status und entfernt die geplante Änderung

### Edge Cases Status

#### EC-1: Kunde ohne Abo sieht Leerzustand
- [x] Passed — „Kein aktives Abo vorhanden."

#### EC-2: Kunde mit mehreren aktiven Abos
- [x] Passed — jedes Abo einzeln mit eigenen Aktionen

#### EC-3: Zyklus-Ankerdatum liegt weit in der Vergangenheit
- [x] Passed — `next_cycle_end()` projiziert korrekt in 4-Wochen-Schritten in die Zukunft (verifiziert per SQL: Anker vor 10/40/60 Tagen ergibt jeweils korrekt das nächste zukünftige Vielfache, nicht einfach Anker+28)

#### EC-4: Gleichzeitiges Pausieren und Kündigen — eine Aktion ersetzt die andere
- [x] Passed — verifiziert per Live-Test in der Frontend-Phase (Kündigen nach geplanter Pausierung ersetzt den Hinweis, keine zwei parallelen geplanten Änderungen möglich, durch die DB-Struktur mit genau einem `pending_status`-Feld strukturell garantiert)

#### EC-5: Admin ändert Preis während Kunde umbucht
- [x] Passed by design — unabhängige Felder (Umbuchen ändert nur `course_id`, Preisänderung ist ein separates Admin-Feld), keine Konfliktmöglichkeit; nicht separat live getestet, da strukturell ausgeschlossen

#### EC-6: Bestehendes Abo ohne Zyklus-Ankerdatum (Altdaten aus PROJ-4)
- [x] Satisfied by design — Migration hat `cycle_anchor_date` für alle Bestandsabos aus `created_at` befüllt und die Spalte ist `NOT NULL` mit Default; es kann in der aktuellen UI kein Abo ohne Ankerdatum entstehen

### Security Audit Results (Red Team)

Durchgeführt per SQL-Impersonation der exakten JWT-Claims, die PostgREST bei einer echten Session mitgeben würde (`SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = ...`) — testet die tatsächliche Autorisierungsgrenze direkt an der Quelle.

- [x] **Cross-Customer-Angriff auf alle 4 RPCs:** Kunde A versucht, Abo von Kunde B zu pausieren/kündigen/reaktivieren/umzubuchen/rückgängig zu machen → jede RPC lehnt mit „subscription not eligible..." ab, keine Zustandsänderung
- [x] **Anonymer Zugriff:** `anon`-Rolle versucht RPC-Aufruf → `permission denied for function` (EXECUTE korrekt entzogen)
- [x] **Direkter Tabellenzugriff (RPC-Umgehung):** Kunde versucht `UPDATE subscriptions SET price = 0.01, name = 'HACKED'` direkt auf eigenes Abo → 0 Zeilen betroffen (RLS lässt keine Kunden-UPDATE-Policy zu, nur Admin); Preis/Name unverändert
- [x] **Direktes Insert:** Kunde versucht sich selbst ein neues (kostenloses) Abo anzulegen → RLS-Verstoß, abgelehnt
- [x] **Server-seitige Kursvalidierung:** Umbuchen auf eine nicht existierende `course_id` → „course not found", abgelehnt (nicht nur Client-seitig validiert)
- [x] **Keine Informationslecks in Fehlermeldungen:** Fehlermeldungen bei fremden/nicht-existenten IDs unterscheiden sich nicht („not eligible" statt spezifischer Gründe) — verhindert Enumeration fremder Abo-IDs
- [x] **Positivkontrolle:** derselbe Aufruf mit dem tatsächlichen Besitzer als Claim gelingt einwandfrei — bestätigt, dass die Ablehnungen oben echte Autorisierungsgrenzen sind und keine generellen Funktionsfehler

Keine Sicherheitsfunde.

### Regression Testing
- `npm test` (Vitest): 68/68 passed (64 bestehende + 4 neue für `subscriptionSchema`s neue Felder)
- `npm run build`: erfolgreich
- Neue permanente Suite `tests/PROJ-9-abo-verwaltung-self-service.spec.ts`: 10/10 passed im isolierten Einzellauf (alle 9 ACs + Mehrfach-Abo-Edge-Case)
- Vollständiger E2E-Regressionslauf (alle Feature-Suiten, `--project=chromium`): 36/88 bestanden, 52 fehlgeschlagen. Beide Fehlerursachen sind **nicht durch PROJ-9 verursacht** (siehe BUG-2 und BUG-3) — im Detail unten aufgeschlüsselt und durch gezielte Einzel-Nachtests bestätigt.

### Bugs Found

#### BUG-1: `self_switch_subscription_course` überschrieb den Abo-Namen mit dem Kursnamen (bereits behoben)
- **Severity:** Medium
- **Gefunden:** während der Frontend-Phase per Live-Test, noch vor Beginn dieser QA-Session
- **Status:** Behoben (Migration `proj9_fix_switch_course_preserves_name`) und in dieser QA-Session erneut verifiziert (AC-6-Test bestätigt, dass „E2E9 Testabo" nach Kurswechsel seinen Namen behält)
- **Priority:** N/A — bereits vor Deployment behoben

#### BUG-2: Vorbestehende, von PROJ-9 unabhängige Fixture-Alterung/-Häufung in PROJ-7/PROJ-8-E2E-Suiten
- **Severity:** Low
- **Beschreibung:** Im vollständigen Regressionslauf schlagen mehrere PROJ-7- und PROJ-8-Tests fehl. Ursache ist in jedem Fall nachweislich Fixture-Alterung bzw. -Häufung, nicht PROJ-9-Code:
  - `e2e7-customer-multi` hat bereits seit 2026-08-16 (einem früheren Testlauf) ein aktives Mandat + zwei Abos, wodurch die „keine Kunden für diesen Lauf"-Annahme eines anderen Tests nicht mehr zutrifft; dieser Fehlschlag zieht weitere PROJ-7-Tests im selben File mit (Kaskadeneffekt einer nicht-isolierten Testreihenfolge).
  - `e2e8-customer@...`s Probestunde-Buchung wurde am 2026-08-16 für „morgen" (2026-08-17) angelegt — das ist inzwischen „heute", wodurch die 1-Tages-Stornofrist bereits abgelaufen ist und Umbuchen/Stornieren-Buttons korrekterweise ausgeblendet werden.
  - Zusätzlich hat das mehrfache Ausführen der PROJ-8-Suite **innerhalb dieser Session** (units Frontend-Selbsttest + zwei QA-Regressionsläufe) bei `e2e8-customer` mittlerweile 3 „Probestunde"-Buchungen angehäuft (jede Ausführung legt automatisch eine neue an); ein Test mit `getByText("Bestätigt")` ohne `.first()` schlägt dadurch mit einem Playwright-„strict mode violation" fehl, reproduzierbar auch in einem isolierten Einzellauf **direkt jetzt** verifiziert — kein Zufallsbefund des langen Gesamtlaufs.
- **Beweis, dass PROJ-9 nicht ursächlich ist:** Der einzige PROJ-9-Codeeingriff in PROJ-7/8 ist (a) ein zusätzlicher Ausschluss-Filter in `createCollectionRun`, der Zeilen nur entfernen, nie hinzufügen kann, und (b) eine Erweiterung von `confirmRegularBooking` (nur für `type: 'regular'`, die fehlschlagenden Tests betreffen aber ausschließlich `type: 'trial'`-Buchungen bzw. bereits vor PROJ-9 bestehende Mandats-/Abo-Daten).
- **Priority:** Nice to have — bestehendes Problem der Suiten-Wiederholbarkeit über mehrere Tage/Sessions hinweg, nicht spezifisch für PROJ-9; würde eine projektweite Lösung brauchen (z. B. automatisches Fixture-Reset vor jedem vollständigen Lauf), außerhalb des Scopes dieses Features

#### BUG-3: Fixture-Konten für PROJ-2/PROJ-3/PROJ-4/PROJ-5/PROJ-6/PROJ-23 existieren nicht mehr in der Produktions-DB (vorbestehend, nicht durch PROJ-9 verursacht)
- **Severity:** Medium (betrifft die Verlässlichkeit der Regressionssuite für 6 bereits deployte Features, nicht deren tatsächliche Produktionsfunktion)
- **Beschreibung:** Beim vollständigen Regressionslauf schlagen ALLE Tests dieser 6 Spec-Dateien fehl. Ursache: die dort hartkodierten Konten (`qa-proj2-*`, `qa-proj3-*`, `qa-proj4-*`, `qa-proj5-*`, `qa-proj6-*`, `qa-proj23-*`, jeweils `@viennasalsastudio.test`) existieren aktuell überhaupt nicht in `auth.users` — verifiziert per direkter DB-Abfrage (nur 12 Nutzer insgesamt in der Produktions-DB vorhanden, keiner mit `qa-proj*`-Präfix).
- **Beweis, dass PROJ-9 nicht ursächlich ist:** Diese Konten wurden in keinem Tool-Aufruf dieser gesamten Session referenziert, gelesen oder verändert — die einzige auth.users-Manipulation dieser Session betraf ausschließlich drei `e2e9-*`-Testkonten, die exakt namentlich wieder gelöscht wurden (verifiziert). Das Fehlen der `qa-proj*`-Konten ist folglich bereits vor Beginn dieser Session eingetreten — vermutlich wurden sie bei einer früheren Aufräumaktion versehentlich als „Wegwerf"-Konten behandelt (dieselbe Fehlerklasse, die bei PROJ-24s `e2e24-*`-Konten während der Frontend-Phase auftrat und dort noch rechtzeitig selbst korrigiert wurde, siehe PROJ-24 Implementation Notes).
- **Auswirkung:** Die Regressionssuiten für PROJ-2, PROJ-3, PROJ-4, PROJ-5, PROJ-6 und PROJ-23 sind aktuell nicht aussagekräftig — das sagt nichts über die tatsächliche Produktionsfunktion dieser Features aus (die App selbst ist unverändert), sondern nur, dass ihre automatisierten Tests nicht mehr laufen können, bis die Konten neu angelegt werden.
- **Priority:** Fix in next sprint — außerhalb des Scopes von PROJ-9, sollte aber zeitnah als eigenständige Aufgabe behoben werden (Konten neu anlegen, ggf. mit denselben Fixture-Daten wie ursprünglich), da sonst kein verlässliches Regressions-Sicherheitsnetz für sechs Features besteht

### Summary
- **Acceptance Criteria:** 9/9 passed
- **Edge Cases:** 6/6 passed (verifiziert oder by-design erfüllt)
- **Bugs Found:** 3 total (0 critical, 0 high, 1 medium — vorbestehend & außerhalb Scope [BUG-3], 1 medium — bereits vor QA behoben [BUG-1], 1 low — vorbestehend, nicht PROJ-9-spezifisch [BUG-2])
- **Security:** Pass — keine Funde bei RLS/RPC-Red-Team-Prüfung (Cross-Customer-Zugriff, anonymer Zugriff, direkte Tabellen-Umgehung, Server-seitige Kursvalidierung, Informationslecks — alle abgedeckt)
- **Production Ready:** YES für PROJ-9 selbst — alle 9 Acceptance Criteria bestehen isoliert und im dedizierten Regressionslauf; die gefundenen Bugs sind entweder bereits behoben (BUG-1) oder nachweislich nicht durch PROJ-9 verursacht und liegen außerhalb seines Scopes (BUG-2, BUG-3)
- **Recommendation:** Deploy PROJ-9. Unabhängig davon: BUG-3 (fehlende Test-Konten für 6 bereits deployte Features) sollte als eigenständige Aufgabe zeitnah behoben werden, da die Regressionssicherheit dieser Features aktuell nicht automatisiert überprüfbar ist.

## Deployment
_To be added by /deploy_
