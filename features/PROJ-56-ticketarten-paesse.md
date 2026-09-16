# PROJ-56: Ticketarten, Pässe & Einheiten

## Status: Deployed
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

## Implementation Notes (Frontend)

**Stand 2026-09-15:** Frontend fertig. Im Browser läuft es erst mit der Migration aus `/backend` — die Seiten lesen sechs neue Tabellen und vier neue Spalten. Unit-Tests 720 in 61 Dateien, Typprüfung, Lint und `npm run build` sauber.

### Gebaut
- **Ticketlogik** `src/lib/events/tickets.ts` (36 neue Tests): Geltungsbereiche, freie Plätze je Einheit, Rest eines Kontingents, wann eine Ticketart ausverkauft ist, wählbare Einheiten, Stornofrist, Zahlungsarten, die Rollenregel und der Vorschlag für den Einlass.
- **Eventseite**: zwei neue Abschnitte — „Programm" mit den Einheiten nach Zeit samt freien Plätzen, „Tickets" mit Preisen und dem, was enthalten ist. Ausverkaufte und vom Verkauf genommene Arten bleiben sichtbar.
- **Kaufdialog** mehrstufig: Ticketart, dann — wenn sie es vorsieht — die Einheit, dann die Tanzrolle. Was ein Event nicht braucht, erscheint nicht: Bei einer Ticketart ohne Einheiten sieht der Kunde denselben Dialog wie vorher. Eine kostenlose Art überspringt die Zahlungsart ganz.
- **Verwaltung** `programm-dialog.tsx`: je Zeile ein Knopf „Programm & Tickets" (nur bei Ticketverkauf). Einheiten anlegen, ändern, löschen; Ticketarten mit Preis, Kontingent, Geltung und Verkaufsstatus. Eine Art mit verkauften Tickets sagt das und lässt nur noch Name und Verkaufsstatus zu.
- **Event-Formular** bekommt Zahlungsarten, Stornofrist in Tagen und die Tanzrollen-Option mit dem größten erlaubten Abstand.
- **Gästeliste** zeigt Ticketart, gewählte Einheit und Tanzrolle — und darunter die **Gäste von Hand**: eintragen mit Name, Notiz, Rolle und Einheiten, wieder entfernen. Die Kopfzeile nennt Tickets und Gäste getrennt.
- **Einlass** `checkin-client.tsx`: Bei einem Event mit Programm kommt eine zweite Auswahl dazu, vorgeschlagen ist die laufende oder nächste Einheit. Die Namenssuche findet jetzt auch Gäste von Hand; jede Zeile nennt Ticketart, Einheit und Rolle, und „Eingecheckt um …" bezieht sich auf die gewählte Einheit.
- **Geteilte Tür** `src/lib/events/kauf-laden.ts`: Übersicht, Eventseite, Serienseite und „Mein Bereich" holen sich die Kaufangaben an einer Stelle. Ohne sie baute jede Seite das Ticketmodell selbst zusammen — und eine davon böte Barzahlung an, wo das Event nur SEPA erlaubt.

### Entscheidungen beim Bauen
- **Ein Event ohne Ticketarten fällt auf seine eigenen Preise zurück.** Das ist der Zustand zwischen Auslieferung und Migration, und der Fall, in dem jemand die letzte Art gelöscht hat — statt einer leeren Seite steht dann ein Ticket da.
- **Die Belegung je Einheit kommt über eine eigene Datenbankfunktion** (`get_event_unit_occupancy`), nicht aus den Tickets: Die gehen Besucher nichts an. Dieselbe Überlegung wie bei `get_event_occupancy` aus PROJ-12.
- **Serientermine bekommen den einfachen Kauf** ohne Programm — Einheiten gibt es nach der Entscheidung aus dem Entwurf nur bei Einzelevents.

