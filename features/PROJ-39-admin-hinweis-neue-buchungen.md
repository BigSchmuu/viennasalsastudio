# PROJ-39: Admin-Hinweis auf neue Buchungen

## Status: Approved
**Created:** 2026-08-22
**Last Updated:** 2026-08-22

## Dependencies
- Requires: PROJ-8 (Kursbuchung) — erzeugt die offenen Buchungsanfragen, die bearbeitet werden müssen.
- Requires: PROJ-16 (Automatische E-Mail-/Push-Benachrichtigungen) — liefert die Push-Infrastruktur (Geräte-Registrierung, Versand).
- Requires: PROJ-24 (Globale Navigation) / Admin-Navigation — dort erscheint der Zähler.

## User Stories
- Als Betreiber möchte ich beim Öffnen der Verwaltung sofort sehen, ob Buchungen auf mich warten, ohne die Buchungsseite zu öffnen.
- Als Betreiber möchte ich eine Push-Nachricht bekommen, wenn eine neue Buchungsanfrage eingeht, damit ich zeitnah reagieren kann, auch wenn die App nicht offen ist.
- Als Betreiber möchte ich, dass der Zähler verschwindet, sobald ich alle Anfragen bearbeitet habe — ohne dass ich etwas extra wegklicken muss.
- Als Kunde profitiere ich indirekt: Meine Anfrage bleibt nicht tagelang unbemerkt liegen.

## Out of Scope
- **Benachrichtigung für Lehrer.** Nur Admins bearbeiten Buchungen.
- **E-Mail an den Admin** zusätzlich zur Push-Nachricht — vorerst nur Push (siehe Decision Log).
- **Zähler für andere Bereiche** (z.B. offene Probestunden-Follow-ups, Wartelisten, Rücklastschriften). Bewusst nur Buchungen; weitere Zähler wären ein eigenes Thema.
- **Zusammenfassungs-Nachricht** ("3 neue Buchungen heute") — jede Buchung meldet sich einzeln.
- **Konfigurierbare Ruhezeiten** (keine Push nachts).

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Zähler in der Navigation
- [ ] Angenommen es gibt offene Buchungsanfragen, wenn ein Admin die Verwaltung öffnet, dann zeigt der Menüpunkt "Buchungen" einen roten Kreis mit deren Anzahl.
- [ ] Angenommen es gibt keine offenen Anfragen, wenn ein Admin die Verwaltung öffnet, dann wird **kein** Kreis angezeigt (keine "0").
- [ ] Angenommen der Admin bestätigt oder lehnt die letzte offene Anfrage ab, wenn die Seite anschließend neu geladen wird, dann ist der Zähler verschwunden — ohne dass er etwas wegklicken muss.
- [ ] Angenommen eine Buchung ist bereits bestätigt, abgelehnt oder storniert, wenn der Zähler berechnet wird, dann zählt sie **nicht** mit.
- [ ] Angenommen eine Probestunde wurde gebucht (wird automatisch bestätigt), wenn der Zähler berechnet wird, dann zählt sie **nicht** mit — sie erfordert keine Handlung.
- [ ] Angenommen ein Kunde oder Lehrer ist eingeloggt, dann sieht er diesen Zähler nirgends.

### Push bei neuer Buchung
- [ ] Angenommen ein Admin hat Push auf einem Gerät aktiviert, wenn ein Kunde eine Buchungsanfrage abschickt, dann erhält der Admin eine Push-Nachricht mit Kundenname und Kursname.
- [ ] Angenommen der Admin tippt die Push-Nachricht an, dann landet er direkt auf der Buchungsseite.
- [ ] Angenommen ein Kunde bucht eine Probestunde (automatisch bestätigt), dann wird **keine** Push-Nachricht ausgelöst.
- [ ] Angenommen der Admin hat auf keinem Gerät Push aktiviert, wenn eine Buchung eingeht, dann passiert nichts weiter — die Buchung selbst funktioniert unverändert und der Zähler zeigt sie trotzdem an.
- [ ] Angenommen der Push-Versand schlägt fehl, wenn ein Kunde bucht, dann wird die Buchung **trotzdem** normal gespeichert (die Benachrichtigung darf den Kunden nie blockieren).
- [ ] Angenommen es gibt mehrere Admins, wenn eine Buchung eingeht, dann werden alle mit aktiviertem Push benachrichtigt.

