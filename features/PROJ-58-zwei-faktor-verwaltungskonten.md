# PROJ-58: Zwei-Faktor-Anmeldung für Verwaltungskonten

## Status: Planned
**Created:** 2026-09-16
**Last Updated:** 2026-09-16

## Dependencies
- Requires: PROJ-2 (Auth & Kundenprofil) — Anmeldung, Sitzung, Profilseite
- Requires: PROJ-4 (Admin: Kunden-/Mitgliederverwaltung) — dort wird eine zweite Stufe zurückgesetzt
- Requires: PROJ-16 (Benachrichtigungen) — E-Mail an den Betroffenen beim Zurücksetzen
  *Hinweis für /architecture: `notification_queue.event_type` hat eine CHECK-Liste. Eine neue
  Benachrichtigungsart ohne Migration wird lautlos verworfen — siehe PROJ-16.*
- Requires: PROJ-22 (Admin: Lehrer-Rollen verwalten) — die Rolle `admin` ist dort definiert und änderbar

## Anlass
Aus dem Datenschutz-Durchgang vom 2026-09-16: Die App speichert IBAN und Kontoinhaber im Klartext,
weil der Lastschrifteinzug sie braucht. Jede Tabelle ist per Row Level Security abgesichert (51 von
51 geprüft), und ein Trigger verhindert, dass sich jemand selbst zum Admin macht. Damit bleibt eine
einzige wirklich große Angriffsfläche: **Ein Admin-Passwort öffnet alle Bankdaten aller Kunden.**
Dieses Projekt schließt genau diese Lücke — und nur sie.

## User Stories
- Als Betreiber möchte ich, dass ein gestohlenes Admin-Passwort allein niemandem Zugang zu Kundendaten und IBANs verschafft, damit ein Phishing-Versuch oder ein Passwort-Leak nicht das ganze Studio trifft.
- Als Admin möchte ich die zweite Stufe einmal einrichten und danach im Alltag kaum davon aufgehalten werden, damit Sicherheit nicht zur täglichen Last wird.
- Als Admin, der sein Handy verloren hat, möchte ich wieder hineinkommen, ohne dass jemand die Datenbank anfassen muss.
- Als Betreiber möchte ich auf einen Blick sehen, welche Verwaltungskonten abgesichert sind, damit ich nicht raten muss.
- Als Betreiber möchte ich erfahren, wenn die zweite Stufe eines Kontos zurückgesetzt wurde, damit ein Missbrauch auffällt statt unbemerkt zu bleiben.
- Als Admin an einem fremden Rechner möchte ich, dass dieses Gerät sich nichts merkt, damit der Schutz nicht dort verloren geht, wo ich ihn am meisten brauche.

## Out of Scope
- **Lehrer- und Kundenkonten** — Lehrer sehen Namen, Geburtsdaten, Anwesenheiten und Gästelisten, aber keine Bankdaten oder Rechnungen; ein gekapertes Lehrer-Konto kann sich nicht selbst befördern. Kann später nachgezogen werden.
- **Wiederherstellungscodes zum Ausdrucken** — bewusst verworfen zugunsten des Zurücksetzens durch einen anderen Admin
- **SMS und E-Mail als zweiter Faktor** — bewusst verworfen, Begründung im Decision Log
- **Passkeys, WebAuthn, Hardware-Schlüssel** — eigenes Thema, deutlich größerer Umfang
- **Protokoll darüber, wer welche Kundendaten angesehen hat** — kam im selben Gespräch auf, ist ein eigenes Projekt
- **Selbstbedienung für DSGVO-Auskunft und -Löschung** — kam im selben Gespräch auf, eigenes Projekt
- **Passwortregeln, erzwungener Passwortwechsel, Sitzungsübersicht** — nicht Teil dieser Lücke
- **Zwei-Faktor für das Supabase-Dashboard selbst** — Betreiberaufgabe im Dashboard, kein Code; siehe Open Questions
- **Verschlüsselung der IBAN-Spalte** — ein eigenes, deutlich größeres Vorhaben

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Einrichtung
- [ ] Angenommen ein Admin hat noch keine Authenticator-App hinterlegt, wenn seine Anmeldung mit E-Mail und Passwort gelingt, dann sieht er ausschließlich die Einrichtungsseite und erreicht keine andere Seite der App
- [ ] Angenommen ein Admin ist auf der Einrichtungsseite, wenn sie erscheint, dann sieht er einen QR-Code **und** denselben Schlüssel als Text zum Abtippen, falls die Kamera nicht mitspielt
- [ ] Angenommen ein Admin hat den QR-Code gescannt, wenn er einen gültigen Code aus der App eingibt, dann ist die zweite Stufe aktiv und er wird in die Verwaltung gelassen
- [ ] Angenommen ein Admin gibt bei der Einrichtung einen falschen Code ein, wenn er absendet, dann erscheint eine Fehlermeldung und derselbe QR-Code bleibt gültig — die Einrichtung beginnt nicht von vorn
- [ ] Angenommen die Einrichtung ist abgeschlossen, wenn der Admin die Seite erneut aufruft, dann wird der geheime Schlüssel nie wieder angezeigt
- [ ] Angenommen ein Konto mit der Rolle Kunde oder Lehrer meldet sich an, wenn die Anmeldung gelingt, dann ändert sich für dieses Konto nichts
- [ ] Angenommen ein bestehendes Konto wird zum Admin gemacht, wenn dieses sich das nächste Mal anmeldet, dann wird es zur Einrichtung geführt

