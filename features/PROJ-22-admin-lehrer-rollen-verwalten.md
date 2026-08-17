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
| Keine neue Tabelle — alles läuft über das bestehende `role`-Feld in `profiles` | `profiles.role` unterstützt bereits `customer`/`teacher`/`admin`; Befördern/Zurückstufen ist nur eine Wertänderung an einem bestehenden Feld, keine neue Datenstruktur nötig | 2026-08-17 |
| Einladung neuer Lehrer nutzt Supabases privilegierte Admin-Funktion (Service-Role-Schlüssel), ausschließlich serverseitig | Das ist der einzige Weg, ein Konto samt Einladungs-Mail zu erzeugen, ohne dass der Admin ein Passwort kennt oder vergibt; dieser Schlüssel darf niemals an den Browser gelangen, deshalb läuft die gesamte Einladungs-Logik in einer serverseitigen Aktion | 2026-08-17 |
| Kundensuche auf `/admin/lehrer` nutzt dasselbe Muster wie die bestehende Kundenliste (PROJ-4) | Kein neuer Suchmechanismus nötig; reduziert Code-Duplikation und Inkonsistenz | 2026-08-17 |
| Warnhinweis bei Degradierung liest live aus `course_teachers`, statt einen eigenen Zähler zu pflegen | Einfacher und immer aktuell; die Tabelle existiert bereits aus PROJ-3, es muss nur eine Abfrage vor der Bestätigung erfolgen | 2026-08-17 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Komponentenstruktur

```
/admin/lehrer (neue Admin-Seite, neuer Nav-Punkt "Lehrer")
├── Leerzustand „Noch keine Lehrer vorhanden" (falls keine Lehrer existieren)
├── Lehrer-Tabelle (Name, E-Mail)
│   └── Pro Zeile: „Zum Kunden zurückstufen"
│       ├── Ist bei keinem Kurs eingetragen → sofortige Zurückstufung
│       └── Ist bei mind. einem Kurs eingetragen → Bestätigungsdialog mit Kursliste
├── „Lehrer einladen" (Button, öffnet Dialog)
│   └── Einladungs-Dialog: Name, E-Mail → Absenden → Einladungs-Mail wird verschickt
└── „Bestehenden Kunden befördern" (Button, öffnet Dialog)
    └── Beförderungs-Dialog: Kundensuche (nur Personen mit Rolle „customer") → Auswahl → Bestätigen
```

Die bestehende `AdminNav`-Komponente (PROJ-3) wird um den Punkt „Lehrer" erweitert. Die bestehende Kundendetailseite (PROJ-4) bleibt unverändert.

### B) Datenmodell (fachlich)

Es wird **keine neue Tabelle** benötigt. Alles läuft über das bestehende Kundenprofil:

**Profil** (bestehend, aus PROJ-1):
- Rolle: `customer`, `teacher` oder `admin` — dieses Feld existiert bereits und wird von diesem Feature lediglich zwischen `customer` und `teacher` umgeschaltet
- Name, E-Mail-Adresse (bestehend)

**Kurs-Lehrer-Zuordnung** (bestehend, aus PROJ-3): wird von PROJ-22 nur *gelesen* (um die Warnung bei Degradierung anzuzeigen), nicht verändert.

Neu ist lediglich der **Ablauf**, wie ein Profil entsteht bzw. seine Rolle wechselt:
- Befördern: bestehendes Profil, Rolle wird geändert
- Einladen: komplett neues Konto samt Profil wird angelegt, mit Rolle „teacher" von Anfang an, und einer Einladungs-Mail statt eines vom Kunden selbst gewählten Passworts

### C) Tech-Entscheidungen (Begründung)

- **Kein neues Datenmodell:** Die Rolle „teacher" existiert bereits im System (wird schon vom Lehrer-Auswahlfeld im Kurs-Formular genutzt) — es fehlte bisher nur eine Bedienoberfläche, um diese Rolle zu vergeben.
- **Einladung statt Admin-Passwort:** Das Anlegen eines komplett neuen Kontos erfordert eine erhöhte Berechtigung, die ausschließlich serverseitig verwendet werden darf, niemals im Browser sichtbar sein darf. Dadurch bleibt die Passwortvergabe wie bei der normalen Registrierung allein in der Hand der eingeladenen Person.
- **Zentrale Seite statt verteilter Buttons:** Alle Lehrer-bezogenen Aktionen (Liste ansehen, einladen, befördern, zurückstufen) an einem Ort zu bündeln hält die bestehende Kundenverwaltung (PROJ-4) unangetastet und macht PROJ-22 unabhängig testbar.
- **Warnung statt Sperre bei Degradierung:** Der Admin behält die Kontrolle, wird aber informiert, bevor er jemanden zurückstuft, der noch aktiv unterrichtet — ohne unnötige Hürden aufzubauen.

### D) Abhängigkeiten (Pakete)

Keine neuen Fremdpakete nötig — die Einladungsfunktion ist Teil des bereits installierten Supabase-Pakets, wird hier nur erstmals mit einer erhöhten Berechtigung statt der öffentlichen Standard-Berechtigung verwendet. Diese Berechtigung (ein zusätzlicher geheimer Schlüssel) muss einmalig in der Serverkonfiguration (lokal und in Vercel) hinterlegt werden, bevor `/backend` beginnt.