## Edge Cases
- Was passiert, wenn zwei Admins dieselbe Anfrage gleichzeitig bearbeiten? → Unverändertes bestehendes Verhalten: Der zweite bekommt "Buchung nicht gefunden oder nicht mehr offen"; der Zähler korrigiert sich beim nächsten Laden.
- Wie aktuell ist der Zähler? → Er wird beim Seitenaufruf berechnet, nicht live nachgeführt. Eine Buchung, die eintrifft während der Admin die Seite offen hat, erscheint erst beim nächsten Laden — dafür gibt es die Push-Nachricht.
- Was passiert bei sehr vielen offenen Anfragen? → Ab 99 wird "99+" angezeigt, damit der Kreis das Menü nicht sprengt.
- Was passiert, wenn ein Kunde bucht und sofort wieder storniert? → Push wurde bereits verschickt (nicht rückholbar), der Zähler zeigt die Buchung aber korrekt nicht mehr an.
- Zählt eine Drop-in-Anfrage mit? → Ja, sie muss vom Admin bestätigt oder abgelehnt werden.
- Was passiert, wenn der Admin dasselbe Gerät für Kunden- und Admin-Push nutzt? → Push hängt am Benutzerkonto, nicht am Gerät; ein Admin-Konto erhält nur Admin-Nachrichten.

## Technical Requirements (optional)
- Security: Der Zähler und die Push-Nachricht dürfen keine Daten preisgeben, die der Empfänger nicht ohnehin sehen darf — beides ausschließlich für Admins.
- Der Push-Versand darf den Buchungsvorgang des Kunden **nicht** verlangsamen oder zum Scheitern bringen (siehe Erfahrung aus PROJ-12: der synchrone E-Mail-Versand beim Ablehnen verzögert die Aktion spürbar).

## Open Questions
- [x] Muss der Admin Push separat aktivieren? → Ja, einmalig pro Gerät über den bereits vorhandenen Schalter unter „Mein Profil → Benachrichtigungen". Es wird kein neuer Mechanismus gebaut (2026-08-22)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Roter Zähler **und** Push | Der Zähler ist der verlässliche Dauerzustand (eine verpasste Push-Nachricht bleibt sonst unsichtbar), Push liefert die Sofort-Information | 2026-08-22 |
| Zähler = Anzahl offener Anfragen, nicht "seit letztem Besuch neu" | Braucht keinen "gelesen"-Zustand und beantwortet die eigentliche Frage: *Wie viel Arbeit wartet auf mich?* Er löst sich automatisch auf, wenn alles bearbeitet ist | 2026-08-22 |
| Probestunden lösen weder Zähler noch Push aus | Sie werden automatisch bestätigt und erfordern keine Handlung — sonst entstünde Alarm ohne Aufgabe | 2026-08-22 |
| Vorerst kein zusätzliches E-Mail an den Admin | Push plus Zähler decken den Bedarf; E-Mails würden das eigene Postfach zusätzlich fluten | 2026-08-22 |
| Keine Zusammenfassung, jede Buchung meldet sich einzeln | Bei der aktuellen Buchungsmenge überschaubar; eine Sammelmeldung würde die Reaktionszeit unnötig verzögern | 2026-08-22 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Zähler wird beim Laden der Verwaltungsseite serverseitig ermittelt, nicht laufend im Hintergrund aktualisiert | Der Server baut die Seite ohnehin auf; eine Dauerverbindung nur für eine Zahl wäre unverhältnismäßig. Die Sofort-Information übernimmt die Push-Nachricht | 2026-08-22 |
| "Offen" wird nicht extra markiert, sondern aus dem vorhandenen Buchungsstatus abgeleitet | Es braucht keine neue Spalte und keinen "gelesen"-Zustand — der Zähler kann gar nicht falsch stehen, weil er direkt aus der Arbeit selbst folgt | 2026-08-22 |
| Probestunden fallen ohne Sonderregel heraus | Sie werden bei der Buchung automatisch bestätigt und haben deshalb nie den Status "offen" — es ist keine zusätzliche Ausnahme nötig | 2026-08-22 |
| Neuer Benachrichtigungs-Anlass, der **nicht** in den Kunden-Einstellungen auftaucht | Sonst stünde "Neue Buchung" bei jedem Kunden im Profil, obwohl es ihn nichts angeht. Es gibt dafür bereits ein Vorbild: die SEPA-Ankündigung läuft ebenfalls außerhalb der Kunden-Einstellungen | 2026-08-22 |
| Text dieser Meldung ist **nicht** über PROJ-34 anpassbar | PROJ-34 verwaltet Texte, die an Kunden gehen. Eine interne Arbeitsmeldung dort einzureihen würde die Übersicht verwässern | 2026-08-22 |
| Push-Versand erfolgt entkoppelt vom Buchungsvorgang | Beim Ablehnen einer Buchung (PROJ-12) verzögert der synchrone Mailversand die Aktion spürbar. Dieser Fehler wird hier bewusst nicht wiederholt: Der Kunde darf nie warten, weil der Betreiber benachrichtigt wird | 2026-08-22 |
| Push-Aktivierung über den bestehenden Schalter im Profil, kein eigener Admin-Weg | Der Mechanismus existiert bereits vollständig (Geräte-Registrierung, Berechtigung, Abmelden). Ein zweiter Weg wäre doppelte Wartung | 2026-08-22 |

