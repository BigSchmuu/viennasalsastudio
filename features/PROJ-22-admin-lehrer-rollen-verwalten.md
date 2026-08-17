# PROJ-22: Admin: Lehrer-Rollen verwalten

## Status: Planned
**Created:** 2026-08-17
**Last Updated:** 2026-08-17

## Dependencies
- Requires: PROJ-1 (Supabase Infrastructure Setup) — `profiles.role` unterstützt bereits `'teacher'` als Wert
- Requires: PROJ-4 (Admin: Kunden-/Mitgliederverwaltung) — die Kundensuche auf `/admin/lehrer` zum Befördern eines bestehenden Kunden nutzt dasselbe Datenmodell/Suchmuster wie die Kundenliste; die Kundendetailseite selbst bleibt unverändert
- Nutzt bereits bestehende Infrastruktur: der Lehrer-Picker im Kurs-Formular (PROJ-3) filtert bereits auf `role = 'teacher'` über die `teacher_directory`-View — PROJ-22 füllt die bisher einzige Lücke, wie Profile diese Rolle überhaupt bekommen
- Ermöglicht: PROJ-13 (Lehrer-Ansicht) — eine eigene Lehrer-Oberfläche ergibt erst Sinn, wenn Lehrer-Konten sauber verwaltbar sind

## User Stories
- Als Admin möchte ich einen bestehenden, registrierten Kunden zum Lehrer befördern können, damit ich ihn/sie Kursen zuordnen kann, ohne ein neues Konto anlegen zu müssen.
- Als Admin möchte ich für eine Person, die noch kein Konto hat, direkt ein neues Lehrer-Konto per E-Mail-Einladung anlegen können.
- Als Admin möchte ich alle aktuellen Lehrer an einem Ort sehen, damit ich einen Überblick über das Team habe.
- Als Admin möchte ich einen Lehrer wieder zum Kunden zurückstufen können, falls die Zusammenarbeit endet.
- Als Admin möchte ich gewarnt werden, wenn ich jemanden zurückstufe, der noch aktiv Kursen zugeordnet ist, damit ich nicht versehentlich die Kurs-Übersicht durcheinanderbringe.

