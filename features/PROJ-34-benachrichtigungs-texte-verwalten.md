# PROJ-34: Benachrichtigungs-Texte verwalten

## Status: Planned
**Created:** 2026-08-22
**Last Updated:** 2026-08-22

## Dependencies
- Requires: PROJ-16 (Automatische E-Mail-/Push-Benachrichtigungen) — definiert die bestehenden Vorlagen, Event-Typen und den Versand-Mechanismus, den dieses Feature editierbar macht
- Requires: PROJ-29 (Probestunden-Follow-up & Conversion-Tracking) — liefert die beiden `probestunde_nachfassung`-Varianten (abend, naechster_termin)
- Requires: PROJ-14 (Events & Workshops) — liefert die drei `event_tickets`-Varianten
- Berührt, aber nicht Teil davon: PROJ-28 (Newsletter-Versand) — hat bereits einen eigenen Text-Composer, bleibt davon unberührt

## User Stories
- Als Admin möchte ich den Text automatischer Kunden-Benachrichtigungen (E-Mail und Push) selbst anpassen können, ohne dafür einen Code-Deploy zu benötigen.
- Als Admin möchte ich vor dem Speichern sehen, wie eine Benachrichtigung mit echten Beispieldaten tatsächlich aussieht.
- Als Admin möchte ich mir eine Testversion an meine eigene Adresse schicken lassen, um das Ergebnis in einem echten Postfach zu sehen.
- Als Admin möchte ich einen versehentlich verschlechterten Text jederzeit auf den ursprünglichen Standardtext zurücksetzen können.
- Als Admin möchte ich beim Speichern gewarnt werden, wenn ich einen Platzhalter falsch schreibe, damit keine kaputte Mail unbemerkt rausgeht.

## Out of Scope
- **Newsletter-Texte** — haben bereits einen eigenen Composer (PROJ-28), nicht Teil dieses Features.
- **Neue Benachrichtigungs-Typen anlegen** — dieses Feature bearbeitet nur die 12 bestehenden System-Vorlagen (siehe Acceptance Criteria), keine neuen Event-Typen oder Auslöser.
- **Mehrsprachigkeit** — die App ist durchgängig auf Deutsch ausgelegt, keine Übersetzungsfunktion.
- **Rich-Text-/Markdown-Formatierung im Editor** (fett, Links, Listen frei setzbar) — Layout-Elemente (Hervorhebungen, Link-Buttons, E-Mail-Rahmen mit Header/Footer) bleiben systemseitig fix; der Admin bearbeitet reinen Text mit `{platzhalter}`-Syntax.
- **Änderungshistorie / Audit-Log** (wer hat wann was geändert) — bewusst nicht Teil des MVP, siehe Decision Log.
- **Freigabe-Workflow** (z.B. Vier-Augen-Prinzip vor Veröffentlichung) — jede gespeicherte Änderung gilt sofort, kein Entwurfs-/Review-Status.
- **Sperren gegen gleichzeitiges Bearbeiten** — bei mehreren Admins gilt "letzter Speichervorgang gewinnt", siehe Decision Log.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Übersicht & Zugriff
- [ ] Angenommen ein Admin ist eingeloggt, wenn er im Admin-Menü auf "Benachrichtigungs-Texte" (in der Gruppe "Finanzen & Kommunikation") klickt, dann sieht er eine Liste aller 12 Vorlagen-Varianten mit Klarname (z.B. "Buchung bestätigt", "Probestunden-Follow-up am selben Abend"), gruppiert nach den zugehörigen 6 Event-Typen (Buchungsstatus, Warteliste, Kursstart-Erinnerung, Probestunden-Follow-up, Abo-Kündigung/-Pausierung, SEPA-Ankündigung, Event-Tickets).
- [ ] Angenommen eine Vorlage wurde noch nie angepasst, wenn sie in der Liste angezeigt wird, dann ist sie als "Standard" gekennzeichnet.
- [ ] Angenommen eine Vorlage wurde bereits angepasst, wenn sie in der Liste angezeigt wird, dann ist sie als "Angepasst" gekennzeichnet.
- [ ] Angenommen ein nicht-Admin (Kunde oder Lehrer) versucht, die Verwaltungsseite direkt per URL aufzurufen, dann wird der Zugriff verweigert (wie bei allen anderen `/admin`-Bereichen).

