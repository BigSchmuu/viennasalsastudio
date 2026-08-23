# PROJ-38: Kursausfall-Benachrichtigung

## Status: Planned
**Created:** 2026-08-22
**Last Updated:** 2026-08-22

## Dependencies
- Requires: PROJ-6 (Stundenplan & Kalender) — dort existiert bereits "Woche pausieren" (`course_schedule_pauses`), das einen einzelnen Termin ausfallen lässt.
- Requires: PROJ-16 (Automatische E-Mail-/Push-Benachrichtigungen) — liefert Versand, Warteschlange und Zustellprotokoll.
- Requires: PROJ-34 (Benachrichtigungs-Texte verwalten) — der Text dieser Benachrichtigung soll dort anpassbar sein.

## User Stories
- Als Betreiber möchte ich betroffene Kunden mit einem Klick über einen ausgefallenen Termin informieren, statt einzeln Nachrichten zu schreiben.
- Als Betreiber möchte ich Ferien im Voraus eintragen können, ohne dass sofort Benachrichtigungen rausgehen.
- Als Kunde möchte ich rechtzeitig erfahren, wenn mein Kurs ausfällt, damit ich nicht umsonst hinfahre.
- Als Probestunden- oder Drop-in-Gast möchte ich ebenfalls informiert werden — ich habe für genau diesen Termin gebucht.

## Out of Scope
- **Ersatztermin anbieten / Verschieben.** Die Benachrichtigung informiert nur über den Ausfall; einen Nachholtermin organisierst du außerhalb der App.
- **Gutschrift oder Rückerstattung** für ausgefallene Termine (Abos laufen weiter wie bisher, Drop-in-Zahlungen werden nicht automatisch erstattet).
- **Absage einzelner Kunden** ("du kannst heute nicht kommen") — es geht immer um den ganzen Termin.
- **Automatische Absage** (z.B. bei zu wenigen Anmeldungen) — immer eine bewusste Entscheidung des Betreibers.
- **Nachträgliche Korrektur einer versendeten Benachrichtigung** ("doch nicht abgesagt") — dafür schreibst du bei Bedarf über den Newsletter.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Auslösen
- [ ] Angenommen der Admin hat für einen Kurs eine Woche pausiert, wenn er die Pausen-Liste ansieht, dann gibt es zu jeder Pause einen Button "Kunden benachrichtigen".
- [ ] Angenommen der Admin klickt "Kunden benachrichtigen", dann sieht er **vor** dem Versand, wie viele Personen benachrichtigt werden, und muss bestätigen.
- [ ] Angenommen der Admin trägt eine Pause ein, wenn er **nicht** auf "Kunden benachrichtigen" klickt, dann wird niemand benachrichtigt (Ferien lassen sich im Voraus eintragen, ohne Nachrichten auszulösen).
- [ ] Angenommen für eine Pause wurde bereits benachrichtigt, wenn der Admin die Liste ansieht, dann sieht er, wann das war, und kann bei Bedarf erneut senden.
- [ ] Angenommen ein nicht-Admin versucht die Aktion direkt aufzurufen, dann wird sie abgelehnt.

### Empfängerkreis
- [ ] Angenommen ein Termin fällt aus, wenn benachrichtigt wird, dann erhalten alle Kunden mit **aktivem Abo** für diesen Kurs die Nachricht.
- [ ] Angenommen jemand hat für **genau diesen Termin** eine bestätigte Probestunde oder ein bestätigtes Drop-in gebucht, wenn benachrichtigt wird, dann erhält auch diese Person die Nachricht.
- [ ] Angenommen jemand hat für einen **anderen** Termin desselben Kurses gebucht, wenn benachrichtigt wird, dann erhält diese Person **keine** Nachricht.
- [ ] Angenommen ein Abo ist pausiert oder gekündigt, wenn benachrichtigt wird, dann erhält dieser Kunde **keine** Nachricht.
- [ ] Angenommen niemand ist betroffen, wenn der Admin auf "Kunden benachrichtigen" klickt, dann wird er darauf hingewiesen und es wird nichts versendet.