---

## Tech Design (Solution Architect)

### A) Component Structure (Visual Tree)

```
Verwaltung (bestehendes Layout um alle /admin-Seiten)
└── Admin-Navigation (bestehend)
    └── Menüpunkt "Buchungen"
        └── NEU: roter Zähler — nur sichtbar, wenn > 0

Mein Profil → Benachrichtigungen (bestehend, unverändert)
└── Schalter "Push-Benachrichtigungen aktivieren"
    └── denselben Schalter nutzt der Admin für seine Geräte

Kunde bucht (bestehender Ablauf, unverändert für den Kunden)
└── NEU im Hintergrund: Meldung an alle Admins mit aktivem Push
```

### B) Data Model (plain language)

**Es wird nichts Neues gespeichert.** Das ist die wichtigste Eigenschaft dieses Entwurfs.

```
Der Zähler ist keine gespeicherte Zahl, sondern eine Frage an die Datenbank:
"Wie viele Buchungen stehen gerade auf 'offen'?"

Offen  = wartet auf deine Entscheidung (Buchungsanfrage oder Drop-in)
Nicht offen = bestätigt, abgelehnt oder storniert — und damit erledigt
Probestunden = werden sofort automatisch bestätigt, sind also nie offen

Folge: Der Zähler kann nicht "falsch stehen" oder hängenbleiben. Er sinkt
in dem Moment, in dem du eine Anfrage bearbeitest, weil er direkt aus der
Arbeit selbst abgeleitet ist — und nicht aus einem separaten
"gelesen"-Vermerk, den jemand pflegen müsste.
```

