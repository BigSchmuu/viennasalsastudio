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
- [x] Verliert eine laufende Sitzung sofort ihre bestätigte zweite Stufe, wenn der Faktor entfernt wird? → Nein, und die Bibliothek kann fremde Sitzungen gar nicht beenden (sie verlangt dafür deren Anmeldetoken). Gelöst mit `admin_sitzungen_beenden` — einer Datenbankfunktion, die die Sitzungszeilen löscht, was ein Abmelden ohnehin tut (2026-09-16)
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
| Decision | Rationale | Date |
|----------|-----------|------|
| Die Zwei-Faktor-Funktion von Supabase nutzen statt etwas Eigenes zu bauen | Wir speichern dann kein einziges neues Geheimnis: Der Schlüssel liegt in Supabases eigenem, geschütztem Bereich, nicht in unseren Tabellen. Eigenbau hieße, den Schlüssel selbst aufzubewahren und die Codeprüfung selbst zu schreiben — genau die zwei Dinge, bei denen ein Fehler alles wertlos macht | 2026-09-16 |
| Kein neues Paket | Supabase liefert den QR-Code bei der Einrichtung als fertiges Bild mit. Eine QR-Bibliothek wäre überflüssig | 2026-09-16 |
| „Gerät merken" über die Lebensdauer der Anmeldung, nicht über einen eigenen Geräteausweis | Ein eigener Ausweis wäre ein zweites Geheimnis, das kopiert werden kann — und die Datenbank könnte ihn nicht prüfen, womit die wichtigste Schutzschicht ins Leere liefe. Über die Anmeldung bleibt die bestätigte zweite Stufe Teil der Sitzung und gilt damit überall | 2026-09-16 |
| Die Rollenauskunft der Datenbank verlangt die bestätigte zweite Stufe | Ein einziger Ort, an dem rund 50 bestehende Sicherheitsregeln die Prüfung erben. Jede Regel einzeln zu ändern hieße, an fünfzig Stellen nichts vergessen zu dürfen | 2026-09-16 |
| Torwächter in der bestehenden Zugangsprüfung, nicht in der Middleware | Die Middleware läuft bei jedem einzelnen Seiten- und Bildaufruf, kennt die Rolle aber nicht — sie müsste jedes Mal die Datenbank fragen. Das wäre auf jeder Seite spürbar, für einen Schutz, der an der richtigen Stelle nichts kostet | 2026-09-16 |
| Handgriffe mit dem Generalschlüssel prüfen zusätzlich selbst | Der Generalschlüssel umgeht die Datenbankregeln absichtlich (Einladungen, Benachrichtigungen, offene Posten). Dort greift die Datenbanksperre nicht, also muss der Handgriff selbst nachsehen | 2026-09-16 |
| „Gerät merken" über die Lebensdauer des **Merkers**, nicht der Anmeldecookies | Beim Bauen stellte sich heraus: `@supabase/ssr` überschreibt jede selbst gesetzte Cookie-Dauer mit ihrer eigenen Vorgabe von 400 Tagen, und zwar in drei verschiedenen Schreibern. Daran zu drehen hieße, die Anmeldung aller Kunden anzufassen — hohes Risiko für eine Bequemlichkeitsfunktion. Der Merker erreicht dasselbe: Mit Häkchen liegt er 30 Tage, ohne Häkchen endet er mit dem Browser, und der Torwächter verlangt ihn zusätzlich zur bestätigten Stufe | 2026-09-16 |
| Der Merker trägt die Kontokennung | Damit gilt ein gemerktes Gerät nur für ein Konto. Meldet sich jemand anderes am selben Gerät an, passt der Merker nicht und der Code wird verlangt | 2026-09-16 |
| Die Sicherheitsmeldung läuft **nicht** über die anpassbaren Vorlagen | Sie richtet sich an Studiopersonal, nicht an Kunden, und an ihrem Wortlaut gibt es nichts zu gestalten. In der Vorlagenliste stünde sie den Kundennachrichten nur im Weg. Nebeneffekt: Da für diesen Typ keine Einstellung existiert, greift die Vorgabe „zustellen" — eine Sicherheitsmeldung lässt sich nicht versehentlich abschalten | 2026-09-16 |
| Fremde Sitzungen über eine eigene Datenbankfunktion beenden | Die Bibliothek verlangt zum Abmelden das Anmeldetoken des Betroffenen, das wir nicht haben. Das Löschen der Sitzungszeile ist genau das, was ein Abmelden tut | 2026-09-16 |
| Ausrollen in zwei Schritten | Die Datenbankregel wird erst scharf geschaltet, wenn die Einrichtung nachweislich funktioniert. Sonst stünde im schlimmsten Fall eine Verwaltung ohne Zugang und mit kaputtem Einrichtungsweg da | 2026-09-16 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Die Grundidee

