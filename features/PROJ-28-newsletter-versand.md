# PROJ-28: Newsletter-Versand mit Empfängergruppen

## Status: In Progress
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Dependencies
- PROJ-16 (Automatische E-Mail-/Push-Benachrichtigungen) — nutzt bestehende Mail-/Queue-Infrastruktur und Opt-out-System
- PROJ-29 (Probestunden-Follow-up & Conversion-Tracking) — liefert die Definition für die Gruppe "Probestunde ohne Folgebuchung"
- PROJ-32 (Aktive-Kunden-Anzahl im Dashboard) — teilt sich die Definition von "aktiver Kunde"

## User Stories
- Als Admin möchte ich eine E-Mail an eine wählbare Gruppe von Kunden verschicken, damit ich Ankündigungen, Aktionen oder Terminänderungen kommunizieren kann, ohne jeden Kunden einzeln anzuschreiben.
- Als Admin möchte ich aus vordefinierten Empfängergruppen wählen (Alle Kunden, Aktive Kunden, Kunden mit Probestunde ohne Folgebuchung, Teilnehmer eines bestimmten Kurses), damit ich die richtige Zielgruppe erreiche.
- Als Kunde möchte ich Newsletter-E-Mails abbestellen können, ohne dabei wichtige transaktionale E-Mails (Buchungsbestätigung etc.) zu verlieren.

## Out of Scope
- Rich-Text/WYSIWYG-Editor mit Bildern — nur Betreff + Fließtext fürs MVP
- Öffnungs-/Klickraten-Tracking (Analytics) — nur Erfolg/Misserfolg des Versands
- Zeitgesteuerter/geplanter Versand — nur Sofortversand fürs MVP
- Weitere Segmentierung (z.B. nach Tanzstil, Level) über die 4 definierten Gruppen hinaus
- SMS/Push als Newsletter-Kanal — nur E-Mail

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen der Admin ist im Newsletter-Bereich, wenn er eine Empfängergruppe auswählt, dann wird die Anzahl der Empfänger in dieser Gruppe angezeigt, bevor er sendet
- [ ] Angenommen der Admin hat Betreff, Text und eine Gruppe ausgefüllt, wenn er auf „Senden" klickt, dann erscheint eine Bestätigungsabfrage mit Empfängeranzahl vor dem tatsächlichen Versand
- [ ] Angenommen der Versand wurde bestätigt, wenn die Newsletter-Mail verschickt wird, dann erhalten nur Kunden, die Newsletter-Benachrichtigungen nicht deaktiviert haben, die E-Mail
- [ ] Angenommen ein Kunde hat Newsletter-Benachrichtigungen in seinen Benachrichtigungseinstellungen deaktiviert, wenn ein Newsletter verschickt wird, dann erhält dieser Kunde keine E-Mail
- [ ] Angenommen die Gruppe „Aktive Kunden" ist gewählt, wenn der Newsletter verschickt wird, dann erhalten nur Kunden mit mindestens einem Abo im Status „aktiv" die E-Mail
- [ ] Angenommen die Gruppe „Probestunde ohne Folgebuchung" ist gewählt, wenn der Newsletter verschickt wird, dann erhalten nur Kunden, deren letzte Probestunden-Buchung noch nicht zu einer regulären Buchung/Abo geführt hat, die E-Mail
- [ ] Angenommen die Gruppe „Kurs-Teilnehmer" ist gewählt, wenn der Admin zusätzlich einen Kurs auswählt, dann erhalten nur aktuell in diesem Kurs gebuchte Kunden die E-Mail
- [ ] Angenommen Betreff oder Text sind leer, wenn der Admin auf „Senden" klickt, dann wird eine Validierungsfehlermeldung angezeigt und kein Versand ausgelöst
- [ ] Angenommen eine gewählte Gruppe hat 0 Empfänger, wenn der Admin senden will, dann wird ein Hinweis angezeigt und der Senden-Button bleibt deaktiviert
- [ ] Angenommen der Newsletter wurde verschickt, wenn der Admin die Versandhistorie öffnet, dann sieht er vergangene Newsletter mit Betreff, Datum, Gruppe und Empfängeranzahl

