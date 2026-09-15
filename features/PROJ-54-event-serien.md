# PROJ-54: Event-Serien (regelmäßige Veranstaltungen)

## Status: Architected
**Created:** 2026-09-14
**Last Updated:** 2026-09-14

## Dependencies
- Requires: PROJ-53 (Veranstaltungsprogramm) — Eventarten, Verkaufsart, Bereich „Regelmäßig" in der Übersicht
- Requires: PROJ-51 (Kurszeiträume, Umwandlung und Ferien) — Studioferien
- Requires: PROJ-14 (Events & Workshops) — Ticketkauf, QR-Check-in
- Requires: PROJ-16 (Benachrichtigungen) — Absage und Verlegung einzelner Termine an Ticket-Inhaber

## User Stories
- Als Admin möchte ich eine regelmäßige Party einmal als Serie anlegen (z. B. „jeden Freitag 21:00" oder „jeden 1. Samstag im Monat"), damit ich nicht jeden Termin einzeln pflegen muss.
- Als Admin möchte ich einzelne Termine einer Serie absagen oder verlegen (andere Uhrzeit, anderes Datum, anderer Ort), ohne die ganze Serie zu ändern.
- Als Admin möchte ich pro Serie festlegen, ob sie in den Studioferien pausiert.
- Als Besucher möchte ich im Programm sehen, wann die regelmäßige Party das nächste Mal stattfindet und welche Termine folgen.
- Als Kunde möchte ich bei einer Serie mit Tickets ein Ticket für einen bestimmten Termin kaufen.
- Als Ticket-Inhaber möchte ich benachrichtigt werden, wenn mein Termin abgesagt oder verlegt wird.

## Out of Scope
- **Mehrfachkarten, Saisonkarten oder ein Party-Abo** über mehrere Termine
- **Andere Rhythmen** als ein fester Wochentag — kein monatlicher, zweiwöchiger oder „letzter Freitag im Monat"-Rhythmus (Betreiberentscheidung 2026-09-15). Eine monatliche Party wird als Einzelevent je Termin angelegt.
- **Unterschiedliche Preise je Termin** — eine Serie hat einheitliche Preise
- **Eigene Bilder je Termin** — eine Serie teilt ihre Bilder (PROJ-55)
- **Ferien einzelner Locations** — es zählen nur die Studioferien
- **Warteliste** — bleibt ausgeschlossen

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Serie anlegen und ändern
- [ ] Angenommen ein Admin legt eine Serie an, dann gibt er Name, Eventart, Wochentag, Uhrzeit von–bis, Ort, Beschreibung, Preise, Verkaufsart, den ersten Termin und optional ein Ende der Serie an
- [ ] Angenommen eine Serie ist gespeichert, dann erscheinen ihre kommenden Termine automatisch im Programm, ohne dass einzelne Termine angelegt werden
- [ ] Angenommen eine Serie hat ein Ende, dann gibt es danach keine Termine mehr, und nach dem letzten Termin verschwindet sie aus dem Programm
- [ ] Angenommen ein Admin ändert Rhythmus, Uhrzeit oder Ort der Serie, dann gilt das für alle künftigen Termine; betroffene Termine mit verkauften Tickets zeigt die App vor dem Speichern an, und deren Ticket-Inhaber werden wie bei einer Verlegung benachrichtigt
- [ ] Angenommen ein Admin beendet eine Serie, deren künftige Termine Tickets haben, dann nennt die App vor dem Bestätigen die Zahl der betroffenen Tickets, und nach dem Bestätigen werden deren Inhaber benachrichtigt

### Einzelne Termine
- [ ] Angenommen ein Admin sagt einen einzelnen Termin ab, dann erscheint dieser Termin in der Terminliste der Serie als „Fällt aus", alle anderen Termine bleiben unverändert
- [ ] Angenommen der abgesagte Termin hatte verkaufte Tickets, dann gelten diese als storniert, und ihre Inhaber werden benachrichtigt (Event-Tickets-Benachrichtigung)
- [ ] Angenommen ein Admin verlegt einen einzelnen Termin (Datum, Uhrzeit oder Ort), dann zeigt das Programm den geänderten Termin mit dem Hinweis „Geändert", und Ticket-Inhaber werden benachrichtigt
- [ ] Angenommen ein Admin nimmt eine Absage zurück, bevor der Termin stattgefunden hat, dann erscheint der Termin wieder regulär
- [ ] Angenommen ein Termin wurde verlegt, dann darf ein Ticket-Inhaber sein Ticket unabhängig von der Stornofrist stornieren

