# PROJ-54: Event-Serien (regelmäßige Veranstaltungen)

## Status: Approved
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

## Implementation Notes (Frontend)

**Stand 2026-09-15:** Frontend fertig. Im Browser läuft es erst mit der Migration aus `/backend` — die Seiten lesen die neue Serien-Tabelle. Unit-Tests 613 in 55 Dateien, Typprüfung und Lint sauber.

### Gebaut
- **Serien-Logik** `src/lib/events/serie.ts` (12 neue Tests): Termine im Vorschaufenster von vier Wochen, nächster Termin, Ferienpause und die Uhrzeit ohne Sekunden. Gerechnet wird mit `upcomingOccurrences` aus dem Stundenplan — genau der Funktion, die auch Kurstermine bestimmt, samt Ferien und Zeitraum.
- **Übersicht:** Bereich „Regelmäßig" über den besonderen Events. Die Serien-Karte nennt den Rhythmus in Worten und darunter den nächsten Termin oder „Ferienpause bis …". Der Filter nach Eventart gilt für beide Bereiche; Serientermine erscheinen nicht einzeln unter „Besondere Events".
- **Serienseite:** unter derselben Adresse wie Eventseiten. Rhythmus, Beschreibung, Terminliste der nächsten vier Wochen mit „Fällt aus", „Geändert", freien Plätzen und Kaufknopf je Termin. Seitentitel, Link-Vorschau und Event-Daten für Google — je Termin ein Eintrag, weil schema.org keine Serie kennt.
- **Admin:** `/admin/events` hat zwei Bereiche. Die Serien-Verwaltung zeigt Rhythmus und Status, das Formular fragt Wochentag, Uhrzeit, ersten Termin, optionales Ende, Ferienpause, Verkaufsart, Kapazität und Preise. Je Serie gibt es eine Terminliste mit Absagen, Zurücknehmen und Verlegen; „Beenden" nennt vorher die Zahl der betroffenen Tickets.
- **Server-Aktionen** `src/lib/actions/admin/event-series.ts`: anlegen (legt die Termine sofort an, nicht erst nachts), ändern (richtet künftige Termine aus, lässt abgesagte und einzeln verlegte unberührt, benachrichtigt Ticket-Inhaber bei geänderter Zeit oder geändertem Ort), beenden, Termin absagen, Absage zurücknehmen, Termin verlegen, Termine und Ticketzahl lesen.
- **Gemeinsame Adressprüfung** `src/lib/actions/admin/adressen.ts`: Events, frühere Adressen und Serien zusammen — unter `/events/…` darf keine Adresse doppelt vergeben sein.
- **Texte** in beiden Sprachen: „Regelmäßig", Rhythmus, nächster Termin, Ferienpause, „Fällt aus", „Geändert".

### Abweichungen und Offenes
- `src/lib/supabase/types.ts` ist erneut **von Hand** ergänzt (Serien-Tabelle sowie `series_id`, `occurrence_date`, `overridden`, `moved_at` am Event) — nach der Migration neu erzeugen und abgleichen.
- ~~Die Benachrichtigung „Termin verlegt" hat noch keine Vorlage.~~ Erledigt im Backend.
- ~~Die Storno-Funktion wertet `moved_at` noch nicht aus.~~ Erledigt im Backend.
- ~~Der Check-in prüft nicht, ob ein Ticket zum ausgewählten Termin gehört.~~ Erledigt im Backend.
- ~~Der nächtliche Schritt fehlt.~~ Erledigt im Backend.
- Der PROJ-53-Test „ohne Serien kein Bereich Regelmäßig" prüft einen studioweiten Leerzustand. Sobald Serien existieren, ist er nicht mehr aussagekräftig — er gehört in der QA umgebaut (siehe auch die Projektregel, keine studioweiten Leerzustände zu behaupten).

### Übergabe an `/backend`

Abgearbeitet — siehe „Implementation Notes (Backend)“.

## Implementation Notes (Backend)

**Stand 2026-09-15:** Backend fertig. Migration `supabase/migrations/20260915100000_proj54_event_serien.sql` — erst einspielen, dann den Code ausliefern. Unit-Tests 621 in 56 Dateien, Typprüfung, Lint und `npm run build` sauber.