## Edge Cases
- Der Versand an hunderte Empfänger darf die Admin-UI nicht blockieren — läuft asynchron über die bestehende `notification_queue`.
- Ein Kunde gehört zu mehreren sich überschneidenden Gruppen (z.B. aktiv + Kursteilnehmer) — wird pro Versand nur einmal angeschrieben (Deduplizierung nach `customer_id`).
- Ein gewählter Kurs hat 0 Teilnehmer — Kurs bleibt auswählbar, Empfängeranzahl zeigt 0, Senden-Button bleibt deaktiviert.
- Ein Kunde ohne gültige E-Mail-Adresse wird beim Versand übersprungen, ohne den gesamten Versand abzubrechen.

## Technical Requirements (optional)
- Versand läuft über die bestehende Notification-Queue (asynchron, kein Blocking).

## Open Questions
- [ ] Soll die Versandhistorie später um Öffnungs-/Klickraten erweitert werden? → Aktuell bewusst Out of Scope, ggf. eigenes Folge-Feature.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| 4 Empfängergruppen: Alle, Aktive, Probestunde ohne Folgebuchung, pro Kurs | Deckt das genannte Follow-up-Szenario und die Kurs-Zielgruppe ab, ohne die Segmentierung zu überladen | 2026-08-21 |
| Einfacher Editor (Betreff + Fließtext) statt Rich-Text | Schneller umsetzbar, passt zum bisherigen minimalen Tooling der App | 2026-08-21 |
| Nur Sofortversand, kein geplanter Versand | Reduziert Scope fürs MVP | 2026-08-21 |
| Newsletter nutzt einen neuen `newsletter`-Event-Typ im bestehenden Opt-out-System | Konsistent mit PROJ-16, kein neues Consent-System nötig | 2026-08-21 |
| „Probestunde ohne Folgebuchung" nutzt die Conversion-Logik aus PROJ-29 | Vermeidet doppelte Definition derselben Berechnung in zwei Features | 2026-08-21 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Neue, kleine Tabelle `newsletter_sends` für die Versandhistorie (Betreff, Text, Gruppe, Kurs falls zutreffend, Empfängeranzahl, Zeitpunkt, Absender) | Rein informative Historie, kein bestehender Datensatz deckt das ab; analog zu den bereits etablierten kleinen Zusatztabellen aus PROJ-29 | 2026-08-21 |
| Versand über die bestehende `notification_queue`-Bulk-Enqueue-Funktion (kein `enqueueAndDispatch` pro Kunde) | Verhindert, dass der Admin-Klick auf „Senden" bei hunderten Empfängern blockiert — identisches Muster zum bestehenden Sammel-Lastschriftlauf (PROJ-7), der ebenfalls nur enqueued und den Versand dem Cron überlässt | 2026-08-21 |
| Neue Benachrichtigungs-Ereignisgruppe `newsletter`, aber **nur E-Mail-Kanal** (kein Push) | Entspricht der Spec-Vorgabe „nur E-Mail als Kanal"; im Unterschied zu allen bestehenden Gruppen ist dies die erste Gruppe ohne Push-Option — die Einstellungen-Tabelle zeigt für diese Zeile einen Strich statt eines Push-Schalters | 2026-08-21 |
| Newsletter-Inhalt (Betreff/Text) wird nicht in jeder Queue-Zeile dupliziert, sondern per `send_id`-Referenz auf `newsletter_sends` zur Versandzeit nachgeladen | Vermeidet hunderte Kopien desselben Texts in `notification_queue`; konsistent mit dem bereits bestehenden Muster, bei dem jede Queue-Zeile nur eine ID referenziert und der eigentliche Inhalt erst beim Versand aufgelöst wird | 2026-08-21 |
| „Probestunde ohne Folgebuchung"-Gruppe: nur die **letzte** Probestunde pro Kunde zählt, nicht irgendeine | Direkte Umsetzung der Spec-Formulierung „deren letzte Probestunden-Buchung..."; nutzt dieselbe Konvertierungs-Prüfung wie PROJ-29 (`hasConvertedSince`), aber nur für den jeweils spätesten Probestunden-Termin pro Kunde | 2026-08-21 |
| Empfängerzahl-Vorschau (vor dem Senden) läuft über eine reine Zähl-Server-Action, ohne etwas zu schreiben | Erlaubt AC1 (Live-Anzeige der Empfängerzahl bei Gruppenwahl) ohne Nebenwirkungen; dieselbe Funktion wird beim tatsächlichen Versand erneut aufgerufen, um die endgültige Liste zu ermitteln | 2026-08-21 |
| `/backend` nötig (neue Tabelle, neue Ereignisgruppe, zwei neue Server Actions) | Analog zu PROJ-29 — Versandhistorie und Empfängerauflösung sind serverseitige Logik, kein reines Frontend-Feature | 2026-08-21 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Component Structure (Visual Tree)