## Implementation Notes (Frontend/Backend)

Frontend und Backend wurden zusammen in einem Durchgang umgesetzt (wie bei PROJ-7/8/9) — keine DB-Migration nötig, da `profiles.role` bereits `'teacher'` unterstützte.

### Neue Dateien
- `src/lib/supabase/admin.ts` — Server-only Supabase-Client mit dem Service-Role-Key (`createAdminClient()`), umgeht RLS vollständig; ausschließlich für die Einladungsfunktion genutzt, nirgends sonst importiert
- `src/lib/actions/admin/teachers.ts` — `inviteTeacher`, `promoteToTeacher`, `demoteToCustomer` (jeweils `requireAdmin()`-geschützt; Promote/Demote sind einfache `UPDATE profiles SET role = ...` mit zusätzlichem `.eq("role", ...)`-Sicherheitscheck gegen falsche Zustandsübergänge)
- `src/components/admin/teachers/teacher-manager.tsx` — Hauptkomponente inkl. Einladungs-Dialog (react-hook-form + Zod) und Kundensuche-Dialog (gleiches Suchmuster wie `customer-list.tsx`); lokaler State wird per `useEffect` mit den Server-Props synchronisiert (siehe PROJ-9-Erkenntnis zu `useState(initialProp)`)
- `src/app/admin/lehrer/page.tsx` — lädt Lehrer, Kunden (für die Beförderungssuche) und `course_teachers`-Zuordnungen (für die Degradierungs-Warnung) server-seitig
- `src/lib/validations/admin.ts` — neues `teacherInviteSchema`
- `src/components/admin/admin-nav.tsx` — neuer Nav-Punkt „Lehrer"

### Neue Umgebungsvariable
`SUPABASE_SERVICE_ROLE_KEY` — in `.env.local.example` dokumentiert, vom Nutzer lokal aus dem Supabase Dashboard eingetragen. Muss vor `/deploy` auch in Vercel gesetzt werden.

### Beim Live-Test gefundene und behobene Probleme
- **Fehlende Weiterleitung nach Einladung (echter Bug, behoben):** `inviteUserByEmail()` wurde ursprünglich ohne `redirectTo`-Option aufgerufen. Die eingeladene Person landete dadurch nach Klick auf den Mail-Link zwar eingeloggt, aber ohne Aufforderung, ein Passwort zu setzen — es existierte schlicht keines. Fix: `redirectTo: `${siteUrl}/passwort-zuruecksetzen`` ergänzt (exakt dasselbe etablierte Muster wie bei `resetPasswordForEmail` in `src/lib/actions/auth.ts`). Die bestehende `ResetPasswordForm`-Seite eignet sich unverändert dafür, da sie nur eine gültige Session voraussetzt, unabhängig davon, ob diese durch Passwort-Reset oder Einladung entstanden ist. Verifiziert per `auth.admin.generateLink()` (erzeugt den Link ohne Mail-Versand) und direktem Öffnen in Playwright — landet jetzt korrekt auf „Neues Passwort festlegen".
- **Generische Einladungs-E-Mail-Vorlage:** Supabases Standard-Vorlage für „Invite user" erwähnt nicht, wofür/von wem eingeladen wird. Das ist ein Supabase-Dashboard-Setting (Authentication → Email Templates → „Invite user"), kein Code — der Nutzer hat die Vorlage manuell auf Vienna-Salsa-Studio-Branding angepasst.
- **Root-Cause-Korrektur zu einer früheren Session-Annahme:** Die E-Mail-Zustellung an `@viennasalsastudio.test`-Adressen schlägt IMMER fehl („Domain does not exist" — `.test` ist eine reservierte, nicht auflösbare TLD nach RFC 2606). Das erklärt rückwirkend die früher als „Rate-Limit" gedeuteten Signup-Fehlschläge in dieser Session — es war nie ein Rate-Limit. Bei fehlgeschlagenem Mail-Versand rollt Supabase die Kontoerstellung selbst zurück (kein verwaistes Konto).

### Live-Test (Playwright + echte E-Mail, gegen Produktionsdaten, throwaway-Fixtures)
Getestet und bestanden: Leerzustand/Liste zeigt bestehende Lehrer → Kundensuche filtert korrekt (nur `role='customer'`) → Beförderung eines bestehenden Kunden funktioniert, verschwindet danach aus `/admin/kunden` → Degradierung ohne Kurs-Zuordnung erfolgt sofort ohne Dialog → Degradierung mit Kurs-Zuordnung zeigt Bestätigungsdialog mit korrektem Kursnamen → Einladung mit bereits registrierter E-Mail zeigt den vorgesehenen Fehlertext → Einladung mit echter E-Mail-Adresse (Nutzer-bereitgestellt) komplett end-to-end verifiziert: Mail kommt an, Link führt zu „Neues Passwort festlegen", Konto/Rolle/Name korrekt gesetzt.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