### Studioferien
- [ ] Angenommen eine Serie ist auf „In Studioferien pausieren" gestellt, dann entfallen ihre Termine in den Studioferien automatisch, und das Programm zeigt bei der Serie „Ferienpause bis …", solange der nächste reguläre Termin in die Ferien fällt
- [ ] Angenommen eine Serie ist nicht auf Ferienpause gestellt, dann finden ihre Termine auch in den Studioferien statt
- [ ] Angenommen Studioferien werden nachträglich eingetragen und betreffen einen Termin mit verkauften Tickets, dann bleibt dieser Termin bestehen, und der Admin sieht einen Hinweis, dass er ihn ausdrücklich absagen muss

### Programm
- [ ] Angenommen ein Besucher öffnet die Übersicht, dann steht jede Serie im Bereich „Regelmäßig" mit dem Rhythmus in Worten (z. B. „Jeden Freitag, 21:00–02:00"), dem nächsten stattfindenden Termin und dem Ort
- [ ] Angenommen ein Besucher öffnet die Eventseite einer Serie, dann sieht er die kommenden Termine, einschließlich „Fällt aus" und „Geändert"
- [ ] Angenommen ein Besucher filtert nach Eventart, dann gilt der Filter auch für Serien
- [ ] Angenommen die Seite wird auf Englisch aufgerufen, dann erscheint auch der Rhythmus auf Englisch (z. B. „Every Friday")

### Tickets bei Serien
- [ ] Angenommen eine Serie verkauft Tickets in der App, dann wählt der Kunde beim Kauf einen Termin, und die Kapazität gilt je Termin
- [ ] Angenommen ein Termin ist ausgebucht, dann ist nur dieser Termin nicht mehr kaufbar, die anderen bleiben es
- [ ] Angenommen ein Kunde hat ein Ticket für einen Serientermin, dann nennen „Meine Tickets", die Bestätigung und der QR-Code Datum und Uhrzeit genau dieses Termins
- [ ] Angenommen ein Ticket wird an einem anderen Termin der Serie gescannt, dann wird der Check-in abgelehnt, mit Hinweis auf den richtigen Termin

## Edge Cases
- Der erste Termin einer Serie liegt auf einem anderen Wochentag als dem gewählten → der erste Termin ist der nächste passende Wochentag
- Eine Party geht über Mitternacht (21:00–02:00) → der Termin gehört zum Starttag, das Ende liegt am Folgetag
- Sommer-/Winterzeit-Umstellung → eine Party um 21:00 bleibt 21:00 Wiener Zeit
- Ein Einzeltermin wird auf ein Datum verlegt, an dem die Serie bereits einen Termin hat → Validierungsfehler
- Studioferien werden wieder gelöscht → die betroffenen Termine erscheinen wieder, außer sie wurden einzeln abgesagt
- Der erste Termin einer neuen Serie liegt in der Vergangenheit → vergangene Termine erscheinen nicht, die Serie beginnt mit dem nächsten künftigen Termin
- Ein Kunde kauft ein Ticket, danach wird der Termin verlegt → das Ticket gilt für den neuen Zeitpunkt, der Kunde darf stornieren
- Zwei Kunden kaufen gleichzeitig den letzten Platz eines Termins → nur einer bekommt ihn (wie PROJ-14)
- Eine Serie steht auf „Nur anzeigen" → keine Kapazität, kein Kauf, Termine erscheinen nur im Programm

## Technical Requirements (optional)
- Alle Zeiten in Wiener Zeit (Europe/Vienna), einschließlich Sommer-/Winterzeit
- Kapazitätsprüfung je Termin race-condition-sicher (wie PROJ-14)
- Benachrichtigungen über die bestehende Gruppe „Event-Tickets" (PROJ-16)

## Open Questions
- [x] Welche Rhythmen? → Nur wöchentlich, ein fester Wochentag. Ausdrücklich nachgefragt, weil der Betreiber anfangs auch eine monatliche Party genannt hatte; die wird als Einzelevent angelegt (2026-09-15)
- [x] Wie weit im Voraus sind Serientermine sichtbar und kaufbar? → Vier Wochen (2026-09-15)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Regelmäßige Veranstaltungen als Serie mit Rhythmus, nicht als Einzeltermine | Betreiberentscheidung — einmal anlegen statt jeden Termin neu | 2026-09-14 |
| Einzelne Termine lassen sich absagen und verlegen, ohne die Serie zu ändern | Betreiberentscheidung — Ausfälle und Sondertermine kommen vor | 2026-09-14 |
| Ferienpause pro Serie wählbar | Betreiberentscheidung — manche Partys laufen auch in den Ferien weiter | 2026-09-14 |
| Tickets und Kapazität gelten je Termin | Folgt aus der Entscheidung für Serien mit Tickets | 2026-09-14 |
| Abgesagte Termine bleiben in der Terminliste als „Fällt aus" sichtbar | Stammgäste sollen den Ausfall sehen, statt zu rätseln | 2026-09-14 (Vorschlag) |
| Nachträglich eingetragene Ferien sagen Termine mit verkauften Tickets nicht automatisch ab | Eine Absage mit Folgen für zahlende Gäste braucht eine bewusste Entscheidung | 2026-09-14 (Vorschlag) |
| Nach einer Verlegung darf der Kunde unabhängig von der Stornofrist stornieren | Er hat für den ursprünglichen Termin gekauft | 2026-09-14 |
| Nur wöchentliche Serien; die monatliche Party wird als Einzelevent je Termin angelegt | Betreiberentscheidung nach ausdrücklicher Rückfrage — der Aufwand für einen zweiten Rhythmus lohnt sich für eine Party im Monat nicht | 2026-09-15 |
| Termine sind vier Wochen im Voraus sichtbar und kaufbar | Betreiberentscheidung — genug zum Planen, ohne endlose Terminlisten | 2026-09-15 |
| Die drei Vorschläge vom 2026-09-14 gelten (abgesagte Termine bleiben als „Fällt aus" sichtbar, nachträgliche Ferien sagen Termine mit Tickets nicht automatisch ab, Storno nach Verlegung ohne Frist) | Vom Betreiber bestätigt | 2026-09-15 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Serientermine werden als echte Events angelegt, nicht zur Anzeige gerechnet | Tickets, Kapazitätssperre, QR-Check-in, Gästeliste, SEPA-Posten und „Mein Bereich" hängen an einem Event; virtuelle Termine müssten all das doppeln | 2026-09-15 |
| Vier Wochen Termine im Voraus, nachgelegt vom nächtlichen Lauf und beim Speichern einer Serie | Der Lauf hat schon Schritte dieser Art (PROJ-51); beim Speichern sofort, damit Termine nicht erst am Folgetag erscheinen | 2026-09-15 |
| Die Terminberechnung der Kurse wird wiederverwendet (Wochentag, Ferien, Zeitraum) | Sie kann genau das schon; eine zweite Rechnung liefe früher oder später anders | 2026-09-15 |
| Einzelne Termine: Absage über den bestehenden Event-Status, Verlegung über Zeit/Ort plus Markierung „weicht ab" | Serienweite Änderungen dürfen einen bewusst verlegten Termin nicht überschreiben | 2026-09-15 |
| „Termin verlegt" wird eine neue Vorlage in der bestehenden Gruppe „Event-Tickets", keine neue Ereignisart | Die Warteschlange hat eine feste CHECK-Liste erlaubter Arten — ein unbekannter Eintrag scheitert lautlos; die Vorlage bleibt im Admin änderbar | 2026-09-15 |
| Der Termin merkt sich, dass er verlegt wurde; daran hängt das fristfreie Stornieren | Sonst müsste die Storno-Funktion raten, ob der Kunde für einen anderen Zeitpunkt gekauft hat | 2026-09-15 |
| Der Check-in prüft künftig Ticket gegen ausgewählten Termin | Bei Serien heißen alle Termine gleich; heute prüft er nur die Ticket-Kennung, ein Ticket der Vorwoche wäre an der Tür gültig | 2026-09-15 |
| Eigene Adresse je Termin (Serienadresse plus Datum), Serienseite behält ihre eigene | Ein einzelner Abend soll teilbar bleiben, ohne die Serienseite zu ersetzen | 2026-09-15 |
| Serientermine erscheinen nicht einzeln unter „Besondere Events" | Sonst stünde dieselbe Party vier Mal untereinander und verdrängte die besonderen Veranstaltungen | 2026-09-15 |
| Keine neuen Pakete | Alles mit Next.js, Supabase und vorhandenen Bausteinen umsetzbar | 2026-09-15 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
PROJ-54 braucht Frontend **und** Backend. Der Kern in einem Satz: Eine Serie beschreibt nur die Regel — die einzelnen Termine entstehen daraus automatisch als ganz normale Events. Damit gelten Tickets, Kapazität, QR-Check-in, SEPA-Posten, Benachrichtigungen und „Mein Bereich" unverändert; nichts davon muss für Serien ein zweites Mal gebaut werden.

### A) Komponentenstruktur

**Öffentliche Übersicht** (der Bereich aus PROJ-53 wird endlich befüllt)
```
Event-Übersicht
+-- Bereich „Regelmäßig"
|   +-- Serien-Karte: Eventart, Name, „Jeden Freitag, 21:00–02:00", nächster Termin, Ort
|       +-- führt zur Serienseite
+-- Bereich „Besondere Events" (unverändert — Serientermine stehen hier nicht einzeln)
```

**Serienseite** (eigene Adresse, wie eine Eventseite)
```
Serienseite
+-- Kopf: Eventart, Name, Rhythmus in Worten, Ort
+-- Hinweis „Ferienpause bis …" (wenn der nächste reguläre Termin in die Ferien fällt)
+-- Beschreibung
+-- Terminliste der nächsten vier Wochen
|   +-- je Termin: Datum und Uhrzeit, dazu frei / ausgebucht / „Fällt aus" / „Geändert" / „Du hast ein Ticket"
|   +-- je Termin ein Knopf: Ticket kaufen (bestehender Kaufdialog) oder „Eintritt vor Ort"
+-- Für Suchmaschinen: je kommendem Termin ein Eintrag in den Event-Daten
```

**Admin** (die bestehende Event-Verwaltung bekommt einen zweiten Bereich)
```
/admin/events
+-- Einzelevents (wie bisher)
+-- Serien
    +-- Liste: Name, Rhythmus, nächster Termin, Verkaufsart, Status
    +-- Anlegen/Bearbeiten: Name, Eventart, Wochentag, Uhrzeit von–bis, Ort,
    |   Beschreibung, Preise, Verkaufsart, Kapazität, erster Termin,
    |   optionales Ende, „In Studioferien pausieren"
    +-- Serie beenden (nennt vorher die Zahl der Tickets auf künftigen Terminen)
    +-- Terminliste der Serie: „Absagen", „Absage zurücknehmen", „Verlegen"
```

### B) Datenmodell (in Worten)

**Serie** (neu)
- Name, Eventart, Beschreibung, Ort
- Wochentag, Beginn- und Endzeit
- erster Termin, optionales Ende der Serie
- „in Studioferien pausieren" ja/nein
- Verkaufsart, Kapazität, Preise (gelten für jeden Termin gleich)
- eigene lesbare Adresse für die Serienseite
- Status: läuft oder beendet

**Termin** = ein Event wie bisher, zusätzlich
- Verweis auf seine Serie
- das Kalenderdatum des Termins (je Serie und Datum höchstens ein Termin)
- eine Markierung „weicht ab" für einzeln verlegte Termine
- eine Markierung, dass er verlegt wurde — daran hängt das fristfreie Stornieren

**Unverändert:** Tickets, Check-in, SEPA-Posten, Benachrichtigungen, Eventarten, frühere Adressen.

Gespeichert in Supabase (PostgreSQL) mit Row Level Security wie bei Events: öffentlich lesbar, schreiben nur Admins.

### C) Technische Entscheidungen (für den Betreiber erklärt)

- **Termine sind echte Events, nicht nur gerechnet.** Ticket, Kapazitätssperre, QR-Code, Gästeliste, Lastschrift und „Mein Bereich" hängen alle an einem Event. Wären Serientermine bloß Rechenergebnisse, müsste jedes dieser Stücke ein zweites Mal gebaut werden — mit der Aussicht, dass beide Fassungen auseinanderlaufen.
- **Vier Wochen Vorlauf, täglich nachgelegt.** Der nächtliche Lauf hat schon Schritte dieser Art (Abo-Vollzug, Kursumwandlung). Ein weiterer Schritt legt fehlende Termine an; beim Speichern einer Serie passiert dasselbe sofort, damit die Termine nicht erst am nächsten Morgen erscheinen.
- **Nur ein fester Wochentag.** Damit lässt sich die Terminberechnung der Kurse wiederverwenden, die Wochentag, Ferien und Zeitraum schon beherrscht — statt eine zweite, eigene Rechnung zu bauen.
- **Ferien:** Beim Anlegen künftiger Termine werden Ferien übersprungen, wenn die Serie darauf eingestellt ist. Nachträglich eingetragene Ferien lassen bestehende Termine stehen; die Verwaltung weist darauf hin, welche Termine betroffen sind.
- **Einzelne Termine bleiben normale Events.** Absagen heißt: Status „abgesagt" wie bei jedem Event, Ticket-Inhaber werden benachrichtigt. Verlegen heißt: Zeit oder Ort ändern und den Termin als „weicht ab" markieren, damit die nächste Serienänderung ihn nicht wieder überschreibt.
- **Serienweite Änderungen** greifen auf alle künftigen Termine, außer auf abgesagte und einzeln verlegte. Vor dem Speichern nennt die App, wie viele betroffene Termine Tickets haben; danach werden deren Inhaber wie bei einer Verlegung benachrichtigt.
- **„Termin verlegt" wird eine neue Vorlage in der bestehenden Gruppe „Event-Tickets".** Keine neue Ereignisart: Die Warteschlange hat eine feste Liste erlaubter Arten, und ein Eintrag mit unbekannter Art scheitert lautlos. So bleibt außerdem der Text im Admin änderbar wie alle anderen.
- **Stornieren nach einer Verlegung** ist unabhängig von der Frist möglich; dafür merkt sich der Termin, dass er verlegt wurde.
- **Der Check-in prüft künftig, dass das Ticket zum ausgewählten Termin gehört.** Heute prüft er nur die Ticket-Kennung. Bei einer Serie heißen alle Termine gleich — ohne diese Prüfung wäre ein Ticket vom Vorwoche-Termin an der Tür gültig.
- **Jeder Termin bekommt eine eigene Adresse** (Serienadresse plus Datum), damit sich ein einzelner Abend teilen lässt. Die Serienseite behält ihre eigene.
- **Serientermine erscheinen nicht einzeln unter „Besondere Events"** — sonst stünde dieselbe Party vier Mal untereinander und verdrängte die besonderen Veranstaltungen.
- **Keine neuen Pakete.**

### D) Abhängigkeiten (Pakete)
Keine neuen Pakete.

### Auswirkungen auf Bestehendes
- **Migration:** neue Tabelle für Serien, zwei zusätzliche Angaben an den Events, eine neue Benachrichtigungsvorlage. Auslieferung wie gehabt: erst Migration, dann Code.
- **Nächtlicher Lauf:** ein zusätzlicher Schritt; der Zeitplan in Vercel bleibt unverändert.
- **Tests:** Die PROJ-53-Übersicht bekommt den Bereich „Regelmäßig" (ein Test dort prüft bisher seine Abwesenheit). Die neue Check-in-Prüfung ändert Verhalten aus PROJ-14 und braucht dort einen zusätzlichen Test.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