```
Neue Admin-Seite: /admin/newsletter ("Newsletter" in der Admin-Navigation)
├── Versand-Formular
│   ├── Betreff (Text)
│   ├── Text (mehrzeilig, kein Rich-Text)
│   ├── Empfängergruppe (Alle Kunden / Aktive Kunden /
│   │   Probestunde ohne Folgebuchung / Kurs-Teilnehmer)
│   ├── Kurs-Auswahl (nur sichtbar, wenn „Kurs-Teilnehmer" gewählt ist)
│   ├── Live-Empfängerzahl — aktualisiert sich bei jeder Gruppen-/Kurs-Änderung
│   ├── „Senden"-Button — deaktiviert bei leerem Betreff/Text oder 0 Empfängern
│   └── Bestätigungsdialog vor dem tatsächlichen Versand, zeigt die
│       Empfängerzahl noch einmal zur Bestätigung
└── Versandhistorie (Tabelle)
    └── Spalten: Betreff, Datum, Gruppe (inkl. Kursname falls zutreffend),
        Empfängeranzahl

Kundenprofil → Benachrichtigungen: neue Zeile „Newsletter" in der
bestehenden Einstellungen-Tabelle aus PROJ-16 — nur mit E-Mail-Schalter,
Push-Spalte zeigt für diese Zeile einen Strich statt eines Schalters.
```

### B) Data Model (plain language)

```
Neue Tabelle „Newsletter-Versände" — ein Eintrag pro tatsächlich
ausgelöstem Versand:
- Betreff, Text
- Gewählte Empfängergruppe (und Kurs, falls „Kurs-Teilnehmer" gewählt war)
- Anzahl der tatsächlich erreichten Empfänger
- Zeitpunkt und ausführender Admin

Empfängerlisten selbst werden NICHT gespeichert — sie werden bei jeder
Gruppenwahl live aus bereits bestehenden Daten berechnet, analog zum
bereits etablierten Muster abgeleiteter Berechnungen (PROJ-29, PROJ-31,
PROJ-33):
- Alle Kunden: alle Kundenprofile mit gültiger E-Mail
- Aktive Kunden: Kunden mit mindestens einem Abo im Status „aktiv"
  (identische Definition wie im Dashboard, PROJ-32)
- Probestunde ohne Folgebuchung: Kunden, deren jeweils letzte
  Probestunden-Buchung noch zu keiner regulären Buchung/keinem Abo
  geführt hat (nutzt dieselbe Konvertierungs-Berechnung wie PROJ-29)
- Kurs-Teilnehmer: Kunden mit aktivem Abo oder offener/bestätigter
  regulärer Buchung für den gewählten Kurs

Der eigentliche Versand läuft über die bereits bestehende
Benachrichtigungs-Warteschlange (PROJ-16): pro Empfänger wird eine
Zeile mit einem Verweis auf den Versand-Datensatz angelegt (nicht der
volle Text dupliziert), der Cron verschickt sie asynchron. Kunden mit
deaktivierter Newsletter-Benachrichtigung oder ohne gültige E-Mail
werden automatisch übersprungen — dieselbe Logik, die bereits für alle
anderen Benachrichtigungstypen gilt.

Gespeichert in: neue Tabelle nur für die Versandhistorie; alle
Empfängerdaten bleiben abgeleitet, nicht dupliziert.
```

### C) Tech Decisions (justified for PM)

- **Empfängerlisten werden nie gespeichert, immer live berechnet:** Genau wie bei den bereits umgesetzten Features PROJ-29/31/33 — das stellt sicher, dass die angezeigte Empfängerzahl beim Senden immer den tatsächlich aktuellen Stand widerspiegelt, nicht einen veralteten Schnappschuss.
- **Versand läuft asynchron über die bereits bestehende Warteschlange:** Der Admin-Klick auf „Senden" ist sofort fertig, auch bei hunderten Empfängern — der tatsächliche E-Mail-Versand passiert im Hintergrund, genau wie bei allen anderen automatisierten Benachrichtigungen in der App.
- **Kein neuer Versandweg, sondern Wiederverwendung:** Newsletter ist technisch nur eine weitere Ereignisgruppe im bereits bestehenden Benachrichtigungssystem (PROJ-16) — Opt-out, Zustellungsstatus und Fehlerbehandlung (fehlende/ungültige E-Mail wird übersprungen, bricht den Versand nicht ab) funktionieren dadurch automatisch mit, ohne neu gebaut zu werden.
- **Bestätigungsdialog vor dem Versand:** Ein Newsletter-Versand lässt sich nicht rückgängig machen (E-Mails sind raus) — die Bestätigungsabfrage mit Empfängerzahl ist eine bewusste Sicherheitsbremse gegen versehentliches Absenden.