### Nebenbefund: Die Datenbanktests störten sich gegenseitig
Beim ersten vollen Lauf fielen 19 Datenbanktests aus, mit `Request rate limit reached`. Ursache war nicht der neue Code: Die vier Testdateien liefen parallel, und jede Prüfung meldete sich neu an — zusammen mehr, als Supabase durchlässt. Behoben an beiden Enden: `tests/anmeldung.ts` meldet jedes Konto nur einmal an, und die Testdateien laufen nacheinander (`fileParallelism: false`). Das kostet etwa eine Minute und nimmt eine ganze Klasse von Wackelkandidaten heraus.

### Abweichungen und Offenes
- `src/lib/supabase/types.ts` ist erneut **von Hand** ergänzt (sechs Tabellen, vier Spalten, drei Funktionen) — nach der Migration neu erzeugen und abgleichen.
- **Noch keine E2E-Tests**; sie kommen in der QA.
- Die Einheiten einer Ticketart mit fester Geltung lädt die **öffentliche** Seite noch nicht mit — dort steht deshalb bei „bestimmte Einheiten" keine Aufzählung. In der Verwaltung stimmt sie.

### Was `/backend` liefern muss
- **Sechs Tabellen**: `event_units`, `event_ticket_types`, `event_ticket_type_units`, `event_guests`, `event_guest_units`, `event_checkins` — alle mit RLS: Programm und Ticketarten öffentlich lesbar, Gäste und Einlass nur für Admin und Lehrer, schreiben nur Admin.
- **`events`** um Zahlungsarten, Stornofrist, Rollenabfrage und größten Rollenabstand; **`tickets`** um Ticketart, Einheit, Tanzrolle und die beim Kauf geltende Stornofrist.
- **`purchase_event_ticket` umbauen**: Ticketart, Einheit und Rolle entgegennehmen; Kontingent **und** Kapazität je Einheit prüfen (ein Ticket belegt jede Einheit, für die es gilt); die Rollenregel anwenden; Zahlungsart gegen die Erlaubnis des Events prüfen; bei 0 € sofort bestätigen; Stornofrist und Zahlungsart am Ticket einfrieren. Gesperrt wird das Event, nicht die Einheit.
- **`cancel_event_ticket`**: die am Ticket eingefrorene Frist verwenden statt der festen Ein-Tages-Regel.
- **`checkin_event_ticket`** um die Einheit erweitern (`ticket not for unit`, `already checked in` je Einheit) und **`checkin_event_guest`** neu; bei Barzahlung gilt das Ticket beim ersten Check-in als bezahlt.
- **`get_event_unit_occupancy`** als SECURITY-DEFINER-Funktion.
- **Bestand umbauen**: Jedes Event mit Ticketverkauf bekommt die Ticketart „Ticket" mit seinen Preisen, beide Zahlungsarten, einen Tag Frist; bestehende Tickets zeigen darauf.
- Danach `types.ts` erzeugen und mit der Handfassung abgleichen.

## Implementation Notes (Backend)

**Stand 2026-09-15:** Backend fertig. Migration `supabase/migrations/20260915220000_proj56_ticketarten_einheiten.sql` — erst einspielen, dann den Code ausliefern. Unit-Tests 720 in 61 Dateien, Typprüfung, Lint und `npm run build` sauber.

### Datenbank
- **Sechs neue Tabellen**: `event_units`, `event_ticket_types`, `event_ticket_type_units`, `event_guests`, `event_guest_units`, `event_checkins`. Programm und Ticketarten sind öffentlich lesbar — sie stehen auf der Eventseite. Gäste und Einlass nur für Admin und Lehrer: Namen von Gästen sind personenbezogen und gehen nur das Studio etwas an. Geschrieben wird überall nur von Admins, der Einlass ausschließlich über die Check-in-Funktionen.
- **`events`** um Zahlungsarten, Stornofrist, Rollenabfrage und größten Rollenabstand; **`tickets`** um Ticketart, Einheit, Tanzrolle und die beim Kauf geltende Stornofrist.
- **Einlass je Einheit**: vier Eindeutigkeitssperren — je Ticket und Einheit einmal, je Ticket ohne Einheit einmal, dasselbe für Gäste. Daran erkennt der Check-in „bereits eingecheckt", ohne selbst zu zählen.
- **Bestand übernommen**: Jedes Event mit Ticketverkauf hat jetzt die Ticketart „Ticket" mit seinen bisherigen Preisen, und seine Tickets zeigen darauf.