### Bearbeiten
- [ ] Angenommen ein Admin öffnet eine Vorlage zum Bearbeiten, dann sieht er vier separate Textfelder: E-Mail-Betreff, E-Mail-Text, Push-Titel, Push-Text — vorausgefüllt mit dem aktuell aktiven Text (Standard oder vorherige Anpassung).
- [ ] Angenommen ein Admin bearbeitet ein Textfeld, wenn er die für diese Vorlage gültigen Platzhalter sehen möchte, dann zeigt der Editor eine Liste der verfügbaren `{platzhalter}` für genau diese Vorlage (z.B. `{kurs}`, `{datum}` bei "Kursstart-Erinnerung").
- [ ] Angenommen ein Admin speichert ein Textfeld leer (kein Text), dann wird das Speichern verhindert und ein Hinweis "Text darf nicht leer sein" angezeigt.
- [ ] Angenommen ein Admin speichert einen Text, der einen für diese Vorlage unbekannten oder falsch geschriebenen Platzhalter enthält (z.B. `{kurss}`), dann wird das Speichern verhindert und eine Fehlermeldung mit der Liste der gültigen Platzhalter angezeigt.
- [ ] Angenommen ein Admin speichert einen Text mit ausschließlich gültigen Platzhaltern, dann wird die Änderung sofort aktiv — die nächste ausgelöste Benachrichtigung dieser Vorlage verwendet den neuen Text.

### Vorschau & Test
- [ ] Angenommen ein Admin bearbeitet eine Vorlage, dann aktualisiert sich eine Live-Vorschau der gerenderten E-Mail (inkl. Layout, Fett-Hervorhebung, Link-Button) automatisch, sobald er tippt, mit Beispieldaten anstelle der Platzhalter (z.B. `{kurs}` → "Salsa Beginner 1").
- [ ] Angenommen ein Admin hat eine Vorlage im Editor offen (auch ungespeichert), wenn er auf "Test-Mail senden" klickt, dann erhält er innerhalb weniger Minuten eine echte E-Mail mit dem aktuell im Editor stehenden Text (inkl. Beispieldaten) an seine eigene Admin-Adresse.

### Zurücksetzen
- [ ] Angenommen eine Vorlage wurde angepasst, wenn der Admin auf "Auf Standard zurücksetzen" klickt und bestätigt, dann wird der ursprüngliche, im Code hinterlegte Text wiederhergestellt und die Vorlage ist wieder als "Standard" gekennzeichnet.
- [ ] Angenommen eine Vorlage ist bereits im Standard-Zustand, dann ist der "Auf Standard zurücksetzen"-Button deaktiviert oder ausgeblendet.

## Edge Cases
- Was passiert, wenn zwei Admins gleichzeitig dieselbe Vorlage bearbeiten? → Letzter Speichervorgang gewinnt, keine Sperre (siehe Decision Log).
- Was passiert, wenn ein Push-Titel oder Push-Text sehr lang ist (Gefahr des Abschneidens auf dem Gerät)? → Ein weicher Warnhinweis erscheint ab einer Richtlänge (z.B. 50 Zeichen Titel / 120 Zeichen Text), blockiert das Speichern aber nicht.
- Was passiert bei einem Fehler beim Test-Versand (z.B. Mail-Dienst nicht erreichbar)? → Fehlermeldung im Editor, der bearbeitete (ungespeicherte) Text bleibt erhalten.
- Was passiert, wenn ein Admin die Seite mit ungespeicherten Änderungen verlässt? → Kein spezieller Warn-Dialog für MVP; Änderungen gehen verloren, wie bei den übrigen Admin-Formularen dieser App auch.
- Was passiert mit bereits in der Warteschlange stehenden, aber noch nicht versendeten Benachrichtigungen, wenn eine Vorlage währenddessen geändert wird? → Der Text wird erst beim tatsächlichen Versand zusammengebaut (nicht beim Einreihen in die Warteschlange), eine Änderung wirkt sich also auch auf bereits wartende Benachrichtigungen aus, die noch nicht verschickt wurden.

## Technical Requirements (optional)
- Security: Nur Admins dürfen lesen/schreiben (wie alle `/admin`-Routen).
- Die 12 Standardtexte aus `src/lib/notifications/templates.ts` bleiben als eingebauter Fallback im Code erhalten — eine Anpassung überschreibt sie, löscht sie aber nicht.

## Open Questions
- [x] Exakte Liste der gültigen Platzhalter-Namen pro Vorlage → siehe Tech Design, Abschnitt "Die 12 Vorlagen und ihre Platzhalter" (2026-08-22)
- [x] Technischer Weg für den Testversand → läuft direkt über die bestehende E-Mail-/Push-Infrastruktur, ohne die Warteschlange, siehe Tech Design (2026-08-22)

