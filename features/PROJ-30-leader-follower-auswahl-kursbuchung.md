# PROJ-30: Leader/Follower-Auswahl bei Kursbuchung

## Status: Architected
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Dependencies
- PROJ-3 (Admin: Kurse verwalten) — für die Pro-Kurs-Konfiguration
- PROJ-8 (Kursbuchung) / PROJ-26 (Kursbuchung vom Stundenplan) — Buchungsdialog
- PROJ-12 (Warteliste & automatische Nachrückung) — Balance-Prüfung nutzt und erweitert die bestehende Wartelisten-/Nachrück-Logik

## User Stories
- Als Kunde möchte ich beim Buchen eines Partnertanz-Kurses angeben, ob ich Leader, Follower oder beides tanze, damit der Lehrer eine ausgewogene Klasse planen kann.
- Als Admin möchte ich pro Kurs festlegen, ob diese Abfrage überhaupt erscheint, damit sie bei Kursen ohne Partnertanz-Bezug (z.B. Ladies Styling) nicht unnötig auftaucht.
- Als Admin/Lehrer möchte ich die Leader/Follower-Verteilung eines Kurses auf einen Blick sehen, damit ich die Klasse entsprechend planen kann.
- Als Admin möchte ich pro Kurs festlegen, wie groß die maximal erlaubte Differenz zwischen Leadern und Followern sein darf, damit ich die Balance-Regel an die Realität jedes Kurses anpassen kann.
- Als Kunde möchte ich, wenn meine gewählte Rolle den Kurs zu sehr aus der Balance bringen würde, die Möglichkeit bekommen, mich auf die Warteliste einzutragen, damit ich eine Chance auf einen Platz bekomme, sobald die Gegenrolle nachzieht.
- Als Admin möchte ich die Leader/Follower-Verteilung aller Kurse direkt in der Kursliste sehen, damit ich nicht jeden Kurs einzeln öffnen muss.