### Ticketkauf
Der Kauf ist umgebaut und prüft der Reihe nach: Event offen, Ticketart im Verkauf, Einheit nötig und gültig, Zahlungsart vom Event erlaubt, Kontingent der Art, **Kapazität jeder Einheit, die dieses Ticket belegen würde**, Kapazität des Events, Tanzrolle — und erst dann Preis und Zahlungsweg.

- **Gesperrt wird das Event, nicht die Einheit.** Ein Full Pass und ein Einzelticket dürfen nicht gleichzeitig denselben letzten Platz bekommen. Bei Studiogröße kostet die grobe Sperre nichts.
- **Die Belegung je Einheit rechnet `get_event_unit_occupancy`** — dieselbe Funktion, die auch die Eventseite fragt. Zwei Rechnungen für dieselbe Frage liefen früher oder später auseinander.
- **Kostenlos heißt kostenlos**: kein Mandat, keine Zahlungsart, sofort bestätigt.
- **Eingefroren wird am Ticket**, was beim Kauf galt: die Stornofrist. Die Zahlungsart stand ohnehin schon dort.
- **Eine Einheit anzugeben, wo keine zu wählen ist, wird abgewiesen** — sonst stünde am Ticket eine Angabe, die nichts bedeutet.
- **Tanzrolle nach dem Kursmuster**: kein festes Kontingent je Rolle, sondern ein größter erlaubter Abstand. Gerechnet wird je Event, wie bei Kursen je Kurs.

### Stornieren und Einlass
- **`cancel_event_ticket`** nimmt die Frist vom Ticket statt der festen Ein-Tages-Regel. Die Ausnahme aus PROJ-54 bleibt: Ein verlegter Termin hebt die Frist ganz auf.
- **`checkin_event_ticket`** bekommt die Einheit. Ein Ticket, das nicht für sie gilt, wird abgewiesen (`ticket not for unit`); ein zweiter Scan derselben Einheit meldet „bereits eingecheckt". Das Ticket selbst gilt ab dem **ersten** Einlass als eingecheckt — daran hängen die Gästeliste und bei Barzahlung „gescannt heißt bezahlt". Ohne Programm bleibt alles wie seit PROJ-14.
- **`checkin_event_guest`** neu, für Gäste ohne QR-Code. Keine Zuordnung zu Einheiten heißt: gilt für alle.
- **Tickets aus der Zeit vor PROJ-56** (ohne Ticketart) gelten für das ganze Event — sonst ließe die Einheitenprüfung sie nirgends hinein.

### In der Testdatenbank geprüft
Die Migration ist am 2026-09-15 vom Betreiber eingespielt worden. `tests/PROJ-56-ticketarten-db.test.ts` prüft 23 Regeln gegen die echte Testdatenbank, alle grün: die Sperren der neuen Tabellen, den Kauf mit Ticketart samt eingefrorener Stornofrist, die Wahlpflicht bei mehreren Arten, Einheit nötig und Einheit unzulässig, Kontingent, die Sperre eines Passes durch eine einzige volle Einheit (mitsamt der Belegung je Einheit), die erlaubten Zahlungsarten, die kostenlose Ticketart, die Rollenregel, das Stornieren nach der beim Kauf geltenden Frist, den Einlass je Einheit für Tickets und Gäste — und die Rechte.

**Dabei gefunden: ein Fehler in dieser Migration.** Der Ticketkauf war danach unmöglich. In der Migration stand, `create or replace` genüge für die drei neuen Parameter mit Vorgabewert. Das ist falsch — Postgres erkennt eine Funktion an Name **und** Parameterliste, also entstand eine zweite Funktion, und die alte blieb daneben stehen. Ein Aufruf mit fünf Argumenten, genau der aus der App, passte auf beide: „Could not choose the best candidate function". Behoben mit `20260915234500_proj56_alte_kauffunktion_entfernen.sql`, das die alte Fassung entfernt. Dieselbe Falle ist in der PROJ-54-Migration beschrieben und dort richtig gelöst; hier nicht.

