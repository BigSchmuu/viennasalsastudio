# PROJ-9: Abo-Verwaltung (Self-Service Pause/Kündigung)

## Status: In Progress
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
_To be added by /qa_

## Deployment
_To be added by /deploy_