## Decision Log
<!-- Record of conscious decisions made and why. Added to by /write-spec and /architecture. -->

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Alle 12 System-Vorlagen editierbar (nicht nur eine Teilmenge) | Einheitliche Lösung ohne Sonderfälle, die später nachgezogen werden müssten | 2026-08-22 |
| Alle 4 Felder (Betreff, E-Mail-Text, Push-Titel, Push-Text) einzeln editierbar statt Push automatisch abgeleitet | Volle Kontrolle für den Admin über beide Kanäle | 2026-08-22 |
| Reiner Text mit `{platzhalter}`-Syntax statt Rich-Text/Markdown | Einfach zu verstehen, zu validieren und in Push-Text wiederzuverwenden (Push kennt ohnehin keine Formatierung); Layout-Elemente (Fett, Link-Button, E-Mail-Rahmen) bleiben systemseitig fix | 2026-08-22 |
| Speichern wird bei unbekannten/falsch geschriebenen Platzhaltern blockiert | Verhindert zuverlässig kaputte, unbemerkt verschickte Mails | 2026-08-22 |
| Live-Vorschau mit Beispieldaten | Admin sieht sofort das gerenderte Endergebnis inkl. automatischer Formatierung | 2026-08-22 |
| Testversand an die eigene Admin-Adresse | In-App-Vorschau kann die Darstellung in echten Mail-/Push-Clients nie 100%ig abbilden | 2026-08-22 |
| "Auf Standard zurücksetzen" pro Vorlage | Günstige Absicherung gegen versehentliche Verschlimmbesserungen; die Original-Texte in `templates.ts` bleiben als Fallback erhalten | 2026-08-22 |
| Platzierung im Admin-Menü unter "Finanzen & Kommunikation", neben Newsletter | Inhaltlich am nächsten verwandte bestehende Gruppe (beides Kunden-Kommunikation), keine neue Nav-Gruppe nötig | 2026-08-22 |
| Kein Sperr-/Locking-Mechanismus bei gleichzeitiger Bearbeitung | Kleines Studio mit wenigen Admin-Nutzern — das Risiko einer Kollision ist gering, letzter Speichervorgang gewinnt | 2026-08-22 |
| Keine Änderungshistorie/Audit-Log im MVP | Nutzer hat das nicht angefragt; kann bei Bedarf später als eigenständige Erweiterung nachgezogen werden | 2026-08-22 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Neue Supabase-Tabelle "Vorlagen-Überschreibungen", statt die 12 Standardtexte direkt zu ersetzen | Standardtexte bleiben im Code als eingebauter Fallback erhalten (nötig fürs "Zurücksetzen"); eine leere/fehlende Zeile bedeutet automatisch "Standard aktiv" | 2026-08-22 |
| Platzhalter-Werte werden beim Rendern automatisch fett hervorgehoben, statt Fett-Syntax im Text zu erlauben | Entspricht 1:1 dem bisherigen Aussehen aller Vorlagen, ohne dass der Admin Formatierung selbst setzen muss oder kann | 2026-08-22 |
| Fixe Layout-Elemente (E-Mail-Rahmen, Footer-Link, "Jetzt buchen"-Button bei Probestunden-Follow-up) bleiben außerhalb des bearbeitbaren Textes | Verhindert, dass ein Admin versehentlich den Handlungsaufruf/Link aus einer Vorlage entfernt, der für die Conversion (PROJ-29) wichtig ist | 2026-08-22 |
| Testversand läuft direkt über die bestehende E-Mail-/Push-Versandfunktion, nicht über die Warteschlange | Der Testversand transportiert den gerade eingetippten (ggf. ungespeicherten) Text mit Beispieldaten an den Admin selbst — das ist kein echtes Geschäftsereignis und braucht daher keine Warteschlangen-Zeile, keinen Dedupe-Key, kein Tracking | 2026-08-22 |
| Speichern validiert serverseitig gegen eine feste Zuordnung "Vorlagen-Schlüssel → erlaubte Platzhalter" | Serverseitige Prüfung kann nicht durch direkte API-Aufrufe umgangen werden (anders als eine reine Frontend-Prüfung) | 2026-08-22 |
| Wiederverwendung der bestehenden Absatz-Darstellung (Leerzeile = neuer Absatz) aus dem Newsletter-Feature (PROJ-28) für den E-Mail-Text | Bereits vorhandene, geprüfte Logik statt einer neuen Formatierungsregel | 2026-08-22 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Component Structure (Visual Tree)

```
/admin/benachrichtigungen (neue Admin-Seite)
├── Vorlagen-Übersicht
│   └── Für jeden der 6 Event-Typen eine Gruppe mit seinen Varianten:
│       └── Vorlagen-Zeile (Klarname, Status-Badge "Standard" / "Angepasst", "Bearbeiten"-Button)
└── Vorlagen-Editor (öffnet beim Klick auf "Bearbeiten")
    ├── Hinweis-Box: gültige Platzhalter für genau diese Vorlage (z.B. {kurs}, {datum})
    ├── Eingabefeld: E-Mail-Betreff
    ├── Eingabefeld: E-Mail-Text
    ├── Eingabefeld: Push-Titel
    ├── Eingabefeld: Push-Text
    ├── Live-Vorschau (rendert die aktuellen Eingaben mit Beispieldaten, inkl. Fett-Hervorhebung/Layout)
    ├── Aktion: "Test-Mail an mich senden"
    ├── Aktion: "Auf Standard zurücksetzen" (nur sichtbar, wenn die Vorlage angepasst ist)
    └── Aktion: "Speichern"
```

