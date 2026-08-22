# PROJ-39: Admin-Hinweis auf neue Buchungen

## Status: Planned
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
- [ ] Muss der Admin Push separat aktivieren, oder soll das für Admin-Konten automatisch geschehen? → In `/architecture` klären; die Browser-Berechtigung muss in jedem Fall aktiv erteilt werden.

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

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