### D) Dependencies (packages to install)

- Keine neuen Pakete nötig — nutzt bereits vorhandene shadcn/ui-Bausteine (Textarea, Select, AlertDialog, Table) sowie die bestehende PROJ-16-Benachrichtigungs- und PROJ-29-Konvertierungs-Infrastruktur.

## Implementation Notes (Backend)

**Refactor vor der eigentlichen Implementierung:** Die Konvertierungs-Prüfung aus PROJ-29 (`hasConvertedSince`, bisher privat in `dispatch.ts`) wurde nach `src/lib/trials/conversion.ts` verschoben und exportiert, da PROJ-28 dieselbe Logik für die Gruppe „Probestunde ohne Folgebuchung" braucht. Eine dritte Kopie derselben Prüfung anzulegen hätte genau das Risiko wiederholt, das bereits zu PROJ-29s BUG-1 geführt hat (ein Status-Filter, der in einer Kopie vergessen wird). `dispatch.ts` importiert die Funktion jetzt von dort, keine Verhaltensänderung.

**Datenbank** (Migration `proj28_newsletter_sends`): neue Tabelle `newsletter_sends` (Betreff, Text, Empfängergruppe, optionaler Kurs, Empfängeranzahl, Absender, Zeitpunkt) mit admin-only RLS (SELECT/INSERT, kein UPDATE/DELETE — reine Historie). `notification_queue`/`notification_preferences` CHECK-Constraints um `newsletter` erweitert.

**Empfängerauflösung** (`src/lib/newsletter/recipients.ts`, `resolveRecipientIds`): eine gemeinsame Funktion für alle vier Gruppen, genutzt sowohl für die Live-Vorschau als auch den tatsächlichen Versand (garantiert, dass beide immer dieselbe Liste sehen). „Probestunde ohne Folgebuchung" ermittelt zuerst pro Kunde die jeweils *letzte* bestätigte Probestunde (per `ORDER BY chosen_date DESC`, erster Treffer pro Kunde gewinnt), prüft dann nur diese über die gemeinsame `hasConvertedSince`-Funktion.

**Bug gefunden und behoben (noch vor QA, während der eigenen Verifikation):** „Kurs-Teilnehmer" zählte ursprünglich sowohl offene als auch bereits *bestätigte* reguläre Buchungen als aktuell Teilnehmende. Live-Verifikation zeigte: eine bestätigte Buchung erzeugt zwar bei der Bestätigung automatisch ein Abo, aber falls dieses Abo *später* gekündigt wird, bleibt die ursprüngliche Buchung für immer auf „confirmed" stehen — der Kunde wäre dadurch fälschlich weiterhin als aktueller Teilnehmer gezählt worden. Behoben: nur noch *offene* reguläre Buchungen zählen zusätzlich zu aktiven Abos, exakt dieselbe Konvention wie die bereits bestehende Auslastungsberechnung in `src/app/admin/kurse/page.tsx`.

