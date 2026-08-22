# PROJ-15: Gutscheine & Rabattcodes

## Status: Planned
**Created:** 2026-08-22
**Last Updated:** 2026-08-22

## Dependencies
- Requires: PROJ-8 (Kursbuchung) — der Gutschein-Code wird im bestehenden Buchungsdialog bei einer regulären Buchungsanfrage eingegeben und beim Bestätigen durch den Admin (`confirmRegularBooking`) eingelöst.
- Requires: PROJ-4 (Admin: Kunden-/Mitgliederverwaltung) — "erstes Abo" wird über die bestehende `subscriptions`-Historie des Kunden geprüft.

## User Stories
- Als Kunde möchte ich bei meiner ersten Buchungsanfrage einen Rabattcode eingeben können, um einen Neukunden-Rabatt zu erhalten.
- Als Admin möchte ich Gutscheincodes mit Prozent- oder Festbetrag-Rabatt, optionalem Ablaufdatum und einer maximalen Einlöse-Anzahl anlegen können.
- Als Admin möchte ich beim Bestätigen einer Buchungsanfrage sehen, welcher Rabatt hinterlegt ist, damit ich den Abo-Preis entsprechend reduziert eintragen kann.
- Als Admin möchte ich einen laufenden Gutschein-Code jederzeit deaktivieren können, ohne die bisherige Einlöse-Historie zu verlieren.
- Als Admin möchte ich auf einen Blick sehen, wie oft ein Code bereits eingelöst wurde.

## Out of Scope
- **Rabatt auf Drop-in-Buchungen oder spätere Abo-Zyklen** — Gutscheine gelten ausschließlich für das erste, bei der Neuanmeldung angelegte Abo. Ein Rabatt auf laufende/künftige Abrechnungszyklen oder auf Drop-in-Einzeltermine ist nicht Teil dieses Features.
- **Automatische Preisberechnung/-verrechnung** — es gibt aktuell keinen hinterlegten "Listenpreis" pro Kurs, von dem sich ein Rabatt automatisch abziehen ließe (der Admin trägt den Abo-Preis wie bisher frei ein). Der Gutschein liefert nur die Rabatt-Information als Hinweis; automatische Preisberechnung wäre ein separates Vorprojekt (bräuchte zuerst feste Kurspreise).
- **Gutscheine für Bestandskunden / wiederkehrende Rabatte** — ein Kunde, der schon einmal irgendein Abo hatte (auch gekündigt/pausiert), kann keinen "erstes Abo"-Gutschein mehr einlösen, siehe Decision Log.
- **Automatische Code-Generierung/Massen-Import** — Codes werden einzeln vom Admin von Hand vergeben (freier Text), kein Bulk-Generator für z.B. 1000 Einzelcodes.
- **Kombinierbarkeit mehrerer Codes** — pro Buchungsanfrage ist maximal ein Gutschein-Code hinterlegbar.
- **Öffentliche Gutschein-Übersicht für Kunden** ("alle aktuellen Aktionen") — Codes werden außerhalb der App kommuniziert (Social Media, E-Mail, vor Ort), nicht in der App selbst beworben.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Admin: Gutscheine verwalten
- [ ] Angenommen ein Admin ist auf der neuen Seite "Gutscheine", wenn er einen neuen Code anlegt (Code-Text, Rabatt-Typ Prozent oder Festbetrag, Rabatt-Höhe, maximale Einlösungen, optionales Ablaufdatum), dann erscheint der Code in der Liste als "Aktiv" mit "0 von X eingelöst".
- [ ] Angenommen ein Code existiert bereits, wenn der Admin einen zweiten Code mit demselben Text anlegen möchte, dann wird das verhindert mit einem Hinweis, dass der Code bereits vergeben ist.
- [ ] Angenommen ein aktiver Code existiert, wenn der Admin ihn deaktiviert, dann kann er nicht mehr eingelöst werden, bleibt aber inkl. bisheriger Einlöse-Historie in der Liste sichtbar.
- [ ] Angenommen ein Code wurde bereits X-mal eingelöst, wenn der Admin die Gutschein-Liste öffnet, dann sieht er "X von [Limit] eingelöst" pro Code.

### Kunde: Code bei Buchungsanfrage eingeben
- [ ] Angenommen ein Kunde stellt eine reguläre Buchungsanfrage, wenn er im Buchungsdialog ein optionales Feld "Gutscheincode" sieht, dann kann er dort einen Code eintragen oder das Feld leer lassen.
- [ ] Angenommen der Kunde trägt einen ungültigen, abgelaufenen oder bereits ausgeschöpften Code ein, dann erscheint eine Fehlermeldung direkt am Feld, das Absenden der Buchungsanfrage bleibt aber möglich (mit oder ohne Code).
- [ ] Angenommen der Kunde trägt einen gültigen Code ein, wenn er die Anfrage absendet, dann wird der Code an die Buchungsanfrage angehängt (noch nicht als eingelöst gezählt).
- [ ] Angenommen ein Kunde hatte bereits irgendwann ein Abo (aktiv, pausiert oder gekündigt), wenn er einen "erstes Abo"-Gutschein einträgt, dann wird dieser als ungültig für seinen Account abgelehnt, auch wenn der Code selbst noch Einlösungen übrig hat.