### Inhalt & Zustellung
- [ ] Angenommen ein Kunde wird benachrichtigt, wenn er die E-Mail erhält, dann enthält sie Kursname und das Datum des ausgefallenen Termins.
- [ ] Angenommen ein Kunde hat Push aktiviert, wenn benachrichtigt wird, dann erhält er zusätzlich eine Push-Nachricht.
- [ ] Angenommen ein Kunde hat andere Benachrichtigungen in seinem Profil abgeschaltet, wenn ein Kurs ausfällt, dann erhält er die Ausfall-Nachricht **trotzdem** (betrieblich notwendig, wie die SEPA-Ankündigung).
- [ ] Angenommen der Admin hat den Text unter "Benachrichtigungs-Texte" angepasst, wenn eine Ausfall-Nachricht verschickt wird, dann wird der angepasste Text verwendet.

## Edge Cases
- Was passiert, wenn der Admin zweimal hintereinander auf "Kunden benachrichtigen" klickt? → Beim zweiten Mal wird er darauf hingewiesen, dass bereits benachrichtigt wurde, und muss bewusst bestätigen — versehentliche Dopplungen werden so vermieden, bewusstes Nachfassen bleibt möglich.
- Was passiert, wenn der Termin bereits in der Vergangenheit liegt? → Der Button ist deaktiviert; eine Absage im Nachhinein hilft niemandem mehr.
- Was passiert, wenn die Pause wieder gelöscht wird, nachdem benachrichtigt wurde? → Der Termin findet wieder statt, aber es geht **keine** automatische Entwarnung raus (siehe Out of Scope) — der Admin muss das bei Bedarf selbst kommunizieren. Bewusste Einschränkung, damit hier keine widersprüchlichen Automatik-Nachrichten entstehen.
- Was passiert, wenn ein Kunde mehrere Buchungen für denselben Termin hat (z.B. Abo **und** Drop-in)? → Er erhält die Nachricht genau einmal.
- Was passiert, wenn der Kurs gar keinen Wochentermin hinterlegt hat? → Dann gibt es keine Pausen und damit auch keinen Button.

## Technical Requirements (optional)
- Security: Auslösen nur durch Admins.
- Der Versand darf den Admin nicht blockieren: Bei vielen Empfängern wird eingereiht statt synchron versendet (Muster wie beim Newsletter, PROJ-28).

