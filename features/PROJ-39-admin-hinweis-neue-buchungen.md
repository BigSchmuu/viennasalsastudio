# PROJ-39: Admin-Hinweis auf neue Buchungen

## Status: In Progress
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
_To be added by /qa_

## Deployment
_To be added by /deploy_