### B) Data Model (plain language)

**Neue Tabelle "Vorlagen-Überschreibungen":**
```
Jede Zeile gehört zu genau einer der 12 festen Vorlagen-Varianten:
- Vorlagen-Schlüssel (eindeutig, einer von 12 festen Werten, siehe unten)
- E-Mail-Betreff
- E-Mail-Text
- Push-Titel
- Push-Text
- Zuletzt geändert am

Existiert für einen Schlüssel keine Zeile → der im Code hinterlegte
Standardtext wird verwendet ("Standard").
Existiert eine Zeile → sie überschreibt den Standardtext ("Angepasst").
"Auf Standard zurücksetzen" löscht einfach die Zeile.
```

**Die 12 Vorlagen und ihre Platzhalter:**

| Event-Typ | Variante | Platzhalter |
|---|---|---|
| Buchungsstatus | Bestätigt | `{kurs}` |
| Buchungsstatus | Abgelehnt | `{kurs}` |
| Warteliste | Nachgerückt | `{kurs}`, `{datum}` |
| Abo-Kündigung | Pausiert | `{abo}`, `{datum}` |
| Abo-Kündigung | Gekündigt | `{abo}`, `{datum}` |
| Kursstart-Erinnerung | (eine Variante) | `{kurs}`, `{datum}`, `{typ}` (Probestunde/Drop-in) |
| SEPA-Ankündigung | (eine Variante) | `{betrag}`, `{datum}` |
| Event-Ticket | Bestätigt | `{event}`, `{zeitpunkt}` |
| Event-Ticket | Reserviert | `{event}`, `{zeitpunkt}` |
| Event-Ticket | Event abgesagt | `{event}`, `{zeitpunkt}` |
| Probestunden-Follow-up | Am selben Abend | `{kurs}` |
| Probestunden-Follow-up | Vor dem nächsten Termin | `{kurs}` |

Diese Zuordnung ist die Grundlage für die serverseitige Validierung beim Speichern: wird ein Platzhalter benutzt, der für die gewählte Vorlage nicht in dieser Liste steht, wird das Speichern verhindert.

### C) Tech Decisions (justified for PM)

- **Neue Datenbank-Tabelle statt Code-Änderung:** Die 12 Standardtexte bleiben unverändert im Code (Fallback). Eine Anpassung wird als zusätzliche, überschreibende Zeile in einer neuen Tabelle gespeichert — dadurch ist "Zurücksetzen" ein einfaches Löschen dieser Zeile, ohne dass der ursprüngliche Text irgendwo dupliziert werden muss.
- **Serverseitige Validierung der Platzhalter:** Die Prüfung "ist dieser Platzhalter für diese Vorlage erlaubt?" passiert beim Speichern auf dem Server (nicht nur im Browser), damit sie nicht umgangen werden kann.
- **Automatische Fett-Hervorhebung:** Sobald ein Platzhalter-Wert (z.B. der Kursname) in den Text eingesetzt wird, wird er automatisch fett dargestellt — genau wie in den bisherigen Vorlagen. Der Admin muss dafür nichts Besonderes tun oder eintippen.
- **Fixes Layout bleibt außerhalb des Textfelds:** Der E-Mail-Rahmen (Logo-Header, Rand), der Footer-Link "Zu meinem Profil" und der "Jetzt buchen"-Button bei den beiden Probestunden-Follow-up-Vorlagen werden weiterhin automatisch vom System ergänzt — der Admin bearbeitet nur den eigentlichen Nachrichtentext.
- **Testversand ohne Warteschlange:** Ein Testversand verwendet dieselbe Versandfunktion wie echte Benachrichtigungen, läuft aber sofort und direkt an den Admin selbst, ohne über die normale Warteschlange/Protokollierung zu laufen — passend, weil es sich um keine echte Kunden-Benachrichtigung handelt.
- **Zugriff:** Nur Admins können lesen/schreiben, wie bei jedem anderen `/admin`-Bereich dieser App.

### D) Dependencies (packages to install)

Keine neuen Pakete nötig — das Feature nutzt ausschließlich bereits vorhandene Infrastruktur (Datenbank, E-Mail-Versand, Push-Versand) aus PROJ-16.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