**Für die Push-Nachricht** wird ein neuer Anlass in der bestehenden Benachrichtigungs-Warteschlange
ergänzt („neue Buchung"). Diese Warteschlange, die Geräte-Registrierung und der Versand existieren
bereits seit PROJ-16 — es kommt nur ein weiterer Auslöser hinzu, keine neue Infrastruktur.

### C) Tech Decisions (justified for PM)

- **Kein „gelesen"-Status.** Die naheliegende Lösung wäre, neue Buchungen als „ungelesen" zu
  markieren und beim Ansehen zurückzusetzen. Das haben wir bewusst verworfen: Es bräuchte eine
  zusätzliche Spalte, jemand müsste sie pflegen, und sie kann mit der Realität auseinanderlaufen
  (Zähler zeigt 3, aber alles ist längst bearbeitet). Die Frage *„wie viel Arbeit wartet auf mich?"*
  beantwortet der offene Buchungsstatus ohnehin exakt — und er räumt sich selbst auf.

- **Der Zähler wird beim Seitenaufruf berechnet.** Er ist damit nicht sekundengenau live. Das ist
  Absicht: Für „gerade eben ist etwas reingekommen" gibt es die Push-Nachricht; eine dauerhafte
  Live-Verbindung nur für eine Zahl wäre unverhältnismäßig.

- **Die Push-Meldung taucht nicht in den Kunden-Einstellungen auf.** Würde sie als normale
  Benachrichtigungsart geführt, stünde „Neue Buchung" bei jedem Kunden im Profil — verwirrend und
  sinnlos. Für genau solche Fälle gibt es bereits ein Vorbild im System: die SEPA-Ankündigung läuft
  ebenfalls an den Kunden-Einstellungen vorbei.

- **Die Benachrichtigung darf den Kunden nicht ausbremsen.** Beim Ablehnen einer Buchung wartet die
  App heute, bis die E-Mail an den Kunden verschickt ist — das verzögert die Aktion spürbar
  (aufgefallen bei der Test-Aufräumarbeit an PROJ-12). Diesen Fehler machen wir hier nicht: Die
  Meldung an dich wird eingereiht und im Hintergrund zugestellt. Selbst wenn der Versand komplett
  scheitert, wird die Buchung des Kunden normal gespeichert.

- **Push-Aktivierung nutzt den vorhandenen Weg.** Du aktivierst Push einmalig pro Gerät unter
  „Mein Profil → Benachrichtigungen" — derselbe Schalter, den auch Kunden verwenden. Es wird kein
  zweiter Mechanismus gebaut. Wichtig zu wissen: Die Berechtigung hängt am **Gerät**. Willst du die
  Meldungen auf Handy *und* Laptop, musst du sie auf beiden einmal aktivieren.

- **Sichtbarkeit:** Zähler und Meldung sind ausschließlich für Admins. Kunden und Lehrer sehen
  weder den Zähler noch erhalten sie die Push-Nachricht.

### D) Dependencies (packages to install)

Keine. Das Feature nutzt ausschließlich Vorhandenes: die Admin-Navigation, den Buchungsstatus und
die Benachrichtigungs-Infrastruktur aus PROJ-16.

---

## Implementation Notes (Backend)

**Umgesetzt am 2026-08-22.** Keine neue Tabelle, keine neue Spalte — wie im Entwurf vorgesehen.

### Geänderte/neue Dateien
| Datei | Zweck |
|-------|-------|
| `src/app/admin/layout.tsx` | Zählt beim Seitenaufbau die offenen Buchungen und reicht die Zahl an die Navigation weiter |
| `src/components/admin/admin-nav.tsx` | Roter Kreis am Menüpunkt „Buchungen", nur bei > 0, Deckel bei „99+" |
| `src/lib/notifications/admin-alerts.ts` (neu) | Ermittelt die Admins mit registriertem Gerät und stellt ihnen die Meldung zu |
| `src/lib/notifications/templates.ts` | Neuer Meldungstext `neue_buchung` (Kundenname + Kursname) |
| `src/lib/notifications/dispatch.ts` | Zustellweg für `neue_buchung` — nur Push, ohne E-Mail |
| `src/lib/actions/booking.ts` | Löst die Meldung aus, **nachdem** die Antwort an den Kunden raus ist |
| `supabase/migrations/20260822181924_proj39_neue_buchung_event_type.sql` | Erlaubt den neuen Anlass in der Warteschlange |

### Abweichungen und bewusste Entscheidungen
- **Nur Admins mit registriertem Gerät bekommen einen Warteschlangen-Eintrag.** Ohne diesen Filter
  hätte jede Buchung 12 unzustellbare Einträge erzeugt (so viele Admin-Konten gibt es inkl.
  Testkonten), die niemand je zugestellt bekommen hätte.
- **Zustellung sofort statt über den Zeitplan.** Die geplante Verarbeitung läuft nur um 06:00 und
  18:00 Uhr — eine Buchung um 09:00 hätte sich also erst neun Stunden später gemeldet. Die Meldung
  wird deshalb direkt nach dem Einreihen zugestellt, wie es die SEPA-Ankündigung ebenfalls tut.
- **Auslöser hängt am Status, nicht an der Buchungsart.** Es wird nur gemeldet, was auf „offen"
  steht. Probestunden werden automatisch bestätigt und fallen dadurch von selbst heraus — genau wie
  im Entwurf beschrieben, ohne eigene Sonderregel.

### Aufgetretenes Problem
Der erste Live-Test erzeugte **keine** Meldung, ohne sichtbaren Fehler für den Kunden (korrektes
Verhalten — die Buchung darf nie scheitern, nur weil die Meldung scheitert). Ursache: Die Datenbank
führt eine feste Liste erlaubter Benachrichtigungs-Anlässe, in der `neue_buchung` noch fehlte. Nach
Ergänzen der Liste lief der Test durch.

### Verifiziert (manuell, gegen die Produktionsdatenbank)
- Zähler zeigt **7** — deckungsgleich mit 6 offenen Anfragen + 1 offenem Drop-in; ein Kundenkonto
  sieht ihn **nirgends**.
- Echte Drop-in-Buchung → Push kam auf dem Gerät des Betreibers tatsächlich an
  (Status `sent`); ein zweites Admin-Testkonto mit absichtlich ungültigem Gerät scheiterte sauber,
  ohne die Buchung zu beeinträchtigen. E-Mail bei beiden korrekt übersprungen.
- Die 11 Admin-Konten **ohne** Gerät erzeugten erwartungsgemäß keinerlei Einträge.
- Probestunden-Gegentest: Buchung erfolgreich, **keine** Meldung erzeugt.
- Alle Testdaten (Testkonto, Testgerät, Testbuchungen, Warteschlangen-Einträge) wurden nach dem
  Test wieder entfernt.

Automatisierte Tests folgen im QA-Schritt.

## QA Test Results

**Getestet:** 2026-08-22
**Umgebung:** http://localhost:3000 gegen die Produktiv-Datenbank (es gibt keine Staging-DB)
**Tester:** QA Engineer (AI)

### Akzeptanzkriterien

#### Zähler in der Navigation — 6/6 bestanden
- [x] Offene Anfragen erzeugen einen roten Kreis am Menüpunkt „Buchungen" (E2E AC1)
- [x] Keine offenen Anfragen → **kein** Kreis, insbesondere keine „0" (Komponententest; systemweit leerer Zustand ist per E2E nicht prüfbar, siehe Methodik)
- [x] Nach dem Bearbeiten der letzten Anfrage ist der Zähler weg, ohne Wegklicken (E2E AC5)
- [x] Bestätigte, abgelehnte und stornierte Buchungen zählen nicht mit (E2E AC3)
- [x] Probestunden zählen nicht mit (E2E AC4)
- [x] Kunde und Lehrer sehen den Zähler nirgends; `/admin` bleibt für beide gesperrt (E2E AC6, AC7)

#### Push bei neuer Buchung — 5/6 bestanden, 1 nur hergeleitet
- [x] Admin mit aktiviertem Gerät erhält Push mit Kundenname und Kursname — **real auf dem Gerät des Betreibers bestätigt**
- [~] Antippen führt zur Buchungsseite — Ziel-Adresse per Unit-Test abgesichert (`/admin/buchungen`), der Service Worker öffnet sie korrekt. **Nicht auf einem echten Gerät durchgeklickt** — siehe Offener Punkt
- [x] Probestunde löst **keine** Push aus (Gegentest: Buchung erfolgreich, Warteschlange unverändert)
- [x] Admin ohne Gerät → keine Meldung, Buchung funktioniert normal (11 Admin-Konten ohne Gerät erzeugten keine Einträge)
- [x] Fehlgeschlagener Versand blockiert die Buchung nicht (Testkonto mit ungültigem Gerät: Meldung `failed`, Buchung gespeichert)
- [x] Mehrere Admins mit Gerät werden alle benachrichtigt

### Edge Cases
- [x] Sehr viele Anfragen → Deckel bei „99+", exakte Zahl bleibt für Screenreader erhalten (Komponententest)
- [x] Drop-in-Anfrage zählt mit (E2E AC2)
- [x] Zähler ist beim Seitenaufruf berechnet, nicht live — dokumentiert und akzeptiert
- [x] Kunden- und Admin-Push am selben Gerät: Zuordnung hängt am Konto, nicht am Gerät

### Sicherheitsprüfung (Red Team)
- [x] **XSS über den Kundennamen:** Der Kunde bestimmt seinen Namen selbst. Push wird über `showNotification` als reiner Text gerendert, zusätzlich escaped der E-Mail-Pfad. Kein Angriffsweg. Regressionstest ergänzt
- [x] **Rechteausweitung:** Ein Kunde kann sich nicht selbst zum Admin machen und so die Meldungen mitlesen — real getestet, Trigger blockt mit „Only admins can change a user role"
- [x] **Rechtetrennung:** Zähler und Meldung erreichen ausschließlich Admins
- [x] **Datenpreisgabe:** Die Meldung enthält nur Daten, die der Empfänger als Admin ohnehin sieht
- [ ] **Missbrauch durch Massenbuchung:** siehe BUG-1

### Gefundene Fehler

#### BUG-1: Unbegrenzte Drop-in-Buchungen ermöglichen eine Push-Flut
- **Schweregrad:** Medium
- **Reproduktion:**
  1. Als beliebiger eingeloggter Kunde `create_self_service_booking` mit Typ `dropin` mehrfach für denselben Kurs und dasselbe Datum aufrufen
  2. Erwartet: Ab der zweiten identischen Anfrage eine Ablehnung
  3. Tatsächlich: **5 von 5 Versuchen angenommen** — es existiert weder ein Unique-Constraint noch ein Rate-Limit
- **Folge für PROJ-39:** Jede dieser Buchungen steht auf `open` und löst je eine Push-Nachricht an jedes Admin-Gerät aus; zusätzlich bläht sie den Zähler auf
- **Einordnung:** Die Lücke ist **vorbestehend** (fehlende Dublettenprüfung in PROJ-8) und trifft nur Drop-ins — reguläre Anfragen sind durch „already requested" geschützt. PROJ-39 verändert nicht die Lücke, sondern ihre Folge: aus unordentlicher Liste wird Dauerklingeln
- **Status: BEHOBEN am 2026-08-22**

**Lösung — zwei Ebenen, beide in der Datenbank** (`create_self_service_booking`).
Die App-Schicht wäre wirkungslos gewesen: Der gefundene Angriff rief die RPC direkt mit dem
öffentlichen Schlüssel auf und ging an Next.js komplett vorbei — dieselbe Erkenntnis wie beim
Gutschein-Ratenlimit aus PROJ-15.

1. **Dublettensperre:** Gleicher Kunde, gleicher Kurs, gleiches Datum, gleiche Art und noch aktiv
   → abgelehnt. Stornierte und abgelehnte Buchungen zählen bewusst **nicht**, sonst wäre ein Termin
   nach einer Stornierung für immer blockiert.
2. **Stundenlimit:** Höchstens 10 Selbstbuchungen pro Kunde und Stunde. Nötig, weil die
   Dublettensperre allein nichts nützt — ein Angreifer weicht einfach auf andere Termine und Kurse
   aus. Stornierte Buchungen zählen mit, sonst könnte man das Limit durch Stornieren zurücksetzen.

**Verifikation — derselbe Angriff wie im Befund, unverändert wiederholt:**

| Angriff | Vorher | Nachher |
|---------|--------|---------|
| 5× identische Drop-in-Buchung | 5 von 5 angenommen | **1 angenommen, 4 abgelehnt** („already booked") |
| Ausweichen auf 14 verschiedene Termine | alle angenommen | **nach dem Limit abgeriegelt** („booking rate limit") |

**Legitime Nutzung unberührt:** 36 Tests aus PROJ-8, 26, 27 und 30 laufen unverändert grün,
inklusive Umbuchen und wiederholtem Buchen desselben Kurses an anderen Terminen.

**Warum 10 pro Stunde:** Ein Kunde, der seinen Monat plant, bucht realistisch fünf bis acht
Drop-ins am Stück — das Limit greift dort nicht. Für einen Angreifer sinkt die Obergrenze von
„unbegrenzt" auf 10 Meldungen pro Stunde. Der Wert steht an einer Stelle in der Migration und ist
jederzeit anpassbar.

**Nebenbei behoben:** `course_bookings` hatte außer dem Primärschlüssel **keinen einzigen Index**.
Die beiden neuen Prüfungen und die Zähler-Abfrage laufen alle über Kunde bzw. Status, daher zwei
passende Indizes. Bei heute 21 Zeilen ist das nicht messbar, verhindert aber, dass jede Buchung
später die ganze Tabelle durchsucht.

**Regressionstests:** `tests/PROJ-39-booking-abuse-guard.test.ts` — 5 Integrationstests direkt
gegen die Datenbank (nicht über die Oberfläche, weil der Angriff dort ebenfalls nicht entlangläuft).
Abgedeckt: Dublette abgelehnt, anderes Datum weiterhin erlaubt, nach Stornierung wieder buchbar,
Stundenlimit greift, Stornieren setzt das Limit nicht zurück. Eigenes Wegwerf-Konto, damit das
Stundenbudget der geteilten Testkunden unangetastet bleibt und die Reihenfolge der Suiten egal ist.

#### BUG-2: E2E-Testläufe erzeugen echte Push-Nachrichten in der Produktion
- **Schweregrad:** Medium
- **Reproduktion:** `npm run test:e2e` ausführen
- **Gemessen:** Ein voller Chromium-Lauf erzeugte **9 Meldungen, alle mit Status `sent`** an das Gerät des Betreibers, dazu 9 Zeilen in der produktiven Warteschlange
- **Ursache:** Es gibt keine Staging-Datenbank; die Tests buchen über die echte Oberfläche, also durch die echte Buchungsaktion
- **Einordnung:** Direkt durch PROJ-39 entstanden. Kein Nutzerschaden, aber der Testlauf wird für den Betreiber unangenehm und verschmutzt Produktivdaten
- **Status: BEHOBEN am 2026-08-22**

**Lösung:** Buchungen von Testkonten lösen keine Meldung mehr aus. Die Weiche sitzt in
`isTestAccountEmail()` (`admin-alerts.ts`) und erkennt Adressen auf der Top-Level-Domain `.test`,
die per RFC 2606 genau dafür reserviert ist und daher nie mit einer echten Kundenadresse kollidieren
kann. Alle 64 buchenden Testkonten laufen auf `viennasalsastudio.test`.

Bewusst **nicht** über die Umgebung gelöst (etwa „nur in der Produktion senden"): Damit hätte man
die Meldung lokal nie mehr prüfen können — genau diese lokale Prüfung war aber der Beweis, dass das
Feature überhaupt funktioniert.

**Verifikation — beide Richtungen geprüft:**

| Auslöser | Erzeugte offene Buchungen | Meldungen |
|----------|---------------------------|-----------|
| Testkonten (PROJ-8 + PROJ-30, 23 Tests) | 4 | **0** |
| Kunde mit echter Adresse (`@example.com`) | 1 | **1, zugestellt** |

Die Gegenprobe war der wichtigere Teil: Ein zu grober Filter hätte das Feature stillschweigend
komplett abgeschaltet, und das wäre im Betrieb erst aufgefallen, wenn eine echte Buchung
unbemerkt liegen bleibt.

**Verbleibende Lücke:** Würde jemand später einen Buchungstest mit einer *echten* Adresse schreiben,
löst dieser wieder Meldungen aus. Der Filter erkennt Testkonten an der Adresse, nicht am Kontext.
Für die aktuelle Testsuite ist das abgedeckt.

### Automatisierte Tests
- **Unit/Komponente:** 16 neue Tests (`admin-nav.test.tsx`, `admin-alerts.test.ts`, Ergänzungen in `templates.test.ts`) — Gesamtsuite **238/238 grün**
  - `admin-alerts.test.ts` pinnt die Weiche aus BUG-2 fest, inklusive der Fälle, die einen naiven Filter aushebeln würden: Groß-/Kleinschreibung, umgebende Leerzeichen, `test@gmail.com`, `anna@test.com` (beides **echte** Kunden) sowie fehlende Adresse — dort wird bewusst benachrichtigt statt unterdrückt
  - Enthält eine gezielte Regressionsbremse gegen die `{0 && …}`-Falle, die im Geburtsdatumsfeld schon einmal produktiv sichtbar war
- **E2E:** 9 neue Tests in `tests/PROJ-39-admin-hinweis-neue-buchungen.spec.ts` — **9/9 grün auf Chromium**
- **Methodik:** Die E2E-Tests messen bewusst **Differenzen** statt absoluter Zahlen und seeden per Direkt-Insert statt über die Oberfläche. Grund: Es gibt keine Staging-DB, parallele Suiten erzeugen eigene offene Buchungen, und ein Seeding über die Oberfläche würde bei jedem Testlauf echte Pushes auslösen

### Regressionstest — separater Befund, **nicht** von PROJ-39 verursacht
Der vollständige Chromium-Lauf ergab **226 bestanden, 22 fehlgeschlagen, 6 nicht gelaufen**. Die Fehler
verteilen sich auf PROJ-6, 7, 9, 10, 14, 23 und 25 — überwiegend Admin-Seiten, also genau der Bereich,
dessen Layout PROJ-39 anfasst. Dieser Verdacht wurde überprüft statt weggeredet:

| Lauf | PROJ-6 | Die anderen 6 Dateien |
|------|--------|----------------------|
| Mit PROJ-39 | 5 Fehler | 17 Fehler |
| **Auf dem Stand vor PROJ-39** (`0caa1da^`) | **5 Fehler, dieselben** | **22 Fehler** |

Ohne PROJ-39 sind es also eher **mehr** Fehler. Alle 22 sind vorbestehend. Inhaltlich laufen sie
darauf hinaus, dass Tests auf Bedienelemente warten, die nicht erscheinen (z.B. „Termin anlegen",
„Termin speichern"). Ob dahinter echte Defekte oder veraltete Tests stecken, ist **offen und gehört
in eine eigene Test-Hygiene-Runde** — es blockiert PROJ-39 nicht.

Aufgefallen ist das erst jetzt, weil die letzten Durchgänge gezielt einzelne Dateien geprüft haben
statt der vollständigen Suite.

### Nicht abgedeckt
- **Mobile Safari / WebKit:** Der Browser war zum Testzeitpunkt noch nicht installiert (Download lief).
  Der Zähler ist reines CSS ohne browser-spezifische Eigenschaften, das Risiko ist gering — geprüft
  ist es dennoch nicht. Die Darstellung bei 375px wurde auf Chromium verifiziert (kein horizontales
  Scrollen der Seite)
- **Antippen der Push auf einem echten Gerät** (siehe oben)

### Aufräumen
Alle Testspuren entfernt: Testkonto samt Gerät, sämtliche Fixture-Buchungen und alle
`neue_buchung`-Einträge (Warteschlange auf 0 geprüft). Die 7 offenen Buchungen entsprechen exakt
dem Stand vor dem Lauf.

### Zusammenfassung
- **Akzeptanzkriterien:** 11/12 vollständig bestanden, 1 nur hergeleitet (Antippen)
- **Fehler:** 2 gefunden (0 kritisch, 0 hoch, **2 mittel**, 0 niedrig) — **beide behoben und verifiziert**
- **Sicherheit:** Bestanden. Der Missbrauchsweg aus BUG-1 ist geschlossen und durch Regressionstests abgesichert
- **Produktionsreif:** **JA**
- **Empfehlung:** Deployment möglich. Die 22 vorbestehenden Testfehler in PROJ-6, 7, 9, 10, 14, 23
  und 25 sind ein eigenes Thema und sollten nicht mit diesem Feature vermischt werden

## Deployment
_To be added by /deploy_
