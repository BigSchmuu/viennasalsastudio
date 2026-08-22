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

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