### Admin: Buchung mit Gutschein bestätigen
- [ ] Angenommen eine Buchungsanfrage hat einen gültigen Gutschein-Code angehängt, wenn der Admin sie auf `/admin/buchungen` öffnet, dann sieht er den Rabatt als Hinweis (z.B. "Gutschein WELCOME20: -20%") neben dem Preisfeld.
- [ ] Angenommen der Admin bestätigt eine Buchungsanfrage mit gültigem Gutschein-Code, dann wird die Einlösung genau in diesem Moment gezählt (nicht schon bei der Anfrage) und das Abo wird mit dem vom Admin eingetragenen Preis angelegt.
- [ ] Angenommen der Admin lehnt eine Buchungsanfrage mit angehängtem Gutschein-Code ab, dann bleibt die Einlösung des Codes unverändert (nicht verbraucht) — der Kunde kann den Code bei einer neuen Anfrage erneut versuchen.
- [ ] Angenommen ein Code wurde zwischen Anfrage und Bestätigung ausgeschöpft, abgelaufen oder deaktiviert (z.B. durch eine andere, zwischenzeitlich bestätigte Buchung), wenn der Admin die Buchung bestätigt, dann wird das Abo trotzdem angelegt, aber ohne Gutschein-Hinweis — der Admin trägt den Preis dann ohne Rabatt-Referenz ein.

## Edge Cases
- Was passiert, wenn zwei Admins gleichzeitig die letzte verbleibende Einlösung desselben Codes für unterschiedliche Buchungen bestätigen (Wettlaufsituation)? → Serverseitig atomar geprüft (nach dem Muster der bestehenden Kapazitätsprüfung in `create_regular_course_booking`): nur die zuerst verarbeitete Bestätigung zählt die Einlösung, die zweite läuft ohne Gutschein-Hinweis durch (siehe letztes AC oben).
- Was passiert, wenn der Admin einen Code löscht, der bereits eingelöst wurde? → Löschen ist nicht vorgesehen (nur Deaktivieren, siehe Decision Log) — bereits eingelöste Codes bleiben zur Nachverfolgbarkeit dauerhaft in der Liste.
- Was passiert bei Groß-/Kleinschreibung im Code (Kunde tippt "welcome20" statt "WELCOME20")? → Codes werden case-insensitive verglichen (intern einheitlich groß gespeichert).
- Was passiert, wenn der Kunde den Code nachträglich ändern möchte, nachdem die Anfrage schon abgeschickt wurde? → Nicht möglich — wie bei den übrigen Feldern der Buchungsanfrage muss der Kunde stornieren (falls möglich) und neu anfragen.
- Was passiert mit einem Gutschein-Hinweis, wenn der Admin die Buchungsanfrage vor der Entscheidung neu lädt? → Der Hinweis wird bei jedem Laden der Seite neu anhand des aktuellen Code-Status berechnet (nicht zwischengespeichert), damit ein inzwischen abgelaufener/deaktivierter Code sofort korrekt nicht mehr angezeigt wird.

## Technical Requirements (optional)
- Security: Gutschein-Verwaltung (`/admin/gutscheine`) nur für Admins, wie alle anderen `/admin`-Bereiche.
- Die Einlösungs-Prüfung (Limit erreicht? abgelaufen? aktiv?) muss serverseitig beim Bestätigen erfolgen, nicht nur im UI — ein Kunde/Admin darf einen Code nicht durch reines Umgehen der UI ein zweites Mal einlösen.

## Open Questions
- [x] Exaktes Datenmodell → siehe Tech Design, Abschnitt B) Data Model (2026-08-22)
- [x] Ob die Rabatt-Anzeige auch auf `/admin/kunden/[id]` erscheinen muss → Nein, bewusst nur im Bestätigungs-Dialog auf `/admin/buchungen`. Das manuelle "Neues Abo"-Formular auf `/admin/kunden/[id]` (PROJ-4) ist ein eigenständiger Admin-Vorgang ohne Kunden-Buchungsanfrage und damit ohne Code-Eingabefeld — ein Gutschein kann dort also nie angehängt sein (2026-08-22)