Supabase kann Zwei-Faktor-Anmeldung von Haus aus. Das heißt für uns: **Wir speichern kein neues Geheimnis.**
Der Schlüssel, den die Authenticator-App bekommt, liegt in Supabases eigenem, abgeschottetem Bereich —
wir sehen ihn ein einziges Mal, während der Einrichtung, und legen ihn nirgends ab. Auch der QR-Code
kommt fertig von dort. Es kommt kein einziges neues Paket dazu.

Was Supabase **nicht** mitbringt, ist alles Übrige: die Pflicht, die Rücksetzung durch einen anderen
Admin, das Merken eines Geräts und die Sperre an den richtigen Stellen. Das bauen wir.

### Drei Mauern statt einer

Der wichtigste Entwurfsgedanke: Eine Sperre in der Oberfläche allein wäre zu wenig. Die Adresse der
Datenbank und der öffentliche Zugangsschlüssel stehen in jeder ausgelieferten Seite — das ist bei
Supabase so vorgesehen, geschützt wird über die Regeln *in* der Datenbank. Wer ein Admin-Passwort
erbeutet, könnte damit an den Seiten vorbei direkt mit der Datenbank reden. Deshalb sitzt die Sperre
an drei Stellen:

**1. In der Datenbank (die eigentliche Mauer).** Es gibt dort eine kleine Auskunftsfunktion, die
sämtliche Sicherheitsregeln benutzen: „Ist der Anfragende ein Admin?" Diese Funktion beantwortet die
Frage künftig nur noch mit Ja, wenn in derselben Anmeldung die zweite Stufe bestätigt wurde. Ein
Ort, rund 50 Regeln erben den Schutz — Kundendaten, Rechnungen, Lastschriften, alles.

**2. In den Seiten (der Wegweiser).** Die Verwaltung hat bereits eine gemeinsame Zugangsprüfung,
durch die jede Verwaltungsseite geht. Sie bekommt zwei neue Antworten: „noch nicht eingerichtet" führt
zur Einrichtungsseite, „Stufe noch nicht bestätigt" zur Code-Seite. Dasselbe gilt für den
Kundenbereich, weil ein Admin laut Spec vor der Einrichtung gar nichts erreichen soll.

**3. In den Handgriffen mit Generalschlüssel.** Zwölf Stellen im Code arbeiten mit einem Schlüssel,
der die Datenbankregeln absichtlich umgeht — Lehrer einladen, Benachrichtigungen verschicken, offene
Posten nachschlagen. Genau dort greift Mauer 1 nicht. Diese Stellen müssen selbst nachsehen, ob die
zweite Stufe bestätigt ist. Das ist die Stelle, an der so ein Vorhaben erfahrungsgemäß undicht wird,
darum steht sie hier ausdrücklich.

### Wie „Gerät 30 Tage merken" funktioniert

Der naheliegende Weg wäre ein eigener Geräteausweis im Browser. Er wäre ein **zweites Geheimnis, das
gestohlen werden kann** — und die Datenbank könnte ihn nicht prüfen, womit Mauer 1 ins Leere liefe.

Stattdessen hängt es an der Lebensdauer der Anmeldung selbst. Eine bestätigte zweite Stufe ist Teil
der laufenden Anmeldung und bleibt es, solange diese lebt:

- **Häkchen gesetzt:** Die Anmeldung überdauert das Schließen des Browsers, bis zu 30 Tage. In dieser
  Zeit fragt dieses Gerät weder nach Passwort noch nach Code.
- **Häkchen nicht gesetzt (Voreinstellung):** Die Anmeldung endet mit dem Browser. Beim nächsten Mal
  wieder Passwort und Code.

