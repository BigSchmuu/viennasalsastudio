# PROJ-56: Ticketarten, Pässe & Einheiten

## Status: Architected
**Created:** 2026-09-14
**Last Updated:** 2026-09-15

## Dependencies
- Requires: PROJ-53 (Veranstaltungsprogramm) — Verkaufsart „Tickets in der App", Eventseite
- Requires: PROJ-14 (Events & Workshops) — Ticketkauf, QR-Code, Check-in, Gästeliste
- Requires: PROJ-7 (SEPA-Lastschriftmandate & Sammel-Einzug) — Ticketbeträge im Sammellauf
- Requires: PROJ-42 (Rechtssichere Buchungsbestätigung) — Zustimmung und Bestätigung beim Kauf
- Requires: PROJ-16 (Benachrichtigungen) — Ticketbestätigung und Änderungen an Einheiten
- Berührt: PROJ-54 (Event-Serien) — Ticketarten gelten auch für Serientermine

## User Stories
- Als Admin möchte ich für einen Workshop mehrere Einheiten mit Titel, Datum und Uhrzeit anlegen (z. B. „Samstag 14:00 Styling"), damit Kunden das Programm sehen.
- Als Admin möchte ich Ticketarten anlegen (z. B. „Full Pass", „Einzelne Einheit") mit Normal- und Studierendenpreis, optionalem Kontingent und den Einheiten, für die sie gelten.
- Als Kunde möchte ich beim Kauf eine Ticketart wählen und, falls sie das vorsieht, die Einheit wählen.
- Als Admin möchte ich pro Event festlegen, ob Kunden per SEPA-Lastschrift, bar vor Ort oder beides zahlen können.
- Als Admin möchte ich pro Event die Stornofrist festlegen, damit Workshops eine längere Frist haben können als Partys.
- Als Admin oder Lehrer möchte ich beim Einlass zu jeder Einheit scannen und sehen, ob das Ticket für diese Einheit gilt.
- Als Admin möchte ich jemanden von Hand auf die Gästeliste setzen — Lehrer, Freunde des Hauses, Gewinner —, ohne dass diese Person ein Konto braucht oder etwas bezahlt.

## Out of Scope
- **Frühbucherpreise, Mengenrabatte** und Rabattcodes beim Ticketkauf
- **Mehrere Tickets in einem Kauf** (z. B. für Tanzpartner) — entschieden am 2026-09-15: bleibt draußen
- **Feste Platzkontingente je Tanzrolle** — die Rolle wird abgefragt, begrenzt wird aber über den höchsten Abstand, wie bei Kursen (2026-09-15)
- **Wechsel der Ticketart** nach dem Kauf (z. B. Upgrade auf Full Pass) — der Kunde storniert und kauft neu, wie in PROJ-14
- **Online-Zahlung** und automatisierte Rückerstattung — Rückerstattung bleibt manuell
- **Warteliste** — bleibt ausgeschlossen

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Einheiten
- [ ] Angenommen ein Admin legt bei einem Event mit Tickets Einheiten an (Titel, Datum, Beginn, Ende, optional Kapazität), dann erscheinen sie nach Zeit sortiert als Programm auf der Eventseite
- [ ] Angenommen eine Einheit liegt außerhalb des Event-Zeitraums, dann erscheint beim Speichern ein Validierungsfehler
- [ ] Angenommen ein Event hat keine Einheiten, dann funktioniert es wie bisher als ein Termin, und Ticketarten gelten für das ganze Event
- [ ] Angenommen für eine Einheit gelten bereits verkaufte Tickets, wenn der Admin sie löschen will, dann wird das verhindert; verschiebt er sie, werden die betroffenen Ticket-Inhaber benachrichtigt

### Ticketarten
- [ ] Angenommen ein Admin legt eine Ticketart an, dann gibt er Name, Normal- und Studierendenpreis, optional ein Kontingent und den Geltungsbereich an: alle Einheiten, bestimmte Einheiten oder „Kunde wählt eine Einheit"
- [ ] Angenommen ein Event verkauft Tickets in der App, dann hat es mindestens eine Ticketart; ein neues Event startet mit einer Ticketart „Ticket" für alle Einheiten
- [ ] Angenommen eine Ticketart kostet 0 €, dann ist sie kostenlos: Die Zahlungsartwahl entfällt, und das Ticket ist sofort bestätigt
- [ ] Angenommen eine Ticketart hat bereits verkaufte Tickets, dann lassen sich Preis und Geltungsbereich nicht mehr ändern, der Name schon; der Admin kann sie aber vom Verkauf nehmen, und verkaufte Tickets bleiben gültig

### Kauf
- [ ] Angenommen ein Kunde öffnet den Kauf, dann sieht er alle Ticketarten mit Preis und dem, was enthalten ist; ausverkaufte Arten sind sichtbar, aber nicht wählbar
- [ ] Angenommen der Kunde wählt eine Ticketart mit „Kunde wählt eine Einheit", dann muss er eine Einheit wählen; volle Einheiten sind nicht wählbar
- [ ] Angenommen das Kontingent der Ticketart oder die Kapazität einer Einheit, für die das Ticket gilt, ist erschöpft, dann ist der Kauf nicht möglich; kaufen zwei Kunden gleichzeitig den letzten Platz, bekommt ihn nur einer
- [ ] Angenommen ein Ticket gilt für mehrere Einheiten, dann belegt es in jeder dieser Einheiten einen Platz
- [ ] Angenommen ein Kunde kauft ein Ticket, dann nennen Bestätigung, „Meine Tickets" und die Benachrichtigung Ticketart, Preis, die enthaltenen Einheiten und die Stornofrist
- [ ] Angenommen ein Kunde möchte den Studierendenpreis, dann wählt er ihn wie bisher beim Kauf
- [ ] Angenommen ein Event fragt die Tanzrolle ab, dann steht sie an der Gästeliste und am Einlass beim gefundenen Ticket

### Zahlungsarten
- [ ] Angenommen ein Admin legt die Zahlungsarten eines Events fest (SEPA-Lastschrift, bar vor Ort oder beides), dann bietet der Kauf nur diese an; mindestens eine muss gewählt sein
- [ ] Angenommen ein Event erlaubt nur SEPA und der Kunde hat kein Mandat, dann sieht er den Hinweis, dass dafür ein SEPA-Mandat nötig ist, mit Link zum Hinterlegen, und kann nicht kaufen
- [ ] Angenommen ein Event erlaubt nur bar vor Ort, dann wird SEPA nicht angeboten, auch wenn der Kunde ein Mandat hat
- [ ] Angenommen der Admin ändert die Zahlungsarten nachträglich, dann bleiben verkaufte Tickets mit ihrer Zahlungsart gültig

### Stornofrist
- [ ] Angenommen ein Admin legt die Stornofrist in Tagen fest (Vorgabe: 1 Tag), dann können Kunden bis so viele Tage vor Beginn des Events bzw. des Serientermins selbst stornieren
- [ ] Angenommen die Frist ist abgelaufen, dann ist Stornieren nicht möglich, und der Kunde sieht, bis wann es möglich gewesen wäre
- [ ] Angenommen der Admin ändert die Frist, dann behalten bereits verkaufte Tickets die Frist, die beim Kauf galt

### Gästeliste von Hand
- [ ] Angenommen ein Admin öffnet die Gästeliste eines Events, dann kann er jemanden von Hand eintragen: Name, optional eine Notiz, optional die Tanzrolle und — bei einem Event mit Einheiten — für welche Einheiten der Eintrag gilt (Vorgabe: alle)
- [ ] Angenommen ein Gast steht von Hand auf der Liste, dann ist er als solcher erkennbar, zahlt nichts und taucht in keinem Sammellauf auf
- [ ] Angenommen ein Gast steht von Hand auf der Liste, dann verringert er die verkäuflichen Plätze nicht; die Liste nennt Tickets und Gäste getrennt
- [ ] Angenommen jemand steht von Hand auf der Liste, dann lässt er sich am Einlass über die Namenssuche einchecken — je Einheit, wie ein Ticket
- [ ] Angenommen ein Admin entfernt einen Eintrag von Hand, dann verschwindet er aus der Liste; bereits erfolgte Check-ins verschwinden mit ihm
- [ ] Angenommen jemand ohne Admin-Rolle versucht, einen Gast einzutragen oder zu entfernen, dann wird das verweigert

### Check-in
- [ ] Angenommen ein Event hat Einheiten, dann wählt die Person am Einlass vor dem Scannen die Einheit; vorgeschlagen ist die laufende oder nächste Einheit
- [ ] Angenommen ein Ticket gilt für die gewählte Einheit und ist dort noch nicht eingecheckt, dann wird es für diese Einheit eingecheckt; bei „bar vor Ort" wird beim ersten Check-in des Tickets die Zahlung als erhalten markiert
- [ ] Angenommen ein Ticket gilt nicht für die gewählte Einheit, dann erscheint „Gilt nicht für diese Einheit" mit den Einheiten, für die es gilt
- [ ] Angenommen ein Ticket ist für diese Einheit schon eingecheckt, dann erscheint „Bereits eingecheckt um HH:MM" statt eines erneuten Check-ins
- [ ] Angenommen ein Event hat keine Einheiten, dann funktioniert der Check-in wie bisher mit einem Scan
- [ ] Angenommen die Kamera ist nicht verfügbar, dann lässt sich wie bisher per Namenssuche einchecken, ebenfalls je Einheit

## Edge Cases
- Ein Full Pass und ein Einzelticket konkurrieren um den letzten Platz einer Einheit → nur einer bekommt ihn
- Die Kapazität einer Einheit wird unter die bereits belegten Plätze gesenkt → verkaufte Tickets bleiben gültig, bis wieder Platz frei ist, wird nichts verkauft (wie PROJ-14)
- Ein Kunde versucht, für dieselbe Einheit ein zweites Ticket zu kaufen → wird verhindert, solange Mehrfachkäufe ausgeschlossen sind
- Ein SEPA-Mandat wird nach dem Kauf widerrufen → das Ticket bleibt gültig, der Einzug folgt der Logik von PROJ-14
- Die Stornofrist ist 0 Tage → Stornieren ist bis zum Beginn möglich
- Eine Ticketart wird vom Verkauf genommen → verkaufte Tickets bleiben gültig und scannbar
- Der Admin stellt ein Event auf „nur bar", nachdem SEPA-Tickets verkauft wurden → diese bleiben SEPA-Tickets und kommen weiterhin in den Sammellauf
- Ein von Hand eingetragener Gast trägt denselben Namen wie ein zahlender Kunde → beide stehen auf der Liste, als Gast und als Ticket unterscheidbar
- Ein Gast wird von Hand eingetragen, obwohl die Einheit voll ist → geht, denn Gäste zählen nicht gegen die verkäuflichen Plätze; die Liste zeigt die Überzahl
- Ein Gast wird entfernt, nachdem er schon eingecheckt wurde → der Eintrag und seine Check-ins verschwinden zusammen
- Bestehende Test-Events → erhalten beim Umbau die Ticketart „Ticket" mit ihren bisherigen Preisen, beide Zahlungsarten und 1 Tag Stornofrist

## Technical Requirements (optional)
- Kontingent- und Kapazitätsprüfung race-condition-sicher (wie PROJ-14)
- SEPA-Tickets kommen mit dem Preis der Ticketart in den nächsten Sammellauf (PROJ-7)
- Kauf mit Zustimmung und rechtssicherer Bestätigung (PROJ-42), einschließlich Stornofrist
- Check-in nur für Admin und Lehrer

## Open Questions
- [x] Kapazität je Einheit plus optionales Kontingent je Ticketart → ja, beide greifen; der Kauf scheitert an dem, was zuerst voll ist (2026-09-15)
- [x] Mehrere Tickets in einem Kauf → nein, ein Ticket je Kauf. Die Begleitung kauft selbst, mit eigenem Konto und eigenem QR-Code (2026-09-15)
- [x] Leader/Follower bei Workshop-Tickets → ja, wenn das Event danach fragt, und dann nach dem Kursmuster mit höchstem Abstand statt fester Kontingente (2026-09-15)
- [x] Brauchen Serientermine auch Einheiten? → nein, Einheiten nur bei Einzelevents (2026-09-15)
- [x] Soll die Tanzrolle auch in der Gästeliste und beim Check-in sichtbar sein? → ja, an beiden Stellen (2026-09-15)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Ticketarten mit eigenem Preis und Kontingent („Pässe mit Auswahl") | Betreiberentscheidung — ein einzelner Pass deckt auch „ein Ticket für alles" ab | 2026-09-14 |
| Normal- und Studierendenpreis je Ticketart, 0 € bedeutet kostenlos | Betreiberentscheidung — gleiches Preismuster wie bisher | 2026-09-14 |
| Check-in je Einheit | Betreiberentscheidung — ein geteilter Pass fällt auf | 2026-09-14 |
| Zahlungsarten pro Event: SEPA-Lastschrift, bar vor Ort oder beides | Betreiberentscheidung | 2026-09-14 |
| Stornofrist pro Event, Vorgabe 1 Tag | Betreiberentscheidung — Workshops brauchen längere Fristen als Partys | 2026-09-14 |
| Verkaufte Tickets behalten Zahlungsart und Stornofrist vom Kaufzeitpunkt | Vertragsbedingungen ändern sich nicht nachträglich (PROJ-42) | 2026-09-14 (Vorschlag) |
| Bar-Zahlung gilt beim ersten Check-in des Tickets als erhalten | Führt die PROJ-14-Regel „Scan = bezahlt" für Pässe fort | 2026-09-14 (Vorschlag) |
| Kapazität je Einheit, ein Ticket belegt einen Platz in jeder Einheit, für die es gilt | Räume haben je Einheit begrenzten Platz, Full-Pass-Inhaber sind in jeder Einheit | 2026-09-14 (Vorschlag) |
| Gäste lassen sich von Hand auf die Gästeliste setzen — ohne Konto, ohne Zahlung | Betreiberwunsch: Lehrer und Freunde des Hauses sollen auf der Liste stehen, ohne durch den Ticketkauf zu müssen | 2026-09-15 |
| Von Hand eingetragene Gäste verringern die verkäuflichen Plätze nicht | Sonst nähme ein eingetragener Lehrer einem zahlenden Gast den Platz weg, ohne dass jemand damit rechnet. Wer weniger verkaufen will, setzt die Kapazität | 2026-09-15 (Vorschlag) |
| Die Tanzrolle steht an Gästeliste und Einlass | Betreiberwunsch — am Einlass sieht man damit sofort, wie die Runde steht | 2026-09-15 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Ein Ticket zeigt auf eine Ticketart; die Ticketart sagt, welche Einheiten gelten | Der Geltungsbereich gehört zur Art, nicht zum einzelnen Ticket — sonst müsste jedes Ticket seine Einheiten selbst mitschleppen | 2026-09-15 |
| Events ohne Einheiten laufen unverändert weiter; der Bestand bekommt die Ticketart „Ticket" | Eine Party braucht kein Programm; niemand soll nach dem Umbau etwas nachtragen müssen | 2026-09-15 |
| Tanzrolle nach dem Kursmuster: abfragen ja/nein plus höchster Abstand zwischen Leadern und Followern | Betreiberwunsch „wie bei den Kursen auch". Feste Kontingente je Rolle führten dazu, dass ein Workshop für die eine Rolle voll ist und für die andere leer | 2026-09-15 |
| Plätze werden je Einheit gezählt; ein Pass belegt in jeder seiner Einheiten einen | Sonst wären drei Einheiten à 20 Plätze zusammen 60 Tickets für einen Raum mit 20 Leuten | 2026-09-15 |
| Beim Kauf wird das Event gesperrt, nicht die einzelne Einheit | Ein Full Pass und ein Einzelticket dürfen nicht gleichzeitig denselben letzten Platz bekommen; bei Studiogröße kostet die grobe Sperre nichts | 2026-09-15 |
| Stornofrist und Zahlungsart werden beim Kauf am Ticket eingefroren | Vertragsbedingungen ändern sich nicht rückwirkend — dasselbe Prinzip wie bei der AGB-Fassung aus PROJ-42 | 2026-09-15 |
| Eine Ticketart mit verkauften Tickets lässt sich nur umbenennen oder vom Verkauf nehmen | Ein nachträglich geänderter Preis stünde an einem Ticket, das zu einem anderen gekauft wurde | 2026-09-15 |
| Eigene Zeile je Einlass und Einheit; das Ticket gilt ab dem ersten Scan als eingecheckt | Nur so lässt sich „bereits eingecheckt um 14:05" je Einheit sagen, ohne Gästeliste und Barzahlungsregel aus PROJ-14 umzubauen | 2026-09-15 |
| Einheiten nur bei Einzelevents, nicht bei Serienterminen | Betreiberentscheidung — sonst müssten Einheiten bei jedem neuen Termin neu entstehen | 2026-09-15 |
| Keine neuen Pakete | Alles mit Next.js, Supabase und vorhandenen Bausteinen umsetzbar | 2026-09-15 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
PROJ-56 braucht Frontend **und** Backend, und es ist der größte Umbau der Event-Reihe: Bisher ist ein Event ein Termin mit einem Preis. Künftig kann es ein **Programm aus Einheiten** haben und **mehrere Ticketarten**, die je eigene Einheiten abdecken.

Der Kern in einem Satz: Ein Ticket ist nicht mehr „für das Event", sondern **für eine Ticketart** — und die Ticketart sagt, für welche Einheiten das Ticket gilt.

Alles, was heute ohne Einheiten läuft, läuft weiter: Ein Event ohne Einheiten ist ein Event mit genau einem Termin und einer Ticketart. Nichts an der Party ändert sich, weil der Workshop neue Möglichkeiten bekommt.

### A) Komponentenstruktur

**Eventseite**
```
Eventseite
+-- Kopf, Titelbild, Beschreibung (unverändert, PROJ-53/55)
+-- Bereich „Programm"  (nur wenn das Event Einheiten hat)
|   +-- je Einheit: Uhrzeit, Titel, freie Plätze
+-- Bereich „Tickets"
|   +-- je Ticketart: Name, Preis (normal/Studierende), was enthalten ist
|   +-- ausverkaufte Arten bleiben sichtbar, aber ohne Knopf
+-- Kaufdialog
    +-- Ticketart wählen
    +-- Einheit wählen        (nur bei „Kunde wählt eine Einheit")
    +-- Tanzrolle wählen      (nur wenn das Event danach fragt)
    +-- Zahlungsart           (nur die, die das Event erlaubt)
    +-- Studierendenpreis, AGB-Zustimmung, kaufen (unverändert, PROJ-42)
```

**Verwaltung**
```
/admin/events
+-- Eventliste: neuer Knopf „Programm & Tickets" je Zeile
|   (neben „Bilder & Videos" und „Gästeliste")
+-- Dialog „Programm & Tickets"
|   +-- Einheiten: anlegen, ändern, löschen — Titel, Beginn, Ende, Kapazität
|   +-- Ticketarten: anlegen, ändern, vom Verkauf nehmen
|       +-- Name, Normal- und Studierendenpreis, optionales Kontingent
|       +-- Geltung: alle Einheiten · bestimmte Einheiten · Kunde wählt eine
+-- Event-Formular bekommt drei Angaben dazu:
|   Zahlungsarten, Stornofrist in Tagen, Tanzrolle abfragen
+-- Gästeliste (vorhanden) bekommt zwei Dinge dazu:
    +-- die Tanzrolle je Zeile, wenn das Event danach fragt
    +-- „Gast eintragen": Name, Notiz, Tanzrolle, Einheiten (Vorgabe: alle)
```

**Check-in**
```
/checkin
+-- Termin wählen (wie seit PROJ-54)
+-- Einheit wählen          (nur wenn das Event Einheiten hat;
|                            vorgeschlagen ist die laufende oder nächste)
+-- Scannen oder Namenssuche (unverändert)
+-- Antwort: eingecheckt · gilt nicht für diese Einheit (mit Liste) ·
    bereits eingecheckt um HH:MM
```

### B) Datenmodell (in Worten)

**Einheit** (neu) — gehört zu einem Event
- Titel, Beginn, Ende, optionale Kapazität
- Die Reihenfolge ergibt sich aus der Zeit, nicht aus einer eigenen Angabe

**Ticketart** (neu) — gehört zu einem Event
- Name, Normalpreis, Studierendenpreis, optionales Kontingent
- Geltung: alle Einheiten · eine feste Auswahl · der Kunde wählt eine
- bei fester Auswahl: welche Einheiten dazugehören
- „im Verkauf" ja/nein — vom Verkauf genommen heißt nicht gelöscht

**Ticket** (vorhanden, erweitert)
- welche Ticketart
- welche Einheit, falls der Kunde eine wählen musste
- die Tanzrolle, falls das Event danach fragt
- **die Stornofrist, die beim Kauf galt** — eingefroren, nicht nachgeschlagen
- Zahlungsart, Preis, AGB-Zustimmung: unverändert

**Einlass je Einheit** (neu)
- welches Ticket, welche Einheit, wann, von wem
- Ein Pass für drei Einheiten wird dreimal gescannt und hinterlässt drei Zeilen

**Gast von Hand** (neu) — gehört zu einem Event
- Name, optionale Notiz, optionale Tanzrolle
- bei einem Event mit Einheiten: für welche Einheiten der Eintrag gilt
- wer ihn eingetragen hat und wann
- kein Konto, kein Preis, kein QR-Code — er steht auf der Liste, mehr nicht

**Event** (vorhanden, erweitert)
- erlaubte Zahlungsarten
- Stornofrist in Tagen (Vorgabe 1)
- Tanzrolle abfragen ja/nein, und wie weit Leader und Follower auseinanderlaufen dürfen

**Unverändert:** Serien, Eventarten, Bilder, Videos, SEPA-Mandate, Sammellauf.

### C) Technische Entscheidungen (für den Betreiber erklärt)

- **Ein Event ohne Einheiten bleibt genau das, was es heute ist.** Die Einheiten sind eine Möglichkeit, keine Pflicht. Für die Freitagsparty ändert sich nichts außer den drei neuen Angaben im Formular.
- **Jedes Event mit Ticketverkauf bekommt beim Umbau die Ticketart „Ticket"** mit seinen bisherigen Preisen, beiden Zahlungsarten und einem Tag Frist. Verkaufte Tickets zeigen danach auf diese Art. Niemand muss etwas von Hand nachtragen.
- **Die Tanzrolle funktioniert wie bei den Kursen** — so, wie du es gewünscht hast. Das heißt konkret: Das Event fragt die Rolle ab oder nicht, und wenn es sie abfragt, darf der Abstand zwischen Leadern und Followern eine eingestellte Zahl nicht überschreiten. **Das ist etwas anderes als getrennte Platzkontingente**, und mit Absicht: Feste Kontingente führen dazu, dass ein Workshop für die eine Rolle ausverkauft ist, während für die andere Plätze leer bleiben. Die Kursregel verhindert genau das. Sag Bescheid, wenn du es doch fest getrennt haben willst.
- **Plätze werden je Einheit gezählt.** Ein Full Pass belegt in jeder Einheit, für die er gilt, einen Platz — sonst wären drei Einheiten mit je 20 Plätzen zusammen 60 Tickets, obwohl im Raum 20 Leute stehen.
- **Das Kontingent einer Ticketart kommt obendrauf.** Die Einheit sagt, wie viele in den Raum passen; das Kontingent sagt, wie viele Full Passes es überhaupt gibt. Beide können greifen, und der Kauf scheitert an dem, was zuerst voll ist.
- **Beim Kauf wird das ganze Event kurz gesperrt**, nicht einzelne Einheiten. Damit kann es nicht passieren, dass ein Full Pass und ein Einzelticket gleichzeitig den letzten Platz derselben Einheit bekommen. Bei der Größenordnung eines Studios kostet das nichts — zwei Käufe in derselben Sekunde sind ohnehin die Ausnahme.
- **Die Stornofrist wird beim Kauf eingefroren.** Ändert der Admin sie später, gilt für schon verkaufte Tickets weiter, was beim Kauf zugesagt war. Dasselbe Prinzip wie bei der AGB-Fassung aus PROJ-42: Vertragsbedingungen ändern sich nicht rückwirkend.
- **Zahlungsarten ebenso:** Wer per SEPA gekauft hat, bleibt im Sammellauf, auch wenn das Event danach auf „nur bar" gestellt wird.
- **Eine Ticketart mit verkauften Tickets lässt sich nicht mehr umpreisen** und nicht in ihrer Geltung ändern — nur umbenennen oder vom Verkauf nehmen. Sonst stünde im Nachhinein ein anderer Preis an einem Ticket, das jemand zu einem anderen gekauft hat.
- **Der Einlass bekommt eine eigene Zeile je Einheit.** Nur so lässt sich „bereits eingecheckt um 14:05" für die eine Einheit sagen und gleichzeitig die nächste offen lassen. Das Ticket selbst gilt weiterhin ab dem ersten Scan als eingecheckt — daran hängt die Gästeliste und bei Barzahlung die Zusage „gescannt heißt bezahlt".
- **Ein Gast von Hand ist kein Ticket, sondern ein eigener Eintrag.** Ein Ticket hängt an einem Konto — das ist die Grundlage für QR-Code, Storno, „Meine Tickets" und den Sammellauf. Ein Lehrer ohne Konto ließe sich dort nur unterbringen, indem all das aufgeweicht wird. Ein eigener, kleiner Eintrag lässt das Ticketmodell in Ruhe; die Gästeliste zeigt beide nebeneinander, als Ticket und als Gast erkennbar.
- **Gäste von Hand verringern die verkäuflichen Plätze nicht.** Sonst nähme ein eingetragener Lehrer einem zahlenden Gast den Platz weg, ohne dass jemand damit rechnet — und der Admin sähe nur, dass „ausverkauft" dasteht. Wer weniger verkaufen will, setzt die Kapazität. Die Liste nennt beide Zahlen getrennt, damit am Einlass klar ist, wie viele Leute wirklich kommen. *Sag Bescheid, wenn Gäste doch mitzählen sollen.*
- **Eingecheckt wird ein Gast über die Namenssuche**, die es am Einlass schon gibt — je Einheit, wie ein Ticket. Einen QR-Code bekommt er nicht: Er hat kein Konto, an das man ihn schicken könnte.
- **Kein Kauf mehrerer Tickets auf einmal** und keine Begleitpersonen — deine Entscheidung. Die Begleitung kauft selbst, mit eigenem Konto und eigenem QR-Code; der Einlass bleibt eindeutig.
- **Einheiten nur bei Einzelevents.** Serientermine behalten eine Ticketart für den ganzen Abend.
- **Keine neuen Pakete.**

### D) Abhängigkeiten (Pakete)
Keine neuen Pakete.

### Auswirkungen auf Bestehendes
- **Migration:** vier neue Tabellen (Einheiten, Ticketarten, Einlass je Einheit, Gäste von Hand) und die nötigen Verknüpfungen; das Event bekommt drei Angaben, das Ticket vier. Dazu der Umbau des Bestands auf die Ticketart „Ticket". Auslieferung wie gehabt: erst Migration, dann Code.
- **Der Ticketkauf in der Datenbank wird umgebaut** — er kennt künftig Ticketart, Einheit und Tanzrolle. Das berührt PROJ-14, PROJ-53 und PROJ-54.
- **Der Check-in bekommt eine zweite Auswahl.** Die Prüfung gegen den Termin aus PROJ-54 bleibt und wird um die Einheit ergänzt.
- **Die Eventseite bekommt zwei Abschnitte** (Programm, Tickets); der Kaufdialog wird mehrstufig. Die Tests aus PROJ-53 und PROJ-14 prüfen den heutigen Dialog und brauchen einen Blick.
- **Rechnungen und Sammellauf** bleiben unberührt: Sie sehen weiterhin einen Ticketbetrag, nur kommt der jetzt von der Ticketart. Gäste von Hand tauchen dort nie auf.
- **Die Gästeliste** zeigt künftig Tickets und Gäste gemeinsam, mit Tanzrolle, und bekommt einen Knopf zum Eintragen.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