## Out of Scope
- Rollenwechsel durch den Kunden im Self-Service nach der Buchung (Admin kann die Angabe aber im Buchungsdetail korrigieren)
- Rollenabfrage bei Event-/Workshop-Ticketkauf (PROJ-14) — nur bei regulären Kursbuchungen
- „Beide" wird nicht automatisch der gerade unterrepräsentierten Rolle zugerechnet — zählt neutral und beeinflusst die Differenz nicht (siehe Decision Log)
- Stille, bestätigungslose Wartelisten-Eintragung bei Balance-Überschreitung — läuft über dasselbe Hinweis+Button-Muster wie bei vollen Kursen (PROJ-12)
- Rückwirkende Umschichtung bereits bestätigter Buchungen, wenn sich nachträglich (z.B. durch Stornos) ein Ungleichgewicht ergibt — bestehende Buchungen werden nicht angetastet

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Admin bearbeitet einen Kurs, wenn er „Leader/Follower-Abfrage aktivieren" einschaltet, dann wird beim Buchen dieses Kurses die Rollenauswahl angezeigt
- [ ] Angenommen ein Kurs hat die Rollenabfrage nicht aktiviert, wenn ein Kunde diesen Kurs bucht, dann erscheint keine Rollenauswahl im Buchungsdialog
- [ ] Angenommen ein Kurs hat die Rollenabfrage aktiviert, wenn ein Kunde den Buchungsdialog öffnet, dann kann er zwischen Leader, Follower und Beide wählen; das Feld ist optional
- [ ] Angenommen ein Kunde hat beim Buchen eine Rolle gewählt, wenn der Admin die Teilnehmerliste des Kurses öffnet, dann sieht er die Rolle je Teilnehmer sowie eine Zusammenfassung (z.B. „6 Leader / 4 Follower / 2 Beide")
- [ ] Angenommen ein Kunde hat keine Rolle angegeben, wenn der Admin die Teilnehmerliste öffnet, dann wird dieser Kunde als „keine Angabe" geführt
- [ ] Angenommen ein Kurs hat die Rollenabfrage aktiviert, wenn der Admin eine maximale Rollen-Differenz einträgt, dann wird dieser Wert gespeichert und ab sofort für neue Buchungen dieses Kurses angewendet
- [ ] Angenommen für einen Kurs ist keine maximale Rollen-Differenz hinterlegt, wenn Kunden buchen, dann gibt es keine Balance-Beschränkung
- [ ] Angenommen ein Kunde wählt beim Buchen eine Rolle, die die konfigurierte maximale Differenz überschreiten würde, wenn er die Buchung abschickt, dann erscheint ein Hinweis mit der Möglichkeit, sich stattdessen auf die Warteliste einzutragen (wie bei einem vollen Kurs)
- [ ] Angenommen ein Kunde wählt „Beide" oder trifft keine Auswahl, wenn die Differenz berechnet wird, dann beeinflusst diese Buchung die Balance nicht und wird nie wegen der Balance auf die Warteliste verwiesen
- [ ] Angenommen auf der Warteliste eines Kurses warten mehrere Kunden mit unterschiedlichen Rollen, wenn ein Platz für eine bestimmte Rolle frei wird, dann rückt der am längsten wartende Kunde nach, dessen Rolle die Balance nicht wieder verletzt — auch wenn er nicht ganz vorne in der Warteliste steht
- [ ] Angenommen der Admin öffnet die Kursliste, wenn ein Kurs die Rollenabfrage aktiviert hat, dann sieht er dort die aktuelle Leader/Follower/Beide-Verteilung dieses Kurses auf einen Blick

## Edge Cases
- Admin deaktiviert die Rollenabfrage, nachdem bereits Buchungen mit Rollenangabe existieren — bestehende Angaben bleiben erhalten, nur neue Buchungen fragen nicht mehr.
- Ein Kurs wechselt von „keine Abfrage" zu „Abfrage aktiv" — betrifft nur neue Buchungen ab Aktivierung; bestehende Buchungen zeigen weiterhin „keine Angabe".
- Ein Kurs erreicht gleichzeitig die maximale Teilnehmerzahl UND würde durch eine Buchung die Rollen-Differenz überschreiten — beide Prüfungen wirken unabhängig voneinander, jede für sich reicht aus, um auf die Warteliste zu verweisen.
- Alle wartenden Kunden auf der Warteliste haben dieselbe (für die Balance ungünstige) Rolle — niemand wird nachgerückt, bis jemand mit passender Rolle beitritt oder ein Admin manuell eingreift (z.B. über die bestehende Möglichkeit, die Rollenangabe im Buchungsdetail zu korrigieren).
- Admin senkt die maximale Rollen-Differenz nachträglich, sodass der Kurs bereits jetzt „überbalanciert" wäre — bestehende Buchungen bleiben unverändert (analog zum bestehenden Verhalten bei `max_participants`), nur neue Buchungen werden nach der neuen Grenze geprüft.

## Technical Requirements (optional)
- Keine besonderen Anforderungen über die üblichen Standards hinaus.

## Open Questions
- Keine offenen Fragen zum Zeitpunkt der Spec-Erstellung.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Pro Kurs konfigurierbar statt global aktiviert | User-Entscheidung: nicht alle Kurse sind Partnertänze | 2026-08-21 |
| Dritte Option „Beide" zusätzlich zu Leader/Follower | Viele Tänzer tanzen ohne feste Rolle; erzwingt keine künstliche Festlegung | 2026-08-21 |
| Optionales statt Pflichtfeld | Reduziert Buchungs-Reibung; Admin bekommt trotzdem eine vollständige Teilnehmerliste inkl. „keine Angabe" | 2026-08-21 |
| Automatisches Balancing (Wartelisten-Verweis bei zu großer Differenz) ist jetzt im Scope, nicht mehr nur reine Anzeige | User-Feedback nach erster Architektur-Review: der eigentliche Bedarf ist eine echte Kapazitätssteuerung pro Rolle, nicht nur ein Anzeige-Widget | 2026-08-21 |
| „Beide" und „keine Angabe" zählen neutral, beeinflussen die Differenz nicht | Einfachste, nachvollziehbarste Regel; vermeidet komplexe Zuordnungslogik, wer welcher Seite „zugeschlagen" wird | 2026-08-21 |
| Wartelisten-Eintragung bei Balance-Überschreitung läuft über dasselbe Hinweis+Button-Muster wie bei vollen Kursen (PROJ-12) | Konsistente UX, kein neues Verhalten das Kunden erst lernen müssen | 2026-08-21 |
| Nachrücken sucht den nächsten passenden Kandidaten unabhängig von der FIFO-Position | Verhindert, dass ein Kurs dauerhaft blockiert bleibt, nur weil die nächste Person in der Warteliste die falsche Rolle hat | 2026-08-21 |
| Zusätzliche Rollen-Verteilungsanzeige direkt in der Kursliste (nicht nur in der Anwesenheitsmatrix) | User-Wunsch nach einer Übersicht ohne jeden Kurs einzeln öffnen zu müssen | 2026-08-21 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Rollenfeld lebt auf der einzelnen Kursbuchung, nicht am Kundenprofil | Ein Kunde kann in verschiedenen Kursen unterschiedliche Rollen tanzen; verhindert außerdem, dass eine später aktivierte Abfrage rückwirkend alte Buchungen befüllt | 2026-08-21 |
| Kurs-Umschalter folgt exakt dem PROJ-27-Muster (`prerequisite_note`-Feld → bedingte Checkbox im Buchungsdialog) | Bereits erprobtes, funktionierendes Muster für „optionales Kurs-Flag schaltet eine Frage im Buchungsdialog frei" — reduziert Risiko, keine neue Interaktionslogik nötig | 2026-08-21 |
| Rollenauswahl im Buchungsdialog als RadioGroup (3 Optionen: Leader/Follower/Beide) | Konsistent mit der bestehenden „Nur diesen Kurs / Flatrate"-Auswahl im selben Dialog, die für eine kleine Optionsmenge bereits RadioGroup statt Dropdown nutzt | 2026-08-21 |
| Zusammenfassung + Rolle pro Teilnehmer wird in die bestehende Anwesenheitsmatrix (PROJ-13, `/lehrer/[courseId]`) integriert statt eine neue Ansicht zu bauen | Diese Ansicht ist bereits die etablierte Teilnehmerliste pro Kurs (eine Zeile pro Kunde) und für Admins zugänglich; eine zweite Roster-Ansicht wäre Doppelarbeit | 2026-08-21 |
| Keine neue Datenbanktabelle — je ein neues Feld auf `courses` und `course_bookings` | Beide Tabellen existieren bereits und tragen bereits vergleichbare optionale Felder (`prerequisite_note`, `referral_source`); passt ins bestehende Schema | 2026-08-21 |
| Die Balance-Prüfung wird in dieselbe Datenbank-Funktion eingebaut, die heute schon die Teilnehmer-Kapazität prüft (statt einer separaten, nachgelagerten Prüfung) | Die bestehende Kapazitätsprüfung läuft bereits atomar mit einer Zeilensperre, um Wettlaufsituationen bei gleichzeitigen Buchungen zu verhindern; eine zweite, unabhängige Prüfung außerhalb dieser Sperre könnte dieselbe Race Condition erneut einführen | 2026-08-21 |
| Die automatische Nachrück-Funktion bekommt dieselbe Rollen-Logik: sie sucht bei freiem Platz den am längsten wartenden Kandidaten, dessen Rolle die Balance nicht verletzt, statt stur den ersten in der Reihe zu nehmen | Ohne diese Erweiterung könnte ein Kurs dauerhaft "stecken bleiben", wenn die vorderste Person auf der Warteliste die falsche Rolle für die aktuelle Balance hat | 2026-08-21 |
| Die neue Kursliste-Spalte liest dieselbe Zähl-Logik wie die Anwesenheitsmatrix-Zusammenfassung (eine gemeinsame Berechnung, zwei Anzeigeorte) | Vermeidet, dieselbe Auszählung zweimal unterschiedlich zu implementieren und damit Inkonsistenzen zu riskieren | 2026-08-21 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Component Structure (Visual Tree)

```
Admin: Kurs bearbeiten (course-manager.tsx)
├── Neuer Schalter „Leader/Follower-Abfrage aktivieren"
│   (direkt neben dem bestehenden Vorkenntnisse-Hinweis-Feld aus PROJ-27)
└── Neues Zahlenfeld „Max. Rollen-Differenz" (nur sichtbar/aktiv, wenn der Schalter an ist)
    — leer = keine Balance-Beschränkung, analog zum bestehenden „Max. Teilnehmer (leer = unbegrenzt)"

Admin: Kursliste (course-manager.tsx, Tabellen-Übersicht)
└── Neue Spalte „Rollen" bei Kursen mit aktivierter Abfrage
    z.B. "6 L / 4 F / 2 B" als kompaktes Badge, sonst „—"

Buchungsdialog (booking-dialog.tsx, PROJ-8/PROJ-26)
├── Neue Frage „Ich tanze als:" (Leader / Follower / Beide)
│   — erscheint nur, wenn der gewählte Kurs die Abfrage aktiviert hat, optional
└── Neuer Hinweis + „Auf Warteliste eintragen"-Button, wenn die gewählte Rolle
    die konfigurierte Differenz überschreiten würde
    (exakt dasselbe Muster wie der bestehende „Kurs ist voll"-Hinweis aus PROJ-12)

Anwesenheitsmatrix (attendance-matrix.tsx, PROJ-13, /lehrer/[courseId])
├── Neue Zusammenfassungszeile über der Tabelle
│   "6 Leader / 4 Follower / 2 Beide / 3 keine Angabe"
└── Neues Rollen-Badge pro Kundenzeile (z.B. kleines "L"/"F"/"B"-Icon neben dem Namen)
```

### B) Data Model (plain language)

```
Kurs (bestehende Tabelle) bekommt zwei neue Felder:
- Rollenabfrage aktiviert (Ja/Nein), Standard: Nein
- Max. erlaubte Rollen-Differenz (Zahl, optional — leer = keine Beschränkung)

Kursbuchung (bestehende Tabelle) bekommt ein neues, optionales Feld:
- Gewählte Rolle: Leader / Follower / Beide / (leer = keine Angabe)
  wird nur befüllt, wenn der Kunde beim Buchen eine Auswahl getroffen hat
  und der gebuchte Kurs die Abfrage zu diesem Zeitpunkt aktiviert hatte

Balance-Berechnung (keine gespeicherten Werte, live berechnet):
- Differenz = Anzahl aktiver Leader-Buchungen minus Anzahl aktiver Follower-Buchungen
  (Beide und keine Angabe zählen zu keiner Seite)
- Eine neue Buchung wird abgelehnt (→ Warteliste-Hinweis), wenn sie diese Differenz
  über den konfigurierten Höchstwert des Kurses hinaus vergrößern würde

Gespeichert in: Supabase (bestehende `courses`- und `course_bookings`-Tabellen, kein neues Schema-Objekt).
Die Warteliste selbst nutzt weiterhin die bestehende Wartelisten-Tabelle aus PROJ-12 unverändert.
```

### C) Tech Decisions (justified for PM)

- **Feld auf der Buchung, nicht auf dem Kundenprofil:** Ein Kunde tanzt evtl. in Kurs A als Follower und in Kurs B als Leader — ein einziges Profil-Feld könnte das nicht abbilden. Außerdem verhindert das, dass alte Buchungen rückwirkend eine Rolle „bekommen", wenn ein Admin die Abfrage erst später für einen Kurs aktiviert.
- **Wiederverwendung des PROJ-27-Musters für den Kurs-Schalter:** Die App hat mit dem Vorkenntnisse-Hinweis (PROJ-27) bereits exakt diese Mechanik gebaut — ein optionales Kurs-Flag, das im Buchungsdialog bedingt eine zusätzliche Frage einblendet.
- **Balance-Prüfung an derselben Stelle wie die bestehende Kapazitätsprüfung:** Die App prüft heute schon bei jeder Buchung, ob ein Kurs voll ist — an einer einzigen, gegen gleichzeitige Buchungen abgesicherten Stelle (damit nicht zwei Personen gleichzeitig den letzten Platz bekommen). Die neue Rollen-Balance-Prüfung wird an derselben Stelle ergänzt, statt eine zweite, separate Prüfung zu bauen — das hält das Verhalten robust und vermeidet, dass unter Last kurzzeitig doch ein zu großes Ungleichgewicht entstehen könnte.
- **Wartelisten-Hinweis statt stiller Umleitung:** Wenn die Balance überschritten würde, bekommt der Kunde denselben Hinweis + Button wie bei einem vollen Kurs („Auf Warteliste eintragen") statt automatisch und ohne Rückmeldung auf die Warteliste gesetzt zu werden — konsistent mit dem bestehenden Verhalten, kein neues Muster zu lernen.
- **Nachrücken sucht den passenden Kandidaten:** Wenn ein Platz für eine Rolle frei wird (z.B. durch eine Kündigung), rückt nicht stur die älteste Warteliste-Anmeldung nach, sondern die älteste, deren Rolle die Balance nicht wieder verletzt. Das verhindert, dass ein Kurs dauerhaft "steckenbleibt", nur weil die vorderste Person die falsche Rolle für die aktuelle Situation hat.
- **Keine neue Teilnehmerliste, zwei Anzeigeorte mit einer gemeinsamen Zähl-Logik:** Die Anwesenheitsmatrix aus PROJ-13 bleibt die Detailansicht pro Kurs; die Kursliste bekommt zusätzlich eine kompakte Zusammenfassungsspalte, damit der Admin nicht jeden Kurs einzeln öffnen muss. Beide nutzen dieselbe zugrunde liegende Berechnung, um Inkonsistenzen zu vermeiden.

### D) Dependencies (packages to install)

- Keine neuen Pakete nötig — RadioGroup, Select und die Formular-Validierung (Zod/react-hook-form) sind bereits im Projekt vorhanden und werden im selben Buchungsdialog schon für vergleichbare Felder genutzt. Die Wartelisten-UI und -Logik aus PROJ-12 wird erweitert, nicht neu gebaut.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