Im Browser liegt dafür nur ein schlichter Merker, der nichts weiter besagt als „diese Anmeldung darf
das Schließen überdauern". Er enthält kein Geheimnis und öffnet für sich genommen gar nichts.

„Alle Geräte abmelden" heißt dann genau das, was es sagt: alle Anmeldungen dieses Kontos beenden.
Dasselbe geschieht automatisch beim Passwortwechsel und beim Zurücksetzen der zweiten Stufe.

### Was gebaut wird

```
Anmeldung (bestehend, Weiche wird erweitert)
+-- Passwort stimmt → wohin?
    +-- Kunde oder Lehrer          → wie bisher, nichts ändert sich
    +-- Admin ohne App             → Seite „Verwaltung absichern"
    +-- Admin mit App              → Seite „Code bestätigen"

Seite „Verwaltung absichern" (neu)
+-- Kurze Erklärung, warum das nötig ist
+-- QR-Code (kommt fertig von Supabase)
+-- Derselbe Schlüssel als Text, falls die Kamera nicht mitspielt
+-- Code-Feld (6 Ziffern)
+-- Bei falschem Code: Meldung, aber derselbe QR-Code bleibt stehen

Seite „Code bestätigen" (neu)
+-- Code-Feld (6 Ziffern)
+-- Häkchen „Diesem Gerät 30 Tage vertrauen" — leer vorausgewählt
+-- Nach wiederholtem Fehlschlag: Hinweis auf die Uhrzeit des Handys
+-- Ausweg „Abmelden"

Profil → neuer Abschnitt „Anmeldesicherheit"
+-- Zustand: eingerichtet seit …
+-- Knopf „Alle Geräte abmelden"

Verwaltung → Kunden → Konto mit Rolle Admin (Erweiterung)
+-- Kennzeichen „Zweite Stufe aktiv" bzw. „nicht eingerichtet"
+-- Knopf „Zweite Stufe zurücksetzen" mit Rückfrage
+-- Beim eigenen Konto nicht anklickbar

Verwaltung → Startseite (Erweiterung)
+-- Hinweisbalken, solange es nur ein einziges Admin-Konto gibt

Benachrichtigungen (Erweiterung)
+-- Neue Art „Zweite Stufe zurückgesetzt" samt Vorlage
```

### Was gespeichert wird

**Der Schlüssel der Authenticator-App:** in Supabases eigenem, geschütztem Bereich — nicht in unseren
Tabellen, nicht in unseren Sicherungen, für uns nach der Einrichtung nicht mehr lesbar.

**Neu in unserer Datenbank:** nichts weiter als ein zusätzlicher Eintrag in der bestehenden Liste
erlaubter Benachrichtigungsarten. Diese Liste ist in der Datenbank festgeschrieben; fehlt der Eintrag,
verschwindet die E-Mail lautlos, ohne Fehlermeldung. Das ist in diesem Projekt schon einmal passiert
(PROJ-16) und darum hier vermerkt.

**Geändert:** die eine Auskunftsfunktion aus Mauer 1.

**Im Browser:** der Merker für das gemerkte Gerät — kein Geheimnis, keine Berechtigung.

### Was wir nicht brauchen

Keine neue Tabelle. Kein neues Paket. Keine Geräteliste, keine Wiederherstellungscodes, keine
zusätzlichen Zugangsdaten und keinen weiteren Dienstleister — also auch keinen neuen
Auftragsverarbeitungsvertrag.

### Reihenfolge beim Ausrollen

Zwei Schritte, nicht einer. Zuerst gehen Einrichtung, Code-Seite und Rücksetzung in Betrieb; die
Admins richten ihre App ein. Erst danach wird die Datenbankregel scharf geschaltet. Andernfalls
stünde im ungünstigsten Fall eine Verwaltung ohne Zugang **und** mit einem Einrichtungsweg da, der
sich noch nie bewährt hat. Der Weg zurück wäre dann nur noch das Supabase-Dashboard.

### Backend nötig?

Ja. Datenbankfunktion ändern, eine Migration für die Benachrichtigungsart, Rücksetzung über den
privilegierten Serverzugang, und die zwölf Stellen mit Generalschlüssel nachziehen.

### Zusätzliche Pakete

Keine.

## Umsetzung — Frontend (2026-09-16)

### Gebaut und lauffähig

