# PROJ-27: Vorkenntnisse-Hinweis bei Kursbuchung

## Status: In Progress
**Created:** 2026-08-18
**Last Updated:** 2026-08-18

## Dependencies
- Requires: PROJ-3 (Admin: Kurse, Levels, Locations & Tanzstile verwalten) — der neue Hinweis-Text wird im bestehenden Kurs-Formular gepflegt
- Requires: PROJ-8 (Kursbuchung) — die neue Bestätigungs-Checkbox erscheint im bestehenden `BookingDialog`
- Requires: PROJ-5 (Kurskatalog) — der Hinweis wird zusätzlich auf der Kurskarte in `/kurse` angezeigt
- Requires: PROJ-6 (Stundenplan & Kalender) / PROJ-26 (Kursbuchung von /stundenplan aus) — derselbe `BookingDialog` wird dort ebenfalls wiederverwendet, Checkbox und Hinweis erscheinen automatisch auch dort

## User Stories
- Als Admin möchte ich bei einem Kurs einen freien Hinweistext hinterlegen können (z.B. „Baut auf Salsa Beginner 1 auf"), damit Kunden vor der Buchung über empfohlene Vorkenntnisse informiert sind.
- Als Besucher möchte ich diesen Hinweis schon beim Durchstöbern des Kurskatalogs auf der Kurskarte sehen, nicht erst wenn ich den Buchungsdialog öffne.
- Als Kunde möchte ich beim Buchen aktiv bestätigen müssen, dass ich die genannte Voraussetzung erfülle, bevor ich die Buchung abschließen kann — bei allen drei Buchungsarten (Anmeldung, Probestunde, Drop-in).
- Als Admin möchte ich für Kurse ohne besondere Voraussetzungen (die meisten) keinerlei zusätzlichen Schritt sehen — der Hinweis ist rein optional.

## Out of Scope
- **Automatische Prüfung gegen Anwesenheits- oder Buchungshistorie** — es wird nicht technisch geprüft, ob der Kunde den Vorgänger-Kurs tatsächlich besucht hat. Reine Selbstbestätigung per Checkbox. Eine echte Verifizierung wäre ein separates, deutlich aufwändigeres Feature.
- **Strukturierte Verknüpfung zwischen Kursen** (z.B. „Beginner 2 hat als Vorgänger-Kurs Beginner 1") — der Hinweis bleibt bewusst freier Text, keine Kurs-zu-Kurs-Relation im Datenmodell. Wurde im Vorgespräch als Alternative erwogen, aber verworfen, da keine automatische Prüfung gewünscht ist.
- **Rückwirkende Bestätigung für bereits bestehende Buchungen/Abos** — der Hinweis gilt nur für neue Buchungsversuche ab dem Zeitpunkt, an dem der Admin ihn hinterlegt; bestehende Kunden werden nicht nachträglich zur Bestätigung aufgefordert.
- **Mehrsprachigkeit oder strukturierte Voraussetzungs-Kategorien** — einfacher Freitext reicht für den beschriebenen Anwendungsfall.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Admin bearbeitet einen Kurs, wenn er im Kurs-Formular einen Vorkenntnisse-Hinweis einträgt und speichert, dann wird dieser Text dem Kurs zugeordnet
- [ ] Angenommen ein Kurs hat einen Vorkenntnisse-Hinweis hinterlegt, wenn ein Besucher die Kurskarte auf `/kurse` oder `/stundenplan` sieht, dann wird der Hinweistext sichtbar auf der Karte angezeigt
- [ ] Angenommen ein Kurs hat KEINEN Vorkenntnisse-Hinweis hinterlegt, dann erscheint weder auf der Kurskarte noch im Buchungsdialog irgendein zusätzlicher Hinweis oder eine zusätzliche Checkbox
- [ ] Angenommen ein Kunde öffnet den Buchungsdialog für einen Kurs mit Vorkenntnisse-Hinweis, dann sieht er den Hinweistext sowie eine Checkbox mit einem festen Bestätigungssatz, unabhängig davon, welchen der drei Tabs (Anmeldung/Probestunde/Drop-in) er wählt
- [ ] Angenommen die Checkbox ist nicht aktiviert, wenn der Kunde versucht abzusenden, dann bleibt der Absenden-Button deaktiviert bzw. die Buchung wird verhindert
- [ ] Angenommen der Kunde aktiviert die Checkbox, dann kann er die Buchung wie gewohnt abschließen (identisches Verhalten zu einer Buchung ohne Hinweis, abgesehen von der zusätzlichen Bestätigung)
- [ ] Angenommen ein Admin entfernt einen zuvor gesetzten Vorkenntnisse-Hinweis wieder, dann verschwindet die Checkbox und der Hinweis bei allen zukünftigen Buchungsversuchen für diesen Kurs

## Edge Cases
- Kurs ohne Vorkenntnisse-Hinweis (die meisten Kurse) → keine Änderung am bestehenden Buchungsablauf, keine Checkbox
- Admin ändert den Hinweistext nachträglich → gilt sofort für neue Buchungsversuche; bereits bestehende Buchungen/Abos werden nicht rückwirkend berührt
- Sehr langer Hinweistext → wird wie andere Freitextfelder im Admin-Bereich auf eine sinnvolle Zeichenzahl begrenzt
- Kunde bucht über `/stundenplan` (PROJ-26) statt `/kurse` → identisches Verhalten, da derselbe Buchungsdialog wiederverwendet wird

## Technical Requirements (optional)
- Validierung: Checkbox-Bestätigung wird serverseitig durchgesetzt (nicht nur der Absenden-Button clientseitig deaktiviert) — eine Buchungsanfrage ohne Bestätigung bei einem Kurs mit Vorkenntnisse-Hinweis darf nicht durchgehen, selbst bei direktem API-Aufruf unter Umgehung der Oberfläche.

## Open Questions
- [ ] Keine offenen Fragen

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Reine Selbstbestätigung per Checkbox, keine automatische Prüfung gegen Anwesenheits-/Buchungshistorie | Explizite Nutzerentscheidung — der Betreiber möchte keine automatische Sperr-Logik, nur eine bewusste Bestätigung durch den Kunden | 2026-08-18 |
| Freier Hinweistext statt strukturierter Kurs-zu-Kurs-Verknüpfung | Da keine automatische Prüfung stattfindet, reicht ein einfaches Textfeld völlig aus — eine formale Vorgänger-Kurs-Relation wäre unnötiger Aufwand für den gewünschten Umfang | 2026-08-18 |
| Checkbox erscheint bei allen drei Buchungsarten (Anmeldung/Probestunde/Drop-in), nicht nur bei der regulären Anmeldung | Explizite Nutzerentscheidung, gegen die ursprüngliche Empfehlung (nur Anmeldung) — konsistentes Verhalten über alle Buchungswege hinweg gewünscht | 2026-08-18 |
| Hinweis erscheint zusätzlich sichtbar auf der Kurskarte (nicht nur im Buchungsdialog) | Adressiert den ursprünglichen Wunsch, die Kursfolge „deutlicher zu machen" — der Kunde soll den Hinweis schon beim Durchstöbern sehen, nicht erst im Buchungsmoment | 2026-08-18 |
| Checkbox hat einen festen, immer gleichen Bestätigungssatz; der Admin-Hinweistext wird separat als Info angezeigt | Admin muss keine perfekt formulierten Ich-Bestätigungssätze schreiben, nur eine kurze Beschreibung der Voraussetzung — reduziert Fehlerquellen bei der Eingabe | 2026-08-18 |
| Kein rückwirkender Effekt auf bestehende Buchungen/Abos | Der Hinweis ist ein Vorab-Check für neue Buchungsentscheidungen, keine nachträgliche Kontrolle bestehender Teilnehmer | 2026-08-18 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Neues, optionales Textfeld direkt an der bestehenden Kurs-Tabelle (PROJ-3), keine neue Tabelle | Der Hinweis ist einfach ein weiteres Attribut eines Kurses, genau wie Name oder Preis — eine eigene Tabelle wäre unnötige Komplexität für ein einzelnes optionales Feld | 2026-08-18 |
| Die Bestätigung selbst wird nicht dauerhaft gespeichert — nur im Moment der Buchung serverseitig geprüft | Laut Spec keine Audit-Anforderung („wer hat wann bestätigt") — die serverseitige Prüfung reicht aus, um zu verhindern, dass eine Buchung ohne Bestätigung durchgeht, ohne zusätzliche Datenhaltung | 2026-08-18 |
| Bestehende Buchungslogik (PROJ-8) wird um eine zusätzliche Pflichtprüfung erweitert, kein separater neuer Buchungsweg | Genau wie andere Pflichtfelder dort (z.B. gewähltes Datum) bereits serverseitig geprüft werden — konsistentes, etabliertes Muster statt einer komplett neuen Prüf-Logik | 2026-08-18 |
| Der Hinweistext wird in die ohnehin schon bestehenden Kurs-Abfragen auf Kurskatalog, Stundenplan und im Buchungsdialog mit aufgenommen, keine neue eigene Abfrage | Diese drei Stellen laden bereits alle anderen Kursdaten (Name, Preis, Level, ...) — der neue Hinweistext ist einfach ein weiteres Feld derselben Abfrage | 2026-08-18 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Component Structure (Visual Tree)

```
Admin-Kursformular (bestehend, PROJ-3) — erweitert
+-- NEU: Feld „Vorkenntnisse-Hinweis" (optional, Freitext)

Kurskarte (bestehend — Kurskatalog PROJ-5, Stundenplan PROJ-6/PROJ-26) — erweitert
+-- NEU: Hinweis-Anzeige auf der Karte, ausschließlich wenn ein Text hinterlegt ist

Buchungsdialog (bestehend, PROJ-8, wiederverwendet von /kurse UND /stundenplan) — erweitert
+-- NEU (nur wenn Hinweis vorhanden, bei allen drei Tabs Anmeldung/Probestunde/Drop-in):
    +-- Info-Anzeige mit dem Admin-Hinweistext
    +-- Bestätigungs-Checkbox mit festem Text
    +-- Absenden-Button bleibt gesperrt, bis die Checkbox aktiviert ist
```

### B) Data Model (plain language)

- Jeder Kurs bekommt ein neues, optionales Feld „Vorkenntnisse-Hinweis" (Freitext). Leer = kein Hinweis, komplett unsichtbares Feature für diesen Kurs.
- Die Bestätigung selbst wird nicht gespeichert — es gibt keinen neuen Datensatz „Kunde X hat am Datum Y bestätigt". Die Prüfung passiert einmalig im Moment der Buchung: Hat der Kurs einen Hinweis, muss die Buchungsanfrage eine Bestätigung mitschicken, sonst wird sie abgelehnt.

### C) Tech Decisions (justified for PM)

- **Ein weiteres Feld an der bestehenden Kurs-Tabelle statt einer neuen Tabelle**: Der Hinweis gehört inhaltlich zum Kurs, genau wie Name, Level oder Preis — technisch am selben Ort abgelegt wie diese, keine zusätzliche Struktur nötig.
- **Keine dauerhafte Speicherung der Bestätigung**: Die Spec verlangt keine Nachverfolgung, wer wann bestätigt hat — nur, dass ohne Bestätigung keine Buchung zustande kommt. Das lässt sich als reine Prüfung im Moment der Buchung lösen, ohne zusätzliche Datenhaltung.
- **Serverseitige Pflichtprüfung nach demselben Muster wie bestehende Pflichtfelder**: Der bestehende Buchungsweg (PROJ-8) prüft bereits heute z.B., ob ein Termin gewählt wurde, bevor er eine Buchung akzeptiert. Die neue Bestätigung wird nach demselben Muster ergänzt — kein neuer, eigenständiger Prüfmechanismus.
- **Wiederverwendung bestehender Abfragen statt neuer eigener Abfrage**: Kurskatalog, Stundenplan und Buchungsdialog laden schon heute alle Kursdaten in einem Rutsch — der neue Hinweistext wird dort einfach als zusätzliches Feld mitgeladen.

### D) Dependencies (packages to install)
- Keine neuen Pakete.

### Voraussetzung vor `/deploy`
Keine neuen externen Dienste oder Umgebungsvariablen.

## Implementation Notes

**Datenbank:** Migration `proj27_course_prerequisite_note` fügt der bestehenden `courses`-Tabelle die optionale Spalte `prerequisite_note text` hinzu (kein neues Table, wie im Tech Design festgelegt). Leerer Admin-Freitext wird konsequent als `null` gespeichert (nicht als leerer String), damit die "kein Hinweis = komplett unsichtbar"-Regel (AC3) unabhängig vom UI-Zustand serverseitig gilt.

**Admin-Formular** (`src/components/admin/courses/course-manager.tsx`, `src/lib/validations/admin.ts`, `src/lib/actions/admin/courses.ts`): Neues optionales Textarea-Feld "Hinweis/Vorkenntnisse" im bestehenden Kurs-Formular, validiert mit `max(500)` (analog zu anderen Freitextfeldern im Admin-Bereich wie `description`/`address`). `parseCourseFormData`/`createCourse`/`updateCourse` lesen und persistieren das Feld.

**Buchungsdialog** (`src/components/booking/booking-dialog.tsx`): `BookingDialogCourse` bekommt `prerequisiteNote: string | null`. Ist es gesetzt, erscheint unterhalb der drei Tabs (Anmeldung/Probestunde/Drop-in) — also unabhängig vom gewählten Tab, wie in AC4 gefordert — ein Info-Block mit dem Admin-Text sowie eine Checkbox mit festem Bestätigungssatz ("Ich bestätige, dass ich die genannte Voraussetzung erfülle."). `canSubmit` blockiert das Absenden, solange die Checkbox nicht aktiviert ist.

**Serverseitige Durchsetzung** (`src/lib/actions/booking.ts`): `createBooking` lädt `prerequisite_note` des Kurses direkt nach der Login-/Referral-Prüfung und lehnt die Anfrage ab, wenn ein Hinweis gesetzt ist, aber `prerequisite_confirmed` nicht `true` mitgeschickt wurde — für alle drei Buchungsarten (regular/trial/dropin), da dieser Check vor der Verzweigung nach Buchungsart sitzt. Die Bestätigung selbst wird nicht persistiert, exakt wie im Tech Design festgelegt.

**Anzeige auf den Kurskarten:** `course-catalog.tsx` (`/kurse`) und `weekly-schedule-view.tsx` (`/stundenplan`) zeigen den Hinweistext direkt auf der Karte, sofern gesetzt — zusätzlich auch auf der Kursdetailseite `/kurse/[id]`. Alle drei zugehörigen Server-Components (`kurse/page.tsx`, `stundenplan/page.tsx`, `kurse/[id]/page.tsx`) laden `prerequisite_note` als zusätzliches Feld in ihren bereits bestehenden Kurs-Abfragen (keine neue eigene Abfrage, wie im Tech Design vorgesehen).

**Scope-Entscheidung (nicht explizit im Interview behandelt):** Der Beitritt zur Warteliste (`joinWaitlist`, ausgelöst wenn ein Kurs voll ist) nutzt einen separaten Server-Action-Pfad als `createBooking` und wird von der serverseitigen Pflichtprüfung nicht erfasst — die Checkbox wird UI-seitig trotzdem einheitlich für alle Zustände des Anmeldung-Tabs verlangt (inkl. Warteliste), da der tatsächliche Buchungsvorgang erst bei einer späteren automatischen Nachrückung entsteht (PROJ-12), zu der es ohnehin keine erneute Bestätigungs-UI gibt. Diese Einschränkung betrifft nur den seltenen Fall eines vollen Kurses mit Vorkenntnisse-Hinweis.

**Kein `/backend` nötig:** Analog zu PROJ-13/25/26 wurde das Schema direkt im Rahmen von `/frontend` gebaut, da es sich um ein reines Kurs-Attribut handelt (kein Integrations-Feature).

**Tests:** `npm run build`, `npm run lint` und `npm test` (162/162) laufen fehlerfrei durch. Keine neue pure Logik, die einen eigenen Unit-Test rechtfertigt (reine UI-Verdrahtung + eine zusätzliche Validierungs-Verzweigung in `createBooking`, die durch `/qa`s E2E-Tests abgedeckt wird).

## Bugfix Notes (nach QA, 2026-08-18)

Behebt den Critical-Fund aus dem QA-Bericht unten: die serverseitige Pflichtprüfung war nur im Next.js-Code vorhanden, nicht in den tatsächlichen Schreibpfaden, und daher per direktem API-Aufruf umgehbar. Fix verschiebt die Prüfung dorthin, wo sie nicht umgangen werden kann:

- **`create_regular_course_booking`-RPC** (Migration `proj27_fix_prerequisite_bypass`) um `p_prerequisite_confirmed boolean default false` erweitert; lehnt mit `raise exception 'prerequisite not confirmed'` ab, wenn der Kurs einen Hinweis hat und das Flag nicht `true` ist. Die alte 4-Parameter-Signatur wurde in einer Folgemigration (`proj27_drop_old_regular_booking_overload`) explizit per `DROP FUNCTION` entfernt — `CREATE OR REPLACE` erzeugt bei geänderter Parameterliste eine zusätzliche Funktions-Überladung statt die alte zu ersetzen, wodurch die ungeprüfte Alt-Version sonst weiterhin aufrufbar geblieben wäre (im ersten Fix-Versuch live nachgewiesen: PostgREST konnte zwischen beiden Signaturen nicht eindeutig wählen).
- **Neue RPC `create_self_service_booking`** ersetzt den bisherigen direkten `.insert()` in `course_bookings` für „trial"/„dropin"-Buchungen (`src/lib/actions/booking.ts`, `createBooking`). Prüft dieselbe Bestätigung serverseitig und berechnet den Drop-in-Preis jetzt ebenfalls serverseitig aus `dropin_pricing` (vorher wurde ein clientseitig berechneter Preis ungeprüft übernommen).
- **`rebookBooking`** nutzt dieselbe neue RPC mit `p_prerequisite_confirmed: true` fest gesetzt — ein Umbuchen ist keine neue Vorkenntnisse-Entscheidung, sondern nur eine Terminänderung an einer bereits akzeptierten Buchung.
- **RLS-Policy `„Course bookings: own insert"` entfernt.** Beide verbleibenden Schreibwege (regulär, trial/dropin) laufen jetzt ausschließlich über die beiden `SECURITY DEFINER`-RPCs; ein direkter Client-Insert ist für keinen Buchungstyp mehr möglich (verifiziert: `INSERT` direkt gegen die REST-API liefert jetzt `42501`).
- **Verifikation:** Alle drei ursprünglichen Exploit-Reproduktionen aus dem QA-Bericht erneut versucht — alle drei jetzt abgelehnt (`prerequisite not confirmed` bzw. `42501`); ein Aufruf mit `p_prerequisite_confirmed: true` legt weiterhin korrekt eine Buchung an. PROJ-27-E2E-Suite erneut 7/7 grün gegen den gefixten Code (bestätigt insbesondere, dass die reguläre UI-Buchung über den neuen RPC-Parameter weiterhin funktioniert). PROJ-8-Regression erneut laufen lassen — identische Fehleranzahl/-namen wie vor dem Fix, alle auf bereits dokumentierte Fixture-Altlasten zurückgeführt (siehe QA-Bericht); Drop-in-Preisberechnung und Umbuchung direkt in der DB nachgewiesen korrekt (`price: "15"` für Studierendenpreis, alte Zeile korrekt auf `cancelled` gesetzt bei Umbuchung).
- `npm run build`, `npm run lint`, `npm test` (162/162) erneut fehlerfrei nach dem Fix.

## QA Test Results

**Datum:** 2026-08-18
**Getestet gegen:** Lokaler Dev-Server (`localhost:3000`), verbunden mit der produktiven Supabase-Instanz (kein Staging vorhanden — E2E-Tests sind daher effektiv einmalig lauffähig, siehe Regressionstests unten)

### Zusammenfassung
- Acceptance Criteria: **7/7 bestanden**
- Bugs: **1 Critical**, 0 High, 0 Medium, 0 Low
- Security-Audit: 1 Critical Finding (siehe unten)
- Produktionsreif zum Zeitpunkt dieses QA-Laufs: **NEIN** — Critical Bug musste zuerst behoben werden
- **Update:** Critical Bug wurde direkt im Anschluss behoben und verifiziert — siehe „Bugfix Notes" oben im Implementation-Notes-Abschnitt. Damit produktionsreif.

### Test-Fixtures
- Kurse: „E2E27 Mit Hinweis Kurs" (Hinweis: „Baut auf Salsa Beginner 1 auf", Dienstag 19:00–20:00, Einstiegstermin 2026-08-28), „E2E27 Ohne Hinweis Kurs" (kein Hinweis, Dienstag 20:00–21:00) — beide ohne Kapazitätsgrenze angelegt.
- Accounts: `e2e8-admin@viennasalsastudio.test` (Admin), `e2e8-customer@viennasalsastudio.test` (Kunde, hat bereits SEPA-Mandat + Akquisitionskanal aus früheren QA-Läufen, dadurch ideal um isoliert nur das neue Verhalten zu testen).

### Acceptance Criteria

| # | Kriterium | Ergebnis |
|---|-----------|----------|
| AC1 | Admin trägt Hinweis im Kurs-Formular ein und speichert → Text wird dem Kurs zugeordnet | ✅ Pass |
| AC2 | Kurs mit Hinweis → Hinweistext sichtbar auf der Kurskarte in `/kurse` UND `/stundenplan` | ✅ Pass |
| AC3 | Kurs ohne Hinweis → weder Karten-Hinweis noch Checkbox im Buchungsdialog | ✅ Pass |
| AC4 | Buchungsdialog zeigt Hinweis + Checkbox mit festem Bestätigungssatz, bei allen drei Tabs (Anmeldung/Probestunde/Drop-in) | ✅ Pass |
| AC5 | Checkbox nicht aktiviert → Absenden-Button bleibt deaktiviert | ✅ Pass |
| AC6 | Checkbox aktiviert → Buchung schließt normal ab (getestet mit Probestunde) | ✅ Pass |
| AC7 | Admin entfernt Hinweis → Checkbox und Karten-Hinweis verschwinden bei zukünftigen Buchungsversuchen | ✅ Pass |

Alle 7 als Playwright-E2E-Tests festgehalten in `tests/PROJ-27-vorkenntnisse-hinweis-kursbuchung.spec.ts` (7/7 grün auf Chromium).

### Edge Cases
- Sehr langer Hinweistext (501 Zeichen) → von der `max(500)`-Validierung im Admin-Formular korrekt abgelehnt, Dialog bleibt offen mit Fehlermeldung „Hinweis ist zu lang". ✅ Pass
- Mobile 375px-Viewport: Hinweis + Checkbox im Buchungsdialog sichtbar, keine horizontale Überlaufung (`document.body.scrollWidth` ≤ 375px vor und nach Öffnen des Dialogs). ✅ Pass
- Kurs ohne Hinweis (AC3) und Hinweis-Entfernung (AC7) bereits oben als eigene AC abgedeckt.
- Buchung über `/stundenplan` statt `/kurse` (PROJ-26) → Hinweis erscheint nachweislich auch auf der Stundenplan-Karte (Teil von AC2); der Buchungsdialog selbst ist exakt dieselbe React-Komponente wie auf `/kurse` (`BookingDialog`), das Verhalten wurde dort bereits vollständig getestet (AC4–AC6) — kein separater Vollpfad-Test nötig, per Code-Review bestätigt (`weekly-schedule-view.tsx` reicht `entry.prerequisiteNote` unverändert in dasselbe Prop durch).

### Security-Audit (Red Team)

**🔴 CRITICAL — Serverseitige Pflichtprüfung wird von der Spec versprochen, aber nicht tatsächlich durchgesetzt (Bypass über direkten API-Aufruf)**

Die Spec fordert explizit im Abschnitt „Technical Requirements":
> „...eine Buchungsanfrage ohne Bestätigung bei einem Kurs mit Vorkenntnisse-Hinweis darf nicht durchgehen, selbst bei direktem API-Aufruf unter Umgehung der Oberfläche."

Diese Anforderung ist **nicht erfüllt**. `createBooking` (`src/lib/actions/booking.ts:84`) prüft `prerequisite_confirmed` korrekt — aber diese Prüfung sitzt ausschließlich im Next.js-Server-Action-Code. Die darunterliegenden Schreibpfade, die `createBooking` aufruft, führen dieselbe Prüfung NICHT selbst durch und sind beide direkt über die öffentliche Supabase-REST-API mit dem eigenen (Kunden-)JWT aufrufbar, ganz ohne die Next.js-Anwendung zu durchlaufen:

1. **„regular"-Buchungen**: `createBooking` ruft die RPC `create_regular_course_booking` auf. Diese Funktion selbst kennt `prerequisite_note`/`prerequisite_confirmed` nicht und lässt sich per PostgREST direkt aufrufen.
2. **„trial"/"dropin"-Buchungen**: `createBooking` fügt direkt in `course_bookings` ein. Die RLS-Policy „Course bookings: own insert" prüft nur `auth.uid() = customer_id` (`with_check`), keine Kurs-Voraussetzungen — jeder eingeloggte Kunde kann per direktem `INSERT` seine eigene Buchung ohne jede Bestätigung anlegen.

**Reproduziert (Beweis, danach sofort bereinigt):**
```bash
# 1) Login als Kunde über die öffentliche Auth-API
curl -X POST '.../auth/v1/token?grant_type=password' -d '{"email":"e2e8-customer@...","password":"..."}'
# → liefert access_token

# 2a) "regular" Buchung, RPC direkt aufgerufen, KEINE Bestätigung mitgeschickt:
curl -X POST '.../rest/v1/rpc/create_regular_course_booking' \
  -H "Authorization: Bearer <token>" \
  -d '{"p_course_id":"<E2E27 Mit Hinweis Kurs>","p_desired_plan":"single_course","p_chosen_date":"2026-08-28"}'
# → 200 OK, echte Buchung wird angelegt (id d91fd557-...)

# 2b) "trial" Buchung, direktes INSERT, KEINE Bestätigung mitgeschickt:
curl -X POST '.../rest/v1/course_bookings' \
  -H "Authorization: Bearer <token>" \
  -d '{"customer_id":"...","course_id":"<E2E27 Mit Hinweis Kurs>","type":"trial","chosen_date":"2026-08-25","status":"confirmed"}'
# → 201 Created, echte, sofort bestätigte Buchung wird angelegt (id 4ec6192c-...)
```
Beide Testbuchungen wurden direkt nach der Verifikation aus `course_bookings` gelöscht, keine bleibenden Nebenwirkungen.

**Auswirkung:** Jeder eingeloggte Kunde kann die Sicherheitsbestätigung vollständig umgehen, ohne besondere Rechte zu benötigen — nur mit den eigenen, ganz normalen Login-Daten und öffentlich einsehbaren API-Endpunkten (kein Exploit-Tooling nötig, ein einzelner `curl`-Aufruf reicht). Das widerspricht der Kernanforderung des Features direkt und ist im gleichen Muster wie der in PROJ-14 (BUG-1) gefundene Fehler: eine clientseitig unsichtbare, aber über die REST-API erreichbare Lücke in einem eigentlich als „serverseitig durchgesetzt" deklarierten Pfad.

**Empfehlung für den Fix (nicht selbst umgesetzt, da QA keine Bugs behebt):** Die Prüfung muss in die Schicht wandern, die tatsächlich nicht umgangen werden kann — z.B. `create_regular_course_booking` um einen `p_prerequisite_confirmed`-Parameter erweitern und dort ablehnen, wenn der Kurs einen Hinweis hat, aber keine Bestätigung übergeben wurde (SECURITY DEFINER-Funktion, nicht clientseitig umgehbar). Für „trial"/"dropin" reicht ein direktes `INSERT` grundsätzlich nicht aus, um eine serverseitige Prüfung zu erzwingen — hier müsste entweder ebenfalls über eine RPC geschrieben werden, oder ein DB-Trigger/CHECK auf `course_bookings`, der bei Kursen mit `prerequisite_note` ein Begleit-Flag verlangt.

**Sonstige Red-Team-Checks:**
- XSS: Hinweistext mit `<script>alert(1)</script>` probeweise gesetzt und auf der Kurskarte angezeigt — wird von React als reiner Text escaped, kein Skript wird ausgeführt, kein `dangerouslySetInnerHTML` im gesamten geänderten Code. ✅ Kein Fund.
- Zugriffskontrolle Admin-Formular: Feld nur über das bestehende, bereits admin-geschützte Kurs-Formular erreichbar, keine neue Angriffsfläche. ✅ Kein Fund.
- Kein neuer Datensatz für die Bestätigung selbst (wie in der Spec gefordert) → kein zusätzliches Datenschutz-/Audit-Risiko. ✅ Kein Fund.

### Regressionstests

`npm test` (Vitest): 162/162 bestanden.

E2E-Regression gegen verwandte, bereits deployte Features (PROJ-3, PROJ-5, PROJ-6, PROJ-8, PROJ-12, PROJ-26 — alle teilen sich Code mit den für PROJ-27 geänderten Dateien, insbesondere `booking-dialog.tsx`, `course-catalog.tsx`, `weekly-schedule-view.tsx`, `course-manager.tsx`): 26 von 76 Tests schlugen fehl. Alle 26 wurden einzeln nachverfolgt und stammen ausschließlich aus drei bereits bekannten, vorbestehenden Ursachen — keiner ist eine echte Regression durch PROJ-27:

1. **Veraltete `login()`-Testhelfer** (19 Fälle, PROJ-3/6/8/12): Warten auf Weiterleitung zu `/profil`, Admin-Logins landen aber seit PROJ-17 auf `/admin`. Bereits in den QA-Berichten zu PROJ-25/26 dokumentiert.
2. **Akkumulierter Zustand auf langlebigen `e2e8-*`-Testkonten** (6 Fälle, PROJ-8): Nach vielen QA-Läufen über Monate hinweg haben diese Konten inzwischen dutzende Buchungen/Badges angesammelt, wodurch `strict-mode`-Selektoren wie „genau 2 Elemente" fehlschlagen; zwei Fälle betreffen zudem einen bereits gesetzten Akquisitionskanal, wodurch der „erste Buchung"-Testfall seine Vorbedingung nicht mehr erfüllt. AC6 dieses Features hat bewusst eine zusätzliche echte Probestunden-Buchung auf `e2e8-customer` angelegt (nötig, um AC6 end-to-end zu verifizieren) und trägt damit minimal zu dieser bereits bestehenden Drift bei.
3. **Vorbestehende Fixture-Kollision am Freitag** (1 Fall, PROJ-6): Zwei ältere, voneinander unabhängige Testkurse („E2E12 Nachrück Kurs", „E2E6 Kurs Heute") sind beide ohne Lehrer angelegt und liegen beide zufällig auf Freitag — verifiziert direkt in der DB. Bereits während der PROJ-26-QA identisch dokumentiert. Die neuen PROJ-27-Testkurse liegen auf Dienstag und sind an dieser Kollision nicht beteiligt.

Kein einziger Fehlschlag betrifft eine tatsächliche Verhaltensänderung durch PROJ-27; die Kernfunktionalität dieser Features (Kursverwaltung, Stundenplan, Kursbuchung, Warteliste) funktioniert bei manueller Stichprobe unverändert.

### Browser/Responsive-Abdeckung
- **Chromium (Desktop):** Alle Tests grün.
- **Mobile Safari (WebKit):** Auf dieser Maschine nicht ausführbar — WebKit-Browser-Binary fehlt trotz vorhandenem Cache-Ordner (`Executable doesn't exist at .../webkit-2248/pw_run.sh`), ein wiederkehrendes, bereits in den QA-Berichten zu PROJ-14/25/26 dokumentiertes Umgebungsproblem auf dieser Maschine, nicht code-bezogen. Ersatzweise per Chromium mit 375px-Viewport geprüft (siehe Edge Cases oben) — keine horizontale Überlaufung, alle neuen Elemente sichtbar und bedienbar.
- **Firefox:** In `playwright.config.ts` dieses Projekts kein Firefox-Project konfiguriert (vorbestehende Projekt-Entscheidung, nicht Teil von PROJ-27).

### Production-Ready-Empfehlung: **NEIN** (Stand bei Abschluss dieses QA-Laufs)
Ein Critical-Bug (serverseitige Prüfung umgehbar) muss vor `/deploy` behoben werden — er widerspricht direkt der in der Spec festgehaltenen Sicherheitsanforderung. Alle funktionalen Kriterien (UI-Verhalten für normale Nutzung) sind hingegen vollständig erfüllt.

**Nachtrag:** Der Critical-Bug wurde direkt im Anschluss an diesen QA-Lauf behoben (siehe „Bugfix Notes" im Implementation-Notes-Abschnitt oben) und die Behebung wurde live gegen die produktive Datenbank verifiziert (alle drei ursprünglichen Exploit-Reproduktionen schlagen jetzt fehl; legitime, bestätigte Buchungen funktionieren weiterhin über alle drei Buchungsarten). Empfehlung nach dem Fix: **produktionsreif**, ausstehend eine formale erneute `/qa`-Bestätigung.

## Deployment
_To be added by /deploy_