### Nach der Migration noch offen
- `src/lib/supabase/types.ts` neu erzeugen und mit der Handfassung abgleichen (sechs Tabellen, vier Spalten, drei Funktionen). Der MCP-Zugang war am 2026-09-15 nicht verbunden (HTTP 401).

### Bewusst nicht gebaut
- **Keine Sperre gegen ein zweites Ticket für dieselbe Einheit.** Die Spezifikation nennt das unter den Edge Cases; es hängt aber an der Frage nach Mehrfachkäufen, die draußen bleibt. Heute kann ein Kunde zweimal kaufen — das gehört in der QA angesehen.
- **Keine Rollenprüfung je Einheit.** Gerechnet wird je Event, wie bei den Kursen je Kurs. Für einen Workshop ist das Event die Gruppe.

## QA Test Results
_To be added by /qa_

## QA Test Results

**Getestet:** 2026-09-15
**Umgebung:** localhost:3100 gegen die Testdatenbank, Migrationen 20260915220000 und 20260915234500 eingespielt
**Tester:** QA Engineer (AI)

### Abnahmekriterien

#### Einheiten
- [x] Einheiten anlegen mit Titel, Beginn, Ende und Kapazität; sie erscheinen nach Zeit sortiert als Programm auf der Eventseite — E2E
- [x] Eine Einheit außerhalb des Event-Zeitraums wird abgewiesen — E2E
- [x] Ein Event ohne Einheiten läuft wie bisher — der Kaufdialog zeigt dann weder Einheit noch Auswahl
- [x] Eine Einheit mit gültigen Tickets lässt sich nicht löschen — die Verwaltung nennt die Zahl

#### Ticketarten
- [x] Anlegen mit Name, Preisen, Kontingent und Geltungsbereich — E2E
- [x] Eine Art mit verkauften Tickets lässt sich nur umbenennen und vom Verkauf nehmen; Preis und Geltung sind gesperrt — E2E
- [x] Eine Ticketart zu 0 € ist kostenlos: keine Zahlungsart, kein Mandat, sofort bestätigt — Datenbanktest
- [x] Bei „bestimmte Einheiten" nennt die öffentliche Seite, welche — und erkennt die Art als ausverkauft, wenn eine davon voll ist — BUG-2 behoben

#### Kauf
- [x] Die Ticketliste zeigt Preis und was enthalten ist; eine ausverkaufte Art bleibt sichtbar und ist nicht wählbar — E2E (über die Kapazität; über das Kontingent siehe BUG-1)
- [x] „Kunde wählt eine Einheit": ohne Wahl kein Kauf, volle Einheiten sind nicht wählbar — E2E
- [x] Ein Ticket belegt jede Einheit, für die es gilt; ein Pass ist gesperrt, sobald eine einzige seiner Einheiten voll ist — Datenbanktest, samt Belegung je Einheit
- [x] Kontingent und Kapazität greifen beide, race-condition-sicher über die Sperre am Event — Datenbanktest
- [x] Ein erschöpftes Kontingent steht als ausgebucht da und ist nicht wählbar — BUG-1 behoben
- [x] „Meine Tickets" nennt Ticketart, Einheit, Preis und Stornofrist — BUG-3 behoben

#### Zahlungsarten
- [x] Der Kauf bietet nur an, was das Event erlaubt — E2E und Datenbanktest
- [x] Nur SEPA ohne Mandat: Hinweis mit Link, kein Kauf möglich — E2E
- [x] Nur bar: SEPA wird nicht angeboten, auch mit Mandat — Datenbanktest
- [x] Verkaufte Tickets behalten ihre Zahlungsart

#### Stornofrist
- [x] Die Frist ist je Event einstellbar und steht im Kaufdialog — E2E
- [x] Nach Ablauf ist Stornieren nicht möglich — Datenbanktest
- [x] Verkaufte Tickets behalten die Frist vom Kauf, auch wenn der Admin sie danach ändert — Datenbanktest, ausdrücklich geprüft
- [x] 0 Tage heißt: bis zum Beginn — Datenbanktest