- **`/sicherheit/einrichten`** — dreischrittige Anleitung, QR-Code, Schlüssel zum Abtippen hinter
  einem Aufklapper, Code-Feld. Bei falschem Code bleibt derselbe QR-Code gültig; ab dem zweiten
  Fehlversuch erscheint der Hinweis auf die Uhrzeit des Handys.
- **`/sicherheit/code`** — Code-Feld, Häkchen „Diesem Gerät 30 Tage vertrauen" (leer
  vorausgewählt), Ausweg „Abmelden".
- **Profil → „Anmeldesicherheit"** — nur für Admins sichtbar: Zustand samt Einrichtungsdatum und
  „Alle Geräte abmelden" mit Rückfrage.
- **`src/lib/auth/zweite-stufe.ts`** — gemeinsame Logik, 15 Unit-Tests.

Die Seiten liegen unter `(staff)` neben Lehreransicht und Einlass, nicht im Kundenbereich: Sie sind
einsprachig deutsch, unter `/en/...` stünde dort sonst deutscher Text. Die Middleware nimmt
`/sicherheit` deshalb von der Sprachweiche aus.

Einrichten, Prüfen und globales Abmelden laufen über die Sitzung im Browser — für das **eigene**
Konto ist das der vorgesehene Weg und braucht keinen Serverzugang.

### Umgesetzte Entwurfsentscheidungen

- Der QR-Code wird aus der Adresse erzeugt, die Supabase mitliefert, statt dessen fertiges SVG
  einzublenden — fremdes Markup ungeprüft in die Seite zu schreiben ist eine Gewohnheit, die man
  sich nicht angewöhnen sollte. Das QR-Paket lag ohnehin im Projekt (Tickets).
- Ein Eingabefeld statt sechs Kästchen: iOS und Android füllen einen Code nur dann von selbst ein,
  wenn er in *ein* Feld mit `one-time-code` passt. Da die Einrichtung meist am Handy passiert, wiegt
  das schwerer als das Aussehen.
- Vor jeder Einrichtung werden unbestätigte Reste einer abgebrochenen früheren Einrichtung entfernt.
  Sonst scheiterte der nächste Anlauf an einem belegten Namen — an etwas, das mit dem Vorgang nichts
  zu tun hat.

### Bewusst offen für /backend

- **Die Torwächter.** Noch leitet nichts automatisch auf die beiden Seiten um; sie sind direkt
  erreichbar. Die Weiche nach dem Anmelden, die Sperre der Verwaltung und die Sperre des
  Kundenbereichs gehören zur Zugangsprüfung.
- **Die Datenbankregel** (Mauer 1) und die zwölf Stellen mit Generalschlüssel.
- **Zurücksetzen durch einen anderen Admin** samt Zustandsanzeige in der Kundenverwaltung — beides
  braucht den privilegierten Serverzugang, den es im Browser nicht gibt. Deshalb hier bewusst nicht
  halb gebaut.
- **Die E-Mail beim Zurücksetzen** samt Migration der Benachrichtigungsart.
- **Der Hinweis „nur ein Admin-Konto"**.
- **Die zweite Hälfte des Gerätemerkers:** Der Merker wird gesetzt und gelöscht
  (`src/lib/actions/geraet-merken.ts`), aber die Lebensdauer der Anmeldecookies richtet sich noch
  nicht danach.

## Umsetzung — Backend (2026-09-16)

### Eine Korrektur am Entwurf

Der Entwurf rechnete mit zwölf Stellen, die mit Generalschlüssel arbeiten und einzeln nachgezogen
werden müssten. Beim Nachsehen stellte sich heraus: **Alle rufen bereits `requireAdmin()` auf**, und
die Seiten unter `/admin` hängen ohnehin am gemeinsamen Layout, das dasselbe tut. Die Prüfung
einmal in `requireAdmin()` einzubauen deckt sie deshalb vollständig ab. Die übrigen Fundstellen sind
kein Verwaltungszugang: der nächtliche Lauf (durch ein eigenes Geheimnis geschützt), die
Registrierung und die Versandbibliotheken.

### Gebaut

- **`zweiteStufeLage()`** — die eine Auskunft: `einrichten`, `bestaetigen` oder `erfuellt`. Sie liest
  das Anmeldetoken, das ohnehin vorliegt; es geht keine Anfrage hinaus. Bei einem Fehler lautet die
  Antwort `einrichten` — ein Torwächter, der im Zweifel durchlässt, ist keiner.