**Newsletter ist die erste Benachrichtigungsgruppe ohne Push-Kanal:** `notificationEmailOnlyGroups` (neuer Export in `constants/notifications.ts`) steuert sowohl die Kunden-Einstellungen-UI (zeigt einen Strich statt eines Schalters für Push) als auch `dispatch.ts` (versucht nie Push für `newsletter`, unabhängig vom — standardmäßig „an" — Präferenzwert, da es dafür ja gar keinen Schalter gibt).

**Versand** (`src/lib/actions/admin/newsletter.ts`): `previewRecipientCount` (reine Zählung, keine Nebenwirkung) und `sendNewsletter` (legt den `newsletter_sends`-Datensatz an, enqueued dann pro Empfänger eine Zeile über das bestehende Bulk-`enqueueNotification`, kein `enqueueAndDispatch` — blockiert den Admin-Klick nicht). `dedupe_key` enthält die `send_id`, damit derselbe Kunde bei einem *späteren, neuen* Versand erneut angeschrieben werden kann (im Unterschied zu den anderen Ereignistypen, die dieselbe Erinnerung nie zweimal verschicken).

**Verifikation:** `npm run build`/`npm run lint` sauber, `npm test` 197/197 (3 neue Tests für die Newsletter-Vorlage inkl. HTML-Escaping und Absatz-/Zeilenumbruch-Konvertierung). Live gegen die echte Produktionsdatenbank geprüft (vollständig eigenständige Testkunden/-kurs, danach restlos entfernt):
- Alle 4 Empfängergruppen liefern die exakt erwartete Kundenmenge, inkl. gezielter Prüfung des „nur die letzte Probestunde zählt"-Falls (ein Kunde mit alter konvertierter + neuer unkonvertierter Probestunde wird korrekt eingeschlossen; ein Kunde mit alter unkonvertierter + neuer konvertierter Probestunde korrekt ausgeschlossen)
- „Kurs-Teilnehmer"-Dedupe bestätigt (ein Kunde mit sowohl aktivem Abo als auch offener Buchung für denselben Kurs erscheint nur einmal)
- Zwei unabhängige Versände an dieselben zwei Empfänger erzeugen korrekt 4 separate Warteschlangen-Einträge (kein fälschliches Dedupe zwischen unterschiedlichen Versänden)
- Alle 4 verschickten Test-Zeilen zeigen `push_status: "skipped"` trotz Standard-Präferenz „an" — bestätigt die Push-Sperre
- Inhaltsauflösung funktioniert (Betreff/Text korrekt aus `newsletter_sends` geladen), E-Mail-Versand schlug erwartungsgemäß nur an der Fake-Testdomain fehl

## Implementation Notes (Frontend)

Neue Admin-Seite `/admin/newsletter` (Nav-Eintrag zwischen „Probestunden" und „Lastschriften"): `src/app/admin/newsletter/page.tsx` (Loader), `newsletter-composer.tsx` (Versand-Formular) und `newsletter-history-list.tsx` (Historie-Tabelle).

- **Live-Empfängerzahl:** `useEffect` ruft `previewRecipientCount` bei jeder Änderung von Gruppe/Kurs auf (debounced durch die `cancelled`-Flag-Absicherung gegen veraltete Antworten bei schnellem Wechsel). Zeigt „Bitte einen Kurs auswählen." wenn „Kurs-Teilnehmer" ohne Kurs gewählt ist, „0 Empfänger" bzw. die tatsächliche Zahl sonst.
- **„Senden"-Button** ist deaktiviert bei leerem Betreff/Text, bei „Kurs-Teilnehmer" ohne Kurs, während die Zahl noch lädt, und bei 0 Empfängern — deckt AC7/AC8 direkt in der UI ab, nicht erst serverseitig.
- **Bestätigungsdialog** (AlertDialog) zeigt Betreff, Empfängerzahl und Gruppenname vor dem tatsächlichen Versand.
- Nach erfolgreichem Versand: Formular wird zurückgesetzt, Toast-Bestätigung, `router.refresh()` lädt die Historie-Tabelle neu (die serverseitige `revalidatePath` aus der Server Action reicht allein nicht, da wir bereits auf der Zielseite sind, nicht neu dorthin navigieren).
- **Einstellungen-Seite** (`notification-settings-section.tsx`): die Newsletter-Zeile zeigt dank `notificationEmailOnlyGroups` (aus dem Backend-Schritt) einen Strich statt eines Push-Schalters — keine Komponenten-Logik-Änderung nötig über die bereits im Backend vorbereitete Konstante hinaus.

**Verifikation:** `npm run build`/`npm run lint` sauber. Live gegen die echte Produktionsdatenbank geprüft: Empfängerzahl-Vorschau für „Alle Kunden"/„Aktive Kunden" funktioniert (nur Vorschau, **kein** tatsächlicher Versand an diese Gruppen während der Verifikation, um keine echten Kunden per E-Mail zu erreichen); Senden-Button-Deaktivierung bei leerem Formular und bei „Kurs-Teilnehmer" ohne Kurs bestätigt; vollständiger Versand-Durchlauf mit einem eigens angelegten, isolierten Testkurs mit genau einem Testkunden als einzigem Teilnehmer (kein Risiko für echte Kunden) — Bestätigungsdialog, tatsächlicher Versand, Toast, Formular-Reset und Historie-Aktualisierung alle korrekt; Newsletter-Zeile in den Kunden-Einstellungen zeigt genau einen Schalter (E-Mail) statt zwei; 375px ohne horizontales Scrollen. Alle Testdaten (Kurs, Kunde, Buchung, Newsletter-Versand-Eintrag, Queue-Zeilen) nach der Verifikation vollständig entfernt.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