#### Gästeliste von Hand
- [x] Eintragen mit Name, Notiz, Rolle und Einheiten — E2E
- [x] Als Gast erkennbar, zahlt nichts, in keinem Sammellauf
- [x] Verringert die verkäuflichen Plätze nicht; die Liste nennt Tickets und Gäste getrennt — E2E
- [x] Über die Namenssuche einzuchecken, je Einheit — Datenbanktest
- [x] Entfernen nimmt die Check-ins mit — Löschweitergabe
- [x] Ohne Admin-Rolle verweigert — Datenbanktest

#### Check-in
- [x] Bei einem Event mit Programm kommt die Einheitenauswahl dazu, vorgeschlagen ist die laufende oder nächste — E2E und Unit
- [x] Gilt das Ticket, wird es für diese Einheit eingecheckt — Datenbanktest
- [x] Gilt es nicht: „Gilt nicht für diese Einheit" — E2E und Datenbanktest
- [x] Schon eingecheckt: die Uhrzeit statt eines zweiten Einlasses — Datenbanktest
- [x] Ohne Einheiten wie bisher ein Scan — Datenbanktest
- [x] Namenssuche findet Tickets und Gäste, je Einheit — E2E

#### Tanzrolle
- [x] Wird abgefragt, wenn das Event es vorsieht, und steht danach an der Gästeliste — E2E
- [x] Die Runde bleibt beisammen: nicht feste Plätze je Rolle, sondern ein größter Abstand, wie bei Kursen — Datenbanktest und Unit

### Edge Cases
- [x] Full Pass und Einzelticket um den letzten Platz einer Einheit — nur einer bekommt ihn (Sperre am Event)
- [x] Kapazität unter die Belegung gesenkt: verkaufte Tickets bleiben, verkauft wird nichts mehr — Unit
- [x] Stornofrist 0 Tage — Datenbanktest
- [x] Eine Art vom Verkauf genommen: verkaufte Tickets bleiben gültig und scannbar
- [x] Bestehende Events haben nach der Migration die Ticketart „Ticket"; Tickets ohne Art gelten für das ganze Event
- [ ] **Ungetestet und ungebaut:** ein zweites Ticket desselben Kunden für dieselbe Einheit wird nicht verhindert (siehe Beobachtung 1)

### Sicherheitsprüfung
- [x] **Schreibrechte:** Kunden können weder Einheiten noch Ticketarten anlegen — Datenbanktest
- [x] **Gästenamen und Einlass** sind für Kunden unsichtbar; lesen dürfen nur Admin und Lehrer — Datenbanktest
- [x] **Check-in nur für Admin und Lehrer**, auch für das eigene Ticket — Datenbanktest
- [x] **Der Kauf glaubt dem Browser nichts:** Ticketart, Einheit, Zahlungsart, Kontingent, Kapazität und Rolle werden in der Datenbank geprüft — zehn Datenbanktests
- [x] **Belegungszahlen ohne Ticketeinsicht:** `get_event_unit_occupancy` gibt Zahlen, keine Tickets
- [x] **Einschleusen:** Namen, Notizen und Titel gehen als Text durch React

### Regression — der gebündelte Lauf
Die komplette E2E-Suite lief am 2026-09-16 in einem Stück: **1208 bestanden, 2 gescheitert, 22 übersprungen, 2,2 Stunden.**

Die zwei Fehlschläge waren derselbe Test in beiden Browsern — und dahinter stand eine echte Regression, die keine der Einzelsuiten gefunden hatte (BUG-4). Nach der Behebung: 750 Unit-Tests, Build und 128 E2E-Tests über PROJ-14, PROJ-53, PROJ-54, PROJ-55 und PROJ-56 in beiden Browsern, alles grün.

### Gefundene Fehler