- **Torwächter** in `requireAdmin()`, `requireAdminOrTeacher()` (dort nur für Admins) und im Rahmen
  des Kundenbereichs.
- **Zurücksetzen** durch einen anderen Admin, samt Abmelden aller Geräte des Betroffenen und E-Mail
  an ihn. Das eigene Konto ist ausgenommen, und zwar doppelt: in der Server-Action und noch einmal
  in der Datenbankfunktion.
- **Zustandsanzeige** im Kundendatensatz eines Verwaltungskontos.
- **Hinweis im Verwaltungsrahmen**, solange es nur ein einziges Admin-Konto gibt.
- **Zwei Migrationen**, bewusst getrennt (siehe unten).

### Was sich gegenüber dem Entwurf geändert hat

„Gerät 30 Tage merken" hängt jetzt an der Lebensdauer des **Merkers**, nicht an der der
Anmeldecookies. Grund: `@supabase/ssr` überschreibt jede selbst gesetzte Cookie-Dauer mit ihrer
eigenen Vorgabe von 400 Tagen, in drei verschiedenen Schreibern. Daran zu drehen hieße, die
Anmeldung sämtlicher Kunden anzufassen — viel Risiko für eine Bequemlichkeitsfunktion. Der Merker
erreicht dasselbe Ergebnis mit einem Bruchteil der Angriffsfläche, und er kann eine Anmeldung nur
verkürzen, nie verlängern: Der Torwächter verlangt weiterhin die bestätigte zweite Stufe.

### Einspielen — Reihenfolge

1. **`20260916120000_proj58_zweite_stufe_grundlage.sql`** — jederzeit. Ändert keine Rechte, sperrt
   niemanden aus.
2. Die Admins richten ihre Authenticator-App ein.
3. **`20260916121000_proj58_zweite_stufe_erzwingen.sql`** — erst danach. Ab hier verlangt die
   Datenbank die bestätigte zweite Stufe für jede Admin-Berechtigung.

### Noch nicht geprüft

Der Supabase-Zugang meldet in dieser Sitzung `AUTH_HEADER_REJECTED`. Beide Migrationen sind deshalb
**an keiner Datenbank gelaufen** — weder an der Test- noch an der Produktionsdatenbank. Lint,
Typprüfung, Build und 100 Unit-Tests laufen durch, aber das sagt über das SQL nichts aus. Das gehört
in den QA-Durchgang, sobald der Zugang wieder steht.

## QA Test Results (2026-09-16)