### Datenbank
- **`event_series`**: Name, eigene Adresse, Beschreibung, Ort, Eventart, Verkaufsart, Wochentag (0 = Montag), Beginn- und Endzeit, erster Termin, optionales Ende, Ferienpause, Kapazität, Preise, Status. RLS wie bei den Events: öffentlich lesbar, schreiben nur Admins. Zwei Sperren in der Tabelle selbst — das Serienende darf nicht vor ihrem Beginn liegen, und wer Tickets verkauft, braucht Kapazität und Preise.
- **`events`** um vier Angaben erweitert: Serie, Kalendertag des Termins, „weicht ab" und „wurde verlegt". Index auf die Serie, und je Serie und Kalendertag höchstens ein Termin — ohne diese Sperre entstünde bei zwei gleichzeitigen Läufen derselbe Abend zweimal. Ein Serientermin ohne Datum ist ausgeschlossen: Er wäre für das Nachlegen unsichtbar und käme in jedem Lauf neu dazu.
- Wird eine Serie je gelöscht, bleiben ihre Abende samt Tickets stehen und gelten fortan als gewöhnliche Events (`on delete set null`). Die Verwaltung bietet ohnehin nur „Beenden" an.
- **Stornieren:** Ist der Termin verlegt worden, entfällt die Frist; Grenze ist dann der Abend selbst. Die Profilseite rechnet genauso — sonst böte der Knopf etwas an, das die Datenbank ablehnt.
- **Check-in:** `checkin_event_ticket` verlangt jetzt den ausgewählten Termin und weist ein Ticket ab, das zu einem anderen gehört. Hier war ein `drop` unvermeidlich (zweiter Parameter), die Rechte werden in derselben Migration neu vergeben. Beide angefassten Funktionen entziehen `anon` anschließend wieder das Ausführungsrecht — die Falle aus `20260909210000`.

### Code
- **Termine nachlegen** `src/lib/events/termine-nachlegen.ts` (7 neue Tests): eine Tür für beide Anlässe — das Speichern einer Serie und der nächtliche Lauf. Dort steht auch die Umrechnung „21:00 heißt 21:00 in Wien" samt der Regel, dass ein Ende vor dem Beginn am Folgetag liegt.
- **Nächtlicher Lauf** `/api/cron/notifications`: ein zusätzlicher Schritt „serientermine" im Morgenlauf, abgesichert wie die anderen — eine klemmende Serie kostet weder den Abo-Vollzug noch die Warteschlange, wird aber gemeldet und färbt den Lauf rot. Der Zeitplan in Vercel bleibt unverändert.
- **Vorlage „Termin verlegt"** (`event_verlegt`) in der Gruppe „Event-Tickets", deutsch und englisch, im Admin änderbar wie alle anderen. Keine neue Ereignisart, also keine Änderung an der Warteschlange. Der Text nennt den neuen Zeitpunkt und den Wegfall der Frist und führt ins Profil, wo Ticket und Stornoknopf stehen.
- **Check-in an der Oberfläche:** Die Terminauswahl zeigt jetzt Datum und Uhrzeit — bei einer Serie heißen alle Termine gleich — und führt nur noch, was noch aussteht (ein Tag Rückblick, damit der Check-in nach Mitternacht weitergeht). Ein Ticket vom falschen Abend meldet „Dieses Ticket gehört zu einem anderen Termin."
- **Serie auf „Nur anzeigen" umstellen** wird abgelehnt, solange auf künftigen Terminen gültige Tickets liegen — mit der Zahl dazu. Ohne diese Prüfung liefe die Serie auf „Nur anzeigen", ihre Termine aber blieben auf „Tickets": Die Datenbanksperre am einzelnen Event hätte deren Umstellung stillschweigend verhindert.

### In der Testdatenbank geprüft
Die Migration ist am 2026-09-15 vom Betreiber eingespielt worden. `tests/PROJ-54-serien-db.test.ts` prüft 18 Regeln gegen die echte Testdatenbank, alle grün — die Sperren der Serientabelle, höchstens ein Termin je Serie und Kalendertag, das Weiterleben eines Abends samt Ticket nach dem Löschen seiner Serie, die öffentliche Leseregel, die aufgehobene Stornofrist nach einer Verlegung (samt der Grenze, dass ein begonnener Abend auch dann nicht mehr storniert wird) und der Check-in gegen den ausgewählten Termin, geprüft am echten Fall „Ticket der Vorwoche am heutigen Abend".

### Nach der Migration noch offen
- `src/lib/supabase/types.ts` neu erzeugen und mit der Handfassung abgleichen (Serien-Tabelle, die vier Event-Spalten, die neue Check-in-Signatur). Der MCP-Zugang war am 2026-09-15 nicht verbunden (HTTP 401); die Handfassung deckt sich mit der Migration, die die Datenbanktests nun als eingespielt belegen.