## Decision Log
<!-- Record of conscious decisions made and why. Added to by /write-spec and /architecture. -->

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Gutscheine gelten nur für das erste Abo bei Neuanmeldung, nicht für Drop-ins oder spätere Zyklen | Klassischer, häufigster Anwendungsfall für eine Tanzschule; vermeidet Eingriff in die laufende Abrechnung | 2026-08-22 |
| Kunde gibt Code bei der Buchungsanfrage ein; Admin sieht Rabatt-Hinweis und trägt den Preis weiterhin frei ein (keine automatische Verrechnung) | Es gibt keinen hinterlegten Kurs-Listenpreis, von dem sich automatisch abziehen ließe — automatische Verrechnung wäre ein separates Vorprojekt (erst feste Kurspreise nötig) | 2026-08-22 |
| Rabatt-Typ ist admin-wählbar: Prozent ODER Festbetrag pro Code | Deckt sowohl prozentuale Aktionen als auch feste Willkommensrabatte/Partner-Gutscheine ab | 2026-08-22 |
| Admin gibt eine maximale Anzahl Einlösungen pro Code an (frei wählbar, z.B. 1 für einen persönlichen Code oder 50 für eine breite Aktion) | Deckt sowohl personalisierte Einzelcodes als auch geteilte Marketing-Codes mit einem gemeinsamen Mechanismus ab, ohne Bulk-Code-Generierung bauen zu müssen | 2026-08-22 |
| Optionales Ablaufdatum pro Code | Übliche Anforderung für zeitlich befristete Aktionen; ohne Datum gilt der Code unbegrenzt (bis Limit erreicht oder deaktiviert) | 2026-08-22 |
| Ungültiger/abgelaufener/aufgebrauchter Code blockiert die Buchung nicht — nur eine Fehlermeldung am Feld | Der Gutschein ist ein Bonus, kein Pflichtfeld; ein Tippfehler soll nicht die eigentliche Anmeldung verhindern | 2026-08-22 |
| Admin kann Codes deaktivieren (nicht nur löschen) und sieht die Einlöse-Historie/-Zahl | Standard-Erwartung an eine Gutschein-Verwaltung; Löschen würde die Nachverfolgbarkeit bereits eingelöster Codes zerstören | 2026-08-22 |
| Einlösung zählt erst bei Bestätigung durch den Admin, nicht schon bei der Buchungsanfrage | Eine abgelehnte Anfrage (z.B. Kurs war voll) soll den Gutschein-Code des Kunden nicht "verbrennen" | 2026-08-22 |
| "Erstes Abo" = Kunde hatte noch NIE irgendein Abo (aktiv, pausiert oder gekündigt) — nicht nur "aktuell kein aktives Abo" | Verhindert, dass Bestandskunden den Neukunden-Rabatt durch Kündigen + Neuanmelden wiederholt nutzen | 2026-08-22 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Neue eigenständige Tabelle "Gutscheine" statt Erweiterung einer bestehenden Tabelle | Gutscheine sind eine unabhängige Entität mit eigenem Lebenszyklus (aktiv/inaktiv, Ablauf, Einlöse-Zähler), unabhängig von einer einzelnen Buchung | 2026-08-22 |
| Der Gutschein-Code wird als neues, optionales Feld direkt an die Buchungsanfrage angehängt (nicht in einer separaten "Einlösungen"-Tabelle vor der Bestätigung) | Der Code ist bis zur Bestätigung nur eine unverbindliche Absicht, kein Verbrauch — ein einfaches Feld auf der Anfrage genügt, bis der Admin sie bestätigt | 2026-08-22 |
| Prüfung + Einlösungs-Zählung passiert serverseitig, atomar, im selben Bestätigungs-Schritt wie die bestehende Abo-Anlage (`confirmRegularBooking`) | Verhindert, dass zwei fast gleichzeitig bestätigte Buchungen denselben letzten Restplatz eines Codes doppelt verbrauchen — nutzt dasselbe Locking-Muster, das die App schon für Kurs-Kapazität in `create_regular_course_booking` einsetzt | 2026-08-22 |
| "Erstes Abo"-Prüfung anhand der kompletten `subscriptions`-Historie des Kunden (jede Zeile, unabhängig vom Status) | Direkt aus bestehenden Daten ableitbar, keine neue Tabelle für den Kunden-Status nötig | 2026-08-22 |
| Preisfeld-Vorschlag im Bestätigungs-Dialog nutzt den bereits bestehenden Kurs-Preis (`courses.price`), der schon heute zur Vorbefüllung des Preisfelds dient | Bei "Nur diesen Kurs"-Anfragen kann der vorgeschlagene Preis direkt rabattiert vorbefüllt werden (Admin kann weiterhin frei überschreiben) — echte Zwangs-Verrechnung bleibt bewusst Produkt-Entscheidung (siehe Decision Log), aber die bestehende Vorbefüllungs-Logik lässt sich ohne neuen Mechanismus um den Rabatt erweitern. Bei Flatrate-Anfragen gibt es wie heute schon keinen Basispreis, daher nur der reine Text-Hinweis | 2026-08-22 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Component Structure (Visual Tree)