**Empfehlung: noch nicht in Produktion** — nicht wegen eines offenen Fehlers, sondern weil die
wichtigste Schicht ungeprüft ist (siehe „Was ungeprüft bleibt").

### Zahlen

| | |
|---|---|
| Unit- und Datenbanktests | 796 grün (66 Dateien) |
| E2E PROJ-58 | 22 grün (11 Prüfungen × Chromium und iPhone 13) |
| E2E Regressionsprobe | 27 grün (PROJ-2 Auth, PROJ-4 Kundenverwaltung) |
| Gefundene Fehler | 4 — alle behoben |

### Die größte Entdeckung: 51 Bestandsdateien waren rot

Der Torwächter greift für jedes Admin-Konto, auch ohne eingerichtete App. Damit lief **jeder**
bestehende Verwaltungstest auf die Einrichtungsseite statt in die Verwaltung — nachgewiesen an einem
echten Lauf, nicht vermutet. 54 von 57 Spec-Dateien melden sich als Admin an.

Gelöst mit drei neuen Bausteinen:

- **`tests/totp.ts`** — erzeugt gültige Codes, wie eine Authenticator-App. Gegen alle sechs
  Prüfwerte aus RFC 6238 geprüft, bevor irgendetwas darauf aufbaut (13 Tests).
- **`tests/global-setup.ts`** — legt vor dem Lauf für jedes Verwaltungskonto der Testdatenbank eine
  App an, über den normalen Weg. Supabase kann einen Faktor nicht von außen anlegen, und das ist gut so.
- **`zweiteStufeErledigen()`** — eine Zeile hinter jedem der 66 Anmelde-Klicks. Bewusst so
  eingefügt statt 44 gewachsene `login()`-Funktionen zu vereinheitlichen: Der kleinere Eingriff
  ändert nichts an ihrem Verhalten.

Der Helfer schweigt, wenn keine Code-Abfrage kommt — sonst hätte er die Tests für *misslungene*
Anmeldungen mit einer irreführenden Meldung zum Scheitern gebracht. Genau die laufen grün.

### Gefundene Fehler

**BUG-1 (Hoch, behoben) — Nach der Einrichtung ging es nicht weiter.**
Wer den QR-Code scannte und den ersten Code richtig eingab, landete wieder auf der Code-Seite und
musste sofort einen zweiten Code eintippen. Ursache war meine eigene Naht zwischen zwei
Arbeitsschritten: Der Torwächter aus dem Backend verlangt zusätzlich den Gerätemerker, die
Einrichtungsseite aus dem Frontend kannte ihn noch nicht und setzte ihn nicht. Verletzte ein
Abnahmekriterium und hätte **jeden** Admin beim ersten Mal getroffen.

**BUG-2 (Niedrig, behoben) — Die beiden neuen Seiten hatten keine Überschrift.**
`CardTitle` rendert ein `div`. Jede andere Seite der App hat ein echtes `h1`; ausgerechnet auf den
zwei Seiten, an denen niemand vorbeikommt, fehlte Screenreadern der Ankerpunkt.

**BUG-3 (Niedrig, behoben) — Der neue Ereignistyp hatte keine Beschriftung.**
Gefunden von einem Test, den das Projekt genau dafür gebaut hat. In der Warteschlange der
Verwaltung hätte der technische Schlüssel gestanden statt „Zwei-Faktor zurückgesetzt".

**BUG-4 (Niedrig, behoben) — Ein Name wanderte ungefiltert in die E-Mail.**
Meine Sicherheitsmeldung setzte den Namen dessen, der zurückgesetzt hat, ohne Maskierung ins HTML —
während das restliche Projekt dafür durchgehend `escapeHtml` benutzt. Der Inhalt liegt jetzt in
`templates.ts`, wo das Maskieren zu Hause ist, samt fünf Tests.

Dazu kamen vier Fehler in **meinen Tests** (zu grobe Locators, ein Klick auf einen Knopf, den es auf
der Zielseite nicht gibt, und zweimal eine zu grobe Behauptung über die Maskierung). Keiner davon
war ein Produktfehler.

### Sicherheitsprüfung

| Angriff | Ergebnis |
|---|---|
| Kundenkonto ruft `admin_sitzungen_beenden` für ein fremdes Konto auf | abgewiesen |
| Kundenkonto liest `profiles` | 1 Zeile — die eigene |
| Kundenkonto liest `sepa_mandates` | 0 Zeilen |
| `/sicherheit/einrichten` und `/sicherheit/code` ohne Anmeldung | Umleitung auf `/login` |
| `/admin` über die Adresszeile, ohne Code | Umleitung auf die Code-Abfrage |
| Eigene zweite Stufe zurücksetzen | in der Oberfläche nicht angeboten, in der Server-Action abgewiesen, in der Datenbankfunktion noch einmal abgewiesen |
| Gerätemerker gefälscht | nutzlos — der Torwächter prüft zuerst die bestätigte Stufe; der Merker kann nur verkürzen |

### Was ungeprüft bleibt

**Mauer 1 — die Datenbankregel.** `20260916121000_proj58_zweite_stufe_erzwingen.sql` ist in keiner
Datenbank eingespielt, auch nicht in der Test-Datenbank. Damit ist ungeprüft, ob
`auth.jwt() ->> 'aal'` in dieser Supabase-Version so heißt und ob die Regel greift. Das ist genau
die Schicht, die einen Angreifer aufhält, der die Oberfläche umgeht — sie gehört geprüft, bevor
irgendetwas in Produktion geht.

**Weitere Lücken:** Die Drosselung nach mehreren Fehlversuchen kommt von Supabase und wurde nicht
eigens ausgelöst. Firefox ist im Projekt weiterhin nicht eingerichtet (Bestandslücke). Der Hinweis
„nur ein Admin-Konto" ist nicht automatisiert geprüft — die Testdatenbank hat zwölf.

## Deployment

_To be added by /deploy_