### Anmeldung
- [ ] Angenommen ein Admin mit eingerichteter App meldet sich an, wenn E-Mail und Passwort stimmen, dann wird der sechsstellige Code verlangt, bevor irgendeine Seite geöffnet wird
- [ ] Angenommen ein Admin gibt einen falschen Code ein, wenn er absendet, dann erscheint eine Fehlermeldung, die nicht verrät, ob Passwort oder Code das Problem war
- [ ] Angenommen ein Admin gibt mehrfach hintereinander falsche Codes ein, wenn er es weiter versucht, dann wird er vorübergehend ausgebremst
- [ ] Angenommen das 30-Sekunden-Fenster ist gerade gewechselt, wenn der abgelesene Code abgesendet wird, dann wird er abgelehnt und ein frisch abgelesener Code funktioniert
- [ ] Angenommen ein Admin bricht bei der Code-Eingabe ab und schließt den Browser, wenn er danach die Verwaltungsadresse direkt aufruft, dann kommt er nicht hinein
- [ ] Angenommen ein Admin ist vollständig angemeldet, wenn er sich abmeldet, dann verlangt die nächste Anmeldung wieder einen Code — sofern das Gerät nicht gemerkt ist

### Gemerktes Gerät
- [ ] Angenommen ein Admin gibt den Code ein, wenn er das Häkchen „Diesem Gerät 30 Tage vertrauen" setzt, dann fragt genau dieser Browser 30 Tage lang nicht erneut nach einem Code
- [ ] Angenommen das Häkchen ist nicht gesetzt — das ist die Voreinstellung —, wenn der Admin sich am selben Gerät neu anmeldet, dann wird der Code wieder verlangt
- [ ] Angenommen ein Gerät ist gemerkt, wenn seit der Bestätigung 30 Tage vergangen sind, dann wird der Code wieder verlangt
- [ ] Angenommen ein Admin hat Geräte gemerkt, wenn er in seinem Profil „Alle Geräte vergessen" wählt, dann verlangt jedes dieser Geräte bei der nächsten Anmeldung wieder einen Code
- [ ] Angenommen die zweite Stufe eines Admins wird zurückgesetzt oder sein Passwort geändert, dann sind alle gemerkten Geräte dieses Kontos vergessen
- [ ] Angenommen jemand kopiert das Merkmal eines gemerkten Geräts, wenn er das Passwort nicht kennt, dann kommt er trotzdem nicht hinein — das Merken ersetzt nur den zweiten Schritt, nie den ersten
- [ ] Angenommen ein Gerät ist für ein Konto gemerkt, wenn sich am selben Gerät ein **anderer** Admin anmeldet, dann wird von diesem ein Code verlangt

### Zurücksetzen durch einen anderen Admin
- [ ] Angenommen ein Admin öffnet die Kundenverwaltung, wenn er ein Verwaltungskonto ansieht, dann erkennt er, ob dessen zweite Stufe eingerichtet ist
- [ ] Angenommen ein Admin setzt die zweite Stufe eines anderen Admins zurück, wenn er die Rückfrage bestätigt, dann muss dieser bei der nächsten Anmeldung neu einrichten
- [ ] Angenommen eine zweite Stufe wurde zurückgesetzt, wenn der Vorgang abgeschlossen ist, dann erhält der Betroffene darüber eine E-Mail
- [ ] Angenommen ein Admin versucht, seine eigene zweite Stufe zu entfernen oder zurückzusetzen, wenn er es versucht, dann ist das nicht möglich
- [ ] Angenommen es gibt nur ein einziges Admin-Konto, wenn ein Admin die Verwaltung öffnet, dann weist ein Hinweis darauf hin, dass niemand ihn im Notfall zurücksetzen könnte
- [ ] Angenommen ein Lehrer- oder Kundenkonto wird angesehen, wenn es keine zweite Stufe hat, dann gibt es dort auch nichts zurückzusetzen

### Erste Inbetriebnahme
- [ ] Angenommen die Funktion geht in Betrieb und noch kein Admin hat eine App eingerichtet, wenn sich der erste Admin anmeldet, dann kann er die Einrichtung vollständig allein abschließen — ohne dass jemand anderes etwas tun muss