## Out of Scope
- Eigene Lehrer-Ansicht/Dashboard (Stundenplan, Anwesenheit, Notizen) — das ist PROJ-13, ein separates Feature
- Zusätzliche Lehrer-Profildaten (Bio, Foto, Spezialisierung) — aktuell nur `full_name` wie bei Kunden; erweiterte Profile sind kein MVP-Bedarf laut PRD
- Admin-Rollen verwalten (jemanden zum Admin machen/degradieren) — nicht Teil dieses Features, betrifft nur customer↔teacher
- Automatisches Entfernen aus `course_teachers` bei Degradierung — Zuordnungen bleiben bestehen (siehe Decision Log), nur die öffentliche Anzeige filtert sie aus
- Passwort-Vergabe durch den Admin beim Neuanlegen — ausschließlich Einladungs-E-Mail, kein Admin-gesetztes Startpasswort
- Bulk-Aktionen (mehrere Lehrer gleichzeitig befördern/degradieren) — bei erwarteter kleiner Anzahl im MVP nicht nötig (gleiche Begründung wie PROJ-4/PROJ-9)

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen der Admin ist auf `/admin/lehrer`, wenn er über die Kundensuche einen bestehenden Kunden auswählt und die Beförderung bestätigt, dann wird die Rolle des Profils auf „teacher" gesetzt und die Person erscheint ab sofort im Lehrer-Picker der Kurs-Verwaltung sowie in der Lehrer-Liste auf `/admin/lehrer`
- [ ] Angenommen der Admin ist auf `/admin/lehrer` und öffnet die Kundensuche, wenn er einen Namen eingibt, dann werden nur Personen mit Rolle „customer" vorgeschlagen (bereits bestehende Lehrer/Admins erscheinen nicht in der Auswahl)
- [ ] Angenommen ein Kunde wurde zum Lehrer befördert, wenn der Admin die Kundenliste (`/admin/kunden`) ansieht, dann erscheint diese Person dort nicht mehr (Liste filtert weiterhin auf `role = 'customer'`)
- [ ] Angenommen der Admin ist auf `/admin/lehrer`, wenn er „Lehrer einladen" wählt und eine gültige E-Mail sowie einen Namen eingibt, dann wird ein neues Konto mit Rolle „teacher" angelegt und eine Einladungs-E-Mail verschickt, über die die Person ihr eigenes Passwort setzen kann
- [ ] Angenommen der Admin versucht, eine E-Mail-Adresse einzuladen, die bereits ein Konto hat, wenn er absendet, dann wird ein verständlicher Fehlerhinweis angezeigt („Diese E-Mail ist bereits registriert — bitte stattdessen über die Kundenliste befördern")
- [ ] Angenommen es existieren Lehrer, wenn der Admin `/admin/lehrer` öffnet, dann sieht er alle Personen mit Rolle „teacher" mit Name und E-Mail
- [ ] Angenommen ein Lehrer ist noch bei mindestens einem Kurs eingetragen, wenn der Admin ihn zurückstufen möchte, dann zeigt ein Bestätigungsdialog die betroffenen Kurse namentlich an, bevor die Degradierung ausgeführt wird
- [ ] Angenommen der Admin bestätigt die Degradierung trotz Warnung, wenn er fortfährt, dann wird die Rolle auf „customer" gesetzt, die Person erscheint wieder in der Kundenliste, und bestehende `course_teachers`-Einträge bleiben unverändert in der Datenbank, verschwinden aber aus der öffentlichen Lehrer-Anzeige (da diese auf `role = 'teacher'` filtert)
- [ ] Angenommen ein Lehrer ist bei keinem Kurs eingetragen, wenn der Admin ihn zurückstuft, dann erfolgt die Degradierung ohne Bestätigungsdialog sofort

## Edge Cases
- Admin lädt eine E-Mail ein, die bereits als Lehrer oder Admin existiert → gleicher Fehlerhinweis wie bei bestehenden Kunden-Konten (Supabase lehnt Einladung an bereits existierende Adresse ab)
- Kunde mit aktivem Abo wird zum Lehrer befördert → Abo bleibt unverändert bestehen; „Lehrer" ist eine zusätzliche Fähigkeit, kein Ersatz für den Kundenstatus (die Person kann theoretisch gleichzeitig Kundin und Lehrerin sein)
- Admin versucht, sich selbst zu befördern/degradieren → nicht explizit blockiert, aber unwahrscheinlich, da Admin-Konten nicht über die Kundenliste erscheinen (Kundenliste filtert `role = 'customer'`); kein zusätzlicher Schutz nötig
- Leerzustand: keine Lehrer vorhanden → `/admin/lehrer` zeigt „Noch keine Lehrer vorhanden" statt leerer Liste
- Ungültige E-Mail beim Einladen → Client- und serverseitige Validierung wie bei bestehenden Formularen, Fehlermeldung „Bitte eine gültige E-Mail-Adresse eingeben"
- Einladungs-E-Mail kann nicht zugestellt werden (z. B. ungültige Domain) → Supabase liefert einen Fehler zurück, der dem Admin direkt angezeigt wird, kein Konto wird angelegt

## Technical Requirements (optional)
- Security: Nur Admins dürfen Rollen ändern oder Lehrer einladen (bestehendes `requireAdmin()`-Muster). Das Einladen erfordert den Supabase Service-Role-Key serverseitig (`auth.admin.inviteUserByEmail`) — dieser darf ausschließlich in einer Server Action verwendet werden, niemals client-seitig oder in einem `NEXT_PUBLIC_`-Wert landen. Neue Pflicht-Umgebungsvariable: `SUPABASE_SERVICE_ROLE_KEY`.
- Konsistenz: Rollenänderung ist eine einfache `UPDATE profiles SET role = ...`-Operation über bestehende RLS-Admin-Policies, keine neue Tabelle nötig

## Open Questions
- [ ] Keine offenen Fragen

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Beide Wege erlaubt: bestehenden Kunden befördern UND direkt neues Lehrer-Konto per Einladung anlegen | Deckt beide realen Fälle ab — manche Lehrer sind bereits registrierte Kunden, andere kommen komplett neu dazu | 2026-08-17 |
| Neue Konten ausschließlich per Einladungs-E-Mail, kein vom Admin gesetztes Startpasswort | Vermeidet, dass der Admin Passwörter kennt/verteilt; Person setzt eigenes Passwort wie bei der normalen Registrierung | 2026-08-17 |
| Degradierung: Warnung mit betroffenen Kursen anzeigen, aber nicht blockieren; `course_teachers`-Einträge bleiben technisch bestehen | Blockieren wäre unnötige Reibung für den Admin; Zuordnungen automatisch zu löschen wäre stiller Datenverlust. Da die öffentliche Anzeige ohnehin auf `role = 'teacher'` filtert, verschwindet die Person dort korrekt, auch ohne die Datenbank-Einträge zu löschen | 2026-08-17 |
| Alles läuft über eine neue eigene Seite `/admin/lehrer` — auch das Befördern eines bestehenden Kunden über eine integrierte Kundensuche dort, keine Änderung an der bestehenden Kundendetailseite | Ein einziger, zentraler Ort für alle Lehrer-Rollen-Aktionen (Liste, Einladen, Befördern, Zurückstufen) ist übersichtlicher als über zwei Seiten verteilt; die Kundendetailseite (PROJ-4) bleibt dadurch unverändert und unabhängig testbar | 2026-08-17 |
| Keine zusätzlichen Lehrer-Profilfelder (Bio, Foto) in diesem Feature | Nicht MVP-relevant laut PRD; würde den Scope unnötig vergrößern, gehört eher zu einer künftigen Lehrer-Ansicht (PROJ-13) | 2026-08-17 |

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