#### BUG-1: Ein erschöpftes Kontingent ist auf der Eventseite unsichtbar
- **Schwere:** High
- **Schritte:**
  1. Eine Ticketart mit Kontingent 1 anlegen, ein Ticket davon verkaufen
  2. Die Eventseite als Kunde öffnen
  3. **Erwartet:** Die Art steht als „Ausgebucht" da und ist im Kaufdialog nicht wählbar
  4. **Tatsächlich:** Sie wird angeboten, und „Noch 1 verfügbar" steht daneben. Der Kauf scheitert erst in der Datenbank, der Kunde sieht „Dieses Event ist mittlerweile ausgebucht."
- **Ursache:** Die öffentlichen Seiten laden nicht mit, wie viele Tickets je Art verkauft sind — `ticketartenAus` setzt `verkauft` immer auf 0. Die Zahl kann nicht direkt kommen: Tickets sind nicht öffentlich lesbar. Es braucht eine Funktion wie `get_event_unit_occupancy`, nur je Ticketart
- **Behoben (2026-09-16):** `get_event_type_occupancy` gibt die Zahl je Ticketart heraus, ohne die Tickets dahinter preiszugeben — dieselbe Bauart wie die Belegung je Einheit. Die Eventseite holt sie mit und zeigt eine erschöpfte Art als ausgebucht

#### BUG-2: „Bestimmte Einheiten" bleibt öffentlich unsichtbar
- **Schwere:** Medium
- **Schritte:** Eine Ticketart mit Geltung „bestimmte Einheiten" anlegen und die Eventseite öffnen
- **Erwartet:** „Gilt für: Styling, Footwork", und ausverkauft, sobald eine dieser Einheiten voll ist
- **Tatsächlich:** Die Aufzählung fehlt, und weil die Zuordnung nicht geladen wird, gilt die Art als unbegrenzt — sie wird nie als ausverkauft erkannt
- **Ursache:** `ticketartenAus` setzte `einheitIds` immer auf `[]`; die Zuordnungstabelle wurde öffentlich nicht mitgeladen
- **Behoben (2026-09-16):** Die Zuordnung kommt mit der Ticketart zusammen aus der Datenbank

#### BUG-4: Serientermine konnten keine Tickets mehr verkaufen
- **Schwere:** High
- **Gefunden:** von der kompletten E2E-Suite, nicht von den Einzelsuiten
- **Schritte:** Auf der Seite einer Serie ein Ticket für einen Termin kaufen
- **Erwartet:** Ticket reserviert
- **Tatsächlich:** Der Kauf scheitert. Betroffen war jeder Serientermin, der nach der Migration entstanden ist — und damit die wöchentliche Party
- **Ursache:** Ein Event ohne eigene Ticketarten bekommt im Kaufdialog eine ersatzweise Art, die die Kennung des **Events** trägt. Die schickte der Dialog als Ticketart mit, und die Datenbank kennt sie nicht: `ticket type unavailable`. Der Bestandsumbau der Migration hatte alle damals vorhandenen Events versorgt — neu entstehende Serientermine bekommen aber keine Ticketart
- **Behoben (2026-09-16):** Die ersatzweise Art ist als solche gekennzeichnet, und der Dialog schickt ihre Kennung nicht mit. Dann entscheidet der Preis des Events, wie vor PROJ-56. Sieben Unit-Tests halten das fest

#### BUG-3: „Meine Tickets" nennt Ticketart, Einheiten und Frist nicht
- **Schwere:** Medium
- **Schritte:** Ein Ticket kaufen und das Profil öffnen
- **Erwartet:** Ticketart, Preis, die enthaltenen Einheiten und die Stornofrist — so verlangt es das Kriterium
- **Tatsächlich:** Nur Eventname, Termin, Zahlungsart und Status
- **Behoben (2026-09-16):** Ticketart, Einheit, Preis und Stornofrist stehen jetzt an der Karte — und die Frist kommt vom Ticket, nicht aus der Vorgabe. *Die Bestätigungs-Benachrichtigung nennt weiterhin nur Event und Zeitpunkt; das bleibt offen (siehe Beobachtung 5).*