```
Admin
├── Neuer Nav-Punkt "Gutscheine" (Gruppe "Finanzen & Kommunikation", neben Newsletter/Benachrichtigungen)
│   └── /admin/gutscheine
│       ├── "Neuer Gutschein"-Formular (Code, Rabatt-Typ Prozent/Festbetrag, Rabatt-Höhe, max. Einlösungen, optionales Ablaufdatum)
│       └── Gutschein-Liste (Code, Rabatt, Status Aktiv/Inaktiv mit Umschalter, "X von Y eingelöst")
│
└── Buchungsanfragen (/admin/buchungen, bestehend)
    └── Bestätigungs-Dialog (bestehend, wird erweitert)
        ├── NEU: Gutschein-Hinweis-Zeile, falls ein gültiger Code angehängt ist (z.B. "Gutschein WELCOME20: -20%")
        └── Preisfeld (bestehend) — bei "Nur diesen Kurs"-Anfragen jetzt inkl. Rabatt vorbefüllt, weiterhin frei änderbar

Kunde
└── Buchungsdialog (/kurse, bestehend), Tab "Anmeldung"
    └── NEU: optionales Feld "Gutscheincode" mit Inline-Fehlermeldung bei ungültigem/abgelaufenem/aufgebrauchtem Code
```

### B) Data Model (plain language)

**Neue Tabelle "Gutscheine":**
```
- Code (Text, eindeutig, wird case-insensitive verglichen)
- Rabatt-Typ: Prozent oder Festbetrag
- Rabatt-Höhe (Zahl)
- Maximale Einlösungen (Zahl)
- Bisherige Einlösungen (Zähler, startet bei 0)
- Ablaufdatum (optional)
- Aktiv/Inaktiv (Umschalter, unabhängig von Limit/Ablauf manuell steuerbar)
```

**Bestehende Buchungsanfrage** bekommt ein neues, optionales Feld:
```
- Angehängter Gutschein-Code (nur die Referenz — bis zur Bestätigung rein informativ, noch kein Verbrauch)
```

**Ablauf beim Bestätigen einer Buchungsanfrage durch den Admin** (im bestehenden `confirmRegularBooking`-Schritt):
```
1. Ist ein Gutschein-Code angehängt?
2. Wenn ja: ist er noch aktiv, nicht abgelaufen, Einlöse-Limit noch nicht erreicht,
   UND hatte der Kunde noch nie zuvor irgendein Abo?
3. Wenn alle Bedingungen erfüllt: Einlösungs-Zähler wird um 1 erhöht (atomar,
   damit zwei gleichzeitige Bestätigungen sich nicht gegenseitig überholen
   können), das Abo wird wie gewohnt mit dem vom Admin eingetragenen Preis angelegt.
4. Wenn eine Bedingung nicht (mehr) erfüllt ist: Das Abo wird trotzdem ganz
   normal angelegt, nur ohne Rabatt-Vermerk und ohne dass ein Zähler erhöht wird.
```

### C) Tech Decisions (justified for PM)

- **Eigene Tabelle für Gutscheine:** Codes haben einen eigenen Lebenszyklus (aktiv/inaktiv, Ablauf, Zähler) unabhängig von einzelnen Buchungen — eine eigene Tabelle bildet das sauber ab, statt bestehende Tabellen zu überladen.
- **Serverseitige, atomare Prüfung erst beim Bestätigen:** Die eigentliche Rabatt-Vergabe passiert serverseitig im selben Moment, in dem auch das Abo angelegt wird — dasselbe bewährte Muster, das die App schon nutzt, um zu verhindern, dass zwei Kunden gleichzeitig den letzten freien Kursplatz bekommen.
- **"Erstes Abo" direkt aus der bestehenden Abo-Historie ableitbar:** Keine zusätzliche Tabelle nötig, um zu wissen, ob ein Kunde Neukunde ist — die Antwort steckt schon in den vorhandenen Daten.
- **Rabattierter Preisvorschlag nutzt den bereits hinterlegten Kurs-Preis:** Kurse haben schon heute einen Preis, der das Preisfeld beim Bestätigen vorausfüllt. Diese bestehende Vorbefüllung wird einfach um den Rabatt ergänzt — der Admin sieht direkt einen sinnvollen Vorschlag, kann ihn aber wie bisher frei überschreiben. Das ist kein Bruch mit der Produkt-Entscheidung "keine automatische Verrechnung", weil das Feld weiterhin ein normales, frei editierbares Eingabefeld bleibt.
- **Zugriff:** `/admin/gutscheine` nur für Admins, wie jeder andere Admin-Bereich.

### D) Dependencies (packages to install)

Keine neuen Pakete nötig — reine Erweiterung der bestehenden Buchungs- und Admin-Infrastruktur.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