### Bewusst nicht gebaut
- **Keine Datenbanksperre auf die gemeinsame Adresse** von Events und Serien. Beide wohnen unter `/events/…`, geprüft wird in der App (`vergebeneAdressen`). Tabellenübergreifend ginge das nur über einen Trigger, der bei jedem Event-Schreibvorgang die Serien mitliest.
- **Keine Nachricht bei nachträglich eingetragenen Ferien.** Bestehende Termine bleiben stehen; die Verwaltung weist darauf hin. Wer sie absagen will, tut es je Termin — dann greift die übliche Absage samt Benachrichtigung.

## QA Test Results

**Getestet:** 2026-09-15
**Umgebung:** localhost:3100 gegen die Testdatenbank, Migration 20260915100000 eingespielt
**Tester:** QA Engineer (AI)

### Abnahmekriterien

#### Serie anlegen und ändern
- [x] Anlegen mit Name, Eventart, Wochentag, Uhrzeit von–bis, Ort, Beschreibung, Preisen, Verkaufsart, erstem Termin und optionalem Ende — E2E
- [x] Termine erscheinen ohne weiteres Zutun im Programm (vier Wochen Vorlauf) — E2E
- [x] Serie mit Ende legt danach nichts mehr an und verschwindet aus dem Programm — Unit (`serie.test.ts`: „hört mit dem Ende der Serie auf", „gibt nichts zurück, wenn die Serie schon beendet ist")
- [x] Serienweite Änderung: Das Formular nennt vorab die Tickets auf künftigen Terminen und den Hinweis auf die Benachrichtigung — E2E
- [x] „Serie beenden" nennt vorher die Zahl der betroffenen Tickets — E2E

#### Einzelne Termine
- [x] Absagen: „Fällt aus" in Verwaltung und Programm, andere Termine unberührt — E2E
- [x] Ticket-Inhaber eines abgesagten Termins werden benachrichtigt (siehe Beobachtung 1 zum Ticketstatus)
- [x] Verlegen: „Geändert" im Programm, Ticket-Inhaber werden benachrichtigt — E2E
- [x] Absage zurücknehmen — E2E
- [x] Nach einer Verlegung ohne Frist stornieren — Datenbanktest, und der Stornoknopf im Profil folgt derselben Regel

#### Studioferien
- [x] Ferienpause: Termine entfallen, das Programm zeigt „Ferienpause bis …" — E2E (zweimal: die Karte der pausierenden Serie und eine neu angelegte Serie, die die Ferienwoche überspringt)
- [x] Ohne Ferienpause finden die Termine auch in den Ferien statt — E2E
- [x] Nachträglich eingetragene Ferien lassen einen Termin mit verkauften Tickets stehen; die Verwaltung markiert ihn mit „In Studioferien" und nennt den Grund — BUG-1 behoben, E2E