## Edge Cases
- **Alle Admins gleichzeitig ausgesperrt** (z. B. beide Handys weg): Der dokumentierte Notausgang ist das Supabase-Dashboard, wo der Betreiber den hinterlegten Faktor direkt löscht. Kein Code nötig, aber im Spec festgehalten, damit im Ernstfall niemand raten muss.
- **Nur ein Admin-Konto vorhanden:** Niemand kann zurücksetzen. Die App weist darauf hin (siehe Kriterium); der Notausgang bleibt das Dashboard.
- **Falsch gehende Handy-Uhr:** Codes werden dann verlässlich abgelehnt, ohne erkennbaren Grund. Die Code-Seite nennt das als möglichen Grund, sonst sucht der Betroffene an der falschen Stelle.
- **Abbruch mitten in der Einrichtung** (Netzwerkfehler, Browser zu): Das Konto darf nicht halb abgesichert zurückbleiben — entweder die zweite Stufe ist bestätigt und aktiv, oder es ist so, als wäre nichts geschehen.
- **QR-Code abfotografiert, aber nie bestätigt:** Ohne einen bestätigten Code aus der App wird die zweite Stufe nicht aktiv.
- **Admin wird zum Kunden herabgestuft**, während seine zweite Stufe aktiv ist: Sie bleibt bestehen und stört nicht — sie schützt ihn weiterhin.
- **Zwei Tabs gleichzeitig:** Wird in einem Tab zurückgesetzt, während der andere noch offen ist, darf der offene Tab nicht weiter in der Verwaltung arbeiten können.
- **Privates Fenster oder gelöschte Cookies:** Das Gerät gilt dann als unbekannt und der Code wird verlangt. Das ist richtig so und kein Fehler.
- **Ein Admin nutzt Handy und Rechner:** Beide Geräte lassen sich unabhängig voneinander merken.

## Technical Requirements
- Sicherheit: Fehlermeldungen verraten nie, ob eine E-Mail-Adresse existiert oder welcher der beiden Schritte gescheitert ist
- Sicherheit: Code-Versuche sind begrenzt; wiederholtes Raten wird ausgebremst
- Sicherheit: Das Merkmal eines gemerkten Geräts ist an genau ein Konto gebunden, für den Browser unlesbar und nicht erratbar
- Sicherheit: Der geheime Schlüssel wird nach Abschluss der Einrichtung nie wieder ausgegeben
- Bedienung: Das Code-Feld nimmt sechs Ziffern entgegen und erlaubt das automatische Einsetzen aus der Zwischenablage bzw. vom Betriebssystem
- Sprache: Alles Deutsch — die Verwaltung ist einsprachig, der Kundenbereich bleibt unberührt
- Browser: Chrome, Firefox, Safari; Mobil (375 px) muss funktionieren, weil die Einrichtung typischerweise am Handy passiert

## Open Questions
- [ ] Wie viele Admin-Konten gibt es derzeit? Für die Rücksetz-Regel entscheidend — der Betreiber prüft das in der Kundenverwaltung (aus der Konversation nicht abfragbar, siehe CLAUDE.md)
- [ ] Soll die 30-Tage-Frist später einstellbar sein? Vorschlag: vorerst fest
- [ ] Zwei-Faktor für das Supabase-Dashboard selbst aktivieren — das ist der eigentliche Notausgang und sollte vor dem Deploy abgesichert sein (Betreiberaufgabe)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Pflicht statt freiwilligem Angebot | Ein einziges ungeschütztes Admin-Passwort hebt den Schutz für alle anderen auf | 2026-09-16 |
| Nur Admin-Konten, keine Lehrer | Nur Admins erreichen IBANs, Rechnungen und alle Kundenprofile; ein gekapertes Lehrer-Konto kann sich nicht selbst befördern (Datenbank-Trigger) | 2026-09-16 |
| Authenticator-App statt E-Mail-Code | Der E-Mail-Faktor teilt sich den Kanal mit dem Passwort-Reset — wer das Postfach hat, hätte beide Stufen | 2026-09-16 |
| Authenticator-App statt SMS | SIM-Übernahme ist ein reales Angriffsmuster, dazu laufende Kosten und ein weiterer Anbieter | 2026-09-16 |
| Zurücksetzen durch einen anderen Admin statt Wiederherstellungscodes | Kein zweites Geheimnis, das aufbewahrt werden muss; Codes landen erfahrungsgemäß als Screenshot im selben Handy, das verloren geht | 2026-09-16 |
| Gerät für 30 Tage merkbar | Entscheidung des Betreibers zugunsten des Alltags. Die Empfehlung lautete „bei jeder Anmeldung", weil ein gemerktes Gerät ein Ausweis ist, der gestohlen werden kann | 2026-09-16 |
| Häkchen zum Merken standardmäßig aus | Der Rechner im Studio oder bei einem Dritten soll sich nichts merken, ohne dass jemand es bewusst entscheidet | 2026-09-16 |
| Vor der Einrichtung gar kein Zugang, auch nicht zum eigenen Kundenbereich | Entscheidung des Betreibers. Folge: Wer Admin wird, braucht ab diesem Tag den Authenticator auch für seine eigenen Rechnungen und Tickets | 2026-09-16 |
| Selbst-Zurücksetzen ist ausgeschlossen | Sonst ließe sich die Pflicht mit einem Klick abschalten und der Schutz wäre wertlos | 2026-09-16 |
| E-Mail an den Betroffenen beim Zurücksetzen | Ein Zurücksetzen ist der einzige Weg, die zweite Stufe loszuwerden — es darf nicht unbemerkt geschehen | 2026-09-16 |

### Technical Decisions
_To be added by /architecture_

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