## Open Questions
- [ ] Soll der Admin optional einen kurzen Grund mitschicken können ("Lehrer krank")? → Erhöht den Nutzen für Kunden, macht aber den Text variabel. In `/architecture` klären.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Separater Button statt automatischem Versand beim Eintragen der Pause | Ferien werden oft für ein ganzes Jahr im Voraus eingetragen — automatischer Versand würde sofort dutzende Nachrichten auslösen | 2026-08-22 |
| Empfänger: Abo-Kunden **und** Probestunden-/Drop-in-Gäste dieses Termins | Gerade Gäste haben sich den Termin fest vorgenommen und würden sonst umsonst anreisen | 2026-08-22 |
| Nicht abschaltbar durch den Kunden | Wie die SEPA-Ankündigung betrieblich zu wichtig: Wer die Info verpasst, steht vor verschlossener Tür — das ärgert mehr als eine Mail zu viel | 2026-08-22 |
| Keine automatische "Entwarnung" beim Löschen einer Pause | Vermeidet widersprüchliche Automatik-Nachrichten; der seltene Fall wird bewusst manuell kommuniziert | 2026-08-22 |
| Kein Ersatztermin-/Gutschrift-Mechanismus | Deutlich größeres Thema (Abrechnung, Kapazität); die Absage-Information allein löst bereits den akuten Schmerz | 2026-08-22 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Der Empfängerkreis wird beim Senden ermittelt, nicht gespeichert | Eine gespeicherte Liste veraltet, sobald jemand kündigt oder dazukommt — sie würde Nachrichten an Falsche schicken oder Richtige übergehen | 2026-08-23 |
| Eine einzige neue Angabe an der Pause („zuletzt benachrichtigt am") | Mehr braucht es nicht: Sie beantwortet „habe ich schon?" und ermöglicht wiederholtes Senden ohne Ratespiel | 2026-08-23 |
| Eintragen und Benachrichtigen bleiben getrennt | Ferien werden Monate im Voraus eingetragen; ein automatischer Versand dabei wäre eine Zumutung für die Kunden und für den Betreiber nicht steuerbar | 2026-08-23 |
| Bestätigungsdialog mit Empfängerzahl vor dem Versand | Eine Nachricht an alle Kursteilnehmer lässt sich nicht zurückholen. Die Zahl ist die letzte Gelegenheit, einen falsch gewählten Termin zu bemerken | 2026-08-23 |
| Drop-in und Probestunde nur beim eigenen Termin, Abos immer | Wer für einen anderen Tag gebucht hat, ist nicht betroffen; Abo-Kunden könnten dagegen jede Woche kommen | 2026-08-23 |
| Versand an den Kunden-Einstellungen vorbei | Wie SEPA-Ankündigung und Zahlungserinnerung betrieblich notwendig: Wer nichts erfährt, steht vor verschlossener Tür | 2026-08-23 |
| Wiederholtes Senden erlaubt, kein Dublettenschutz | Ein zu früher Klick oder ein neu dazugekommener Teilnehmer muss korrigierbar sein — dieselbe Begründung wie bei der Zahlungserinnerung aus PROJ-37 | 2026-08-23 |

---

## Tech Design (Solution Architect)

### A) Component Structure (Visual Tree)

```
Verwaltung → Kurse → Kurs bearbeiten → Pausen (bestehend)
└── Liste der eingetragenen Pausen
    ├── 15.09.2026                          [Entfernen]   (bestehend)
    └── NEU pro Zeile:
        ├── „Kunden benachrichtigen"  → Bestätigungsdialog
        │      „12 Personen werden informiert. Senden?"
        └── „zuletzt benachrichtigt am 01.09."  (sobald verschickt)

Verwaltung → Benachrichtigungen (bestehend)
└── NEU: Vorlage „Kursausfall" — Text selbst anpassbar
```

Es entsteht **keine neue Seite**. Die Pausen-Liste, die es seit PROJ-6 gibt, bekommt pro Eintrag
eine Aktion.

### B) Data Model (plain language)

```
Zur bereits vorhandenen Pause kommt eine einzige Angabe hinzu:
- Zuletzt benachrichtigt am   (leer = noch nie)

Sonst wird nichts gespeichert. Wer benachrichtigt wird, ergibt sich
im Moment des Versands aus den vorhandenen Daten:

  Kunden mit AKTIVEM Abo für diesen Kurs
  + Personen mit bestätigter Probestunde oder Drop-in GENAU an diesem Termin
```

**Der Empfängerkreis wird nicht gespeichert.** Er wird beim Senden ermittelt. Eine gespeicherte
Empfängerliste würde veralten, sobald jemand kündigt oder dazukommt — und dann Nachrichten an
Falsche schicken oder Richtige übergehen.

### C) Tech Decisions (justified for PM)

- **Eintragen und Benachrichtigen sind getrennt.** Das ist die wichtigste Entscheidung. Du trägst
  die Sommerferien im Mai ein — es wäre absurd, wenn dann sofort Nachrichten rausgingen. Die Pause
  wirkt sofort im Stundenplan, die Benachrichtigung löst du bewusst aus, wenn der Zeitpunkt passt.

- **Vor dem Senden steht die Zahl.** Du siehst „12 Personen werden informiert" und bestätigst.
  Eine Nachricht an alle Kursteilnehmer lässt sich nicht zurückholen; die Zahl ist die letzte
  Gelegenheit zu merken, dass man den falschen Termin erwischt hat.

- **Drop-in- und Probestunden-Gäste bekommen die Nachricht nur für ihren eigenen Termin.** Wer für
  den 22. gebucht hat, interessiert der Ausfall am 15. nicht. Abo-Kunden erhalten sie dagegen immer,
  weil sie grundsätzlich jede Woche kommen könnten.

- **Pausierte und gekündigte Abos bleiben außen vor.** Sie kommen ohnehin nicht.

- **Die Nachricht geht an den Kunden-Benachrichtigungseinstellungen vorbei** — wie die
  SEPA-Ankündigung und die Zahlungserinnerung. Ein ausgefallener Termin ist betrieblich notwendig:
  Wer davon nichts erfährt, steht vor verschlossener Tür.

- **Der Text ist über „Benachrichtigungs-Texte" anpassbar.** Ob „muss leider entfallen" oder „fällt
  aus" — das ist dein Ton, nicht meiner.

- **Wiederholtes Senden ist erlaubt.** Wenn du merkst, dass du zu früh geklickt hast oder jemand
  neu dazugekommen ist, sendest du erneut. Der Zeitpunkt des letzten Versands steht daneben, damit
  du nicht raten musst.

- **Kein automatischer Versand.** Auch nicht „X Tage vorher". Eine Absage ist immer eine bewusste
  Entscheidung.

### D) Dependencies (packages to install)

Keine. Das Feature nutzt die Pausen aus PROJ-6, die Benachrichtigungs-Infrastruktur aus PROJ-16 und
die Textverwaltung aus PROJ-34.

### Umfang

Neu: eine Aktion in der bestehenden Pausen-Liste, eine Textvorlage, ein neuer
Benachrichtigungs-Anlass. Erweitert: die Pause um eine Angabe. Keine neue Seite, keine neue Tabelle,
keine neue Abhängigkeit.

---

## Implementation Notes (Frontend)

**Umgesetzt am 2026-08-23.** Knopf, Bestätigungsdialog und Empfängerzahl stehen; der **Versand**
folgt im Backend-Schritt.

### Geänderte/neue Dateien
| Datei | Zweck |
|-------|-------|
| `supabase/migrations/…_proj38_pause_notified_at.sql` | Eine Angabe an der Pause: zuletzt benachrichtigt |
| `src/lib/actions/admin/course-cancellation.ts` (neu) | Ermittelt die Empfängerzahl |
| `src/components/admin/courses/course-schedule-section.tsx` | Knopf, Dialog, „benachrichtigt am" |
| `src/app/admin/kurse/page.tsx` | Reicht den Zeitpunkt durch |
| `src/lib/actions/admin/course-schedule.ts` | Neue Pause startet mit „nie benachrichtigt" |

### Entscheidungen bei der Umsetzung
- **Die Empfängerzahl wird beim Öffnen des Dialogs geholt, nicht beim Seitenaufruf.** Der Admin
  schickt gleich etwas Unwiderrufliches; eine Zahl von vor zehn Minuten könnte in beide Richtungen
  falsch sein.
- **Doppelte Empfänger werden einmal gezählt.** Wer ein Abo *und* ein Drop-in für denselben Tag hat,
  ist eine Person — die Zahl im Dialog muss der Zahl der Nachrichten entsprechen.
- **Bei null Betroffenen ist der Senden-Knopf gesperrt** und der Dialog sagt es ausdrücklich, statt
  einen Versand ins Leere zu erlauben.
- **Der Knopf heißt „Erneut benachrichtigen"**, sobald schon einmal gesendet wurde — zusammen mit
  dem Datum daneben sieht der Admin auf einen Blick, woran er ist.

### Nebenbei korrigiert
Die Pausen-Liste zeigte Datumsangaben als `2026-12-01`, während die Verwaltung sonst durchgängig
`01.12.2026` schreibt. Angeglichen — in der Liste und im Dialog.

### Verifiziert
Pause für einen Kurs mit einem aktiven Abo angelegt, Dialog geöffnet:

> „1 Person wird über den Ausfall am 01.12.2026 informiert. Das lässt sich nicht zurücknehmen."

Einzahl und Mehrzahl werden korrekt unterschieden. Testdaten anschließend entfernt.

### Noch offen (Backend-Schritt)
Der eigentliche Versand, die Textvorlage über PROJ-34, der neue Benachrichtigungs-Anlass und das
Setzen des Zeitpunkts nach erfolgreichem Versand.

---

## Implementation Notes (Backend)

**Umgesetzt am 2026-08-23.** Versand, Textvorlage und neuer Benachrichtigungs-Anlass.

### Geänderte/neue Dateien
| Datei | Zweck |
|-------|-------|
| `supabase/migrations/…_proj38_kursausfall_event_type.sql` | Neuer Anlass in der Warteschlange |
| `src/lib/actions/admin/course-cancellation.ts` | Versand an alle Betroffenen |
| `src/lib/notifications/template-registry.ts` | Vorlage „Kursausfall" — über PROJ-34 anpassbar |
| `src/lib/notifications/templates.ts` | Inhalt (Kursname, Datum) |
| `src/lib/notifications/dispatch.ts` | Zustellweg, an den Kunden-Einstellungen vorbei |
| `src/components/admin/courses/course-schedule-section.tsx` | Dialog verkabelt, Rückmeldung |

### Ein Denkfehler, der beim Testen auffiel
Der erste Entwurf zählte einen Empfänger nur dann als erreicht, wenn die **E-Mail** zugestellt
wurde. Wer ausschließlich Push nutzt, wäre damit als „nicht erreicht" gezählt worden — obwohl er die
Nachricht bekommen hat. Wären *alle* Empfänger push-only, hätte die App gemeldet, es sei niemand
erreicht worden, und der Zeitstempel wäre ausgeblieben. Der Admin hätte erneut gesendet und alle
doppelt benachrichtigt.

**Behoben:** Beide Kanäle zählen. Erreicht ist, wer per E-Mail **oder** per Push erreicht wurde.

### Weitere Entscheidungen
- **Der Zeitstempel wird gesetzt, sobald mindestens eine Nachricht rausging** — nicht erst, wenn
  alle zugestellt wurden. Sonst würde eine einzige veraltete Adresse verbergen, dass dreißig andere
  informiert sind, und zu einem doppelten Versand führen.
- **Die Rückmeldung nennt beide Zahlen**, wenn etwas schiefging: „12 benachrichtigt, 1 nicht
  zustellbar." Eine Sammelmeldung „erfolgreich" wäre in dem Fall unehrlich.
- **Der Dialog schließt erst nach dem Versand.** Sonst verschwände eine Fehlermeldung ungesehen.
- **Kein Dublettenschutz**, der Schlüssel trägt einen Zeitstempel — wiederholtes Senden ist
  ausdrücklich erlaubt (falscher Klick, jemand ist neu dazugekommen).

### Verifiziert
Pause an einem Kurs mit aktivem Abo angelegt und über die Oberfläche versendet:
- Warteschlangen-Eintrag entsteht mit dem richtigen Kurs und Datum
- Zustellung an die `.test`-Adresse scheitert erwartungsgemäß
- **`notified_at` bleibt daraufhin leer** und der Dialog meldet „Keine der Benachrichtigungen konnte
  zugestellt werden." — kein falscher „erledigt"-Eindruck
- Testdaten anschließend entfernt

### Nicht abgedeckt
Ein **erfolgreicher** Versand. Alle Fixture-Kunden haben `.test`-Adressen und keine Push-Geräte;
der Erfolgspfad ist damit nur bis zur Übergabe an den Versand geprüft. Der Fehlerpfad — der
wichtigere, weil er einen falschen „benachrichtigt"-Vermerk verhindert — ist real durchgespielt.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