#### Programm
- [x] Die Übersichtskarte nennt Rhythmus in Worten, Ort und den nächsten *stattfindenden* Termin — BUG-2 behoben, E2E
- [x] Serienseite zeigt die kommenden Termine samt „Fällt aus" und „Geändert" — E2E
- [x] Der Filter nach Eventart gilt auch für Serien — E2E
- [x] Auf Englisch steht auch der Rhythmus auf Englisch („Every Wednesday, 21:00–02:00") — E2E

#### Tickets bei Serien
- [x] Kauf je Termin, Kapazität je Termin — E2E
- [x] Ein ausgebuchter Termin sperrt nur sich selbst — E2E
- [x] „Meine Tickets" nennt Datum und Uhrzeit genau dieses Termins — E2E
- [ ] **BUG-3:** Ein Ticket vom falschen Termin wird abgewiesen (Datenbanktest), die Meldung nennt aber nicht den richtigen Termin

### Edge Cases
- [x] Erster Termin auf einem anderen Wochentag → der nächste passende — Unit
- [x] Party über Mitternacht (21:00–02:00) → Ende am Folgetag — Unit
- [x] Sommer-/Winterzeit → 21:00 bleibt 21:00 Wiener Zeit — Unit
- [x] Verlegen auf ein belegtes Datum → Fehlermeldung — E2E, zusätzlich als Datenbanksperre
- [x] Ferien wieder gelöscht → der nächtliche Lauf legt die fehlenden Termine wieder an, einzeln abgesagte bleiben abgesagt
- [x] Erster Termin in der Vergangenheit → vergangene Termine erscheinen nicht — Unit und Datenbanktest
- [x] Ticket gekauft, danach verlegt → Ticket gilt weiter, Storno ohne Frist — Datenbanktest
- [x] Zwei Kunden, letzter Platz → unverändert die Sperre aus PROJ-14
- [x] Serie auf „Nur anzeigen" → kein Kauf (siehe BUG-5 zur fehlenden Angabe)

### Sicherheitsprüfung
- [x] **Schreibrechte:** Ein Kunde kann keine Serie anlegen; alle acht Server-Aktionen prüfen zuerst `requireAdmin()` — Datenbanktest und Code
- [x] **Leserechte:** Serien sind öffentlich lesbar und enthalten nur Programmangaben — Datenbanktest mit einer echten Zeile, nicht nur „kein Fehler"
- [x] **Check-in:** Ein Kunde kann nicht einchecken, auch nicht sein eigenes Ticket; ein Ticket vom anderen Termin wird abgewiesen und bleibt unangetastet — Datenbanktest
- [x] **Stornieren:** nur das eigene Ticket, und nach einer Verlegung nur bis zum Beginn — Datenbanktest
- [x] **Einschleusen:** Name und Beschreibung gehen als Text durch React. Die Google-Daten im `<script>` laufen über `alsSkriptInhalt`, das `<` maskiert — ein `</script>` im Seriennamen bricht nicht aus
- [x] **Regeln gelten auch an der Oberfläche vorbei:** höchstens ein Termin je Serie und Tag, Serientermin ohne Datum, Kapazität und Preise bei Ticketverkauf — alles als Datenbanksperre geprüft

### Regression
- [x] PROJ-53 Veranstaltungsprogramm: vollständig grün (ein Test prüfte bisher, dass es studioweit keine Serien gibt — auf die Zuordnung der eigenen Testdaten umgestellt, siehe Projektregel gegen studioweite Leerzustände)
- [x] PROJ-14 Events, Tickets, QR-Check-in: vollständig grün trotz der geänderten Check-in-Signatur
- [x] Unit-Suite: 639 Tests in 57 Dateien

### Gefundene Fehler

#### BUG-1: Nachträgliche Ferien sagen einen Termin mit Tickets ab
- **Schwere:** High
- **Schritte:**
  1. Serie mit „In Studioferien pausieren" anlegen, ein Termin am 17.09. trägt ein verkauftes Ticket
  2. Danach Studioferien vom 17.09. bis 19.09. eintragen
  3. In der Verwaltung die Serie öffnen, nur die Beschreibung ändern, speichern
  4. **Erwartet:** Der Termin bleibt bestehen; der Admin sieht den Hinweis, dass er ihn ausdrücklich absagen muss
  5. **Tatsächlich:** Der Termin steht auf „abgesagt", und die Ticket-Inhaber bekommen die Absage-Nachricht
- **Beleg:** Wegwerf-Test am 2026-09-15, Status nach dem Speichern: `abgesagt`
- **Ursache:** `richteKuenftigeTermineAus` in `src/lib/actions/admin/event-series.ts` strich jeden künftigen Termin, der nicht mehr im gerechneten Rhythmus lag — Ferien eingeschlossen. Der Hinweis im Formular („Bereits angelegte Termine bleiben.") sagte das Gegenteil, und die Produktentscheidung vom 2026-09-14 verlangt für eine Absage mit Folgen für zahlende Gäste eine bewusste Entscheidung
- **Behoben (2026-09-15):** Der Rhythmus wird jetzt zweimal gerechnet — mit und ohne Ferien. Was nur ihretwegen fehlt, bleibt stehen und wird weiter ausgerichtet; nur was aus dem Rhythmus selbst fällt (anderer Wochentag, Serie früher zu Ende), verschwindet oder wird abgesagt. Die Regel steht als `terminBleibt` in `src/lib/events/serie.ts` und ist einzeln getestet. Die Terminliste im Admin zeigt solche Termine als „In Studioferien" samt Hinweis, dass sie bis zu einer ausdrücklichen Absage bestehen bleiben

#### BUG-2: „Nächster Termin" nennt auch einen abgesagten Abend
- **Schwere:** Medium
- **Schritte:**
  1. Den nächsten Termin einer Serie absagen
  2. `/events` öffnen
  3. **Erwartet:** Die Karte nennt den nächsten *stattfindenden* Termin
  4. **Tatsächlich:** Sie nennt weiter den abgesagten („Nächster Termin: Do., 17.09.")
- **Beleg:** Wegwerf-Test am 2026-09-15
- **Ursache:** `naechsterTermin` rechnete allein aus der Regel (Wochentag, Zeitraum, Ferien) und sah die Terminzeilen nicht an. Verlegte Termine traf dasselbe
- **Behoben (2026-09-15):** Die Übersicht liest die kommenden Serientermine mit und nennt den ersten, der wirklich stattfindet — dieselbe Grenze wie bei Einzelevents. `naechsterTermin` ist damit entfallen: Eine zweite, gerechnete Antwort auf dieselbe Frage liefe früher oder später wieder auseinander

#### BUG-3: Die Check-in-Absage nennt den richtigen Termin nicht
- **Schwere:** Low
- **Schritte:** Ticket vom Abend der Vorwoche am heutigen Termin scannen
- **Erwartet:** Ablehnung mit Hinweis, zu welchem Termin das Ticket gehört
- **Tatsächlich:** „Dieses Ticket gehört zu einem anderen Termin." — ohne Datum. An der Tür hilft das nicht weiter, wenn jemand den Abend verwechselt hat
- **Priorität:** im nächsten Durchgang

#### BUG-4: Verlegen löscht den Ort des Termins
- **Schwere:** Low
- **Schritte:** Einen Termin verlegen, das Feld „Anderer Ort" leer lassen
- **Erwartet:** Der Ort der Serie bleibt — so verspricht es der Platzhalter „leer lassen: Ort der Serie"
- **Tatsächlich:** `moveSeriesOccurrence` schreibt `null`; die eigene Seite dieses Abends steht danach ohne Ort da. Die Serienseite zeigt weiter den Ort der Serie, deshalb fällt es kaum auf
- **Priorität:** im nächsten Durchgang

#### BUG-5: Der Serienseite fehlen Angaben, die jede Eventkarte hat
- **Schwere:** Low
- **Schritte:** Serienseite einer Serie auf „Nur anzeigen" öffnen; oder als Ticket-Inhaber die Serienseite öffnen
- **Erwartet:** „Eintritt vor Ort" wie auf jeder Karte; bei vorhandenem Ticket zusätzlich die freien Plätze oder „Ausgebucht" (die Regel aus PROJ-53, BUG-1)
- **Tatsächlich:** Die Terminliste baut ihre Angaben selbst, statt `EventVerfuegbarkeit` zu verwenden. Bei „Nur anzeigen" steht neben dem Datum nichts; bei vorhandenem Ticket nur der Knopf „Zum Ticket"
- **Priorität:** im nächsten Durchgang

### Beobachtungen (kein Fehler dieser Umsetzung)
1. **Ein abgesagter Termin lässt die Tickets auf „reserviert" stehen.** Der Kunde sieht in „Meine Tickets" weiter einen QR-Code, ohne Hinweis auf die Absage. Das ist unverändert das Verhalten aus PROJ-14 für Einzelevents — durch Serien wird es nur häufiger sichtbar. Gehört in ein eigenes Projekt.
2. **Eine umbenannte Serie behält ihre Adresse.** Bei Events erzeugt eine Umbenennung eine neue Adresse und merkt sich die alte; bei Serien nicht. Kein Fehler, aber ein Unterschied, der später überraschen kann.
3. **Firefox ist in Playwright nicht eingerichtet**, Tabletbreite ist ungetestet — beides schon vor PROJ-54 so.

### Nachprüfung nach den Fehlerbehebungen (2026-09-15)
BUG-1 und BUG-2 sind behoben, beide mit einem dauerhaften Test abgesichert —
derselbe Ablauf, mit dem sie gefunden wurden, läuft jetzt in jeder Suite mit:

- „Admin: Nachträgliche Ferien sagen einen Termin mit Ticket nicht ab"
- „Admin: Termin absagen und die Absage zurücknehmen" prüft zusätzlich, dass die Übersichtskarte den abgesagten Abend nicht mehr nennt

Nachgelaufen: 26 E2E in zwei Browsern, PROJ-53 und PROJ-14 vollständig,
643 Unit-Tests, `npm run build` — alles grün.

### Zusammenfassung
- **Abnahmekriterien:** 22 von 23 bestanden (offen: der Hinweis auf den richtigen Termin beim Check-in, BUG-3)
- **Fehler:** 5 gefunden, 2 behoben — offen 3, alle niedrig
- **Sicherheit:** bestanden
- **Automatisierte Tests:** 26 E2E in zwei Browsern (Desktop Chrome, iPhone 13), 18 Datenbanktests, 643 Unit-Tests — alle grün
- **Auslieferungsreif:** JA — die verbliebenen drei Fehler sind niedrig und kosten niemanden ein Ticket
- **Empfehlung:** ausliefern; BUG-3, BUG-4 und BUG-5 im nächsten Durchgang
_To be added by /qa_

## Deployment
_To be added by /deploy_