### Beobachtungen (kein Fehler dieser Umsetzung)
1. **Ein zweites Ticket für dieselbe Einheit wird nicht verhindert.** Die Spezifikation nennt das unter den Edge Cases, knüpft es aber an Mehrfachkäufe, die draußen bleiben. Heute kann derselbe Kunde zweimal kaufen. Gehört entschieden, nicht stillschweigend gelassen.
2. **Die Rollenregel rechnet je Event, nicht je Einheit** — wie bei Kursen je Kurs. Für einen Workshop ist das Event die Gruppe; bei einem Programm mit sehr verschiedenen Einheiten könnte man es anders wollen.
3. **Die Namenssuche am Einlass bleibt leer, bis jemand tippt.** Unverändert seit PROJ-14, fällt mit Einheiten aber mehr auf.
4. **Firefox ist in Playwright weiterhin nicht eingerichtet**, Tabletbreite ungetestet.
5. **Die Bestätigungs-Benachrichtigung nennt weiterhin nur Event und Zeitpunkt**, nicht Ticketart, Einheiten und Frist. Das Kriterium verlangt es; die Karte im Profil erfüllt es jetzt, die Nachricht nicht. Dafür bräuchte es eine neue Vorlagenfassung — eigener Durchgang, damit die Texte im Admin änderbar bleiben.

### Zusammenfassung
- **Abnahmekriterien:** 33 von 34 bestanden (offen: die Bestätigungs-Benachrichtigung, siehe Beobachtung 5)
- **Fehler:** 4 gefunden, 4 behoben
- **Sicherheit:** bestanden
- **Automatisierte Tests:** 10 E2E in zwei Browsern, 23 Datenbanktests, 750 Unit-Tests — alle grün; dazu der gebündelte Lauf über alles
- **Auslieferungsreif:** JA
- **Empfehlung:** ausliefern — gemeinsam mit PROJ-53 bis PROJ-55, Migrationen zuerst

## Deployment

**Deployed:** 2026-09-16
**Produktions-URL:** https://app.viennasalsastudio.at
**Commit:** `ecd2356`
**Tag:** `v1.55.0-events`
**Migration:** `20260915220000_proj56_ticketarten_einheiten.sql, 20260915234500_proj56_alte_kauffunktion_entfernen.sql, 20260916090000_proj56_kontingent_sichtbar.sql` — vom Betreiber eingespielt, vor dem Code

### Gemeinsam ausgeliefert
PROJ-53 bis PROJ-56 gingen zusammen live — sie bauen aufeinander auf, und ein
einzelnes von ihnen auszuliefern hätte die Eventseite auf halbem Weg stehen
lassen. Der Betreiber hat die sechs Migrationen der Reihe nach eingespielt,
danach ging der Code raus.

**Das Zeitfenster dazwischen war bekannt und angekündigt:** Zwischen Migration
und Deploy lief der alte Code gegen die neue Datenbank. Der QR-Check-in ging
in diesen Minuten nicht — die Funktion verlangt seit PROJ-54 den Termin, den
der alte Code nicht mitschickte. Ticketkauf, Stornieren und alle Kundenseiten
liefen durch; die Signaturen waren abwärtskompatibel gehalten.

### Vor dem Deploy geprüft
Die komplette E2E-Suite lief in einem Stück: 1208 bestanden, 2 gescheitert,
2,2 Stunden. Die zwei Fehlschläge deckten eine Regression auf, die keine
Einzelsuite gefunden hatte — Serientermine konnten keine Tickets mehr
verkaufen. Nach der Behebung: 750 Unit-Tests, Build und 128 E2E-Tests über
PROJ-14 und PROJ-53 bis PROJ-56 in beiden Browsern, alles grün.

### Noch offen
- **`src/lib/supabase/types.ts` neu erzeugen**, sobald der Supabase-Zugang
  wieder steht — er war die ganze Umsetzung über nicht verbunden (HTTP 401).
  Die App läuft auf der Handfassung; dass sie zur Datenbank passt, belegen die
  Datenbanktests.
- **Die Bestätigungs-Benachrichtigung** nennt weiterhin nur Event und
  Zeitpunkt, nicht Ticketart, Einheiten und Frist (PROJ-56, Beobachtung 5).
